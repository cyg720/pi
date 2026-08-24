/**
 * 文件职责：验证 AgentHarness 的 read、write、edit、bash 工具在文件、图片、并发、中止、截断和环境准备方面的行为。
 * 技术维度：使用 Vitest、NodeExecutionEnv、可注入执行环境子类、diff 补丁库、符号链接与受控异步屏障。
 * 产品维度：保障代理读取和修改文件、运行命令时结果准确，取消与并发操作不会互相覆盖或丢失完整输出。
 * 逻辑维度：先定义输出提取、延迟和特殊执行环境，再按 read、write、edit、bash 四个工具分组覆盖。
 * 关键边界：Bash 用例依赖 POSIX 命令；符号链接可能受 Windows 权限限制，超大输出会写入临时完整结果文件。
 * 新手阅读建议：先读 createContext、deferred 和四个执行环境类，再逐组对照 execute 的五个参数与断言。
 */

import { symlink } from "node:fs/promises";
import { applyPatch } from "diff";
import { describe, expect, it } from "vitest";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import { type BashToolDetails, createBashTool } from "../../src/harness/tools/bash.ts";
import { createEditTool } from "../../src/harness/tools/edit.ts";
import { createReadTool } from "../../src/harness/tools/read.ts";
import { createWriteTool } from "../../src/harness/tools/write.ts";
import {
	type ExecutionError,
	type FileError,
	getOrThrow,
	ok,
	type Result,
	type ShellExecOptions,
} from "../../src/harness/types.ts";
import { createTempDir } from "./session-test-utils.ts";

/** 从工具结果中提取全部文本内容块。参数 result 为工具结果；返回以换行连接的字符串。例如：textOutput(result)。 */
function textOutput(result: { content: Array<{ type: string; text?: string }> }): string {
	return result.content.flatMap((part) => (part.type === "text" ? [part.text ?? ""] : [])).join("\n");
}

/** 创建带独立临时目录的 Node 执行上下文。无参数；返回含 env 的对象。例如：createContext()。 */
function createContext() {
	/** 变量 env：当前场景使用的 Node 执行环境或测试专用子类；仅在当前类、函数或测试作用域内有效。 */
	const env = new NodeExecutionEnv({ cwd: createTempDir() });
	return { env };
}

