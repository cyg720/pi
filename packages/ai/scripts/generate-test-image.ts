#!/usr/bin/env node
/**
 * 文件职责：生成供图片输入测试使用的 200×200 红色圆形 PNG 固定夹具。
 * 技术维度：使用 node-canvas 绘图 API、ESM 路径转换和 Node.js 同步文件系统写入。
 * 产品维度：为多模态模型测试提供可重复的本地图片，避免依赖外部资源或人工准备。
 * 逻辑维度：定位脚本目录，创建画布，绘制白底红圆，编码 PNG，确保目录存在后写入。
 * 关键边界：会覆盖 test/data/red-circle.png；运行环境必须安装可用的 canvas 原生依赖。
 * 新手阅读建议：按“画布—绘制上下文—图形—PNG 缓冲区—文件”顺序理解图片生成流程。
 */

import { createCanvas } from "canvas";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/** 当前脚本的绝对文件名，用 ESM import.meta.url 转换得到。 */
const __filename = fileURLToPath(import.meta.url);
/** 当前脚本所在目录，用于稳定定位包内测试数据目录。 */
const __dirname = dirname(__filename);

// Create a 200x200 canvas
// 创建宽高均为 200 像素的画布。
/** 测试图片画布；尺寸固定为 200×200 像素。 */
const canvas = createCanvas(200, 200);
/** 二维绘图上下文；提供填充矩形、圆弧等 Canvas API。 */
const ctx = canvas.getContext("2d");

// Fill background with white
// 先用白色填满背景，避免 PNG 透明区域影响测试。
ctx.fillStyle = "white";
ctx.fillRect(0, 0, 200, 200);

// Draw a red circle in the center
// 在画布中心绘制半径 50 像素的红色实心圆。
ctx.fillStyle = "red";
ctx.beginPath();
ctx.arc(100, 100, 50, 0, Math.PI * 2);
ctx.fill();

// Save the image
// 把画布编码为 PNG 缓冲区并确定输出路径。
/** 已编码的 PNG 二进制数据，写入前保存在内存中。 */
const buffer = canvas.toBuffer("image/png");
/** 最终测试图片路径，固定为包内 test/data/red-circle.png。 */
const outputPath = join(__dirname, "..", "test", "data", "red-circle.png");

// Ensure the directory exists
// 递归创建测试数据目录；目录已存在时不会报错。
mkdirSync(join(__dirname, "..", "test", "data"), { recursive: true });

writeFileSync(outputPath, buffer);
console.log(`Generated test image at: ${outputPath}`);
