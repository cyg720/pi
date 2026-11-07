# 离线源码导览验证记录

本轮日期：2026-11-07。源码基线：LG-Workbench / cf43eea7e741ae899ad4609233084c43ec5274f9。12 个一级包为 1.5.0，另含 Unreleased；apps/p2 为 0.0.1。前次结果在 [2026-10-24 验证记录](history/2026-10-24-VALIDATION.md)，不计为本轮证据。

## 更新范围

- 按合并父提交核对 526 个新增上游可达提交；具体范围与迁移重点见 [上游更新说明](UPSTREAM-UPDATE.md)。
- 新增 Schema、p2、p2 插件、AI catalog 和 Chord 示例索引。显式修订 Chord v2 与 Durable 教学正文、稳定编号解释、包教程、学习路线和版本重点；原编号原文保留历史身份。
- Durable 分组提交、receive 回执、延迟进度落盘、ConversationTranscript、任务失败和逐会话压缩与旧接口区分。38 个编号示例都有对应中文说明。
- p2 实验应用、本地 PRD / prototype 和旧工作台分别说明。删除的 sandbox 示例退休，旧资料仍可读取。
- 五图按当前源码绑定指纹；时序图和数据流图调整纵向间距，解决桌面浏览溢出。八份课件的正文、讲者备注、源码路径及基线同步，旧课件存于 history/learning-slides-2026-10-24。
- 有依据的新目录说明初始化；已有说明和原指纹保留。来源改变仍标为待复核，未知节点保持空白，不宣称逐文件审计。

## 生成结果

| 项目 | 数量 |
| --- | --- |
| 当前教程 | 12 个包 + 1 个 p2 应用 |
| 开发阶段 / 学习路线 | 17 / 44 |
| 源码专题与索引 | 481，其中 229 项中文能力解说，其余为源码索引 |
| 归属源码文件 / AST 声明 | 2,152 / 46,040 |
| 稳定功能编号 | 640，其中 45 项历史资料 |
| 内嵌源码与资料 | 3,707 |
| 本地可达 Git 提交 | 7,634 |
| 架构图 / PPTX | 5 / 8 份，共 132 页 |

index.html 约 83 MiB（最终值以文件为准）。目录节点和生成时间随本地文档变动，精确指纹见 data/manifest.json。

## 实际验证

| 命令或检查 | 本轮结果 |
| --- | --- |
| node source-code-html/build.mjs --initialize-directory | 通过，逐项核对专题路径、文档与定位文字 |
| node --test --test-isolation=none source-code-html/*.test.mjs | 75 通过，0 失败、0 跳过；源码快照、目录、课程、版本与课件全部通过 |
| npm.cmd run check | 整链通过，退出 0；Biome 检查 2517 文件，无修改；TypeScript、入口图、安装锁与 browser-smoke 均通过 |
| git diff --check | 通过；architecture.json 已统一为 LF，并重新生成规格指纹；五图 HTML 字节与已查看的浏览器证据完全一致 |
| 五图 Archify deliver / 离线封装 check | 每图 9/9 showcase，0 错误、0 警告 |
| 五图 visual-check | Chrome 明暗主题，1440×900、1600×1000、1920×1080、2048×1320 均通过；五图截图已查看 |
| PPTX 文件结构、字体、尺寸与重新导入 | 8 份均通过；1280×720、Microsoft YaHei、原生可编辑文字 |
| PPTX 正文、备注与渲染 | 132 页与课程精确匹配并重新渲染；18 页正文改变逐页查看，其余 114 页正文区域与原版像素一致；最后一处讲者备注修正后的 33 页图像全部不变 |
| 离线浏览器检查 | Chrome offline，1440×1000 和 390×844；首页、搜索、四个新修订教程、课程翻页、内嵌 PPTX 链接、主题和窄屏检查通过；0 页面异常、0 HTTP/HTTPS 请求 |

新增两项上游回归先验证旧产物失败，再更新实现。既有测试适配实际的 12 包 + p2、38 个 Durable 示例及修订后的教程；不以忽略失效路径替代更新。浏览器证据见 [结果](validation/browser-result.json)、[桌面](validation/browser-desktop-home.png)、[窄屏](validation/browser-mobile-dark.png)。图谱回执与截图在 diagrams；课件摘要在 learning-slides/validation.json。

导览源码基线允许后续仅修改导览、功能文档和项目记忆的提交，避免导览自身提交改变 HEAD 后被误判为过期。仍验证基线祖先关系、后续改动路径及每份业务源码快照的 SHA-256；业务代码或版本变化必须重新生成。

首次根检查因合并后本机依赖与模型数据陈旧失败。随后执行 npm.cmd ci --ignore-scripts（锁文件未变，安装审计 0 vulnerabilities）和 hydrate:model-data，再通过完整检查。当前水合使用 catalog/generate.ts --strict --data-only 访问目录来源，不调用模型。npm 仍提示本机 npm 不识别仓库 min-release-age-exclude 配置；未修改仓库安全配置以消除提示。此前 Windows 入口图分隔符问题在本次上游中已修复，不再是阻塞。

## 验收边界

- 未运行产品 build、npm test、全量 Vitest、真实模型、SSH、Docker、p2 服务或部署；关联测试路径是阅读线索，不代表全部执行过。
- 未在原生 PowerPoint 或 Google Slides 中打开验收。工具渲染、结构检查与文字比对不等于目标软件实测。
- 浏览器验证了内嵌课件链接与字节一致性；剪贴板授权、五图所有导出格式和真实用户下载流程未逐项实测。
- 本次是源码快照和重点教学迁移，不是 526 个提交、46,040 个声明的逐项审计。历史中文文档可能滞后，当前专题与原始源码优先；待复核目录仍保持其标记。
- 单独复制 index.html 可读取内嵌源码、教程、图和课件；外部链接需要网络，完整历史快照需携带 history 目录。
