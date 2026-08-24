/**
 * 文件职责：验证 SDK 创建会话时对技能资源的默认发现、禁用结果与自定义注入行为。
 * 技术维度：使用 Vitest、临时 SKILL.md 文件、内存会话管理器和 ResourceLoader 测试替身。
 * 产品维度：确保嵌入方能可靠读取默认技能，也能通过自定义资源加载器完全控制技能列表。
 * 逻辑维度：先创建磁盘技能夹具，再分别测试默认发现、空加载器和提供自定义技能三种场景。
 * 关键边界：所有文件均写入临时目录；自定义加载器必须实现会话要求的完整接口形状。
 * 新手阅读建议：先看三条 it 的预期差异，再对照两个 resourceLoader 对象理解依赖注入。
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createExtensionRuntime } from "../src/core/extensions/loader.ts";
import type { ResourceLoader } from "../src/core/resource-loader.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { createSyntheticSourceInfo } from "../src/core/source-info.ts";

describe("createAgentSession skills option", () => {
	// 当前用例的临时代理目录；测试结束后递归删除。
	let tempDir: string;
	// 测试技能所在目录，固定为 tempDir/skills/test-skill。
	let skillsDir: string;

	// 功能：写入最小 SKILL.md 测试夹具；参数：无；返回：无。示例：Vitest 每个用例前自动调用。
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-sdk-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		skillsDir = join(tempDir, "skills", "test-skill");
		mkdirSync(skillsDir, { recursive: true });

		// Create a test skill in the pi skills directory
		// 中文说明：在 pi 约定的 skills 目录中创建一个包含前置元数据的测试技能。
		writeFileSync(
			join(skillsDir, "SKILL.md"),
			`---
name: test-skill
description: A test skill for SDK tests.
---

# Test Skill

This is a test skill.
`,
		);
	});

	// 功能：删除技能夹具及临时目录；参数：无；返回：无。示例：Vitest 每个用例后自动调用。
	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("should discover skills by default and expose them on session.skills", async () => {
		// 默认资源加载器创建的会话；应自动扫描临时 agentDir 下的技能。
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.inMemory(),
		});

		// Skills should be discovered and exposed on the session
		// 中文说明：发现结果应通过 session.resourceLoader 暴露，并包含 test-skill。
		expect(session.resourceLoader.getSkills().skills.length).toBeGreaterThan(0);
		expect(session.resourceLoader.getSkills().skills.some((s) => s.name === "test-skill")).toBe(true);
	});

	it("should have empty skills when resource loader returns none (--no-skills)", async () => {
		// 模拟 --no-skills 的最小资源加载器；所有资源集合均为空且 reload 无副作用。
		const resourceLoader: ResourceLoader = {
			getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
			getSkills: () => ({ skills: [], diagnostics: [] }),
			getPrompts: () => ({ prompts: [], diagnostics: [] }),
			getThemes: () => ({ themes: [], diagnostics: [] }),
			getAgentsFiles: () => ({ agentsFiles: [] }),
			getSystemPrompt: () => undefined,
			getAppendSystemPrompt: () => [],
			extendResources: () => {},
			reload: async () => {},
		};

		// 使用空资源加载器创建的会话；技能和诊断都应为空。
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.inMemory(),
			resourceLoader,
		});

		expect(session.resourceLoader.getSkills().skills).toEqual([]);
		expect(session.resourceLoader.getSkills().diagnostics).toEqual([]);
	});

	it("should use provided skills when resource loader supplies them", async () => {
		// 由嵌入方直接提供的技能描述；路径仅用于测试，不会读取真实文件。
		const customSkill = {
			name: "custom-skill",
			description: "A custom skill",
			filePath: "/fake/path/SKILL.md",
			baseDir: "/fake/path",
			sourceInfo: createSyntheticSourceInfo("/fake/path/SKILL.md", { source: "sdk" }),
			disableModelInvocation: false,
		};

		// 返回 customSkill 的资源加载器替身；其余资源保持为空。
		const resourceLoader: ResourceLoader = {
			getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
			getSkills: () => ({ skills: [customSkill], diagnostics: [] }),
			getPrompts: () => ({ prompts: [], diagnostics: [] }),
			getThemes: () => ({ themes: [], diagnostics: [] }),
			getAgentsFiles: () => ({ agentsFiles: [] }),
			getSystemPrompt: () => undefined,
			getAppendSystemPrompt: () => [],
			extendResources: () => {},
			reload: async () => {},
		};

		// 使用自定义资源加载器创建的会话；返回列表应保持对象身份和内容。
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.inMemory(),
			resourceLoader,
		});

		expect(session.resourceLoader.getSkills().skills).toEqual([customSkill]);
		expect(session.resourceLoader.getSkills().diagnostics).toEqual([]);
	});
});
