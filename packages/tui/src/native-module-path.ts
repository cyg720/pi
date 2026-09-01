/**
 * 【文件职责】实现 `@earendil-works/pi-tui` 包中的 `native-module-path` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `node:module`、`node:path`、`node:url`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为文本应用提供基于差分渲染的终端界面能力；本文件负责其中与 `native-module-path` 对应的子能力。
 * 【逻辑维度】对外入口包括 `NativeModuleCandidateOptions`、`getNativeModuleCandidates`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `NativeModuleCandidateOptions`、`getNativeModuleCandidates` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const moduleRequire = createRequire(import.meta.url);
const TUI_PACKAGE_NAME = "@earendil-works/pi-tui";

export interface NativeModuleCandidateOptions {
	moduleUrl?: string;
	execPath?: string;
	resolvePackage?: (specifier: string) => string;
}

export function getNativeModuleCandidates(nativePath: string, options: NativeModuleCandidateOptions = {}): string[] {
	const moduleDir = dirname(fileURLToPath(options.moduleUrl ?? import.meta.url));
	const candidates: string[] = [];

	try {
		const packageEntry = (options.resolvePackage ?? moduleRequire.resolve)(TUI_PACKAGE_NAME);
		candidates.push(join(dirname(packageEntry), "..", nativePath));
	} catch {
		// Standalone binaries do not have an installed TUI package.
	}

	candidates.push(
		join(moduleDir, "..", nativePath),
		join(moduleDir, nativePath),
		join(dirname(options.execPath ?? process.execPath), nativePath),
	);
	return Array.from(new Set(candidates));
}
