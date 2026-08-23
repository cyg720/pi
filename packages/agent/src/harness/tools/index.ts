/**
 * 【文件职责】内置工具的出口（barrel 文件）：集中导出 bash / edit / read / write 四个内置工具
 *              的工厂函数与相关类型，以及工具上下文类型 ExecutionToolContext。
 * 【技术维度】纯再导出，无实现逻辑。
 * 【产品维度】使用方只需 import 本文件即可获得全部内置工具能力，是编写自定义工具集时的对照参考。
 * 【逻辑维度】按 bash → edit → read → tool-context 类型 → write 顺序分组导出。
 * 【关键边界】新增内置工具需在此登记；注意各 createXxxTool 的选项类型随之一并导出。
 * 【新手阅读建议】作为目录索引使用：想了解某个工具的实现就顺着导出跳到对应源文件。
 */
export {
	type BashExecution,
	type BashPrepare,
	type BashToolDetails,
	type BashToolInput,
	type BashToolOptions,
	createBashTool,
} from "./bash.ts";
export {
	createEditTool,
	type EditToolDetails,
	type EditToolInput,
} from "./edit.ts";
export {
	createReadTool,
	type ReadImageProcessor,
	type ReadImageProcessorResult,
	type ReadToolDetails,
	type ReadToolInput,
	type ReadToolOptions,
} from "./read.ts";
// 工具执行上下文类型（由 Harness 注入工具的环境能力）
export type { ExecutionToolContext } from "./tool-context.ts";
// 写文件工具
export { createWriteTool, type WriteToolInput } from "./write.ts";
