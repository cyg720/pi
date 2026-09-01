/**
 * 【文件职责】实现 `@earendil-works/pi-protocol` 包中的 `cbor/options` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 语言内建能力与本文件声明，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为远程 pi 会话定义传输无关的 CBOR 通信协议；本文件负责其中与 `cbor/options` 对应的子能力。
 * 【逻辑维度】对外入口包括 `UINT32_BASE`、`MAX_UINT32`、`DEFAULT_MAX_CBOR_BYTE_LENGTH`、`DEFAULT_MAX_CBOR_CONTAINER_LENGTH`、`DEFAULT_MAX_CBOR_DEPTH`、`CborOptions`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `UINT32_BASE`、`MAX_UINT32`、`DEFAULT_MAX_CBOR_BYTE_LENGTH`、`DEFAULT_MAX_CBOR_CONTAINER_LENGTH`、`DEFAULT_MAX_CBOR_DEPTH`、`CborOptions` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
export const UINT32_BASE = 0x1_0000_0000;
export const MAX_UINT32 = 0xffff_ffff;
const MAX_CONFIGURED_DEPTH = 512;

/** Safe defaults for untrusted protocol payloads. */
export const DEFAULT_MAX_CBOR_BYTE_LENGTH = 16 * 1024 * 1024;
export const DEFAULT_MAX_CBOR_CONTAINER_LENGTH = 1_000_000;
export const DEFAULT_MAX_CBOR_DEPTH = 64;

export interface CborOptions {
	/** Maximum encoded input/output bytes and maximum byte/text string length. */
	maxByteLength?: number;
	/** Maximum number of elements in an array or entries in a map. */
	maxContainerLength?: number;
	/** Maximum recursive item depth. */
	maxDepth?: number;
}

export interface ResolvedCborOptions {
	maxByteLength: number;
	maxContainerLength: number;
	maxDepth: number;
}

export class CborError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CborError";
	}
}

export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function resolveLimit(name: string, value: number, maximum: number): number {
	if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
		throw new RangeError(`${name} must be an integer between 0 and ${maximum}`);
	}
	return value;
}

export function resolveOptions(options: CborOptions | undefined): ResolvedCborOptions {
	return {
		maxByteLength: resolveLimit("maxByteLength", options?.maxByteLength ?? DEFAULT_MAX_CBOR_BYTE_LENGTH, MAX_UINT32),
		maxContainerLength: resolveLimit(
			"maxContainerLength",
			options?.maxContainerLength ?? DEFAULT_MAX_CBOR_CONTAINER_LENGTH,
			MAX_UINT32,
		),
		maxDepth: resolveLimit("maxDepth", options?.maxDepth ?? DEFAULT_MAX_CBOR_DEPTH, MAX_CONFIGURED_DEPTH),
	};
}
