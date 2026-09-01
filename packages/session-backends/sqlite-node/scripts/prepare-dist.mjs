#!/usr/bin/env node
/**
 * 文件职责：为 sqlite-node 包清理构建目录或把 SQLite 迁移文件复制进发布产物。
 * 技术维度：使用 Node.js Promise 文件系统 API、ESM 路径解析和顶层 await 实现命令行脚本。
 * 产品维度：保证发布包不含旧构建残留，并携带运行数据库升级所必需的迁移脚本。
 * 逻辑维度：计算包与目录路径，根据命令参数选择递归删除 dist 或复制 migrations，否则报用法错误。
 * 关键边界：clean 会递归删除本包 dist；命令必须精确匹配，且脚本不应从错误包路径复制运行。
 * 新手阅读建议：先核对五个目录变量，再分别阅读 clean 与 copy-sqlite-migrations 两条互斥分支。
 */

import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 当前脚本所在目录的绝对路径。 */
const scriptDir = dirname(fileURLToPath(import.meta.url));
/** sqlite-node 包根目录，由 scripts 向上一级得到。 */
const packageDir = resolve(scriptDir, "..");
/** 构建产物目录；clean 命令只删除这个明确路径。 */
const distDir = resolve(packageDir, "dist");
/** 源码中的 SQLite 迁移文件目录。 */
const migrationSourceDir = resolve(packageDir, "src/sqlite/migrations");
/** 构建产物内迁移文件的目标目录。 */
const migrationDestDir = resolve(distDir, "sqlite/migrations");

/**
 * 删除本包 dist 构建目录。
 * @returns 目录删除完成后的 Promise；目录不存在也视为成功。
 * @example `await clean()` 仅由 `clean` 命令分支调用。
 */
async function clean() {
	await rm(distDir, { recursive: true, force: true });
}

/**
 * 把源码迁移目录递归复制到 dist。
 * @returns 目标目录创建和复制完成后的 Promise。
 * @example `await copySqliteMigrations()` 仅由对应命令分支调用。
 */
async function copySqliteMigrations() {
	await mkdir(migrationDestDir, { recursive: true });
	await cp(migrationSourceDir, migrationDestDir, { recursive: true });
}

/** 用户选择的子命令，只接受 clean 或 copy-sqlite-migrations。 */
const command = process.argv[2];

if (command === "clean") {
	await clean();
	process.exit(0);
}

if (command === "copy-sqlite-migrations") {
	await copySqliteMigrations();
	process.exit(0);
}

console.error("Usage: node scripts/prepare-dist.mjs <clean|copy-sqlite-migrations>");
process.exit(1);
