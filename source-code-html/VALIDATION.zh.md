# 2026-11-18 离线源码导览验证

源码基线 `dbc6ee9c53115c3788a4343c8c4c24d55c6fa768`。这次合并的 437 个提交及迁移点见 [main 更新说明](UPSTREAM-UPDATE.md)。上一版记录见 [1.5.0 验证存档](history/2026-11-07-VALIDATION.md)。

| 验证 | 结果 |
| --- | --- |
| Git 合并 | main 是当前 HEAD 的祖先。第二父提交为 05fd3fbda，计数 437，工作区无未解决冲突。 |
| 导览生成 | 8,077 条提交、4,260 份源码与资料、509 项功能与索引，HTML 约 94.5 MiB。 |
| 导览回归 | 75 项通过，覆盖引用定位、章节、源码指纹、版本、五图及课件。 |
| 离线 Chrome | 1440×1000、390×844 均可打开首页、p3、p2-mac、Durable 教程与恢复课件。内嵌下载字节与本地 PPTX 一致。0 页面错误、0 HTTP 请求、0 横向溢出。 |
| 五幅图 | 五图均通过 Archify 9/9 showcase、离线封装检查及四种桌面尺寸的 Chrome 自动检查。抽看架构图和生命周期图的新说明与状态标签。 |
| 八份 PPTX | 132 页的可编辑正文和讲者备注均与课程对应，1280×720 渲染中正文区域与上一版一致，页脚更新源码基线。 |
| 仓库检查 | 完整根 check、p2 check、p3 check 和 git diff --check 通过。依赖由锁文件安装，pi-ai 目录水合完成。 |

离线浏览器检查对应 index.html SHA-256 `cccdeaf0bed0a44b01809effbffc1262204f297d78ffbfec50c4dd59a9ef92ad`。图的校验回执见 [图谱清单](diagrams/manifest.json)，课件结果见 [课件验证](learning-slides/validation.json)。

合并后原型曾有两项目录对照失败。用现有生成器刷新目录后，43 个接入项与 1,682 个聊天模型均已收录，原型 73 项测试通过。离线导览已同步内嵌的原型说明。

根检查和导览回归覆盖静态与离线行为。p2、p3 服务、真实模型调用与原生 PowerPoint 打开未在本轮验收。依赖安装报告 7 项 high，npm 仍提示不认识 min-release-age-exclude 配置。
