<<<<<<< HEAD
/**
 * 【文件职责】实现 `@earendil-works/pi-tui` 包中的 `native-modifiers` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `node:module`、`node:path`、`./native-module-path.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为文本应用提供基于差分渲染的终端界面能力；本文件负责其中与 `native-modifiers` 对应的子能力。
 * 【逻辑维度】对外入口包括 `ModifierKey`、`isNativeModifierPressed`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `ModifierKey`、`isNativeModifierPressed` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { createRequire } from "node:module";
import * as path from "node:path";
import { getNativeModuleCandidates } from "./native-module-path.ts";
=======
import { getNativePlatformHelper, type ModifierKey } from "./native-platform.ts";
>>>>>>> main

export type { ModifierKey } from "./native-platform.ts";

export function isNativeModifierPressed(key: ModifierKey): boolean {
	const helper = getNativePlatformHelper();
	if (!helper?.isModifierPressed) return false;
	try {
		return helper.isModifierPressed(key) === true;
	} catch {
		return false;
	}
}
