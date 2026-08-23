/**
 * 【文件职责】实现内置 read 工具：读取文本文件（支持 offset/limit 分页、头部截断与续读提示）
 *              或图片文件（格式嗅探后作为附件返回，可选接入图片处理器做转换/缩放）。
 * 【技术维度】typebox schema；二进制读取 + 魔数识别；TextDecoder 解码；truncateHead 头部截断；
 *              可注入的 imageProcessor 扩展点（BMP 等需转换格式的处理入口）。
 * 【产品维度】模型感知代码与资源的首要途径：分页续读机制让大文件也能被完整浏览而不撑爆上下文。
 * 【逻辑维度】路径容错解析（resolveReadToolPath）→ 读字节 → 命中图片 MIME 走图片分支（处理器/直编 Base64）→
 *              否则解码为文本：定位起始行 → 按 limit 截取 → truncateHead → 按四种情形拼装输出与续读提示。
 * 【关键边界】offset 为 1 起始行号，越界报错；首行超字节上限时给出 sed 替代命令；
 *              无 imageProcessor 时 BMP 直接省略图片内容；截断详情写入 details 供 UI 展示。
 * 【新手阅读建议】先看 readSchema 与 ReadToolOptions 了解契约 → 再按 execute 的“图片分支/文本分支”两条线阅读，
 *              重点理解末尾四段式输出的拼接规则。
 */
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import { type Static, Type } from "typebox";
import type { AgentHarnessTool } from "../types.ts";
import { getOrThrow } from "../types.ts";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	type TruncationResult,
	truncateHead,
} from "../utils/truncate.ts";
import { detectSupportedImageMimeType, encodeBase64 } from "./image.ts";
import { resolveReadToolPath } from "./path-utils.ts";
import type { ExecutionToolContext } from "./tool-context.ts";

// read 工具参数 schema：path 必填；offset 起始行（1 起）；limit 最大行数
const readSchema = Type.Object({
	path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
	offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});

/** read 工具输入类型 */
export type ReadToolInput = Static<typeof readSchema>;

/** read 工具详情（中文说明）：发生截断时携带截断诊断信息。 */
export interface ReadToolDetails {
	truncation?: TruncationResult;
}

/**
 * 图片处理结果（中文说明）：成功时返回编码后的数据、最终 MIME 与提示列表；
 * 失败时返回用户可读的失败说明。
 */
export type ReadImageProcessorResult =
	| { ok: true; data: string; mimeType: string; hints: string[] }
	| { ok: false; message: string };

/**
 * 图片处理器类型（中文说明）：宿主可注入的扩展点——把原始图片字节转换为
 * 适合发送给模型的形态（如缩放、BMP→PNG 转换）。参数 bytes/mimeType/options。
 */
export type ReadImageProcessor = (
	bytes: Uint8Array,
	mimeType: string,
	options: { autoResizeImages: boolean },
) => Promise<ReadImageProcessorResult>;

/** read 工具选项（中文说明）：autoResizeImages 控制注入的处理器是否缩放图片（默认 true）。 */
export interface ReadToolOptions {
	/** Whether an injected image processor should resize images. Default: true. */
	autoResizeImages?: boolean;
	/** Optional image conversion/resizing implementation. */
	imageProcessor?: ReadImageProcessor;
}

/**
 * 创建 read 工具实例（中文说明）：options 可注入图片处理器及其配置；
 * 返回 AgentHarnessTool。
 */
