/**
 * 文件职责：验证 Mistral 工具 Schema 在交给 SDK 前移除 TypeBox 的 Symbol 键。
 * 技术维度：使用 Vitest、TypeBox 嵌套 Schema、onPayload 捕获和不可达本地地址。
 * 产品维度：避免 SDK 因附加符号元数据拒绝工具定义，使 Mistral 工具调用正常工作。
 * 逻辑维度：构造模型、Schema 和 Context，捕获序列化 payload，逐层检查无 Symbol 键。
 * 关键边界：请求固定发往 127.0.0.1:9 并预期网络错误；测试关注错误前的 payload。
 * 新手阅读建议：先看 MistralToolPayload，再沿 parameters、capturedPayload 的嵌套层级阅读。
 */
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { complete, getModel } from "../src/compat.ts";
import type { Context, Model } from "../src/types.ts";

/** 测试关注的 Mistral 请求载荷最小结构。 */
interface MistralToolPayload {
	/** 可选工具定义数组。 */
	tools?: Array<{
		/** Mistral 当前工具类型固定为 function。 */
		type: "function";
		function: {
			/** 工具名称。 */
			name: string;
			/** 已序列化为纯字符串键的参数 Schema。 */
			parameters: Record<string, unknown>;
			/** 是否启用严格 Schema。 */
			strict?: boolean;
		};
	}>;
}

/** Mistral 工具 Schema 序列化测试组。 */
describe("Mistral tool schema serialization", () => {
	/** 验证顶层、properties 和 nested 对象均不再含 TypeBox Symbol。 */
	it("strips TypeBox symbol keys before the SDK validates tool schemas", async () => {
		/** 把真实模型 baseUrl 改到不可达本地端口的测试模型。 */
		const model: Model<"mistral-conversations"> = {
			...getModel("mistral", "devstral-medium-latest"),
			baseUrl: "http://127.0.0.1:9",
		};
		/** 含一层 nested 对象的 TypeBox 参数 Schema。 */
		const parameters = Type.Object({
			nested: Type.Object({
				value: Type.String(),
			}),
		});
		/** 带一个严格工具定义的请求上下文。 */
		const context: Context = {
			messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
			tools: [
				{
					name: "inspect_schema",
					description: "Inspect the schema",
					parameters,
					constrainedSampling: { type: "json_schema", strict: "require" },
				},
			],
		};
		/** onPayload 捕获到的 Mistral 请求；调用前为 undefined。 */
		let capturedPayload: MistralToolPayload | undefined;

		/** 预期最终网络失败、但已完成载荷构造的响应。 */
		const response = await complete(model, context, {
			apiKey: "fake-key",
			onPayload: (payload) => {
				capturedPayload = payload as MistralToolPayload;
				return payload;
			},
		});

		expect(capturedPayload?.tools).toHaveLength(1);
		expect(capturedPayload?.tools?.[0]?.function.strict).toBe(true);
		/** 捕获载荷中的工具参数 Schema。 */
		const payloadParameters = capturedPayload?.tools?.[0]?.function.parameters;
		expect(payloadParameters).toBeDefined();
		expect(Object.getOwnPropertySymbols(payloadParameters ?? {})).toHaveLength(0);
		/** Schema 的 properties 字段。 */
		const properties = payloadParameters?.properties;
		expect(properties).toBeTruthy();
		expect(Object.getOwnPropertySymbols((properties as Record<string, unknown>) ?? {})).toHaveLength(0);
		/** properties 中的 nested 子 Schema。 */
		const nested = (properties as Record<string, unknown> | undefined)?.nested;
		expect(nested).toBeTruthy();
		expect(Object.getOwnPropertySymbols((nested as Record<string, unknown>) ?? {})).toHaveLength(0);
		expect(response.stopReason).toBe("error");
		expect(response.errorMessage).not.toContain("Input validation failed");
	});
});
