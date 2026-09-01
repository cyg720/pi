/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `core/experimental` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 语言内建能力与本文件声明，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `core/experimental` 对应的子能力。
 * 【逻辑维度】对外入口包括 `areExperimentalFeaturesEnabled`、`getExperimentalToolSampling`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `areExperimentalFeaturesEnabled`、`getExperimentalToolSampling` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
const PREFER_STRICT_TOOL_SAMPLING = { type: "json_schema", strict: "prefer" } as const;

export function areExperimentalFeaturesEnabled(): boolean {
	return process.env.PI_EXPERIMENTAL === "1";
}

export function getExperimentalToolSampling() {
	return areExperimentalFeaturesEnabled() ? PREFER_STRICT_TOOL_SAMPLING : undefined;
}
