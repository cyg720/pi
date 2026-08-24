/**
 * 文件职责：运行 coding-agent 的 Node/Bun 启动性能基准，采集多轮耗时并汇总可比较的统计指标。
 * 技术维度：使用 Node.js 子进程、命令行参数解析、JSON Lines/RPC 输出和环境变量注入完成性能采样。
 * 产品维度：帮助维护者定位启动变慢和运行时差异，保障命令行工具启动体验。
 * 逻辑维度：解析参数与运行时，准备输出目录和环境，按 TUI 或 RPC 模式执行多轮采样，最后汇总结果。
 * 关键边界：脚本会启动真实子进程并可触发构建；结果受机器负载、运行时版本和预热轮次影响。
 * 新手阅读建议：先看 parseArgs 与默认值，再看 runBenchmarkRun 的模式分发，最后阅读 summarize 和 main。
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

/** 常量 __dirname 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const __dirname = dirname(fileURLToPath(import.meta.url));
/** 常量 repoRoot 保存“repoRoot”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const repoRoot = resolve(__dirname, "..");
/** 常量 packageDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const packageDir = join(repoRoot, "packages", "coding-agent");
/** 常量 distCliPath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const distCliPath = join(packageDir, "dist", "cli.js");
/** 常量 srcCliPath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const srcCliPath = join(packageDir, "src", "cli.ts");
/** 常量 defaultNodeProfileDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const defaultNodeProfileDir = join(repoRoot, "profiles-node");
/** 常量 defaultBunProfileDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const defaultBunProfileDir = join(repoRoot, "profiles-bun");
/** 常量 agentDirEnvName 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const agentDirEnvName = "PI_CODING_AGENT_DIR";
/** 常量 startupBenchmarkEnvName 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const startupBenchmarkEnvName = "PI_STARTUP_BENCHMARK";

/** 处理 printHelp 对应步骤；无参数；返回值供调用方继续执行或断言。示例：printHelp()。 */
function printHelp() {
	console.log(`Usage:
  node scripts/profile-coding-agent-node.mjs [options]

Profiles coding-agent startup with the runtime selected below:
- npm run profile:tui     -> builds packages/coding-agent and profiles TUI startup with Node
- npm run profile:rpc     -> builds packages/coding-agent and profiles RPC startup with Node
- bun run profile:tui     -> profiles TUI startup from src/cli.ts directly with Bun
- bun run profile:rpc     -> profiles RPC startup from src/cli.ts directly with Bun

Options:
  --mode <name>          tui or rpc (default: tui)
  --runs <n>             Number of measured runs (default: 1)
  --warmup <n>           Number of warmup runs before measurements (default: 0)
  --profile-dir <dir>    CPU profile output directory
                         Default: profiles-node for Node, profiles-bun for Bun
  --label <name>         Profile name prefix (default: <mode>-startup)
  --runtime <name>       node, bun, or auto (default: auto)
  --agent-dir <dir>      Use a specific PI_CODING_AGENT_DIR for the benchmark run
  --isolated-agent-dir   Use a fresh temporary agent dir instead of the normal one
  --no-offline           Do not force PI_OFFLINE=1 / PI_SKIP_VERSION_CHECK=1
  --skip-build           Reuse the current dist/cli.js without rebuilding first (Node only)
  --cpu-profile          Write CPU profiles for benchmark runs
  --help                 Show this help

Notes:
  - By default the benchmark uses your normal configured agent dir, so global models/auth/settings work.
  - TUI mode measures startup until the interactive UI reaches first usable state.
  - RPC mode measures startup until a real get_state request receives a response, then closes stdin to exit cleanly.
  - CPU profiles are kept in the selected profile directory for later analysis.
`);
}

