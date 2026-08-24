/**
 * 文件职责：验证 Google 工具声明转换会正确处理 JSON Schema 元字段、严格采样模式和空工具列表。
 * 技术维度：使用 Vitest 与手工 Tool 数据，对 convertTools 的深层复制、递归清理和 Gemini 版本判断做单元测试。
 * 产品维度：避免把 Google 不接受的 Schema 字段发送到接口，同时保留引用和严格工具调用能力。
 * 逻辑维度：先定义工具工厂，再覆盖顶层/嵌套元字段、不可变性、两种参数格式和严格工具模式。
 * 关键边界：`$ref` 不是元字段，必须保留；严格约束工具仅能用于支持 VALIDATED 模式的 Gemini 3。
 * 新手阅读建议：先比较 useParameters true/false 的输出字段，再看递归清理和严格采样断言。
 */
import { describe, expect, it } from "vitest";
import {
	convertTools,
	resolveGoogleFunctionCallingMode,
	supportsGoogleStrictToolSampling,
} from "../src/api/google-shared.ts";
import type { Tool } from "../src/types.ts";

/**
 * 用给定参数模式创建最小测试工具。
 * @param parameters 任意 JSON Schema 风格参数对象。
 * @returns 名为 test_tool 的 Tool；例如 `makeTool({ type: "object" })`。
 */
function makeTool(parameters: Record<string, unknown>): Tool {
	return {
		name: "test_tool",
		description: "A test tool",
		parameters: parameters as Tool["parameters"],
	};
}

