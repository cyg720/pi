/**
 * 文件职责：验证 AI 包入口采用懒加载，不会在无需要时提前载入各供应商 SDK。
 * 技术维度：使用 Node registerHooks 监控模块解析，并通过子进程动态导入不同入口执行探针。
 * 产品维度：减少普通启动的内存与加载开销，同时确保真正调用 Anthropic 时只加载对应 SDK。
 * 逻辑维度：拼装探针脚本、执行子进程、解析最后一行 JSON，再用五个场景比较已加载模块。
 * 关键边界：依赖 Node 的模块钩子与 TypeScript 运行配置；子进程失败或无输出会直接终止测试。
 * 新手阅读建议：先读 SDK_SPECIFIERS 和五条断言，再研究 runProbe 如何监控动态导入。
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AI 包根目录，作为探针子进程的工作目录。
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// AI 主入口的绝对 URL，用于验证仅导入根导出时的行为。
const aiEntryUrl = new URL("../src/index.ts", import.meta.url).href;
// 兼容入口的绝对 URL，用于验证兼容 API 自身不会急切加载 SDK。
const compatEntryUrl = new URL("../src/compat.ts", import.meta.url).href;
// 内置供应商集合入口 URL，用于验证构造模型目录不会加载 SDK。
const providersAllUrl = new URL("../src/providers/all.ts", import.meta.url).href;

// 需要监控的第三方供应商 SDK 模块名；只记录这些精确标识符。
const SDK_SPECIFIERS = [
	"@anthropic-ai/sdk",
	"openai",
	"@google/genai",
	"@mistralai/mistralai",
	"@aws-sdk/client-bedrock-runtime",
] as const;

// 探针标准输出的 JSON 结构；loadedSpecifiers 已在子进程中去重。
type ProbeResult = {
	loadedSpecifiers: string[];
};

/** 功能：在隔离 Node 子进程中执行导入动作并记录供应商 SDK；参数 action 为插入脚本的代码；返回：加载结果。示例：runProbe("")。 */
function runProbe(action: string): ProbeResult {
	// 完整探针脚本；模块解析钩子只记录目标 SDK，不阻止正常解析。
	const script = `
		import { registerHooks } from "node:module";

		const targets = new Set(${JSON.stringify(SDK_SPECIFIERS)});
		const loaded = [];

		registerHooks({
			resolve(specifier, context, nextResolve) {
				if (targets.has(specifier)) {
					loaded.push(specifier);
				}
				return nextResolve(specifier, context);
			},
		});

		const mod = await import(${JSON.stringify(aiEntryUrl)});
		${action}
		console.log(JSON.stringify({ loadedSpecifiers: [...new Set(loaded)] }));
	`;

	// 同步子进程结果；status 非零、stdout 或 stderr 可用于定位探针失败。
	const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
		cwd: packageRoot,
		encoding: "utf8",
	});

	if (result.status !== 0) {
		throw new Error(`Probe failed (exit ${result.status})\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
	}

	// 去除空行后的标准输出；最后一行应为探针 JSON，前面可能有被测代码日志。
	const stdoutLines = result.stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	// 约定的结果行；不存在表示探针没有完成 console.log。
	const lastLine = stdoutLines.at(-1);
	if (!lastLine) {
		throw new Error(`Probe produced no output\nSTDERR:\n${result.stderr}`);
	}

	return JSON.parse(lastLine) as ProbeResult;
}

describe("lazy provider module loading", () => {
	it("does not load provider SDKs when importing the root barrel", () => {
		// 空动作表示只导入 AI 根入口，不调用任何供应商 API。
		const result = runProbe("");
		expect(result.loadedSpecifiers).toEqual([]);
	});

	it("does not load provider SDKs when building all builtin providers", () => {
		// 构造并读取内置模型目录时捕获的 SDK 加载集合。
		const result = runProbe(`
			const all = await import(${JSON.stringify(providersAllUrl)});
			const models = all.builtinModels();
			models.getModels();
		`);
		expect(result.loadedSpecifiers).toEqual([]);
	});

	it("does not load provider SDKs when importing the compat entrypoint", () => {
		// 额外导入 compat 入口后的 SDK 加载集合。
		const result = runProbe(`
			await import(${JSON.stringify(compatEntryUrl)});
		`);
		expect(result.loadedSpecifiers).toEqual([]);
	});

	it("loads only the Anthropic SDK when streaming through the lazy API wrapper", () => {
		// 直接调用懒加载 Anthropic API 包装器后的 SDK 加载集合。
		const result = runProbe(`
			const compat = await import(${JSON.stringify(compatEntryUrl)});
			const model = {
				id: "claude-sonnet-4-6",
				name: "Claude Sonnet 4",
				api: "anthropic-messages",
				provider: "anthropic",
				baseUrl: "https://api.anthropic.com",
				reasoning: true,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 200000,
				maxTokens: 8192,
			};
			const context = { messages: [{ role: "user", content: "hi" }] };
			await compat.anthropicMessagesApi().streamSimple(model, context).result();
		`);

		expect(result.loadedSpecifiers).toEqual(["@anthropic-ai/sdk"]);
	});

	it("loads only the Anthropic SDK when dispatching through streamSimple", () => {
		// 通过通用 streamSimple 分派到 Anthropic 后的 SDK 加载集合。
		const result = runProbe(`
			const compat = await import(${JSON.stringify(compatEntryUrl)});
			const model = compat.getModel("anthropic", "claude-sonnet-4-6");
			const context = { messages: [{ role: "user", content: "hi" }] };
			await compat.streamSimple(model, context).result();
		`);

		expect(result.loadedSpecifiers).toEqual(["@anthropic-ai/sdk"]);
	});
});
