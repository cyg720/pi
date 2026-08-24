// Unit tests for the shared provider error-body normalizer.
// 共享提供商错误正文规范化器的单元测试。
//
// See issues/provider-error-body-passthrough. These cover one synthesized error
// 参见 issues/provider-error-body-passthrough；这里为每种 SDK 错误结构构造合成对象。
// object per SDK shape (Mistral, openai APIError, @google/genai ApiError, AWS
// 覆盖 Mistral、OpenAI APIError、Google ApiError 和 AWS Bedrock ServiceException。
// Bedrock ServiceException), plus the non-Error fallback, truncation, the empty
// 同时覆盖非 Error 值、正文截断和空解析正文。
// parsed-body edge case, and the formatProviderError compose helper.
// 最后验证 formatProviderError 对规范化结果的组合输出。
// 文件职责：验证不同提供商 SDK 的错误对象能归一化为统一状态码、正文和消息，再生成用户可读文本。
// 技术维度：使用 Vitest 和手工合成错误对象覆盖属性探测、JSON 序列化、流对象忽略及长度截断。
// 产品维度：让用户看到上游网关的真实错误原因，同时避免重复正文或输出庞大、不可序列化的内部对象。
// 逻辑维度：先测试 normalizeProviderError 的各 SDK 输入，再测试 formatProviderError 的前缀组合规则。
// 关键边界：空对象不算有效正文；Bedrock 流不能序列化；正文超过上限必须附带截断说明。
// 新手阅读建议：先比较每个合成 error 的字段差异，再观察 norm 三个核心字段如何决定最终格式。

import { describe, expect, it } from "vitest";
import { formatProviderError, MAX_PROVIDER_ERROR_BODY_CHARS, normalizeProviderError } from "../src/utils/error-body.ts";

// 验证错误对象到统一结构的提取、去重和截断规则。
describe("normalizeProviderError", () => {
	// Mistral 使用 statusCode 和字符串 body 字段。
	it("extracts status and body from a Mistral-shaped error", () => {
		// error 模拟 Mistral SDK 的错误结构。
		const error = Object.assign(new Error("Mistral request failed"), {
			statusCode: 403,
			body: '{"error":"blocked by gateway WAF"}',
		});

		// norm 是规范化后的状态、消息和正文信息。
		const norm = normalizeProviderError(error);

		expect(norm.status).toBe(403);
		expect(norm.body).toBe('{"error":"blocked by gateway WAF"}');
		expect(norm.messageCarriesBody).toBe(false);
	});

	// OpenAI APIError 的解析正文位于 error.error，原 message 可能是占位文本。
	it("reads the parsed body off an openai APIError when the message is opaque", () => {
		// makeMessage(status, error, message) yields "<status> status code (no body)"
		// makeMessage 在正文未进入 message 时只生成“状态码且无正文”的占位文本。
		// when the parsed body is unparsed, while the body stays on error.error.
		// 已解析正文仍保存在 error.error，因此规范化器应从那里读取。
		// error 模拟 OpenAI SDK 的不透明消息与解析正文组合。
		const error = Object.assign(new Error("403 status code (no body)"), {
			status: 403,
			error: { error: "blocked by gateway WAF" },
		});

		// norm 应把解析对象序列化为正文。
		const norm = normalizeProviderError(error);

		expect(norm.status).toBe(403);
		expect(norm.body).toBe('{"error":"blocked by gateway WAF"}');
		expect(norm.messageCarriesBody).toBe(false);
	});

	// Google SDK 已把正文折入 message 时，不应再重复追加正文。
	it("preserves the message when @google/genai already folds the body into it", () => {
		// body 是 Google 错误消息中已经序列化的结构。
		const body = { error: { code: 403, message: "Permission denied" } };
		// error 的 message 已等于 body JSON。
		const error = Object.assign(new Error(JSON.stringify(body)), {
			status: 403,
		});

		// norm 应标记 message 已携带正文。
		const norm = normalizeProviderError(error);

		expect(norm.status).toBe(403);
		expect(norm.messageCarriesBody).toBe(true);
		expect(norm.message).toBe(JSON.stringify(body));
	});

	// Bedrock ServiceException 通过 $metadata 和 $response 暴露状态与正文。
	it("extracts status and body from a Bedrock-shaped ServiceException", () => {
		// error 模拟 AWS SDK 的 ServiceException 属性形状。
		const error = Object.assign(new Error("UnknownError"), {
			name: "UnknownError",
			$metadata: { httpStatusCode: 403 },
			$response: { statusCode: 403, body: '{"message":"blocked by gateway WAF"}' },
		});

		// norm 是从 AWS 字段提取后的统一错误。
		const norm = normalizeProviderError(error);

		expect(norm.status).toBe(403);
		expect(norm.body).toBe('{"message":"blocked by gateway WAF"}');
		expect(norm.messageCarriesBody).toBe(false);
	});

	// Bedrock 响应 body 若为流对象，不能把其内部事件和方法 JSON 化给用户。
	it("ignores a Bedrock response stream instead of serializing its internals", () => {
		// error 模拟含流式 body 的 Bedrock ValidationException。
		const error = Object.assign(
			new Error("Invocation of model ID anthropic.claude-opus-5 with on-demand throughput isn't supported."),
			{
				name: "ValidationException",
				$metadata: { httpStatusCode: 400 },
				$response: {
					statusCode: 400,
					body: { pipe: () => undefined, _events: { close: [null, null] } },
				},
			},
		);

		// norm 应保留清晰 message，但不生成 body。
		const norm = normalizeProviderError(error);

		expect(norm.status).toBe(400);
		expect(norm.body).toBeUndefined();
		expect(norm.message).toContain("on-demand throughput isn't supported");
		expect(norm.messageCarriesBody).toBe(true);
	});

	// 抛出的普通对象应安全转换为 JSON 消息。
	it("JSON-stringifies a non-Error thrown value", () => {
		// norm 是非 Error 对象的回退规范化结果。
		const norm = normalizeProviderError({ reason: "boom" });

		expect(norm.status).toBeUndefined();
		expect(norm.body).toBeUndefined();
		expect(norm.message).toBe('{"reason":"boom"}');
		expect(norm.messageCarriesBody).toBe(false);
	});

	// 空解析对象不提供有效诊断信息，应视为没有独立正文。
	it("treats an empty parsed body object as no body", () => {
		// error 模拟 error.error 为空对象的 OpenAI 错误。
		const error = Object.assign(new Error("403 status code (no body)"), {
			status: 403,
			error: {},
		});

		// norm 不应序列化空对象为 `{}` 正文。
		const norm = normalizeProviderError(error);

		expect(norm.body).toBeUndefined();
		expect(norm.messageCarriesBody).toBe(true);
	});

	// 超长正文应截断到共享上限并说明省略字符数。
	it("truncates the body at the cap", () => {
		// longBody 比允许上限多 50 个字符。
		const longBody = "x".repeat(MAX_PROVIDER_ERROR_BODY_CHARS + 50);
		// error 模拟携带超长正文的提供商错误。
		const error = Object.assign(new Error("failed"), {
			statusCode: 500,
			body: longBody,
		});

		// norm 包含截断后的正文。
		const norm = normalizeProviderError(error);

		expect(norm.body).toContain("... [truncated 50 chars]");
		expect(norm.body?.length).toBeLessThan(longBody.length);
	});

	// message 已包含完全相同正文时应设置去重标志。
	it("sets messageCarriesBody when the message already contains the extracted body", () => {
		// error 的消息文本已经包含 body 字符串。
		const error = Object.assign(new Error("500: upstream exploded"), {
			statusCode: 500,
			body: "upstream exploded",
		});

		// norm 应识别正文已由 message 承载。
		const norm = normalizeProviderError(error);

		expect(norm.messageCarriesBody).toBe(true);
	});
});

