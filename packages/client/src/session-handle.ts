/**
 * 【文件职责】实现 `@earendil-works/pi-client` 包中的 `session-handle` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-protocol`、`./types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为远程 pi 会话提供基于 CBOR 帧字节的传输无关客户端能力；本文件负责其中与 `session-handle` 对应的子能力。
 * 【逻辑维度】对外入口包括 `SessionLeaseMode`、`AcquireSessionOptions`、`SessionLease`、`PiSessionHandle`、`SessionHandleCallbacks`、`SessionHandle`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `SessionLeaseMode`、`AcquireSessionOptions`、`SessionLease`、`PiSessionHandle`、`SessionHandleCallbacks`、`SessionHandle` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type {
	Command,
	ModelRef,
	ResultForCommand,
	ServerEvent,
	SessionSnapshot,
	ThinkingLevel,
} from "@earendil-works/pi-protocol";
import type { Unsubscribe } from "./types.ts";

type SessionCommand = Extract<Command, { sessionId: string }>;

export type SessionLeaseMode = "shared" | "exclusive";

export interface AcquireSessionOptions {
	mode: SessionLeaseMode;
}

export interface SessionLease extends AsyncDisposable {
	readonly id: string;
	readonly active: boolean;
	readonly attached: boolean;
	readonly snapshot: SessionSnapshot | undefined;
	subscribe(listener: (snapshot: SessionSnapshot) => void): Unsubscribe;
	onEvent(listener: (event: ServerEvent) => void): Unsubscribe;
	detach(): Promise<void>;
	dispose(): Promise<void>;
	prompt(text: string): Promise<SessionSnapshot>;
	steer(text: string): Promise<SessionSnapshot>;
	abort(): Promise<SessionSnapshot>;
	setModel(model: ModelRef): Promise<SessionSnapshot>;
	setThinking(thinkingLevel: ThinkingLevel): Promise<SessionSnapshot>;
}

export type PiSessionHandle = SessionLease;

export interface SessionHandleCallbacks {
	isAttached(): boolean;
	getSnapshot(): SessionSnapshot | undefined;
	subscribe(listener: (snapshot: SessionSnapshot) => void): Unsubscribe;
	onEvent(listener: (event: ServerEvent) => void): Unsubscribe;
	detach(): Promise<void>;
	dispose(): Promise<void>;
	request<const TCommand extends SessionCommand>(command: TCommand): Promise<ResultForCommand<TCommand>>;
}

export class SessionHandle implements SessionLease {
	readonly id: string;
	readonly #callbacks: SessionHandleCallbacks;

	constructor(id: string, callbacks: SessionHandleCallbacks) {
		this.id = id;
		this.#callbacks = callbacks;
	}

	get attached(): boolean {
		return this.#callbacks.isAttached();
	}

	get active(): boolean {
		return this.attached;
	}

	get snapshot(): SessionSnapshot | undefined {
		return this.#callbacks.getSnapshot();
	}

	subscribe(listener: (snapshot: SessionSnapshot) => void): Unsubscribe {
		return this.#callbacks.subscribe(listener);
	}

	onEvent(listener: (event: ServerEvent) => void): Unsubscribe {
		return this.#callbacks.onEvent(listener);
	}

	async detach(): Promise<void> {
		await this.#callbacks.detach();
	}

	dispose(): Promise<void> {
		return this.#callbacks.dispose();
	}

	[Symbol.asyncDispose](): Promise<void> {
		return this.dispose();
	}

	async prompt(text: string): Promise<SessionSnapshot> {
		return (await this.#request({ command: "prompt", sessionId: this.id, text })).session;
	}

	async steer(text: string): Promise<SessionSnapshot> {
		return (await this.#request({ command: "steer", sessionId: this.id, text })).session;
	}

	async abort(): Promise<SessionSnapshot> {
		return (await this.#request({ command: "abort", sessionId: this.id })).session;
	}

	async setModel(model: ModelRef): Promise<SessionSnapshot> {
		return (await this.#request({ command: "set_model", sessionId: this.id, model })).session;
	}

	async setThinking(thinkingLevel: ThinkingLevel): Promise<SessionSnapshot> {
		return (await this.#request({ command: "set_thinking", sessionId: this.id, thinkingLevel })).session;
	}

	#request<const TCommand extends SessionCommand>(command: TCommand): Promise<ResultForCommand<TCommand>> {
		return this.#callbacks.request(command);
	}
}
