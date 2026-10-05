# 更新日志

## [Unreleased]

## [1.0.2] - 2026-10-04

## [1.0.1] - 2026-10-03

### 不兼容变更

- `OAuthClientProvider.clientMetadataUrl` 被 `clientMetadataDocument(metadata)` 替代。后者返回每个授权服务器对应的文档 URL 及其重定向 URI，也可返回 `undefined` 以进行动态注册。只要没有存储客户端信息就会调用它，即使服务器未声明支持也一样；该文档不再作为客户端信息存储（[#10302](https://github.com/earendil-works/pi/issues/10302)）。

### 新增

- 新增 `McpOAuthProviderOptions.clientMetadataDocument`、`OAuthCallbackServerOptions.extraPaths`，并为 `OAuthCallbackServer.waitForCallback` 增加 `path` 参数，以拒绝其他路径上的响应（[#10302](https://github.com/earendil-works/pi/issues/10302)）。

## [1.0.0] - 2026-10-01

### 新增

- 为 `authorizeMcp()` 新增 `authorizationServerMetadataUrl` 选项，使用配置的授权服务器元数据文档，而非执行发现流程（[#10172](https://github.com/earendil-works/pi/issues/10172)）。
- 为 `authorizeMcp()` 新增 `iss` 选项。仅当 `iss` 指定本次流程的授权服务器，或该字段缺失且服务器元数据未设置 `authorization_response_iss_parameter_supported` 时，才会交换授权码（RFC 9207）。
- 新增 `stepUpScope()`，将 `insufficient_scope` 质询中的授权范围与此前已授予的范围合并。

### 修复

- 修复 OAuth 令牌和客户端注册响应的可选字段为空或 `null`（如 `"scope": ""`）时出现 `Invalid scope` 等错误的问题；现在这些字段按缺失处理（[#10266](https://github.com/earendil-works/pi/issues/10266)）。
- 修复令牌响应中的 `expires_in: null` 将访问令牌标记为已过期的问题。
- 修复受保护资源元数据中的无效 URL 导致 OAuth 发现中止、而非回退到 MCP 服务器源地址的问题。
- 修复请求授权范围为空（来自 `WWW-Authenticate` 质询中的 `scope=""` 或空的 `scopes_supported`）时覆盖下一个授权范围来源的问题。
- 修复服务器以 `nextCursor: ""` 或 `null` 结束分页时，列表分页因重复游标错误而失败的问题。
- 修复 `adaptOAuthProvider()` 中的权限升级授权只请求 `insufficient_scope` 质询中的授权范围的问题。新令牌丢失此前已授予的范围，导致其他请求再次出现 `insufficient_scope` 错误。现在令牌会记录已授予的授权范围；令牌响应省略 `scope` 时，以请求的授权范围为准。

## [0.99.2] - 2026-09-30

### 修复

- 修复 `StreamableHttpTransport` 在 Cloudflare Workers 上每次请求都因 `Illegal invocation` 失败的问题：调用 `fetch`（包括 `UnauthorizedContext.fetch`）时不再指定接收对象（[#10188](https://github.com/earendil-works/pi/issues/10188)）。

## [0.99.1] - 2026-09-29

## [0.99.0] - 2026-09-29

### 新增

- 新增独立的 MCP 客户端，支持 JSON-RPC 生命周期、工具发现与调用、取消、进度、根目录、stdio 和 Streamable HTTP 传输，以及用于测试的内存传输。
