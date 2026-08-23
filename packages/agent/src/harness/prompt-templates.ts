/**
 * 【文件职责】提示词模板（Prompt Template）的加载与渲染：从文件/目录加载带 YAML frontmatter 的 .md 模板，
 *              解析元信息，并支持 shell 风格的位置参数（$1、$@、$ARGUMENTS 等）替换。
 * 【技术维度】YAML 解析（yaml 包）+ 手写 frontmatter 切分；Result 风格错误处理（不抛异常，返回 diagnostics 警告列表）；
 *              正则替换实现参数占位符。
 * 【产品维度】用户可把常用提示词写成 markdown 文件放进目录即可复用（类似斜杠命令），是产品可扩展性的基础机制之一。
 * 【逻辑维度】loadPromptTemplates 遍历路径（目录只扫一层直接子级 .md）→ loadTemplateFromFile 解析 frontmatter 与正文 →
 *              formatPromptTemplateInvocation 用 substituteArgs 渲染最终提示词。
 * 【关键边界】目录不递归；非 .md 文件跳过；缺失路径静默忽略；读取/解析失败仅记警告不中断；
 *              description 缺省时取正文首个非空行前 60 字符。
 * 【新手阅读建议】先读 PromptTemplateDiagnostic 了解告警模型 → 再读 loadPromptTemplates 主流程 →
 *              最后读 parseCommandArgs/substituteArgs 掌握参数语法。
 */
import { parse } from "yaml";
import { type ExecutionEnv, type FileInfo, type PromptTemplate, type Result, toError } from "./types.ts";

/** 诊断码类型（中文说明）：标识加载失败的环节——取文件信息/列目录/读文件/解析 frontmatter。 */
export type PromptTemplateDiagnosticCode = "file_info_failed" | "list_failed" | "read_failed" | "parse_failed";

/** Warning produced while loading prompt templates. */
/** 加载提示词模板时产生的警告（中文说明）：目前只有 warning 一种级别。 */
export interface PromptTemplateDiagnostic {
	/** Diagnostic severity. Currently only warnings are emitted. */
	// 严重级别：当前固定为 "warning"
	type: "warning";
	/** Stable diagnostic code. */
	// 稳定的诊断码（见 PromptTemplateDiagnosticCode）
	code: PromptTemplateDiagnosticCode;
	/** Human-readable diagnostic message. */
	// 人类可读的错误说明
	message: string;
	/** Path associated with the diagnostic. */
	// 相关文件路径
	path: string;
}

/** 模板 frontmatter 结构（中文说明）：支持 description 描述与 argument-hint 参数提示，其余键原样保留。 */
interface PromptTemplateFrontmatter {
	description?: string;
	"argument-hint"?: string;
	[key: string]: unknown;
}

/**
 * Load prompt templates from one or more paths.
 *
 * Directory inputs load direct `.md` children non-recursively. File inputs load explicit `.md` files. Missing paths and
 * non-markdown files are skipped. Read and parse failures are returned as diagnostics.
 */
// 从一个或多个路径加载提示词模板（中文说明）：
// 目录输入加载其直接的 .md 子项（不递归）；文件输入必须是显式 .md；
// 缺失路径与非 md 文件跳过；读取/解析失败以 diagnostics 返回而非抛错。
// 参数 env —— 执行环境抽象（文件系统操作入口）；paths —— 单个路径或路径数组。
// 返回：{ promptTemplates 加载结果, diagnostics 警告列表 }。
export async function loadPromptTemplates(
	env: ExecutionEnv,
	paths: string | string[],
): Promise<{ promptTemplates: PromptTemplate[]; diagnostics: PromptTemplateDiagnostic[] }> {
	// 累积加载成功的模板
	const promptTemplates: PromptTemplate[] = [];
	// 累积加载过程中的警告
	const diagnostics: PromptTemplateDiagnostic[] = [];
	for (const path of Array.isArray(paths) ? paths : [paths]) {
		// 查询路径基本信息
		const infoResult = await env.fileInfo(path);
		if (!infoResult.ok) {
			// not_found 静默跳过，其余错误记录诊断
			if (infoResult.error.code !== "not_found") {
				diagnostics.push({
					type: "warning",
					code: "file_info_failed",
					message: infoResult.error.message,
					path,
				});
			}
			continue;
		}
		const info = infoResult.value;
		// 判定是目录还是文件（可能是符号链接等，需要归一化）
		const kind = await resolveKind(env, info, diagnostics);
		if (kind === "directory") {
			// 目录：加载其下 .md 文件
			const result = await loadTemplatesFromDir(env, info.path);
			promptTemplates.push(...result.promptTemplates);
			diagnostics.push(...result.diagnostics);
		} else if (kind === "file" && info.name.endsWith(".md")) {
			// 文件：仅接受 .md
			const result = await loadTemplateFromFile(env, info.path);
			if (result.promptTemplate) promptTemplates.push(result.promptTemplate);
			diagnostics.push(...result.diagnostics);
		}
	}
	return { promptTemplates, diagnostics };
}

