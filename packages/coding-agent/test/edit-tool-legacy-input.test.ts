/**
 * 文件职责：验证 edit 工具仍能规范化旧版 oldText/newText 输入及字符串化 edits，同时不公开旧字段。
 * 技术维度：使用 Vitest、临时文件系统和工具定义的 prepareArguments/execute 两阶段接口。
 * 产品维度：兼容历史模型生成的编辑参数，并保证新版公开模式保持简洁且执行结果正确。
 * 逻辑维度：先测试参数模式与旧字段折叠，再测试实际文件编辑，最后覆盖 JSON 字符串解析失败边界。
 * 关键边界：兼容只发生在预处理层；合法新输入应保持对象身份，无效 JSON 字符串不得被破坏。
 * 新手阅读建议：先看 prepareArguments 的输入输出对照，再阅读最后的真实文件执行测试。
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ExtensionContext } from "../src/core/extensions/types.ts";
import { createEditToolDefinition } from "../src/core/tools/edit.ts";

// 所有待清理临时目录；每个用例可追加，afterEach 会一次性清空。
const tempDirs: string[] = [];

/** 功能：创建并登记独占临时目录；参数：无；返回：目录绝对路径。示例：const dir = await createTempDir()。 */
async function createTempDir(): Promise<string> {
	// 由操作系统临时目录派生的唯一测试目录。
	const dir = await mkdtemp(join(tmpdir(), "pi-edit-legacy-input-"));
	tempDirs.push(dir);
	return dir;
}

// 功能：并行删除所有登记目录；参数：无；返回：完成清理的 Promise。示例：Vitest 每个用例后自动调用。
afterEach(async () => {
	await Promise.all(tempDirs.splice(0, tempDirs.length).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("edit tool prepareArguments", () => {
	it("keeps legacy fields out of the public schema", () => {
		// 当前工作目录下的 edit 工具定义；只检查其公开参数模式。
		const definition = createEditToolDefinition(process.cwd());
		expect(definition.parameters.properties).not.toHaveProperty("oldText");
		expect(definition.parameters.properties).not.toHaveProperty("newText");
	});

	it("folds top-level oldText/newText into edits", () => {
		// 负责执行旧参数兼容预处理的 edit 工具定义。
		const definition = createEditToolDefinition(process.cwd());
		// 顶层旧字段规范化后的参数；应包含单元素 edits 数组。
		const prepared = definition.prepareArguments!({
			path: "file.txt",
			oldText: "before",
			newText: "after",
		});
		expect(prepared).toEqual({
			path: "file.txt",
			edits: [{ oldText: "before", newText: "after" }],
		});
	});

	it("appends legacy replacement to existing edits", () => {
		// 负责合并新旧编辑描述的 edit 工具定义。
		const definition = createEditToolDefinition(process.cwd());
		// 同时含 edits 和旧字段时的预处理结果；旧替换应追加到末尾。
		const prepared = definition.prepareArguments!({
			path: "file.txt",
			edits: [{ oldText: "a", newText: "b" }],
			oldText: "c",
			newText: "d",
		});
		expect(prepared).toEqual({
			path: "file.txt",
			edits: [
				{ oldText: "a", newText: "b" },
				{ oldText: "c", newText: "d" },
			],
		});
	});

	it("passes through valid input unchanged", () => {
		// 负责判断输入是否已符合新版结构的工具定义。
		const definition = createEditToolDefinition(process.cwd());
		// 已合法的新版输入；预处理后必须保持同一对象引用。
		const input = {
			path: "file.txt",
			edits: [{ oldText: "a", newText: "b" }],
		};
		// 对合法输入执行预处理得到的返回值。
		const prepared = definition.prepareArguments!(input);
		expect(prepared).toBe(input);
	});

	it("passes through non-object input unchanged", () => {
		// 用于检查 null、undefined 和字符串透传行为的工具定义。
		const definition = createEditToolDefinition(process.cwd());
		expect(definition.prepareArguments!(null)).toBe(null);
		expect(definition.prepareArguments!(undefined)).toBe(undefined);
		expect(definition.prepareArguments!("garbage")).toBe("garbage");
	});

	it("prepared args execute correctly", async () => {
		// 实际文件编辑场景的临时工作目录。
		const dir = await createTempDir();
		// 待编辑文件的绝对路径，内容初始为 before。
		const filePath = join(dir, "legacy.txt");
		await writeFile(filePath, "before\n", "utf8");

		// 绑定临时目录的 edit 工具定义。
		const definition = createEditToolDefinition(dir);
		// 从旧字段转换出的可执行新版参数。
		const prepared = definition.prepareArguments!({
			path: "legacy.txt",
			oldText: "before",
			newText: "after",
		});

		// 工具实际执行结果；应报告替换一个文本块。
		const result = await definition.execute("tool-1", prepared, undefined, undefined, {} as ExtensionContext);
		expect(result.content).toEqual([{ type: "text", text: "Successfully replaced 1 block(s) in legacy.txt." }]);
		expect(await readFile(filePath, "utf8")).toBe("after\n");
	});
});

describe("edit tool stringified edits", () => {
	it("parses edits from a JSON string", () => {
		// 用于解析字符串化 edits 的工具定义。
		const definition = createEditToolDefinition(process.cwd());
		// JSON 字符串解析并规范化后的参数。
		const prepared = definition.prepareArguments!({
			path: "file.txt",
			edits: JSON.stringify([{ oldText: "a", newText: "b" }]),
		});
		expect(prepared).toEqual({
			path: "file.txt",
			edits: [{ oldText: "a", newText: "b" }],
		});
	});

	it("leaves edits alone when the string is not valid JSON", () => {
		// 用于验证无效 JSON 边界的工具定义。
		const definition = createEditToolDefinition(process.cwd());
		// 无效 edits 字符串的预处理结果；值应保持原样。
		const prepared = definition.prepareArguments!({
			path: "file.txt",
			edits: "not json",
		});
		expect(prepared).toEqual({
			path: "file.txt",
			edits: "not json",
		});
	});
});
