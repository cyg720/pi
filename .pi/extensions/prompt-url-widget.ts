/**
 * 文件职责：识别 PR、Issue 或安全公告任务提示，获取 GitHub 元数据，并在 TUI 中展示链接小组件和会话名。
 * 技术维度：使用 coding-agent 扩展事件、gh CLI、异步文件读取、正则解析和 pi-tui Container/Text 组件。
 * 产品维度：让代码审查与安全公告任务始终显示目标标题、作者、状态和 URL，便于用户确认当前上下文。
 * 逻辑维度：解析提示目标，按类型加载 GitHub 元数据，格式化小组件与会话名，并在会话切换时重建。
 * 关键边界：只识别固定提示模板；gh 或草稿读取失败时安全降级；无 UI 的会话不会创建小组件。
 * 新手阅读建议：先看三个 PATTERN 与 PromptMatch，再读 fetchGhMetadata，最后从默认导出函数跟踪事件注册。
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { DynamicBorder, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";

/** 从标准 PR 任务提示首行提取第一个非空 URL。 */
const PR_PROMPT_PATTERN = /^\s*You are given one or more GitHub PR URLs:\s*(\S+)/im;
/** 从标准 Issue 分析提示首行提取第一个目标。 */
const ISSUE_PROMPT_PATTERN = /^\s*Analyze GitHub issue\(s\):\s*(\S+)/im;
/** 从安全公告发布提示首行提取公告 URL 或草稿路径。 */
const ADVISORY_PROMPT_PATTERN = /^\s*Update a GitHub security advisory for publication:\s*(\S+)/im;

/** 从任务提示中识别出的 GitHub 目标类型和原始目标文本。 */
type PromptMatch = {
	/** 目标是拉取请求、Issue 或安全公告。 */
	kind: "pr" | "issue" | "advisory";
	/** URL、编号或公告草稿路径。 */
	target: string;
};

/** 小组件显示所需的统一 GitHub 元数据。 */
type GhMetadata = {
	/** PR、Issue 或公告标题。 */
	title?: string;
	/** 作者、公告严重性或状态等补充信息。 */
	detail?: string;
	/** 规范化后应展示的目标 URL。 */
	displayUrl?: string;
	/** PR 或 Issue 作者信息。 */
	author?: {
		/** GitHub 登录名。 */
		login?: string;
		/** 可选公开姓名。 */
		name?: string | null;
	};
};

/** gh security-advisories API 返回中本扩展关心的字段。 */
type GitHubAdvisoryMetadata = {
	/** GitHub Security Advisory 标识。 */
	ghsa_id?: string;
	/** 公告摘要标题。 */
	summary?: string;
	/** 严重性等级。 */
	severity?: string;
	/** 草稿或已发布等状态。 */
	state?: string;
	/** GitHub 网页地址。 */
	html_url?: string;
	/** 关联 CVE，尚未分配时为空。 */
	cve_id?: string | null;
};

/** 从 GitHub 公告 URL 解析出的仓库与公告引用。 */
type AdvisoryRef = {
	/** 仓库所有者。 */
	owner: string;
	/** 仓库名。 */
	repo: string;
	/** GHSA 标识。 */
	ghsaId: string;
	/** 去除查询与片段后的规范公告 URL。 */
	url: string;
};

/**
 * 从固定任务提示模板中提取第一个 GitHub 目标。
 * @param prompt 用户或系统任务提示全文。
 * @returns 目标类型与文本，未匹配模板时为 undefined。
 * @example extractPromptMatch("Analyze GitHub issue(s): https://github.com/o/r/issues/1");
 */
function extractPromptMatch(prompt: string): PromptMatch | undefined {
	/** PR 提示匹配结果。 */
	const prMatch = prompt.match(PR_PROMPT_PATTERN);
	if (prMatch?.[1]) {
		return { kind: "pr", target: prMatch[1].trim() };
	}

	/** Issue 提示匹配结果。 */
	const issueMatch = prompt.match(ISSUE_PROMPT_PATTERN);
	if (issueMatch?.[1]) {
		return { kind: "issue", target: issueMatch[1].trim() };
	}

	/** 安全公告提示匹配结果。 */
	const advisoryMatch = prompt.match(ADVISORY_PROMPT_PATTERN);
	if (advisoryMatch?.[1]) {
		return { kind: "advisory", target: advisoryMatch[1].trim() };
	}

	return undefined;
}

