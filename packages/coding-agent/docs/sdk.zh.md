# SDK

`@earendil-works/pi-coding-agent` 将 Pi 集成到 Node.js 或 Bun 进程中。它提供了直接的 TypeScript 访问权限，用于命令行应用程序所使用的代理、会话、工具、模型和资源。

使用 SDK 进行进程内 TypeScript 集成。如需语言无关或隔离的子进程，请参见 [CLI 集成](cli-integration.md)。

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();

try {
  await session.prompt("What files are in the current directory?");
  console.log(session.getLastAssistantText());
} finally {
  session.dispose();
}
```

此功能使用当前工作目录、发现的资源、存储的设置和配置的凭据。`prompt()` 在运行结束时解析。

[完整的最小示例](../examples/sdk/01-minimal.ts) 也支持文本事件流式传输。所有 [SDK 示例](../examples/sdk/) 均通过仓库进行类型检查。

<a id="session-management"></a>

##  会话生命周期

`createAgentSession()` 创建 `AgentSession`。会话拥有一个对话、其模型和工具、排队的消息、压缩状态和扩展运行时。

通过 `session.messages`、`session.model`、`session.thinkingLevel`、`session.systemPrompt` 和 `session.getActiveToolNames()` 读取当前状态。

`session.systemPrompt` 为只读，返回当前有效的系统提示，包括尚未发送到模型的更改。工具更改会在下一次请求前声明给模型。

<a id="sessionmanager-api"></a>

###  会话存储

会话默认持久化。`SessionManager` 拥有持久化或内存中的入口树，并跟踪其活跃的叶子节点。分支更改叶子节点而不删除废弃的分支。当 Pi 重建模型上下文时，管理器会选择活跃分支并应用压缩。

`SessionManager` 是已确认模型上下文的权威来源。通过构造包含这些条目的管理器来恢复外部历史记录。赋值 `session.agent.state.messages` 不会替换已持久化的上下文。

当主机不希望有会话文件时，使用内存管理器：

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});
```

参见已检查的 [会话示例](../examples/sdk/11-sessions.ts) 以了解如何创建、打开、继续、列出和分叉会话。[会话文件格式](session-format.md) 定义了持久化的 JSONL 协议，[消息类型](message-types.md) 定义了转录值。如需精确的方法和签名，请使用导出的 TypeScript 声明或 [`session-manager.ts`](../src/core/session-manager.ts)。

`cwd` 选择用于项目资源发现、上下文文件、会话分组和内置工具路径的工作区。显式传递它，当目标与 `process.cwd()` 不同时。

`session.dispose()` 中断活跃工作、使扩展上下文无效、断开与代理的连接并移除事件监听器。在会话不再需要时调用它。

`AgentSessionRuntime` 添加 `newSession()`、`switchSession()`、`fork()` 和 `importFromJsonl()`。每个操作都会替换活跃的 `AgentSession` 并为目标工作目录重建服务。

运行时替换后，订阅属于旧的 `AgentSession`，必须重新绑定。参见 [会话运行时示例](../examples/sdk/13-session-runtime.ts)。

##  提示

`prompt()` 处理扩展命令并在普通用户消息进入代理前展开基于文件的提示模板。对于已接受的代理运行，它在运行结束后解析，包括自动重试。

如果会话正在流式传输，发送提示时必须指定是否要引导当前运行或跟随它。调用 `prompt()` 且未做此选择将拒绝而非猜测。

引导消息在当前助手轮次及其工具调用之后进入。跟随消息在当前运行完成其待处理工作后进入。`steer()` 和 `followUp()` 直接暴露这些行为并返回 `"queued"`，如果输入被排队（包括在扩展转换后），或 `"handled"`，如果扩展消费了它。

`abort()` 停止活跃操作并等待会话空闲。`waitForIdle()` 等待但不中止。

##  订阅事件

在提示前订阅，当主机需要流式输出时：

```typescript
const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  await session.prompt("Explain this repository");
} finally {
  unsubscribe();
}
```

会话事件报告消息更新、工具执行、排队、压缩、重试和运行生命周期变化。

`message_end` 包含权威的已完成消息。`agent_end` 标记了一个低级代理运行的结束，但自动恢复或排队的工作仍可能跟随。

使用 `agent_settled` 以通知主机 Pi 不会自动继续。

##  配置会话
如果没有覆盖项，工厂会创建 `ModelRuntime`、基于文件的 `SettingsManager`、持久化的 `SessionManager`、`DefaultResourceLoader` 以及配置的默认工具。

每个边界都可以显式提供：

