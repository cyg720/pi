/**
 * 【文件职责】文件变更串行队列：确保对“同一执行环境 + 同一规范路径”的写/删等变更操作按提交顺序
 *              逐个执行，避免并发编辑同一文件造成交错损坏。
 * 【技术维度】WeakMap 按环境实例挂载状态（环境被回收则状态自动释放）；Promise 链实现互斥锁；
 *              canonicalPath 归一化路径键（符号链接指向同一实体时视为同一路径）。
 * 【产品维度】是 edit/write 工具安全并发的基石：模型并行调用多个编辑时，底层仍保证文件一致性。
 * 【逻辑维度】getState 懒初始化 → getMutationQueueKey 计算队列键 → withFileMutationQueue 注册入队 →
 *              等待前驱完成 → 执行 fn → finally 释放后继并清理空队列。
 * 【关键边界】注册与执行分离：注册顺序即执行顺序；canonicalPath 失败且非 not_found/not_supported 时直接抛错；
 *              不同 ExecutionEnv 实例之间不共享队列。
 * 【新手阅读建议】重点读 withFileMutationQueue：理解“先在 registration 链上排队拿号，
 *              再在对应文件的 Promise 链上等号”的两段式设计。
 */
import type { ExecutionEnv } from "../types.ts";
import { getOrThrow } from "../types.ts";

/** 队列状态（中文说明）：queues —— 路径键 → 该路径的当前队尾 Promise；registration —— 全局注册链，保证拿号顺序。 */
type MutationQueueState = {
	queues: Map<string, Promise<void>>;
	registration: Promise<void>;
};

// 以执行环境为键的全局状态表（弱引用，不阻止环境被垃圾回收）
const states = new WeakMap<ExecutionEnv, MutationQueueState>();

// 获取（或懒创建）某环境的队列状态（私有）
function getState(env: ExecutionEnv): MutationQueueState {
	let state = states.get(env);
	if (!state) {
		state = { queues: new Map(), registration: Promise.resolve() };
		states.set(env, state);
	}
	return state;
}

/**
 * 计算变更队列键（私有）：优先用规范路径（解析符号链接后的真实路径）；
 * 文件不存在或后端不支持规范化时退回绝对路径；其他错误向上抛出。
 */
async function getMutationQueueKey(env: ExecutionEnv, path: string): Promise<string> {
	const absolutePath = getOrThrow(await env.absolutePath(path));
	const canonicalPath = await env.canonicalPath(absolutePath);
	if (canonicalPath.ok) return canonicalPath.value;
	if (canonicalPath.error.code === "not_found" || canonicalPath.error.code === "not_supported") return absolutePath;
	throw canonicalPath.error;
}

/** Serialize file mutations targeting the same environment and canonical path. */
/**
 * 在文件变更队列中串行执行函数（中文说明）：
 * 参数 env —— 执行环境；path —— 目标文件路径；fn —— 要排队的异步操作。
 * 返回 fn 的结果。使用示例：
 *   await withFileMutationQueue(env, file, async () => { /* 读-改-写 file *\/ })
 */
export async function withFileMutationQueue<T>(env: ExecutionEnv, path: string, fn: () => Promise<T>): Promise<T> {
	const state = getState(env);
	// 第一段：在全局注册链上排队，确定本操作的文件队列与位置
	const registration = state.registration.then(async () => {
		const key = await getMutationQueueKey(env, path);
		const currentQueue = state.queues.get(key) ?? Promise.resolve();

		// 为本次操作准备一个“放行闸门”
		let releaseNext = () => {};
		const nextQueue = new Promise<void>((resolve) => {
			releaseNext = resolve;
		});
		// 新队尾 = 前驱完成后再等本次放行
		const chainedQueue = currentQueue.then(() => nextQueue);
		state.queues.set(key, chainedQueue);
		return { key, currentQueue, chainedQueue, releaseNext };
	});
	// 注册链吞掉异常继续前进，避免后续操作被单个失败卡死
	state.registration = registration.then(
		() => undefined,
		() => undefined,
	);

	const { key, currentQueue, chainedQueue, releaseNext } = await registration;
	// 第二段：等待同一路径的前驱全部完成
	await currentQueue;
	try {
		return await fn();
	} finally {
		// 放行下一个等待者；若自己是最新队尾则清掉映射防泄漏
		releaseNext();
		if (state.queues.get(key) === chainedQueue) state.queues.delete(key);
	}
}
