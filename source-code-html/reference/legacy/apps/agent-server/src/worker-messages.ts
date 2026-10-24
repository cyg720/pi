import type { ConfiguredLocalModelOptions, WorkbenchRuntimeOptions } from "@pi-workbench/runtime-adapter";
export interface WorkerInit {
	configuredModel?: ConfiguredLocalModelOptions;
	builtinExtensions?: { codemode?: boolean; mcpLocalEcho?: boolean };
	options: Pick<
		WorkbenchRuntimeOptions,
		| "cwd"
		| "agentDir"
		| "sessionDir"
		| "sessionFile"
		| "mode"
		| "tools"
		| "allowedTools"
		| "scopedSettings"
		| "fauxResponses"
		| "fauxTokensPerSecond"
		| "fauxResponseSteps"
		| "fauxModels"
	>;
}
export type WorkerCommand =
	| "init"
	| "prompt"
	| "queue"
	| "abort"
	| "dispose"
	| "snapshot"
	| "tools"
	| "extensions"
	| "context"
	| "tree"
	| "resources"
	| "export"
	| "compact"
	| "navigate"
	| "fork"
	| "model"
	| "thinking"
	| "toolsSet"
	| "clearQueue";
export interface WorkerRequest {
	id: string;
	command: WorkerCommand;
	args: Record<string, unknown>;
}
