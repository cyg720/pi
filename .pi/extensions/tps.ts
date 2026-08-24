/**
 * 文件职责：统计每次代理运行的吞吐、token、缓存读写和耗时并通知用户。
 * 技术维度：使用扩展事件 API、AssistantMessage 类型守卫、Usage 累加和毫秒计时。
 * 产品维度：帮助用户观察模型响应速度与缓存使用，诊断性能和上下文成本。
 * 逻辑维度：开始时记时，结束时汇总助手用量、计算 TPS 并通过 UI 通知。
 * 关键边界：只统计助手消息和有 UI 的运行；输出为零或耗时异常时不通知。
 * 新手阅读建议：先看两个事件如何共享 agentStartMs，再阅读累加与 TPS 公式。
 */
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * 判断未知消息是否为助手消息。
 * @param message 任意事件消息。
 * @returns 对象存在且 role 为 assistant 时返回 true。
 * @example `messages.filter(isAssistantMessage)`。
 */
function isAssistantMessage(message: unknown): message is AssistantMessage {
	if (!message || typeof message !== "object") return false;
	/** 从对象中读取的可选 role，比较前仍保持 unknown。 */
	const role = (message as { role?: unknown }).role;
	return role === "assistant";
}

/**
 * 注册 TPS 统计事件监听器。
 * @param pi 扩展宿主 API。
 * @returns 无返回值；通过事件监听产生通知。
 * @example `extension(pi)`。
 */
export default function (pi: ExtensionAPI) {
	/** 最近一次代理开始时间；无活跃统计时为 null。 */
	let agentStartMs: number | null = null;

	/** 记录代理开始时刻。 */
	pi.on("agent_start", () => {
		agentStartMs = Date.now();
	});

	/** 汇总 event.messages，并使用 ctx.ui 显示结果。 */
	pi.on("agent_end", (event, ctx) => {
		if (!ctx.hasUI) return;
		if (agentStartMs === null) return;

		/** 本次代理运行总毫秒数。 */
		const elapsedMs = Date.now() - agentStartMs;
		agentStartMs = null;
		if (elapsedMs <= 0) return;

		/** 累计输入 token。 */
		let input = 0;
		/** 累计输出 token。 */
		let output = 0;
		/** 累计缓存读取 token。 */
		let cacheRead = 0;
		/** 累计缓存写入 token。 */
		let cacheWrite = 0;
		/** 累计总 token。 */
		let totalTokens = 0;

		// message 是本次运行的一条消息，非助手消息不参与 usage 汇总。
		for (const message of event.messages) {
			if (!isAssistantMessage(message)) continue;
			input += message.usage.input || 0;
			output += message.usage.output || 0;
			cacheRead += message.usage.cacheRead || 0;
			cacheWrite += message.usage.cacheWrite || 0;
			totalTokens += message.usage.totalTokens || 0;
		}

		if (output <= 0) return;

		/** 总耗时秒数。 */
		const elapsedSeconds = elapsedMs / 1000;
		/** 平均输出吞吐，单位 token/秒。 */
		const tokensPerSecond = output / elapsedSeconds;
		/** 最终显示的性能摘要文本。 */
		const message = `TPS ${tokensPerSecond.toFixed(1)} tok/s. out ${output.toLocaleString()}, in ${input.toLocaleString()}, cache r/w ${cacheRead.toLocaleString()}/${cacheWrite.toLocaleString()}, total ${totalTokens.toLocaleString()}, ${elapsedSeconds.toFixed(1)}s`;
		ctx.ui.notify(message, "info");
	});
}
