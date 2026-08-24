/**
 * 文件职责：验证文件模型存储按提供方持久化、重载和删除时不会影响其他提供方。
 * 技术维度：使用 Vitest、临时 JSON 文件、Model 夹具和 FileModelsStore。
 * 产品维度：保证远端模型目录缓存可独立更新，避免一个提供方覆盖全部缓存。
 * 逻辑维度：创建两份目录并写入，重新加载后检查，再删除 one 并确认 two 保留。
 * 关键边界：测试会递归删除自身临时目录；模型元数据仅为最小固定夹具。
 * 新手阅读建议：先看 model 工厂，再按 write、reload/read、delete 的顺序阅读。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Model } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { FileModelsStore } from "../src/core/models-store.ts";

/** 本文件创建的临时目录清单。 */
const tempDirs: string[] = [];

/** 删除所有存在的测试临时目录。 */
afterEach(() => {
	// path 仅来自下方测试创建并登记的系统临时目录。
	for (const path of tempDirs.splice(0)) {
		if (existsSync(path)) rmSync(path, { recursive: true });
	}
});

/** @param provider 提供方 ID。@param id 模型 ID。@returns 最小 OpenAI Completions 模型夹具。 */
function model(provider: string, id: string): Model<"openai-completions"> {
	return {
		id,
		name: id,
		api: "openai-completions",
		provider,
		baseUrl: "https://example.test/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000,
		maxTokens: 100,
	};
}

/** FileModelsStore 持久化隔离测试组。 */
describe("FileModelsStore", () => {
	/** 验证两个提供方可共存，删除 one 后 two 仍可读取。 */
	it("persists provider catalogs without replacing unrelated providers", async () => {
		/** 本例唯一临时目录路径。 */
		const dir = join(tmpdir(), `pi-models-store-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		tempDirs.push(dir);
		mkdirSync(dir, { recursive: true });
		/** 模型存储 JSON 路径。 */
		const path = join(dir, "models-store.json");
		/** 首次写入使用的文件存储实例。 */
		const store = new FileModelsStore(path);

		await store.write("one", { models: [model("one", "m1")], checkedAt: 100 });
		await store.write("two", { models: [model("two", "m2")], checkedAt: 200 });

		/** 模拟进程重启后从同一文件重载的实例。 */
		const reloaded = new FileModelsStore(path);
		// entry 是当前提供方缓存中的模型，只提取 ID 断言。
		expect((await reloaded.read("one"))?.models.map((entry) => entry.id)).toEqual(["m1"]);
		expect((await reloaded.read("one"))?.checkedAt).toBe(100);
		expect((await reloaded.read("two"))?.models.map((entry) => entry.id)).toEqual(["m2"]);

		await reloaded.delete("one");
		expect(await reloaded.read("one")).toBeUndefined();
		expect((await reloaded.read("two"))?.models.map((entry) => entry.id)).toEqual(["m2"]);
	});
});
