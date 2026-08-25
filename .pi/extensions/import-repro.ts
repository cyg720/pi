/**
 * Import a pi session shared as a gist by the issue-analysis CI workflow
 * (.github/workflows/issue-analysis.yml) and switch to it.
 *
 * The CI job runs in a high-entropy checkout directory; this command rewrites
 * the recorded cwd to the local checkout, installs the session file into the
 * current session directory, and switches to it.
 *
 * Usage:
 *   /ir b4d100022aefb12f25dd2d8485e0a82a
 *   /ir https://gist.github.com/mitsuhiko/b4d100022aefb12f25dd2d8485e0a82a
 *   /ir https://pi.dev/session/#b4d100022aefb12f25dd2d8485e0a82a
 *   /ir https://github.com/earendil-works/pi/issues/123
 *
 *   pi "/ir <gist-id>"
 */
/**
 * 文件职责：实现 /ir 扩展命令，从 Gist、共享页、GitHub Issue 或本地文件导入问题复现会话并切换过去。
 * 技术维度：使用 GitHub REST API、Base64 解码、JSONL/HTML 解析、跨平台路径识别与字符串级 cwd 重写。
 * 产品维度：让维护者可一条命令复现 CI 问题分析会话，并把高熵 CI 路径安全映射到当前本地仓库。
 * 逻辑维度：先解析引用类型并取得会话，再验证头部、重写路径、处理覆盖确认，最后切换会话并写入平台提示。
 * 关键边界：远程请求依赖 GitHub 可访问；只接受规定 URL/文件格式；覆盖会丢失目标会话本地改动，必须确认。
 * 新手阅读建议：先看 parseRef、parseSessionJsonl 和 decodeExportedHtml，再看路径重写函数，最后跟读命令 handler。
 */

import { Buffer } from "node:buffer";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