// 验证 Google 工具声明转换和函数调用模式选择规则。
describe("google-shared convertTools", () => {
	// parameters 模式应删除 Google 参数对象不接受的顶层元字段。
	it("strips JSON Schema meta keys from parameters when useParameters=true", () => {
		// tools 包含同时具备新旧定义字段和常规属性的单个测试工具。
		const tools = [
			makeTool({
				$schema: "http://json-schema.org/draft-07/schema#",
				$id: "urn:bash-tool",
				$comment: "A bash tool for demonstration",
				$defs: {
					commandDef: { type: "string" },
				},
				definitions: {
					legacyDef: { type: "number" },
				},
				type: "object",
				properties: {
					command: { type: "string" },
				},
				required: ["command"],
			}),
		];

		// result 是使用 parameters 字段格式转换出的 Google 工具列表。
		const result = convertTools(tools, true);
		// decl 是首个工具的首个函数声明，后续断言聚焦其参数结构。
		const decl = result?.[0]?.functionDeclarations?.[0];

		expect(decl).toBeDefined();
		expect(decl?.parameters).toEqual({
			type: "object",
			properties: {
				command: { type: "string" },
			},
			required: ["command"],
		});
		expect(decl?.parameters).not.toHaveProperty("$schema");
		expect(decl?.parameters).not.toHaveProperty("$id");
		expect(decl?.parameters).not.toHaveProperty("$comment");
		expect(decl?.parameters).not.toHaveProperty("$defs");
		expect(decl?.parameters).not.toHaveProperty("definitions");
	});

	// 元字段清理必须递归进入 properties 的嵌套模式。
	it("recursively strips nested JSON Schema meta keys", () => {
		// tools 构造同时含顶层和深层元字段的参数模式。
		const tools = [
			makeTool({
				$schema: "http://json-schema.org/draft-07/schema#",
				type: "object",
				properties: {
					deep: {
						$schema: "http://json-schema.org/draft-07/schema#",
						$id: "urn:nested",
						type: "string",
					},
				},
			}),
		];

		// result 是递归清理后的 Google 工具列表。
		const result = convertTools(tools, true);
		// decl 指向待检查的函数参数声明。
		const decl = result?.[0]?.functionDeclarations?.[0];

		expect(decl).toBeDefined();
		expect(decl?.parameters).toEqual({
			type: "object",
			properties: {
				deep: {
					type: "string",
				},
			},
		});
	});

	// `$ref` 具有实际引用语义，清理其他元字段时不能移除。
	it("preserves $ref while stripping meta keys", () => {
		// tools 包含一个同时带 `$ref` 和普通类型的嵌套属性。
		const tools = [
			makeTool({
				$schema: "http://json-schema.org/draft-07/schema#",
				type: "object",
				properties: {
					refProp: {
						$ref: "#/$defs/someDef",
						type: "string",
					},
				},
			}),
		];

		// result 是转换后的工具定义。
		const result = convertTools(tools, true);
		// decl 用于验证引用字段仍存在。
		const decl = result?.[0]?.functionDeclarations?.[0];

		expect(decl).toBeDefined();
		expect(decl?.parameters).toEqual({
			type: "object",
			properties: {
				refProp: {
					$ref: "#/$defs/someDef",
					type: "string",
				},
			},
		});
	});

	// 转换必须创建新对象，不能就地删除调用者的 Schema 字段。
	it("does not mutate the original Tool.parameters object", () => {
		// originalParameters 保存转换前后都应完全相同的源对象。
		const originalParameters = {
			$schema: "http://json-schema.org/draft-07/schema#",
			type: "object",
			properties: {
				command: { type: "string" },
			},
			required: ["command"],
		};
		// tools 用源对象构造待转换工具数组。
		const tools = [makeTool(originalParameters)];

		convertTools(tools, true);

		expect(originalParameters).toEqual({
			$schema: "http://json-schema.org/draft-07/schema#",
			type: "object",
			properties: {
				command: { type: "string" },
			},
			required: ["command"],
		});
	});

	// parametersJsonSchema 格式允许保留完整 `$schema` 信息。
	it("preserves $schema in parametersJsonSchema when useParameters=false", () => {
		// tools 包含一个带 `$schema` 的标准对象参数模式。
		const tools = [
			makeTool({
				$schema: "http://json-schema.org/draft-07/schema#",
				type: "object",
				properties: {
					command: { type: "string" },
				},
				required: ["command"],
			}),
		];

		// result 使用 parametersJsonSchema 输出格式。
		const result = convertTools(tools, false);
		// decl 是用于检查完整 Schema 的函数声明。
		const decl = result?.[0]?.functionDeclarations?.[0];

		expect(decl).toBeDefined();
		expect(decl?.parametersJsonSchema).toEqual({
			$schema: "http://json-schema.org/draft-07/schema#",
			type: "object",
			properties: {
				command: { type: "string" },
			},
			required: ["command"],
		});
	});

	// 没有元字段的常规工具也应正常转换。
	it("handles tools without $schema gracefully", () => {
		// tools 只包含普通对象属性和 required 列表。
		const tools = [
			makeTool({
				type: "object",
				properties: {
					path: { type: "string" },
				},
				required: ["path"],
			}),
		];

		// result 是无需删除字段的转换结果。
		const result = convertTools(tools, true);
		// decl 指向最终参数声明。
		const decl = result?.[0]?.functionDeclarations?.[0];

		expect(decl).toBeDefined();
		expect(decl?.parameters).toEqual({
			type: "object",
			properties: {
				path: { type: "string" },
			},
			required: ["path"],
		});
	});

	// Gemini 3 的严格工具应选 VALIDATED，旧模型则必须明确拒绝。
	it("uses validated function calling for strict tools on Gemini 3", () => {
		// tool 是要求 JSON Schema 严格约束采样的测试工具。
		const tool = makeTool({ type: "object", properties: {} });
		tool.constrainedSampling = { type: "json_schema", strict: "require" };

		expect(supportsGoogleStrictToolSampling("gemini-3.1-pro-preview")).toBe(true);
		expect(supportsGoogleStrictToolSampling("gemini-2.5-pro")).toBe(false);
		expect(resolveGoogleFunctionCallingMode([tool], undefined, true)).toBe("VALIDATED");
		expect(() => resolveGoogleFunctionCallingMode([tool], undefined, false)).toThrow(
			'Tool "test_tool" requires JSON-schema constrained sampling',
		);
	});

	// 没有工具时转换器应返回 undefined，避免发送空声明结构。
	it("returns undefined for empty tool list", () => {
		expect(convertTools([])).toBeUndefined();
		expect(convertTools([], true)).toBeUndefined();
	});
});
