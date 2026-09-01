/**
 * 文件职责：验证终端背景主题检测、RGB 亮度分类、颜色能力选择及自动主题设置解析。
 * 技术维度：使用 Vitest、TUI 能力缓存、环境变量 COLORFGBG 和可模拟终端背景查询接口。
 * 产品维度：让界面在不同终端自动选择可读的明暗主题和 256 色/真彩色输出。
 * 逻辑维度：依次测试环境推断、终端查询回退、颜色模式、RGB 分类和 light/dark 设置解析。
 * 关键边界：终端查询优先于环境；查询失败需静默回退；无提示默认低置信度暗色。
 * 新手阅读建议：先读两个 detect 函数的优先级用例，再看颜色能力和设置字符串的纯函数断言。
 */
import { type RgbColor, resetCapabilitiesCache, setCapabilities } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it } from "vitest";
import {
	detectTerminalBackgroundFromEnv,
	detectTerminalBackgroundTheme,
	detectTerminalThemeForAuto,
	getThemeByName,
	getThemeForRgbColor,
	parseAutoThemeSetting,
	resolveThemeSetting,
} from "../src/modes/interactive/theme/theme.ts";

// 功能：清除全局终端能力缓存；参数：无；返回：无。示例：每个用例后自动调用。
afterEach(() => {
	resetCapabilitiesCache();
});

describe("detectTerminalBackgroundFromEnv", () => {
	it("uses the COLORFGBG background color index", () => {
		expect(detectTerminalBackgroundFromEnv({ env: { COLORFGBG: "0;15" } })).toMatchObject({
			theme: "light",
			source: "COLORFGBG",
			confidence: "high",
		});
		expect(detectTerminalBackgroundFromEnv({ env: { COLORFGBG: "15;0" } })).toMatchObject({
			theme: "dark",
			source: "COLORFGBG",
			confidence: "high",
		});
	});

	it("uses the last COLORFGBG field as the background", () => {
		expect(detectTerminalBackgroundFromEnv({ env: { COLORFGBG: "0;7;15" } }).theme).toBe("light");
	});

	it("defaults to dark without terminal background hints", () => {
		expect(detectTerminalBackgroundFromEnv({ env: {} })).toMatchObject({
			theme: "dark",
			source: "fallback",
			confidence: "low",
		});
	});
});

describe("detectTerminalBackgroundTheme", () => {
	it("uses the queried terminal background before environment hints", async () => {
		// 传给终端查询方法的实际超时值。
		let queriedTimeoutMs: number | undefined;
		// 终端返回浅色 RGB 后的检测结果。
		const detection = await detectTerminalBackgroundTheme({
			env: { COLORFGBG: "15;0" },
			timeoutMs: 250,
			ui: {
				/** 参数 timeoutMs 是查询上限；记录后返回浅色背景；示例：由检测器调用。 */
				async queryTerminalBackgroundColor({ timeoutMs }: { timeoutMs: number }): Promise<RgbColor | undefined> {
					queriedTimeoutMs = timeoutMs;
					return { r: 250, g: 250, b: 250 };
				},
			},
		});

		expect(queriedTimeoutMs).toBe(250);
		expect(detection).toMatchObject({
			theme: "light",
			source: "terminal background",
			confidence: "high",
		});
	});

	it("falls back to environment hints when the terminal query returns no color", async () => {
		// 终端未返回颜色时由 COLORFGBG 得到的结果。
		const detection = await detectTerminalBackgroundTheme({
			env: { COLORFGBG: "15;0" },
			timeoutMs: 250,
			ui: {
				/** 无参数；返回 undefined 模拟终端无响应；示例：由检测器调用。 */
				async queryTerminalBackgroundColor(): Promise<RgbColor | undefined> {
					return undefined;
				},
			},
		});

		expect(detection).toMatchObject({
			theme: "dark",
			source: "COLORFGBG",
			confidence: "high",
		});
	});

	it("falls back to environment hints when the terminal query fails", async () => {
		// 终端查询抛错后由 COLORFGBG 得到的结果。
		const detection = await detectTerminalBackgroundTheme({
			env: { COLORFGBG: "0;15" },
			timeoutMs: 250,
			ui: {
				/** 无参数；抛出写终端失败异常且不返回；示例：由检测器调用。 */
				async queryTerminalBackgroundColor(): Promise<RgbColor | undefined> {
					throw new Error("terminal write failed");
				},
			},
		});

		expect(detection).toMatchObject({
			theme: "light",
			source: "COLORFGBG",
			confidence: "high",
		});
	});
});

describe("detectTerminalThemeForAuto", () => {
	it("starts both queries and returns the preferred color-scheme result without waiting", async () => {
		let resolveColorScheme!: (theme: "dark" | "light" | undefined) => void;
		let backgroundQueryStarted = false;
		const detection = detectTerminalThemeForAuto({
			timeoutMs: 100,
			ui: {
				queryTerminalColorScheme: () =>
					new Promise((resolve) => {
						resolveColorScheme = resolve;
					}),
				queryTerminalBackgroundColor: () => {
					backgroundQueryStarted = true;
					return new Promise<RgbColor | undefined>(() => {});
				},
			},
		});

		expect(backgroundQueryStarted).toBe(true);
		resolveColorScheme("dark");
		await expect(detection).resolves.toBe("dark");
	});

	it("uses the background result when the color-scheme query fails", async () => {
		await expect(
			detectTerminalThemeForAuto({
				timeoutMs: 100,
				ui: {
					async queryTerminalColorScheme(): Promise<undefined> {
						throw new Error("color-scheme query failed");
					},
					async queryTerminalBackgroundColor(): Promise<RgbColor> {
						return { r: 250, g: 250, b: 250 };
					},
				},
			}),
		).resolves.toBe("light");
	});
});

describe("theme color mode", () => {
	it("uses terminal capabilities", () => {
		setCapabilities({ images: null, trueColor: false, hyperlinks: false });
		// 禁用真彩色能力后取得的暗色主题。
		const ansi256Theme = getThemeByName("dark");
		if (!ansi256Theme) throw new Error("dark theme not found");
		expect(ansi256Theme.getColorMode()).toBe("256color");
		expect(ansi256Theme.getFgAnsi("accent")).toMatch(/^\x1b\[38;5;\d+m$/);

		setCapabilities({ images: null, trueColor: true, hyperlinks: false });
		// 启用真彩色能力后重新取得的暗色主题。
		const truecolorTheme = getThemeByName("dark");
		if (!truecolorTheme) throw new Error("dark theme not found");
		expect(truecolorTheme.getColorMode()).toBe("truecolor");
		expect(truecolorTheme.getFgAnsi("accent")).toMatch(/^\x1b\[38;2;\d+;\d+;\d+m$/);
	});
});

describe("theme detection from RGB", () => {
	it("classifies RGB colors by luminance", () => {
		expect(getThemeForRgbColor({ r: 8, g: 8, b: 8 })).toBe("dark");
		expect(getThemeForRgbColor({ r: 250, g: 250, b: 250 })).toBe("light");
	});
});

describe("theme setting helpers", () => {
	it("parses and resolves automatic theme settings", () => {
		expect(parseAutoThemeSetting("light/dark")).toEqual({ lightTheme: "light", darkTheme: "dark" });
		expect(resolveThemeSetting("dark", "light")).toBe("dark");
		expect(resolveThemeSetting("light/dark", "light")).toBe("light");
		expect(resolveThemeSetting("light/dark", "dark")).toBe("dark");
		expect(resolveThemeSetting("light/dark/extra", "dark")).toBeUndefined();
	});
});
