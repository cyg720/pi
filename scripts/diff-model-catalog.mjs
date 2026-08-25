#!/usr/bin/env node
/**
 * 文件职责：比较当前工作区与 HEAD 生成的模型目录，按模型输出 JSON 字段差异或有效推理等级差异。
 * 技术维度：使用 Node.js ESM、临时 Git worktree、同步子进程、规范化 JSON 和无索引 git diff。
 * 产品维度：帮助维护者在提交前审查模型元数据变化，避免大目录生成结果掩盖单个模型的意外变动。
 * 逻辑维度：解析参数，创建基线 worktree，生成两套目录，规范排序，逐模型 diff，汇总后清理资源。
 * 关键边界：脚本会创建并强制移除临时 worktree；依赖已安装 node_modules；未知提供商会中止比较。
 * 新手阅读建议：先看主 try 块掌握流程，再读 canonicalizeJson/formatJsonForDiff 理解稳定差异输出。
 */

import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * 输出命令用法、参数说明和示例。
 * @returns {void} 文本写入标准输出。
 * @example printUsage();
 */
function printUsage() {
	console.log(`Usage: node scripts/diff-model-catalog.mjs [--thinking] [provider ...]

Generates the model catalog at HEAD and in the current worktree, then shows
JSON differences. If providers are omitted, all providers are compared.

--thinking compares each worktree's effective thinking levels using that
worktree's getSupportedThinkingLevels() implementation.

Examples:
  node scripts/diff-model-catalog.mjs github-copilot
  npm run diff:model-catalog -- --thinking moonshotai kimi-coding
`);
}

/**
 * 同步运行命令并在非零退出时抛出含输出的错误。
 * @param {string} command 可执行命令。
 * @param {string[]} args 参数数组。
 * @param {{cwd?: string, capture?: boolean}} options 工作目录和是否捕获输出。
 * @returns {string} 捕获的标准输出或空串。
 */
function run(command, args, options = {}) {
	/** 子进程同步执行结果。 */
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
	});
	if (result.status !== 0) {
		/** 组合标准输出与错误输出的失败详情。 */
		const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
		throw new Error(`Command failed: ${[command, ...args].join(" ")}\n${details}`);
	}
	return result.stdout ?? "";
}

/**
 * 在指定目录运行 git diff 并保留退出状态供调用方区分有差异和失败。
 * @param {string[]} args git 参数。
 * @param {string} cwd 工作目录。
 * @returns {import("node:child_process").SpawnSyncReturns<string>} 同步执行结果。
 */
function runDiff(args, cwd) {
	return spawnSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

/** 命令行参数，不包含 node 与脚本路径。 */
const args = process.argv.slice(2);
if (args.includes("--help")) {
	printUsage();
	process.exit(0);
}
/** 是否只比较有效推理等级。 */
const thinkingOnly = args.includes("--thinking");
/** 用户显式要求比较的提供商列表。 */
const requestedProviders = args.filter((arg) => arg !== "--thinking");
if (requestedProviders.some((arg) => arg.startsWith("-"))) {
	printUsage();
	process.exit(1);
}

/** 当前仓库根目录。 */
const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { capture: true }).trim();
/** 本次比较所有临时 worktree 与输出的根目录。 */
const temporaryRoot = mkdtempSync(join(tmpdir(), "pi-model-catalog-diff-"));
/** 指向 HEAD 的临时基线 worktree。 */
const baselineWorktree = join(temporaryRoot, "baseline-worktree");
/** HEAD 模型目录输出目录。 */
const baselineOutput = join(temporaryRoot, "before");
/** 当前工作区模型目录输出目录。 */
const currentOutput = join(temporaryRoot, "after");
/** HEAD 有效推理等级输出目录。 */
const baselineThinkingOutput = join(temporaryRoot, "before-thinking");
/** 当前工作区有效推理等级输出目录。 */
const currentThinkingOutput = join(temporaryRoot, "after-thinking");
/** 基线 worktree 是否已成功添加，用于安全清理。 */
let worktreeAdded = false;

