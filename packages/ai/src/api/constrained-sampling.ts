import type { Tool } from "../types.ts";

/**
 * 【文件职责】受约束采样（constrained sampling）解析：为工具解析 JSON-schema 严格模式
 *              与语法（grammar）模式配置，并支持把流式工具输入的 JSON 增量安全写入。
 * 【技术维度】JSON Schema 结构推断（单必填字符串属性）；单调追加校验（防增量错乱）；
 *              按能力开关降级/报错。
 * 【产品维度】让模型按语法约束生成严格格式的参数（OpenAI Lark/regex 语法），
 *              提升工具调用的结构正确率。
 * 【逻辑维度】getGrammarToolInput 校验 → appendGrammarToolInputJsonDelta 增量组装 →
 *              inferGrammarInputProperty 推断 → resolveJsonSchemaStrictSampling /
 *              resolveGrammarConstrainedSampling 解析 → createGrammarToolInputProperties 建映射。
 * 【关键边界】严格模式在供应商不支持时：require 抛错、prefer 静默降级；
 *              语法增量必须单调追加且闭合后不可变；工具 schema 必须为单必填字符串属性。
 * 【新手阅读建议】先读两个 resolve 函数理解降级策略 → 再看增量追加的单调性约束。
 */
interface JsonSchemaObject {
	type?: unknown;
	properties?: Record<string, JsonSchemaObject | undefined>;
	required?: unknown;
}

/** 语法受约束采样配置（中文说明）：format lark 或 regex；definition 语法定义；inputProperty 输入属性名。 */
export interface GrammarConstrainedSampling {
	format: "lark" | "regex";
	// 语法格式：Lark 或正则
	definition: string;
	// 语法定义文本
	inputProperty: string;
	// 承载输入串的属性名（schema 中的单必填字符串属性）
}

/** 语法工具输入的流式缓冲（中文说明）：input 已接收内容；started/closed 生命周期标记。 */
export interface GrammarToolInputJsonBuffer {
	input: string;
	// 已累积的输入内容
	started: boolean;
	// 是否已开始（已写入首片段）
	closed: boolean;
	// 是否已闭合（收到最终片段）
}

// 从参数对象读取语法输入（公开）：必须是字符串，否则抛错
export function getGrammarToolInput(
	toolName: string,
	arguments_: Record<string, unknown>,
	inputProperty: string,
): string {
	const input = arguments_[inputProperty];
	if (typeof input !== "string") {
		throw new Error(`Grammar tool call "${toolName}" requires argument "${inputProperty}" to be a string.`);
	}
	return input;
}

// 追加语法输入的 JSON 增量（公开）：校验单调追加与闭合后不可变；
// 返回写入增量文本（含开/闭括号），无增量返回 undefined
export function appendGrammarToolInputJsonDelta(
	buffer: GrammarToolInputJsonBuffer,
	inputProperty: string,
	nextInput: string,
	close: boolean,
): string | undefined {
	if (buffer.closed) {
		if (close && nextInput === buffer.input) return undefined;
		throw new Error(`grammar tool input for property "${inputProperty}" changed after it was closed`);
	}
	if (!nextInput.startsWith(buffer.input)) {
		throw new Error(`grammar tool input for property "${inputProperty}" changed non-monotonically`);
	}

	const inputDelta = nextInput.slice(buffer.input.length);
	if (!close && inputDelta.length === 0) return undefined;

	let delta = "";
	if (!buffer.started) {
		delta += `{${JSON.stringify(inputProperty)}:"`;
		buffer.started = true;
	}
	delta += JSON.stringify(inputDelta).slice(1, -1);
	buffer.input = nextInput;

	if (close) {
		delta += '"}';
		buffer.closed = true;
	}
	return delta;
}

// 推断语法输入属性（私有）：schema 须为对象、恰好一个必填字符串属性且 properties 中存在
function inferGrammarInputProperty(tool: Tool): string {
	const schema = tool.parameters as JsonSchemaObject;
	if (schema.type !== "object") {
		throw new Error("grammar constrained sampling requires an object parameter schema");
	}
	if (!Array.isArray(schema.required) || schema.required.length !== 1 || typeof schema.required[0] !== "string") {
		throw new Error("grammar constrained sampling requires exactly one required string property");
	}

	const inputProperty = schema.required[0];
	if (!schema.properties?.[inputProperty]) {
		throw new Error(`grammar constrained sampling requires a properties entry for ${inputProperty}`);
	}
	if (schema.properties[inputProperty]?.type !== "string") {
		throw new Error(`grammar constrained sampling property ${inputProperty} must have type string`);
	}
	return inputProperty;
}

// 解析 JSON-schema 严格采样（公开）：支持时启用；不支持且 require 则抛错、prefer 则降级
export function resolveJsonSchemaStrictSampling(tool: Tool, supportsStrictMode: boolean): boolean | undefined {
	const config = tool.constrainedSampling;
	if (!config || config.type !== "json_schema") {
		return undefined;
	}

	if (supportsStrictMode) {
		return true;
	}
	if (config.strict === "require") {
		throw new Error(
			`Tool "${tool.name}" requires JSON-schema constrained sampling, but strict tools are unsupported.`,
		);
	}
	return undefined;
}

// 解析语法受约束采样（公开）：供应商不支持语法工具时返回 undefined；
// 无可用语法变体或 schema 不合规时抛错（带工具名上下文）
export function resolveGrammarConstrainedSampling(
	tool: Tool,
	supportsOpenAIGrammarTools: boolean,
): GrammarConstrainedSampling | undefined {
	const config = tool.constrainedSampling;
	if (!config || config.type !== "grammar") {
		return undefined;
	}

	if (!supportsOpenAIGrammarTools) {
		return undefined;
	}

	const larkDefinition = config.variants.openai_lark;
	const regexDefinition = config.variants.openai_regex;
	const hasLarkDefinition = typeof larkDefinition === "string" && larkDefinition.trim().length > 0;
	const hasRegexDefinition = typeof regexDefinition === "string" && regexDefinition.trim().length > 0;
	if (!hasLarkDefinition && !hasRegexDefinition) {
		throw new Error(
			`Tool "${tool.name}" cannot use grammar constrained sampling: no supported grammar variant was provided.`,
		);
	}

	try {
		return {
			format: hasLarkDefinition ? "lark" : "regex",
			definition: hasLarkDefinition ? larkDefinition : regexDefinition!,
			inputProperty: inferGrammarInputProperty(tool),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Tool "${tool.name}" cannot use grammar constrained sampling: ${message}.`);
	}
}

// 为全部工具建立"工具名 → 输入属性"映射（公开）：仅收录可解析语法的工具
export function createGrammarToolInputProperties(
	tools: Tool[] | undefined,
	supportsOpenAIGrammarTools: boolean,
): ReadonlyMap<string, string> {
	const properties = new Map<string, string>();
	for (const tool of tools ?? []) {
		const grammar = resolveGrammarConstrainedSampling(tool, supportsOpenAIGrammarTools);
		if (grammar) {
			properties.set(tool.name, grammar.inputProperty);
		}
	}
	return properties;
}
