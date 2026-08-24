/**
 * 文件职责：验证 CombinedAutocompleteProvider 对斜杠、@ 文件、相对路径、引号路径、隐藏文件和符号链接的补全。
 * 技术维度：使用 Node.js test/assert、临时文件系统、fd 命令探测以及真实 CombinedAutocompleteProvider。
 * 产品维度：保障用户在编辑器中输入文件引用或路径时得到正确、排序合理且不会破坏引号的候选项。
 * 逻辑维度：先定义临时目录构造和候选获取辅助函数，再按前缀提取、fd 搜索、点斜杠和引号路径分组。
 * 关键边界：fd 相关分组在命令不可用时跳过；符号链接用例受 Windows 权限影响，测试目录必须在 afterEach 清理。
 * 新手阅读建议：先读 setupFolder 与 getSuggestions，再从简单前缀用例进入 fd 搜索，最后看 applyCompletion 的引号处理。
 */

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it, test } from "node:test";
import { CombinedAutocompleteProvider } from "../src/autocomplete.ts";

/** 查找当前平台可执行的 fd 命令。无参数；返回首个绝对路径或 null。例如：resolveFdPath()。 */
/** 变量 resolveFdPath：当前自动补全测试使用的 resolveFdPath 值；仅在当前函数、分组或测试中使用。 */
const resolveFdPath = (): string | null => {
	/** 变量 command：当前平台用于定位可执行文件的 where 或 which 命令；仅在当前函数、分组或测试中使用。 */
	const command = process.platform === "win32" ? "where" : "which";
	/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
	const result = spawnSync(command, ["fd"], { encoding: "utf-8" });
	if (result.status !== 0 || !result.stdout) {
		return null;
	}

	/** 变量 firstLine：where/which 输出中的首个非空路径；仅在当前函数、分组或测试中使用。 */
	const firstLine = result.stdout.split(/\r?\n/).find(Boolean);
	return firstLine ? firstLine.trim() : null;
};

/** 类型 FolderStructure：描述 setupFolder 可选创建的目录列表与文件内容映射。 */
type FolderStructure = {
	/** 可选相对目录路径数组。 */
	dirs?: string[];
	/** 可选的相对文件路径到文本内容映射。 */
	files?: Record<string, string>;
};

/** 按描述批量创建目录与文件。参数 baseDir 为根目录、structure 为目录和文件映射；无返回值。例如：setupFolder(dir, { files: { "a.txt": "x" } })。 */
/** 变量 setupFolder：当前自动补全测试使用的 setupFolder 值；仅在当前函数、分组或测试中使用。 */
const setupFolder = (baseDir: string, structure: FolderStructure = {}): void => {
	/** 变量 dirs：准备创建的相对目录数组；仅在当前函数、分组或测试中使用。 */
	const dirs = structure.dirs ?? [];
	/** 变量 files：准备写入的相对文件映射；仅在当前函数、分组或测试中使用。 */
	const files = structure.files ?? {};

	dirs.forEach((dir) => {
		mkdirSync(join(baseDir, dir), { recursive: true });
	});
	Object.entries(files).forEach(([filePath, contents]) => {
		/** 变量 fullPath：当前文件相对路径拼接后的完整路径；仅在当前函数、分组或测试中使用。 */
		const fullPath = join(baseDir, filePath);
		mkdirSync(dirname(fullPath), { recursive: true });
		writeFileSync(fullPath, contents);
	});
};

/** 变量 fdPath：模块初始化时探测到的 fd 可执行文件路径；仅在当前函数、分组或测试中使用。 */
const fdPath = resolveFdPath();
/** 变量 isFdInstalled：fd 是否可用，用于控制整组测试跳过；仅在当前函数、分组或测试中使用。 */
const isFdInstalled = Boolean(fdPath);

/** 取得已探测的 fd 路径。无参数；返回字符串，缺失时抛错。例如：requireFdPath()。 */
/** 变量 requireFdPath：当前自动补全测试使用的 requireFdPath 值；仅在当前函数、分组或测试中使用。 */
const requireFdPath = (): string => {
	if (!fdPath) {
		throw new Error("fd is not available");
	}
	return fdPath;
};

/** 调用补全提供器取得候选。参数 provider、lines、光标行列与 force；返回同步或异步候选结果。例如：await getSuggestions(provider, ["@"], 0, 1)。 */
/** 变量 getSuggestions：当前自动补全测试使用的 getSuggestions 值；仅在当前函数、分组或测试中使用。 */
const getSuggestions = (
	provider: CombinedAutocompleteProvider,
	lines: string[],
	cursorLine: number,
	cursorCol: number,
	force: boolean = false,
) => provider.getSuggestions(lines, cursorLine, cursorCol, { signal: new AbortController().signal, force });

