# SDK 示例

通过 `createAgentSession()` 和 `createAgentSessionRuntime()` 程序化使用 pi-coding-agent。

运行时示例展示了如何构建一个闭包函数，该函数捕获全局固定输入并重建与当前活动会话 cwd 绑定的服务和会话。

## 示例

| 文件 | 描述 |
|------|-------------|
| `01-minimal.ts` | 最简单的用法，使用所有默认值 |
| `02-custom-model.ts` | 选择模型和思考级别 |
| `03-custom-prompt.ts` | 替换或修改系统提示 |
| `04-skills.ts` | 发现、过滤或替换技能 |
| `05-tools.ts` | 内置工具允许列表 |
| `06-extensions.ts` | 日志记录、阻断、结果修改 |
| `07-context-files.ts` | AGENTS.md 上下文文件 |
| `08-prompt-templates.ts` | 基于文件的提示模板 |
| `09-api-keys-and-oauth.ts` | API 密钥解析、OAuth 配置 |
| `10-settings.ts` | 覆盖压缩、重试、终端设置 |
| `11-sessions.ts` | 内存中、持久化、继续、列出会话 |
| `12-full-control.ts` | 替换一切，不进行发现 |
| `13-session-runtime.ts` | 管理运行时支持的会话替换 |
| `14-codemode-mcp.ts` | 添加 `codemode`、`tool_search` 和 MCP 扩展 |

## 运行

```bash
cd packages/coding-agent
node examples/sdk/01-minimal.ts
```

## 快速参考

```typescript
import { getModel } from "@earendil-works/pi-ai";
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

// Minimal
const { session } = await createAgentSession({ modelRuntime });

// Custom model
const model = getModel("anthropic", "claude-opus-4-5");
const { session } = await createAgentSession({ model, thinkingLevel: "high", modelRuntime });

// Modify prompt
const loader = new DefaultResourceLoader({
  systemPromptOverride: (base) => `${base}\n\nBe concise.`,
});
await loader.reload();
const { session } = await createAgentSession({ resourceLoader: loader, modelRuntime });

// Read-only
const { session } = await createAgentSession({ tools: ["read", "grep", "find", "ls"], modelRuntime });

// In-memory
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});

// Full control
const customRuntime = await ModelRuntime.create({
  authPath: "/my/app/auth.json",
  modelsPath: "/my/app/models.json",
});
await customRuntime.setRuntimeApiKey("anthropic", process.env.MY_KEY!);

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => "You are helpful.",
  extensionFactories: [myExtension],
  skillsOverride: () => ({ skills: [], diagnostics: [] }),
  agentsFilesOverride: () => ({ agentsFiles: [] }),
  promptsOverride: () => ({ prompts: [], diagnostics: [] }),
});
await resourceLoader.reload();

const { session } = await createAgentSession({
  model,
  modelRuntime: customRuntime,
  resourceLoader,
  tools: ["read", "bash", "my_tool"],
  customTools: [myTool],
  sessionManager: SessionManager.inMemory(),
  settingsManager: SettingsManager.inMemory(),
});

// Run prompts
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});
await session.prompt("Hello");
```

## 选项

| 选项 | 默认值 | 描述 |
|--------|---------|-------------|
| `modelRuntime` | 使用 `agentDir/auth.json` 和 `models.json` 的运行时 | 标准模型和身份验证运行时 |
| `cwd` | `process.cwd()` | 工作目录 |
| `agentDir` | `~/.pi/agent` | 配置目录 |
| `model` | 从设置/第一个可用项 | 使用的模型 |
| `thinkingLevel` | 从设置/"off" | 关闭、低、中、高 |
| `tools` | `["read", "bash", "edit", "write"]` 内置工具 | 跨内置、扩展和自定义工具的工具名称允许列表 |
| `customTools` | `[]` | 额外的工具定义 |
| `resourceLoader` | DefaultResourceLoader | 用于扩展、技能、提示、主题和上下文文件的资源加载器 |
| `sessionManager` | `SessionManager.create(cwd)` | 持久化 |
| `settingsManager` | `SettingsManager.create(cwd, agentDir)` | 设置覆盖 |

## 事件

```typescript
session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;
    case "tool_execution_start":
      console.log(`Tool: ${event.toolName}`);
      break;
    case "tool_execution_end":
      console.log(`Result: ${event.result}`);
      break;
    case "agent_settled":
      console.log("Done");
      break;
  }
});
```


