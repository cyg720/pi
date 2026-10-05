# 压缩参考

本参考描述了自动压缩、分支摘要、持久化条目和扩展钩子。有关用户工作流，请参见 [会话和上下文](sessions.md#manage-conversation-context)。

**源文件** ([pi](https://github.com/earendil-works/pi))：

- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - 自动压缩逻辑  
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - 分支摘要  
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - 公共实用工具（文件跟踪、序列化）  
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 条目类型（`CompactionEntry`，`BranchSummaryEntry`）  
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) - 扩展事件类型

要在项目中使用 TypeScript 定义，请检查 `node_modules/@earendil-works/pi-coding-agent/dist/`。

## 概述

Pi 具有两个摘要机制：

| 机制       | 触发条件                   | 目的                     |
|------------|----------------------------|--------------------------|
| 压缩       | 上下文超过阈值，或 `/compact` | 将旧消息摘要化以释放上下文 |
| 分支摘要    | `/tree` 导航       | 切换分支时保留上下文     |

两者均使用结构化格式，并累计跟踪文件操作。摘要请求会禁用 prompt-cache 写入，因为这些一次性提示不太可能被重复使用。

## 压缩

### 触发时机

自动压缩在以下情况下触发：

```
contextTokens > contextWindow - reserveTokens
```
  
默认情况下，`reserveTokens` 为 16384 个标记（可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）。这为 LLM 的响应留出空间。

在多轮代理运行期间，Pi 会在工具执行完毕且结果追加后，检查工具完成后的规范投影上下文，然后开始下一个助手响应。如果阈值被超过，Pi 会在 `prepareNextTurn` 期间进行压缩，然后执行现有的追赶引导轮询，再进入 `turn_start`。如果已完成的工具批次终止运行且没有排队的消息需要进一步响应，则跳过此轮次检查。Pi 还会在接收到新用户提示前进行检查，并在低级运行结束后执行最终尝试的溢出恢复。

提供程序上下文溢出错误或早期的最终 `stopReason: "length"` 可以选择一次压缩并重试的恢复尝试。带有工具调用的长响应会保留其合成失败的工具结果，并遵循常规的工具/队列调度器，而不是强制运行结束。

您也可以通过 `/compact [instructions]` 手动触发，其中可选的指令会聚焦摘要。

### 工作原理

1. **查找切点**：向后遍历最终化的会话投影，累计标记估算，直到 `keepRecentTokens`（默认 20k，可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）被达到  
2. **提取消息**：收集从上一个保留边界（或会话开始）到切点的投影消息  
3. **生成摘要**：调用 LLM 以结构化格式进行摘要，将之前的摘要作为迭代上下文传递  
4. **追加条目**：保存 `CompactionEntry`，包含摘要和 `firstKeptEntryId`  
5. **重建上下文**：会话使用摘要和 `firstKeptEntryId` 之后的消息重建上下文以供下一个请求使用

```
Before compaction:

  entry:  0     1     2     3      4     5     6      7      8     9
        ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                └────────┬───────┘ └──────────────┬──────────────┘
               messagesToSummarize            kept messages
                                   ↑
                          firstKeptEntryId (entry 4)

After compaction (new entry appended):

  entry:  0     1     2     3      4     5     6      7      8     9     10
        ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│ cmp │
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┴─────┘
               └──────────┬──────┘ └──────────────────────┬───────────────────┘
                 not sent to LLM                    sent to LLM
                                                         ↑
                                              starts from firstKeptEntryId

What the LLM sees:

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    prompt   from cmp          messages from firstKeptEntryId
```
  
在多次压缩中，摘要的跨度从上一次压缩的保留边界（`firstKeptEntryId`）开始，而不是从压缩条目本身开始，如果无法在路径中找到该保留条目，则回退到该压缩条目之后的条目。保留无条目的压缩会记录其自己的 ID 为 `firstKeptEntryId`；重复压缩从该条目之后开始。这会将之前压缩中幸存的消息包括在下一次摘要过程中。Pi 还会重新计算 `tokensBefore`，基于重建并编辑上下文的会话投影，然后写入新的 `CompactionEntry`，使标记计数反映实际被替换的预压缩上下文。省略的原始条目仍被存储，但不影响切点选择、摘要、检查点或标记估算。

### 溢出和长度恢复顺序

恢复会保留现有生命周期和队列顺序。已完成的尝试对 `turn_end` 和 `agent_end` 仍可见；运行后恢复会修复持久化模型上下文，然后进行新鲜重试：

```text
persist final assistant response
→ extension/public turn_end
→ extension/public agent_end
→ append context_edit omissions for the selected attempt
→ for overflow/length: run session_before_compact and append compaction on success
→ start the retry as a fresh run
```

如果恢复压缩失败或被取消，Pi 会保留遗漏的编辑，不附加压缩记录，并且不会调度内部重试。已排队的工作仍由常规的引导和后续规则管理。`agent_before_settle` 在恢复处理后可以看到修复后的投影。原始转录历史、导出、计费总额和历史搜索扩展仍可以检查被遗漏的尝试。

###  分割用户消息跨度

用户消息跨度以用户消息开始，包含所有轮次直到下一个用户消息。通常，压缩会在用户消息边界进行切割。

当一个用户消息跨度超过 `keepRecentTokens` 时，切割点会落在该跨度内的一个助手消息上。这就是分割用户消息跨度：

```
Split user-message span (one span exceeds budget):

  entry:  0     1     2      3     4      5      6     7      8
        ┌─────┬─────┬─────┬──────┬─────┬──────┬──────┬─────┬──────┐
        │ hdr │ usr │ ass │ tool │ ass │ tool │ tool │ ass │ tool │
        └─────┴─────┴─────┴──────┴─────┴──────┴──────┴─────┴──────┘
                ↑                                     ↑
         turnStartIndex = 1                  firstKeptEntryId = 7
                │                                     │
                └──── turnPrefixMessages (1-6) ───────┘
                                                      └── kept (7-8)

  isSplitTurn = true
  messagesToSummarize = []  (no earlier user-message spans)
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

对于分割用户消息跨度，Pi 会生成两个摘要并将它们合并：
1. **历史摘要**：之前的上下文（如果有）
2. **用户消息跨度前缀摘要**：分割用户消息跨度的早期部分

###  切割点规则

有效的切割点包括：
-  用户消息
-  助手消息
-  Bash 执行消息
-  自定义消息（custom_message, branch_summary）

永远不要在工具结果上切割（它们必须与对应的工具调用保持在一起）。

准备阶段会将保留边界推进到一个不可见于上下文的后缀中，但仅当该后缀包含被遗漏的助手尝试且没有未被遗漏的上下文生成条目时。恢复 `context_edit` 的遗漏满足此规则；本质上不可见于上下文的元数据可以与它们共存。仅元数据和新追加的自定义消息不会移动切割点。如果候选输入或摘要前缀被替换编辑影响，也会阻止推进，因为被遗漏的助手回答了预编辑输入；替换后最终被遗漏的后缀条目仍然安全。这允许在预算超支的情况下恢复输入被总结，同时保留使废弃尝试被遗漏的编辑，无论新模型输入是否保持原文不变。

###  压缩条目结构

定义于 [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  usage?: Usage;       // LLM usage that generated the summary
  fromHook?: boolean;  // true if provided by extension (legacy field name)
  details?: T;         // implementation-specific data
}

// Default compaction uses this for details (from compaction.ts):
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可以存储任何可 JSON 序列化的数据在 `details`。默认压缩会跟踪文件操作，但自定义扩展实现可以使用自己的结构。生成的和扩展提供的摘要会在有可用时存储其 LLM `usage`，以便会话总额包含摘要工作。

详见 [`prepareCompaction()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 和 [`compact()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 的实现。对于直接的程序化摘要，`generateSummary()` 返回摘要文本，`generateSummaryWithUsage()` 返回 `{ text, usage }`。

##  分支摘要

###  触发时机

当你使用 `/tree` 导航到不同分支时，Pi 会提供总结你即将离开的工作。这会将左侧分支的上下文注入到新分支中。

###  工作原理

1. **查找共同祖先**：旧和新位置共享的最深节点
2. **收集条目**：从旧叶节点回溯到共同祖先
3. **准备预算**：包含最多预算令牌的条目（最新优先）
4. **生成摘要**：调用 LLM 并使用结构化格式
5. **追加条目**：在导航点保存 `BranchSummaryEntry`

```
Tree before navigation:

         ┌─ B ─ C ─ D (old leaf, being abandoned)
    A ───┤
         └─ E ─ F (target)

Common ancestor: A
Entries to summarize: B, C, D

After navigation with summary:

         ┌─ B ─ C ─ D
    A ───┤
         └─ E ─ F ─ [summary of B,C,D] (new leaf)
```

###  累计文件跟踪

默认压缩和分支摘要会累计跟踪文件。两者都会从被总结的消息中的工具调用中提取文件操作。压缩还会携带上一个 Pi 生成的压缩中的文件列表。分支摘要会携带 Pi 生成的分支摘要中的文件列表。

因此，文件跟踪会跨默认压缩和嵌套的默认分支摘要累积。Pi 不会自动携带扩展生成摘要的文件列表，其 `fromHook` 字段为 `true`；扩展需要自行管理 `details` 格式。

###  分支摘要条目结构

定义于 [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
  fromId: string;      // Entry we navigated from
  usage?: Usage;       // LLM usage that generated the summary
  fromHook?: boolean;  // true if provided by extension (legacy field name)
  details?: T;         // implementation-specific data
}

// Default branch summarization uses this for details (from branch-summarization.ts):
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

与压缩相同，扩展可以存储自定义数据在 `details`。

详见 [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 和 [`generateBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 的实现。

##  摘要格式
```markdown
## Goal
[What the user is trying to accomplish]

## Constraints & Preferences
- [Requirements mentioned by user]

## Progress
### Done
- [x] [Completed tasks]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues, if any]

## Key Decisions
- **[Decision]**: [Rationale]

## Next Steps
1. [What should happen next]

## Critical Context
- [Data needed to continue]

<read-files>
path/to/file1.ts
path/to/file2.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

### 消息序列化

在摘要之前，消息会通过 [`serializeConversation()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) 序列化为文本：

```
[User]: What they said
[Assistant thinking]: Internal reasoning
[Assistant]: Response text
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: Output from tool
```

这可以防止模型将其视为需要继续的对话。

工具结果在序列化时会被截断为2000个字符。超出该限制的内容会被一个标记替换，指示被截断的字符数。这样可以确保摘要请求的token预算保持在合理范围内，因为工具结果（尤其是来自 `read` 和 `bash` 的结果）通常是上下文大小的主要贡献者。

## 通过扩展实现自定义摘要

扩展可以拦截并自定义压缩和分支摘要。有关事件类型定义，请参见 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts)。

### session_before_compact

在自动压缩或 `/compact` 之前触发。可以取消操作或提供自定义摘要。有关类型文件中的定义，请参见 `SessionBeforeCompactEvent` 和 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - messages to summarize
  // preparation.turnPrefixMessages - user-message-span prefix (if isSplitTurn)
  // preparation.previousSummary - previous compaction summary
  // preparation.fileOps - extracted file operations
  // preparation.tokensBefore - context tokens before compaction
  // preparation.firstKeptEntryId - where kept messages start
  // preparation.settings - effective settings after applying model overrides

  // branchEntries - all entries on current branch (for custom state)
  // reason - "manual" (/compact), "threshold", or "overflow"
  // willRetry - whether the aborted turn is retried after compaction (overflow recovery)
  // signal - AbortSignal (pass to LLM calls)

  // Cancel:
  return { cancel: true };

  // Custom summary:
  return {
    compaction: {
      summary: "Your summary...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // Optional; included in session totals
      details: { /* custom data */ },
    }
  };
});
```

#### 将消息转换为文本

要使用您自己的模型生成摘要，请使用 `serializeConversation` 将消息转换为文本：

```typescript
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;
  
  // Convert AgentMessage[] to Message[], then serialize to text
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize)
  );
  // Returns:
  // [User]: message text
  // [Assistant thinking]: thinking content
  // [Assistant]: response text
  // [Assistant tool calls]: read(path="..."); bash(command="...")
  // [Tool result]: output text

  // Now send to your model for summarization
  const { summary, usage } = await myModel.summarize(conversationText);
  
  return {
    compaction: {
      summary,
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      usage,
    }
  };
});
```

有关使用不同模型的完整示例，请参见 [custom-compaction.ts](../examples/extensions/custom-compaction.ts)。

### session_compact_failed

在手动或自动压缩失败或被中止时触发。这对需要将 `session_before_compact` 尝试与最终结果配对的遥测扩展很有用。

```typescript
pi.on("session_compact_failed", async (event, ctx) => {
  const { reason, errorMessage, aborted, willRetry, fromExtension } = event;
  // reason - "manual" (/compact), "threshold", or "overflow"
  // errorMessage - present for non-abort failures
  // aborted - true for canceled/aborted compactions
  // willRetry - whether the aborted turn would have retried after compaction
  // fromExtension - whether extension-provided compaction content was being used
});
```

### session_before_tree

在 `/tree` 导航之前触发。无论用户是否选择摘要，该事件始终会触发。可以取消导航或提供自定义摘要。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - where we're navigating to
  // preparation.oldLeafId - current position (being abandoned)
  // preparation.commonAncestorId - shared ancestor
  // preparation.entriesToSummarize - entries that would be summarized
  // preparation.userWantsSummary - whether user chose to summarize

  // Cancel navigation entirely:
  return { cancel: true };

  // Provide custom summary (only used if userWantsSummary is true):
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "Your summary...",
        // usage: summaryResponse.usage, // Optional; included in session totals
        details: { /* custom data */ },
      }
    };
  }
});
```

