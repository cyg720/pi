/**
 * 文件职责：配置 pi-agent 包的 Vitest 环境，并把 pi-ai 包导入重定向到工作区源码。
 * 技术维度：使用 Vitest defineConfig、URL 路径解析和正则别名，在 Node.js 中直接测试 TypeScript 源码。
 * 产品维度：保证代理核心始终与当前工作区的 AI 实现联调，及时发现跨包接口回归。
 * 逻辑维度：先计算两个 AI 源码入口，再设置测试运行参数与模块解析别名。
 * 关键边界：别名依赖单仓库目录结构；目录移动后必须同步修改 URL，相对路径错误会导致测试加载发布包。
 * 新手阅读建议：先看 aiSrcIndex 与 aiSrcCompat 指向哪里，再理解 resolve.alias 如何替换包名导入。
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** pi-ai 主源码入口的绝对路径；由当前配置文件位置解析，供测试别名使用。 */
const aiSrcIndex = fileURLToPath(new URL("../ai/src/index.ts", import.meta.url));
/** pi-ai 兼容层源码入口的绝对路径；只匹配 /compat 子路径导入。 */
const aiSrcCompat = fileURLToPath(new URL("../ai/src/compat.ts", import.meta.url));

/** Agent 包测试配置；包含 Node 测试参数及工作区源码别名。 */
export default defineConfig({
	test: {
		/** 允许直接使用 Vitest 全局测试函数。 */
		globals: true,
		/** 在 Node.js 环境执行，匹配代理核心的实际运行平台。 */
		environment: "node",
		testTimeout: 30000, // 30 seconds for API calls
		// 涉及 API 的单个测试最多等待 30 秒，单位为毫秒。
		/** CI 同时启用 GitHub 注解报告，本地仅输出 dot 报告。 */
		reporters: process.env.GITHUB_ACTIONS ? ["dot", "github-actions"] : ["dot"],
		/** 隐藏通过用例的普通输出，保留失败诊断。 */
		silent: "passed-only",
	},
	resolve: {
		/** 包名到本地源码文件的解析规则；正则仅接受完整匹配。 */
		alias: [
			{ find: /^@earendil-works\/pi-ai$/, replacement: aiSrcIndex },
			{ find: /^@earendil-works\/pi-ai\/compat$/, replacement: aiSrcCompat },
		],
	},
});
