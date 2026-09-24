/**
 * 文件职责：验证图片缩放失败时，读取工具和文件参数处理器都安全省略图片附件。
 * 技术维度：使用 Vitest 模块模拟、临时 PNG 文件和两个真实调用入口。
 * 产品维度：避免不安全图片继续发送给模型，同时给用户明确的文字提示。
 * 逻辑维度：模拟 resizeImage 返回 null，每例写入微型 PNG，分别调用读取工具和文件处理器。
 * 关键边界：不执行真实缩放；测试会创建并递归删除系统临时目录。
 * 新手阅读建议：先看 vi.mock 的失败返回，再比较两个调用入口的相同降级结果。
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 把图片缩放模块替换成可控的模拟函数。 */
vi.mock("../src/utils/image-resize.js", () => ({
	resizeImage: vi.fn(),
	formatDimensionNote: vi.fn(() => undefined),
}));

import { processFileArguments } from "../src/cli/file-processor.ts";
import type { ExtensionContext } from "../src/core/extensions/types.ts";
import { createReadTool, createReadToolDefinition } from "../src/core/tools/read.ts";
import { resizeImage } from "../src/utils/image-resize.ts";

/** 1×1 PNG 的 Base64 固定夹具。 */
const TINY_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

/** 图片缩放调用方降级测试组。 */
describe("image resize callers", () => {
	/** 当前用例的临时目录。 */
	let testDir: string;

	/** 创建临时目录，并让模拟缩放固定返回 null。 */
	beforeEach(() => {
		testDir = join(tmpdir(), `image-resize-callers-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		vi.mocked(resizeImage).mockReset();
		vi.mocked(resizeImage).mockResolvedValue(null);
	});

	/** 删除当前临时目录。 */
	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	/** 验证读取工具只返回“图片已省略”的文本。 */
	it("read tool returns text-only output when auto-resize cannot produce a safe image", async () => {
		/** 测试 PNG 路径。 */
		const imagePath = join(testDir, "test.png");
		writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, "base64"));

		/** 限定在测试目录的读取工具。 */
		const tool = createReadTool(testDir);
		/** 读取图片后的降级结果。 */
		const result = await tool.execute("test-read-image", { path: imagePath });

		expect(result.content).toHaveLength(1);
		expect(result.content[0].type).toBe("text");
		expect((result.content[0] as { type: "text"; text: string }).text).toContain("Image omitted");
	});

	/** 验证 CLI 文件处理器不生成图片附件并在文本中提示省略。 */
	it("file processor omits image attachments when auto-resize cannot produce a safe image", async () => {
		/** 测试 PNG 路径。 */
		const imagePath = join(testDir, "test.png");
		writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, "base64"));

		/** 文件参数处理结果。 */
		const result = await processFileArguments([imagePath]);

		expect(result.images).toHaveLength(0);
		expect(result.text).toContain("Image omitted");
	});

	it("passes the current model resize profile to the read tool", async () => {
		const imagePath = join(testDir, "test.png");
		writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, "base64"));
		const resize = { maxWidth: 1234, maxHeight: 1000, maxBytes: 500000, jpegQuality: 70 };
		const model: Model<Api> = {
			id: "vision-model",
			name: "Vision model",
			api: "test",
			provider: "test",
			baseUrl: "https://example.com",
			reasoning: false,
			input: ["text", "image"],
			inputLimits: { images: { resize } },
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 1000,
			maxTokens: 100,
		};
		const ctx = { cwd: testDir, model } as unknown as ExtensionContext;

		await createReadToolDefinition(testDir).execute(
			"test-read-model-profile",
			{ path: imagePath },
			undefined,
			undefined,
			ctx,
		);

		expect(resizeImage).toHaveBeenCalledWith(expect.any(Uint8Array), "image/png", resize);
	});

	it("can defer resizing file attachments until prompt dispatch", async () => {
		const imagePath = join(testDir, "test.png");
		writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, "base64"));

		const result = await processFileArguments([imagePath], { autoResizeImages: false });

		expect(result.images).toHaveLength(1);
		expect(resizeImage).not.toHaveBeenCalled();
	});
});
