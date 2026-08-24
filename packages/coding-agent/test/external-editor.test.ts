/**
 * 文件职责：验证外部编辑器在私有临时目录中编辑提示，并正确处理失败和清空内容。
 * 技术维度：使用 Vitest、真实子进程夹具、临时目录权限和文件系统捕获数据。
 * 产品维度：让用户安全调用外部编辑器，同时避免临时提示泄漏或失败时丢失原文。
 * 逻辑维度：辅助函数运行假编辑器并读取捕获结果，三个用例覆盖成功、失败和空内容。
 * 关键边界：测试会递归删除自己的临时目录；Unix 才检查目录权限低位。
 * 新手阅读建议：先看 EditorCapture 与 runExternalEditor，再比较三个 fixtureFlag 分支。
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type ExternalEditorResult, editInExternalEditor } from "../src/modes/interactive/external-editor.ts";

/** 假外部编辑器脚本的绝对路径。 */
const editorFixturePath = fileURLToPath(new URL("./fixtures/fake-external-editor.mjs", import.meta.url));

/** 假编辑器写出的环境捕获结构。 */
interface EditorCapture {
	/** 被编辑的临时文件路径。 */
	filePath: string;
	/** 编辑前文件内容。 */
	content: string;
	/** 临时目录内的条目。 */
	entries: string[];
	/** 目录 Unix 权限位。 */
	directoryMode: number;
}

/**
 * 运行假外部编辑器并返回编辑结果与捕获数据。
 * @param fixtureFlag 可选失败或清空行为开关。
 * @returns 外部编辑结果和捕获信息。
 * @example `await runExternalEditor("--empty")`。
 */
async function runExternalEditor(fixtureFlag?: "--fail" | "--empty"): Promise<{
	result: ExternalEditorResult;
	capture: EditorCapture;
}> {
	/** 存放 capture.json 的测试临时目录。 */
	const testDirectory = mkdtempSync(join(tmpdir(), "pi-external-editor-test-"));
	/** 假编辑器捕获文件路径。 */
	const capturePath = join(testDirectory, "capture.json");
	try {
		/** 被测函数返回的完成、失败或取消结果。 */
		const result = await editInExternalEditor({
			command: `${process.execPath} ${editorFixturePath} ${capturePath}${fixtureFlag ? ` ${fixtureFlag}` : ""}`,
			content: "original",
		});
		/** 假编辑器记录的调用环境。 */
		const capture = JSON.parse(readFileSync(capturePath, "utf-8")) as EditorCapture;
		return { result, capture };
	} finally {
		rmSync(testDirectory, { recursive: true, force: true });
	}
}

/** 外部编辑器集成测试组。 */
describe("editInExternalEditor", () => {
	/** 验证成功编辑使用私有目录、只含 prompt.md，并在结束后删除。 */
	it("edits a prompt inside a private temporary directory", async () => {
		/** 成功编辑结果和捕获信息。 */
		const { result, capture } = await runExternalEditor();
		/** prompt.md 所在的私有临时目录。 */
		const directory = dirname(capture.filePath);

		expect(result).toEqual({ status: "complete", content: "edited" });
		expect(dirname(directory)).toBe(tmpdir());
		expect(basename(directory)).toMatch(/^pi-editor-.+$/);
		expect(basename(capture.filePath)).toBe("prompt.md");
		expect(capture.entries).toEqual(["prompt.md"]);
		expect(capture.content).toBe("original");
		if (process.platform !== "win32") {
			expect(capture.directoryMode & 0o077).toBe(0);
		}
		expect(existsSync(directory)).toBe(false);
	});

	/** 验证编辑器失败时返回 failed 并清理临时目录。 */
	it("keeps the original content when the editor exits unsuccessfully", async () => {
		/** 失败结果与捕获信息。 */
		const { result, capture } = await runExternalEditor("--fail");

		expect(result).toEqual({ status: "failed" });
		expect(existsSync(dirname(capture.filePath))).toBe(false);
	});
	/** 验证编辑器清空文件时返回空字符串而不是原文。 */
	it("returns empty content when the editor clears the prompt", async () => {
		/** 清空编辑后的结果。 */
		const { result } = await runExternalEditor("--empty");

		expect(result).toEqual({ status: "complete", content: "" });
	});
});
