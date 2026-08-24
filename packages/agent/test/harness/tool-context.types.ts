/**
 * 文件职责：用 TypeScript 编译结果验证 AgentHarness 对工具上下文的静态类型约束。
 * 技术维度：使用 declare 构造仅参与类型检查的值，并以 @ts-expect-error 固化错误用法。
 * 产品维度：防止调用方忘记为依赖执行上下文的工具传入 toolContext，减少运行时失败。
 * 逻辑维度：创建读取工具，先验证合法构造，再声明缺少上下文的构造必须产生类型错误。
 * 关键边界：本文件不应直接运行，declare 变量在 JavaScript 中没有实际值；价值来自 TypeScript 检查。
 * 新手阅读建议：先区分 declare 与真实变量，再对比两次 AgentHarness 构造参数的唯一差异。
 */
import type { Api, Model, Models } from "@earendil-works/pi-ai";
import { AgentHarness } from "../../src/harness/agent-harness.ts";
import { createReadTool } from "../../src/harness/tools/read.ts";
import type { ExecutionToolContext } from "../../src/harness/tools/tool-context.ts";
import type { Session } from "../../src/harness/types.ts";

/** 仅供类型测试使用的模型集合声明；运行时不存在。 */
declare const models: Models;
/** 仅供类型测试使用的单个模型声明；API 类型允许覆盖所有已知提供方。 */
declare const model: Model<Api>;
/** 仅供类型测试使用的会话声明；不创建真实存储或消息。 */
declare const session: Session;
/** 读取工具所需的执行上下文声明；用于证明合法构造必须携带该值。 */
declare const toolContext: ExecutionToolContext;

/** 需要 ExecutionToolContext 的读取工具实例；用于触发构造参数的条件类型检查。 */
const readTool = createReadTool();

new AgentHarness({ models, model, session, tools: [readTool], toolContext });

// @ts-expect-error Context-requiring tools must be paired with toolContext.
// 需要执行上下文的工具必须和 toolContext 一起传入；若此行不再报错，类型约束已发生回归。
new AgentHarness({ models, model, session, tools: [readTool] });