/** 纯 Gist ID 的允许格式。 */
const GIST_ID_RE = /^[0-9a-fA-F]{20,}$/;
/** 从 GitHub Gist URL 提取 ID 的格式。 */
const GIST_URL_RE = /^https:\/\/gist\.github\.com\/(?:[^/]+\/)?([0-9a-fA-F]{20,})(?:[/#?].*)?$/;
/** 从 pi.dev 会话共享 URL 提取 Gist ID 的格式。 */
const SHARE_URL_RE = /^https:\/\/pi\.dev\/session\/#([0-9a-fA-F]{20,})(?:[/#?].*)?$/;
/** 从 GitHub Issue URL 提取 owner、repo 与 issue 编号的格式。 */
const ISSUE_URL_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:[/#?].*)?$/;
/** 在 Issue 评论正文中查找全部 Gist URL 的全局正则。 */
const GIST_URL_IN_TEXT_RE = /https:\/\/gist\.github\.com\/(?:[^/\s]+\/)?([0-9a-fA-F]{20,})\b/g;
/** 从导出 HTML 中提取 Base64 会话数据脚本的正则。 */
const SESSION_DATA_RE = /<script id="session-data" type="application\/json">([^<]+)<\/script>/;

/** JSONL 会话首行必须包含的头部字段。 */
interface SessionHeader {
	type: "session";
	id: string;
	cwd: string;
	[key: string]: unknown;
}

/** 导出 HTML 解码后的会话头与条目结构。 */
interface ExportedSessionData {
	header: SessionHeader | null;
	entries: Array<Record<string, unknown>>;
}

/** GitHub Gist API 返回的单个文件元数据。 */
interface GistFile {
	filename?: string;
	raw_url?: string;
	content?: string;
	truncated?: boolean;
}

/** Gist API 响应中本扩展关心的文件映射。 */
interface GistResponse {
	files?: Record<string, GistFile>;
}

/** Issue 评论中用于筛选机器人和 Gist 链接的字段。 */
interface IssueComment {
	body?: string | null;
	user?: { login?: string } | null;
}

/** 将用户引用解析为 Gist、本地文件或 Issue。cwd 用于解析相对文件；返回带判别字段的引用。示例：parseRef(ref, cwd)。 */
function parseRef(
	ref: string,
	cwd: string,
): { type: "gist"; id: string } | { type: "file"; path: string } | { type: "issue"; owner: string; repo: string; issue: string } {
	if (ref.endsWith(".html") || ref.endsWith(".jsonl")) {
		return { type: "file", path: isAbsolute(ref) ? ref : resolve(cwd, ref) };
	}

	/** pi.dev 共享 URL 的匹配结果。 */
	const shareMatch = ref.match(SHARE_URL_RE);
	if (shareMatch) return { type: "gist", id: shareMatch[1] };

	/** GitHub Gist URL 的匹配结果。 */
	const gistMatch = ref.match(GIST_URL_RE);
	if (gistMatch) return { type: "gist", id: gistMatch[1] };

	/** GitHub Issue URL 的匹配结果。 */
	const issueMatch = ref.match(ISSUE_URL_RE);
	if (issueMatch) return { type: "issue", owner: issueMatch[1], repo: issueMatch[2], issue: issueMatch[3] };

	if (GIST_ID_RE.test(ref)) return { type: "gist", id: ref };

	throw new Error(`expected a gist ID, gist URL, pi.dev share URL, issue URL, .html file, or .jsonl file: ${ref}`);
}

/** 解析 JSONL 首行并验证会话头。返回头部和未修改原文。示例：parseSessionJsonl(raw)。 */
function parseSessionJsonl(raw: string): { header: SessionHeader; jsonl: string } {
	/** 首个换行符位置；不存在时整段即首行。 */
	const newlineIndex = raw.indexOf("\n");
	/** 应包含会话头 JSON 的首行。 */
	const firstLine = newlineIndex === -1 ? raw : raw.slice(0, newlineIndex);
	/** 首行解析后的未知值。 */
	let parsed: unknown;
	try {
		parsed = JSON.parse(firstLine);
	} catch {
		throw new Error("first line of session file is not valid JSON");
	}
	/** 作为部分会话头检查必需字段的解析结果。 */
	const header = parsed as Partial<SessionHeader>;
	if (header.type !== "session" || typeof header.id !== "string" || typeof header.cwd !== "string" || header.cwd === "") {
		throw new Error("session file has no valid session header with a cwd");
	}
	return { header: header as SessionHeader, jsonl: raw };
}

/** 解码导出 HTML 内嵌的 Base64 会话并重建 JSONL。返回会话头和文本。示例：decodeExportedHtml(html)。 */
function decodeExportedHtml(html: string): { header: SessionHeader; jsonl: string } {
	/** session-data 脚本及其 Base64 内容匹配结果。 */
	const match = html.match(SESSION_DATA_RE);
	if (!match) throw new Error("HTML does not contain embedded pi session data");

	/** Base64 解码并解析后的未知数据。 */
	let data: unknown;
	try {
		data = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
	} catch {
		throw new Error("embedded pi session data is not valid JSON");
	}

	/** 用于校验头和条目字段的部分导出结构。 */
	const sessionData = data as Partial<ExportedSessionData>;
	/** 导出数据中的会话头。 */
	const header = sessionData.header;
	if (!header || header.type !== "session" || typeof header.id !== "string" || typeof header.cwd !== "string") {
		throw new Error("embedded pi session data has no valid session header");
	}
	if (!Array.isArray(sessionData.entries)) {
		throw new Error("embedded pi session data has no entries array");
	}

	/** 将头部和条目逐项序列化后的 JSONL 行。 */
	const lines = [header, ...sessionData.entries].map((entry) => JSON.stringify(entry));
	return { header, jsonl: `${lines.join("\n")}\n` };
}

/** 会话记录路径可能来自的平台分类。 */
type SessionPlatform = "windows" | "unix" | "unknown";

/** 转义字符串以便直接替换 JSON 字符串内部内容。返回无外层引号文本。示例：escapeJsonString(cwd)。 */
function escapeJsonString(value: string): string {
	return JSON.stringify(value).slice(1, -1);
}

/** 转义正则元字符。返回可安全拼入 RegExp 的文本。示例：escapeRegExp(name)。 */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 删除路径末尾斜杠或反斜杠。返回规范化尾部的文本。示例：trimTrailingPathSeparators(path)。 */
function trimTrailingPathSeparators(value: string): string {
	return value.replace(/[\\/]+$/, "");
}

/** 跨 Windows/Unix 分隔符读取路径最后一段。返回名称或空串。示例：getPathTailName(cwd)。 */
function getPathTailName(value: string): string {
	/** 去除末尾分隔符后的路径。 */
	const trimmed = trimTrailingPathSeparators(value);
	return trimmed.split(/[\\/]/).filter(Boolean).at(-1) ?? "";
}

/** 识别 C:\\path 或 /c/path 并返回盘符与正斜杠路径。无法识别时返回 undefined。 */
function getWindowsDrivePathParts(value: string): { drive: string; rest: string } | undefined {
	/** 去除末尾分隔符后的候选路径。 */
	const trimmed = trimTrailingPathSeparators(value);
	/** 标准盘符路径匹配结果。 */
	const driveMatch = trimmed.match(/^([A-Za-z]):[\\/](.*)$/);
	if (driveMatch) {
		return { drive: driveMatch[1].toUpperCase(), rest: driveMatch[2].replace(/[\\/]+/g, "/") };
	}

	/** MSYS 风格 /c/path 匹配结果。 */
	const msysMatch = trimmed.match(/^\/([A-Za-z])\/(.*)$/);
	if (msysMatch) {
		return { drive: msysMatch[1].toUpperCase(), rest: msysMatch[2].replace(/[\\/]+/g, "/") };
	}

	return undefined;
}

/** 生成源 cwd 的 Windows、正斜杠和 MSYS 等价写法。返回按长度降序的去重列表。 */
function getCwdRewriteVariants(sourceCwd: string): string[] {
	/** 去除尾部分隔符后的源 cwd。 */
	const trimmed = trimTrailingPathSeparators(sourceCwd);
	/** 去重保存所有候选写法。 */
	const variants = new Set<string>();
	if (trimmed) variants.add(trimmed);

	/** 源 cwd 的 Windows 盘符分解结果。 */
	const driveParts = getWindowsDrivePathParts(trimmed);
	if (driveParts) {
		/** 去除首尾正斜杠的盘符后路径。 */
		const rest = driveParts.rest.replace(/^\/+|\/+$/g, "");
		/** 反斜杠形式的盘符后路径。 */
		const backslashRest = rest.replace(/\//g, "\\");
		variants.add(`${driveParts.drive}:\\${backslashRest}`);
		variants.add(`${driveParts.drive}:/${rest}`);
		variants.add(`/${driveParts.drive.toLowerCase()}/${rest}`);
		variants.add(`/${driveParts.drive}/${rest}`);
	}

	return Array.from(variants).filter(Boolean).sort((a, b) => b.length - a.length);
}

/** 仅当路径末段符合 CI 临时目录命名时返回该名称。示例：getCiWorkdirName(sourceCwd)。 */
function getCiWorkdirName(sourceCwd: string): string | undefined {
	/** 源路径最后一段目录名。 */
	const name = getPathTailName(sourceCwd);
	return /^pi-ci-[0-9a-f]{32}$/i.test(name) ? name : undefined;
}

/** 根据 cwd 写法识别来源平台。返回 windows、unix 或 unknown。示例：detectSessionPlatform(cwd)。 */
function detectSessionPlatform(cwd: string): SessionPlatform {
	if (/^[A-Za-z]:[\\/]/.test(cwd) || /^\/[A-Za-z]\//.test(cwd)) return "windows";
	if (cwd.startsWith("/")) return "unix";
	return "unknown";
}

/** 返回当前 Node.js 运行平台的路径类别。示例：getLocalPlatform()。 */
function getLocalPlatform(): Exclude<SessionPlatform, "unknown"> {
	return process.platform === "win32" ? "windows" : "unix";
}

/** 跨平台继续会话时生成路径风格提示；同平台或未知来源返回 undefined。 */
function getPlatformContinuationNotice(sourceCwd: string): string | undefined {
	/** 会话原 cwd 的平台类别。 */
	const sourcePlatform = detectSessionPlatform(sourceCwd);
	/** 当前机器的平台类别。 */
	const localPlatform = getLocalPlatform();
	if (sourcePlatform === "unknown" || sourcePlatform === localPlatform) return undefined;
	if (localPlatform === "unix") {
		return "This session was continued on a non-Windows machine; paths are now Unix style.";
	}
	return "This session was continued on a Windows machine; paths are now Windows style.";
}

/** Rewrite occurrences of the recorded CI cwd (JSON-escaped) to the target cwd. */
/** 将记录中 JSON 转义后的 CI cwd 各种写法替换为目标 cwd。返回重写后的完整 JSONL。 */
function rewriteSessionCwd(raw: string, sourceCwd: string, targetCwd: string): string {
	/** 目标 cwd 的 JSON 字符串内部写法。 */
	const target = escapeJsonString(targetCwd);
	/** 逐步应用替换的 JSONL 文本。 */
	let rewritten = raw;

	/** sourceVariant 是源工作目录的当前等价写法；与目标相同的写法无需替换。 */
	for (const sourceVariant of getCwdRewriteVariants(sourceCwd)) {
		if (sourceVariant === targetCwd) continue;
		rewritten = rewritten.split(escapeJsonString(sourceVariant)).join(target);
	}

	/** 若源 cwd 是标准 CI 临时目录，则用于宽松匹配的目录名。 */
	const ciWorkdirName = getCiWorkdirName(sourceCwd);
	if (ciWorkdirName) {
		/** 经过正则转义的 CI 目录名。 */
		const escapedName = escapeRegExp(ciWorkdirName);
		/** 能覆盖盘符路径和 MSYS 路径的宽松匹配正则。 */
		const windowsPathPatterns = [
			new RegExp(`[A-Za-z]:(?:[^"\\r\\n])*?${escapedName}`, "g"),
			new RegExp(`/[A-Za-z]/(?:[^"\\r\\n])*?${escapedName}`, "g"),
		];
		/** pattern 是当前 Windows 路径兼容表达式，用于清理残留绝对路径。 */
		for (const pattern of windowsPathPatterns) {
			rewritten = rewritten.replace(pattern, target);
		}
	}

	return rewritten;
}

/** 获取远程文本并检查 HTTP 状态。返回响应正文。示例：await fetchText(rawUrl)。 */
async function fetchText(url: string): Promise<string> {
	/** GitHub API 或 raw URL 的 HTTP 响应。 */
	const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
	if (!response.ok) {
		throw new Error(`failed to fetch ${url}: HTTP ${response.status}`);
	}
	return await response.text();
}

/** 读取 Gist 文件；完整 content 可直接使用，否则请求 raw_url。返回文件文本。 */
async function readGistFile(file: GistFile): Promise<string> {
	if (file.content && !file.truncated) return file.content;
	if (!file.raw_url) throw new Error(`gist file ${file.filename ?? "<unknown>"} has no raw URL`);
	return await fetchText(file.raw_url);
}

/** 分页查找 Issue 中 github-actions 机器人最后发布的 Gist ID。返回 ID，找不到则抛错。 */
async function findIssueGistId(owner: string, repo: string, issue: string): Promise<string> {
	/** 按评论顺序收集的所有机器人 Gist ID。 */
	const gistIds: string[] = [];
	/** 当前请求的 GitHub 评论页码。 */
	let page = 1;
	while (true) {
		/** 当前页 Issue 评论响应。 */
		const response = await fetch(
			`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issue)}/comments?per_page=100&page=${page}`,
			{ headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } },
		);
		if (!response.ok) throw new Error(`failed to fetch issue comments: HTTP ${response.status}`);

		/** 当前页解析出的评论列表。 */
		const comments = (await response.json()) as IssueComment[];
		/** comment 是当前议题评论；仅分析 GitHub Actions 机器人发布的内容。 */
		for (const comment of comments) {
			if (comment.user?.login !== "github-actions[bot]") continue;
			/** match 是评论正文中当前匹配到的 Gist 链接，其第一捕获组为 Gist ID。 */
			for (const match of (comment.body ?? "").matchAll(GIST_URL_IN_TEXT_RE)) {
				gistIds.push(match[1]);
			}
		}

		if (comments.length < 100) break;
		page++;
	}

	/** 最后出现的 Gist ID，视为最新分析结果。 */
	const gistId = gistIds.at(-1);
	if (!gistId) throw new Error(`no github-actions gist link found in comments on ${owner}/${repo}#${issue}`);
	return gistId;
}

/** 从 Gist API 读取 .jsonl 或 .html 会话。返回标准头和 JSONL。示例：fetchGistSession(id)。 */
async function fetchGistSession(gistId: string): Promise<{ header: SessionHeader; jsonl: string }> {
	/** Gist 元数据响应。 */
	const response = await fetch(`https://api.github.com/gists/${gistId}`, {
		headers: {
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});
	if (!response.ok) throw new Error(`failed to fetch gist ${gistId}: HTTP ${response.status}`);

	/** 解析后的 Gist 元数据。 */
	const gist = (await response.json()) as GistResponse;
	/** Gist 中全部文件。 */
	const files = Object.values(gist.files ?? {});
	/** 优先选择的 JSONL 会话文件。 */
	const jsonlFile = files.find((file) => file.filename?.endsWith(".jsonl"));
	if (jsonlFile) return parseSessionJsonl(await readGistFile(jsonlFile));

	/** JSONL 不存在时回退的 HTML 导出文件。 */
	const htmlFile = files.find((file) => file.filename?.endsWith(".html"));
	if (htmlFile) return decodeExportedHtml(await readGistFile(htmlFile));

	throw new Error(`gist ${gistId} has no .jsonl or .html session file`);
}

/** 注册 /ir 命令。参数 pi 为扩展 API；无返回值。示例：由扩展加载器调用默认导出函数。 */
export default function (pi: ExtensionAPI) {
	pi.registerCommand("ir", {
		description: "Import a CI issue-analysis session from a gist ID, share URL, or issue URL and switch to it",
		/** 解析引用、导入会话、重写 cwd 并切换；错误通过 UI 通知。 */
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			/** 用户参数去除首尾空白后的引用。 */
			const ref = args.trim();
			if (!ref) {
				ctx.ui.notify("Usage: /ir <gist-id | gist-url | pi.dev/session URL | issue URL>", "error");
				return;
			}

			try {
				/** 当前会话工作目录，也是路径重写目标。 */
				const targetCwd = ctx.sessionManager.getCwd();
				/** 当前项目的会话文件目录。 */
				const sessionDir = ctx.sessionManager.getSessionDir();
				/** 解析后的引用类型和字段。 */
				const parsedRef = parseRef(ref, targetCwd);

				ctx.ui.notify(`Importing repro session from ${ref}...`, "info");

				/** 导入后使用的 JSONL 文件名。 */
				let sourceName: string;
				/** 从远程或本地读取并解码的会话。 */
				let decoded: { header: SessionHeader; jsonl: string };
				if (parsedRef.type === "gist") {
					decoded = await fetchGistSession(parsedRef.id);
					sourceName = `${parsedRef.id}.jsonl`;
				} else if (parsedRef.type === "issue") {
					/** Issue 评论中找到的最新 CI Gist ID。 */
					const gistId = await findIssueGistId(parsedRef.owner, parsedRef.repo, parsedRef.issue);
					decoded = await fetchGistSession(gistId);
					sourceName = `${gistId}.jsonl`;
				} else {
					if (!existsSync(parsedRef.path)) throw new Error(`session file not found: ${parsedRef.path}`);
					/** 本地 HTML 或 JSONL 文件原文。 */
					const raw = readFileSync(parsedRef.path, "utf8");
					decoded = parsedRef.path.endsWith(".html") ? decodeExportedHtml(raw) : parseSessionJsonl(raw);
					sourceName = basename(parsedRef.path).replace(/\.html$/, ".jsonl");
				}

				/** 当来源平台不同于本机时追加到新会话的提示。 */
				const platformNotice = getPlatformContinuationNotice(decoded.header.cwd);
				/** cwd 已替换为当前项目的 JSONL 文本。 */
				const rewritten = rewriteSessionCwd(decoded.jsonl, decoded.header.cwd, targetCwd);
				/** 最终写入的会话文件路径。 */
				const destination = join(sessionDir, sourceName);
				if (existsSync(destination)) {
					/** 用户是否允许覆盖已存在的导入会话。 */
					const overwrite = await ctx.ui.confirm(
						"Session already imported",
						`Overwrite ${destination}? Local changes to that session will be lost.`,
					);
					if (!overwrite) {
						ctx.ui.notify("Import cancelled", "warning");
						return;
					}
				}
				writeFileSync(destination, rewritten);

				ctx.ui.notify(`Imported session ${decoded.header.id} (cwd ${decoded.header.cwd} -> ${targetCwd})`, "info");
				await ctx.switchSession(destination, {
					withSession: async (nextCtx) => {
						if (!platformNotice) return;
						await nextCtx.sendMessage(
							{
								customType: "import-repro",
								content: platformNotice,
								display: true,
								details: { sourceCwd: decoded.header.cwd, targetCwd },
							},
							{ triggerTurn: false },
						);
					},
				});
			} catch (error) {
				/** error 是导入复现数据时捕获的未知异常，将转为可读文本显示给用户。 */
				ctx.ui.notify(`ir: ${error instanceof Error ? error.message : String(error)}`, "error");
			}
		},
	});
}
