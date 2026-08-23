// Shared normalization for provider HTTP error objects.
//
// Endpoints behind a proxy / gateway may return a non-2xx response whose body
// the provider SDK cannot fold into `error.message`. The SDK error object still
// carries the HTTP status and the raw/parsed body, but under SDK-specific field
// names. Provider catch blocks that read only `error.message` therefore drop
// the body and surface opaque messages like `"403 status code (no body)"` or
// collapse to `"Unknown: UnknownError"`.
//
// `normalizeProviderError` probes the known SDK field shapes (Mistral,
// `openai`, `@google/genai`, AWS Bedrock) and returns a struct each provider
// composes into its display string. The `messageCarriesBody` flag captures the
// Anthropic / `@google/genai` happy path where the SDK already folded the body
// into the message, so providers can preserve it without double-printing.
/**
 * 【文件职责】供应商 HTTP 错误的统一归一化：探测各 SDK 错误对象中状态码与响应体的
 *              不同字段形态，组合出可读的错误展示字符串。
 * 【技术维度】鸭子类型探测多种 SDK 字段（Mistral 的 statusCode、openai 的 status/error、
 *              Bedrock 的 $metadata/$response）；安全 JSON 序列化；文本截断。
 * 【产品维度】让代理/网关后的非 2xx 错误不再显示为 "403 (no body)" 这类无信息文案，
 *              而是保留真实响应体，便于用户与上层策略定位问题。
 * 【逻辑维度】normalizeProviderError 归一化 → extractStatus/extractBody 探测 →
 *              formatProviderError 组装展示串。
 * 【关键边界】响应体截断到 4000 字符；流式响应体不序列化；message 已含 body 时不再重复展示。
 * 【新手阅读建议】先读 NormalizedProviderError 三个关键字段 → 再看 extractStatus 的探测顺序 →
 *              最后看 formatProviderError 的四种组装路径。
 */

// 响应体最大保留字符数
export const MAX_PROVIDER_ERROR_BODY_CHARS = 4000;

/** 归一化后的供应商错误（中文说明）：status 状态码；body 响应体原因（截断）；
 * message SDK 自带消息；messageCarriesBody 表示 message 已含 body。 */
export interface NormalizedProviderError {
	/** HTTP status code, when one could be extracted from the SDK error object. */
	// HTTP 状态码（能从 SDK 错误对象提取时）
	status?: number;
	/** Raw HTTP body reason, already trimmed and truncated to the cap. */
	// 原始响应体原因（已裁剪并截断）
	body?: string;
	/** `error.message`, or `safeJsonStringify(error)` for a non-`Error` throw. */
	// error.message；非 Error 抛出的值则安全序列化
	message: string;
	/** True when `message` already contains the body (no separate body to add). */
	// message 已包含 body 时为 true（避免重复展示）
	messageCarriesBody: boolean;
}

// 各 SDK 错误字段形态（鸭子类型探测）
type SdkErrorShape = Error & {
	statusCode?: unknown;
	status?: unknown;
	body?: unknown;
	error?: unknown;
	$metadata?: { httpStatusCode?: unknown };
	$response?: { statusCode?: unknown; body?: unknown };
};

// 归一化任意错误（公开）：非 Error 直接序列化；Error 则提取状态/响应体/消息
export function normalizeProviderError(error: unknown): NormalizedProviderError {
	if (!(error instanceof Error)) {
		return { message: safeJsonStringify(error), messageCarriesBody: false };
	}

	const sdkError = error as SdkErrorShape;
	const status = extractStatus(sdkError);
	const body = extractBody(sdkError);
	const messageCarriesBody = body === undefined || error.message.includes(body);

	return {
		status,
		body,
		message: error.message,
		messageCarriesBody,
	} satisfies NormalizedProviderError;
}

/**
 * Probe the HTTP status, first numeric hit wins, in SDK-field order:
 * `statusCode` (Mistral) → `status` (`openai`, `@google/genai`) →
 * `$metadata.httpStatusCode` (Bedrock) → `$response.statusCode` (Bedrock).
 * 探测 HTTP 状态码（私有）：按 SDK 字段顺序取首个数值命中——
 * statusCode（Mistral）→ status（openai/@google/genai）→ $metadata.httpStatusCode（Bedrock）→
 * $response.statusCode（Bedrock）。
 */
