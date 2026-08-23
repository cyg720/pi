#!/usr/bin/env node

/**
 * 【文件职责】独立 CLI 入口：通过命令行完成 OAuth 登录并把凭据写入本地 auth.json，
 *              也支持列出可用供应商与命令帮助。
 * 【技术维度】node:fs/readline 实现交互；复用内置供应商的 oauth.login 流程；
 *              AuthPrompt（select/text）交互适配。
 * 【产品维度】为不便使用完整 UI 的场景（脚本/CI/简单测试）提供零依赖的登录方式，
 *              凭据落盘到当前目录 auth.json 供应用读取。
 * 【逻辑维度】加载内置供应商（仅含 oauth 的）→ login：选供应商 → 驱动登录 →
 *              凭据写 auth.json；main 按 help/list/login 命令分派。
 * 【关键边界】凭据文件为当前工作目录的 auth.json（明文 JSON）；
 *              login 不带 provider 时进入交互选择；未授权命令抛错并退出码 1。
 * 【新手阅读建议】无需逐行精读：理解 login 里"交互回调 → 登录 → 保存"三步即可。
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import type { AuthPrompt, OAuthCredential, Provider } from "./index.ts";
import { builtinProviders } from "./providers/all.ts";

// 凭据文件名（当前工作目录）
const AUTH_FILE = "auth.json";
// 仅保留带 OAuth 能力的供应商
const PROVIDERS = builtinProviders().filter(
	(provider): provider is Provider & { auth: { oauth: NonNullable<Provider["auth"]["oauth"]> } } =>
		provider.auth.oauth !== undefined,
);

// 封装 readline 提问为 Promise（中文说明）
function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
	return new Promise((resolve) => rl.question(question, resolve));
}

// 从 auth.json 读取既有凭据（中文说明）：文件缺失或解析失败返回空对象
function loadAuth(): Record<string, OAuthCredential> {
	if (!existsSync(AUTH_FILE)) return {};
	try {
		return JSON.parse(readFileSync(AUTH_FILE, "utf-8")) as Record<string, OAuthCredential>;
	} catch {
		return {};
	}
}

// 保存凭据到 auth.json（中文说明）：格式化 JSON 便于人工检查
function saveAuth(auth: Record<string, OAuthCredential>): void {
	writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), "utf-8");
}

// 应答登录交互提示（中文说明）：select 类型打印编号菜单让用户选，text 类型直接输入
async function answerPrompt(rl: ReturnType<typeof createInterface>, authPrompt: AuthPrompt): Promise<string> {
	if (authPrompt.type === "select") {
		console.log(`\n${authPrompt.message}`);
		for (let index = 0; index < authPrompt.options.length; index++) {
			console.log(`  ${index + 1}. ${authPrompt.options[index].label}`);
		}
		const choice = Number.parseInt(await prompt(rl, `Enter number (1-${authPrompt.options.length}): `), 10) - 1;
		const selected = authPrompt.options[choice];
		if (!selected) throw new Error("Invalid selection");
		return selected.id;
	}
	return prompt(rl, `${authPrompt.message}${authPrompt.placeholder ? ` (${authPrompt.placeholder})` : ""}: `);
}

// 执行单个供应商登录（中文说明）：驱动 oauth.login（授权 URL/设备码等提示），成功后写盘
async function login(providerId: string): Promise<void> {
	const provider = PROVIDERS.find((entry) => entry.id === providerId);
	if (!provider) throw new Error(`Unknown provider: ${providerId}`);
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const credential = await provider.auth.oauth.login({
			prompt: (authPrompt) => answerPrompt(rl, authPrompt),
			notify: (event) => {
				switch (event.type) {
					case "auth_url":
						console.log(`\nOpen this URL in your browser:\n${event.url}`);
						if (event.instructions) console.log(event.instructions);
						break;
					case "device_code":
						console.log(`\nOpen this URL in your browser:\n${event.verificationUri}`);
						console.log(`Enter code: ${event.userCode}`);
						break;
					case "info":
					case "progress":
						console.log(event.message);
						break;
				}
			},
		});
		const auth = loadAuth();
		auth[providerId] = credential;
		saveAuth(auth);
		console.log(`\nCredentials saved to ${AUTH_FILE}`);
	} finally {
		rl.close();
	}
}

// 主入口（中文说明）：help/list 直接输出；login 无参数时交互选择供应商
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];
	if (!command || command === "help" || command === "--help" || command === "-h") {
		const providerList = PROVIDERS.map((provider) => `  ${provider.id.padEnd(20)} ${provider.name}`).join("\n");
		console.log(
			`Usage: npx @earendil-works/pi-ai <command> [provider]\n\nCommands:\n  login [provider]  Login to an OAuth provider\n  list              List available providers\n\nProviders:\n${providerList}`,
		);
		return;
	}
	if (command === "list") {
		for (const provider of PROVIDERS) console.log(`${provider.id.padEnd(20)} ${provider.name}`);
		return;
	}
	if (command === "login") {
		let providerId = args[1];
		if (!providerId) {
			// 交互选择供应商
			const rl = createInterface({ input: process.stdin, output: process.stdout });
			try {
				for (let index = 0; index < PROVIDERS.length; index++) {
					console.log(`  ${index + 1}. ${PROVIDERS[index].name}`);
				}
				const index = Number.parseInt(await prompt(rl, `Enter number (1-${PROVIDERS.length}): `), 10) - 1;
				providerId = PROVIDERS[index]?.id;
			} finally {
				rl.close();
			}
		}
		if (!providerId || !PROVIDERS.some((provider) => provider.id === providerId)) {
			throw new Error(`Unknown provider: ${providerId ?? ""}`);
		}
		await login(providerId);
		return;
	}
	throw new Error(`Unknown command: ${command}`);
}

// 兜底错误处理：输出错误信息并退出
main().catch((error: unknown) => {
	console.error("Error:", error instanceof Error ? error.message : String(error));
	process.exit(1);
});
