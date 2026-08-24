/**
 * 文件职责：提供代理核心包的 tree-shaking 冒烟测试入口，构造一个最小可导出的 Agent 实例。
 * 技术维度：使用 ESM、模型注册表和 Anthropic 提供方，供打包器分析实际依赖是否可裁剪。
 * 产品维度：防止发布包因导出关系或打包优化错误而无法创建基本代理。
 * 逻辑维度：创建模型集合、注册提供方、取出指定模型，随后用模型与流函数实例化代理。
 * 关键边界：仅验证构建期引用关系，不发送真实请求；指定模型缺失会立即抛错使冒烟检查失败。
 * 新手阅读建议：按 createModels、setProvider、getModel、new Agent 的顺序阅读，理解代理启动的最小依赖链。
 */
import { Agent } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";

/** 冒烟测试使用的模型集合；初始为空，随后注册 Anthropic 提供方。 */
const models = createModels();
models.setProvider(anthropicProvider());
/** 固定选取的 Anthropic 模型；可能为 undefined，因此下方必须先做存在性检查。 */
const model = models.getModel("anthropic", "claude-sonnet-4-5");
if (!model) throw new Error("Anthropic smoke-test model not found");

/** 可被打包测试导入的最小代理实例；使用已确认存在的模型和模型集合绑定后的流式调用函数。 */
export const agent = new Agent({
	initialState: { model },
	streamFn: models.streamSimple.bind(models),
});
