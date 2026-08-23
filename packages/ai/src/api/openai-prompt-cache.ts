/**
 * 【文件职责】OpenAI prompt cache key 的钳制工具：限制缓存键长度（最多 64 个字符），
 *              防止超长键被供应商拒绝。
 * 【技术维度】字符级切片（Array.from 保证代理对不拆分）。
 * 【产品维度】让长会话生成的缓存键安全发送给 OpenAI 兼容端点。
 * 【逻辑维度】超长截断，否则原样返回。
 * 【关键边界】按码点而非 UTF-16 单元截断，避免拆坏 emoji 等增补平面字符。
 * 【新手阅读建议】半分钟读完即可。
 */

// OpenAI 提示缓存键的最大长度
export const OPENAI_PROMPT_CACHE_KEY_MAX_LENGTH = 64;

// 钳制缓存键（公开）：超长时按码点截断到上限；undefined 原样返回
export function clampOpenAIPromptCacheKey(key: string | undefined): string | undefined {
	if (key === undefined) return undefined;
	const chars = Array.from(key);
	if (chars.length <= OPENAI_PROMPT_CACHE_KEY_MAX_LENGTH) return key;
	return chars.slice(0, OPENAI_PROMPT_CACHE_KEY_MAX_LENGTH).join("");
}
