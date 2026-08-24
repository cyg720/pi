/**
 * 文件职责：验证 BMP 魔数识别及图片处理管线把 BMP 转换为 PNG。
 * 技术维度：使用 Vitest、Node Buffer 手工构造 BMP，并检查 PNG 文件签名字节。
 * 产品维度：让用户上传的 BMP 在模型不直接支持时自动转换为安全附件。
 * 逻辑维度：构造 1×1 红色 BMP，分别测试识别、禁用缩放转换和转换后自动缩放。
 * 关键边界：夹具只覆盖 24bpp 1×1 BMP；PNG 检查仅验证前四个魔数字节。
 * 新手阅读建议：先看 BMP 头字段写入，再看 expectPngMagic 与三个测试。
 */
import { describe, expect, it } from "vitest";
import { processImage } from "../src/utils/image-process.ts";
import { detectSupportedImageMimeType } from "../src/utils/mime.ts";

/** @returns 58 字节、1×1、24bpp 红色 BMP 缓冲区。@example `createTinyBmp1x1Red24bpp()`。 */
function createTinyBmp1x1Red24bpp(): Buffer {
	/** BMP 文件头、DIB 头和一行像素数据缓冲区。 */
	const buffer = Buffer.alloc(58);
	buffer.write("BM", 0, "ascii");
	buffer.writeUInt32LE(buffer.length, 2);
	buffer.writeUInt32LE(54, 10);
	buffer.writeUInt32LE(40, 14);
	buffer.writeInt32LE(1, 18);
	buffer.writeInt32LE(1, 22);
	buffer.writeUInt16LE(1, 26);
	buffer.writeUInt16LE(24, 28);
	buffer.writeUInt32LE(0, 30);
	buffer.writeUInt32LE(4, 34);
	buffer[56] = 0xff;
	return buffer;
}

/** @param base64Data PNG 的 Base64 数据。@returns 无返回；前四字节不匹配时断言失败。 */
function expectPngMagic(base64Data: string): void {
	/** 解码后的图片字节。 */
	const buffer = Buffer.from(base64Data, "base64");
	expect(buffer[0]).toBe(0x89);
	expect(buffer[1]).toBe(0x50);
	expect(buffer[2]).toBe(0x4e);
	expect(buffer[3]).toBe(0x47);
}

/** 图片处理管线测试组。 */
describe("image processing pipeline", () => {
	/** 验证 BMP 文件头被识别为 image/bmp。 */
	it("detects BMP files from magic bytes", () => {
		expect(detectSupportedImageMimeType(createTinyBmp1x1Red24bpp())).toBe("image/bmp");
	});

	/** 验证禁用自动缩放时仍执行格式转换并附加提示。 */
	it("converts BMP files to PNG attachments when auto-resize is disabled", async () => {
		/** 图片处理结果；失败分支由 ok 区分。 */
		const result = await processImage(createTinyBmp1x1Red24bpp(), "image/bmp", { autoResizeImages: false });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.mimeType).toBe("image/png");
		expect(result.hints).toContain("[Image converted from image/bmp to image/png.]");
		expectPngMagic(result.data);
	});

	/** 验证默认自动缩放路径也先把 BMP 转为 PNG。 */
	it("converts BMP files before auto-resizing", async () => {
		/** 默认配置下的图片处理结果。 */
		const result = await processImage(createTinyBmp1x1Red24bpp(), "image/bmp");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.mimeType).toBe("image/png");
		expect(result.hints).toContain("[Image converted from image/bmp to image/png.]");
		expectPngMagic(result.data);
	});
});
