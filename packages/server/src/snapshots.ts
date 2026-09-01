/**
 * 【文件职责】实现 `@earendil-works/pi-server` 包中的 `snapshots` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-protocol`、`./connection.ts`、`./types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的实验性服务端提供实现；本文件负责其中与 `snapshots` 对应的子能力。
 * 【逻辑维度】对外入口包括 `ServerSnapshotPublisher`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `ServerSnapshotPublisher` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import {
	type EventEnvelope,
	type ModelMetadata,
	PROTOCOL_VERSION,
	type ServerSnapshot,
	type SessionMetadata,
} from "@earendil-works/pi-protocol";
import type { ConnectionState } from "./connection.ts";
import type { PiServerService } from "./types.ts";

interface ServerSnapshotPublisherOptions {
	serverId: string;
	service: PiServerService;
	connections: Set<ConnectionState>;
	isClosing: () => boolean;
	listSessions: () => Promise<SessionMetadata[]>;
	sendMessage: (connection: ConnectionState, message: EventEnvelope) => Promise<boolean>;
	reportError: (error: unknown) => void;
}

export class ServerSnapshotPublisher {
	private readonly options: ServerSnapshotPublisherOptions;
	private revision = 0;
	private broadcastQueue: Promise<void> = Promise.resolve();

	constructor(options: ServerSnapshotPublisherOptions) {
		this.options = options;
	}

	get currentRevision(): number {
		return this.revision;
	}

	async get(models?: ModelMetadata[]): Promise<ServerSnapshot> {
		return {
			serverId: this.options.serverId,
			protocolVersion: PROTOCOL_VERSION,
			revision: this.revision,
			sessions: await this.options.listSessions(),
			models: models ?? (await this.options.service.listModels()),
		};
	}

	broadcast(): Promise<void> {
		const broadcast = this.broadcastQueue.then(() => this.performBroadcast());
		this.broadcastQueue = broadcast.catch((error: unknown) => this.options.reportError(error));
		return broadcast;
	}

	private async performBroadcast(): Promise<void> {
		const readyConnections = [...this.options.connections].filter(
			(connection) => connection.stage === "ready" && !connection.disconnected,
		);
		if (readyConnections.length === 0 || this.options.isClosing()) return;
		const revision = ++this.revision;
		const models = await this.options.service.listModels();
		const current = await this.get(models);
		const snapshot: ServerSnapshot = { ...current, revision };
		const envelope: EventEnvelope = { type: "event", event: { type: "server_snapshot", snapshot } };
		for (const connection of readyConnections) await this.options.sendMessage(connection, envelope);
	}
}
