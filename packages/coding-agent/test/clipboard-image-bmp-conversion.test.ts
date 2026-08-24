/**
 * Test for BMP to PNG conversion in clipboard image handling.
 * Separate from clipboard-image.test.ts due to different mocking requirements.
 *
 * This tests the fix for WSL2/WSLg where clipboard often provides image/bmp
 * instead of image/png.
 */
/**
 * 文件职责：验证 Wayland/WSLg 剪贴板返回 BMP 时会转换为可用的 PNG 图片。
 * 技术维度：使用 Vitest 模块模拟、手工构造 1×1 BMP 字节和剪贴板图片读取接口。
 * 产品维度：让 WSL 用户粘贴图片时无需关心剪贴板提供的底层图像格式。
 * 逻辑维度：构造红色 BMP，模拟 wl-paste 类型与内容响应，读取后检查 MIME 和 PNG 魔数。
 * 关键边界：只覆盖 24 位单像素 BMP 转换路径；原生剪贴板模块被模拟且不参与 Wayland 路径。
 * 新手阅读建议：先按 BMP 文件头、DIB 头、像素数据三段读构造函数，再看两个模块模拟。
 */
import { describe, expect, test, vi } from "vitest";

/**
 * 构造最小的 1×1 红色 24 位 BMP。
 * 参数：无。
 * 返回值：包含完整 BMP 头和一行像素的 Uint8Array。
 * 使用示例：wl-paste 模拟中调用 `createTinyBmp1x1Red24bpp()`。
 */
function createTinyBmp1x1Red24bpp(): Uint8Array {
	// Minimal 1x1 24bpp BMP (BGR + row padding to 4 bytes)
	// 最小 1×1 24 位 BMP，像素为 BGR，并把一行补齐到 4 字节。
	// File size = 14 (BMP header) + 40 (DIB header) + 4 (pixel row) = 58
	// 文件总长为 14 字节文件头、40 字节 DIB 头和 4 字节像素行，共 58 字节。
	// buffer 是待逐字段写入的 58 字节 BMP 缓冲区。
	const buffer = Buffer.alloc(58);

	// BITMAPFILEHEADER
	// 写入 BMP 文件头。
	buffer.write("BM", 0, "ascii");
	buffer.writeUInt32LE(buffer.length, 2); // file size
	buffer.writeUInt16LE(0, 6); // reserved1
	buffer.writeUInt16LE(0, 8); // reserved2
	buffer.writeUInt32LE(54, 10); // pixel data offset

	// BITMAPINFOHEADER
	// 写入 BITMAPINFOHEADER 图像信息头。
	buffer.writeUInt32LE(40, 14); // DIB header size
	buffer.writeInt32LE(1, 18); // width
	buffer.writeInt32LE(1, 22); // height (positive = bottom-up)
	buffer.writeUInt16LE(1, 26); // planes
	buffer.writeUInt16LE(24, 28); // bits per pixel
	buffer.writeUInt32LE(0, 30); // compression (BI_RGB)
	buffer.writeUInt32LE(4, 34); // image size (incl. padding)
	buffer.writeInt32LE(0, 38); // x pixels per meter
	buffer.writeInt32LE(0, 42); // y pixels per meter
	buffer.writeUInt32LE(0, 46); // colors used
	buffer.writeUInt32LE(0, 50); // important colors

	// Pixel data (B, G, R) + 1 byte padding
	// 写入蓝、绿、红三个通道和一个填充字节。
	buffer[54] = 0x00; // B
	buffer[55] = 0x00; // G
	buffer[56] = 0xff; // R
	buffer[57] = 0x00; // padding

	return new Uint8Array(buffer);
}

// Mock wl-paste to return BMP

// 模拟 wl-paste 返回 BMP 类型和字节内容。
vi.mock("child_process", async () => {
	// actual 是真实 child_process 模块，其余导出保持不变。
	const actual = await vi.importActual<typeof import("child_process")>("child_process");
	return {
		...actual,
		// command 是命令名，args 是参数；仅拦截本测试使用的两个 wl-paste 调用。
		spawnSync: vi.fn((command: string, args: string[]) => {
			if (command === "wl-paste" && args.includes("--list-types")) {
				return { status: 0, stdout: Buffer.from("image/bmp\n"), error: null };
			}
			if (command === "wl-paste" && args.includes("image/bmp")) {
				return { status: 0, stdout: Buffer.from(createTinyBmp1x1Red24bpp()), error: null };
			}
			return { status: 1, stdout: Buffer.alloc(0), error: null };
		}),
	};
});

// Mock the native clipboard (not used in Wayland path, but needs to be mocked)

// 模拟原生剪贴板；Wayland 路径不会使用它，但模块加载仍要求存在。
vi.mock("@mariozechner/clipboard", () => ({
	default: {
		hasImage: vi.fn(() => false),
		getImageBinary: vi.fn(() => Promise.resolve(null)),
	},
}));

describe("readClipboardImage BMP conversion", () => {
	// 验证 WSLg 环境读取 BMP 后返回 PNG MIME 和正确魔数；无参数，无返回值。
	test("converts BMP to PNG on Wayland/WSLg", async () => {
		// readClipboardImage 是在模块模拟生效后动态加载的被测函数。
		const { readClipboardImage } = await import("../src/utils/clipboard-image.ts");

		// Simulate Wayland session (WSLg)
		// 模拟 WSLg 的 Wayland 会话环境。
		// image 是剪贴板 BMP 转换后的可选图片结果。
		const image = await readClipboardImage({
			env: { WAYLAND_DISPLAY: "wayland-0" },
			platform: "linux",
		});

		expect(image).not.toBeNull();
		expect(image!.mimeType).toBe("image/png");

		// Verify PNG magic bytes
		// 检查 PNG 文件签名的前四个字节。
		expect(image!.bytes[0]).toBe(0x89);
		expect(image!.bytes[1]).toBe(0x50); // P
		expect(image!.bytes[2]).toBe(0x4e); // N
		expect(image!.bytes[3]).toBe(0x47); // G
	});
});
