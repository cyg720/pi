/**
 * 【文件职责】实现 `@earendil-works/pi-evals` 包中的 `vitest-evals/setup` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `vitest`、`vitest-evals`、`./artifacts.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的评测场景提供运行与结果处理能力；本文件负责其中与 `vitest-evals/setup` 对应的子能力。
 * 【逻辑维度】本文件不直接导出公开符号，由包内流程加载并执行其中的辅助逻辑。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先从调用本文件的上层入口定位执行时机，再沿内部调用链理解具体实现。
 */
import { afterEach } from "vitest";
import type {} from "vitest-evals";
import { recordEvalSessionArtifact } from "./artifacts.ts";

afterEach(async ({ task }) => {
	const run = task.meta.harness?.run;
	if (run) await recordEvalSessionArtifact(task, run);
});
