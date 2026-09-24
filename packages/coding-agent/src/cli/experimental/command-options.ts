<<<<<<< HEAD
/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `cli/experimental/command-options` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../args.ts`、`./auth.ts`、`./command.ts`、`./transport-address.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `cli/experimental/command-options` 对应的子能力。
 * 【逻辑维度】对外入口包括 `authTokenOption`、`authTokenFileOption`、`transportOption`、`parseAuth`、`parseLegacyOptions`、`unsupportedLegacyOptions`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `authTokenOption`、`authTokenFileOption`、`transportOption`、`parseAuth`、`parseLegacyOptions`、`unsupportedLegacyOptions` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { type Args, parseArgs } from "../args.ts";
import { type AuthInput, parseAuthInput } from "./auth.ts";
import { type CommandOption, type ParsedCommandInput, stringOption, valueOption } from "./command.ts";
import { parseTransportAddress, type TransportAddress } from "./transport-address.ts";
=======
import { posix } from "node:path";
import { isServerId, type ServerId } from "@earendil-works/pi-protocol";
import { type ParsedCommandInput, stringOption, valueOption } from "./command.ts";

export type AuthInput =
	| { readonly type: "token"; readonly token: string }
	| { readonly type: "file"; readonly path: string };

interface UnixTransportAddress {
	readonly transport: "unix";
	readonly path: string;
}

interface RadiusTransportAddress {
	readonly transport: "radius";
	readonly serverId: ServerId;
}

export type TransportAddress = UnixTransportAddress | RadiusTransportAddress;
>>>>>>> main

export const authTokenOption = stringOption("--auth-token");
export const authTokenFileOption = stringOption("--auth-token-file");

function parseAuthInput(options: { readonly authToken?: string; readonly authTokenFile?: string }): {
	auth?: AuthInput;
	errors: string[];
} {
	if (options.authToken !== undefined && options.authTokenFile !== undefined) {
		return { errors: ["--auth-token and --auth-token-file are mutually exclusive"] };
	}
	if (options.authToken !== undefined) {
		return { auth: { type: "token", token: options.authToken }, errors: [] };
	}
	if (options.authTokenFile !== undefined) {
		return { auth: { type: "file", path: options.authTokenFile }, errors: [] };
	}
	return { errors: [] };
}

function parseTransportAddress(value: string): { address?: TransportAddress; error?: string } {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return { error: `Invalid --connect address "${value}"` };
	}
	if (url.protocol === "radius:") {
		if (
			url.username ||
			url.password ||
			url.port ||
			(url.pathname !== "" && url.pathname !== "/") ||
			url.search ||
			url.hash ||
			value !== `radius://${url.hostname}${url.pathname}`
		) {
			return { error: `Invalid --connect address "${value}"` };
		}
		const serverId = url.hostname;
		if (!isServerId(serverId)) {
			return { error: "Radius transport address requires a lowercase UUIDv4 server ID" };
		}
		return { address: { transport: "radius", serverId } };
	}
	if (url.protocol !== "unix:") return { error: `Unsupported --connect transport "${url.protocol}"` };
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
		return { error: `Invalid --connect address "${value}"` };
	}
	let path: string;
	try {
		path = decodeURIComponent(url.pathname);
	} catch {
		return { error: `Invalid --connect address "${value}"` };
	}
	if (path.includes("\0")) return { error: `Invalid --connect address "${value}"` };
	if (!posix.isAbsolute(path)) return { error: "Unix transport address requires an absolute path" };
	return { address: { transport: "unix", path } };
}

export const connectOption = valueOption("--connect", (value) => {
	const result = parseTransportAddress(value);
	return result.address
		? { ok: true, value: result.address }
		: { ok: false, error: result.error ?? `Invalid --connect address "${value}"` };
});

export function parseAuth(input: ParsedCommandInput): { auth?: AuthInput; errors: string[] } {
	return parseAuthInput({
		authToken: input.value(authTokenOption),
		authTokenFile: input.value(authTokenFileOption),
	});
}

export function unsupportedOptions(command: string, input: ParsedCommandInput): string[] {
	if (input.remainingArgs.length === 0) return [];
	return [`The experimental ${command} command does not support existing CLI options yet`];
}
