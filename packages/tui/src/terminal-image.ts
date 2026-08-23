import { execSync } from "node:child_process";

/**
 * 【文件职责】终端图片协议支持：探测终端能力（Kitty 图形协议/iTerm2/真彩色/OSC8 超链接），
 *              按协议编码图片传输序列，并从 PNG/JPEG/GIF/WebP 二进制中解析像素尺寸。
 * 【技术维度】Buffer 直接解析二进制魔数与元数据；base64 分块传输；环境变量驱动能力探测；
 *              tmux 转发探测用 execSync 子进程；能力结果带模块级缓存。
 * 【产品维度】让模型返回的截图/附件能直接在终端内联显示，无法显示时优雅降级为文字说明。
 * 【逻辑维度】类型定义 → 能力探测（环境判定 + 缓存）→ 协议编码（Kitty/iTerm2）→
 *              格尺寸计算 → 四类图片解析器 → renderImage 统一入口 → 超链接与降级文本。
 * 【关键边界】tmux/screen 下禁用图片与超链接；未知终端默认关超链接（避免 URL 被吞）；
 *              Kitty 序列超过 4096 字节必须分块；解析失败一律返回 null 不抛错。
 * 【新手阅读建议】先看 TerminalCapabilities 与 detectCapabilities 理解探测逻辑 →
 *              再读 encodeKitty 的分块机制 → 最后看任一 getXxxDimensions 了解二进制解析范式。
 */
export type ImageProtocol = "kitty" | "iterm2" | null;

/** 终端能力（中文说明）：images 图片协议类型；trueColor 是否支持真彩色；hyperlinks 是否支持 OSC8 超链接。 */
export interface TerminalCapabilities {
	images: ImageProtocol;
	// 图片协议：kitty / iterm2 / null（不支持）
	trueColor: boolean;
	// 是否支持真彩色（24 位色）
	hyperlinks: boolean;
	// 是否支持 OSC 8 可点击超链接
}

/** 单元格尺寸（中文说明）：终端一个字符格的像素宽高，用于图片格数换算。 */
export interface CellDimensions {
	widthPx: number;
	// 格宽（像素）
	heightPx: number;
	// 格高（像素）
}

/** 图片原始像素尺寸。 */
export interface ImageDimensions {
	widthPx: number;
	heightPx: number;
}

/** 图片渲染选项（中文说明）：限定显示格数、是否保持宽高比、Kitty 图片 ID 与光标行为。 */
export interface ImageRenderOptions {
	maxWidthCells?: number;
	maxHeightCells?: number;
	preserveAspectRatio?: boolean;
	/** Kitty image ID. If provided, reuses/replaces existing image with this ID. */
	// Kitty 图片 ID：提供时复用/替换该 ID 的既有图片
	imageId?: number;
	/** Whether Kitty should apply its default cursor movement after placement. */
	// Kitty 放置后是否执行默认光标移动（动画/覆盖场景置 false）
	moveCursor?: boolean;
}

// 能力探测结果缓存：进程内只探测一次
let cachedCapabilities: TerminalCapabilities | null = null;

// Default cell dimensions - updated by TUI when terminal responds to query
// 默认单元格像素尺寸：TUI 收到终端查询响应后会更新
let cellDimensions: CellDimensions = { widthPx: 9, heightPx: 18 };

// 读取当前单元格尺寸
export function getCellDimensions(): CellDimensions {
	return cellDimensions;
}

// 设置单元格尺寸（供 TUI 从终端查询结果写入）
export function setCellDimensions(dims: CellDimensions): void {
	cellDimensions = dims;
}

/**
 * Checks whether the attached tmux client forwards OSC 8 hyperlinks to the
 * outer terminal. tmux only re-emits them when its `client_termfeatures` lists
 * `hyperlinks`, and strips them otherwise. On any error fallbacks `false`.
 */
// 探测 tmux 是否转发 OSC 8 超链接（私有）：读取 client_termfeatures 特性列表；
// 命令失败或超时一律返回 false
function probeTmuxHyperlinks(): boolean {
	try {
		const termfeatures = execSync("tmux display-message -p '#{client_termfeatures}'", {
			encoding: "utf8",
			timeout: 250,
			stdio: ["ignore", "pipe", "ignore"],
		});
		return termfeatures
			.split(",")
			.map((feature) => feature.trim())
			.includes("hyperlinks");
	} catch {
		return false;
	}
}

