#!/usr/bin/env node
/**
 * 文件职责：命令行校验 pi-ai 包内生成的模型数据是否存在且与来源保持同步。
 * 技术维度：使用 Node.js ESM 路径 API 定位包根目录，并调用共享校验函数设置进程退出状态。
 * 产品维度：在提交或发布前阻止缺失、过期模型目录进入产物，避免用户看到错误模型列表。
 * 逻辑维度：计算包根目录，执行校验；成功打印提示，失败输出原因和修复命令并返回失败码。
 * 关键边界：只检查本地生成数据，不获取远端最新目录；失败时设置 exitCode 而不是立即强制退出。
 * 新手阅读建议：先看 packageRoot 的路径计算，再进入 validateGeneratedModelData 阅读具体校验规则。
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateGeneratedModelData } from "./model-data.ts";

/** pi-ai 包根目录的绝对路径；由当前脚本 URL 向上一级计算，不接受外部输入。 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

try {
	validateGeneratedModelData(packageRoot);
	console.log("Generated model data is valid.");
} catch (error) {
	// error 是校验阶段捕获的未知异常；输出前先判断是否为标准 Error，避免假定其结构。
	console.error(error instanceof Error ? error.message : String(error));
	console.error("\nModel data is missing or stale. Run `npm run hydrate:model-data` from the repository root.");
	process.exitCode = 1;
}
