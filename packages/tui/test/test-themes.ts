/**
 * 文件职责：提供 TUI 单元测试可复用的默认选择列表、Markdown 和编辑器主题。
 * 技术维度：使用 Chalk 三级颜色能力和 pi-tui 主题接口，把文本样式实现为纯函数集合。
 * 产品维度：让组件测试在稳定颜色规则下渲染 ANSI 输出，便于验证视觉结构。
 * 逻辑维度：创建 Chalk 实例，依次组装选择列表主题、Markdown 主题，再嵌入编辑器主题。
 * 关键边界：强制 level=3 会生成真彩色 ANSI 序列，不代表当前终端真实能力；仅供测试使用。
 * 新手阅读建议：先看 chalk 如何包装 text，再从 defaultEditorTheme 反向追踪到复用的选择列表主题。
 */
/**
 * Default themes for TUI tests using chalk
 */
/** 使用 Chalk 构建的 TUI 测试默认主题。 */

import { Chalk } from "chalk";
import type { EditorTheme, MarkdownTheme, SelectListTheme } from "../src/index.ts";

/** 开启三级真彩色输出的独立 Chalk 实例，避免依赖测试进程的终端探测结果。 */
const chalk = new Chalk({ level: 3 });

/** 选择列表测试主题；每个函数接收原文本并返回带对应 ANSI 样式的文本。 */
export const defaultSelectListTheme: SelectListTheme = {
	/** 选中项前缀使用蓝色。 */
	selectedPrefix: (text: string) => chalk.blue(text),
	/** 选中项正文使用粗体。 */
	selectedText: (text: string) => chalk.bold(text),
	/** 描述文本使用暗色。 */
	description: (text: string) => chalk.dim(text),
	/** 滚动提示使用暗色。 */
	scrollInfo: (text: string) => chalk.dim(text),
	/** 无匹配提示使用暗色。 */
	noMatch: (text: string) => chalk.dim(text),
};

/** Markdown 测试主题；为各语法元素指定确定的 Chalk 样式。 */
export const defaultMarkdownTheme: MarkdownTheme = {
	/** 标题使用粗体青色。 */
	heading: (text: string) => chalk.bold.cyan(text),
	/** 链接正文使用蓝色。 */
	link: (text: string) => chalk.blue(text),
	/** 链接 URL 使用暗色。 */
	linkUrl: (text: string) => chalk.dim(text),
	/** 行内代码使用黄色。 */
	code: (text: string) => chalk.yellow(text),
	/** 代码块正文使用绿色。 */
	codeBlock: (text: string) => chalk.green(text),
	/** 代码块边框使用暗色。 */
	codeBlockBorder: (text: string) => chalk.dim(text),
	/** 引用正文使用斜体。 */
	quote: (text: string) => chalk.italic(text),
	/** 引用边框使用暗色。 */
	quoteBorder: (text: string) => chalk.dim(text),
	/** 水平分隔线使用暗色。 */
	hr: (text: string) => chalk.dim(text),
	/** 列表项目符号使用青色。 */
	listBullet: (text: string) => chalk.cyan(text),
	/** 粗体语法使用粗体样式。 */
	bold: (text: string) => chalk.bold(text),
	/** 斜体语法使用斜体样式。 */
	italic: (text: string) => chalk.italic(text),
	/** 删除线语法使用删除线样式。 */
	strikethrough: (text: string) => chalk.strikethrough(text),
	/** 下划线语法使用下划线样式。 */
	underline: (text: string) => chalk.underline(text),
};

/** 编辑器测试主题；边框使用暗色，并复用上方选择列表主题。 */
export const defaultEditorTheme: EditorTheme = {
	/** 编辑器边框着色函数。 */
	borderColor: (text: string) => chalk.dim(text),
	/** 编辑器补全列表使用的选择主题。 */
	selectList: defaultSelectListTheme,
};
