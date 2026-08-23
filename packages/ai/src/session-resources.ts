/**
 * 【文件职责】会话资源清理注册表：允许各模块注册“会话结束时的清理回调”，
 *              并在会话终结时统一执行；任一回调抛错会聚合并整体抛出。
 * 【技术维度】Set 存储回调；注册返回退订函数；AggregateError 聚合错误。
 * 【产品维度】确保会话生命周期内的临时资源（OAuth 页面、文件句柄等）得到可靠释放，
 *              避免多模块各自为政导致泄漏。
 * 【逻辑维度】registerSessionResourceCleanup 登记 → cleanupSessionResources 遍历执行 → 出错聚合上抛。
 * 【关键边界】清理是尽力而为：单回调失败不影响其余回调执行；sessionId 可选（全局清理时省略）；
 *              重复注册同一回调会被 Set 去重。
 * 【新手阅读建议】半分钟读完：记住“注册返回退订函数、清理抛 AggregateError”两点即可。
 */

/** 会话资源清理回调类型（中文说明）：sessionId 可选——提供时只清理该会话相关资源。 */
export type SessionResourceCleanup = (sessionId?: string) => void;

// 全局清理回调集合
const sessionResourceCleanups = new Set<SessionResourceCleanup>();

// 注册清理回调：返回退订函数
export function registerSessionResourceCleanup(cleanup: SessionResourceCleanup): () => void {
	sessionResourceCleanups.add(cleanup);
	return () => {
		sessionResourceCleanups.delete(cleanup);
	};
}

// 执行全部清理回调（中文说明）：逐个 try/catch 收集错误；存在错误时以 AggregateError 整体抛出
export function cleanupSessionResources(sessionId?: string): void {
	const errors: unknown[] = [];
	for (const cleanup of sessionResourceCleanups) {
		try {
			cleanup(sessionId);
		} catch (error) {
			errors.push(error);
		}
	}
	if (errors.length > 0) {
		throw new AggregateError(errors, "Failed to cleanup session resources");
	}
}
