---
description: 根据 URL 评审 PR，进行结构化的问题与代码分析
argument-hint: "<PR-URL>"
---
您将收到一个或多个GitHub PR URL：$@

对于每个PR URL，请按以下顺序执行操作：
1. 在分析开始前，通过GitHub CLI为PR添加`inprogress`标签。如果添加标签失败，请明确报告，然后继续。
2. 完整读取PR页面。包括描述、所有评论、所有提交和所有更改的文件。
3. 识别PR正文、评论、提交信息或交叉链接中引用的任何关联问题。完整阅读每个问题，包括所有评论。
4. 在不检出或切换到PR分支的情况下分析PR diff。使用`gh pr diff`、`gh pr view`、`gh api`和本地主分支文件；如果需要PR文件内容，请使用`git show <ref>:<path>`获取的引用或临时文件。完整阅读所有相关代码文件，不进行截断，并与diff进行比较。除非主分支上文件缺失或diff上下文不足，否则不要获取PR文件blob。包括diff之外但验证行为所必需的相关代码路径。
5. 不要检查是否有变更日志条目。根据CONTRIBUTING.md，贡献者PR不得编辑`CHANGELOG.md`——维护者在合并时添加该条目。
6. 检查packages/coding-agent/README.md、packages/coding-agent/docs/*.md、packages/coding-agent/examples/**/*.md是否需要修改。通常在现有功能已更改或新增功能时需要修改。
7. 提供结构化的评审，包括以下部分：
   - What it does: 用一段简短的文字描述变更及其意图。
   - Good: 坚实的选择或改进。
   - Bad: 具体的问题、回归、缺失的测试或风险。
   - Ugly: 隐蔽或影响较大的问题。
   - Tests: 覆盖范围、缺失内容以及现有测试是否充分。
   - Open questions for you: 只包括影响合并决策且需要用户输入的内容。如果没有问题，则省略该部分。

每个PR的输出格式如下：
PR: <url>
What it does:
- ...
Good:
- ...
Bad:
- ...
Ugly:
- ...
Tests:
- ...
需要你回答的问题：
- ...

如果没有发现问题，请在Bad和Ugly部分说明。

