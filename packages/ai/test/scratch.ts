// Scratch script showing real-world use of the new Models API.
// 展示新版 Models API 真实用法的临时示例脚本。
// Run from packages/ai: node test/scratch.ts
// 请在 packages/ai 目录运行：node test/scratch.ts。
// Requires ANTHROPIC_API_KEY.
// 需要预先配置 ANTHROPIC_API_KEY。
/**
 * 文件职责：演示 Models 运行时的提供方注册、认证查询、普通完成和流式完成。
 * 技术维度：使用顶层 await、Anthropic 内置提供方、Context 和异步迭代流。
 * 产品维度：为开发者提供最小真实调用路径，便于理解如何二次集成模型 API。
 * 逻辑维度：创建模型集合并注册提供方，验证认证，完成一轮请求，再追加消息并流式输出。
 * 关键边界：会调用真实 Anthropic 服务并产生费用；缺少认证时以状态码 1 退出。
 * 新手阅读建议：按四个编号章节顺序运行和阅读，先确保环境变量只用于测试账户。
 */

import { createModels } from "../src/models.ts";
import { anthropicProvider } from "../src/providers/anthropic.ts";
import type { Context } from "../src/types.ts";

// ---------------------------------------------------------------------------
// 1. Build a Models runtime and register a built-in provider factory.
// 1. 创建 Models 运行时并注册内置提供方工厂。
//    (Apps wanting everything use `builtinModels()` from providers/all.)
//    需要全部提供方的应用可使用 providers/all 中的 builtinModels()。
// ---------------------------------------------------------------------------

/** 模型运行时集合；初始未注册任何提供方。 */
const models = createModels();
models.setProvider(anthropicProvider());

// ---------------------------------------------------------------------------
// 2. Look up a model and check auth.
// 2. 查找模型并检查认证。
// ---------------------------------------------------------------------------

/** 要调用的 Anthropic Haiku 模型；目录缺失时可能为 undefined。 */
const model = models.getModel("anthropic", "claude-haiku-4-5");
if (!model) throw new Error("model not found");

/** 当前提供方解析到的认证信息；未配置时为 undefined。 */
const auth = await models.getAuth(model.provider);
console.log(`model: ${model.provider}/${model.id}`);
console.log(`auth:  ${auth ? `configured via ${auth.source}` : "not configured"}\n`);
if (!auth) process.exit(1);

/** 两次调用共享并会追加消息的对话上下文。 */
const context: Context = {
	systemPrompt: "You are terse.",
	messages: [{ role: "user", content: "Say exactly: ok", timestamp: Date.now() }],
};

// ---------------------------------------------------------------------------
// 3. Simple completion (request-level auth resolution happens inside).
// 3. 普通完成；请求级认证会在内部解析。
// ---------------------------------------------------------------------------

/** 第一轮非流式助手消息。 */
const message = await models.completeSimple(model, context);
console.log(`completeSimple -> [${message.stopReason}]`, message.content);

// ---------------------------------------------------------------------------
// 4. Streaming with deltas.
// 4. 使用增量事件进行流式完成。
// ---------------------------------------------------------------------------

context.messages.push(message, {
	role: "user",
	content: "Now count from 1 to 5, one number per line.",
	timestamp: Date.now(),
});

process.stdout.write("streamSimple   -> ");
/** 第二轮流式响应对象，可异步迭代并最终取得完整结果。 */
const stream = models.streamSimple(model, context);
// event 是流中的一个增量事件；这里只即时打印文本增量。
for await (const event of stream) {
	if (event.type === "text_delta") process.stdout.write(event.delta.replaceAll("\n", " "));
}
/** 流结束后汇总的最终助手消息。 */
const final = await stream.result();
console.log(`[${final.stopReason}] cost: $${final.usage.cost.total.toFixed(6)}`);