/**
 * Load prompt templates from source-tagged paths.
 *
 * Source values are preserved exactly and attached to every loaded prompt template and diagnostic. The agent package does
 * not interpret source values; applications define their own provenance shape.
 */
// 从“带来源标记”的路径集合加载模板（中文说明）：source 原样附加到每条模板与诊断上，
// 本包不解释 source 含义，由应用自定义（如区分内置/用户/项目来源）。
// 泛型 TSource —— 来源值类型；TPromptTemplate —— 映射后的模板类型。
export async function loadSourcedPromptTemplates<TSource, TPromptTemplate extends PromptTemplate = PromptTemplate>(
	env: ExecutionEnv,
	inputs: Array<{ path: string; source: TSource }>,
	mapPromptTemplate?: (promptTemplate: PromptTemplate, source: TSource) => TPromptTemplate,
): Promise<{
	promptTemplates: Array<{ promptTemplate: TPromptTemplate; source: TSource }>;
	diagnostics: Array<PromptTemplateDiagnostic & { source: TSource }>;
}> {
	// 带来源的模板结果
	const promptTemplates: Array<{ promptTemplate: TPromptTemplate; source: TSource }> = [];
	// 带来源的诊断
	const diagnostics: Array<PromptTemplateDiagnostic & { source: TSource }> = [];
	for (const input of inputs) {
		// 复用普通加载函数
		const result = await loadPromptTemplates(env, input.path);
		for (const promptTemplate of result.promptTemplates) {
			promptTemplates.push({
				promptTemplate: mapPromptTemplate
					? mapPromptTemplate(promptTemplate, input.source)
					: (promptTemplate as TPromptTemplate),
				source: input.source,
			});
		}
		// 诊断补充来源信息
		for (const diagnostic of result.diagnostics) diagnostics.push({ ...diagnostic, source: input.source });
	}
	return { promptTemplates, diagnostics };
}

// 从目录加载模板（私有）：列出直接子项，按名称排序后逐个加载 .md 文件；列目录失败记 list_failed 诊断
async function loadTemplatesFromDir(
	env: ExecutionEnv,
	dir: string,
): Promise<{ promptTemplates: PromptTemplate[]; diagnostics: PromptTemplateDiagnostic[] }> {
	const promptTemplates: PromptTemplate[] = [];
	const diagnostics: PromptTemplateDiagnostic[] = [];
	const entriesResult = await env.listDir(dir);
	if (!entriesResult.ok) {
		diagnostics.push({
			type: "warning",
			code: "list_failed",
			message: entriesResult.error.message,
			path: dir,
		});
		return { promptTemplates, diagnostics };
	}
	// 目录条目列表
	const entries = entriesResult.value;

	// 按名称排序保证加载顺序稳定
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const kind = await resolveKind(env, entry, diagnostics);
		// 只处理 .md 文件
		if (kind !== "file" || !entry.name.endsWith(".md")) continue;
		const result = await loadTemplateFromFile(env, entry.path);
		if (result.promptTemplate) promptTemplates.push(result.promptTemplate);
		diagnostics.push(...result.diagnostics);
	}
	return { promptTemplates, diagnostics };
}

// 从单个文件加载模板（私有）：读文本 → 解析 frontmatter → 组装 PromptTemplate；
// description 缺省时用正文第一个非空行的前 60 字符；名称取文件名去掉 .md 后缀
async function loadTemplateFromFile(
	env: ExecutionEnv,
	filePath: string,
): Promise<{ promptTemplate: PromptTemplate | null; diagnostics: PromptTemplateDiagnostic[] }> {
	const diagnostics: PromptTemplateDiagnostic[] = [];
	const rawContent = await env.readTextFile(filePath);
	if (!rawContent.ok) {
		diagnostics.push({
			type: "warning",
			code: "read_failed",
			message: rawContent.error.message,
			path: filePath,
		});
		return { promptTemplate: null, diagnostics };
	}

	// 解析 frontmatter 与正文
	const parsed = parseFrontmatter<PromptTemplateFrontmatter>(rawContent.value);
	if (!parsed.ok) {
		diagnostics.push({
			type: "warning",
			code: "parse_failed",
			message: parsed.error.message,
			path: filePath,
		});
		return { promptTemplate: null, diagnostics };
	}

	const { frontmatter, body } = parsed.value;
	// 找正文第一个非空行作为描述兜底
	const firstLine = body.split("\n").find((line) => line.trim());
	let description = typeof frontmatter.description === "string" ? frontmatter.description : "";
	if (!description && firstLine) {
		description = firstLine.slice(0, 60);
		if (firstLine.length > 60) description += "...";
	}
	return {
		promptTemplate: {
			name: basenameEnvPath(filePath).replace(/\.md$/i, ""),
			description,
			content: body,
		},
		diagnostics,
	};
}

