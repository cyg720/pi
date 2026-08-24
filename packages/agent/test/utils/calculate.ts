/**
 * 文件职责：提供 Agent 测试使用的计算器工具、参数 Schema 和可附加 Usage 的变体。
 * 技术维度：使用 TypeBox 描述参数，AgentTool 泛型约束结果，并通过 Function 执行表达式。
 * 产品维度：作为简单工具夹具演示代理如何调用参数化工具并接收文本结果与用量信息。
 * 逻辑维度：calculate 求值并格式化；Schema 定义输入；calculateTool 暴露工具；工厂包装 Usage。
 * 关键边界：Function 会执行任意 JavaScript，只能用于受控测试表达式，绝不能直接处理不可信输入。
 * 新手阅读建议：先看 calculateSchema 与 CalculateParams，再沿 execute 到 calculate 理解工具调用链。
 */
import type { Usage } from "@earendil-works/pi-ai";
import { type Static, Type } from "typebox";
import type { AgentTool, AgentToolResult } from "../../src/types.ts";

/** 计算器工具结果；始终只有文本内容，details 明确为 undefined。 */
export interface CalculateResult extends AgentToolResult<undefined> {
	/** 计算结果文本块数组，当前实现固定为一个文本块。 */
	content: Array<{ type: "text"; text: string }>;
	/** 本测试工具没有结构化详情。 */
	details: undefined;
}

/**
 * 执行一个受控数学表达式并格式化结果。
 * @param expression JavaScript 表达式文本；仅允许测试代码提供的可信内容。
 * @returns 含“表达式 = 结果”文本的 CalculateResult。
 * @throws 表达式语法错误或执行异常时抛出标准 Error。
 * @example `calculate("1 + 2")` 返回文本 `1 + 2 = 3`。
 */
export function calculate(expression: string): CalculateResult {
	try {
		/** 动态表达式的求值结果；类型取决于传入表达式，仅用于字符串化展示。 */
		const result = new Function(`return ${expression}`)();
		return { content: [{ type: "text", text: `${expression} = ${result}` }], details: undefined };
	} catch (e: any) {
		// e 是动态求值捕获的异常；旧测试夹具使用 any 读取 message，非 Error 时退回字符串转换。
		throw new Error(e.message || String(e));
	}
}

/** 计算器参数 Schema；要求 expression 为描述明确的字符串字段。 */
const calculateSchema = Type.Object({
	/** 待求值数学表达式的字符串规则。 */
	expression: Type.String({ description: "The mathematical expression to evaluate" }),
});

/** 从 TypeBox Schema 静态推导的执行参数类型，结构为 `{ expression: string }`。 */
type CalculateParams = Static<typeof calculateSchema>;

/** 可直接交给 Agent 的基础计算器工具定义。 */
export const calculateTool: AgentTool<typeof calculateSchema, undefined> = {
	/** 界面显示名称。 */
	label: "Calculator",
	/** 模型调用时使用的稳定工具名。 */
	name: "calculate",
	/** 告知模型工具用途的描述。 */
	description: "Evaluate mathematical expressions",
	/** 工具输入验证 Schema。 */
	parameters: calculateSchema,
	/** 执行入口；_toolCallId 本夹具不使用，args 已由 Schema 验证。 */
	execute: async (_toolCallId: string, args: CalculateParams) => {
		return calculate(args.expression);
	},
};

/**
 * 创建一个在计算结果中附带固定用量的工具。
 * @param usage 每次执行返回的模型 Usage 对象。
 * @returns 复用 calculateTool 元数据、但 execute 会附加 usage 的新工具对象。
 * @example `createCalculateToolWithUsage({ input: 1, output: 1, ... })`。
 */
export function createCalculateToolWithUsage(usage: Usage): AgentTool<typeof calculateSchema, undefined> {
	return {
		...calculateTool,
		/** _toolCallId 不参与计算；args.expression 是唯一输入，并在结果上合并固定 usage。 */
		execute: async (_toolCallId: string, args: CalculateParams) => ({ ...calculate(args.expression), usage }),
	};
}