/**
 * 在指定 worktree 生成严格 JSON 模型目录。
 * @param {string} cwd 源 worktree。
 * @param {string} outputDir 输出目录。
 * @param {boolean} pretty 是否生成易读 JSON。
 * @returns {void}
 */
function generateCatalog(cwd, outputDir, pretty = false) {
	/** generate-models.ts 的命令参数。 */
	const args = ["packages/ai/scripts/generate-models.ts", "--strict", "--json-only", "--json-output", outputDir];
	if (pretty) args.push("--pretty");
	run(process.execPath, args, { cwd, capture: true });
}

/**
 * 将每个提供商 JSON 重写为稳定的两空格缩进格式。
 * @param {string} outputDir 目录生成根路径。
 * @returns {void}
 */
function formatProviderCatalogs(outputDir) {
	/** providers JSON 子目录。 */
	const providersDir = join(outputDir, "providers");
	/** entry 是 providers 目录中的当前文件名；非 JSON 文件会被忽略。 */
	for (const entry of readdirSync(providersDir)) {
		if (!entry.endsWith(".json")) continue;
		/** 当前提供商 JSON 路径。 */
		const path = join(providersDir, entry);
		/** 当前提供商目录解析值。 */
		const value = JSON.parse(readFileSync(path, "utf8"));
		writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
	}
}

/**
 * 读取单个提供商目录 JSON。
 * @param {string} outputDir 目录生成根路径。
 * @param {string} provider 提供商标识。
 * @returns {object|undefined} 提供商模型映射，不存在时为 undefined。
 */
function readProviderCatalog(outputDir, provider) {
	/** 目标提供商 JSON 文件路径。 */
	const path = join(outputDir, "providers", `${provider}.json`);
	return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
}

/**
 * 根据模型目录计算有效推理等级目录。
 * @param {string} cwd 源 worktree。
 * @param {string} catalogPath models.json 路径。
 * @param {string} outputDir 输出目录。
 * @returns {void}
 */
function generateThinkingCatalog(cwd, catalogPath, outputDir) {
	run(process.execPath, ["scripts/generate-thinking-capabilities.mjs", catalogPath, outputDir], {
		cwd,
		capture: true,
	});
}

/** 推理等级期望排序，从关闭到最高。 */
const THINKING_LEVEL_ORDER = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
/** 推理等级到排序序号的映射。 */
const THINKING_LEVEL_RANKS = new Map(THINKING_LEVEL_ORDER.map((key, index) => [key, index]));

/**
 * 按普通字典序或推理等级语义顺序排列 JSON 键。
 * @param {string[]} keys 待排序键。
 * @param {string|undefined} parentKey 父字段名。
 * @returns {string[]} 原地排序后的键。
 */
function sortJsonKeys(keys, parentKey) {
	if (parentKey !== "thinkingLevelMap" && parentKey !== "values") return keys.sort();
	return keys.sort((left, right) => {
		/** 左侧推理等级排序值，未知值排在最后。 */
		const leftRank = THINKING_LEVEL_RANKS.get(left) ?? Number.POSITIVE_INFINITY;
		/** 右侧推理等级排序值，未知值排在最后。 */
		const rightRank = THINKING_LEVEL_RANKS.get(right) ?? Number.POSITIVE_INFINITY;
		return leftRank - rightRank || left.localeCompare(right);
	});
}

/**
 * 递归复制 JSON，并稳定排序所有对象键。
 * @param {unknown} value JSON 值。
 * @param {string|undefined} parentKey 父字段名。
 * @returns {unknown} 规范化 JSON 值。
 */
