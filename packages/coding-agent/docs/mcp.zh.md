# MCP 服务器

Pi 通过 stdio 或可流式 HTTP 连接到 [模型上下文协议](https://modelcontextprotocol.io) 服务器，并使模型能够访问其工具和资源。

## 快速设置

添加本地 stdio 服务器，检查连接，然后启动 Pi：

```bash
pi mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem .
pi mcp list
pi
```

对于远程服务器：

```bash
pi mcp add docs --url https://example.com/mcp --bearer-token-env-var DOCS_TOKEN
pi mcp list
```

这些命令默认以用户级方式添加服务器。若要将项目配置写入，可添加 `--local` 或 `-l`：

```bash
pi mcp add -l tools --env API_KEY='${TOOLS_KEY}' -- uvx tools-mcp
```

在交互式会话中使用 `/mcp` 检查连接、登录、重新连接、更改暴露或启用/禁用服务器。在会话外部添加、删除或更改服务器后，运行 `/reload`。

## 配置服务器

Pi 从 `~/.pi/agent/mcp.json` 读取用户级服务器，从 `.pi/mcp.json` 读取项目服务器。项目配置仅在授予 [项目信任](security.md#understand-project-trust) 后才读取。项目条目会替换同名的用户级条目。

没有 `command`、`url` 或 `type` 的项目条目，仅会覆盖用户级同名服务器的 `enabled`、`exposure` 和 `toolExposure`，其余部分（包括 `env`、`headers` 和 `auth`）保持不变。例如，这会关闭用户级服务器在某个项目中的启用状态：

```json
{
  "mcpServers": {
    "internal-tools": { "enabled": false }
  }
}
```

格式与其他 MCP 客户端一致：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "docs": {
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ${DOCS_TOKEN}" },
      "description": "Search and read the product documentation"
    }
  }
}
```

Stdio 服务器使用 `command`、`args`、`env` 和 `cwd`。相对 `cwd` 值相对于会话目录解析。`~/` 作为 `command`（参数）或 `cwd` 的前缀，表示家目录。

HTTP 服务器使用 `url`、`headers` 和 `oauth`（请参阅 [OAuth 认证](#authenticate-with-oauth)）。不支持旧版 SSE 传输。

两种服务器均支持：

- `timeout`：请求超时（秒），默认 60。进度通知会重置此值。
- `enabled: false`：保持条目但不连接。
- `exposure` 和 `toolExposure`：控制工具如何访问模型（请参阅 [控制工具暴露](#control-tool-exposure)）。
- `description`：服务器提供的内容，一句话概括。它在系统提示中列出服务器（见[控制工具暴露](#control-tool-exposure)），工具搜索根据它对服务器的工具进行排名，codemode的`describeNamespace()`也会返回它。如果没有它，服务器连接后会使用服务器说明的第一行。

将个人服务器和带凭证的服务器保留在用户级文件中。仅将项目所需的服务器保留在项目文件中，并且仅在受信任的项目中使用。

### 配置规则

- 服务器名称只能包含字母、数字、`_`和`-`。工具名称为`mcp__<server>__<tool>`，除字母、数字和`_`外的其他字符均替换为`_`；当服务器名称发生冲突时，所有工具都会附加一个哈希后缀。仅在`-`和`_`上不同的服务器名称被视为同一服务器：第二个被拒绝，`mcp.json`服务器会覆盖已注册的服务器。

- `type`是可选的。`command`选择stdio，`url`选择可流式HTTP。如果存在，`type`必须是`stdio`、`http`或`streamable-http`。

- `sse`被拒绝。经常提供SSE端点的服务器通常也提供可流式HTTP，通常在`/mcp`而不是`/sse`。

- `command`是一个可执行文件，`args`包含其参数。它不是shell命令字符串。

- `env`和`headers`的值可以使用环境变量如`${GITHUB_TOKEN}`。它们也可以运行`!command`命令，但命令必须构成整个值，例如`"Authorization": "!echo Bearer $(gh auth token)"`。

- 无效条目会被报告并跳过，但不会阻止其他服务器连接。

`pi mcp add`和`pi mcp remove`涵盖了shell中常见的更改。有关其选项，请参见[MCP命令](cli.md#mcp-commands)。

### 检查或更改服务器
`/mcp` 列出了已配置服务器的状态、工具数量、暴露状态和配置来源。需要关注的服务器会排在前面。选择一个服务器可以查看其工具和连接详情，重新连接，登录或注销，更改暴露状态，或启用/禁用该服务器。

暴露状态和启用状态的更改会被保存到定义该服务器的文件中，不会替换无关内容。在受信任的项目中，“仅在本项目中启用”和“仅在本项目中禁用”会为用户级服务器添加一个项目覆盖；之后对该服务器的更改会被保存到覆盖文件中。禁用的服务器仍会保留在列表中。在非交互式TUI环境下，`/mcp` 会打印服务器状态；`/mcp login <server>`、`/mcp logout <server>` 和 `/mcp reconnect <server>` 会直接执行这些操作。

Shell命令无需会话即可运行：`pi mcp add`、`pi mcp remove`、`pi mcp list`、`pi mcp login` 和 `pi mcp logout`。Shell命令不会加载扩展。

###  诊断连接问题

运行 `pi mcp list` 可以连接到所有已启用的服务器并打印其状态、工具和错误。当某个条目无效或已启用的服务器未连接时，它会以状态1退出。`/mcp` 会显示完整的连接错误和失败的stdio服务器stderr的末尾内容。

Pi在启动后会报告一次配置错误、连接失败和必需的登录。服务器日志通知会追加到 `~/.pi/agent/mcp.log` 中，作为 `<time> [<server>] <level> <logger>: <message>`。文件在超过5MB后会移动到 `mcp.log.1`。

Pi在会话启动时会在后台连接所有已启用的服务器。服务器连接后其工具才会显示；`codemode` 描述中不包含工具列表，因此服务器连接时不会改变。第一个提示符最多等待10秒，仅针对需要在请求中声明的 `direct` 工具服务器；其他服务器在需要时才会等待：codemode脚本会等待其命名的服务器（`mcp__<server>`），并在调用 `searchTools()` 或读取 `ALL_TOOLS` 时等待所有服务器；`tool_search` 和资源工具也会等待所有服务器。HTTP网络错误和瞬态状态（408、429和5xx）会重试两次。断开的连接会显示为已断开，下次调用时会重新连接。当服务器宣布工具列表变更时，新工具会被添加，已撤回的工具会变得不可达。

停止stdio服务器会关闭其stdin，发送SIGTERM，然后向其进程组发送SIGKILL。这也适用于通过如`npx`或`uvx`等包装器启动的服务器。

##  从另一个客户端迁移配置

将转换后的条目移动到 `mcpServers` 中的 `mcp.json`，然后运行 `pi mcp list` 进行验证。

| 客户端 | 转换方式 |
|---|---|
| Claude Desktop、Claude Code 或 Cursor | 复制现有的 `mcpServers` 条目。 |
| VS Code | 从顶级 `servers` 对象移动条目，并用 `${NAME}` 环境变量替换 `${input:...}` 提示。 |
| Codex | 将 `[mcp_servers.<name>]` TOML字段（如 `command`、`args`、`env` 和 `url`）转换为JSON。 |
| OpenCode | 将 `"type": "local"` 转换为stdio条目，将其 `command` 数组拆分为 `command` 和 `args`，将 `environment` 重命名为 `env`，并用 `${NAME}` 替换 `{env:NAME}`。将 `"type": "remote"` 转换为URL条目。 |

<a id="authenticate-with-oauth"></a>
##  OAuth认证

使用OAuth的远程服务器（如Sentry）无需在 `mcp.json` 中提供凭证：

```json
{
  "mcpServers": {
    "sentry": { "url": "https://mcp.sentry.dev/mcp" }
  }
}
```

当服务器拒绝未认证连接时，`/mcp` 会显示需要登录。选择“登录”，运行 `/mcp login sentry`，或运行 `pi mcp login sentry`。Pi会打开授权页面并等待批准。如果浏览器运行在另一台机器上（如通过SSH），请将重定向URL粘贴到登录界面。正在运行的会话会在下一次轮询时使用新凭证。

Pi会向授权服务器注册自身，将令牌存储在 `~/.pi/agent/mcp-auth.json` 中，并在令牌过期或服务器拒绝时刷新访问令牌。如果服务器后续请求额外权限，Pi会再次请求登录。注销会删除存储的凭证。

凭证属于服务器名称和URL。具有相同URL但不同名称的服务器（如每个账户一个）会单独登录；具有相同名称和URL且在不同 `mcp.json` 文件中的服务器会共享同一登录凭证。
OAuth适用于没有`Authorization`头部的HTTP服务器。对于不支持动态客户端注册的服务器，请配置已注册客户端：

```json
{
  "mcpServers": {
    "example": {
      "url": "https://mcp.example.com/mcp",
      "oauth": { "clientId": "my-client", "clientSecret": "${EXAMPLE_SECRET}", "callbackPort": 8765 }
    }
  }
}
```

重定向URI必须与注册的URI匹配。`callbackPort`使用`http://127.0.0.1:<port>/callback`。若要使用其他URI，请设置`callbackUrl`；它必须使用HTTP协议，协议为`localhost`、`127.0.0.1`或`[::1]`。Pi会将它原样发送。当`callbackUrl`省略端口时，Pi会使用`callbackPort`或一个空闲端口，并将其添加到URI中，这符合RFC 8252中对回环重定向的允许。`clientSecret`是可选的，可以使用环境变量或命令。

