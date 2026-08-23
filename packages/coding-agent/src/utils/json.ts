/** Strip `//` line comments and trailing commas from JSON, leaving string literals untouched. */
/**
 * 【文件职责】JSON 工具：宽松/容错解析与读取（支持注释/尾逗号/修复）。
 * 【产品维度】宽容用户手写的配置/数据。
 * 【新手阅读建议】看解析链。
 */
export function stripJsonComments(input: string): string {
	return input
		.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (m) => (m[0] === '"' ? m : ""))
		.replace(/"(?:\\.|[^"\\])*"|,(\s*[}\]])/g, (m, tail) => tail ?? (m[0] === '"' ? m : ""));
}
