<<<<<<< HEAD
/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `cli/experimental/commands/server` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../auth.ts`、`../command.ts`、`../command-options.ts`、`../transport-address.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `cli/experimental/commands/server` 对应的子能力。
 * 【逻辑维度】对外入口包括 `ServerCommand`、`ServerCommandContext`、`serverCommand`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `ServerCommand`、`ServerCommandContext`、`serverCommand` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { AuthInput } from "../auth.ts";
import { Command } from "../command.ts";
=======
import { isServerId, type ServerId } from "@earendil-works/pi-protocol";
import { Command, stringOption, valueOption } from "../command.ts";
>>>>>>> main
import {
	type AuthInput,
	authTokenFileOption,
	authTokenOption,
	parseAuth,
	unsupportedOptions,
} from "../command-options.ts";

export interface ServerCommand {
	readonly command: "server";
	readonly auth?: AuthInput;
	readonly provider?: string;
	readonly model?: string;
	readonly pluginPackages?: readonly string[];
	readonly serverId?: ServerId;
	readonly sessionDir?: string;
}

export interface ServerCommandContext {
	runServer(command: ServerCommand): void | Promise<void>;
}

const serverIdOption = valueOption("--server-id", (value) =>
	isServerId(value)
		? { ok: true, value }
		: { ok: false, error: `Invalid --server-id "${value}"; expected a lowercase UUIDv4` },
);
const sessionDirOption = stringOption("--session-dir");
const providerOption = stringOption("--provider");
const modelOption = stringOption("--model");
const pluginPackageOption = stringOption("-e", { repeatable: true });

export const serverCommand = new Command<ServerCommand, ServerCommandContext>("server")
	.option(serverIdOption)
	.option(sessionDirOption)
	.option(providerOption)
	.option(modelOption)
	.option(pluginPackageOption)
	.option(authTokenOption)
	.option(authTokenFileOption)
	.build((input) => {
		const { auth, errors: authErrors } = parseAuth(input);
		const serverId = input.value(serverIdOption);
		const sessionDir = input.value(sessionDirOption);
		const provider = input.value(providerOption);
		const model = input.value(modelOption);
		const pluginPackages = input.values(pluginPackageOption);
		const modelErrors = provider !== undefined && model === undefined ? ["--provider requires --model"] : [];
		const errors = [...authErrors, ...modelErrors, ...unsupportedOptions("server", input)];
		if (errors.length > 0) return { ok: false, errors };
		return {
			ok: true,
			command: {
				command: "server",
				...(auth === undefined ? {} : { auth }),
				...(provider === undefined ? {} : { provider }),
				...(model === undefined ? {} : { model }),
				...(pluginPackages.length === 0 ? {} : { pluginPackages }),
				...(serverId === undefined ? {} : { serverId }),
				...(sessionDir === undefined ? {} : { sessionDir }),
			},
		};
	})
	.action((command, context) => context.runServer(command));
