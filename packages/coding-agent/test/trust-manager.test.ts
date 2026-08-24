/**
 * 文件职责：验证项目信任决策的父目录继承，以及哪些项目资源需要用户授权。
 * 技术维度：使用 Vitest、临时目录、环境变量隔离和 ProjectTrustStore 文件存储。
 * 产品维度：阻止未信任项目自动加载设置或技能，同时记住用户对目录树的信任选择。
 * 逻辑维度：一例测试父子信任覆盖/清除，另一例创建不同资源并检查风险识别。
 * 关键边界：测试会临时改写 HOME 并递归删除自己的目录；必须在 finally 恢复环境。
 * 新手阅读建议：先理解父目录 true、子目录 false、子目录 null 的优先级，再看资源检测。
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasTrustRequiringProjectResources, ProjectTrustStore } from "../src/core/trust-manager.ts";

/** 项目信任存储与资源检测测试组。 */
describe("ProjectTrustStore", () => {
	/** 当前测试组的临时根目录。 */
	let tempDir: string;
	/** 隔离的代理配置目录。 */
	let agentDir: string;
	/** 隔离的项目工作目录。 */
	let cwd: string;

	/** 每例前创建所需目录。 */
	beforeEach(() => {
		tempDir = join(tmpdir(), `trust-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		cwd = join(tempDir, "project");
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(cwd, { recursive: true });
	});

	/** 每例后删除临时根目录。 */
	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	/** 验证子目录继承父决策，可覆盖并通过 null 恢复继承。 */
	it("stores decisions and inherits from parent directories", () => {
		/** 使用隔离配置目录的信任存储。 */
		const store = new ProjectTrustStore(agentDir);
		/** 将被设置为可信的父目录。 */
		const parentDir = join(tempDir, "trusted-parent");
		/** 父目录下的项目子目录。 */
		const childDir = join(parentDir, "project");
		mkdirSync(childDir, { recursive: true });

		expect(store.get(childDir)).toBeNull();
		store.set(parentDir, true);
		expect(store.get(childDir)).toBe(true);
		store.set(childDir, false);
		expect(store.get(childDir)).toBe(false);
		store.set(childDir, null);
		expect(store.get(childDir)).toBe(true);
	});

	/** 验证全局资源不触发项目信任，而项目设置或技能目录会触发。 */
	it("detects trust-requiring project resources", () => {
		/** 测试前 HOME 的原值。 */
		const originalHome = process.env.HOME;
		process.env.HOME = tempDir;
		try {
			mkdirSync(join(tempDir, ".pi", "agent"), { recursive: true });
			mkdirSync(join(tempDir, ".agents", "skills"), { recursive: true });
			expect(hasTrustRequiringProjectResources(tempDir)).toBe(false);
			expect(hasTrustRequiringProjectResources(cwd)).toBe(false);

			writeFileSync(join(tempDir, ".pi", "settings.json"), "{}");
			expect(hasTrustRequiringProjectResources(tempDir)).toBe(true);
			rmSync(join(tempDir, ".pi", "settings.json"), { force: true });

			mkdirSync(join(cwd, ".pi"), { recursive: true });
			writeFileSync(join(cwd, ".pi", "settings.json"), "{}");
			expect(hasTrustRequiringProjectResources(cwd)).toBe(true);

			rmSync(join(cwd, ".pi"), { recursive: true, force: true });
			mkdirSync(join(cwd, ".agents", "skills"), { recursive: true });
			expect(hasTrustRequiringProjectResources(cwd)).toBe(true);
		} finally {
			if (originalHome === undefined) {
				delete process.env.HOME;
			} else {
				process.env.HOME = originalHome;
			}
		}
	});
});
