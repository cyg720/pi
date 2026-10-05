# @earendil-works/pi-mcp

一个独立的模型上下文协议客户端。它不依赖官方的MCP SDK或其他pi包。

该包提供了一个与传输无关的核心客户端、stdio和可流式HTTP传输，以及一个内存测试传输。

## 用法

```typescript
import { McpClient, StdioTransport } from "@earendil-works/pi-mcp";

const transport = new StdioTransport({
	command: "npx",
	args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
});
const client = new McpClient({
	name: "my-client",
	version: "1.0.0",
	roots: [{ uri: "file:///workspace", name: "workspace" }],
});

await client.connect(transport);
const tools = await client.listTools();
const result = await client.callTool("search", { query: "MCP" });
await client.close();
```

对于远程服务器，请使用`new StreamableHttpTransport({ url, headers })`。Fetch可以被注入以实现代理或自定义网络功能。

### LLM工具的辅助工具

`toLlmContent(result)`将`CallToolResult`转换为模型可用的文本和图像内容，以`@earendil-works/pi-ai`的`TextContent`和`ImageContent`格式呈现。文本和图像内容直接通过，内嵌的文本和图像资源被解包，音频、资源链接和二进制资源则转换为简短的文本占位符。如果没有内容块但带有`structuredContent`，则结果以JSON格式呈现。

将MCP工具封装为`pi-agent-core` `AgentTool`：

```typescript
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { toLlmContent } from "@earendil-works/pi-mcp";
import { Type } from "typebox";

const tools: AgentTool[] = (await client.listTools()).map((tool) => ({
	// Providers allow at most 64 characters of [A-Za-z0-9_-].
	name: `mcp_${tool.name}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64),
	label: tool.title ?? tool.name,
	description: tool.description ?? tool.name,
	// Providers require an object schema, and some reject one without `properties`.
	parameters: Type.Unsafe({ ...tool.inputSchema, type: "object", properties: tool.inputSchema.properties ?? {} }),
	execute: async (_toolCallId, params, signal) => {
		const result = await client.callTool(tool.name, params as Record<string, unknown>, { signal });
		// MCP reports tool failures in the result instead of as a protocol error.
		return { content: toLlmContent(result), details: undefined, isError: result.isError === true };
	},
}));
```

[mcp-codemode示例](https://github.com/earendil-works/pi/tree/main/packages/agent/examples/mcp-codemode)同样会转发进度、传递`structuredContent`，并允许`@earendil-works/pi-codemode`脚本调用工具。

### OAuth

`@earendil-works/pi-mcp/oauth`提供了MCP OAuth客户端子集，且不依赖官方SDK：

```typescript
import { McpClient, StreamableHttpTransport } from "@earendil-works/pi-mcp";
import {
	adaptOAuthProvider,
	authorizeMcp,
	McpOAuthAuthorizationRequiredError,
	McpOAuthProvider,
	OAuthCallbackServer,
} from "@earendil-works/pi-mcp/oauth";

const serverUrl = "https://mcp.example.com/mcp";
const callback = await OAuthCallbackServer.listen();
let authorizationUrl: URL | undefined;
const oauth = new McpOAuthProvider({
	serverUrl,
	redirectUrl: callback.redirectUrl,
	clientMetadata: { client_name: "My MCP client" },
	onRedirect: (url) => {
		authorizationUrl = url;
	},
});

const connect = () => {
	const client = new McpClient({ name: "my-client", version: "1.0.0" });
	return {
		client,
		connected: client.connect(
			new StreamableHttpTransport({ url: serverUrl, authProvider: adaptOAuthProvider(oauth) }),
		),
	};
};

const first = connect();
try {
	await first.connected;
} catch (error) {
	if (!(error instanceof McpOAuthAuthorizationRequiredError)) throw error;
	const state = await oauth.state();
	const result = callback.waitForCallback(state);
	// Open authorizationUrl in the user's browser here.
	const { code } = await result;
	await authorizeMcp(oauth, { serverUrl, authorizationCode: code });
}

const { client, connected } = connect();
await connected;
```

将`McpOAuthStateStore`注入到`McpOAuthProvider`中以实现持久化凭证。该包不会打开浏览器，也不负责凭证的存储位置。

OAuth实现基于MIT许可的Model Context Protocol TypeScript SDK v1.29.0。其许可证内容位于`LICENSES/`。

一个MCP传输负责帧处理和I/O。它将独立的JSON-RPC消息传递给`McpClient`；客户端则负责请求关联、初始化、超时、取消、服务器请求及协议级辅助功能。

## 支持的协议范围

- MCP协议版本`2025-11-25`，支持协商`2025-06-18`、`2025-03-26`或`2024-11-05`
- 初始化和`notifications/initialized`
- ping
- 分页`tools/list`
- `tools/call`，包括结构化内容
- 进度通知和超时续期
- 请求取消
- 可流式HTTP会话，服务器到客户端的GET流支持重连，以及通过`Last-Event-ID`恢复已断开的响应流
- 按照规范执行stdio关闭（先关闭stdin，再SIGTERM，最后SIGKILL），应用于服务器整个进程组
- 服务器`ping`和`roots/list`请求
- 通过通用通知API实现日志和工具列表变更通知
- OAuth受保护资源和授权服务器发现
- PKCE授权码流程、动态客户端注册、令牌刷新（并发401共享一个刷新）、以及`insufficient_scope`的升级授权

批量JSON-RPC消息、传统HTTP+SSE、服务器、采样和任务等功能目前不在初始核心范围内。

## 测试

`@earendil-works/pi-mcp/testing`导出`createInMemoryTransportPair()`用于客户端和适配器测试。

