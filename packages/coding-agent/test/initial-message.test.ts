/**
 * 文件职责：验证标准输入、文件文本与首个 CLI 消息组合成初始提示的规则。
 * 技术维度：使用 Vitest 和最小 Args 构造函数测试纯消息组装逻辑。
 * 产品维度：支持管道与文件内容合并，同时保留后续排队消息。
 * 逻辑维度：辅助函数创建参数，三个用例覆盖 stdin+消息、仅 stdin、三来源组合。
 * 关键边界：首个 CLI 消息会被消费，其余消息保留；换行由输入结尾决定。
 * 新手阅读建议：先看 createArgs，再比较每例 parsed.messages 前后的变化。
 */
import { describe, expect, test } from "vitest";
import type { Args } from "../src/cli/args.ts";
import { buildInitialMessage } from "../src/cli/initial-message.ts";

/**
 * 创建最小 Args。
 * @param messages CLI 消息数组，默认空数组；函数会复制。
 * @returns 可传给 buildInitialMessage 的参数对象。
 * @example `createArgs(["hello"])`。
 */
function createArgs(messages: string[] = []): Args {
	return {
		messages: [...messages],
		fileArgs: [],
		unknownFlags: new Map(),
		diagnostics: [],
	};
}

/** 初始消息合并测试组。 */
describe("buildInitialMessage", () => {
	/** 验证 stdin 与首条 CLI 消息合并且队列清空。 */
	test("merges piped stdin with the first CLI message into one prompt", () => {
		/** 含一条 CLI 消息的参数。 */
		const parsed = createArgs(["Summarize the text given"]);
		/** 合并 stdin 后的结果。 */
		const result = buildInitialMessage({
			parsed,
			stdinContent: "README contents\n",
		});

		expect(result.initialMessage).toBe("README contents\nSummarize the text given");
		expect(parsed.messages).toEqual([]);
	});

	/** 验证没有 CLI 消息时直接采用 stdin。 */
	test("uses stdin as the initial prompt when no CLI message is present", () => {
		/** 无消息参数。 */
		const parsed = createArgs();
		/** 仅 stdin 的结果。 */
		const result = buildInitialMessage({
			parsed,
			stdinContent: "README contents",
		});

		expect(result.initialMessage).toBe("README contents");
		expect(parsed.messages).toEqual([]);
	});

	/** 验证 stdin、文件、首条消息依次合并，第二条消息保留。 */
	test("combines stdin, file text, and first CLI message in one prompt", () => {
		/** 含首条提示和后续消息的参数。 */
		const parsed = createArgs(["Explain it", "Second message"]);
		/** 三种文本来源合并后的结果。 */
		const result = buildInitialMessage({
			parsed,
			stdinContent: "stdin\n",
			fileText: "file\n",
		});

		expect(result.initialMessage).toBe("stdin\nfile\nExplain it");
		expect(parsed.messages).toEqual(["Second message"]);
	});
});
