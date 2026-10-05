# MCP 客户端一致性测试

针对 pi 的 MCP 客户端运行官方 [MCP 一致性测试套件](https://github.com/modelcontextprotocol/conformance)，并将结果与已提交的基线比较。

```bash
npm run test:mcp-conformance
```

CI 在 `mcp-conformance` 任务（位于 `.github/workflows/ci.yml`）中运行它。首次运行需要联网以获取固定版本的测试套件（`@modelcontextprotocol/conformance@0.2.0-alpha.11`），获取方式是使用 `npx`。安装脚本已禁用。需要 POSIX shell。

## 工作方式

对于 pi 协商的每个协议版本（`2025-03-26`、`2025-06-18`、`2025-11-25`），`run.ts` 会列出测试套件的客户端场景并逐个运行。测试套件启动场景服务器，并针对该服务器运行 `client.ts`。

`client.ts` 使用 pi 为 `mcp.json` 中的 HTTP 服务器运行的代码：`McpServerConnection` 负责连接和调用工具，`signInMcpServer` 执行由 `/mcp` 启动的 OAuth 登录。模拟浏览器访问授权 URL，并将重定向传递给 pi 的本机回环回调服务器。如果服务器再次要求登录（例如要求更多授权范围），模拟用户会再次登录，最多三次。

测试套件报告的每项检查都会与 `baseline.json` 比较。额外的 `pi-client` 检查记录 `client.ts` 是否完成了场景。有些场景预期客户端会放弃（`auth/scope-retry-limit`），因此它们也和其他场景一样记录在基线中。

以下情况会导致运行失败：

- 基线中通过的检查失败或缺失，
- 某项检查失败，但基线并未将其列为失败，
- 基线中的某个场景未运行。

以前失败、现在开始通过的检查会被报告；更新基线以固定这些结果。

## 选项

```bash
node packages/coding-agent/test/mcp-conformance/run.ts --mode 2025-11-25 --scenario auth/scope-step-up --verbose
node packages/coding-agent/test/mcp-conformance/run.ts --update-baseline
```

- `--mode`、`--scenario`：运行部分场景（可重复指定）。
- `--verbose`：打印测试套件输出，包括每项检查和客户端日志。
- `--keep-results`：保留测试套件的 `checks.json` 和客户端输出。
- `--update-baseline`：将完整运行的结果写入 `baseline.json`。检查差异；不要通过重新生成基线来掩盖回归问题。

## 已知失败

- `elicitation-sep1034-client-defaults`：pi 不支持 elicitation（向用户征询信息）。
- `auth/basic-cimd`：pi 动态注册客户端，而不使用客户端 ID 元数据文档（Client ID Metadata Document）。
- `auth/scope-retry-limit`：`pi-client` 按设计失败；服务器始终不接受已授予的授权范围。

不覆盖 2026-07-28：这是 pi 未实现的无状态协议。
