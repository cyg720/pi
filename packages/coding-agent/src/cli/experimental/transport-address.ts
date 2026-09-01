/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `cli/experimental/transport-address` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `node:path`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `cli/experimental/transport-address` 对应的子能力。
 * 【逻辑维度】对外入口包括 `UnixTransportAddress`、`TransportAddress`、`parseTransportAddress`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `UnixTransportAddress`、`TransportAddress`、`parseTransportAddress` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { posix } from "node:path";

export interface UnixTransportAddress {
	readonly transport: "unix";
	readonly path: string;
}

export type TransportAddress = UnixTransportAddress;

export function parseTransportAddress(
	value: string,
	option: "--listen" | "--connect",
): { address?: TransportAddress; error?: string } {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return { error: `Invalid ${option} address "${value}"` };
	}
	if (url.protocol !== "unix:") {
		return { error: `Unsupported ${option} transport "${url.protocol}"` };
	}
	if (url.hostname || url.port || url.username || url.password) {
		return { error: "Unix transport address must not include an authority" };
	}
	if (
		!value.startsWith("unix:///") ||
		value.startsWith("unix:////") ||
		value.includes("?") ||
		value.includes("#") ||
		url.href !== value
	) {
		return { error: `Invalid ${option} address "${value}"` };
	}
	let path: string;
	try {
		path = decodeURIComponent(url.pathname);
	} catch {
		return { error: `Invalid ${option} address "${value}"` };
	}
	if (path.includes("\0")) {
		return { error: `Invalid ${option} address "${value}"` };
	}
	if (!posix.isAbsolute(path)) {
		return { error: "Unix transport address requires an absolute path" };
	}
	return { address: { transport: "unix", path } };
}
