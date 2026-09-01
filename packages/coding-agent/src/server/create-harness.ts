/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `server/create-harness` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-agent-core`、`typebox`、`../core/experimental.ts`、`../core/system-prompt.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `server/create-harness` 对应的子能力。
 * 【逻辑维度】对外入口包括 `CodingAgentHarnessTool`、`CreateCodingAgentHarnessOptions`、`BuildCodingAgentHarnessSystemPromptOptions`、`buildCodingAgentHarnessSystemPrompt`、`createCodingAgentHarness`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `CodingAgentHarnessTool`、`CreateCodingAgentHarnessOptions`、`BuildCodingAgentHarnessSystemPromptOptions`、`buildCodingAgentHarnessSystemPrompt`、`createCodingAgentHarness` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import {
	AgentHarness,
	type AgentHarnessOptions,
	type AgentHarnessTool,
	createBashTool,
	createEditTool,
	createReadTool,
	createWriteTool,
	type ExecutionEnv,
	type ExecutionToolContext,
	type HarnessTool,
} from "@earendil-works/pi-agent-core";
import type { Static, TSchema } from "typebox";
import { getExperimentalToolSampling } from "../core/experimental.ts";
import { type BuildSystemPromptOptions, buildSystemPrompt } from "../core/system-prompt.ts";
import { bashToolSystemPromptContribution } from "../core/tools/bash.ts";
import { editToolSystemPromptContribution } from "../core/tools/edit.ts";
import { readToolSystemPromptContribution } from "../core/tools/read.ts";
import { writeToolSystemPromptContribution } from "../core/tools/write.ts";

export interface CodingAgentHarnessTool extends HarnessTool {
	promptSnippet?: string;
	promptGuidelines?: readonly string[];
}

function createCodingAgentHarnessTool<TParameters extends TSchema, TDetails>(
	tool: AgentHarnessTool<ExecutionToolContext, TParameters, TDetails>,
	context: ExecutionToolContext,
	prompt: Required<Pick<CodingAgentHarnessTool, "promptSnippet" | "promptGuidelines">>,
): CodingAgentHarnessTool {
	return {
		...tool,
		...prompt,
		constrainedSampling: getExperimentalToolSampling(),
		execute: (toolCallId, params, signal, onUpdate) =>
			tool.execute(toolCallId, params as Static<TParameters>, signal, onUpdate, context),
	};
}

export interface CreateCodingAgentHarnessOptions extends Omit<AgentHarnessOptions, "toolContext" | "tools"> {
	env: ExecutionEnv;
	bashCommandPrefix?: string;
	/** Path to the JSONL session file exposed to default bash commands as PI_SESSION_FILE. */
	sessionFile?: string;
	tools?: CodingAgentHarnessTool[];
	systemPromptOptions?: Omit<BuildSystemPromptOptions, "cwd" | "promptGuidelines" | "selectedTools" | "toolSnippets">;
}

export interface BuildCodingAgentHarnessSystemPromptOptions {
	cwd: string;
	tools: readonly CodingAgentHarnessTool[];
	activeToolNames: readonly string[];
	systemPromptOptions?: CreateCodingAgentHarnessOptions["systemPromptOptions"];
}

export function buildCodingAgentHarnessSystemPrompt(options: BuildCodingAgentHarnessSystemPromptOptions): string {
	const activeTools = options.activeToolNames.flatMap((name) => {
		const tool = options.tools.find((candidate) => candidate.name === name);
		return tool ? [tool] : [];
	});
	const toolSnippets = Object.fromEntries(
		activeTools.flatMap((tool) => {
			const promptSnippet = tool.promptSnippet
				?.replace(/[\r\n]+/g, " ")
				.replace(/\s+/g, " ")
				.trim();
			return promptSnippet ? [[tool.name, promptSnippet]] : [];
		}),
	);
	const promptGuidelines = activeTools.flatMap((tool) => tool.promptGuidelines ?? []);
	return buildSystemPrompt({
		...options.systemPromptOptions,
		cwd: options.cwd,
		selectedTools: activeTools.map((tool) => tool.name),
		toolSnippets,
		promptGuidelines,
	});
}

export async function createCodingAgentHarness(options: CreateCodingAgentHarnessOptions) {
	const {
		env,
		bashCommandPrefix,
		sessionFile,
		systemPromptOptions,
		tools: providedTools,
		activeToolNames: providedActiveToolNames,
		systemPrompt: providedSystemPrompt,
		...harnessOptions
	} = options;
	let harness: AgentHarness | undefined;
	const getHarness = (): AgentHarness => {
		if (!harness) throw new Error("Coding-agent Harness callback ran before Harness initialization");
		return harness;
	};
	let tools = providedTools;
	if (tools === undefined) {
		const metadata = await options.session.getMetadata();
		const toolContext = { env } satisfies ExecutionToolContext;
		tools = [
			createCodingAgentHarnessTool(createReadTool<ExecutionToolContext>(), toolContext, {
				promptSnippet: readToolSystemPromptContribution.snippet,
				promptGuidelines: readToolSystemPromptContribution.guidelines,
			}),
			createCodingAgentHarnessTool(
				createBashTool<ExecutionToolContext>({
					commandPrefix: bashCommandPrefix,
					prepare: async (execution) => {
						const currentHarness = getHarness();
						const [model, thinkingLevel] = await Promise.all([
							currentHarness.getModel(),
							currentHarness.getThinkingLevel(),
						]);
						execution.env.PI_SESSION_ID = metadata.id;
						execution.env.PI_SESSION_FILE = sessionFile ?? "";
						execution.env.PI_PROVIDER = model.provider;
						execution.env.PI_MODEL = model.id;
						execution.env.PI_REASONING_LEVEL = thinkingLevel;
					},
				}),
				toolContext,
				{
					promptSnippet: bashToolSystemPromptContribution.snippet,
					promptGuidelines: bashToolSystemPromptContribution.guidelines,
				},
			),
			createCodingAgentHarnessTool(createEditTool<ExecutionToolContext>(), toolContext, {
				promptSnippet: editToolSystemPromptContribution.snippet,
				promptGuidelines: editToolSystemPromptContribution.guidelines,
			}),
			createCodingAgentHarnessTool(createWriteTool<ExecutionToolContext>(), toolContext, {
				promptSnippet: writeToolSystemPromptContribution.snippet,
				promptGuidelines: writeToolSystemPromptContribution.guidelines,
			}),
		];
	}
	const activeToolNames = [...(providedActiveToolNames ?? tools.map((tool) => tool.name))];
	const systemPrompt =
		providedSystemPrompt ??
		(async () => {
			const currentHarness = getHarness();
			const [currentTools, currentActiveToolNames] = await Promise.all([
				currentHarness.getTools(),
				currentHarness.getActiveTools(),
			]);
			return buildCodingAgentHarnessSystemPrompt({
				cwd: env.cwd,
				tools: currentTools,
				activeToolNames: currentActiveToolNames,
				systemPromptOptions,
			});
		});
	const created = await AgentHarness.create({
		...harnessOptions,
		tools,
		activeToolNames,
		systemPrompt,
	});
	harness = created.harness;
	return created;
}
