/**
 * 文件职责：验证 contentText 从助手和工具结果内容中只提取文本块并按指定分隔符连接。
 * 技术维度：使用 Vitest、联合消息类型和纯文本转换函数进行无网络单元测试。
 * 产品维度：保证日志、导出和上下文处理能忽略思考、工具调用与图片，只得到用户可读文本。
 * 逻辑维度：准备混合助手内容，测试默认与自定义分隔符、字符串直通和工具结果提取。
 * 关键边界：非文本块会被忽略；测试不验证富媒体转文字或工具参数序列化。
 * 新手阅读建议：先观察 content 中四种块，再逐项比较每个测试的输入与期望字符串。
 */
import { describe, expect, it } from "vitest";
import { type AssistantMessage, contentText, type ToolResultMessage } from "../src/index.ts";

/** 混合助手内容夹具；包含思考、两个文本块和工具调用，用来验证过滤规则。 */
const content: AssistantMessage["content"] = [
	{ type: "thinking", thinking: "reasoning" },
	{ type: "text", text: "first" },
	{ type: "toolCall", id: "1", name: "read", arguments: {} },
	{ type: "text", text: "second" },
];

/** contentText 文本提取测试组。 */
describe("contentText", () => {
	/** 验证助手内容只保留两个文本块，并用默认换行连接。 */
	it("extracts assistant text blocks", () => {
		expect(contentText(content)).toBe("first\nsecond");
	});

	/** 验证空分隔符会直接拼接文本块。 */
	it("supports custom separators", () => {
		expect(contentText(content, "")).toBe("firstsecond");
	});

	/** 验证输入已经是字符串时原样返回。 */
	it("passes string content through", () => {
		expect(contentText("hello")).toBe("hello");
	});

	/** 验证工具结果中的图片块被忽略，文本仍按自定义分隔符提取。 */
	it("extracts text from tool-result content", () => {
		/** 工具结果内容夹具；中间图片用于证明非文本块不会进入输出。 */
		const toolResultContent: ToolResultMessage["content"] = [
			{ type: "text", text: "first" },
			{ type: "image", data: "...", mimeType: "image/png" },
			{ type: "text", text: "second" },
		];

		expect(contentText(toolResultContent, "")).toBe("firstsecond");
	});
});