function canonicalizeJson(value, parentKey) {
	if (Array.isArray(value)) return value.map((entry) => canonicalizeJson(entry));
	if (value === null || typeof value !== "object") return value;

	/** 写入规范键顺序的新对象。 */
	const result = {};
	/** key 是按目录规则排序后的当前对象键，用于递归生成稳定 JSON。 */
	for (const key of sortJsonKeys(Object.keys(value), parentKey)) {
		result[key] = canonicalizeJson(value[key], key);
	}
	return result;
}

/**
 * 将规范 JSON 格式化为每个数组/对象元素独占一行的 diff 文本。
 * @param {unknown} value JSON 值。
 * @param {string} indent 当前缩进。
 * @returns {string} 稳定格式文本。
 */
function formatJsonForDiff(value, indent = "") {
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		/** 数组子元素缩进。 */
		const childIndent = `${indent}  `;
		return `[\n${value.map((entry) => `${childIndent}${formatJsonForDiff(entry, childIndent)},`).join("\n")}\n${indent}]`;
	}
	if (value === null || typeof value !== "object") return JSON.stringify(value);

	/** 当前对象键值条目。 */
	const entries = Object.entries(value);
	if (entries.length === 0) return "{}";
	/** 对象子字段缩进。 */
	const childIndent = `${indent}  `;
	return `{\n${entries
		.map(([key, entry]) => `${childIndent}${JSON.stringify(key)}: ${formatJsonForDiff(entry, childIndent)},`)
		.join("\n")}\n${indent}}`;
}

/**
 * 写入单个模型的临时比较快照。
 * @param {string} path 输出文件路径。
 * @param {unknown} model 模型数据，undefined 写为空文件。
 * @returns {void}
 */
function writeModelSnapshot(path, model) {
	writeFileSync(path, model === undefined ? "" : `${formatJsonForDiff(canonicalizeJson(model))}\n`);
}

/**
 * 从彩色 git diff 中只输出真正增加或删除的内容行。
 * @param {string} output git diff 标准输出。
 * @returns {void}
 */