/**
 * 将目标类型转换为会话名使用的简短标签。
 * @param kind 目标类型。
 * @returns PR、Issue 或 Advisory。
 * @example getPromptLabel("pr");
 */
function getPromptLabel(kind: PromptMatch["kind"]): string {
	if (kind === "pr") return "PR";
	if (kind === "issue") return "Issue";
	return "Advisory";
}

/**
 * 解析 GitHub 仓库安全公告 URL。
 * @param value 待解析 URL。
 * @returns 仓库、GHSA 和规范 URL；格式不符时为 undefined。
 * @example parseAdvisoryUrl("https://github.com/o/r/security/advisories/GHSA-xxxx");
 */
function parseAdvisoryUrl(value: string): AdvisoryRef | undefined {
	/** URL 各路径段和 GHSA 标识的正则匹配。 */
	const match = value.match(
		/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/security\/advisories\/(GHSA-[A-Za-z0-9-]+)(?:[/?#].*)?$/i,
	);
	if (!match?.[1] || !match[2] || !match[3]) return undefined;
	return {
		owner: match[1],
		repo: match[2],
		ghsaId: match[3],
		url: `https://github.com/${match[1]}/${match[2]}/security/advisories/${match[3]}`,
	};
}

/**
 * 去除 YAML 标量外层成对单引号或双引号。
 * @param value 原始 YAML 值文本。
 * @returns 去空并按需去引号后的值。
 * @example unquoteYamlValue('"value"');
 */
function unquoteYamlValue(value: string): string {
	/** 去除首尾空白后的值。 */
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

/**
 * 将草稿路径按 cwd 与用户主目录解析为绝对路径。
 * @param cwd 当前任务工作目录。
 * @param target ~、~/path、相对或绝对路径。
 * @returns 规范绝对路径。
 * @example resolveDraftPath(process.cwd(), "~/draft.md");
 */
function resolveDraftPath(cwd: string, target: string): string {
	if (target === "~") return homedir();
	if (target.startsWith("~/")) return resolve(homedir(), target.slice(2));
	return resolve(cwd, target);
}

/**
 * 从安全公告草稿的 frontmatter 或正文读取 advisory_url。
 * @param cwd 当前任务工作目录。
 * @param target 草稿文件路径。
 * @returns 解析后的公告引用；读取或格式错误时为 undefined。
 * @example await readAdvisoryRefFromDraft(cwd, "draft.md");
 */
async function readAdvisoryRefFromDraft(cwd: string, target: string): Promise<AdvisoryRef | undefined> {
	try {
		/** 草稿文件完整文本。 */
		const content = await readFile(resolveDraftPath(cwd, target), "utf8");
		/** 可选 YAML frontmatter 匹配。 */
		const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		/** 优先解析 frontmatter，缺失时搜索全文。 */
		const body = frontmatter?.[1] ?? content;
		/** advisory_url 行的匹配结果。 */
		const urlMatch = body.match(/^advisory_url:\s*(.+)$/m);
		if (!urlMatch?.[1]) return undefined;
		return parseAdvisoryUrl(unquoteYamlValue(urlMatch[1]));
	} catch {
		return undefined;
	}
}

/**
 * 拼接安全公告标识、CVE、严重性和状态。
 * @param advisory GitHub API 公告元数据。
 * @returns 使用中点分隔的详情；所有字段为空时为 undefined。
 * @example formatAdvisoryDetail({ ghsa_id: "GHSA-x", severity: "high" });
 */
function formatAdvisoryDetail(advisory: GitHubAdvisoryMetadata): string | undefined {
	/** 去空后仍有内容的公告详情字段。 */
	const parts = [advisory.ghsa_id, advisory.cve_id ?? undefined, advisory.severity, advisory.state]
		.map((part) => part?.trim())
		.filter((part): part is string => part !== undefined && part.length > 0);
	return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * 通过 gh API 获取安全公告元数据，失败时至少保留可点击 URL。
 * @param pi 扩展命令执行 API。
 * @param cwd 当前任务目录。
 * @param target 公告 URL 或草稿路径。
 * @returns 统一元数据；目标无法解析时为 undefined。
 * @example await fetchAdvisoryMetadata(pi, cwd, target);
 */
async function fetchAdvisoryMetadata(pi: ExtensionAPI, cwd: string, target: string): Promise<GhMetadata | undefined> {
	/** 直接解析 URL 或从草稿间接读取的公告引用。 */
	const advisoryRef = parseAdvisoryUrl(target) ?? (await readAdvisoryRefFromDraft(cwd, target));
	if (!advisoryRef) return undefined;

	try {
		/** gh api 命令执行结果。 */
		const result = await pi.exec("gh", [
			"api",
			`repos/${advisoryRef.owner}/${advisoryRef.repo}/security-advisories/${advisoryRef.ghsaId}`,
		]);
		if (result.code !== 0 || !result.stdout) return { displayUrl: advisoryRef.url };
		/** 从 gh 标准输出解析的公告字段。 */
		const advisory = JSON.parse(result.stdout) as GitHubAdvisoryMetadata;
		return {
			title: advisory.summary,
			detail: formatAdvisoryDetail(advisory),
			displayUrl: advisory.html_url ?? advisoryRef.url,
		};
	} catch {
		return { displayUrl: advisoryRef.url };
	}
}

/**
 * 按目标类型获取 PR、Issue 或安全公告元数据。
 * @param pi 扩展命令执行 API。
 * @param kind 目标类型。
 * @param target URL、编号或草稿路径。
 * @param cwd 当前任务目录。
 * @returns 统一元数据；查询失败时为 undefined 或安全公告 URL 降级信息。
 * @example await fetchGhMetadata(pi, "pr", target, cwd);
 */
async function fetchGhMetadata(
	pi: ExtensionAPI,
	kind: PromptMatch["kind"],
	target: string,
	cwd: string,
): Promise<GhMetadata | undefined> {
	if (kind === "advisory") {
		return fetchAdvisoryMetadata(pi, cwd, target);
	}

	/** PR 或 Issue 对应的 gh view 参数。 */
	const args =
		kind === "pr"
			? ["pr", "view", target, "--json", "title,author"]
			: ["issue", "view", target, "--json", "title,author"];

	try {
		/** gh pr/issue view 命令结果。 */
		const result = await pi.exec("gh", args);
		if (result.code !== 0 || !result.stdout) return undefined;
		return JSON.parse(result.stdout) as GhMetadata;
	} catch {
		return undefined;
	}
}

/**
 * 将 GitHub 作者的姓名和登录名格式化为单行。
 * @param author 可选作者字段。
 * @returns “姓名 (@login)”、@login、姓名或 undefined。
 * @example formatAuthor({ login: "octocat", name: "Mona" });
 */
function formatAuthor(author?: GhMetadata["author"]): string | undefined {
	if (!author) return undefined;
	/** 去空后的作者公开姓名。 */
	const name = author.name?.trim();
	/** 去空后的 GitHub 登录名。 */
	const login = author.login?.trim();
	if (name && login) return `${name} (@${login})`;
	if (login) return `@${login}`;
	if (name) return name;
	return undefined;
}

/**
 * 注册提示 URL 小组件及会话生命周期事件。
 * @param pi coding-agent 扩展 API。
 * @returns 无返回值；通过事件回调更新 UI 和会话名。
 * @example promptUrlWidgetExtension(pi);
 */
export default function promptUrlWidgetExtension(pi: ExtensionAPI) {
	/** 在 TUI 中创建或刷新目标标题、详情和 URL 小组件。 */
	const setWidget = (ctx: ExtensionContext, match: PromptMatch, metadata?: GhMetadata) => {
		ctx.ui.setWidget("prompt-url", (_tui, thm) => {
			/** 元数据规范 URL 优先，否则使用原始目标。 */
			const displayTarget = metadata?.displayUrl ?? match.target;
			/** 有标题时突出标题，否则突出目标 URL。 */
			const titleText = metadata?.title
				? thm.fg("accent", metadata.title)
				: thm.fg("accent", displayTarget);
			/** 公告详情或 PR/Issue 作者文本。 */
			const detailText = metadata?.detail ?? formatAuthor(metadata?.author);
			/** 应用 muted 主题色的可选详情行。 */
			const detailLine = detailText ? thm.fg("muted", detailText) : undefined;
			/** 应用 dim 主题色的 URL 行。 */
			const urlLine = thm.fg("dim", displayTarget);

			/** 按标题、可选详情、URL 顺序组成的显示行。 */
			const lines = [titleText];
			if (detailLine) lines.push(detailLine);
			lines.push(urlLine);

			/** 承载边框与文本的 TUI 容器。 */
			const container = new Container();
			container.addChild(new DynamicBorder((s: string) => thm.fg("muted", s)));
			container.addChild(new Text(lines.join("\n"), 1, 0));
			return container;
		});
	};

	/** 按目标元数据设置会话名，同时尊重用户自定义名称。 */
	const applySessionName = (ctx: ExtensionContext, match: PromptMatch, metadata?: GhMetadata) => {
		/** 目标类型的显示标签。 */
		const label = getPromptLabel(match.kind);
		/** 元数据规范 URL 或原始目标。 */
		const displayTarget = metadata?.displayUrl ?? match.target;
		/** 去空后的远程标题。 */
		const trimmedTitle = metadata?.title?.trim();
		/** 初次只知道原始目标时的旧式回退会话名。 */
		const fallbackName = `${label}: ${match.target}`;
		/** 使用规范 URL 的回退会话名。 */
		const desiredFallbackName = `${label}: ${displayTarget}`;
		/** 有标题时包含标题和 URL 的最终名称。 */
		const desiredName = trimmedTitle ? `${label}: ${trimmedTitle} (${displayTarget})` : desiredFallbackName;
		/** 当前会话名；非自动生成名称不会被覆盖。 */
		const currentName = pi.getSessionName()?.trim();
		if (!currentName) {
			pi.setSessionName(desiredName);
			return;
		}
		if (currentName === match.target || currentName === fallbackName || currentName === desiredFallbackName) {
			pi.setSessionName(desiredName);
		}
	};

	/** 先用本地信息更新 UI，再异步获取远程元数据二次刷新。 */
	const updatePromptContext = (ctx: ExtensionContext, match: PromptMatch) => {
		setWidget(ctx, match);
		applySessionName(ctx, match);
		void fetchGhMetadata(pi, match.kind, match.target, ctx.cwd).then((meta) => {
			setWidget(ctx, match, meta);
			applySessionName(ctx, match, meta);
		});
	};

	pi.on("before_agent_start", async (event, ctx) => {
		if (!ctx.hasUI) return;
		/** 当前启动提示中识别出的 GitHub 目标。 */
		const match = extractPromptMatch(event.prompt);
		if (!match) {
			return;
		}

		updatePromptContext(ctx, match);
	});

	pi.on("session_switch", async (_event, ctx) => {
		rebuildFromSession(ctx);
	});

	/** 从字符串或结构化用户内容中拼接纯文本。 */
	const getUserText = (content: string | { type: string; text?: string }[] | undefined): string => {
		if (!content) return "";
		if (typeof content === "string") return content;
		return (
			content
				.filter((block): block is { type: "text"; text: string } => block.type === "text")
				.map((block) => block.text)
				.join("\n") ?? ""
		);
	};

	/** 从现有会话最后一个匹配用户消息恢复小组件。 */
	const rebuildFromSession = (ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;

		/** 会话中的全部持久化条目。 */
		const entries = ctx.sessionManager.getEntries();
		/** 从后向前找到的最后一个匹配模板的用户消息条目。 */
		const lastMatch = [...entries].reverse().find((entry) => {
			if (entry.type !== "message" || entry.message.role !== "user") return false;
			/** 当前候选用户消息的纯文本。 */
			const text = getUserText(entry.message.content);
			return !!extractPromptMatch(text);
		});

		/** 最后匹配消息的原始内容。 */
		const content =
			lastMatch?.type === "message" && lastMatch.message.role === "user" ? lastMatch.message.content : undefined;
		/** 从原始内容提取的用户文本。 */
		const text = getUserText(content);
		/** 恢复出的目标匹配。 */
		const match = text ? extractPromptMatch(text) : undefined;
		if (!match) {
			ctx.ui.setWidget("prompt-url", undefined);
			return;
		}

		updatePromptContext(ctx, match);
	};

	pi.on("session_start", async (_event, ctx) => {
		rebuildFromSession(ctx);
	});
}
