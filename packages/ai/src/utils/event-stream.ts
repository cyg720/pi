/**
 * 【文件职责】通用事件流（EventStream）：支持异步迭代与"最终结果"Promise 的推式事件流；
 *              并提供助手消息事件流的特化（AssistantMessageEventStream）。
 * 【技术维度】生产者-消费者队列（等待者数组）；AsyncIterable 协议；终止事件判定 + 结果提取。
 * 【产品维度】流式 API 的统一返回形态：模型输出增量经它交付给上层，同时可 await result()
 *              拿到最终助手消息。
 * 【逻辑维度】push 投递/入队并在终止事件时结算结果 → end 结束并唤醒等待者 →
 *              [Symbol.asyncIterator] 产出事件 → result() 等待最终结果。
 * 【关键边界】终止事件（done/error）后 push 被忽略；result() 的解析由终止事件或 end(result)
 *              触发；事件一旦入队即按 FIFO 消费。
 * 【新手阅读建议】先读 EventStream 的 push/迭代器/result 三件套 → 再看子类如何以 done/error
 *              判定终止并提取消息。
 */
import type { AssistantMessage, AssistantMessageEvent } from "../types.ts";

// Generic event stream class for async iteration
// 通用事件流（中文说明）：泛型 T 事件、R 最终结果；生产者 push/end，消费者异步迭代。
export class EventStream<T, R = T> implements AsyncIterable<T> {
	// 已入队待消费的事件
	private queue: T[] = [];
	// 等待中的消费者（IteratorResult 解析器）
	private waiting: ((value: IteratorResult<T>) => void)[] = [];
	// 流是否已结束
	private done = false;
	// 最终结果 Promise（end/终止事件时 resolve）
	private finalResultPromise: Promise<R>;
	// 最终结果解析器（构造时赋值）
	private resolveFinalResult!: (result: R) => void;
	// 终止事件判定函数
	private isComplete: (event: T) => boolean;
	// 从终止事件提取最终结果
	private extractResult: (event: T) => R;

	// 构造函数：注入终止判定与结果提取逻辑
	constructor(isComplete: (event: T) => boolean, extractResult: (event: T) => R) {
		this.isComplete = isComplete;
		this.extractResult = extractResult;
		this.finalResultPromise = new Promise((resolve) => {
			this.resolveFinalResult = resolve;
		});
	}

	// 推入一个事件（公开）：终止事件同时结算最终结果；有等待消费者则直投，否则入队
	push(event: T): void {
		if (this.done) return;

		if (this.isComplete(event)) {
			this.done = true;
			this.resolveFinalResult(this.extractResult(event));
		}

		// Deliver to waiting consumer or queue it
		// 投递给等待者或入队
		const waiter = this.waiting.shift();
		if (waiter) {
			waiter({ value: event, done: false });
		} else {
			this.queue.push(event);
		}
	}

	// 结束流（公开）：可选携带结果；唤醒全部等待消费者
	end(result?: R): void {
		this.done = true;
		if (result !== undefined) {
			this.resolveFinalResult(result);
		}
		// Notify all waiting consumers that we're done
		// 通知全部等待者结束
		while (this.waiting.length > 0) {
			const waiter = this.waiting.shift()!;
			waiter({ value: undefined as any, done: true });
		}
	}

	// 异步迭代器：消费队列中事件；无事件且未结束则挂起等待
	async *[Symbol.asyncIterator](): AsyncIterator<T> {
		while (true) {
			if (this.queue.length > 0) {
				yield this.queue.shift()!;
			} else if (this.done) {
				return;
			} else {
				const result = await new Promise<IteratorResult<T>>((resolve) => this.waiting.push(resolve));
				if (result.done) return;
				yield result.value;
			}
		}
	}

	// 最终结果（公开）：等待终止事件或 end 结算
	result(): Promise<R> {
		return this.finalResultPromise;
	}
}

// 助手消息事件流（中文说明）：以 done/error 为终止事件，结果提取出最终 AssistantMessage。
export class AssistantMessageEventStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	constructor() {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") {
					return event.message;
				} else if (event.type === "error") {
					return event.error;
				}
				throw new Error("Unexpected event type for final result");
			},
		);
	}
}

/** Factory function for AssistantMessageEventStream (for use in extensions) */
// 创建助手消息事件流的工厂函数（供扩展使用）
export function createAssistantMessageEventStream(): AssistantMessageEventStream {
	return new AssistantMessageEventStream();
}
