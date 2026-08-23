/**
 * 【文件职责】Cloudflare 系列 API 的基础地址常量：Workers AI 直连端点与 AI Gateway
 *              的 OpenAI/Anthropic 兼容透传端点。
 * 【技术维度】纯常量定义；端点含 {CLOUDFLARE_ACCOUNT_ID} 等占位符供替换。
 * 【产品维度】供应商工厂据此构造请求地址，用户配置账号/网关 ID 后即可使用。
 * 【逻辑维度】四个常量按用途排列：直连 / compat 统一 API / OpenAI 透传 / Anthropic 透传。
 * 【关键边界】占位符需在运行时替换；OpenAI 透传为过渡方案（compat 支持 responses 后弃用）。
 * 【新手阅读建议】半分钟读完：记住四个端点的用途即可。
 */

/** Workers AI direct endpoint. */
// Workers AI 直连端点（中文说明）：账号 ID 占位符需替换
export const CLOUDFLARE_WORKERS_AI_BASE_URL =
	"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1";

/** AI Gateway Unified API. https://developers.cloudflare.com/ai-gateway/usage/unified-api/ */
// AI Gateway 统一 API 端点：/compat 路径
export const CLOUDFLARE_AI_GATEWAY_COMPAT_BASE_URL =
	"https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/compat";

/** AI Gateway → OpenAI passthrough. Used until /compat supports /v1/responses. */
// AI Gateway → OpenAI 透传端点：用于 /compat 尚未支持 /v1/responses 的过渡期
export const CLOUDFLARE_AI_GATEWAY_OPENAI_BASE_URL =
	"https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/openai";

/** AI Gateway → Anthropic passthrough. */
// AI Gateway → Anthropic 透传端点
export const CLOUDFLARE_AI_GATEWAY_ANTHROPIC_BASE_URL =
	"https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/anthropic";
