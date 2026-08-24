/**
 * 文件职责：为 TypeScript 声明 JSON 模块的通用导入类型。
 * 技术维度：通过环境模块声明匹配 *.json，并把默认导出保守地标记为 unknown。
 * 产品维度：允许模型目录安全导入 JSON 数据，同时提醒调用方先验证数据结构。
 * 逻辑维度：匹配 JSON 导入后提供一个默认值类型，不包含任何运行时代码。
 * 关键边界：unknown 禁止未经收窄直接访问字段；实际 JSON 加载仍取决于运行环境配置。
 * 新手阅读建议：先理解 declare module 只影响类型检查，再观察调用处如何校验或推断 JSON 内容。
 */
declare module "*.json" {
	/** JSON 模块的默认导出；具体结构未知，使用前必须通过类型判断或既有目录类型进行收窄。 */
	const value: unknown;
	export default value;
}
