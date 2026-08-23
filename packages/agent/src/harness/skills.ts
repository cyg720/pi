/**
 * 【文件职责】技能（Skill）的发现、加载与校验：递归扫描目录中的 SKILL.md 与根级 .md 文件，
 *              解析 frontmatter 元数据，遵循 gitignore 风格忽略规则，并产出诊断信息。
 * 【技术维度】ignore 库实现 .gitignore/.ignore/.fdignore 规则匹配；YAML frontmatter 解析；
 *              Result 风格错误处理（警告列表而非异常）；纯函数路径工具（join/dirname/basename/relative）。
 * 【产品维度】“技能”是让模型按需获取领域知识的载体（如代码规范、部署流程），
 *              用户只需按约定目录放置 SKILL.md 即可扩展智能体能力。
 * 【逻辑维度】loadSkills 遍历目录 → loadSkillsFromDirInternal 递归扫描（每目录优先取一个 SKILL.md）→
 *              loadSkillFromFile 解析校验 → validateName/validateDescription 保证元数据合规。
 * 【关键边界】名称必须与父目录名一致且为小写字母数字连字符；description 必填且 ≤1024 字符；
 *              每个目录只取第一个 SKILL.md；隐藏目录与 node_modules 跳过；缺失输入目录静默跳过。
 * 【新手阅读建议】先看 SkillFrontmatter 与两个 validate 函数了解规则 → 再读 loadSkillsFromDirInternal 的扫描顺序 →
 *              最后看 formatSkillInvocation 理解技能如何注入提示词。
 */
import ignore from "ignore";
import { parse } from "yaml";
import { type ExecutionEnv, type FileInfo, type Result, type Skill, toError } from "./types.ts";

// 技能名最大长度（字符数）
const MAX_NAME_LENGTH = 64;
// 描述最大长度（字符数）
const MAX_DESCRIPTION_LENGTH = 1024;
// 会被读取并应用的忽略文件名列表
const IGNORE_FILE_NAMES = [".gitignore", ".ignore", ".fdignore"];

// ignore 库匹配器类型（由工厂函数返回类型推导）
type IgnoreMatcher = ReturnType<typeof ignore>;

/** 技能诊断码类型（中文说明）：标识失败环节——文件信息/列目录/读文件/解析/元数据非法。 */
export type SkillDiagnosticCode =
	| "file_info_failed"
	| "list_failed"
	| "read_failed"
	| "parse_failed"
	| "invalid_metadata";

/** Warning produced while loading skills. */
/** 加载技能时产生的警告（中文说明）：当前仅 warning 级别。 */
export interface SkillDiagnostic {
	/** Diagnostic severity. Currently only warnings are emitted. */
	// 严重级别：固定 "warning"
	type: "warning";
	/** Stable diagnostic code. */
	// 稳定诊断码
	code: SkillDiagnosticCode;
	/** Human-readable diagnostic message. */
	// 人类可读的错误说明
	message: string;
	/** Path associated with the diagnostic. */
	// 相关路径
	path: string;
}

/** 技能 frontmatter 结构（中文说明）：name 名称、description 描述（必填）、
 * disable-model-invocation 为 true 时禁止模型自动调用该技能；其余键原样保留。 */
interface SkillFrontmatter {
	name?: string;
	description?: string;
	"disable-model-invocation"?: boolean;
	[key: string]: unknown;
}

