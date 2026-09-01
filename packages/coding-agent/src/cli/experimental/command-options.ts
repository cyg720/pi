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

export const authTokenOption = stringOption("--auth-token");
export const authTokenFileOption = stringOption("--auth-token-file");

export function transportOption(name: "--listen" | "--connect"): CommandOption<TransportAddress> {
	return valueOption(name, (value) => {
		const result = parseTransportAddress(value, name);
		return result.address
			? { ok: true, value: result.address }
			: { ok: false, error: result.error ?? `Invalid ${name} address "${value}"` };
	});
}

export function parseAuth(input: ParsedCommandInput): { auth?: AuthInput; errors: string[] } {
	return parseAuthInput({
		authToken: input.value(authTokenOption),
		authTokenFile: input.value(authTokenFileOption),
	});
}

export function parseLegacyOptions(input: ParsedCommandInput): { options: Args; errors: string[] } {
	const options = parseArgs([...input.remainingArgs]);
	return {
		options,
		errors: options.diagnostics
			.filter((diagnostic) => diagnostic.type === "error")
			.map((diagnostic) => diagnostic.message),
	};
}

export function unsupportedLegacyOptions(command: string, input: ParsedCommandInput): string[] {
	if (input.remainingArgs.length === 0) return [];
	return [`The experimental ${command} command does not support existing CLI options yet`];
}
