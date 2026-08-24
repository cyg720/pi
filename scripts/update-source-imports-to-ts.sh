#!/usr/bin/env bash
# 文件职责：批量把包源码中的相对 .js 导入说明符改为 .ts。
# 技术维度：使用 Bash、find 的 NUL 分隔输出、xargs 与 Perl 正则进行跨文件原地替换。
# 产品维度：帮助源码直接执行和类型检查正确定位 TypeScript 文件，同时让构建器再输出 .js 路径。
# 逻辑维度：发现 packages 下的 src 目录，枚举其中所有 .ts 文件，再处理导入与模块声明三种写法。
# 关键边界：脚本会原地修改匹配文件；仅应在版本控制工作区执行，并在执行后审查差异。
# 新手阅读建议：先理解三段管道的数据流，再逐段阅读 Perl 正则对应的 from/import、declare module 和提供方导入。
set -euo pipefail

# Rewrites relative source import specifiers in package source directories from .js to .ts.
# 将包源码中的相对导入后缀由 .js 改写为 .ts。
# TypeScript's rewriteRelativeImportExtensions option rewrites these back to .js in emitted output.
# 构建时 TypeScript 的 rewriteRelativeImportExtensions 会再把这些后缀写回 .js。
# src_dir 表示当前发现的源码目录；它只来自 packages 下深度为二的命名为 src 的目录。
find packages -mindepth 2 -maxdepth 2 -type d -name src -print0 |
	while IFS= read -r -d '' src_dir; do
		find "$src_dir" -type f -name '*.ts' -print0
	done |
	xargs -0 perl -0pi -e 's/(\b(?:from|import)\b\s*\(?\s*["\x27])(\.{1,2}\/[^"\x27\r\n]+)\.js(["\x27]\s*\)?)/$1$2.ts$3/g; s/(\bdeclare\s+module\s+["\x27])(\.{1,2}\/[^"\x27\r\n]+)\.js(["\x27])/$1$2.ts$3/g; s/(\bimportNodeOnlyProvider\(\s*["\x27])(\.{1,2}\/[^"\x27\r\n]+)\.js(["\x27]\s*\))/$1$2.ts$3/g'
