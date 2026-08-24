import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setKeybindings } from "@earendil-works/pi-tui";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import type { SessionInfo } from "../src/core/session-manager.ts";
import { SessionSelectorComponent } from "../src/modes/interactive/components/session-selector.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

/** 可由测试手动完成或拒绝的 Promise 控制器。 */
type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (err: unknown) => void;
};

/** 创建手动控制的 Promise。返回 promise、resolve 和 reject。示例：createDeferred<SessionInfo[]>()。 */
function createDeferred<T>(): Deferred<T> {
	/** 稍后由 Promise 构造器赋值的成功回调。 */
	let resolve: (value: T) => void = () => {};
	/** 稍后由 Promise 构造器赋值的失败回调。 */
	let reject: (err: unknown) => void = () => {};
	/** 暴露给待测异步加载器的可控 Promise。 */
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** 等待当前事件循环中的 setImmediate 任务执行。返回完成 Promise。示例：await flushPromises()。 */
async function flushPromises(): Promise<void> {
	await new Promise<void>((resolve) => {
		setImmediate(resolve);
	});
}

/** 删除 TUI 输出中的 ANSI 控制序列。返回纯文本。示例：stripAnsi(selector.render(...).join("\n"))。 */
function stripAnsi(text: string): string {
	return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

/** 用默认值创建 SessionInfo。overrides 必须给出 id；返回完整会话信息。示例：makeSession({id: "a"})。 */
function makeSession(overrides: Partial<SessionInfo> & { id: string }): SessionInfo {
	return {
		path: overrides.path ?? `/tmp/${overrides.id}.jsonl`,
		id: overrides.id,
		cwd: overrides.cwd ?? "",
		name: overrides.name,
		parentSessionPath: overrides.parentSessionPath,
		created: overrides.created ?? new Date(0),
		modified: overrides.modified ?? new Date(0),
		messageCount: overrides.messageCount ?? 1,
		firstMessage: overrides.firstMessage ?? "hello",
		allMessagesText: overrides.allMessagesText ?? "hello",
	};
}

/** 创建同一真实会话目录的两个符号链接别名。返回父子会话测试路径。 */
function createSymlinkedSessionPaths(): {
	baseDir: string;
	parentAliasA: string;
	parentAliasB: string;
	childAliasB: string;
} {
	/** 当前符号链接场景的临时根目录。 */
	const baseDir = mkdtempSync(join(tmpdir(), "pi-session-selector-"));
	/** 保存真实 sessions 目录的目录。 */
	const realDir = join(baseDir, "real");
	/** 第一个别名目录。 */
	const aliasADir = join(baseDir, "alias-a");
	/** 第二个别名目录。 */
	const aliasBDir = join(baseDir, "alias-b");
	mkdirSync(realDir, { recursive: true });
	mkdirSync(aliasADir, { recursive: true });
	mkdirSync(aliasBDir, { recursive: true });

	/** 真实会话文件目录。 */
	const sharedDir = join(realDir, "sessions");
	mkdirSync(sharedDir, { recursive: true });
	/** 指向真实目录的别名 A 路径。 */
	const aliasASessions = join(aliasADir, "sessions");
	/** 指向真实目录的别名 B 路径。 */
	const aliasBSessions = join(aliasBDir, "sessions");
	symlinkSync(sharedDir, aliasASessions);
	symlinkSync(sharedDir, aliasBSessions);

	/** 父会话真实文件路径。 */
	const parentRealPath = join(sharedDir, "parent.jsonl");
	/** 子会话真实文件路径。 */
	const childRealPath = join(sharedDir, "child.jsonl");
	writeFileSync(parentRealPath, "parent\n");
	writeFileSync(childRealPath, "child\n");

	return {
		baseDir,
		parentAliasA: join(aliasASessions, "parent.jsonl"),
		parentAliasB: join(aliasBSessions, "parent.jsonl"),
		childAliasB: join(aliasBSessions, "child.jsonl"),
	};
}

/** Ctrl+D 的输入字符，用作显式删除快捷键。 */
const CTRL_D = "\x04";
/** Kitty 键盘协议表示的 Ctrl+Backspace。 */
const CTRL_BACKSPACE = "\x1b[127;5u";

describe("session selector path/delete interactions", () => {
	/** 传给选择器的按键绑定管理器。 */
	const keybindings = new KeybindingsManager();
	/** 用例创建且需清理的临时目录。 */
	const tempDirs: string[] = [];

	/** 每个用例后递归删除登记的临时目录。 */
	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	/** 每个用例前重置全局按键绑定，避免状态串扰。 */
	beforeEach(() => {
		// Ensure test isolation: keybindings are a global singleton
		// 按键绑定是全局单例，重置它以隔离测试。
		setKeybindings(new KeybindingsManager());
	});

	/** 整个测试文件开始前初始化会话选择器依赖的全局主题。 */
	beforeAll(() => {
		// session selector uses the global theme instance
		// 会话选择器依赖全局主题实例。
		initTheme("dark");
	});
	/** 验证搜索非空时 Ctrl+Backspace 只编辑查询，不触发删除。 */
	it("does not treat Ctrl+Backspace as delete when search query is non-empty", async () => {
		/** 供选择器展示的两个测试会话。 */
		const sessions = [makeSession({ id: "a" }), makeSession({ id: "b" })];

		/** 使用固定会话加载器创建的选择器。 */
		const selector = new SessionSelectorComponent(
			async () => sessions,
			async () => [],
			() => {},
			() => {},
			() => {},
			() => {},
			{ keybindings },
		);
		await flushPromises();

		/** 选择器内部的可输入会话列表。 */
		const list = selector.getSessionList();
		/** 删除确认目标路径的变化记录。 */
		const confirmationChanges: Array<string | null> = [];
		list.onDeleteConfirmationChange = (path) => confirmationChanges.push(path);

		list.handleInput("a");
		list.handleInput(CTRL_BACKSPACE);

		expect(confirmationChanges).toEqual([]);
	});

	/** 验证搜索非空时 Ctrl+D 仍显式进入删除确认。 */
	it("enters confirmation mode on Ctrl+D even with a non-empty search query", async () => {
		/** 供选择器展示的两个测试会话。 */
		const sessions = [makeSession({ id: "a" }), makeSession({ id: "b" })];

		/** 使用固定会话加载器创建的选择器。 */
		const selector = new SessionSelectorComponent(
			async () => sessions,
			async () => [],
			() => {},
			() => {},
			() => {},
			() => {},
			{ keybindings },
		);
		await flushPromises();

		/** 选择器内部的可输入会话列表。 */
		const list = selector.getSessionList();
		/** 删除确认目标路径的变化记录。 */
		const confirmationChanges: Array<string | null> = [];
		list.onDeleteConfirmationChange = (path) => confirmationChanges.push(path);

		list.handleInput("a");
		list.handleInput(CTRL_D);

		expect(confirmationChanges).toEqual([sessions[0]!.path]);
	});

	/** 验证搜索为空时 Ctrl+Backspace 可确认并执行删除。 */
	it("enters confirmation mode on Ctrl+Backspace when search query is empty", async () => {
		/** 供选择器展示的两个测试会话。 */
		const sessions = [makeSession({ id: "a" }), makeSession({ id: "b" })];

		/** 使用固定会话加载器创建的选择器。 */
		const selector = new SessionSelectorComponent(
			async () => sessions,
			async () => [],
			() => {},
			() => {},
			() => {},
			() => {},
			{ keybindings },
		);
		await flushPromises();

		/** 选择器内部的可输入会话列表。 */
		const list = selector.getSessionList();
		/** 删除确认目标路径的变化记录。 */
		const confirmationChanges: Array<string | null> = [];
		list.onDeleteConfirmationChange = (path) => confirmationChanges.push(path);

		/** onDeleteSession 最后收到的会话路径。 */
		let deletedPath: string | null = null;
		list.onDeleteSession = async (sessionPath) => {
			deletedPath = sessionPath;
		};

		list.handleInput(CTRL_BACKSPACE);
		expect(confirmationChanges).toEqual([sessions[0]!.path]);

		list.handleInput("\r");
		expect(confirmationChanges).toEqual([sessions[0]!.path, null]);
		expect(deletedPath).toBe(sessions[0]!.path);
	});

	/** 验证已切回 Current 后，迟到的 All 加载结果不会改变当前范围。 */
	it("does not switch scope back to All when All load resolves after toggling back to Current", async () => {
		/** Current 范围返回的会话。 */
		const currentSessions = [makeSession({ id: "current" })];
		/** 手动控制完成时间的 All 范围加载。 */
		const allDeferred = createDeferred<SessionInfo[]>();
		/** All 加载器实际调用次数。 */
		let allLoadCalls = 0;

		/** 使用延迟 All 加载器创建的选择器。 */
		const selector = new SessionSelectorComponent(
			async () => currentSessions,
			async () => {
				allLoadCalls++;
				return allDeferred.promise;
			},
			() => {},
			() => {},
			() => {},
			() => {},
			{ keybindings },
		);
		await flushPromises();

		/** 选择器内部列表，用于发送 Tab。 */
		const list = selector.getSessionList();
		list.handleInput("\t"); // current -> all (starts async load)
		// 从 current 切到 all，并开始异步加载。
		list.handleInput("\t"); // all -> current
		// 在加载完成前从 all 切回 current。

		allDeferred.resolve([makeSession({ id: "all" })]);
		await flushPromises();

		expect(allLoadCalls).toBe(1);
		/** All 结果迟到后渲染出的选择器文本。 */
		const output = selector.render(120).join("\n");
		expect(output).toContain("Resume Session (Current Folder)");
		expect(output).not.toContain("Resume Session (All)");
	});

	/** 验证 All 已加载中时反复切换不会启动重复请求。 */
	it("does not start redundant All loads when toggling scopes while All is already loading", async () => {
		/** Current 范围返回的会话。 */
		const currentSessions = [makeSession({ id: "current" })];
		/** 手动控制完成时间的 All 范围加载。 */
		const allDeferred = createDeferred<SessionInfo[]>();
		/** All 加载器实际调用次数。 */
		let allLoadCalls = 0;

		/** 使用延迟 All 加载器创建的选择器。 */
		const selector = new SessionSelectorComponent(
			async () => currentSessions,
			async () => {
				allLoadCalls++;
				return allDeferred.promise;
			},
			() => {},
			() => {},
			() => {},
			() => {},
			{ keybindings },
		);
		await flushPromises();

		/** 选择器内部列表，用于快速切换范围。 */
		const list = selector.getSessionList();
		list.handleInput("\t"); // current -> all (starts async load)
		// 从 current 切到 all，并开始异步加载。
		list.handleInput("\t"); // all -> current
		// 在加载期间切回 current。
		list.handleInput("\t"); // current -> all again while load pending
		// 加载仍未完成时再次切到 all，应复用原任务。

		expect(allLoadCalls).toBe(1);

		allDeferred.resolve([makeSession({ id: "all" })]);
		await flushPromises();
	});

	/** 验证父子路径使用不同符号链接别名时仍被组织成线程。 */
	it("threads sessions when parent and child paths use different symlink aliases", async () => {
		/** 同一真实目录的两个符号链接路径集合。 */
		const paths = createSymlinkedSessionPaths();
		tempDirs.push(paths.baseDir);

		/** 父子会话分别使用不同别名描述的会话列表。 */
		const sessions = [
			makeSession({
				id: "parent",
				path: paths.parentAliasB,
				name: "Parent",
				modified: new Date("2026-01-01T00:00:00.000Z"),
			}),
			makeSession({
				id: "child",
				path: paths.childAliasB,
				parentSessionPath: paths.parentAliasA,
				name: "Child",
				modified: new Date("2025-12-31T00:00:00.000Z"),
			}),
		];

		/** 使用符号链接会话列表创建的选择器。 */
		const selector = new SessionSelectorComponent(
			async () => sessions,
			async () => [],
			() => {},
			() => {},
			() => {},
			() => {},
			{ keybindings },
		);
		await flushPromises();

		/** 去除 ANSI 后的线程化渲染文本。 */
		const output = stripAnsi(selector.render(120).join("\n"));
		expect(output).toContain("Parent");
		expect(output).toContain("└─ Child");
	});

	/** 验证线程根节点按整个子树的最新活动排序。 */
	it("sorts threaded sessions by latest activity in their subtree", async () => {
		/** 活动时间较新的第一个根会话。 */
		const parentOne = makeSession({
			id: "parent-one",
			name: "Parent one",
			modified: new Date("2026-01-02T00:00:00.000Z"),
		});
		/** 自身较旧但子会话更新的第二个根会话。 */
		const parentTwo = makeSession({
			id: "parent-two",
			name: "Parent two",
			modified: new Date("2026-01-01T00:00:00.000Z"),
		});
		/** 属于 parentTwo 且全局最新的子会话。 */
		const childTwo = makeSession({
			id: "child-two",
			name: "Child two",
			parentSessionPath: parentTwo.path,
			modified: new Date("2026-01-03T00:00:00.000Z"),
		});

		/** 使用两棵会话线程创建的选择器。 */
		const selector = new SessionSelectorComponent(
			async () => [parentOne, parentTwo, childTwo],
			async () => [],
			() => {},
			() => {},
			() => {},
			() => {},
			{ keybindings },
		);
		await flushPromises();

		/** 去除 ANSI 后的排序渲染文本。 */
		const output = stripAnsi(selector.render(120).join("\n"));
		/** Parent two 在输出中的位置。 */
		const parentTwoIndex = output.indexOf("Parent two");
		/** Child two 在输出中的位置。 */
		const childTwoIndex = output.indexOf("└─ Child two");
		/** Parent one 在输出中的位置。 */
		const parentOneIndex = output.indexOf("Parent one");

		expect(parentTwoIndex).toBeGreaterThanOrEqual(0);
		expect(childTwoIndex).toBeGreaterThan(parentTwoIndex);
		expect(parentOneIndex).toBeGreaterThan(childTwoIndex);
	});

	/** 验证当前会话路径与列表路径使用不同别名时仍禁止删除。 */
	it("treats the current session as active across symlink aliases", async () => {
		/** 同一真实目录的两个符号链接路径集合。 */
		const paths = createSymlinkedSessionPaths();
		tempDirs.push(paths.baseDir);

		/** 列表中使用别名 B 的当前会话。 */
		const sessions = [makeSession({ id: "parent", path: paths.parentAliasB, name: "Parent" })];
		/** 当前会话路径使用别名 A 的选择器。 */
		const selector = new SessionSelectorComponent(
			async () => sessions,
			async () => [],
			() => {},
			() => {},
			() => {},
			() => {},
			{ keybindings },
			paths.parentAliasA,
		);
		await flushPromises();

		/** 选择器内部列表，用于触发删除快捷键。 */
		const list = selector.getSessionList();
		/** 删除确认路径变化记录，应保持为空。 */
		const confirmationChanges: Array<string | null> = [];
		/** 尝试删除当前会话时收到的错误文本。 */
		let errorMessage: string | undefined;
		list.onDeleteConfirmationChange = (path) => confirmationChanges.push(path);
		list.onError = (message) => {
			errorMessage = message;
		};

		list.handleInput(CTRL_D);

		expect(confirmationChanges).toEqual([]);
		expect(errorMessage).toBe("Cannot delete the currently active session");
	});
});
/**
 * 文件职责：验证会话选择器的删除快捷键、异步范围切换、会话线程排序以及符号链接路径等价性。
 * 技术维度：使用 Vitest、TUI 输入模拟、Deferred Promise、ANSI 清理和真实临时目录符号链接构造回归场景。
 * 产品维度：保障用户搜索会话、切换全部范围或删除会话时不会误操作，并能正确展示父子会话关系。
 * 逻辑维度：先定义延迟任务、会话工厂和符号链接目录，再测试快捷键、竞态加载、线程结构、排序与当前会话保护。
 * 关键边界：符号链接用例在无创建权限的平台可能失败；按键绑定和主题是全局单例，必须在用例前重置。
 * 新手阅读建议：先看 makeSession 和 createDeferred，再读前三个删除快捷键用例，最后分析异步竞态与符号链接场景。
 */
