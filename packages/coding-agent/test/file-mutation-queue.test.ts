/**
 * 文件职责：验证同一文件的修改任务会串行排队，不同文件可并行，并覆盖 edit/write 工具共享队列和中止行为。
 * 技术维度：使用 Vitest、Promise 延迟器、临时文件、符号链接和可注入文件操作制造确定的并发时序。
 * 产品维度：避免并行工具调用覆盖彼此写入，确保用户中止任务时底层写入完成前不会提前释放文件锁。
 * 逻辑维度：先测试队列键与并行性，再通过自定义 operations 检查 edit、write、符号链接和 abort 场景。
 * 关键边界：符号链接用例受 Windows 权限影响；短延迟只用于建立顺序；临时目录必须在用例后清理。
 * 新手阅读建议：先看 delay/createDeferred，再读同文件与不同文件两个基础用例，最后跟踪中止写入的时间线。
 */
import { access, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createEditTool } from "../src/core/tools/edit.ts";
import { withFileMutationQueue } from "../src/core/tools/file-mutation-queue.ts";
import { createWriteTool } from "../src/core/tools/write.ts";

/**
 * 等待指定毫秒数。
 * @param ms 延迟时间。
 * @returns 到时后完成的 Promise。
 * @example await delay(10);
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建可从外部主动完成的 Promise。
 * @returns promise 与对应 resolve 函数。
 * @example const gate = createDeferred(); gate.resolve();
 */
function createDeferred(): { promise: Promise<void>; resolve: () => void } {
	/** 赋值后可从测试流程外部解除等待的函数。 */
	let resolve!: () => void;
	/** 等待 resolve 被调用的 Promise。 */
	const promise = new Promise<void>((promiseResolve) => {
		resolve = promiseResolve;
	});
	return { promise, resolve };
}

/**
 * 判断一个 Promise 是否能在限定时间内完成。
 * @param promise 待观察的异步操作。
 * @param ms 最长等待毫秒数。
 * @returns 先完成为 true，先超时为 false。
 * @example await resolvesWithin(gate.promise, 20);
 */
async function resolvesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
	return Promise.race([promise.then(() => true), delay(ms).then(() => false)]);
}

/** 当前文件创建的所有临时目录，afterEach 统一删除。 */
const tempDirs: string[] = [];

/**
 * 创建并登记一个文件队列测试临时目录。
 * @returns 新目录绝对路径。
 * @example const dir = await createTempDir();
 */
async function createTempDir(): Promise<string> {
	/** 新建的唯一临时目录。 */
	const dir = await mkdtemp(join(tmpdir(), "pi-file-mutation-queue-"));
	tempDirs.push(dir);
	return dir;
}

