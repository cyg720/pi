/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `cli/experimental/auth` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 语言内建能力与本文件声明，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `cli/experimental/auth` 对应的子能力。
 * 【逻辑维度】对外入口包括 `AuthInput`、`RawAuthOptions`、`parseAuthInput`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `AuthInput`、`RawAuthOptions`、`parseAuthInput` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
export type AuthInput =
	| { readonly type: "token"; readonly token: string }
	| { readonly type: "file"; readonly path: string };

export interface RawAuthOptions {
	readonly authToken?: string;
	readonly authTokenFile?: string;
}

export function parseAuthInput(options: RawAuthOptions): { auth?: AuthInput; errors: string[] } {
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
