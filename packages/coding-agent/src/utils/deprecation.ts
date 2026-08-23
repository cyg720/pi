import chalk from "chalk";

const emittedDeprecationWarnings = new Set<string>();

/**
 * 【文件职责】弃用提示：检测/提示已废弃配置或用法。
 * 【新手阅读建议】半分钟读完。
 */
export function warnDeprecation(message: string): void {
	if (emittedDeprecationWarnings.has(message)) return;
	emittedDeprecationWarnings.add(message);
	console.warn(chalk.yellow(`Deprecation warning: ${message}`));
}

/** Clear deprecation warning state. Exported for tests. */
export function clearDeprecationWarningsForTests(): void {
	emittedDeprecationWarnings.clear();
}
