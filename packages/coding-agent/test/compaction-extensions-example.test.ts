/**
 * 文件职责：验证 extensions.md 中的自定义压缩扩展示例可编译且事件字段可用。
 * 技术维度：使用 Vitest、扩展事件类型和内联示例函数进行类型与运行时形状检查。
 * 产品维度：防止文档示例随扩展 API 演进而失效，帮助二次开发者直接复用。
 * 逻辑维度：第一例检查压缩前钩子字段和返回值，第二例检查压缩完成事件字段。
 * 关键边界：示例函数不会真正注册到运行中代理；主要证明类型和可调用性。
 * 新手阅读建议：先读英文说明，再把每个 event/ctx 字段对照扩展类型定义。
 */
/**
 * Verify the documentation example from extensions.md compiles and works.
 */
/** 验证 extensions.md 文档示例可以编译并保持预期行为。 */

import { describe, expect, it } from "vitest";
import type { ExtensionAPI, SessionBeforeCompactEvent, SessionCompactEvent } from "../src/core/extensions/index.ts";

/** 文档压缩扩展示例测试组。 */
describe("Documentation example", () => {
	/** 验证 session_before_compact 示例的字段与返回结构。 */
	it("custom compaction example should type-check correctly", () => {
		// This is the example from extensions.md - verify it compiles
		// 这是 extensions.md 中的示例，此处确认它仍可编译。
		/** 文档中的示例扩展函数。 */
		const exampleExtension = (pi: ExtensionAPI) => {
			/** event 是压缩准备事件，ctx 是扩展上下文。 */
			pi.on("session_before_compact", async (event: SessionBeforeCompactEvent, ctx) => {
				// All these should be accessible on the event
				// 以下 preparation 与 branchEntries 都必须能从事件访问。
				/** 压缩准备数据与当前分支条目。 */
				const { preparation, branchEntries } = event;
				// sessionManager, modelRegistry, and model come from ctx
				// sessionManager、modelRegistry 和 model 来自上下文。
				/** 示例需要的会话管理器和模型注册表。 */
				const { sessionManager, modelRegistry } = ctx;
				/** 压缩准备阶段的消息分组、token 和保留边界字段。 */
				const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, isSplitTurn } =
					preparation;

				// Verify types
				// 通过运行时断言验证字段类型。
				expect(Array.isArray(messagesToSummarize)).toBe(true);
				expect(Array.isArray(turnPrefixMessages)).toBe(true);
				expect(typeof isSplitTurn).toBe("boolean");
				expect(typeof tokensBefore).toBe("number");
				expect(typeof sessionManager.getEntries).toBe("function");
				expect(typeof modelRegistry.getApiKeyAndHeaders).toBe("function");
				expect(typeof firstKeptEntryId).toBe("string");
				expect(Array.isArray(branchEntries)).toBe(true);

				/** 从用户消息生成的示例摘要文本。 */
				const summary = messagesToSummarize
					// m 是一条待摘要消息，只保留用户消息。
					.filter((m) => m.role === "user")
					.map((m) => `- ${typeof m.content === "string" ? m.content.slice(0, 100) : "[complex]"}`)
					.join("\n");

				// Extensions return compaction content - SessionManager adds id/parentId
				// 扩展返回压缩内容，id 和 parentId 由 SessionManager 补充。
				return {
					compaction: {
						summary: `User requests:\n${summary}`,
						firstKeptEntryId,
						tokensBefore,
					},
				};
			});
		};

		// Just verify the function exists and is callable
		expect(typeof exampleExtension).toBe("function");
	});

	/** 验证 session_compact 事件包含压缩条目和来源标志。 */
	it("compact event should have correct fields", () => {
		/** 注册压缩完成监听器的示例函数。 */
		const checkCompactEvent = (pi: ExtensionAPI) => {
			/** event 是压缩完成事件。 */
			pi.on("session_compact", async (event: SessionCompactEvent) => {
				// These should all be accessible
				// 以下字段都必须能从事件访问。
				/** 新写入的压缩条目。 */
				const entry = event.compactionEntry;
				/** 摘要是否由扩展提供。 */
				const fromExtension = event.fromExtension;

				expect(entry.type).toBe("compaction");
				expect(typeof entry.summary).toBe("string");
				expect(typeof entry.tokensBefore).toBe("number");
				expect(typeof fromExtension).toBe("boolean");
			});
		};

		expect(typeof checkCompactEvent).toBe("function");
	});
});
