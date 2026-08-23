/**
 * 【文件职责】图片格式嗅探与 Base64 编码工具：通过魔数（magic bytes）识别 JPEG/PNG/GIF/WebP/BMP，
 *              排除动画 PNG 等不受支持的变体，并提供无依赖的 Base64 编码实现。
 * 【技术维度】二进制魔数匹配 + 手写大端/小端整数读取；PNG 块结构遍历（检测 acTL 动画块）；
 *              纯手写 Base64 算法（不依赖运行时 btoa/Buffer）。
 * 【产品维度】read 工具把本地图片转为模型可读的 image 内容块前，需要先确认格式受支持，
 *              避免把不兼容数据发给模型供应商导致请求失败。
 * 【逻辑维度】detectSupportedImageMimeType 按常见格式逐一匹配魔数 → 各 isXxx 校验结构合法性 →
 *              encodeBase64 每 3 字节编 4 字符、尾部补 =。
 * 【关键边界】渐进式 JPEG（0xFF 0xD8 0xFF 0xF7）与动画 PNG 返回 undefined（不支持）；
 *              BMP 仅接受 1/4/8/16/24/32 位且单色板的常规文件；越界读取按 0 处理不抛错。
 * 【新手阅读建议】先看 PNG_SIGNATURE 与 detectSupportedImageMimeType 主流程 → 再按需阅读各 isXxx
 *              与底层 readUint/startsWith 辅助函数。
 */

// PNG 文件魔数（8 字节固定签名）
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * 探测受支持的图片 MIME 类型（中文说明）：按 JPEG→PNG→GIF→WebP→BMP 顺序匹配魔数；
 * 不支持或无法识别返回 undefined。参数 buffer —— 文件头部字节。返回 MIME 字符串或 undefined。
 */
export function detectSupportedImageMimeType(buffer: Uint8Array): string | undefined {
	// JPEG：FF D8 FF 开头；第 4 字节 0xF7 表示渐进式，不支持
	if (startsWith(buffer, [0xff, 0xd8, 0xff])) return buffer[3] === 0xf7 ? undefined : "image/jpeg";
	// PNG：签名匹配且为非动画的标准 PNG
	if (startsWith(buffer, PNG_SIGNATURE)) return isPng(buffer) && !isAnimatedPng(buffer) ? "image/png" : undefined;
	// GIF：ASCII "GIF" 开头
	if (startsWithAscii(buffer, 0, "GIF")) return "image/gif";
	// WebP：RIFF 容器 + 偏移 8 处 "WEBP"
	if (startsWithAscii(buffer, 0, "RIFF") && startsWithAscii(buffer, 8, "WEBP")) return "image/webp";
	// BMP："BM" 开头且结构校验通过
	if (startsWithAscii(buffer, 0, "BM") && isBmp(buffer)) return "image/bmp";
	return undefined;
}

/**
 * 手写 Base64 编码（中文说明）：每 3 字节映射为 4 个字母表字符；不足 3 字节时以 '=' 补位。
 * 参数 bytes —— 原始字节。返回 Base64 字符串。
 */
