/**
 * 文件职责：验证图片阻止设置不会妨碍读取层和命令行文件处理层识别图片与普通文本。
 * 技术维度：使用 Vitest、临时目录、Node.js 文件系统 API，并以内嵌 PNG/BMP 数据测试图片处理链路。
 * 产品维度：确保用户可以控制图片是否发送给模型，同时仍能从磁盘正确读取和转换附件。
 * 逻辑维度：依次测试设置持久化、Read 工具输出，以及 processFileArguments 对 PNG、BMP 和文本的处理。
 * 关键边界：过滤发生在 convertToLlm 层而非读取层；临时文件必须在每个用例后清理。
 * 新手阅读建议：先看 SettingsManager 用例理解设置含义，再跟随图片从文件创建到工具输出的流向。
 */
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { processFileArguments } from "../src/cli/file-processor.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createReadTool } from "../src/core/tools/read.ts";

// 1x1 red PNG image as base64 (smallest valid PNG)
// 一个 1×1 像素的红色 PNG Base64 字符串，用最小有效图片降低测试成本。
const TINY_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

/**
 * 在内存中构造一个 1×1 像素、24 位红色 BMP 文件。
 * @returns 包含完整 BMP 文件头和像素数据的 Buffer；例如可直接传给 `writeFileSync`。
 */
