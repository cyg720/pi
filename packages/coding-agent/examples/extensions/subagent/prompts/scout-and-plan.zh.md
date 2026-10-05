---
description: Scout gathers context, planner creates implementation plan (no implementation)
---
使用子代理工具，通过链参数执行以下工作流程：

1. 首先，使用“侦察员”代理查找所有与：$@相关的代码
2. 然后，使用“规划员”代理，利用上一步的上下文创建“$@”的实施方案（使用{previous}占位符）

将这两步作为链执行，通过{previous}传递输出。请勿实际实现，只需返回计划。