/** 测试分组：组合自动补全的当前功能类别。 */
describe("CombinedAutocompleteProvider", () => {
	/** 测试分组：组合自动补全的当前功能类别。 */
	describe("extractPathPrefix", () => {
		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		it("extracts / from 'hey /' when forced", async () => {
			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], "/tmp");
			/** 变量 lines：模拟编辑器当前全部文本行；仅在当前函数、分组或测试中使用。 */
			const lines = ["hey /"];
			/** 变量 cursorLine：模拟光标所在行号，从 0 开始；仅在当前函数、分组或测试中使用。 */
			const cursorLine = 0;
			/** 变量 cursorCol：模拟光标所在列号，从 0 开始；仅在当前函数、分组或测试中使用。 */
			const cursorCol = 5; // After the "/"
			// 中文说明：以上英文注释标明光标位置或说明该候选结果允许为空的测试意图。

			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, lines, cursorLine, cursorCol, true);

			assert.notEqual(result, null, "Should return suggestions for root directory");
			if (result) {
				assert.strictEqual(result.prefix, "/", "Prefix should be '/'");
			}
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		it("extracts /A from '/A' when forced", async () => {
			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], "/tmp");
			/** 变量 lines：模拟编辑器当前全部文本行；仅在当前函数、分组或测试中使用。 */
			const lines = ["/A"];
			/** 变量 cursorLine：模拟光标所在行号，从 0 开始；仅在当前函数、分组或测试中使用。 */
			const cursorLine = 0;
			/** 变量 cursorCol：模拟光标所在列号，从 0 开始；仅在当前函数、分组或测试中使用。 */
			const cursorCol = 2; // After the "A"
			// 中文说明：以上英文注释标明光标位置或说明该候选结果允许为空的测试意图。

			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, lines, cursorLine, cursorCol, true);

			console.log("Result:", result);
			// This might return null if /A doesn't match anything, which is fine
			// We're mainly testing that the prefix extraction works
			// 中文说明：以上英文注释标明光标位置或说明该候选结果允许为空的测试意图。
			if (result) {
				assert.strictEqual(result.prefix, "/A", "Prefix should be '/A'");
			}
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		it("does not trigger for slash commands", async () => {
			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], "/tmp");
			/** 变量 lines：模拟编辑器当前全部文本行；仅在当前函数、分组或测试中使用。 */
			const lines = ["/model"];
			/** 变量 cursorLine：模拟光标所在行号，从 0 开始；仅在当前函数、分组或测试中使用。 */
			const cursorLine = 0;
			/** 变量 cursorCol：模拟光标所在列号，从 0 开始；仅在当前函数、分组或测试中使用。 */
			const cursorCol = 6; // After "model"
			// 中文说明：以上英文注释标明光标位置或说明该候选结果允许为空的测试意图。

			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, lines, cursorLine, cursorCol, true);

			console.log("Result:", result);
			assert.strictEqual(result, null, "Should not trigger for slash commands");
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		it("triggers for absolute paths after slash command argument", async () => {
			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], "/tmp");
			/** 变量 lines：模拟编辑器当前全部文本行；仅在当前函数、分组或测试中使用。 */
			const lines = ["/command /"];
			/** 变量 cursorLine：模拟光标所在行号，从 0 开始；仅在当前函数、分组或测试中使用。 */
			const cursorLine = 0;
			/** 变量 cursorCol：模拟光标所在列号，从 0 开始；仅在当前函数、分组或测试中使用。 */
			const cursorCol = 10; // After the second "/"
			// 中文说明：以上英文注释标明光标位置或说明该候选结果允许为空的测试意图。

			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, lines, cursorLine, cursorCol, true);

			console.log("Result:", result);
			assert.notEqual(result, null, "Should trigger for absolute paths in command arguments");
			if (result) {
				assert.strictEqual(result.prefix, "/", "Prefix should be '/'");
			}
		});
	});

	/** 测试分组：组合自动补全的当前功能类别。 */
	describe("fd @ file suggestions", { skip: !isFdInstalled }, () => {
		/** 变量 rootDir：fd 测试的临时根目录；仅在当前函数、分组或测试中使用。 */
		let rootDir = "";
		/** 变量 baseDir：补全提供器使用的当前工作目录；仅在当前函数、分组或测试中使用。 */
		let baseDir = "";
		/** 变量 outsideDir：工作目录外用于相对路径和符号链接的目录；仅在当前函数、分组或测试中使用。 */
		let outsideDir = "";

		beforeEach(() => {
			rootDir = mkdtempSync(join(tmpdir(), "pi-autocomplete-root-"));
			baseDir = join(rootDir, "cwd");
			outsideDir = join(rootDir, "outside");
			mkdirSync(baseDir, { recursive: true });
			mkdirSync(outsideDir, { recursive: true });
		});

		afterEach(() => {
			rmSync(rootDir, { recursive: true, force: true });
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("returns all files and folders for empty @ query", async () => {
			setupFolder(baseDir, {
				dirs: ["src"],
				files: {
					"README.md": "readme",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value).sort();
			assert.deepStrictEqual(values, ["@README.md", "@src/"].sort());
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("matches file with extension in query", async () => {
			setupFolder(baseDir, {
				files: {
					"file.txt": "content",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@file.txt";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes("@file.txt"));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("filters are case insensitive", async () => {
			setupFolder(baseDir, {
				dirs: ["src"],
				files: {
					"README.md": "readme",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@re";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value).sort();
			assert.deepStrictEqual(values, ["@README.md"]);
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("ranks directories before files", async () => {
			setupFolder(baseDir, {
				dirs: ["src"],
				files: {
					"src.txt": "text",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@src";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 firstValue：排序后第一条候选的插入值；仅在当前函数、分组或测试中使用。 */
			const firstValue = result?.items[0]?.value;
			/** 变量 hasSrcFile：候选中是否包含 src.txt 文件；仅在当前函数、分组或测试中使用。 */
			const hasSrcFile = result?.items?.some((item) => item.value === "@src.txt");
			assert.strictEqual(firstValue, "@src/");
			assert.ok(hasSrcFile);
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("returns nested file paths", async () => {
			setupFolder(baseDir, {
				files: {
					"src/index.ts": "export {};\n",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@index";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes("@src/index.ts"));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("matches deeply nested paths", async () => {
			setupFolder(baseDir, {
				files: {
					"packages/tui/src/autocomplete.ts": "export {};",
					"packages/ai/src/autocomplete.ts": "export {};",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@tui/src/auto";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes("@packages/tui/src/autocomplete.ts"));
			assert.ok(!values?.includes("@packages/ai/src/autocomplete.ts"));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("matches directory in middle of path with --full-path", async () => {
			setupFolder(baseDir, {
				files: {
					"src/components/Button.tsx": "export {};",
					"src/utils/helpers.ts": "export {};",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@components/";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes("@src/components/Button.tsx"));
			assert.ok(!values?.includes("@src/utils/helpers.ts"));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("scopes fuzzy search to relative directories and searches recursively", async () => {
			setupFolder(outsideDir, {
				files: {
					"nested/alpha.ts": "export {};",
					"nested/deeper/also-alpha.ts": "export {};",
					"nested/deeper/zzz.ts": "export {};",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@../outside/a";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes("@../outside/nested/alpha.ts"));
			assert.ok(values?.includes("@../outside/nested/deeper/also-alpha.ts"));
			assert.ok(!values?.includes("@../outside/nested/deeper/zzz.ts"));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("quotes paths with spaces for @ suggestions", async () => {
			setupFolder(baseDir, {
				dirs: ["my folder"],
				files: {
					"my folder/test.txt": "content",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@my";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes('@"my folder/"'));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("includes hidden paths but excludes .git", async () => {
			setupFolder(baseDir, {
				dirs: [".pi", ".github", ".git"],
				files: {
					".pi/config.json": "{}",
					".github/workflows/ci.yml": "name: ci",
					".git/config": "[core]",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value) ?? [];
			assert.ok(values.includes("@.pi/"));
			assert.ok(values.includes("@.github/"));
			assert.ok(!values.some((value) => value === "@.git" || value.startsWith("@.git/")));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("follows symlinked directories for fuzzy @ search", async () => {
			setupFolder(baseDir, {
				files: {
					"dir/some_file.txt": "real",
				},
			});
			setupFolder(outsideDir, {
				files: {
					"some_file.txt": "symlinked",
				},
			});
			symlinkSync("../outside", join(baseDir, "symlinked_dir"));

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@some";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value) ?? [];
			assert.ok(values.includes("@dir/some_file.txt"));
			assert.ok(values.includes("@symlinked_dir/some_file.txt"));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("returns symlinked directories when matching their name", async () => {
			setupFolder(outsideDir, {
				files: {
					"nested/file.txt": "symlinked",
				},
			});
			symlinkSync("../outside", join(baseDir, "symlinked_dir"));

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@symlinked";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value) ?? [];
			assert.ok(values.includes("@symlinked_dir/"));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("returns symlinked files without requiring type l", async () => {
			setupFolder(baseDir, {
				files: {
					"original.txt": "content",
				},
			});
			/** 变量 linkPath：指向测试原文件的符号链接路径；仅在当前函数、分组或测试中使用。 */
			const linkPath = join(baseDir, "link.txt");
			symlinkSync("original.txt", linkPath);

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "@link";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length);

			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value) ?? [];
			assert.ok(values.includes("@link.txt"));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("returns the same @ suggestions when the cwd path contains the query", async () => {
			/** 变量 normalBaseDir：路径本身不含查询词的对照工作目录；仅在当前函数、分组或测试中使用。 */
			const normalBaseDir = join(rootDir, "cwd-normal");
			/** 变量 queryInPathBaseDir：路径本身包含查询词的工作目录；仅在当前函数、分组或测试中使用。 */
			const queryInPathBaseDir = join(rootDir, "cwd-plan-repro");
			mkdirSync(normalBaseDir, { recursive: true });
			mkdirSync(queryInPathBaseDir, { recursive: true });

			/** 变量 structure：两个工作目录复用的相同文件树；仅在当前函数、分组或测试中使用。 */
			const structure = {
				dirs: ["packages/coding-agent/examples/extensions/plan-mode"],
				files: {
					"packages/coding-agent/examples/extensions/plan-mode/README.md": "readme",
					"packages/tui/docs/plan.md": "plan",
				},
			};
			setupFolder(normalBaseDir, structure);
			setupFolder(queryInPathBaseDir, structure);

			/** 变量 query：用于比较两目录候选一致性的 @ 查询；仅在当前函数、分组或测试中使用。 */
			const query = "@plan";
			/** 变量 normalProvider：基于对照目录创建的补全提供器；仅在当前函数、分组或测试中使用。 */
			const normalProvider = new CombinedAutocompleteProvider([], normalBaseDir, requireFdPath());
			/** 变量 queryInPathProvider：基于含查询词目录创建的补全提供器；仅在当前函数、分组或测试中使用。 */
			const queryInPathProvider = new CombinedAutocompleteProvider([], queryInPathBaseDir, requireFdPath());

			/** 变量 normalResult：对照目录返回的补全结果；仅在当前函数、分组或测试中使用。 */
			const normalResult = await getSuggestions(normalProvider, [query], 0, query.length);
			/** 变量 queryInPathResult：含查询词目录返回的补全结果；仅在当前函数、分组或测试中使用。 */
			const queryInPathResult = await getSuggestions(queryInPathProvider, [query], 0, query.length);

			/** 变量 normalize：把候选标准化为可稳定比较的标签与描述字符串数组；仅在当前函数、分组或测试中使用。 */
			const normalize = (result: Awaited<ReturnType<typeof getSuggestions>>) =>
				(result?.items ?? []).map((item) => `${item.label} :: ${item.description ?? ""}`).sort();

			assert.deepStrictEqual(normalize(queryInPathResult), normalize(normalResult));
			assert.ok(
				normalize(normalResult).includes("plan-mode/ :: packages/coding-agent/examples/extensions/plan-mode"),
			);
			assert.ok(normalize(normalResult).includes("plan.md :: packages/tui/docs/plan.md"));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("continues autocomplete inside quoted @ paths", async () => {
			setupFolder(baseDir, {
				files: {
					"my folder/test.txt": "content",
					"my folder/other.txt": "content",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = '@"my folder/"';
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length - 1);

			assert.notEqual(result, null, "Should return suggestions for quoted folder path");
			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes('@"my folder/test.txt"'));
			assert.ok(values?.includes('@"my folder/other.txt"'));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("applies quoted @ completion without duplicating closing quote", async () => {
			setupFolder(baseDir, {
				files: {
					"my folder/test.txt": "content",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir, requireFdPath());
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = '@"my folder/te"';
			/** 变量 cursorCol：模拟光标所在列号，从 0 开始；仅在当前函数、分组或测试中使用。 */
			const cursorCol = line.length - 1;
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, cursorCol);

			assert.notEqual(result, null, "Should return suggestions for quoted @ path");
			/** 变量 item：从候选中找到的目标文件补全项；仅在当前函数、分组或测试中使用。 */
			const item = result?.items.find((entry) => entry.value === '@"my folder/test.txt"');
			assert.ok(item, "Should find test.txt suggestion");

			/** 变量 applied：调用 applyCompletion 后得到的新文本和光标状态；仅在当前函数、分组或测试中使用。 */
			const applied = provider.applyCompletion([line], 0, cursorCol, item!, result!.prefix);
			assert.strictEqual(applied.lines[0], '@"my folder/test.txt" ');
		});
	});

	/** 测试分组：组合自动补全的当前功能类别。 */
	describe("dot-slash path completion", () => {
		/** 变量 baseDir：补全提供器使用的当前工作目录；仅在当前函数、分组或测试中使用。 */
		let baseDir = "";

		beforeEach(() => {
			baseDir = mkdtempSync(join(tmpdir(), "pi-autocomplete-"));
		});

		afterEach(() => {
			rmSync(baseDir, { recursive: true, force: true });
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("preserves ./ prefix when completing paths", async () => {
			setupFolder(baseDir, {
				files: {
					"update.sh": "#!/bin/bash",
					"utils.ts": "export {};",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir);
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "./up";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length, true);

			assert.notEqual(result, null, "Should return suggestions for ./ path");
			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes("./update.sh"), `Expected ./update.sh in ${JSON.stringify(values)}`);
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("preserves ./ prefix for directory completions", async () => {
			setupFolder(baseDir, {
				dirs: ["src"],
				files: {
					"src/index.ts": "export {};",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir);
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "./sr";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length, true);

			assert.notEqual(result, null, "Should return suggestions for ./ directory path");
			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes("./src/"), `Expected ./src/ in ${JSON.stringify(values)}`);
		});
	});

	/** 测试分组：组合自动补全的当前功能类别。 */
	describe("quoted path completion", () => {
		/** 变量 baseDir：补全提供器使用的当前工作目录；仅在当前函数、分组或测试中使用。 */
		let baseDir = "";

		beforeEach(() => {
			baseDir = mkdtempSync(join(tmpdir(), "pi-autocomplete-"));
		});

		afterEach(() => {
			rmSync(baseDir, { recursive: true, force: true });
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("quotes paths with spaces for direct completion", async () => {
			setupFolder(baseDir, {
				dirs: ["my folder"],
				files: {
					"my folder/test.txt": "content",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir);
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = "my";
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length, true);

			assert.notEqual(result, null, "Should return suggestions for path completion");
			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes('"my folder/"'));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("continues completion inside quoted paths", async () => {
			setupFolder(baseDir, {
				files: {
					"my folder/test.txt": "content",
					"my folder/other.txt": "content",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir);
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = '"my folder/"';
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, line.length - 1, true);

			assert.notEqual(result, null, "Should return suggestions for quoted folder path");
			/** 变量 values：从候选项提取并可选排序后的插入值数组；仅在当前函数、分组或测试中使用。 */
			const values = result?.items.map((item) => item.value);
			assert.ok(values?.includes('"my folder/test.txt"'));
			assert.ok(values?.includes('"my folder/other.txt"'));
		});

		/** 测试场景：验证当前路径形式的候选匹配、排序或应用结果。 */
		test("applies quoted completion without duplicating closing quote", async () => {
			setupFolder(baseDir, {
				files: {
					"my folder/test.txt": "content",
				},
			});

			/** 变量 provider：当前场景使用的组合补全提供器；仅在当前函数、分组或测试中使用。 */
			const provider = new CombinedAutocompleteProvider([], baseDir);
			/** 变量 line：当前模拟输入的单行文本；仅在当前函数、分组或测试中使用。 */
			const line = '"my folder/te"';
			/** 变量 cursorCol：模拟光标所在列号，从 0 开始；仅在当前函数、分组或测试中使用。 */
			const cursorCol = line.length - 1;
			/** 变量 result：命令探测或补全调用返回的结果；仅在当前函数、分组或测试中使用。 */
			const result = await getSuggestions(provider, [line], 0, cursorCol, true);

			assert.notEqual(result, null, "Should return suggestions for quoted path");
			/** 变量 item：从候选中找到的目标文件补全项；仅在当前函数、分组或测试中使用。 */
			const item = result?.items.find((entry) => entry.value === '"my folder/test.txt"');
			assert.ok(item, "Should find test.txt suggestion");

			/** 变量 applied：调用 applyCompletion 后得到的新文本和光标状态；仅在当前函数、分组或测试中使用。 */
			const applied = provider.applyCompletion([line], 0, cursorCol, item!, result!.prefix);
			assert.strictEqual(applied.lines[0], '"my folder/test.txt"');
		});
	});
});
