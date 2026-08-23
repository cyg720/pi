/**
 * 【文件职责】PKCE（RFC 7636）工具：生成 code verifier 与其 SHA-256 challenge，
 *              供 OAuth 授权码流程使用。
 * 【技术维度】Web Crypto API（getRandomValues + subtle.digest）；base64url 编码。
 * 【产品维度】让 OAuth 登录（尤其公开客户端）满足 PKCE 安全要求，Node 20+ 与浏览器均可用。
 * 【逻辑维度】生成 32 字节随机 verifier → SHA-256 摘要 → base64url 编码为 challenge。
 * 【关键边界】依赖全局 crypto（Node 20+/浏览器）；编码去除 = 填充。
 * 【新手阅读建议】半分钟读完：理解 verifier 与 challenge 的关系即可。
 */

/**
 * PKCE utilities using Web Crypto API.
 * Works in both Node.js 20+ and browsers.
 */
// PKCE 工具（中文说明）：基于 Web Crypto API，Node 20+ 与浏览器均可用。

/**
 * Encode bytes as base64url string.
 */
// 字节 → base64url 字符串（私有）：替换 + / 并去除 = 填充
function base64urlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generate PKCE code verifier and challenge.
 * Uses Web Crypto API for cross-platform compatibility.
 */
// 生成 PKCE verifier 与 challenge（公开）：verifier 为随机串，challenge 为其 SHA-256 摘要
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
	// Generate random verifier
	// 生成随机 verifier（32 字节）
	const verifierBytes = new Uint8Array(32);
	crypto.getRandomValues(verifierBytes);
	const verifier = base64urlEncode(verifierBytes);

	// Compute SHA-256 challenge
	// 计算 SHA-256 challenge
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const challenge = base64urlEncode(new Uint8Array(hashBuffer));

	return { verifier, challenge };
}
