/**
 * 【文件职责】请求头转换工具：把 Fetch Headers 或 ProviderHeaders（允许 null 抑制值）
 *              转换为普通 Record 形式。
 * 【技术维度】纯函数；类型收窄（null 值过滤）。
 * 【产品维度】统一请求头在库内各层的表示形式，避免类型混乱。
 * 【逻辑维度】headersToRecord 逐项复制 → providerHeadersToRecord 过滤 null 值。
 * 【关键边界】providerHeadersToRecord 全为 null 时返回 undefined；空头对象同样返回 undefined。
 * 【新手阅读建议】半分钟读完即可。
 */
import type { ProviderHeaders } from "../types.ts";

// Fetch Headers → 普通 Record（公开）
export function headersToRecord(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of headers.entries()) {
		result[key] = value;
	}
	return result;
}

// ProviderHeaders（含 null 抑制值）→ 普通 Record（公开）：过滤掉 null 值；
// 无有效头时返回 undefined
export function providerHeadersToRecord(headers: ProviderHeaders | undefined): Record<string, string> | undefined {
	if (!headers) return undefined;
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		if (value !== null) result[key] = value;
	}
	return Object.keys(result).length > 0 ? result : undefined;
}
