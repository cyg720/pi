/**
 * 文件职责：验证 git-merge-and-resolve 示例扩展在代理结束后检查、合并并报告 Git 冲突的行为。
 * 技术维度：使用 Vitest mock ExtensionAPI，以临时目录和预设命令结果模拟不同 Git 仓库状态。
 * 产品维度：保障自动合并扩展不会在脏工作区误操作，并能把精确冲突位置作为后续消息交给代理。
 * 逻辑维度：setup 构造扩展环境，withUpstream 准备常规命令结果，各用例覆盖跳过、成功和冲突分支。
 * 关键边界：测试不运行真实 Git；临时目录会递归删除；命令未预设时默认按失败处理。
 * 新手阅读建议：先看 setup 如何注入假 API，再看干净合并与冲突报告两个主用例，最后补充异常分支。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import mergeAndResolve from "../examples/extensions/git-merge-and-resolve.ts";
import type { ExecResult, ExtensionAPI, ExtensionContext } from "../src/core/extensions/index.ts";

/** agent_end 事件处理函数的最小签名，返回 undefined 表示不改变事件传播。 */
type AgentEndHandler = (event: { type: "agent_end" }, ctx: ExtensionContext) => Promise<undefined>;

/** 表示命令成功且没有输出的标准结果。 */
const ok: ExecResult = { stdout: "", stderr: "", code: 0, killed: false };
/** 表示命令失败的标准结果，未显式配置的调用也使用它。 */
const fail: ExecResult = { stdout: "", stderr: "error", code: 1, killed: false };

/** Standard exec results for a clean repo tracking origin/main, not in a merge. */
/** 为跟踪 origin/main、未处于合并中的干净仓库补齐标准 Git 命令结果。 */
/**
 * @param results 可继续覆盖的命令字符串到执行结果映射。
 * @returns 写入标准上游场景后的同一个映射。
 * @example const results = withUpstream(new Map());
 */
function withUpstream(results: Map<string, ExecResult>): Map<string, ExecResult> {
	results.set("git rev-parse --git-dir", ok);
	results.set("git rev-parse MERGE_HEAD", fail);
	results.set("git status --porcelain", ok);
	results.set("git rev-parse --abbrev-ref --symbolic-full-name @{u}", { ...ok, stdout: "origin/main\n" });
	results.set("git fetch origin", ok);
	return results;
}

/**
 * 构造扩展测试环境并返回触发器及可断言的 mock。
 * @param cwd 扩展看到的当前工作目录。
 * @param execResults 完整命令文本到模拟结果的映射。
 * @returns 触发 agent_end 的函数、命令 mock 和消息 mock。
 * @example const { trigger } = setup(cwd, new Map()); await trigger();
 */
function setup(cwd: string, execResults: Map<string, ExecResult>) {
	/** 扩展注册的 agent_end 处理器，注册前为空。 */
	let handler: AgentEndHandler | undefined;
	/** 捕获扩展发送给代理的用户消息。 */
	const sendUserMessage = vi.fn();

	/** 按“命令 + 参数”查表返回预设结果的执行器。 */
	const exec = vi.fn<ExtensionAPI["exec"]>().mockImplementation(async (cmd, args) => {
		/** 与测试映射键格式一致的完整命令文本。 */
		const key = [cmd, ...args].join(" ");
		return execResults.get(key) ?? fail;
	});

	/** 注入扩展的最小 API；on 只保存 agent_end 处理器。 */
	const api = {
		on: (event: string, h: AgentEndHandler) => {
			if (event === "agent_end") handler = h;
		},
		exec,
		sendUserMessage,
	} as unknown as ExtensionAPI;

	mergeAndResolve(api);

	/** 扩展执行时使用的最小上下文，通知方法也被 mock。 */
	const ctx = { cwd, ui: { notify: vi.fn() } } as unknown as ExtensionContext;

	/**
	 * 主动触发已注册的 agent_end 处理器。
	 * @returns 处理器完成后的 Promise。
	 * @example await trigger();
	 */
	async function trigger() {
		await handler!({ type: "agent_end" }, ctx);
	}

	return { trigger, exec, sendUserMessage };
}

