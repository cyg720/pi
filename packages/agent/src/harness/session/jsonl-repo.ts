/**
 * 【文件职责】实现基于 JSONL 文件的会话仓库（JsonlSessionRepo），负责在磁盘上创建、打开、列举、删除和分叉（fork）会话。
 * 【技术维度】每个会话对应一个追加写（append-only，只增不改）的 .jsonl 日志文件；按"工作目录编码后的子目录"组织；所有磁盘操作经由注入的 FileSystem 抽象完成，便于测试与跨运行时替换。
 * 【产品维度】让用户的对话历史可持久保存、可按项目（cwd）检索，并能从任意历史节点分叉出新会话继续探索。
 * 【逻辑维度】create/open/list/delete/fork 五个核心操作；文件系统调用的 Result 结果统一经 getFileSystemResultOrThrow 转成 SessionError 抛出；list 时静默跳过损坏的会话文件而不中断整体列举。
 * 【关键边界】open 前先检查文件是否存在；list 只认扩展名为 .jsonl 的文件；fork 复制的是从叶子到根（或最近压缩点）的路径条目。
 * 【新手阅读建议】先看 JsonlSessionRepo 类注释和五个公开方法，再回看 encodeCwd 与各私有路径辅助方法，理解目录名如何由 cwd 编码而来。
 */
import type {
	FileSystem,
	JsonlSessionCreateOptions,
	JsonlSessionListOptions,
	JsonlSessionMetadata,
	JsonlSessionRepoApi,
	Session,
} from "../types.ts";
import { SessionError, toError } from "../types.ts";
import { JsonlSessionStorage, loadJsonlSessionMetadata } from "./jsonl-storage.ts";
import {
	createSessionId,
	createTimestamp,
	getEntriesToFork,
	getFileSystemResultOrThrow,
	toSession,
} from "./repo-utils.ts";

/**
 * 本仓库需要的文件系统能力的最小子集：用 Pick 从完整 FileSystem 接口中挑出实际用到的方法
 * （路径解析、拼接、读写、目录列举、增删等）。这样测试时只需伪造这几个方法即可，降低耦合。
 */
type JsonlSessionRepoFileSystem = Pick<
	FileSystem,
	| "cwd"
	| "absolutePath"
	| "joinPath"
	| "readTextFile"
	| "readTextLines"
	| "writeFile"
	| "appendFile"
	| "listDir"
	| "exists"
	| "createDir"
	| "remove"
>;

/**
 * 把工作目录路径编码成一个文件名安全的单层目录名，用作该目录下会话文件的存放位置。
 * @param cwd 工作目录绝对路径，例如 /home/u/proj 或 D:\proj
 * @returns 形如 "--home-u-proj--" 的目录名：去掉开头的盘符或斜杠，把剩余的斜杠和冒号统一替换为 "-"，再用 "--" 包裹以避免与其他普通目录撞名
 */
