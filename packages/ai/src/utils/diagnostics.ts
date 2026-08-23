/**
 * 【文件职责】诊断记录工具：把运行期错误/异常规范化为可持久化的诊断条目，
 *              并支持追加到助手消息的 diagnostics 字段。
 * 【技术维度】错误信息提取（name/message/stack/code）；类型守卫。
 * 【产品维度】让失败与恢复过程对用户与调试器可见：诊断随消息流转，便于排查供应商故障。
 * 【逻辑维度】formatThrownValue 兜底字符串化 → extractDiagnosticError 结构化 →
 *              createAssistantMessageDiagnostic 组装 → append 追加到消息。
 * 【关键边界】诊断只记录摘要信息，不包含敏感载荷；code 仅保留 string/number 类型。
 * 【新手阅读建议】半分钟读完：记住诊断的四个函数用途即可。
 */

/** 错误信息快照（中文说明）：用于诊断的规范化错误字段。 */
export interface DiagnosticErrorInfo {
	// 错误名（可选）
	name?: string;
	// 错误消息
	message: string;
	// 堆栈（可选）
	stack?: string;
	// 错误码（可选，string 或 number）
	code?: string | number;
}

/** 助手消息诊断条目（中文说明）：type 类型；timestamp 时间戳；error 错误快照；details 附加数据。 */
export interface AssistantMessageDiagnostic {
	// 诊断类型
	type: string;
	// 时间戳（毫秒）
	timestamp: number;
	// 错误快照（可选）
	error?: DiagnosticErrorInfo;
	// 附加详情（可选）
	details?: Record<string, unknown>;
}

// 把任意值格式化为可读字符串（公开）：Error 取 message/name，其余 String() 化
export function formatThrownValue(value: unknown): string {
	if (value instanceof Error) return value.message || value.name;
	if (typeof value === "string") return value;
	return String(value);
}

// 提取规范化错误快照（公开）：非 Error 标记为 ThrownValue
export function extractDiagnosticError(error: unknown): DiagnosticErrorInfo {
	if (!(error instanceof Error)) return { name: "ThrownValue", message: formatThrownValue(error) };
	const code = (error as Error & { code?: unknown }).code;
	return {
		name: error.name || undefined,
		message: error.message || error.name,
		stack: error.stack,
		code: typeof code === "string" || typeof code === "number" ? code : undefined,
	};
}

// 创建诊断条目（公开）：组装类型/时间戳/错误/详情
export function createAssistantMessageDiagnostic(
	type: string,
	error: unknown,
	details?: Record<string, unknown>,
): AssistantMessageDiagnostic {
	return { type, timestamp: Date.now(), error: extractDiagnosticError(error), details };
}

// 追加诊断到消息（公开）：不可变地扩展 diagnostics 数组
export function appendAssistantMessageDiagnostic<T extends { diagnostics?: AssistantMessageDiagnostic[] }>(
	message: T,
	diagnostic: AssistantMessageDiagnostic,
): void {
	message.diagnostics = [...(message.diagnostics ?? []), diagnostic];
}