function extractStatus(error: SdkErrorShape): number | undefined {
	if (typeof error.statusCode === "number") return error.statusCode;
	if (typeof error.status === "number") return error.status;
	if (typeof error.$metadata?.httpStatusCode === "number") return error.$metadata.httpStatusCode;
	if (typeof error.$response?.statusCode === "number") return error.$response.statusCode;
	return undefined;
}

/**
 * Probe the raw body reason, first usable hit wins, in SDK-field order:
 * `body` string (Mistral) → `error` parsed JSON body object (`openai` SDK's
 * `this.error`) → `$response.body` (Bedrock). Empty objects and unread response
 * streams are treated as no body so they do not surface as `"{}"` or serialized
 * stream internals. The chosen body is truncated to the cap.
 * 探测原始响应体（私有）：按 SDK 字段顺序取首个可用文本——
 * body 字符串（Mistral）→ error 解析对象（openai SDK）→ $response.body（Bedrock）；
 * 空对象与未读响应流视为无响应体；结果截断到上限。
 */
function extractBody(error: SdkErrorShape): string | undefined {
	const bodyText = pickBodyText(error);
	if (bodyText === undefined) return undefined;
	const trimmed = bodyText.trim();
	if (trimmed.length === 0) return undefined;
	return truncateErrorText(trimmed, MAX_PROVIDER_ERROR_BODY_CHARS);
}

// 选取响应体文本（私有）：按字段形态依次尝试
function pickBodyText(error: SdkErrorShape): string | undefined {
	if (typeof error.body === "string") return error.body;
	if (isNonEmptyObject(error.error)) return safeJsonStringify(error.error);
	const responseBody = error.$response?.body;
	if (typeof responseBody === "string") return responseBody;
	if (isReadableStreamLike(responseBody)) return undefined;
	if (isNonEmptyObject(responseBody)) return safeJsonStringify(responseBody);
	return undefined;
}

// 是否未读取的响应流（私有）：pipe 函数存在视为流，不序列化
function isReadableStreamLike(value: unknown): boolean {
	return typeof value === "object" && value !== null && "pipe" in value && typeof value.pipe === "function";
}

// 是否非空对象（私有）
function isNonEmptyObject(value: unknown): boolean {
	return typeof value === "object" && value !== null && Object.keys(value).length > 0;
}

/**
 * Compose a display string from a normalized error. When the message already
 * carries the body (Anthropic / `@google/genai` happy path) or no body/status
 * was extracted, the message is returned unchanged. Otherwise the status and
 * body are surfaced, with an optional provider prefix.
 *
 * - no prefix: `"<status>: <body>"`
 * - prefix:    `"<prefix> (<status>): <body>"`
 * 组装错误展示字符串（公开）：message 已含 body 或未提取到状态/响应体时原样返回消息；
 * 否则按"无前缀：状态: 响应体 / 有前缀：前缀 (状态): 响应体"格式输出。
 */
export function formatProviderError(norm: NormalizedProviderError, prefix?: string): string {
	if (norm.messageCarriesBody || norm.status === undefined || norm.body === undefined) {
		return prefix !== undefined && norm.status !== undefined
			? `${prefix} (${norm.status}): ${norm.message}`
			: norm.message;
	}
	return prefix !== undefined ? `${prefix} (${norm.status}): ${norm.body}` : `${norm.status}: ${norm.body}`;
}

// 截断错误文本到上限并附加说明（公开）
export function truncateErrorText(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}... [truncated ${text.length - maxChars} chars]`;
}

// 安全 JSON 序列化（公开）：循环引用等失败时回退 String()
export function safeJsonStringify(value: unknown): string {
	try {
		const serialized = JSON.stringify(value);
		return serialized === undefined ? String(value) : serialized;
	} catch {
		return String(value);
	}
}