// 判定路径种类（私有）：优先信任 info.kind；不确定时通过 canonicalPath 解析真实目标再查询，
// 失败时记 file_info_failed 诊断并返回 undefined
async function resolveKind(
	env: ExecutionEnv,
	info: FileInfo,
	diagnostics: PromptTemplateDiagnostic[],
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

/**
 * 解析 frontmatter（私有）：识别文件头部的 `---` YAML 块，返回 { frontmatter, body }。
 * 统一换行符后处理；无 frontmatter 或块未闭合时正文原样返回、frontmatter 为空对象；
 * YAML 解析异常转为 Error 返回（ok:false）。泛型 T 为 frontmatter 形状。
 */
function parseFrontmatter<T extends Record<string, unknown>>(
	content: string,
): Result<{ frontmatter: T; body: string }, Error> {
	try {
		// 统一 CRLF/CR 为 LF
		const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		if (!normalized.startsWith("---")) return { ok: true, value: { frontmatter: {} as T, body: normalized } };
		// 找结束分隔符位置
		const endIndex = normalized.indexOf("\n---", 3);
		if (endIndex === -1) return { ok: true, value: { frontmatter: {} as T, body: normalized } };
		// 截出 YAML 字符串与正文
		const yamlString = normalized.slice(4, endIndex);
		const body = normalized.slice(endIndex + 4).trim();
		return { ok: true, value: { frontmatter: (parse(yamlString) ?? {}) as T, body } };
	} catch (error) {
		return { ok: false, error: toError(error) };
	}
}

// 取环境路径的文件名部分（私有）：去尾部斜杠后按最后一个 "/" 切分
function basenameEnvPath(path: string): string {
	const normalized = path.replace(/\/+$/, "");
	const slashIndex = normalized.lastIndexOf("/");
	return slashIndex === -1 ? normalized : normalized.slice(slashIndex + 1);
}

/** Parse an argument string using simple shell-style single and double quotes. */
// 按 shell 风格解析参数串（中文说明）：支持单双引号包裹与空白分隔，不支持转义符。
// 参数 argsString —— 原始参数串；返回参数数组。
// 示例：parseCommandArgs('fix "two words"') → ["fix", "two words"]
export function parseCommandArgs(argsString: string): string[] {
	// 结果参数数组
	const args: string[] = [];
	// 当前累积中的字符
	let current = "";
	// 当前引号类型；null 表示不在引号内
	let inQuote: string | null = null;

	for (let i = 0; i < argsString.length; i++) {
		const char = argsString[i]!;
		if (inQuote) {
			// 引号内：遇到配对引号结束，否则照常累积
			if (char === inQuote) inQuote = null;
			else current += char;
		} else if (char === '"' || char === "'") {
			inQuote = char;
		} else if (char === " " || char === "\t") {
			// 空白分隔：结算当前参数
			if (current) {
				args.push(current);
				current = "";
			}
		} else {
			current += char;
		}
	}
	if (current) args.push(current);
	return args;
}

/** Substitute prompt template placeholders (`$1`, `$@`, `$ARGUMENTS`, `${@:N}`, `${@:N:L}`). */
// 替换模板占位符（中文说明）：$N 取第 N 个参数（从 1 起，越界为空串）；
// ${@:N} 取从第 N 个到末尾；${@:N:L} 取从第 N 个起共 L 个；$ARGUMENTS 与 $@ 都表示全部参数空格连接。
// 参数 content —— 模板正文；args —— 参数数组；返回渲染后的字符串。
export function substituteArgs(content: string, args: string[]): string {
	let result = content;
	// 先处理 $N 位置参数
	result = result.replace(/\$(\d+)/g, (_, num: string) => args[parseInt(num, 10) - 1] ?? "");
	// 再处理 ${@:N[:L]} 切片语法
	result = result.replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_, startStr: string, lengthStr?: string) => {
		let start = parseInt(startStr, 10) - 1;
		if (start < 0) start = 0;
		if (lengthStr) return args.slice(start, start + parseInt(lengthStr, 10)).join(" ");
		return args.slice(start).join(" ");
	});
	// 全部参数拼接
	const allArgs = args.join(" ");
	result = result.replace(/\$ARGUMENTS/g, allArgs);
	result = result.replace(/\$@/g, allArgs);
	return result;
}

/** Format a prompt template invocation with positional arguments. */
// 格式化一次模板调用（中文说明）：用给定参数渲染模板正文；args 缺省为空数组。
// 使用示例：formatPromptTemplateInvocation(template, ["main"]) → 替换后的提示词文本
export function formatPromptTemplateInvocation(template: PromptTemplate, args: string[] = []): string {
	return substituteArgs(template.content, args);
}