/** 解析 parseIntegerFlag 对应步骤；参数 value、name 按签名提供所需输入；返回值供调用方继续执行或断言。示例：parseIntegerFlag(..., ...)。 */
function parseIntegerFlag(value, name) {
	/** 常量 parsed 保存“parsed”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`Invalid ${name}: ${value}`);
	}
	return parsed;
}

/** 解析 parseRuntime 对应步骤；参数 value 按签名提供所需输入；返回值供调用方继续执行或断言。示例：parseRuntime(...)。 */
function parseRuntime(value) {
	if (value === "auto" || value === "node" || value === "bun") {
		return value;
	}
	throw new Error(`Invalid --runtime: ${value}`);
}

/** 解析 parseMode 对应步骤；参数 value 按签名提供所需输入；返回值供调用方继续执行或断言。示例：parseMode(...)。 */
function parseMode(value) {
	if (value === "tui" || value === "rpc") {
		return value;
	}
	throw new Error(`Invalid --mode: ${value}`);
}

/** 解析 parseArgs 对应步骤；参数 argv 按签名提供所需输入；返回值供调用方继续执行或断言。示例：parseArgs(...)。 */
function parseArgs(argv) {
	/** 常量 options 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const options = {
		mode: "tui",
		runs: 1,
		warmup: 0,
		profileDir: undefined,
		label: undefined,
		offline: true,
		build: true,
		runtime: "auto",
		agentDir: undefined,
		isolatedAgentDir: false,
		cpuProfile: false,
	};

	/** 循环变量 index 表示当前遍历项或索引，只在本循环体内有效。 */
	for (let index = 0; index < argv.length; index++) {
		/** 常量 arg 保存“arg”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const arg = argv[index];

		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}

		if (arg === "--no-offline") {
			options.offline = false;
			continue;
		}

		if (arg === "--isolated-agent-dir") {
			options.isolatedAgentDir = true;
			continue;
		}

		if (arg === "--skip-build") {
			options.build = false;
			continue;
		}

		if (arg === "--cpu-profile") {
			options.cpuProfile = true;
			continue;
		}

		if (
			(arg === "--mode" ||
				arg === "--runs" ||
				arg === "--warmup" ||
				arg === "--profile-dir" ||
				arg === "--label" ||
				arg === "--runtime" ||
				arg === "--agent-dir") &&
			index + 1 >= argv.length
		) {
			throw new Error(`Missing value for ${arg}`);
		}

		if (arg === "--mode") {
			options.mode = parseMode(argv[++index]);
			continue;
		}

		if (arg === "--runs") {
			options.runs = parseIntegerFlag(argv[++index], "--runs");
			continue;
		}

		if (arg === "--warmup") {
			options.warmup = parseIntegerFlag(argv[++index], "--warmup");
			continue;
		}

		if (arg === "--profile-dir") {
			options.profileDir = resolve(argv[++index]);
			continue;
		}

		if (arg === "--label") {
			options.label = argv[++index];
			continue;
		}

		if (arg === "--runtime") {
			options.runtime = parseRuntime(argv[++index]);
			continue;
		}

		if (arg === "--agent-dir") {
			options.agentDir = resolve(argv[++index]);
			continue;
		}

		throw new Error(`Unknown option: ${arg}`);
	}

	return options;
}

/** 检测 detectRuntimeFromPackageManager 对应步骤；无参数；返回值供调用方继续执行或断言。示例：detectRuntimeFromPackageManager()。 */
function detectRuntimeFromPackageManager() {
	/** 常量 userAgent 保存“userAgent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const userAgent = process.env.npm_config_user_agent ?? "";
	return userAgent.startsWith("bun/") ? "bun" : "node";
}

/** 解析并确定 resolveRuntime 对应步骤；参数 requestedRuntime 按签名提供所需输入；返回值供调用方继续执行或断言。示例：resolveRuntime(...)。 */
function resolveRuntime(requestedRuntime) {
	if (requestedRuntime === "auto") {
		return detectRuntimeFromPackageManager();
	}
	return requestedRuntime;
}

/** 解析并确定 resolveProfileDir 对应步骤；参数 runtime、requestedProfileDir 按签名提供所需输入；返回值供调用方继续执行或断言。示例：resolveProfileDir(..., ...)。 */
function resolveProfileDir(runtime, requestedProfileDir) {
	if (requestedProfileDir) {
		return requestedProfileDir;
	}
	return runtime === "bun" ? defaultBunProfileDir : defaultNodeProfileDir;
}

/** 解析并确定 resolveLabel 对应步骤；参数 mode、requestedLabel 按签名提供所需输入；返回值供调用方继续执行或断言。示例：resolveLabel(..., ...)。 */
function resolveLabel(mode, requestedLabel) {
	return requestedLabel ?? `${mode}-startup`;
}

/** 格式化 formatMs 对应步骤；参数 value 按签名提供所需输入；返回值供调用方继续执行或断言。示例：formatMs(...)。 */
function formatMs(value) {
	return `${value.toFixed(1)}ms`;
}

/** 处理 toDisplayPath 对应步骤；参数 path 按签名提供所需输入；返回值供调用方继续执行或断言。示例：toDisplayPath(...)。 */
function toDisplayPath(path) {
	/** 常量 relativePath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const relativePath = relative(repoRoot, path);
	if (relativePath !== "" && !relativePath.startsWith("..")) {
		return relativePath.replaceAll("\\", "/");
	}
	return path;
}

/** 汇总 summarize 对应步骤；参数 values 按签名提供所需输入；返回值供调用方继续执行或断言。示例：summarize(...)。 */
function summarize(values) {
	/** 常量 sorted 保存“sorted”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const sorted = [...values].sort((a, b) => a - b);
	/** 常量 total 保存“total”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const total = sorted.reduce((sum, value) => sum + value, 0);
	/** 常量 middle 保存“middle”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const middle = Math.floor(sorted.length / 2);
	/** 常量 median 保存“median”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
	return {
		min: sorted[0],
		max: sorted[sorted.length - 1],
		avg: total / sorted.length,
		median,
	};
}

/** 解析 parseStartupTimings 对应步骤；参数 stderr 按签名提供所需输入；返回值供调用方继续执行或断言。示例：parseStartupTimings(...)。 */
function parseStartupTimings(stderr) {
	/** 常量 lines 保存“lines”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const lines = stderr.split(/\r?\n/);
	/** 常量 timings 保存“timings”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const timings = new Map();
	/** 变量 inBlock 保存“inBlock”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let inBlock = false;

	/** 循环变量 line 表示当前遍历项或索引，只在本循环体内有效。 */
	for (const line of lines) {
		if (line.includes("--- Startup Timings ---")) {
			inBlock = true;
			continue;
		}
		if (!inBlock) {
			continue;
		}
		if (line.includes("------------------------")) {
			break;
		}
		/** 常量 match 保存“match”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const match = line.match(/^\s+([^:]+):\s+(\d+)ms$/);
		if (!match) {
			continue;
		}
		timings.set(match[1], Number.parseInt(match[2], 10));
	}

	return timings;
}

/** 汇总 summarizeTimingMaps 对应步骤；参数 runs 按签名提供所需输入；返回值供调用方继续执行或断言。示例：summarizeTimingMaps(...)。 */
function summarizeTimingMaps(runs) {
	/** 常量 valuesByLabel 保存“valuesByLabel”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const valuesByLabel = new Map();
	/** 循环变量 run 表示当前遍历项或索引，只在本循环体内有效。 */
	for (const run of runs) {
		/** 循环变量 [label, 表示当前遍历项或索引，只在本循环体内有效。 */
		for (const [label, value] of run.timings.entries()) {
			/** 常量 values 保存“values”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const values = valuesByLabel.get(label);
			if (values) {
				values.push(value);
			} else {
				valuesByLabel.set(label, [value]);
			}
		}
	}

	/** 常量 summaries 保存“summaries”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const summaries = new Map();
	/** 循环变量 [label, 表示当前遍历项或索引，只在本循环体内有效。 */
	for (const [label, values] of valuesByLabel.entries()) {
		summaries.set(label, summarize(values));
	}
	return summaries;
}

/** 处理 toMetricName 对应步骤；参数 label 按签名提供所需输入；返回值供调用方继续执行或断言。示例：toMetricName(...)。 */
function toMetricName(label) {
	return `${label.replaceAll(/[^a-zA-Z0-9]+/g, "_").replaceAll(/^_+|_+$/g, "")}_ms`;
}

/** 等待 waitForExit 对应步骤；参数 child、errorPrefix 按签名提供所需输入；返回值供调用方继续执行或断言。示例：waitForExit(..., ...)。 */
async function waitForExit(child, errorPrefix) {
	return await new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (signal) {
				reject(new Error(`${errorPrefix} exited from signal ${signal}`));
				return;
			}
			resolve(code ?? 0);
		});
	});
}

/** 执行 runBuild 对应步骤；无参数；返回值供调用方继续执行或断言。示例：runBuild()。 */
async function runBuild() {
	process.stdout.write("Building packages/tui, packages/ai, packages/agent, and packages/coding-agent...\n");
	/** 常量 startedAt 保存“startedAt”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const startedAt = performance.now();
	/** 常量 child 保存“child”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const child = spawn(
		"npm",
		[
			"run",
			"build",
			"--workspace",
			"packages/tui",
			"--workspace",
			"packages/ai",
			"--workspace",
			"packages/agent",
			"--workspace",
			"packages/coding-agent",
		],
		{
			cwd: repoRoot,
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
			shell: process.platform === "win32",
		},
	);

	/** 变量 stdout 保存“stdout”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let stdout = "";
	/** 变量 stderr 保存“stderr”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let stderr = "";
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk) => {
		stdout += chunk;
	});
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});

	/** 常量 exitCode 保存“exitCode”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const exitCode = await waitForExit(child, "Build");
	if (exitCode !== 0) {
		if (stdout.trim()) {
			process.stdout.write(`${stdout}${stdout.endsWith("\n") ? "" : "\n"}`);
		}
		if (stderr.trim()) {
			process.stderr.write(`${stderr}${stderr.endsWith("\n") ? "" : "\n"}`);
		}
		throw new Error(`Build failed with exit code ${exitCode}`);
	}

	process.stdout.write(`Build completed in ${formatMs(performance.now() - startedAt)}\n`);
}

/** 取得 getRuntimeCommand 对应步骤；参数 runtime、mode、profileDir、profileName、cpuProfile 按签名提供所需输入；返回值供调用方继续执行或断言。示例：getRuntimeCommand(..., ..., ..., ..., ...)。 */
function getRuntimeCommand(runtime, mode, profileDir, profileName, cpuProfile) {
	/** 常量 benchmarkArgs 保存“benchmarkArgs”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const benchmarkArgs = ["--no-session"];
	if (mode === "rpc") {
		benchmarkArgs.push("--mode", "rpc");
	}

	if (runtime === "bun") {
		/** 常量 args 保存“args”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const args = [];
		if (cpuProfile) {
			args.push("--cpu-prof", `--cpu-prof-dir=${profileDir}`, `--cpu-prof-name=${profileName}`);
		}
		args.push(srcCliPath, ...benchmarkArgs);
		return {
			executable: "bun",
			args,
		};
	}

	/** 常量 args 保存“args”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const args = [];
	if (cpuProfile) {
		args.push("--cpu-prof", `--cpu-prof-dir=${profileDir}`, `--cpu-prof-name=${profileName}`);
	}
	args.push(distCliPath, ...benchmarkArgs);
	return {
		executable: process.execPath,
		args,
	};
}

/** 创建 createBenchmarkEnv 对应步骤；参数 options、isolatedAgentDir 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createBenchmarkEnv(..., ...)。 */
function createBenchmarkEnv(options, isolatedAgentDir) {
	/** 常量 env 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const env = { ...process.env };
	if (options.agentDir) {
		env[agentDirEnvName] = options.agentDir;
	} else if (isolatedAgentDir) {
		env[agentDirEnvName] = isolatedAgentDir;
	}
	if (options.mode === "tui") {
		env[startupBenchmarkEnvName] = "1";
	}
	if (options.offline) {
		env.PI_OFFLINE = "1";
		env.PI_SKIP_VERSION_CHECK = "1";
	}
	return env;
}

/** 执行 runTuiBenchmarkRun 对应步骤；参数 { runtime、runIndex、measuredIndex、options、profileDir } 按签名提供所需输入；返回值供调用方继续执行或断言。示例：runTuiBenchmarkRun(..., ..., ..., ..., ...)。 */
async function runTuiBenchmarkRun({ runtime, runIndex, measuredIndex, options, profileDir }) {
	/** 常量 runNumber 保存“runNumber”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const runNumber = runIndex + 1;
	/** 常量 suffix 保存“suffix”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const suffix = String(runNumber).padStart(3, "0");
	/** 常量 profileName 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const profileName = `${options.label}-${suffix}.cpuprofile`;
	/** 常量 tempRoot 保存“tempRoot”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const tempRoot = options.isolatedAgentDir ? mkdtempSync(join(tmpdir(), "pi-startup-benchmark-")) : undefined;
	/** 常量 isolatedAgentDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const isolatedAgentDir = tempRoot ? join(tempRoot, "agent") : undefined;
	if (isolatedAgentDir) {
		mkdirSync(isolatedAgentDir, { recursive: true });
	}

	/** 常量 command 保存“command”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const command = getRuntimeCommand(runtime, "tui", profileDir, profileName, options.cpuProfile);
	/** 常量 child 保存“child”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const child = spawn(command.executable, command.args, {
		cwd: packageDir,
		env: createBenchmarkEnv(options, isolatedAgentDir),
		stdio: ["inherit", "ignore", "pipe"],
		shell: process.platform === "win32" && runtime === "bun",
	});

	/** 变量 stderr 保存“stderr”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let stderr = "";
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});

	/** 常量 startedAt 保存“startedAt”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const startedAt = performance.now();
	/** 常量 exitCode 保存“exitCode”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const exitCode = await waitForExit(child, `Benchmark ${measuredIndex === undefined ? `warmup ${runNumber}` : `run ${measuredIndex}`}`);
	/** 常量 elapsedMs 保存“elapsedMs”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const elapsedMs = performance.now() - startedAt;

	try {
		if (exitCode !== 0) {
			throw new Error(stderr.trim() || `Benchmark child exited with code ${exitCode}`);
		}

		/** 常量 profilePath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const profilePath = options.cpuProfile ? join(profileDir, profileName) : undefined;
		if (profilePath && !existsSync(profilePath)) {
			throw new Error(`CPU profile was not written: ${profilePath}`);
		}

		return { elapsedMs, profilePath, timings: parseStartupTimings(stderr) };
	} finally {
		if (tempRoot) {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	}
}

/** 处理 splitJsonLines 对应步骤；参数 buffer、onLine 按签名提供所需输入；返回值供调用方继续执行或断言。示例：splitJsonLines(..., ...)。 */
function splitJsonLines(buffer, onLine) {
	/** 变量 remaining 保存“remaining”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let remaining = buffer;
	while (true) {
		/** 常量 newlineIndex 保存“newlineIndex”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const newlineIndex = remaining.indexOf("\n");
		if (newlineIndex === -1) {
			return remaining;
		}
		/** 常量 line 保存“line”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const line = remaining.slice(0, newlineIndex);
		onLine(line.endsWith("\r") ? line.slice(0, -1) : line);
		remaining = remaining.slice(newlineIndex + 1);
	}
}

/** 执行 runRpcBenchmarkRun 对应步骤；参数 { runtime、runIndex、measuredIndex、options、profileDir } 按签名提供所需输入；返回值供调用方继续执行或断言。示例：runRpcBenchmarkRun(..., ..., ..., ..., ...)。 */
async function runRpcBenchmarkRun({ runtime, runIndex, measuredIndex, options, profileDir }) {
	/** 常量 runNumber 保存“runNumber”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const runNumber = runIndex + 1;
	/** 常量 suffix 保存“suffix”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const suffix = String(runNumber).padStart(3, "0");
	/** 常量 profileName 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const profileName = `${options.label}-${suffix}.cpuprofile`;
	/** 常量 tempRoot 保存“tempRoot”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const tempRoot = options.isolatedAgentDir ? mkdtempSync(join(tmpdir(), "pi-startup-benchmark-")) : undefined;
	/** 常量 isolatedAgentDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const isolatedAgentDir = tempRoot ? join(tempRoot, "agent") : undefined;
	if (isolatedAgentDir) {
		mkdirSync(isolatedAgentDir, { recursive: true });
	}

	/** 常量 command 保存“command”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const command = getRuntimeCommand(runtime, "rpc", profileDir, profileName, options.cpuProfile);
	/** 常量 child 保存“child”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const child = spawn(command.executable, command.args, {
		cwd: packageDir,
		env: createBenchmarkEnv(options, isolatedAgentDir),
		stdio: ["pipe", "pipe", "pipe"],
		shell: process.platform === "win32" && runtime === "bun",
	});

	/** 变量 stdoutBuffer 保存“stdoutBuffer”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let stdoutBuffer = "";
	/** 变量 stderr 保存“stderr”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let stderr = "";
	/** 变量 readyElapsedMs 保存“readyElapsedMs”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let readyElapsedMs;
	/** 变量 responseError 保存当前调用返回的响应；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let responseError;
	/** 常量 requestId 保存“requestId”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const requestId = `startup-benchmark-${runNumber}`;
	/** 常量 startedAt 保存“startedAt”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const startedAt = performance.now();

	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk) => {
		stdoutBuffer = splitJsonLines(stdoutBuffer + chunk, (line) => {
			if (line.trim() === "") {
				return;
			}
			/** 变量 parsed 保存“parsed”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			let parsed;
			try {
				parsed = JSON.parse(line);
			} catch (error) {
				responseError = error instanceof Error ? error.message : String(error);
				return;
			}

			if (parsed?.type !== "response" || parsed.id !== requestId || parsed.command !== "get_state") {
				return;
			}

			if (parsed.success !== true) {
				responseError = typeof parsed.error === "string" ? parsed.error : "get_state failed";
				return;
			}

			if (readyElapsedMs === undefined) {
				readyElapsedMs = performance.now() - startedAt;
				child.stdin.end();
			}
		});
	});

	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});

	child.stdin.setDefaultEncoding("utf8");
	child.stdin.write(`${JSON.stringify({ id: requestId, type: "get_state" })}\n`);

	/** 常量 exitCode 保存“exitCode”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const exitCode = await waitForExit(child, `Benchmark ${measuredIndex === undefined ? `warmup ${runNumber}` : `run ${measuredIndex}`}`);

	try {
		if (responseError) {
			throw new Error(responseError);
		}
		if (readyElapsedMs === undefined) {
			throw new Error(stderr.trim() || "RPC benchmark did not receive get_state response");
		}
		if (exitCode !== 0) {
			throw new Error(stderr.trim() || `Benchmark child exited with code ${exitCode}`);
		}

		/** 常量 profilePath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const profilePath = options.cpuProfile ? join(profileDir, profileName) : undefined;
		if (profilePath && !existsSync(profilePath)) {
			throw new Error(`CPU profile was not written: ${profilePath}`);
		}

		return { elapsedMs: readyElapsedMs, profilePath, timings: parseStartupTimings(stderr) };
	} finally {
		if (tempRoot) {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	}
}

/** 执行 runBenchmarkRun 对应步骤；参数 params 按签名提供所需输入；返回值供调用方继续执行或断言。示例：runBenchmarkRun(...)。 */
async function runBenchmarkRun(params) {
	if (params.options.mode === "rpc") {
		return await runRpcBenchmarkRun(params);
	}
	return await runTuiBenchmarkRun(params);
}

/** 处理 main 对应步骤；无参数；返回值供调用方继续执行或断言。示例：main()。 */
async function main() {
	/** 常量 options 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	if (options.agentDir && options.isolatedAgentDir) {
		throw new Error("--agent-dir and --isolated-agent-dir cannot be combined");
	}

	if (options.mode === "tui" && (!process.stdin.isTTY || !process.stdout.isTTY)) {
		throw new Error("TUI benchmark must be run from an interactive terminal.");
	}

	/** 常量 runtime 保存“runtime”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const runtime = resolveRuntime(options.runtime);
	options.label = resolveLabel(options.mode, options.label);
	/** 常量 profileDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const profileDir = resolveProfileDir(runtime, options.profileDir);

	if (runtime === "node" && options.build) {
		await runBuild();
	}
	if (runtime === "bun") {
		process.stdout.write(
			`Using Bun runtime with ${options.mode === "rpc" ? "packages/coding-agent/src/cli.ts --mode rpc" : "packages/coding-agent/src/cli.ts"}\n`,
		);
	}

	/** 常量 entryPath 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const entryPath = runtime === "bun" ? srcCliPath : distCliPath;
	if (!existsSync(entryPath)) {
		throw new Error(`CLI entrypoint not found: ${entryPath}`);
	}

	mkdirSync(profileDir, { recursive: true });

	/** 常量 measuredRuns 保存“measuredRuns”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const measuredRuns = [];
	/** 常量 totalRuns 保存“totalRuns”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const totalRuns = options.warmup + options.runs;
	/** 循环变量 runIndex 表示当前遍历项或索引，只在本循环体内有效。 */
	for (let runIndex = 0; runIndex < totalRuns; runIndex++) {
		/** 常量 measuredIndex 保存“measuredIndex”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const measuredIndex = runIndex >= options.warmup ? runIndex - options.warmup + 1 : undefined;
		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = await runBenchmarkRun({
			runtime,
			runIndex,
			measuredIndex,
			options,
			profileDir,
		});

		process.stdout.write(
			`[${measuredIndex === undefined ? `warmup ${runIndex + 1}` : `run ${measuredIndex}`}] elapsed=${formatMs(result.elapsedMs)}\n`,
		);

		if (measuredIndex !== undefined) {
			measuredRuns.push(result);
		}
	}

	if (measuredRuns.length === 0) {
		process.stdout.write("\nNo measured runs requested.\n");
		return;
	}

	/** 常量 elapsedSummary 保存“elapsedSummary”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const elapsedSummary = summarize(measuredRuns.map((run) => run.elapsedMs));
	/** 常量 timingSummaries 保存“timingSummaries”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const timingSummaries = summarizeTimingMaps(measuredRuns);
	/** 常量 maxElapsedRun 保存“maxElapsedRun”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const maxElapsedRun = measuredRuns.reduce((slowest, run) => (run.elapsedMs > slowest.elapsedMs ? run : slowest));
	if (measuredRuns.length === 1) {
		process.stdout.write("\nResult\n");
		process.stdout.write(`  runtime:          ${runtime}\n`);
		process.stdout.write(`  mode:             ${options.mode}\n`);
		process.stdout.write(`  elapsed:          ${formatMs(measuredRuns[0].elapsedMs)}\n`);
		/** 循环变量 [label, 表示当前遍历项或索引，只在本循环体内有效。 */
		for (const [label, summary] of timingSummaries.entries()) {
			process.stdout.write(`  ${label}: ${formatMs(summary.median)}\n`);
		}
		if (options.cpuProfile && maxElapsedRun.profilePath) {
			process.stdout.write(`  selected profile: ${toDisplayPath(maxElapsedRun.profilePath)}\n`);
			process.stdout.write(`  profiles dir:     ${toDisplayPath(profileDir)}\n`);
		}
		process.stdout.write(`METRIC startup_time_ms=${measuredRuns[0].elapsedMs.toFixed(1)}\n`);
		/** 循环变量 [label, 表示当前遍历项或索引，只在本循环体内有效。 */
		for (const [label, summary] of timingSummaries.entries()) {
			process.stdout.write(`METRIC ${toMetricName(label)}=${summary.median.toFixed(1)}\n`);
		}
		return;
	}

	process.stdout.write("\nSummary\n");
	process.stdout.write(`  runtime:          ${runtime}\n`);
	process.stdout.write(`  mode:             ${options.mode}\n`);
	process.stdout.write(`  elapsed min:      ${formatMs(elapsedSummary.min)}\n`);
	process.stdout.write(`  elapsed median:   ${formatMs(elapsedSummary.median)}\n`);
	process.stdout.write(`  elapsed avg:      ${formatMs(elapsedSummary.avg)}\n`);
	process.stdout.write(`  elapsed max:      ${formatMs(elapsedSummary.max)}\n`);
	/** 循环变量 [label, 表示当前遍历项或索引，只在本循环体内有效。 */
	for (const [label, summary] of timingSummaries.entries()) {
		process.stdout.write(`  ${label} median: ${formatMs(summary.median)}\n`);
	}
	if (options.cpuProfile && maxElapsedRun.profilePath) {
		process.stdout.write(`  selected profile: ${toDisplayPath(maxElapsedRun.profilePath)}\n`);
		process.stdout.write(`  profiles dir:     ${toDisplayPath(profileDir)}\n`);
	}
	process.stdout.write(`METRIC startup_time_ms=${elapsedSummary.median.toFixed(1)}\n`);
	/** 循环变量 [label, 表示当前遍历项或索引，只在本循环体内有效。 */
	for (const [label, summary] of timingSummaries.entries()) {
		process.stdout.write(`METRIC ${toMetricName(label)}=${summary.median.toFixed(1)}\n`);
	}
}

main().catch((error) => {
	/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
});
