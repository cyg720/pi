/**
 * 文件职责：验证主题导出颜色支持变量引用、递归别名和 256 色值到十六进制转换。
 * 技术维度：使用 Vitest、临时主题 JSON 文件、环境目录切换和 getThemeExportColors。
 * 产品维度：保证导出的 HTML 或分享页面能复用终端主题变量并得到标准网页颜色。
 * 逻辑维度：复制内置深色主题，添加自定义变量与 export 字段，写入后读取解析结果。
 * 关键边界：测试会临时覆盖 PI_CODING_AGENT_DIR 并递归删除目录；空颜色映射为 undefined。
 * 新手阅读建议：先看 ThemeFile 的 vars/colors/export，再比较直接别名和递归/ANSI 两例。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getThemeExportColors } from "../src/modes/interactive/theme/theme.ts";

/** 描述测试写入的主题文件中与导出颜色相关的最小结构。 */
type ThemeFile = {
	// name 是主题唯一名称。
	name: string;
	// vars 保存可被颜色或导出字段引用的字符串或 256 色数值变量。
	vars?: Record<string, string | number>;
	// colors 保存主题必需的常规颜色映射。
	colors: Record<string, string | number>;
	// export 保存网页导出时使用的三个可选背景颜色。
	export?: {
		pageBg?: string | number;
		cardBg?: string | number;
		infoBg?: string | number;
	};
};

describe("getThemeExportColors", () => {
	// tempRoot 是每个用例独享的临时主题根目录。
	let tempRoot: string;
	// previousAgentDir 保存原代理目录环境值，可能未定义。
	let previousAgentDir: string | undefined;

	// 每个用例前创建隔离主题目录并切换代理目录；无参数，无返回值。
	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "pi-theme-export-"));
		previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = join(tempRoot, "agent");
		mkdirSync(join(process.env.PI_CODING_AGENT_DIR, "themes"), { recursive: true });
	});

	// 每个用例后删除临时目录并恢复代理目录环境；无参数，无返回值。
	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
		if (previousAgentDir === undefined) {
			delete process.env.PI_CODING_AGENT_DIR;
		} else {
			process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		}
	});

	// 验证 export 字段使用与 colors 相同的变量别名解析语法；无参数，无返回值。
	it("resolves export variable references using the same syntax as colors", () => {
		// darkTheme 是从内置深色主题解析的基础配置。
		const darkTheme = JSON.parse(
			readFileSync(new URL("../src/modes/interactive/theme/dark.json", import.meta.url), "utf-8"),
		) as ThemeFile;

		// customTheme 添加直接和二级别名形式的导出背景变量。
		const customTheme: ThemeFile = {
			...darkTheme,
			name: "custom-export-vars",
			vars: {
				...(darkTheme.vars ?? {}),
				pageBgVar: "#112233",
				pageBgAlias: "pageBgVar",
				infoBgVar: "#445566",
				cardBgVar: "#223344",
			},
			export: {
				pageBg: "pageBgAlias",
				cardBg: "cardBgVar",
				infoBg: "infoBgVar",
			},
		};

		writeFileSync(
			join(process.env.PI_CODING_AGENT_DIR!, "themes", "custom-export-vars.json"),
			JSON.stringify(customTheme, null, 2),
		);

		expect(getThemeExportColors("custom-export-vars")).toEqual({
			pageBg: "#112233",
			cardBg: "#223344",
			infoBg: "#445566",
		});
	});

	// 验证递归变量解析、ANSI 256 色转换和空值处理；无参数，无返回值。
	it("resolves recursive vars and converts 256-color export values to hex", () => {
		// darkTheme 是构造第二个自定义主题的基础配置。
		const darkTheme = JSON.parse(
			readFileSync(new URL("../src/modes/interactive/theme/dark.json", import.meta.url), "utf-8"),
		) as ThemeFile;

		// customTheme 包含递归别名、数值色和空导出值。
		const customTheme: ThemeFile = {
			...darkTheme,
			name: "custom-export-recursive",
			vars: {
				...(darkTheme.vars ?? {}),
				deepPageBg: "#abcdef",
				pageBgAlias: "deepPageBg",
				cardBgAnsi: 24,
			},
			export: {
				pageBg: "pageBgAlias",
				cardBg: "cardBgAnsi",
				infoBg: "",
			},
		};

		writeFileSync(
			join(process.env.PI_CODING_AGENT_DIR!, "themes", "custom-export-recursive.json"),
			JSON.stringify(customTheme, null, 2),
		);

		expect(getThemeExportColors("custom-export-recursive")).toEqual({
			pageBg: "#abcdef",
			cardBg: "#005f87",
			infoBg: undefined,
		});
	});
});
