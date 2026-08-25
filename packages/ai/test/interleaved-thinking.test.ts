/**
 * 文件职责：端到端验证 Anthropic 与 Bedrock Claude 在两阶段工具调用中都会生成交错思考内容。
 * 技术维度：使用 Vitest 条件跳过、TypeBox 工具模式、真实模型凭据和 completeSimple 多轮调用。
 * 产品维度：确保复杂工具任务在获得工具结果后仍能继续推理，而不是只在第一次调用前思考。
 * 逻辑维度：构造计算器工具，完成首轮工具调用，注入含歧义结果，再断言第二轮含 thinking 和 text。
 * 关键边界：这是在线测试且可能产生费用；首轮必须恰有可解析工具调用，支持凭据缺失时跳过。
 * 新手阅读建议：先看 calculatorSchema/evaluate，再沿 assertSecondToolCallWithInterleavedThinking 阅读两轮消息。
 */
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { completeSimple, getModel } from "../src/compat.ts";
import { getEnvApiKey } from "../src/env-api-keys.ts";
import type { Api, Context, Model, StopReason, Tool, ToolCall, ToolResultMessage } from "../src/types.ts";
import { StringEnum } from "../src/utils/typebox-helpers.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";

// 计算器工具参数模式，限制两个数字和四种操作。
const calculatorSchema = Type.Object({
	a: Type.Number({ description: "First number" }),
	b: Type.Number({ description: "Second number" }),
	operation: StringEnum(["add", "subtract", "multiply", "divide"], {
		description: "The operation to perform.",
	}),
});

// 供模型调用的计算器工具描述，不在测试中直接实现 execute。
const calculatorTool: Tool<typeof calculatorSchema> = {
	name: "calculator",
	description: "Perform basic arithmetic operations",
	parameters: calculatorSchema,
};

// 计算器允许的操作字面量联合。
type CalculatorOperation = "add" | "subtract" | "multiply" | "divide";

// 解析成功后的计算器参数结构。
type CalculatorArguments = {
	a: number;
	b: number;
	operation: CalculatorOperation;
};

/** 功能：校验未知工具参数并收窄类型；参数 args；返回：CalculatorArguments。示例：asCalculatorArguments(toolCall.arguments)。 */
function asCalculatorArguments(args: ToolCall["arguments"]): CalculatorArguments {
	if (typeof args !== "object" || args === null) {
		throw new Error("Tool arguments must be an object");
	}

	// 参数对象的通用键值视图。
	const value = args as Record<string, unknown>;
	// 未收窄的 operation 字段。
	const operation = value.operation;
	if (
		typeof value.a !== "number" ||
		typeof value.b !== "number" ||
		(operation !== "add" && operation !== "subtract" && operation !== "multiply" && operation !== "divide")
	) {
		throw new Error("Invalid calculator arguments");
	}

	return { a: value.a, b: value.b, operation };
}

/** 功能：计算一条已校验工具调用；参数 toolCall；返回：数值结果。示例：evaluateCalculatorCall(call)。 */
function evaluateCalculatorCall(toolCall: ToolCall): number {
	const { a, b, operation } = asCalculatorArguments(toolCall.arguments);
	/** a、b 是已校验的数值操作数，operation 只允许加、减、乘、除四类运算。 */
	switch (operation) {
		case "add":
			return a + b;
		case "subtract":
			return a - b;
		case "multiply":
			return a * b;
		case "divide":
			return a / b;
	}
}

