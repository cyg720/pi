/**
 * 文件职责：验证提示模板从目录、显式文件和符号链接加载，以及来源诊断和参数替换。
 * 技术维度：使用 Vitest、NodeExecutionEnv、临时文件系统、Markdown 前置元数据和 symlink。
 * 产品维度：保证用户和项目模板可被稳定发现，错误能标明来源，命令参数能正确展开。
 * 逻辑维度：前四例覆盖加载与诊断，最后一例检查模板调用中的位置参数和全部参数。
 * 关键边界：目录扫描不递归；符号链接支持依赖本机文件系统权限。
 * 新手阅读建议：先看第一例目录结构，再比较 sourced 结果与诊断，最后看参数占位符。
 */
import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import {
	formatPromptTemplateInvocation,
	loadPromptTemplates,
	loadSourcedPromptTemplates,
} from "../../src/harness/prompt-templates.ts";
import { createTempDir } from "./session-test-utils.ts";

describe("loadPromptTemplates", () => {
	// 验证从多个目录非递归加载 Markdown 模板；无参数，无返回值。
	it("loads markdown templates non-recursively from one or more dirs", async () => {
		// root 是本例临时根目录，env 是对应执行环境。
		const root = createTempDir();
		const env = new NodeExecutionEnv({ cwd: root });
		await env.createDir("a/nested", { recursive: true });
		await env.createDir("b", { recursive: true });
		await env.writeFile("a/one.md", "---\ndescription: One template\n---\nHello $1");
		await env.writeFile("a/nested/ignored.md", "Ignored");
		await env.writeFile("b/two.md", "First line description\nBody");

		// promptTemplates 和 diagnostics 是加载结果与警告列表。
		const { promptTemplates, diagnostics } = await loadPromptTemplates(env, ["a", "b"]);

		expect(diagnostics).toEqual([]);
		expect(promptTemplates).toEqual([
			{ name: "one", description: "One template", content: "Hello $1" },
			{ name: "two", description: "First line description", content: "First line description\nBody" },
		]);
	});

	// 验证 sourced 加载保留项目来源信息；无参数，无返回值。
	it("preserves source info for sourced prompt templates", async () => {
		// root 和 env 构成隔离文件环境。
		const root = createTempDir();
		const env = new NodeExecutionEnv({ cwd: root });
		await env.createDir("prompts", { recursive: true });
		await env.writeFile("prompts/example.md", "---\ndescription: Example\n---\nExample body");

		// promptTemplates 和 diagnostics 是带来源包装的加载结果。
		const { promptTemplates, diagnostics } = await loadSourcedPromptTemplates(env, [
			{ path: "prompts", source: { type: "project" as const } },
		]);

		expect(diagnostics).toEqual([]);
		expect(promptTemplates).toEqual([
			{
				promptTemplate: { name: "example", description: "Example", content: "Example body" },
				source: { type: "project" },
			},
		]);
	});

	// 验证解析警告附带用户来源和绝对路径；无参数，无返回值。
	it("attaches source info to diagnostics", async () => {
		// root 和 env 构成包含坏 YAML 模板的隔离环境。
		const root = createTempDir();
		const env = new NodeExecutionEnv({ cwd: root });
		await env.writeFile("broken.md", "---\ndescription: [unterminated\n---\nBody");

		// promptTemplates 应为空，diagnostics 应含一条来源警告。
		const { promptTemplates, diagnostics } = await loadSourcedPromptTemplates(env, [
			{ path: "broken.md", source: { type: "user" as const } },
		]);

		expect(promptTemplates).toEqual([]);
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toMatchObject({
			type: "warning",
			path: join(root, "broken.md"),
			source: { type: "user" },
		});
	});

	// 验证显式 Markdown 文件和符号链接都能加载；无参数，无返回值。
	it("loads explicit markdown files and symlinked files", async () => {
		// root 和 env 构成含目标文件与链接的隔离环境。
		const root = createTempDir();
		const env = new NodeExecutionEnv({ cwd: root });
		await env.writeFile("target.md", "---\ndescription: Target\n---\nTarget body");
		await symlink(join(root, "target.md"), join(root, "link.md"));

		// promptTemplates 保存目标与链接分别命名的两个模板。
		const { promptTemplates } = await loadPromptTemplates(env, ["target.md", "link.md"]);

		expect(promptTemplates).toEqual([
			{ name: "target", description: "Target", content: "Target body" },
			{ name: "link", description: "Target", content: "Target body" },
		]);
	});
});

describe("formatPromptTemplateInvocation", () => {
	// 验证位置参数、切片参数和全部参数占位符替换；无参数，无返回值。
	it("substitutes command arguments", () => {
		// content 是同时包含三种参数语法的模板文本。
		const content = "$1 $" + "{@:2} $ARGUMENTS";
		expect(formatPromptTemplateInvocation({ name: "one", content }, ["hello world", "test"])).toBe(
			"hello world test hello world test",
		);
	});
});
