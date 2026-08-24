/**
 * 文件职责：提供手工运行的 AgentHarness 示例，加载技能、提示模板、模型和基础编码工具。
 * 技术维度：使用 Node 执行环境、内存会话、统一模型注册表、资源加载器和异步顶层调用。
 * 产品维度：帮助开发者快速试验代理系统提示、技能去重、工具调用和真实模型响应。
 * 逻辑维度：创建执行环境，加载三类技能与两类模板，注册提供商，构建代理后发送综合提示词。
 * 关键边界：会访问用户目录与项目资源，并调用真实 OpenAI 模型；缺少模型时直接退出。
 * 新手阅读建议：先看 Source 类型和资源加载，再看 models 注册，最后读 AgentHarness 配置。
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { createModels } from "@earendil-works/pi-ai";
import { cloudflareAIGatewayProvider } from "@earendil-works/pi-ai/providers/cloudflare-ai-gateway";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import { InMemorySessionStorage } from "../../src/harness/session/memory-storage.ts";
import {
	AgentHarness,
	createBashTool,
	createEditTool,
	createReadTool,
	createWriteTool,
	formatSkillsForSystemPrompt,
	loadSourcedPromptTemplates,
	loadSourcedSkills,
	type PromptTemplate,
	Session,
	type Skill,
} from "../../src/index.ts";

/** 描述资源来源类型和原始目录。 */
type Source = { type: "project" | "user" | "path"; dir: string };
/** 在普通 Skill 上附加来源信息，便于后续识别重复项。 */
type SourcedSkill = Skill & { source: Source };
/** 在提示模板上附加来源信息。 */
type SourcedPromptTemplate = PromptTemplate & { source: Source };

// env 是以当前工作目录为根的 Node 工具执行环境。
const env = new NodeExecutionEnv({ cwd: process.cwd() });

/** 根据来源类型和目录创建资源加载描述；返回 path 与 source，示例：`source("project", dir)`。 */
const source = (type: Source["type"], dir: string) => ({ path: dir, source: { type, dir } });
// sourcedSkills 是从项目、用户和额外路径加载并附加来源的技能列表。
const { skills: sourcedSkills } = await loadSourcedSkills<Source, SourcedSkill>(
	env,
	[
		source("project", join(env.cwd, ".pi/skills")),
		source("user", join(homedir(), ".pi/agent/skills")),
		source("path", join(env.cwd, "../../../pi-skills")),
	],
	// skill 是已解析技能，source 是对应来源，回调合并两者。
	(skill, source) => ({ ...skill, source }),
);
// sourcedPromptTemplates 是从项目和用户目录加载并附加来源的提示模板列表。
const { promptTemplates: sourcedPromptTemplates } = await loadSourcedPromptTemplates<Source, SourcedPromptTemplate>(
	env,
	[source("project", join(env.cwd, ".pi/prompts")), source("user", join(homedir(), ".pi/agent/prompts"))],
	// promptTemplate 是已解析模板，source 是对应来源，回调合并两者。
	(promptTemplate, source) => ({ ...promptTemplate, source }),
);

// models 是可动态注册多个提供商的统一模型目录。
const models = createModels();
models.setProvider(openaiProvider());
models.setProvider(cloudflareAIGatewayProvider());

// model 是本示例实际调用的 OpenAI GPT-5.5 配置。
const model = models.getModel("openai", "gpt-5.5");
// const model = models.getModel("cloudflare-ai-gateway", "claude-haiku-4-5");
// 也可改用上面的 Cloudflare AI Gateway 模型进行手工试验。
if (!model) {
	console.log("Model not found");
	process.exit(-1);
}

// session 使用内存存储，不会把本次手工会话写入磁盘。
const session = new Session(new InMemorySessionStorage());
// agent 组合模型、工具、资源和动态系统提示，形成可执行代理。
const agent = new AgentHarness({
	session,
	models,
	model,
	thinkingLevel: "low",
	tools: [createReadTool(), createWriteTool(), createEditTool(), createBashTool()],
	toolContext: { env },
	// resources 是已加载技能和模板，回调用其构建最终系统提示。
	systemPrompt: ({ resources }) =>
		[
			"You are a helpful assistant.",
			formatSkillsForSystemPrompt(resources.skills ?? []),
			`Current working directory: ${env.cwd}`,
		]
			// part 是当前提示片段，空内容会被过滤。
			.filter((part) => part.length > 0)
			.join("\n\n"),
	resources: {
		// promptTemplate 是带来源记录中的原始模板。
		promptTemplates: sourcedPromptTemplates.map(({ promptTemplate }) => promptTemplate),
		// skill 是带来源记录中的原始技能。
		skills: sourcedSkills.map(({ skill }) => skill),
	},
});

// response 是代理处理综合资源与工具任务后的最终文本结果。
const response = await agent.prompt(
	"What skills do you have? Any duplicates? Also use bash to get the current date and time, then read README.md and tell me what this project is about.",
);
console.log(response);
