/**
 * 文件职责：验证 Agent 测试工具链能通过执行环境加载技能文件、符号链接、来源信息和诊断信息。
 * 技术维度：使用 Vitest、NodeExecutionEnv、临时目录与真实符号链接，读取 YAML 前置元数据的 Markdown。
 * 产品维度：保证代理在不同目录布局下稳定发现技能，并向用户准确报告无效技能的来源。
 * 逻辑维度：依次覆盖普通技能、符号链接目录、带来源技能、错误诊断和根目录直属 Markdown。
 * 关键边界：符号链接测试需要操作系统权限；根目录扫描不应递归加载嵌套的直接 Markdown 文件。
 * 新手阅读建议：先比较 loadSkills 与 loadSourcedSkills 的返回形状，再看诊断和扫描边界用例。
 */
import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import { loadSkills, loadSourcedSkills } from "../../src/harness/skills.ts";
import { createTempDir } from "./session-test-utils.ts";

describe("loadSkills", () => {
	it("loads SKILL.md files through the execution environment", async () => {
		// 当前用例的独占临时根目录。
		const root = createTempDir();
		// 绑定 root 的 Node 执行环境，所有相对路径都从该目录解析。
		const env = new NodeExecutionEnv({ cwd: root });
		await env.createDir(".agents/skills/example", { recursive: true });
		await env.writeFile(
			".agents/skills/example/SKILL.md",
			`---
name: example
description: Example skill
disable-model-invocation: true
---
Use this skill.
`,
		);

		// 技能加载结果与非致命诊断；合法文件应得到一项技能且无诊断。
		const { skills, diagnostics } = await loadSkills(env, ".agents/skills");

		expect(diagnostics).toEqual([]);
		expect(skills).toEqual([
			{
				name: "example",
				description: "Example skill",
				content: "Use this skill.",
				filePath: join(root, ".agents/skills/example/SKILL.md"),
				disableModelInvocation: true,
			},
		]);
	});

	it("loads skills through symlinked directories", async () => {
		// 符号链接场景的临时根目录。
		const root = createTempDir();
		// 用于创建和读取真实目录树的执行环境。
		const env = new NodeExecutionEnv({ cwd: root });
		await env.createDir("actual/example", { recursive: true });
		await env.writeFile(
			"actual/example/SKILL.md",
			"---\nname: example\ndescription: Example skill\n---\nUse this skill.",
		);
		await symlink(join(root, "actual"), join(root, "skills-link"));

		// 从符号链接入口发现的技能集合。
		const { skills } = await loadSkills(env, "skills-link");

		expect(skills.map((skill) => skill.name)).toEqual(["example"]);
		expect(skills[0]?.filePath).toBe(join(root, "skills-link/example/SKILL.md"));
	});

	it("preserves source info for sourced skills", async () => {
		// 带来源加载场景的临时根目录。
		const root = createTempDir();
		// 绑定临时目录的 Node 执行环境。
		const env = new NodeExecutionEnv({ cwd: root });
		await env.createDir("user/example", { recursive: true });
		await env.writeFile(
			"user/example/SKILL.md",
			"---\nname: example\ndescription: Example skill\n---\nUse this skill.",
		);

		// 带来源包装的技能与诊断；source 应保留 user 类型。
		const { skills, diagnostics } = await loadSourcedSkills(env, [
			{ path: "user", source: { type: "user" as const } },
		]);

		expect(diagnostics).toEqual([]);
		expect(skills).toEqual([
			{
				skill: {
					name: "example",
					description: "Example skill",
					content: "Use this skill.",
					filePath: join(root, "user/example/SKILL.md"),
					disableModelInvocation: false,
				},
				source: { type: "user" },
			},
		]);
	});

	it("attaches source info to diagnostics", async () => {
		// 无效技能诊断场景的临时根目录。
		const root = createTempDir();
		// 负责写入缺少 description 文件并加载它的执行环境。
		const env = new NodeExecutionEnv({ cwd: root });
		await env.createDir("user/broken", { recursive: true });
		await env.writeFile("user/broken/SKILL.md", "---\nname: broken\n---\nMissing description.");

		// 无效技能的空结果与警告诊断；诊断必须携带 user 来源。
		const { skills, diagnostics } = await loadSourcedSkills(env, [
			{ path: "user", source: { type: "user" as const } },
		]);

		expect(skills).toEqual([]);
		expect(diagnostics).toEqual([
			{
				type: "warning",
				code: "invalid_metadata",
				message: "description is required",
				path: join(root, "user/broken/SKILL.md"),
				source: { type: "user" },
			},
		]);
	});

	it("loads direct markdown children only from the root directory", async () => {
		// 根目录直属 Markdown 扫描场景的临时目录。
		const root = createTempDir();
		// 用于创建根文件和嵌套文件的执行环境。
		const env = new NodeExecutionEnv({ cwd: root });
		await env.createDir("skills/nested", { recursive: true });
		await env.writeFile("skills/root.md", "---\ndescription: Root skill\n---\nRoot content");
		await env.writeFile("skills/nested/ignored.md", "---\ndescription: Ignored\n---\nIgnored content");

		// 从 skills 根目录加载的技能；嵌套 ignored.md 不应出现。
		const { skills } = await loadSkills(env, "skills");

		expect(skills.map((skill) => skill.name)).toEqual(["skills"]);
		expect(skills[0]?.content).toBe("Root content");
	});
});
