/**
 * 【文件职责】SDK 示例：会话运行时完整装配。
 * 【新手阅读建议】综合示例。
 */
// Session runtime
// 会话运行时（中文说明）：需要替换活动 AgentSession（new-session/resume/fork/import）时使用。
//
// The important pattern is: after the runtime replaces the active session,
// rebind any session-local subscriptions and extension bindings to `runtime.session`.
// 重要模式：运行时替换活动会话后，把会话级订阅与扩展绑定重新指向 runtime.session。

import {
	type CreateAgentSessionRuntimeFactory,
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	createAgentSessionServices,
	getAgentDir,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
	const services = await createAgentSessionServices({ cwd });
	return {
		...(await createAgentSessionFromServices({
			services,
			sessionManager,
			sessionStartEvent,
		})),
		services,
		diagnostics: services.diagnostics,
	};
};
const runtime = await createAgentSessionRuntime(createRuntime, {
	cwd: process.cwd(),
	agentDir: getAgentDir(),
	sessionManager: SessionManager.create(process.cwd()),
});

let unsubscribe: (() => void) | undefined;

async function bindSession() {
	unsubscribe?.();
	const session = runtime.session;
	await session.bindExtensions({});
	unsubscribe = session.subscribe((event) => {
		if (event.type === "queue_update") {
			console.log("Queued:", event.steering.length + event.followUp.length);
		}
	});
	return session;
}

let session = await bindSession();
const originalSessionFile = session.sessionFile;
console.log("Initial session:", originalSessionFile);

await runtime.newSession();
session = await bindSession();
console.log("After newSession():", session.sessionFile);

if (originalSessionFile) {
	await runtime.switchSession(originalSessionFile);
	session = await bindSession();
	console.log("After switchSession():", session.sessionFile);
}

unsubscribe?.();
await runtime.dispose();
