/**
 * 文件职责：解析评测命令行中的模型选择并在 evals 包目录启动 Vitest。
 * 技术维度：使用 Node ESM、createRequire 定位依赖、spawnSync 转发参数和环境变量。
 * 产品维度：为开发者提供统一的模型评测入口，避免评测时遗漏提供商或模型配置。
 * 逻辑维度：解析两种参数写法，回退到环境变量，校验组合后同步启动测试进程。
 * 关键边界：提供商和模型必须成对给出；子进程使用真实模型时可能访问网络并产生费用。
 * 新手阅读建议：先看参数循环的四种分支，再看环境变量回退和最终 spawnSync 调用。
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// packageRoot 是 evals 包根目录，确保从任意工作目录启动时仍能找到配置文件。
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// args 保存用户传给本脚本的参数，不包含 node 和脚本路径。
const args = process.argv.slice(2);
// provider 保存目标模型提供商，可来自命令行或 PI_PROVIDER。
let provider;
// model 保存目标模型标识，可来自命令行或 PI_MODEL。
let model;
// hasCliModelSelection 标记用户是否在命令行显式指定过模型选择参数。
let hasCliModelSelection = false;
// vitestArgs 收集不属于本脚本的参数并原样转发给 Vitest。
const vitestArgs = [];

// index 是当前参数索引；循环同时支持空格分隔和等号形式的模型参数。
for (let index = 0; index < args.length; index += 1) {
	// arg 是当前待解析的命令行参数。
	const arg = args[index];
	if (arg === "--provider" || arg === "--model") {
		// value 是空格分隔形式参数后面的值，缺失或形似新选项时视为错误。
		const value = args[index + 1];
		if (!value || value.startsWith("-")) {
			console.error(`Missing value for ${arg}`);
			process.exit(1);
		}
		if (arg === "--provider") provider = value;
		else model = value;
		hasCliModelSelection = true;
		index += 1;
		continue;
	}
	if (arg.startsWith("--provider=")) {
		provider = arg.slice("--provider=".length);
		hasCliModelSelection = true;
		continue;
	}
	if (arg.startsWith("--model=")) {
		model = arg.slice("--model=".length);
		hasCliModelSelection = true;
		continue;
	}
	vitestArgs.push(arg);
}

if (hasCliModelSelection && (!provider || !model)) {
	console.error("CLI model selection requires both --provider and --model.");
	process.exit(1);
}

provider ??= process.env.PI_PROVIDER;
model ??= process.env.PI_MODEL;

if (!provider || !model) {
	console.error(
		"No eval model selected. Pass --provider and --model, or set PI_PROVIDER and PI_MODEL.",
	);
	process.exit(1);
}

// require 是从当前 ESM 文件创建的 CommonJS 解析器，仅用于定位 Vitest 包。
const require = createRequire(import.meta.url);
// vitestPackagePath 是已安装 Vitest 的 package.json 绝对路径。
const vitestPackagePath = require.resolve("vitest/package.json");
// vitestCliPath 是与 package.json 同目录的 Vitest 命令行入口路径。
const vitestCliPath = resolve(dirname(vitestPackagePath), "vitest.mjs");

console.error(`[eval] provider=${provider} model=${model}`);
// result 保存同步评测子进程的退出状态或启动错误。
const result = spawnSync(
	process.execPath,
	[vitestCliPath, "run", "--config", "vitest.config.ts", ...vitestArgs],
	{
		cwd: packageRoot,
		stdio: "inherit",
		env: {
			...process.env,
			PI_PROVIDER: provider,
			PI_MODEL: model,
		},
	},
);

if (result.error) {
	throw result.error;
}

process.exit(result.status ?? 1);
