<<<<<<< HEAD
/**
 * 文件职责：验证图片剪贴板在 Wayland、WSL 和普通 Linux 会话中选择原生接口、wl-paste、xclip 或 PowerShell 的顺序。
 * 技术维度：使用 Vitest 提升模块桩、动态导入、spawnSync 结果模拟和临时图片写入执行平台分支测试。
 * 产品维度：保障不同 Linux 桌面与 WSL 用户都能粘贴图片，同时避免错误调用不适用的剪贴板后端。
 * 逻辑维度：先定义子进程成功/失败工厂，再覆盖 Wayland 首选与回退、WSL 路径传递、非 Wayland 原生与回退。
 * 关键边界：所有外部命令均被模拟；WSL Windows 路径中的单引号必须安全转义；每个用例重置模块缓存。
 * 新手阅读建议：先看 spawnOk/spawnError 的返回形状，再按五个用例比较命令调用和最终图片字节。
 */
import type { SpawnSyncReturns } from "child_process";
=======
import type { NativeClipboard } from "@earendil-works/pi-tui";
>>>>>>> main
import { writeFileSync } from "fs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { readClipboardImage } from "../src/utils/clipboard-image.ts";

<<<<<<< HEAD
// mocks 在模块导入前提升，集中控制外部命令和原生剪贴板接口。
const mocks = vi.hoisted(() => {
	return {
		spawnSync: vi.fn<(command: string, args: string[], options: unknown) => SpawnSyncReturns<Buffer>>(),
		clipboard: {
			hasImage: vi.fn<() => boolean>(),
			getImageBinary: vi.fn<() => Promise<Uint8Array | null>>(),
		},
	};
});

// 替换 child_process.spawnSync，避免启动真实系统程序。
vi.mock("child_process", () => {
	return {
		spawnSync: mocks.spawnSync,
	};
});

// 替换原生剪贴板模块，允许精确控制是否有图片及其二进制内容。
vi.mock("../src/utils/clipboard-native.js", () => {
	return {
		clipboard: mocks.clipboard,
	};
});

/** 构造退出码为 0 的同步子进程结果；参数 stdout 为标准输出；返回 SpawnSyncReturns。 */
function spawnOk(stdout: Buffer): SpawnSyncReturns<Buffer> {
	return {
		pid: 123,
		output: [Buffer.alloc(0), stdout, Buffer.alloc(0)],
		stdout,
		stderr: Buffer.alloc(0),
		status: 0,
		signal: null,
	};
}

/** 构造启动失败的同步子进程结果；参数 error 为错误对象；返回含 error 的 SpawnSyncReturns。 */
function spawnError(error: Error): SpawnSyncReturns<Buffer> {
	return {
		pid: 123,
		output: [Buffer.alloc(0), Buffer.alloc(0), Buffer.alloc(0)],
		stdout: Buffer.alloc(0),
		stderr: Buffer.alloc(0),
		status: null,
		signal: null,
		error,
	};
}
=======
const mocks = vi.hoisted(() => ({
	command: vi.fn<(command: string, args: string[], options?: unknown) => Promise<Buffer | undefined>>(),
	getImage: vi.fn<NativeClipboard["getImage"]>(),
	getNativeClipboard: vi.fn<() => NativeClipboard | undefined>(),
}));

vi.mock("../src/utils/clipboard-command.ts", () => ({ runClipboardCommand: mocks.command }));
vi.mock("@earendil-works/pi-tui", () => ({ getNativeClipboard: mocks.getNativeClipboard }));

