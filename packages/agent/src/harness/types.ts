/**
 * 【文件职责】Harness 层的完整类型与工具函数集合：Result 错误处理原语、技能/模板/资源类型、
 *              文件系统与执行环境抽象（FileSystem/Shell/ExecutionEnv）、会话树条目与存储接口、
 *              各类错误类、Harness 事件体系、钩子返回值映射，以及 AgentHarness 配置选项。
 * 【技术维度】TS 高级类型（条件类型、Omit/Extract、声明式联合）；Result 模式替代异常；
 *              接口驱动的环境抽象（可替换 Node/Bun/浏览器后端）。
 * 【产品维度】本文件是二次开发 Harness 的“合同书”：自定义执行环境、存储后端、事件钩子都按这里的接口实现。
 * 【逻辑维度】区块顺序：Result 工具 → Skill/PromptTemplate/Resources → HarnessTool 与流选项 →
 *              文件系统抽象与错误码 → 会话树条目/存储/仓库 → Harness 事件与结果映射 → 配置选项。
 * 【关键边界】所有环境方法契约“不得抛异常”，失败一律封装为 Result/FileError 等稳定错误码；
 *              会话树条目的 type 字段是持久化格式的一部分，不可随意改名。
 * 【新手阅读建议】先读 Result 与 ok/err/toError → 再按需查 FileSystem / ExecutionEnv / SessionTreeEntry /
 *              AgentHarnessEvent 四大块；写扩展时把本文件当 API 字典使用。
 */
import type {
	ImageContent,
	Model,
	Models,
	RetryPolicy,
	SimpleStreamOptions,
	TextContent,
	Transport,
	Usage,
} from "@earendil-works/pi-ai";
import type { Static, TSchema } from "typebox";
import type {
	AgentEvent,
	AgentMessage,
	AgentTool,
	AgentToolResult,
	AgentToolUpdateCallback,
	QueueMode,
	ThinkingLevel,
} from "../index.ts";
import type { Session } from "./session/session.ts";

/** Result of a fallible operation. Expected failures are returned as `ok: false` instead of thrown. */
/**
 * Result 类型（中文说明）：可失败操作的标准返回形态——成功时 { ok:true, value }，
 * 失败时 { ok:false, error }；预期内的错误用返回值表达而非抛异常。
 */
export type Result<TValue, TError> = { ok: true; value: TValue } | { ok: false; error: TError };

/** Create a successful {@link Result}. */
// 构造成功 Result：参数 value —— 成功值
export function ok<TValue, TError>(value: TValue): Result<TValue, TError> {
	return { ok: true, value };
}

/** Create a failed {@link Result}. */
// 构造失败 Result：参数 error —— 错误值
export function err<TValue, TError>(error: TError): Result<TValue, TError> {
	return { ok: false, error };
}

/** Return the success value or throw the failure error. Intended for tests and explicit adapter boundaries. */
// 取出成功值否则抛出错误：仅建议在测试或显式适配边界使用（日常路径应保持不抛异常约定）
export function getOrThrow<TValue, TError>(result: Result<TValue, TError>): TValue {
	if (!result.ok) throw result.error;
	return result.value;
}

/** Return the success value or `undefined`. Only object values are allowed to avoid truthiness bugs with primitives. */
// 取出成功值否则 undefined：泛型限定为对象类型，避免基本类型的真值判断陷阱
export function getOrUndefined<TValue extends object, TError>(result: Result<TValue, TError>): TValue | undefined {
	return result.ok ? result.value : undefined;
}

/** Normalize unknown thrown values into Error instances before using them as typed error causes. */
// 把任意抛出的值规范化为 Error 实例（中文说明）：Error 原样返回；字符串包装为 Error；
// 其他对象先 JSON 序列化，失败再用 String()。用于统一错误原因类型。
export function toError(error: unknown): Error {
	if (error instanceof Error) return error;
	if (typeof error === "string") return new Error(error);
	try {
		return new Error(JSON.stringify(error));
	} catch {
		return new Error(String(error));
	}
}

/**
 * Skill loaded from a `SKILL.md` file or provided by an application.
 *
 * `name`, `description`, and `filePath` are inserted into the system prompt in an XML-formatted block as suggested by agentskills.io.
 * Use {@link formatSkillsForSystemPrompt} to generate the spec-compatible system prompt block.
 */
/**
 * 技能对象（中文说明）：来自 SKILL.md 文件或应用直接提供；
 * name/description/filePath 会被格式化进系统提示词的 XML 块（见 formatSkillsForSystemPrompt）。
 */
export interface Skill {
	/** Stable skill name used for lookup and model-visible listings. */
	// 稳定的技能名：用于查找与模型可见清单
	name: string;
	/** Short model-visible description of when to use the skill. */
	// 面向模型的简短描述：说明何时使用该技能
	description: string;
	/** Full skill instructions. */
	// 技能全文指令内容
	content: string;
	/** Absolute path to the skill file. Used for model-visible location and resolving relative references. */
	// 技能文件绝对路径：用于展示位置与解析相对引用
	filePath: string;
	/** Exclude this skill from model-visible skill lists while still allowing explicit application invocation. */
	// 为 true 时不出现在模型可见清单中，但应用仍可显式调用
	disableModelInvocation?: boolean;
}

/** Prompt template that can be formatted into a prompt for explicit invocation. */
/** 提示词模板（中文说明）：可被渲染成提示词供显式调用的模板。 */
export interface PromptTemplate {
	/** Stable template name used for lookup or application command routing. */
	// 稳定模板名：用于查找或应用层命令路由
	name: string;
	/** Optional description for command lists or autocomplete. */
	// 可选描述：用于命令列表或自动补全
	description?: string;
	/** Template content. Argument placeholders are formatted by `formatPromptTemplateInvocation`. */
	// 模板正文；占位符由 formatPromptTemplateInvocation 渲染
	content: string;
}

