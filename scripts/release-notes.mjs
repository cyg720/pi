#!/usr/bin/env node

/**
 * 文件职责：从 coding-agent CHANGELOG 提取发布说明，并将本地或旧仓库 Markdown 链接规范化为指定标签的 GitHub 固定链接。
 * 技术维度：使用 Node.js 文件与子进程 API、Markdown 内联链接正则、POSIX 路径解析和 gh CLI 更新 Release。
 * 产品维度：生成可追溯且不会随 main 漂移的发布说明，也可批量修复历史 GitHub Release 中的失效链接。
 * 逻辑维度：解析命令与选项，提取版本章节并规范化链接；修复模式则分页读取 Release、展示差异并按需写回。
 * 关键边界：只处理内联 Markdown 链接；更新远端需要已认证 gh；非 dry-run 会修改 GitHub Release，调用前须确认范围。
 * 新手阅读建议：先看 normalizeLinkTarget 与 normalizeReleaseNoteLinks，再看 extractReleaseNotes，最后阅读 fixGithubReleases。
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** 默认 GitHub 仓库。 */
const DEFAULT_REPO = "earendil-works/pi";
/** 相对 CHANGELOG 链接解析时使用的默认仓库基路径。 */
const DEFAULT_BASE_PATH = "packages/coding-agent";
/** 默认 CHANGELOG 文件。 */
const DEFAULT_CHANGELOG = "packages/coding-agent/CHANGELOG.md";
/** 批量修复历史 Release 时最早允许的标签。 */
const DEFAULT_FIX_SINCE_TAG = "v0.74.0";
/** 需要迁移到当前仓库的旧 pi-mono URL 前缀。 */
const LEGACY_REPO_RE = /^https:\/\/github\.com\/(?:badlogic|earendil-works)\/pi-mono(?=\/|$)/;
/** 判断目标是否已带 URL 协议的正则。 */
const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
/** 匹配 Markdown 内联链接或图片链接的正则。 */
const INLINE_MARKDOWN_LINK_RE = /(!?\[[^\]\n]+\]\()([^\s)]+)((?:\s+[^)]*)?\))/g;

/** 输出命令和选项帮助，无返回值。示例：printUsage()。 */
function printUsage() {
	console.log(`Usage: node scripts/release-notes.mjs <command> [options]

Commands:
  extract              Extract release notes from the coding-agent changelog
  fix-github-releases  Rewrite existing GitHub release note links in place

extract options:
  --version <x.y.z>    Version to extract
  --tag <vX.Y.Z>       Release tag used for repository links (defaults to v<version>)
  --changelog <path>   Changelog path (default: ${DEFAULT_CHANGELOG})
  --out <path>         Output file (default: stdout)
  --repo <owner/repo>  GitHub repository for generated links (default: ${DEFAULT_REPO})
  --base-path <path>   Base path for relative changelog links (default: ${DEFAULT_BASE_PATH})

fix-github-releases options:
  --repo <owner/repo>     GitHub repository to patch (default: ${DEFAULT_REPO})
  --tag <vX.Y.Z>          Patch only one release tag
  --since-tag <vX.Y.Z>    Oldest release tag to patch (default: ${DEFAULT_FIX_SINCE_TAG})
  --base-path <path>      Base path for relative changelog links (default: ${DEFAULT_BASE_PATH})
  --dry-run               Print releases that would change without updating GitHub
`);
}

/** Windows 上为外部命令补 .cmd，其他平台原样返回。示例：commandForPlatform("gh")。 */
function commandForPlatform(command) {
	return process.platform === "win32" ? `${command}.cmd` : command;
}

/** 同步执行外部命令并在失败时抛出包含输出的异常。返回 stdout。示例：run("gh", args, {capture: true})。 */
function run(command, args, options = {}) {
	/** 子进程同步执行结果。 */
	const result = spawnSync(commandForPlatform(command), args, {
		cwd: options.cwd,
		encoding: "utf8",
		maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
		stdio: options.capture ? ["inherit", "pipe", "pipe"] : "inherit",
	});

	if (result.status !== 0) {
		/** 合并后的 stdout 与 stderr。 */
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
		throw new Error(output ? `Command failed: ${command} ${args.join(" ")}\n${output}` : `Command failed: ${command} ${args.join(" ")}`);
	}

	return result.stdout ?? "";
}

