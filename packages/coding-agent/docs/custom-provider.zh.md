# 自定义提供程序

提供程序扩展将Pi连接到需要自定义身份验证、模型发现、请求处理或流式传输的模型服务。如果服务已经支持API，请在`models.json`中进行配置。

提供程序扩展在Pi内部运行，可以检查凭证、提示、工具定义、模型响应和使用情况。将其视为受信任的代码，避免记录机密或提供程序负载。

## 选择最小的集成

| 要求 | 使用 |
|---|---|
| 添加支持API后的模型 | [`models.json`](models.md#configure-a-compatible-endpoint) |
| 更改现有提供程序端点或标头 | `models.json`或小型提供程序扩展 |
| 动态发现模型 | 具有`refreshModels`的提供程序 |
| 添加`/login`流程 | 具有原生或遗留OAuth配置的提供程序 |
| 实现不受支持的线协议 | 具有`stream`或`streamSimple`的提供程序 |

提供程序扩展是一个[扩展](extensions.md)，因此它遵循相同的加载、信任、重新加载和错误行为。

## 注册提供程序

从扩展工厂调用`pi.registerProvider()`。Pi在启动前等待异步工厂，因此在那里注册的提供程序可用于启动模型选择和`pi --list-models`。
有两个注册表单：
- 注册完整的`Provider`，从`@earendil-works/pi-ai`开始 本地身份验证、过滤、发现、刷新和流式行为。
- 在`ProviderConfig`注册提供商名称 用于现有扩展的旧版配置表单。
更喜欢为新集成提供完整的提供者，而不仅仅是静态端点和模型元数据。Pi 组合了 `models.json` 以上的覆盖项，基于已注册的本地提供者。
为现有提供商注册仅 `baseUrl` 或 `headers` 可保留其内置模型。在传统形式中提供 `models` 可替换该提供商在聊天、图像和分类器操作中的模型。省略 `type` 表示 `"chat"`；图像和分类器模型需要通过 `images` 和 `classifiers` 字段，基于其 `api` 值进行显式区分和实现。
例如，混合操作提供商可以将非聊天模型及其实现一起注册：

```typescript
pi.registerProvider("media-tools", {
  apiKey: "$MEDIA_TOOLS_API_KEY",
  models: [
    {
      type: "image",
      id: "image-v1",
      name: "Image V1",
      api: "media-images",
      baseUrl: "https://media.example.com/v1",
      input: ["text"],
      output: ["image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    },
    {
      type: "classifier",
      id: "classifier-v1",
      name: "Classifier V1",
      api: "media-classifier",
      baseUrl: "https://media.example.com/v1",
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 64000,
    },
  ],
  images: {
    "media-images": { generateImages: async (model, context, options) => result },
  },
  classifiers: {
    "media-classifier": { classify: async (model, context, options) => result },
  },
});
```

模型级别的`baseUrl`值优先于提供商端点。如果未提供`models`列表，则每个操作的内置模型仍将保持注册。不同操作中的相同模型ID保持独立，包括其特定模型的头部。

初始扩展加载后的调用立即生效。使用`pi.unregisterProvider()`移除动态提供商并恢复其替换的内置行为。

有关将流式处理委派给内置API实现的完整注册，请参见已检查的[GitLab Duo提供商](../examples/extensions/custom-provider-gitlab-duo/)。

## 提供身份验证

静态提供商可以从字面量、环境插值或命令中解析API密钥。这些值使用与`models.json`相同的语法：

- `$NAME`和`${NAME}`读取环境变量。
- 以`!command`开头使用命令输出。
- `$$`发出字面量`$`。
- `$!`发出以`!`开头的字面量。

当集成需要存储凭证、自定义解析、提供商范围的环境或多种登录方法时，使用本地提供商身份验证。

OAuth提供商提供显示名称、登录流程、令牌刷新和访问令牌解析。注册后，它将出现在`/login`中，并且Pi将返回的凭证存储在`~/.pi/agent/auth.json`中。

OAuth回调是UI中立的。它们可以打开授权URL、显示设备代码、报告进度、请求输入或要求用户选择登录方法。在进行网络请求时，尊重取消和提供的abort信号。

绝不将访问令牌、刷新令牌、授权头部或完整的提供商响应写入普通日志。

## 提供和刷新模型
每个模型都需要一个ID、显示名称、输入能力以及成本元数据。聊天模型和分类器模型还需要上下文窗口；聊天模型还需要输出限制和推理支持；图像模型声明其输出模态。除非某个模型需要覆盖，否则应选择提供方级别的API实现。

当Pi应保持空闲提示缓存温暖时，将`promptCache.short`或`promptCache.long`设置为提供方的最佳努力缓存生命周期（秒）。不设置它们将禁用该保留等级的缓存预热。

兼容性标志描述了在API其他方面已支持的情况下经过验证的差异。不要仅根据端点声称的兼容性就启用它们。

请核对实际服务器上的请求字段和响应行为。

当可用目录来自实时服务时，使用`refreshModels`。将`context.signal`传递给阻塞I/O，以便调用者可以取消刷新。

两个注册表单有不同的刷新协议：

- A完整的`Provider`返回空。它调用`context.publish({ update })`安装提供方拥有的模型状态，之后其同步`getModels()`会暴露最新列表。
- 旧版`ProviderConfig.refreshModels`返回混合操作的模型定义。Pi会用返回的列表替换该注册表的实时模型，并应用任何请求的持久化。

仅在数据应跨运行保存时才发布持久化目录数据。例如，像llama.cpp这样的实时服务可以更新其内存列表而不持久化；远程目录可以在离线启动时保留快照。

## 重用支持的流式API

在提供方协议匹配时，始终使用Pi AI的API实现之一。

支持的实现包括Anthropic消息、OpenAI聊天完成和响应、Google生成式AI和Vertex、Azure OpenAI响应、Mistral对话、以及Bedrock对话。

提供方仍可自定义认证、基础URL、头部、模型过滤和发现，同时将请求转换和流式处理委托给现有的API实现。

这比复制流式实现更安全，因为它保留了Pi的消息转换、工具处理、使用统计、取消和兼容性行为。
## 实现自定义流

仅在没有现有API实现能表示该服务时，实现`streamSimple`。首先研究[`packages/ai/src/api`](https://github.com/earendil-works/pi/tree/main/packages/ai/src/api)下的实现。

流接收一个规范化的`TranscriptContext`。系统提示和工具声明存在于转录系统消息中，因此请使用`getCurrentSystemPrompt(context.messages)`和`getCurrentTools(context.messages)`读取它们，而不是期待`context.systemPrompt`或`context.tools`。支持对话中系统消息的模型可以直接接收它们；否则调用`collapseSystemMessages(context)`将后续系统消息折叠到前置消息中。

自定义流必须：

1. 创建一条包含提供者、模型、时间戳、待停止原因、内容和清零用量的助手消息。
2. 请求设置成功后，发出一个`start`事件，然后发出内容事件。
3. 在发出平衡文本、思考和工具调用事件的同时更新消息。
4. 最终确定用量、成本、内容和停止原因。
5. 发出恰好一个终端`done`或`error`事件并关闭流。
6. 将取消操作转换为中止结果。

请求设置可能在`start`之前失败；在这种情况下，流可以直接以`error`终止。缺少请求认证也可能在流返回前同步抛出异常。

内容索引指的是助手消息中的块。在发出状态由`partial`字段暴露的事件之前，必须更新每个块。工具调用参数必须包含由`toolcall_end`解析的有效输入。

流还必须遵守通过`SimpleStreamOptions`提供的请求仪器化：

- 在发送提供者请求之前调用`options.onPayload`，并使用它返回的任何替换负载。
- 在接收响应但尚未消费其主体之前调用`options.onResponse`。
- 在规范化每个解析的提供者事件之前，等待`options.onProviderStreamEvent?.(providerEvent, model)`。
- 传递中止信号和提供者作用域环境。
这些钩子用于扩展请求检查、响应头事件和提供者流观察。省略它们会使提供者的行为与 Pi 内置提供者不同。

## 报告失败和使用情况

为终端设置具体的停止原因。错误和中止消息需要 `errorMessage`；成功消息需要准确的输入、输出、缓存、总令牌和成本值。

Pi 可以在识别到上下文溢出错误后进行压缩和重试。如果服务使用了未知消息，请仅将该提供者的溢出响应规范化为 `context_length_exceeded`，并在受保护的 `message_end` 处理器中处理。

不要将速率限制或瞬态提供者失败重写为上下文溢出。这些失败将使用 Pi 的正常重试行为。

## 测试集成

至少测试以下内容：

- 普通和空文本响应
- 工具调用和工具结果
- 支持时的图像输入和图像工具结果
- 使用和成本核算
- 中止行为
- 上下文溢出
- 格式错误或部分流
- Unicode边界
- 跨提供者会话交接
- 身份验证刷新和取消

在 [`packages/ai/test`](https://github.com/earendil-works/pi/tree/main/packages/ai/test) 下定义的提供者测试决定了内置提供者应具备的行为。应适配相关测试套件，而不是仅依赖手动提示。

在开发时直接运行扩展，然后将其移动到已发现的扩展位置，或通过 [Pi 包](packages.md) 分发。在活动会话中更改已发现的提供者扩展后，使用 `/reload`。