/** Resources made available to explicit invocation methods and system-prompt callbacks. */
/** Harness 资源集（中文说明）：显式调用方法与系统提示词回调可用的模板与技能。 */
export interface AgentHarnessResources<
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
> {
	/** Prompt templates available for explicit invocation. */
	// 可显式调用的提示词模板列表
	promptTemplates?: TPromptTemplate[];
	/** Skills available to the model and explicit skill invocation. */
	// 模型可用及可显式调用的技能列表
	skills?: TSkill[];
}

/** Tool definition executed by an {@link AgentHarness} with an application-defined context. */
/** Harness 工具定义（中文说明）：在 AgentTool 基础上改造 execute——额外接收应用定义的上下文 context，
 * 该上下文由 Harness 按轮次快照解析后注入。 */
export type AgentHarnessTool<
	TContext extends object | undefined,
	TParameters extends TSchema = TSchema,
	TDetails = unknown,
> = Omit<AgentTool<TParameters, TDetails>, "execute"> & {
	/** Execute the tool call with the context resolved for the current turn snapshot. */
	// 执行工具：context 为当前轮次快照解析出的上下文
	execute(
		toolCallId: string,
		params: Static<TParameters>,
		signal: AbortSignal | undefined,
		onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
		context: TContext,
	): Promise<AgentToolResult<TDetails>>;
};

/** Static tool context or zero-argument provider resolved for each turn snapshot. */
// 工具上下文来源（中文说明）：静态上下文对象，或每次轮次快照时调用的零参提供函数
export type AgentHarnessToolContextSource<TContext extends object | undefined> =
	| TContext
	| (() => TContext | Promise<TContext>);

/** Curated provider request options owned by the harness and snapshotted per turn. */
/** Harness 流选项（中文说明）：由 Harness 管理并在每轮开始时快照的请求选项。 */
export interface AgentHarnessStreamOptions {
	/** Preferred transport forwarded to the stream function. */
	// 首选传输方式
	transport?: Transport;
	/** Provider request timeout in milliseconds. */
	// 供应商请求超时（毫秒）
	timeoutMs?: number;
	/** Maximum provider retry attempts. */
	// 最大重试次数
	maxRetries?: number;
	/** Optional cap for provider-requested retry delays. */
	// 重试延迟上限（毫秒）
	maxRetryDelayMs?: number;
	/** Additional request headers merged with auth and lifecycle headers. */
	// 附加请求头：与认证/生命周期头合并
	headers?: Record<string, string>;
	/** Provider metadata forwarded with requests. */
	// 随请求转发的供应商元数据
	metadata?: SimpleStreamOptions["metadata"];
	/** Provider cache retention hint. */
	// 缓存保留提示
	cacheRetention?: SimpleStreamOptions["cacheRetention"];
}

/** Per-request stream option patch returned by provider hooks. */
/** 流选项补丁（中文说明）：钩子返回的部分覆盖项；headers/metadata 支持 undefined 删除键，
 * 显式整体置 undefined 表示全部清空。 */
export interface AgentHarnessStreamOptionsPatch
	extends Omit<Partial<AgentHarnessStreamOptions>, "headers" | "metadata"> {
	/** Header patch. `undefined` values delete keys; explicit `headers: undefined` clears all headers. */
	// 头部补丁：值为 undefined 表示删除该键；headers 整体 undefined 清空全部
	headers?: Record<string, string | undefined>;
	/** Metadata patch. `undefined` values delete keys; explicit `metadata: undefined` clears all metadata. */
	// 元数据补丁：语义同上
	metadata?: Record<string, unknown | undefined>;
}

/** Kind of filesystem object as addressed by a {@link FileSystem}. Symlinks are not followed automatically. */
// 文件系统对象种类（中文说明）：file/directory/symlink；符号链接不会自动跟随
export type FileKind = "file" | "directory" | "symlink";

/** Stable, backend-independent file error codes returned by {@link FileSystem} file operations. */
// 文件错误码（中文说明）：跨后端稳定的错误分类——中止/不存在/无权限/非目录/是目录/非法/不支持/未知
export type FileErrorCode =
	| "aborted"
	| "not_found"
	| "permission_denied"
	| "not_directory"
	| "is_directory"
	| "invalid"
	| "not_supported"
	| "unknown";

/** Error returned by {@link FileSystem} file operations. */
/** FileError（中文说明）：文件操作的统一错误类，携带稳定 code 与相关 path。 */
export class FileError extends Error {
	/** Backend-independent error code. */
	// 跨后端稳定的错误码
	public code: FileErrorCode;
	/** Absolute addressed path associated with the failure, when available. */
	// 失败相关的绝对寻址路径（如有）
	public path?: string;

	constructor(code: FileErrorCode, message: string, path?: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "FileError";
		this.code = code;
		this.path = path;
	}
}

/** Stable, backend-independent execution error codes returned by {@link ExecutionEnv.exec}. */
// 执行错误码（中文说明）：中止/超时/shell 不可用/进程启动失败/回调出错/未知
export type ExecutionErrorCode =
	| "aborted"
	| "timeout"
	| "shell_unavailable"
	| "spawn_error"
	| "callback_error"
	| "unknown";

/** Error returned by {@link ExecutionEnv.exec}. */
/** ExecutionError（中文说明）：命令执行的统一错误类。 */
export class ExecutionError extends Error {
	/** Backend-independent error code. */
	// 跨后端稳定错误码
	public code: ExecutionErrorCode;

	constructor(code: ExecutionErrorCode, message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "ExecutionError";
		this.code = code;
	}
}

/** Stable compaction error codes returned by compaction helpers. */
// 压缩错误码（中文说明）：中止/摘要生成失败/会话无效/未知
export type CompactionErrorCode = "aborted" | "summarization_failed" | "invalid_session" | "unknown";

/** Error returned by compaction helpers. */
/** CompactionError（中文说明）：压缩流程的统一错误类。 */
export class CompactionError extends Error {
	/** Backend-independent error code. */
	public code: CompactionErrorCode;

	constructor(code: CompactionErrorCode, message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "CompactionError";
		this.code = code;
	}
}

