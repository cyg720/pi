import { getKeybindings } from "../keybindings.ts";
import { decodeKittyPrintable } from "../keys.ts";
import { KillRing } from "../kill-ring.ts";
import { type Component, CURSOR_MARKER, type Focusable } from "../tui.ts";
import { UndoStack } from "../undo-stack.ts";
import { getGraphemeSegmenter, isWhitespaceChar, sliceByColumn, visibleWidth } from "../utils.ts";
import { findWordBackward, findWordForward } from "../word-navigation.ts";

const segmenter = getGraphemeSegmenter();

// 撤销快照（私有）：值与光标位置的组合
interface InputState {
	value: string;
	cursor: number;
}

/**
 * Input component - single-line text input with horizontal scrolling
 */
/**
 * Input 组件（中文说明）：单行文本输入框，支持水平滚动、括号粘贴、Emacs 风格 kill/yank、
 * 按词移动/删除、字素级左右移动与撤销。是搜索框等单行交互的基础组件。
 */
export class Input implements Component, Focusable {
	// 当前输入内容
	private value: string = "";
	// 光标在 value 中的字符下标
	private cursor: number = 0; // Cursor position in the value
	// 提交回调（Enter）
	public onSubmit?: (value: string) => void;
	// 取消回调（Esc）
	public onEscape?: () => void;

	/** Focusable interface - set by TUI when focus changes */
	// 焦点状态：由 TUI 在焦点切换时设置
	focused: boolean = false;

	// Bracketed paste mode buffering
	// 括号粘贴缓冲
	private pasteBuffer: string = "";
	// 是否正在接收括号粘贴
	private isInPaste: boolean = false;

	// Kill ring for Emacs-style kill/yank operations
	// Emacs 风格剪切环
	private killRing = new KillRing();
	// 上一次操作类型：用于 kill 合并与打字合并成组撤销
	private lastAction: "kill" | "yank" | "type-word" | null = null;

	// Undo support
	// 撤销栈
	private undoStack = new UndoStack<InputState>();

	// 读取当前输入值
	getValue(): string {
		return this.value;
	}

	// 设置输入值；光标钳制到新值末尾
	setValue(value: string): void {
		this.value = value;
		this.cursor = Math.min(this.cursor, value.length);
	}

