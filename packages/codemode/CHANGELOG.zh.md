# 更新日志

## [未发布]

## [1.0.2] - 2026-10-04

## [1.0.1] - 2026-10-03

### 修复

- 修复了无限循环打印导致主机内存不断增长直至崩溃的脚本：输出限制为 `MAX_OUTPUT_CHARS`（16 Mi）字符和 `MAX_OUTPUT_ITEMS`（100000）项，超过任一限制的脚本将返回 `RangeError`（[#10283](https://github.com/earendil-works/pi/issues/10283)）

## [1.0.0] - 2026-10-01

### 新增

- 新增 `renderToolOutputType()`，工具调用解析后的类型。

### 修改

- 读取 `tools` 或不存在的全局命名空间的成员，现在会抛出错误，列出相近名称，而不是返回 `undefined`。使用 `"name" in tools` 检查工具。`store()` 尺寸错误会解释存储用途。

## [0.99.2] - 2026-09-30

### 修改

- 允许 `CodemodeSandbox.workerUrl` 为字符串，以满足 Bun 编译可执行文件中嵌入式 worker 入口点的要求（[#10204](https://github.com/earendil-works/pi/issues/10204)）。

### 修复

- 修复了 `image()` 接受格式错误的 base64 数据和不支持的图像类型。现在除非数据是有效的 PNG、JPEG、GIF 或 WebP 图像的 base64，否则会抛出 `TypeError`，MIME 类型根据图像签名推导，而非声明类型，并剥离换行符（[#10215](https://github.com/earendil-works/pi/issues/10215)）。

## [0.99.1] - 2026-09-29

## [0.99.0] - 2026-09-29

### 新增

- 初始探索：`CodemodeSandbox` 在工作线程中运行模型编写的 JavaScript，并将注入的工具作为 `tools.<name>(args)` 异步函数暴露。

