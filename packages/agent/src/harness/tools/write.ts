/**
 * 【文件职责】实现内置 write 工具：把文本内容写入指定文件——不存在则创建（含父目录），存在则整体覆盖；
 *              写入操作进入文件变更队列串行执行。
 * 【技术维度】typebox 定义参数 schema（供模型生成与参数校验）；工厂函数 createWriteTool 返回
 *              AgentHarnessTool；withFileMutationQueue 保证并发安全。
 * 【产品维度】让模型能够创建或改写项目文件，是代码生成与修改闭环的核心动作之一。
 * 【逻辑维度】execute 内部：解析绝对路径 → 入队 → 前后两次检查中止信号 → env.writeFile → 返回成功文本。
 * 【关键边界】覆盖语义（不做追加/局部编辑）；content 按字符串写入（二进制请走其他途径）；
 *              中止发生在写前或写后都会抛错，可能留下已写入的部分结果。
 * 【新手阅读建议】先看 writeSchema 了解参数契约，再读 execute 的五步流程，注意两处中止检查的原因。
 */
import { type Static, Type } from "typebox";
import type { AgentHarnessTool } from "../types.ts";
import { getOrThrow } from "../types.ts";
import { withFileMutationQueue } from "./file-mutation-queue.ts";
import { resolveToolPath } from "./path-utils.ts";
import type { ExecutionToolContext } from "./tool-context.ts";

// write 工具的参数 schema：path 目标文件路径；content 待写入内容
const writeSchema = Type.Object({
	path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
	content: Type.String({ description: "Content to write to the file" }),
});

/** write 工具的输入类型（由 schema 推导） */
export type WriteToolInput = Static<typeof writeSchema>;

/**
 * 创建 write 工具实例（中文说明）：泛型 TContext 允许应用扩展上下文；
 * 无任何构造选项。返回符合 AgentHarnessTool 约定的工具对象。
 */
export function createWriteTool<TContext extends ExecutionToolContext = ExecutionToolContext>(): AgentHarnessTool<
	TContext,
	typeof writeSchema,
	undefined
> {
	return {
		// 工具名：模型以此调用
		name: "write",
		label: "write",
		description:
			"Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.",
		parameters: writeSchema,
		async execute(_toolCallId, { path, content }, signal, _onUpdate, { env }) {
			// 规范化并转绝对路径（失败会抛出）
			const absolutePath = await resolveToolPath(env, path, signal);
			// 进入同路径串行队列，避免并发写冲突
			return withFileMutationQueue(env, absolutePath, async () => {
				if (signal?.aborted) throw new Error("Operation aborted");
				getOrThrow(await env.writeFile(absolutePath, content, signal));
				if (signal?.aborted) throw new Error("Operation aborted");
				return {
					content: [{ type: "text", text: `Successfully wrote ${content.length} bytes to ${path}` }],
					details: undefined,
				};
			});
		},
	};
}
