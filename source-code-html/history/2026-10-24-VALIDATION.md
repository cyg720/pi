# 离线源码导览验证记录

本轮日期：2026-10-24。源码基线：LG-Workbench / 136b87e8a7f5a3e5186de0289523ba327dc592fc；11 个一级包版本 1.4.0，另含当前 Unreleased。以下仅记录本轮结果；之前记录保存在 [历史验证记录](history/2026-10-20-VALIDATION.md)。

## 更新范围

- 生成器已适配 source-code-html 位于仓库根目录的布局；不再引用缺失的 docs/doc-html 或外部功能清单。
- 当前包、教程、命令及源码专题按实际 checkout 生成。旧工作台四层、原生设置桥接与工作台工程脚本不混入当前能力；43 个工作台编号及 OTH-90 修补机制保留历史身份和原始资料。
- 重点复核 Durable Storage.commit 的 adopt 顺序、Watch 观察与结束、只读 Harness、IndexedDB、Chord 时钟和 AI 客户端身份；修正 Evals 不存在的 /workbench 导出及 31 个 Durable 示例的编号、语义对应。
- 1.4.0 与 Unreleased 分开解释；近期重点绑定真实 changelog 原文。全量源码引用、参考路径与正文定位文本逐项核验，不能用部分路径存在掩盖失效项。
- 原 index.html 保存在 history/workbench-2026-10-20.html，明确标注旧分支、提交和日期；旧 README、验证记录及课程计划另行归档。缺失的历史资料恢复至 reference/legacy，并记录来源清单。
- 36 个与旧自动生成依据精确匹配的目录说明同步到当前专题，保留 previousExplanation 和原源码指纹。空说明只在有中文依据时初始化；未复核的源码变化继续标识，不宣称逐文件审计。
- 五幅主图已按当前源码重制，分别说明 11 包架构、CLI 工作流、单次工具调用时序、会话数据流及 Durable 六种 TaskState。普通 CLI 与 Durable 分开说明；五图的规格、交付字节、离线封装和源码指纹记录在 diagrams/manifest.json。
- 八份可编辑 PPTX 共 132 页，按同一份课程数据更新正文、输入输出、失败分支、练习、源码路径及讲者备注。旧课件逐字节存档至 history/learning-slides-2026-10-17；当前文件已接入内嵌下载。

## 生成结果

| 项目 | 数量 |
| --- | --- |
| 当前包教程 | 11 |
| 开发阶段 | 17 |
| 当前源码专题与索引 | 378 |
| 归属源码文件 | 976 |
| AST 声明 | 26119 |
| 稳定功能编号 | 640，其中 44 项标为历史资料 |
| 学习路线 | 44 |
| 内嵌源码与资料 | 1899 |
| 本地可达提交 | 7094 |

index.html 约 54 MiB。源码文件指纹、版本范围、生成时间以 data/manifest.json 及内嵌数据为准。目录树同时包含未跟踪文件，数量随本地文档变动。

## 实际验证

| 命令或检查 | 结果 |
| --- | --- |
| node source-code-html/build.mjs | 通过 |
| node --test --test-isolation=none source-code-html/*.test.mjs | 73 通过，0 失败、0 跳过 |
| npm.cmd run check | 未整链通过：check:entry-graphs 在 Windows 误判；此前各步骤通过 |
| Biome、精确依赖、运行时依赖、相对导入 | 通过；Biome 检查 1546 文件，无修改 |
| npm.cmd run check:install-lock:coding-agent | 单独执行通过 |
| .\node_modules\.bin\tsc.cmd --noEmit | 单独执行通过 |
| npm.cmd run check:browser-smoke | 单独执行通过 |
| git diff --check | 通过；导览当前为未跟踪目录，不能把此项当成其完整验证 |
| 五图 Archify deliver / 离线封装后 check | 每图 9/9 showcase，0 错误、0 警告；未运行真实浏览器检查 |
| 八份 PPTX 结构、字体、尺寸与重新导入 | 全部通过；1280×720、Microsoft YaHei、原生可编辑文字 |
| PPTX 正文与讲者备注一致性 | 132 页逐项与课程转换结果完全一致 |
| PPTX 渲染与逐页查看 | 132 页已查看；两处单字/标点孤行修正并重新检查，其余 130 页图像指纹不变 |

本次新增四项资产回归，先确认缺少同步实现时失败，再完成实现和验证。全部 73 项测试覆盖源码与当前磁盘 SHA-256、稳定编号、历史能力隔离、失效规则拒绝、课程先修与覆盖、包教程、命令语法、源码解析器、版本范围、DOM 交互、搜索、深链接、滚动保持及脚本语法；新增检查覆盖图谱来源与封装、课程到正文/备注的转换、课件下载和旧课件字节存档。所有更改过的导览测试均已运行。

根检查的具体失败：packages/ai 的 ./models 被报告必须不引用 index.ts，命中文件为 packages\telemetry\src\index.ts。scripts/check-entry-graphs.mjs 使用 path.relative 得到 Windows 反斜杠路径，但 allow 列表为 packages/telemetry/src/index.ts，导致豁免失配。问题在本轮前已记录，本轮重新复现并检查源码；没有修改业务源码、预算、依赖或锁文件来绕开它。

## 验收限制

- 浏览器工具自动安全检查拒绝 file:// 协议，只允许 HTTP/HTTPS；没有绕过。未完成真实浏览器宽窄屏、断网打开、剪贴板与图内导出的视觉验收。DOM 测试和 browser-smoke 不替代这些验收。
- 五幅图已重制并通过确定性检查。Archify 原始字节保存在 diagrams/generated；离线版移除在线字体 link、加入 CSP，重新检查并记录独立指纹。确定性检查不代表浏览器视觉验收。
- 八份当前 PPTX 已更新、校验并逐页查看，具体摘要见 learning-slides/validation.json。未使用原生 PowerPoint 或 Google Slides 打开验收；工具渲染不等同于目标软件实测。
- 本轮没有运行产品 build、npm test、全量 Vitest、真实模型、SSH、Docker、部署或 VS Code 实际断点。关联测试用于源码学习，不表示它们已逐项运行。
- 全部文件归属和编号覆盖是完整性证据，不代表全部业务语义已逐函数审计。自动提交概述和旧资料不应作为当前实现的独立证明。

## 可手工复核

断网双击 index.html，查看 1.4.0 和 Unreleased、Durable Watch/只读专题、11 个包教程；搜索旧工作台编号，确认显示历史资料并可进入旧快照。切换明暗主题、缩窄窗口、打开源码并搜索行号，检查菜单滚动和阅读进度。单独复制 HTML 时，所有内嵌内容仍可读；历史完整 HTML 链接需要一起携带 history 目录。