// 探测终端能力（公开）：按环境变量逐级判定——
// tmux/screen 禁用图片与超链接；Kitty/Ghostty/WezTerm/Warp 支持 kitty 协议；
// iTerm 支持 iterm2 协议；Windows Terminal/VSCode/Alacritty 支持真彩色但无图片；
// 未知终端保守起见关闭超链接
export function detectCapabilities(tmuxForwardsHyperlink: () => boolean = probeTmuxHyperlinks): TerminalCapabilities {
	const termProgram = process.env.TERM_PROGRAM?.toLowerCase() || "";
	const terminalEmulator = process.env.TERMINAL_EMULATOR?.toLowerCase() || "";
	const term = process.env.TERM?.toLowerCase() || "";
	const colorTerm = process.env.COLORTERM?.toLowerCase() || "";
	const hasTrueColorHint = colorTerm === "truecolor" || colorTerm === "24bit";

	// Emit OSC 8 hyperlinks only when tmux confirms it forwards.
	// Image protocols are unreliable under tmux, so leave `images: null`.
	if (process.env.TMUX || term.startsWith("tmux")) {
		return { images: null, trueColor: hasTrueColorHint, hyperlinks: tmuxForwardsHyperlink() };
	}

	// screen does not forward OSC 8 hyperlinks, so keep them off there.
	if (term.startsWith("screen")) {
		return { images: null, trueColor: hasTrueColorHint, hyperlinks: false };
	}

	if (process.env.KITTY_WINDOW_ID || termProgram === "kitty") {
		return { images: "kitty", trueColor: true, hyperlinks: true };
	}

	if (termProgram === "ghostty" || term.includes("ghostty") || process.env.GHOSTTY_RESOURCES_DIR) {
		return { images: "kitty", trueColor: true, hyperlinks: true };
	}

	if (process.env.WEZTERM_PANE || termProgram === "wezterm") {
		return { images: "kitty", trueColor: true, hyperlinks: true };
	}

	// Warp supports the Kitty graphics protocol and OSC 8 hyperlinks.
	if (termProgram === "warpterminal" || process.env.WARP_SESSION_ID || process.env.WARP_TERMINAL_SESSION_UUID) {
		return { images: "kitty", trueColor: true, hyperlinks: true };
	}

	if (process.env.ITERM_SESSION_ID || termProgram === "iterm.app") {
		return { images: "iterm2", trueColor: true, hyperlinks: true };
	}

	if (process.env.WT_SESSION) {
		return { images: null, trueColor: true, hyperlinks: true };
	}

	if (termProgram === "vscode") {
		return { images: null, trueColor: true, hyperlinks: true };
	}

	if (termProgram === "alacritty") {
		return { images: null, trueColor: true, hyperlinks: true };
	}

	if (terminalEmulator === "jetbrains-jediterm") {
		return { images: null, trueColor: true, hyperlinks: false };
	}

	// Unknown terminal: be conservative. OSC 8 is rendered invisibly as "just
	// text" on terminals that swallow it, which means the URL disappears from
	// the rendered output. Default to the legacy `text (url)` behavior unless we
	// have positively identified a hyperlink-capable terminal above.
	return { images: null, trueColor: hasTrueColorHint, hyperlinks: false };
}

// 获取能力（公开）：带进程级缓存，首次调用时探测
export function getCapabilities(): TerminalCapabilities {
	if (!cachedCapabilities) {
		cachedCapabilities = detectCapabilities();
	}
	return cachedCapabilities;
}

// 清空能力缓存（测试或环境变化时调用）
export function resetCapabilitiesCache(): void {
	cachedCapabilities = null;
}

// 覆盖缓存的能力值（测试用：可强制走特定代码路径）
/** Override the cached capabilities. Useful in tests to exercise both code paths. */
export function setCapabilities(caps: TerminalCapabilities): void {
	cachedCapabilities = caps;
}

// Kitty 图形协议序列前缀
const KITTY_PREFIX = "\x1b_G";
// iTerm2 内联图片序列前缀
const ITERM2_PREFIX = "\x1b]1337;File=";