	// 输入分发主入口（公开）：粘贴状态机 → 取消/撤销/提交 → 删除类 → 剪切环 → 光标移动 →
	// Kitty CSI-u 可打印解码 → 普通可打印字符插入
	handleInput(data: string): void {
		// Handle bracketed paste mode
		// Start of paste: \x1b[200~
		// End of paste: \x1b[201~

		// Check if we're starting a bracketed paste
		if (data.includes("\x1b[200~")) {
			this.isInPaste = true;
			this.pasteBuffer = "";
			data = data.replace("\x1b[200~", "");
		}

		// If we're in a paste, buffer the data
		if (this.isInPaste) {
			// Check if this chunk contains the end marker
			this.pasteBuffer += data;

			const endIndex = this.pasteBuffer.indexOf("\x1b[201~");
			if (endIndex !== -1) {
				// Extract the pasted content
				const pasteContent = this.pasteBuffer.substring(0, endIndex);

				// Process the complete paste
				this.handlePaste(pasteContent);

				// Reset paste state
				this.isInPaste = false;

				// Handle any remaining input after the paste marker
				const remaining = this.pasteBuffer.substring(endIndex + 6); // 6 = length of \x1b[201~
				this.pasteBuffer = "";
				if (remaining) {
					this.handleInput(remaining);
				}
			}
			return;
		}

		const kb = getKeybindings();

		// Escape/Cancel
		if (kb.matches(data, "tui.select.cancel")) {
			if (this.onEscape) this.onEscape();
			return;
		}

		// Undo
		if (kb.matches(data, "tui.editor.undo")) {
			this.undo();
			return;
		}

		// Submit
		if (kb.matches(data, "tui.input.submit") || data === "\n") {
			if (this.onSubmit) this.onSubmit(this.value);
			return;
		}

		// Deletion
		if (kb.matches(data, "tui.editor.deleteCharBackward")) {
			this.handleBackspace();
			return;
		}

		if (kb.matches(data, "tui.editor.deleteCharForward")) {
			this.handleForwardDelete();
			return;
		}

		if (kb.matches(data, "tui.editor.deleteWordBackward")) {
			this.deleteWordBackwards();
			return;
		}

		if (kb.matches(data, "tui.editor.deleteWordForward")) {
			this.deleteWordForward();
			return;
		}

		if (kb.matches(data, "tui.editor.deleteToLineStart")) {
			this.deleteToLineStart();
			return;
		}

		if (kb.matches(data, "tui.editor.deleteToLineEnd")) {
			this.deleteToLineEnd();
			return;
		}

		// Kill ring actions
		if (kb.matches(data, "tui.editor.yank")) {
			this.yank();
			return;
		}
		if (kb.matches(data, "tui.editor.yankPop")) {
			this.yankPop();
			return;
		}

		// Cursor movement
		if (kb.matches(data, "tui.editor.cursorLeft")) {
			this.lastAction = null;
			if (this.cursor > 0) {
				const beforeCursor = this.value.slice(0, this.cursor);
				const graphemes = [...segmenter.segment(beforeCursor)];
				const lastGrapheme = graphemes[graphemes.length - 1];
				this.cursor -= lastGrapheme ? lastGrapheme.segment.length : 1;
			}
			return;
		}

		if (kb.matches(data, "tui.editor.cursorRight")) {
			this.lastAction = null;
			if (this.cursor < this.value.length) {
				const afterCursor = this.value.slice(this.cursor);
				const graphemes = [...segmenter.segment(afterCursor)];
				const firstGrapheme = graphemes[0];
				this.cursor += firstGrapheme ? firstGrapheme.segment.length : 1;
			}
			return;
		}

		if (kb.matches(data, "tui.editor.cursorLineStart")) {
			this.lastAction = null;
			this.cursor = 0;
			return;
		}

		if (kb.matches(data, "tui.editor.cursorLineEnd")) {
			this.lastAction = null;
			this.cursor = this.value.length;
			return;
		}

		if (kb.matches(data, "tui.editor.cursorWordLeft")) {
			this.moveWordBackwards();
			return;
		}

		if (kb.matches(data, "tui.editor.cursorWordRight")) {
			this.moveWordForwards();
			return;
		}

		// Kitty CSI-u printable character (e.g. \x1b[97u for 'a').
		// Terminals with Kitty protocol flag 1 (disambiguate) send CSI-u for all keys,
		// including plain printable characters. Decode before the control-char check
		// since CSI-u sequences contain \x1b which would be rejected.
		const kittyPrintable = decodeKittyPrintable(data);
		if (kittyPrintable !== undefined) {
			this.insertCharacter(kittyPrintable);
			return;
		}

		// Regular character input - accept printable characters including Unicode,
		// but reject control characters (C0: 0x00-0x1F, DEL: 0x7F, C1: 0x80-0x9F)
		const hasControlChars = [...data].some((ch) => {
			const code = ch.charCodeAt(0);
			return code < 32 || code === 0x7f || (code >= 0x80 && code <= 0x9f);
		});
		if (!hasControlChars) {
			this.insertCharacter(data);
		}
	}

	// 插入单个字符（私有）：连续打字合并为一个撤销单元（遇空白或动作切换才重新压栈）
	private insertCharacter(char: string): void {
		// Undo coalescing: consecutive word chars coalesce into one undo unit
		if (isWhitespaceChar(char) || this.lastAction !== "type-word") {
			this.pushUndo();
		}
		this.lastAction = "type-word";

		this.value = this.value.slice(0, this.cursor) + char + this.value.slice(this.cursor);
		this.cursor += char.length;
	}

	// 退格删除（私有）：按字素删除光标前一个字符
	private handleBackspace(): void {
		this.lastAction = null;
		if (this.cursor > 0) {
			this.pushUndo();
			const beforeCursor = this.value.slice(0, this.cursor);
			const graphemes = [...segmenter.segment(beforeCursor)];
			const lastGrapheme = graphemes[graphemes.length - 1];
			const graphemeLength = lastGrapheme ? lastGrapheme.segment.length : 1;
			this.value = this.value.slice(0, this.cursor - graphemeLength) + this.value.slice(this.cursor);
			this.cursor -= graphemeLength;
		}
	}

