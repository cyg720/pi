/**
 * Tests for image processing utilities using Photon.
 */
/**
 * 文件职责：验证基于 Photon 的图片转 PNG、按尺寸/字节限制缩放和尺寸说明格式化工具。
 * 技术维度：使用 Vitest、Base64 固定图片夹具、Uint8Array 与 PNG 魔数进行无文件系统单元测试。
 * 产品维度：确保用户上传图片可被模型接受、过大图片被安全压缩，并能提示原始与显示尺寸差异。
 * 逻辑维度：先定义三种图片夹具和字节转换函数，再分别测试格式转换、缩放边界和说明文本。
 * 关键边界：固定图片很小且只覆盖 PNG/JPEG；无法压到 maxBytes 时返回 null；输入字节不得被原地修改。
 * 新手阅读建议：先看 imageBytes 与 convertToPng 用例，再按“不缩放、尺寸缩放、字节缩放、失败”阅读。
 */

import { describe, expect, it } from "vitest";
import { convertToPng } from "../src/utils/image-convert.ts";
import { formatDimensionNote, resizeImage } from "../src/utils/image-resize.ts";

// Small 2x2 red PNG image (base64) - generated with ImageMagick
// 由 ImageMagick 生成的 2×2 红色 PNG Base64 固定夹具。
/** 验证 PNG 直通和输入字节保持不变的微型图片。 */
const TINY_PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURf8AAP///0EdNBEAAAABYktHRAH/Ai3eAAAAB3RJTUUH6gEOADM5Ddoh/wAAAAxJREFUCNdjYGBgAAAABAABJzQnCgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyNi0wMS0xNFQwMDo1MTo1NyswMDowMOnKzHgAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjYtMDEtMTRUMDA6NTE6NTcrMDA6MDCYl3TEAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDI2LTAxLTE0VDAwOjUxOjU3KzAwOjAwz4JVGwAAAABJRU5ErkJggg==";

// Small 2x2 blue JPEG image (base64) - generated with ImageMagick
// 由 ImageMagick 生成的 2×2 蓝色 JPEG Base64 固定夹具。
/** 验证 JPEG 转 PNG 及 JPEG 缩放路径的微型图片。 */
const TINY_JPEG =
	"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAVAQEBAAAAAAAAAAAAAAAAAAAGCf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AD3VTB3/2Q==";

// 100x100 gray PNG
// 100×100 灰色 PNG，用于触发尺寸上限缩放。
/** 中等尺寸 PNG Base64 夹具。 */
const MEDIUM_PNG_100x100 =
	"iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAAAAABVicqIAAAAAmJLR0QA/4ePzL8AAAAHdElNRQfqAQ4AMzkN2iH/AAAAP0lEQVRo3u3NQQEAAAQEMASXXYrz2gqst/Lm4ZBIJBKJRCKRSCQSiUQikUgkEolEIpFIJBKJRCKRSCQSiSTsAP1cAUZeKtreAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI2LTAxLTE0VDAwOjUxOjU3KzAwOjAw6crMeAAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNi0wMS0xNFQwMDo1MTo1NyswMDowMJiXdMQAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjYtMDEtMTRUMDA6NTE6NTcrMDA6MDDPglUbAAAAAElFTkSuQmCC";