/** Stable branch-summary error codes returned by branch summarization helpers. */
// 分支摘要错误码（中文说明）：中止/摘要生成失败/会话无效
export type BranchSummaryErrorCode = "aborted" | "summarization_failed" | "invalid_session";

/** Error returned by branch summarization helpers. */
/** BranchSummaryError（中文说明）：分支摘要流程的统一错误类。 */
export class BranchSummaryError extends Error {
	/** Backend-independent error code. */
	public code: BranchSummaryErrorCode;

	constructor(code: BranchSummaryErrorCode, message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "BranchSummaryError";
		this.code = code;
	}
}

// 会话子系统错误码（中文说明）：不存在/会话无效/条目无效/fork 目标非法/存储故障/未知
export type SessionErrorCode =
	| "not_found"
	| "invalid_session"
	| "invalid_entry"
	| "invalid_fork_target"
	| "storage"
	| "unknown";

/** Error thrown by session storage, repositories, and session tree operations. */
/** SessionError（中文说明）：会话存储、仓库与树操作抛出的统一错误类。 */
export class SessionError extends Error {
	/** Session subsystem error code. */
	// 会话子系统错误码
	public code: SessionErrorCode;

	constructor(code: SessionErrorCode, message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "SessionError";
		this.code = code;
	}
}

// Harness 顶层错误码（中文说明）：忙/状态非法/参数非法/会话/钩子/认证/压缩/分支摘要/未知
export type AgentHarnessErrorCode =
	| "busy"
	| "invalid_state"
	| "invalid_argument"
	| "session"
	| "hook"
	| "auth"
	| "compaction"
	| "branch_summary"
	| "unknown";

/** Public AgentHarness failure with a stable top-level classification. */
/** AgentHarnessError（中文说明）：对外暴露的 Harness 统一失败类，code 提供顶层分类便于程序化处理。 */
export class AgentHarnessError extends Error {
	// 顶层错误码
	public code: AgentHarnessErrorCode;

	constructor(code: AgentHarnessErrorCode, message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "AgentHarnessError";
		this.code = code;
	}
}

/** Metadata for one filesystem object in a {@link FileSystem}. */
/** FileInfo（中文说明）：文件系统对象的元数据快照。 */
export interface FileInfo {
	/** Basename of {@link path}. */
	// 文件名（path 的最后一段）
	name: string;
	/** Absolute, syntactically normalized addressed path in the execution environment. Symlinks are not followed. */
	// 绝对且语法规范化的寻址路径；不解析符号链接
	path: string;
	/** Object kind. Symlink targets are not followed; use {@link FileSystem.canonicalPath} explicitly. */
	// 对象种类；需要真实目标请用 canonicalPath
	kind: FileKind;
	/** Size in bytes for the addressed filesystem object. */
	// 对象大小（字节）
	size: number;
	/** Modification time as milliseconds since Unix epoch. */
	// 修改时间（Unix 纪元毫秒）
	mtimeMs: number;
}

/**
 * Filesystem capability used by the harness.
 *
 * Paths passed to methods may be absolute or relative to {@link cwd}. Paths returned by file operations are addressed paths
 * in the filesystem namespace, but are not canonicalized through symlinks unless returned by {@link canonicalPath}.
 *
 * Operation methods must never throw or reject. All filesystem failures, including unexpected backend failures, must be
 * encoded in the returned {@link Result}. Implementations must preserve this invariant.
 */
/**
 * FileSystem 接口（中文说明）：Harness 所依赖的文件系统能力抽象。
 * 入参路径可为绝对或相对 cwd 的相对路径；除 canonicalPath 外返回的路径不做符号链接归一化；
 * 铁律：所有方法不得抛异常或 reject，一切失败（含后端意外故障）必须编码进 Result。
 */
export interface FileSystem {
	/** Current working directory for relative paths. */
	// 相对路径的基准工作目录
	cwd: string;

	/** Return an absolute addressed path without requiring it to exist and without resolving symlinks. */
	// 转绝对寻址路径：不要求存在、不解析符号链接
	absolutePath(path: string, abortSignal?: AbortSignal): Promise<Result<string, FileError>>;
	/** Join path segments in the filesystem namespace without requiring the result to exist. */
	// 在命名空间内拼接路径段：结果无需存在
	joinPath(parts: string[], abortSignal?: AbortSignal): Promise<Result<string, FileError>>;
	/** Read a UTF-8 text file. */
	// 读取 UTF-8 文本文件
	readTextFile(path: string, abortSignal?: AbortSignal): Promise<Result<string, FileError>>;
	/** Read UTF-8 text lines. Implementations should stop once `maxLines` lines have been read. */
	// 按行读取文本；实现应在读满 maxLines 后尽早停止
	readTextLines(
		path: string,
		options?: { maxLines?: number; abortSignal?: AbortSignal },
	): Promise<Result<string[], FileError>>;
	/** Read a binary file. */
	// 读取二进制文件
	readBinaryFile(path: string, abortSignal?: AbortSignal): Promise<Result<Uint8Array, FileError>>;
	/** Create or overwrite a file, creating parent directories when supported. */
	// 写文件（覆盖语义）；支持时自动创建父目录
	writeFile(path: string, content: string | Uint8Array, abortSignal?: AbortSignal): Promise<Result<void, FileError>>;
	/** Create or append to a file, creating parent directories when supported. */
	// 追加写文件；支持时自动创建父目录
	appendFile(path: string, content: string | Uint8Array, abortSignal?: AbortSignal): Promise<Result<void, FileError>>;
	/** Return metadata for the addressed path without following symlinks. */
	// 取路径元信息：不跟随符号链接
	fileInfo(path: string, abortSignal?: AbortSignal): Promise<Result<FileInfo, FileError>>;
	/** List direct children of a directory without following symlinks. */
	// 列目录直接子项：不跟随符号链接
	listDir(path: string, abortSignal?: AbortSignal): Promise<Result<FileInfo[], FileError>>;
	/** Return the canonical path for an existing path, resolving symlinks where supported. */
	// 取规范路径：解析符号链接（受支持时），要求目标存在
	canonicalPath(path: string, abortSignal?: AbortSignal): Promise<Result<string, FileError>>;
	/** Return false for missing paths. Other errors, such as permission failures, return a {@link FileError}. */
	// 存在性检查：缺失返回 false；权限等错误以 FileError 报告
	exists(path: string, abortSignal?: AbortSignal): Promise<Result<boolean, FileError>>;
	/** Create a directory. Defaults: `recursive: true`, no abort signal. */
	// 创建目录；默认递归、无中止信号
	createDir(
		path: string,
		options?: { recursive?: boolean; abortSignal?: AbortSignal },
	): Promise<Result<void, FileError>>;
	/** Remove a file or directory. Defaults: `recursive: false`, `force: false`, no abort signal. */
	// 删除文件/目录；默认不递归不强删
	remove(
		path: string,
		options?: { recursive?: boolean; force?: boolean; abortSignal?: AbortSignal },
	): Promise<Result<void, FileError>>;
	/** Create a temporary directory and return its absolute path. Defaults: `prefix: "tmp-"`, no abort signal. */
	// 创建临时目录并返回绝对路径；默认前缀 "tmp-"
	createTempDir(prefix?: string, abortSignal?: AbortSignal): Promise<Result<string, FileError>>;
	/** Create a temporary file and return its absolute path. Defaults: `prefix: ""`, `suffix: ""`, no abort signal. */
	// 创建临时文件并返回绝对路径；默认前后缀为空
	createTempFile(options?: {
		prefix?: string;
		suffix?: string;
		abortSignal?: AbortSignal;
	}): Promise<Result<string, FileError>>;