/** 解析命令后的选项数组。返回带默认值的配置对象。示例：parseOptions(args)。 */
function parseOptions(args) {
	/** 可由命令行覆盖的全部配置。 */
	const options = {
		basePath: DEFAULT_BASE_PATH,
		changelog: DEFAULT_CHANGELOG,
		dryRun: false,
		out: undefined,
		repo: DEFAULT_REPO,
		sinceTag: DEFAULT_FIX_SINCE_TAG,
		tag: undefined,
		version: undefined,
	};

	for (let i = 0; i < args.length; i++) {
		/** 当前命令行选项名。 */
		const arg = args[i];
		if (arg === "--help") {
			printUsage();
			process.exit(0);
		}
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}

		/** 允许携带值的选项名集合。 */
		const optionNames = new Set(["--base-path", "--changelog", "--out", "--repo", "--since-tag", "--tag", "--version"]);
		if (!optionNames.has(arg)) {
			throw new Error(`Unknown option: ${arg}`);
		}

		/** 当前选项后紧跟的值。 */
		const value = args[++i];
		if (!value) {
			throw new Error(`${arg} requires a value`);
		}

		if (arg === "--base-path") options.basePath = value;
		if (arg === "--changelog") options.changelog = value;
		if (arg === "--out") options.out = value;
		if (arg === "--repo") options.repo = value;
		if (arg === "--since-tag") options.sinceTag = value;
		if (arg === "--tag") options.tag = value;
		if (arg === "--version") options.version = value;
	}

	return options;
}

/** 将版本或标签规范化为 v 前缀标签；空值返回 undefined。示例：normalizeTag("1.2.3")。 */
function normalizeTag(tagOrVersion) {
	if (!tagOrVersion) {
		return undefined;
	}
	return tagOrVersion.startsWith("v") ? tagOrVersion : `v${tagOrVersion}`;
}

/** 从 v 前缀标签提取版本号。示例：versionFromTag("v1.2.3")。 */
function versionFromTag(tag) {
	return tag.startsWith("v") ? tag.slice(1) : tag;
}

/** 比较最多三段数值版本。返回负数、0 或正数。示例：compareVersions("v1.2.0", "v1.1.0")。 */
function compareVersions(a, b) {
	/** 左侧标签的三段数字。 */
	const aParts = versionFromTag(a).split(".").map(Number);
	/** 右侧标签的三段数字。 */
	const bParts = versionFromTag(b).split(".").map(Number);

	for (let i = 0; i < 3; i++) {
		/** 当前版本段差值，缺失段按 0。 */
		const diff = (aParts[i] || 0) - (bParts[i] || 0);
		if (diff !== 0) {
			return diff;
		}
	}

	return 0;
}

