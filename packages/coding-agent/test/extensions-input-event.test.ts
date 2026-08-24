/**
 * 文件职责：验证扩展 input 事件处理器的继续、转换、短路、来源、流式行为和错误恢复语义。
 * 技术维度：使用 Vitest、动态 TypeScript 扩展文件、ExtensionRunner、内存会话和测试模型注册表。
 * 产品维度：保证扩展能可靠预处理用户输入与图片，多处理器可组合且单个错误不会中断交互。
 * 逻辑维度：公共工厂重建扩展目录和运行器；九个用例覆盖无处理器、转换链、handled 和元数据传递。
 * 关键边界：处理器按注册顺序执行，handled 会停止后续处理；全局测试变量必须在用例前清理。
 * 新手阅读建议：先看 createRunner 如何装载字符串扩展，再按 continue、transform、handled 三类 action 阅读。
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { discoverAndLoadExtensions } from "../src/core/extensions/loader.ts";
import { ExtensionRunner } from "../src/core/extensions/runner.ts";
import { SessionManager } from "../src/core/session-manager.ts";

import { createModelRegistry } from "./model-runtime-test-utils.ts";

describe("Input Event", () => {
	// 当前用例所有临时文件的根目录。
	let tempDir: string;
	// 动态扩展源码写入目录。
	let extensionsDir: string;

	// 功能：创建空扩展目录并清理全局变量；参数：无；返回：无。示例：每个用例前自动调用。
	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-input-test-"));
		extensionsDir = path.join(tempDir, "extensions");
		fs.mkdirSync(extensionsDir);
		// Clean globalThis test vars
		// 中文说明：删除动态扩展用来记录输入元数据的全局测试变量。
		delete (globalThis as any).testVar;
	});

	// 功能：递归删除临时目录；参数：无；返回：无。示例：每个用例后自动调用。
	afterEach(() => fs.rmSync(tempDir, { recursive: true, force: true }));

	/** 功能：写入并加载任意数量的扩展源码；参数 extensions；返回：ExtensionRunner。示例：await createRunner(source1, source2)。 */
	async function createRunner(...extensions: string[]) {
		// Clear and recreate extensions dir for clean state
		// 中文说明：每次创建运行器前重建目录，避免上一组动态模块残留。
		fs.rmSync(extensionsDir, { recursive: true, force: true });
		fs.mkdirSync(extensionsDir);
		// i 是扩展源码索引，范围为 0 到 extensions.length-1，用于生成稳定文件名。
		for (let i = 0; i < extensions.length; i++) fs.writeFileSync(path.join(extensionsDir, `e${i}.ts`), extensions[i]);
		// 动态发现和加载结果，包含扩展实例与共享运行时。
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);
		// 扩展运行器使用的内存会话管理器。
		const sm = SessionManager.inMemory();
		// 使用临时鉴权文件构建的模型注册表。
		const mr = await createModelRegistry(AuthStorage.create(path.join(tempDir, "auth.json")));
		return new ExtensionRunner(result.extensions, result.runtime, tempDir, sm, mr);
	}

	it("returns continue when no handlers, undefined return, or explicit continue", async () => {
		// No handlers
		// 中文说明：没有 input 处理器时默认继续原输入。
		expect((await (await createRunner()).emitInput("x", undefined, "interactive")).action).toBe("continue");
		// Returns undefined
		// 中文说明：处理器未返回值时同样解释为 continue。
		// 第一种动态运行器，处理器隐式返回 undefined。
		let r = await createRunner(`export default p => p.on("input", async () => {});`);
		expect((await r.emitInput("x", undefined, "interactive")).action).toBe("continue");
		// Returns explicit continue
		// 中文说明：显式返回 continue 的行为与默认路径一致。
		r = await createRunner(`export default p => p.on("input", async () => ({ action: "continue" }));`);
		expect((await r.emitInput("x", undefined, "interactive")).action).toBe("continue");
	});

	it("transforms text and preserves images when omitted", async () => {
		// 只转换文本、不返回 images 的扩展运行器。
		const r = await createRunner(
			`export default p => p.on("input", async e => ({ action: "transform", text: "T:" + e.text }));`,
		);
		// 原始单张 PNG 图片数组。
		const imgs = [{ type: "image" as const, data: "orig", mimeType: "image/png" }];
		// input 事件转换结果；未返回图片时应复用 imgs。
		const result = await r.emitInput("hi", imgs, "interactive");
		expect(result).toEqual({ action: "transform", text: "T:hi", images: imgs });
	});

	it("transforms and replaces images when provided", async () => {
		// 同时返回新文本和新 JPEG 图片的扩展运行器。
		const r = await createRunner(
			`export default p => p.on("input", async () => ({ action: "transform", text: "X", images: [{ type: "image", data: "new", mimeType: "image/jpeg" }] }));`,
		);
		// input 事件转换结果，应包含处理器给出的替换图片。
		const result = await r.emitInput("hi", [{ type: "image", data: "orig", mimeType: "image/png" }], "interactive");
		expect(result).toEqual({
			action: "transform",
			text: "X",
			images: [{ type: "image", data: "new", mimeType: "image/jpeg" }],
		});
	});

	it("chains transforms across multiple handlers", async () => {
		// 依次追加 [1] 与 [2] 的两个处理器运行器。
		const r = await createRunner(
			`export default p => p.on("input", async e => ({ action: "transform", text: e.text + "[1]" }));`,
			`export default p => p.on("input", async e => ({ action: "transform", text: e.text + "[2]" }));`,
		);
		// 两次转换串联后的最终结果。
		const result = await r.emitInput("X", undefined, "interactive");
		expect(result).toEqual({ action: "transform", text: "X[1][2]", images: undefined });
	});

	it("short-circuits on handled and skips subsequent handlers", async () => {
		(globalThis as any).testVar = false;
		// 首个处理器 handled、第二个处理器会修改全局变量的运行器。
		const r = await createRunner(
			`export default p => p.on("input", async () => ({ action: "handled" }));`,
			`export default p => p.on("input", async () => { globalThis.testVar = true; });`,
		);
		expect(await r.emitInput("X", undefined, "interactive")).toEqual({ action: "handled" });
		expect((globalThis as any).testVar).toBe(false);
	});

	it("passes source correctly for all source types", async () => {
		// 把 e.source 写入全局变量的扩展运行器。
		const r = await createRunner(
			`export default p => p.on("input", async e => { globalThis.testVar = e.source; return { action: "continue" }; });`,
		);
		for (const source of ["interactive", "rpc", "extension"] as const) {
			// source 是当前输入来源枚举，循环覆盖三种合法值。
			await r.emitInput("x", undefined, source);
			expect((globalThis as any).testVar).toBe(source);
		}
	});

	it("passes streamingBehavior correctly", async () => {
		// 把 e.streamingBehavior 写入全局变量的运行器。
		const r = await createRunner(
			`export default p => p.on("input", async e => { globalThis.testVar = e.streamingBehavior; return { action: "continue" }; });`,
		);
		await r.emitInput("x", undefined, "interactive", "steer");
		expect((globalThis as any).testVar).toBe("steer");
		await r.emitInput("x", undefined, "interactive", "followUp");
		expect((globalThis as any).testVar).toBe("followUp");
		await r.emitInput("x", undefined, "interactive");
		expect((globalThis as any).testVar).toBeUndefined();
	});

	it("catches handler errors and continues", async () => {
		// input 处理器始终抛出 boom 的运行器。
		const r = await createRunner(`export default p => p.on("input", async () => { throw new Error("boom"); });`);
		// 通过 onError 收集的错误消息数组。
		const errs: string[] = [];
		r.onError((e) => errs.push(e.error));
		// 抛错后的 input 结果，应恢复为 continue。
		const result = await r.emitInput("x", undefined, "interactive");
		expect(result.action).toBe("continue");
		expect(errs).toContain("boom");
	});

	it("hasHandlers returns correct value", async () => {
		// 起初没有任何扩展处理器的运行器。
		let r = await createRunner();
		expect(r.hasHandlers("input")).toBe(false);
		r = await createRunner(`export default p => p.on("input", async () => {});`);
		expect(r.hasHandlers("input")).toBe(true);
	});
});