// 200x200 colored PNG
// 200×200 彩色 PNG，用于触发编码字节上限缩放。
/** 较大 PNG Base64 夹具。 */
const LARGE_PNG_200x200 =
	"iVBORw0KGgoAAAANSUhEUgAAAMgAAADIEAIAAAByquWKAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRP///////wlY99wAAAAHdElNRQfqAQ4AMzqU03BFAAAEEElEQVR42u3dvWqUURSF4XXMRAyIhSAWQvwnWtjaWusFx9bW1kKD/wELESxEiBjDjJdwysOC57mCXW32+zGcGbtdACpsdi+T8Xz1GABzm91xMl6sHgNgblzcT/Y+rh4DYG6cv0/2H64eA2BOEgI1fHQHaoyzbXIwVo8BMCcJgRqSEKgxft9Lrn5aPQbA3Ph1klw7Wj0GwJwkBGpYWECN8fMiub63egyAORcWUMPCAmqMH3eTG59XjwEwN76/S24+Wj0GwJwkBGpYWECN8e1fcmuzegyAORcWUMPCAmqM09vJ4dfVYwDMjS9vkzuPV48BMCcJgRqeSAZqjA/nyYP91WMAzElCoIYkBGqMk8Pk6HT1GABzm+3L5JIkBApIQqCGj+5AjfHmb/Lk8uoxAOYkIVBDEgI1LCygxmZ7nFyShEABFxZQw8ICaozXf5KnV1aPATDnwgJqWFhADQsLqOFnDUANFxZQw8ICaoxXZ8mzg9VjAMy5sIAaFhZQw3tYQA1/QgHUkIRADUkI1JCEQA1JCNSQhEANFxZQwzcsoIYkBGpIQqCGJARqSEKghiQEalhYQA1/QgHUcGEBNSwsoIYkBGq4sIAaFhZQw8ICaviGBdRwYQE1LCyghiQEariwgBoWFlDDe1hADS+OAjUkIVBDEgI1JCFQQxICNSQhUMOFBdTwDQuoIQmBGpIQqCEJgRqSEKghCYEaFhZQw4ujQA0XFlDDwgJqSEKghgsLqGFhATUsLKCGb1hADRcWUMPCAmpIQqCGCwuoYWEBNbyHBdTw4ihQQxICNSQhUEMSAjUkIVBDEgI1XFhADd+wgBqSEKghCYEakhCoIQmBGpIQqGFhATW8OArUcGEBNSwsoIYkBGq4sIAaFhZQw8ICaviGBdRwYQE1LCyghiQEariwgBoWFlDDe1hADS+OAjUkIVBDEgI1JCFQQxICNSQhUMOFBdTwDQuoIQmBGpIQqCEJgRqSEKghCYEa49lB8ups9RgAc14cBWpIQqCGhQXUkIRADRcWUMPCAmqMp1eS139WjwEw5xsWUEMSAjUsLKCGJARquLCAGhYWUGM8uZy8+bt6DIA5L44CNSQhUMMTyUCNcXSanByuHgNgThICNSQhUGM82E8+nK8eA2DOzxqAGpIQqDHuPE6+vF09BsDcOPyanN5ePQbAnCQEavgdFlBj3Nok3/6tHgNgzoujQA1JCNQYNx8l39+tHgNgbtz4nPy4u3oMgDlJCNSwsIAa4/pe8vNi9RgAc37WANSQhECNce0o+XWyegyAuXH1U/L73uoxAOYkIVDDwgJqjIORnG1XjwEw508ogBqSEKgx9h8m5+9XjwEwN/Y+Jhf3V48BMCcJgRpjPE+2x6vHAJgbSbLbrR4DYO4/GqiSgXN+ksgAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDEtMTRUMDA6NTE6NTcrMDA6MDDpysx4AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTAxLTE0VDAwOjUxOjU3KzAwOjAwmJd0xAAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wMS0xNFQwMDo1MTo1NyswMDowMM+CVRsAAAAASUVORK5CYII=";

/**
 * 将 Base64 图片转换为 Uint8Array 字节。
 * @param base64Data 图片 Base64 文本。
 * @returns 解码后的独立字节视图。
 * @example imageBytes(TINY_PNG);
 */
function imageBytes(base64Data: string): Uint8Array {
	return Buffer.from(base64Data, "base64");
}

/** 覆盖图片格式转换到 PNG 的直通和转码路径。 */
describe("convertToPng", () => {
	it("should return original data for PNG input", async () => {
		/** PNG 输入的转换结果，应原样返回数据。 */
		const result = await convertToPng(TINY_PNG, "image/png");
		expect(result).not.toBeNull();
		expect(result!.data).toBe(TINY_PNG);
		expect(result!.mimeType).toBe("image/png");
	});

	it("should convert JPEG to PNG", async () => {
		/** JPEG 输入的 PNG 转码结果。 */
		const result = await convertToPng(TINY_JPEG, "image/jpeg");
		expect(result).not.toBeNull();
		expect(result!.mimeType).toBe("image/png");
		// Result should be valid base64
		// 转换结果应是可解码的合法 Base64。
		expect(() => Buffer.from(result!.data, "base64")).not.toThrow();
		// PNG magic bytes
		// 解码后的前四字节应为 PNG 魔数。
		/** 转码结果解码后的 PNG 字节。 */
		const buffer = Buffer.from(result!.data, "base64");
		expect(buffer[0]).toBe(0x89);
		expect(buffer[1]).toBe(0x50); // 'P'
		// 十六进制 0x50 对应 ASCII 字符 P。
		expect(buffer[2]).toBe(0x4e); // 'N'
		// 十六进制 0x4e 对应 ASCII 字符 N。
		expect(buffer[3]).toBe(0x47); // 'G'
		// 十六进制 0x47 对应 ASCII 字符 G。
	});
});

