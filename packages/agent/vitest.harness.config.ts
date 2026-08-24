/**
 * 文件职责：为 pi-agent Harness 测试定义独立的 Vitest 发现、覆盖率和工作区别名配置。
 * 技术维度：使用 Vitest、V8 覆盖率和 ESM URL 路径解析，直接加载单仓库 TypeScript 源码。
 * 产品维度：集中验证代理会话、工具和压缩流程，并生成可定位未覆盖逻辑的报告。
 * 逻辑维度：计算三个源码入口，限制测试目录，配置覆盖率范围，最后映射跨包导入。
 * 关键边界：路径与仓库结构强绑定；30 秒超时适用于 Harness 测试但不代表生产超时。
 * 新手阅读建议：先看 include 确认测试范围，再对照 coverage.include 和 resolve.alias 阅读。
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** pi-ai 主入口的绝对路径，供 Harness 测试解析当前工作区源码。 */
const aiSrcIndex = fileURLToPath(new URL("../ai/src/index.ts", import.meta.url));
/** pi-ai 兼容层入口的绝对路径，只用于 /compat 包名。 */
const aiSrcCompat = fileURLToPath(new URL("../ai/src/compat.ts", import.meta.url));
/** pi-agent 当前源码入口的绝对路径，避免 SQLite 等跨包代码落到未构建 dist。 */
const agentSrcIndex = fileURLToPath(new URL("../agent/src/index.ts", import.meta.url));

/** Harness 专用 Vitest 配置，不影响生产运行时。 */
export default defineConfig({
	test: {
		/** 允许测试直接使用 describe、it、expect 等全局 API。 */
		globals: true,
		/** 使用 Node.js 环境运行文件系统、SQLite 和进程相关测试。 */
		environment: "node",
		/** 单用例超时 30 秒，单位为毫秒。 */
		testTimeout: 30000,
		/** 只发现 test/harness 下以 .test.ts 结尾的文件。 */
		include: ["test/harness/**/*.test.ts"],
		coverage: {
			/** 使用 Node/V8 原生覆盖率采集器。 */
			provider: "v8",
			/** 未被测试导入的目标源码也计入覆盖率。 */
			all: true,
			/** 需要统计的 Harness 源码、代理与循环入口。 */
			include: ["src/harness/**/*.ts", "src/agent.ts", "src/agent-loop.ts"],
			/** 声明文件没有运行代码，因此排除在覆盖率之外。 */
			exclude: ["src/**/*.d.ts"],
			/** 同时输出终端文本、HTML 和 lcov 三种报告。 */
			reporter: ["text", "html", "lcov"],
			/** 覆盖率产物目录，相对于 pi-agent 包根目录。 */
			reportsDirectory: "coverage/harness",
		},
	},
	resolve: {
		/** 包名到工作区源码文件的精确解析规则。 */
		alias: [
			{ find: /^@earendil-works\/pi-agent-core$/, replacement: agentSrcIndex },
			{ find: /^@earendil-works\/pi-ai$/, replacement: aiSrcIndex },
			{ find: /^@earendil-works\/pi-ai\/compat$/, replacement: aiSrcCompat },
		],
	},
});
