# 会话文件格式

会话以JSONL（JSON行）文件存储。每行是一个JSON对象，包含`type`字段。会话条目通过`id`/`parentId`字段形成树结构，从而实现就地分支，无需创建新文件。

有关程序化创建、持久化和树导航，请参见[`SessionManager` API](sdk.md#sessionmanager-api)。

## 文件位置

```
~/.pi/agent/sessions/--<path>--/<timestamp>_<session-id>.jsonl
```


默认情况下，`<session-id>`为UUID。调用方可通过SDK或`--session-id`提供自定义ID。对于`<path>`，Pi会移除前导路径分隔符，并将`/`、`\\`和`:`替换为`-`。

## 删除会话

会话可通过删除其`.jsonl`文件来删除，这些文件位于`~/.pi/agent/sessions/`下。

Pi还支持通过`/resume`（选择会话并按下`Ctrl+D`，然后确认）交互式删除会话。当可用时，pi会使用`trash` CLI避免永久删除。

## 会话版本

会话在头部包含一个版本字段：

- **版本1**：线性条目序列（遗留，加载时自动迁移）
- **版本2**：带`id`/`parentId`链接的树结构
- **版本3**：将`hookMessage`角色重命名为`custom`（扩展统一）

现有会话在加载时会自动迁移到当前版本（v3）。

## 源文件

源码托管在GitHub上（[pi](https://github.com/earendil-works/pi)）：

- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 会话条目类型和SessionManager
- [消息类型](message-types.md) - 共享消息和内容块引用
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts) - 扩展消息类型
- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts) - 基础消息和内容块类型
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/types.ts) - 可扩展的`AgentMessage`联合体

要在项目中使用TypeScript定义，请检查`node_modules/@earendil-works/pi-coding-agent/dist/`和`node_modules/@earendil-works/pi-ai/dist/`。

## 消息

一个`message`条目存储一个[`AgentMessage`](message-types.md)。消息内容块、角色、使用情况和消息时间戳在[消息类型](message-types.md)中定义。
会话条目的时间戳为ISO 8601字符串。嵌套消息的时间戳为毫秒级的Unix时间戳。

## 条目基础

除`SessionHeader`外，所有条目均继承自`SessionEntryBase`：

```typescript
interface SessionEntryBase {
  type: string;
  id: string;           // Usually an 8-char hex ID; may fall back to a full UUID
  parentId: string | null;  // Parent entry ID (null for a root entry)
  timestamp: string;    // ISO timestamp
}
```


## 条目类型

### 会话头

文件第一行。仅元数据，不属于树结构（无`id`/`parentId`）。

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project"}
```


对于具有父级的会话（通过`/fork`、`/clone`或`newSession({ parentSession })`创建）：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project","parentSession":"/path/to/original/session.jsonl"}
```


### 会话消息条目

对话中的消息。`message`字段包含一个`AgentMessage`。系统消息携带提示和工具加载：会话的第一个请求会持久化一个包含所有提示部分和工具声明的条目，后续更改以系统消息形式补丁`sections`（按名称，`null`移除一个）并列出`toolsAdded`/`toolsRemoved`。按顺序回放这些消息即可获得当前提示和工具；不存在单独的提示状态条目。

```json
{"type":"message","id":"a0b1c2d3","parentId":null,"timestamp":"2024-12-03T14:00:00.000Z","message":{"role":"system","content":"","sections":{"preamble":"You are an expert coding assistant...","tools":"<tools>\n- read: ...\n</tools>","cwd":"/project"},"toolsAdded":[{"name":"read","description":"...","parameters":{}}],"timestamp":1733234400000}}
{"type":"message","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:04:00.000Z","message":{"role":"system","content":"","sections":{"skills":"<skills>...</skills>"},"toolsRemoved":[{"name":"write"}],"timestamp":1733234640000}}
```


在系统消息存在之前创建的会话没有前置系统消息；第一个请求声明当前提示为后续系统消息，回放方式相同。

```json
{"type":"message","id":"a1b2c3d4","parentId":"prev1234","timestamp":"2024-12-03T14:00:01.000Z","message":{"role":"user","content":"Hello","timestamp":1733234401000}}
{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}],"api":"anthropic-messages","provider":"anthropic","model":"claude-sonnet-4-5","usage":{...},"stopReason":"stop","timestamp":1733234402000}}
{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2024-12-03T14:00:03.000Z","message":{"role":"toolResult","toolCallId":"call_123","toolName":"bash","content":[{"type":"text","text":"output"}],"isError":false,"timestamp":1733234403000}}
```


助手消息会注明生成它们的模型。较新的消息还会记录`thinkingLevel`，即为此响应请求的Pi思考级别。

### 模型变更条目

用户在会话中切换模型时发出。最新条目为所选模型，可能为[虚拟模型](virtual-models.md)；随后的助手消息会注明实际回答的物理模型。

