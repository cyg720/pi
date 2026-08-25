#!/usr/bin/env node
/**
 * 文件职责：从 OpenRouter 模型接口抓取图片生成模型，并生成项目使用的 image-models.generated.ts 静态目录。
 * 技术维度：使用 Node.js fetch、TypeScript 类型收窄、模态过滤、价格换算和确定性字符串序列化生成源码。
 * 产品维度：让用户及时获得可用图片模型、输入输出模态和成本信息，供模型选择与费用展示使用。
 * 逻辑维度：解析 strict 参数，校验并转换远端数据，按模型 ID 排序生成文件，最后写入包源码目录。
 * 关键边界：依赖 OpenRouter 在线响应；strict 模式遇到空数据或请求失败会退出，生成文件禁止手工编辑。
 * 新手阅读建议：先看 OpenRouterModelRecord 与 parseOpenRouterImageModels，再阅读 generateImageModelsFile 的模板结构。
 */

import { writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import type { ImagesModel } from "../src/types.ts";

// __filename 是当前 ESM 脚本对应的本机绝对文件路径。
const __filename = fileURLToPath(import.meta.url);
// __dirname 是当前脚本所在目录，用于稳定计算包根目录。
const __dirname = dirname(__filename);
// packageRoot 指向 packages/ai，生成文件路径以此为基准。
const packageRoot = join(__dirname, "..");
// OPENROUTER_BASE_URL 是查询图片模型目录及生成模型请求共用的 API 根地址。
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * 解析命令行的 strict 开关并拒绝未知参数。
 * @param args 去掉 node 和脚本名后的参数数组。
 * @returns 是否包含 `--strict`；例如 `readStrictOption(["--strict"])` 返回 true。
 */
function readStrictOption(args: string[]): boolean {
	// arg 是当前命令行参数；除 --strict 外的值都会触发错误。
	for (const arg of args) {
		if (arg !== "--strict") throw new Error(`Unknown argument: ${arg}`);
	}
	return args.includes("--strict");
}

// OpenRouterModelRecord 描述远端模型列表中本生成器实际使用的字段，其他字段会被忽略。
interface OpenRouterModelRecord {
	id: string;
	name: string;
	context_length?: number;
	architecture?: {
		input_modalities?: string[];
		output_modalities?: string[];
	};
	pricing?: {
		prompt?: string;
		completion?: string;
		input_cache_read?: string;
		input_cache_write?: string;
	};
}

/**
 * 把未知 OpenRouter 响应转换为项目统一的图片模型元数据。
 * @param payload 远端 JSON 响应，运行时会检查 data 是否为非空数组。
 * @param strict 为 true 时空列表或无可用图片模型会抛错。
 * @returns 仅包含图片输出模型的数组；例如 `parseOpenRouterImageModels({ data: [] }, false)` 返回空数组。
 */
export function parseOpenRouterImageModels(
	payload: unknown,
	strict: boolean,
): ImagesModel<"openrouter-images">[] {
	// data 仅在 payload 为对象时读取其可选 data 字段，否则视为无数据。
	const data =
		typeof payload === "object" && payload !== null
			? (payload as { data?: OpenRouterModelRecord[] }).data
			: undefined;
	if (!Array.isArray(data) || data.length === 0) {
		if (strict) throw new Error("OpenRouter API returned a missing or empty image model list");
		return [];
	}

	// models 逐项累积验证通过并支持图片输出的模型元数据。
	const models: ImagesModel<"openrouter-images">[] = [];
	for (const model of data) {
		// input 对远端输入模态去重，并只保留项目支持的 text/image。
		const input = Array.from(
			new Set(
				(model.architecture?.input_modalities ?? []).filter(
					(modality): modality is "text" | "image" => modality === "text" || modality === "image",
				),
			),
		);
		// output 对输出模态做相同过滤，后续要求必须包含 image。
		const output = Array.from(
			new Set(
				(model.architecture?.output_modalities ?? []).filter(
					(modality): modality is "text" | "image" => modality === "text" || modality === "image",
				),
			),
		);

		if (!output.includes("image")) continue;
		if (input.length === 0) input.push("text");

		models.push({
			id: model.id,
			name: model.name,
			api: "openrouter-images",
			provider: "openrouter",
			baseUrl: OPENROUTER_BASE_URL,
			input,
			output,
			cost: {
				input: parseFloat(model.pricing?.prompt || "0") * 1_000_000,
				output: parseFloat(model.pricing?.completion || "0") * 1_000_000,
				cacheRead: parseFloat(model.pricing?.input_cache_read || "0") * 1_000_000,
				cacheWrite: parseFloat(model.pricing?.input_cache_write || "0") * 1_000_000,
			},
		});
	}

	if (strict && models.length === 0) {
		throw new Error("OpenRouter API returned no usable image models");
	}
	return models;
}

/**
 * 从 OpenRouter 在线接口读取并解析图片模型列表。
 * @param strict 是否在网络或数据错误时继续抛出异常。
 * @returns 图片模型数组；非严格模式失败时返回空数组，例如 `await fetchOpenRouterImageModels(false)`。
 */
async function fetchOpenRouterImageModels(strict: boolean): Promise<ImagesModel<"openrouter-images">[]> {
	try {
		console.log("Fetching image models from OpenRouter API...");
		// response 是 OpenRouter 按图片输出模态过滤后的模型列表响应。
		const response = await fetch(`${OPENROUTER_BASE_URL}/models?output_modalities=image`);
		if (!response.ok) throw new Error(`OpenRouter API returned ${response.status}`);
		// models 是经过结构检查、模态过滤和价格换算后的项目模型数组。
		const models = parseOpenRouterImageModels(await response.json(), strict);
		console.log(`Fetched ${models.length} image models from OpenRouter`);
		return models;
	} catch (error) {
		// error 是获取或解析 OpenRouter 目录时捕获的异常，strict 模式会继续抛出。
		console.error("Failed to fetch OpenRouter image models:", error);
		if (strict) throw error;
		return [];
	}
}

/**
 * 把图片模型数组序列化为可直接提交的 TypeScript 模块文本。
 * @param models 待生成的 OpenRouter 图片模型；函数会按 ID 原地排序。
 * @returns 完整源码字符串；例如 `generateImageModelsFile([])` 生成空提供商映射。
 */
function generateImageModelsFile(models: ImagesModel<"openrouter-images">[]): string {
	// imageModelsByProvider 构造提供商到模型 ID/源码片段的两级映射。
	const imageModelsByProvider = {
		openrouter: Object.fromEntries(
			models
				.sort((a, b) => a.id.localeCompare(b.id))
				.map((model) => [
					model.id,
					`{
			id: ${JSON.stringify(model.id)},
			name: ${JSON.stringify(model.name)},
			api: ${JSON.stringify(model.api)},
			provider: ${JSON.stringify(model.provider)},
			baseUrl: ${JSON.stringify(model.baseUrl)},
			input: ${JSON.stringify(model.input)},
			output: ${JSON.stringify(model.output)},
			cost: ${JSON.stringify(model.cost, null, 2).replace(/^/gm, "\t")}
		} satisfies ImagesModel<${JSON.stringify(model.api)}>`,
				]),
		),
	};

	// providerEntries 把每个提供商映射序列化为 IMAGE_MODELS 对象成员源码。
	const providerEntries = Object.entries(imageModelsByProvider)
		.map(([provider, providerModels]) => {
			// modelEntries 是当前提供商下按行拼接的模型属性源码。
			const modelEntries = Object.entries(providerModels)
				.map(([id, serialized]) => `\t\t${JSON.stringify(id)}: ${serialized},`)
				.join("\n");
			return `\t${JSON.stringify(provider)}: {\n${modelEntries}\n\t},`;
		})
		.join("\n");

	return `// This file is auto-generated by scripts/generate-image-models.ts
// 此文件由 scripts/generate-image-models.ts 自动生成。
// Do not edit manually - run 'npm run generate-image-models' to update
// 请勿手工编辑；应运行 npm run generate-image-models 更新。
// 文件职责：提供图片模型的静态注册目录，供运行时按提供商和模型 ID 查询。
// 技术维度：使用 TypeScript const 对象与 satisfies 约束，保留字面量类型并校验模型结构。
// 产品维度：为图片生成模型选择、能力判断和费用展示提供内置元数据。
// 逻辑维度：按提供商分组，再以模型 ID 映射到完整 ImagesModel 配置。
// 关键边界：内容来自生成脚本和 OpenRouter 数据，禁止手工修改，更新时必须重新生成。
// 新手阅读建议：先看 IMAGE_MODELS 的两级键，再对照 ImagesModel 类型理解每个字段。

import type { ImagesApi, ImagesModel } from "./types.ts";

/** IMAGE_MODELS 是按提供商和模型 ID 建立的只读图片模型目录，运行时用它查询能力与费用元数据。 */
export const IMAGE_MODELS = {
${providerEntries}
} as const satisfies Record<string, Record<string, ImagesModel<ImagesApi>>>;
`;
}

/**
 * 执行命令行生成流程并写入目标文件。
 * @returns 写入完成后结束的 Promise；例如直接运行脚本时由入口调用 `main()`。
 */
async function main(): Promise<void> {
	// strict 表示是否把远端或数据异常视为生成失败。
	const strict = readStrictOption(process.argv.slice(2));
	// models 是从 OpenRouter 获取并规范化后的图片模型列表。
	const models = await fetchOpenRouterImageModels(strict);
	// output 是将写入生成文件的完整 TypeScript 源码文本。
	const output = generateImageModelsFile(models);
	// outputPath 是 packages/ai/src/image-models.generated.ts 的绝对路径。
	const outputPath = join(packageRoot, "src", "image-models.generated.ts");
	writeFileSync(outputPath, output, "utf-8");
	console.log(`Generated ${outputPath}`);
}

// 只有直接执行脚本时才运行 main；作为测试模块导入时不会写文件。
if (process.argv[1] && resolve(process.argv[1]) === __filename) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