export function encodeBase64(bytes: Uint8Array): string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	let output = "";
	for (let index = 0; index < bytes.length; index += 3) {
		const first = bytes[index] ?? 0;
		const second = bytes[index + 1];
		const third = bytes[index + 2];
		output += alphabet[first >> 2];
		output += alphabet[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
		output += second === undefined ? "=" : alphabet[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
		output += third === undefined ? "=" : alphabet[third & 0x3f];
	}
	return output;
}

// 是否为标准 PNG（私有）：长度足够、IHDR 块长度字段为 13、偏移 12 处为 "IHDR"
function isPng(buffer: Uint8Array): boolean {
	return (
		buffer.length >= 16 && readUint32BE(buffer, PNG_SIGNATURE.length) === 13 && startsWithAscii(buffer, 12, "IHDR")
	);
}

// 是否为动画 PNG（私有）：遍历 PNG 块链，先于 IDAT 出现 acTL 块即为动画；结构异常按非动画处理
function isAnimatedPng(buffer: Uint8Array): boolean {
	let offset = PNG_SIGNATURE.length;
	while (offset + 8 <= buffer.length) {
		const chunkLength = readUint32BE(buffer, offset);
		const chunkTypeOffset = offset + 4;
		if (startsWithAscii(buffer, chunkTypeOffset, "acTL")) return true;
		if (startsWithAscii(buffer, chunkTypeOffset, "IDAT")) return false;
		const nextOffset = offset + 8 + chunkLength + 4;
		if (nextOffset <= offset || nextOffset > buffer.length) return false;
		offset = nextOffset;
	}
	return false;
}

// 是否为结构合法的 BMP（私有）：校验文件大小声明、像素数据偏移、DIB 头尺寸与色板/位深
function isBmp(buffer: Uint8Array): boolean {
	if (buffer.length < 26) return false;
	const declaredFileSize = readUint32LE(buffer, 2);
	const pixelDataOffset = readUint32LE(buffer, 10);
	const dibHeaderSize = readUint32LE(buffer, 14);
	if (declaredFileSize !== 0 && declaredFileSize < 26) return false;
	if (pixelDataOffset < 14 + dibHeaderSize) return false;
	if (declaredFileSize !== 0 && pixelDataOffset >= declaredFileSize) return false;

	let colorPlanes: number;
	let bitsPerPixel: number;
	if (dibHeaderSize === 12) {
		// BITMAPCOREHEADER：字段位置不同
		colorPlanes = readUint16LE(buffer, 22);
		bitsPerPixel = readUint16LE(buffer, 24);
	} else if (dibHeaderSize >= 40 && dibHeaderSize <= 124) {
		// 常规 BITMAPINFOHEADER 及后续扩展头
		if (buffer.length < 30) return false;
		colorPlanes = readUint16LE(buffer, 26);
		bitsPerPixel = readUint16LE(buffer, 28);
	} else {
		return false;
	}
	return colorPlanes === 1 && [1, 4, 8, 16, 24, 32].includes(bitsPerPixel);
}

// 读取 16 位小端整数（私有）：越界按 0
function readUint16LE(buffer: Uint8Array, offset: number): number {
	return (buffer[offset] ?? 0) + ((buffer[offset + 1] ?? 0) << 8);
}

// 读取 32 位大端整数（私有）：越界按 0
function readUint32BE(buffer: Uint8Array, offset: number): number {
	return (
		(buffer[offset] ?? 0) * 0x1000000 +
		((buffer[offset + 1] ?? 0) << 16) +
		((buffer[offset + 2] ?? 0) << 8) +
		(buffer[offset + 3] ?? 0)
	);
}

// 读取 32 位小端整数（私有）：越界按 0
function readUint32LE(buffer: Uint8Array, offset: number): number {
	return (
		(buffer[offset] ?? 0) +
		((buffer[offset + 1] ?? 0) << 8) +
		((buffer[offset + 2] ?? 0) << 16) +
		(buffer[offset + 3] ?? 0) * 0x1000000
	);
}

// 前缀字节匹配（私有）：buffer 是否以指定字节序列开头
function startsWith(buffer: Uint8Array, bytes: number[]): boolean {
	if (buffer.length < bytes.length) return false;
	return bytes.every((byte, index) => buffer[index] === byte);
}

// ASCII 前缀匹配（私有）：buffer 从 offset 起是否以 text 的 ASCII 编码开头
function startsWithAscii(buffer: Uint8Array, offset: number, text: string): boolean {
	if (buffer.length < offset + text.length) return false;
	for (let index = 0; index < text.length; index++) {
		if (buffer[offset + index] !== text.charCodeAt(index)) return false;
	}
	return true;
}