```json
{"type":"model_change","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:05:00.000Z","provider":"openai","modelId":"gpt-4o"}
```


### 思考级别变更条目

用户更改思考/推理级别时发出。

```json
{"type":"thinking_level_change","id":"e5f6g7h8","parentId":"d4e5f6g7","timestamp":"2024-12-03T14:06:00.000Z","thinkingLevel":"high"}
```


### 使用条目

记录非助手消息且不参与LLM上下文的模型属性使用。`kind`为任意字符串，标识操作；例如，缓存预热使用`"cache_warm"`。

```json
{"type":"usage","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:08:00.000Z","kind":"cache_warm","provider":"anthropic","model":"claude-sonnet-4-5","usage":{"input":0,"output":0,"cacheRead":50000,"cacheWrite":0,"totalTokens":50000,"cost":{"input":0,"output":0,"cacheRead":0.015,"cacheWrite":0,"total":0.015}}}
```

使用条目会贡献会话令牌和成本总计。Pi会将它们隐藏在对话树中。消费者应将未知的`kind`值视为普通使用，而不是拒绝它们。

### 压缩条目

在上下文被压缩时创建。存储了早期消息的摘要和完整的系统提示/工具检查点。

```json
{"type":"compaction","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:10:00.000Z","summary":"User discussed X, Y, Z...","firstKeptEntryId":"c3d4e5f6","tokensBefore":50000,"systemMessage":{"role":"system","content":"You are a coding assistant.","toolsAdded":[],"timestamp":1733235000000}}
```

`firstKeptEntryId`是必需的。它标识了压缩条目之前保留的第一个条目。在重建上下文时，Pi会用压缩摘要替换较旧的汇总条目，并保留从该条目开始的范围。对于保留none的压缩，该字段会存储其自身的ID，因此不会保留任何前置条目。

可选字段：
- `systemMessage`：在压缩边界处重放的提示部分和工具声明；它会成为压缩后上下文的首个系统消息，压缩条目中保留的系统消息会为此让位。在较旧的会话条目中，该字段缺失。
- `usage`：生成摘要时的LLM使用量；包含在会话令牌和成本总计中
- `details`：实现特定的数据（例如，`{ readFiles: string[], modifiedFiles: string[] }`为默认值，或扩展的自定义数据）
- `fromHook`：`true`如果由扩展生成，`false`/`undefined`如果是pi生成（遗留字段名）

### ContextEditEntry

对先前产生上下文的单个条目进行只追加编辑。它只改变未来的模型上下文；目标条目及其元数据在原始历史、用户界面、导出和会话会计中保持不变。

```json
{"type":"context_edit","id":"g6h7i8j9","parentId":"f6g7h8i9","timestamp":"2024-12-03T14:11:00.000Z","targetId":"c3d4e5f6","replacement":null}
```

目标可以是用户、助手、工具结果或自定义消息条目。`replacement: null`会从模型上下文中省略目标。非空的`replacement`仅替换目标消息内容。对于助手和工具结果条目的字符串替换会被规范化为一个文本块，因为这些角色需要内容数组。如果多个编辑针对同一个条目，活跃分支上最新的编辑将胜出。编辑是分支相对的：导航到编辑之前的时间点会再次显示目标的原始贡献。

### BranchSummaryEntry

在通过`/tree`切换分支时创建，包含LLM生成的左分支摘要（截至共同祖先）。捕获废弃路径的上下文。
```json
{"type":"branch_summary","id":"g7h8i9j0","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:15:00.000Z","fromId":"f6g7h8i9","summary":"Branch explored approach A..."}
```


`parentId` 是新分支继续的入口。`fromId` 是之前被废弃路径的叶子节点摘要。

可选字段：
- `usage`：生成摘要的LLM使用情况；包含在会话令牌和成本总计中
- `details`：文件跟踪数据（`{ readFiles: string[], modifiedFiles: string[] }`）为默认值，或扩展的自定义数据
- `fromHook`：由扩展生成时为 `true`，由pi生成（遗留字段名称）时为 `false`/`undefined`

###  自定义条目

扩展状态持久化。不参与LLM上下文。

```json
{"type":"custom","id":"h8i9j0k1","parentId":"g7h8i9j0","timestamp":"2024-12-03T14:20:00.000Z","customType":"my-extension","data":{"count":42}}
```

使用 `customType` 在重载时标识扩展的条目。交互模式可通过 `pi.registerEntryRenderer(customType, renderer)` 渲染自定义条目，但它们仍然不参与LLM上下文。

Pi将[virtual model](virtual-models.md)路由器状态作为自定义条目存储，使用 `customType` `pi.virtual-model-state` 和 `data` `{ provider, modelId, state }`。

###  自定义消息条目

注入的扩展消息确实参与LLM上下文。

