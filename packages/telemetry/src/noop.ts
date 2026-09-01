/**
 * 【文件职责】实现 `@earendil-works/pi-telemetry` 包中的 `noop` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `./index.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 定义供应商无关的遥测契约和强类型 schema 工具；本文件负责其中与 `noop` 对应的子能力。
 * 【逻辑维度】对外入口包括 `NOOP_TELEMETRY_CONTEXT`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `NOOP_TELEMETRY_CONTEXT` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { SpanOptions, TelemetryContext, TelemetrySpan } from "./index.ts";

function startNoopSpan<T>(_options: SpanOptions, callback: (span: TelemetrySpan) => T | Promise<T>): Promise<T> {
	try {
		return Promise.resolve(callback(noopTelemetrySpan));
	} catch (error) {
		return Promise.reject(error);
	}
}

const noopTelemetrySpan: TelemetrySpan = {
	startSpan: startNoopSpan,
	addEvent: () => {},
	setAttributes: () => {},
	setStatus: () => {},
};
Object.freeze(noopTelemetrySpan);

/** Shared telemetry context used when an application does not provide one. */
export const NOOP_TELEMETRY_CONTEXT: TelemetryContext = noopTelemetrySpan;
