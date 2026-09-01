/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `cli/experimental/commands/pi` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../../args.ts`、`../auth.ts`、`../command.ts`、`../command-options.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `cli/experimental/commands/pi` 对应的子能力。
 * 【逻辑维度】对外入口包括 `PiCommand`、`PiCommandContext`、`piCommand`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `PiCommand`、`PiCommandContext`、`piCommand` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { Args } from "../../args.ts";
import type { AuthInput } from "../auth.ts";
import { Command } from "../command.ts";
import {
	authTokenFileOption,
	authTokenOption,
	parseAuth,
	parseLegacyOptions,
	transportOption,
} from "../command-options.ts";
import type { TransportAddress } from "../transport-address.ts";

export interface PiCommand {
	readonly command: "pi";
	readonly auth?: AuthInput;
	readonly options: Args;
	readonly listen?: readonly TransportAddress[];
}

export interface PiCommandContext {
	runPi(command: PiCommand): void | Promise<void>;
}

const listenOption = transportOption("--listen");

export const piCommand = new Command<PiCommand, PiCommandContext>("pi")
	.option(listenOption)
	.option(authTokenOption)
	.option(authTokenFileOption)
	.build((input) => {
		const { auth, errors: authErrors } = parseAuth(input);
		const listen = input.values(listenOption);
		const { options, errors: optionErrors } = parseLegacyOptions(input);
		const errors = [...authErrors, ...optionErrors];
		if (options.unknownFlags.has("connect")) errors.push("--connect is only valid for client mode");
		if (errors.length > 0) return { ok: false, errors };
		return {
			ok: true,
			command: {
				command: "pi",
				options,
				...(auth === undefined ? {} : { auth }),
				...(listen.length === 0 ? {} : { listen }),
			},
		};
	})
	.action((command, context) => context.runPi(command));
