import {
	allocateImageId,
	getCapabilities,
	getCellDimensions,
	getImageDimensions,
	type ImageDimensions,
	imageFallback,
	renderImage,
} from "../terminal-image.ts";
import type { Component } from "../tui.ts";
import { truncateToWidth } from "../utils.ts";

/**
 * 【文件职责】实现 Image 图片组件：在支持图片协议（Kitty/iTerm2）的终端中内嵌渲染图片，
 *              不支持时降级为占位文本；带宽度级缓存与 Kitty 图片 ID 复用。
 * 【技术维度】实现 Component 接口；委托 terminal-image 的能力探测/渲染/回退；
 *              Kitty 协议用 C=1 防止光标移动，其他协议用光标上移序列保证布局占位正确。
 * 【产品维度】让模型读取的截图/图片能直接显示在终端会话里，无图片能力时也有可读的替代说明。
 * 【逻辑维度】构造时解析图片尺寸 → render：缓存命中判断 → 计算最大宽高 → 按终端能力分支
 *              （kitty / 其他协议 / 降级文本）→ 写缓存。
 * 【关键边界】maxWidthCells 默认 60；无尺寸信息时按 800×600 兜底；Kitty 首次渲染时分配图片 ID；
 *              渲染失败自动走 fallback 文本。
 * 【新手阅读建议】先看 ImageOptions 各字段 → 再通读 render 的三分支结构 →
 *              最后对照注释理解两种协议下占位行数的差异。
 */
export interface ImageTheme {
	// 降级占位文本的着色函数
	fallbackColor: (str: string) => string;
}

/** 图片选项（中文说明）：maxWidthCells/maxHeightCells 限制显示尺寸（单位：终端格）；
 * filename 用于降级文本；imageId 复用 Kitty 图片 ID（动画/更新场景）。 */
export interface ImageOptions {
	// 最大显示宽度（终端格数）
	maxWidthCells?: number;
	// 最大显示高度（终端格数）；省略时按图片宽高比推算
	maxHeightCells?: number;
	// 文件名：降级占位文本中展示
	filename?: string;
	/** Kitty image ID. If provided, reuses this ID (for animations/updates). */
	// Kitty 图片 ID：提供时复用同一 ID 实现动画帧更新
	imageId?: number;
}

/**
 * Image 组件（中文说明）：持有 base64 图片数据、MIME、尺寸、主题与选项；
 * 渲染结果按宽度缓存。
 */
export class Image implements Component {
	// 图片的 base64 编码数据
	private base64Data: string;
	// 图片 MIME 类型
	private mimeType: string;
	// 图片原始像素尺寸
	private dimensions: ImageDimensions;
	// 外观主题（降级文本着色）
	private theme: ImageTheme;
	// 显示选项
	private options: ImageOptions;
	// Kitty 协议使用的图片 ID
	private imageId?: number;

	// 渲染结果缓存
	private cachedLines?: string[];
	// 缓存对应的渲染宽度
	private cachedWidth?: number;

	// 构造函数：未提供尺寸时自动探测，再不行按 800×600 兜底
	constructor(
		base64Data: string,
		mimeType: string,
		theme: ImageTheme,
		options: ImageOptions = {},
		dimensions?: ImageDimensions,
	) {
		this.base64Data = base64Data;
		this.mimeType = mimeType;
		this.theme = theme;
		this.options = options;
		this.dimensions = dimensions || getImageDimensions(base64Data, mimeType) || { widthPx: 800, heightPx: 600 };
		this.imageId = options.imageId;
	}

	/** Get the Kitty image ID used by this image (if any). */
	// 获取本图片使用的 Kitty 图片 ID（未分配则 undefined）
	getImageId(): number | undefined {
		return this.imageId;
	}

	// 失效渲染缓存
	invalidate(): void {
		this.cachedLines = undefined;
		this.cachedWidth = undefined;
	}

	// 渲染（公开）：按终端能力三分支——Kitty 协议 / 其他图片协议 / 降级文本
	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		// 计算实际可用宽高：宽度取“视口-2”与选项的较小值；高度缺省时按格像素比推算
		const maxWidth = Math.max(1, Math.min(width - 2, this.options.maxWidthCells ?? 60));
		const cellDimensions = getCellDimensions();
		const defaultMaxHeight = Math.max(1, Math.ceil((maxWidth * cellDimensions.widthPx) / cellDimensions.heightPx));
		const maxHeight = this.options.maxHeightCells ?? defaultMaxHeight;

		const caps = getCapabilities();
		let lines: string[];

		// 终端支持图片协议
		if (caps.images) {
			// Kitty 协议且尚未分配 ID：先分配
			if (caps.images === "kitty" && this.imageId === undefined) {
				this.imageId = allocateImageId();
			}
			const result = renderImage(this.base64Data, this.dimensions, {
				maxWidthCells: maxWidth,
				maxHeightCells: maxHeight,
				imageId: this.imageId,
				moveCursor: false,
			});

			if (result) {
				// Store the image ID for later cleanup
				// 记录渲染器返回的图片 ID，供后续清理/更新
				if (result.imageId) {
					this.imageId = result.imageId;
				}

				if (caps.images === "kitty") {
					// For Kitty: C=1 prevents cursor movement.
					// Don't need the cursor movement.
					lines = [result.sequence];

					// Return `rows` lines so TUI accounts for image height.
					for (let i = 0; i < result.rows - 1; i++) {
						lines.push("");
					}
				} else {
					// Return `rows` lines so TUI accounts for image height.
					// First (rows-1) lines are empty and cleared before the image is drawn.
					// Last line: move cursor back up, draw the image, then move back down
					// so TUI cursor accounting stays inside the scroll area.
					lines = [];
					for (let i = 0; i < result.rows - 1; i++) {
						lines.push("");
					}
					const rowOffset = result.rows - 1;
					const moveUp = rowOffset > 0 ? `\x1b[${rowOffset}A` : "";
					lines.push(moveUp + result.sequence);
				}
			} else {
				// 渲染失败或终端不支持：生成降级占位文本并着色
				const fallback = imageFallback(this.mimeType, this.dimensions, this.options.filename);
				lines = [truncateToWidth(this.theme.fallbackColor(fallback), width)];
			}
		} else {
			const fallback = imageFallback(this.mimeType, this.dimensions, this.options.filename);
			lines = [truncateToWidth(this.theme.fallbackColor(fallback), width)];
		}

		// 写入缓存
		this.cachedLines = lines;
		this.cachedWidth = width;

		return lines;
	}
}
