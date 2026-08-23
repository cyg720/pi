/**
 * 【文件职责】终端颜色环境探测：解析 OSC 11 背景色响应与 CSI 997 配色方案上报，
 *              让应用知晓终端是深色还是浅色主题并拿到背景 RGB。
 * 【技术维度】手写正则匹配 ANSI/OSC 转义响应；十六进制/rgba 两种颜色格式解析；通道宽度自适应归一化。
 * 【产品维度】启动时自动适配终端明暗主题（如浅色终端下切换更合适的配色），提升可读性与美观度。
 * 【逻辑维度】hexToRgb/parseOscHexChannel 两个解析基元 → 两个响应模式常量 →
 *              isOsc11BackgroundColorResponse 判定 / parseOsc11BackgroundColor 取色 /
 *              parseTerminalColorSchemeReport 判明暗。
 * 【关键边界】仅识别 #rrggbb、#rrrrggggbbbb 与 rgb(a):r/g/b 三种格式；非法输入一律返回 undefined；
 *              997 上报中 1=dark、2=light。
 * 【新手阅读建议】先看两个导出 parse 函数的用途 → 再回看两个 PATTERN 正则理解响应长什么样。
 */
export interface RgbColor {
	// 红色分量（0-255）
	r: number;
	// 绿色分量（0-255）
	g: number;
	// 蓝色分量（0-255）
	b: number;
}

// 终端配色方案：深色或浅色
export type TerminalColorScheme = "dark" | "light";

// 六位十六进制（可带 #）转 RGB（私有）
function hexToRgb(hex: string): RgbColor {
	const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
	const r = parseInt(normalized.slice(0, 2), 16);
	const g = parseInt(normalized.slice(2, 4), 16);
	const b = parseInt(normalized.slice(4, 6), 16);
	return { r, g, b };
}

// 解析 OSC 十六进制颜色通道（私有）：按位数求满值后比例折算到 0-255；非十六进制返回 undefined
function parseOscHexChannel(channel: string): number | undefined {
	if (!/^[0-9a-f]+$/i.test(channel)) {
		return undefined;
	}
	const max = 16 ** channel.length - 1;
	if (max <= 0) {
		return undefined;
	}
	return Math.round((parseInt(channel, 16) / max) * 255);
}

// OSC 11 背景色响应模式：形如 ESC ]11;<颜色值> BEL 或 ESC \
const OSC11_BACKGROUND_COLOR_RESPONSE_PATTERN = /^\x1b\]11;([^\x07\x1b]*)(?:\x07|\x1b\\)$/i;
// CSI 997 配色方案上报模式：1=深色，2=浅色
const COLOR_SCHEME_REPORT_PATTERN = /^\x1b\[\?997;(1|2)n$/;

// 判断一段终端输出是否为 OSC 11 背景色响应（公开）
export function isOsc11BackgroundColorResponse(data: string): boolean {
	return OSC11_BACKGROUND_COLOR_RESPONSE_PATTERN.test(data);
}

// 从 OSC 11 响应中解析背景色 RGB（公开）：支持 #rrggbb、16 位十六进制与 rgb(a):r/g/b 三种写法；
// 无法解析返回 undefined
export function parseOsc11BackgroundColor(data: string): RgbColor | undefined {
	const match = data.match(OSC11_BACKGROUND_COLOR_RESPONSE_PATTERN);
	if (!match) {
		return undefined;
	}

	const value = match[1].trim();
	if (value.startsWith("#")) {
		const hex = value.slice(1);
		if (/^[0-9a-f]{6}$/i.test(hex)) {
			return hexToRgb(value);
		}
		if (/^[0-9a-f]{12}$/i.test(hex)) {
			const r = parseOscHexChannel(hex.slice(0, 4));
			const g = parseOscHexChannel(hex.slice(4, 8));
			const b = parseOscHexChannel(hex.slice(8, 12));
			return r !== undefined && g !== undefined && b !== undefined ? { r, g, b } : undefined;
		}
		return undefined;
	}

	const rgbValue = value.replace(/^rgba?:/i, "");
	const [red, green, blue] = rgbValue.split("/");
	if (red === undefined || green === undefined || blue === undefined) {
		return undefined;
	}
	const r = parseOscHexChannel(red);
	const g = parseOscHexChannel(green);
	const b = parseOscHexChannel(blue);
	return r !== undefined && g !== undefined && b !== undefined ? { r, g, b } : undefined;
}

// 从 CSI 997 上报中解析配色方案（公开）：2 视为浅色，其余视为深色；非该格式返回 undefined
export function parseTerminalColorSchemeReport(data: string): TerminalColorScheme | undefined {
	const match = data.match(COLOR_SCHEME_REPORT_PATTERN);
	if (!match) {
		return undefined;
	}
	return match[1] === "2" ? "light" : "dark";
}
