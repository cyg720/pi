---
description: 发布前审核更新日志条目
---
审核自上次发布以来所有提交对应的更新日志条目。

## 流程

1. **查找最近一次发布的标签：**
   ```bash
   git tag --sort=-version:refname | head -1
   ```

2. **列出该标签之后的所有提交：**
   ```bash
   git log <tag>..HEAD --oneline
   ```

3. **阅读每个包的 [Unreleased] 部分：**
   - packages/ai/CHANGELOG.md
   - packages/tui/CHANGELOG.md
   - packages/coding-agent/CHANGELOG.md

4. **逐个检查提交：**
   - 跳过：更新日志修改、仅文档修改和发布维护工作
   - 跳过：生成的模型目录变更（例如 `packages/ai/src/models.generated.ts`），除非同时在非生成的源码或文档中有面向产品的有意变更。
   - 确定提交影响哪些包（使用 `git show <hash> --stat`）
   - 验证受影响的包中是否有对应的更新日志条目
   - 对于外部贡献（PR），验证格式：`Description ([#N](url) by [@user](url))`

5. **跨包重复记录规则：**
   `ai`、`agent` 或 `tui` 中影响最终用户的变更也应记录到 `coding-agent` 的更新日志中，因为 coding-agent 是依赖这些包、直接面向用户的包。

6. **修复更新日志后添加新功能部分：**
   - 插入 `### New Features` 部分，位置为 `packages/coding-agent/CHANGELOG.md` 中的 `## [Unreleased]` 开头。
   - 写入之前，向用户提出主要新功能条目并请求确认。
   - 尽可能链接到相关文档和章节。

7. **报告：**
   - 列出缺少条目的提交
   - 列出需要跨包重复记录的条目
   - 直接补充缺失的条目

## 更新日志格式参考

章节（按顺序）：
- `### Breaking Changes` - 需要迁移的 API 变更
- `### Added` - 新功能
- `### Changed` - 现有功能的变更
- `### Fixed` - 错误修复
- `### Removed` - 移除的功能

贡献归属：
- 内部贡献：`Fixed foo ([#123](https://github.com/earendil-works/pi/issues/123))`
- 外部贡献：`Added bar ([#456](https://github.com/earendil-works/pi/pull/456) by [@user](https://github.com/user))`
