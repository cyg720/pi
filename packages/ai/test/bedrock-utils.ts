/**
 * 文件职责：提供 Amazon Bedrock 在线测试所需的 AWS 凭据存在性判断。
 * 技术维度：读取 Node.js 环境变量，支持命名配置、IAM 密钥对和 Bedrock Bearer Token 三种方式。
 * 产品维度：让 Bedrock 测试只在具备凭据时运行，避免普通开发环境产生无意义失败。
 * 逻辑维度：按“配置文件，或密钥对，或专用令牌”的条件组合返回布尔结果。
 * 关键边界：只判断变量非空，不校验凭据有效性、区域设置、权限或网络连通性。
 * 新手阅读建议：把返回表达式拆成三个 OR 分支，重点注意 IAM 方式要求两个变量同时存在。
 */
/**
 * Utility functions for Amazon Bedrock tests
 */
/** Amazon Bedrock 测试工具函数集合。 */

/**
 * Check if any valid AWS credentials are configured for Bedrock.
 * Returns true if any of the following are set:
 * - AWS_PROFILE (named profile from ~/.aws/credentials)
 * - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (IAM keys)
 * - AWS_BEARER_TOKEN_BEDROCK (Bedrock API key)
 */
/**
 * 检查环境中是否配置了任一种 Bedrock 凭据形式。
 * @returns 发现命名配置、完整 IAM 密钥对或 Bedrock 令牌时返回 true，否则返回 false。
 * @example `const canRun = hasBedrockCredentials();`
 */
export function hasBedrockCredentials(): boolean {
	return !!(
		process.env.AWS_PROFILE ||
		(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
		process.env.AWS_BEARER_TOKEN_BEDROCK
	);
}
