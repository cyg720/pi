---
description: 更新GitHub安全公告以便发布
argument-hint: "<advisory-url-or-draft-path>"
---
更新GitHub安全公告以便发布：$ARGUMENTS

使用`gh`执行所有GitHub操作。除非用户明确同意或草稿Markdown中明确说明`request_cve: true`，否则不要发布公告、更改其状态或请求CVE。

GitHub未通过文档记录的REST OpenAPI模式或公共GraphQL模式公开存储库安全公告的评论/讨论。对于诸如`api.github.com/repos/.../security-advisories/<GHSA>/comments`、`.../timeline`或`.../events`等猜测的API端点返回404是预期行为，本身并不表示认证失败。不要使用浏览器会话、浏览器Cookie或Cookie提取来获取公告评论。应明确告知用户公告评论未包含在内，并告知他们可以粘贴任何相关评论以便考虑。

## 输入处理

- 如果`$ARGUMENTS`是GitHub安全公告的URL，则启动调查和起草工作流程。
- 如果`$ARGUMENTS`是现有markdown草稿的路径，则读取该草稿并将其应用于公告。
- 在本提示的后续消息中，如果用户说“更新”、“应用”、“不错”等，则视为批准应用先前撰写的临时markdown草稿。更新前请重新从磁盘读取文件。
- 如果应用草稿但没有已知草稿路径，请询问用户markdown文件路径。

## 初始公告工作流程

1. 将公告URL解析为`owner`、`repo`和`GHSA` ID。
2. 获取公告：
   ```sh
   gh api repos/<owner>/<repo>/security-advisories/<GHSA>
   ```
   记录公告的原始严重性、CVSS向量和CVSS分数，与返回内容完全一致后再提出更改。
3. 除非用户将评论粘贴到对话中，否则不要获取公告评论/讨论：
   - 检查公告JSON中的引用、致谢、关联问题/PR和任何讨论字段。
   - 不要依赖于诸如`/comments`、`/timeline`或`/events`等虚构的API端点；它们通常返回404，因为GitHub未通过公共API公开草稿公告评论。
   - 不要使用浏览器会话、浏览器Cookie或Cookie提取来获取评论。
   - 明确告知用户：`Advisory comments were not included because GitHub does not expose them through the public API. Paste any relevant comments if you want them considered.`
   - 如果用户粘贴了评论，请读取并考虑它们。
   - 绝不要假装评论已被读取。
4. 独立调查：
   - 阅读公告文本、元数据、受影响的包/版本范围、CVSS、CWE、引用和关联问题/PR/提交记录。
   - 检查相关代码历史、发布记录、变更日志、包元数据和标签。
   - 确定漏洞是否已修复。
   - 如果已修复，请识别补丁版本和正确的受影响版本范围。
   - 不要盲目信任报告人的分析，必须自行验证。
5. 讨论CVSS评分后再起草最终更新：
   - 建议CVSS向量、分数和严重性。
   - 简要解释有争议的指标。
   - 请用户确认或调整。
6. 询问是否应向GitHub请求此公告的CVE。
7. 起草一个可用于发布的公告markdown文件，路径为`/tmp`，例如`/tmp/sa-<GHSA>.md`。包含公告的原始CVSS和已确认/更新的CVSS。
8. 告知用户：
   - 临时markdown文件的路径
   - 原始公告URL
   - 他们可以编辑文件，然后说“更新”或提供路径

## markdown草稿格式

草稿文件必须包含YAML前置信息，随后是公告正文。包含所有用于更新GitHub和决定是否请求CVE所需的字段。

```markdown
---
advisory_url: https://github.com/<owner>/<repo>/security/advisories/<GHSA>
owner: <owner>
repo: <repo>
ghsa_id: <GHSA>
summary: <short advisory summary>
original_severity: <low|medium|high|critical|null>
original_cvss_vector: <original CVSS:3.1/... or null>
original_cvss_score: <original number or null>
severity: <proposed/confirmed low|medium|high|critical>
cvss_vector: <proposed/confirmed CVSS:3.1/...>
cvss_score: <proposed/confirmed number>
cwe_ids:
  - CWE-...
vulnerabilities:
  - package:
      ecosystem: npm
      name: <package-name>
    vulnerable_version_range: <range>
    patched_versions: <range-or-version>
request_cve: false
---

# <Advisory title>

<Concise description of the vulnerability and vulnerable behavior.>

## Info

<Technical explanation of the root cause and affected component. Focus on facts needed by defenders and maintainers. Do not include PoC steps, exploit payloads, or copy-pastable exploit strings.>

## Impact

<Who can exploit it, prerequisites, confidentiality/integrity/availability impact, and realistic deployment assumptions.>

## Affected versions

- Affected: `<range>`
- Patched: `<version or range>`

## The solution

<Describe the fix and the patched release.>

## Recommendations

<Upgrade guidance and operational mitigations.>

## Workarounds

<Workarounds if any; otherwise skip this section entirely>

## Timeline

- YYYY-MM-DD: Report received
- YYYY-MM-DD: Fix committed
- YYYY-MM-DD: Fixed version released
- YYYY-MM-DD: Advisory published

## Credits

<Reporter/researcher attribution if appropriate, otherwise skip section.>

## References

- <links to releases, commits, advisories, documentation>
```

使用curl公告风格作为灵感来源：清晰的章节、直白的语言、受影响/已修复版本的事实、建议、时间线和致谢。不要包含PoC。

## 将草稿应用于GitHub

当用户以“更新”/类似方式批准或提供markdown路径时：

1. 重新从磁盘读取markdown文件。绝不依赖内存中先前生成的内容。
2. 解析 YAML 前置数据和正文。
3. 在临时文件中构建 JSON 载荷。字段映射如下：
   - `summary` 来自前置数据
   - `description` 来自前置数据之后的 Markdown 正文
   - `severity` 来自前置数据（如有）
   - `cvss_vector_string` 来自 `cvss_vector`
   - `cwe_ids` 来自前置数据
   - `vulnerabilities` 来自前置数据
   - 不要发送 `original_severity`、`original_cvss_vector` 或 `original_cvss_score`；这些字段仅保留用于审计上下文。
4. 更新通告内容：
   ```sh
   gh api -X PATCH repos/<owner>/<repo>/security-advisories/<GHSA> --input /tmp/<payload>.json
   ```
5. 仅当 Markdown 前置数据包含 `request_cve: true` 时，请求 CVE：
   ```sh
   gh api -X POST repos/<owner>/<repo>/security-advisories/<GHSA>/cve
   ```
   将“已请求”或“已分配”视为非致命错误并进行报告。
6. 报告更新内容：
   - 通告 URL
   - 摘要
   - 受影响范围
   - 已修补版本
   - 原始 CVSS 向量/分数/严重性
   - 更新后的 CVSS 向量/分数/严重性
   - 是否请求了 CVE

## 安全规则

- 不要在最终通告正文中包含 PoC 材料。
- 除非 Markdown 文件中包含 `request_cve: true`，否则不要请求 CVE。
- 除非用户明确要求，否则不要发布通告或更改其状态。
- 不要通过浏览器会话或 Cookie 获取通告评论。说明评论未包含，并邀请用户粘贴相关评论以供考虑。
- 如果受影响范围、已修补版本、CVSS 或 CVE 请求状态存在不确定性，请在应用前询问用户。