有关类型文件中的定义，请参见 `SessionBeforeTreeEvent` 和 `TreePreparation`。

## 设置

在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置压缩：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| 设置项 | 默认值 | 描述 |
|---------|---------|-------------|
| `enabled` | `true` | 启用自动压缩 |
| `reserveTokens` | `16384` | 保留用于LLM响应的token数 |
| `keepRecentTokens` | `20000` | 保留最近的未摘要token数 |

通过 `"enabled": false` 禁用自动压缩。您仍然可以使用 `/compact` 手动压缩。

### 按模型覆盖

使用 `compaction.modelOverrides` 调整不同模型的token预算：

```json
{
  "compaction": {
    "reserveTokens": 16384,
    "keepRecentTokens": 20000,
    "modelOverrides": {
      "some-provider/big-model": {
        "reserveTokens": 400000
      }
    }
  }
}
```

对于一个上下文窗口为1M的模型，此覆盖会在token超过600K时触发压缩，并保留普通的20000个最近token。其他模型则保留普通的16384个token保留。`reserveTokens` 也会影响摘要输出限制，受模型最大输出token数限制；它不仅仅是触发阈值。

键是精确的、大小写敏感的 `provider/modelId` 值，包括模型ID中的任何斜杠。每个 `reserveTokens` 和 `keepRecentTokens` 值会独立回退到普通设置，再回退到内置默认值。值必须是非负安全整数。匹配模型覆盖中的无效值在读取时会报错；只有被省略的字段才会回退到普通设置。模型覆盖项必须是对象。普通token设置中的无效值在读取时也会报错，即使当前模型有有效的覆盖。只有被省略的普通值才会使用内置默认值。`enabled` 保持全局，非模型特定。

这些解析后的值会被用于手动压缩、所有自动阈值检查、溢出恢复以及扩展可见的 `preparation.settings`。模型切换会影响后续检查和压缩，但不会改变普通设置。正在进行的压缩会使用该操作捕获的模型和设置。分支摘要设置不受影响。

覆盖可在全局和项目设置中使用。文件递归合并后再查找，因此全局模型特定值会覆盖项目范围的回退；项目必须覆盖该模型条目才能更改。详情请参见 [Settings](settings.md#per-model-compaction-overrides)。

