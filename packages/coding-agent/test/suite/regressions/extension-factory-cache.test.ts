/**
 * 文件职责：验证扩展模块缓存只缓存模块加载、不缓存工厂结果，并按工作目录隔离且可在重载时清除。
 * 技术维度：使用 Vitest、动态 TypeScript 扩展文件、globalThis 计数状态和默认资源加载器。
 * 产品维度：减少重复扩展模块加载开销，同时确保每个会话获得独立运行时并能感知文件重载。
 * 逻辑维度：写入计数扩展，分别测试同目录缓存、直接加载、资源重载和跨 cwd 隔离。
 * 关键边界：全局计数与扩展缓存必须在用例前后重置；所有临时目录都需可靠清理。
 * 新手阅读建议：先理解 moduleLoads 与 factoryRuns 的区别，再按四个用例比较期望计数。
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearExtensionCache, loadExtensions, loadExtensionsCached } from "../../../src/core/extensions/loader.ts";
import { DefaultResourceLoader } from "../../../src/core/resource-loader.ts";

// 动态扩展写入 globalThis 的可选计数状态。
interface TestState {
	moduleLoads?: number;
	factoryRuns?: number;
}

/** 功能：取得或初始化全局计数对象；参数：无；返回：稳定 TestState 引用。示例：state().moduleLoads。 */
function state(): TestState {
	// 扩展测试专用的全局对象类型视图。
	const global = globalThis as typeof globalThis & { __extensionFactoryCacheTest?: TestState };
	if (!global.__extensionFactoryCacheTest) {
		global.__extensionFactoryCacheTest = {};
	}
	return global.__extensionFactoryCacheTest;
}

/** 功能：删除全局扩展计数状态；参数：无；返回：无。示例：beforeEach 中调用 resetState()。 */
function resetState(): void {
	delete (globalThis as typeof globalThis & { __extensionFactoryCacheTest?: TestState }).__extensionFactoryCacheTest;
}

/** 功能：写入会分别统计模块加载与工厂运行次数的扩展；参数 filePath；返回：无。示例：writeCountingExtension(path)。 */
function writeCountingExtension(filePath: string): void {
	writeFileSync(
		filePath,
		`
const state = (globalThis.__extensionFactoryCacheTest ??= {});
state.moduleLoads = (state.moduleLoads ?? 0) + 1;

export default function () {
	state.factoryRuns = (state.factoryRuns ?? 0) + 1;
}
`,
		"utf-8",
	);
}

describe("extension factory cache", () => {
	// 本套件创建的临时根目录栈；afterEach 逐个弹出删除。
	const roots: string[] = [];

	/** 功能：创建带 project 与 agent 子目录的夹具；参数 name 用于路径标识；返回：三个目录路径。示例：fixture("reload")。 */
	function fixture(name: string) {
		// 带用例名和随机后缀的临时根目录。
		const root = join(tmpdir(), `pi-extension-cache-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		// 作为扩展缓存作用域键的项目工作目录。
		const cwd = join(root, "project");
		// 默认资源加载器扫描的代理配置目录。
		const agentDir = join(root, "agent");
		mkdirSync(cwd, { recursive: true });
		mkdirSync(agentDir, { recursive: true });
		roots.push(root);
		return { root, cwd, agentDir };
	}

	// 功能：重置全局计数和扩展缓存；参数：无；返回：无。示例：每个测试前自动调用。
	beforeEach(() => {
		resetState();
		clearExtensionCache();
	});

	// 功能：删除目录并再次清空状态；参数：无；返回：无。示例：每个测试后自动调用。
	afterEach(() => {
		while (roots.length > 0) {
			// 当前待删除的临时根目录；数组为空时为 undefined。
			const root = roots.pop();
			if (root && existsSync(root)) {
				rmSync(root, { recursive: true, force: true });
			}
		}
		resetState();
		clearExtensionCache();
	});

	it("caches extension modules for cached same-cwd loads but reruns factories", async () => {
		// 同一 cwd 缓存场景的根目录与工作目录。
		const { root, cwd } = fixture("same-cwd");
		// 动态计数扩展文件路径。
		const extensionPath = join(root, "counting.ts");
		writeCountingExtension(extensionPath);

		// 第一次缓存加载结果。
		const first = await loadExtensionsCached([extensionPath], cwd);
		// 同 cwd 的第二次缓存加载结果；模块复用但运行时重新创建。
		const second = await loadExtensionsCached([extensionPath], cwd);

		expect(state().moduleLoads).toBe(1);
		expect(state().factoryRuns).toBe(2);
		expect(first.extensions[0]).not.toBe(second.extensions[0]);
		expect(first.runtime).not.toBe(second.runtime);
	});

	it("does not cache direct loadExtensions calls", async () => {
		// 直接加载场景的根目录与工作目录。
		const { root, cwd } = fixture("direct");
		// 将被直接加载两次的扩展路径。
		const extensionPath = join(root, "counting.ts");
		writeCountingExtension(extensionPath);

		await loadExtensions([extensionPath], cwd);
		await loadExtensions([extensionPath], cwd);

		expect(state().moduleLoads).toBe(2);
		expect(state().factoryRuns).toBe(2);
	});

	it("clears the cache on resource loader reload", async () => {
		// 资源重载场景的项目和代理目录。
		const { cwd, agentDir } = fixture("reload");
		// 默认扫描的 extensions 目录。
		const extensionDir = join(agentDir, "extensions");
		mkdirSync(extensionDir, { recursive: true });
		writeCountingExtension(join(extensionDir, "counting.ts"));
		// 每次 reload 都应清除模块缓存的资源加载器。
		const loader = new DefaultResourceLoader({
			cwd,
			agentDir,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
		});

		await loader.reload();
		await loader.reload();

		expect(state().moduleLoads).toBe(2);
		expect(state().factoryRuns).toBe(2);
	});

	it("keeps the cache scoped to one cwd", async () => {
		// 跨 cwd 场景共用的临时根目录。
		const { root } = fixture("cross-cwd");
		// 第一个缓存作用域工作目录。
		const firstCwd = join(root, "first");
		// 第二个独立缓存作用域工作目录。
		const secondCwd = join(root, "second");
		mkdirSync(firstCwd, { recursive: true });
		mkdirSync(secondCwd, { recursive: true });
		// 两个 cwd 共用的扩展文件路径。
		const extensionPath = join(root, "counting.ts");
		writeCountingExtension(extensionPath);

		await loadExtensionsCached([extensionPath], firstCwd);
		await loadExtensionsCached([extensionPath], secondCwd);
		await loadExtensionsCached([extensionPath], secondCwd);

		expect(state().moduleLoads).toBe(2);
		expect(state().factoryRuns).toBe(3);
	});
});