/** 每个用例后并行删除已登记的全部临时目录。 */
afterEach(async () => {
	await Promise.all(tempDirs.splice(0, tempDirs.length).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** 覆盖底层文件修改队列的串行、并行和符号链接归一化规则。 */
describe("withFileMutationQueue", () => {
	it("serializes operations for the same file", async () => {
		/** 记录两个任务的开始和结束顺序。 */
		const order: string[] = [];
		/** 两个任务共享的文件队列键。 */
		const path = "/tmp/file-mutation-queue-same";

		/** 包含延迟的首个排队任务。 */
		const first = withFileMutationQueue(path, async () => {
			order.push("first:start");
			await delay(30);
			order.push("first:end");
		});
		/** 同一文件上的第二个任务，应等待 first。 */
		const second = withFileMutationQueue(path, async () => {
			order.push("second:start");
			order.push("second:end");
		});

		await Promise.all([first, second]);
		expect(order).toEqual(["first:start", "first:end", "second:start", "second:end"]);
	});

	it("allows different files to proceed in parallel", async () => {
		/** 记录两个不同文件任务的交错顺序。 */
		const order: string[] = [];

		await Promise.all([
			withFileMutationQueue("/tmp/file-mutation-queue-a", async () => {
				order.push("a:start");
				await delay(30);
				order.push("a:end");
			}),
			withFileMutationQueue("/tmp/file-mutation-queue-b", async () => {
				order.push("b:start");
				await delay(30);
				order.push("b:end");
			}),
		]);

		expect(order.indexOf("a:start")).toBeLessThan(order.indexOf("a:end"));
		expect(order.indexOf("b:start")).toBeLessThan(order.indexOf("b:end"));
		expect(order.indexOf("b:start")).toBeLessThan(order.indexOf("a:end"));
	});

	it("uses the same queue for symlink aliases", async () => {
		/** 符号链接场景的临时目录。 */
		const dir = await createTempDir();
		/** 实际文件路径。 */
		const targetPath = join(dir, "target.txt");
		/** 指向实际文件的符号链接路径。 */
		const symlinkPath = join(dir, "alias.txt");
		await writeFile(targetPath, "hello\n", "utf8");
		await symlink(targetPath, symlinkPath);

		/** 记录真实路径与别名任务的执行顺序。 */
		const order: string[] = [];
		await Promise.all([
			withFileMutationQueue(targetPath, async () => {
				order.push("target:start");
				await delay(30);
				order.push("target:end");
			}),
			withFileMutationQueue(symlinkPath, async () => {
				order.push("alias:start");
				order.push("alias:end");
			}),
		]);

		expect(order).toEqual(["target:start", "target:end", "alias:start", "alias:end"]);
	});
});

/** 覆盖内置 edit/write 工具对共享文件队列的使用。 */
describe("built-in edit and write tools", () => {
	it("preserves both parallel edits on the same file", async () => {
		/** 并行编辑场景的临时目录。 */
		const dir = await createTempDir();
		/** 同时修改两个片段的目标文件。 */
		const filePath = join(dir, "parallel-edit.txt");
		await writeFile(filePath, "alpha\nbeta\ngamma\n", "utf8");

		/** 注入延迟读写操作的 edit 工具。 */
		const editTool = createEditTool(dir, {
			operations: {
				access,
				readFile: async (path) => {
					/** 延迟期间保持队列锁的文件字节。 */
					const buffer = await readFile(path);
					await delay(30);
					return buffer;
				},
				writeFile: async (path, content) => {
					await delay(30);
					await writeFile(path, content, "utf8");
				},
			},
		});

		await Promise.all([
			editTool.execute("call-1", { path: filePath, edits: [{ oldText: "alpha", newText: "ALPHA" }] }),
			editTool.execute("call-2", { path: filePath, edits: [{ oldText: "beta", newText: "BETA" }] }),
		]);

		/** 两次编辑完成后的文件文本。 */
		const content = await readFile(filePath, "utf8");
		expect(content).toBe("ALPHA\nBETA\ngamma\n");
	});

	it("shares the queue between edit and write", async () => {
		/** edit/write 共享队列场景的临时目录。 */
		const dir = await createTempDir();
		/** 先编辑再整体写入的目标文件。 */
		const filePath = join(dir, "mixed.txt");
		await writeFile(filePath, "original\n", "utf8");

		/** 读写均带延迟的 edit 工具。 */
		const editTool = createEditTool(dir, {
			operations: {
				access,
				readFile: async (path) => {
					/** edit 读取到的原始文件字节。 */
					const buffer = await readFile(path);
					await delay(30);
					return buffer;
				},
				writeFile: async (path, content) => {
					await delay(30);
					await writeFile(path, content, "utf8");
				},
			},
		});
		/** 与 edit 工具共享文件队列的 write 工具。 */
		const writeTool = createWriteTool(dir, {
			operations: {
				mkdir: async () => {},
				writeFile: async (path, content) => {
					await delay(10);
					await writeFile(path, content, "utf8");
				},
			},
		});

		/** 先进入队列的编辑 Promise。 */
		const editPromise = editTool.execute("call-1", {
			path: filePath,
			edits: [{ oldText: "original", newText: "edited" }],
		});
		await delay(5);
		/** 稍后进入队列并最终覆盖文件的写入 Promise。 */
		const writePromise = writeTool.execute("call-2", {
			path: filePath,
			content: "replacement\n",
		});

		await Promise.all([editPromise, writePromise]);

		/** 两个操作完成后的最终文件文本。 */
		const content = await readFile(filePath, "utf8");
		expect(content).toBe("replacement\n");
	});

	it("keeps write queue locked while an aborted write is still in flight", async () => {
		/** 中止 write 场景的临时目录。 */
		const dir = await createTempDir();
		/** 两次写入共享的目标文件。 */
		const filePath = join(dir, "abort-write.txt");
		/** 表示首次底层写入已经开始的门闩。 */
		const firstWriteStarted = createDeferred();
		/** 测试控制首次底层写入何时完成的门闩。 */
		const finishFirstWrite = createDeferred();
		/** 表示第二次底层写入已经开始的门闩。 */
		const secondWriteStarted = createDeferred();
		/** 首次底层写入是否真正落盘完成。 */
		let firstWriteSettled = false;

		/** 使用可控底层写入时序的 write 工具。 */
		const writeTool = createWriteTool(dir, {
			operations: {
				mkdir: async () => {},
				writeFile: async (path, content) => {
					if (content === "first\n") {
						firstWriteStarted.resolve();
						await finishFirstWrite.promise;
						await writeFile(path, content, "utf8");
						firstWriteSettled = true;
						return;
					}

					if (content === "second\n") {
						expect(firstWriteSettled).toBe(true);
						secondWriteStarted.resolve();
					}
					await writeFile(path, content, "utf8");
				},
			},
		});

		/** 中止首次工具调用的控制器。 */
		const controller = new AbortController();
		/** 会在底层写入结束后才以中止错误拒绝的首次写入。 */
		const firstWrite = writeTool.execute("call-1", { path: filePath, content: "first\n" }, controller.signal);
		await firstWriteStarted.promise;
		controller.abort();

		/** 同文件第二次写入，应在首次底层写入结束前保持等待。 */
		const secondWrite = writeTool.execute("call-2", { path: filePath, content: "second\n" });
		expect(await resolvesWithin(secondWriteStarted.promise, 20)).toBe(false);

		finishFirstWrite.resolve();
		await expect(firstWrite).rejects.toThrow("Operation aborted");
		await secondWrite;

		/** 两次任务结束后的最终文件文本。 */
		const content = await readFile(filePath, "utf8");
		expect(content).toBe("second\n");
	});

	it("keeps edit queue locked while an aborted edit write is still in flight", async () => {
		/** 中止 edit 场景的临时目录。 */
		const dir = await createTempDir();
		/** 两次编辑共享的目标文件。 */
		const filePath = join(dir, "abort-edit.txt");
		await writeFile(filePath, "alpha\nbeta\n", "utf8");
		/** 表示首次 edit 底层写入已开始的门闩。 */
		const firstWriteStarted = createDeferred();
		/** 控制首次 edit 底层写入完成的门闩。 */
		const finishFirstWrite = createDeferred();
		/** 表示第二次 edit 写入已开始的门闩。 */
		const secondWriteStarted = createDeferred();
		/** 首次 edit 底层写入是否完成。 */
		let firstWriteSettled = false;

		/** 使用可控写入实现的 edit 工具。 */
		const editTool = createEditTool(dir, {
			operations: {
				access,
				readFile,
				writeFile: async (path, content) => {
					if (content === "ALPHA\nbeta\n") {
						firstWriteStarted.resolve();
						await finishFirstWrite.promise;
						await writeFile(path, content, "utf8");
						firstWriteSettled = true;
						return;
					}

					if (content === "ALPHA\nBETA\n" || content === "alpha\nBETA\n") {
						expect(firstWriteSettled).toBe(true);
						secondWriteStarted.resolve();
					}
					await writeFile(path, content, "utf8");
				},
			},
		});

		/** 中止首次 edit 调用的控制器。 */
		const controller = new AbortController();
		/** 首次编辑 Promise，底层写入完成后才报告中止。 */
		const firstEdit = editTool.execute(
			"call-1",
			{ path: filePath, edits: [{ oldText: "alpha", newText: "ALPHA" }] },
			controller.signal,
		);
		await firstWriteStarted.promise;
		controller.abort();

		/** 同文件第二次编辑，应等待首次底层写入结束。 */
		const secondEdit = editTool.execute("call-2", {
			path: filePath,
			edits: [{ oldText: "beta", newText: "BETA" }],
		});
		expect(await resolvesWithin(secondWriteStarted.promise, 20)).toBe(false);

		finishFirstWrite.resolve();
		await expect(firstEdit).rejects.toThrow("Operation aborted");
		await secondEdit;

		/** 两次编辑结束后的最终文本。 */
		const content = await readFile(filePath, "utf8");
		expect(content).toBe("ALPHA\nBETA\n");
	});
});