function writeChangedLines(output) {
	/** 去掉文件头后保留的加减行。 */
	const changedLines = output.split("\n").filter((line) => {
		/** 去除 ANSI 颜色控制符后的文本。 */
		const withoutColor = line.replace(/\u001b\[[0-9;]*m/g, "");
		return (
			(withoutColor.startsWith("+") && !withoutColor.startsWith("+++")) ||
			(withoutColor.startsWith("-") && !withoutColor.startsWith("---"))
		);
	});
	if (changedLines.length > 0) process.stdout.write(`${changedLines.join("\n")}\n`);
}

try {
	run("git", ["worktree", "add", "--detach", baselineWorktree, "HEAD"], { cwd: repoRoot });
	worktreeAdded = true;
	copyFileSync(
		join(repoRoot, "scripts", "generate-thinking-capabilities.mjs"),
		join(baselineWorktree, "scripts", "generate-thinking-capabilities.mjs"),
	);

	const nodeModules = join(repoRoot, "node_modules");
	/** nodeModules 是当前工作区依赖目录；存在时链接到基线工作树以避免重复安装。 */
	if (existsSync(nodeModules)) {
		symlinkSync(nodeModules, join(baselineWorktree, "node_modules"), process.platform === "win32" ? "junction" : "dir");
	}

	console.log("Generating catalog from HEAD...");
	generateCatalog(baselineWorktree, baselineOutput);
	formatProviderCatalogs(baselineOutput);
	console.log("Generating catalog from the current worktree...");
	generateCatalog(repoRoot, currentOutput, true);
	formatProviderCatalogs(currentOutput);

	if (thinkingOnly) {
		console.log("Computing effective thinking capabilities...");
		generateThinkingCatalog(baselineWorktree, join(baselineOutput, "models.json"), baselineThinkingOutput);
		generateThinkingCatalog(repoRoot, join(currentOutput, "models.json"), currentThinkingOutput);
	}

	/** HEAD 生成的提供商标识列表。 */
	const beforeProviders = JSON.parse(readFileSync(join(baselineOutput, "providers.json"), "utf8"));
	/** 当前工作区生成的提供商标识列表。 */
	const afterProviders = JSON.parse(readFileSync(join(currentOutput, "providers.json"), "utf8"));
	/** 实际比较的提供商列表。 */
	const providers =
		requestedProviders.length > 0 ? requestedProviders : [...new Set([...beforeProviders, ...afterProviders])].sort();
	/** 基线侧实际读取目录，可能是模型目录或推理等级目录。 */
	const beforeCatalogOutput = thinkingOnly ? baselineThinkingOutput : baselineOutput;
	/** 当前侧实际读取目录。 */
	const currentCatalogOutput = thinkingOnly ? currentThinkingOutput : currentOutput;
	/** 重复覆盖使用的基线单模型快照文件名。 */
	const beforeModelPath = "before-model.json";
	/** 重复覆盖使用的当前单模型快照文件名。 */
	const afterModelPath = "after-model.json";
	/** 已发现变化的 provider/model 列表。 */
	const changedModels = [];
	/** 变化模型总数。 */
	let differences = 0;

	for (const provider of providers) {
		/** 基线中的提供商模型映射。 */
		const beforeModels = readProviderCatalog(beforeCatalogOutput, provider);
		/** 当前工作区中的提供商模型映射。 */
		const afterModels = readProviderCatalog(currentCatalogOutput, provider);
		if (beforeModels === undefined && afterModels === undefined) {
			throw new Error(`Unknown provider: ${provider}`);
		}

		/** 两侧模型标识并集。 */
		const modelIds = [...new Set([...Object.keys(beforeModels ?? {}), ...Object.keys(afterModels ?? {})])].sort();
		for (const modelId of modelIds) {
			/** 基线侧单模型数据。 */
			const beforeModel = beforeModels?.[modelId];
			/** 当前侧单模型数据。 */
			const afterModel = afterModels?.[modelId];
			if (JSON.stringify(canonicalizeJson(beforeModel)) === JSON.stringify(canonicalizeJson(afterModel))) continue;

			writeModelSnapshot(join(temporaryRoot, beforeModelPath), beforeModel);
			writeModelSnapshot(join(temporaryRoot, afterModelPath), afterModel);
			/** 单模型无索引 git diff 结果。 */
			const result = runDiff(
				[
					"diff",
					"--no-index",
					"--no-ext-diff",
					"--color=always",
					"--unified=0",
					"--",
					beforeModelPath,
					afterModelPath,
				],
				temporaryRoot,
			);
			if (result.status === 1) {
				/** 用于汇总显示的 provider/model 标识。 */
				const changedModel = `${provider}/${modelId}`;
				console.log(`\n${changedModel}`);
				writeChangedLines(result.stdout);
				changedModels.push(changedModel);
				differences++;
			} else if (result.status !== 0) {
				throw new Error(`Could not compare ${provider}/${modelId}: ${result.stderr || result.stdout}`);
			}
		}
	}

	if (differences === 0) {
		console.log(`No model catalog changes${requestedProviders.length === 1 ? ` for ${requestedProviders[0]}` : ""}.`);
	} else {
		console.log(`\n${differences} model catalog entr${differences === 1 ? "y" : "ies"} changed.`);
		/** changedModel 是目录差异中的当前模型标识，用于逐行输出摘要。 */
		for (const changedModel of changedModels) {
			console.log(`- ${changedModel}`);
		}
	}
} finally {
	if (worktreeAdded) {
		try {
			run("git", ["worktree", "remove", "--force", baselineWorktree], { cwd: repoRoot });
		} catch (error) {
			/** error 是清理临时工作树时捕获的异常；记录后仍继续删除临时目录。 */
			console.error(error instanceof Error ? error.message : String(error));
		}
	}
	rmSync(temporaryRoot, { recursive: true, force: true });
}