// 判断一行输出是否包含图片协议序列（公开）：先快路径查行首，再慢路径全行查找
export function isImageLine(line: string): boolean {
	// Fast path: sequence at line start (single-row images)
	// 快路径：序列出现在行首（单行图片）
	if (line.startsWith(KITTY_PREFIX) || line.startsWith(ITERM2_PREFIX)) {
		return true;
	}
	// Slow path: sequence elsewhere (multi-row images have cursor-up prefix)
	// 慢路径：序列在行中（多行图片带光标上移前缀）
	return line.includes(KITTY_PREFIX) || line.includes(ITERM2_PREFIX);
}

/**
 * Generate a random image ID for Kitty graphics protocol.
 * Uses random IDs to avoid collisions between different module instances
 * (e.g., main app vs extensions).
 */
// 生成随机图片 ID（公开）：1 到 2^32-1 范围内，避免多模块实例间冲突
export function allocateImageId(): number {
	// Use random ID in range [1, 0xffffffff] to avoid collisions
	// 用随机数生成 ID，规避跨实例冲突
	return Math.floor(Math.random() * 0xfffffffe) + 1;
}

// 编码 Kitty 图形协议序列（公开）：base64 数据 ≤4096 字节时单包发送，
// 否则按块分包（m=1 中间块 / m=0 末块）；可带列数/行数/图片 ID/光标行为参数
export function encodeKitty(
	base64Data: string,
	options: {
		columns?: number;
		rows?: number;
		imageId?: number;
		/** Whether Kitty should apply its default cursor movement after placement. Default: true. */
		// Kitty 放置后是否执行默认光标移动（默认 true）
		moveCursor?: boolean;
	} = {},
): string {
	// 单个数据包的最大 base64 字节数
	const CHUNK_SIZE = 4096;

	const params: string[] = ["a=T", "f=100", "q=2"];

	if (options.moveCursor === false) params.push("C=1");
	if (options.columns) params.push(`c=${options.columns}`);
	if (options.rows) params.push(`r=${options.rows}`);
	if (options.imageId) params.push(`i=${options.imageId}`);

	if (base64Data.length <= CHUNK_SIZE) {
		return `\x1b_G${params.join(",")};${base64Data}\x1b\\`;
	}

	const chunks: string[] = [];
	let offset = 0;
	let isFirst = true;

	while (offset < base64Data.length) {
		const chunk = base64Data.slice(offset, offset + CHUNK_SIZE);
		const isLast = offset + CHUNK_SIZE >= base64Data.length;

		if (isFirst) {
			chunks.push(`\x1b_G${params.join(",")},m=1;${chunk}\x1b\\`);
			isFirst = false;
		} else if (isLast) {
			chunks.push(`\x1b_Gm=0;${chunk}\x1b\\`);
		} else {
			chunks.push(`\x1b_Gm=1;${chunk}\x1b\\`);
		}

		offset += CHUNK_SIZE;
	}

	return chunks.join("");
}

/**
 * Delete a Kitty graphics image by ID.
 * Uses uppercase 'I' to also free the image data.
 */
// 按 ID 删除 Kitty 图片（公开）：使用大写 I 同时释放图片数据
export function deleteKittyImage(imageId: number): string {
	return `\x1b_Ga=d,d=I,i=${imageId},q=2\x1b\\`;
}

/**
 * Delete all visible Kitty graphics images.
 * Uses uppercase 'A' to also free the image data.
 */
// 删除全部可见 Kitty 图片（公开）：使用大写 A 同时释放数据
export function deleteAllKittyImages(): string {
	return "\x1b_Ga=d,d=A,q=2\x1b\\";
}

// 编码 iTerm2 内联图片序列（公开）：支持宽/高/名称（base64 编码）/宽高比/内联参数
export function encodeITerm2(
	base64Data: string,
	options: {
		width?: number | string;
		height?: number | string;
		name?: string;
		preserveAspectRatio?: boolean;
		inline?: boolean;
	} = {},
): string {
	const params: string[] = [`inline=${options.inline !== false ? 1 : 0}`];

	if (options.width !== undefined) params.push(`width=${options.width}`);
	if (options.height !== undefined) params.push(`height=${options.height}`);
	if (options.name) {
		const nameBase64 = Buffer.from(options.name).toString("base64");
		params.push(`name=${nameBase64}`);
	}
	if (options.preserveAspectRatio === false) {
		params.push("preserveAspectRatio=0");
	}

	return `\x1b]1337;File=${params.join(";")}:${base64Data}\x07`;
}

