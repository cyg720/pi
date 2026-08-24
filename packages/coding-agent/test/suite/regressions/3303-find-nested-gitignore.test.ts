/**
 * 文件职责：回归验证 find 工具按目录层级应用 .gitignore，不让规则泄漏到兄弟目录。
 * 技术维度：使用 Vitest、真实临时目录树和 find 工具定义，通过 fd 的层级忽略行为完成断言。
 * 产品维度：确保用户搜索项目文件时既尊重各目录忽略规则，又不会错误隐藏其他目录文件。
 * 逻辑维度：公共帮助函数执行查找；两组夹具分别覆盖平级目录与深层嵌套规则。
 * 关键边界：测试依赖系统可执行的 fd；临时目录必须在每个用例后递归删除。
 * 新手阅读建议：先看文件顶部的问题背景，再比较 flat 与 deeply nested 两组期望结果。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFindToolDefinition } from "../../../src/core/tools/find.ts";

/**
 * Regression test for https://github.com/earendil-works/pi-mono/issues/3303
 *
 * The `find` tool previously collected every `.gitignore` under the search
 * path and passed them to `fd` via `--ignore-file`. fd treats `--ignore-file`
 * entries as a single global ignore source, so rules from `a/.gitignore`
 * also filtered files under sibling `b/`. The fix switches to fd's
 * hierarchical `.gitignore` handling via `--no-require-git` and drops the
 * manual collection.
 * 中文说明：旧实现把所有忽略文件当作全局规则；回归测试确保新实现只在各自子树内应用规则。
 */
describe("issue #3303 nested .gitignore rules leak into sibling directories", () => {
	// 当前用例创建的临时目录根；afterEach 仅在其已赋值时删除。
	let tempRoot: string;

	/** 功能：在临时根目录执行 find；参数 pattern 为 glob 模式；返回：清理并排序后的相对路径。示例：await runFind("**\/*.txt")。 */
	async function runFind(pattern: string): Promise<string[]> {
		// 绑定当前临时根目录的 find 工具定义。
		const def = createFindToolDefinition(tempRoot);
		// execute 所需的最小工具上下文；本测试不使用其中其他能力。
		const ctx = {} as Parameters<typeof def.execute>[4];
		// 工具执行结果；仅关心第一个文本内容块。
		const result = (await def.execute("call-1", { pattern }, undefined, undefined, ctx)) as {
			content: Array<{ type: string; text?: string }>;
		};
		// find 工具返回的文本；缺失内容时按空字符串处理。
		const text = result.content[0]?.text ?? "";
		if (text === "No files found matching pattern") return [];
		return text
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && !l.startsWith("["))
			.sort();
	}

	// 功能：删除当前用例目录；参数：无；返回：无。示例：Vitest 在每个测试后自动调用。
	afterEach(() => {
		if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
	});

	describe("flat sibling case", () => {
		// 功能：创建带两组平级目录的忽略规则夹具；参数：无；返回：无。示例：Vitest 在本组每个用例前调用。
		beforeEach(() => {
			tempRoot = mkdtempSync(join(tmpdir(), "pi-3303-flat-"));
			mkdirSync(join(tempRoot, "a"), { recursive: true });
			mkdirSync(join(tempRoot, "b"), { recursive: true });
			writeFileSync(join(tempRoot, "a", ".gitignore"), "ignored.txt\n");
			writeFileSync(join(tempRoot, "a", "ignored.txt"), "");
			writeFileSync(join(tempRoot, "a", "kept.txt"), "");
			writeFileSync(join(tempRoot, "b", "ignored.txt"), "");
			writeFileSync(join(tempRoot, "b", "kept.txt"), "");
			writeFileSync(join(tempRoot, "root.txt"), "");
		});

		it("applies a/.gitignore only inside a/ and leaves b/ untouched", async () => {
			// 平级目录场景实际找到的文本文件列表。
			const files = await runFind("**/*.txt");
			expect(files).toEqual(["a/kept.txt", "b/ignored.txt", "b/kept.txt", "root.txt"]);
		});
	});

	describe("deeply nested case", () => {
		// 功能：创建包含嵌套 .gitignore 的目录树；参数：无；返回：无。示例：Vitest 在本组每个用例前调用。
		beforeEach(() => {
			tempRoot = mkdtempSync(join(tmpdir(), "pi-3303-deep-"));
			mkdirSync(join(tempRoot, "a", "deep"), { recursive: true });
			mkdirSync(join(tempRoot, "b"), { recursive: true });
			writeFileSync(join(tempRoot, "a", ".gitignore"), "ignored.txt\n");
			writeFileSync(join(tempRoot, "a", "deep", ".gitignore"), "secret.txt\n");
			writeFileSync(join(tempRoot, "a", "ignored.txt"), "");
			writeFileSync(join(tempRoot, "a", "kept.txt"), "");
			writeFileSync(join(tempRoot, "a", "deep", "ignored.txt"), "");
			writeFileSync(join(tempRoot, "a", "deep", "secret.txt"), "");
			writeFileSync(join(tempRoot, "a", "deep", "kept.txt"), "");
			writeFileSync(join(tempRoot, "b", "ignored.txt"), "");
			writeFileSync(join(tempRoot, "b", "kept.txt"), "");
			writeFileSync(join(tempRoot, "root.txt"), "");
		});

		it("scopes each .gitignore to its own subtree", async () => {
			// 深层嵌套场景实际找到的文本文件列表。
			const files = await runFind("**/*.txt");
			// a/.gitignore ignores 'ignored.txt' within a/ and a/deep/.
			// 中文说明：a/.gitignore 的 ignored.txt 规则只影响 a 及其深层目录。
			// a/deep/.gitignore additionally ignores 'secret.txt' within a/deep/.
			// 中文说明：a/deep/.gitignore 额外隐藏该子树内的 secret.txt。
			// b/ is untouched by either.
			// 中文说明：兄弟目录 b 不受上述两份忽略规则影响。
			expect(files).toEqual(["a/deep/kept.txt", "a/kept.txt", "b/ignored.txt", "b/kept.txt", "root.txt"]);
		});
	});
});