/** 转义正则元字符。返回可安全拼入 RegExp 的字符串。 */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 从 CHANGELOG 中提取指定版本正文，不存在时返回空串。示例：extractChangelogSection(text, version)。 */
function extractChangelogSection(changelog, version) {
	/** 指定版本二级标题的正则。 */
	const headingRe = new RegExp(`^## \\[${escapeRegExp(version)}\\](?:\\s+-\\s+\\d{4}-\\d{2}-\\d{2})?\\s*$`, "m");
	/** 版本标题匹配结果。 */
	const heading = headingRe.exec(changelog);

	if (!heading) {
		return "";
	}

	/** 标题结束后的正文起点。 */
	const sectionStart = heading.index + heading[0].length;
	/** 从版本标题后开始的剩余文本。 */
	const rest = changelog.slice(sectionStart);
	/** 下一版本标题相对 rest 的位置。 */
	const nextHeading = rest.search(/^## \[/m);
	/** 当前版本未清理空白的章节正文。 */
	const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
	return section.trim();
}

/** 将本地链接拆为路径、查询和片段。返回三个部分。示例：splitLocalTarget("a.md?q#x")。 */
function splitLocalTarget(target) {
	/** # 片段开始位置。 */
	const hashIndex = target.indexOf("#");
	/** 去除 # 片段后的目标。 */
	const beforeHash = hashIndex === -1 ? target : target.slice(0, hashIndex);
	/** 包含 # 的片段文本。 */
	const fragment = hashIndex === -1 ? "" : target.slice(hashIndex);
	/** 查询字符串开始位置。 */
	const queryIndex = beforeHash.indexOf("?");

	if (queryIndex === -1) {
		return { fragment, pathPart: beforeHash, query: "" };
	}

	return {
		fragment,
		pathPart: beforeHash.slice(0, queryIndex),
		query: beforeHash.slice(queryIndex),
	};
}

/** 把 Windows 反斜杠转换为 URL 使用的正斜杠。 */
function normalizePathPart(value) {
	return value.replaceAll("\\", "/");
}

/** 规范化仓库基路径并去除末尾斜杠，根路径返回空串。 */
function normalizeBasePath(basePath) {
	/** POSIX 规范化后的基路径。 */
	const normalized = path.posix.normalize(normalizePathPart(basePath)).replace(/\/+$/, "");
	return normalized === "." ? "" : normalized;
}

/** 将相对链接解析为仓库内路径；越出仓库时返回 undefined。 */
function resolveRepositoryPath(targetPath, basePath) {
	/** 统一为正斜杠的目标路径。 */
	const normalizedTarget = normalizePathPart(targetPath);
	/** 与基路径合并后的仓库相对路径。 */
	const joined = normalizedTarget.startsWith("/")
		? path.posix.normalize(normalizedTarget.replace(/^\/+/, ""))
		: path.posix.normalize(path.posix.join(normalizeBasePath(basePath), normalizedTarget));

	if (joined === "." || joined.startsWith("../") || joined === "..") {
		return undefined;
	}

	return joined;
}

/** 根据末尾斜杠或 basename 是否有扩展名推测目标是否为目录。 */
function isDirectoryTarget(originalPath, repositoryPath) {
	if (originalPath.endsWith("/")) {
		return true;
	}

	/** 仓库路径最后一段名称。 */
	const basename = path.posix.basename(repositoryPath);
	return !basename.includes(".");
}

/** 规范化单个 Markdown 链接目标。返回原目标或固定到标签的 GitHub URL。 */
function normalizeLinkTarget(target, options) {
	/** 先把旧仓库前缀迁移为目标仓库的候选链接。 */
	let canonicalTarget = target.replace(LEGACY_REPO_RE, `https://github.com/${options.repo}`);
	/** 目标仓库基础 URL。 */
	const repoUrl = `https://github.com/${options.repo}`;

	for (const route of ["blob", "tree"]) {
		for (const branch of ["main", "master"]) {
			/** 指向 main/master 的浮动 blob/tree 前缀。 */
			const floatingRefPrefix = `${repoUrl}/${route}/${branch}/`;
			if (canonicalTarget.startsWith(floatingRefPrefix)) {
				canonicalTarget = `${repoUrl}/${route}/${options.tag}/${canonicalTarget.slice(floatingRefPrefix.length)}`;
			}
		}
	}

	if (canonicalTarget.startsWith("#") || canonicalTarget.startsWith("//") || URL_SCHEME_RE.test(canonicalTarget)) {
		return canonicalTarget;
	}

	/** 拆分后的片段、路径和查询部分。 */
	const { fragment, pathPart, query } = splitLocalTarget(canonicalTarget);
	if (!pathPart) {
		return canonicalTarget;
	}

	/** 相对目标解析出的仓库路径。 */
	const repositoryPath = resolveRepositoryPath(pathPart, options.basePath);
	if (!repositoryPath) {
		return canonicalTarget;
	}

	/** GitHub 中目录使用 tree，文件使用 blob。 */
	const route = isDirectoryTarget(pathPart, repositoryPath) ? "tree" : "blob";
	return `https://github.com/${options.repo}/${route}/${options.tag}/${encodeURI(repositoryPath)}${query}${fragment}`;
}

/** 规范化 Markdown 中全部内联链接。返回新文本与每次变更。 */
function normalizeReleaseNoteLinks(markdown, options) {
	/** 所有发生变化的 from/to 链接对。 */
	const changes = [];
	/** 替换完成的 Markdown。 */
	const normalized = markdown.replace(INLINE_MARKDOWN_LINK_RE, (match, prefix, target, suffix) => {
		/** 当前链接规范化后的目标。 */
		const normalizedTarget = normalizeLinkTarget(target, options);
		if (normalizedTarget !== target) {
			changes.push({ from: target, to: normalizedTarget });
		}
		return `${prefix}${normalizedTarget}${suffix}`;
	});

	return { changes, markdown: normalized };
}

/** 将内容写入指定文件；未给路径时写 stdout。无返回值。 */
function writeOutput(content, outPath) {
	if (outPath) {
		writeFileSync(outPath, content);
		return;
	}

	process.stdout.write(content);
}

/** 从 CHANGELOG 提取指定版本并输出规范化发布说明。无返回值。 */
function extractReleaseNotes(options) {
	/** 显式版本或从标签推导出的版本。 */
	const version = options.version ?? (options.tag ? versionFromTag(options.tag) : undefined);
	if (!version) {
		throw new Error("extract requires --version or --tag");
	}

	if (!existsSync(options.changelog)) {
		throw new Error(`Changelog does not exist: ${options.changelog}`);
	}

	/** 用于生成 GitHub 固定链接的规范标签。 */
	const tag = normalizeTag(options.tag ?? version);
	/** CHANGELOG 完整文本。 */
	const changelog = readFileSync(options.changelog, "utf8");
	/** 指定版本的章节正文。 */
	const section = extractChangelogSection(changelog, version);
	/** 有章节时使用正文，否则生成最小发布文本。 */
	const rawNotes = section ? `${section}\n` : `Release ${version}\n`;
	/** 链接规范化后的 Markdown。 */
	const { markdown } = normalizeReleaseNoteLinks(rawNotes, { basePath: options.basePath, repo: options.repo, tag });
	writeOutput(markdown, options.out);
}

/** 使用 gh API 分页列出仓库 Release。返回解析后的对象数组。 */
function listGithubReleases(repo) {
	/** gh 输出的逐行 JSON 文本。 */
	const output = run("gh", ["api", `repos/${repo}/releases`, "--paginate", "--jq", ".[] | {id, tag_name, body} | @json"], {
		capture: true,
	});
	return output
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

/** 去除重复的链接变更对。返回保持首次出现顺序的数组。 */
function uniqueChanges(changes) {
	/** 已见 from/to 对的复合键。 */
	const seen = new Set();
	/** 去重后的变更列表。 */
	const unique = [];
	for (const change of changes) {
		/** 同时包含旧目标和新目标的去重键。 */
		const key = `${change.from}\n${change.to}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push(change);
	}
	return unique;
}

/** 用临时 notes 文件调用 gh release edit。无返回值。 */
function updateGithubRelease(repo, tag, body) {
	/** 存放临时 notes.md 的目录。 */
	const tempDir = mkdtempSync(path.join(tmpdir(), "pi-release-notes-"));
	try {
		/** 传给 gh 的临时发布说明文件。 */
		const notesPath = path.join(tempDir, "notes.md");
		writeFileSync(notesPath, body);
		run("gh", ["release", "edit", tag, "--repo", repo, "--notes-file", notesPath], { capture: true });
	} finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
}

/** 筛选并修复 GitHub Release 链接；dryRun 时只打印。无返回值。 */
function fixGithubReleases(options) {
	/** 可选的单标签过滤器。 */
	const tagFilter = normalizeTag(options.tag);
	/** 最早允许处理的规范标签。 */
	const sinceTag = normalizeTag(options.sinceTag);
	/** 仓库中满足单标签过滤的 Release。 */
	const matchingReleases = listGithubReleases(options.repo).filter((release) => !tagFilter || release.tag_name === tagFilter);

	if (tagFilter && matchingReleases.length === 0) {
		throw new Error(`Release not found: ${tagFilter}`);
	}

	/** 再按最早版本过滤后的 Release。 */
	const releases = matchingReleases.filter((release) => compareVersions(release.tag_name, sinceTag) >= 0);
	if (tagFilter && releases.length === 0) {
		console.log(`Skipping ${tagFilter}: older than ${sinceTag}.`);
		console.log(`${options.dryRun ? "Would update" : "Updated"} 0 releases.`);
		return;
	}

	/** 实际需要修改的 Release 数。 */
	let changedCount = 0;
	for (const release of releases) {
		/** 当前 Release 标签。 */
		const tag = release.tag_name;
		/** 当前 Release 正文，空值回退为空串。 */
		const body = release.body ?? "";
		/** 当前正文的规范化结果和链接变更。 */
		const result = normalizeReleaseNoteLinks(body, { basePath: options.basePath, repo: options.repo, tag });
		if (result.markdown === body) {
			continue;
		}

		changedCount++;
		/** 去重后用于控制台展示的链接变更。 */
		const unique = uniqueChanges(result.changes);
		console.log(`${options.dryRun ? "Would update" : "Updating"} ${tag} (${unique.length} link${unique.length === 1 ? "" : "s"})`);
		for (const change of unique) {
			console.log(`  ${change.from}`);
			console.log(`  -> ${change.to}`);
		}

		if (!options.dryRun) {
			updateGithubRelease(options.repo, tag, result.markdown);
		}
	}

	/** 最终统计使用的动作前缀。 */
	const prefix = options.dryRun ? "Would update" : "Updated";
	console.log(`${prefix} ${changedCount} release${changedCount === 1 ? "" : "s"}.`);
}

try {
	/** 顶层子命令及其余参数。 */
	const [command, ...args] = process.argv.slice(2);
	if (!command || command === "--help") {
		printUsage();
		process.exit(command ? 0 : 1);
	}

	/** 解析完成的子命令选项。 */
	const options = parseOptions(args);
	if (command === "extract") {
		extractReleaseNotes(options);
	} else if (command === "fix-github-releases") {
		fixGithubReleases(options);
	} else {
		throw new Error(`Unknown command: ${command}`);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
