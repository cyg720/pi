#!/usr/bin/env node
/**
 * 文件职责：从多个模型目录与供应商接口收集模型元数据，应用项目兼容修正规则，并生成运行时模型目录、数据清单和可选 JSON 输出。
 * 技术维度：使用 Node.js 文件系统与 Fetch、TypeScript 类型约束、供应商兼容规则、临时目录原子替换和生成数据校验。
 * 产品维度：为模型选择、能力展示、成本估算和多供应商请求提供一致且可更新的内置目录，是新增或修正模型支持的主要入口。
 * 逻辑维度：解析命令参数后拉取并标准化各数据源，逐层应用兼容/推理/价格覆盖，去重分组，暂存校验后生成分片、聚合器和 JSON。
 * 关键边界：生成过程依赖外部 API，strict 模式下任一数据源失败即终止；生成文件禁止手改，目录替换必须通过暂存和恢复逻辑保证原子性。
 * 新手阅读建议：先读参数和数据类型，再看兼容元数据函数；按供应商浏览 loadModelsDevData，最后重点理解 generateModels 的覆盖、去重、暂存校验和输出模板。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { getEffortThinkingLevelMap, type ModelsDevReasoningOption } from "./models-dev-reasoning-options.ts";
import {
	CLOUDFLARE_AI_GATEWAY_ANTHROPIC_BASE_URL,
	CLOUDFLARE_AI_GATEWAY_COMPAT_BASE_URL,
	CLOUDFLARE_AI_GATEWAY_OPENAI_BASE_URL,
	CLOUDFLARE_WORKERS_AI_BASE_URL,
} from "../src/api/cloudflare.ts";
import type {
	AnthropicMessagesCompat,
	Api,
	KnownProvider,
	Model,
	ModelCost,
	OpenAICompletionsCompat,
	OpenAIResponsesCompat,
} from "../src/types.ts";
import {
	createModelDataManifest,
	type ModelDataStructure,
	MODEL_DATA_MANIFEST_FILE,
	readModelDataProviderIds,
	validateGeneratedModelData,
	validateModelDataDirectory,
} from "./model-data.ts";

/** 常量 __filename 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const __filename = fileURLToPath(import.meta.url);
/** 常量 __dirname 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const __dirname = dirname(__filename);
/** 常量 packageRoot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const packageRoot = join(__dirname, "..");

/** readGeneratorOptions 执行当前测试辅助步骤；参数 args 按签名提供输入，返回值供调用方断言。示例：readGeneratorOptions(...)。 */
function readGeneratorOptions(args: string[]): {
	strict: boolean;
	dataOnly: boolean;
	jsonOnly: boolean;
	jsonOutputDir: string | undefined;
	pretty: boolean;
} {
	/** 变量 strict 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let strict = false;
	/** 变量 dataOnly 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let dataOnly = false;
	/** 变量 jsonOnly 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let jsonOnly = false;
	/** 变量 jsonOutputDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let jsonOutputDir: string | undefined;
	/** 变量 pretty 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let pretty = false;

	/** 循环变量 index 表示当前遍历项或索引，仅在循环体内有效。 */
	for (let index = 0; index < args.length; index++) {
		/** 常量 arg 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const arg = args[index];
		if (arg === "--strict") {
			strict = true;
			continue;
		}
		if (arg === "--data-only") {
			dataOnly = true;
			continue;
		}
		if (arg === "--json-only") {
			jsonOnly = true;
			continue;
		}
		if (arg === "--pretty") {
			pretty = true;
			continue;
		}
		if (arg === "--json-output") {
			/** 常量 value 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const value = args[++index];
			if (!value) throw new Error("--json-output requires a directory");
			jsonOutputDir = resolve(value);
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (jsonOnly && !jsonOutputDir) throw new Error("--json-only requires --json-output");
	if (dataOnly && (jsonOnly || jsonOutputDir)) throw new Error("--data-only cannot be combined with JSON catalog output");
	return { strict, dataOnly, jsonOnly, jsonOutputDir, pretty };
}

/** 常量 generatorOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const generatorOptions = readGeneratorOptions(process.argv.slice(2));

interface ModelsDevModel {
	id: string;
	name: string;
	tool_call?: boolean;
	structured_output?: boolean;
	reasoning?: boolean;
	reasoning_options?: ModelsDevReasoningOption[];
	limit?: {
		context?: number;
		output?: number;
	};
	cost?: {
		input?: number;
		output?: number;
		cache_read?: number;
		cache_write?: number;
		tiers?: {
			input?: number;
			output?: number;
			cache_read?: number;
			cache_write?: number;
			tier?: {
				type?: string;
				size?: number;
			};
		}[];
	};
	modalities?: {
		input?: string[];
		output?: string[];
	};
	provider?: {
		npm?: string;
	};
}

interface ModelsDevProvider {
	models?: Record<string, ModelsDevModel>;
}

type ModelsDevCatalog = Record<string, ModelsDevProvider>;

interface NvidiaNimModelListItem {
	id: string;
}

interface AiGatewayModel {
	id: string;
	name?: string;
	context_window?: number;
	max_tokens?: number;
	tags?: string[];
	pricing?: {
		input?: string | number;
		output?: string | number;
		input_cache_read?: string | number;
		input_cache_write?: string | number;
	};
}

/** 常量 COPILOT_STATIC_HEADERS 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const COPILOT_STATIC_HEADERS = {
	"User-Agent": "GitHubCopilotChat/0.35.0",
	"Editor-Version": "vscode/1.107.0",
	"Editor-Plugin-Version": "copilot-chat/0.35.0",
	"Copilot-Integration-Id": "vscode-chat",
} as const;

/** 常量 KIMI_STATIC_HEADERS 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const KIMI_STATIC_HEADERS = {
	"User-Agent": "KimiCLI/1.5",
} as const;

/** 常量 TOGETHER_BASE_URL 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_BASE_URL = "https://api.together.ai/v1";
/** 常量 TOGETHER_BASE_COMPAT 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_BASE_COMPAT: OpenAICompletionsCompat = {
	supportsStore: false,
	supportsDeveloperRole: false,
	supportsReasoningEffort: false,
	maxTokensField: "max_tokens",
	supportsStrictMode: false,
	supportsLongCacheRetention: false,
};
/** 常量 TOGETHER_TOGGLE_REASONING_COMPAT 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_TOGGLE_REASONING_COMPAT: OpenAICompletionsCompat = {
	...TOGETHER_BASE_COMPAT,
	thinkingFormat: "together",
};
/** 常量 TOGETHER_REASONING_EFFORT_COMPAT 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_REASONING_EFFORT_COMPAT: OpenAICompletionsCompat = {
	...TOGETHER_BASE_COMPAT,
	supportsReasoningEffort: true,
	thinkingFormat: "openai",
};
/** 常量 TOGETHER_TOGGLE_REASONING_EFFORT_COMPAT 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_TOGGLE_REASONING_EFFORT_COMPAT: OpenAICompletionsCompat = {
	...TOGETHER_TOGGLE_REASONING_COMPAT,
	supportsReasoningEffort: true,
};
/** 常量 TOGETHER_REASONING_ONLY_MODELS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_REASONING_ONLY_MODELS = new Set([
	"deepseek-ai/DeepSeek-R1",
	"MiniMaxAI/MiniMax-M2.7",
]);
/** 常量 TOGETHER_REASONING_EFFORT_MODELS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_REASONING_EFFORT_MODELS = new Set(["openai/gpt-oss-20b", "openai/gpt-oss-120b"]);
/** 常量 TOGETHER_TOGGLE_REASONING_EFFORT_MODELS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_TOGGLE_REASONING_EFFORT_MODELS = new Set(["deepseek-ai/DeepSeek-V4-Pro"]);
/** 常量 TOGETHER_FIXED_REASONING_LEVEL_MAP 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_FIXED_REASONING_LEVEL_MAP = {
	off: null,
	minimal: null,
	low: null,
	medium: null,
} as const;
/** 常量 TOGETHER_REASONING_EFFORT_LEVEL_MAP 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_REASONING_EFFORT_LEVEL_MAP = {
	off: null,
	minimal: null,
} as const;
/** 常量 TOGETHER_DEEPSEEK_V4_THINKING_LEVEL_MAP 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_DEEPSEEK_V4_THINKING_LEVEL_MAP = {
	minimal: null,
	low: null,
	medium: null,
	high: "high",
	xhigh: null,
} as const;
/** 常量 TOGETHER_TOGGLE_REASONING_LEVEL_MAP 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const TOGETHER_TOGGLE_REASONING_LEVEL_MAP = {
	minimal: null,
	low: null,
	medium: null,
} as const;

/** 常量 AI_GATEWAY_MODELS_URL 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const AI_GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1";
/** 常量 AI_GATEWAY_BASE_URL 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh";
/** 常量 VERTEX_BASE_URL 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const VERTEX_BASE_URL = "https://{location}-aiplatform.googleapis.com";
/** 常量 NVIDIA_BASE_URL 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
/** 常量 NVIDIA_HEADERS 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const NVIDIA_HEADERS = {
	"NVCF-POLL-SECONDS": "3600",
} as const;
/** 常量 NVIDIA_OPENAI_COMPAT 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const NVIDIA_OPENAI_COMPAT: OpenAICompletionsCompat = {
	supportsStore: false,
	supportsDeveloperRole: false,
	supportsReasoningEffort: false,
	maxTokensField: "max_tokens",
	supportsStrictMode: false,
	supportsLongCacheRetention: false,
};
/** 常量 NVIDIA_NIM_UNSUPPORTED_MODELS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const NVIDIA_NIM_UNSUPPORTED_MODELS = new Set([
	"abacusai/dracarys-llama-3.1-70b-instruct",
	"bytedance/seed-oss-36b-instruct",
	"deepseek-ai/deepseek-v4-flash",
	"deepseek-ai/deepseek-v4-pro",
	"google/gemma-2-2b-it",
	"google/gemma-3n-e2b-it",
	"google/gemma-3n-e4b-it",
	"google/gemma-4-31b-it",
	"meta/llama-3.2-1b-instruct",
	"meta/llama-4-maverick-17b-128e-instruct",
	"microsoft/phi-4-mini-instruct",
	"minimaxai/minimax-m2.7",
	"mistralai/mistral-nemotron",
	"nvidia/nemotron-mini-4b-instruct",
	"qwen/qwen3-next-80b-a3b-instruct",
	"qwen/qwen3.5-397b-a17b",
	"sarvamai/sarvam-m",
	"upstage/solar-10.7b-instruct",
]);
/** 常量 ZAI_TOOL_STREAM_UNSUPPORTED_MODELS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const ZAI_TOOL_STREAM_UNSUPPORTED_MODELS = new Set(["glm-4.5", "glm-4.5-air", "glm-4.5-flash", "glm-4.5v"]);
/** 常量 ZAI_GLM52_THINKING_LEVEL_MAP 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const ZAI_GLM52_THINKING_LEVEL_MAP = {
	minimal: null,
	low: "high",
	medium: "high",
	high: "high",
	max: "max",
} as const;
/** 常量 OPENCODE_GO_GLM52_THINKING_LEVEL_MAP 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const OPENCODE_GO_GLM52_THINKING_LEVEL_MAP = {
	off: null,
	minimal: null,
	low: null,
	medium: null,
	high: "high",
	max: "max",
} as const;
/** 常量 EAGER_TOOL_INPUT_STREAMING_UNSUPPORTED_ANTHROPIC_MODELS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const EAGER_TOOL_INPUT_STREAMING_UNSUPPORTED_ANTHROPIC_MODELS = new Set([
	"github-copilot:claude-haiku-4.5",
	"github-copilot:claude-sonnet-4",
	"github-copilot:claude-sonnet-4.5",
]);

/** 常量 DEEPSEEK_V4_THINKING_LEVEL_MAP 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const DEEPSEEK_V4_THINKING_LEVEL_MAP = {
	minimal: null,
	low: null,
	medium: null,
	high: "high",
	max: "max",
} as const;

/** 常量 KIMI_K3_MAX_TOKENS 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const KIMI_K3_MAX_TOKENS = 131072;
/** 常量 KIMI_K3_COST 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const KIMI_K3_COST = {
	input: 3,
	output: 15,
	cacheRead: 0.3,
	cacheWrite: 0,
} as const;
// Kimi Coding is subscription-backed, so models.dev reports zero cost. Use the
// equivalent Moonshot API rates to estimate the value of subscription usage.
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
const KIMI_CODING_IMPLIED_COSTS: Record<string, Model<Api>["cost"]> = {
	k3: KIMI_K3_COST,
	"kimi-for-coding": { input: 0.95, output: 4, cacheRead: 0.19, cacheWrite: 0 },
	"kimi-for-coding-highspeed": { input: 1.9, output: 8, cacheRead: 0.38, cacheWrite: 0 },
	"kimi-k2-thinking": { input: 0.6, output: 2.5, cacheRead: 0.15, cacheWrite: 0 },
};
/** 常量 OPENROUTER_KIMI_K3_MODEL_IDS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const OPENROUTER_KIMI_K3_MODEL_IDS = new Set(["moonshotai/kimi-k3", "~moonshotai/kimi-latest"]);

/** 常量 ANT_LING_RING_THINKING_LEVEL_MAP 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const ANT_LING_RING_THINKING_LEVEL_MAP = {
	off: null,
	minimal: null,
	low: null,
	medium: null,
	high: "high",
	xhigh: "xhigh",
} as const;

/** 常量 BEDROCK_INFERENCE_PROFILE_ONLY_MODEL_IDS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const BEDROCK_INFERENCE_PROFILE_ONLY_MODEL_IDS = new Set(["anthropic.claude-opus-5"]);
/** 常量 MODELS_DEV_OPENAI_UNSUPPORTED_MODEL_IDS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const MODELS_DEV_OPENAI_UNSUPPORTED_MODEL_IDS = new Set(["gpt-5.6"]);
/** 常量 OPENAI_TOOL_SEARCH_MODEL_IDS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const OPENAI_TOOL_SEARCH_MODEL_IDS = new Set([
	"gpt-5.4",
	"gpt-5.4-mini",
	"gpt-5.4-pro",
	"gpt-5.5",
	"gpt-5.6-sol",
	"gpt-5.6-terra",
	"gpt-5.6-luna",
]);
/** 常量 OPENAI_LONG_CONTEXT_INPUT_THRESHOLD 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const OPENAI_LONG_CONTEXT_INPUT_THRESHOLD = 272000;
/** 常量 OPENAI_SHORT_CONTEXT_CAPPED_MODEL_IDS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const OPENAI_SHORT_CONTEXT_CAPPED_MODEL_IDS = new Set([
	"gpt-5.4",
	"gpt-5.5",
	"gpt-5.6-sol",
	"gpt-5.6-terra",
	"gpt-5.6-luna",
]);
/** 常量 OPENAI_LONG_CONTEXT_PRICING_MODEL_IDS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const OPENAI_LONG_CONTEXT_PRICING_MODEL_IDS = new Set([
	"gpt-5.4",
	"gpt-5.4-pro",
	"gpt-5.5",
	"gpt-5.5-pro",
	"gpt-5.6-sol",
	"gpt-5.6-terra",
	"gpt-5.6-luna",
]);

/** withOpenAiLongContextPricing 执行当前测试辅助步骤；参数 cost 按签名提供输入，返回值供调用方断言。示例：withOpenAiLongContextPricing(...)。 */
function withOpenAiLongContextPricing(cost: Model<Api>["cost"]): Model<Api>["cost"] {
	return {
		...cost,
		tiers: [
			{
				inputTokensAbove: OPENAI_LONG_CONTEXT_INPUT_THRESHOLD,
				input: cost.input * 2,
				output: cost.output * 1.5,
				cacheRead: cost.cacheRead * 2,
				cacheWrite: cost.cacheWrite * 2,
			},
		],
	};
}

/** 常量 OPENAI_RESPONSES_NONE_REASONING_MODELS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const OPENAI_RESPONSES_NONE_REASONING_MODELS = new Set([
	"gpt-5.1",
	"gpt-5.2",
	"gpt-5.3-codex",
	"gpt-5.4",
	"gpt-5.4-mini",
	"gpt-5.4-nano",
	"gpt-5.5",
	"gpt-5.6-sol",
	"gpt-5.6-terra",
	"gpt-5.6-luna",
]);
/** 常量 XAI_RESPONSES_MODEL_ID 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const XAI_RESPONSES_MODEL_ID = "grok-4.5";
/** 常量 XAI_BUILTIN_EXCLUDED_MODEL_IDS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const XAI_BUILTIN_EXCLUDED_MODEL_IDS = new Set([
	"grok-3",
	"grok-3-fast",
	"grok-4.20-0309-non-reasoning",
	"grok-4.20-0309-reasoning",
	"grok-code-fast-1",
]);
/** 常量 XAI_RESPONSES_EFFORT_LEVEL_MAP 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const XAI_RESPONSES_EFFORT_LEVEL_MAP = {
	off: null,
	minimal: null,
} as const;
/** 常量 XAI_RESPONSES_COMPAT 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const XAI_RESPONSES_COMPAT: OpenAIResponsesCompat = {
	supportsLongCacheRetention: false,
};

/** 常量 OPENCODE_OPENAI_COMPLETIONS_LONG_CACHE_RETENTION_UNSUPPORTED_MODELS 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const OPENCODE_OPENAI_COMPLETIONS_LONG_CACHE_RETENTION_UNSUPPORTED_MODELS = new Set([
	"opencode:deepseek-v4-flash",
	"opencode:deepseek-v4-pro",
	"opencode:kimi-k2.5",
	"opencode:kimi-k2.6",
	"opencode:minimax-m2.7",
	"opencode-go:kimi-k2.6",
]);

// GitHub's "Models with extended capabilities" table lists these Copilot models as supporting
// the extended 1 million token context window.
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
const GITHUB_COPILOT_EXTENDED_CONTEXT_MODELS = new Set([
	"claude-fable-5",
	"claude-opus-4.6",
	"claude-opus-4.7",
	"claude-opus-4.8",
	"claude-sonnet-4.6",
	"claude-sonnet-5",
	"gpt-5.3-codex",
	"gpt-5.4",
	"gpt-5.5",
]);

// Checked manually against the authenticated GitHub Copilot /models endpoint on 2026-06-15.
// Keep this to narrow corrections over models.dev metadata instead of snapshotting Copilot's catalog.
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
const GITHUB_COPILOT_THINKING_LEVEL_OVERRIDES = {
	"claude-opus-4.7": { minimal: "low" },
	"claude-opus-4.8": { minimal: "low" },
	"claude-sonnet-4.6": { minimal: "low", max: "max" },
} satisfies Record<string, NonNullable<Model<Api>["thinkingLevelMap"]>>;

/** mergeThinkingLevelMap 执行当前测试辅助步骤；参数 model、map 按签名提供输入，返回值供调用方断言。示例：mergeThinkingLevelMap(..., ...)。 */
function mergeThinkingLevelMap(model: Model<any>, map: NonNullable<Model<any>["thinkingLevelMap"]>): void {
	model.thinkingLevelMap = { ...model.thinkingLevelMap, ...map };
}

/** 常量 modelsDevReasoningOptions 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const modelsDevReasoningOptions = new Map<string, ModelsDevReasoningOption[]>();

/** getModelKey 执行当前测试辅助步骤；参数 model、"provider" | "id"> 按签名提供输入，返回值供调用方断言。示例：getModelKey(..., ...)。 */
function getModelKey(model: Pick<Model<Api>, "provider" | "id">): string {
	return `${model.provider}:${model.id}`;
}

/** recordModelsDevReasoningOptions 执行当前测试辅助步骤；参数 provider、id、sourceModel 按签名提供输入，返回值供调用方断言。示例：recordModelsDevReasoningOptions(..., ..., ...)。 */
function recordModelsDevReasoningOptions(provider: string, id: string, sourceModel: ModelsDevModel): void {
	if (sourceModel.reasoning_options !== undefined) {
		modelsDevReasoningOptions.set(`${provider}:${id}`, sourceModel.reasoning_options);
	}
}

/** supportsDirectReasoningEffort 执行当前测试辅助步骤；参数 model 按签名提供输入，返回值供调用方断言。示例：supportsDirectReasoningEffort(...)。 */
function supportsDirectReasoningEffort(model: Model<Api>): boolean {
	if (model.api === "anthropic-messages") return model.compat?.forceAdaptiveThinking === true;
	if (
		model.api === "openai-responses" ||
		model.api === "azure-openai-responses" ||
		model.api === "openai-codex-responses"
	) {
		return true;
	}
	if (model.api !== "openai-completions") return false;

	/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const compat = {
		...detectOpenAICompletionsCompat(model as Model<"openai-completions">),
		...(model.compat as OpenAICompletionsCompat | undefined),
	};
	return compat.thinkingFormat === "openai" && compat.supportsReasoningEffort;
}

/** applyModelsDevReasoningOptionMetadata 执行当前测试辅助步骤；参数 model 按签名提供输入，返回值供调用方断言。示例：applyModelsDevReasoningOptionMetadata(...)。 */
function applyModelsDevReasoningOptionMetadata(model: Model<Api>): void {
	/** 常量 reasoningOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const reasoningOptions = modelsDevReasoningOptions.get(getModelKey(model));
	if (!reasoningOptions || !supportsDirectReasoningEffort(model)) return;
	/** 常量 thinkingLevelMap 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const thinkingLevelMap = getEffortThinkingLevelMap(reasoningOptions);
	if (thinkingLevelMap) mergeThinkingLevelMap(model, thinkingLevelMap);
}

/** getTogetherCompat 执行当前测试辅助步骤；参数 modelId、reasoning 按签名提供输入，返回值供调用方断言。示例：getTogetherCompat(..., ...)。 */
function getTogetherCompat(modelId: string, reasoning: boolean): OpenAICompletionsCompat {
	if (!reasoning) return TOGETHER_BASE_COMPAT;
	if (TOGETHER_REASONING_EFFORT_MODELS.has(modelId)) return TOGETHER_REASONING_EFFORT_COMPAT;
	if (TOGETHER_TOGGLE_REASONING_EFFORT_MODELS.has(modelId)) return TOGETHER_TOGGLE_REASONING_EFFORT_COMPAT;
	if (TOGETHER_REASONING_ONLY_MODELS.has(modelId)) return TOGETHER_BASE_COMPAT;
	return TOGETHER_TOGGLE_REASONING_COMPAT;
}

/** getTogetherThinkingLevelMap 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：getTogetherThinkingLevelMap()。 */
function getTogetherThinkingLevelMap(
	modelId: string,
	reasoning: boolean,
): NonNullable<Model<any>["thinkingLevelMap"]> | undefined {
	if (!reasoning) return undefined;
	if (TOGETHER_REASONING_EFFORT_MODELS.has(modelId)) return { ...TOGETHER_REASONING_EFFORT_LEVEL_MAP };
	if (TOGETHER_TOGGLE_REASONING_EFFORT_MODELS.has(modelId)) return { ...TOGETHER_DEEPSEEK_V4_THINKING_LEVEL_MAP };
	if (TOGETHER_REASONING_ONLY_MODELS.has(modelId)) return { ...TOGETHER_FIXED_REASONING_LEVEL_MAP };
	return { ...TOGETHER_TOGGLE_REASONING_LEVEL_MAP };
}

/** supportsOpenAiXhigh 执行当前测试辅助步骤；参数 modelId 按签名提供输入，返回值供调用方断言。示例：supportsOpenAiXhigh(...)。 */
function supportsOpenAiXhigh(modelId: string): boolean {
	return (
		modelId.includes("gpt-5.2") ||
		modelId.includes("gpt-5.3") ||
		modelId.includes("gpt-5.4") ||
		modelId.includes("gpt-5.5") ||
		modelId.includes("gpt-5.6")
	);
}

/** supportsOpenAiMax 执行当前测试辅助步骤；参数 model 按签名提供输入，返回值供调用方断言。示例：supportsOpenAiMax(...)。 */
function supportsOpenAiMax(model: Model<Api>): boolean {
	return (
		model.id.includes("gpt-5.6") &&
		(model.api === "openai-responses" ||
			model.api === "azure-openai-responses" ||
			model.api === "openai-codex-responses" ||
			model.api === "openai-completions")
	);
}

/** isGoogleThinkingApi 执行当前测试辅助步骤；参数 model 按签名提供输入，返回值供调用方断言。示例：isGoogleThinkingApi(...)。 */
function isGoogleThinkingApi(model: Model<any>): boolean {
	return model.api === "google-generative-ai" || model.api === "google-vertex";
}

/** isAnthropicAdaptiveThinkingModel 执行当前测试辅助步骤；参数 modelId 按签名提供输入，返回值供调用方断言。示例：isAnthropicAdaptiveThinkingModel(...)。 */
function isAnthropicAdaptiveThinkingModel(modelId: string): boolean {
	return (
		modelId.includes("opus-4-6") ||
		modelId.includes("opus-4.6") ||
		modelId.includes("opus-4-7") ||
		modelId.includes("opus-4.7") ||
		modelId.includes("opus-4-8") ||
		modelId.includes("opus-4.8") ||
		modelId.includes("opus-5") ||
		modelId.includes("opus.5") ||
		modelId.includes("sonnet-4-6") ||
		modelId.includes("sonnet-4.6") ||
		modelId.includes("sonnet-5") ||
		modelId.includes("sonnet.5") ||
		modelId.includes("fable-5")
	);
}

/** isAnthropicTemperatureUnsupportedModel 执行当前测试辅助步骤；参数 modelId 按签名提供输入，返回值供调用方断言。示例：isAnthropicTemperatureUnsupportedModel(...)。 */
function isAnthropicTemperatureUnsupportedModel(modelId: string): boolean {
	/** 常量 id 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const id = modelId.toLowerCase();
	return (
		id.includes("opus-4-7") ||
		id.includes("opus-4.7") ||
		id.includes("opus-4-8") ||
		id.includes("opus-4.8") ||
		id.includes("opus-5") ||
		id.includes("opus.5")
	);
}

/** 常量 OPENAI_COMPLETIONS_DEFAULT_COMPAT 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const OPENAI_COMPLETIONS_DEFAULT_COMPAT = {
	supportsStore: true,
	supportsDeveloperRole: true,
	supportsReasoningEffort: true,
	supportsUsageInStreaming: true,
	maxTokensField: "max_completion_tokens",
	requiresToolResultName: false,
	requiresAssistantAfterToolResult: false,
	requiresThinkingAsText: false,
	requiresReasoningContentOnAssistantMessages: false,
	thinkingFormat: "openai",
	openRouterRouting: {},
	vercelGatewayRouting: {},
	chatTemplateKwargs: {},
	zaiToolStream: false,
	supportsStrictMode: true,
	supportsOpenAIGrammarTools: false,
	sendSessionAffinityHeaders: false,
	supportsLongCacheRetention: true,
} satisfies Required<Omit<OpenAICompletionsCompat, "cacheControlFormat" | "deferredToolsMode">> & {
	cacheControlFormat?: OpenAICompletionsCompat["cacheControlFormat"];
	deferredToolsMode?: OpenAICompletionsCompat["deferredToolsMode"];
};

type OpenAICompletionsResolvedCompat = typeof OPENAI_COMPLETIONS_DEFAULT_COMPAT & {
	cacheControlFormat?: OpenAICompletionsCompat["cacheControlFormat"];
};

/** mergeAnthropicMessagesCompat 执行当前测试辅助步骤；参数 model、compat 按签名提供输入，返回值供调用方断言。示例：mergeAnthropicMessagesCompat(..., ...)。 */
function mergeAnthropicMessagesCompat(model: Model<Api>, compat: AnthropicMessagesCompat): void {
	model.compat = { ...(model.compat as AnthropicMessagesCompat | undefined), ...compat };
}

/** detectOpenAICompletionsCompat 执行当前测试辅助步骤；参数 model 按签名提供输入，返回值供调用方断言。示例：detectOpenAICompletionsCompat(...)。 */
function detectOpenAICompletionsCompat(model: Model<"openai-completions">): OpenAICompletionsResolvedCompat {
	/** 常量 provider 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const provider = model.provider;
	/** 常量 baseUrl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const baseUrl = model.baseUrl;

	/** 常量 isZai 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isZai =
		provider === "zai" ||
		provider === "zai-coding-cn" ||
		baseUrl.includes("api.z.ai") ||
		baseUrl.includes("open.bigmodel.cn");
	/** 常量 isTogether 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isTogether =
		provider === "together" || baseUrl.includes("api.together.ai") || baseUrl.includes("api.together.xyz");
	/** 常量 isMoonshot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isMoonshot = provider === "moonshotai" || provider === "moonshotai-cn" || baseUrl.includes("api.moonshot.");
	/** 常量 isOpenRouter 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isOpenRouter = provider === "openrouter" || baseUrl.includes("openrouter.ai");
	/** 常量 isCloudflareWorkersAI 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isCloudflareWorkersAI = provider === "cloudflare-workers-ai" || baseUrl.includes("api.cloudflare.com");
	/** 常量 isCloudflareAiGateway 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isCloudflareAiGateway = provider === "cloudflare-ai-gateway" || baseUrl.includes("gateway.ai.cloudflare.com");
	/** 常量 isNvidia 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isNvidia = provider === "nvidia" || baseUrl.includes("integrate.api.nvidia.com");
	/** 常量 isAntLing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isAntLing = provider === "ant-ling" || baseUrl.includes("api.ant-ling.com");
	/** 常量 isTogetherReasoningOnly 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isTogetherReasoningOnly = isTogether && TOGETHER_REASONING_ONLY_MODELS.has(model.id);

	/** 常量 isNonStandard 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isNonStandard =
		isNvidia ||
		provider === "cerebras" ||
		baseUrl.includes("cerebras.ai") ||
		provider === "xai" ||
		baseUrl.includes("api.x.ai") ||
		isTogether ||
		baseUrl.includes("chutes.ai") ||
		baseUrl.includes("deepseek.com") ||
		isZai ||
		isMoonshot ||
		provider === "opencode" ||
		baseUrl.includes("opencode.ai") ||
		isCloudflareWorkersAI ||
		isCloudflareAiGateway ||
		isAntLing;

	/** 常量 useMaxTokens 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const useMaxTokens =
		baseUrl.includes("chutes.ai") || isMoonshot || isCloudflareAiGateway || isTogether || isNvidia || isAntLing;

	/** 常量 isGrok 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isGrok = provider === "xai" || baseUrl.includes("api.x.ai");
	/** 常量 isDeepSeek 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isDeepSeek = provider === "deepseek" || baseUrl.includes("deepseek.com");
	/** 常量 isOpenRouterDeveloperRoleModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isOpenRouterDeveloperRoleModel =
		isOpenRouter && (model.id.startsWith("anthropic/") || model.id.startsWith("openai/"));
	/** 常量 cacheControlFormat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const cacheControlFormat =
		provider === "openrouter" && /^~?anthropic\//.test(model.id) ? "anthropic" : undefined;

	return {
		supportsStore: !isNonStandard,
		supportsDeveloperRole: isOpenRouterDeveloperRoleModel || (!isNonStandard && !isOpenRouter),
		supportsReasoningEffort:
			!isGrok && !isZai && !isMoonshot && !isTogether && !isCloudflareAiGateway && !isNvidia && !isAntLing,
		supportsUsageInStreaming: true,
		maxTokensField: useMaxTokens ? "max_tokens" : "max_completion_tokens",
		requiresToolResultName: false,
		requiresAssistantAfterToolResult: false,
		requiresThinkingAsText: false,
		requiresReasoningContentOnAssistantMessages: isDeepSeek,
		thinkingFormat: isDeepSeek
			? "deepseek"
			: isZai
				? "zai"
				: isTogether && !isTogetherReasoningOnly
					? "together"
					: isAntLing
						? "ant-ling"
						: isOpenRouter
							? "openrouter"
							: "openai",
		openRouterRouting: {},
		vercelGatewayRouting: {},
		chatTemplateKwargs: {},
		zaiToolStream: false,
		supportsStrictMode: !isMoonshot && !isTogether && !isCloudflareAiGateway && !isNvidia,
		supportsOpenAIGrammarTools: false,
		...(cacheControlFormat ? { cacheControlFormat } : {}),
		sendSessionAffinityHeaders: false,
		supportsLongCacheRetention: !(
			isTogether ||
			isCloudflareWorkersAI ||
			isCloudflareAiGateway ||
			isNvidia ||
			isAntLing
		),
	};
}

/** isPlainEmptyObject 执行当前测试辅助步骤；参数 value 按签名提供输入，返回值供调用方断言。示例：isPlainEmptyObject(...)。 */
function isPlainEmptyObject(value: unknown): boolean {
	return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
}

/** openAICompletionsCompatDelta 执行当前测试辅助步骤；参数 compat 按签名提供输入，返回值供调用方断言。示例：openAICompletionsCompatDelta(...)。 */
function openAICompletionsCompatDelta(compat: OpenAICompletionsResolvedCompat): OpenAICompletionsCompat {
	/** 常量 delta 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const delta: OpenAICompletionsCompat = {};
	/** 循环变量 [key, 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const [key, value] of Object.entries(compat)) {
		/** 常量 defaultValue 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const defaultValue = OPENAI_COMPLETIONS_DEFAULT_COMPAT[key as keyof typeof OPENAI_COMPLETIONS_DEFAULT_COMPAT];
		if (isPlainEmptyObject(value) && isPlainEmptyObject(defaultValue)) continue;
		if (value !== defaultValue) {
			(delta as Record<string, unknown>)[key] = value;
		}
	}
	return delta;
}

/** mergeOpenAICompletionsCompat 执行当前测试辅助步骤；参数 model、compat 按签名提供输入，返回值供调用方断言。示例：mergeOpenAICompletionsCompat(..., ...)。 */
function mergeOpenAICompletionsCompat(model: Model<Api>, compat: OpenAICompletionsCompat): void {
	model.compat = { ...(model.compat as OpenAICompletionsCompat | undefined), ...compat };
}

/** applyOpenAICompletionsCompatMetadata 执行当前测试辅助步骤；参数 model 按签名提供输入，返回值供调用方断言。示例：applyOpenAICompletionsCompatMetadata(...)。 */
function applyOpenAICompletionsCompatMetadata(model: Model<Api>): void {
	if (model.api !== "openai-completions") return;
	/** 常量 detected 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const detected = openAICompletionsCompatDelta(detectOpenAICompletionsCompat(model as Model<"openai-completions">));
	model.compat = { ...detected, ...(model.compat as OpenAICompletionsCompat | undefined) };
	if (Object.keys(model.compat).length === 0) {
		delete model.compat;
	}
}

/** applyStrictToolCompatMetadata 执行当前测试辅助步骤；参数 model 按签名提供输入，返回值供调用方断言。示例：applyStrictToolCompatMetadata(...)。 */
function applyStrictToolCompatMetadata(model: Model<Api>): void {
	if (model.provider === "openai" && model.api === "openai-responses") {
		model.compat = { ...(model.compat as OpenAIResponsesCompat | undefined), supportsStrictMode: true };
	} else if (model.provider === "anthropic" && model.api === "anthropic-messages") {
		mergeAnthropicMessagesCompat(model, { supportsStrictTools: true });
	}
}

// Responses endpoints verified (OpenAI, ChatGPT Codex backend, GitHub Copilot,
// opencode zen) or documented (Azure OpenAI, Cloudflare AI Gateway) to pass
// OpenAI custom grammar tools through. OpenAI rejects `type: "custom"` tools
// for pre-GPT-5 models (gpt-4.x, gpt-4o, o-series).
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
const OPENAI_GRAMMAR_TOOL_PROVIDERS = new Set([
	"openai",
	"openai-codex",
	"azure-openai-responses",
	"github-copilot",
	"opencode",
	"cloudflare-ai-gateway",
]);
/** 常量 OPENAI_GRAMMAR_TOOL_APIS 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const OPENAI_GRAMMAR_TOOL_APIS = new Set<Api>([
	"openai-responses",
	"azure-openai-responses",
	"openai-codex-responses",
]);

/** applyOpenAIGrammarToolCompatMetadata 执行当前测试辅助步骤；参数 model 按签名提供输入，返回值供调用方断言。示例：applyOpenAIGrammarToolCompatMetadata(...)。 */
function applyOpenAIGrammarToolCompatMetadata(model: Model<Api>): void {
	if (!OPENAI_GRAMMAR_TOOL_APIS.has(model.api) || !OPENAI_GRAMMAR_TOOL_PROVIDERS.has(model.provider)) return;
	/** 常量 match 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const match = /^gpt-(\d+)/.exec(model.id);
	if (!match || Number(match[1]) < 5) return;
	model.compat = { ...(model.compat as OpenAIResponsesCompat | undefined), supportsOpenAIGrammarTools: true };
}

/** applyOpenAIToolSearchMetadata 执行当前测试辅助步骤；参数 model 按签名提供输入，返回值供调用方断言。示例：applyOpenAIToolSearchMetadata(...)。 */
function applyOpenAIToolSearchMetadata(model: Model<Api>): void {
	/** 常量 isOpenAIResponses 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isOpenAIResponses = model.provider === "openai" && model.api === "openai-responses";
	/** 常量 isOpenAICodex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isOpenAICodex = model.provider === "openai-codex" && model.api === "openai-codex-responses";
	if (!(isOpenAIResponses || isOpenAICodex) || !OPENAI_TOOL_SEARCH_MODEL_IDS.has(model.id)) return;
	model.compat = {
		...(model.compat as OpenAIResponsesCompat | undefined),
		supportsToolSearch: true,
	};
}

// OpenAI charges prompt-cache writes starting with the GPT-5.6 family, and exactly
// those models accept `prompt_cache_options`; older models reject the parameter.
// https://developers.openai.com/api/docs/guides/prompt-caching
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
function applyOpenAIExplicitPromptCacheMetadata(model: Model<Api>): void {
	if (model.provider !== "openai" || model.api !== "openai-responses") return;
	if (!(model.cost.cacheWrite > 0)) return;
	model.compat = {
		...(model.compat as OpenAIResponsesCompat | undefined),
		supportsExplicitPromptCacheMode: true,
	};
}

/** isGemini3ProModel 执行当前测试辅助步骤；参数 modelId 按签名提供输入，返回值供调用方断言。示例：isGemini3ProModel(...)。 */
function isGemini3ProModel(modelId: string): boolean {
	return /gemini-3(?:\.\d+)?-pro/.test(modelId.toLowerCase());
}

/** isGemini3FlashModel 执行当前测试辅助步骤；参数 modelId 按签名提供输入，返回值供调用方断言。示例：isGemini3FlashModel(...)。 */
function isGemini3FlashModel(modelId: string): boolean {
	/** 常量 id 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const id = modelId.toLowerCase();
	return /gemini-3(?:\.\d+)?-flash/.test(id) || id === "gemini-flash-latest" || id === "gemini-flash-lite-latest";
}

/** isGemma4Model 执行当前测试辅助步骤；参数 modelId 按签名提供输入，返回值供调用方断言。示例：isGemma4Model(...)。 */
function isGemma4Model(modelId: string): boolean {
	return /gemma-?4/.test(modelId.toLowerCase());
}

/** applyThinkingLevelMetadata 执行当前测试辅助步骤；参数 model 按签名提供输入，返回值供调用方断言。示例：applyThinkingLevelMetadata(...)。 */
function applyThinkingLevelMetadata(model: Model<any>): void {
	if (
		(model.api === "openai-responses" || model.api === "azure-openai-responses") &&
		model.id.startsWith("gpt-5")
	) {
		mergeThinkingLevelMap(model, { off: null });
	}
	if (model.provider === "github-copilot" && model.id.startsWith("gpt-5")) {
		mergeThinkingLevelMap(model, { minimal: "low" });
	}
	if (
		model.api === "openai-responses" &&
		model.provider === "openai" &&
		OPENAI_RESPONSES_NONE_REASONING_MODELS.has(model.id)
	) {
		mergeThinkingLevelMap(model, { off: "none" });
	}
	if (model.provider === "xai" && model.api === "openai-responses" && model.id === XAI_RESPONSES_MODEL_ID) {
		mergeThinkingLevelMap(model, XAI_RESPONSES_EFFORT_LEVEL_MAP);
	}
	if (supportsOpenAiXhigh(model.id)) {
		mergeThinkingLevelMap(model, { xhigh: "xhigh" });
	}
	if (supportsOpenAiMax(model)) {
		mergeThinkingLevelMap(model, { max: "max" });
	}
	if (model.provider === "openai" && model.id === "gpt-5.5") {
		mergeThinkingLevelMap(model, { minimal: null });
	}
	if (model.id.endsWith("gpt-5.5-pro")) {
		mergeThinkingLevelMap(model, { off: null, minimal: null, low: null });
	}
	// Anthropic adaptive-thinking effort support (per Anthropic adaptive thinking docs):
	// - "max" is available on all adaptive-thinking Claude models.
	// - "xhigh" is only available on Opus 4.7/4.8/5, Sonnet 5, and Fable 5.
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	if (
		model.id.includes("opus-4-6") ||
		model.id.includes("opus-4.6") ||
		model.id.includes("sonnet-4-6") ||
		model.id.includes("sonnet-4.6")
	) {
		mergeThinkingLevelMap(model, { max: "max" });
	}
	if (
		model.id.includes("opus-4-7") ||
		model.id.includes("opus-4.7") ||
		model.id.includes("opus-4-8") ||
		model.id.includes("opus-4.8") ||
		model.id.includes("opus-5") ||
		model.id.includes("opus.5") ||
		model.id.includes("sonnet-5") ||
		model.id.includes("sonnet.5")
	) {
		mergeThinkingLevelMap(model, { xhigh: "xhigh", max: "max" });
	}
	if (model.id.includes("fable-5")) {
		mergeThinkingLevelMap(model, { off: null, xhigh: "xhigh", max: "max" });
	}
	if (model.api === "anthropic-messages" && isAnthropicAdaptiveThinkingModel(model.id)) {
		mergeAnthropicMessagesCompat(model, { forceAdaptiveThinking: true });
	}
	if (model.api === "anthropic-messages" && isAnthropicTemperatureUnsupportedModel(model.id)) {
		mergeAnthropicMessagesCompat(model, { supportsTemperature: false });
	}
	if (model.api === "openai-completions" && model.id.includes("deepseek-v4")) {
		mergeThinkingLevelMap(
			model,
			model.provider === "openrouter"
				? { ...DEEPSEEK_V4_THINKING_LEVEL_MAP, xhigh: "xhigh", max: null }
				: DEEPSEEK_V4_THINKING_LEVEL_MAP,
		);
	}
	if (isGoogleThinkingApi(model) && isGemini3ProModel(model.id)) {
		mergeThinkingLevelMap(model, { off: null, minimal: null, low: "LOW", medium: null, high: "HIGH" });
	}
	if (isGoogleThinkingApi(model) && isGemini3FlashModel(model.id)) {
		mergeThinkingLevelMap(model, { off: null });
	}
	if (isGoogleThinkingApi(model) && isGemma4Model(model.id)) {
		mergeThinkingLevelMap(model, { off: null, minimal: "MINIMAL", low: null, medium: null, high: "HIGH" });
	}
	if (model.provider === "groq" && model.id === "qwen/qwen3-32b") {
		mergeThinkingLevelMap(model, { minimal: null, low: null, medium: null, high: "default" });
	}
	if (model.provider === "openai-codex" && supportsOpenAiXhigh(model.id)) {
		mergeThinkingLevelMap(model, { minimal: "low" });
	}
	if (
		(model.provider === "moonshotai" || model.provider === "moonshotai-cn") &&
		(model.id === "kimi-k2.7-code" || model.id === "kimi-k2.7-code-highspeed")
	) {
		// Kimi K2.7 Code is always-thinking. Official docs say
		// `thinking: { type: "disabled" }` is rejected, and callers can omit
		// the thinking parameter to use the enabled default.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		mergeThinkingLevelMap(model, { off: null });
	}
	if (model.provider === "openrouter" && model.id.startsWith("inception/mercury-2")) {
		// Mercury 2 in instant mode (reasoning_effort: "none") disables tool calling.
		// Mark "off" unsupported so the openai-completions provider omits the reasoning param
		// instead of defaulting to {reasoning:{effort:"none"}} (see openai-completions.ts:575).
		// Pi's low/medium/high pass through verbatim; OpenRouter normalizes to Mercury's vocabulary.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		mergeThinkingLevelMap(model, { off: null });
	}
	if (model.provider === "openrouter" && model.id === "z-ai/glm-5.2") {
		mergeThinkingLevelMap(model, { xhigh: "xhigh" });
	}
	if (model.provider === "fireworks" && model.id.includes("glm-5p2")) {
		mergeThinkingLevelMap(model, { off: "none", minimal: null, low: "high", medium: "high", max: "max" });
	}
	if (model.provider === "opencode-go" && model.id === "glm-5.2") {
		mergeThinkingLevelMap(model, OPENCODE_GO_GLM52_THINKING_LEVEL_MAP);
	}
	if (model.provider === "opencode-go" && model.id === "kimi-k2.6") {
		// OpenCode Go exposes Kimi K2.6 thinking as on/off, not distinct effort tiers.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		mergeThinkingLevelMap(model, { minimal: null, low: null, medium: null });
	}
	if (model.provider === "opencode" && model.id === "grok-build-0.1") {
		// OpenCode Zen Grok Build reasons by default but rejects explicit reasoningEffort.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		mergeThinkingLevelMap(model, { off: null, minimal: null, low: null, medium: null });
	}
	if (model.provider === "ant-ling" && model.reasoning) {
		// Ring reasons by default. Only high/xhigh have documented explicit effort controls.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		mergeThinkingLevelMap(model, ANT_LING_RING_THINKING_LEVEL_MAP);
	}
	if (model.provider === "github-copilot") {
		/** 常量 override 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const override = GITHUB_COPILOT_THINKING_LEVEL_OVERRIDES[model.id];
		if (override) {
			mergeThinkingLevelMap(model, override);
		}
	}
}

/** getAnthropicMessagesCompat 执行当前测试辅助步骤；参数 provider、modelId 按签名提供输入，返回值供调用方断言。示例：getAnthropicMessagesCompat(..., ...)。 */
function getAnthropicMessagesCompat(provider: string, modelId: string): AnthropicMessagesCompat | undefined {
	/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const compat: AnthropicMessagesCompat = {};
	if (EAGER_TOOL_INPUT_STREAMING_UNSUPPORTED_ANTHROPIC_MODELS.has(`${provider}:${modelId}`)) {
		compat.supportsEagerToolInputStreaming = false;
	}
	if (provider === "xiaomi" || provider.startsWith("xiaomi-token-plan-")) {
		compat.allowEmptySignature = true;
	}
	return Object.keys(compat).length > 0 ? compat : undefined;
}

/** getBedrockBaseUrl 执行当前测试辅助步骤；参数 modelId 按签名提供输入，返回值供调用方断言。示例：getBedrockBaseUrl(...)。 */
function getBedrockBaseUrl(modelId: string): string {
	return modelId.startsWith("eu.")
		? "https://bedrock-runtime.eu-central-1.amazonaws.com"
		: "https://bedrock-runtime.us-east-1.amazonaws.com";
}

/** normalizeNvidiaModelId 执行当前测试辅助步骤；参数 modelId 按签名提供输入，返回值供调用方断言。示例：normalizeNvidiaModelId(...)。 */
function normalizeNvidiaModelId(modelId: string): string {
	return modelId.toLowerCase().replaceAll("_", ".");
}

/** roundCost 执行当前测试辅助步骤；参数 value 按签名提供输入，返回值供调用方断言。示例：roundCost(...)。 */
function roundCost(value: number): number {
	return Number(value.toFixed(6));
}

/** getModelsDevCost 执行当前测试辅助步骤；参数 cost 按签名提供输入，返回值供调用方断言。示例：getModelsDevCost(...)。 */
function getModelsDevCost(cost: ModelsDevModel["cost"]): ModelCost {
	/** 常量 tiers 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const tiers = cost?.tiers?.flatMap((tier) => {
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context = tier.tier;
		if (context?.type !== "context" || context.size === undefined) return [];
		return [
			{
				inputTokensAbove: context.size,
				input: tier.input || 0,
				output: tier.output || 0,
				cacheRead: tier.cache_read || 0,
				cacheWrite: tier.cache_write || 0,
			},
		];
	});

	return {
		input: cost?.input || 0,
		output: cost?.output || 0,
		cacheRead: cost?.cache_read || 0,
		cacheWrite: cost?.cache_write || 0,
		...(tiers && tiers.length > 0 ? { tiers } : {}),
	};
}

/** fetchNvidiaNimModelIds 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：fetchNvidiaNimModelIds()。 */
async function fetchNvidiaNimModelIds(): Promise<Map<string, string>> {
	try {
		console.log("Fetching models from NVIDIA NIM API...");
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await fetch(`${NVIDIA_BASE_URL}/models`);
		if (!response.ok) throw new Error(`NVIDIA NIM API returned ${response.status}`);
		/** 常量 data 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const data = (await response.json()) as { data?: NvidiaNimModelListItem[] };
		/** 常量 modelIds 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const modelIds = new Map<string, string>();

		/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const model of data.data ?? []) {
			modelIds.set(model.id, model.id);
			modelIds.set(normalizeNvidiaModelId(model.id), model.id);
		}

		console.log(`Fetched ${data.data?.length ?? 0} model IDs from NVIDIA NIM`);
		return modelIds;
	} catch (error) {
		/** error 是 NVIDIA NIM 目录请求异常；严格模式重抛，否则回退为空映射。 */
		console.error("Failed to fetch NVIDIA NIM models:", error);
		if (generatorOptions.strict) throw error;
		return new Map();
	}
}

/** fetchOpenRouterModels 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：fetchOpenRouterModels()。 */
async function fetchOpenRouterModels(): Promise<Model<any>[]> {
	try {
		console.log("Fetching models from OpenRouter API...");
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await fetch("https://openrouter.ai/api/v1/models");
		if (!response.ok) throw new Error(`OpenRouter API returned ${response.status}`);
		/** 常量 data 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const data = await response.json();

		/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const models: Model<any>[] = [];

		/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const model of data.data) {
			// Only include models that support tools
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			if (!model.supported_parameters?.includes("tools")) continue;

			// Parse provider from model ID
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			let provider: KnownProvider = "openrouter";
			/** 变量 modelKey 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let modelKey = model.id;

			modelKey = model.id; // Keep full ID for OpenRouter

			// Parse input modalities
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const input: ("text" | "image")[] = ["text"];
			if (model.architecture?.modality?.includes("image")) {
				input.push("image");
			}

			// Convert pricing from $/token to $/million tokens
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const inputCost = roundCost(parseFloat(model.pricing?.prompt || "0") * 1_000_000);
			/** 常量 outputCost 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const outputCost = roundCost(parseFloat(model.pricing?.completion || "0") * 1_000_000);
			/** 常量 cacheReadCost 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const cacheReadCost = roundCost(parseFloat(model.pricing?.input_cache_read || "0") * 1_000_000);
			/** 常量 cacheWriteCost 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const cacheWriteCost = roundCost(parseFloat(model.pricing?.input_cache_write || "0") * 1_000_000);

			/** 常量 contextWindow 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const contextWindow = model.top_provider?.context_length || model.context_length || 4096;

			/** 常量 normalizedModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const normalizedModel: Model<any> = {
				id: modelKey,
				name: model.name,
				api: "openai-completions",
				baseUrl: "https://openrouter.ai/api/v1",
				provider,
				reasoning: model.supported_parameters?.includes("reasoning") || false,
				input,
				cost: {
					input: inputCost,
					output: outputCost,
					cacheRead: cacheReadCost,
					cacheWrite: cacheWriteCost,
				},
				contextWindow,
				maxTokens: model.top_provider?.max_completion_tokens || 4096,
			};
			models.push(normalizedModel);
		}

		console.log(`Fetched ${models.length} tool-capable models from OpenRouter`);
		return models;
	} catch (error) {
		/** error 是 OpenRouter 目录请求或解析异常；严格模式重抛，否则返回空列表。 */
		console.error("Failed to fetch OpenRouter models:", error);
		if (generatorOptions.strict) throw error;
		return [];
	}
}

/** fetchAiGatewayModels 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：fetchAiGatewayModels()。 */
async function fetchAiGatewayModels(): Promise<Model<any>[]> {
	try {
		console.log("Fetching models from Vercel AI Gateway API...");
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await fetch(`${AI_GATEWAY_MODELS_URL}/models`);
		if (!response.ok) throw new Error(`Vercel AI Gateway API returned ${response.status}`);
		/** 常量 data 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const data = await response.json();
		/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const models: Model<any>[] = [];

		/** 常量 toNumber 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toNumber = (value: string | number | undefined): number => {
			if (typeof value === "number") {
				return Number.isFinite(value) ? value : 0;
			}
			/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed = parseFloat(value ?? "0");
			return Number.isFinite(parsed) ? parsed : 0;
		};

		/** 常量 items 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const items = Array.isArray(data.data) ? (data.data as AiGatewayModel[]) : [];
		/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const model of items) {
			/** 常量 tags 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tags = Array.isArray(model.tags) ? model.tags : [];
			// Only include models that support tools
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			if (!tags.includes("tool-use")) continue;

			/** 常量 input 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const input: ("text" | "image")[] = ["text"];
			if (tags.includes("vision")) {
				input.push("image");
			}

			/** 常量 inputCost 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const inputCost = roundCost(toNumber(model.pricing?.input) * 1_000_000);
			/** 常量 outputCost 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const outputCost = roundCost(toNumber(model.pricing?.output) * 1_000_000);
			/** 常量 cacheReadCost 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const cacheReadCost = roundCost(toNumber(model.pricing?.input_cache_read) * 1_000_000);
			/** 常量 cacheWriteCost 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const cacheWriteCost = roundCost(toNumber(model.pricing?.input_cache_write) * 1_000_000);

			models.push({
				id: model.id,
				name: model.name || model.id,
				api: "anthropic-messages",
				baseUrl: AI_GATEWAY_BASE_URL,
				provider: "vercel-ai-gateway",
				reasoning: tags.includes("reasoning"),
				input,
				cost: {
					input: inputCost,
					output: outputCost,
					cacheRead: cacheReadCost,
					cacheWrite: cacheWriteCost,
				},
				contextWindow: model.context_window || 4096,
				maxTokens: model.max_tokens || 4096,
			});
		}

		console.log(`Fetched ${models.length} tool-capable models from Vercel AI Gateway`);
		return models;
	} catch (error) {
		/** error 是 Vercel AI Gateway 目录请求异常；严格模式重抛，否则返回空列表。 */
		console.error("Failed to fetch Vercel AI Gateway models:", error);
		if (generatorOptions.strict) throw error;
		return [];
	}
}

/** loadModelsDevData 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：loadModelsDevData()。 */
async function loadModelsDevData(): Promise<Model<any>[]> {
	try {
		console.log("Fetching models from models.dev API...");
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await fetch("https://models.dev/api.json");
		if (!response.ok) throw new Error(`models.dev API returned ${response.status}`);
		/** 常量 data 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const data = (await response.json()) as ModelsDevCatalog;

		/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const models: Model<any>[] = [];
		/** 常量 nvidiaNimModelIds 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const nvidiaNimModelIds = data.nvidia?.models ? await fetchNvidiaNimModelIds() : new Map<string, string>();

		// Process Amazon Bedrock models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data["amazon-bedrock"]?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data["amazon-bedrock"].models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;
				if (BEDROCK_INFERENCE_PROFILE_ONLY_MODEL_IDS.has(modelId)) continue;

				/** 变量 id 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let id = modelId;

				if (id.startsWith("ai21.jamba")) {
					// These models doesn't support tool use in streaming mode
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					continue;
				}

				if (id.startsWith("mistral.mistral-7b-instruct-v0")) {
					// These models doesn't support system messages
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					continue;
				}

				models.push({
					id,
					name: m.name || id,
					api: "bedrock-converse-stream" as const,
					provider: "amazon-bedrock" as const,
					baseUrl: getBedrockBaseUrl(id),
					reasoning: m.reasoning === true,
					input: (m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"]) as ("text" | "image")[],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
					...(m.structured_output === true && { compat: { supportsStrictMode: true } }),
				});
				recordModelsDevReasoningOptions("amazon-bedrock" as const, id, m);
			}
		}

		// Process Anthropic models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data.anthropic?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data.anthropic.models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "anthropic-messages",
					provider: "anthropic",
					baseUrl: "https://api.anthropic.com",
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("anthropic", modelId, m);
			}
		}

		// Process Google models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data.google?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data.google.models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;
				/** 变量 source 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let source = m;
				if (modelId === "gemini-flash-latest") {
					source = (data.google.models["gemini-3.5-flash"] as ModelsDevModel | undefined) ?? m;
				}
				if (modelId === "gemini-flash-lite-latest") {
					source = (data.google.models["gemini-3.1-flash-lite"] as ModelsDevModel | undefined) ?? m;
				}

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "google-generative-ai",
					provider: "google",
					baseUrl: "https://generativelanguage.googleapis.com/v1beta",
					reasoning: source.reasoning === true,
					input: source.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: source.cost?.input || 0,
						output: source.cost?.output || 0,
						cacheRead: source.cost?.cache_read || 0,
						cacheWrite: source.cost?.cache_write || 0,
					},
					contextWindow: source.limit?.context || 4096,
					maxTokens: source.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("google", modelId, source);
			}
		}

		// Process Google Vertex Gemini models. The google-vertex models.dev catalog also includes
		// Claude, OpenAI, and other MaaS models that do not use the @google/genai Gemini streaming
		// path implemented by our google-vertex provider.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data["google-vertex"]?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data["google-vertex"].models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;
				if (!modelId.startsWith("gemini-")) continue;
				if (modelId === "gemini-3.1-flash-lite-preview") continue;
				/** 变量 source 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let source = m;
				if (modelId === "gemini-flash-latest") {
					source = (data["google-vertex"].models["gemini-3.5-flash"] as ModelsDevModel | undefined) ?? m;
				}
				if (modelId === "gemini-flash-lite-latest") {
					source = (data["google-vertex"].models["gemini-3.1-flash-lite"] as ModelsDevModel | undefined) ?? m;
				}

				// models.dev reports Vertex cache_read/cache_write values for Gemini 2.5 Flash that
				// do not match the official Gemini API standard pricing table. pi only accounts
				// cachedContentTokenCount as cacheRead.
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				const cacheRead = modelId === "gemini-2.5-flash" ? 0.03 : source.cost?.cache_read || 0;
				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "google-vertex",
					provider: "google-vertex",
					baseUrl: VERTEX_BASE_URL,
					reasoning: source.reasoning === true,
					input: source.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: source.cost?.input || 0,
						output: source.cost?.output || 0,
						cacheRead,
						cacheWrite: 0,
					},
					contextWindow: source.limit?.context || 4096,
					maxTokens: source.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("google-vertex", modelId, source);
			}
		}

		// Process OpenAI models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data.openai?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data.openai.models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;
				// models.dev lists this alias, but it is not accepted by OpenAI APIs.
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				if (MODELS_DEV_OPENAI_UNSUPPORTED_MODEL_IDS.has(modelId)) continue;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "openai-responses",
					provider: "openai",
					baseUrl: "https://api.openai.com/v1",
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("openai", modelId, m);
			}
		}

		// Process Groq models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data.groq?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data.groq.models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "openai-completions",
					provider: "groq",
					baseUrl: "https://api.groq.com/openai/v1",
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("groq", modelId, m);
			}
		}

		// Process Cerebras models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data.cerebras?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data.cerebras.models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "openai-completions",
					provider: "cerebras",
					baseUrl: "https://api.cerebras.ai/v1",
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("cerebras", modelId, m);
			}
		}

		// Process Cloudflare Workers AI models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data["cloudflare-workers-ai"]?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data["cloudflare-workers-ai"].models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "openai-completions",
					provider: "cloudflare-workers-ai",
					baseUrl: CLOUDFLARE_WORKERS_AI_BASE_URL,
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
					compat: { sendSessionAffinityHeaders: true },
				});
				recordModelsDevReasoningOptions("cloudflare-workers-ai", modelId, m);
			}
		}

		// Process Cloudflare AI Gateway models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data["cloudflare-ai-gateway"]?.models) {
			/** 循环变量 [prefixedId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [prefixedId, model] of Object.entries(data["cloudflare-ai-gateway"].models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;

				/** 常量 slashIdx 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const slashIdx = prefixedId.indexOf("/");
				if (slashIdx === -1) continue;
				/** 常量 upstream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const upstream = prefixedId.slice(0, slashIdx);
				/** 常量 nativeId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const nativeId = prefixedId.slice(slashIdx + 1);

				/** 变量 api 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let api: "anthropic-messages" | "openai-completions" | "openai-responses";
				/** 变量 baseUrl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let baseUrl: string;
				/** 变量 id 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let id: string;
				if (upstream === "openai") {
					api = "openai-responses";
					baseUrl = CLOUDFLARE_AI_GATEWAY_OPENAI_BASE_URL;
					id = nativeId;
				} else if (upstream === "anthropic") {
					api = "anthropic-messages";
					baseUrl = CLOUDFLARE_AI_GATEWAY_ANTHROPIC_BASE_URL;
					id = nativeId;
				} else if (upstream === "workers-ai") {
					api = "openai-completions";
					baseUrl = CLOUDFLARE_AI_GATEWAY_COMPAT_BASE_URL;
					id = prefixedId;
				} else {
					continue;
				}

				// Gateway passthroughs forward session affinity headers to upstreams that
				// use them for cache/routing affinity.
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				const compat =
					upstream === "anthropic" || upstream === "workers-ai" ? { sendSessionAffinityHeaders: true } : undefined;

				models.push({
					id,
					name: m.name || id,
					api,
					provider: "cloudflare-ai-gateway",
					baseUrl,
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
					...(compat ? { compat } : {}),
				});
				recordModelsDevReasoningOptions("cloudflare-ai-gateway", id, m);
			}
		}

		// Process xAi models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data.xai?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data.xai.models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;
				/** 常量 useResponsesApi 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const useResponsesApi = modelId === XAI_RESPONSES_MODEL_ID;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: useResponsesApi ? "openai-responses" : "openai-completions",
					provider: "xai",
					baseUrl: "https://api.x.ai/v1",
					...(useResponsesApi ? { compat: { ...XAI_RESPONSES_COMPAT } } : {}),
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("xai", modelId, m);
			}
		}

		// Process zAi models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const zaiCodingPlanVariants = [
			{ provider: "zai", baseUrl: "https://api.z.ai/api/coding/paas/v4" },
			{ provider: "zai-coding-cn", baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4" },
		] as const;

		if (data["zai-coding-plan"]?.models) {
			/** 循环变量 { 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const { provider, baseUrl } of zaiCodingPlanVariants) {
				/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const [modelId, model] of Object.entries(data["zai-coding-plan"].models)) {
					/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const m = model as ModelsDevModel;
					if (m.tool_call !== true) continue;
					/** 常量 supportsImage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const supportsImage = m.modalities?.input?.includes("image");

					/** 常量 isGlm52 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const isGlm52 = modelId === "glm-5.2";

					models.push({
						id: modelId,
						name: m.name || modelId,
						api: "openai-completions",
						provider,
						baseUrl,
						reasoning: m.reasoning === true,
						...(isGlm52 ? { thinkingLevelMap: ZAI_GLM52_THINKING_LEVEL_MAP } : {}),
						input: supportsImage ? ["text", "image"] : ["text"],
						cost: {
							input: m.cost?.input || 0,
							output: m.cost?.output || 0,
							cacheRead: m.cost?.cache_read || 0,
							cacheWrite: m.cost?.cache_write || 0,
						},
						compat: {
							supportsDeveloperRole: false,
							thinkingFormat: "zai",
							...(isGlm52 ? { supportsReasoningEffort: true } : {}),
							...(!ZAI_TOOL_STREAM_UNSUPPORTED_MODELS.has(modelId) ? { zaiToolStream: true } : {}),
						},
						contextWindow: m.limit?.context || 4096,
						maxTokens: m.limit?.output || 4096,
					});
					recordModelsDevReasoningOptions(provider, modelId, m);
				}
			}
		}

		// Process Mistral models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data.mistral?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data.mistral.models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "mistral-conversations",
					provider: "mistral",
					baseUrl: "https://api.mistral.ai",
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read ?? (m.cost?.input ? roundCost(m.cost.input * 0.1) : 0),
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("mistral", modelId, m);
			}
		}

		// Process Hugging Face models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data.huggingface?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data.huggingface.models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "openai-completions",
					provider: "huggingface",
					baseUrl: "https://router.huggingface.co/v1",
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					compat: {
						supportsDeveloperRole: false,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("huggingface", modelId, m);
			}
		}

		// Process Fireworks models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data["fireworks-ai"]?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data["fireworks-ai"].models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "anthropic-messages",
					provider: "fireworks",
					// Fireworks Anthropic-compatible API - SDK appends /v1/messages
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					baseUrl: "https://api.fireworks.ai/inference",
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
					// Fireworks prompt caching uses automatic prefix matching + session affinity.
					// x-session-affinity routes requests to the same replica for cache hits.
					// cache_control on tools and eager_input_streaming are not supported.
					// See: https://docs.fireworks.ai/tools-sdks/anthropic-compatibility
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					compat: {
						sendSessionAffinityHeaders: true,
						supportsEagerToolInputStreaming: false,
						supportsCacheControlOnTools: false,
						supportsLongCacheRetention: false,
					},
				});
				recordModelsDevReasoningOptions("fireworks", modelId, m);
			}
		}

		// Process NVIDIA NIM models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data.nvidia?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data.nvidia.models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;
				if (!m.modalities?.input?.includes("text")) continue;
				if (!m.modalities?.output?.includes("text")) continue;

				/** 常量 liveModelId 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const liveModelId = nvidiaNimModelIds.get(modelId) ?? nvidiaNimModelIds.get(normalizeNvidiaModelId(modelId));
				if (!liveModelId) continue;
				if (NVIDIA_NIM_UNSUPPORTED_MODELS.has(liveModelId)) continue;

				models.push({
					id: liveModelId,
					name: m.name || liveModelId,
					api: "openai-completions",
					provider: "nvidia",
					baseUrl: NVIDIA_BASE_URL,
					headers: { ...NVIDIA_HEADERS },
					reasoning: m.reasoning === true,
					input: m.modalities.input.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					compat: NVIDIA_OPENAI_COMPAT,
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("nvidia", liveModelId, m);
			}
		}

		// Process Together AI models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const togetherProvider = data.together ?? data.togetherai ?? data["together-ai"];
		if (togetherProvider?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(togetherProvider.models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel & { status?: string };
				if (m.tool_call !== true) continue;
				if (m.status === "deprecated") continue;

				/** 常量 reasoning 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const reasoning = m.reasoning === true;
				/** 常量 thinkingLevelMap 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const thinkingLevelMap = getTogetherThinkingLevelMap(modelId, reasoning);
				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "openai-completions",
					provider: "together",
					baseUrl: TOGETHER_BASE_URL,
					reasoning,
					...(thinkingLevelMap ? { thinkingLevelMap } : {}),
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					compat: getTogetherCompat(modelId, reasoning),
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("together", modelId, m);
			}
		}

		// Process OpenCode models (Zen and Go)
		// API mapping based on provider.npm field:
		// - @ai-sdk/openai → openai-responses
		// - @ai-sdk/anthropic → anthropic-messages
		// - @ai-sdk/google → google-generative-ai
		// - null/undefined/@ai-sdk/openai-compatible → openai-completions
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const opencodeVariants = [
			{ key: "opencode", provider: "opencode", basePath: "https://opencode.ai/zen" },
			{ key: "opencode-go", provider: "opencode-go", basePath: "https://opencode.ai/zen/go" },
		] as const;

		/** 循环变量 variant 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const variant of opencodeVariants) {
			if (!data[variant.key]?.models) continue;

			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data[variant.key].models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel & { status?: string };
				if (m.tool_call !== true) continue;
				if (m.status === "deprecated") continue;

				/** 常量 npm 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const npm = m.provider?.npm;
				/** 变量 api 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let api: Api;
				/** 变量 baseUrl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let baseUrl: string;
				/** 变量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let compat: OpenAICompletionsCompat | OpenAIResponsesCompat | undefined;

				if (npm === "@ai-sdk/openai") {
					api = "openai-responses";
					baseUrl = `${variant.basePath}/v1`;
					compat = { sessionAffinityFormat: "openai-nosession" };
				} else if (npm === "@ai-sdk/anthropic") {
					api = "anthropic-messages";
					// Anthropic SDK appends /v1/messages to baseURL
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					baseUrl = variant.basePath;
				} else if (npm === "@ai-sdk/google") {
					api = "google-generative-ai";
					baseUrl = `${variant.basePath}/v1`;
				} else if (npm === "@ai-sdk/alibaba") {
					api = "openai-completions";
					baseUrl = `${variant.basePath}/v1`;
					compat = { cacheControlFormat: "anthropic" };
				} else {
					// null, undefined, or @ai-sdk/openai-compatible
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					api = "openai-completions";
					baseUrl = `${variant.basePath}/v1`;
				}

				if (variant.provider === "opencode" && modelId === "grok-build-0.1") {
					compat = { ...(compat ?? {}), supportsReasoningEffort: false };
				}

				if ((variant.provider === "opencode" || variant.provider === "opencode-go") && modelId === "kimi-k2.6") {
					// OpenCode Kimi K2.6 accepts Anthropic-style thinking objects
					// and rejects string thinking values or combined reasoning_effort.
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					compat = { ...(compat ?? {}), thinkingFormat: "deepseek", supportsReasoningEffort: false };
				}

				// Fix known mismatches between models.dev npm data and actual
				// OpenCode Go endpoint behaviour. models.dev reports these models
				// as @ai-sdk/anthropic, but the OpenCode Go endpoints either don't
				// accept Anthropic SDK auth (MiniMax M2.7) or are served through
				// the OpenAI-compatible /v1/chat/completions path (Qwen 3.5/3.6).
				// Switch them to openai-completions so requests use Bearer auth
				// and the standard /v1/chat/completions endpoint.
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				if (variant.provider === "opencode-go") {
					if (modelId === "minimax-m2.7") {
						api = "openai-completions";
						baseUrl = `${variant.basePath}/v1`;
					}
					if (modelId === "qwen3.5-plus" || modelId === "qwen3.6-plus") {
						api = "openai-completions";
						baseUrl = `${variant.basePath}/v1`;
						// Qwen/DashScope uses enable_thinking at the top level.
						// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
						compat = { ...(compat ?? {}), thinkingFormat: "qwen" };
					}
				}

				if (api === "openai-completions") {
					compat = { ...(compat ?? {}), maxTokensField: "max_tokens" };
					if (
						OPENCODE_OPENAI_COMPLETIONS_LONG_CACHE_RETENTION_UNSUPPORTED_MODELS.has(
							`${variant.provider}:${modelId}`,
						)
					) {
						compat = { ...compat, supportsLongCacheRetention: false };
					}
				}

				models.push({
					id: modelId,
					name: m.name || modelId,
					api,
					provider: variant.provider,
					baseUrl,
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					...(compat ? { compat } : {}),
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions(variant.provider, modelId, m);
			}
		}

		// Process GitHub Copilot models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data["github-copilot"]?.models) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(data["github-copilot"].models)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel & { status?: string };
				if (m.tool_call !== true) continue;
				if (m.status === "deprecated") continue;

				// Claude 4.x and 5.x models route to Anthropic Messages API
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				const isCopilotClaude = /^claude-(haiku|sonnet|opus)-[45]([.\-]|$)/.test(modelId);
				// gpt-5, oswe, and MAI-Code models are only served through the
				// Copilot /responses endpoint.
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				const needsResponsesApi =
					modelId.startsWith("gpt-5") || modelId.startsWith("oswe") || modelId.startsWith("mai-");

				/** 常量 api 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const api: Api = isCopilotClaude
					? "anthropic-messages"
					: needsResponsesApi
						? "openai-responses"
						: "openai-completions";

				/** 常量 anthropicCompat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const anthropicCompat =
					api === "anthropic-messages" ? getAnthropicMessagesCompat("github-copilot", modelId) : undefined;

				/** 常量 copilotModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const copilotModel: Model<any> = {
					id: modelId,
					name: m.name || modelId,
					api,
					provider: "github-copilot",
					baseUrl: "https://api.individual.githubcopilot.com",
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: getModelsDevCost(m.cost),
					contextWindow: m.limit?.context || 128000,
					maxTokens: m.limit?.output || 8192,
					headers: { ...COPILOT_STATIC_HEADERS },
					...(anthropicCompat ? { compat: anthropicCompat } : {}),
					// compat only applies to openai-completions
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					...(api === "openai-completions" ? {
						compat: {
							supportsStore: false,
							supportsDeveloperRole: false,
							supportsReasoningEffort: false,
						},
					} : {}),
				};

				models.push(copilotModel);
				recordModelsDevReasoningOptions("github-copilot", modelId, m);
			}
		}

		// Process MiniMax models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const minimaxVariants = [
			{ key: "minimax", provider: "minimax", baseUrl: "https://api.minimax.io/anthropic" },
			{ key: "minimax-cn", provider: "minimax-cn", baseUrl: "https://api.minimaxi.com/anthropic" },
		] as const;

		/** 循环变量 { 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const { key, provider, baseUrl } of minimaxVariants) {
			if (data[key]?.models) {
				/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const [modelId, model] of Object.entries(data[key].models)) {
					/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const m = model as ModelsDevModel;
					if (m.tool_call !== true) continue;

					models.push({
						id: modelId,
						name: m.name || modelId,
						api: "anthropic-messages",
						provider,
						// MiniMax's Anthropic-compatible API - SDK appends /v1/messages
						// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
						baseUrl,
						reasoning: m.reasoning === true,
						input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
						cost: {
							input: m.cost?.input || 0,
							output: m.cost?.output || 0,
							cacheRead: m.cost?.cache_read || 0,
							cacheWrite: m.cost?.cache_write || 0,
						},
						contextWindow: m.limit?.context || 4096,
						maxTokens: m.limit?.output || 4096,
					});
					recordModelsDevReasoningOptions(provider, modelId, m);
				}
			}
		}

		// Process Kimi For Coding models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (data["kimi-for-coding"]?.models) {
			/** 常量 kimiModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const kimiModels = data["kimi-for-coding"].models as Record<string, ModelsDevModel>;
			/** 常量 hasCanonicalModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const hasCanonicalModel = Object.prototype.hasOwnProperty.call(kimiModels, "kimi-for-coding");

			/** 常量 kimiAliases 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const kimiAliases = new Set(["k2p5", "k2p6", "k2p7"]);

			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(kimiModels)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;
				// models.dev may expose versioned aliases (e.g. k2p5/k2p6/k2p7).
				// Normalize aliases to the canonical model id and drop duplicates when canonical exists.
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				if (kimiAliases.has(modelId) && hasCanonicalModel) continue;

				/** 常量 normalizedId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const normalizedId = kimiAliases.has(modelId) ? "kimi-for-coding" : modelId;
				/** 常量 normalizedName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const normalizedName = kimiAliases.has(modelId) ? "Kimi For Coding" : m.name || normalizedId;
				/** 常量 isKimiK3 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const isKimiK3 = normalizedId === "k3";
				/** 常量 allowEmptySignature 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const allowEmptySignature = isKimiK3 || normalizedId === "kimi-for-coding";
				/** 常量 impliedCost 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const impliedCost = KIMI_CODING_IMPLIED_COSTS[normalizedId];

				models.push({
					id: normalizedId,
					name: normalizedName,
					api: "anthropic-messages",
					provider: "kimi-coding",
					// Kimi For Coding's Anthropic-compatible API - SDK appends /v1/messages
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					baseUrl: "https://api.kimi.com/coding",
					headers: { ...KIMI_STATIC_HEADERS },
					compat: {
						...(allowEmptySignature ? { allowEmptySignature: true } : {}),
						forceAdaptiveThinking: true,
					},
					reasoning: isKimiK3 || m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || impliedCost?.input || 0,
						output: m.cost?.output || impliedCost?.output || 0,
						cacheRead: m.cost?.cache_read || impliedCost?.cacheRead || 0,
						cacheWrite: m.cost?.cache_write || impliedCost?.cacheWrite || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions("kimi-coding", normalizedId, m);
			}
		}

		// Process Moonshot AI models
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const moonshotVariants = [
			{ key: "moonshotai", provider: "moonshotai", baseUrl: "https://api.moonshot.ai/v1" },
			{ key: "moonshotai-cn", provider: "moonshotai-cn", baseUrl: "https://api.moonshot.cn/v1" },
		] as const;
		/** 常量 moonshotCompat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const moonshotCompat: OpenAICompletionsCompat = {
			supportsStore: false,
			supportsDeveloperRole: false,
			supportsReasoningEffort: false,
			maxTokensField: "max_tokens",
			supportsStrictMode: false,
			thinkingFormat: "deepseek",
		};
		/** 常量 getMoonshotProviderModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const getMoonshotProviderModels = (key: "moonshotai" | "moonshotai-cn"): Record<string, ModelsDevModel> => {
			/** 常量 providerModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const providerModels = data[key]?.models as Record<string, ModelsDevModel> | undefined;
			return providerModels ? { ...providerModels } : {};
		};
		/** 常量 moonshotModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const moonshotModels = {
			moonshotai: getMoonshotProviderModels("moonshotai"),
			"moonshotai-cn": getMoonshotProviderModels("moonshotai-cn"),
		};

		/** 循环变量 { 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const { key, provider, baseUrl } of moonshotVariants) {
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, m] of Object.entries(moonshotModels[key])) {
				if (m.tool_call !== true) continue;

				/** 常量 isKimiK3 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const isKimiK3 = modelId === "kimi-k3";
				/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const compat = isKimiK3 ? { ...moonshotCompat } : moonshotCompat;
				if (isKimiK3) {
					compat.requiresReasoningContentOnAssistantMessages = true;
					compat.deferredToolsMode = "kimi";
					compat.thinkingFormat = "openai";
					compat.supportsReasoningEffort = true;
				}
				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "openai-completions",
					provider,
					baseUrl,
					reasoning: isKimiK3 || m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || (isKimiK3 ? KIMI_K3_COST.input : 0),
						output: m.cost?.output || (isKimiK3 ? KIMI_K3_COST.output : 0),
						cacheRead: m.cost?.cache_read || (isKimiK3 ? KIMI_K3_COST.cacheRead : 0),
						cacheWrite: m.cost?.cache_write || (isKimiK3 ? KIMI_K3_COST.cacheWrite : 0),
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
					compat,
				});
				recordModelsDevReasoningOptions(provider, modelId, m);
			}
		}

		// Process Xiaomi MiMo models
		// Built-in `xiaomi` targets the API billing endpoint (single stable URL,
		// keys from platform.xiaomimimo.com). The three `xiaomi-token-plan-*`
		// providers cover prepaid Token Plan endpoints in cn / ams / sgp.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const xiaomiCompat: OpenAICompletionsCompat = {
			requiresReasoningContentOnAssistantMessages: true,
			thinkingFormat: "deepseek",
		};
		/** 常量 xiaomiVariants 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const xiaomiVariants = [
			{ source: "xiaomi", provider: "xiaomi", baseUrl: "https://api.xiaomimimo.com/v1" },
			{
				source: "xiaomi-token-plan-cn",
				provider: "xiaomi-token-plan-cn",
				baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
			},
			{
				source: "xiaomi-token-plan-ams",
				provider: "xiaomi-token-plan-ams",
				baseUrl: "https://token-plan-ams.xiaomimimo.com/v1",
			},
			{
				source: "xiaomi-token-plan-sgp",
				provider: "xiaomi-token-plan-sgp",
				baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1",
			},
		] as const;

		/** 循环变量 { 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const { source, provider, baseUrl } of xiaomiVariants) {
			/** 常量 providerModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const providerModels = data[source]?.models;
			if (!providerModels) continue;

			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(providerModels)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "openai-completions",
					provider,
					baseUrl,
					compat: xiaomiCompat,
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions(provider, modelId, m);
			}
		}

		// Process Alibaba Cloud Model Studio Token Plan models
		// Two regions (international / cn) with identical catalogs, separate
		// endpoints and API keys (sk-sp- prefix). models.dev keys are
		// "alibaba-token-plan[-cn]"; pi exposes them as "qwen-token-plan[-cn]".
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const qwenTokenPlanCompat: OpenAICompletionsCompat = {
			thinkingFormat: "qwen",
			supportsDeveloperRole: false,
			supportsStore: false,
		};
		/** 常量 qwenTokenPlanVariants 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const qwenTokenPlanVariants = [
			{
				source: "alibaba-token-plan",
				provider: "qwen-token-plan",
				baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
			},
			{
				source: "alibaba-token-plan-cn",
				provider: "qwen-token-plan-cn",
				baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
			},
		] as const;

		/** 循环变量 { 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const { source, provider, baseUrl } of qwenTokenPlanVariants) {
			/** 常量 providerModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const providerModels = data[source]?.models;
			if (!providerModels) continue;

			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(providerModels)) {
				/** 常量 m 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const m = model as ModelsDevModel;
				if (m.tool_call !== true) continue;

				models.push({
					id: modelId,
					name: m.name || modelId,
					api: "openai-completions",
					provider,
					baseUrl,
					compat: qwenTokenPlanCompat,
					reasoning: m.reasoning === true,
					input: m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"],
					cost: {
						input: m.cost?.input || 0,
						output: m.cost?.output || 0,
						cacheRead: m.cost?.cache_read || 0,
						cacheWrite: m.cost?.cache_write || 0,
					},
					contextWindow: m.limit?.context || 4096,
					maxTokens: m.limit?.output || 4096,
				});
				recordModelsDevReasoningOptions(provider, modelId, m);
			}
		}

		console.log(`Loaded ${models.length} tool-capable models from models.dev`);
		return models;
	} catch (error) {
		/** error 是 models.dev 数据读取或解析异常；严格模式重抛，否则返回空列表。 */
		console.error("Failed to load models.dev data:", error);
		if (generatorOptions.strict) throw error;
		return [];
	}
}

/** generateModels 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：generateModels()。 */
async function generateModels() {
	// Fetch models from both sources
	// models.dev: Anthropic, Google, OpenAI, Groq, Cerebras
	// OpenRouter: xAI and other providers (excluding Anthropic, Google, OpenAI)
	// AI Gateway: OpenAI-compatible catalog with tool-capable models
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const modelsDevModels = await loadModelsDevData();
	/** 常量 openRouterModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const openRouterModels = await fetchOpenRouterModels();
	/** 常量 aiGatewayModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const aiGatewayModels = await fetchAiGatewayModels();

	// Combine models (models.dev has priority)
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const allModels = [...modelsDevModels, ...openRouterModels, ...aiGatewayModels].filter(
		(model) =>
			!(model.provider === "xai" && XAI_BUILTIN_EXCLUDED_MODEL_IDS.has(model.id)) &&
			!((model.provider === "opencode" || model.provider === "opencode-go") && model.id === "gpt-5.3-codex-spark"),
	);

	// Temporary overrides until upstream model metadata is corrected.
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	for (const candidate of allModels) {
		if (candidate.provider === "github-copilot" && GITHUB_COPILOT_EXTENDED_CONTEXT_MODELS.has(candidate.id)) {
			candidate.contextWindow = 1000000;
		}

		if (
			(candidate.provider === "anthropic" ||
				candidate.provider === "opencode" ||
				candidate.provider === "opencode-go") &&
			(candidate.id === "claude-opus-4-6" ||
				candidate.id === "claude-sonnet-4-6" ||
				candidate.id === "claude-opus-4.6" ||
				candidate.id === "claude-sonnet-4.6")
		) {
			candidate.contextWindow = 1000000;
		}

		// OpenCode variants list Claude Sonnet 4/4.5 with 1M context, actual limit is 200K
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (
			(candidate.provider === "opencode" || candidate.provider === "opencode-go") &&
			(candidate.id === "claude-sonnet-4-5" || candidate.id === "claude-sonnet-4")
		) {
			candidate.contextWindow = 200000;
		}
		if ((candidate.provider === "opencode" || candidate.provider === "opencode-go") && candidate.id === "gpt-5.4") {
			candidate.contextWindow = 272000;
			candidate.maxTokens = 128000;
		}
		// Keep direct OpenAI requests in the short-context pricing tier by default. Users can opt into the
		// larger context through model overrides, so retain long-context cost metadata on the capped models.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (candidate.provider === "openai" && OPENAI_SHORT_CONTEXT_CAPPED_MODEL_IDS.has(candidate.id)) {
			candidate.contextWindow = OPENAI_LONG_CONTEXT_INPUT_THRESHOLD;
			candidate.maxTokens = 128000;
		}
		if (candidate.provider === "openai" && OPENAI_LONG_CONTEXT_PRICING_MODEL_IDS.has(candidate.id)) {
			candidate.cost = withOpenAiLongContextPricing(candidate.cost);
		}
		// models.dev reports gpt-5-pro output as 272000 (a duplicate of the input sub-limit);
		// the actual max output is 128000. Also propagates to the derived Azure clone.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (candidate.provider === "openai" && candidate.id === "gpt-5-pro") {
			candidate.maxTokens = 128000;
		}
		// Keep Kimi K3's canonical output limit when gateway metadata is missing or incorrect.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (
			(candidate.provider === "openrouter" && OPENROUTER_KIMI_K3_MODEL_IDS.has(candidate.id)) ||
			(candidate.provider === "vercel-ai-gateway" && candidate.id === "moonshotai/kimi-k3")
		) {
			candidate.maxTokens = KIMI_K3_MAX_TOKENS;
		}
		// Keep selected OpenRouter model metadata stable until upstream settles.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (candidate.provider === "openrouter" && candidate.id === "moonshotai/kimi-k2.5") {
			candidate.cost.input = 0.41;
			candidate.cost.output = 2.06;
			candidate.cost.cacheRead = 0.07;
			candidate.maxTokens = 4096;
		}
		if (candidate.provider === "openrouter" && candidate.id.startsWith("moonshotai/kimi-k2.6")) {
			candidate.compat = {
				...candidate.compat,
				supportsDeveloperRole: false,
				requiresReasoningContentOnAssistantMessages: true,
			};
		}
		if (candidate.provider === "openrouter" && candidate.id === "z-ai/glm-5") {
			candidate.cost.input = 0.6;
			candidate.cost.output = 1.9;
			candidate.cost.cacheRead = 0.119;
		}
		if (candidate.provider === "fireworks" && candidate.id.includes("glm-5p2")) {
			candidate.api = "openai-completions";
			candidate.baseUrl = "https://api.fireworks.ai/inference/v1";
			candidate.compat = { supportsStore: false, supportsDeveloperRole: false };
		}
	}


	// Add missing gpt models
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const missingOpenAiModels: Model<"openai-responses">[] = [
		{
			id: "gpt-5.6-sol",
			name: "GPT-5.6 Sol",
			api: "openai-responses",
			baseUrl: "https://api.openai.com/v1",
			provider: "openai",
			reasoning: true,
			input: ["text", "image"],
			cost: withOpenAiLongContextPricing({ input: 5, output: 30, cacheRead: 0.5, cacheWrite: 6.25 }),
			contextWindow: OPENAI_LONG_CONTEXT_INPUT_THRESHOLD,
			maxTokens: 128000,
		},
		{
			id: "gpt-5.6-terra",
			name: "GPT-5.6 Terra",
			api: "openai-responses",
			baseUrl: "https://api.openai.com/v1",
			provider: "openai",
			reasoning: true,
			input: ["text", "image"],
			cost: withOpenAiLongContextPricing({ input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 3.125 }),
			contextWindow: OPENAI_LONG_CONTEXT_INPUT_THRESHOLD,
			maxTokens: 128000,
		},
		{
			id: "gpt-5.6-luna",
			name: "GPT-5.6 Luna",
			api: "openai-responses",
			baseUrl: "https://api.openai.com/v1",
			provider: "openai",
			reasoning: true,
			input: ["text", "image"],
			cost: withOpenAiLongContextPricing({ input: 1, output: 6, cacheRead: 0.1, cacheWrite: 1.25 }),
			contextWindow: OPENAI_LONG_CONTEXT_INPUT_THRESHOLD,
			maxTokens: 128000,
		},
		{
			id: "gpt-5-chat-latest",
			name: "GPT-5 Chat Latest",
			api: "openai-responses",
			baseUrl: "https://api.openai.com/v1",
			provider: "openai",
			reasoning: false,
			input: ["text", "image"],
			cost: {
				input: 1.25,
				output: 10,
				cacheRead: 0.125,
				cacheWrite: 0,
			},
			contextWindow: 128000,
			maxTokens: 16384,
		},
	];
	/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const model of missingOpenAiModels) {
		if (!allModels.some((m) => m.provider === model.provider && m.id === model.id)) {
			allModels.push(model);
		}
	}

	/** 常量 deepseekCompat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const deepseekCompat: OpenAICompletionsCompat = {
		requiresReasoningContentOnAssistantMessages: true,
		thinkingFormat: "deepseek",
	};
	/** 常量 deepseekV4Models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const deepseekV4Models: Model<"openai-completions">[] = [
		{
			id: "deepseek-v4-flash",
			name: "DeepSeek V4 Flash",
			api: "openai-completions",
			baseUrl: "https://api.deepseek.com",
			provider: "deepseek",
			reasoning: true,
			input: ["text"],
			cost: {
				input: 0.14,
				output: 0.28,
				cacheRead: 0.0028,
				cacheWrite: 0,
			},
			contextWindow: 1000000,
			maxTokens: 384000,
			compat: deepseekCompat,
		},
		{
			id: "deepseek-v4-pro",
			name: "DeepSeek V4 Pro",
			api: "openai-completions",
			baseUrl: "https://api.deepseek.com",
			provider: "deepseek",
			reasoning: true,
			input: ["text"],
			cost: {
				input: 0.435,
				output: 0.87,
				cacheRead: 0.003625,
				cacheWrite: 0,
			},
			contextWindow: 1000000,
			maxTokens: 384000,
			compat: deepseekCompat,
		},
	];
	allModels.push(...deepseekV4Models);

	/** 常量 antLingCompat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const antLingCompat: OpenAICompletionsCompat = {
		supportsStore: false,
		supportsDeveloperRole: false,
		supportsReasoningEffort: false,
		maxTokensField: "max_tokens",
		supportsLongCacheRetention: false,
	};
	/** 常量 antLingModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const antLingModels: Model<"openai-completions">[] = [
		{
			id: "Ling-2.6-flash",
			name: "Ling 2.6 Flash",
			api: "openai-completions",
			baseUrl: "https://api.ant-ling.com/v1",
			provider: "ant-ling",
			reasoning: false,
			input: ["text"],
			cost: { input: 0.01, output: 0.02, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 262144,
			maxTokens: 65536,
			compat: antLingCompat,
		},
		{
			id: "Ling-2.6-1T",
			name: "Ling 2.6 1T",
			api: "openai-completions",
			baseUrl: "https://api.ant-ling.com/v1",
			provider: "ant-ling",
			reasoning: false,
			input: ["text"],
			cost: { input: 0.06, output: 0.25, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 262144,
			maxTokens: 65536,
			compat: antLingCompat,
		},
		{
			id: "Ring-2.6-1T",
			name: "Ring 2.6 1T",
			api: "openai-completions",
			baseUrl: "https://api.ant-ling.com/v1",
			provider: "ant-ling",
			reasoning: true,
			input: ["text"],
			cost: { input: 0.06, output: 0.25, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 262144,
			maxTokens: 65536,
			compat: { ...antLingCompat, thinkingFormat: "ant-ling" },
		},
	];
	allModels.push(...antLingModels);

	/** 循环变量 candidate 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const candidate of allModels) {
		if (candidate.api === "openai-completions" && candidate.id.includes("deepseek-v4")) {
			/** 常量 preservesNativeReasoningEffort 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const preservesNativeReasoningEffort = candidate.provider === "openrouter" || candidate.provider === "opencode";
			candidate.compat = {
				...candidate.compat,
				...(preservesNativeReasoningEffort
					? {
							requiresReasoningContentOnAssistantMessages:
								deepseekCompat.requiresReasoningContentOnAssistantMessages,
						}
					: deepseekCompat),
			};
		}
	}

	/** 常量 minimaxDirectSupportedIds 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const minimaxDirectSupportedIds = new Set(["MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M3"]);

	/** 循环变量 i 表示当前遍历项或索引，仅在循环体内有效。 */
	for (let i = allModels.length - 1; i >= 0; i--) {
		/** 常量 candidate 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const candidate = allModels[i];
		if (
			(candidate.provider === "minimax" || candidate.provider === "minimax-cn") &&
			!minimaxDirectSupportedIds.has(candidate.id)
		) {
			allModels.splice(i, 1);
		}
	}

	// OpenAI Codex (ChatGPT OAuth) models
	// NOTE: These are not fetched from models.dev; we keep a small, explicit list to avoid aliases.
	// Older model limits are based on observed server behavior; GPT-5.6 follows Codex's 272k catalog limit (formerly 372k).
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const CODEX_BASE_URL = "https://chatgpt.com/backend-api";
	/** 常量 CODEX_CONTEXT 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const CODEX_CONTEXT = 272000;
	/** 常量 CODEX_GPT_56_CONTEXT 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const CODEX_GPT_56_CONTEXT = 272000;
	/** 常量 CODEX_SPARK_CONTEXT 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const CODEX_SPARK_CONTEXT = 128000;
	/** 常量 CODEX_MAX_TOKENS 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const CODEX_MAX_TOKENS = 128000;
	/** 常量 codexModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const codexModels: Model<"openai-codex-responses">[] = [
		{
			id: "gpt-5.3-codex-spark",
			name: "GPT-5.3 Codex Spark",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: CODEX_BASE_URL,
			reasoning: true,
			input: ["text"],
			cost: { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 },
			contextWindow: CODEX_SPARK_CONTEXT,
			maxTokens: CODEX_MAX_TOKENS,
		},
		{
			id: "gpt-5.4",
			name: "GPT-5.4",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: CODEX_BASE_URL,
			reasoning: true,
			input: ["text", "image"],
			cost: withOpenAiLongContextPricing({ input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 0 }),
			contextWindow: CODEX_CONTEXT,
			maxTokens: CODEX_MAX_TOKENS,
		},
		{
			id: "gpt-5.4-mini",
			name: "GPT-5.4 mini",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: CODEX_BASE_URL,
			reasoning: true,
			input: ["text", "image"],
			cost: { input: 0.75, output: 4.5, cacheRead: 0.075, cacheWrite: 0 },
			contextWindow: CODEX_CONTEXT,
			maxTokens: CODEX_MAX_TOKENS,
		},
		{
			id: "gpt-5.5",
			name: "GPT-5.5",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: CODEX_BASE_URL,
			reasoning: true,
			input: ["text", "image"],
			cost: withOpenAiLongContextPricing({ input: 5, output: 30, cacheRead: 0.5, cacheWrite: 0 }),
			contextWindow: CODEX_CONTEXT,
			maxTokens: CODEX_MAX_TOKENS,
		},
		{
			id: "gpt-5.6-luna",
			name: "GPT-5.6 Luna",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: CODEX_BASE_URL,
			reasoning: true,
			input: ["text", "image"],
			cost: withOpenAiLongContextPricing({ input: 1, output: 6, cacheRead: 0.1, cacheWrite: 1.25 }),
			contextWindow: CODEX_GPT_56_CONTEXT,
			maxTokens: CODEX_MAX_TOKENS,
		},
		{
			id: "gpt-5.6-sol",
			name: "GPT-5.6 Sol",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: CODEX_BASE_URL,
			reasoning: true,
			input: ["text", "image"],
			cost: withOpenAiLongContextPricing({ input: 5, output: 30, cacheRead: 0.5, cacheWrite: 6.25 }),
			contextWindow: CODEX_GPT_56_CONTEXT,
			maxTokens: CODEX_MAX_TOKENS,
		},
		{
			id: "gpt-5.6-terra",
			name: "GPT-5.6 Terra",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: CODEX_BASE_URL,
			reasoning: true,
			input: ["text", "image"],
			cost: withOpenAiLongContextPricing({ input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 3.125 }),
			contextWindow: CODEX_GPT_56_CONTEXT,
			maxTokens: CODEX_MAX_TOKENS,
		},
	];
	allModels.push(...codexModels);

	// Add missing Mistral Medium 3.5 model until models.dev includes it
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	if (!allModels.some(m => m.provider === "mistral" && m.id === "mistral-medium-3.5")) {
		allModels.push({
			id: "mistral-medium-3.5",
			name: "Mistral Medium 3.5",
			api: "mistral-conversations",
			provider: "mistral",
			baseUrl: "https://api.mistral.ai",
			reasoning: true,
			input: ["text", "image"],
			cost: {
				input: 1.5,
				output: 7.5,
				cacheRead: 0,
				cacheWrite: 0,
			},
			contextWindow: 262144, // 256k tokens
			maxTokens: 262144,
		});
	}

	// Add qwen3.8-max-preview to Qwen Token Plan providers until models.dev includes it
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	for (const qwenTpProvider of ["qwen-token-plan", "qwen-token-plan-cn"] as const) {
		if (!allModels.some((m) => m.provider === qwenTpProvider && m.id === "qwen3.8-max-preview")) {
			/** 常量 baseUrl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const baseUrl =
				qwenTpProvider === "qwen-token-plan"
					? "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1"
					: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
			allModels.push({
				id: "qwen3.8-max-preview",
				name: "Qwen3.8 Max Preview",
				api: "openai-completions",
				provider: qwenTpProvider,
				baseUrl,
				compat: { thinkingFormat: "qwen", supportsDeveloperRole: false, supportsStore: false } satisfies OpenAICompletionsCompat,
				reasoning: true,
				input: ["text", "image"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 1000000,
				maxTokens: 65536,
			});
		}
	}

	// Add "auto" alias for openrouter/auto
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	if (!allModels.some(m => m.provider === "openrouter" && m.id === "auto")) {
		allModels.push({
			id: "auto",
			name: "Auto",
			api: "openai-completions",
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
			reasoning: true,
			input: ["text", "image"],
			cost: {
				// we dont know about the costs because OpenRouter auto routes to different models
				// and then charges you for the underlying used model
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				input:0,
				output:0,
				cacheRead:0,
				cacheWrite:0,
			},
			contextWindow: 2000000,
			maxTokens: 30000,
		});
	}

	// Add "fusion" alias for openrouter/fusion. OpenRouter exposes Fusion as a
	// router alias/plugin entry point; its model metadata does not advertise
	// tools, but the alias resolves to a concrete model that can invoke caller
	// tools and has the openrouter:fusion server tool auto-injected.
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	if (!allModels.some(m => m.provider === "openrouter" && m.id === "openrouter/fusion")) {
		allModels.push({
			id: "openrouter/fusion",
			name: "OpenRouter: Fusion",
			api: "openai-completions",
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
			reasoning: true,
			input: ["text"],
			cost: {
				// we dont know about the costs because Fusion routes to multiple models
				// and then charges you for the underlying used models
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
			},
			contextWindow: 1000000,
			maxTokens: 30000,
		});
	}

	// Azure Foundry deploys these with larger context windows than OpenAI's own short-tier defaults.
	// See models-sold-directly-by-azure docs.
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const AZURE_CONTEXT_WINDOW_OVERRIDES: Record<string, number> = {
		"gpt-5.4": 1050000,
		"gpt-5.5": 1050000,
		"gpt-5.6-luna": 1050000,
		"gpt-5.6-sol": 1050000,
		"gpt-5.6-terra": 1050000,
	};
	/** 常量 azureOpenAiModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const azureOpenAiModels: Model<Api>[] = allModels
		.filter((model) => model.provider === "openai" && model.api === "openai-responses")
		.map((model) => ({
			...model,
			api: "azure-openai-responses",
			provider: "azure-openai-responses",
			baseUrl: "",
			cost: {
				input: model.cost.input,
				output: model.cost.output,
				cacheRead: model.cost.cacheRead,
				cacheWrite: model.cost.cacheWrite,
			},
			contextWindow: AZURE_CONTEXT_WINDOW_OVERRIDES[model.id] ?? model.contextWindow,
		}));
	allModels.push(...azureOpenAiModels);

	/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const model of allModels) {
		applyOpenAICompletionsCompatMetadata(model);
		applyModelsDevReasoningOptionMetadata(model);
		applyThinkingLevelMetadata(model);
		applyStrictToolCompatMetadata(model);
		applyOpenAIGrammarToolCompatMetadata(model);
		applyOpenAIToolSearchMetadata(model);
		applyOpenAIExplicitPromptCacheMetadata(model);
	}

	// Group by provider and deduplicate by model ID
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const providers: Record<string, Record<string, Model<any>>> = {};
	/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const model of allModels) {
		if (!providers[model.provider]) {
			providers[model.provider] = {};
		}
		// Use model ID as key to automatically deduplicate
		// Only add if not already present (models.dev takes priority over OpenRouter)
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		if (!providers[model.provider][model.id]) {
			providers[model.provider][model.id] = model;
		}
	}

	/** 常量 sortedProviderIds 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const sortedProviderIds = Object.keys(providers).sort();
	/** 常量 jsonProviders 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const jsonProviders: Record<string, Record<string, Model<any>>> = {};
	/** 循环变量 providerId 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const providerId of sortedProviderIds) {
		jsonProviders[providerId] = {};
		/** 循环变量 modelId 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const modelId of Object.keys(providers[providerId]).sort()) {
			jsonProviders[providerId][modelId] = providers[providerId][modelId];
		}
	}

	/** serializeJson 封装当前回调或辅助步骤；参数 value: unknown 提供输入，返回值用于后续流程。示例：serializeJson(...)。 */
	const serializeJson = (value: unknown) => `${JSON.stringify(value, null, generatorOptions.pretty ? 2 : undefined)}\n`;
	/** writeJson 封装当前回调或辅助步骤；参数 path: string、value: unknown 提供输入，返回值用于后续流程。示例：writeJson(..., ...)。 */
	const writeJson = (path: string, value: unknown) => writeFileSync(path, serializeJson(value));
	/** 常量 generatedDataProviderIds 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const generatedDataProviderIds = generatorOptions.dataOnly
		? readModelDataProviderIds(packageRoot)
		: sortedProviderIds;
	/** 常量 missingProviderIds 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const missingProviderIds = generatedDataProviderIds.filter((providerId) => !jsonProviders[providerId]);
	if (missingProviderIds.length > 0) {
		throw new Error(`Cannot hydrate missing providers: ${missingProviderIds.join(", ")}`);
	}

	// Only the ignored internal data is grouped by API for type derivation. Public JSON catalog output stays flat.
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const generatedDataProviders: Record<string, Record<string, Record<string, Model<Api>>>> = {};
	/** 常量 modelDataStructure 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const modelDataStructure: ModelDataStructure = {};
	/** 循环变量 providerId 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const providerId of generatedDataProviderIds) {
		/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const models = jsonProviders[providerId];
		generatedDataProviders[providerId] = {};
		modelDataStructure[providerId] = {};
		/** 常量 apiIds 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const apiIds = Array.from(new Set(Object.values(models).map((model) => model.api))).sort();
		/** 循环变量 api 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const api of apiIds) {
			generatedDataProviders[providerId][api] = {};
			/** 循环变量 [modelId, 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const [modelId, model] of Object.entries(models)) {
				if (model.api !== api) continue;
				generatedDataProviders[providerId][api][modelId] = model;
				modelDataStructure[providerId][modelId] = api;
			}
		}
	}

	/** 常量 generatedAt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const generatedAt = new Date().toISOString();

	if (!generatorOptions.jsonOnly) {
		// Stage and validate all provider values before replacing the current generated data.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const providersDir = join(packageRoot, "src/providers");
		/** 常量 dataDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const dataDir = join(providersDir, "data");
		/** 常量 stagingRoot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stagingRoot = mkdtempSync(join(providersDir, ".model-generation-"));
		/** 常量 stagedDataDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stagedDataDir = join(stagingRoot, "data");
		/** 常量 previousDataDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const previousDataDir = join(stagingRoot, "previous-data");
		/** 变量 restoreGeneratedCatalog 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let restoreGeneratedCatalog: (() => void) | undefined;
		try {
			mkdirSync(stagedDataDir, { recursive: true });
			/** 常量 fileContents 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const fileContents: Record<string, string> = {};
			/** 循环变量 providerId 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const providerId of generatedDataProviderIds) {
				/** 常量 filename 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const filename = `${providerId}.json`;
				/** 常量 content 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const content = serializeJson(generatedDataProviders[providerId]);
				fileContents[filename] = content;
				writeFileSync(join(stagedDataDir, filename), content);
			}
			writeJson(
				join(stagedDataDir, MODEL_DATA_MANIFEST_FILE),
				createModelDataManifest(modelDataStructure, fileContents, generatedAt),
			);
			validateModelDataDirectory(modelDataStructure, stagedDataDir);

			if (!generatorOptions.dataOnly) {
				/** 常量 previousShardContents 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const previousShardContents = new Map(
					readdirSync(providersDir)
						.filter((entry) => entry.endsWith(".models.ts"))
						.map((entry) => [entry, readFileSync(join(providersDir, entry), "utf8")] as const),
				);
				/** 常量 aggregatorPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const aggregatorPath = join(packageRoot, "src/models.generated.ts");
				/** 常量 previousAggregator 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const previousAggregator = readFileSync(aggregatorPath, "utf8");
				restoreGeneratedCatalog = () => {
					/** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
					for (const entry of readdirSync(providersDir)) {
						if (entry.endsWith(".models.ts")) rmSync(join(providersDir, entry));
					}
					/** 循环变量 [entry, 表示当前遍历项或索引，仅在循环体内有效。 */
					for (const [entry, content] of previousShardContents) {
						writeFileSync(join(providersDir, entry), content);
					}
					writeFileSync(aggregatorPath, previousAggregator);
				};

				/** 常量 generatedHeader 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const generatedHeader = `// This file is auto-generated by scripts/generate-models.ts
// 中文说明：本文件由 scripts/generate-models.ts 自动生成。
// Do not edit manually - run 'npm run generate-models' to update
// 中文说明：禁止手工修改；需要更新时请运行 npm run generate-models。
/**
 * 文件职责：保存单个供应商的模型目录分片，或汇总所有供应商分片形成统一模型索引。
 * 技术维度：使用 TypeScript 静态类型、JSON 导入属性和 flattenModelCatalog 将生成数据转换为只读模型目录。
 * 产品维度：为模型选择、能力判断和请求路由提供内置模型清单，使用户无需手工录入常见供应商模型。
 * 逻辑维度：供应商分片加载对应 JSON 并扁平化；聚合文件导入全部分片，再按供应商标识组成 MODELS 对象。
 * 关键边界：内容来自外部目录与生成器修正规则，禁止手工编辑；任何调整都必须修改生成器后重新生成并校验。
 * 新手阅读建议：先确认这是生成文件，再查看导入的数据分片和导出常量；业务规则应回到 generate-models.ts 阅读。
 */

`;
				/** catalogConstName 封装当前回调或辅助步骤；参数 providerId: string 提供输入，返回值用于后续流程。示例：catalogConstName(...)。 */
				const catalogConstName = (providerId: string) =>
					`${providerId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_MODELS`;
				/** 常量 generatedShardFiles 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const generatedShardFiles = new Set<string>();
				/** 循环变量 providerId 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const providerId of sortedProviderIds) {
					/** 变量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					let output = generatedHeader;
					output += `import values from "./data/${providerId}.json" with { type: "json" };\n`;
					output += `import { flattenModelCatalog, type ModelCatalog } from "../model-catalog.ts";\n\n`;
					output += `/** 当前供应商的只读模型目录；键为模型 ID，值为经过扁平化和类型校验的模型元数据。 */\n`;
					output += `export const ${catalogConstName(providerId)}: ModelCatalog<typeof values, ${JSON.stringify(providerId)}> =\n`;
					output += `\tflattenModelCatalog(${JSON.stringify(providerId)}, values);\n`;
					/** 常量 filename 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const filename = `${providerId}.models.ts`;
					generatedShardFiles.add(filename);
					writeFileSync(join(providersDir, filename), output);
				}
				/** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const entry of readdirSync(providersDir)) {
					if (entry.endsWith(".models.ts") && !generatedShardFiles.has(entry)) rmSync(join(providersDir, entry));
				}

				/** 变量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let output = generatedHeader;
				/** 循环变量 providerId 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const providerId of sortedProviderIds) {
					output += `import { ${catalogConstName(providerId)} } from "./providers/${providerId}.models.ts";\n`;
				}
				output += `\n/** 全部内置供应商的模型目录聚合；键为供应商标识，值为对应的只读模型分片。 */\n`;
				output += `export const MODELS: {\n`;
				/** 循环变量 providerId 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const providerId of sortedProviderIds) {
					output += `\treadonly ${JSON.stringify(providerId)}: typeof ${catalogConstName(providerId)};\n`;
				}
				output += `} = {\n`;
				/** 循环变量 providerId 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const providerId of sortedProviderIds) {
					output += `\t${JSON.stringify(providerId)}: ${catalogConstName(providerId)},\n`;
				}
				output += `};\n`;
				writeFileSync(aggregatorPath, output);
				console.log("Generated provider catalogs and src/models.generated.ts");
			}

			/** 常量 hadPreviousData 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const hadPreviousData = existsSync(dataDir);
			if (hadPreviousData) renameSync(dataDir, previousDataDir);
			try {
				renameSync(stagedDataDir, dataDir);
				validateGeneratedModelData(packageRoot);
			} catch (error) {
				/** error 是新目录替换或校验异常；恢复旧目录后继续向上传递。 */
				rmSync(dataDir, { recursive: true, force: true });
				if (hadPreviousData && existsSync(previousDataDir)) renameSync(previousDataDir, dataDir);
				throw error;
			}
			restoreGeneratedCatalog = undefined;
			console.log(
				generatorOptions.dataOnly
					? "Hydrated JSON model values under src/providers/data/"
					: "Generated JSON model values under src/providers/data/",
			);
		} catch (error) {
			/** error 是生成目录发布阶段异常；先恢复目录文件，再交由调用方处理。 */
			restoreGeneratedCatalog?.();
			throw error;
		} finally {
			rmSync(stagingRoot, { recursive: true, force: true });
		}
	}

	if (generatorOptions.jsonOutputDir) {
		/** 常量 providerOutputDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const providerOutputDir = join(generatorOptions.jsonOutputDir, "providers");
		rmSync(generatorOptions.jsonOutputDir, { recursive: true, force: true });
		mkdirSync(providerOutputDir, { recursive: true });
		writeJson(join(generatorOptions.jsonOutputDir, "models.json"), jsonProviders);
		writeJson(join(generatorOptions.jsonOutputDir, "providers.json"), sortedProviderIds);
		/** 循环变量 providerId 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const providerId of sortedProviderIds) {
			writeJson(join(providerOutputDir, `${providerId}.json`), jsonProviders[providerId]);
		}
		console.log(`Generated JSON model catalog under ${generatorOptions.jsonOutputDir}`);
	}

	// Print statistics
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const totalModels = allModels.length;
	/** 常量 reasoningModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const reasoningModels = allModels.filter(m => m.reasoning).length;

	console.log(`\nModel Statistics:`);
	console.log(`  Total tool-capable models: ${totalModels}`);
	console.log(`  Reasoning-capable models: ${reasoningModels}`);

	/** 循环变量 [provider, 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const [provider, models] of Object.entries(providers)) {
		console.log(`  ${provider}: ${Object.keys(models).length} models`);
	}
}

// Run the generator
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
generateModels().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