/** 图片占用的终端格数（中文说明）：columns 列数、rows 行数。 */
export interface ImageCellSize {
	columns: number;
	// 列数
	rows: number;
	// 行数
}

// 计算图片缩放后的格数（公开）：按“宽高比保持 + 双上限”求最小缩放系数，
// 像素换算为格数后向上取整并钳制到上限（至少 1 格）
export function calculateImageCellSize(
	imageDimensions: ImageDimensions,
	maxWidthCells: number,
	maxHeightCells?: number,
	cellDimensions: CellDimensions = { widthPx: 9, heightPx: 18 },
): ImageCellSize {
	const maxWidth = Math.max(1, Math.floor(maxWidthCells));
	const maxHeight = maxHeightCells === undefined ? undefined : Math.max(1, Math.floor(maxHeightCells));
	const imageWidth = Math.max(1, imageDimensions.widthPx);
	const imageHeight = Math.max(1, imageDimensions.heightPx);

	const widthScale = (maxWidth * cellDimensions.widthPx) / imageWidth;
	const heightScale = maxHeight === undefined ? widthScale : (maxHeight * cellDimensions.heightPx) / imageHeight;
	const scale = Math.min(widthScale, heightScale);

	const scaledWidthPx = imageWidth * scale;
	const scaledHeightPx = imageHeight * scale;
	const columns = Math.ceil(scaledWidthPx / cellDimensions.widthPx);
	const rows = Math.ceil(scaledHeightPx / cellDimensions.heightPx);

	return {
		columns: Math.max(1, Math.min(maxWidth, columns)),
		rows: Math.max(1, maxHeight === undefined ? rows : Math.min(maxHeight, rows)),
	};
}

// 按目标宽度计算图片占用行数（公开）：委托 calculateImageCellSize 取 rows
export function calculateImageRows(
	imageDimensions: ImageDimensions,
	targetWidthCells: number,
	cellDimensions: CellDimensions = { widthPx: 9, heightPx: 18 },
): number {
	return calculateImageCellSize(imageDimensions, targetWidthCells, undefined, cellDimensions).rows;
}

// 从 PNG 数据解析像素尺寸（公开）：校验签名（89 50 4E 47）后读取 IHDR 的宽高（偏移 16/20）
export function getPngDimensions(base64Data: string): ImageDimensions | null {
	try {
		const buffer = Buffer.from(base64Data, "base64");

		if (buffer.length < 24) {
			return null;
		}

		if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
			return null;
		}

		const width = buffer.readUInt32BE(16);
		const height = buffer.readUInt32BE(20);

		return { widthPx: width, heightPx: height };
	} catch {
		return null;
	}
}

// 从 JPEG 数据解析像素尺寸（公开）：扫描段结构，遇 SOF0-SOF2（C0-C2）段读取宽高
export function getJpegDimensions(base64Data: string): ImageDimensions | null {
	try {
		const buffer = Buffer.from(base64Data, "base64");

		if (buffer.length < 2) {
			return null;
		}

		if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
			return null;
		}

		let offset = 2;
		while (offset < buffer.length - 9) {
			if (buffer[offset] !== 0xff) {
				offset++;
				continue;
			}

			const marker = buffer[offset + 1];

			if (marker >= 0xc0 && marker <= 0xc2) {
				const height = buffer.readUInt16BE(offset + 5);
				const width = buffer.readUInt16BE(offset + 7);
				return { widthPx: width, heightPx: height };
			}

			if (offset + 3 >= buffer.length) {
				return null;
			}
			const length = buffer.readUInt16BE(offset + 2);
			if (length < 2) {
				return null;
			}
			offset += 2 + length;
		}

		return null;
	} catch {
		return null;
	}
}

// 从 GIF 数据解析像素尺寸（公开）：校验 GIF87a/GIF89a 签名后读取偏移 6/8 的小端宽高
export function getGifDimensions(base64Data: string): ImageDimensions | null {
	try {
		const buffer = Buffer.from(base64Data, "base64");

		if (buffer.length < 10) {
			return null;
		}

		const sig = buffer.slice(0, 6).toString("ascii");
		if (sig !== "GIF87a" && sig !== "GIF89a") {
			return null;
		}

		const width = buffer.readUInt16LE(6);
		const height = buffer.readUInt16LE(8);

		return { widthPx: width, heightPx: height };
	} catch {
		return null;
	}
}

