/**
 * 文件职责：验证剪贴板文本读取和复制在原生实现、系统命令及 OSC 52 终端协议之间的回退顺序。
 * 技术维度：使用 Vitest 模块桩、环境变量桩、stdout 拦截和异步模拟覆盖 macOS 与远程终端行为。
 * 产品维度：保障本地、SSH 和 Mosh 用户都能复制文本，并避免向终端发送过大的剪贴板载荷。
 * 逻辑维度：统一重置剪贴板与平台模拟状态，然后分别测试读取、原生写入、Shell 回退和 OSC 52 回退。
 * 关键边界：测试不会访问真实系统剪贴板；OSC 52 只捕获特定转义序列，超长内容必须明确失败。
 * 新手阅读建议：先理解 mocks 和 stdout 拦截，再按 copyToClipboard 的三层回退顺序阅读用例。
 */
import { execSync, spawn } from "child_process";
import { platform } from "os";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { copyToClipboard, readClipboardText } from "../src/utils/clipboard.ts";

// mocks 在模块加载前提升，集中保存原生剪贴板、进程和平台相关的模拟函数。
const mocks = vi.hoisted(() => {
	return {
		clipboard: {
			getText: vi.fn<() => Promise<string>>(),
			setText: vi.fn<(text: string) => Promise<void>>(),
		},
		execSync: vi.fn(),
		spawn: vi.fn(),
		platform: vi.fn<() => NodeJS.Platform>(),
		isWaylandSession: vi.fn<() => boolean>(),
	};
});

// 把原生剪贴板模块替换为可控制的异步读写实现。
vi.mock("../src/utils/clipboard-native.js", () => {
	return {
		clipboard: mocks.clipboard,
	};
});

// 拦截系统命令调用，避免测试真正启动 pbcopy 等外部程序。
vi.mock("child_process", () => {
	return {
		execSync: mocks.execSync,
		spawn: mocks.spawn,
	};
});

// 模拟 os.platform，使测试结果不依赖实际运行平台。
vi.mock("os", () => {
	return {
		platform: mocks.platform,
	};
});

// 固定 Wayland 会话检测结果，当前用例聚焦文本剪贴板回退。
vi.mock("../src/utils/clipboard-image.js", () => {
	return {
		isWaylandSession: mocks.isWaylandSession,
	};
});

// mockedExecSync 是带 Vitest 类型信息的同步命令模拟函数。
const mockedExecSync = vi.mocked(execSync);
// mockedSpawn 是带类型信息的子进程启动模拟函数。
const mockedSpawn = vi.mocked(spawn);
// mockedPlatform 控制被测代码看到的操作系统平台。
const mockedPlatform = vi.mocked(platform);

// originalWrite 保存 stdout 原始写函数，便于用例结束后恢复。
let originalWrite: typeof process.stdout.write;
// stdoutWrites 收集被测代码输出的 OSC 52 剪贴板转义序列。
let stdoutWrites: string[];
// nativeResolved 标记原生异步写入是否已完成，用于验证调用先后顺序。
let nativeResolved = false;

/**
 * 从已捕获 stdout 输出中筛选 OSC 52 剪贴板写入序列。
 * @returns 以 ESC ]52;c; 开头的字符串数组；例如 `osc52Writes().length` 可检查回退次数。
 */
function osc52Writes(): string[] {
	return stdoutWrites.filter((write) => write.startsWith("\x1b]52;c;"));
}

// 每个用例前重置环境、模拟函数和 stdout 捕获器。
beforeEach(() => {
	vi.unstubAllEnvs();
	vi.stubEnv("SSH_CONNECTION", "");
	vi.stubEnv("SSH_CLIENT", "");
	vi.stubEnv("MOSH_CONNECTION", "");
	stdoutWrites = [];
	// nativeResolved 在每个用例开始时重置，防止沿用前一次异步状态。
	nativeResolved = false;
	mocks.clipboard.getText.mockReset();
	mocks.clipboard.setText.mockReset();
	mocks.execSync.mockReset();
	mocks.spawn.mockReset();
	mocks.platform.mockReset();
	mocks.isWaylandSession.mockReset();
	mockedPlatform.mockReturnValue("darwin");
	mocks.isWaylandSession.mockReturnValue(false);
	mocks.clipboard.getText.mockResolvedValue("");
	mocks.clipboard.setText.mockImplementation(async () => {
		await new Promise((resolve) => setTimeout(resolve, 1));
		nativeResolved = true;
	});
	// originalWrite 绑定真实 stdout，非 OSC 52 输出仍按原方式写出。
	originalWrite = process.stdout.write.bind(process.stdout);
	process.stdout.write = ((...args: Parameters<typeof process.stdout.write>) => {
		// chunk 是本次 stdout 写入的首个数据参数。
		const [chunk] = args;
		if (typeof chunk === "string" && chunk.startsWith("\x1b]52;c;")) {
			stdoutWrites.push(chunk);
			return true;
		}
		return originalWrite(...args);
	}) as typeof process.stdout.write;
});

