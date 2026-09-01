/**
 * 【文件职责】实现 `@earendil-works/pi-server` 包中的 `types` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-protocol`、`./errors.ts`、`./listener.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的实验性服务端提供实现；本文件负责其中与 `types` 对应的子能力。
 * 【逻辑维度】对外入口包括 `PiServerOptions`、`MaybePromise`、`PromptInput`、`SteerInput`、`CreateSessionOptions`、`PiSessionRuntimeEvent`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `PiServerOptions`、`MaybePromise`、`PromptInput`、`SteerInput`、`CreateSessionOptions`、`PiSessionRuntimeEvent` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type {
	Command,
	ModelMetadata,
	ModelRef,
	SessionMetadata,
	SessionPhase,
	SessionSnapshot,
	ThinkingLevel,
	TranscriptProgress,
} from "@earendil-works/pi-protocol";
import type { PiServerError } from "./errors.ts";
import type { PiServerListener } from "./listener.ts";

export interface PiServerOptions {
	listeners: readonly PiServerListener[];
	maxFrameLength?: number;
	handshakeTimeoutMs?: number;
	serverId?: string;
	onError?: (error: Error) => void;
}

export type MaybePromise<T> = T | Promise<T>;

export type PromptInput = Omit<Extract<Command, { command: "prompt" }>, "command" | "sessionId">;
export type SteerInput = Omit<Extract<Command, { command: "steer" }>, "command" | "sessionId">;

export interface CreateSessionOptions {
	/** A collision-resistant ID assigned by PiServer. The service must persist this exact ID. */
	id: string;
	cwd?: string;
	name?: string;
	model?: ModelRef;
	thinkingLevel?: ThinkingLevel;
}

export type PiSessionRuntimeEvent =
	| { type: "snapshot" }
	| { type: "progress"; progress: TranscriptProgress }
	| { type: "error"; error: PiServerError };

/** One acquired durable session. Conflicting operations must reject rather than queue. */
export interface PiSessionRuntime {
	snapshot(): MaybePromise<SessionSnapshot>;
	getPhase(): SessionPhase;
	prompt(input: PromptInput): Promise<void>;
	steer(input: SteerInput): Promise<void>;
	abort(): Promise<void>;
	setModel(model: ModelRef): Promise<void>;
	setThinking(thinkingLevel: ThinkingLevel): Promise<void>;
	subscribe(listener: (event: PiSessionRuntimeEvent) => void): () => void;
	dispose(): Promise<void>;
}

/** Service boundary for durable sessions and exclusively acquired runtimes. */
export interface PiServerService {
	listSessions(): Promise<SessionMetadata[]>;
	listModels(): Promise<ModelMetadata[]>;
	createSession(options: CreateSessionOptions): Promise<PiSessionRuntime>;
	openSession(sessionId: string): Promise<PiSessionRuntime>;
}

export type SessionRuntime = PiSessionRuntime;
export type SessionRuntimeEvent = PiSessionRuntimeEvent;
