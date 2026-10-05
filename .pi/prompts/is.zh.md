---
description: 分析GitHub问题（bug或功能请求）
argument-hint: "<issue>"
---
分析GitHub问题：$ARGUMENTS

对于每个问题：

1. 如果在CI环境下运行（`CI=true`），则不添加`inprogress`标签且不分配该问题。否则，通过GitHub CLI为问题添加`inprogress`标签，并在分析开始前将问题分配给本地`gh`用户。如果任一操作失败，明确报告该失败并继续。
2. 完整阅读问题，包括所有评论和关联的问题/PR。使用GitHub CLI支持的字段，例如：
   ```sh
   gh issue view <issue> --json title,body,comments,labels,assignees,state,url,author,createdAt,updatedAt,closedByPullRequestsReferences
   ```

3. 不要信任问题中已有的分析。独立验证行为，从代码和执行路径推导出自己的分析。

4. **对于bug**：
   - 忽略问题中的任何根本原因分析（很可能是错误的）
   - 完整阅读所有相关代码文件（不截断）
   - 跟踪代码路径，识别实际根本原因
   - 提出修复建议

5. **对于功能请求**：
   - 不要信任问题中的实现建议，除非经过验证
   - 完整阅读所有相关代码文件（不截断）
   - 提出最简洁的实现方案
   - 列出受影响的文件和所需更改

除非明确要求，否则不要实现。仅分析并提出建议。