	/** Release filesystem resources. Must be best-effort and must not throw or reject. */
	// 释放资源：尽力而为，不得抛异常
	cleanup(): Promise<void>;
}

/** Options for {@link Shell.exec}. */
/** exec 选项（中文说明）：控制工作目录、环境变量、继承策略、超时与输出流回调。 */
export interface ShellExecOptions {
	/** Working directory for the command. Relative paths are resolved against {@link ExecutionEnv.cwd}. Defaults to {@link ExecutionEnv.cwd}. */
	// 命令工作目录；相对路径基于 cwd 解析；缺省即 cwd
	cwd?: string;
	/** Environment variables for the command. Values override inherited defaults when `inheritEnv` is true. */
	// 命令环境变量；inheritEnv 为 true 时覆盖同名默认变量
	env?: Record<string, string>;
	/** Whether to inherit the execution environment's default variables. Defaults to true. */
	// 是否继承默认环境变量；默认 true
	inheritEnv?: boolean;
	/** Timeout in seconds. Implementations should return a timeout error when the command exceeds this duration. Defaults to no timeout. */
	// 超时（秒）；超过应报 timeout 错误；缺省不限时
	timeout?: number;
	/** Abort signal used to terminate the command. Defaults to no abort signal. */
	// 中止信号；触发时应终止命令
	abortSignal?: AbortSignal;
	/** Called with stdout chunks as they are produced. */
	// stdout 分块回调
	onStdout?: (chunk: string) => void;
	/** Called with stderr chunks as they are produced. */
	// stderr 分块回调
	onStderr?: (chunk: string) => void;
}

/** Shell execution capability used by the harness. */
/** Shell 能力（中文说明）：命令执行入口；exec 返回 stdout/stderr/exitCode 或 ExecutionError。 */
export interface Shell {
	/** Execute a shell command in {@link FileSystem.cwd} unless `options.cwd` is provided. */
	// 执行 shell 命令；未指定 cwd 时使用 FileSystem.cwd
	exec(
		command: string,
		options?: ShellExecOptions,
	): Promise<Result<{ stdout: string; stderr: string; exitCode: number }, ExecutionError>>;
	/** Release shell resources. Must be best-effort and must not throw or reject. */
	// 释放资源：尽力而为不得抛异常
	cleanup(): Promise<void>;
}

/** Filesystem and process execution environment used by the harness. */
/** ExecutionEnv（中文说明）：文件系统 + shell 能力的组合接口，是 Harness 的运行环境抽象；
 * 二次开发适配新平台（容器/远程）主要实现此接口。 */
export interface ExecutionEnv extends FileSystem, Shell {}

/** 会话树条目公共字段（中文说明）：type 种类、id 条目 ID、parentId 父条目（根为 null）、ISO 时间戳。 */
export interface SessionTreeEntryBase {
	type: string;
	id: string;
	parentId: string | null;
	timestamp: string;
}

/** 消息条目（中文说明）：会话树中的一条 AgentMessage。 */
export interface MessageEntry extends SessionTreeEntryBase {
	type: "message";
	message: AgentMessage;
}

/** 思考级别变更条目（中文说明）：记录用户切换思考强度的历史。 */
export interface ThinkingLevelChangeEntry extends SessionTreeEntryBase {
	type: "thinking_level_change";
	thinkingLevel: string;
}

/** 模型变更条目（中文说明）：记录切换到哪个 provider/modelId。 */
export interface ModelChangeEntry extends SessionTreeEntryBase {
	type: "model_change";
	provider: string;
	modelId: string;
}

/** 活动工具变更条目（中文说明）：记录启用工具名单的变化。 */
export interface ActiveToolsChangeEntry extends SessionTreeEntryBase {
	type: "active_tools_change";
	activeToolNames: string[];
}

/** 压缩条目（中文说明）：一次历史压缩的结果——summary 摘要、firstKeptEntryId 压缩后保留起点、
 * tokensBefore 压缩前 token 数、retainedTail 保留的尾部消息、fromHook 标记是否由钩子触发。 */
export interface CompactionEntry<T = unknown> extends SessionTreeEntryBase {
	type: "compaction";
	summary: string;
	firstKeptEntryId?: string;
	tokensBefore: number;
	retainedTail?: AgentMessage[];
	details?: T;
	usage?: Usage;
	fromHook?: boolean;
}

