/**
 * Tests for AgentSession forking behavior.
 *
 * These tests verify:
 * - Forking from a single message works
 * - Forking in --no-session mode (in-memory only)
 * - getUserMessagesForForking returns correct entries
 */
/**
 * 文件职责：验证 AgentSession 从不同用户消息位置创建分支会话时的状态、文件和消息历史行为。
 * 技术维度：使用 Vitest、真实会话运行时、临时目录和带 API 密钥的 Anthropic 模型执行集成测试。
 * 产品维度：保障用户可从对话任意节点重新探索方案，并支持不落盘的 `--no-session` 隐私模式。
 * 逻辑维度：先创建可复用运行时，再覆盖单消息分支、内存分支和从多轮对话中间分支三种场景。
 * 关键边界：没有 API_KEY 时整组跳过；每个用例必须释放运行时并删除临时会话目录。
 * 新手阅读建议：先看 createSession 如何组装服务，再比较 fork 前后的 messages、sessionFile 和 selectedText。
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@earendil-works/pi-ai/compat";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentSession } from "../src/core/agent-session.ts";
import {
	type AgentSessionRuntime,
	type CreateAgentSessionRuntimeFactory,
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	createAgentSessionServices,
} from "../src/core/agent-session-runtime.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { API_KEY } from "./utilities.ts";

// 仅在存在真实模型密钥时运行分支集成测试，避免无凭据环境产生误报。
describe.skipIf(!API_KEY)("AgentSession forking", () => {
	// session 指向当前运行时持有的活动会话；分支后会更新为新会话。
	let session: AgentSession;
	// runtimeHost 管理会话切换、分支和资源释放。
	let runtimeHost: AgentSessionRuntime;
	// tempDir 保存当前用例的认证和会话文件，生命周期仅限单个测试。
	let tempDir: string;
	// sessionManager 根据用例选择磁盘模式或内存模式。
	let sessionManager: SessionManager;

	// 每个用例前创建独立临时工作目录，隔离会话数据。
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-branching-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	// 每个用例结束后释放运行时并清理其临时目录。
	afterEach(async () => {
		if (runtimeHost) {
			await runtimeHost.dispose();
		}
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	/**
	 * 创建绑定临时目录和 Anthropic 测试模型的会话。
	 * @param noSession 为 true 时使用纯内存会话管理器，默认写入会话文件。
	 * @returns 新创建的 AgentSession；例如 `await createSession(true)` 创建不落盘会话。
	 */
	async function createSession(noSession: boolean = false) {
		// model 是本组真实请求统一使用的 Claude 模型元数据。
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		sessionManager = noSession ? SessionManager.inMemory(tempDir) : SessionManager.create(tempDir);
		// authStorage 把当前测试密钥写入临时认证文件，不接触用户配置。
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: API_KEY! }));

		// servicesOptions 关闭与分支无关的扩展、技能、提示模板和主题加载。
		const servicesOptions = {
			agentDir: tempDir,
			authStorage,
			resourceLoaderOptions: {
				noExtensions: true,
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			},
		};
		// createRuntime 按宿主给出的目录和会话状态组装一次完整运行时。
		const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
			// services 是当前工作目录对应的会话服务集合。
			const services = await createAgentSessionServices({
				...servicesOptions,
				cwd,
			});
			return {
				...(await createAgentSessionFromServices({
					services,
					sessionManager,
					sessionStartEvent,
					model,
					tools: ["read", "bash", "edit", "write"],
				})),
				services,
				diagnostics: services.diagnostics,
			};
		};
		runtimeHost = await createAgentSessionRuntime(createRuntime, {
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager,
		});
		session = runtimeHost.session;
		session.subscribe(() => {});
		return session;
	}

	// 单条用户消息也应能成为有效的分支起点。
	it("should allow forking from single message", async () => {
		await createSession();

		await session.prompt("Say hello");
		await session.agent.waitForIdle();

		// userMessages 是可供分支选择器展示的用户消息条目。
		const userMessages = session.getUserMessagesForForking();
		expect(userMessages.length).toBe(1);
		expect(userMessages[0].text).toBe("Say hello");

		// result 描述分支是否取消以及被选中的原始文本。
		const result = await runtimeHost.fork(userMessages[0].entryId);
		expect(result.cancelled).toBe(false);
		session = runtimeHost.session;
		expect(result.selectedText).toBe("Say hello");

		expect(session.messages.length).toBe(0);
		expect(session.sessionFile).not.toBeNull();
		expect(existsSync(session.sessionFile!)).toBe(false);
	});

	// `--no-session` 模式应在不创建会话文件的前提下支持相同分支语义。
	it("should support in-memory forking in --no-session mode", async () => {
		await createSession(true);

		expect(session.sessionFile).toBeUndefined();

		await session.prompt("Say hi");
		await session.agent.waitForIdle();

		// userMessages 是内存会话中可供选择的用户消息列表。
		const userMessages = session.getUserMessagesForForking();
		expect(userMessages.length).toBe(1);
		expect(session.messages.length).toBeGreaterThan(0);

		// result 是从唯一用户消息创建内存分支的结果。
		const result = await runtimeHost.fork(userMessages[0].entryId);
		expect(result.cancelled).toBe(false);
		session = runtimeHost.session;
		expect(result.selectedText).toBe("Say hi");

		expect(session.messages.length).toBe(0);
		expect(session.sessionFile).toBeUndefined();
	});

	// 从多轮对话中间分支时，只保留所选消息之前的完整轮次。
	it("should fork from middle of conversation", async () => {
		await createSession();

		await session.prompt("Say one");
		await session.agent.waitForIdle();

		await session.prompt("Say two");
		await session.agent.waitForIdle();

		await session.prompt("Say three");
		await session.agent.waitForIdle();

		// userMessages 按会话顺序包含三条用户消息。
		const userMessages = session.getUserMessagesForForking();
		expect(userMessages.length).toBe(3);

		// secondMessage 是作为新分支起点的第二条用户消息。
		const secondMessage = userMessages[1];
		// result 记录中间分支操作的选择和取消状态。
		const result = await runtimeHost.fork(secondMessage.entryId);
		expect(result.cancelled).toBe(false);
		session = runtimeHost.session;
		expect(result.selectedText).toBe("Say two");

		expect(session.messages.length).toBe(2);
		expect(session.messages[0].role).toBe("user");
		expect(session.messages[1].role).toBe("assistant");
	}, 60000);
});
