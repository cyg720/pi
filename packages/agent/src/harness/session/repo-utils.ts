/**
 * 【文件职责】会话仓库层的公共工具函数：会话 ID/时间戳生成、Session 包装、
 *              文件系统 Result → SessionError 的转换，以及 fork 时截取条目的规则实现。
 * 【技术维度】uuidv7 时间有序 ID；ISO 8601 时间戳；Result 解包辅助；纯函数集合。
 * 【产品维度】统一各存储后端（内存/JSONL）的公共行为，避免重复实现，保证 ID 与分叉语义全局一致。
 * 【逻辑维度】前三个函数是简单工厂 → getFileSystemResultOrThrow 统一错误转换 →
 *              getEntriesToFork 按 entryId+position 决定分叉叶子并回溯路径。
 * 【关键边界】position="before" 仅允许锚定在 user 消息上（否则 invalid_fork_target）；
 *              默认 position 为 before（取锚点之前的历史）；无 entryId 时复制全部条目。
 * 【新手阅读建议】逐个函数阅读即可，重点理解 getEntriesToFork 中 "at" 与 "before" 两种截断语义。
 */
import { uuidv7 } from "@earendil-works/pi-ai";
import {
	type FileError,
	type Result,
	SessionError,
	type SessionMetadata,
	type SessionStorage,
	type SessionTreeEntry,
} from "../types.ts";
import { Session } from "./session.ts";

// 生成新的会话 ID（uuidv7：时间有序，利于排序与索引）
export function createSessionId(): string {
	return uuidv7();
}

// 生成 ISO 8601 格式的当前时间戳字符串
export function createTimestamp(): string {
	return new Date().toISOString();
}

// 把一个存储实例包装成 Session 对象（泛型透传元信息类型）
export function toSession<TMetadata extends SessionMetadata>(storage: SessionStorage<TMetadata>): Session<TMetadata> {
	return new Session(storage);
}

/**
 * 解包文件系统 Result（中文说明）：失败时抛出 SessionError——not_found 保持原码，其余归为 storage；
 * message 作为错误前缀。参数 result —— 文件操作结果；message —— 错误上下文描述。返回成功值。
 */
export function getFileSystemResultOrThrow<TValue>(result: Result<TValue, FileError>, message: string): TValue {
	if (!result.ok) {
		const code = result.error.code === "not_found" ? "not_found" : "storage";
		throw new SessionError(code, `${message}: ${result.error.message}`, result.error);
	}
	return result.value;
}

/**
 * 计算 fork 需要复制的条目（中文说明）：
 * - 未指定 entryId：返回全部条目；
 * - position="at"（或默认语义下的锚点即目标）：以目标条目为叶子回溯路径；
 * - position="before"：目标必须是 user 消息，以其父节点为叶子回溯。
 * 参数 storage —— 源会话存储；options —— 分叉选项。返回条目数组；锚点非法时抛 invalid_fork_target。
 */
export async function getEntriesToFork(
	storage: SessionStorage,
	options: { entryId?: string; position?: "before" | "at" },
): Promise<SessionTreeEntry[]> {
	if (!options.entryId) return storage.getEntries();
	const target = await storage.getEntry(options.entryId);
	if (!target) {
		throw new SessionError("invalid_fork_target", `Entry ${options.entryId} not found`);
	}
	let effectiveLeafId: string | null;
	if ((options.position ?? "before") === "at") {
		// at：包含目标条目本身
		effectiveLeafId = target.id;
	} else {
		if (target.type !== "message" || target.message.role !== "user") {
			throw new SessionError("invalid_fork_target", `Entry ${options.entryId} is not a user message`);
		}
		// before：不含目标，回到其父节点
		effectiveLeafId = target.parentId;
	}
	return storage.getPathToRootOrCompaction(effectiveLeafId);
}
