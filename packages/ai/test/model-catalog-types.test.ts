/**
 * 文件职责：验证模型目录从静态数据中正确推导 API、模型 ID 与提供方的字面量类型。
 * 技术维度：使用 Vitest 的 expectTypeOf 做编译期类型断言，不依赖真实网络请求。
 * 产品维度：避免模型元数据退化为宽泛字符串，从而保留调用方的自动补全和类型安全。
 * 逻辑维度：读取 xAI 模型目录，对不同模型的 api、id、provider 字段逐项校验。
 * 关键边界：断言关注 TypeScript 类型而非运行值；测试模型 ID 变更时需同步更新。
 * 新手阅读建议：先看 XAI_MODELS 的生成方式，再理解 toEqualTypeOf 检查的是类型而非相等值。
 */
import { expectTypeOf, it } from "vitest";
import { XAI_MODELS } from "../src/providers/xai.models.ts";

/** 类型回归用例：确认分组模型数据经过扁平化后仍保留精确的字面量类型。 */
it("derives model API, ID, and provider literals from grouped model data", () => {
	expectTypeOf(XAI_MODELS["grok-4.5"].api).toEqualTypeOf<"openai-responses">();
	expectTypeOf(XAI_MODELS["grok-4.5"].id).toEqualTypeOf<"grok-4.5">();
	expectTypeOf(XAI_MODELS["grok-4.5"].provider).toEqualTypeOf<"xai">();
	expectTypeOf(XAI_MODELS["grok-4.3"].api).toEqualTypeOf<"openai-completions">();
});
