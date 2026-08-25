/**
 * 文件职责：提供命令行工具，用于计算主题色对比度、测试 JSON 颜色表并检查内置明暗主题。
 * 技术维度：使用 RGB/HSL 颜色转换、WCAG 相对亮度公式、ANSI 真彩色转义和主题运行时接口。
 * 产品维度：帮助主题开发者选择可读颜色，降低文字在明暗背景上对比不足的无障碍风险。
 * 逻辑维度：先定义颜色数学工具，再实现 contrast、test、light/dark 三类命令，最后解析命令行参数。
 * 关键边界：目标对比度按纯白或纯黑背景计算；JSON 只检查十六进制颜色；脚本会设置 COLORTERM。
 * 新手阅读建议：先从底部命令分派找到入口，再分别阅读 cmdTest、cmdTheme，最后理解 HSL 二分调整算法。
 */
import fs from "fs";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";

/**
 * 将六位十六进制颜色转换为 RGB。
 * @param hex 形如 #rrggbb 或 rrggbb 的颜色文本。
 * @returns 0–255 的红绿蓝三元组；格式无效时返回全零。
 * @example hexToRgb("#ffffff");
 */
// --- Color utilities ---
// --- 颜色工具：负责格式转换、亮度、对比度和自动调色。---

function hexToRgb(hex: string): [number, number, number] {
	/** 正则匹配得到的三个十六进制通道。 */
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
}

/**
 * 将 RGB 通道压入合法范围并转换为六位十六进制颜色。
 * @param r 红色通道。
 * @param g 绿色通道。
 * @param b 蓝色通道。
 * @returns 带 # 的小写十六进制颜色。
 * @example rgbToHex(255, 0, 0);
 */
function rgbToHex(r: number, g: number, b: number): string {
	return (
		"#" +
		[r, g, b]
			.map((x) =>
				Math.round(Math.max(0, Math.min(255, x)))
					.toString(16)
					.padStart(2, "0"),
			)
			.join("")
	);
}

/**
 * 将 0–255 RGB 转换为 0–1 HSL。
 * @param r 红色通道。
 * @param g 绿色通道。
 * @param b 蓝色通道。
 * @returns 色相、饱和度、亮度三元组。
 * @example rgbToHsl(255, 0, 0);
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
	r /= 255;
	g /= 255;
	b /= 255;
	/** 归一化通道中的最大值和最小值。 */
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	/** 色相和饱和度；灰色时均保持 0。 */
	let h = 0,
		s = 0;
	/** HSL 亮度。 */
	const l = (max + min) / 2;
	if (max !== min) {
		/** 最大与最小通道差，用于计算色相和饱和度。 */
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}
	return [h, s, l];
}

/**
 * 将 0–1 HSL 转换为 0–255 RGB。
 * @param h 色相。
 * @param s 饱和度。
 * @param l 亮度。
 * @returns 四舍五入后的红绿蓝三元组。
 * @example hslToRgb(0, 1, 0.5);
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	/** 计算过程中使用的红绿蓝归一化通道。 */
	let r: number, g: number, b: number;
	if (s === 0) {
		r = g = b = l;
	} else {
		/**
		 * 根据相邻色相区间插值得到单个 RGB 通道。
		 * @param p 较低插值端点。
		 * @param q 较高插值端点。
		 * @param t 经偏移的色相。
		 * @returns 0–1 通道值。
		 */
		const hue2rgb = (p: number, q: number, t: number) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};
		/** HSL 转 RGB 的较高插值端点。 */
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		/** HSL 转 RGB 的较低插值端点。 */
		const p = 2 * l - q;
		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}
	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * 按 WCAG 公式计算 RGB 相对亮度。
 * @param r 红色通道。
 * @param g 绿色通道。
 * @param b 蓝色通道。
 * @returns 0（黑）到 1（白）的相对亮度。
 * @example getLuminance(255, 255, 255);
 */
