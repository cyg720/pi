/**
 * 【文件职责】Bedrock Converse 流的懒加载入口：用变量说明符动态导入 Bedrock 实现，
 *              避免打包器（浏览器 smoke/Bun 编译）追踪进仅 Node 可用的 AWS SDK；
 *              并支持 Bun 二进制构建静态注册替代模块。
 * 【技术维度】import.meta.url 判断 .js/.ts 以重写说明符；模块覆盖（override）机制。
 * 【产品维度】保证 Bedrock 能力在浏览器/独立二进制等受限环境中不因静态导入而崩溃。
 * 【逻辑维度】importNodeOnlyApi 动态导入 → setBedrockProviderModule 覆盖 →
 *              bedrockConverseStreamApi 返回 lazyApi 包装。
 * 【关键边界】覆盖一旦设置即优先于动态导入；动态导入失败会以流错误呈现。
 * 【新手阅读建议】理解"变量说明符 + 覆盖机制"两点即可。
 */
import type { ProviderStreams } from "../types.ts";
import { lazyApi } from "./lazy.ts";

/**
 * Loads the bedrock implementation through a variable specifier so bundlers
 * (browser smoke, Bun compile) cannot follow the import into the Node-only
 * AWS SDK. The `.ts`/`.js` rewrite keeps the trick working from both source
 * and built output.
 */
// 用变量说明符动态导入 Bedrock 实现（私有）：打包器无法静态跟踪进 Node 专属 AWS SDK；
// 按运行环境重写 .ts/.js 后缀使技巧在源码与构建产物中都生效
const importNodeOnlyApi = (specifier: string): Promise<unknown> => {
	const runtimeSpecifier = import.meta.url.endsWith(".js") ? specifier.replace(/\.ts$/, ".js") : specifier;
	return import(runtimeSpecifier);
};

// 可选的 Bedrock 模块覆盖
let bedrockModuleOverride: ProviderStreams | undefined;

/**
 * Overrides the dynamically imported bedrock implementation. Used by the Bun
 * binary build, where the variable-specifier import cannot be bundled; the
 * build registers a statically imported module instead.
 */
// 覆盖动态导入的 Bedrock 实现（公开）：Bun 二进制构建用——变量说明符导入无法被打包，
// 构建时改为注册静态导入的模块
export function setBedrockProviderModule(module: ProviderStreams): void {
	bedrockModuleOverride = module;
}

// 返回 Bedrock Converse 流的 ProviderStreams（公开）：优先覆盖模块，否则动态导入
export const bedrockConverseStreamApi = (): ProviderStreams =>
	lazyApi(
		async () =>
			bedrockModuleOverride ?? ((await importNodeOnlyApi("./bedrock-converse-stream.ts")) as ProviderStreams),
	);