// 验证统一错误结构最终组合为用户消息的格式。
describe("formatProviderError", () => {
	// 无提供商前缀时仍应显示状态码和真实正文。
	it("surfaces status and body without a prefix", () => {
		// norm 是含独立解析正文的 OpenAI 风格错误。
		const norm = normalizeProviderError(
			Object.assign(new Error("403 status code (no body)"), {
				status: 403,
				error: { error: "blocked by gateway WAF" },
			}),
		);

		// formatted 是不带前缀的最终错误文本。
		const formatted = formatProviderError(norm);

		expect(formatted).toContain("403");
		expect(formatted).toContain("blocked by gateway WAF");
		expect(formatted).not.toBe("403 status code (no body)");
	});

	// 提供商前缀、状态码和正文应按稳定格式组合。
	it("applies a provider prefix with status and body", () => {
		// norm 是待添加 OpenAI API 前缀的统一错误。
		const norm = normalizeProviderError(
			Object.assign(new Error("403 status code (no body)"), {
				status: 403,
				error: { error: "blocked by gateway WAF" },
			}),
		);

		expect(formatProviderError(norm, "OpenAI API error")).toBe(
			'OpenAI API error (403): {"error":"blocked by gateway WAF"}',
		);
	});

	// message 已含正文时，格式器只补前缀与状态，不重复正文。
	it("preserves the message (with prefix + status) when it already carries the body", () => {
		// body 是已经进入 Error.message 的 JSON 文本。
		const body = JSON.stringify({ error: { message: "Permission denied" } });
		// norm 标记消息已携带 body。
		const norm = normalizeProviderError(Object.assign(new Error(body), { status: 403 }));

		expect(formatProviderError(norm, "OpenAI API error")).toBe(`OpenAI API error (403): ${body}`);
	});

	// 非 Error 值没有状态和前缀时应返回其 JSON 消息本身。
	it("returns the bare message for a non-Error value", () => {
		// norm 是普通对象的统一错误表示。
		const norm = normalizeProviderError({ reason: "boom" });

		expect(formatProviderError(norm)).toBe('{"reason":"boom"}');
	});
});