/** 分支摘要条目（中文说明）：从分支返回时的摘要记录；fromId 指向来源节点。 */
export interface BranchSummaryEntry<T = unknown> extends SessionTreeEntryBase {
	type: "branch_summary";
	fromId: string;
	summary: string;
	details?: T;
	usage?: Usage;
	fromHook?: boolean;
}

/** 自定义条目（中文说明）：应用写入的任意持久化数据，customType 区分用途。 */
export interface CustomEntry<T = unknown> extends SessionTreeEntryBase {
	type: "custom";
	customType: string;
	data?: T;
}

/** 自定义消息条目（中文说明）：持久化的自定义消息（与 CustomMessage 类似但面向会话树）。 */
export interface CustomMessageEntry<T = unknown> extends SessionTreeEntryBase {
	type: "custom_message";
	customType: string;
	content: string | (TextContent | ImageContent)[];
	details?: T;
	display: boolean;
}

/** 标签条目（中文说明）：给某个目标条目设置/清除标签（label 为 undefined 表示清除）。 */
export interface LabelEntry extends SessionTreeEntryBase {
	type: "label";
	targetId: string;
	label: string | undefined;
}

/** 会话信息条目（中文说明）：记录会话名称等元信息；type 为历史遗留名称，向后兼容保留。 */
export interface SessionInfoEntry extends SessionTreeEntryBase {
	type: "session_info"; // legacy name, kept for backwards compatibility
	name?: string;
}

/** 叶子指针条目（中文说明）：记录当前活动叶子节点 ID（null 表示清空）。 */
export interface LeafEntry extends SessionTreeEntryBase {
	type: "leaf";
	targetId: string | null;
}

/** 会话树条目联合类型（中文说明）：持久化会话的全部可能条目形态。 */
export type SessionTreeEntry =
	| MessageEntry
	| ThinkingLevelChangeEntry
	| ModelChangeEntry
	| ActiveToolsChangeEntry
	| CompactionEntry
	| BranchSummaryEntry
	| CustomEntry
	| CustomMessageEntry
	| LabelEntry
	| SessionInfoEntry
	| LeafEntry;

/** 会话上下文重建结果（中文说明）：从会话树恢复运行所需的状态——消息、思考级别、模型、启用工具。 */
export interface SessionContext {
	messages: AgentMessage[];
	thinkingLevel: string;
	model: { provider: string; modelId: string } | null;
	activeToolNames: string[] | null;
}

/** 会话统计（中文说明）：消息数与各类 token 用量、总成本。 */
export interface SessionStats {
	messageCount: number;
	cachedTokens: number;
	uncachedTokens: number;
	totalTokens: number;
	costTotal: number;
}

/** 会话基础元信息（中文说明）：id 与 ISO 创建时间。 */
export interface SessionMetadata {
	id: string;
	createdAt: string;
}

/** JSONL 会话元信息（中文说明）：附加工作目录、文件路径、可选父会话路径与自由元数据。 */
export interface JsonlSessionMetadata extends SessionMetadata {
	cwd: string;
	path: string;
	parentSessionPath?: string;
	metadata?: Record<string, unknown>;
}

/** 条目游标选项（中文说明）：afterEntrySeq 从指定序号之后取，limit 限制数量。 */
export interface SessionEntryCursorOptions {
	afterEntrySeq?: number;
	limit?: number;
}

/**
 * SessionStorage 接口（中文说明）：会话树底层存储抽象——元信息、叶子指针、条目的增查、
 * 标签/名称/统计、以及“到根或最近压缩点”的路径查询。二次开发接入新存储（数据库等）实现此接口即可。
 * 泛型 TMetadata 为具体实现的元信息类型。
 */
export interface SessionStorage<TMetadata extends SessionMetadata = SessionMetadata> {
	getMetadata(): Promise<TMetadata>;
	getLeafId(): Promise<string | null>;
	/** Persist a leaf entry that records the active session-tree leaf. */
	// 持久化叶子指针条目
	setLeafId(leafId: string | null): Promise<void>;
	createEntryId(): Promise<string>;
	appendEntry(entry: SessionTreeEntry): Promise<void>;
	getEntry(id: string): Promise<SessionTreeEntry | undefined>;
	findEntries<TType extends SessionTreeEntry["type"]>(
		type: TType,
	): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>>;
	getLabel(id: string): Promise<string | undefined>;
	getSessionName(): Promise<string | undefined>;
	getSessionStats(): Promise<SessionStats>;
	getPathToRootOrCompaction(leafId: string | null): Promise<SessionTreeEntry[]>;
	getEntries(options?: SessionEntryCursorOptions): Promise<SessionTreeEntry[]>;
}

// 重新导出 Session 类型，方便集中引用
export type { Session } from "./session/session.ts";

/** 创建会话选项（中文说明）：可指定会话 id。 */
export interface SessionCreateOptions {
	id?: string;
}

/** fork 选项（中文说明）：entryId 分叉锚点；position 在其之前或恰在其处截断；id 新会话 id。 */
export interface SessionForkOptions {
	entryId?: string;
	position?: "before" | "at";
	id?: string;
}

/**
 * SessionRepo 接口（中文说明）：会话集合级仓库——创建/打开/列出/删除/fork；
 * 泛型分别定制元信息、创建选项与列表选项。JSONL 与 SQLite 各有实现。
 */
export interface SessionRepo<
	TMetadata extends SessionMetadata = SessionMetadata,
	TCreateOptions extends SessionCreateOptions = SessionCreateOptions,
	TListOptions = void,
> {
	create(options: TCreateOptions): Promise<Session<TMetadata>>;
	open(metadata: TMetadata): Promise<Session<TMetadata>>;
	list(options?: TListOptions): Promise<TMetadata[]>;
	delete(metadata: TMetadata): Promise<void>;
	fork(source: TMetadata, options: SessionForkOptions & TCreateOptions): Promise<Session<TMetadata>>;
}

/** JSONL 创建选项（中文说明）：额外要求 cwd，并可记录父会话路径与自由元数据。 */
export interface JsonlSessionCreateOptions extends SessionCreateOptions {
	cwd: string;
	parentSessionPath?: string;
	metadata?: Record<string, unknown>;
}