将`scope`设置为空格分隔的列表，用于那些没有声明所需作用域的服务器。否则，Pi会请求已声明的作用域。后续的作用域请求会添加到已配置的值中。

Pi注册为`pi`。有些服务器只接受来自已知客户端的注册。若要发送另一个名称，请设置`clientName`：

```json
{
  "mcpServers": {
    "figma": { "url": "https://mcp.figma.com/mcp", "oauth": { "clientName": "Claude Code" } }
  }
}
```

该名称仅在Pi注册客户端时发送。若要再次以新名称注册，请先注销。

有些授权服务器允许客户端通过Client ID元数据文档URL来识别，而不是注册它们。将`clientRegistration`设置为`cimd`，以标识Pi的文档（pi.dev）而不是注册：

```json
{
  "mcpServers": {
    "example": { "url": "https://mcp.example.com/mcp", "oauth": { "clientRegistration": "cimd" } }
  }
}
```

客户端ID为`https://pi.dev/oauth/client.json`，重定向URI为`http://127.0.0.1:<port>/callback`。如果授权服务器没有在授权响应中发送`iss`参数（RFC 9207），Pi会使用特定于MCP服务器的文档和重定向路径：`https://pi.dev/oauth/<id>/client.json`与`http://127.0.0.1:<port>/callback/<id>`。授权服务器必须声明支持Client ID元数据文档和公开客户端，否则登录会失败。`cimd`不能与`clientId`或`clientName`同时使用，并且`callbackUrl`必须使用`localhost`或`127.0.0.1`，路径为`/callback`。

