/**
 * 文件职责：配置 pi-evals 的评测文件发现、串行执行、专用报告器和跨包源码别名。
 * 技术维度：使用 Vitest mergeConfig、vitest-evals 报告器、依赖内联和 ESM 路径解析。
 * 产品维度：让模型评测以稳定顺序运行并输出结构化评分，同时直接覆盖工作区最新代码。
 * 逻辑维度：继承基础配置，设置评测超时与报告器，内联 Harness 依赖，再建立兼容包名映射。
 * 关键边界：评测文件不并行，整批可能较慢；两分钟用例超时不等同于产品请求超时。
 * 新手阅读建议：先看 include 和 fileParallelism，再理解专用 reporter 与三个 alias 的用途。
 */
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig, { workspaceSourcePaths } from "../../vitest.base.ts";

/** 评测兼容层的绝对源码路径，用来替换旧 pi-ai 包名。 */
const piAiCompatIndex = fileURLToPath(new URL("./src/pi-ai-compat.ts", import.meta.url));

/** 评测包最终配置；由全仓基础配置和本包专用选项合并而成。 */
export default mergeConfig(
	// baseConfig 提供当前 @earendil-works 包名的工作区解析规则。
	baseConfig,
	defineConfig({
		test: {
			/** 在 Node.js 环境执行评测 Harness。 */
			environment: "node",
			/** 禁止文件级并行，减少模型请求互相干扰。 */
			fileParallelism: false,
			/** 只发现 src 下以 .eval.ts 结尾的评测文件。 */
			include: ["src/**/*.eval.ts"],
			/** 单评测超时两分钟，数值单位为毫秒。 */
			testTimeout: 120000,
			/** 生命周期钩子超时 30 秒。 */
			hookTimeout: 30000,
			/** 使用 vitest-evals 专用报告器输出评测结果。 */
			reporters: ["vitest-evals/reporter"],
			server: {
				deps: {
					/** 将评测 Harness 包交给 Vitest 转换，以兼容工作区源码。 */
					inline: [/@vitest-evals\/harness-pi-ai/],
				},
			},
		},
		resolve: {
			/** 当前与旧命名空间到工作区评测适配入口的别名规则。 */
			alias: [
				{ find: /^@earendil-works\/pi-coding-agent$/, replacement: workspaceSourcePaths.codingAgentIndex },
				{ find: /^@mariozechner\/pi-ai$/, replacement: piAiCompatIndex },
				{ find: /^@mariozechner\/pi-agent-core$/, replacement: workspaceSourcePaths.agentIndex },
			],
		},
	}),
);
