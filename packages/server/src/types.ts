<<<<<<< HEAD
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
=======
import type { JsonValue, ServiceCall, ServiceProviderUpdate } from "@earendil-works/chord";
import type { Context, SessionMetadata } from "@earendil-works/pi-agent-core";
import type { ServerListener } from "./listener.ts";
>>>>>>> main

export interface ServerOptions {
	listeners: readonly ServerListener[];
	/** Stable logical server identity supplied by the installation or profile. */
	serverId: string;
	maxFrameLength?: number;
	handshakeTimeoutMs?: number;
	onConnectionCountChanged?: (count: number) => void;
	onError?: (error: Error) => void;
}

export type MaybePromise<T> = T | Promise<T>;

/** One presentation connection's live capability for a hosted Session. */
export interface RoutedSessionAttachment {
	/** Route one contract-agnostic service operation to the attached Session endpoint. */
	invokeService(
		call: ServiceCall,
		publish: (subscriptionId: string, update: ServiceProviderUpdate, context: Context) => MaybePromise<void>,
		context: Context,
	): Promise<JsonValue | undefined>;
	release(context: Context): MaybePromise<void>;
}

/** Presentation-scoped routing capabilities available to server service implementations. */
export interface RoutedServerPresentation {
	attachSession(sessionId: string, context: Context): Promise<void>;
	detachSession(context: Context): Promise<void>;
	/** Release routed attachments and handles before the application deletes durable metadata. */
	prepareSessionRemoval(sessionId: string, context: Context): Promise<void>;
}

/** One connection's server-scoped service endpoint. */
export interface RoutedServerServiceAttachment {
	invokeService(
		call: ServiceCall,
		publish: (subscriptionId: string, update: ServiceProviderUpdate, context: Context) => MaybePromise<void>,
		context: Context,
	): Promise<JsonValue | undefined>;
	release(context: Context): MaybePromise<void>;
}

export interface RoutedServerServiceHost {
	attachClient(presentation: RoutedServerPresentation, context: Context): MaybePromise<RoutedServerServiceAttachment>;
}

/** A process-safe handle that acquires presentation-scoped Session capabilities. */
export interface RoutedSessionHandle {
	attachClient(context: Context): MaybePromise<RoutedSessionAttachment>;
	/** Resolves with an error for unexpected termination, or undefined after an expected close. */
	readonly terminated?: Promise<Error | undefined>;
	close(context: Context): Promise<void>;
}

/** Application capabilities used by server-wide management and Session routing. */
export interface ServerHost<TMetadata extends SessionMetadata = SessionMetadata> {
	readonly serverServices: RoutedServerServiceHost;
	/** Resolve one durable Session ID or throw a bounded routing error. */
	resolveSession(sessionId: string, context: Context): Promise<TMetadata>;
	openSession(metadata: TMetadata, context: Context): Promise<RoutedSessionHandle>;
}