- `modelRuntime`、`model`、`thinkingLevel` 和 `scopedModels` 负责控制模型访问和选择。
- `settingsManager` 提供合并的设置或内存配置。
- `sessionManager` 提供持久化或内存对话历史。
- `resourceLoader` 提供扩展、技能、提示模板、主题和上下文文件。
- `tools`、`noTools`、`excludeTools` 和 `customTools` 负责控制活动工具集。

当你需要标准发现并带有选定覆盖项时，使用 `DefaultResourceLoader`。如果主机完全拥有资源存储和发现，提供自定义的 `ResourceLoader`。

<a id="inlineextension"></a>
内联扩展工厂可以通过 `DefaultResourceLoader` 提供。仅当需要在诊断和启动输出中提供稳定名称时，才给一个 `InlineExtension` 命名。具有 `replaceable: true` 名称的命名内联扩展，当另一个扩展在加载时注册工具、命令或标志时，会跳过该扩展，而不是两者都因冲突而加载。CLI 的内置 codemode、工具搜索和 MCP 扩展均可替换。一个命名条目 with `builtin: true` 不是内联扩展：它提供 `builtin:<name>` 扩展的代码，该扩展像已配置的扩展文件一样加载。它默认加载，列在 `pi config` 中，并由 `-builtin:<name>` 禁用 在 `extensions` 设置或由 `noExtensions` 指定；`additionalExtensionPaths: ["builtin:<name>"]` 显式加载它。它在项目信任解析完成后加载，因此无法处理 `project_trust`。CLI 的内置扩展使用它。
<a id="codemode-mcp"></a>

命令行界面（CLI）加载了`codemode`、`tool_search`和MCP作为内置扩展。SDK会话不加载这些扩展；请将`createCodemodeExtension()`、`createToolSearchExtension()`和`createMcpExtension()`添加到`extensionFactories`的`DefaultResourceLoader`中。`codemode`和`tool_search`已注册为非活动状态：可以通过`defaultTools`设置启用它们（`["+codemode", "+tool_search"]`保持其他默认工具不变），或者让MCP扩展自动激活它们：对于具有`codemode`暴露的服务器使用`codemode`，对于具有`deferred`暴露的服务器使用`tool_search`。MCP扩展将其服务器连接到`session_start`，因此请调用`session.bindExtensions()`。详见[Codemode和MCP](../examples/sdk/14-codemode-mcp.ts)。
请参阅以下示例中的 [模型](../examples/sdk/02-custom-model.ts)、[工具](../examples/sdk/05-tools.ts)、[扩展](../examples/sdk/06-extensions.ts) 和 [完整控制](../examples/sdk/12-full-control.ts)。

## 示例

| 示例 | 目的 |
|---|---|
| [最小化](../examples/sdk/01-minimal.ts) | 创建、提示、观察和处置会话 |
| [自定义模型](../examples/sdk/02-custom-model.ts) | 选择模型和思考级别 |
| [系统提示](../examples/sdk/03-custom-prompt.ts) | 替换或追加系统提示 |
| [技能](../examples/sdk/04-skills.ts) | 发现、过滤和添加技能 |
| [工具](../examples/sdk/05-tools.ts) | 选择内置工具及其工作目录 |
| [扩展](../examples/sdk/06-extensions.ts) | 加载基于文件和内联的扩展 |
| [上下文文件](../examples/sdk/07-context-files.ts) | 添加或替换项目说明 |
| [提示模板](../examples/sdk/08-prompt-templates.ts) | 添加文件式提示模板 |
| [凭证](../examples/sdk/09-api-keys-and-oauth.ts) | 配置凭证和模型存储 |
| [设置](../examples/sdk/10-settings.ts) | 提供基于文件或内存的设置 |
| [会话](../examples/sdk/11-sessions.ts) | 控制会话持久性和恢复 |
| [完整控制](../examples/sdk/12-full-control.ts) | 替换默认的发现和状态服务 |
| [会话运行时](../examples/sdk/13-session-runtime.ts) | 安全替换活动会话 |
| [代码模式和MCP](../examples/sdk/14-codemode-mcp.ts) | 添加 `codemode`、`tool_search` 和 MCP 扩展 |

<a id="exports">和 </a>

## 资源

- [选择模型](models.md) 覆盖模型选择和兼容端点；[提供者](providers.md) 覆盖凭证和提供者特定的设置。
- [配置](configuration.md) 解释常规发现和设置；[设置](settings.md) 列出所有设置。
- [会话和上下文](sessions.md) 解释会话行为；[会话格式](session-format.md) 定义持久化条目；[消息类型](message-types.md) 定义共享转录值。
- [扩展](extensions.md)、[技能](skills.md)和[提示模板](prompt-templates.md)文档资源通过`ResourceLoader`提供。
- [命令行集成](cli-integration.md)涵盖了打印、JSON和RPC替代方案，用于替代进程内SDK集成。

