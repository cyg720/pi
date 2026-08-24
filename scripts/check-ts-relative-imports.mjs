/**
 * 文件职责：扫描仓库 TypeScript 源码并禁止在相对导入路径中使用 .js 扩展名。
 * 技术维度：使用 TypeScript 编译器 API 构建语法树，递归检查静态导入、导出、动态导入和类型导入。
 * 产品维度：在提交前阻止不符合源码运行约定的路径，减少 Node 直接执行 TypeScript 时的解析问题。
 * 逻辑维度：收集非声明 .ts 文件，遍历每棵语法树，记录违规位置并以非零状态退出。
 * 关键边界：忽略构建产物、依赖与声明文件；只检查相对且以 .js 结尾的模块说明符。
 * 新手阅读建议：先看两个判定辅助函数，再跟随 collect、visit、failures 输出的主流程阅读。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// 列出递归扫描时必须跳过的版本库、覆盖率、构建产物和依赖目录。
const ignoredDirectories = new Set([".git", "coverage", "dist", "node_modules"]);
// 收集待检查的普通 TypeScript 文件路径，不包含 .d.ts 声明文件。
const files = [];

/**
 * 递归收集目录中的非声明 TypeScript 文件。
 * 参数：directory 为当前扫描目录。
 * 返回值：无，结果追加到 files。
 * 使用示例：`collectTypescriptFiles(".")`。
 */
function collectTypescriptFiles(directory) {
	// entry 是当前目录项；目录继续递归，普通 .ts 文件加入列表。
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				collectTypescriptFiles(join(directory, entry.name));
			}
			continue;
		}

		if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
			files.push(join(directory, entry.name));
		}
	}
}

/**
 * 判断模块说明符是否为以 .js 结尾的相对路径。
 * 参数：specifier 为导入或导出的字符串路径。
 * 返回值：同时满足相对路径和 .js 扩展名时为 true。
 * 使用示例：`isRelativeJavaScriptSpecifier("./foo.js")` 返回 true。
 */
function isRelativeJavaScriptSpecifier(specifier) {
	return /^\.\.?\//.test(specifier) && /\.js(?:[?#].*)?$/.test(specifier);
}

/**
 * 从 import 类型节点中提取字符串模块说明符。
 * 参数：node 为 TypeScript ImportTypeNode。
 * 返回值：字符串字面量节点，不符合结构时为 undefined。
 * 使用示例：用于解析 `import("./types.js").Foo` 的路径节点。
 */
function getImportTypeSpecifier(node) {
	if (!ts.isLiteralTypeNode(node.argument)) return undefined;
	if (!ts.isStringLiteralLike(node.argument.literal)) return undefined;
	return node.argument.literal;
}

// 收集格式为“文件:行:列:说明符”的全部违规记录。
const failures = [];

collectTypescriptFiles(".");

// file 是排序后的当前待检查文件路径，排序用于稳定错误输出顺序。
for (const file of files.sort()) {
	// sourceText 是当前文件的 UTF-8 源码文本。
	const sourceText = readFileSync(file, "utf8");
	// sourceFile 是 TypeScript 解析得到的完整语法树。
	const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);

	/**
	 * 检查单个字符串说明符并记录违规位置。
	 * 参数：node 为字符串字面量节点。
	 * 返回值：无，发现违规时写入 failures。
	 * 使用示例：`checkSpecifier(node.moduleSpecifier)`。
	 */
	function checkSpecifier(node) {
		if (!isRelativeJavaScriptSpecifier(node.text)) return;
		// line 和 character 是 TypeScript 返回的从零开始的源码位置。
		const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
		failures.push(`${file}:${line + 1}:${character + 1}: ${node.text}`);
	}

	/**
	 * 深度优先访问语法节点并检查所有支持的模块说明符位置。
	 * 参数：node 为当前 TypeScript 语法节点。
	 * 返回值：无，递归子节点并把违规写入 failures。
	 * 使用示例：`visit(sourceFile)`。
	 */
	function visit(node) {
		if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
			checkSpecifier(node.moduleSpecifier);
		} else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
			checkSpecifier(node.moduleSpecifier);
		} else if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword &&
			node.arguments[0] &&
			ts.isStringLiteralLike(node.arguments[0])
		) {
			checkSpecifier(node.arguments[0]);
		} else if (ts.isImportTypeNode(node)) {
			// specifier 是类型导入中的可选字符串路径。
			const specifier = getImportTypeSpecifier(node);
			if (specifier) checkSpecifier(specifier);
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
}

if (failures.length > 0) {
	console.error("Relative .js imports are not allowed in non-declaration .ts files:");
	// failure 是当前格式化违规记录，逐条输出便于编辑器定位。
	for (const failure of failures) console.error(`  ${failure}`);
	process.exit(1);
}