Pi通过服务器的受保护资源元数据（RFC 9728）找到授权服务器，并检查授权服务器的元数据是否指定了预期的发行者（RFC 8414）。有些服务器会错误地广告授权服务器或根本不广告，因此登录会打开一个不存在的页面。将`authServerMetadataUrl`设置为正确授权服务器的元数据文档：

```json
{
  "mcpServers": {
    "example": {
      "url": "https://mcp.example.com/mcp",
      "oauth": { "authServerMetadataUrl": "https://example.okta.com/.well-known/openid-configuration" }
    }
  }
}
```

Pi会使用该文档而不是发现机制，并将其视为已配置的信任文档，因此请仅将其指向您信任的文档。URL必须使用HTTPS，除非在`localhost`、`127.0.0.1`或`[::1]`上。

<a id="control-tool-exposure"></a>
## 控制工具暴露

每个服务器工具都注册为`mcp__<server>__<tool>`。服务器的`exposure`决定了模型如何访问它：

| 暴露类型 | 行为 | 典型用途 |
|---|---|---|
| `codemode`（默认） | 可从[`codemode`](cli.md#tools)脚本中调用，但未向模型声明，也不在codemode描述中列出。脚本通过`searchTools()`、`describeTool()`或`ALL_TOOLS`查找工具。 | 通用MCP服务器，尤其是当脚本应组合或过滤调用时。 |
| `deferred` | 直到[`tool_search`](cli.md#tools)加载匹配项后才声明。 | 大型服务器，其工具应在发现后直接调用。 |
| `direct` | 像内置工具一样向模型声明，并且也可从codemode调用。 | 小型、频繁使用的工具集。 |
| `hidden` | 已注册但无法访问。 | 服务器或工具应保持不可用。 |

`codemode-deferred`可作为`codemode`的别名。

具有`codemode`或`deferred`工具的服务器会在系统提示的`mcp_servers`部分中列出，包括工具的访问方式和配置的`description`或连接后服务器说明中的一行。Pi会在提示开始时更新该部分，等待具有`direct`工具的服务器后添加。当它发生变化时（例如，服务器连接且摘要可用），Pi会将新部分附加到对话中，而不是更改工具声明，以保持早期消息缓存。`describeNamespace()`和`namespace`选项（`searchTools()`）接受`mcp__dev-radius`、`mcp__dev_radius`、`dev-radius`或`dev_radius`。
Pi 在检测到具有 `codemode` � 曝光的服务器连接时，会激活 `codemode`。对于具有 `deferred` 曝光的服务器，会激活 `tool_search`。若要使模型无需搜索即可看到工具，可给予 `direct` 曝光并配合 `toolExposure`。

`toolExposure` 会覆盖单个工具的服务器曝光。键值可以是服务器工具的精确名称或模式，其中 `*` 可匹配任意字符。精确名称优先于模式；在模式中，最先匹配的生效。具有 `hidden` 曝光的服务器只能暴露选定的工具：

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "exposure": "deferred",
      "toolExposure": {
        "search_code": "direct",
        "get_*": "codemode",
        "delete_*": "hidden"
      }
    }
  }
}
```

`pi mcp list` 用于标记那些曝光与服务器不一致的工具。在 `/mcp` 的工具视图中也会显示有效的曝光。

具有 `codemode` 或 `deferred` 曝光的工具可以通过两种间接方式访问：codemode 脚本可以调用它们，`tool_search` 也可以加载它们。codemode 调用不依赖于当前激活的工具集，因此在 `/tree`、恢复或分叉后仍保持可用。通过 `tool_search` 加载的工具会记录在转录中，并在该分支上保持声明。

若要在没有 MCP 服务器的情况下保持 `codemode` 活跃，可将 `"defaultTools": ["+codemode"]` 添加到 [settings](settings.md#tools)。为防止自动激活 codemode，可在 `"autoEnableCodemode": false` 旁设置 `mcpServers`。项目级值会覆盖用户级值。当 `codemode` 和 `tool_search` 均未激活且无法直接调用工具时，Pi 会发出一次警告。

超过 20 KB 的文本结果会在 `…N chars truncated…` 标记附近截取中间部分后传递给模型。完整文本会保存到一个临时文件中，文件名基于结果生成。codemode 脚本会收到完整结果，并可在返回模型前对其进行缩减。

codemode 脚本会接收到完整的 MCP `CallToolResult`，包括 `content`、`structuredContent` 和 `isError`。带有 `isError` 的结果会在脚本内解析，但对直接调用会作为错误报告。`image(result.content[0])` 会转发图像块。服务器指令不会包含在任何工具描述中；脚本可通过 `describeNamespace("mcp__<server>")` 读取它们，该命令也会返回服务器的工具名称。

##  使用资源

当连接的服务器提供 [资源](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) 时，Pi 会将 Codex 和 OpenCode 使用的资源工具添加进来：

-  `list_mcp_resources` 以 JSON 格式列出资源：`{ server?, resources: [{ server, uri, name, ... }], nextCursor? }`。配合 `server` 可列出一页资源；`cursor` 可继续列出下一页。若未使用 `server`，则会列出所有服务器上的所有资源。

-  `list_mcp_resource_templates` 列出服务器未直接列出的资源的 URI 模板。

-  `read_mcp_resource` 通过 `server` 和 `uri` 读取资源。文本以文本形式传递给模型，图像以图像形式传递。其他二进制资源会被保存到临时文件，模型会收到路径。脚本会收到 `{ server, uri, contents }`。

这些工具会覆盖所有已启用且未隐藏的服务器资源。其曝光范围为这些服务器中最宽的曝光：`direct`，其次是 `codemode` 或 `deferred`。工具结果中的资源链接会识别 `read_mcp_resource` 和服务器。

MCP 应用的资源（通过 `ui://` URI 或 `text/html;profile=mcp-app` 识别）会被省略，因为 Pi 不会渲染它们。资源图标也会被省略。

