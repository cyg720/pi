/**
 * 文件职责：递归查找仓库 packages 目录下所有包含 package.json 的工作区包目录。
 * 技术维度：使用 Node.js 同步文件系统 API、目录项类型判断和 Set 黑名单完成深度优先遍历。
 * 产品维度：为发布、校验等仓库脚本提供统一的包发现结果，避免维护容易过期的手工清单。
 * 逻辑维度：从根目录开始，记录包目录，跳过构建与依赖目录，递归子目录后排序返回。
 * 关键边界：根目录必须存在且可读；同步遍历会阻塞进程，不适合面向请求的高频运行场景。
 * 新手阅读建议：先看 findPackageDirectories 的输入输出，再顺着内部 visit 的“记录—枚举—递归”阅读。
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** 递归时必须跳过的目录名；dist 是构建产物，node_modules 是外部依赖，二者都不应被识别为工作区。 */
const SKIPPED_DIRECTORIES = new Set(["dist", "node_modules"]);

/**
 * 查找给定根目录内的全部包目录。
 * @param root 搜索起点，默认是仓库的 packages 目录；应为存在且可读取的目录。
 * @returns 按路径字典序排序的包目录数组；找不到 package.json 时返回空数组。
 * @example `findPackageDirectories()` 或 `findPackageDirectories("fixtures/packages")`。
 */
export function findPackageDirectories(root = "packages") {
	/** 已发现的包目录；遍历期间追加，返回前统一排序。 */
	const packageDirectories = [];

	/**
	 * 深度优先访问一个目录并收集其中的包。
	 * @param directory 当前目录路径，来自根目录或 readdirSync 发现的子目录。
	 * @returns 无返回值；通过闭包向 packageDirectories 写入结果。
	 * @example `visit(root)` 从搜索根开始递归。
	 */
	function visit(directory) {
		if (existsSync(join(directory, "package.json"))) {
			packageDirectories.push(directory);
		}

		// entry 是当前目录的一个文件系统条目；只有非黑名单子目录才会继续递归。
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (!entry.isDirectory() || SKIPPED_DIRECTORIES.has(entry.name)) {
				continue;
			}
			visit(join(directory, entry.name));
		}
	}

	visit(root);
	return packageDirectories.sort();
}