/** JSONL 列表选项（中文说明）：按工作目录过滤。 */
export interface JsonlSessionListOptions {
	cwd?: string;
}

// JSONL 会话仓库 API（中文说明）：用具体泛型实例化 SessionRepo
export interface JsonlSessionRepoApi
	extends SessionRepo<JsonlSessionMetadata, JsonlSessionCreateOptions, JsonlSessionListOptions> {}

/** Harness 阶段枚举（中文说明）：空闲/轮次进行中/压缩中/分支摘要中/重试等待。 */
export type AgentHarnessPhase = "idle" | "turn" | "compaction" | "branch_summary" | "retry";

/**
 * 待写入会话的条目草稿（中文说明）：利用条件类型把每种 SessionTreeEntry 去掉
 * id/parentId/timestamp 三个由系统生成的字段，作为待持久化形态。
 */
export type PendingSessionWrite = SessionTreeEntry extends infer TEntry
	? TEntry extends SessionTreeEntry
		? Omit<TEntry, "id" | "parentId" | "timestamp">
		: never
	: never;

/** 队列更新事件（中文说明）：三条队列（转向/追问/下一轮）当前内容的快照通知。 */
export interface QueueUpdateEvent {
	type: "queue_update";
	steer: AgentMessage[];
	followUp: AgentMessage[];
	nextTurn: AgentMessage[];
}

/** 存档点事件（中文说明）：发生保存动作；hadPendingMutations 表示当时是否有未落盘修改。 */
export interface SavePointEvent {
	type: "save_point";
	hadPendingMutations: boolean;
}

/** 中止事件（中文说明）：报告被清除的转向/追问队列内容。 */
export interface AbortEvent {
	type: "abort";
	clearedSteer: AgentMessage[];
	clearedFollowUp: AgentMessage[];
}

/** 收束事件（中文说明）：一轮完全落定；nextTurnCount 为排队中的下一轮消息数。 */
export interface SettledEvent {
	type: "settled";
	nextTurnCount: number;
}

/** 代理启动前事件（中文说明）：可在此改写提示词/图片/系统提示词/资源。 */
export interface BeforeAgentStartEvent<
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
> {
	type: "before_agent_start";
	prompt: string;
	images?: ImageContent[];
	systemPrompt: string;
	resources: AgentHarnessResources<TSkill, TPromptTemplate>;
}

/** 上下文事件（中文说明）：暴露即将发送的消息数组，可用于观察或调整。 */
export interface ContextEvent {
	type: "context";
	messages: AgentMessage[];
}

/** 供应商请求前事件（中文说明）：可修改流选项补丁。 */
export interface BeforeProviderRequestEvent {
	type: "before_provider_request";
	model: Model<any>;
	sessionId: string;
	streamOptions: AgentHarnessStreamOptions;
}

/** 请求载荷发出前事件（中文说明）：可直接替换最终 payload。 */
export interface BeforeProviderPayloadEvent {
	type: "before_provider_payload";
	model: Model<any>;
	payload: unknown;
}

/** 供应商响应后事件（中文说明）：观测 HTTP 状态与响应头（只读）。 */
export interface AfterProviderResponseEvent {
	type: "after_provider_response";
	status: number;
	headers: Record<string, string>;
}

/** 工具调用事件（中文说明）：工具即将执行；可拦截。 */
export interface ToolCallEvent {
	type: "tool_call";
	toolCallId: string;
	toolName: string;
	input: Record<string, unknown>;
}

/** 工具结果事件（中文说明）：工具已产出结果；可部分修补。 */
export interface ToolResultEvent {
	type: "tool_result";
	toolCallId: string;
	toolName: string;
	input: Record<string, unknown>;
	content: Array<TextContent | ImageContent>;
	details: unknown;
	isError: boolean;
	usage?: Usage;
}

/** 压缩前事件（中文说明）：携带压缩准备数据，可取消或自带压缩结果。 */
export interface SessionBeforeCompactEvent {
	type: "session_before_compact";
	preparation: CompactionPreparation;
	branchEntries: SessionTreeEntry[];
	customInstructions?: string;
	signal: AbortSignal;
}

/** 压缩完成事件（中文说明）：携带生成的压缩条目；fromHook 标记是否由钩子产生。 */
export interface SessionCompactEvent {
	type: "session_compact";
	compactionEntry: CompactionEntry;
	fromHook: boolean;
}

/** 树切换前事件（中文说明）：携带树导航准备数据与中止信号。 */
export interface SessionBeforeTreeEvent {
	type: "session_before_tree";
	preparation: TreePreparation;
	signal: AbortSignal;
}

/** 树切换完成事件（中文说明）：报告新旧叶子与可选摘要条目。 */
export interface SessionTreeEvent {
	type: "session_tree";
	newLeafId: string | null;
	oldLeafId: string | null;
	summaryEntry?: BranchSummaryEntry;
	fromHook?: boolean;
}

/** 重试排期事件（中文说明）：压缩/分支摘要将按 delayMs 进行第 attempt/maxAttempts 次尝试。 */
export interface RetryScheduledEvent {
	type: "retry_scheduled";
	operation: "compaction" | "branch_summary";
	attempt: number;
	maxAttempts: number;
	delayMs: number;
	errorMessage: string;
}

/** 重试尝试开始事件（中文说明）。 */
export interface RetryAttemptStartEvent {
	type: "retry_attempt_start";
	operation: "compaction" | "branch_summary";
}

/** 重试结束事件（中文说明）：不再重试（成功或放弃）。 */
export interface RetryFinishedEvent {
	type: "retry_finished";
	operation: "compaction" | "branch_summary";
}

/** 模型更新事件（中文说明）：source 区分手动 set 还是恢复 restore。 */
export interface ModelUpdateEvent {
	type: "model_update";
	model: Model<any>;
	previousModel: Model<any> | undefined;
	source: "set" | "restore";
}

/** 思考级别更新事件（中文说明）：报告新旧思考强度。 */
export interface ThinkingLevelUpdateEvent {
	type: "thinking_level_update";
	level: ThinkingLevel;
	previousLevel: ThinkingLevel;
}