	// 前向删除（私有）：按字素删除光标处字符
	private handleForwardDelete(): void {
		this.lastAction = null;
		if (this.cursor < this.value.length) {
			this.pushUndo();
			const afterCursor = this.value.slice(this.cursor);
			const graphemes = [...segmenter.segment(afterCursor)];
			const firstGrapheme = graphemes[0];
			const graphemeLength = firstGrapheme ? firstGrapheme.segment.length : 1;
			this.value = this.value.slice(0, this.cursor) + this.value.slice(this.cursor + graphemeLength);
		}
	}

	// 删除到行首（私有）：删入剪切环（向前拼接，可累积）
	private deleteToLineStart(): void {
		if (this.cursor === 0) return;
		this.pushUndo();
		const deletedText = this.value.slice(0, this.cursor);
		this.killRing.push(deletedText, { prepend: true, accumulate: this.lastAction === "kill" });
		this.lastAction = "kill";
		this.value = this.value.slice(this.cursor);
		this.cursor = 0;
	}

	// 删除到行尾（私有）：删入剪切环（向后拼接，可累积）
	private deleteToLineEnd(): void {
		if (this.cursor >= this.value.length) return;
		this.pushUndo();
		const deletedText = this.value.slice(this.cursor);
		this.killRing.push(deletedText, { prepend: false, accumulate: this.lastAction === "kill" });
		this.lastAction = "kill";
		this.value = this.value.slice(0, this.cursor);
	}

	// 向前删一个词（私有）：先记住是否连续 kill，借词移动定位边界后再删除并入环
	private deleteWordBackwards(): void {
		if (this.cursor === 0) return;

		// Save lastAction before cursor movement (moveWordBackwards resets it)
		const wasKill = this.lastAction === "kill";

		this.pushUndo();

		const oldCursor = this.cursor;
		this.moveWordBackwards();
		const deleteFrom = this.cursor;
		this.cursor = oldCursor;

		const deletedText = this.value.slice(deleteFrom, this.cursor);
		this.killRing.push(deletedText, { prepend: true, accumulate: wasKill });
		this.lastAction = "kill";

		this.value = this.value.slice(0, deleteFrom) + this.value.slice(this.cursor);
		this.cursor = deleteFrom;
	}

	// 向后删一个词（私有）：逻辑与 deleteWordBackwards 镜像
	private deleteWordForward(): void {
		if (this.cursor >= this.value.length) return;

		// Save lastAction before cursor movement (moveWordForwards resets it)
		const wasKill = this.lastAction === "kill";

		this.pushUndo();

		const oldCursor = this.cursor;
		this.moveWordForwards();
		const deleteTo = this.cursor;
		this.cursor = oldCursor;

		const deletedText = this.value.slice(this.cursor, deleteTo);
		this.killRing.push(deletedText, { prepend: false, accumulate: wasKill });
		this.lastAction = "kill";

		this.value = this.value.slice(0, this.cursor) + this.value.slice(deleteTo);
	}

	// yank 粘贴（私有）：把剪切环最新条目插入光标处
	private yank(): void {
		const text = this.killRing.peek();
		if (!text) return;

		this.pushUndo();

		this.value = this.value.slice(0, this.cursor) + text + this.value.slice(this.cursor);
		this.cursor += text.length;
		this.lastAction = "yank";
	}

	// yank-pop 轮换（私有）：仅在上一步是 yank 时有效——删掉刚贴的内容，
	// 轮换剪切环后贴入上一条
	private yankPop(): void {
		if (this.lastAction !== "yank" || this.killRing.length <= 1) return;

		this.pushUndo();

		// Delete the previously yanked text (still at end of ring before rotation)
		const prevText = this.killRing.peek() || "";
		this.value = this.value.slice(0, this.cursor - prevText.length) + this.value.slice(this.cursor);
		this.cursor -= prevText.length;

		// Rotate and insert new entry
		this.killRing.rotate();
		const text = this.killRing.peek() || "";
		this.value = this.value.slice(0, this.cursor) + text + this.value.slice(this.cursor);
		this.cursor += text.length;
		this.lastAction = "yank";
	}

	// 压入撤销快照（私有）
	private pushUndo(): void {
		this.undoStack.push({ value: this.value, cursor: this.cursor });
	}