// 用例结束后恢复 stdout 和环境变量，避免影响其他测试文件。
afterEach(() => {
	process.stdout.write = originalWrite;
	vi.unstubAllEnvs();
});

// 验证剪贴板文本读取对成功、空值和底层异常的统一返回语义。
describe("readClipboardText", () => {
	// 原生接口返回文本时应原样交给调用者。
	test("returns native clipboard text", async () => {
		mocks.clipboard.getText.mockResolvedValue("clipboard text");

		await expect(readClipboardText()).resolves.toBe("clipboard text");
	});

	// 空文本或不可用剪贴板都应安全归一化为 null。
	test("returns null for empty or unavailable clipboard text", async () => {
		await expect(readClipboardText()).resolves.toBeNull();

		mocks.clipboard.getText.mockRejectedValue(new Error("clipboard unavailable"));
		await expect(readClipboardText()).resolves.toBeNull();
	});
});

// 验证复制文本时原生、Shell 和 OSC 52 三种通道的选择逻辑。
describe("copyToClipboard", () => {
	// 本地原生写入成功后无需执行任何回退通道。
	test("local native success skips OSC 52 and shell fallbacks", async () => {
		await copyToClipboard("hello");

		expect(mocks.clipboard.setText).toHaveBeenCalledWith("hello");
		expect(osc52Writes()).toHaveLength(0);
		expect(mockedExecSync).not.toHaveBeenCalled();
		expect(mockedSpawn).not.toHaveBeenCalled();
	});

	// 远程会话先等待原生写入完成，再额外输出 OSC 52 供客户端剪贴板使用。
	test("remote native success emits OSC 52 after native write", async () => {
		vi.stubEnv("SSH_CONNECTION", "client server");
		mocks.clipboard.setText.mockImplementation(async () => {
			await new Promise((resolve) => setTimeout(resolve, 1));
			expect(osc52Writes()).toHaveLength(0);
			nativeResolved = true;
		});

		await copyToClipboard("hello");

		expect(nativeResolved).toBe(true);
		expect(osc52Writes()).toHaveLength(1);
		expect(mockedExecSync).not.toHaveBeenCalled();
	});

	// 本地原生失败但系统复制命令成功时，不应再污染终端输出。
	test("local shell fallback success skips OSC 52", async () => {
		mocks.clipboard.setText.mockRejectedValue(new Error("native failed"));
		mockedExecSync.mockReturnValue(Buffer.alloc(0));

		await copyToClipboard("hello");

		expect(mockedExecSync).toHaveBeenCalledWith("pbcopy", {
			input: "hello",
			stdio: ["pipe", "ignore", "ignore"],
			timeout: 5000,
		});
		expect(osc52Writes()).toHaveLength(0);
	});

	// 原生和系统命令都失败时，使用 OSC 52 作为最后回退。
	test("uses OSC 52 fallback when native and shell tools fail", async () => {
		mocks.clipboard.setText.mockRejectedValue(new Error("native failed"));
		mockedExecSync.mockImplementation(() => {
			throw new Error("pbcopy failed");
		});

		await copyToClipboard("hello");

		expect(osc52Writes()).toHaveLength(1);
	});

	// 超过终端安全上限的内容不得通过 OSC 52 输出。
	test("does not emit oversized OSC 52 payloads", async () => {
		mocks.clipboard.setText.mockRejectedValue(new Error("native failed"));
		mockedExecSync.mockImplementation(() => {
			throw new Error("pbcopy failed");
		});

		await expect(copyToClipboard("x".repeat(80_000))).rejects.toThrow("Failed to copy to clipboard");
		expect(osc52Writes()).toHaveLength(0);
	});
});
