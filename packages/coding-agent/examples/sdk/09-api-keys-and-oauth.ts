/**
 * API Keys and OAuth
 *
 * Configure provider auth through ModelRuntime.
 */

/**
 * 【文件职责】SDK 示例：API 密钥与 OAuth 登录。
 * 【新手阅读建议】看认证流程。
 */
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const { session: defaultAuthSession } = await createAgentSession({
	sessionManager: SessionManager.inMemory(),
	modelRuntime,
});
console.log("Session with default model runtime");
defaultAuthSession.dispose();

const customRuntime = await ModelRuntime.create({
	authPath: "/tmp/my-app/auth.json",
	modelsPath: "/tmp/my-app/models.json",
});
const { session: customAuthSession } = await createAgentSession({
	sessionManager: SessionManager.inMemory(),
	modelRuntime: customRuntime,
});
console.log("Session with custom auth and models locations");
customAuthSession.dispose();

await modelRuntime.setRuntimeApiKey("anthropic", "sk-my-temp-key");
const { session: runtimeKeySession } = await createAgentSession({
	sessionManager: SessionManager.inMemory(),
	modelRuntime,
});
console.log("Session with runtime API key override");
runtimeKeySession.dispose();
