/**
 * 文件职责：提供 Agent 测试使用的当前时间工具及 TypeBox 参数定义。
 * 技术维度：使用 Intl 日期格式化、可选 IANA 时区、Schema 和 AgentTool 泛型。
 * 产品维度：演示工具如何同时返回用户可读时间与程序可用的 UTC 时间戳。
 * 逻辑维度：创建当前 Date；有时区则尝试按时区格式化，否则使用本地格式。
 * 关键边界：无效时区会抛错；时间戳单位为毫秒，显示文本受运行环境影响。
 * 新手阅读建议：先看 getCurrentTime 两个分支，再从 Schema 到 execute 阅读封装。
 */
import { type Static, Type } from "typebox";
import type { AgentTool, AgentToolResult } from "../../src/types.ts";

/** 当前时间工具结果；details 固定包含 UTC 毫秒时间戳。 */
export interface GetCurrentTimeResult extends AgentToolResult<{ utcTimestamp: number }> {}

/**
 * 获取并格式化当前时间。
 * @param timezone 可选 IANA 时区名；省略时使用本地时区。
 * @returns 文本时间和 utcTimestamp 的异步结果。
 * @throws 时区无效时抛出含当前 UTC 时间的错误。
 * @example `await getCurrentTime("Europe/London")`。
 */
export async function getCurrentTime(timezone?: string): Promise<GetCurrentTimeResult> {
	/** 调用瞬间的日期对象，确保文本与时间戳一致。 */
	const date = new Date();
	if (timezone) {
		try {
			/** 按指定时区格式化的完整日期时间。 */
			const timeStr = date.toLocaleString("en-US", {
				timeZone: timezone,
				dateStyle: "full",
				timeStyle: "long",
			});
			return {
				content: [{ type: "text", text: timeStr }],
				details: { utcTimestamp: date.getTime() },
			};
		} catch (_e) {
			// _e 是 Intl 时区校验异常，这里替换为更易懂的错误。
			throw new Error(`Invalid timezone: ${timezone}. Current UTC time: ${date.toISOString()}`);
		}
	}
	/** 未指定时区时按本地时区格式化的完整日期时间。 */
	const timeStr = date.toLocaleString("en-US", { dateStyle: "full", timeStyle: "long" });
	return {
		content: [{ type: "text", text: timeStr }],
		details: { utcTimestamp: date.getTime() },
	};
}

/** 输入 Schema；timezone 可省略，提供时必须为字符串。 */
const getCurrentTimeSchema = Type.Object({
	/** 可选 IANA 时区字段。 */
	timezone: Type.Optional(
		Type.String({ description: "Optional timezone (e.g., 'America/New_York', 'Europe/London')" }),
	),
});

/** 从 Schema 推导的 `{ timezone?: string }` 参数类型。 */
type GetCurrentTimeParams = Static<typeof getCurrentTimeSchema>;

/** 可交给 Agent 调用的当前时间工具。 */
export const getCurrentTimeTool: AgentTool<typeof getCurrentTimeSchema, { utcTimestamp: number }> = {
	/** UI 显示名称。 */
	label: "Current Time",
	/** 模型调用名称。 */
	name: "get_current_time",
	/** 面向模型的功能说明。 */
	description: "Get the current date and time",
	/** 输入验证 Schema。 */
	parameters: getCurrentTimeSchema,
	/** _toolCallId 不参与逻辑，args.timezone 交给核心函数。 */
	execute: async (_toolCallId: string, args: GetCurrentTimeParams) => {
		return getCurrentTime(args.timezone);
	},
};
