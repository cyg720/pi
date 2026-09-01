/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `index` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-ai`、`@earendil-works/pi-telemetry`、`./agent.ts`、`./agent-loop.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `index` 对应的子能力。
 * 【逻辑维度】本文件通过重导出汇总相邻模块的公开符号，使调用方可以从稳定入口访问各项能力。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看各条重导出语句，再进入对应子模块阅读具体类型与实现。
 */
// Core Agent

export { uuidv7 } from "@earendil-works/pi-ai";
export type {
	AttributeValue,
	ExactTelemetryAttributes,
	InferEventAttributes,
	InferOptionalAttributes,
	InferRequiredAndOptionalAttributes,
	InferStartAttributes,
	RecordedTelemetryEvent,
	RecordedTelemetrySpan,
	SchemaTelemetrySpan,
	SpanAttributes,
	SpanAttributes as TelemetrySpanAttributes,
	SpanOptions,
	SpanStatus,
	TelemetryAttributeDefinition,
	TelemetryAttributeMetadata,
	TelemetryAttributeType,
	TelemetryContext,
	TelemetryEventAttributeDefinition,
	TelemetryEventDefinition,
	TelemetryParentDefinition,
	TelemetrySchemaDefinition,
	TelemetrySchemaSpanEndAttributes,
	TelemetrySchemaSpanEventAttributes,
	TelemetrySchemaSpanEventName,
	TelemetrySchemaSpanName,
	TelemetrySchemaSpanStartAttributes,
	TelemetrySchemaSpanUnion,
	TelemetrySpan,
	TelemetrySpanDefinition,
	TelemetryStartAttributeDefinition,
	TypedSpanStarter,
} from "@earendil-works/pi-telemetry";
export {
	createTypedSpanStarter,
	defineTelemetrySchema,
	InMemoryTelemetryContext,
	NOOP_TELEMETRY_CONTEXT,
} from "@earendil-works/pi-telemetry";
export * from "./agent.ts";
// Loop functions
export * from "./agent-loop.ts";
export * from "./harness/agent-harness.ts";
export {
	type BranchPreparation,
	type BranchSummaryDetails,
	type BranchSummaryResult,
	type CollectEntriesResult,
	collectEntriesForBranchSummary,
	type FileOperations,
	type GenerateBranchSummaryOptions,
	generateBranchSummary,
	prepareBranchEntries,
} from "./harness/compaction/branch-summarization.ts";
export {
	type CompactionPreparation,
	type CompactionSettings,
	type CompactResult,
	calculateContextTokens,
	compact,
	DEFAULT_COMPACTION_SETTINGS,
	estimateContextTokens,
	estimateTokens,
	findCutPoint,
	findTurnStartIndex,
	generateSummary,
	generateSummaryWithUsage,
	getLastAssistantUsage,
	prepareCompaction,
	serializeConversation,
	shouldCompact,
} from "./harness/compaction/compaction.ts";
export * from "./harness/messages.ts";
export * from "./harness/prompt-templates.ts";
// Harness
export * from "./harness/result.ts";
export * from "./harness/session/index.ts";
export * from "./harness/skills.ts";
export * from "./harness/system-prompt.ts";
export type {
	AiSpan,
	AiSpanAttributes,
	AiSpanEndAttributes,
	AiSpanEventAttributes,
	AiSpanEventName,
	AiSpanName,
	AiSpanStartAttributes,
	AiTelemetrySpan,
	HarnessSpan,
	HarnessSpanAttributes,
	HarnessSpanEndAttributes,
	HarnessSpanEventAttributes,
	HarnessSpanEventName,
	HarnessSpanName,
	HarnessSpanStartAttributes,
	HarnessTelemetrySpan,
} from "./harness/telemetry.ts";
export {
	AGENT_TELEMETRY_SCHEMAS,
	AI_TELEMETRY_SCHEMA,
	HARNESS_TELEMETRY_SCHEMA,
	startAiSpan,
	startHarnessSpan,
} from "./harness/telemetry.ts";
export * from "./harness/tools/index.ts";
export {
	type AgentHarnessResources,
	type AgentHarnessStreamOptions,
	type AgentHarnessStreamOptionsPatch,
	type AgentHarnessTool,
	type AgentHarnessToolContextSource,
	BranchSummaryError,
	type BranchSummaryErrorCode,
	CompactionError,
	type CompactionErrorCode,
	type ExecutionEnv,
	ExecutionError,
	type ExecutionErrorCode,
	err,
	FileError,
	type FileErrorCode,
	type FileInfo,
	type FileKind,
	type FileSystem,
	getOrThrow,
	getOrUndefined,
	ok,
	type PromptTemplate,
	type Shell,
	type ShellExecOptions,
	type Skill,
	toError,
} from "./harness/types.ts";
export * from "./harness/utils/shell-output.ts";
export * from "./harness/utils/truncate.ts";
// Proxy utilities
export * from "./proxy.ts";
export * from "./search/index.ts";
// Stream defaults
export { setDefaultStreamFn } from "./stream-fn.ts";
// Types
export * from "./types.ts";
