/**
 * 文件职责：对 OpenCode Zen 与 OpenCode Go 目录中的每个模型执行真实完成请求冒烟测试。
 * 技术维度：使用 Vitest 条件跳过、生成模型目录和异步 complete API 进行参数化在线测试。
 * 产品维度：在配置凭据时快速发现模型目录、认证或响应转换的整体集成故障。
 * 逻辑维度：无 API 密钥时跳过；否则遍历两个提供方及其模型，发送固定消息并检查响应内容与停止原因。
 * 关键边界：会产生真实网络请求和潜在费用；受服务可用性影响，单模型超时为 60 秒。
 * 新手阅读建议：先看 describe.skipIf 的安全开关，再按“提供方—模型—请求—断言”的两层遍历阅读。
 */
import { describe, expect, it } from "vitest";
import { complete } from "../src/compat.ts";
import { MODELS } from "../src/models.generated.ts";
import type { Model } from "../src/types.ts";

/** OpenCode 在线冒烟测试组；只有存在 OPENCODE_API_KEY 时才会执行。 */
describe.skipIf(!process.env.OPENCODE_API_KEY)("OpenCode Models Smoke Test", () => {
	/** 受测提供方及显示标签；key 用于查目录，label 用于生成清晰的测试名称。 */
	const providers = [
		{ key: "opencode", label: "OpenCode Zen" },
		{ key: "opencode-go", label: "OpenCode Go" },
	] as const;

	// key 和 label 分别是提供方目录键与用例显示名，均来自上方只读列表。
	providers.forEach(({ key, label }) => {
		/** 当前提供方目录中的全部模型对象；数量由生成的模型数据决定。 */
		const providerModels = Object.values(MODELS[key]);
		// model 是当前将被真实调用的目录模型；每个模型生成一个独立测试用例。
		providerModels.forEach((model) => {
			/** 单模型在线冒烟用例：请求固定问候并验证存在内容且正常停止。 */
			it(`${label}: ${model.id}`, async () => {
				/** 模型完成响应；内容结构由具体 API 适配器统一转换。 */
				const response = await complete(model as Model<any>, {
					messages: [{ role: "user", content: "Say hello.", timestamp: Date.now() }],
				});

				expect(response.content).toBeTruthy();
				expect(response.stopReason).toBe("stop");
			}, 60000);
		});
	});
});
