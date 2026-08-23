import { createRequire } from "module";
import { dirname, join } from "path";
import { pathToFileURL } from "url";

/**
 * 【文件职责】剪贴板原生支持：加载/封装原生剪贴板模块（可选能力降级）。
 * 【新手阅读建议】看加载与降级。
 */
export type ClipboardModule = {
	getText: () => Promise<string>;
	setText: (text: string) => Promise<void>;
	hasImage: () => boolean;
	getImageBinary: () => Promise<Array<number>>;
};

type ClipboardRequire = (id: string) => unknown;

const moduleRequire = createRequire(import.meta.url);
const executableDirRequire = createRequire(pathToFileURL(join(dirname(process.execPath), "package.json")).href);
const hasDisplay = process.platform !== "linux" || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

export function loadClipboardNative(
	requires: readonly ClipboardRequire[] = [moduleRequire, executableDirRequire],
): ClipboardModule | null {
	for (const requireClipboard of requires) {
		try {
			return requireClipboard("@mariozechner/clipboard") as ClipboardModule;
		} catch {
			// Try the next resolution root.
		}
	}
	return null;
}

const clipboard = !process.env.TERMUX_VERSION && hasDisplay ? loadClipboardNative() : null;

export { clipboard };