export function createReadTool<TContext extends ExecutionToolContext = ExecutionToolContext>(
	options?: ReadToolOptions,
): AgentHarnessTool<TContext, typeof readSchema, ReadToolDetails | undefined> {
	return {
		name: "read",
		label: "read",
		description: `Read the contents of a file. Supports text files and images (jpg, png, gif, webp, bmp). Images are sent as attachments. For text files, output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.`,
		parameters: readSchema,
		async execute(_toolCallId, { path, offset, limit }, signal, _onUpdate, { env }) {
			// 带容错的路径解析（多变体探测）
			const absolutePath = await resolveReadToolPath(env, path, signal);
			const bytes = getOrThrow(await env.readBinaryFile(absolutePath, signal));
			// 先按魔数判断是否为受支持的图片
			const mimeType = detectSupportedImageMimeType(bytes);
			if (mimeType) {
				if (options?.imageProcessor) {
					// 有处理器：交由其转换/缩放
					const processed = await options.imageProcessor(bytes, mimeType, {
						autoResizeImages: options.autoResizeImages ?? true,
					});
					if (!processed.ok) {
						// 处理失败：以文本说明代替图片
						return {
							content: [{ type: "text", text: `Read image file [${mimeType}]\n${processed.message}` }],
							details: undefined,
						};
					}
					const hints = processed.hints.length > 0 ? `\n${processed.hints.join("\n")}` : "";
					return {
						content: [
							{ type: "text", text: `Read image file [${processed.mimeType}]${hints}` },
							{ type: "image", data: processed.data, mimeType: processed.mimeType },
						] satisfies Array<TextContent | ImageContent>,
						details: undefined,
					};
				}
				if (mimeType === "image/bmp") {
					// 无处理器时 BMP 无法直接发送：省略图片并提示
					return {
						content: [
							{
								type: "text",
								text: "Read image file [image/bmp]\n[Image omitted: configure an imageProcessor to convert BMP images.]",
							},
						],
						details: undefined,
					};
				}
				// 其余受支持格式：Base64 直接送出
				return {
					content: [
						{ type: "text", text: `Read image file [${mimeType}]` },
						{ type: "image", data: encodeBase64(bytes), mimeType },
					] satisfies Array<TextContent | ImageContent>,
					details: undefined,
				};
			}

			// 文本分支：解码并按行切分
			const textContent = new TextDecoder().decode(bytes);
			const allLines = textContent.split("\n");
			const totalFileLines = allLines.length;
			// 起始行下标（0 起）：offset 为 1 起始的用户行号
			const startLine = offset ? Math.max(0, offset - 1) : 0;
			const startLineDisplay = startLine + 1;
			if (startLine >= allLines.length) {
				throw new Error(`Offset ${offset} is beyond end of file (${allLines.length} lines total)`);
			}

			let selectedContent: string;
			// 用户显式 limit 时实际取到的行数（用于计算剩余行提示）
			let userLimitedLines: number | undefined;
			if (limit !== undefined) {
				const endLine = Math.min(startLine + limit, allLines.length);
				selectedContent = allLines.slice(startLine, endLine).join("\n");
				userLimitedLines = endLine - startLine;
			} else {
				selectedContent = allLines.slice(startLine).join("\n");
			}

			// 对选中内容再做头部截断保护
			const truncation = truncateHead(selectedContent);
			let outputText: string;
			let details: ReadToolDetails | undefined;
			if (truncation.firstLineExceedsLimit) {
				// 特例：目标行本身超限——给出 bash 替代命令
				const firstLineSize = formatSize(new TextEncoder().encode(allLines[startLine]).byteLength);
				outputText = `[Line ${startLineDisplay} is ${firstLineSize}, exceeds ${formatSize(DEFAULT_MAX_BYTES)} limit. Use bash: sed -n '${startLineDisplay}p' ${path} | head -c ${DEFAULT_MAX_BYTES}]`;
				details = { truncation };
			} else if (truncation.truncated) {
				// 发生截断：附保留区间与续读 offset 提示
				const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
				const nextOffset = endLineDisplay + 1;
				outputText = truncation.content;
				if (truncation.truncatedBy === "lines") {
					outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
				} else {
					outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
				}
				details = { truncation };
			} else if (userLimitedLines !== undefined && startLine + userLimitedLines < allLines.length) {
				// 未触发系统截断但用户 limit 未读完：提示剩余行数
				const remaining = allLines.length - (startLine + userLimitedLines);
				const nextOffset = startLine + userLimitedLines + 1;
				outputText = `${truncation.content}\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
			} else {
				// 完整读取
				outputText = truncation.content;
			}

			return { content: [{ type: "text", text: outputText }], details };
		},
	};
}
