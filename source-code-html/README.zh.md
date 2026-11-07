# Pi 中文离线源码导览

双击 [index.html](index.html) 阅读。源码、中文讲解、Git 历史、版本资料和阅读图均已内嵌，不需要网络或本地服务。单独复制 HTML 仍能阅读内嵌内容；历史完整快照需要同时保留 history 目录。

## 当前基线

2026-11-07：LG-Workbench / cf43eea7e741ae899ad4609233084c43ec5274f9。12 个一级包为 1.5.0，另含 Unreleased；新增 apps/p2 0.0.1 实验应用。根包 0.0.3 不是 CLI 版本。

- 合入上游 085c84e98，相对本地父提交新增 526 个可达提交。主要变化、破坏性接口和本地计划影响见 [上游更新说明](UPSTREAM-UPDATE.md)。
- 同步 Chord v2、pi-schema、p2、AI catalog；更新 Durable 分组提交、延迟进度落盘、会话历史与任务恢复说明。12 个包教程加 1 个 p2 应用教程、17 个开发阶段、38 个 Durable 示例、44 条路线和 640 个稳定编号保持可导航。
- p2 是上游实验原型；本地 PRD / prototype 和旧 WBW/WBP/WBS/WBR 工作台分别说明。已删除的 sandbox 示例转为历史资料，不伪造当前源码。
- 五幅图与八份可编辑 PPTX（132 页）同步到当前基线，保留离线内嵌下载。旧图、旧课件和旧验证记录留在 history 或 original。

## 更新命令

在仓库根目录运行：

~~~powershell
node source-code-html/build.mjs
node --test --test-isolation=none source-code-html/*.test.mjs
~~~

生成需要 Git、Node 和仓库已有 TypeScript 依赖；阅读不需要。生成器不调用模型、在线翻译或 CDN，不修改依赖、锁文件或业务源码。导览代码改动后按 AGENTS.md 运行 npm.cmd run check；该检查不运行产品测试，也不能代替导览回归。本轮结果与限制见 [验证记录](VALIDATION.md)。

图和课件需先按源码复核再更新，普通 build 不会用旧资产覆盖新版：

~~~powershell
# 编辑 src/diagrams/*.json 后，用已安装的 Archify 生成并校验五图
node source-code-html/update-diagrams.mjs <Archify目录>/bin/archify.mjs
# 从当前 data/mastery.json 生成 PPTX 候选及逐页预览
# RUNTIME_NODE_MODULES 指向含 @oai/artifact-tool 的运行时 node_modules
node source-code-html/build-slides.mjs <独立候选目录>
~~~

PPTX 候选须经结构、版式、字体、重新导入和逐页视觉检查后再替换 learning-slides 文件，并更新 manifest 的课程与文件指纹。不要只改 baseline 让旧课件通过检查。图谱 manifest 绑定规格、原始交付、离线封装及源码指纹；相关源码变化会阻止未经复核的重生成。

## 维护位置

| 路径 | 内容 |
| --- | --- |
| build.mjs | 从本目录的上一级定位仓库，收集和生成全部产物 |
| src/content.mjs、development.mjs、package-lessons.mjs | 中文章节、开发步骤、包教程 |
| src/features.mjs、feature-additions.mjs、current-features.mjs | 当前源码专题及明确路径规则 |
| src/upstream-revision.mjs | 本次合并的显式教学修订；保留稳定编号原文作为历史对照 |
| UPSTREAM-UPDATE.md | 已核实的合并范围、主要变化与迁移边界 |
| src/workbench.mjs | 旧工作台内容；仅对应源码存在时进入当前索引 |
| reference/pi-feature-catalog.zh.md | 稳定编号原文；已迁移的接口与历史状态在此维护 |
| reference/legacy/、legacy-manifest.json | 当前 checkout 缺失资料的旧快照及来源清单 |
| src/capability-bindings.mjs | 稳定编号到源码专题的显式对应 |
| src/mastery-curriculum.mjs、mastery-plan.json | 学习路线、练习、维护状态与验收边界 |
| src/version-notes.mjs、upstream-version-notes.mjs、history-notes.json | 版本重点与人工中文提交说明 |
| src/directory-notes.json | 持久目录说明与原源码指纹 |
| src/edition-baseline.json | 2026-09-29 固定差异基准，普通更新不覆盖 |
| data/ | 功能、版本、课程、目录、历史、指纹等生成数据 |
| history/ | 原导览、旧维护记录与 learning-slides-2026-10-17 原课件 |
| src/diagrams/、update-diagrams.mjs | 五图规格与生成、离线封装、校验流程 |
| src/slides.mjs、build-slides.mjs | 共享课程到原有三页课件的转换与候选生成 |
| learning-slides/ | 当前八份 PPTX、manifest 和验证摘要 |
| diagrams/ | 当前离线图与 manifest；original 保留原图，generated 保留 Archify 原始交付及回执 |

功能声明的每条路径、参考文档和教程定位文字均逐项校验。未知源码专题仍会报错；只有明确列出的旧分支功能允许退休，不能用静默过滤掩盖失效引用。不要直接手改生成 JSON 或 HTML。

## 目录与完整性边界

目录树收录 Git 跟踪路径及未被忽略的新文件；不含空目录、node_modules、.git 和被忽略的产物。业务功能索引来自已跟踪的源码路径；新文件需纳入 Git 后才能进入该索引。未跟踪导览文件出现在目录中不代表已经提交。

普通生成保留非空目录说明，新未知节点保持空白。有中文依据的空节点可用 node source-code-html/build.mjs --initialize-directory 补充。只有与旧自动说明完全匹配的内容才可据当前专题刷新，并保留 previousExplanation；源码指纹变化仍标待复核，不能冒充逐文件审计。

全部文件有归属、全部编号有学习位置，不代表每个函数或业务分支都经过人工审计或运行验证。静态引用图不是精确调用链；关联测试只是阅读线索。声明导出不等于 npm 公共接口。编号原文保留历史粒度，当前接口以专题、源码与版本日志为准。

Git 时间线只含当前 HEAD 可达的本地历史。人工说明之外是元数据概述，不是逐条 diff 翻译；“当前快照”指生成时文件，不是历史提交版本。版本页聚合中英文 changelog，中文可能滞后；标签、包版本和远端发布状态分别理解。两版对照比较各自日志，不是累计升级报告。

## 阅读和验证

入口包括 #mastery、#development、#packages、#directory、#functions、#versions、#workbench。进度仅保存到当前浏览器，不代表执行过命令或测试。复制失败可手动选择文本；本地存储不可用时仍可阅读。

本轮的测试结果与验收边界见 [VALIDATION.md](VALIDATION.md)。历史记录在 history，不计作本轮通过证据。真实模型、SSH、Docker、部署和断点操作不会由离线页面执行。外部参考链接需联网。
