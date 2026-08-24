/**
 * 文件职责：回归验证直接调用和扩展调用设置会话名称都会发出 session_info_changed。
 * 技术维度：使用 Vitest、编码代理 Harness、ExtensionAPI 捕获和事件日志。
 * 产品维度：确保标题栏、扩展和其他监听方能及时同步最新会话名称。
 * 逻辑维度：分别从 AgentSession、ExtensionAPI 设置名称，再验证扩展监听收到连续事件。
 * 关键边界：只验证名称字段和事件顺序；所有 Harness 必须在用例后清理。
 * 新手阅读建议：比较前两个入口用例，再看第三例如何在扩展内部监听同一事件。
 */
import { afterEach, describe, expect, it } from "vitest";
import type { ExtensionAPI } from "../../../src/index.ts";
import { createHarness, type Harness } from "../harness.ts";

/** 第 3686 号问题的会话名称事件测试组。 */
describe("regression #3686: session name changes emit an event", () => {
	/** 当前测试组创建的 Harness 集合。 */
	const harnesses: Harness[] = [];

	/** 每例后清理全部 Harness。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/** 验证 AgentSession.setSessionName 发出名称事件。 */
	it("emits session_info_changed when AgentSession.setSessionName is called", async () => {
		/** 当前用例的测试 Harness。 */
		const harness = await createHarness();
		harnesses.push(harness);

		harness.session.setSessionName("hello world");

		expect(harness.sessionManager.getSessionName()).toBe("hello world");
		// event 是名称变化事件，只提取 name 比较。
		expect(harness.eventsOfType("session_info_changed").map((event) => event.name)).toEqual(["hello world"]);
	});

	/** 验证扩展 API 设置名称同样发出事件。 */
	it("emits session_info_changed when an extension calls pi.setSessionName", async () => {
		/** 从扩展工厂捕获的 API。 */
		let api: ExtensionAPI | undefined;
		/** 捕获扩展 API 的 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				// pi 是当前 Harness 的扩展 API。
				(pi) => {
					api = pi;
				},
			],
		});
		harnesses.push(harness);

		api?.setSessionName("from extension");

		expect(harness.sessionManager.getSessionName()).toBe("from extension");
		// event 是名称变化事件，只提取 name 比较。
		expect(harness.eventsOfType("session_info_changed").map((event) => event.name)).toEqual(["from extension"]);
	});

	/** 验证扩展监听器按顺序收到扩展与会话直接设置的两个名称。 */
	it("emits session_info_changed to extensions", async () => {
		/** 从扩展工厂捕获的 API。 */
		let api: ExtensionAPI | undefined;
		/** 扩展监听器记录的名称事件。 */
		const events: Array<{ name: string | undefined }> = [];
		/** 同时捕获 API 并注册事件监听器的 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				// pi 是扩展 API，event 是一次会话信息变化事件。
				(pi) => {
					api = pi;
					pi.on("session_info_changed", (event) => {
						events.push({ name: event.name });
					});
				},
			],
		});
		harnesses.push(harness);

		api?.setSessionName("first");
		harness.session.setSessionName("second");

		expect(events).toEqual([{ name: "first" }, { name: "second" }]);
	});
});