/** 创建可由外部 resolve 的 Promise 屏障。无参数；返回 promise 与 resolve。例如：const gate = deferred()。 */
function deferred(): { promise: Promise<void>; resolve: () => void } {
	/** 变量 resolve：外部可调用的 Promise 完成函数；仅在当前类、函数或测试作用域内有效。 */
	let resolve = () => {};
	/** 变量 promise：等待外部 resolve 的同步屏障 Promise；仅在当前类、函数或测试作用域内有效。 */
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

/** 等待指定毫秒数。参数 ms 为非负延迟；返回完成 Promise。例如：await delay(20)。 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 类 SlowReadExecutionEnv：在读取文本前延迟，用于放大并发编辑竞争窗口；仅用于本文件的并发和回调边界测试。 */
class SlowReadExecutionEnv extends NodeExecutionEnv {
	/** 延迟后读取文本。参数 path 为路径、abortSignal 为可选取消信号；返回 Result。例如：await env.readTextFile("a.txt")。 */
	override async readTextFile(path: string, abortSignal?: AbortSignal): Promise<Result<string, FileError>> {
		await delay(20);
		return super.readTextFile(path, abortSignal);
	}
}

/** 类 BlockingWriteExecutionEnv：用两个屏障暂停首次写入并观察第二次写入是否提前开始；仅用于本文件的并发和回调边界测试。 */
class BlockingWriteExecutionEnv extends NodeExecutionEnv {
	/** 成员变量 firstWriteStarted：记录并发写入/编辑阶段的屏障或布尔状态，初始值见赋值表达式。 */
	readonly firstWriteStarted = deferred();
	/** 成员变量 finishFirstWrite：记录并发写入/编辑阶段的屏障或布尔状态，初始值见赋值表达式。 */
	readonly finishFirstWrite = deferred();
	/** 成员变量 secondWriteStarted：记录并发写入/编辑阶段的屏障或布尔状态，初始值见赋值表达式。 */
	secondWriteStarted = false;

	/** 拦截特定内容的写入以控制并发顺序。参数 path、content、abortSignal；返回写入 Result。例如：await env.writeFile("a.txt", "first\n")。 */
	override async writeFile(
		path: string,
		content: string | Uint8Array,
		abortSignal?: AbortSignal,
	): Promise<Result<void, FileError>> {
		if (content === "first\n") {
			this.firstWriteStarted.resolve();
			await this.finishFirstWrite.promise;
		} else if (content === "second\n") {
			this.secondWriteStarted = true;
		}
		return super.writeFile(path, content, abortSignal);
	}
}

/** 类 BlockingEditExecutionEnv：暂停首次编辑落盘并记录第二次编辑与写入完成顺序；仅用于本文件的并发和回调边界测试。 */
class BlockingEditExecutionEnv extends NodeExecutionEnv {
	/** 成员变量 firstEditWriteStarted：记录并发写入/编辑阶段的屏障或布尔状态，初始值见赋值表达式。 */
	readonly firstEditWriteStarted = deferred();
	/** 成员变量 finishFirstEditWrite：记录并发写入/编辑阶段的屏障或布尔状态，初始值见赋值表达式。 */
	readonly finishFirstEditWrite = deferred();
	/** 成员变量 firstEditWriteSettled：记录并发写入/编辑阶段的屏障或布尔状态，初始值见赋值表达式。 */
	firstEditWriteSettled = false;
	/** 成员变量 secondEditWriteStarted：记录并发写入/编辑阶段的屏障或布尔状态，初始值见赋值表达式。 */
	secondEditWriteStarted = false;

	/** 拦截特定内容的写入以控制并发顺序。参数 path、content、abortSignal；返回写入 Result。例如：await env.writeFile("a.txt", "first\n")。 */
	override async writeFile(
		path: string,
		content: string | Uint8Array,
		abortSignal?: AbortSignal,
	): Promise<Result<void, FileError>> {
		if (content === "ALPHA\nbeta\n") {
			this.firstEditWriteStarted.resolve();
			await this.finishFirstEditWrite.promise;
			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await super.writeFile(path, content);
			this.firstEditWriteSettled = true;
			return result;
		}
		if (content === "ALPHA\nBETA\n" || content === "alpha\nBETA\n") {
			this.secondEditWriteStarted = true;
		}
		return super.writeFile(path, content, abortSignal);
	}
}

/** 类 LateOutputExecutionEnv：在 exec 已返回后异步发送迟到输出，验证回调被忽略；仅用于本文件的并发和回调边界测试。 */
class LateOutputExecutionEnv extends NodeExecutionEnv {
	/** 模拟先同步输出再迟到输出的命令执行。参数 command 未使用、options 提供回调；返回成功结果。例如：await env.exec(":", options)。 */
	override async exec(
		_command: string,
		options?: ShellExecOptions,
	): Promise<Result<{ stdout: string; stderr: string; exitCode: number }, ExecutionError>> {
		options?.onStdout?.("before\n");
		setTimeout(() => options?.onStdout?.("late\n"), 0);
		return ok({ stdout: "before\n", stderr: "", exitCode: 0 });
	}
}

/** 构造最小 1×1、24 位 BMP 字节。无参数；返回 Uint8Array。例如：createTinyBmp()。 */
function createTinyBmp(): Uint8Array {
	/** 变量 bytes：最小 BMP 文件的可变字节数组；仅在当前类、函数或测试作用域内有效。 */
	const bytes = new Uint8Array(58);
	/** 变量 view：按小端写入 BMP 头字段的 DataView；仅在当前类、函数或测试作用域内有效。 */
	const view = new DataView(bytes.buffer);
	bytes[0] = 0x42;
	bytes[1] = 0x4d;
	view.setUint32(2, bytes.length, true);
	view.setUint32(10, 54, true);
	view.setUint32(14, 40, true);
	view.setInt32(18, 1, true);
	view.setInt32(22, 1, true);
	view.setUint16(26, 1, true);
	view.setUint16(28, 24, true);
	view.setUint32(34, 4, true);
	return bytes;
}

/** 测试分组：AgentHarness 当前工具类别。 */
describe("AgentHarness tools", () => {
	/** 测试分组：AgentHarness 当前工具类别。 */
	describe("read", () => {
		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("reads text with offsets, limits, and continuation notices", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			getOrThrow(
				await context.env.writeFile(
					"test.txt",
					Array.from({ length: 100 }, (_, index) => `Line ${index + 1}`).join("\n"),
				),
			);

			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createReadTool().execute(
				"read-1",
				{ path: "test.txt", offset: 41, limit: 20 },
				undefined,
				undefined,
				context,
			);
			/** 变量 output：从 read 工具结果提取的纯文本；仅在当前类、函数或测试作用域内有效。 */
			const output = textOutput(result);

			expect(output).not.toContain("Line 40");
			expect(output).toContain("Line 41");
			expect(output).toContain("Line 60");
			expect(output).not.toContain("Line 61");
			expect(output).toContain("[40 more lines in file. Use offset=61 to continue.]");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("truncates large text by line count", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			getOrThrow(
				await context.env.writeFile(
					"large.txt",
					Array.from({ length: 2500 }, (_, index) => `Line ${index + 1}`).join("\n"),
				),
			);

			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createReadTool().execute("read-2", { path: "large.txt" }, undefined, undefined, context);

			expect(textOutput(result)).toContain("[Showing lines 1-2000 of 2500. Use offset=2001 to continue.]");
			expect(result.details?.truncation).toMatchObject({
				truncated: true,
				truncatedBy: "lines",
				totalLines: 2500,
				outputLines: 2000,
			});
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("does not count a trailing newline as an extra line at the truncation limit", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			getOrThrow(
				await context.env.writeFile("exact.txt", `${Array.from({ length: 2000 }, () => "x").join("\n")}\n`),
			);

			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createReadTool().execute(
				"read-exact",
				{ path: "exact.txt" },
				undefined,
				undefined,
				context,
			);

			expect(result.details).toBeUndefined();
			expect(textOutput(result)).not.toContain("Use offset=");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("rejects offsets beyond the file", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			getOrThrow(await context.env.writeFile("short.txt", "one\ntwo\nthree"));

			await expect(
				createReadTool().execute("read-3", { path: "short.txt", offset: 100 }, undefined, undefined, context),
			).rejects.toThrow("Offset 100 is beyond end of file (3 lines total)");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("detects supported images by content", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			/** 变量 png：从固定 Base64 构造的 1×1 PNG 字节；仅在当前类、函数或测试作用域内有效。 */
			const png = Uint8Array.from(
				Buffer.from(
					"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==",
					"base64",
				),
			);
			getOrThrow(await context.env.writeFile("image.txt", png));

			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createReadTool().execute("read-4", { path: "image.txt" }, undefined, undefined, context);

			expect(textOutput(result)).toContain("Read image file [image/png]");
			expect(result.content).toContainEqual({
				type: "image",
				data: Buffer.from(png).toString("base64"),
				mimeType: "image/png",
			});
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("delegates image conversion and resizing to an injected processor", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			/** 变量 bmp：createTinyBmp 返回的 BMP 原始字节；仅在当前类、函数或测试作用域内有效。 */
			const bmp = createTinyBmp();
			getOrThrow(await context.env.writeFile("image.bmp", bmp));
			/** 变量 received：注入图片处理器实际收到的参数记录；仅在当前类、函数或测试作用域内有效。 */
			let received: { bytes: Uint8Array; mimeType: string; autoResizeImages: boolean } | undefined;
			/** 变量 tool：当前场景创建的 read、write、edit 或 bash 工具；仅在当前类、函数或测试作用域内有效。 */
			const tool = createReadTool({
				autoResizeImages: false,
				imageProcessor: async (bytes, mimeType, options) => {
					received = { bytes, mimeType, autoResizeImages: options.autoResizeImages };
					return {
						ok: true,
						data: "converted",
						mimeType: "image/png",
						hints: ["[Image converted from image/bmp to image/png.]"],
					};
				},
			});

			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await tool.execute("read-bmp", { path: "image.bmp" }, undefined, undefined, context);

			expect(received).toMatchObject({ mimeType: "image/bmp", autoResizeImages: false });
			expect(Array.from(received?.bytes ?? [])).toEqual(Array.from(bmp));
			expect(textOutput(result)).toContain("[Image converted from image/bmp to image/png.]");
			expect(result.content).toContainEqual({ type: "image", data: "converted", mimeType: "image/png" });
		});
	});

	/** 测试分组：AgentHarness 当前工具类别。 */
	describe("write", () => {
		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("writes files and creates parent directories", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createWriteTool().execute(
				"write-1",
				{ path: "nested/dir/file.txt", content: "hello" },
				undefined,
				undefined,
				context,
			);

			expect(textOutput(result)).toBe("Successfully wrote 5 bytes to nested/dir/file.txt");
			expect(getOrThrow(await context.env.readTextFile("nested/dir/file.txt"))).toBe("hello");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("keeps the mutation queue locked until an aborted write settles", async () => {
			/** 变量 env：当前场景使用的 Node 执行环境或测试专用子类；仅在当前类、函数或测试作用域内有效。 */
			const env = new BlockingWriteExecutionEnv({ cwd: createTempDir() });
			/** 变量 tool：当前场景创建的 read、write、edit 或 bash 工具；仅在当前类、函数或测试作用域内有效。 */
			const tool = createWriteTool();
			/** 变量 controller：取消首次写入或编辑的 AbortController；仅在当前类、函数或测试作用域内有效。 */
			const controller = new AbortController();
			/** 变量 firstWrite：被暂停并随后取消的第一次写入 Promise；仅在当前类、函数或测试作用域内有效。 */
			const firstWrite = tool.execute(
				"write-first",
				{ path: "file.txt", content: "first\n" },
				controller.signal,
				undefined,
				{
					env,
				},
			);
			await env.firstWriteStarted.promise;
			controller.abort();
			/** 变量 secondWrite：等待队列锁释放的第二次写入 Promise；仅在当前类、函数或测试作用域内有效。 */
			const secondWrite = tool.execute(
				"write-second",
				{ path: "file.txt", content: "second\n" },
				undefined,
				undefined,
				{ env },
			);

			await delay(20);
			expect(env.secondWriteStarted).toBe(false);
			env.finishFirstWrite.resolve();
			await expect(firstWrite).rejects.toThrow();
			await secondWrite;
			expect(getOrThrow(await env.readTextFile("file.txt"))).toBe("second\n");
		});
	});

	/** 测试分组：AgentHarness 当前工具类别。 */
	describe("edit", () => {
		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("applies disjoint edits and returns both diff formats", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			/** 变量 original：应用多处编辑前的原始文件文本；仅在当前类、函数或测试作用域内有效。 */
			const original = "alpha\nbeta\ngamma\ndelta\n";
			getOrThrow(await context.env.writeFile("edit.txt", original));

			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createEditTool().execute(
				"edit-1",
				{
					path: "edit.txt",
					edits: [
						{ oldText: "alpha\n", newText: "ALPHA\n" },
						{ oldText: "gamma\n", newText: "GAMMA\n" },
					],
				},
				undefined,
				undefined,
				context,
			);

			expect(textOutput(result)).toBe("Successfully replaced 2 block(s) in edit.txt.");
			expect(result.details?.diff).toContain("ALPHA");
			expect(result.details?.diff).toContain("GAMMA");
			expect(applyPatch(original, result.details?.patch ?? "")).toBe("ALPHA\nbeta\nGAMMA\ndelta\n");
			expect(getOrThrow(await context.env.readTextFile("edit.txt"))).toBe("ALPHA\nbeta\nGAMMA\ndelta\n");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("matches all edits against the original and rejects overlaps", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			getOrThrow(await context.env.writeFile("edit.txt", "one\ntwo\nthree\n"));

			await expect(
				createEditTool().execute(
					"edit-2",
					{
						path: "edit.txt",
						edits: [
							{ oldText: "one\ntwo\n", newText: "ONE\nTWO\n" },
							{ oldText: "two\nthree\n", newText: "TWO\nTHREE\n" },
						],
					},
					undefined,
					undefined,
					context,
				),
			).rejects.toThrow(/overlap/);
			expect(getOrThrow(await context.env.readTextFile("edit.txt"))).toBe("one\ntwo\nthree\n");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("rejects missing and duplicate target text", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			getOrThrow(await context.env.writeFile("edit.txt", "foo foo foo"));
			/** 变量 tool：当前场景创建的 read、write、edit 或 bash 工具；仅在当前类、函数或测试作用域内有效。 */
			const tool = createEditTool();

			await expect(
				tool.execute(
					"edit-3",
					{ path: "edit.txt", edits: [{ oldText: "bar", newText: "baz" }] },
					undefined,
					undefined,
					context,
				),
			).rejects.toThrow(/Could not find the exact text/);
			await expect(
				tool.execute(
					"edit-4",
					{ path: "edit.txt", edits: [{ oldText: "foo", newText: "bar" }] },
					undefined,
					undefined,
					context,
				),
			).rejects.toThrow(/Found 3 occurrences/);
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("keeps the mutation queue locked until an aborted edit write settles", async () => {
			/** 变量 env：当前场景使用的 Node 执行环境或测试专用子类；仅在当前类、函数或测试作用域内有效。 */
			const env = new BlockingEditExecutionEnv({ cwd: createTempDir() });
			getOrThrow(await env.writeFile("file.txt", "alpha\nbeta\n"));
			/** 变量 tool：当前场景创建的 read、write、edit 或 bash 工具；仅在当前类、函数或测试作用域内有效。 */
			const tool = createEditTool();
			/** 变量 controller：取消首次写入或编辑的 AbortController；仅在当前类、函数或测试作用域内有效。 */
			const controller = new AbortController();
			/** 变量 firstEdit：被暂停并随后取消的第一次编辑 Promise；仅在当前类、函数或测试作用域内有效。 */
			const firstEdit = tool.execute(
				"edit-first",
				{ path: "file.txt", edits: [{ oldText: "alpha", newText: "ALPHA" }] },
				controller.signal,
				undefined,
				{ env },
			);
			await env.firstEditWriteStarted.promise;
			controller.abort();
			/** 变量 secondEdit：等待首次写入完成的第二次编辑 Promise；仅在当前类、函数或测试作用域内有效。 */
			const secondEdit = tool.execute(
				"edit-second",
				{ path: "file.txt", edits: [{ oldText: "beta", newText: "BETA" }] },
				undefined,
				undefined,
				{ env },
			);

			await delay(20);
			expect(env.secondEditWriteStarted).toBe(false);
			env.finishFirstEditWrite.resolve();
			await expect(firstEdit).rejects.toThrow("Operation aborted");
			await secondEdit;
			expect(env.firstEditWriteSettled).toBe(true);
			expect(getOrThrow(await env.readTextFile("file.txt"))).toBe("ALPHA\nBETA\n");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("serializes concurrent edits through canonical and symlink paths", async () => {
			/** 变量 env：当前场景使用的 Node 执行环境或测试专用子类；仅在当前类、函数或测试作用域内有效。 */
			const env = new SlowReadExecutionEnv({ cwd: createTempDir() });
			getOrThrow(await env.writeFile("target.txt", "alpha\nbeta\ngamma\n"));
			await symlink("target.txt", `${env.cwd}/link.txt`);
			/** 变量 tool：当前场景创建的 read、write、edit 或 bash 工具；仅在当前类、函数或测试作用域内有效。 */
			const tool = createEditTool();

			await Promise.all([
				tool.execute(
					"edit-target",
					{ path: "target.txt", edits: [{ oldText: "alpha", newText: "ALPHA" }] },
					undefined,
					undefined,
					{ env },
				),
				tool.execute(
					"edit-link",
					{ path: "link.txt", edits: [{ oldText: "beta", newText: "BETA" }] },
					undefined,
					undefined,
					{ env },
				),
			]);

			expect(getOrThrow(await env.readTextFile("target.txt"))).toBe("ALPHA\nBETA\ngamma\n");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("edits regular files through symlinks", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			getOrThrow(await context.env.writeFile("target.txt", "before\n"));
			await symlink("target.txt", `${context.env.cwd}/link.txt`);

			await createEditTool().execute(
				"edit-symlink",
				{ path: "link.txt", edits: [{ oldText: "before", newText: "after" }] },
				undefined,
				undefined,
				context,
			);

			expect(getOrThrow(await context.env.readTextFile("target.txt"))).toBe("after\n");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("preserves BOM and CRLF line endings", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			getOrThrow(await context.env.writeFile("edit.txt", "\uFEFFone\r\ntwo\r\n"));

			await createEditTool().execute(
				"edit-5",
				{ path: "edit.txt", edits: [{ oldText: "two", newText: "TWO" }] },
				undefined,
				undefined,
				context,
			);

			expect(getOrThrow(await context.env.readTextFile("edit.txt"))).toBe("\uFEFFone\r\nTWO\r\n");
		});
	});

	/** 测试分组：AgentHarness 当前工具类别。 */
	describe("bash", () => {
		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("executes commands and combines stdout and stderr", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createBashTool().execute(
				"bash-1",
				{ command: "printf out; printf err >&2" },
				undefined,
				undefined,
				context,
			);

			expect(textOutput(result)).toContain("out");
			expect(textOutput(result)).toContain("err");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("reports nonzero exits and timeouts", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			/** 变量 tool：当前场景创建的 read、write、edit 或 bash 工具；仅在当前类、函数或测试作用域内有效。 */
			const tool = createBashTool();

			await expect(
				tool.execute("bash-2", { command: "printf failed; exit 7" }, undefined, undefined, context),
			).rejects.toThrow(/failed[\s\S]*Command exited with code 7/);
			await expect(
				tool.execute("bash-3", { command: "sleep 2", timeout: 0.01 }, undefined, undefined, context),
			).rejects.toThrow(/Command timed out after 0.01 seconds/);
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("preserves truncated output when a command times out", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			/** 变量 error：捕获的 Bash 超时异常；仅在当前类、函数或测试作用域内有效。 */
			let error: unknown;
			try {
				await createBashTool().execute(
					"bash-timeout-output",
					{
						command: "i=1; while [ $i -le 3000 ]; do echo line-$i; i=$((i + 1)); done; sleep 2",
						timeout: 0.05,
					},
					undefined,
					undefined,
					context,
				);
			} catch (cause) {
				error = cause;
			}

			expect(error).toBeInstanceOf(Error);
			/** 变量 message：从异常取得的错误文本；仅在当前类、函数或测试作用域内有效。 */
			const message = (error as Error).message;
			expect(message).toContain("Command timed out after 0.05 seconds");
			/** 变量 fullOutputPath：错误文本中提取的完整输出临时路径；仅在当前类、函数或测试作用域内有效。 */
			const fullOutputPath = message.match(/Full output: ([^\]\n]+)/)?.[1];
			expect(fullOutputPath).toBeDefined();
			/** 变量 fullOutput：从临时文件读取的未截断命令输出；仅在当前类、函数或测试作用域内有效。 */
			const fullOutput = getOrThrow(await context.env.readTextFile(fullOutputPath!));
			expect(fullOutput).toContain("line-1\nline-2");
			expect(fullOutput).toContain("line-2999\nline-3000");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("ignores output callbacks after execution settles", async () => {
			/** 变量 env：当前场景使用的 Node 执行环境或测试专用子类；仅在当前类、函数或测试作用域内有效。 */
			const env = new LateOutputExecutionEnv({ cwd: createTempDir() });
			/** 变量 updates：工具执行期间收到的合并后部分更新数组；仅在当前类、函数或测试作用域内有效。 */
			const updates: string[] = [];
			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createBashTool().execute(
				"bash-late",
				{ command: "late" },
				undefined,
				(update) => updates.push(textOutput(update)),
				{ env },
			);
			await new Promise((resolve) => setTimeout(resolve, 20));

			expect(textOutput(result)).toBe("before\n");
			expect(updates.some((update) => update.includes("late"))).toBe(false);
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("reports the total size of an oversized final line", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createBashTool().execute(
				"bash-long-line",
				{ command: "printf '%060000d' 0" },
				undefined,
				undefined,
				context,
			);

			expect(textOutput(result)).toMatch(/Showing last 50\.0KB of line 1 \(line is 58\.6KB\)\. Full output:/);
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("prepares command, cwd, and an explicit environment with the turn context", async () => {
			/** 变量 env：当前场景使用的 Node 执行环境或测试专用子类；仅在当前类、函数或测试作用域内有效。 */
			const env = new NodeExecutionEnv({
				cwd: createTempDir(),
				shellEnv: { PI_BASH_PREPARE_INHERITED: "inherited" },
			});
			getOrThrow(await env.createDir("workspace"));
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = { env, workspace: `${env.cwd}/workspace` };
			/** 变量 controller：取消首次写入或编辑的 AbortController；仅在当前类、函数或测试作用域内有效。 */
			const controller = new AbortController();
			/** 变量 receivedContext：prepare 回调实际接收的 turn context；仅在当前类、函数或测试作用域内有效。 */
			let receivedContext: typeof context | undefined;
			/** 变量 receivedSignal：prepare 回调实际接收的取消信号；仅在当前类、函数或测试作用域内有效。 */
			let receivedSignal: AbortSignal | undefined;
			/** 变量 tool：当前场景创建的 read、write、edit 或 bash 工具；仅在当前类、函数或测试作用域内有效。 */
			const tool = createBashTool<typeof context>({
				commandPrefix: "prefix=ready",
				prepare: async (execution, turnContext, signal) => {
					receivedContext = turnContext;
					receivedSignal = signal;
					execution.cwd = turnContext.workspace;
					execution.env = { PI_BASH_PREPARE_EXPLICIT: "explicit" };
					execution.inheritEnv = false;
					execution.command += `\nprintf '%s:%s:%s:%s' "$prefix" "\${PI_BASH_PREPARE_INHERITED-}" "$PI_BASH_PREPARE_EXPLICIT" "$PWD"`;
				},
			});

			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await tool.execute("bash-prepare", { command: ":" }, controller.signal, undefined, context);

			expect(receivedContext).toBe(context);
			expect(receivedSignal).toBe(controller.signal);
			expect(textOutput(result)).toBe(`ready::explicit:${getOrThrow(await env.canonicalPath(context.workspace))}`);
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("supports command prefixes", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createBashTool({ commandPrefix: "value=hello" }).execute(
				"bash-4",
				{ command: "printf $value" },
				undefined,
				undefined,
				context,
			);

			expect(textOutput(result)).toBe("hello");
		});

		/** 测试场景：验证当前工具的正常结果、异常、中止、并发或截断行为。 */
		it("coalesces updates and persists truncated full output", async () => {
			/** 变量 context：当前工具执行使用的临时目录上下文；仅在当前类、函数或测试作用域内有效。 */
			const context = createContext();
			/** 变量 updates：工具执行期间收到的合并后部分更新数组；仅在当前类、函数或测试作用域内有效。 */
			const updates: Array<{
				content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
				details?: BashToolDetails;
			}> = [];
			/** 变量 result：当前工具执行返回的内容和详情；仅在当前类、函数或测试作用域内有效。 */
			const result = await createBashTool().execute(
				"bash-5",
				{ command: "i=1; while [ $i -le 3000 ]; do echo line-$i; i=$((i + 1)); done" },
				undefined,
				(update) => updates.push(update),
				context,
			);

			expect(updates.length).toBeLessThan(25);
			expect(result.details?.truncation).toMatchObject({
				truncated: true,
				truncatedBy: "lines",
				totalLines: 3000,
				outputLines: 2000,
			});
			expect(textOutput(result)).toContain("line-3000");
			expect(result.details?.fullOutputPath).toBeDefined();
			/** 变量 finalUpdate：更新数组中的最后一次部分结果；仅在当前类、函数或测试作用域内有效。 */
			const finalUpdate = updates.at(-1);
			expect(finalUpdate ? textOutput(finalUpdate) : "").toContain("line-3000");
			expect(finalUpdate?.details).toMatchObject({
				truncation: { totalLines: 3000, totalBytes: expect.any(Number) },
				fullOutputPath: result.details?.fullOutputPath,
			});
			/** 变量 fullOutput：从临时文件读取的未截断命令输出；仅在当前类、函数或测试作用域内有效。 */
			const fullOutput = getOrThrow(await context.env.readTextFile(result.details!.fullOutputPath!));
			expect(fullOutput).toContain("line-1\nline-2");
			expect(fullOutput).toContain("line-2999\nline-3000");
		});
	});
});