function getLuminance(r: number, g: number, b: number): number {
	/**
	 * 把一个 sRGB 通道线性化。
	 * @param c 0–255 通道值。
	 * @returns 0–1 线性亮度分量。
	 */
	const lin = (c: number) => {
		c = c / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * 计算前景 RGB 与已知背景亮度的 WCAG 对比度。
 * @param rgb 前景红绿蓝三元组。
 * @param bgLum 背景相对亮度，纯黑为 0、纯白为 1。
 * @returns 1–21 的对比度。
 * @example getContrast([0, 0, 0], 1);
 */
function getContrast(rgb: [number, number, number], bgLum: number): number {
	/** 前景颜色的相对亮度。 */
	const fgLum = getLuminance(...rgb);
	/** 前景和背景中较亮者的亮度。 */
	const lighter = Math.max(fgLum, bgLum);
	/** 前景和背景中较暗者的亮度。 */
	const darker = Math.min(fgLum, bgLum);
	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 保持色相和饱和度，通过二分亮度逼近目标对比度。
 * @param hex 原始颜色。
 * @param targetContrast 期望对比度。
 * @param againstWhite true 表示对白底调暗，false 表示对黑底调亮。
 * @returns 调整后的十六进制颜色。
 * @example adjustColorToContrast("#5f8787", 4.5, true);
 */
function adjustColorToContrast(hex: string, targetContrast: number, againstWhite: boolean): string {
	/** 原始颜色的 RGB 值。 */
	const rgb = hexToRgb(hex);
	/** 原始颜色的色相和饱和度，调色过程中保持不变。 */
	const [h, s] = rgbToHsl(...rgb);
	/** 纯白或纯黑背景亮度。 */
	const bgLum = againstWhite ? 1.0 : 0.0;

	/** 二分搜索亮度的下界。 */
	let lo = againstWhite ? 0 : 0.5;
	/** 二分搜索亮度的上界。 */
	let hi = againstWhite ? 0.5 : 1.0;

	for (let i = 0; i < 50; i++) {
		/** 当前尝试的 HSL 亮度中点。 */
		const mid = (lo + hi) / 2;
		/** 当前亮度生成的 RGB 值。 */
		const testRgb = hslToRgb(h, s, mid);
		/** 当前颜色相对目标背景的对比度。 */
		const contrast = getContrast(testRgb, bgLum);

		if (againstWhite) {
			if (contrast < targetContrast) hi = mid;
			else lo = mid;
		} else {
			if (contrast < targetContrast) lo = mid;
			else hi = mid;
		}
	}

	/** 搜索结束后最接近目标对比度的亮度。 */
	const finalL = againstWhite ? lo : hi;
	return rgbToHex(...hslToRgb(h, s, finalL));
}

/**
 * 为十六进制颜色生成 ANSI 24 位前景色转义序列。
 * @param hex 前景颜色。
 * @returns 终端真彩色控制字符串。
 * @example fgAnsi("#ff0000");
 */
function fgAnsi(hex: string): string {
	/** 要写入 ANSI 序列的 RGB 通道。 */
	const rgb = hexToRgb(hex);
	return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
}

/** 清除 ANSI 样式的终端控制序列。 */
const reset = "\x1b[0m";

/**
 * 输出基础颜色在明暗背景上达到目标对比度后的建议值。
 * @param targetContrast 目标 WCAG 对比度，通常为 4.5。
 * @returns 无返回值，结果写入标准输出。
 * @example cmdContrast(4.5);
 */
// --- Commands ---
// --- 命令实现：分别计算建议色、检查文件和展示内置主题。---

function cmdContrast(targetContrast: number): void {
	/** 待调整的基础主题颜色表。 */
	const baseColors = {
		teal: "#5f8787",
		blue: "#5f87af",
		green: "#87af87",
		yellow: "#d7af5f",
		red: "#af5f5f",
	};

	console.log(`\n=== Colors adjusted to ${targetContrast}:1 contrast ===\n`);

	console.log("For LIGHT theme (vs white):");
	for (const [name, hex] of Object.entries(baseColors)) {
		/** 当前颜色针对白底调整后的值。 */
		const adjusted = adjustColorToContrast(hex, targetContrast, true);
		/** 调整后颜色的 RGB 通道。 */
		const rgb = hexToRgb(adjusted);
		/** 调整后颜色对白底的实际对比度。 */
		const contrast = getContrast(rgb, 1.0);
		console.log(`  ${name.padEnd(8)} ${fgAnsi(adjusted)}Sample${reset}  ${adjusted}  (${contrast.toFixed(2)}:1)`);
	}

	console.log("\nFor DARK theme (vs black):");
	for (const [name, hex] of Object.entries(baseColors)) {
		/** 当前颜色针对黑底调整后的值。 */
		const adjusted = adjustColorToContrast(hex, targetContrast, false);
		/** 调整后颜色的 RGB 通道。 */
		const rgb = hexToRgb(adjusted);
		/** 调整后颜色对黑底的实际对比度。 */
		const contrast = getContrast(rgb, 0.0);
		console.log(`  ${name.padEnd(8)} ${fgAnsi(adjusted)}Sample${reset}  ${adjusted}  (${contrast.toFixed(2)}:1)`);
	}
}

/**
 * 读取 JSON 颜色表并输出每个颜色对黑白背景的 WCAG 等级。
 * @param filePath 主题 JSON 文件路径，支持根对象或 vars 对象。
 * @returns 无返回值；文件不存在时以状态码 1 退出。
 * @example cmdTest("theme.json");
 */
function cmdTest(filePath: string): void {
	if (!fs.existsSync(filePath)) {
		console.error(`File not found: ${filePath}`);
		process.exit(1);
	}

	/** 解析后的主题 JSON 数据。 */
	const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
	/** 实际颜色变量表，优先使用 data.vars。 */
	const vars = data.vars || data;

	console.log(`\n=== Testing ${filePath} ===\n`);

	// name 和 hex 分别是主题变量名称及其十六进制颜色值。
	for (const [name, hex] of Object.entries(vars as Record<string, string>)) {
		if (!hex.startsWith("#")) continue;
		/** 当前颜色的 RGB 通道。 */
		const rgb = hexToRgb(hex);
		/** 当前颜色对白底的对比度。 */
		const vsWhite = getContrast(rgb, 1.0);
		/** 当前颜色对黑底的对比度。 */
		const vsBlack = getContrast(rgb, 0.0);
		/** 白底下的 WCAG 文本等级。 */
		const passW = vsWhite >= 4.5 ? "AA" : vsWhite >= 3.0 ? "AA-lg" : "FAIL";
		/** 黑底下的 WCAG 文本等级。 */
		const passB = vsBlack >= 4.5 ? "AA" : vsBlack >= 3.0 ? "AA-lg" : "FAIL";
		console.log(
			`${name.padEnd(14)} ${fgAnsi(hex)}Sample text${reset}  ${hex}  white: ${vsWhite.toFixed(2)}:1 ${passW.padEnd(5)}  black: ${vsBlack.toFixed(2)}:1 ${passB}`,
		);
	}
}

/**
 * 初始化指定内置主题并输出核心颜色的真实 ANSI 样例和对比度。
 * @param themeName 内置主题名，主入口只传 light 或 dark。
 * @returns 无返回值，结果写入标准输出。
 * @example cmdTheme("dark");
 */
function cmdTheme(themeName: string): void {
	process.env.COLORTERM = "truecolor";
	initTheme(themeName);

	/**
	 * 从 ANSI 真彩色前景序列提取 RGB。
	 * @param ansi 可能包含 38;2;r;g;b 的终端文本。
	 * @returns RGB 三元组，未匹配时为 null。
	 */
	const parseAnsiRgb = (ansi: string): [number, number, number] | null => {
		/** ANSI 真彩色三个数字通道的正则匹配结果。 */
		const match = ansi.match(/38;2;(\d+);(\d+);(\d+)/);
		return match ? [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)] : null;
	};

	/**
	 * 计算主题前景色对白底的对比度等级。
	 * @param colorName 主题前景色键名。
	 * @returns 对比度与 AA 等级，默认色返回 default。
	 */
	const getContrastVsWhite = (colorName: string): string => {
		/** 主题系统生成的前景 ANSI 序列。 */
		const ansi = theme.getFgAnsi(colorName as Parameters<typeof theme.getFgAnsi>[0]);
		/** 从 ANSI 提取的 RGB。 */
		const rgb = parseAnsiRgb(ansi);
		if (!rgb) return "(default)";
		/** 当前颜色对白底的对比度。 */
		const ratio = getContrast(rgb, 1.0);
		/** 白底下的 WCAG 等级。 */
		const pass = ratio >= 4.5 ? "AA" : ratio >= 3.0 ? "AA-lg" : "FAIL";
		return `${ratio.toFixed(2)}:1 ${pass}`;
	};

	/**
	 * 计算主题前景色对黑底的对比度等级。
	 * @param colorName 主题前景色键名。
	 * @returns 对比度与 AA 等级，默认色返回 default。
	 */
	const getContrastVsBlack = (colorName: string): string => {
		/** 主题系统生成的前景 ANSI 序列。 */
		const ansi = theme.getFgAnsi(colorName as Parameters<typeof theme.getFgAnsi>[0]);
		/** 从 ANSI 提取的 RGB。 */
		const rgb = parseAnsiRgb(ansi);
		if (!rgb) return "(default)";
		/** 当前颜色对黑底的对比度。 */
		const ratio = getContrast(rgb, 0.0);
		/** 黑底下的 WCAG 等级。 */
		const pass = ratio >= 4.5 ? "AA" : ratio >= 3.0 ? "AA-lg" : "FAIL";
		return `${ratio.toFixed(2)}:1 ${pass}`;
	};

	/**
	 * 输出一个主题颜色的样例及黑白背景对比度。
	 * @param name 主题前景色键名。
	 * @returns 无返回值。
	 */
	const logColor = (name: string): void => {
		/** 应用主题色后的示例文本。 */
		const sample = theme.fg(name as Parameters<typeof theme.fg>[0], "Sample text");
		/** 该颜色对白底的等级文本。 */
		const cw = getContrastVsWhite(name);
		/** 该颜色对黑底的等级文本。 */
		const cb = getContrastVsBlack(name);
		console.log(`${name.padEnd(20)} ${sample}  white: ${cw.padEnd(12)} black: ${cb}`);
	};

	console.log(`\n=== ${themeName} theme (WCAG AA = 4.5:1) ===`);

	console.log("\n--- Core UI ---");
	["accent", "border", "borderAccent", "borderMuted", "success", "error", "warning", "muted", "dim"].forEach(logColor);

	console.log("\n--- Markdown ---");
	["mdHeading", "mdLink", "mdCode", "mdCodeBlock", "mdCodeBlockBorder", "mdQuote", "mdListBullet"].forEach(logColor);

	console.log("\n--- Diff ---");
	["toolDiffAdded", "toolDiffRemoved", "toolDiffContext"].forEach(logColor);

	console.log("\n--- Thinking ---");
	["thinkingOff", "thinkingMinimal", "thinkingLow", "thinkingMedium", "thinkingHigh"].forEach(logColor);

	console.log("\n--- Backgrounds ---");
	console.log("userMessageBg:", theme.bg("userMessageBg", " Sample "));
	console.log("toolPendingBg:", theme.bg("toolPendingBg", " Sample "));
	console.log("toolSuccessBg:", theme.bg("toolSuccessBg", " Sample "));
	console.log("toolErrorBg:", theme.bg("toolErrorBg", " Sample "));
	console.log();
}

// --- Main ---
// --- 主入口：解析命令与首个参数并分派到对应功能。---

/** 命令行中的子命令和第一个参数。 */
const [cmd, arg] = process.argv.slice(2);

if (cmd === "contrast") {
	cmdContrast(parseFloat(arg) || 4.5);
} else if (cmd === "test") {
	cmdTest(arg);
} else if (cmd === "light" || cmd === "dark") {
	cmdTheme(cmd);
} else {
	console.log("Usage:");
	console.log("  npx tsx test-theme-colors.ts light|dark     Test built-in theme");
	console.log("  npx tsx test-theme-colors.ts contrast 4.5   Compute colors at ratio");
	console.log("  npx tsx test-theme-colors.ts test file.json Test any JSON file");
}
