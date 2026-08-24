/**
 * 文件职责：验证 trigger-compact 示例扩展只在上下文使用量跨过阈值时触发压缩。
 * 技术维度：使用 Vitest、最小 ExtensionContext/API 替身和模拟 compact 函数。
 * 产品维度：防止上下文接近上限时丢失空间，同时避免同一区间反复压缩。
 * 逻辑维度：捕获 turn_end 处理器，依次传入 110k、120k、95k、105k token 并检查调用。
 * 关键边界：contextWindow 固定 200k；测试针对示例扩展的阈值状态机，不运行真实会话。
 * 新手阅读建议：先看 createContext 返回的 usage，再按四次处理器调用理解跨阈值条件。
 */
import { describe, expect, test, vi } from "vitest";
import triggerCompactExtension from "../examples/extensions/trigger-compact.ts";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "../src/core/extensions/index.ts";

/**
 * 创建最小扩展上下文。
 * @param tokens 当前上下文 token，null 表示未知。
 * @param compact 压缩回调，默认是新的模拟函数。
 * @returns 满足测试所需字段的 ExtensionContext。
 * @example `createContext(100_000, vi.fn())`。
 */
function createContext(tokens: number | null, compact = vi.fn()): ExtensionContext {
	return {
		mode: "print",
		hasUI: false,
		ui: {} as ExtensionContext["ui"],
		cwd: process.cwd(),
		sessionManager: {} as ExtensionContext["sessionManager"],
		modelRegistry: {} as ExtensionContext["modelRegistry"],
		model: undefined,
		isIdle: () => true,
		isProjectTrusted: () => true,
		signal: undefined,
		abort: vi.fn(),
		hasPendingMessages: () => false,
		shutdown: vi.fn(),
		getContextUsage: () => ({ tokens, contextWindow: 200_000, percent: tokens === null ? null : tokens / 2000 }),
		compact,
		getSystemPrompt: () => "",
	};
}

/** trigger-compact 示例扩展测试组。 */
describe("trigger-compact example extension", () => {
	/** 验证只有从阈值上方向下回到触发区间时调用一次 compact。 */
	test("only auto-compacts when context usage crosses the threshold", () => {
		/** 扩展注册后捕获的 turn_end 处理器。 */
		let turnEndHandler:
			| ((event: { type: "turn_end" }, ctx: ExtensionContext | ExtensionCommandContext) => void)
			| undefined;

		/** 仅实现 on 与 registerCommand 的扩展 API 替身。 */
		const api = {
			/** event 是事件名，handler 是扩展注册的处理器。 */
			on: (event: string, handler: (event: { type: "turn_end" }, ctx: ExtensionContext) => void) => {
				if (event === "turn_end") {
					turnEndHandler = handler;
				}
			},
			registerCommand: vi.fn(),
		} as unknown as ExtensionAPI;

		triggerCompactExtension(api);
		expect(turnEndHandler).toBeDefined();

		/** 记录压缩触发次数的模拟函数。 */
		const compact = vi.fn();
		/** 传给处理器的固定 turn_end 事件。 */
		const event = { type: "turn_end" } as const;

		turnEndHandler?.(event, createContext(110_000, compact));
		expect(compact).not.toHaveBeenCalled();

		turnEndHandler?.(event, createContext(120_000, compact));
		expect(compact).not.toHaveBeenCalled();

		turnEndHandler?.(event, createContext(95_000, compact));
		expect(compact).not.toHaveBeenCalled();

		turnEndHandler?.(event, createContext(105_000, compact));
		expect(compact).toHaveBeenCalledTimes(1);
	});
});