function encodeCwd(cwd: string): string {
	return `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
}

/**
 * 基于 JSONL 文件的会话仓库，实现 JsonlSessionRepoApi 接口。
 * 核心功能：把每个会话持久化为一个 .jsonl 追加日志文件，并提供创建、打开、列举、删除、分叉能力。
 * 使用场景：需要跨进程、跨重启保留对话历史的真实运行环境（与之相对的是仅存内存的 InMemorySessionRepo）。
 * 设计要点：磁盘操作全部经由构造时注入的文件系统抽象，单元测试可以用假实现替换。
 */
export class JsonlSessionRepo implements JsonlSessionRepoApi {
	// 注入的文件系统抽象，提供本仓库所需的全部磁盘能力
	private readonly fs: JsonlSessionRepoFileSystem;
	// 构造时传入的会话根目录（可能是相对路径），仅作记录；实际使用前会被解析为绝对路径
	private readonly sessionsRootInput: string;
	// 缓存解析后的会话根目录绝对路径，避免重复解析；undefined 表示尚未解析
	private sessionsRoot: string | undefined;

	/**
	 * 创建仓库实例（不会立即访问磁盘，路径在首次使用时才解析）。
	 * @param options.fs 文件系统抽象实现
	 * @param options.sessionsRoot 存放所有会话文件的根目录
	 */
	constructor(options: { fs: JsonlSessionRepoFileSystem; sessionsRoot: string }) {
		this.fs = options.fs;
		this.sessionsRootInput = options.sessionsRoot;
	}

	/**
	 * 取得会话根目录的绝对路径（带缓存）。
	 * 实现思路：首次调用把 sessionsRootInput 解析成绝对路径并缓存，之后直接复用缓存值。
	 * @returns 会话根目录绝对路径；解析失败时抛出 SessionError
	 */
	private async getSessionsRoot(): Promise<string> {
		if (!this.sessionsRoot) {
			this.sessionsRoot = getFileSystemResultOrThrow(
				await this.fs.absolutePath(this.sessionsRootInput),
				`Failed to resolve sessions root ${this.sessionsRootInput}`,
			);
		}
		return this.sessionsRoot;
	}

	/**
	 * 计算某个工作目录对应的会话子目录完整路径。
	 * @param cwd 工作目录
	 * @returns "<根目录>/<encodeCwd(cwd)>" 形式的目录路径；拼接失败抛出 SessionError
	 */
	private async getSessionDir(cwd: string): Promise<string> {
		return getFileSystemResultOrThrow(
			await this.fs.joinPath([await this.getSessionsRoot(), encodeCwd(cwd)]),
			`Failed to resolve session directory for ${cwd}`,
		);
	}

	/**
	 * 计算新会话文件的完整路径。
	 * @param cwd 工作目录，决定所在子目录
	 * @param sessionId 会话 ID
	 * @param timestamp 创建时间（ISO 字符串），其中的冒号和点会被替换为 "-" 以兼容 Windows 文件名
	 * @returns 形如 "<会话目录>/<timestamp>_<sessionId>.jsonl" 的文件路径
	 */
	private async createSessionFilePath(cwd: string, sessionId: string, timestamp: string): Promise<string> {
		return getFileSystemResultOrThrow(
			await this.fs.joinPath([
				await this.getSessionDir(cwd),
				`${timestamp.replace(/[:.]/g, "-")}_${sessionId}.jsonl`,
			]),
			`Failed to resolve session file path for ${sessionId}`,
		);
	}

	/**
	 * 创建一个新会话，并在磁盘上初始化其 JSONL 文件（含会话头）。
	 * @param options.cwd 会话所属工作目录；options.id 可选的自定义会话 ID；parentSessionPath/metadata 写入文件头
	 * @returns 包装了存储层的 Session 对象；目录创建或文件初始化失败时抛出 SessionError
	 */
	async create(options: JsonlSessionCreateOptions): Promise<Session<JsonlSessionMetadata>> {
		const id = options.id ?? createSessionId();
		const createdAt = createTimestamp();
		const sessionDir = await this.getSessionDir(options.cwd);
		getFileSystemResultOrThrow(
			await this.fs.createDir(sessionDir, { recursive: true }),
			`Failed to create session directory ${sessionDir}`,
		);
		const filePath = await this.createSessionFilePath(options.cwd, id, createdAt);
		const storage = await JsonlSessionStorage.create(this.fs, filePath, {
			cwd: options.cwd,
			sessionId: id,
			parentSessionPath: options.parentSessionPath,
			metadata: options.metadata,
		});
		return toSession(storage);
	}

	/**
	 * 打开一个已存在的会话文件并加载其全部条目。
	 * @param metadata 会话元数据，其 path 字段指向 .jsonl 文件
	 * @returns 对应的 Session 对象；文件不存在抛 not_found，内容非法抛 invalid_session
	 */
	async open(metadata: JsonlSessionMetadata): Promise<Session<JsonlSessionMetadata>> {
		if (
			!getFileSystemResultOrThrow(await this.fs.exists(metadata.path), `Failed to check session ${metadata.path}`)
		) {
			throw new SessionError("not_found", `Session not found: ${metadata.path}`);
		}
		const storage = await JsonlSessionStorage.open(this.fs, metadata.path);
		return toSession(storage);
	}

	/**
	 * 列举会话元数据，按创建时间从新到旧排序。
	 * @param options.cwd 指定则只列举该工作目录下的会话；省略则扫描所有工作目录子目录
	 * @returns 会话元数据数组；损坏（invalid_session）的文件被静默跳过，其他读取错误向上抛出
	 */
	async list(options: JsonlSessionListOptions = {}): Promise<JsonlSessionMetadata[]> {
		const dirs = options.cwd ? [await this.getSessionDir(options.cwd)] : await this.listSessionDirs();
		const sessions: JsonlSessionMetadata[] = [];
		for (const dir of dirs) {
			if (!getFileSystemResultOrThrow(await this.fs.exists(dir), `Failed to check session directory ${dir}`)) {
				continue;
			}
			const files = getFileSystemResultOrThrow(
				await this.fs.listDir(dir),
				`Failed to list sessions in ${dir}`,
			).filter((file) => file.kind !== "directory" && file.name.endsWith(".jsonl"));
			for (const file of files) {
				try {
					sessions.push(await loadJsonlSessionMetadata(this.fs, file.path));
				} catch (error) {
					const cause = toError(error);
					if (!(cause instanceof SessionError) || cause.code !== "invalid_session") throw cause;
				}
			}
		}
		sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return sessions;
	}

	/**
	 * 删除一个会话的 JSONL 文件。
	 * @param metadata 待删除会话的元数据（使用其 path 定位文件）；force: true 表示文件不存在也不报错
	 */
	async delete(metadata: JsonlSessionMetadata): Promise<void> {
		getFileSystemResultOrThrow(
			await this.fs.remove(metadata.path, { force: true }),
			`Failed to delete session ${metadata.path}`,
		);
	}

	/**
	 * 分叉会话：打开源会话并按 entryId/position 截取条目，写入新的 .jsonl 文件；
	 * 新文件头记录父会话路径（缺省用源文件路径）与元数据（缺省继承源元数据）。
	 * @param sourceMetadata 源会话元数据
	 * @param options 分叉选项（entryId 锚点、position 截断位置、id 新会话 ID、cwd 目标工作目录等）
	 * @returns 分叉出的新 Session
	 */
	async fork(
		sourceMetadata: JsonlSessionMetadata,
		options: JsonlSessionCreateOptions & { entryId?: string; position?: "before" | "at"; id?: string },
	): Promise<Session<JsonlSessionMetadata>> {
		// 打开源会话（不存在抛错）
		const source = await this.open(sourceMetadata);
		// 计算需要复制的条目集合
		const forkedEntries = await getEntriesToFork(source.getStorage(), options);
		const id = options.id ?? createSessionId();
		const createdAt = createTimestamp();
		const sessionDir = await this.getSessionDir(options.cwd);
		getFileSystemResultOrThrow(
			await this.fs.createDir(sessionDir, { recursive: true }),
			`Failed to create session directory ${sessionDir}`,
		);
		const storage = await JsonlSessionStorage.create(
			this.fs,
			await this.createSessionFilePath(options.cwd, id, createdAt),
			{
				cwd: options.cwd,
				sessionId: id,
				parentSessionPath: options.parentSessionPath ?? sourceMetadata.path,
				metadata: options.metadata ?? sourceMetadata.metadata,
			},
		);
		for (const entry of forkedEntries) {
			await storage.appendEntry(entry);
		}
		return toSession(storage);
	}

	/**
	 * 列举全部会话子目录（私有）：根目录不存在时返回空数组；
	 * 否则返回其中所有目录条目的路径（每个子目录对应一个工作目录的编码名）。
	 */
	private async listSessionDirs(): Promise<string[]> {
		const sessionsRoot = await this.getSessionsRoot();
		if (
			!getFileSystemResultOrThrow(
				await this.fs.exists(sessionsRoot),
				`Failed to check sessions root ${sessionsRoot}`,
			)
		) {
			return [];
		}
		const entries = getFileSystemResultOrThrow(
			await this.fs.listDir(sessionsRoot),
			`Failed to list sessions root ${sessionsRoot}`,
		);
		return entries.filter((entry) => entry.kind === "directory").map((entry) => entry.path);
	}
}
