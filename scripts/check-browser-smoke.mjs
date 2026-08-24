/**
 * 文件职责：通过浏览器打包冒烟检查验证 AI/Agent 入口可被 esbuild 打包且供应商代码可正确摇树优化。
 * 技术维度：使用 esbuild、metafile 依赖图、自定义生成目录插件和临时输出/错误日志。
 * 产品维度：防止浏览器集成意外携带全部模型目录或大型 SDK，控制前端包体和运行兼容性。
 * 逻辑维度：先打包基础入口，再分析选择性 Agent 包输入，检查目录 JSON 与 SDK 唯一性，失败时写日志。
 * 关键边界：未水合模型数据时插件只返回空 JSON；选择性包必须仅含 anthropic.json 与 Anthropic SDK。
 * 新手阅读建议：先看两个 build 调用，再按 forbiddenInput、catalogInputs、includedAiSdkPackages 三层断言阅读。
 */
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { build } from "esbuild";

// 基础浏览器冒烟包的临时输出路径。
const outputPath = join(tmpdir(), "pi-browser-smoke.js");
// Agent 摇树检查包的临时输出路径。
const agentTreeshakeOutputPath = join(tmpdir(), "pi-agent-treeshake-smoke.js");
// 失败详情日志路径，供精简终端错误指引定位。
const errorLogPath = join(tmpdir(), "pi-browser-smoke-errors.log");
// 生成供应商 JSON 目录的绝对路径。
const generatedCatalogDataDir = join(process.cwd(), "packages/ai/src/providers/data");

// Fresh checkouts do not materialize provider JSON until model data is hydrated.
// 中文说明：新检出仓库尚未水合模型 JSON，插件会为缺失目录文件提供空对象。
// 处理缺失生成模型目录的 esbuild 插件。
const generatedCatalogDataPlugin = {
	name: "generated-model-catalog",
	setup(build) {
		build.onResolve({ filter: /^\.\/data\/[^/]+\.json$/ }, (args) => {
			const path = resolve(dirname(args.importer), args.path);
			if (dirname(path) !== generatedCatalogDataDir || existsSync(path)) return;
			return { path, namespace: "empty-generated-model-catalog" };
		});
		build.onLoad({ filter: /.*/, namespace: "empty-generated-model-catalog" }, () => ({
			contents: "{}",
			loader: "json",
		}));
	},
};

/** 功能：统一路径分隔符；参数 path；返回：正斜杠路径。示例：normalizePath(input)。 */
function normalizePath(path) {
	return path.replaceAll("\\", "/");
}

/** 功能：按后缀寻找 metafile 输入；参数 inputs、suffix；返回：匹配路径或 undefined。示例：findInput(inputs, "src/a.ts")。 */
function findInput(inputs, suffix) {
	return Object.keys(inputs).find((input) => {
		// 当前输入的跨平台标准化路径。
		const normalized = normalizePath(input);
		return normalized === suffix || normalized.endsWith(`/${suffix}`);
	});
}

/** 功能：判断输入图是否包含指定 node_modules 包；参数 inputs、packageName；返回：布尔值。示例：includesNodePackage(inputs, "openai")。 */
function includesNodePackage(inputs, packageName) {
	// 用于避免包名前缀误匹配的完整目录标记。
	const marker = `node_modules/${packageName}/`;
	return Object.keys(inputs).some((input) => normalizePath(input).includes(marker));
}

try {
	await build({
		entryPoints: ["scripts/browser-smoke-entry.ts"],
		bundle: true,
		platform: "browser",
		format: "esm",
		logLevel: "silent",
		outfile: outputPath,
		plugins: [generatedCatalogDataPlugin],
	});

	// Agent 选择性入口的内存构建结果，metafile 用于依赖图检查。
	const agentTreeshakeBuild = await build({
		entryPoints: ["scripts/agent-treeshake-smoke-entry.ts"],
		bundle: true,
		platform: "browser",
		format: "esm",
		logLevel: "silent",
		metafile: true,
		outfile: agentTreeshakeOutputPath,
		plugins: [generatedCatalogDataPlugin],
		write: false,
	});
	// 构建依赖图中的全部输入对象。
	const inputs = agentTreeshakeBuild.metafile.inputs;
	for (const forbiddenInput of [
		"packages/ai/src/compat.ts",
		"packages/ai/src/models.generated.ts",
		"packages/ai/src/providers/all.ts",
	]) {
		// 当前被禁止输入在图中的实际路径；未找到时为 undefined。
		const includedInput = findInput(inputs, forbiddenInput);
		if (includedInput) {
			throw new Error(`Agent selective-provider bundle unexpectedly includes ${includedInput}`);
		}
	}

	// 对最终输出实际贡献字节的输入集合。
	const contributingInputs = new Set(
		Object.values(agentTreeshakeBuild.metafile.outputs).flatMap((output) =>
			Object.entries(output.inputs)
				.filter(([, contribution]) => contribution.bytesInOutput > 0)
				.map(([input]) => input),
		),
	);
	// 贡献内容的供应商目录 JSON 输入。
	const catalogInputs = Array.from(contributingInputs).filter((input) =>
		normalizePath(input).includes("packages/ai/src/providers/data/"),
	);
	if (catalogInputs.length !== 1 || !normalizePath(catalogInputs[0]).endsWith("/anthropic.json")) {
		throw new Error(
			`Agent selective-provider bundle catalogs: expected only anthropic.json, found ${catalogInputs.join(", ") || "none"}`,
		);
	}

	// 不应同时进入选择性浏览器包的所有 AI SDK 名称。
	const aiSdkPackages = [
		"@anthropic-ai/sdk",
		"@aws-sdk/client-bedrock-runtime",
		"@google/genai",
		"@mistralai/mistralai",
		"openai",
	];
	// 实际出现在构建输入图中的 AI SDK。
	const includedAiSdkPackages = aiSdkPackages.filter((packageName) => includesNodePackage(inputs, packageName));
	if (
		includedAiSdkPackages.length !== 1 ||
		includedAiSdkPackages[0] !== "@anthropic-ai/sdk"
	) {
		throw new Error(
			`Agent selective-provider bundle SDKs: expected only @anthropic-ai/sdk, found ${includedAiSdkPackages.join(", ") || "none"}`,
		);
	}

	process.exit(0);
} catch (error) {
	// 从 esbuild 结构化错误中提取的逐行详情。
	let detailedErrors = "";
	if (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors)) {
		detailedErrors = error.errors
			.map((entry) => {
				// 当前 esbuild 错误的可选文件、行、列位置。
				const location = entry.location
					? `${entry.location.file}:${entry.location.line}:${entry.location.column}`
					: "";
				return [location, entry.text].filter(Boolean).join(" ");
			})
			.join("\n");
	}

	// 普通 Error 或未知异常的基础描述。
	const baseError = error instanceof Error ? (error.stack ?? error.message) : String(error);
	writeFileSync(errorLogPath, [detailedErrors, baseError].filter(Boolean).join("\n\n"), "utf-8");
	console.error(`Browser smoke check failed. See ${errorLogPath}`);
	process.exit(1);
}