/** Format a skill invocation prompt, optionally appending additional user instructions. */
// 格式化一次技能调用提示词（中文说明）：把技能内容包进 <skill> 标签（含名称与位置，
// 并注明相对路径基准目录），可选追加用户附加指令。
// 参数 skill —— 技能对象；additionalInstructions —— 追加指令（可选）。返回最终提示词文本。
export function formatSkillInvocation(skill: Skill, additionalInstructions?: string): string {
	const skillBlock = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${dirnameEnvPath(skill.filePath)}.\n\n${skill.content}\n</skill>`;
	return additionalInstructions ? `${skillBlock}\n\n${additionalInstructions}` : skillBlock;
}

/**
 * Load skills from one or more directories.
 *
 * Traverses directories recursively, loads `SKILL.md` files, loads direct root `.md` files as skills, honors ignore files,
 * and returns diagnostics for invalid skill files. Missing input directories are skipped.
 */
// 从一个或多个目录加载技能（中文说明）：递归遍历目录、加载 SKILL.md，
// 根目录的直接 .md 也作为技能加载；应用忽略规则；非法文件产出诊断；缺失目录跳过。
// 参数 env —— 执行环境抽象；dirs —— 单个或多个目录。返回 { skills, diagnostics }。
export async function loadSkills(
	env: ExecutionEnv,
	dirs: string | string[],
): Promise<{ skills: Skill[]; diagnostics: SkillDiagnostic[] }> {
	// 加载成功的技能集合
	const skills: Skill[] = [];
	// 警告集合
	const diagnostics: SkillDiagnostic[] = [];
	for (const dir of Array.isArray(dirs) ? dirs : [dirs]) {
		const rootInfoResult = await env.fileInfo(dir);
		if (!rootInfoResult.ok) {
			// not_found 静默跳过，其余记诊断
			if (rootInfoResult.error.code !== "not_found") {
				diagnostics.push({
					type: "warning",
					code: "file_info_failed",
					message: rootInfoResult.error.message,
					path: dir,
				});
			}
			continue;
		}
		const rootInfo = rootInfoResult.value;
		// 仅接受目录输入
		if ((await resolveKind(env, rootInfo, diagnostics)) !== "directory") continue;
		// 从空匹配器开始递归扫描；根目录允许直接 .md
		const result = await loadSkillsFromDirInternal(env, rootInfo.path, true, ignore(), rootInfo.path);
		skills.push(...result.skills);
		diagnostics.push(...result.diagnostics);
	}
	return { skills, diagnostics };
}

/**
 * Load skills from source-tagged directories.
 *
 * Source values are preserved exactly and attached to every loaded skill and diagnostic. The agent package does not
 * interpret source values; applications define their own provenance shape.
 */
// 从“带来源标记”的目录集合加载技能（中文说明）：source 原样附加到每条技能与诊断上，
// 本包不解释其含义，由应用自定义（如区分内置/用户/项目来源）。泛型同 prompt-templates 版本。
export async function loadSourcedSkills<TSource, TSkill extends Skill = Skill>(
	env: ExecutionEnv,
	inputs: Array<{ path: string; source: TSource }>,
	mapSkill?: (skill: Skill, source: TSource) => TSkill,
): Promise<{
	skills: Array<{ skill: TSkill; source: TSource }>;
	diagnostics: Array<SkillDiagnostic & { source: TSource }>;
}> {
	const skills: Array<{ skill: TSkill; source: TSource }> = [];
	const diagnostics: Array<SkillDiagnostic & { source: TSource }> = [];
	for (const input of inputs) {
		// 复用普通加载
		const result = await loadSkills(env, input.path);
		for (const skill of result.skills) {
			skills.push({ skill: mapSkill ? mapSkill(skill, input.source) : (skill as TSkill), source: input.source });
		}
		for (const diagnostic of result.diagnostics) diagnostics.push({ ...diagnostic, source: input.source });
	}
	return { skills, diagnostics };
}

/**
 * 目录递归扫描核心（私有）：先应用本层忽略规则 → 优先加载本层的 SKILL.md（找到即返回）→
 * 再按名称排序遍历其余条目：目录继续递归（不再收根级 .md），文件仅在 includeRootFiles 时收 .md；
 * 跳过隐藏项与 node_modules。
 */
async function loadSkillsFromDirInternal(
	env: ExecutionEnv,
	dir: string,
	includeRootFiles: boolean,
	ignoreMatcher: IgnoreMatcher,
	rootDir: string,
): Promise<{ skills: Skill[]; diagnostics: SkillDiagnostic[] }> {
	const skills: Skill[] = [];
	const diagnostics: SkillDiagnostic[] = [];

	const dirInfoResult = await env.fileInfo(dir);
	if (!dirInfoResult.ok) {
		if (dirInfoResult.error.code !== "not_found") {
			diagnostics.push({
				type: "warning",
				code: "file_info_failed",
				message: dirInfoResult.error.message,
				path: dir,
			});
		}
		return { skills, diagnostics };
	}
	const dirInfo = dirInfoResult.value;
	if ((await resolveKind(env, dirInfo, diagnostics)) !== "directory") return { skills, diagnostics };

	// 合并本层目录的忽略规则
	await addIgnoreRules(env, ignoreMatcher, dir, rootDir, diagnostics);

	const entriesResult = await env.listDir(dir);
	if (!entriesResult.ok) {
		diagnostics.push({ type: "warning", code: "list_failed", message: entriesResult.error.message, path: dir });
		return { skills, diagnostics };
	}
	const entries = entriesResult.value;

	// 第一轮：只找 SKILL.md（每个目录至多采用一个）
	for (const entry of entries) {
		if (entry.name !== "SKILL.md") continue;
		const fullPath = entry.path;
		const kind = await resolveKind(env, entry, diagnostics);
		if (kind !== "file") continue;
		// 相对路径用于忽略匹配
		const relPath = relativeEnvPath(rootDir, fullPath);
		if (ignoreMatcher.ignores(relPath)) continue;

		const result = await loadSkillFromFile(env, fullPath);
		if (result.skill) skills.push(result.skill);
		diagnostics.push(...result.diagnostics);
		// 本目录已有 SKILL.md，直接返回
		return { skills, diagnostics };
	}

	// 第二轮：遍历其余条目（排序保证稳定）
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		// 跳过隐藏项与 node_modules
		if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
		const fullPath = entry.path;
		const kind = await resolveKind(env, entry, diagnostics);
		if (!kind) continue;

		// 目录在忽略匹配时带尾部斜杠
		const relPath = relativeEnvPath(rootDir, fullPath);
		const ignorePath = kind === "directory" ? `${relPath}/` : relPath;
		if (ignoreMatcher.ignores(ignorePath)) continue;

		if (kind === "directory") {
			// 子目录递归：不收子目录的根级散文件
			const result = await loadSkillsFromDirInternal(env, fullPath, false, ignoreMatcher, rootDir);
			skills.push(...result.skills);
			diagnostics.push(...result.diagnostics);
			continue;
		}

		// 散文件仅根目录且 .md 才收
		if (kind !== "file" || !includeRootFiles || !entry.name.endsWith(".md")) continue;
		const result = await loadSkillFromFile(env, fullPath);
		if (result.skill) skills.push(result.skill);
		diagnostics.push(...result.diagnostics);
	}

	return { skills, diagnostics };
}

/**
 * 应用忽略规则（私有）：读取本层目录的 .gitignore/.ignore/.fdignore，
 * 把模式加上相对前缀后并入匹配器；读取失败记 read_failed 诊断。
 */
async function addIgnoreRules(
	env: ExecutionEnv,
	ig: IgnoreMatcher,
	dir: string,
	rootDir: string,
	diagnostics: SkillDiagnostic[],
): Promise<void> {
	// 本目录相对根的路径；根目录时为空串
	const relativeDir = relativeEnvPath(rootDir, dir);
	// 模式前缀（如 "sub/"）
	const prefix = relativeDir ? `${relativeDir}/` : "";

	for (const filename of IGNORE_FILE_NAMES) {
		const ignorePath = joinEnvPath(dir, filename);
		const info = await env.fileInfo(ignorePath);
		if (!info.ok) {
			if (info.error.code !== "not_found") {
				diagnostics.push({
					type: "warning",
					code: "file_info_failed",
					message: info.error.message,
					path: ignorePath,
				});
			}
			continue;
		}
		if (info.value.kind !== "file") continue;
		const content = await env.readTextFile(ignorePath);
		if (!content.ok) {
			diagnostics.push({ type: "warning", code: "read_failed", message: content.error.message, path: ignorePath });
			continue;
		}
		// 逐行清洗并加前缀
		const patterns = content.value
			.split(/\r?\n/)
			.map((line) => prefixIgnorePattern(line, prefix))
			.filter((line): line is string => Boolean(line));
		if (patterns.length > 0) ig.add(patterns);
	}
}

// 忽略模式预处理（私有）：去空白行与注释；剥掉开头的 !（记录取反）与转义符；
// 去掉开头的 / 锚定符后拼上前缀；取反模式重新加回 !
function prefixIgnorePattern(line: string, prefix: string): string | null {
	const trimmed = line.trim();
	if (!trimmed) return null;
	// 普通注释跳过（转义的 \# 不算）
	if (trimmed.startsWith("#") && !trimmed.startsWith("\\#")) return null;

	let pattern = line;
	let negated = false;
	if (pattern.startsWith("!")) {
		negated = true;
		pattern = pattern.slice(1);
	} else if (pattern.startsWith("\\!")) {
		pattern = pattern.slice(1);
	}
	if (pattern.startsWith("/")) pattern = pattern.slice(1);
	const prefixed = prefix ? `${prefix}${pattern}` : pattern;
	return negated ? `!${prefixed}` : prefixed;
}

/**
 * 从单个文件加载技能（私有）：读文本 → 解析 frontmatter → 校验名称与描述 →
 * description 缺失时返回 null（视为无效技能）；组装 Skill 对象。
 */
async function loadSkillFromFile(
	env: ExecutionEnv,
	filePath: string,
): Promise<{ skill: Skill | null; diagnostics: SkillDiagnostic[] }> {
	const diagnostics: SkillDiagnostic[] = [];
	const rawContent = await env.readTextFile(filePath);
	if (!rawContent.ok) {
		diagnostics.push({ type: "warning", code: "read_failed", message: rawContent.error.message, path: filePath });
		return { skill: null, diagnostics };
	}

	const parsed = parseFrontmatter<SkillFrontmatter>(rawContent.value);
	if (!parsed.ok) {
		diagnostics.push({ type: "warning", code: "parse_failed", message: parsed.error.message, path: filePath });
		return { skill: null, diagnostics };
	}

	const { frontmatter, body } = parsed.value;
	// 技能所在目录与其名称（缺省名即目录名）
	const skillDir = dirnameEnvPath(filePath);
	const parentDirName = basenameEnvPath(skillDir);
	const description = typeof frontmatter.description === "string" ? frontmatter.description : undefined;

	// 描述校验告警
	for (const error of validateDescription(description)) {
		diagnostics.push({ type: "warning", code: "invalid_metadata", message: error, path: filePath });
	}

	// 名称：frontmatter 优先，否则用父目录名
	const frontmatterName = typeof frontmatter.name === "string" ? frontmatter.name : undefined;
	const name = frontmatterName || parentDirName;
	for (const error of validateName(name, parentDirName)) {
		diagnostics.push({ type: "warning", code: "invalid_metadata", message: error, path: filePath });
	}

	// 无有效描述则不作为技能加载
	if (!description || description.trim() === "") {
		return { skill: null, diagnostics };
	}

	return {
		skill: {
			name,
			description,
			content: body,
			filePath,
			disableModelInvocation: frontmatter["disable-model-invocation"] === true,
		},
		diagnostics,
	};
}

/**
 * 名称校验（私有）：必须与父目录名一致；≤64 字符；仅小写字母/数字/连字符；
 * 不能以连字符开头结尾；不能含连续连字符。返回错误信息数组（空表示通过）。
 */
function validateName(name: string, parentDirName: string): string[] {
	const errors: string[] = [];
	if (name !== parentDirName) errors.push(`name "${name}" does not match parent directory "${parentDirName}"`);
	if (name.length > MAX_NAME_LENGTH) errors.push(`name exceeds ${MAX_NAME_LENGTH} characters (${name.length})`);
	if (!/^[a-z0-9-]+$/.test(name)) {
		errors.push("name contains invalid characters (must be lowercase a-z, 0-9, hyphens only)");
	}
	if (name.startsWith("-") || name.endsWith("-")) errors.push("name must not start or end with a hyphen");
	if (name.includes("--")) errors.push("name must not contain consecutive hyphens");
	return errors;
}

// 描述校验（私有）：必填且 ≤1024 字符；返回错误信息数组
function validateDescription(description: string | undefined): string[] {
	const errors: string[] = [];
	if (!description || description.trim() === "") {
		errors.push("description is required");
	} else if (description.length > MAX_DESCRIPTION_LENGTH) {
		errors.push(`description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${description.length})`);
	}
	return errors;
}

// 解析 frontmatter（私有）：逻辑与 prompt-templates.ts 相同——识别 `---` YAML 块并切分正文
function parseFrontmatter<T extends Record<string, unknown>>(
	content: string,
): Result<{ frontmatter: T; body: string }, Error> {
	try {
		const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		if (!normalized.startsWith("---")) return { ok: true, value: { frontmatter: {} as T, body: normalized } };
		const endIndex = normalized.indexOf("\n---", 3);
		if (endIndex === -1) return { ok: true, value: { frontmatter: {} as T, body: normalized } };
		const yamlString = normalized.slice(4, endIndex);
		const body = normalized.slice(endIndex + 4).trim();
		return { ok: true, value: { frontmatter: (parse(yamlString) ?? {}) as T, body } };
	} catch (error) {
		return { ok: false, error: toError(error) };
	}
}

// 判定路径种类（私有）：优先 info.kind，必要时经 canonicalPath 解析真实目标；失败记诊断返回 undefined
async function resolveKind(
	env: ExecutionEnv,
	info: FileInfo,
	diagnostics: SkillDiagnostic[],
): Promise<"file" | "directory" | undefined> {
	if (info.kind === "file" || info.kind === "directory") return info.kind;
	const canonicalPath = await env.canonicalPath(info.path);
	if (!canonicalPath.ok) {
		if (canonicalPath.error.code !== "not_found") {
			diagnostics.push({
				type: "warning",
				code: "file_info_failed",
				message: canonicalPath.error.message,
				path: info.path,
			});
		}
		return undefined;
	}
	const target = await env.fileInfo(canonicalPath.value);
	if (!target.ok) {
		if (target.error.code !== "not_found") {
			diagnostics.push({
				type: "warning",
				code: "file_info_failed",
				message: target.error.message,
				path: info.path,
			});
		}
		return undefined;
	}
	return target.value.kind === "file" || target.value.kind === "directory" ? target.value.kind : undefined;
}

// 环境路径拼接（私有）：去 base 尾部斜杠 + 去 child 头部斜杠后以 / 相接
function joinEnvPath(base: string, child: string): string {
	return `${base.replace(/\/+$/, "")}/${child.replace(/^\/+/, "")}`;
}

// 取目录名部分（私有）：最后一个 / 之前的内容；根目录返回 "/"
function dirnameEnvPath(path: string): string {
	const normalized = path.replace(/\/+$/, "");
	const slashIndex = normalized.lastIndexOf("/");
	return slashIndex <= 0 ? "/" : normalized.slice(0, slashIndex);
}

// 取文件名部分（私有）：最后一个 / 之后的内容
function basenameEnvPath(path: string): string {
	const normalized = path.replace(/\/+$/, "");
	const slashIndex = normalized.lastIndexOf("/");
	return slashIndex === -1 ? normalized : normalized.slice(slashIndex + 1);
}

// 计算相对路径（私有）：path 以 root 为前缀时去掉前缀；相等返回空串；否则去掉开头斜杠
function relativeEnvPath(root: string, path: string): string {
	const normalizedRoot = root.replace(/\/+$/, "");
	const normalizedPath = path.replace(/\/+$/, "");
	if (normalizedPath === normalizedRoot) return "";
	return normalizedPath.startsWith(`${normalizedRoot}/`)
		? normalizedPath.slice(normalizedRoot.length + 1)
		: normalizedPath.replace(/^\/+/, "");
}
