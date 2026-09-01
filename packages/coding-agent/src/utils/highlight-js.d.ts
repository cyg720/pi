/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `utils/highlight-js.d` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 语言内建能力与本文件声明，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `utils/highlight-js.d` 对应的子能力。
 * 【逻辑维度】本文件不直接导出公开符号，由包内流程加载并执行其中的辅助逻辑。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先从调用本文件的上层入口定位执行时机，再沿内部调用链理解具体实现。
 */
interface HighlightJsResult {
	value: string;
}

interface HighlightJsOptions {
	language: string;
	ignoreIllegals?: boolean;
}

interface HighlightJsLanguageDefinition {
	readonly name?: string;
}

type HighlightJsLanguageFactory = (hljs: HighlightJsApi) => HighlightJsLanguageDefinition;

interface HighlightJsApi {
	highlight(code: string, options: HighlightJsOptions): HighlightJsResult;
	highlightAuto(code: string, languageSubset?: string[]): HighlightJsResult;
	getLanguage(name: string): HighlightJsLanguageDefinition | undefined;
	registerLanguage(name: string, language: HighlightJsLanguageFactory): void;
}

declare module "highlight.js/lib/core.js" {
	const hljs: HighlightJsApi;
	export default hljs;
}

declare module "highlight.js/lib/index.js" {
	const hljs: HighlightJsApi;
	export default hljs;
}

declare module "highlight.js/lib/languages/*.js" {
	const language: HighlightJsLanguageFactory;
	export default language;
}
