import { EventEmitter } from "node:events";

/**
 * 【文件职责】事件总线：发布/订阅任意类型事件的轻量实现。
 * 【产品维度】模块间解耦通信的公共设施。
 * 【逻辑维度】createEventBus 返回 {on/emit/off}。
 * 【新手阅读建议】半分钟读完即可。
 */
export interface EventBus {
	emit(channel: string, data: unknown): void;
	on(channel: string, handler: (data: unknown) => void): () => void;
}

export interface EventBusController extends EventBus {
	clear(): void;
}

export function createEventBus(): EventBusController {
	const emitter = new EventEmitter();
	return {
		emit: (channel, data) => {
			emitter.emit(channel, data);
		},
		on: (channel, handler) => {
			const safeHandler = async (data: unknown) => {
				try {
					await handler(data);
				} catch (err) {
					console.error(`Event handler error (${channel}):`, err);
				}
			};
			emitter.on(channel, safeHandler);
			return () => emitter.off(channel, safeHandler);
		},
		clear: () => {
			emitter.removeAllListeners();
		},
	};
}
