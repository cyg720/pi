import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFindToolDefinition } from "../../../src/core/tools/find.ts";

/**
 * Regression test for https://github.com/earendil-works/pi-mono/issues/3302
 *
 * The `find` tool advertises glob patterns like `src/**\/*.spec.ts`, but the
 * default fd-backed implementation used `fd --glob <pattern>` without
 * `--full-path`, which makes fd match only against the basename. Any pattern
 * containing a `/` therefore silently returned no matches.
 *
 * The fix switches fd into full-path mode when the pattern contains a `/`
 * and prepends `**\/` so the pattern can match against the absolute candidate
 * path that fd feeds to the matcher.
 */
/**
 * 文件职责：回归验证 find 工具能用包含目录片段的 glob 模式匹配嵌套文件。
 * 技术维度：使用 Vitest、临时目录、真实文件系统和 fd 后端的 find 工具定义进行集成测试。
 * 产品维度：确保用户按路径查找测试文件或子目录内容时不会得到错误的空结果。
 * 逻辑维度：每个用例前创建固定目录树，通过统一 runFind 执行模式并比较相对路径结果。
 * 关键边界：结果依赖本机可用的 find 后端；目录匹配可能同时返回文件和目录。
 * 新手阅读建议：先看顶部问题说明与目录结构，再读 runFind 的结果清洗，最后比较四种 glob。
 */
describe("issue #3302 find returns no results for path-based glob patterns", () => {
	// 保存每个用例独享的临时根目录；beforeEach 中赋值，afterEach 中删除。
	let tempRoot: string;

	// 为每个用例创建相同的嵌套目录和三个测试文件；无参数，无返回值。
	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "pi-3302-"));
		mkdirSync(join(tempRoot, "some", "parent", "child"), { recursive: true });
		mkdirSync(join(tempRoot, "src", "foo", "bar"), { recursive: true });
		writeFileSync(join(tempRoot, "some", "parent", "child", "file.ext"), "");
		writeFileSync(join(tempRoot, "some", "parent", "child", "test.spec.ts"), "");
		writeFileSync(join(tempRoot, "src", "foo", "bar", "example.spec.ts"), "");
	});

	// 递归删除当前用例的临时目录；无参数，无返回值。
	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
	});

	/**
	 * 在临时目录中执行 find 模式并规范化文本结果。
	 * 参数：pattern 为 glob 字符串，可包含目录分隔符和双星号。
	 * 返回值：匹配到的相对路径数组，未匹配时为空数组。
	 * 使用示例：`await runFind("src/**\/*.spec.ts")`。
	 */
	async function runFind(pattern: string): Promise<string[]> {
		// def 是以临时根目录为工作范围的 find 工具定义。
		const def = createFindToolDefinition(tempRoot);
		// The find tool implementation does not touch ctx; pass a minimal stub.
		// find 实现不会读取 ctx，因此传入满足类型要求的最小占位对象。
		// ctx 是工具执行上下文占位值，本回归测试不使用其中任何成员。
		const ctx = {} as Parameters<typeof def.execute>[4];
		// result 保存工具调用返回的内容块结果。
		const result = (await def.execute("call-1", { pattern }, undefined, undefined, ctx)) as {
			content: Array<{ type: string; text?: string }>;
		};
		// text 是首个内容块的文本；缺失内容时使用空字符串。
		const text = result.content[0]?.text ?? "";
		if (text === "No files found matching pattern") return [];
		// l 表示当前输出行；先去除首尾空白，再过滤诊断行和空行。
		return text
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && !l.startsWith("["));
	}

	// 验证仅按文件名匹配的旧行为保持有效；无参数，无返回值。
	it("basename pattern still matches (regression-safe)", async () => {
		// files 保存所有 .spec.ts 文件的相对路径。
		const files = await runFind("*.spec.ts");
		expect(files.sort()).toEqual(["some/parent/child/test.spec.ts", "src/foo/bar/example.spec.ts"]);
	});

	// 验证带目录前缀和双星号尾部的模式能匹配整个子树；无参数，无返回值。
	it("directory-prefixed pattern with ** tail matches subtree", async () => {
		// files 保存指定 child 子树下的匹配路径。
		const files = await runFind("some/parent/child/**");
		// Matches files (and possibly directories) under the subtree. Assert the two files are present.
		// 结果可能包含文件和目录，因此只断言两个目标文件存在。
		expect(files).toContain("some/parent/child/file.ext");
		expect(files).toContain("some/parent/child/test.spec.ts");
	});

	// 验证以双星号开头的多段路径模式能跨越上级目录；无参数，无返回值。
	it("leading ** wildcard with path segments matches", async () => {
		// files 保存任意前缀下 parent/child 子路径的匹配结果。
		const files = await runFind("**/parent/child/*");
		expect(files.sort()).toContain("some/parent/child/file.ext");
		expect(files.sort()).toContain("some/parent/child/test.spec.ts");
	});

	// 验证 src 前缀与递归双星号能定位嵌套测试文件；无参数，无返回值。
	it("src/**/*.spec.ts matches nested spec file", async () => {
		// files 保存 src 子树中扩展名为 .spec.ts 的匹配结果。
		const files = await runFind("src/**/*.spec.ts");
		expect(files).toEqual(["src/foo/bar/example.spec.ts"]);
	});
});