/** 工具集更新事件（中文说明）：报告全量与激活工具名单的新旧值及来源。 */
export interface ToolsUpdateEvent {
	type: "tools_update";
	toolNames: string[];
	previousToolNames: string[];
	activeToolNames: string[];
	previousActiveToolNames: string[];
	source: "set" | "restore";
}

/** 资源更新事件（中文说明）：技能/模板资源整体替换时触发。 */
export interface ResourcesUpdateEvent<
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
> {
	type: "resources_update";
	resources: AgentHarnessResources<TSkill, TPromptTemplate>;
	previousResources: AgentHarnessResources<TSkill, TPromptTemplate>;
}

/** Harness 自有事件联合（中文说明）：上述全部 Harness 级事件的汇总。 */
export type AgentHarnessOwnEvent<
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
> =
	| QueueUpdateEvent
	| SavePointEvent
	| AbortEvent
	| SettledEvent
	| BeforeAgentStartEvent<TSkill, TPromptTemplate>
	| ContextEvent
	| BeforeProviderRequestEvent
	| BeforeProviderPayloadEvent
	| AfterProviderResponseEvent
	| ToolCallEvent
	| ToolResultEvent
	| SessionBeforeCompactEvent
	| SessionCompactEvent
	| SessionBeforeTreeEvent
	| SessionTreeEvent
	| RetryScheduledEvent
	| RetryAttemptStartEvent
	| RetryFinishedEvent
	| ModelUpdateEvent
	| ThinkingLevelUpdateEvent
	| ResourcesUpdateEvent<TSkill, TPromptTemplate>
	| ToolsUpdateEvent;

/** Harness 完整事件（中文说明）：低层 AgentEvent + Harness 自有事件的并集，订阅者会同时收到两类。 */
export type AgentHarnessEvent<TSkill extends Skill = Skill, TPromptTemplate extends PromptTemplate = PromptTemplate> =
	| AgentEvent
	| AgentHarnessOwnEvent<TSkill, TPromptTemplate>;

/** before_agent_start 钩子返回值（中文说明）：可替换初始消息与系统提示词。 */
export interface BeforeAgentStartResult {
	messages?: AgentMessage[];
	systemPrompt?: string;
}

/** context 钩子返回值（中文说明）：必须给出最终的消息数组。 */
export interface ContextResult {
	messages: AgentMessage[];
}

/** before_provider_request 钩子返回值（中文说明）：可给流选项打补丁。 */
export interface BeforeProviderRequestResult {
	streamOptions?: AgentHarnessStreamOptionsPatch;
}

/** before_provider_payload 钩子返回值（中文说明）：返回替换后的最终载荷。 */
export interface BeforeProviderPayloadResult {
	payload: unknown;
}

/** tool_call 钩子返回值（中文说明）：block:true 拦截执行，reason 为提示文案。 */
export interface ToolCallResult {
	block?: boolean;
	reason?: string;
}

/** tool_result 补丁（中文说明）：字段级覆盖工具结果（同 AfterToolCallResult 语义）。 */
export interface ToolResultPatch {
	content?: Array<TextContent | ImageContent>;
	details?: unknown;
	isError?: boolean;
	usage?: Usage;
	terminate?: boolean;
}

/** 压缩前钩子返回值（中文说明）：cancel 取消压缩；compaction 提供现成压缩结果跳过内置生成。 */
export interface SessionBeforeCompactResult {
	cancel?: boolean;
	compaction?: CompactResult;
}

/** 树切换前钩子返回值（中文说明）：cancel 取消；summary 自带摘要；customInstructions/
 * replaceInstructions 定制摘要指令；label 给新分支打标。 */
export interface SessionBeforeTreeResult {
	cancel?: boolean;
	summary?: {
		summary: string;
		details?: unknown;
		/** Usage from the LLM call that generated this summary, if available. */
		// 生成该摘要的 LLM 用量（如有）
		usage?: Usage;
	};
	customInstructions?: string;
	replaceInstructions?: boolean;
	label?: string;
}

/** 事件→返回值映射表（中文说明）：声明每类 Harness 事件对应钩子的合法返回类型；
 * undefined 表示该事件不支持返回值（纯通知）。扩展新事件时需同步维护此表。 */
export type AgentHarnessEventResultMap = {
	before_agent_start: BeforeAgentStartResult | undefined;
	context: ContextResult | undefined;
	before_provider_request: BeforeProviderRequestResult | undefined;
	before_provider_payload: BeforeProviderPayloadResult | undefined;
	after_provider_response: undefined;
	tool_call: ToolCallResult | undefined;
	tool_result: ToolResultPatch | undefined;
	session_before_compact: SessionBeforeCompactResult | undefined;
	session_compact: undefined;
	session_before_tree: SessionBeforeTreeResult | undefined;
	session_tree: undefined;
	retry_scheduled: undefined;
	retry_attempt_start: undefined;
	retry_finished: undefined;
	model_update: undefined;
	thinking_level_update: undefined;
	resources_update: undefined;
	tools_update: undefined;
	queue_update: undefined;
	save_point: undefined;
	abort: undefined;
	settled: undefined;
};

/** prompt 选项（中文说明）：发提示时可附带图片。 */
export interface AgentHarnessPromptOptions {
	images?: ImageContent[];
}

/** 中止结果（中文说明）：报告因中止而被清除的两条队列。 */
export interface AbortResult {
	clearedSteer: AgentMessage[];
	clearedFollowUp: AgentMessage[];
}

/** 压缩结果（中文说明）：summary 摘要、firstKeptEntryId 保留起点、tokensBefore 压缩前规模、
 * usage 生成本摘要的 LLM 用量、retainedTail 保留尾部、details 自由详情。 */
export interface CompactResult {
	summary: string;
	firstKeptEntryId?: string;
	tokensBefore: number;
	/** Usage from the LLM call(s) that generated this summary, if available. */
	// 生成本摘要的一次或多次 LLM 调用用量（如有）
	usage?: Usage;
	retainedTail?: AgentMessage[];
	details?: unknown;
}

