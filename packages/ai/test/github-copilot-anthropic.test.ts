/**
 * 文件职责：验证 GitHub Copilot 的 Claude 模型通过 Anthropic Messages API 时使用正确鉴权、请求头和思考配置。
 * 技术维度：使用 Vitest 模拟 Anthropic SDK、SSE Response、模型目录和真实流解析器完成无网络测试。
 * 产品维度：保证 Copilot 会话令牌、静态/动态请求头和自适应思考能力符合 GitHub 网关约定。
 * 逻辑维度：模拟两条 SSE 事件，捕获 SDK 构造与 create 参数，再检查模型能力、鉴权和 beta 头。
 * 关键边界：Copilot 不支持 fine-grained-tool-streaming；自适应模型不得发送旧 interleaved-thinking beta。
 * 新手阅读建议：先看 mockState 捕获哪些数据，再按三个用例阅读模型能力、主请求和 beta 边界。
 */
import { describe, expect, it, vi } from "vitest";
import { stream as streamAnthropic } from "../src/api/anthropic-messages.ts";
import { getModel } from "../src/compat.ts";
import { getSupportedThinkingLevels } from "../src/models.ts";
import type { Context } from "../src/types.ts";

// Anthropic SDK 模拟状态；分别保存构造器选项和 messages.create 请求参数。
const mockState = vi.hoisted(() => ({
	constructorOpts: undefined as Record<string, unknown> | undefined,
	createParams: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@anthropic-ai/sdk", () => {
	function createSseResponse(): Response {
		// 模拟 Anthropic 成功响应的两段 SSE 文本。
		const body = [
			`event: message_start\ndata: ${JSON.stringify({
				type: "message_start",
				message: {
					id: "msg_test",
					usage: { input_tokens: 10, output_tokens: 0 },
				},
			})}\n`,
			`event: message_delta\ndata: ${JSON.stringify({
				type: "message_delta",
				delta: { stop_reason: "end_turn" },
				usage: { output_tokens: 5 },
			})}\n`,
		].join("\n");

		return new Response(body, {
			status: 200,
			headers: { "content-type": "text/event-stream" },
		});
	}

	// FakeAnthropic 捕获认证与请求参数，并返回固定 SSE 响应。
	class FakeAnthropic {
		/** 功能：记录 SDK 构造选项；参数 opts；返回：FakeAnthropic 实例。示例：由 streamAnthropic 内部创建。 */
		constructor(opts: Record<string, unknown>) {
			mockState.constructorOpts = opts;
		}
		// 模拟 messages API；create 记录参数并返回可转成 Response 的对象。
		messages = {
			create: (params: Record<string, unknown>) => {
				mockState.createParams = params;
				return {
					asResponse: async () => createSseResponse(),
				};
			},
		};
	}

	return { default: FakeAnthropic };
});

describe("Copilot Claude via Anthropic Messages", () => {
	// 三个用例共用的单轮用户上下文。
	const context: Context = {
		systemPrompt: "You are a helpful assistant.",
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};

	it("applies Copilot-specific adaptive thinking effort overrides", () => {
		// Copilot Opus 4.7 模型，支持 xhigh 与 max 映射。
		const opus47 = getModel("github-copilot", "claude-opus-4.7");
		expect(opus47.thinkingLevelMap).toMatchObject({ minimal: "low", xhigh: "xhigh", max: "max" });
		expect(getSupportedThinkingLevels(opus47)).toContain("xhigh");
		expect(getSupportedThinkingLevels(opus47)).toContain("max");

		// Copilot Sonnet 4.6 模型，只扩展 max，不支持 xhigh。
		const sonnet46 = getModel("github-copilot", "claude-sonnet-4.6");
		expect(sonnet46.thinkingLevelMap).toMatchObject({ minimal: "low", max: "max" });
		expect(getSupportedThinkingLevels(sonnet46)).toContain("max");
		expect(getSupportedThinkingLevels(sonnet46)).not.toContain("xhigh");
	});

	it("uses Bearer auth, Copilot headers, and valid Anthropic Messages payload", async () => {
		// 被测 Copilot Claude 模型。
		const model = getModel("github-copilot", "claude-sonnet-4.6");
		expect(model.api).toBe("anthropic-messages");

		// 使用测试会话令牌创建的 Anthropic 事件流。
		const s = streamAnthropic(model, context, { apiKey: "tid_copilot_session_test_token" });
		for await (const event of s) {
			if (event.type === "error") break;
		}

		// SDK 构造选项，包含鉴权与默认请求头。
		const opts = mockState.constructorOpts!;
		expect(opts).toBeDefined();

		// Auth: apiKey null, authToken for Bearer
		// 中文说明：Copilot 使用 Bearer authToken，标准 apiKey 必须显式为 null。
		expect(opts.apiKey).toBeNull();
		expect(opts.authToken).toBe("tid_copilot_session_test_token");
		// SDK 默认请求头的类型收窄视图。
		const headers = opts.defaultHeaders as Record<string, string>;

		// Copilot static headers from model.headers
		// 中文说明：以下静态头来自模型目录中的 Copilot 配置。
		expect(headers["User-Agent"]).toContain("GitHubCopilotChat");
		expect(headers["Copilot-Integration-Id"]).toBe("vscode-chat");

		// Dynamic headers
		// 中文说明：以下动态头由本次用户发起的对话请求生成。
		expect(headers["X-Initiator"]).toBe("user");
		expect(headers["Openai-Intent"]).toBe("conversation-edits");

		// No fine-grained-tool-streaming (Copilot doesn't support it)
		// 中文说明：Copilot 不支持细粒度工具流，因此 beta 列表不得包含该能力。
		// 归一化后的 Anthropic beta 头文本。
		const beta = headers["anthropic-beta"] ?? "";
		expect(beta).not.toContain("fine-grained-tool-streaming");

		// Payload is valid Anthropic Messages format
		// 中文说明：请求载荷应符合 Anthropic Messages 的模型、流式和消息字段约定。
		// 捕获的 messages.create 请求参数。
		const params = mockState.createParams!;
		expect(params.model).toBe("claude-sonnet-4.6");
		expect(params.stream).toBe(true);
		expect(params.max_tokens).toBe(model.maxTokens);
		expect(Array.isArray(params.messages)).toBe(true);
	});

	it("omits interleaved-thinking beta for adaptive-thinking models", async () => {
		// 自适应思考的 Copilot Sonnet 模型。
		const model = getModel("github-copilot", "claude-sonnet-4.6");
		// 即使调用方请求 interleavedThinking，也不应向自适应模型发送旧 beta。
		const s = streamAnthropic(model, context, {
			apiKey: "tid_copilot_session_test_token",
			interleavedThinking: true,
		});
		for await (const event of s) {
			if (event.type === "error") break;
		}

		// 第二次请求捕获的默认头。
		const headers = mockState.constructorOpts!.defaultHeaders as Record<string, string>;
		expect(headers["anthropic-beta"] ?? "").not.toContain("interleaved-thinking-2025-05-14");
	});
});