/** 覆盖图片缩放的输入保护、尺寸、字节、失败和 JPEG 路径。 */
describe("resizeImage", () => {
	it("should keep caller input bytes intact", async () => {
		/** 待验证不会被 Photon 原地修改的输入字节。 */
		const input = new Uint8Array(imageBytes(TINY_PNG));
		/** 调用前输入的字节长度。 */
		const originalByteLength = input.byteLength;
		/** 调用前输入的首字节。 */
		const originalFirstByte = input[0];

		/** 宽高和字节均在限制内的缩放结果。 */
		const result = await resizeImage(input, "image/png", {
			maxWidth: 100,
			maxHeight: 100,
			maxBytes: 1024 * 1024,
		});

		expect(result).not.toBeNull();
		expect(input.byteLength).toBe(originalByteLength);
		expect(input[0]).toBe(originalFirstByte);
	});

	it("should return original image if within limits", async () => {
		/** 微型 PNG 在宽松限制下的直通结果。 */
		const result = await resizeImage(imageBytes(TINY_PNG), "image/png", {
			maxWidth: 100,
			maxHeight: 100,
			maxBytes: 1024 * 1024,
		});

		expect(result).not.toBeNull();
		expect(result!.wasResized).toBe(false);
		expect(result!.data).toBe(TINY_PNG);
		expect(result!.originalWidth).toBe(2);
		expect(result!.originalHeight).toBe(2);
		expect(result!.width).toBe(2);
		expect(result!.height).toBe(2);
	});

	it("should resize image exceeding dimension limits", async () => {
		/** 100×100 PNG 在 50×50 上限下的缩放结果。 */
		const result = await resizeImage(imageBytes(MEDIUM_PNG_100x100), "image/png", {
			maxWidth: 50,
			maxHeight: 50,
			maxBytes: 1024 * 1024,
		});

		expect(result).not.toBeNull();
		expect(result!.wasResized).toBe(true);
		expect(result!.originalWidth).toBe(100);
		expect(result!.originalHeight).toBe(100);
		expect(result!.width).toBeLessThanOrEqual(50);
		expect(result!.height).toBeLessThanOrEqual(50);
	});

	it("should resize image exceeding byte limit", async () => {
		/** 较大 PNG 解码后的原始字节。 */
		const originalBuffer = Buffer.from(LARGE_PNG_200x200, "base64");
		/** 原始编码图片的字节数。 */
		const originalSize = originalBuffer.length;

		// Set maxBytes to less than the original encoded image size
		// 将 maxBytes 设为低于原始编码大小以强制压缩。
		/** 只受字节上限约束的缩放结果。 */
		const result = await resizeImage(imageBytes(LARGE_PNG_200x200), "image/png", {
			maxWidth: 2000,
			maxHeight: 2000,
			maxBytes: Math.floor(LARGE_PNG_200x200.length * 0.9),
		});

		// Should have tried to reduce size
		// 缩放器应尝试降低编码大小。
		expect(result).not.toBeNull();
		/** 缩放结果解码后的字节，用于与原始大小比较。 */
		const resultBuffer = Buffer.from(result!.data, "base64");
		expect(resultBuffer.length).toBeLessThan(originalSize);
		expect(result!.data.length).toBeLessThan(LARGE_PNG_200x200.length);
	});

	it("should return null when image cannot be resized below maxBytes", async () => {
		/** 在 1 字节不可能限制下的失败结果。 */
		const result = await resizeImage(imageBytes(LARGE_PNG_200x200), "image/png", {
			maxWidth: 2000,
			maxHeight: 2000,
			maxBytes: 1,
		});

		expect(result).toBeNull();
	});

	it("should handle JPEG input", async () => {
		/** JPEG 在宽松限制下的处理结果。 */
		const result = await resizeImage(imageBytes(TINY_JPEG), "image/jpeg", {
			maxWidth: 100,
			maxHeight: 100,
			maxBytes: 1024 * 1024,
		});

		expect(result).not.toBeNull();
		expect(result!.wasResized).toBe(false);
		expect(result!.originalWidth).toBe(2);
		expect(result!.originalHeight).toBe(2);
	});
});

/** 覆盖缩放尺寸说明在直通和已缩放场景下的文本。 */
describe("formatDimensionNote", () => {
	it("should return undefined for non-resized images", () => {
		/** 未缩放图片的说明结果，应为 undefined。 */
		const note = formatDimensionNote({
			data: "",
			mimeType: "image/png",
			originalWidth: 100,
			originalHeight: 100,
			width: 100,
			height: 100,
			wasResized: false,
		});
		expect(note).toBeUndefined();
	});

	it("should return formatted note for resized images", () => {
		/** 2 倍缩小图片的格式化说明。 */
		const note = formatDimensionNote({
			data: "",
			mimeType: "image/png",
			originalWidth: 2000,
			originalHeight: 1000,
			width: 1000,
			height: 500,
			wasResized: true,
		});
		expect(note).toContain("original 2000x1000");
		expect(note).toContain("displayed at 1000x500");
		expect(note).toContain("2.00"); // scale factor
		// 缩放比例应格式化为两位小数。
	});
});
