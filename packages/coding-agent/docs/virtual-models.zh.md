# 虚拟模型

虚拟模型是一种可选模型，针对每个请求选择一个物理模型。可以按任务、成本或对话状态进行路由。例如，路由器可以将简单问题发送给小型模型，将复杂问题发送给大型模型，而用户只需选择一个模型。

从[扩展](extensions.md)注册虚拟模型。它们会像其他模型一样出现在`/model`、`--model`、作用域模型和设置中。虚拟模型可以列在任何提供商下，包括拥有物理模型的提供商，如`openai-codex/auto`。

## 选择与路由

虚拟模型选择一个模型和一个思考层级。路由器将该组合映射到每个请求的物理组合：

```
selected (virtual model, virtual level)  ->  dispatched (physical model, physical level)
jev/auto:low                             ->  anthropic/claude-sonnet-4-5:high
```

虚拟思考层级是路由器的输入。其含义由路由器决定，不必对应于推理预算。

Pi会将两者区分开：

| | 选择 | 路由 |
|---|---|---|
| 记录在 | `model_change`和`thinking_level_change`条目 | 每条助手消息：`provider`、`api`、`model`、`thinkingLevel` |
| 可见为 | `ctx.model`、`ctx.thinkingLevel`、`PI_MODEL`、`PI_REASONING_LEVEL`、`/model` | 每条响应的助手消息 |

提供商仅接收物理模型。助手消息会命名物理模型，因此在不同物理模型间重播对话与手动切换模型后的效果相同。恢复会话时，Pi会从最新的`model_change`条目中恢复虚拟选择。如果虚拟模型不再注册，Pi会回退到上次回答所用的物理模型。

在交互模式下，页脚会显示路由模型与选择项并列，例如`auto • high → gpt-5.6-luna • medium`。`/session`会列出每个物理模型的成本。

上下文使用会遵循产生最新响应的物理模型的限制，即使该响应出现在切换到虚拟模型之前。如果没有此类响应，则使用虚拟模型声明的限制（如有）。压缩检查相同的限制，并再次检查路由目标模型的限制。如果该模型的上下文窗口不足以容纳对话，Pi会在发送请求前进行压缩；路由保持路由器选择的结果。

## 注册虚拟模型

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerVirtualModel({
    provider: "router",
    id: "auto",
    name: "Auto",
    thinkingLevels: ["low", "high"],
    route(request, ctx) {
      // Tool follow-ups and retries stay on the model that handled the turn.
      const sticky = request.failed ?? request.previous;
      if (request.reason !== "user" && sticky) {
        return { model: sticky.model, thinkingLevel: sticky.thinkingLevel ?? "medium" };
      }
      const id = request.thinkingLevel === "high" ? "claude-sonnet-4-5" : "claude-haiku-4-5";
      return { model: ctx.modelRegistry.find("anthropic", id)!, thinkingLevel: "medium" };
    },
  });
}
```

- `provider`是该模型所属的提供商。它可以是任何提供商ID。一个提供商可以在其物理模型旁列出多个虚拟模型。在物理提供商下，虚拟模型在该提供商拥有凭证时可用。在未被任何提供商使用的ID下，虚拟模型始终可用。
- `id`不得是该提供商物理模型的ID。如果目录刷新后添加了具有相同ID的物理模型，虚拟模型会将其隐藏。
- `thinkingLevels`列出了可供选择的层级。它默认为`["off"]`。
- `contextWindow`和`maxTokens`会在首次响应前显示。未设置的限制为未知。
- `input`列出了可供选择的输入类型。它默认为文本和图片；不支持图片的物理模型会接收占位符。

注册遵循与`pi.registerProvider()`相同的排队和重新加载规则。再次使用相同的提供商和ID注册会替换虚拟模型。`pi.unregisterVirtualModel(provider, id)`会移除它；`pi.unregisterProvider()`不会。SDK代码可以不借助扩展注册虚拟模型：`modelRuntime.registerVirtualModel(definition)`。

## 路由请求

`route(request, ctx)`会在每次使用虚拟模型发起请求前运行，并返回`{ model, thinkingLevel }`。模型可以是目录中该提供商拥有凭证的任何物理模型；可通过`ctx.modelRegistry`查找。虚拟模型不能路由到另一个虚拟模型。Pi会将思考层级限制为返回模型。

| 字段 | 含义 |
|---|---|
| `model`、`thinkingLevel` | 选择的虚拟模型和层级 |
| `reason` | 请求发起的原因，详见下文 |
| `previous` | `messages`中最新成功响应的物理模型和思考层级 |
| `failed` | 对于`retry`：失败请求的物理模型、思考层级和助手`message`，该请求`messages`不再包含。消息携带`stopReason`和`errorMessage`。路由失败时不显示 |
| `state` | 本会话分支上最后一次返回的路由器状态，请参见下文 |
| `messages` | 该请求的对话内容，包括系统消息 |
| `signal` | 请求的中止信号 |

| `reason` | 请求 |
|---|---|
| `user` | 用户输入消息后的第一个请求，包括引导和后续消息 |
| `continuation` | 代理循环中的其他请求，例如工具结果或扩展消息后发出的请求 |
| `retry` | 请求失败后的自动重试，包括上下文溢出后的压缩重试 |
| `direct` | 在代理循环外发出的请求，例如压缩摘要或调用`ctx.modelRegistry.streamSimple()`的扩展 |

将`previous`返回给`continuation`，并将`failed`返回给`retry`，可保持提示缓存和思维签名有效。允许在轮次间切换模型，但会丢失提示缓存。重试时也可以切换到其他模型，例如当`failed.message.errorMessage`报告服务提供商过载或上下文溢出时。

如果`route()`抛出异常，或返回虚拟模型或无凭证的模型，请求将以错误响应结束。

## 保持路由状态

`route()`可以将`state`与模型一起返回。Pi会将该状态存储在会话分支上，并在后续请求中将其作为`request.state`返回。可用于转录未记录的决策，例如分类器结果或路由阶段：

```typescript
pi.registerVirtualModel<{ phase: "plan" | "build" }>({
  provider: "router",
  id: "phased",
  name: "Phased",
  route(request, ctx) {
    const state = request.state ?? { phase: "plan" };
    const id = state.phase === "plan" ? "claude-opus-4-5" : "claude-haiku-4-5";
    return { model: ctx.modelRegistry.find("anthropic", id)!, thinkingLevel: "medium", state };
  },
});
```

- 状态必须是JSON可序列化的。返回`undefined`或`request.state`本身可保持当前状态。
- Pi会将任何其他返回的对象作为新状态存储，请求发送前，即使与当前状态相同。仅在状态改变时返回新对象。如果请求后续失败，状态仍会保留。
- 状态遵循会话树，因此分支和`/tree`导航可看到其分支状态。它会保留压缩后的状态。
- `direct`请求没有状态，Pi会忽略它们返回的状态。

转录已记录选择和每个分发的模型，`ctx.sessionManager.getBranch()`同时暴露两者。

路由器可通过`ctx.modelRegistry`调用其他模型，例如`ctx.modelRegistry.classify()`使用`ctx.modelRegistry.findOfType("classifier", provider, id)`的分类器模型。该调用会在该轮次的第一个标记前增加延迟。

有关完整路由器的详细信息，请参见[`jev-router.ts`](../examples/extensions/jev-router.ts)。它基于Jev分类器选择的强大OpenAI Codex模型进行规划，让该模型先进行第一次编辑，然后切换到更便宜的模型，接受一次提示缓存缺失。它会将阶段保持为路由器状态。

