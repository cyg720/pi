/**
 * 文件职责：验证扩展目录发现、显式路径加载、入口优先级、依赖解析以及扩展注册内容和错误报告。
 * 技术维度：使用 Vitest、Node.js 临时文件系统、运行时 TypeScript 扩展加载器和动态扩展源码夹具。
 * 产品维度：保障用户把扩展放入约定目录或包清单后可被稳定发现，错误扩展不会阻塞其他扩展。
 * 逻辑维度：每个用例构造一种目录或 package.json 布局，调用加载器后检查路径、注册表或错误集合。
 * 关键边界：自动发现只深入一层且 package.json 的 pi 字段优先于 index；用例会创建并删除临时目录。
 * 新手阅读建议：先读 beforeEach 和两个源码模板，再按直接文件、子目录、清单、显式加载和错误场景阅读。
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverAndLoadExtensions } from "../src/core/extensions/loader.ts";

/** 变量 __dirname：当前测试模块所在目录，用于定位带依赖的示例扩展；仅在当前测试作用域内有效。 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 测试分组：extensions discovery。 */
describe("extensions discovery", () => {
	/** 变量 tempDir：当前用例使用的临时根目录；仅在当前测试作用域内有效。 */
	let tempDir: string;
	/** 变量 extensionsDir：临时根目录中的默认 extensions 发现目录；仅在当前测试作用域内有效。 */
	let extensionsDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-ext-test-"));
		extensionsDir = path.join(tempDir, "extensions");
		fs.mkdirSync(extensionsDir);
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	/** 变量 extensionCode：注册 test 命令的最小扩展源码文本；仅在当前测试作用域内有效。 */
	const extensionCode = `
		export default function(pi) {
			pi.registerCommand("test", { handler: async () => {} });
		}
	`;

	/** 变量 extensionCodeWithTool：按工具名生成最小工具扩展源码的函数；参数 toolName 为工具名，返回源码字符串，例如 extensionCodeWithTool("demo")；仅在当前测试作用域内有效。 */
	const extensionCodeWithTool = (toolName: string) => `
		import { Type } from "typebox";
		export default function(pi) {
			pi.registerTool({
				name: "${toolName}",
				label: "${toolName}",
				description: "Test tool",
				parameters: Type.Object({}),
				execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
			});
		}
	`;

	/** 测试场景：discovers direct .ts files in extensions/。 */
	it("discovers direct .ts files in extensions/", async () => {
		fs.writeFileSync(path.join(extensionsDir, "foo.ts"), extensionCode);
		fs.writeFileSync(path.join(extensionsDir, "bar.ts"), extensionCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(2);
		expect(result.extensions.map((e) => path.basename(e.path)).sort()).toEqual(["bar.ts", "foo.ts"]);
	});

	/** 测试场景：loads the coding-agent entrypoint without rewriting pi-ai provider subpaths。 */
	it("loads the coding-agent entrypoint without rewriting pi-ai provider subpaths", async () => {
		fs.writeFileSync(
			path.join(extensionsDir, "coding-agent-import.ts"),
			`
				import { getAgentDir } from "@earendil-works/pi-coding-agent";
				void getAgentDir;
				export default function(pi) {
					pi.registerCommand("test", { handler: async () => {} });
				}
			`,
		);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
	});

	/** 测试场景：keeps the type-only pi-ai OAuth compatibility barrel resolvable。 */
	it("keeps the type-only pi-ai OAuth compatibility barrel resolvable", async () => {
		fs.writeFileSync(
			path.join(extensionsDir, "oauth-import.ts"),
			`
				import * as oauth from "@earendil-works/pi-ai/oauth";
				void oauth;
				export default function(pi) {
					pi.registerCommand("test", { handler: async () => {} });
				}
			`,
		);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toEqual([]);
		expect(result.extensions).toHaveLength(1);
	});

	/** 测试场景：discovers direct .js files in extensions/。 */
	it("discovers direct .js files in extensions/", async () => {
		fs.writeFileSync(path.join(extensionsDir, "foo.js"), extensionCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(path.basename(result.extensions[0].path)).toBe("foo.js");
	});

	/** 测试场景：discovers subdirectory with index.ts。 */
	it("discovers subdirectory with index.ts", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "my-extension");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "index.ts"), extensionCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("my-extension");
		expect(result.extensions[0].path).toContain("index.ts");
	});

	/** 测试场景：discovers subdirectory with index.js。 */
	it("discovers subdirectory with index.js", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "my-extension");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "index.js"), extensionCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("index.js");
	});

	/** 测试场景：prefers index.ts over index.js。 */
	it("prefers index.ts over index.js", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "my-extension");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "index.ts"), extensionCode);
		fs.writeFileSync(path.join(subdir, "index.js"), extensionCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("index.ts");
	});

	/** 测试场景：discovers subdirectory with package.json pi field。 */
	it("discovers subdirectory with package.json pi field", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "my-package");
		/** 变量 srcDir：package.json 指向的源码子目录；仅在当前测试作用域内有效。 */
		const srcDir = path.join(subdir, "src");
		fs.mkdirSync(subdir);
		fs.mkdirSync(srcDir);
		fs.writeFileSync(path.join(srcDir, "main.ts"), extensionCode);
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				name: "my-package",
				pi: {
					extensions: ["./src/main.ts"],
				},
			}),
		);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("src");
		expect(result.extensions[0].path).toContain("main.ts");
	});

	/** 测试场景：keeps package.json pi extension entries with leading tilde package-relative。 */
	it("keeps package.json pi extension entries with leading tilde package-relative", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "tilde-package");
		/** 变量 directExtensionPath：名称以波浪号开头的直接扩展路径；仅在当前测试作用域内有效。 */
		const directExtensionPath = path.join(subdir, "~entry.ts");
		/** 变量 slashExtensionPath：波浪号目录中的扩展路径；仅在当前测试作用域内有效。 */
		const slashExtensionPath = path.join(subdir, "~", "entry.ts");
		fs.mkdirSync(path.join(subdir, "~"), { recursive: true });
		fs.writeFileSync(directExtensionPath, extensionCode);
		fs.writeFileSync(slashExtensionPath, extensionCode);
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				name: "tilde-package",
				pi: {
					extensions: ["~entry.ts", "~/entry.ts"],
				},
			}),
		);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions.map((extension) => extension.path).sort()).toEqual(
			[directExtensionPath, slashExtensionPath].sort(),
		);
	});

	/** 测试场景：package.json can declare multiple extensions。 */
	it("package.json can declare multiple extensions", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "my-package");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "ext1.ts"), extensionCode);
		fs.writeFileSync(path.join(subdir, "ext2.ts"), extensionCode);
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				name: "my-package",
				pi: {
					extensions: ["./ext1.ts", "./ext2.ts"],
				},
			}),
		);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(2);
	});

	/** 测试场景：package.json with pi field takes precedence over index.ts。 */
	it("package.json with pi field takes precedence over index.ts", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "my-package");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "index.ts"), extensionCodeWithTool("from-index"));
		fs.writeFileSync(path.join(subdir, "custom.ts"), extensionCodeWithTool("from-custom"));
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				name: "my-package",
				pi: {
					extensions: ["./custom.ts"],
				},
			}),
		);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("custom.ts");
		// Verify the right tool was registered
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		expect(result.extensions[0].tools.has("from-custom")).toBe(true);
		expect(result.extensions[0].tools.has("from-index")).toBe(false);
	});

	/** 测试场景：ignores package.json without pi field, falls back to index.ts。 */
	it("ignores package.json without pi field, falls back to index.ts", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "my-package");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "index.ts"), extensionCode);
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				name: "my-package",
				version: "1.0.0",
			}),
		);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("index.ts");
	});

	/** 测试场景：ignores subdirectory without index or package.json。 */
	it("ignores subdirectory without index or package.json", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "not-an-extension");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "helper.ts"), extensionCode);
		fs.writeFileSync(path.join(subdir, "utils.ts"), extensionCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(0);
	});

	/** 测试场景：does not recurse beyond one level。 */
	it("does not recurse beyond one level", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "container");
		/** 变量 nested：超过自动发现深度的嵌套目录；仅在当前测试作用域内有效。 */
		const nested = path.join(subdir, "nested");
		fs.mkdirSync(subdir);
		fs.mkdirSync(nested);
		fs.writeFileSync(path.join(nested, "index.ts"), extensionCode);
		// No index.ts or package.json in container/
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(0);
	});

	/** 测试场景：handles mixed direct files and subdirectories。 */
	it("handles mixed direct files and subdirectories", async () => {
		// Direct file
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		fs.writeFileSync(path.join(extensionsDir, "direct.ts"), extensionCode);

		// Subdirectory with index
		/** 变量 subdir1：带 index 入口的第一个扩展子目录；仅在当前测试作用域内有效。 */
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		const subdir1 = path.join(extensionsDir, "with-index");
		fs.mkdirSync(subdir1);
		fs.writeFileSync(path.join(subdir1, "index.ts"), extensionCode);

		// Subdirectory with package.json
		/** 变量 subdir2：带 package.json 清单的第二个扩展子目录；仅在当前测试作用域内有效。 */
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		const subdir2 = path.join(extensionsDir, "with-manifest");
		fs.mkdirSync(subdir2);
		fs.writeFileSync(path.join(subdir2, "entry.ts"), extensionCode);
		fs.writeFileSync(path.join(subdir2, "package.json"), JSON.stringify({ pi: { extensions: ["./entry.ts"] } }));

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(3);
	});

	/** 测试场景：skips non-existent paths declared in package.json。 */
	it("skips non-existent paths declared in package.json", async () => {
		/** 变量 subdir：当前用例构造的扩展子目录；仅在当前测试作用域内有效。 */
		const subdir = path.join(extensionsDir, "my-package");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "exists.ts"), extensionCode);
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				pi: {
					extensions: ["./exists.ts", "./missing.ts"],
				},
			}),
		);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("exists.ts");
	});

	/** 测试场景：loads extensions and registers commands。 */
	it("loads extensions and registers commands", async () => {
		fs.writeFileSync(path.join(extensionsDir, "with-command.ts"), extensionCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].commands.has("test")).toBe(true);
	});

	/** 测试场景：loads extensions and registers tools。 */
	it("loads extensions and registers tools", async () => {
		fs.writeFileSync(path.join(extensionsDir, "with-tool.ts"), extensionCodeWithTool("my-tool"));

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].tools.has("my-tool")).toBe(true);
	});

	/** 测试场景：reports errors for invalid extension code。 */
	it("reports errors for invalid extension code", async () => {
		fs.writeFileSync(path.join(extensionsDir, "invalid.ts"), "this is not valid typescript export");

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].path).toContain("invalid.ts");
		expect(result.extensions).toHaveLength(0);
	});

	/** 测试场景：handles explicitly configured paths。 */
	it("handles explicitly configured paths", async () => {
		/** 变量 customPath：默认发现目录之外的显式扩展路径；仅在当前测试作用域内有效。 */
		const customPath = path.join(tempDir, "custom-location", "my-ext.ts");
		fs.mkdirSync(path.dirname(customPath), { recursive: true });
		fs.writeFileSync(customPath, extensionCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([customPath], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("my-ext.ts");
	});

	/** 测试场景：resolves dependencies from extension's own node_modules。 */
	it("resolves dependencies from extension's own node_modules", async () => {
		// Load extension that has its own package.json and node_modules with 'ms' package
		/** 变量 extPath：自带 package.json 和 node_modules 的示例扩展路径；仅在当前测试作用域内有效。 */
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		const extPath = path.resolve(__dirname, "../examples/extensions/with-deps");

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([extPath], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("with-deps");
		// The extension registers a 'parse_duration' tool
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		expect(result.extensions[0].tools.has("parse_duration")).toBe(true);
	});

	/** 测试场景：registers message and entry renderers。 */
	it("registers message and entry renderers", async () => {
		/** 变量 extCode：当前场景写入磁盘的扩展源码；仅在当前测试作用域内有效。 */
		const extCode = `
			export default function(pi) {
				pi.registerMessageRenderer("my-custom-type", (message, options, theme) => {
					return null; // Use default rendering
// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
				});
				pi.registerEntryRenderer("my-entry-type", (entry, options, theme) => {
					return null;
				});
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "with-renderer.ts"), extCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].messageRenderers.has("my-custom-type")).toBe(true);
		expect(result.extensions[0].entryRenderers?.has("my-entry-type")).toBe(true);
	});

	/** 测试场景：reports error when extension throws during initialization。 */
	it("reports error when extension throws during initialization", async () => {
		/** 变量 extCode：当前场景写入磁盘的扩展源码；仅在当前测试作用域内有效。 */
		const extCode = `
			export default function(pi) {
				throw new Error("Initialization failed!");
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "throws.ts"), extCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].error).toContain("Initialization failed!");
		expect(result.extensions).toHaveLength(0);
	});

	/** 测试场景：reports error when extension has no default export。 */
	it("reports error when extension has no default export", async () => {
		/** 变量 extCode：当前场景写入磁盘的扩展源码；仅在当前测试作用域内有效。 */
		const extCode = `
			export function notDefault(pi) {
				pi.registerCommand("test", { handler: async () => {} });
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "no-default.ts"), extCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].error).toContain("does not export a valid factory function");
		expect(result.extensions).toHaveLength(0);
	});

	/** 测试场景：allows multiple extensions to register different tools。 */
	it("allows multiple extensions to register different tools", async () => {
		fs.writeFileSync(path.join(extensionsDir, "tool-a.ts"), extensionCodeWithTool("tool-a"));
		fs.writeFileSync(path.join(extensionsDir, "tool-b.ts"), extensionCodeWithTool("tool-b"));

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(2);

		/** 变量 allTools：合并所有已加载扩展工具名的集合；仅在当前测试作用域内有效。 */
		const allTools = new Set<string>();
		for (const ext of result.extensions) {
			/** 循环变量 ext：当前已加载扩展及其注册表。 */
			for (const name of ext.tools.keys()) {
				/** 循环变量 name：当前扩展注册的工具名。 */
				allTools.add(name);
			}
		}
		expect(allTools.has("tool-a")).toBe(true);
		expect(allTools.has("tool-b")).toBe(true);
	});

	/** 测试场景：loads extension with event handlers。 */
	it("loads extension with event handlers", async () => {
		/** 变量 extCode：当前场景写入磁盘的扩展源码；仅在当前测试作用域内有效。 */
		const extCode = `
			export default function(pi) {
				pi.on("agent_start", async () => {});
				pi.on("tool_call", async (event) => undefined);
				pi.on("agent_end", async () => {});
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "with-handlers.ts"), extCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].handlers.has("agent_start")).toBe(true);
		expect(result.extensions[0].handlers.has("tool_call")).toBe(true);
		expect(result.extensions[0].handlers.has("agent_end")).toBe(true);
	});

	/** 测试场景：loads extension with shortcuts。 */
	it("loads extension with shortcuts", async () => {
		/** 变量 extCode：当前场景写入磁盘的扩展源码；仅在当前测试作用域内有效。 */
		const extCode = `
			export default function(pi) {
				pi.registerShortcut("ctrl+t", {
					description: "Test shortcut",
					handler: async (ctx) => {},
				});
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "with-shortcut.ts"), extCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].shortcuts.has("ctrl+t")).toBe(true);
	});

	/** 测试场景：loads extension with flags。 */
	it("loads extension with flags", async () => {
		/** 变量 extCode：当前场景写入磁盘的扩展源码；仅在当前测试作用域内有效。 */
		const extCode = `
			export default function(pi) {
				pi.registerFlag("my-flag", {
					description: "My custom flag",
					handler: async (value) => {},
				});
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "with-flag.ts"), extCode);

		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].flags.has("my-flag")).toBe(true);
	});

	/** 测试场景：loadExtensions only loads explicit paths without discovery。 */
	it("loadExtensions only loads explicit paths without discovery", async () => {
		// Create discoverable extensions (would be found by discoverAndLoadExtensions)
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		fs.writeFileSync(path.join(extensionsDir, "discovered.ts"), extensionCodeWithTool("discovered"));

		// Create explicit extension outside discovery path
		/** 变量 explicitPath：位于自动发现目录之外的显式加载入口；仅在当前测试作用域内有效。 */
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		const explicitPath = path.join(tempDir, "explicit.ts");
		fs.writeFileSync(explicitPath, extensionCodeWithTool("explicit"));

		// Use loadExtensions directly to skip discovery
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		const { loadExtensions } = await import("../src/core/extensions/loader.ts");
		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await loadExtensions([explicitPath], tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].tools.has("explicit")).toBe(true);
		expect(result.extensions[0].tools.has("discovered")).toBe(false);
	});

	/** 测试场景：loadExtensions with no paths loads nothing。 */
	it("loadExtensions with no paths loads nothing", async () => {
		// Create discoverable extensions (would be found by discoverAndLoadExtensions)
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		fs.writeFileSync(path.join(extensionsDir, "discovered.ts"), extensionCode);

		// Use loadExtensions directly with empty paths
		// 中文说明：以上英文注释说明该扩展目录布局、发现边界或预期注册结果。
		const { loadExtensions } = await import("../src/core/extensions/loader.ts");
		/** 变量 result：发现或显式加载扩展后返回的扩展与错误集合；仅在当前测试作用域内有效。 */
		const result = await loadExtensions([], tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(0);
	});
});