	// 撤销（私有）：弹出快照恢复值与光标；无快照则忽略
	private undo(): void {
		const snapshot = this.undoStack.pop();
		if (!snapshot) return;
		this.value = snapshot.value;
		this.cursor = snapshot.cursor;
		this.lastAction = null;
	}

	// 光标按词左移（私有）
	private moveWordBackwards(): void {
		if (this.cursor === 0) return;
		this.lastAction = null;
		this.cursor = findWordBackward(this.value, this.cursor);
	}

	// 光标按词右移（私有）
	private moveWordForwards(): void {
		if (this.cursor >= this.value.length) return;
		this.lastAction = null;
		this.cursor = findWordForward(this.value, this.cursor);
	}

	// 处理一次完整粘贴（私有）：清除换行/回车、tab 转 4 空格后整体插入光标处
	private handlePaste(pastedText: string): void {
		this.lastAction = null;
		this.pushUndo();

		// Clean the pasted text - remove newlines and carriage returns
		const cleanText = pastedText.replace(/\r\n/g, "").replace(/\r/g, "").replace(/\n/g, "").replace(/\t/g, "    ");

		// Insert at cursor position
		this.value = this.value.slice(0, this.cursor) + cleanText + this.value.slice(this.cursor);
		this.cursor += cleanText.length;
	}

	invalidate(): void {
		// No cached state to invalidate currently
	}

	// 渲染（公开）：计算可视窗口（必要时水平滚动）→ 用反显视频伪造光标 →
	// 前置硬件光标标记供 IME 定位 → 补空格到整行宽
	render(width: number): string[] {
		// Calculate visible window
		// 固定提示符
		const prompt = "> ";
		const availableWidth = width - prompt.length;

		// 宽度不足以容纳提示符：直接返回提示符
		if (availableWidth <= 0) {
			return [prompt];
		}

		let visibleText = "";
		let cursorDisplay = this.cursor;
		const totalWidth = visibleWidth(this.value);

			// 全部内容放得下：无需滚动
		if (totalWidth < availableWidth) {
			// Everything fits (leave room for cursor at end)
			visibleText = this.value;
		} else {
			// Need horizontal scrolling
			// Reserve one column for cursor if it's at the end
			// 需要滚动：光标在末尾时预留一列显示光标
			const scrollWidth = this.cursor === this.value.length ? availableWidth - 1 : availableWidth;
			const cursorCol = visibleWidth(this.value.slice(0, this.cursor));

			if (scrollWidth > 0) {
				const halfWidth = Math.floor(scrollWidth / 2);
				let startCol = 0;

				// 光标靠近起点：窗口从 0 开始
				if (cursorCol < halfWidth) {
					// Cursor near start
					startCol = 0;
				// 光标靠近终点：窗口贴住末端
				} else if (cursorCol > totalWidth - halfWidth) {
					// Cursor near end
					startCol = Math.max(0, totalWidth - scrollWidth);
				} else {
					// Cursor in middle
					startCol = Math.max(0, cursorCol - halfWidth);
				}

				visibleText = sliceByColumn(this.value, startCol, scrollWidth, true);
				const beforeCursor = sliceByColumn(this.value, startCol, Math.max(0, cursorCol - startCol), true);
				cursorDisplay = beforeCursor.length;
			} else {
				visibleText = "";
				cursorDisplay = 0;
			}
		}

		// Build line with fake cursor
		// Insert cursor character at cursor position
		const graphemes = [...segmenter.segment(visibleText.slice(cursorDisplay))];
		const cursorGrapheme = graphemes[0];

		const beforeCursor = visibleText.slice(0, cursorDisplay);
		const atCursor = cursorGrapheme?.segment ?? " "; // Character at cursor, or space if at end
		const afterCursor = visibleText.slice(cursorDisplay + atCursor.length);

		// Hardware cursor marker (zero-width, emitted before fake cursor for IME positioning)
		const marker = this.focused ? CURSOR_MARKER : "";

		// Use inverse video to show cursor
		const cursorChar = `\x1b[7m${atCursor}\x1b[27m`; // ESC[7m = reverse video, ESC[27m = normal
		const textWithCursor = beforeCursor + marker + cursorChar + afterCursor;

		// Calculate visual width
		const visualLength = visibleWidth(textWithCursor);
		const padding = " ".repeat(Math.max(0, availableWidth - visualLength));
		const line = prompt + textWithCursor + padding;

		return [line];
	}
}
