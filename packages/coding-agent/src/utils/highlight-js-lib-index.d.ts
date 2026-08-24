/**
 * 文件职责：补充 highlight.js/lib/index.js 子路径的 TypeScript 类型声明。
 * 技术维度：使用环境模块、接口和可选参数描述项目实际使用的 highlight.js 最小 API 面。
 * 产品维度：为代码高亮功能提供编辑器提示和编译期校验，避免把第三方对象当作无类型值使用。
 * 逻辑维度：依次描述高亮结果、调用选项、库对象方法，最后声明默认导出。
 * 关键边界：声明只覆盖当前用到的方法，并不代表 highlight.js 完整 API；升级依赖时需与真实类型核对。
 * 新手阅读建议：从最小的 HighlightResult 开始，沿 HighlightOptions 到 HighlightJs 理解类型如何组合。
 */
declare module "highlight.js/lib/index.js" {
	/** 单次高亮结果；当前调用方只依赖已经转义并带标记的 value 字符串。 */
	interface HighlightResult {
		/** 高亮后的 HTML 文本；内容可能包含标签，展示时应走可信的既有渲染流程。 */
		value: string;
	}

	/** 指定语言高亮时的选项。 */
	interface HighlightOptions {
		/** highlight.js 注册的语言名称，必须与库中的语言键匹配。 */
		language: string;
		/** 是否忽略非法语法片段；省略时使用 highlight.js 默认行为。 */
		ignoreIllegals?: boolean;
	}

	/** 项目使用到的 highlight.js 库对象最小接口。 */
	interface HighlightJs {
		/**
		 * 按指定语言高亮代码。
		 * @param code 原始代码文本。
		 * @param options 语言及非法语法处理选项。
		 * @returns 包含高亮 HTML 的结果对象。
		 * @example `hljs.highlight("const x = 1", { language: "ts" })`
		 */
		highlight(code: string, options: HighlightOptions): HighlightResult;
		/**
		 * 自动识别语言并高亮代码。
		 * @param code 原始代码文本。
		 * @param languageSubset 可选候选语言列表；省略时由库在全部已注册语言中判断。
		 * @returns 包含高亮 HTML 的结果对象。
		 * @example `hljs.highlightAuto("SELECT 1", ["sql", "text"])`
		 */
		highlightAuto(code: string, languageSubset?: string[]): HighlightResult;
		/**
		 * 查询语言是否已注册。
		 * @param name 语言名称或别名。
		 * @returns 找到时返回语言定义，找不到时通常为 undefined；本地声明保守为 unknown。
		 * @example `const language = hljs.getLanguage("typescript")`。
		 */
		getLanguage(name: string): unknown;
	}

	/** highlight.js 子路径模块的默认库实例；只保证实现上方三个方法。 */
	const hljs: HighlightJs;
	export default hljs;
}
