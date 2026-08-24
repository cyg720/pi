import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import { JsonlSessionStorage } from "../../src/harness/session/jsonl-storage.ts";
import { InMemorySessionStorage } from "../../src/harness/session/memory-storage.ts";
import { type ContextEntryTransform, Session } from "../../src/harness/session/session.ts";
import type { SessionStorage } from "../../src/harness/types.ts";
import { createAssistantMessage, createTempDir, createUserMessage, getLatestTempDir } from "./session-test-utils.ts";

/** 从未知自定义数据中读取 text 字符串；参数 data 可为任意值，非法结构返回空串。示例：getTextData(entry.data)。 */
function getTextData(data: unknown): string {
	if (typeof data !== "object" || data === null || !("text" in data)) {
		return "";
	}
	/** 通过结构检查后取得的 text 候选值。 */
	const value = (data as { text?: unknown }).text;
	return typeof value === "string" ? value : "";
}

/** 为指定存储工厂注册完整 Session 契约测试；inspect 可在持久化用例结束时补充底层检查。无返回值。示例：runSessionSuite("memory", factory)。 */
async function runSessionSuite(
	name: string,
	createStorage: () => SessionStorage | Promise<SessionStorage>,
	inspect?: () => void,
) {
	describe(name, () => {
		/** 验证消息按追加顺序投影到上下文。 */
		it("appends messages and builds context in order", async () => {
			/** 使用当前存储实现创建的待测会话。 */
			const session = new Session(await createStorage());
			await session.appendMessage(createUserMessage("one"));
			await session.appendMessage(createAssistantMessage("two"));
			/** 由当前叶节点构建的模型上下文。 */
			const context = await session.buildContext();
			expect(context.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
		});

		/** 验证模型选择与思考级别变更可被恢复。 */
		it("tracks model and thinking level changes", async () => {
			/** 使用当前存储实现创建的待测会话。 */
			const session = new Session(await createStorage());
			await session.appendMessage(createUserMessage("one"));
			await session.appendModelChange("openai", "gpt-4.1");
			await session.appendThinkingLevelChange("high");
			/** 包含最新模型和思考级别的上下文。 */
			const context = await session.buildContext();
			expect(context.thinkingLevel).toBe("high");
			expect(context.model).toEqual({ provider: "openai", modelId: "gpt-4.1" });
		});

		/** 验证移动叶节点后可从旧节点创建新分支。 */
		it("supports branching by moving the leaf and appending a new branch", async () => {
			/** 用于构造分支的待测会话。 */
			const session = new Session(await createStorage());
			/** 第一条用户消息的条目标识，作为新分支父节点。 */
			const user1 = await session.appendMessage(createUserMessage("one"));
			/** 原分支上的助手条目标识，应从新分支中排除。 */
			const assistant1 = await session.appendMessage(createAssistantMessage("two"));
			await session.appendMessage(createUserMessage("three"));
			await session.moveTo(user1);
			await session.appendMessage(createAssistantMessage("branched"));
			/** 移动后当前叶节点对应的完整分支。 */
			const branch = await session.getBranch();
			expect(branch.map((entry) => entry.id)).toContain(user1);
			expect(branch.map((entry) => entry.id)).not.toContain(assistant1);
			/** 新分支转换出的模型上下文。 */
			const context = await session.buildContext();
			expect(context.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
		});

		/** 验证叶节点可移动到空会话根部。 */
		it("supports moving the leaf to root", async () => {
			/** 用于根节点移动场景的待测会话。 */
			const session = new Session(await createStorage());
			await session.appendMessage(createUserMessage("one"));
			await session.moveTo(null);
			expect(await session.getLeafId()).toBeNull();
			expect((await session.buildContext()).messages).toEqual([]);
		});

		/** 验证压缩摘要、保留消息与后续消息按正确顺序重建。 */
		it("reconstructs compaction summaries in context", async () => {
			/** 用于构造压缩历史的待测会话。 */
			const session = new Session(await createStorage());
			await session.appendMessage(createUserMessage("one"));
			await session.appendMessage(createAssistantMessage("two"));
			/** 压缩后仍需保留的首条用户消息标识。 */
			const user2 = await session.appendMessage(createUserMessage("three"));
			await session.appendMessage(createAssistantMessage("four"));
			await session.appendCompaction("summary", user2, 1234, undefined, undefined, undefined, [
				createUserMessage("three"),
				createAssistantMessage("four"),
			]);
			await session.appendMessage(createUserMessage("five"));
			/** 包含压缩摘要与保留消息的上下文。 */
			const context = await session.buildContext();
			expect(context.messages[0]?.role).toBe("compactionSummary");
			expect(context.messages).toHaveLength(4);
			expect(context.messages.map((message) => message.role)).toEqual([
				"compactionSummary",
				"user",
				"assistant",
				"user",
			]);
		});

		/** 验证带摘要的 moveTo 会创建分支摘要条目。 */
		it("supports moving with branch summary entries in context", async () => {
			/** 用于分支摘要场景的待测会话。 */
			const session = new Session(await createStorage());
			/** 摘要新分支连接的用户条目标识。 */
			const user1 = await session.appendMessage(createUserMessage("one"));
			/** moveTo 创建的分支摘要标识。 */
			const summaryId = await session.moveTo(user1, { summary: "summary text" });
			expect(summaryId).toBeTruthy();
			/** 从存储重新读取的分支摘要条目。 */
			const summaryEntry = await session.getEntry(summaryId!);
			expect(summaryEntry).toMatchObject({ type: "branch_summary", parentId: user1, fromId: user1 });
			/** 包含 branchSummary 消息的上下文。 */
			const context = await session.buildContext();
			expect(context.messages[1]?.role).toBe("branchSummary");
		});

		/** 验证压缩用量数据原样持久化。 */
		it("persists compaction usage", async () => {
			/** 用于压缩用量场景的待测会话。 */
			const session = new Session(await createStorage());
			/** 压缩后首个保留条目标识。 */
			const firstKeptEntryId = await session.appendMessage(createUserMessage("one"));
			/** 覆盖输入、输出、缓存和费用字段的样例用量。 */
			const usage = {
				input: 1,
				output: 2,
				cacheRead: 3,
				cacheWrite: 4,
				totalTokens: 10,
				cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
			};

			/** 新创建的压缩条目标识。 */
			const compactionId = await session.appendCompaction(
				"summary",
				firstKeptEntryId,
				1234,
				undefined,
				false,
				usage,
			);

			/** 从存储读取的压缩条目。 */
			const compactionEntry = await session.getEntry(compactionId);
			expect(compactionEntry?.type === "compaction" ? compactionEntry.usage : undefined).toEqual(usage);
		});

		/** 验证分支摘要用量数据原样持久化。 */
		it("persists branch summary usage", async () => {
			/** 用于分支摘要用量场景的待测会话。 */
			const session = new Session(await createStorage());
			/** 摘要分支连接的用户条目标识。 */
			const user1 = await session.appendMessage(createUserMessage("one"));
			/** 覆盖所有计费维度的样例用量。 */
			const usage = {
				input: 1,
				output: 2,
				cacheRead: 3,
				cacheWrite: 4,
				totalTokens: 10,
				cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
			};

			/** moveTo 创建的分支摘要标识。 */
			const summaryId = await session.moveTo(user1, { summary: "summary text", usage });

			/** 从存储读取的分支摘要条目。 */
			const summaryEntry = await session.getEntry(summaryId!);
			expect(summaryEntry?.type === "branch_summary" ? summaryEntry.usage : undefined).toEqual(usage);
		});

		/** 验证自定义消息条目会进入模型上下文。 */
		it("supports custom message entries in context", async () => {
			/** 用于自定义消息场景的待测会话。 */
			const session = new Session(await createStorage());
			await session.appendMessage(createUserMessage("one"));
			await session.appendCustomMessageEntry("custom", "hello", true, { ok: true });
			/** 投影自定义消息后的上下文。 */
			const context = await session.buildContext();
			expect(context.messages[1]?.role).toBe("custom");
		});

		/** 验证普通自定义条目保留在上下文条目中但默认不成为消息。 */
		it("keeps custom entries in context entries but omits them from messages by default", async () => {
			/** 用于普通自定义条目场景的待测会话。 */
			const session = new Session(await createStorage());
			await session.appendMessage(createUserMessage("one"));
			await session.appendCustomEntry("chat_message", { text: "hello" });
			/** 经过压缩选择但尚未投影成消息的条目列表。 */
			const contextEntries = await session.buildContextEntries();
			/** 默认投影器生成的模型上下文。 */
			const context = await session.buildContext();
			expect(contextEntries.map((entry) => entry.type)).toEqual(["message", "custom"]);
			expect(context.messages).toHaveLength(1);
		});

		/** 验证配置的自定义条目投影器可生成用户消息。 */
		it("projects custom entries with configured custom-entry projectors", async () => {
			/** 配置 chat_message 投影器的待测会话。 */
			const session = new Session(await createStorage(), {
				entryProjectors: {
					chat_message: (entry) => [createUserMessage(`chat: ${getTextData(entry.data)}`)],
				},
			});
			await session.appendMessage(createUserMessage("one"));
			await session.appendCustomEntry("chat_message", { text: "hello" });
			/** 应包含原消息与投影消息的上下文。 */
			const context = await session.buildContext();
			expect(context.messages.map((message) => message.role)).toEqual(["user", "user"]);
			expect(context.messages[1]).toMatchObject({ content: [{ type: "text", text: "chat: hello" }] });
		});

		/** 验证自定义条目转换在默认压缩筛选之后执行。 */
		it("applies context entry transforms after default compaction selection", async () => {
			/** 转换函数观察到的首个条目类型。 */
			let observedFirstEntryType: string | undefined;
			/** 删除压缩条目的测试转换器。 */
			const dropCompaction: ContextEntryTransform = (entries) => {
				observedFirstEntryType = entries[0]?.type;
				return entries.filter((entry) => entry.type !== "compaction");
			};
			/** 配置自定义条目转换器的待测会话。 */
			const session = new Session(await createStorage(), { entryTransforms: [dropCompaction] });
			await session.appendMessage(createUserMessage("one"));
			/** 压缩后保留的消息条目标识。 */
			const kept = await session.appendMessage(createUserMessage("two"));
			await session.appendCompaction("summary", kept, 1234);
			await session.appendMessage(createUserMessage("three"));
			/** 应已应用 dropCompaction 的最终上下文。 */
			const context = await session.buildContext();
			expect(observedFirstEntryType).toBe("compaction");
			expect(context.messages.map((message) => message.role)).toEqual(["user", "user"]);
		});

		/** 验证会话名称中的换行和多余空白会被规范化。 */
		it("normalizes session names", async () => {
			/** 用于名称规范化场景的待测会话。 */
			const session = new Session(await createStorage());
			await session.appendSessionName(" hello\nworld\r\nagain ");
			expect(await session.getSessionName()).toBe("hello world again");
		});

		/** 验证标签和会话信息被保存但不污染模型上下文。 */
		it("supports labels and session info entries without affecting context", async () => {
			/** 用于元数据场景的待测会话。 */
			const session = new Session(await createStorage());
			/** 被添加 checkpoint 标签的用户条目标识。 */
			const user1 = await session.appendMessage(createUserMessage("one"));
			await session.appendLabel(user1, "checkpoint");
			await session.appendSessionName("name");
			/** 包含消息、标签和会话信息的全部存储条目。 */
			const entries = await session.getEntries();
			expect(entries.some((entry) => entry.type === "label")).toBe(true);
			expect(entries.some((entry) => entry.type === "session_info")).toBe(true);
			expect(await session.getLabel(user1)).toBe("checkpoint");
			expect(await session.getSessionName()).toBe("name");
			expect((await session.buildContext()).messages).toHaveLength(1);
		});

		/** 验证给不存在的条目添加标签会明确失败。 */
		it("rejects labels for missing entries", async () => {
			/** 用于非法标签场景的待测会话。 */
			const session = new Session(await createStorage());
			await expect(session.appendLabel("missing", "checkpoint")).rejects.toThrow("Entry missing not found");
		});

		/** 验证重新创建 Session 后仍可恢复叶节点、分支和元数据。 */
		it("persists leaf changes and appended entries via storage", async () => {
			/** 在两次 Session 实例之间复用的存储。 */
			const storage = await createStorage();
			/** 首个负责写入测试数据的会话实例。 */
			const session = new Session(storage);
			/** 被标记并作为分支起点的用户条目标识。 */
			const user1 = await session.appendMessage(createUserMessage("one"));
			await session.appendMessage(createAssistantMessage("two"));
			await session.appendLabel(user1, "checkpoint");
			await session.appendSessionName("name");
			await session.moveTo(user1);
			await session.appendMessage(createAssistantMessage("branched"));
			/** 使用同一存储重新创建的会话实例。 */
			const session2 = new Session(storage);
			/** 重新加载后构建的当前分支上下文。 */
			const context = await session2.buildContext();
			expect(context.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
			expect(await session2.getLabel(user1)).toBe("checkpoint");
			expect(await session2.getSessionName()).toBe("name");
			inspect?.();
		});
	});
}

/** 注册内存存储实现的共享契约测试。 */
runSessionSuite("Session with in-memory storage", () => new InMemorySessionStorage());

/** 注册 JSONL 存储实现的共享契约测试，并检查实际文件布局。 */
runSessionSuite(
	"Session with JSONL storage",
	async () => {
		/** JSONL 会话文件所在的临时目录。 */
		const dir = createTempDir();
		/** 让存储通过 Node.js 环境访问临时目录。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		return await JsonlSessionStorage.create(env, join(dir, "session.jsonl"), { cwd: dir, sessionId: "session-1" });
	},
	() => {
		/** 最近一次 JSONL 用例创建的临时目录。 */
		const dir = getLatestTempDir();
		/** 待检查的 JSONL 会话文件路径。 */
		const filePath = join(dir, "session.jsonl");
		/** 去除末尾空白后得到的逐行 JSON 记录。 */
		const lines = readFileSync(filePath, "utf8").trim().split("\n");
		expect(lines.length).toBeGreaterThan(1);
		/** 文件首行的会话头记录。 */
		const header = JSON.parse(lines[0]!);
		expect(header.type).toBe("session");
		expect(header.version).toBe(3);
		/** 除头部之外的全部会话条目。 */
		const entries = lines.slice(1).map((line) => JSON.parse(line));
		expect(entries.some((entry) => entry.type === "leaf")).toBe(true);
		for (const entry of entries) {
			expect(entry.type).not.toBe("entry");
			expect(typeof entry.id).toBe("string");
		}
	},
);
/**
 * 文件职责：验证通用 Session 在内存存储和 JSONL 文件存储上的消息、分支、压缩与元数据行为一致。
 * 技术维度：使用 Vitest 参数化测试、异步存储接口、树形会话记录和 Node.js 文件读取完成双实现契约测试。
 * 产品维度：保障用户切换持久化方式后仍能可靠恢复对话、分支、标签和压缩上下文。
 * 逻辑维度：先定义安全取值与共享测试套件，再分别传入内存存储和 JSONL 存储工厂执行全部场景。
 * 关键边界：JSONL 检查依赖临时目录；自定义条目默认不进入模型消息，除非配置投影器。
 * 新手阅读建议：先看 runSessionSuite 的输入，再按“消息—分支—压缩—自定义条目—持久化”顺序阅读用例。
 */
