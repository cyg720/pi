# 选择模型

对于内置提供商，请从`/login`开始，然后选择一个模型`/model`。仅在Pi中不包含您需要的提供商或端点时，才使用自定义模型配置。

## 选择连接

| 您拥有的内容 | 推荐设置 |
|---|---|
| 支持的订阅 | 通过`/login`登录 |
| 提供商API密钥 | 通过`/login`存储或设置其环境变量 |
| 本地GGUF模型 | 将Pi连接到llama.cpp路由器 |
| 兼容OpenAI-、Anthropic-或Google-的端点 | 在`models.json`中添加 |
| 具有自定义协议或认证流程的提供商 | 构建或安装提供商扩展 |

可在[模型目录](https://pi.dev/models)中浏览当前提供商、模型ID、能力、上下文限制和定价。Pi从其捆绑的目录开始，并可叠加pi.dev中的更新目录数据。缓存的目录数据可离线访问；运行`pi update --models`可强制刷新。

## 认证

运行`/login`并选择提供商。Pi将凭证存储在[`auth.json`](configuration.md#agent-directory)。运行`/logout`可删除存储的提供商凭证。

您也可以通过提供商的环境变量提供API密钥。这在CI和其他环境中很有用，此时Pi不应写入凭证。[提供商](providers.md)列出了变量和提供商特定的设置。

当配置了多个凭证来源时，Pi按以下顺序使用：首先使用`--api-key`（运行时），然后使用`auth.json`（存储的凭证），接着使用`apiKey`（来自`models.json`），最后使用提供商的环境变量或云凭证。提供商扩展可以定义其自己的认证行为。

请保持`auth.json`和任何凭证命令的私密性。项目设置和扩展可以在您信任项目后在Pi进程中执行。在从不信任的目录加载配置之前，请查看[安全](security.md)。

## 选择模型

运行`/model`搜索可用模型。选择器显示具有可用认证的提供商的模型。按`Ctrl+S`保存模型为新会话的默认值。

运行`/thinking`选择当前模型的思考级别。按`Ctrl+S`保存启动级别。Pi限制选择为所选模型支持的级别。

`Ctrl+P`循环浏览可用模型。使用`/scoped-models`控制循环并保存选择，或通过[设置](settings.md#model-cycling)配置模型模式。

会话记录模型和思考级别的更改。恢复会话时会还原这些更改，而不改变新会话的默认值。

## 连接本地模型

Pi直接与llama.cpp路由器集成。路由器发现GGUF文件并在需要时加载模型。Pi的`/llama`命令管理路由器，`/model`选择其加载的模型之一。

请遵循[使用llama.cpp的本地模型](llama-cpp.md)进行服务器启动、模型布局、下载和连接故障排除。

对于Ollama、LM Studio、vLLM、SGLang和其他兼容服务器，请在`models.json`中[配置兼容端点](#configure-a-compatible-endpoint)。

<a id="configure-a-compatible-endpoint"></a>
## 配置兼容端点

使用[`models.json`](configuration.md#agent-directory)时，端点使用的API Pi已支持。这包括大多数Ollama、LM Studio、vLLM、SGLang和代理部署。

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

该虚拟密钥使模型对Pi可用；Ollama会忽略它。对于已认证的端点，`apiKey`和标头值可以使用`$NAME`或`${NAME}`环境插值、字面值或以`!command`开头。`models.json`中的命令在请求时运行，不会被Pi缓存。

打开`/model`会重新加载文件。`models`条目会添加或替换同一提供商上具有相同ID的模型。使用`modelOverrides`更改现有内置或扩展提供的模型的元数据，而不替换提供商的模型列表。未知覆盖ID会被忽略。

### 描述模型输入和缓存

使用`inputLimits.images.resize`控制Pi如何编码新图像附件、`read`结果和工具结果图像，然后将其存储在对话历史中：

```json
{
  "id": "vision-model",
  "input": ["text", "image"],
  "inputLimits": {
    "images": {
      "resize": {
        "maxWidth": 1568,
        "maxHeight": 1568,
        "maxBytes": 524288,
        "jpegQuality": 75
      }
    }
  }
}
```

`maxBytes`限制了base64编码的有效载荷。省略的缩放字段使用保守默认值：2000x2000像素，4.5 MiB编码，JPEG质量80。图像仅编码一次；更改模型不会重写历史图像。目录还可以使用`inputLimits.maxRequestBytes`、`images.maxPerMessage`和`images.maxPerRequest`描述硬性请求限制，但Pi目前不会根据这些限制重写或拒绝历史记录。

<a id="prompt-cache-lifetimes"></a>

使用`promptCache`声明提供方对`short`或`long`保留层级的最佳努力缓存生命周期（以秒为单位）：

```json
{ "id": "claude-sonnet-5", "promptCache": { "short": 300, "long": 3600 } }
```

选择任何已发布范围的保守端。对于活动层级没有生命周期的模型，不可用于缓存预热。`modelOverrides`条目可以为内置或扩展模型设置`inputLimits`或`promptCache`，包括通过验证代理访问的模型。详见[`cacheWarming`](settings.md#model-and-thinking)。

### 配置采样级别

OpenAI兼容API支持自由形式的`samplingParams`模型默认值和`samplingParamsByThinkingLevel`覆盖。后者使用Pi思考级别密钥（`off`、`minimal`、`low`、`medium`、`high`、`xhigh`和`max`），而不是来自`thinkingLevelMap`的提供方值：

```json
{
  "id": "qwen-thinking-model",
  "reasoning": true,
  "samplingParams": {
    "temperature": 1.0,
    "top_p": 0.95
  },
  "samplingParamsByThinkingLevel": {
    "off": {
      "temperature": 0.7,
      "top_p": 0.8
    },
    "high": {
      "top_k": 20
    }
  }
}
```

Pi首先对不支持的思考级别进行限制，然后按顺序合并模型`samplingParams`、有效级别的覆盖值和请求级别的`samplingParams`。后续值按键覆盖。缺失的级别继承模型默认值。`modelOverrides`按键合并逐级条目与基础模型。这些字段仅适用于`openai-completions`、`openai-responses`和`azure-openai-responses`；其他API会忽略它们。

兼容性设置应描述端点请求或响应行为的已验证差异。不要仅根据端点宣称兼容OpenAI或Anthropic就启用它们。

## 使用分类器模型

分类器模型不支持聊天。它们对JSON状态的输入问题进行回答：从多个选项中选择一个、回答是或否、或给出评分，每种回答均带有概率。Pi包括这些提供商的TypeSafe Jev模型，以及Cloudflare Workers AI的Clef和Clef Flash模型：
| 提供商 | 模型ID | 认证 |
|---|---|---|
| `typesafe` | `jev-latest` | `TYPESAFE_API_KEY` |
| `openrouter` | `typesafe/jev-1.13`, `~typesafe/jev-latest` | `OPENROUTER_API_KEY` 或 `/login` |
| `cloudflare-workers-ai` | `typesafe/jev`, `@cf/cloudflare/clef`, `@cf/cloudflare/clef-flash` | `CLOUDFLARE_API_KEY` 和 `CLOUDFLARE_ACCOUNT_ID` |
| `vercel-ai-gateway` | `typesafe-ai/jev` | `AI_GATEWAY_API_KEY` |
| `opencode` | `jev-1.13`, `jev-1.13-free` | `OPENCODE_API_KEY` |

部署在 [llama.cpp 路由器](llama-cpp.md#classification) 上的聊天模型也被列为分类器模型。

分类器模型不会出现在 `/model` 中。用户可通过 [`codemode`](cli.md#enable-codemode) 工具访问它们，该工具默认关闭，除非启用了 MCP 服务器。通过 [settings](settings.md#tools) 中的 `"defaultTools": ["+codemode"]` 启用它。启用后，脚本使用 `models.getAvailableOfType("classifier")` 列出分类器模型，并调用 `models.classify(model, { state, questions })`：

```js
const jev = await models.getModelOfType("classifier", "typesafe", "jev-latest");
const result = await models.classify(jev, {
  state: { message: "The change works, thanks." },
  questions: {
    approved: {
      type: "bool",
      instructions: "Does the user approve of the result?",
      criteria: { true: "Approval", false: "No approval" },
    },
  },
});
return result.answers;
```

[Codemode](codemode.md#classify) 描述了问题和答案的类型。

当服务报告令牌计数时（所有 System One 服务均会这样做），`result.usage` 会将其与成本一起携带。Pi 会将脚本调用分类器的使用情况计入 `codemode` 工具的结果，因此会计入页面底部和 `/session` 显示的会话成本。成本使用模型目录价格；没有目录价格的模型（如 TypeSafe 的直接 `jev-latest`）报告令牌时成本为零。

扩展通过 `ctx.modelRegistry.classify()` 调用分类器，无需 codemode。[虚拟模型](virtual-models.md#route-requests) 可以使用它们来路由请求；请参见 `jev-router.ts` 示例。

##  使用图像模型

图像模型根据提示和可选的输入图像生成图像。Pi 在 `openrouter` 提供商下列出了 OpenRouter 的图像模型，例如 `google/gemini-2.5-flash-image` 和 `black-forest-labs/flux.2-pro`；它们使用与聊天模型相同的 `OPENROUTER_API_KEY` 或 `/login` 凭证。
与分类器模型类似，图像模型不会出现在 `/model` 中；模型通过 [`codemode`](cli.md#enable-codemode) 工具访问它们。脚本使用 `models.getAvailableOfType("image")` 列出它们，并调用 `models.generateImages(model, { input })`。结果中的 `output` 包含 base64 图像块，`image()` 将这些块附加到 `codemode` 结果中，以便模型能够看到它们：

```js
const painter = await models.getModelOfType("image", "openrouter", "google/gemini-2.5-flash-image");
const result = await models.generateImages(painter, {
  input: [{ type: "text", text: "A red fox in the snow, watercolor" }],
});
if (result.stopReason !== "stop") return result.errorMessage;
for (const block of result.output) if (block.type === "image") image(block);
```

`input` 也可以包含 `{ type: "image", data, mimeType }` 块，用于编辑或作为参考。Pi 会将脚本的图像调用添加到 `codemode` 工具结果中，就像分类器调用一样。生成的图像不会保存到磁盘。[Codemode](codemode.md#generate-images) 描述了完整的 API。

扩展通过 `ctx.modelRegistry.generateImages()` 生成图像，无需 codemode。

##  添加自定义提供商

当提供商需要自定义流式处理、模型发现或身份验证行为时，使用扩展。有关扩展工作流程，请参见 [Custom Providers](custom-provider.md)。

##  故障排除

###  模型未出现

确认其提供商是否具有可用的身份验证。自定义模型可以从 `models.json` 加载，但在 `/model` 中仍不可用，直到 Pi 能够解析凭证。对于 llama.cpp，只有路由器当前加载的模型才会出现。

###  身份验证仅在一个 shell 中有效

检查密钥是否来自环境变量，而不是 `auth.json`。环境变量必须存在于启动 Pi 的进程中。

###  登录时会在远程机器上打开浏览器

在可用时完成提供商的无头身份验证流程。某些提供商允许您将最终重定向 URL 或授权码粘贴回 Pi 中。请参见 [Authenticate interactively](providers.md#authenticate-interactively)。

###  兼容的端点拒绝请求

检查其 API 类型和 `models.json` 中的兼容性设置。上游服务器必须支持相应的请求字段和行为。

