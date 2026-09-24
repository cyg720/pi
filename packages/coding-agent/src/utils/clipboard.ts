<<<<<<< HEAD
/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `utils/clipboard` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `child_process`、`os`、`./clipboard-image.ts`、`./clipboard-native.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `utils/clipboard` 对应的子能力。
 * 【逻辑维度】对外入口包括 `readClipboardText`、`copyToClipboard`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `readClipboardText`、`copyToClipboard` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { type ExecFileSyncOptionsWithStringEncoding, execFileSync, execSync, spawn } from "child_process";
import { platform } from "os";
import { isWaylandSession } from "./clipboard-image.ts";
import { clipboard } from "./clipboard-native.ts";

type NativeClipboardExecOptions = {
	input: string;
	timeout: number;
	stdio: ["pipe", "ignore", "ignore"];
};

function copyToX11Clipboard(options: NativeClipboardExecOptions): void {
	try {
		execSync("xclip -selection clipboard", options);
	} catch {
		execSync("xsel --clipboard --input", options);
	}
}
=======
import { randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import { getNativeClipboard } from "@earendil-works/pi-tui";
import { runClipboardCommand } from "./clipboard-command.ts";
import { isWSL } from "./wsl.ts";
>>>>>>> main

const MAX_OSC52_ENCODED_LENGTH = 100_000;

function isRemoteSession(env: NodeJS.ProcessEnv): boolean {
	return Boolean(env.SSH_CONNECTION || env.SSH_CLIENT || env.MOSH_CONNECTION);
}

function emitOsc52(text: string): boolean {
	const encoded = Buffer.from(text).toString("base64");
	if (encoded.length > MAX_OSC52_ENCODED_LENGTH) {
		return false;
	}
	process.stdout.write(`\x1b]52;c;${encoded}\x07`);
	return true;
}

/**
 * WSL without WSLg has no Linux display, so the Windows clipboard is written through
 * interop. PowerShell reads the text from a file because `clip.exe` and PowerShell stdin
 * decode piped bytes with the console code page, which mangles non-ASCII UTF-8.
 */
async function copyViaWindowsClipboard(text: string): Promise<boolean> {
	const tmpFile = join(tmpdir(), `pi-wsl-clip-${randomUUID()}.txt`);
	try {
		writeFileSync(tmpFile, text, { encoding: "utf8", mode: 0o600 });
		const winPath = (await runClipboardCommand("wslpath", ["-w", tmpFile], { timeoutMs: 1000 }))
			?.toString("utf8")
			.trim();
		if (!winPath) return false;
		const script = `Set-Clipboard -Value ([System.IO.File]::ReadAllText('${winPath.replaceAll("'", "''")}', [System.Text.Encoding]::UTF8))`;
		const result = await runClipboardCommand("powershell.exe", ["-NoProfile", "-Command", script], {
			timeoutMs: 5000,
		});
		return result !== undefined;
	} catch {
		return false;
	} finally {
		try {
			unlinkSync(tmpFile);
		} catch {
			// The file may not have been created.
		}
	}
}

/** Read plain text from the system clipboard. */
export async function readClipboardText(): Promise<string | null> {
	if (platform() === "linux") {
		const commands: [string, string[]][] = [];
		if (process.env.TERMUX_VERSION) commands.push(["termux-clipboard-get", []]);
		if (process.env.WAYLAND_DISPLAY) commands.push(["wl-paste", ["--no-newline", "--type", "text"]]);
		if (process.env.DISPLAY) {
			commands.push(["xclip", ["-selection", "clipboard", "-out"]], ["xsel", ["--clipboard", "--output"]]);
		}
		for (const [command, args] of commands) {
			const bytes = await runClipboardCommand(command, args, { timeoutMs: 5000 });
			if (bytes !== undefined) return bytes.toString("utf8") || null;
		}
	}
	try {
		return (await getNativeClipboard()?.getText()) || null;
	} catch {
		return null;
	}
}

export async function copyToClipboard(text: string): Promise<void> {
	const p = platform();
	const env = process.env;
	let copied = false;
	// Direct writes precede OSC 52 so the terminal cannot race the native writer.
	// Linux tools retain clipboard selection ownership after this call returns.
	if (p !== "linux") {
		try {
			const clipboard = getNativeClipboard();
			if (clipboard?.setText) {
				await clipboard.setText(text);
				copied = true;
			}
		} catch {
			// Try platform commands next.
		}
	}
	if (!copied) {
		const commands: [string, string[]][] = [];
		if (p === "darwin") commands.push(["pbcopy", []]);
		else if (p === "win32") commands.push(["clip", []]);
		else {
			if (env.TERMUX_VERSION) commands.push(["termux-clipboard-set", []]);
			if (env.WAYLAND_DISPLAY) commands.push(["wl-copy", []]);
			if (env.DISPLAY) {
				commands.push(["xclip", ["-selection", "clipboard"]], ["xsel", ["--clipboard", "--input"]]);
			}
		}
		for (const [command, args] of commands) {
			if ((await runClipboardCommand(command, args, { input: text, timeoutMs: 5000 })) !== undefined) {
				copied = true;
				break;
			}
		}
	}
	let osc52Emitted = false;
	if (!copied && p === "linux" && isWSL(env)) {
		// Windows Terminal supports OSC 52; prefer it over the slower PowerShell round trip.
		if (env.WT_SESSION) osc52Emitted = emitOsc52(text);
		copied = osc52Emitted || (await copyViaWindowsClipboard(text));
	}
	// OSC 52 cannot be verified, so a desktop session with a display reports the failure
	// instead (#9618). Without a display the terminal is the only clipboard route (containers,
	// WSL without WSLg), and remote sessions always emit it to reach the client clipboard.
	const headless = p === "linux" && !env.DISPLAY && !env.WAYLAND_DISPLAY && !env.TERMUX_VERSION;
	let oversized = false;
	if (!osc52Emitted && (isRemoteSession(env) || (!copied && headless))) {
		if (emitOsc52(text)) copied = true;
		else oversized = true;
	}
	if (copied) return;
	if (oversized) throw new Error("Clipboard unavailable: text exceeds the OSC 52 size limit");
	if (p === "linux") {
		if (env.TERMUX_VERSION) {
			throw new Error("Clipboard unavailable: install the Termux:API app and `termux-api` package");
		}
		if (env.WAYLAND_DISPLAY) {
			throw new Error("Clipboard unavailable: install `wl-clipboard` (`wl-copy`) or check Wayland access");
		}
		if (env.DISPLAY) {
			throw new Error("Clipboard unavailable: install `xclip` or `xsel`, or check X11 access");
		}
	}
	throw new Error("Clipboard unavailable");
}