/** 功能：执行两轮在线工具对话并断言交错思考；参数 llm、reasoning；返回：完成 Promise。示例：await assertSecondToolCallWithInterleavedThinking(model, "high")。 */
async function assertSecondToolCallWithInterleavedThinking<TApi extends Api>(
	llm: Model<TApi>,
	reasoning: "high" | "xhigh",
) {
	// 包含强制工具使用规则和单个算术请求的对话上下文。
	const context: Context = {
		systemPrompt: [
			"You are a helpful assistant that must use tools for arithmetic.",
			"Always think before every tool call, not just the first one.",
			"Do not answer with plain text when a tool call is required.",
		].join(" "),
		messages: [
			{
				role: "user",
				content: [
					"Use calculator to calculate 328 * 29.",
					"You must call the calculator tool exactly once.",
					"Provide the final answer based on the best guess given the tool result, even if it seems unreliable.",
					"Start by thinking about the steps you will take to solve the problem.",
				].join(" "),
				timestamp: Date.now(),
			},
		],
		tools: [calculatorTool],
	};

	// 首轮模型响应，应包含 thinking 与 calculator toolCall。
	const firstResponse = await completeSimple(llm, context, { reasoning });

	expect(firstResponse.stopReason, `Error: ${firstResponse.errorMessage}`).toBe("toolUse" satisfies StopReason);
	expect(firstResponse.content.some((block) => block.type === "thinking")).toBe(true);
	expect(firstResponse.content.some((block) => block.type === "toolCall")).toBe(true);

	// 首轮内容中的计算器工具调用。
	const firstToolCall = firstResponse.content.find((block) => block.type === "toolCall");
	expect(firstToolCall?.type).toBe("toolCall");
	if (!firstToolCall || firstToolCall.type !== "toolCall") {
		throw new Error("Expected first response to include a tool call");
	}

	context.messages.push(firstResponse);

	// 本地计算出的正确答案。
	const correctAnswer = evaluateCalculatorCall(firstToolCall);
	// 故意同时给出正确值和两倍值的歧义工具结果，促使模型再次思考。
	const firstToolResult: ToolResultMessage = {
		role: "toolResult",
		toolCallId: firstToolCall.id,
		toolName: firstToolCall.name,
		content: [{ type: "text", text: `The answer is ${correctAnswer} or ${correctAnswer * 2}.` }],
		isError: false,
		timestamp: Date.now(),
	};
	context.messages.push(firstToolResult);

	// 收到工具结果后的第二轮响应，应包含新的 thinking 和最终文本。
	const secondResponse = await completeSimple(llm, context, { reasoning });

	expect(secondResponse.stopReason, `Error: ${secondResponse.errorMessage}`).toBe("stop" satisfies StopReason);
	expect(secondResponse.content.some((block) => block.type === "thinking")).toBe(true);
	expect(secondResponse.content.some((block) => block.type === "text")).toBe(true);
}

// Anthropic 环境凭据是否可用。
const hasAnthropicCredentials = !!getEnvApiKey("anthropic");

describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock interleaved thinking", () => {
	it("should do interleaved thinking on Claude Opus 4.5", { retry: 3 }, async () => {
		const llm = getModel("amazon-bedrock", "global.anthropic.claude-opus-4-5-20251101-v1:0");
		/** llm 是本用例选定的 Bedrock Opus 4.5 模型，用于验证高强度交错思考。 */
		await assertSecondToolCallWithInterleavedThinking(llm, "high");
	});

	it("should do interleaved thinking on Claude Opus 4.6", { retry: 3 }, async () => {
		const llm = getModel("amazon-bedrock", "global.anthropic.claude-opus-4-6-v1");
		/** llm 是本用例选定的 Bedrock Opus 4.6 模型，用于验证高强度交错思考。 */
		await assertSecondToolCallWithInterleavedThinking(llm, "high");
	});
});

describe.skipIf(!hasAnthropicCredentials)("Anthropic interleaved thinking", () => {
	it("should do interleaved thinking on Claude Opus 4.5", { retry: 3 }, async () => {
		const llm = getModel("anthropic", "claude-opus-4-5");
		/** llm 是 Anthropic 原生 Opus 4.5 模型，仅在凭据可用时执行在线契约。 */
		await assertSecondToolCallWithInterleavedThinking(llm, "high");
	});

	it("should do interleaved thinking on Claude Opus 4.6", { retry: 3 }, async () => {
		const llm = getModel("anthropic", "claude-opus-4-6");
		/** llm 是 Anthropic 原生 Opus 4.6 模型，仅在凭据可用时执行在线契约。 */
		await assertSecondToolCallWithInterleavedThinking(llm, "high");
	});
});
