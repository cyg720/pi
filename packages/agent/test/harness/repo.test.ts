/**
 * 文件职责：验证内存与 JSONL 两种会话仓库的创建、打开、列举、删除、分叉及元数据持久化行为。
 * 技术维度：使用 Vitest、NodeExecutionEnv、临时目录和会话消息测试工厂覆盖统一仓库接口。
 * 产品维度：保证代理会话既可用于无磁盘测试，也可按项目目录可靠持久化和派生新会话。
 * 逻辑维度：先测试内存实现，再测试 JSONL 的目录编码、分叉范围、删除和头部元数据覆盖。
 * 关键边界：分叉 entryId 表示截断点且不包含该条目；JSONL 路径编码必须区分不同 cwd。
 * 新手阅读建议：先比较两个仓库共有的 open/delete/fork 断言，再看 JSONL 特有的路径和元数据测试。
 */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import { JsonlSessionRepo } from "../../src/harness/session/jsonl-repo.ts";
import { InMemorySessionRepo } from "../../src/harness/session/memory-repo.ts";
import { createAssistantMessage, createTempDir, createUserMessage } from "./session-test-utils.ts";

describe("InMemorySessionRepo", () => {
	it("opens, deletes, and forks by metadata", async () => {
		// 被测内存仓库实例；所有状态只在当前进程存在。
		const repo = new InMemorySessionRepo();
		// id 固定的源会话对象。
		const session = await repo.create({ id: "session-1" });
		// 用于后续 open、fork 和 delete 的源会话元数据。
		const metadata = await session.getMetadata();
		// 第一条用户消息的条目 id。
		const user1 = await session.appendMessage(createUserMessage("one"));
		// 中间助手消息的条目 id。
		const assistant1 = await session.appendMessage(createAssistantMessage("two"));
		// 第二条用户消息 id，同时用作截断分叉点。
		const user2 = await session.appendMessage(createUserMessage("three"));
		expect(await repo.open(metadata)).toBe(session);
		expect((await repo.list()).map((info) => info.id)).toEqual(["session-1"]);
		// 截止 user2 之前内容的新分叉会话。
		const fork = await repo.fork(metadata, { entryId: user2, id: "session-2" });
		expect((await fork.getEntries()).map((entry) => entry.id)).toEqual([user1, assistant1]);
		// 未指定截断点的完整分叉会话。
		const fullFork = await repo.fork(metadata, { id: "session-3" });
		expect((await fullFork.getEntries()).map((entry) => entry.id)).toEqual([user1, assistant1, user2]);
		await repo.delete(metadata);
		await expect(repo.open(metadata)).rejects.toThrow("Session not found: session-1");
	});
});

