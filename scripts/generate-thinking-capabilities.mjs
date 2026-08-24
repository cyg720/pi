#!/usr/bin/env node
/**
 * 文件职责：从完整模型目录生成按提供方拆分的思考能力 JSON 文件。
 * 技术维度：使用 Node.js ESM、同步文件系统 API、对象遍历和 Pi 的思考等级解析函数。
 * 产品维度：为发布产物提供轻量能力索引，使客户端无需加载完整目录即可展示思考选项。
 * 逻辑维度：解析命令行路径，读取目录，逐提供方和模型计算 levels/values，最后写入 JSON。
 * 关键边界：输入必须是合法目录 JSON，输出目录会创建并覆盖同名提供方文件；不会清理多余旧文件。
 * 新手阅读建议：先看两个命令行参数，再按 provider、model、level 三层数据转换顺序阅读。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getSupportedThinkingLevels } from "../packages/ai/src/models.ts";

/** 命令行传入的模型目录路径与输出目录；两者都必须提供。 */
const [catalogPath, outputDir] = process.argv.slice(2);
if (!catalogPath || !outputDir) {
	throw new Error("Usage: node scripts/generate-thinking-capabilities.mjs <catalog-path> <output-dir>");
}

/** 从输入文件解析出的完整模型目录对象；结构由上游目录生成器保证。 */
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
/** 按提供方输出能力文件的子目录路径。 */
const providersDir = join(outputDir, "providers");
mkdirSync(providersDir, { recursive: true });

// provider 是提供方键，models 是该提供方的模型对象；二者都来自输入目录。
for (const [provider, models] of Object.entries(catalog)) {
	/** 当前提供方的模型能力表；键为模型 ID，值包含等级及必要的非默认映射。 */
	const capabilities = Object.fromEntries(
		// id 与 model 分别是模型标识和完整元数据；每个模型转换为一个能力条目。
		Object.entries(models).map(([id, model]) => {
			/** Pi 根据模型元数据计算出的可选思考等级，顺序用于界面展示。 */
			const levels = getSupportedThinkingLevels(model);
			/** 只保留“实际值不同于等级名”的映射，减少输出 JSON 体积。 */
			const values = Object.fromEntries(
				// level 是当前支持等级；没有显式不同值时不写入 values。
				levels.flatMap((level) => {
					/** 模型对该等级声明的底层值；可能未设置或与等级同名。 */
					const value = model.thinkingLevelMap?.[level];
					return value !== undefined && value !== level ? [[level, value]] : [];
				}),
			);
			return [id, Object.keys(values).length > 0 ? { levels, values } : { levels }];
		}),
	);
	writeFileSync(join(providersDir, `${provider}.json`), JSON.stringify(capabilities));
}
