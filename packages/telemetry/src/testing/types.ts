/**
 * 【文件职责】实现 `@earendil-works/pi-telemetry` 包中的 `testing/types` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../index.ts`、`../memory.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 定义供应商无关的遥测契约和强类型 schema 工具；本文件负责其中与 `testing/types` 对应的子能力。
 * 【逻辑维度】对外入口包括 `TelemetryAdapterFixture`、`TelemetryAdapterFixtureFactory`、`TelemetryAdapterConformanceCase`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `TelemetryAdapterFixture`、`TelemetryAdapterFixtureFactory`、`TelemetryAdapterConformanceCase` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { TelemetryContext } from "../index.ts";
import type { RecordedTelemetrySpan } from "../memory.ts";

/** A fresh adapter instance and normalized snapshot reader owned by one conformance case. */
export interface TelemetryAdapterFixture extends AsyncDisposable {
	readonly context: TelemetryContext;
	getSpans(): Promise<readonly RecordedTelemetrySpan[]>;
}

/** Creates an isolated adapter fixture for one conformance case. */
export type TelemetryAdapterFixtureFactory = () => Promise<TelemetryAdapterFixture>;

/** A runner-independent conformance case that can be registered with any test framework. */
export interface TelemetryAdapterConformanceCase {
	readonly group: string;
	readonly name: string;
	run(): Promise<void>;
}
