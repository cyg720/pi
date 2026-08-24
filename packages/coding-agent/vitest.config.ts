/**
 * 文件职责：组合编码代理包的 Vitest 基础配置、运行参数、原生依赖处理和旧包名源码别名。
 * 技术维度：使用 defineConfig 与 mergeConfig 合并配置，通过正则别名和 workspaceSourcePaths 定位单仓库源码。
 * 产品维度：保证编码代理测试在 Node 环境稳定运行，并继续覆盖旧命名空间导入的兼容路径。
 * 逻辑维度：载入根配置，补充测试选项、将 photon-node 外置，再为四个旧包名建立源码映射。
 * 关键边界：外置原生依赖要求运行环境能解析已安装模块；别名只处理列出的精确包名。
 * 新手阅读建议：先阅读 vitest.base.ts，再区分 mergeConfig 中 test 与 resolve 两部分的职责。
 */
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig, { workspaceSourcePaths } from "../../vitest.base.ts";

/** 编码代理最终测试配置；在根配置之上叠加本包专用规则。 */
export default mergeConfig(
	// baseConfig 提供当前命名空间的工作区别名，是合并的基础层。
	baseConfig,
	defineConfig({
		test: {
			/** 允许测试直接使用 Vitest 全局 API。 */
			globals: true,
			/** 使用 Node.js 测试环境，匹配编码代理的主要运行平台。 */
			environment: "node",
			/** 单个测试超时为 30 秒，数值单位是毫秒。 */
			testTimeout: 30000,
			/** CI 增加 GitHub Actions 报告器，本地仅使用 dot 报告器。 */
			reporters: process.env.GITHUB_ACTIONS ? ["dot", "github-actions"] : ["dot"],
			/** 隐藏通过用例的普通输出，保留失败信息。 */
			silent: "passed-only",
			server: {
				deps: {
					/** 交由 Node 直接加载的原生依赖；避免 Vitest 对 photon-node 做不兼容的转换。 */
					external: [/@silvia-odwyer\/photon-node/],
				},
			},
		},
		resolve: {
			/** 旧 @mariozechner 命名空间到当前工作区源码入口的兼容别名。 */
			alias: [
				{ find: /^@mariozechner\/pi-ai$/, replacement: workspaceSourcePaths.aiIndex },
				{ find: /^@mariozechner\/pi-ai\/oauth$/, replacement: workspaceSourcePaths.aiOAuth },
				{ find: /^@mariozechner\/pi-agent-core$/, replacement: workspaceSourcePaths.agentIndex },
				{ find: /^@mariozechner\/pi-tui$/, replacement: workspaceSourcePaths.tuiIndex },
			],
		},
	}),
);