describe("JsonlSessionRepo", () => {
	it("stores sessions below encoded cwd directories and lists by cwd", async () => {
		// JSONL 仓库场景的临时根目录。
		const root = createTempDir();
		// 绑定临时根目录的文件执行环境。
		const env = new NodeExecutionEnv({ cwd: root });
		// 第一会话的逻辑项目目录。
		const cwd = "/tmp/my-project";
		// 用于验证 cwd 过滤的另一个项目目录。
		const otherCwd = "/tmp/other-project";
		// 把会话文件保存到 root 下的 JSONL 仓库。
		const repo = new JsonlSessionRepo({ fs: env, sessionsRoot: root });
		// 第一项目下创建的会话。
		const session = await repo.create({ cwd, id: "019de8c2-de29-73e9-ae0c-e134db34c447" });
		// 另一项目下创建的对照会话。
		const otherSession = await repo.create({ cwd: otherCwd, id: "other-session" });
		// 第一会话的持久化元数据。
		const metadata = await session.getMetadata();
		// 对照会话的持久化元数据。
		const otherMetadata = await otherSession.getMetadata();
		expect(metadata.path).toContain("--tmp-my-project--");
		expect(otherMetadata.path).toContain("--tmp-other-project--");
		expect(existsSync(metadata.path)).toBe(true);
		expect((await repo.list({ cwd })).map((sessionMetadata) => sessionMetadata.id)).toEqual([metadata.id]);
		expect((await repo.list()).map((sessionMetadata) => sessionMetadata.id).sort()).toEqual(
			[metadata.id, otherMetadata.id].sort(),
		);
	});

	it("opens, deletes, and forks by metadata", async () => {
		// JSONL 生命周期场景的临时根目录。
		const root = createTempDir();
		// 文件系统执行环境。
		const env = new NodeExecutionEnv({ cwd: root });
		// 被测 JSONL 仓库。
		const repo = new JsonlSessionRepo({ fs: env, sessionsRoot: root });
		// 分叉源会话。
		const source = await repo.create({ cwd: "/tmp/source", id: "source-session" });
		// 分叉和删除所需的源元数据。
		const sourceMetadata = await source.getMetadata();
		// 第一条用户消息 id。
		const user1 = await source.appendMessage(createUserMessage("one"));
		// 助手消息 id。
		const assistant1 = await source.appendMessage(createAssistantMessage("two"));
		// 分叉截断点用户消息 id。
		const user2 = await source.appendMessage(createUserMessage("three"));
		await expect((await repo.open(sourceMetadata)).getMetadata()).resolves.toEqual(sourceMetadata);
		// 指向新 cwd 且在 user2 前截断的分叉。
		const fork = await repo.fork(sourceMetadata, { cwd: "/tmp/target", id: "fork-session", entryId: user2 });
		// 截断分叉的元数据。
		const forkMetadata = await fork.getMetadata();
		expect(forkMetadata.cwd).toBe("/tmp/target");
		expect(forkMetadata.parentSessionPath).toBe(sourceMetadata.path);
		expect((await fork.getEntries()).map((entry) => entry.id)).toEqual([user1, assistant1]);
		// 包含全部源条目的完整分叉。
		const fullFork = await repo.fork(sourceMetadata, { cwd: "/tmp/target", id: "full-fork-session" });
		expect((await fullFork.getEntries()).map((entry) => entry.id)).toEqual([user1, assistant1, user2]);
		await repo.delete(sourceMetadata);
		expect(existsSync(sourceMetadata.path)).toBe(false);
		await expect(repo.open(sourceMetadata)).rejects.toThrow("Session not found");
	});

	it("persists header metadata through create, list, and fork", async () => {
		// 元数据持久化场景的临时根目录。
		const root = createTempDir();
		// 文件系统执行环境。
		const env = new NodeExecutionEnv({ cwd: root });
		// 被测 JSONL 仓库。
		const repo = new JsonlSessionRepo({ fs: env, sessionsRoot: root });
		// 带 reviewer 自定义头部元数据的源会话。
		const source = await repo.create({
			cwd: "/tmp/source",
			id: "source-session",
			metadata: { profile: "reviewer" },
		});
		// 从源文件重新读取的会话元数据。
		const sourceMetadata = await source.getMetadata();
		expect(sourceMetadata.metadata).toEqual({ profile: "reviewer" });
		expect((await repo.list({ cwd: "/tmp/source" })).map((listed) => listed.metadata)).toEqual([
			{ profile: "reviewer" },
		]);
		// 未覆盖 metadata 的分叉，应继承 reviewer。
		const fork = await repo.fork(sourceMetadata, { cwd: "/tmp/target", id: "fork-session" });
		expect((await fork.getMetadata()).metadata).toEqual({ profile: "reviewer" });
		// 显式覆盖 metadata 的分叉，应使用 writer。
		const overridden = await repo.fork(sourceMetadata, {
			cwd: "/tmp/target",
			id: "overridden-session",
			metadata: { profile: "writer" },
		});
		expect((await overridden.getMetadata()).metadata).toEqual({ profile: "writer" });
	});
});