function createTinyBmp1x1Red24bpp(): Buffer {
	// buffer 固定为 58 字节：54 字节文件与位图头、4 字节对齐后的像素行。
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

// 汇总验证 blockImages 设置及其上下游读取行为。
describe("blockImages setting", () => {
	// 验证内存设置管理器对图片阻止选项的读取与更新。
	describe("SettingsManager", () => {
		// 默认未配置时应允许图片进入后续处理流程。
		it("should default blockImages to false", () => {
			// manager 使用空配置创建，用于观察默认值。
			const manager = SettingsManager.inMemory({});
			expect(manager.getBlockImages()).toBe(false);
		});

		// 显式配置后应返回启用状态。
		it("should return true when blockImages is set to true", () => {
			// manager 含有启用 blockImages 的最小图片配置。
			const manager = SettingsManager.inMemory({ images: { blockImages: true } });
			expect(manager.getBlockImages()).toBe(true);
		});

		// setter 应能在同一实例上来回切换并保存当前值。
		it("should persist blockImages setting via setBlockImages", () => {
			// manager 从默认配置开始，便于验证两次状态变化。
			const manager = SettingsManager.inMemory({});
			expect(manager.getBlockImages()).toBe(false);

			manager.setBlockImages(true);
			expect(manager.getBlockImages()).toBe(true);

			manager.setBlockImages(false);
			expect(manager.getBlockImages()).toBe(false);
		});

		// 图片阻止和自动缩放是彼此独立、可同时启用的设置。
		it("should handle blockImages alongside autoResize", () => {
			// manager 同时启用两个图片选项以检查配置合并结果。
			const manager = SettingsManager.inMemory({
				images: { autoResize: true, blockImages: true },
			});
			expect(manager.getImageAutoResize()).toBe(true);
			expect(manager.getBlockImages()).toBe(true);
		});
	});

	// 验证 Read 工具只负责读取图片，暂不应用模型层过滤规则。
	describe("Read tool", () => {
		// testDir 保存当前用例生成的图片或文本文件路径，仅在用例期间有效。
		let testDir: string;

		// 每个用例前创建独立临时目录，避免文件名和内容相互影响。
		beforeEach(() => {
			testDir = join(tmpdir(), `block-images-test-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });
		});

		// 每个用例后递归移除临时目录，即使文件已不存在也不报错。
		afterEach(() => {
			rmSync(testDir, { recursive: true, force: true });
		});

		// 图片应由读取工具返回，真正的过滤留给 convertToLlm 层。
		it("should always read images (filtering happens at convertToLlm layer)", async () => {
			// Create test image
			// 创建测试图片文件，使用内嵌数据避免依赖外部资源。
			// imagePath 是当前临时目录中的 PNG 文件绝对路径。
			const imagePath = join(testDir, "test.png");
			writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, "base64"));

			// tool 是以测试目录为工作根目录的 Read 工具实例。
			const tool = createReadTool(testDir);
			// result 是工具读取图片后返回的多模态内容集合。
			const result = await tool.execute("test-1", { path: imagePath });

			// Should have text note + image content
			// 返回内容至少包含说明文本，并且应存在图片内容块。
			expect(result.content.length).toBeGreaterThanOrEqual(1);
			// hasImage 表示结果中是否存在类型为 image 的内容块。
			const hasImage = result.content.some((c) => c.type === "image");
			expect(hasImage).toBe(true);
		});

		// 普通文本仍应作为单个文本内容块读取。
		it("should read text files normally", async () => {
			// Create test text file
			// 创建测试文本文件，确认图片相关设置不会影响普通文件。
			// textPath 是当前临时目录中的文本文件绝对路径。
			const textPath = join(testDir, "test.txt");
			writeFileSync(textPath, "Hello, world!");

			// tool 是用于读取当前临时目录内容的工具实例。
			const tool = createReadTool(testDir);
			// result 保存文本文件读取后的标准工具输出。
			const result = await tool.execute("test-2", { path: textPath });

			expect(result.content).toHaveLength(1);
			expect(result.content[0].type).toBe("text");
			// textContent 将已确认的首个内容块收窄为文本结构，以检查正文。
			const textContent = result.content[0] as { type: "text"; text: string };
			expect(textContent.text).toContain("Hello, world!");
		});
	});

	// 验证命令行文件参数预处理能区分并转换不同文件类型。
	describe("processFileArguments", () => {
		// testDir 保存当前命令行处理用例的临时输入文件。
		let testDir: string;

		// 为每个命令行处理用例创建新的临时目录。
		beforeEach(() => {
			testDir = join(tmpdir(), `block-images-process-test-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });
		});

		// 用例结束后删除本次生成的全部临时文件。
		afterEach(() => {
			rmSync(testDir, { recursive: true, force: true });
		});

		// PNG 参数始终先解析为图片附件，过滤不属于这一层。
		it("should always process images (filtering happens at convertToLlm layer)", async () => {
			// Create test image
			// 创建测试图片文件供命令行参数处理器读取。
			// imagePath 指向临时 PNG 输入文件。
			const imagePath = join(testDir, "test.png");
			writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, "base64"));

			// result 将解析出的图片附件与拼接文本分开保存。
			const result = await processFileArguments([imagePath]);

			expect(result.images).toHaveLength(1);
			expect(result.images[0].type).toBe("image");
		});

		// 不受模型直接支持的 BMP 应在附件阶段转换为 PNG。
		it("should process BMP images from disk as PNG attachments", async () => {
			// imagePath 指向由测试代码即时构造的 BMP 文件。
			const imagePath = join(testDir, "test.bmp");
			writeFileSync(imagePath, createTinyBmp1x1Red24bpp());

			// result 应包含转换后的 PNG 附件和一条格式转换说明。
			const result = await processFileArguments([imagePath]);

			expect(result.images).toHaveLength(1);
			expect(result.images[0].type).toBe("image");
			expect(result.images[0].mimeType).toBe("image/png");
			expect(result.text).toContain("[Image converted from image/bmp to image/png.]");
		});

		// 文本参数应合并到文本输出且不产生图片附件。
		it("should process text files normally", async () => {
			// Create test text file
			// 创建测试文本文件，验证普通命令行附件路径。
			// textPath 指向临时文本输入文件。
			const textPath = join(testDir, "test.txt");
			writeFileSync(textPath, "Hello, world!");

			// result 应只有拼接文本，不应包含任何图片。
			const result = await processFileArguments([textPath]);

			expect(result.images).toHaveLength(0);
			expect(result.text).toContain("Hello, world!");
		});
	});
});