读取和列出资源时，若发生短暂 HTTP 错误（408、429 或 5xx），会重试一次。工具调用不会重试，因为服务器可能已执行过这些操作。

##  权限

所有 MCP 调用都会经过 Pi 的工具管道。扩展 `tool_call` 和 `tool_result` 的处理器（包括权限门）因此也适用于 MCP 工具。从 codemode 脚本发起的调用会携带 codemode 调用 ID（`parentToolCallId`）。

`pi.getAllTools()` 会报告每个服务器声明的注解：`readOnlyHint`、`destructiveHint`、`idempotentHint` 和 `openWorldHint`。权限扩展可利用这些提示决定哪些调用需要确认（详见 [工具曝光](extensions.md#tool-exposure)）。资源工具会被标记为只读。

##  扩展与 SDK

###  添加服务器

扩展可使用 `pi.registerMcpServer(name, config)` 为当前会话添加服务器，使用方式与 `mcpServers` 入口相同（详见 [扩展中的 MCP 服务器](extensions.md#mcp-servers)）。注册的服务器会像配置的服务器一样连接，并在 `/mcp` 中显示，扩展作为其来源。
更改启用状态或暴露设置仅适用于当前会话。名称相同的文件配置服务器优先，`/mcp` 列出了被覆盖的注册项。`pi mcp` shell 命令不会加载扩展，仅能看到文件配置的服务器。

###  替换内置的 MCP 支持
安装的扩展程序（例如 `pi-mcp-adapter`）注册 `/mcp`，会替换内置的 MCP 会话支持。因此 Pi 不会读取 `mcp.json` 或连接其服务器进行会话，`/mcp` 属于该扩展。移除该扩展即可恢复内置行为。若要禁用内置 MCP 支持而不使用替代方案，请在 `pi config` 的 Built-in 项下禁用 `mcp`，或在 [settings](settings.md#resources) 中设置 `"extensions": ["-builtin:mcp"]`。
注册 `codemode` 或 `tool_search` 的扩展会将同名的内置工具替换为该扩展。Shell 级别的 `pi mcp` 命令始终使用内置实现。

###  使用 SDK 的 MCP

SDK 会话不会加载内置扩展。将 MCP 扩展、`codemode` 服务器的 codemode 扩展以及 `deferred` 服务器的 tool-search 扩展添加到资源加载器中。详见 [Codemode 和 MCP](sdk.md#codemode-mcp)。