/** 树导航结果（中文说明）：cancelled 是否被取消；editorText 编辑器回填文本；summaryEntry 生成的摘要条目。 */
export interface NavigateTreeResult {
	cancelled: boolean;
	editorText?: string;
	summaryEntry?: BranchSummaryEntry;
}

/** 压缩设置（中文说明）：enabled 开关；reserveTokens 预留空间；keepRecentTokens 最近保留量。 */
export interface CompactionSettings {
	enabled: boolean;
	reserveTokens: number;
	keepRecentTokens: number;
}

/** 压缩准备数据（中文说明）：划定摘要范围——firstKeptEntryId 之后保留；
 * messagesToSummarize 待摘要消息；turnPrefixMessages 跨轮切分时轮次前缀；retainedTail 保留尾；
 * isSplitTurn 是否切开了一轮；fileOps/settings 辅助摘要生成。 */
export interface CompactionPreparation {
	firstKeptEntryId: string;
	messagesToSummarize: AgentMessage[];
	turnPrefixMessages: AgentMessage[];
	retainedTail: AgentMessage[];
	isSplitTurn: boolean;
	tokensBefore: number;
	previousSummary?: string;
	fileOps: FileOperations;
	settings: CompactionSettings;
}

/** 文件操作记录（中文说明）：会话期间读取/写入/编辑过的路径集合，供摘要生成参考。 */
export interface FileOperations {
	read: Set<string>;
	written: Set<string>;
	edited: Set<string>;
}

/** 树导航准备数据（中文说明）：targetId 目标节点、commonAncestorId 公共祖先、entriesToSummarize
 * 待摘要条目、userWantsSummary 用户是否要摘要、其余为指令与标签定制项。 */
export interface TreePreparation {
	targetId: string;
	oldLeafId: string | null;
	commonAncestorId: string | null;
	entriesToSummarize: SessionTreeEntry[];
	userWantsSummary: boolean;
	customInstructions?: string;
	replaceInstructions?: boolean;
	label?: string;
}

/** 分支摘要生成选项（中文说明）：模型、密钥、附加头、中止信号、指令定制与预留 token。 */
export interface GenerateBranchSummaryOptions {
	model: Model<any>;
	apiKey: string;
	headers?: Record<string, string>;
	signal: AbortSignal;
	customInstructions?: string;
	replaceInstructions?: boolean;
	reserveTokens?: number;
}

/** 分支摘要结果（中文说明）：summary 摘要正文、usage LLM 用量、read/modifiedFiles 参与摘要的文件清单。 */
export interface BranchSummaryResult {
	summary: string;
	usage?: Usage;
	readFiles: string[];
	modifiedFiles: string[];
}

/** 系统提示词提供形式（中文说明）：静态字符串，或接收会话/模型/思考级别/激活工具/资源并返回文本（可异步）的函数。 */
export type AgentHarnessSystemPrompt<
	TContext extends object | undefined = undefined,
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
	TTool extends AgentHarnessTool<TContext> = AgentHarnessTool<TContext>,
> =
	| string
	| ((context: {
			session: Session;
			model: Model<any>;
			thinkingLevel: ThinkingLevel;
			activeTools: TTool[];
			resources: AgentHarnessResources<TSkill, TPromptTemplate>;
	  }) => string | Promise<string>);

/** Harness 基础选项（内部）（中文说明）：会话、模型集合、工具、资源、系统提示词、流选项、
 * 重试策略、模型与思考级别、队列模式等核心配置。 */
interface AgentHarnessOptionsBase<
	TContext extends object | undefined,
	TSkill extends Skill,
	TPromptTemplate extends PromptTemplate,
	TTool extends AgentHarnessTool<TContext>,
> {
	session: Session;
	/**
	 * Provider collection used for all model requests (turn streaming,
	 * compaction, branch summarization). Auth resolves through the providers'
	 * auth.
	 */
	// 所有模型请求共用的供应商集合（轮次流式/压缩/分支摘要）；认证经各供应商 auth 解析
	models: Models;
	tools?: TTool[];
	/**
	 * Concrete resources available to explicit invocation methods and system-prompt callbacks.
	 * Applications own loading/reloading resources and should call `setResources()` with new values.
	 */
	// 具体资源：加载/重载由应用负责，更新时调用 setResources()
	resources?: AgentHarnessResources<TSkill, TPromptTemplate>;
	systemPrompt?: AgentHarnessSystemPrompt<TContext, TSkill, TPromptTemplate, TTool>;
	/** Curated stream/provider request options. Snapshotted at turn start. */
	// 流/请求选项：每轮开始时快照
	streamOptions?: AgentHarnessStreamOptions;
	/** Optional retry policy for generated compaction and branch-summary requests. */
	// 压缩与分支摘要请求的可选重试策略
	retry?: RetryPolicy;
	model: Model<any>;
	thinkingLevel?: ThinkingLevel;
	activeToolNames?: string[];
	steeringMode?: QueueMode;
	followUpMode?: QueueMode;
}

/** Harness 完整选项（中文说明）：在基础选项上按 TContext 是否为 undefined 施加条件约束——
 * 无上下文时 toolContext 必须省略；有上下文时必填（静态值或零参提供器）。 */
export type AgentHarnessOptions<
	TContext extends object | undefined = undefined,
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
	TTool extends AgentHarnessTool<TContext> = AgentHarnessTool<TContext>,
> = AgentHarnessOptionsBase<TContext, TSkill, TPromptTemplate, TTool> &
	([TContext] extends [undefined]
		? {
				/** Context-free harnesses do not need a tool context. */
				toolContext?: undefined;
			}
		: {
				/** Static context or zero-argument context provider resolved for each turn snapshot. */
				// 静态上下文或每次轮次快照解析的零参提供器
				toolContext: AgentHarnessToolContextSource<TContext>;
			});

// 重新导出 AgentHarness 类型，形成完整公开面
export type { AgentHarness } from "./agent-harness.ts";
