import type { Credential, CredentialInfo, CredentialStore } from "@earendil-works/pi-ai";

/** Async credential store overlay for non-persistent runtime API keys. */
/**
 * 【文件职责】运行时凭据：解析运行时注入的密钥/凭据源（环境、存储）。
 * 【产品维度】统一运行时密钥获取。
 * 【新手阅读建议】看解析链。
 */
export class RuntimeCredentials implements CredentialStore {
	private readonly store: CredentialStore;
	private readonly overrides = new Map<string, string>();

	constructor(store: CredentialStore) {
		this.store = store;
	}

	setRuntimeApiKey(providerId: string, apiKey: string): void {
		this.overrides.set(providerId, apiKey);
	}

	removeRuntimeApiKey(providerId: string): void {
		this.overrides.delete(providerId);
	}

	hasRuntimeApiKey(providerId: string): boolean {
		return this.overrides.has(providerId);
	}

	async read(providerId: string): Promise<Credential | undefined> {
		const override = this.overrides.get(providerId);
		return override ? { type: "api_key", key: override } : this.store.read(providerId);
	}

	async list(): Promise<readonly CredentialInfo[]> {
		const entries = new Map((await this.store.list()).map((entry) => [entry.providerId, entry]));
		for (const providerId of this.overrides.keys()) {
			entries.set(providerId, { providerId, type: "api_key" });
		}
		return [...entries.values()];
	}

	modify(
		providerId: string,
		fn: (current: Credential | undefined) => Promise<Credential | undefined>,
	): Promise<Credential | undefined> {
		return this.store.modify(providerId, fn);
	}

	async delete(providerId: string): Promise<void> {
		this.overrides.delete(providerId);
		await this.store.delete(providerId);
	}
}
