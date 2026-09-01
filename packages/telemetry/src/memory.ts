/**
 * 【文件职责】实现 `@earendil-works/pi-telemetry` 包中的 `memory` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `./index.ts`、`./noop.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 定义供应商无关的遥测契约和强类型 schema 工具；本文件负责其中与 `memory` 对应的子能力。
 * 【逻辑维度】对外入口包括 `RecordedTelemetryEvent`、`RecordedTelemetrySpan`、`InMemoryTelemetryContext`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `RecordedTelemetryEvent`、`RecordedTelemetrySpan`、`InMemoryTelemetryContext` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type {
	AttributeValue,
	SpanAttributes,
	SpanOptions,
	SpanStatus,
	TelemetryContext,
	TelemetrySpan,
} from "./index.ts";
import { NOOP_TELEMETRY_CONTEXT } from "./noop.ts";

export interface RecordedTelemetryEvent {
	readonly name: string;
	readonly attributes: Readonly<SpanAttributes>;
}

export interface RecordedTelemetrySpan {
	readonly id: number;
	readonly parentId: number | null;
	readonly name: string;
	readonly attributes: Readonly<SpanAttributes>;
	readonly events: readonly RecordedTelemetryEvent[];
	readonly status: SpanStatus;
	readonly settled: boolean;
	readonly endSequence?: number;
}

interface MutableRecordedTelemetryEvent {
	name: string;
	attributes: SpanAttributes;
}

interface MutableRecordedTelemetrySpan {
	id: number;
	parentId: number | null;
	name: string;
	attributes: SpanAttributes;
	events: MutableRecordedTelemetryEvent[];
	status: SpanStatus;
	explicitStatus: boolean;
	settled: boolean;
	endSequence?: number;
}

interface InMemoryTelemetryState {
	spans: MutableRecordedTelemetrySpan[];
	nextSpanId: number;
	nextEndSequence: number;
}

function copyAttributeValue(value: AttributeValue): AttributeValue {
	return Array.isArray(value) ? ([...value] as AttributeValue) : value;
}

function copyAttributes(attributes?: SpanAttributes): SpanAttributes {
	const copy: SpanAttributes = {};
	if (!attributes) return copy;
	for (const [name, value] of Object.entries(attributes)) {
		if (value !== undefined) copy[name] = copyAttributeValue(value);
	}
	return copy;
}

function mergeAttributes(current: SpanAttributes, attributes: SpanAttributes): SpanAttributes {
	const merged = copyAttributes(current);
	for (const [name, value] of Object.entries(attributes)) {
		if (value !== undefined) merged[name] = copyAttributeValue(value);
	}
	return merged;
}

function copyStatus(status: SpanStatus): SpanStatus {
	if (status.status === "ok") return { status: "ok" };
	return status.error
		? { status: "error", error: { name: status.error.name, message: status.error.message } }
		: { status: "error" };
}

function automaticErrorStatus(error: unknown): SpanStatus {
	try {
		if (error instanceof Error) {
			return { status: "error", error: { name: error.name, message: error.message } };
		}
	} catch {
		// Error inspection is passive. Fall through to an error status without details.
	}
	return { status: "error" };
}

function settleSpan(
	state: InMemoryTelemetryState,
	span: MutableRecordedTelemetrySpan,
	failed: boolean,
	error?: unknown,
): void {
	if (span.settled) return;
	if (failed && !span.explicitStatus) span.status = automaticErrorStatus(error);
	span.settled = true;
	span.endSequence = state.nextEndSequence++;
}

function createSpan(
	state: InMemoryTelemetryState,
	parent: MutableRecordedTelemetrySpan | undefined,
	options: SpanOptions,
): MutableRecordedTelemetrySpan {
	const name = options.name;
	const attributes = copyAttributes(options.attributes);
	return {
		id: state.nextSpanId++,
		parentId: parent?.id ?? null,
		name,
		attributes,
		events: [],
		status: { status: "ok" },
		explicitStatus: false,
		settled: false,
	};
}

function startInMemorySpan<T>(
	state: InMemoryTelemetryState,
	parent: MutableRecordedTelemetrySpan | undefined,
	options: SpanOptions,
	callback: (span: TelemetrySpan) => T | Promise<T>,
): Promise<T> {
	if (parent?.settled) return NOOP_TELEMETRY_CONTEXT.startSpan(options, callback);

	let recordedSpan: MutableRecordedTelemetrySpan;
	try {
		recordedSpan = createSpan(state, parent, options);
		state.spans.push(recordedSpan);
	} catch {
		return NOOP_TELEMETRY_CONTEXT.startSpan(options, callback);
	}

	const span: TelemetrySpan = {
		startSpan: <Result>(
			childOptions: SpanOptions,
			childCallback: (child: TelemetrySpan) => Result | Promise<Result>,
		) => startInMemorySpan(state, recordedSpan, childOptions, childCallback),
		addEvent(name, attributes) {
			if (recordedSpan.settled) return;
			try {
				recordedSpan.events.push({ name, attributes: copyAttributes(attributes) });
			} catch {
				// Recording is passive. Ignore malformed or unreadable telemetry payloads.
			}
		},
		setAttributes(attributes) {
			if (recordedSpan.settled) return;
			try {
				recordedSpan.attributes = mergeAttributes(recordedSpan.attributes, attributes);
			} catch {
				// Recording is passive. Ignore malformed or unreadable telemetry payloads.
			}
		},
		setStatus(status) {
			if (recordedSpan.settled) return;
			try {
				recordedSpan.status = copyStatus(status);
				recordedSpan.explicitStatus = true;
			} catch {
				// Recording is passive. Ignore malformed or unreadable telemetry payloads.
			}
		},
	};

	let result: T | Promise<T>;
	try {
		result = callback(span);
	} catch (error) {
		settleSpan(state, recordedSpan, true, error);
		return Promise.reject(error);
	}

	return Promise.resolve(result).then(
		(value) => {
			settleSpan(state, recordedSpan, false);
			return value;
		},
		(error: unknown) => {
			settleSpan(state, recordedSpan, true, error);
			throw error;
		},
	);
}

/**
 * Backend-neutral reference implementation that records spans in process memory.
 * Create a fresh instance to isolate tests or independent recording scopes.
 */
export class InMemoryTelemetryContext implements TelemetryContext {
	private readonly state: InMemoryTelemetryState = {
		spans: [],
		nextSpanId: 1,
		nextEndSequence: 1,
	};

	startSpan<T>(options: SpanOptions, callback: (span: TelemetrySpan) => T | Promise<T>): Promise<T> {
		return startInMemorySpan(this.state, undefined, options, callback);
	}

	/** Returns detached snapshots in span-start order. */
	getSpans(): readonly RecordedTelemetrySpan[] {
		return this.state.spans.map((span) => ({
			id: span.id,
			parentId: span.parentId,
			name: span.name,
			attributes: copyAttributes(span.attributes),
			events: span.events.map((event) => ({
				name: event.name,
				attributes: copyAttributes(event.attributes),
			})),
			status: copyStatus(span.status),
			settled: span.settled,
			...(span.endSequence === undefined ? {} : { endSequence: span.endSequence }),
		}));
	}
}
