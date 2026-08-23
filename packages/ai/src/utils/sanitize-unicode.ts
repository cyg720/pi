/**
 * Removes unpaired Unicode surrogate characters from a string.
 *
 * Unpaired surrogates (high surrogates 0xD800-0xDBFF without matching low surrogates 0xDC00-0xDFFF,
 * or vice versa) cause JSON serialization errors in many API providers.
 *
 * Valid emoji and other characters outside the Basic Multilingual Plane use properly paired
 * surrogates and will NOT be affected by this function.
 *
 * @param text - The text to sanitize
 * @returns The sanitized text with unpaired surrogates removed
 *
 * @example
 * // Valid emoji (properly paired surrogates) are preserved
 * sanitizeSurrogates("Hello 🙈 World") // => "Hello 🙈 World"
 *
 * // Unpaired high surrogate is removed
 * const unpaired = String.fromCharCode(0xD83D); // high surrogate without low
 * sanitizeSurrogates(`Text ${unpaired} here`) // => "Text  here"
 */
/**
 * 【文件职责】Unicode 代理项清洗：移除字符串中未配对的代理项（孤立高/低代理），
 *              避免 JSON 序列化错误。
 * 【技术维度】前瞻/后顾断言正则匹配孤立代理并删除；合法 emoji 的成对代理不受影响。
 * 【产品维度】防止模型输出中的损坏代理导致供应商 API 请求失败——发送前统一清洗。
 * 【逻辑维度】一条正则同时覆盖两种孤立代理：高代理后无低代理 / 低代理前无高代理。
 * 【关键边界】仅删除孤立代理；成对代理（emoji 等 BMP 外字符）完整保留。
 * 【新手阅读建议】先读文件顶部英文 JSDoc 的例子理解行为，再看正则即可。
 */
export function sanitizeSurrogates(text: string): string {
	// 删除孤立高代理（0xD800-0xDBFF 后无低代理跟随）
	// Replace unpaired high surrogates (0xD800-0xDBFF not followed by low surrogate)
	// Replace unpaired low surrogates (0xDC00-0xDFFF not preceded by high surrogate)
	// 删除孤立低代理（0xDC00-0xDFFF 前无高代理）
	return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}