function commandResult(stdout: Buffer, status = 0): Buffer | undefined {
	return status === 0 ? stdout : undefined;
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
>>>>>>> main

// 验证 readClipboardImage 的平台检测与后端回退策略。
describe("readClipboardImage", () => {
	// 每个用例前清除动态导入缓存影响并重置全部模拟函数。
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.command.mockResolvedValue(commandResult(Buffer.alloc(0), 1));
		mocks.getImage.mockResolvedValue(png);
		mocks.getNativeClipboard.mockReturnValue({ getText: async () => null, getImage: mocks.getImage });
	});

<<<<<<< HEAD
	// Wayland 会话应优先使用 wl-paste，绝不访问原生剪贴板模块。
	test("Wayland: uses wl-paste and never calls clipboard", async () => {
		mocks.clipboard.hasImage.mockImplementation(() => {
			throw new Error("clipboard.hasImage should not be called on Wayland");
=======
	for (const [backend, command, env] of [
		["wayland", "wl-paste", { WAYLAND_DISPLAY: "1", DISPLAY: ":0" }],
		["x11", "xclip", { DISPLAY: ":0" }],
	] as const) {
		test.each([true, false])(`${backend}: command image present=%s stops fallback`, async (present) => {
			mocks.command.mockImplementation(async (name, args) => {
				expect(name).toBe(command);
				const listing = args.includes("--list-types") || args.includes("TARGETS");
				return commandResult(listing ? Buffer.from(present ? "text/plain\nimage/png\n" : "text/plain\n") : png);
			});
			expect(await readClipboardImage({ platform: "linux", env })).toEqual(
				present ? { bytes: png, mimeType: "image/png" } : null,
			);
			expect(mocks.command).toHaveBeenCalledTimes(present ? 2 : 1);
			expect(mocks.getNativeClipboard).not.toHaveBeenCalled();
>>>>>>> main
		});
	}

<<<<<<< HEAD
		mocks.spawnSync.mockImplementation((command, args, _options) => {
			if (command === "wl-paste" && args[0] === "--list-types") {
				return spawnOk(Buffer.from("text/plain\nimage/png\n", "utf-8"));
			}
			if (command === "wl-paste" && args[0] === "--type") {
				return spawnOk(Buffer.from([1, 2, 3]));
			}
			throw new Error(`Unexpected spawnSync call: ${command} ${args.join(" ")}`);
		});

		// readClipboardImage 在桩安装后动态加载，确保拿到模拟依赖。
		const { readClipboardImage } = await import("../src/utils/clipboard-image.ts");
		// result 是从 wl-paste 读取的 PNG 图片结果。
		const result = await readClipboardImage({ platform: "linux", env: { WAYLAND_DISPLAY: "1" } });
		expect(result).not.toBeNull();
		expect(result?.mimeType).toBe("image/png");
		expect(Array.from(result?.bytes ?? [])).toEqual([1, 2, 3]);
	});

	// wl-paste 不存在时，Wayland 应改用 xclip 查询类型和读取图片。
	test("Wayland: falls back to xclip when wl-paste is missing", async () => {
		mocks.clipboard.hasImage.mockImplementation(() => {
			throw new Error("clipboard.hasImage should not be called on Wayland");
		});

		// enoent 模拟操作系统找不到 wl-paste 可执行文件。
		const enoent = new Error("spawn ENOENT");
		(enoent as { code?: string }).code = "ENOENT";

		mocks.spawnSync.mockImplementation((command, args, _options) => {
			if (command === "wl-paste") {
				return spawnError(enoent);
			}

			if (command === "xclip" && args.includes("TARGETS")) {
				return spawnOk(Buffer.from("image/png\n", "utf-8"));
			}

			if (command === "xclip" && args.includes("image/png")) {
				return spawnOk(Buffer.from([9, 8]));
			}

			return spawnOk(Buffer.alloc(0));
		});

		// readClipboardImage 在本用例命令桩准备后导入。
		const { readClipboardImage } = await import("../src/utils/clipboard-image.ts");
		// result 是 xclip 回退读取的 PNG 数据。
		const result = await readClipboardImage({ platform: "linux", env: { XDG_SESSION_TYPE: "wayland" } });
		expect(result).not.toBeNull();
		expect(result?.mimeType).toBe("image/png");
		expect(Array.from(result?.bytes ?? [])).toEqual([9, 8]);
	});

	// WSL 应把 wslpath 结果直接嵌入 PowerShell 脚本，不依赖额外环境变量。
	test("WSL: passes PowerShell path directly instead of through a custom env var", async () => {
		mocks.clipboard.hasImage.mockImplementation(() => {
			throw new Error("clipboard.hasImage should not be called before PowerShell on WSL");
=======
	test("X11 does not probe image types when TARGETS fails", async () => {
		// Regression test for #9786.
		mocks.getImage.mockResolvedValue(null);
		mocks.command.mockImplementation(async (_command, args) =>
			args.includes("TARGETS") ? undefined : Buffer.from("hello"),
		);
		expect(await readClipboardImage({ platform: "linux", env: { DISPLAY: ":0" } })).toBeNull();
		expect(mocks.command).toHaveBeenCalledExactlyOnceWith(
			"xclip",
			["-selection", "clipboard", "-t", "TARGETS", "-o"],
			{ timeoutMs: 1000 },
		);
		expect(mocks.getImage).toHaveBeenCalledOnce();
	});

	test("X11 does not probe unadvertised image types", async () => {
		mocks.getImage.mockResolvedValue(null);
		mocks.command.mockImplementation(async (_command, args) => {
			if (args.includes("TARGETS")) return Buffer.from("image/png\n");
			if (args.includes("image/png")) return undefined;
			return Buffer.from("hello");
		});
		expect(await readClipboardImage({ platform: "linux", env: { DISPLAY: ":0" } })).toBeNull();
		expect(mocks.command.mock.calls.map(([, args]) => args[3])).toEqual(["TARGETS", "image/png"]);
		expect(mocks.getImage).toHaveBeenCalledOnce();
	});

	test.each([png, null, new Uint8Array()])("native X11 result %j stops fallback", async (bytes) => {
		mocks.getImage.mockResolvedValue(bytes);
		expect(await readClipboardImage({ platform: "linux", env: { DISPLAY: ":0" } })).toEqual(
			bytes?.length ? { bytes, mimeType: "image/png" } : null,
		);
		expect(mocks.getNativeClipboard).toHaveBeenCalledExactlyOnceWith();
		expect(mocks.getImage).toHaveBeenCalledOnce();
		expect(mocks.command.mock.calls.map(([name]) => name)).toEqual(["xclip"]);
	});
	test.each(["missing module", "unavailable display"])("Wayland: falls back to X11 after %s", async (failure) => {
		if (failure === "missing module") mocks.getNativeClipboard.mockReturnValue(undefined);
		else mocks.getImage.mockResolvedValue(undefined);
		mocks.command.mockImplementation(async (command, args) => {
			if (command === "wl-paste") return commandResult(Buffer.alloc(0), 1);
			return commandResult(args.includes("TARGETS") ? Buffer.from("image/png\n") : Buffer.from(png));
>>>>>>> main
		});
		expect(await readClipboardImage({ platform: "linux", env: { WAYLAND_DISPLAY: "1" } })).toEqual({
			bytes: png,
			mimeType: "image/png",
		});
		expect(mocks.getNativeClipboard).not.toHaveBeenCalled();
	});

<<<<<<< HEAD
		// tmpFile 保存 wslpath 接收到的 Linux 临时文件路径，PowerShell 分支会写入该文件。
=======
	test("WSL: tries PowerShell before a broken native X11 bridge", async () => {
		mocks.getImage.mockRejectedValue(new Error("Broken X11 bridge"));
>>>>>>> main
		let tmpFile: string | undefined;
		mocks.command.mockImplementation(async (command, args, options) => {
			if (command === "wl-paste" || command === "xclip") return undefined;
			if (command === "wslpath") {
				tmpFile = args[1];
				return commandResult(Buffer.from("C:\\Users\\O'Hare\\clip.png\n"));
			}
			if (command === "powershell.exe") {
				// spawnOptions 是 PowerShell 子进程选项，用于确认没有自定义路径环境变量。
				const spawnOptions = options as { env?: NodeJS.ProcessEnv };
				expect(spawnOptions.env?.PI_WSL_CLIPBOARD_IMAGE_PATH).toBeUndefined();
				expect(args[2]).toContain("$path = 'C:\\Users\\O''Hare\\clip.png'");
				if (!tmpFile) throw new Error("wslpath should be called before powershell.exe");
				writeFileSync(tmpFile, png);
				return commandResult(Buffer.from("ok\n"));
			}
			throw new Error(`Unexpected command: ${command}`);
		});
<<<<<<< HEAD

		// readClipboardImage 使用准备好的 WSL 命令模拟。
		const { readClipboardImage } = await import("../src/utils/clipboard-image.ts");
		// result 是 PowerShell 写入临时文件后读取出的图片。
		const result = await readClipboardImage({ platform: "linux", env: { WSL_DISTRO_NAME: "Ubuntu" } });
		expect(result).not.toBeNull();
		expect(result?.mimeType).toBe("image/png");
		expect(Array.from(result?.bytes ?? [])).toEqual([4, 5, 6]);
	});

	// 普通 Linux 会话在原生剪贴板有图片时不应执行外部命令。
	test("Non-Wayland: uses clipboard", async () => {
		mocks.spawnSync.mockImplementation(() => {
			throw new Error(
				"spawnSync should not be called for non-Wayland sessions when native clipboard returns an image",
=======
		expect(await readClipboardImage({ platform: "linux", env: { WSL_DISTRO_NAME: "Ubuntu" } })).toEqual({
			bytes: new Uint8Array(png),
			mimeType: "image/png",
		});
		expect(mocks.getNativeClipboard).not.toHaveBeenCalled();
	});

	for (const platform of ["darwin", "win32"] as const) {
		test.each([png, null, new Uint8Array(), undefined])(`${platform}: reads native image %j once`, async (bytes) => {
			mocks.getImage.mockResolvedValue(bytes);
			expect(await readClipboardImage({ platform, env: {} })).toEqual(
				bytes?.length ? { bytes, mimeType: "image/png" } : null,
>>>>>>> main
			);
			expect(mocks.getImage).toHaveBeenCalledOnce();
			expect(mocks.command).not.toHaveBeenCalled();
		});
	}

<<<<<<< HEAD
		mocks.clipboard.hasImage.mockReturnValue(true);
		mocks.clipboard.getImageBinary.mockResolvedValue(new Uint8Array([7]));

		// readClipboardImage 在原生剪贴板模拟准备后加载。
		const { readClipboardImage } = await import("../src/utils/clipboard-image.ts");
		// result 是原生接口返回的单字节 PNG 数据。
		const result = await readClipboardImage({ platform: "linux", env: {} });
		expect(result).not.toBeNull();
		expect(result?.mimeType).toBe("image/png");
		expect(Array.from(result?.bytes ?? [])).toEqual([7]);
	});

	// 普通 Linux 原生剪贴板没有图片时应回退到 xclip。
	test("Non-Wayland: falls back to xclip when clipboard has no image", async () => {
		mocks.spawnSync.mockImplementation((command, args, _options) => {
			if (command === "xclip" && args.includes("TARGETS")) {
				return spawnOk(Buffer.from("image/png\n", "utf-8"));
			}
			if (command === "xclip" && args.includes("image/png")) {
				return spawnOk(Buffer.from([8, 9]));
			}
			throw new Error(`Unexpected spawnSync call: ${command} ${args.join(" ")}`);
		});

		mocks.clipboard.hasImage.mockReturnValue(false);

		// readClipboardImage 在 xclip 回退桩准备后加载。
		const { readClipboardImage } = await import("../src/utils/clipboard-image.ts");
		// result 是 xclip 返回的图片数据。
		const result = await readClipboardImage({ platform: "linux", env: {} });
		expect(result).not.toBeNull();
		expect(result?.mimeType).toBe("image/png");
		expect(Array.from(result?.bytes ?? [])).toEqual([8, 9]);
=======
	test("returns null without a native helper", async () => {
		mocks.getNativeClipboard.mockReturnValue(undefined);
		expect(await readClipboardImage({ platform: "win32", env: {} })).toBeNull();
		expect(mocks.getImage).not.toHaveBeenCalled();
	});

	test.each(["linux", "win32"] as const)(
		"%s: propagates native transfer errors without fallback",
		async (platform) => {
			const error = new Error("Native clipboard operation failed");
			mocks.getImage.mockImplementation(async () => {
				throw error;
			});
			await expect(readClipboardImage({ platform, env: { WAYLAND_DISPLAY: "1", DISPLAY: ":0" } })).rejects.toBe(
				error,
			);
			expect(mocks.command.mock.calls.map(([name]) => name)).toEqual(
				platform === "linux" ? ["wl-paste", "xclip"] : [],
			);
		},
	);

	test("Termux does not read image clipboards", async () => {
		expect(await readClipboardImage({ platform: "linux", env: { TERMUX_VERSION: "0.119" } })).toBeNull();
		expect(mocks.getNativeClipboard).not.toHaveBeenCalled();
		expect(mocks.command).not.toHaveBeenCalled();
>>>>>>> main
	});
});
