/**
 * 文件职责：验证 Bun 沙箱环境变量丢失时的恢复逻辑及其两个安全跳过条件。
 * 技术维度：使用 Vitest 模块模拟、process 属性替换和 `/proc/self/environ` 内容夹具。
 * 产品维度：确保 Bun 沙箱内的 CLI 能恢复认证配置，同时不干扰 Node 或已有环境变量的进程。
 * 逻辑维度：模拟文件读取，分别构造非 Bun、有环境的 Bun 和空环境 Bun 三种运行状态。
 * 关键边界：测试会临时替换 process.versions 并清空 process.env，必须在用例末尾完整恢复。
 * 新手阅读建议：先看 readFileSync 模拟和被测模块加载，再比较三个用例何时提前返回或执行恢复。
 */
import { describe, expect, it, vi } from "vitest";

// 模拟同步读取 `/proc/self/environ` 的函数，避免访问真实进程文件。
const readFileSync = vi.fn();

vi.mock("node:fs", () => ({
	readFileSync,
}));

// restoreSandboxEnv 是在文件系统模拟生效后加载的被测恢复函数。
const { restoreSandboxEnv } = await import("../src/bun/restore-sandbox-env.ts");

describe("restoreSandboxEnv", () => {
	// 验证普通 Node 进程不会读取或修改环境变量；无参数，无返回值。
	it("does nothing when not running under bun", () => {
		// originalVersions 保存 process.versions 的原始属性描述符，便于恢复。
		const originalVersions = Object.getOwnPropertyDescriptor(process, "versions");
		Object.defineProperty(process, "versions", {
			value: { node: "20.0.0" },
		});
		// envBefore 是调用前的完整环境变量快照。
		const envBefore = { ...process.env };

		restoreSandboxEnv();

		expect(process.env).toEqual(envBefore);

		if (originalVersions) {
			Object.defineProperty(process, "versions", originalVersions);
		}
	});

	// 验证 Bun 进程已有环境变量时不会执行恢复；无参数，无返回值。
	it("does nothing when process.env already has entries", () => {
		// originalVersions 保存 process.versions 的原始属性描述符，便于恢复。
		const originalVersions = Object.getOwnPropertyDescriptor(process, "versions");
		Object.defineProperty(process, "versions", {
			value: { bun: "1.2.0", node: "20.0.0" },
		});
		process.env.RESTORE_SANDBOX_ENV_TEST = "1";
		// envBefore 是加入测试标记后的环境变量快照。
		const envBefore = { ...process.env };

		restoreSandboxEnv();

		expect(process.env).toEqual(envBefore);
		delete process.env.RESTORE_SANDBOX_ENV_TEST;

		if (originalVersions) {
			Object.defineProperty(process, "versions", originalVersions);
		}
	});

	// 验证空环境 Bun 进程会从 `/proc/self/environ` 恢复键值；无参数，无返回值。
	it("restores environment from /proc/self/environ when bun env is empty", () => {
		// originalVersions 保存 process.versions 的原始属性描述符，便于恢复。
		const originalVersions = Object.getOwnPropertyDescriptor(process, "versions");
		Object.defineProperty(process, "versions", {
			value: { bun: "1.2.0", node: "20.0.0" },
		});

		// Clear env to simulate the bun sandbox bug.
		// 清空环境变量以模拟 Bun 沙箱缺陷。
		// envBackup 保存清空前的完整环境，测试结束时用于恢复。
		const envBackup = { ...process.env };
		// key 是当前待删除的环境变量名称。
		for (const key of Object.keys(process.env)) {
			delete process.env[key];
		}

		readFileSync.mockReturnValue("FOO=bar\0BAZ=qux\0");

		restoreSandboxEnv();

		expect(readFileSync).toHaveBeenCalledWith("/proc/self/environ", "utf-8");
		expect(process.env.FOO).toBe("bar");
		expect(process.env.BAZ).toBe("qux");

		// Restore.
		// 恢复测试开始前的环境变量。
		// key 是恢复前需要删除的测试环境变量名称。
		for (const key of Object.keys(process.env)) {
			delete process.env[key];
		}
		Object.assign(process.env, envBackup);

		if (originalVersions) {
			Object.defineProperty(process, "versions", originalVersions);
		}
		readFileSync.mockReset();
	});
});
