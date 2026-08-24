/**
 * 文件职责：懒加载 OpenRouter 图片实现并注册内置图片 API 提供方。
 * 技术维度：使用泛型、Promise 缓存、动态 ESM 导入和统一错误结果。
 * 产品维度：仅在生成图片时加载实现，降低启动成本并友好呈现加载失败。
 * 逻辑维度：缓存模块加载；包装生成调用和错误；注册包装函数并在加载时执行。
 * 关键边界：首次导入失败的 Promise 会被缓存；错误结果不含图片且不会自动重试。
 * 新手阅读建议：从底部注册调用向上读，依次理解包装函数、加载和错误构造。
 */
import type { generateImages as generateImagesOpenRouterFunction } from "../../api/openrouter-images.ts";
import { registerImagesApiProvider } from "../../images-api-registry.ts";
import type { AssistantImages, ImagesContext, ImagesFunction, ImagesModel, ImagesOptions } from "../../types.ts";

/** 懒加载模块的最小接口。 */
interface OpenRouterImagesProviderModule {
	/** 与真实 OpenRouter 图片函数相同的导出。 */
	generateImages: typeof generateImagesOpenRouterFunction;
}

/** 共享模块加载 Promise；首次调用前为 undefined。 */
let openRouterImagesProviderModulePromise: Promise<OpenRouterImagesProviderModule> | undefined;

/**
 * 把未知异常转换为图片错误消息。
 * @param model 本次请求模型。
 * @param error 加载或调用异常。
 * @returns 无图片且 stopReason=error 的结果。
 * @example `createLazyLoadErrorImages(model, new Error("failed"))`。
 */
function createLazyLoadErrorImages(model: ImagesModel<"openrouter-images">, error: unknown): AssistantImages {
	return {
		api: model.api,
		provider: model.provider,
		model: model.id,
		output: [],
		stopReason: "error",
		errorMessage: error instanceof Error ? error.message : String(error),
		timestamp: Date.now(),
	};
}

/**
 * 加载并缓存 OpenRouter 图片模块。
 * @returns 解析为最小接口的共享 Promise。
 * @example `await loadOpenRouterImagesProviderModule()`。
 */
function loadOpenRouterImagesProviderModule(): Promise<OpenRouterImagesProviderModule> {
	// module 是动态导入的 ESM 命名空间，按已知导出收窄。
	openRouterImagesProviderModulePromise ||= import("../../api/openrouter-images.ts").then(
		(module) => module as OpenRouterImagesProviderModule,
	);
	return openRouterImagesProviderModulePromise;
}

/** OpenRouter 图片生成包装函数；成功委托，失败返回结构化错误。 */
export const generateImagesOpenRouter: ImagesFunction<"openrouter-images", ImagesOptions> = async (
	/** 请求模型。 */
	model: ImagesModel<"openrouter-images">,
	/** 图片生成上下文。 */
	context: ImagesContext,
	/** 可选生成参数。 */
	options?: ImagesOptions,
) => {
	try {
		/** 懒加载得到的实现模块。 */
		const module = await loadOpenRouterImagesProviderModule();
		return await module.generateImages(model, context, options);
	} catch (error) {
		return createLazyLoadErrorImages(model, error);
	}
};

/**
 * 注册内置图片 API。
 * @returns 无返回值；注册表会增加 openrouter-images。
 * @example `registerBuiltInImagesApiProviders()`。
 */
export function registerBuiltInImagesApiProviders(): void {
	registerImagesApiProvider({
		api: "openrouter-images",
		generateImages: generateImagesOpenRouter,
	});
}

registerBuiltInImagesApiProviders();
