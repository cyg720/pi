/** Wire-only terminal snapshots. No host terminal handles or executable configuration. */
export type TerminalStatus = "starting" | "running" | "exited" | "closed" | "error";
export interface TerminalColor {
	mode: "palette" | "rgb";
	value: number;
}
export interface TerminalScreenRun {
	x: number;
	width: number;
	text: string;
	fg: TerminalColor | null;
	bg: TerminalColor | null;
	bold: boolean;
	dim: boolean;
	italic: boolean;
	underline: boolean;
	inverse: boolean;
	invisible: boolean;
	strikethrough: boolean;
}
export interface TerminalSnapshot {
	id: string;
	sessionId: string;
	status: TerminalStatus;
	cols: number;
	rows: number;
	lines: string[];
	screen: TerminalScreenRun[][];
	cursor: { x: number; y: number; visible: boolean };
	buffer: "normal" | "alternate";
	modes: { applicationCursorKeys: boolean; bracketedPaste: boolean };
	exitCode: number | null;
	error?: string;
	outputBytes: number;
}
