# 扩展

扩展是 TypeScript 模块，用于为 Pi 添加可执行行为。在工作流需要工具、命令、事件处理器、模型提供者、会话状态或终端用户界面，而不是仅使用指令时，使用扩展。

扩展在 Pi 进程内运行，具有相同的系统权限。它可以检查提示、工具调用、文件、凭据和会话历史，因此仅从可信赖的来源加载扩展。

典型的扩展会添加一个代理工具、保护路径、确认危险命令、响应会话事件、修改上下文、暴露命令或显示持久状态。

<a id="quick-start"></a>
<a id="writing-an-extension"></a>
<a id="create-an-extension"></a>

## 创建和加载扩展

扩展导出一个默认工厂，接收 `ExtensionAPI`。工厂为当前扩展运行时注册能力。

创建 `~/.pi/agent/extensions/hello.ts`：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Show a greeting",
    handler: async (name, ctx) => {
      ctx.ui.notify(`Hello, ${name || "world"}!`, "info");
    },
  });
}
```

启动 Pi 并运行 `/hello`。开发时，可直接加载文件：

```bash
pi --extension ./hello.ts
```

Pi 使用 `jiti`，因此本地 TypeScript 扩展无需单独编译步骤。使用 [Pi 包](packages.md) 进行分发扩展和依赖项。

<a id="extension-locations"></a>
<a id="available-imports"></a>
<a id="choose-where-it-loads"></a>

## 将其添加到 Pi

将扩展放入用户或项目扩展目录。Pi 可直接加载 TypeScript 或 JavaScript 文件，以及包含 `index.ts` 或 `index.js` 入口点的子目录。

小型扩展可使用单个文件，多文件实现则使用目录。npm 依赖项放在附近的 `package.json`。有关约定位置，请参阅 [配置](configuration.md)，有关附加路径，请参阅 [设置](settings.md#resources)。

重新加载会替换扩展运行时，因此 `await ctx.reload()` 之后的代码不得重用旧运行时的状态。只有个人和显式的命令行扩展才能参与 `project_trust` 事件，该事件在项目扩展加载前运行。

<a id="understand-the-lifecycle"></a>

## 尊重运行时生命周期

工厂可以是同步的也可以是异步的。Pi 在启动前会等待异步工厂，以便其获取配置或注册启动时所需的提供者。

不要在工厂中启动进程、套接字、监视器或计时器，因为某些调用会加载扩展而不会启动会话。
从 `session_start` 或需要它们的命令/工具启动长生命周期资源。
从幂等的 `session_shutdown` 处理器关闭会话范围资源。

运行从输入和 `before_agent_start` 开始，经过模型、消息和工具事件，到达 `agent_end`。
自动重试、恢复、压缩或排队工作可在之后继续。

<a id="agent_start--agent_end--agent_before_settle--agent_settled"></a>

`agent_before_settle` 是最终的可执行边界：它可以追加条目并请求一次延续。
`agent_settled` 是最终且仅用于通知的；在集成需要知道 Pi 不会自动继续时使用。

<a id="extensionapi-methods"></a>

## 选择集成点

| 能力                           | 主要 API                       |
|-------------------------------|-------------------------------|
| 观察或修改生命周期行为         | `pi.on()`              |
| 添加模型调用操作               | `pi.registerTool()`              |
| 添加 `/` 命令     | `pi.registerCommand()`              |
| 添加快捷方式或 CLI 标志        | `pi.registerShortcut()` 或 `pi.registerFlag()` |
| 发送用户或自定义消息           | `pi.sendUserMessage()` 或 `pi.sendMessage()` |
| 持久化非上下文会话数据         | `pi.appendEntry()`              |
| 更改活动工具、模型或思考级别   | `pi` 上的会话控制方法 |
| 添加模型提供者                 | `pi.registerProvider()`              |
| 添加 MCP 服务器                | `pi.registerMcpServer()`              |
| 将每个请求路由到模型           | [`pi.registerVirtualModel()`](virtual-models.md) |
| 添加终端渲染                   | 渲染器注册和 `ctx.ui`   |
| 与其他扩展通信                 | `pi.events`              |

使用 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) 导出的声明，获取确切的事件、上下文、工具和结果类型。

## 遵循扩展契约

<a id="events"></a>
<a id="work-with-events"></a>

### 事件和并发

处理器按扩展加载和注册顺序运行。`pi.on()` 返回一个取消该注册的函数；更改不会影响已进行中的分发。
一些事件进行通知；另一些事件则会转换数据、替换结果或取消操作。

应使用每个事件声明的结果类型，而不是假设每个返回值都会产生影响。

事件涵盖资源发现、会话、代理和消息生命周期、提供者、工具以及原始输入等内容。

`before_agent_start` 会同时暴露当前提示及其结构化的 `systemPromptOptions`。建议更改提示的某些部分、所选工具或指南，以便 Pi 可以追加事务变更量。返回 `systemPrompt` 或设置 `forceSystemPrompt` 会替换该次运行的完整提示，而事务记录仍会继续捕获结构化部分。提供者会将强制文本作为其引导系统提示接收。

`message_end` 可以替换已确认的消息同时保留其角色。`tool_call` 可以变异输入或阻止执行。`tool_result` 处理器会进行组合，每个处理器都能看到之前的变更。

<a id="provider_stream_event"></a>

`provider_stream_event` 会在 Pi 归一化每个解析的提供者流事件之前触发。该事件会标识提供者、API 和模型；`event.data` 是 Pi 可用的最早结构化值，不一定是原始 HTTP 字节或 SSE 帧。应将其视为只读，因为变异可能会影响归一化。该事件仅为通知，不会持久化。

处理器会按流顺序等待，因此慢处理器会延迟流消费。处理器错误会报告，但不会改变提供者响应。有关将原始事件按助手消息分组的选入式查看器，请参见 [`debug-provider.ts`](../examples/extensions/debug-provider.ts)。

<a id="context_with_system"></a>

`context` 会转换对话消息，不包括提示和工具系统消息；Pi 会在之后恢复该状态。仅在请求局部转换必须拥有完整事务记录时才使用 `context_with_system`，并且要保持系统消息在索引零的位置。

`turn_end` 和 `agent_before_settle` 是可执行边界。其处理器可以链接提议的 `custom`、`custom_message`、`context_edit` 或 `compaction` 条目，并返回 `continue: true` 以供下一次模型请求使用。应保护继续条件，因为无条件继续可能导致循环。使用导出的事件声明以获取完整验证和排序契约。

<a id="cache_warming_decision"></a>

`cache_warming_decision` 可以通过 `{ action: "warm" }` 或 `{ action: "stop" }` 覆盖空闲提示缓存刷新。最后返回动作的处理器会胜出。

一个助手消息中的工具调用可以并行运行。
不要假设另一个工具事件运行时会存在兄弟调用或结果。
使用 `ctx.signal` 处理嵌套工作，该工作由活跃的轮次拥有；命令和空闲会话事件通常没有操作信号。

一个返回 `undefined` 的 `user_bash` 处理器会将命令传递给下一个处理器，然后在没有处理器处理该命令时传递给本地执行。返回 `operations` 或 `result` 会阻止传播。处理器失败会阻塞命令，而不是继续传递给本地执行。

<a id="custom-tools"></a>
<a id="register-tools"></a>

###  工具

自定义工具需要定义名称、面向模型的描述、TypeBox 参数模式以及 `execute()` 函数。
其结果需要面向模型的 `content` 和一个 `details` 字段，用于渲染或状态重建。
如果没有任何结构化细节，则使用 `details: undefined`。
如果工具进行了嵌套模型调用，请将它们的 `usage` 包含在结果中，以便会话总数保持准确。

从 `execute()` 抛出异常以生成失败的工具结果。
返回对象不会将其标记为错误。
仅在该批次中的每个完成工具都同意终止后，代理应跳过其自动后续操作时才返回 `terminate: true`。

工具共享可变内存状态时应采用顺序执行。
文件修改工具应使用 `withFileMutationQueue()` 包裹完整的读-改-写操作。
截断大型面向模型的结果，并告知模型从何处读取完整输出。
声明 `outputSchema`，当结果为数据时返回匹配的 `structuredContent`。模型仍接收 `content`；程序调用方（如 codemode 脚本）接收 `structuredContent` 而非文本。没有 `outputSchema` 的工具会将其文本内容传递给脚本。若报告失败但仍携带数据，返回结果时使用 `isError: true` 而非抛出异常：模型识别到错误，脚本仍接收 `structuredContent`。

工具可以使用 `ctx.executeTool(name, args, { signal, onUpdate })` 运行其他工具。嵌套调用会经过参数验证，并触发 `tool_call` 和 `tool_result` 处理器（如同模型发出的调用），并发出 `tool_execution_start`、`tool_execution_update` 和 `tool_execution_end`；所有这些事件均携带 `parentToolCallId`，其 `toolCallId` 由 pi 分配为 `<parent id>/<n>`。这些 ID 不会出现在会话记录的工具调用或结果中。嵌套调用不会增加会话记录条目：其结果仅到达调用工具，由其自行报告，例如通过 `onUpdate` 和 `details`。会话会为它们维护一个有界的记录（名称、参数、状态、持续时间、错误；从不包含结果）作为 `nestedCalls`，记录在调用工具的结果消息中。该记录用于压缩文件列表，并在 HTML 导出中显示。单次调用参数超过 8 KiB 或单次工具结果超过 32 KiB 会被省略，最多保留 256 次调用，`complete: false` 标记丢失内容的记录。嵌套结果的 `usage` 会累加到调用工具结果的 `usage` 中，因此工具仅报告自身使用情况，而非其所调用工具的使用情况。`ctx.tools` 列出了 `ctx.executeTool()` 可调用的工具。`tool_result` 处理器若需屏蔽 `content`，也应替换 `structuredContent`；仅替换 `content` 则会将其移除。

详见 [`hello.ts`](../examples/extensions/hello.ts)、[`todo.ts`](../examples/extensions/todo.ts)、[`dynamic-tools.ts`](../examples/extensions/dynamic-tools.ts) 和 [`truncated-tool.ts`](../examples/extensions/truncated-tool.ts)。

###  工具暴露

`exposure` 控制模型如何访问工具。“可调用”指可通过 `ctx.executeTool()`（`ctx.tools`）从其他工具调用，如同 `codemode` 工具的脚本所示：

-   
`direct`（默认）：在激活期间向模型声明，且在激活期间可调用。  
-   
`model-only`：在激活期间向模型声明，但不可调用。用于编排其他工具或向用户提问的工具。  
-   
`codemode`：注册后任何时候均可调用，并被 `codemode` 工具列出。除非显式激活，否则不会向模型声明。  
-   
`deferred`：与 `codemode` 类似，但 codemode 工具不会列出它；`tool_search` 可查找并激活它。  
-   
`hidden`：已注册但不可达。通过 `exposure: "hidden"` 重新注册工具可撤销它，因为工具无法取消注册。

`namespace: { name, description, instructions }` 用于将相关工具分组，如同 MCP 服务器的做法。codemode 工具在其标题下列出一个命名空间及其 `description`。`instructions` 包含更详细的使用说明；它不会被列出，codemode 脚本通过 `describeNamespace(name)` 读取它。

注册 `direct` 或 `model-only` 工具即激活它；其他暴露方式在注册时不激活。活动工具集（`pi.getActiveTools()`、`pi.setActiveTools()`）是向模型声明的工具集合。`pi.getAllTools()` 会报告每个工具的 `exposure`、`namespace` 和 `annotations`。

`annotations` 是关于工具功能的提示，含义与 MCP 工具注解一致：`readOnlyHint`、`destructiveHint`、`idempotentHint` 和 `openWorldHint`。MCP 工具会携带其服务器声明的提示。缺失提示则采用 MCP 默认值：工具非只读，可能具有破坏性且可访问开放世界。提示不经过验证，但权限扩展可利用它们决定哪些调用需要确认。这确认了 Codex 请求批准的调用：

```typescript
pi.on("tool_call", async (event, ctx) => {
  const hints = pi.getAllTools().find((tool) => tool.name === event.toolName)?.annotations;
  const needsApproval =
    hints?.destructiveHint === true ||
    (!hints?.readOnlyHint && ((hints?.destructiveHint ?? true) || (hints?.openWorldHint ?? true)));
  if (needsApproval && !(await ctx.ui.confirm("Allow tool call?", event.toolName))) {
    return { block: true, reason: `${event.toolName} was not approved` };
  }
});
```

一个用于调度其他工具的工具，可以在其运行期间调整模型所见内容，使用`prepareLoadout(loadout)`。它在活动工具发生变化时运行，接收已声明的工具、可调用的工具以及所有注册工具及其暴露和命名空间。它返回已声明工具（包括自身）的替换项`descriptions`，并返回`hiddenDeclarations`：活动工具中声明请求中省略的可调用工具。`codemode`仅使用此钩子`exposure`和`ctx.executeTool()`，因此另一个工具可以在不同名称下实现相同行为。

### 动态激活工具

首先注册所有工具，可选工具保持非活动状态，然后使用加载工具中的`pi.setActiveTools()`选择所需的活动工具。名称必须已注册；未知名称将被忽略。

Pi在日志第一条系统消息中记录初始提示和工具集，然后在下一次模型请求之前追加工具和提示的更改。无法表示转换的提供者将收到完整的日志检查点，这可能会使缓存的前缀失效。

### 工具渲染

工具的`renderCall`和`renderResult`会在交互式日志和HTML导出中绘制其调用。`pi.registerToolRenderer((toolName, next) => renderers)`为任何工具选择渲染器，包括尚未注册的工具，例如恢复会话中服务器尚未连接的MCP工具。`next()`返回剩余解析器（按扩展加载顺序）以及已注册工具将使用的内容，因此`next() ?? mine`仅负责填充。

### MCP服务器

`pi.registerMcpServer(name, config)`为当前会话添加一个MCP服务器。`config`的结构类似于`mcpServers`在[`mcp.json`](mcp.md)中的`command`、`args`、`env`和`cwd`（用于stdio服务器），以及`url`、`headers`和`oauth`（用于HTTP服务器），再加上`exposure`、`toolExposure`、`description`、`enabled`和`timeout`。

```typescript
pi.registerMcpServer("jira", { url: "https://mcp.example.com/jira", exposure: "codemode" });
pi.unregisterMcpServer("jira");
```

在扩展加载期间注册的服务器在会话开始时连接，与`mcp.json`服务器一起；稍后注册的服务器会立即连接，`pi.unregisterMcpServer()`会关闭连接并使服务器的工具不可达。注册不会保存：每次加载时都需要重新注册，例如基于扩展自身的设置。`mcp.json`中具有相同名称的服务器优先级更高，`/mcp`会显示覆盖情况。再次注册相同名称会替换扩展先前的注册；由其他扩展注册的名称、无效名称和无效配置将引发错误。
内置的MCP支持连接已注册的服务器。当没有连接时，因为另一个扩展替换了它（见[MCP](mcp.md#other-mcp-extensions)），每个注册都会报告为扩展错误。其他MCP扩展也可以连接已注册的服务器：使用`pi.getMcpServers()`读取`session_start`，并处理`mcp_servers_change`事件以应对后续更改。

<a id="extensioncontext"></a>
<a id="extensioncommandcontext"></a>
<a id="use-extension-context"></a>

### 上下文和会话更改

`ExtensionContext`提供工作目录、模式、用户界面、会话管理器、模型运行时、中止信号、上下文使用情况以及压缩和关闭的控制。
使用`ctx.modelRegistry.streamSimple()`进行提供者无关的嵌套模型调用。

命令处理器接收`ExtensionCommandContext`，该操作增加了等待空闲、重新加载、树导航和会话替换的功能。
这些操作是命令专用的，因为从生命周期处理器调用它们可能会导致运行时死锁。

会话替换会使得旧的上下文失效。在切换之前，仅捕获普通数据，然后使用提供给`withSession`的新上下文进行与会话绑定的工作。

<a id="state-management"></a>
<a id="persist-state"></a>

### 状态

根据状态在对话中的参与方式选择存储方式：

| 状态 | 存储 |
|---|---|
| 随着活动分支变化的工具状态 | 工具结果`details` |
| 从模型上下文中排除的持久化数据 | `pi.appendEntry()` |
| 存储并发送给模型的自定义内容 | `pi.sendMessage()` |
| 跨越多个会话的数据 | 外部存储 |

在`session_start`期间，从`ctx.sessionManager.getBranch()`中重建分支敏感状态。
不要从每个文件条目重建，因为废弃的分支代表了替代的历史。
注册一个条目或消息渲染器，以便自定义存储的内容能够在转录中显示。

<a id="custom-ui"></a>
<a id="mode-behavior"></a>
<a id="interact-with-the-user"></a>
<a id="account-for-each-mode"></a>

### UI和模式

`ctx.ui`提供对话框、通知、状态文本、小部件、标题、编辑器访问和自定义组件。
仅在交互需要独立渲染和输入时使用`ctx.ui.custom()`。
有关组件、焦点、叠加层、主题和性能的指导，请参见[终端UI](tui.md)。

扩展程序在交互式、RPC、JSON和打印模式下加载。
交互模式提供完整的终端UI。
RPC可以通过[RPC扩展UI协议](rpc-extension-ui.md)转发支持的对话框和通知，但不支持自定义终端组件；JSON和打印模式没有UI。
使用`ctx.mode === "tui"`保护仅终端的行为，并使用`ctx.hasUI`处理交互式和RPC客户端支持的交互。

保持工具和事件行为与渲染独立，以便非交互模式仍能正常工作。

<a id="error-handling"></a>
<a id="handle-errors-and-shutdown"></a>

### 错误和清理

Pi会报告处理错误并尽可能继续。`tool_call`处理程序失败会阻止工具作为安全措施；工具执行失败会成为模型的错误结果。

即使尝试正常操作，`session_shutdown`也会释放资源。
保持清理操作幂等，因为取消、重新加载、会话替换和进程退出可能会收敛到同一条路径。
使用`ctx.shutdown()`请求有序进程关闭。

<a id="examples-reference"></a>
<a id="use-examples-as-the-implementation-reference"></a>

## 示例和参考

已检查的[扩展示例](../examples/extensions/)涵盖了工具、生命周期事件、命令、标志、快捷键、状态、渲染、提供者、OAuth、远程执行和终端组件。
从与您的集成点最匹配的最小示例开始。

使用[自定义提供者](custom-provider.md)进行模型-服务集成，使用[终端UI](tui.md)进行自定义组件，使用[Pi包](packages.md)安装或分发扩展及其他资源。

