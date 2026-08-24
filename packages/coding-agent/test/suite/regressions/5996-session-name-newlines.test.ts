/**
 * 文件职责：回归验证直接调用和扩展 API 设置的会话名称都会过滤 CR/LF 换行符。
 * 技术维度：使用 Vitest、编码代理 Harness、扩展工厂和会话事件断言。
 * 产品维度：防止多行会话名称破坏列表、标题栏或持久化展示布局。
 * 逻辑维度：统一管理 Harness，分别从 AgentSession 与 ExtensionAPI 写入换行名称并检查规范化结果。
 * 关键边界：测试期望换行折叠为空格；不覆盖其他控制字符或超长名称处理。
 * 新手阅读建议：对比两个用例唯一的调用入口，再看相同的存储值和事件值断言。
 */
import { afterEach, describe, expect, it } from "vitest";
import type { ExtensionAPI } from "../../../src/index.ts";
import { createHarness, type Harness } from "../harness.ts";

/** 第 5996 号问题的会话名称换行过滤回归测试组。 */
describe("regression #5996: session names do not contain newlines", () => {
	/** 测试组内创建的 Harness 集合，用于 afterEach 统一清理。 */
	const harnesses: Harness[] = [];

	/** 每例结束后清理全部 Harness 资源。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/** 验证 AgentSession 直接设置的 LF 与 CRLF 都折叠为单个空格。 */
	it("filters newlines when AgentSession.setSessionName is called", async () => {
		/** 当前用例的测试 Harness。 */
		const harness = await createHarness();
		harnesses.push(harness);

		harness.session.setSessionName("hello\nworld\r\nagain");

		expect(harness.sessionManager.getSessionName()).toBe("hello world again");
		// event 是会话信息变化事件；这里只提取规范化后的名称。
		expect(harness.eventsOfType("session_info_changed").map((event) => event.name)).toEqual(["hello world again"]);
	});

	/** 验证扩展通过 pi.setSessionName 写入的换行同样被过滤。 */
	it("filters newlines when an extension calls pi.setSessionName", async () => {
		/** 扩展工厂回调中捕获的 API；Harness 初始化前为 undefined。 */
		let api: ExtensionAPI | undefined;
		/** 注册捕获扩展 API 的测试 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				// pi 是当前 Harness 的 ExtensionAPI 实例，保存后供用例调用。
				(pi) => {
					api = pi;
				},
			],
		});
		harnesses.push(harness);

		api?.setSessionName("from\nextension");

		expect(harness.sessionManager.getSessionName()).toBe("from extension");
		// event 是会话信息变化事件；期望名称已经去除换行。
		expect(harness.eventsOfType("session_info_changed").map((event) => event.name)).toEqual(["from extension"]);
	});
});
