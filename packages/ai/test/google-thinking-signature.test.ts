/**
 * 文件职责：验证 Google 内容块的思考识别只依赖 thought 标志，并正确保留 thoughtSignature。
 * 技术维度：使用 Vitest 对 Google 流式内容辅助函数执行布尔和状态延续单元测试。
 * 产品维度：避免把普通内容误显示为思考，同时保留服务端要求的签名以便后续上下文重放。
 * 逻辑维度：覆盖 thought 真/假/缺失与签名组合，再验证签名缺失、空值和更新规则。
 * 关键边界：thoughtSignature 是不透明字符串，不能据此判断内容类型；空字符串不会覆盖已有签名。
 * 新手阅读建议：先区分 isThinkingPart 与 retainThoughtSignature 两个职责，再按测试组顺序阅读。
 */
import { describe, expect, it } from "vitest";
import { isThinkingPart, retainThoughtSignature } from "../src/api/google-shared.ts";

/** Google thoughtSignature 识别与保留规则测试组。 */
describe("Google thinking detection (thoughtSignature)", () => {
	/** 验证 thought 明确为 true 时，无论签名是否存在都属于思考内容。 */
	it("treats part.thought === true as thinking", () => {
		expect(isThinkingPart({ thought: true, thoughtSignature: undefined })).toBe(true);
		expect(isThinkingPart({ thought: true, thoughtSignature: "opaque-signature" })).toBe(true);
	});

	/** 验证只有签名而没有 thought=true 时仍是普通内容。 */
	it("does not treat thoughtSignature alone as thinking", () => {
		// Per Google docs, thoughtSignature is for context replay and can appear on any part type.
		// 根据 Google 文档，thoughtSignature 用于上下文重放，可出现在任意内容块类型上。
		// Only thought === true indicates thinking content.
		// 只有 thought === true 才表示思考内容。
		// See: https://ai.google.dev/gemini-api/docs/thought-signatures
		// 参考链接见上方 Google 官方 thought signatures 文档。
		expect(isThinkingPart({ thought: undefined, thoughtSignature: "opaque-signature" })).toBe(false);
		expect(isThinkingPart({ thought: false, thoughtSignature: "opaque-signature" })).toBe(false);
	});

	/** 验证 thought 未启用时，空签名或缺失签名也不能判为思考。 */
	it("does not treat empty/missing signatures as thinking if thought is not set", () => {
		expect(isThinkingPart({ thought: undefined, thoughtSignature: undefined })).toBe(false);
		expect(isThinkingPart({ thought: false, thoughtSignature: "" })).toBe(false);
	});

	/** 验证新增量不带有效签名时继续沿用最近的非空签名。 */
	it("preserves the existing signature when subsequent deltas omit thoughtSignature", () => {
		/** 从无签名状态接收的首个有效签名。 */
		const first = retainThoughtSignature(undefined, "sig-1");
		expect(first).toBe("sig-1");

		/** 新增量缺失签名时保留的上一签名。 */
		const second = retainThoughtSignature(first, undefined);
		expect(second).toBe("sig-1");

		/** 新增量给空字符串时仍保留的上一签名。 */
		const third = retainThoughtSignature(second, "");
		expect(third).toBe("sig-1");
	});

	/** 验证新的非空签名会替换旧签名。 */
	it("updates the signature when a new non-empty signature arrives", () => {
		/** 从 sig-1 更新后得到的 sig-2。 */
		const updated = retainThoughtSignature("sig-1", "sig-2");
		expect(updated).toBe("sig-2");
	});
});
