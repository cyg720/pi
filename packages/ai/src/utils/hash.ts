/**
 * 【文件职责】快速确定性哈希：把长字符串压缩为短哈希串，用于日志/缓存键等需要
 *              简洁稳定标识的场景。
 * 【技术维度】双 32 位 FNV 风格混合（Math.imul 防溢出）；二次雪崩混合后以 36 进制输出。
 * 【产品维度】为长提示词、配置等生成短摘要键，兼顾可读性与碰撞容忍度。
 * 【逻辑维度】两路哈希累加 → 混合 → 输出 36 进制串。
 * 【关键边界】非密码学哈希：不适用于安全场景；碰撞概率与字符串长度相关。
 * 【新手阅读建议】半分钟读完：记住它是"确定性、短、非加密"哈希即可。
 */

/** Fast deterministic hash to shorten long strings */
// 快速确定性哈希（中文说明）：返回两个 32 位哈希的 36 进制拼接，约 13 字符
export function shortHash(str: string): string {
	// 两个独立初始种子
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	// 雪崩混合：让微小输入差异扩散到全部位
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}
