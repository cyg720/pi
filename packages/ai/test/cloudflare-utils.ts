/**
 * 文件职责：提供 Cloudflare AI 相关测试的凭据可用性判断函数。
 * 技术维度：读取 Node.js process.env，并用布尔转换判断必要环境变量是否同时存在。
 * 产品维度：让依赖真实 Cloudflare 账户的测试在无凭据环境中安全跳过。
 * 逻辑维度：分别检查 Workers AI 和 AI Gateway 所需的环境变量组合。
 * 关键边界：只判断字符串是否非空，不验证密钥真伪、权限或远端服务可达性。
 * 新手阅读建议：先对比两个函数所需变量的差异，再查看测试如何用返回值控制跳过条件。
 */
/**
 * 判断 Cloudflare Workers AI 的基础凭据是否齐全。
 * @returns API 密钥与账户 ID 均为非空字符串时返回 true，否则返回 false。
 * @example `const canRun = hasCloudflareWorkersAICredentials();`
 */
export function hasCloudflareWorkersAICredentials(): boolean {
	return !!process.env.CLOUDFLARE_API_KEY && !!process.env.CLOUDFLARE_ACCOUNT_ID;
}

/**
 * 判断 Cloudflare AI Gateway 的测试凭据是否齐全。
 * @returns API 密钥、账户 ID 和网关 ID 都存在时返回 true，否则返回 false。
 * @example `const enabled = hasCloudflareAiGatewayCredentials();`
 */
export function hasCloudflareAiGatewayCredentials(): boolean {
	return (
		!!process.env.CLOUDFLARE_API_KEY && !!process.env.CLOUDFLARE_ACCOUNT_ID && !!process.env.CLOUDFLARE_GATEWAY_ID
	);
}
