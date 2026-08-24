/**
 * 文件职责：定义 pi-tui 包的 Vitest 测试发现范围。
 * 技术维度：使用 Vitest defineConfig，以类型安全方式生成测试运行配置。
 * 产品维度：确保终端文本换行兼容性测试可独立执行，降低界面排版回归风险。
 * 逻辑维度：导出配置对象，并将测试文件限制为 wrap-ansi.test.ts。
 * 关键边界：新增测试若不匹配 include 将不会被本配置发现；通用配置需在其他入口处理。
 * 新手阅读建议：先看 include 指向的测试，再对照 Vitest 配置文档理解测试发现机制。
 */
import { defineConfig } from "vitest/config";

/** TUI 测试配置；仅包含指定的 ANSI 换行测试文件，不承载运行时产品配置。 */
export default defineConfig({
	test: {
		/** 测试文件匹配列表；当前固定为一个相对包根目录的测试文件。 */
		include: ["test/wrap-ansi.test.ts"],
	},
});
