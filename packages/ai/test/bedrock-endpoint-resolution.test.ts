/**
 * 文件职责：验证 Amazon Bedrock 客户端在区域、端点、配置档案和令牌组合下的配置解析结果。
 * 技术维度：使用 Vitest 提升式 mock 替换 AWS SDK，并通过捕获构造参数观察适配器行为。
 * 产品维度：保障用户在公有云、GovCloud、私有端点和多种 AWS 认证方式下都能连接正确区域。
 * 逻辑维度：建立最小 AWS SDK 替身，隔离环境变量，触发一次流请求并逐场景断言客户端配置。
 * 关键边界：不会真正访问 Bedrock；环境变量必须在每个用例后恢复；区域优先级由生产适配器决定。
 * 新手阅读建议：先看 captureClientConfig 如何截获配置，再按“内置端点、ARN、自定义认证”顺序阅读用例。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 提升到 mock 工厂之前创建的共享记录器，保存每次客户端构造参数。 */
const bedrockMock = vi.hoisted(() => ({
	constructorCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
	/** 模拟 AWS SDK 暴露的服务异常类型，供被测模块正常导入。 */
	class BedrockRuntimeServiceException extends Error {}

	/** 模拟 Bedrock 客户端，只记录配置并让网络发送稳定失败。 */
	class BedrockRuntimeClient {
		/**
		 * 保存被测代码传入的客户端配置。
		 * @param config AWS Bedrock 客户端配置。
		 */
		constructor(config: Record<string, unknown>) {
			bedrockMock.constructorCalls.push(config);
		}

		/**
		 * 阻止真实网络访问，并让流结果快速结束。
		 * @returns 永远拒绝的 Promise，错误会被被测流封装。
		 * @example await client.send();
		 */
		send(): Promise<never> {
			return Promise.reject(new Error("mock send"));
		}
	}

	/** 模拟 AWS SDK 的流式会话命令，只保留输入供兼容导入。 */
	class ConverseStreamCommand {
		/** 构造命令时收到的原始输入。 */
		readonly input: unknown;

		/** @param input 待发送到 Bedrock 的命令输入。 */
		constructor(input: unknown) {
			this.input = input;
		}
	}

	return {
		BedrockRuntimeClient,
		BedrockRuntimeServiceException,
		ConverseStreamCommand,
		StopReason: {
			END_TURN: "end_turn",
			STOP_SEQUENCE: "stop_sequence",
			MAX_TOKENS: "max_tokens",
			MODEL_CONTEXT_WINDOW_EXCEEDED: "model_context_window_exceeded",
			TOOL_USE: "tool_use",
		},
		CachePointType: { DEFAULT: "default" },
		CacheTTL: { ONE_HOUR: "ONE_HOUR" },
		ConversationRole: { ASSISTANT: "assistant", USER: "user" },
		ImageFormat: { JPEG: "jpeg", PNG: "png", GIF: "gif", WEBP: "webp" },
		ToolResultStatus: { ERROR: "error", SUCCESS: "success" },
	};
});

import type { BedrockOptions } from "../src/api/bedrock-converse-stream.ts";
import { getModel, stream as streamBedrock } from "../src/compat.ts";
import type { Context, Model } from "../src/types.ts";

/** 所有场景复用的最小用户会话。 */
const context: Context = {
	messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
};

/** 测试开始前进程中的 AWS_REGION，结束后必须原样恢复。 */
const originalAwsRegion = process.env.AWS_REGION;
/** 测试开始前进程中的 AWS_DEFAULT_REGION。 */
const originalAwsDefaultRegion = process.env.AWS_DEFAULT_REGION;
/** 测试开始前进程中的 AWS_PROFILE。 */
const originalAwsProfile = process.env.AWS_PROFILE;

/** 每个用例前清空构造记录和会影响区域选择的环境变量。 */
beforeEach(() => {
	bedrockMock.constructorCalls.length = 0;
	delete process.env.AWS_REGION;
	delete process.env.AWS_DEFAULT_REGION;
	delete process.env.AWS_PROFILE;
});

/** 每个用例后恢复原始 AWS 环境，避免污染其他测试。 */
afterEach(() => {
	if (originalAwsRegion === undefined) {
		delete process.env.AWS_REGION;
	} else {
		process.env.AWS_REGION = originalAwsRegion;
	}

	if (originalAwsDefaultRegion === undefined) {
		delete process.env.AWS_DEFAULT_REGION;
	} else {
		process.env.AWS_DEFAULT_REGION = originalAwsDefaultRegion;
	}

	if (originalAwsProfile === undefined) {
		delete process.env.AWS_PROFILE;
	} else {
		process.env.AWS_PROFILE = originalAwsProfile;
	}
});

/**
 * 触发一次 Bedrock 流请求并返回被构造客户端收到的配置。
 * @param model 要交给兼容层的 Bedrock 模型。
 * @param options 可选认证、环境和端点相关选项。
 * @returns 唯一次 BedrockRuntimeClient 构造调用的配置对象。
 * @example const config = await captureClientConfig(model, { apiKey: "token" });
 */
async function captureClientConfig(
	model: Model<"bedrock-converse-stream">,
	options: BedrockOptions = {},
): Promise<Record<string, unknown>> {
	bedrockMock.constructorCalls.length = 0;
	await streamBedrock(model, context, { cacheRetention: "none", ...options }).result();
	expect(bedrockMock.constructorCalls).toHaveLength(1);
	return bedrockMock.constructorCalls[0];
}

/** 覆盖 Bedrock 区域、端点与认证配置的优先级规则。 */
describe("bedrock endpoint resolution", () => {
	it("assigns eu-central-1 runtime URLs to built-in EU inference profiles", () => {
		/** model 是内置欧盟推理配置模型，用于检查其预设运行时地址。 */
		const model = getModel("amazon-bedrock", "eu.anthropic.claude-sonnet-4-5-20250929-v1:0");

		expect(model.baseUrl).toBe("https://bedrock-runtime.eu-central-1.amazonaws.com");
	});

	it("does not pin standard AWS endpoints when AWS_REGION is configured", async () => {
		process.env.AWS_REGION = "us-east-2";
		/** model 是标准美国区域模型；配置环境区域时不应固定 SDK 端点。 */
		const model = getModel("amazon-bedrock", "us.anthropic.claude-opus-4-8");

		/** config 是 SDK 客户端构造参数，应采用环境区域且省略显式端点。 */
		const config = await captureClientConfig(model);

		expect(config.region).toBe("us-east-2");
		expect(config.endpoint).toBeUndefined();
	});

	it("derives region from a built-in EU endpoint when no region or profile is configured", async () => {
		/** model 是带内置欧盟端点的模型，用于反向推导区域。 */
		const model = getModel("amazon-bedrock", "eu.anthropic.claude-sonnet-4-5-20250929-v1:0");

		/** config 是无环境区域和配置文件时生成的 SDK 参数。 */
		const config = await captureClientConfig(model);

		expect(config.endpoint).toBe("https://bedrock-runtime.eu-central-1.amazonaws.com");
		expect(config.region).toBe("eu-central-1");
	});

	it("handles missing regions for explicit, scoped, and ambient profiles", async () => {
		/** model 是带可推导欧盟端点的模型，用于比较三种配置文件来源。 */
		const model = getModel("amazon-bedrock", "eu.anthropic.claude-sonnet-4-5-20250929-v1:0");

		/** config 保存当前配置文件来源对应的 SDK 参数，并在本用例中依次重新赋值。 */
		let config = await captureClientConfig(model, { profile: "bedrock-profile" });

		expect(config.profile).toBe("bedrock-profile");
		expect(config.endpoint).toBe("https://bedrock-runtime.eu-central-1.amazonaws.com");
		expect(config.region).toBe("eu-central-1");

		config = await captureClientConfig(model, { env: { AWS_PROFILE: "scoped-bedrock-profile" } });

		expect(config.profile).toBe("scoped-bedrock-profile");
		expect(config.endpoint).toBe("https://bedrock-runtime.eu-central-1.amazonaws.com");
		expect(config.region).toBe("eu-central-1");

		process.env.AWS_PROFILE = "ambient-bedrock-profile";
		config = await captureClientConfig(model);

		expect(config.profile).toBe("ambient-bedrock-profile");
		expect(config.endpoint).toBeUndefined();
		expect(config.region).toBeUndefined();
	});

	it("still passes custom Bedrock endpoints through to the SDK client", async () => {
		process.env.AWS_REGION = "us-west-2";
		/** baseModel 是用于构造自定义 VPC 端点模型的内置配置基线。 */
		const baseModel = getModel("amazon-bedrock", "us.anthropic.claude-opus-4-8");
		/** model 是覆盖 baseUrl 后的测试模型，端点应原样传给 SDK。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			baseUrl: "https://bedrock-vpc.example.com",
		};

		/** config 是自定义端点模型生成的 SDK 客户端参数。 */
		const config = await captureClientConfig(model);

		expect(config.endpoint).toBe("https://bedrock-vpc.example.com");
		expect(config.region).toBe("us-west-2");
	});

	it("extracts region from inference profile ARN regardless of AWS_REGION", async () => {
		process.env.AWS_REGION = "us-east-1";
		/** baseModel 是自定义商业区 ARN 模型的字段基线。 */
		const baseModel = getModel("amazon-bedrock", "us.anthropic.claude-opus-4-8");
		/** model 使用 us-west-2 推理配置 ARN，优先级应高于环境区域。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			id: "arn:aws:bedrock:us-west-2:123456789012:application-inference-profile/abc123",
		};

		/** config 是从商业区 ARN 推导后的 SDK 参数。 */
		const config = await captureClientConfig(model);

		expect(config.region).toBe("us-west-2");
	});

	it("extracts region from GovCloud inference profile ARN", async () => {
		process.env.AWS_REGION = "us-east-1";
		/** baseModel 是自定义 GovCloud ARN 模型的字段基线。 */
		const baseModel = getModel("amazon-bedrock", "us.anthropic.claude-opus-4-8");
		/** model 使用 aws-us-gov 分区 ARN，用于验证 GovCloud 区域解析。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			id: "arn:aws-us-gov:bedrock:us-gov-west-1:123456789012:application-inference-profile/abc123",
		};

		/** config 是从 GovCloud ARN 推导后的 SDK 参数。 */
		const config = await captureClientConfig(model);

		expect(config.region).toBe("us-gov-west-1");
	});

	it("preserves ambient AWS auth for custom model IDs through compat dispatch", async () => {
		process.env.AWS_PROFILE = "bedrock-profile";
		/** baseModel 是自定义推理配置 ARN 的字段基线。 */
		const baseModel = getModel("amazon-bedrock", "us.anthropic.claude-opus-4-8");
		/** model 使用自定义 ARN，同时应保留环境中的 AWS 配置文件认证。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			id: "arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/example",
		};

		/** config 是兼容分派最终交给 SDK 的认证与端点参数。 */
		const config = await captureClientConfig(model);

		expect(config.profile).toBe("bedrock-profile");
		expect(config.token).toBeUndefined();
		expect(config.authSchemePreference).toBeUndefined();
	});

	it("uses the generic API key option as a Bedrock bearer token", async () => {
		/** model 是用于验证通用 apiKey 映射为 Bedrock Bearer Token 的标准模型。 */
		const model = getModel("amazon-bedrock", "us.anthropic.claude-opus-4-8");

		/** config 是传入通用 API Key 后生成的 SDK 认证参数。 */
		const config = await captureClientConfig(model, { apiKey: "bedrock-api-key" });

		expect(config.token).toEqual({ token: "bedrock-api-key" });
		expect(config.authSchemePreference).toEqual(["httpBearerAuth"]);
	});
});
