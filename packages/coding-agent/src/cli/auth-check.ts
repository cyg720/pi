/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `cli/auth-check` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-ai`、`../core/model-resolver.ts`、`../core/model-runtime.ts`、`../core/models-store.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `cli/auth-check` 对应的子能力。
 * 【逻辑维度】对外入口包括 `AuthCheckStatus`、`AuthCheckReason`、`AuthCheckResult`、`checkProviderAuth`、`getProviderCredential`、`createAuthCheckModelRuntime`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `AuthCheckStatus`、`AuthCheckReason`、`AuthCheckResult`、`checkProviderAuth`、`getProviderCredential`、`createAuthCheckModelRuntime` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { CredentialStore } from "@earendil-works/pi-ai";
import { resolveCliModel } from "../core/model-resolver.ts";
import { ModelRuntime } from "../core/model-runtime.ts";
import { InMemoryCodingAgentModelsStore } from "../core/models-store.ts";
import type { Args } from "./args.ts";
import { AuthCommandError, getAuthCredential, validateAuthCommandArgs } from "./auth-command.ts";

export type AuthCheckStatus = "ready" | "not_ready" | "invalid";
export type AuthCheckReason =
	| "provider_not_found"
	| "credentials_not_configured"
	| "credential_not_available"
	| "invalid_state";

export interface AuthCheckResult {
	status: AuthCheckStatus;
	provider: string;
	reason?: AuthCheckReason;
	authType?: "api_key" | "oauth";
}

export async function checkProviderAuth(
	args: Args,
	modelRuntime: ModelRuntime,
	options: { refresh: boolean } = { refresh: false },
): Promise<AuthCheckResult> {
	const { provider: cliProvider, model: cliModel } = validateAuthCommandArgs(args, "check");
	let provider = cliProvider;
	if (cliModel) {
		const resolved = resolveCliModel({ cliProvider, cliModel, modelRuntime });
		if (resolved.error || !resolved.model) {
			throw new AuthCommandError(resolved.error ?? `Unable to resolve model "${cliModel}"`);
		}
		provider = resolved.model.provider;
	}
	if (!provider) throw new AuthCommandError("Unable to resolve an auth provider");
	if (modelRuntime.getError()) {
		return { status: "invalid", provider, reason: "invalid_state" };
	}
	if (!modelRuntime.getProvider(provider)) {
		return { status: "not_ready", provider, reason: "provider_not_found" };
	}
	try {
		const auth = await modelRuntime.checkAuth(provider);
		if (!auth) return { status: "not_ready", provider, reason: "credentials_not_configured" };
		if (options.refresh && !(await modelRuntime.getAuth(provider))) {
			return { status: "not_ready", provider, reason: "credentials_not_configured" };
		}
		return { status: "ready", provider, authType: auth.type };
	} catch {
		return { status: "invalid", provider, reason: "invalid_state" };
	}
}

export async function getProviderCredential(
	providerId: string,
	modelRuntime: ModelRuntime,
	credentials: CredentialStore,
	options: { refresh: boolean },
): Promise<string | undefined> {
	const credential = await credentials.read(providerId);
	if (!options.refresh && credential?.type === "oauth") return credential.access;
	return getAuthCredential(await modelRuntime.getAuth(providerId));
}

export async function createAuthCheckModelRuntime(credentials: CredentialStore): Promise<ModelRuntime> {
	return ModelRuntime.create({
		credentials,
		modelsStore: new InMemoryCodingAgentModelsStore(),
		allowModelNetwork: false,
		refreshOnCreate: false,
	});
}