// 从 WebP 数据解析像素尺寸（公开）：按 VP8 / VP8L / VP8X 三种块格式分别读取
export function getWebpDimensions(base64Data: string): ImageDimensions | null {
	try {
		const buffer = Buffer.from(base64Data, "base64");

		if (buffer.length < 30) {
			return null;
		}

		const riff = buffer.slice(0, 4).toString("ascii");
		const webp = buffer.slice(8, 12).toString("ascii");
		if (riff !== "RIFF" || webp !== "WEBP") {
			return null;
		}

		const chunk = buffer.slice(12, 16).toString("ascii");
		if (chunk === "VP8 ") {
			if (buffer.length < 30) return null;
			const width = buffer.readUInt16LE(26) & 0x3fff;
			const height = buffer.readUInt16LE(28) & 0x3fff;
			return { widthPx: width, heightPx: height };
		} else if (chunk === "VP8L") {
			if (buffer.length < 25) return null;
			const bits = buffer.readUInt32LE(21);
			const width = (bits & 0x3fff) + 1;
			const height = ((bits >> 14) & 0x3fff) + 1;
			return { widthPx: width, heightPx: height };
		} else if (chunk === "VP8X") {
			if (buffer.length < 30) return null;
			const width = (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1;
			const height = (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1;
			return { widthPx: width, heightPx: height };
		}

		return null;
	} catch {
		return null;
	}
}

// 按 MIME 分派到对应解析器（公开）；不支持的格式返回 null
export function getImageDimensions(base64Data: string, mimeType: string): ImageDimensions | null {
	if (mimeType === "image/png") {
		return getPngDimensions(base64Data);
	}
	if (mimeType === "image/jpeg") {
		return getJpegDimensions(base64Data);
	}
	if (mimeType === "image/gif") {
		return getGifDimensions(base64Data);
	}
	if (mimeType === "image/webp") {
		return getWebpDimensions(base64Data);
	}
	return null;
}

// 渲染图片为终端序列（公开）：终端无图片能力返回 null；
// Kitty 返回编码序列+行数+图片 ID；iTerm2 返回编码序列+行数
export function renderImage(
	base64Data: string,
	imageDimensions: ImageDimensions,
	options: ImageRenderOptions = {},
): { sequence: string; rows: number; imageId?: number } | null {
	const caps = getCapabilities();

	if (!caps.images) {
		return null;
	}

	const maxWidth = options.maxWidthCells ?? 80;
	const size = calculateImageCellSize(imageDimensions, maxWidth, options.maxHeightCells, getCellDimensions());

	if (caps.images === "kitty") {
		const sequence = encodeKitty(base64Data, {
			columns: size.columns,
			rows: size.rows,
			imageId: options.imageId,
			moveCursor: options.moveCursor,
		});
		return { sequence, rows: size.rows, imageId: options.imageId };
	}

	if (caps.images === "iterm2") {
		const sequence = encodeITerm2(base64Data, {
			width: size.columns,
			height: "auto",
			preserveAspectRatio: options.preserveAspectRatio ?? true,
		});
		return { sequence, rows: size.rows };
	}

	return null;
}

/**
 * Wrap text in an OSC 8 hyperlink sequence.
 * The text is rendered as a clickable hyperlink in terminals that support OSC 8
 * (Ghostty, Kitty, WezTerm, iTerm2, VSCode, and others).
 * In terminals that do not support OSC 8, the escape sequences are ignored
 * and only the plain text is displayed.
 *
 * @param text - The visible text to display
 * @param url - The URL to link to
 */
// 把文本包成 OSC 8 可点击超链接（公开）：不支持 OSC8 的终端会忽略序列只显示文本
export function hyperlink(text: string, url: string): string {
	return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

// 生成图片降级占位文本（公开）：如 "[Image: screenshot.png [image/png] 800x600]"
export function imageFallback(mimeType: string, dimensions?: ImageDimensions, filename?: string): string {
	const parts: string[] = [];
	if (filename) parts.push(filename);
	parts.push(`[${mimeType}]`);
	if (dimensions) parts.push(`${dimensions.widthPx}x${dimensions.heightPx}`);
	return `[Image: ${parts.join(" ")}]`;
}
