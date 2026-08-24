/**
 * 文件职责：配置 pi-ai 包的 Vitest 测试环境、超时、报告器与输出策略。
 * 技术维度：使用 Vitest defineConfig，结合 Node.js 环境变量区分本地和 GitHub Actions 报告格式。
 * 产品维度：为模型 API 与兼容性测试提供稳定执行环境，并让 CI 输出可被平台识别。
 * 逻辑维度：启用全局测试 API、Node 环境、统一超时，并按运行环境选择报告器。
 * 关键边界：三十秒超时面向 API 调用但不能保证网络稳定；passed-only 会隐藏已通过测试的普通输出。
 * 新手阅读建议：先理解 test 下每个配置项，再对比包内在线测试如何通过环境变量跳过。
 */
import { defineConfig } from 'vitest/config';

/** AI 包测试配置；只影响测试运行器，不影响库的生产行为。 */
export default defineConfig({
  test: {
    /** 允许测试文件直接使用 describe、it、expect 等全局函数。 */
    globals: true,
    /** 使用 Node.js 作为测试运行环境，便于访问 process、文件系统和网络 API。 */
    environment: 'node',
    testTimeout: 30000, // 30 seconds for API calls
    // API 调用测试的单用例超时时间为 30 秒，取值单位是毫秒。
    /** 报告器列表；CI 增加 GitHub Actions 注解，本地仅使用精简 dot 输出。 */
    reporters: process.env.GITHUB_ACTIONS ? ['dot', 'github-actions'] : ['dot'],
    /** 只静默已通过用例的控制台输出，失败信息仍会显示。 */
    silent: 'passed-only',
  }
});