```json
{"type":"custom_message","id":"i9j0k1l2","parentId":"h8i9j0k1","timestamp":"2024-12-03T14:25:00.000Z","customType":"my-extension","content":"Injected context...","display":true}
```

字段：
- `content`：字符串或 `(TextContent | ImageContent)[]`（与UserMessage相同）
- `display`：`true` = 在TUI中以不同样式显示，`false` = 隐藏
- `details`：可选的扩展特定元数据（不发送给LLM）

###  标签条目

用户定义的条目书签/标记。

```json
{"type":"label","id":"j0k1l2m3","parentId":"i9j0k1l2","timestamp":"2024-12-03T14:30:00.000Z","targetId":"a1b2c3d4","label":"checkpoint-1"}
```

将 `label` 设置为 `undefined` 以清除标签。

###  会话信息条目

会话元数据（例如，用户定义的显示名称）。通过 `/name`、`--name` / `-n` 或 `pi.setSessionName()` 在扩展中设置。

```json
{"type":"session_info","id":"k1l2m3n4","parentId":"j0k1l2m3","timestamp":"2024-12-03T14:35:00.000Z","name":"Refactor auth module"}
```

当设置时，会话名称会显示在会话选择器（`/resume`）中，而不是第一条消息。

##  树结构

条目通常形成一棵树，但导航API可以创建多个根节点：
-  一个根条目具有 `parentId: null`；最初第一个条目是根节点
- 每个非根节点通过`parentId`指向其父节点  
- 分支操作会从早期节点创建出新的子节点  
- “叶子节点”表示树中的当前位置  
- 调用`resetLeaf()`或`branchWithSummary(null, ...)`可以让一个较晚的节点成为另一个根节点  

```
[user msg] ─── [assistant] ─── [user msg] ─── [assistant] ─┬─ [user msg] ← current leaf
                                                            │
                                                            └─ [branch_summary] ─── [user msg] ← alternate branch
```
  
## 上下文构建  

`buildContextEntries()`会从当前叶子节点向根节点移动，生成活动条目列表，同时遵守压缩规则：  

1. 收集路径上的所有条目  
2. 如果路径上存在一个或多个`CompactionEntry`值，则使用最新的一个：  
   - 优先包含压缩条目  
   - 包含来自`firstKeptEntryId`的非系统条目，直到但不包括压缩条目  
   - 包含压缩条目之后的条目  
3. 保持所选范围内非消息条目的完整性，以便交互模式能够渲染它们  

`buildSessionProjection()`然后对每个选定的目标应用最新的`context_edit`。它返回模型可见的消息及其源条目。被省略的目标不会产生消息；替换操作会保留源条目的角色和元数据，仅更改内容。原始选定条目不会被修改。  

`buildSessionContext()`在此投影基础上构建LLM的消息列表：  

1. 提取当前模型和思考层级设置，来自完整路径  
2. 将选定条目转换为消息：  
   - `message` -> 存储的`AgentMessage`  
   - `compaction` -> 完整系统快照后跟`compactionSummary`  
   - `branch_summary` -> `branchSummary`  
   - `custom_message` -> `CustomMessage`  
   - `context_edit` -> 无自身上下文消息  
   - `usage`和`custom` -> 无上下文消息  

压缩摘要会替换`firstKeptEntryId`之前的条目。压缩前的系统消息会被折叠进完整快照，而不是从保留范围内重播。保留的非系统条目和压缩条目之后的所有条目都可供LLM使用。  

## 解析示例  

```typescript
import { readFileSync } from "fs";

const lines = readFileSync("session.jsonl", "utf8").trim().split("\n");

for (const line of lines) {
  const entry = JSON.parse(line);

  switch (entry.type) {
    case "session":
      console.log(`Session v${entry.version ?? 1}: ${entry.id}`);
      break;
    case "message":
      console.log(`[${entry.id}] ${entry.message.role}: ${JSON.stringify(entry.message.content)}`);
      break;
    case "compaction":
      console.log(`[${entry.id}] Compaction: ${entry.tokensBefore} tokens summarized`);
      break;
    case "branch_summary":
      console.log(`[${entry.id}] Branch from ${entry.fromId}`);
      break;
    case "usage":
      console.log(`[${entry.id}] Usage (${entry.kind}): ${entry.usage.totalTokens} tokens`);
      break;
    case "custom":
      console.log(`[${entry.id}] Custom (${entry.customType}): ${JSON.stringify(entry.data)}`);
      break;
    case "custom_message":
      console.log(`[${entry.id}] Extension message (${entry.customType}): ${entry.content}`);
      break;
    case "label":
      console.log(`[${entry.id}] Label "${entry.label}" on ${entry.targetId}`);
      break;
    case "model_change":
      console.log(`[${entry.id}] Model: ${entry.provider}/${entry.modelId}`);
      break;
    case "thinking_level_change":
      console.log(`[${entry.id}] Thinking: ${entry.thinkingLevel}`);
      break;
  }
}
```