/** 覆盖示例扩展面对各种 Git 状态时的安全决策和冲突消息格式。 */
describe("git-merge-and-resolve example", () => {
	/** 当前用例创建的临时目录；清理前可能尚未赋值。 */
	let tempDir: string;

	/** 用例结束后递归删除临时仓库目录。 */
	afterEach(() => {
		if (tempDir) rmSync(tempDir, { recursive: true, force: true });
	});

	/**
	 * 创建并记录一个当前用例专属临时目录。
	 * @returns 新建临时目录的绝对路径。
	 * @example const cwd = createTempDir();
	 */
	function createTempDir() {
		tempDir = mkdtempSync(join(tmpdir(), "pi-merge-test-"));
		return tempDir;
	}

	it("skips when not a git repository", async () => {
		/** 非 Git 场景使用的临时工作目录。 */
		const cwd = createTempDir();
		/** rev-parse 失败的命令结果集合。 */
		const results = new Map<string, ExecResult>();
		results.set("git rev-parse --git-dir", fail);

		const { trigger, exec, sendUserMessage } = setup(cwd, results);
		await trigger();

		expect(exec).toHaveBeenCalledTimes(1);
		expect(sendUserMessage).not.toHaveBeenCalled();
	});

	it("skips when no upstream is configured", async () => {
		/** 无上游场景使用的临时工作目录。 */
		const cwd = createTempDir();
		/** 仓库存在但上游查询失败的命令结果。 */
		const results = new Map<string, ExecResult>();
		results.set("git rev-parse --git-dir", ok);
		results.set("git rev-parse --abbrev-ref --symbolic-full-name @{u}", fail);

		const { trigger, sendUserMessage } = setup(cwd, results);
		await trigger();

		expect(sendUserMessage).not.toHaveBeenCalled();
	});

	it("re-sends conflicts when in an unfinished merge", async () => {
		/** 未完成合并场景的临时目录。 */
		const cwd = createTempDir();
		/** 包含一段标准 Git 冲突标记的文件内容。 */
		const conflictContent = ["<<<<<<< HEAD", "ours", "=======", "theirs", ">>>>>>> origin/main"].join("\n");
		writeFileSync(join(cwd, "file.ts"), conflictContent);

		/** 表示已有 MERGE_HEAD 且 file.ts 未解决的命令结果。 */
		const results = new Map<string, ExecResult>();
		results.set("git rev-parse --git-dir", ok);
		results.set("git rev-parse MERGE_HEAD", ok);
		results.set("git diff --name-only --diff-filter=U", { ...ok, stdout: "file.ts\n" });

		const { trigger, exec, sendUserMessage } = setup(cwd, results);
		await trigger();

		// Should not attempt a new fetch/merge
		// 已处于未完成合并时不应再次 fetch 或发起新合并。
		expect(exec).not.toHaveBeenCalledWith("git", ["fetch", "origin"]);
		expect(sendUserMessage).toHaveBeenCalledTimes(1);
		/** 扩展重新发送的冲突说明文本。 */
		const message = sendUserMessage.mock.calls[0][0] as string;
		expect(message).toContain("file.ts:1-5");
	});

	it("skips when working tree is dirty and not in a merge", async () => {
		/** 脏工作区场景的临时目录。 */
		const cwd = createTempDir();
		/** status 返回修改文件的命令结果。 */
		const results = new Map<string, ExecResult>();
		results.set("git rev-parse --git-dir", ok);
		results.set("git rev-parse MERGE_HEAD", fail);
		results.set("git status --porcelain", { ...ok, stdout: " M src/index.ts\n" });

		const { trigger, exec, sendUserMessage } = setup(cwd, results);
		await trigger();

		expect(exec).not.toHaveBeenCalledWith("git", ["fetch", "origin"]);
		expect(sendUserMessage).not.toHaveBeenCalled();
	});

	it("skips when fetch fails", async () => {
		/** 拉取失败场景的临时目录。 */
		const cwd = createTempDir();
		/** 基于标准上游场景、但 fetch 被覆盖为失败的结果。 */
		const results = withUpstream(new Map<string, ExecResult>());
		results.set("git fetch origin", fail);

		const { trigger, sendUserMessage } = setup(cwd, results);
		await trigger();

		expect(sendUserMessage).not.toHaveBeenCalled();
	});

	it("skips when merge is clean", async () => {
		/** 干净合并场景的临时目录。 */
		const cwd = createTempDir();
		/** 上游检查和 merge 都成功的命令结果。 */
		const results = withUpstream(new Map<string, ExecResult>());
		results.set("git merge --no-ff origin/main", ok);

		const { trigger, sendUserMessage } = setup(cwd, results);
		await trigger();

		expect(sendUserMessage).not.toHaveBeenCalled();
	});

	it("sends conflict report as a follow-up", async () => {
		/** 多冲突场景的临时目录。 */
		const cwd = createTempDir();
		/** 包含两段冲突标记及普通行的文件内容。 */
		const conflictContent = [
			"line 1",
			"<<<<<<< HEAD",
			"our change",
			"=======",
			"their change",
			">>>>>>> origin/main",
			"line 7",
			"<<<<<<< HEAD",
			"second conflict",
			"=======",
			"their second",
			">>>>>>> origin/main",
		].join("\n");

		mkdirSync(join(cwd, "src"), { recursive: true });
		writeFileSync(join(cwd, "src/index.ts"), conflictContent);

		/** merge 失败且 src/index.ts 未解决的命令结果。 */
		const results = withUpstream(new Map<string, ExecResult>());
		results.set("git merge --no-ff origin/main", { ...fail, code: 1 });
		results.set("git diff --name-only --diff-filter=U", { ...ok, stdout: "src/index.ts\n" });

		const { trigger, sendUserMessage } = setup(cwd, results);
		await trigger();

		expect(sendUserMessage).toHaveBeenCalledTimes(1);
		/** 捕获的消息正文与投递选项。 */
		const [message, options] = sendUserMessage.mock.calls[0];
		expect(message).toContain("src/index.ts:2-6 (ours 3, theirs 5)");
		expect(message).toContain("src/index.ts:8-12 (ours 9, theirs 11)");
		expect(options).toEqual({ deliverAs: "followUp" });
	});

	it("handles empty ours or theirs sections", async () => {
		/** 空 ours 分支场景的临时目录。 */
		const cwd = createTempDir();
		/** ours 侧没有内容、theirs 侧只有一行的冲突文本。 */
		const conflictContent = ["<<<<<<< HEAD", "=======", "only theirs", ">>>>>>> origin/main"].join("\n");

		writeFileSync(join(cwd, "empty-ours.ts"), conflictContent);

		/** merge 失败并报告 empty-ours.ts 的命令结果。 */
		const results = withUpstream(new Map<string, ExecResult>());
		results.set("git merge --no-ff origin/main", { ...fail, code: 1 });
		results.set("git diff --name-only --diff-filter=U", { ...ok, stdout: "empty-ours.ts\n" });

		const { trigger, sendUserMessage } = setup(cwd, results);
		await trigger();

		expect(sendUserMessage).toHaveBeenCalledTimes(1);
		/** 扩展生成的空分支冲突说明。 */
		const message = sendUserMessage.mock.calls[0][0] as string;
		expect(message).toContain("empty-ours.ts:1-4 (ours empty, theirs 3)");
	});

	it("skips message when merge fails but no conflict markers found", async () => {
		/** 合并失败但没有未解决文件场景的临时目录。 */
		const cwd = createTempDir();
		/** merge 失败而冲突文件列表为空的命令结果。 */
		const results = withUpstream(new Map<string, ExecResult>());
		results.set("git merge --no-ff origin/main", { ...fail, code: 1 });
		results.set("git diff --name-only --diff-filter=U", { ...ok, stdout: "" });

		const { trigger, sendUserMessage } = setup(cwd, results);
		await trigger();

		expect(sendUserMessage).not.toHaveBeenCalled();
	});
});
