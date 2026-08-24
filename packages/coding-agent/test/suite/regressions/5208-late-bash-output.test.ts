/**
 * 文件职责：回归验证 Bash 操作完成后到达的延迟输出不会污染已返回的工具结果。
 * 技术维度：使用 Vitest、自定义 BashOperations、Buffer 与定时器模拟异步竞态。
 * 产品维度：避免用户看到命令结束后才混入的错误输出，保证一次工具调用的结果边界稳定。
 * 逻辑维度：提取文本辅助函数，模拟即时与延迟 onData，执行工具并等待定时器后断言只保留即时输出。
 * 关键边界：定时器等待 20 毫秒用于触发模拟回调；测试不启动真实 shell。
 * 新手阅读建议：先看 exec 中 before 与 late 的时间差，再理解 getTextOutput 如何读取最终内容块。
 */
import { describe, expect, it } from "vitest";
import { type BashOperations, createBashTool } from "../../../src/core/tools/bash.ts";

/**
 * 合并工具结果中的所有文本内容块。
 * @param result 可能缺少 content 的工具结果；非文本块和缺失 text 会被安全忽略。
 * @returns 以换行连接的文本，完全没有文本时返回空字符串。
 * @example `getTextOutput({ content: [{ type: "text", text: "ok" }] })` 返回 `ok`。
 */
function getTextOutput(result: { content?: Array<{ type: string; text?: string }> }): string {
	return (
		result.content
			// block 是当前内容块；这里只保留 type 明确为 text 的块。
			?.filter((block) => block.type === "text")
			// block.text 缺失时以空字符串代替，避免结果中出现 undefined。
			.map((block) => block.text ?? "")
			.join("\n") ?? ""
	);
}

/** 第 5208 号问题的延迟 Bash 输出回归测试组。 */
describe("regression #5208: late bash output callbacks", () => {
	/** 验证操作 resolve 后触发的 onData 不再写入工具结果。 */
	it("ignores output callbacks after bash operations resolve", async () => {
		/** 模拟 Bash 操作；先同步发送 before，再安排 late 回调，然后立即报告成功退出。 */
		const operations: BashOperations = {
			/** _command 与 _cwd 本例不使用；onData 是待验证生命周期的输出回调。 */
			exec: async (_command, _cwd, { onData }) => {
				onData(Buffer.from("before\n", "utf-8"));
				setTimeout(() => onData(Buffer.from("late\n", "utf-8")), 0);
				return { exitCode: 0 };
			},
		};
		/** 使用模拟 operations 创建的 Bash 工具；工作目录仅满足构造参数要求。 */
		const bash = createBashTool(process.cwd(), { operations });

		/** 工具完成时冻结的结果；延迟回调不应在之后改变它。 */
		const result = await bash.execute("test-call-late-output", { command: "late-output" });
		// resolve 是等待 Promise 的完成函数；20 毫秒确保零延迟定时回调已经有机会执行。
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(getTextOutput(result).trim()).toBe("before");
	});
});
