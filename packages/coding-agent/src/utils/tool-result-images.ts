/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `utils/tool-result-images` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-ai`、`./image-process.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `utils/tool-result-images` 对应的子能力。
 * 【逻辑维度】对外入口包括 `ToolResultContent`、`NormalizeToolResultImagesOptions`、`normalizeToolResultImages`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `ToolResultContent`、`NormalizeToolResultImagesOptions`、`normalizeToolResultImages` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import { processImage } from "./image-process.ts";

export type ToolResultContent = TextContent | ImageContent;

export interface NormalizeToolResultImagesOptions {
	/** Whether oversized images are resized to inline provider limits. Default: true */
	autoResizeImages?: boolean;
}

/**
 * Normalize image blocks returned by tool results.
 *
 * The `read` tool and `@file` CLI attachments run their images through `processImage`, but tools
 * that produce images themselves (extensions, MCP bridges, screenshot tools) hand back arbitrary
 * base64 payloads that go straight into session history and every subsequent provider request.
 * Oversized images make the provider reject the whole conversation, not just the offending turn,
 * so normalize them once as they enter history.
 *
 * Returns the original array when nothing changed so callers can skip rewriting the result.
 */
export async function normalizeToolResultImages(
	content: ToolResultContent[],
	options?: NormalizeToolResultImagesOptions,
): Promise<ToolResultContent[]> {
	if (!content.some((block) => block.type === "image")) {
		return content;
	}

	const autoResizeImages = options?.autoResizeImages ?? true;
	const normalized: ToolResultContent[] = [];
	let changed = false;

	for (const block of content) {
		if (block.type !== "image") {
			normalized.push(block);
			continue;
		}

		const processed = await processImage(Buffer.from(block.data, "base64"), block.mimeType, { autoResizeImages });
		if (!processed.ok) {
			// Unlike `read`, keep the original block. The tool already produced this image and the
			// failure may just be an unavailable image backend, so passing it through preserves the
			// behavior tools have today instead of silently deleting their output.
			normalized.push(block);
			continue;
		}

		if (processed.data === block.data && processed.mimeType === block.mimeType && processed.hints.length === 0) {
			normalized.push(block);
			continue;
		}

		normalized.push({ type: "image", data: processed.data, mimeType: processed.mimeType });
		if (processed.hints.length > 0) {
			normalized.push({ type: "text", text: processed.hints.join("\n") });
		}
		changed = true;
	}

	return changed ? normalized : content;
}
