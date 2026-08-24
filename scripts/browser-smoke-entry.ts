/**
 * 文件职责：作为浏览器打包冒烟入口，引用并实际使用浏览器公开 API 的代表性导出。
 * 技术维度：使用模型兼容 API、Agent、TypeBox、内存仓库和 Rollup/打包器静态依赖分析。
 * 产品维度：防止面向浏览器的包导出意外引入 Node 专属运行时代码，导致网页集成崩溃。
 * 逻辑维度：构造模型、流、代理和多种辅助函数，并统一输出结果以阻止 tree-shaking 删除引用。
 * 关键边界：本文件只验证可打包和基础调用，不发送模型请求；必须保持浏览器安全依赖。
 * 新手阅读建议：先看两行英文边界说明，再逐个把常量对应到导入的公共 API。
 */
import { createAssistantMessageEventStream, Type } from "@earendil-works/pi-ai";
import { complete, getModel, getProviders, streamSimple } from "@earendil-works/pi-ai/compat";
import {
	Agent,
	bashExecutionToText,
	convertToLlm,
	createCustomMessage,
	FileError,
	formatPromptTemplateInvocation,
	formatSkillInvocation,
	formatSkillsForSystemPrompt,
	getOrThrow,
	InMemorySessionRepo,
	ok,
	parseCommandArgs,
	streamProxy,
	toError,
	truncateHead,
} from "@earendil-works/pi-agent-core";

// Keep this entry browser-safe. It is bundled by scripts/check-browser-smoke.mjs
// 保持本入口可在浏览器环境打包；scripts/check-browser-smoke.mjs 会使用它。
// to catch accidental Node-only runtime imports in browser-facing package exports.
// 目的是发现浏览器公开导出中意外出现的 Node 专属运行时导入。
/** 冒烟测试使用的 Google 模型元数据，不会真的发起请求。 */
const model = getModel("google", "gemini-2.5-flash");
/** 用于证明 TypeBox 可从浏览器入口访问的最小对象 Schema。 */
const schema = Type.Object({ prompt: Type.String() });
/** 浏览器安全的助手消息事件流。 */
const stream = createAssistantMessageEventStream();

/** 使用真实模型元数据和 streamSimple 构造的代理。 */
const agent = new Agent({ initialState: { model }, streamFn: streamSimple });
agent.steer({ role: "user", content: [{ type: "text", text: "queued" }], timestamp: 0 });
/** 不依赖文件系统的内存会话仓库。 */
const repo = new InMemorySessionRepo();
/** 对成功 Result 解包后的固定对象。 */
const result = getOrThrow(ok({ value: 1 }));
/** 代表性自定义消息。 */
const customMessage = createCustomMessage("note", "hello", true, undefined, "2026-01-01T00:00:00.000Z");
/** 转换后的 LLM 消息数组。 */
const llmMessages = convertToLlm([customMessage]);
/** 用于系统提示和调用格式化的技能夹具。 */
const skill = { name: "browser-safe", description: "Smoke test", content: "Use browser APIs.", filePath: "/skills/browser-safe/SKILL.md" };

console.log(
	model.id,
	getProviders().length,
	typeof complete,
	schema.type,
	typeof stream.push,
	agent.hasQueuedMessages(),
	typeof repo.create,
	result.value,
	llmMessages.length,
	bashExecutionToText({
		role: "bashExecution",
		command: "echo ok",
		output: "ok",
		exitCode: 0,
		cancelled: false,
		truncated: false,
		timestamp: 0,
	}),
	formatSkillsForSystemPrompt([skill]).length,
	formatSkillInvocation(skill).length,
	formatPromptTemplateInvocation({ name: "example", content: "$1 $@" }, parseCommandArgs('one "two three"')),
	truncateHead("a\nb", { maxLines: 1 }).content,
	new FileError("not_found", "missing").code,
	toError("boom").message,
	typeof streamProxy,
);
