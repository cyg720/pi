/**
 * 文件职责：验证内联扩展工厂的自动编号、显式名称、隐藏状态和混合排序。
 * 技术维度：使用 Vitest、临时资源目录和 DefaultResourceLoader 加载内联扩展。
 * 产品维度：让诊断和扩展列表用稳定可读的名称展示代码注入的扩展。
 * 逻辑维度：创建隔离目录，分别加载裸工厂、命名包装、隐藏工厂和混合列表。
 * 关键边界：资源加载关闭技能、模板和主题；所有临时根目录在每例后删除。
 * 新手阅读建议：先看 fixture 和 noop，再比较四例期望的 `<inline:...>` 路径。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultResourceLoader } from "../../../src/core/resource-loader.ts";
import type { ExtensionAPI } from "../../../src/index.ts";

// noop 是不注册任何能力的内联扩展工厂。
const noop: (pi: ExtensionAPI) => void = () => {};

describe("inline extension naming", () => {
	// roots 记录测试创建的临时根目录。
	const roots: string[] = [];

	/** 创建带 project 和 agent 子目录的夹具；name 为标识，返回三个路径。 */
	function fixture(name: string) {
		// root 是当前夹具唯一的临时根目录。
		const root = join(tmpdir(), `pi-inline-naming-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		// cwd 和 agentDir 分别是项目与代理目录。
		const cwd = join(root, "project");
		// agentDir 是当前夹具隔离出的代理级资源目录。
		const agentDir = join(root, "agent");
		mkdirSync(cwd, { recursive: true });
		mkdirSync(agentDir, { recursive: true });
		roots.push(root);
		return { root, cwd, agentDir };
	}

	// 每例前清空根目录记录；无参数，无返回值。
	beforeEach(() => {
		roots.length = 0;
	});

	// 每例后删除全部临时目录；无参数，无返回值。
	afterEach(() => {
		while (roots.length > 0) {
			// root 是当前待清理的可选路径。
			const root = roots.pop();
			if (root && existsSync(root)) {
				rmSync(root, { recursive: true, force: true });
			}
		}
	});

	// 验证裸工厂按数组位置编号；无参数，无返回值。
	it("displays bare factories as <inline:N>", async () => {
		// cwd 和 agentDir 是本例隔离资源路径。
		const { cwd, agentDir } = fixture("bare");
		// loader 加载两个相同的裸工厂。
		const loader = new DefaultResourceLoader({
			cwd,
			agentDir,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			extensionFactories: [noop, noop],
		});

		await loader.reload();

		// result 是加载后的扩展与诊断结果。
		const result = loader.getExtensions();

		expect(result.extensions).toHaveLength(2);
		expect(result.extensions[0].path).toBe("<inline:1>");
		expect(result.extensions[1].path).toBe("<inline:2>");
	});

	// 验证命名包装使用显式名称；无参数，无返回值。
	it("displays named wrappers as <inline:name>", async () => {
		// cwd 和 agentDir 是本例隔离资源路径。
		const { cwd, agentDir } = fixture("named");
		// loader 加载两个带不同名称的包装工厂。
		const loader = new DefaultResourceLoader({
			cwd,
			agentDir,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			extensionFactories: [
				{ name: "my-provider", factory: noop },
				{ name: "my-commands", factory: noop },
			],
		});

		await loader.reload();

		// result 是加载后的命名扩展列表。
		const result = loader.getExtensions();

		expect(result.extensions).toHaveLength(2);
		expect(result.extensions[0].path).toBe("<inline:my-provider>");
		expect(result.extensions[1].path).toBe("<inline:my-commands>");
	});

	// 验证命名工厂的 hidden 标记得到保留；无参数，无返回值。
	it("preserves hidden state for named factories", async () => {
		// cwd 和 agentDir 是本例隔离资源路径。
		const { cwd, agentDir } = fixture("hidden");
		// loader 加载一个隐藏的 built-in 工厂。
		const loader = new DefaultResourceLoader({
			cwd,
			agentDir,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			extensionFactories: [{ name: "built-in", factory: noop, hidden: true }],
		});

		await loader.reload();

		// result 是含隐藏状态的扩展列表。
		const result = loader.getExtensions();

		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toBe("<inline:built-in>");
		expect(result.extensions[0].hidden).toBe(true);
	});

	// 验证裸工厂和命名工厂混排时位置编号不压缩；无参数，无返回值。
	it("supports mixed bare and named factories", async () => {
		// cwd 和 agentDir 是本例隔离资源路径。
		const { cwd, agentDir } = fixture("mixed");
		// loader 按裸、命名、裸顺序加载三个工厂。
		const loader = new DefaultResourceLoader({
			cwd,
			agentDir,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			extensionFactories: [noop, { name: "named-ext", factory: noop }, noop],
		});

		await loader.reload();

		// result 是保持原数组顺序的扩展列表。
		const result = loader.getExtensions();

		expect(result.extensions).toHaveLength(3);
		expect(result.extensions[0].path).toBe("<inline:1>");
		expect(result.extensions[1].path).toBe("<inline:named-ext>");
		expect(result.extensions[2].path).toBe("<inline:3>");
	});
});
