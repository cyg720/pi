# @earendil-works/pi-ai

统一的大语言模型（LLM）API，支持提供商品牌集合、自动认证解析、令牌和成本追踪，以及简单的上下文持久化和会话中转到其他模型。

**注意**：聊天目录仅包含支持工具调用（函数调用）的模型，因为这对于代理工作流至关重要。图像和分类器目录使用其各自操作的特定能力。

## 目录

- [支持的提供商品牌](#supported-providers)
- [安装](#installation)
- [快速入门](#quick-start)
- [提供商品牌和模型](#providers-and-models)
  - [提供商品牌工厂](#provider-factories)
  - [所有内置提供商品牌](#all-built-in-providers)
  - [查询模型](#querying-models)
  - [静态目录读取](#static-catalog-reads)
  - [动态提供商品牌](#dynamic-providers)
- [认证](#auth)
  - [认证解析方式](#how-auth-resolves)
  - [转换请求头](#transforming-request-headers)
  - [凭证存储](#credential-store)
  - [环境变量](#environment-variables)
- [工具](#tools)
  - [定义工具](#defining-tools)
  - [处理工具调用](#handling-tool-calls)
  - [部分JSON流式工具调用](#streaming-tool-calls-with-partial-json)
  - [验证工具参数](#validating-tool-arguments)
  - [完整事件参考](#complete-event-reference)
  - [紧凑型助手消息帧](#compact-assistant-message-frames)
- [图像输入](#image-input)
- [图像生成](#image-generation)
- [分类](#classification)
- [思考/推理](#thinkingreasoning)
  - [统一接口](#unified-interface-streamsimplecompletesimple)
  - [提供商品牌特定选项](#provider-specific-options-streamcomplete)
  - [流式思考内容](#streaming-thinking-content)
- [停止原因](#stop-reasons)
- [错误处理](#error-handling)
  - [中止请求](#aborting-requests)
  - [中止后继续](#continuing-after-abort)
  - [调试提供商品牌负载](#debugging-provider-payloads)
  - [观察提供商品牌流事件](#observing-provider-stream-events)
- [自定义提供商品牌](#custom-providers)
  - [createProvider()](#createprovider)
  - [直接调用API实现](#calling-api-implementations-directly)
  - [OpenAI兼容设置](#openai-compatibility-settings)
- [测试用伪提供商品牌](#faux-provider-for-tests)
- [跨提供商品牌中转](#cross-provider-handoffs)
- [系统消息](#system-messages)
- [上下文序列化](#context-serialization)
- [浏览器使用](#browser-usage)
- [打包和Tree Shaking](#bundling-and-tree-shaking)
- [OAuth提供商品牌](#oauth-providers)
  - [Vertex AI](#vertex-ai)
  - [命令行登录](#cli-login)
  - [程序化OAuth](#programmatic-oauth)
- [从旧的全局API迁移](#migrating-from-the-old-global-api)
- [开发](#development)
- [许可证](#license)

<a id="supported-providers"></a>
## 支持的提供商品牌

- **OpenAI**
- **Ant Ling**
- **Azure OpenAI（响应）**
- **OpenAI Codex（旧版）**（ChatGPT Plus/Pro订阅，需要OAuth，详见下文）
- **Radius**（API密钥或OAuth，带动态刷新的网关目录）
- **TypeSafe**（System One分类器API）
- **DeepSeek**
- **NVIDIA NIM**
- **Anthropic**
- **Google**
- **Vertex AI**（Gemini通过Vertex AI）
- **Mistral**
- **Groq**
- **Cerebras**
- **Cloudflare AI网关**
- **Cloudflare Workers AI**
- **xAI**
- **OpenRouter**
- **Vercel AI网关**
- **ZAI Coding Plan（全球）**（带独立中国提供商品牌）
- **MiniMax**（带独立中国提供商品牌）
- **Together AI**
- **Baseten**
- **Hugging Face**
- **Moonshot AI**（带独立中国提供商品牌）
- **GitHub Copilot**（需要OAuth，详见下文）
- **Amazon Bedrock**
- **OpenCode Zen**
- **OpenCode Go**
- **Fireworks** (使用与OpenAI和Anthropic兼容的API)
- **Kimi For Coding** (Moonshot AI订阅端点，使用与Anthropic兼容的API)
- **Meta** (模型API，使用与OpenAI响应兼容的API)
- **Qwen Token Plan** (独立的个人及现有目录，配有独立的中国供应商)
- **Xiaomi MiMo** (默认使用API计费端点，配有独立的Token Plan供应商，适用于`cn`/`ams`/`sgp`区域)
- **任何与OpenAI兼容的API**：Ollama、vLLM、LM Studio等。

<a id="installation"></a>
## 安装

```bash
npm install @earendil-works/pi-ai
```

TypeBox导出内容是从`@earendil-works/pi-ai`重新导出的：`Type`、`Static`和`TSchema`。

<a id="quick-start"></a>
## 快速入门

您构建一个`Models`供应商集合，并通过它进行流式传输。最快的方式是注册所有内置供应商；关注包大小的应用程序则注册单个供应商（详见[供应商工厂](#provider-factories)和[Bundling and Tree Shaking](#bundling-and-tree-shaking)）。

```typescript
import { Type, type Context, type Tool } from '@earendil-works/pi-ai';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

// A Models collection with every built-in provider registered
const models = builtinModels();

// Sync lookup against the collection
const model = models.getModel('openai', 'gpt-4o-mini')!;

// Define tools with TypeBox schemas for type safety and validation
const tools: Tool[] = [{
  name: 'get_time',
  description: 'Get the current time',
  parameters: Type.Object({
    timezone: Type.Optional(Type.String({ description: 'Optional timezone (e.g., America/New_York)' }))
  })
}];

// Build a conversation context (easily serializable and transferable between models)
const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'What time is it?', timestamp: Date.now() }],
  tools
};

// Option 1: Streaming with all event types.
// Auth resolves through the provider (OPENAI_API_KEY from the environment here).
const s = models.stream(model, context);

for await (const event of s) {
  switch (event.type) {
    case 'start':
      console.log(`Starting with ${event.partial.model}`);
      break;
    case 'text_start':
      console.log('\n[Text started]');
      break;
    case 'text_delta':
      process.stdout.write(event.delta);
      break;
    case 'text_end':
      console.log('\n[Text ended]');
      break;
    case 'thinking_start':
      console.log('[Model is thinking...]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);
      break;
    case 'thinking_end':
      console.log('[Thinking complete]');
      break;
    case 'toolcall_start':
      console.log(`\n[Tool call started: index ${event.contentIndex}]`);
      break;
    case 'toolcall_delta':
      // Partial tool arguments are being streamed
      const partialCall = event.partial.content[event.contentIndex];
      if (partialCall.type === 'toolCall') {
        console.log(`[Streaming args for ${partialCall.name}]`);
      }
      break;
    case 'toolcall_end':
      console.log(`\nTool called: ${event.toolCall.name}`);
      console.log(`Arguments: ${JSON.stringify(event.toolCall.arguments)}`);
      break;
    case 'done':
      console.log(`\nFinished: ${event.reason}`);
      break;
    case 'error':
      console.error(`Error: ${event.error.errorMessage}`);
      break;
  }
}

// Get the final message after streaming, add it to the context
const finalMessage = await s.result();
context.messages.push(finalMessage);

// Handle tool calls if any
const toolCalls = finalMessage.content.filter(b => b.type === 'toolCall');
for (const call of toolCalls) {
  const result = call.name === 'get_time'
    ? new Date().toLocaleString('en-US', {
        timeZone: call.arguments.timezone || 'UTC',
        dateStyle: 'full',
        timeStyle: 'long'
      })
    : 'Unknown tool';

  // Add tool result to context (supports text and images)
  context.messages.push({
    role: 'toolResult',
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: 'text', text: result }],
    isError: false,
    timestamp: Date.now()
  });
}

// Continue if there were tool calls
if (toolCalls.length > 0) {
  const continuation = await models.complete(model, context);
  context.messages.push(continuation);
  console.log('After tool execution:', continuation.content);
}

console.log(`Total tokens: ${finalMessage.usage.input} in, ${finalMessage.usage.output} out`);
console.log(`Cost: $${finalMessage.usage.cost.total.toFixed(4)}`);

// Option 2: Get complete response without streaming
const response = await models.complete(model, context);

for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'toolCall') {
    console.log(`Tool: ${block.name}(${JSON.stringify(block.arguments)})`);
  }
}
```

本文档其余部分的代码片段假设已设置`models`集合（相关供应商已注册）。

<a id="providers-and-models"></a>
## 供应商与模型

**供应商**是运行时单元：它拥有自己的模型目录、认证（API密钥解析、OAuth流程）和流式行为。`Models`集合包含供应商，并将每个请求路由到拥有该模型的供应商。

供应商内部共享**API实现**（线协议）：Anthropic模型使用`anthropic-messages`，OpenAI使用`openai-responses`，xAI、Groq、Cerebras、OpenRouter及大多数其他供应商共享`openai-completions`。混合API供应商（如GitHub Copilot、OpenCode Zen）按模型分派。

<a id="provider-factories"></a>
### 供应商工厂

对于仅需要特定供应商的应用，每个内置供应商对应一个工厂，每个工厂通过子路径导入只拉取该供应商的目录：

```typescript
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter';
import { amazonBedrockProvider } from '@earendil-works/pi-ai/providers/amazon-bedrock';
// ...one module per provider in the Supported Providers list

const models = createModels();
models.setProvider(anthropicProvider());
models.setProvider(openrouterProvider());
```

供应商工厂导入其模型目录及一个懒加载的API包装器。它们不导入其他供应商。借助打包器代码分割，SDK实现（`@anthropic-ai/sdk`、`openai`、`@google/genai`等）保留在懒加载的代码块中，首次请求该API模型时才加载。
<a id="all-built-in-providers"></a>
### 所有内置提供者

对于希望获取一切（如快速启动）的应用程序：

```typescript
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

const models = builtinModels(); // a Models collection with every built-in provider registered
```

这会导入所有目录和每个内置提供者工厂。它是沉重且显式的入口点。`builtinModels()`接受与`createModels()`（`credentials`，`authContext`）相同的选项；`builtinProviders()`会在您希望自行注册到您的集合时返回提供者数组。

<a id="querying-models"></a>
### 查询模型

读取操作是同步的，返回最后已知的列表：

```typescript
const providers = models.getProviders();           // registered Provider objects
const provider = models.getProvider('anthropic');  // one provider

const all = models.getModels();                    // every chat model across providers
const anthropicModels = models.getModels('anthropic');
const model = models.getModel('anthropic', 'claude-sonnet-4-5');

for (const m of anthropicModels) {
  console.log(`${m.id}: ${m.name}`);
  console.log(`  API: ${m.api}`);
  console.log(`  Context: ${m.contextWindow} tokens`);
  console.log(`  Vision: ${m.input.includes('image')}`);
  console.log(`  Reasoning: ${m.reasoning}`);
}
```

未限定的读取`getModels()`/`getModel()`/`getAvailable()`返回聊天模型（`Model<Api>`），可用于`stream()`。`*OfType`读取返回单一模型类型，而`getAllModels()`/`getAllAvailable()`返回所有类型作为`AnyModel`：

```typescript
const images = models.getModelsOfType('image', 'openrouter');           // ImageModel[]
const flux = models.getModelOfType('image', 'openrouter', 'black-forest-labs/flux.2-pro');
const jev = models.getModelOfType('classifier', 'typesafe', 'jev-latest');
const availableImages = await models.getAvailableOfType('image');
const everything = models.getAllModels();                               // AnyModel[]
```

模型的`type`决定哪个操作接受它：聊天模型流式处理，`type: "image"`模型生成图像，`type: "classifier"`模型对结构化状态进行分类。`type`是聊天模型的可选项，因此没有`type`的模型即为聊天模型。不要直接比较`type`；使用`isModelType()`或读取有效类型`getModelType()`来缩小混合列表：

```typescript
import { isModelType } from '@earendil-works/pi-ai';

for (const model of models.getAllModels()) {
  if (isModelType(model, 'image')) {
    // model: ImageModel<ImageApi>
  }
}
```

每个提供者和类型的ID是唯一的；同一个上游模型可能因不同操作拥有不同的条目。在提供者上，`getModels()`返回聊天模型，可选的`getAllModels()`返回所有类型；仅包含聊天模型的提供者可以省略它。

动态列出的聊天模型是类型`Model<Api>`。当需要API特定的选项类型时，使用`hasApi()`守卫来缩小范围：

```typescript
import { hasApi } from '@earendil-works/pi-ai';

const m = models.getModel('anthropic', 'claude-sonnet-4-5');
if (m && hasApi(m, 'anthropic-messages')) {
  // m: Model<'anthropic-messages'> — stream options fully typed
  models.stream(m, context, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
}
```

<a id="static-catalog-reads"></a>
### 静态目录读取

对于希望获得完整字面量类型（提供者和模型ID自动补全）的工具，独立于任何集合：

```typescript
import {
  getAllBuiltinModels,
  getBuiltinClassifierModel,
  getBuiltinClassifierModels,
  getBuiltinImageModel,
  getBuiltinImageModels,
  getBuiltinModel,
  getBuiltinModels,
  getBuiltinProviders,
} from '@earendil-works/pi-ai/providers/all';

const model = getBuiltinModel('openai', 'gpt-4o-mini'); // typed Model<'openai-responses'>
const radius = getBuiltinModel('radius', 'balanced');   // typed Model<'pi-messages'>
const flux = getBuiltinImageModel('openrouter', 'black-forest-labs/flux.2-pro');
const jev = getBuiltinClassifierModel('typesafe', 'jev-latest');
const providers = getBuiltinProviders();
const openrouterChat = getBuiltinModels('openrouter');        // Model[]
const openrouterImages = getBuiltinImageModels('openrouter'); // ImageModel[]
const typesafeClassifiers = getBuiltinClassifierModels('typesafe'); // ClassifierModel[]
const openrouterAll = getAllBuiltinModels('openrouter');      // AnyModel[]
```

<a id="dynamic-providers"></a>
### 动态提供者

提供者可能拥有动态模型列表（如llama.cpp服务器，或实时OpenRouter列表）。读取操作保持同步；获取操作是一个显式的异步动词：

```typescript
// getModels() returns the last-known list (empty before the first refresh)
await models.refresh({ providers: ['llamacpp'] }); // refresh one provider
await models.refresh();                            // refresh all providers concurrently, best-effort
const fresh = models.getModel('llamacpp', 'qwen3-30b');
```

静态内置提供程序对`refresh()`而言是无效操作。Radius的范围（radius）既是静态的也是动态的：它会分发公共的`radius.pi.dev`目录以供同步API查询，然后在使用配置的认证信息刷新时，叠加缓存和最新获取的`/v1/config`模型。有关构建动态提供程序的说明，请参见[createProvider()](#createprovider)。

<a id="auth"></a>
## 身份验证

每个提供程序都拥有其自身的认证机制：API密钥的解析方式（存储的凭证、环境变量、类似AWS配置文件或gcloud ADC的环境源），以及在支持的情况下，OAuth登录/刷新流程。

<a id="how-auth-resolves"></a>
### 身份验证的解析流程

当你调用`models.stream()`时，集合会通过拥有该提供程序的认证进行解析，并将其合并到请求中。显式的单次请求值始终优先：

```typescript
// Resolved through the provider (env var, stored credential, OAuth token):
await models.complete(model, context);

// Explicit key wins over anything the provider would resolve:
await models.complete(model, context, { apiKey: 'sk-explicit' });
```

你可以检查认证解析，而无需发出请求。传递提供程序ID以解析提供程序范围的认证，或传递模型以包含其静态的`model.headers`：

```typescript
const providerAuth = await models.getAuth(model.provider);
const modelAuth = await models.getAuth(model);

if (modelAuth) {
  console.log(`configured via ${modelAuth.source}`); // e.g. "ANTHROPIC_API_KEY", "OAuth", "stored credential"
  console.log(modelAuth.auth.headers);              // Provider auth headers + model.headers
} else {
  console.log('not configured');
}
```

这两种重载方式都会解析凭证，在必要时刷新过期的OAuth，并可能返回基于认证的`apiKey`、`headers`或`baseUrl`。`getAuth()`会为未配置的提供程序解析`undefined`，并在出现故障时（`"oauth"`：令牌刷新失败，凭证保留以便重新登录；`"auth"`：密钥解析或凭证存储失败）以`ModelsError`形式拒绝请求。请求路径会将相同的故障以流错误的形式暴露出来。

`getAuth()`、`checkAuth()`、`getAvailable()`、login和logout接受通过其现有选项或交互对象的可选调用者取消信号，并且在未提供信号时保持无限制。提供程序`login`、`ApiKeyAuth.check`、`ApiKeyAuth.resolve`和`OAuthAuth.refresh`的实现始终会接收具体的信号，并必须尊重该信号以处理阻塞操作。

<a id="transforming-request-headers"></a>
### 转换请求头

`Models.stream()`、`complete()`、`streamSimple()`和`completeSimple()`接受一个仅限模型的`transformHeaders`选项。它会在提供程序认证、`model.headers`和显式的`options.headers`合并之后，但在提供程序分发之前运行一次：

```typescript
const response = await models.completeSimple(model, context, {
  headers: { "X-Client": "my-app" },
  transformHeaders: async (headers) => ({
    ...headers,
    "X-Request-ID": crypto.randomUUID(),
  }),
});
```

顺序如下：

```text
provider auth headers -> model.headers -> explicit options.headers -> transformHeaders -> Provider.stream*()
```

头部名称以不区分大小写的方式合并。显式的头部会覆盖认证/模型头部，且转换操作拥有最终控制权；如果返回`null`，则会抑制支持删除的底层默认头部。

`transformHeaders`属于`Models`，而非`Provider`。`Models`实现必须消费并移除它，然后才能调用`Provider.stream*()`。提供程序实现将继续接收普通的`ApiStreamOptions`或`SimpleStreamOptions`，而不会自行处理转换。请改用此选项，而不是在调用`stream*()`之前先调用`getAuth(model)`，否则会将请求认证解析两次。

<a id="credential-store"></a>
### 凭据存储

存储的凭证（交互式输入的API密钥、OAuth令牌）保存在`CredentialStore`中——每个提供程序对应一种类型标记的凭证。pi-ai自带内存默认存储；应用可注入持久化存储：

```typescript
import { createModels, type CredentialStore } from '@earendil-works/pi-ai';

const models = createModels({ credentials: myFileBackedStore });
// builtinModels() takes the same options:
// const models = builtinModels({ credentials: myFileBackedStore });
```

契约很简单：`read(providerId)`、`list()`用于非机密的`{ providerId, type }`元数据，`modify(providerId, fn)`（唯一的写入路径——序列化的读-改-写），以及`delete(providerId)`。每个操作都接受可选的取消选项。枚举操作不得解析机密或执行配置的密钥命令。OAuth令牌刷新在`modify`内执行，因此并发请求和进程无法对已旋转的令牌进行双重刷新。存储的凭证“拥有”其提供程序：环境变量仅在没有存储凭证时才会被查询，且刷新失败不会静默地回退到环境密钥。

API密钥凭证使用与pi的`auth.json`相同的区分符，并可携带提供程序范围的环境/配置值：

```typescript
const credential = {
  type: 'api_key',
  key: '...',
  env: {
    CLOUDFLARE_ACCOUNT_ID: 'account-id',
    CLOUDFLARE_GATEWAY_ID: 'gateway-id'
  }
} as const;
```

<a id="environment-variables"></a>
### 环境变量

内置提供程序解析以下环境变量（Node.js；在浏览器中显式传递`apiKey`）：

| 提供程序      | 环境变量                                             |
|-------------|----------------------------------------------------|
| OpenAI      | `OPENAI_API_KEY`                                   |
| Ant Ling    | `ANT_LING_API_KEY`                                   |
| Azure OpenAI| `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL`（例如`https://{resource}.ai.azure.com`）或`AZURE_OPENAI_RESOURCE_NAME`。支持`*.openai.azure.com`、`*.cognitiveservices.azure.com`和`*.ai.azure.com`；根端点会自动规范化为`/openai/v1`。可选：`AZURE_OPENAI_API_VERSION`（默认`v1`）、`AZURE_OPENAI_DEPLOYMENT_NAME_MAP`。 |
| Anthropic   | `ANTHROPIC_API_KEY`或`ANTHROPIC_OAUTH_TOKEN`                 |
| Radius      | `RADIUS_API_KEY`                                   |
| 类型安全 | `TYPESAFE_API_KEY` |
| 深度搜索 | `DEEPSEEK_API_KEY` |
| NVIDIA NIM | `NVIDIA_API_KEY` |
| Google | `GEMINI_API_KEY` |
| 顶点AI | `GOOGLE_CLOUD_API_KEY` 或 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）+ `GOOGLE_CLOUD_LOCATION` + ADC |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| Cloudflare AI网关 | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_GATEWAY_ID` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` |
| xAI | `XAI_API_KEY` |
| Fireworks | `FIREWORKS_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Baseten | `BASETEN_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI网关 | `AI_GATEWAY_API_KEY` |
| ZAI编码计划（全球） | `ZAI_API_KEY` |
| ZAI编码计划（中国） | `ZAI_CODING_CN_API_KEY` |
| MiniMax（全球） | `MINIMAX_API_KEY` |
| MiniMax（中国） | `MINIMAX_CN_API_KEY` |
| Moonshot AI / Moonshot AI（中国） | `MOONSHOT_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| OpenCode Zen / OpenCode Go | `OPENCODE_API_KEY` |
| Kimi For Coding | `KIMI_API_KEY` |
| Meta | `META_API_KEY` |
| Qwen Token计划（现有目录） | `QWEN_TOKEN_PLAN_API_KEY` |
| Qwen Token计划（个人） | `QWEN_TOKEN_PLAN_API_KEY` |
| Qwen Token计划（中国） | `QWEN_TOKEN_PLAN_CN_API_KEY` |
| 小米MiMo（API计费） | `XIAOMI_API_KEY` |
| 小米MiMo Token计划（中国） | `XIAOMI_TOKEN_PLAN_CN_API_KEY` |
| 小米MiMo Token计划（阿姆斯特丹） | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` |
| 小米MiMo Token计划（新加坡） | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` |

`qwen-token-plan-individual`和`qwen-token-plan`共享国际端点和`QWEN_TOKEN_PLAN_API_KEY`。个人提供商仅公开了个人文档中记录的模型
subscriptions，同时现有提供商保留更广泛的目录以实现向后兼容性。
存储的凭据为提供商范围，因此请将密钥保存在您注册的提供商 ID 下。

Amazon Bedrock 解析环境 AWS 凭据（`AWS_PROFILE`，访问密钥对，`AWS_BEARER_TOKEN_BEDROCK`，ECS 任务角色，网络身份令牌）；其提供商拥有的登录流程支持承载令牌、AWS 配置文件以及现有的凭据链。Vertex AI 解析显式密钥或 gcloud 应用默认凭据（ADC）及项目/位置，拥有提供商拥有的登录流程用于 API 密钥、ADC 和服务账户文件。

<a id="tools"></a>
## 工具

工具使大语言模型能够与外部系统交互。该库使用 TypeBox 模式定义类型安全的工具，自动使用 TypeBox 内置验证器和值转换工具进行验证。TypeBox 模式可序列化和反序列化为纯 JSON，非常适合分布式系统。

<a id="defining-tools"></a>
### 定义工具

```typescript
import { Type, type Tool, StringEnum } from '@earendil-works/pi-ai';

// Define tool parameters with TypeBox
const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: Type.Object({
    location: Type.String({ description: 'City name or coordinates' }),
    units: StringEnum(['celsius', 'fahrenheit'], { default: 'celsius' })
  })
};

// Note: For Google API compatibility, use StringEnum helper instead of Type.Enum
// Type.Enum generates anyOf/const patterns that Google doesn't support

const bookMeetingTool: Tool = {
  name: 'book_meeting',
  description: 'Schedule a meeting',
  parameters: Type.Object({
    title: Type.String({ minLength: 1 }),
    startTime: Type.String({ format: 'date-time' }),
    endTime: Type.String({ format: 'date-time' }),
    attendees: Type.Array(Type.String({ format: 'email' }), { minItems: 1 })
  })
};
```

### 受约束的工具采样

工具可选择启用提供商侧受约束的采样。对于 JSON 模式工具，`strict: 'prefer'` 在支持时使用提供商侧严格模式强制执行，否则回退为普通工具调用。`strict: 'require'` 当活动提供商/模型无法满足请求时会失败。设置 `constrainedSampling: false` 可显式关闭此功能；不设置该字段时行为相同。

```typescript
const strictTool: Tool = {
  name: 'edit_file',
  description: 'Edit a file',
  parameters: Type.Object({
    path: Type.String(),
    content: Type.String()
  }, { additionalProperties: false }),
  constrainedSampling: { type: 'json_schema', strict: 'prefer' }
};
```

严格JSON模式约束的采样支持OpenAI、Anthropic、支持Amazon Bedrock Converse模型、Mistral和Gemini 3的工具调用，通过Google Generative AI和Vertex适配器实现。Google使用`VALIDATED`函数调用模式（或显式请求时使用`ANY`）；较早版本的Gemini在`strict: 'prefer'`下回退，并拒绝`strict: 'require'`，因为它们不强制执行必需参数。Bedrock的严格工具能力来源于模型结构化输出元数据；自定义Bedrock模型可以通过`compat.supportsStrictMode`进行覆盖。OpenAI的响应和聊天补全也可以发出带有OpenAI Lark或正则表达式语法变体的语法约束自定义工具。如果提供了多个OpenAI变体，优先选择Lark而非正则表达式。当活动模型支持语法工具时，语法约束会被强制执行；否则工具将回退到常规函数/JSON模式处理。语法工具能力是模型元数据：生成的目录为通过（OpenAI、OpenAI Codex、Azure OpenAI响应、GitHub Copilot、opencode和Cloudflare AI Gateway）的端点设置`compat.supportsOpenAIGrammarTools`，适用于GPT-5+模型。OpenAI拒绝`type: "custom"`工具用于GPT-5之前的模型，且网关（如OpenRouter）会标准化工具模式，导致这些工具被破坏，因此该标志在其他地方保持关闭。自定义模型定义可以通过`compat`启用。具备语法能力的模型会拒绝没有非空支持变体的语法配置。原生语法工具必须具有一个对象参数模式，其中包含且仅包含一个必需的字符串属性：

```typescript
const patchTool: Tool = {
  name: 'apply_patch',
  description: 'Apply a patch',
  parameters: Type.Object({
    input: Type.String()
  }, { additionalProperties: false }),
  constrainedSampling: {
    type: 'grammar',
    variants: {
      openai_lark: 'start: /.+/s'
    }
  }
};
```

<a id="handling-tool-calls"></a>
### 处理工具调用

工具结果使用内容块，可以包含文本和图片：

```typescript
import { readFileSync } from 'fs';

const context: Context = {
  messages: [{ role: 'user', content: 'What is the weather in London?', timestamp: Date.now() }],
  tools: [weatherTool]
};

const response = await models.complete(model, context);

// Check for tool calls in the response
for (const block of response.content) {
  if (block.type === 'toolCall') {
    // Execute your tool with the arguments
    // See "Validating Tool Arguments" section for validation
    const result = await executeWeatherApi(block.arguments);

    // Add tool result with text content
    context.messages.push({
      role: 'toolResult',
      toolCallId: block.id,
      toolName: block.name,
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: false,
      timestamp: Date.now()
    });
  }
}

// Tool results can also include images (for vision-capable models)
const imageBuffer = readFileSync('chart.png');
context.messages.push({
  role: 'toolResult',
  toolCallId: 'tool_xyz',
  toolName: 'generate_chart',
  content: [
    { type: 'text', text: 'Generated chart showing temperature trends' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ],
  isError: false,
  timestamp: Date.now()
});
```

<a id="streaming-tool-calls-with-partial-json"></a>
### 流式工具调用与部分JSON

在流式处理时，工具调用参数会随着它们的到达而逐步解析。这使得在完整参数可用之前就能实现实时UI更新：

```typescript
const s = models.stream(model, context);

for await (const event of s) {
  if (event.type === 'toolcall_delta') {
    const toolCall = event.partial.content[event.contentIndex];

    // toolCall.arguments contains partially parsed JSON during streaming
    // This allows for progressive UI updates
    if (toolCall.type === 'toolCall' && toolCall.arguments) {
      // BE DEFENSIVE: arguments may be incomplete
      // Example: Show file path being written even before content is complete
      if (toolCall.name === 'write_file' && toolCall.arguments.path) {
        console.log(`Writing to: ${toolCall.arguments.path}`);

        // Content might be partial or missing
        if (toolCall.arguments.content) {
          console.log(`Content preview: ${toolCall.arguments.content.substring(0, 100)}...`);
        }
      }
    }
  }

  if (event.type === 'toolcall_end') {
    // Here toolCall.arguments is complete (but not yet validated)
    const toolCall = event.toolCall;
    console.log(`Tool completed: ${toolCall.name}`, toolCall.arguments);
  }
}
```

**关于部分工具参数的重要说明：**
- 在`toolcall_delta`事件中，`arguments`包含对部分JSON的最佳努力解析结果
- 字段可能会缺失或不完整 - 使用前请始终检查字段是否存在
- 字符串值可能会在单词中间被截断
- 数组可能会不完整
- 嵌套对象可能会部分填充
- 至少，`arguments`将是一个空对象`{}`，永远不会是`undefined`
- Google提供程序不支持函数调用流式传输。相反，您将收到一个包含完整参数的单个`toolcall_delta`事件。

<a id="validating-tool-arguments"></a>
### 验证工具参数

在实现您自己的工具执行循环时，使用`validateToolCall`在将参数传递给您的工具之前进行验证：

```typescript
import { validateToolCall, type Tool } from '@earendil-works/pi-ai';

const tools: Tool[] = [weatherTool, calculatorTool];
const s = models.stream(model, { messages, tools });

for await (const event of s) {
  if (event.type === 'toolcall_end') {
    const toolCall = event.toolCall;

    try {
      // Validate arguments against the tool's schema (throws on invalid args)
      const validatedArgs = validateToolCall(tools, toolCall);
      const result = await executeMyTool(toolCall.name, validatedArgs);
      // ... add tool result to context
    } catch (error) {
      // Validation failed - return error as tool result so model can retry
      context.messages.push({
        role: 'toolResult',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: 'text', text: error.message }],
        isError: true,
        timestamp: Date.now()
      });
    }
  }
}
```

<a id="complete-event-reference"></a>
### 完整事件引用

成功生成后遵循`start → updates* → done`。生成开始后出现失败则遵循`start → updates* → error`。请求设置可能在生成开始之前失败，此时流中仅包含`error`；`done`和更新事件在`start`之前无效。直接API `streamSimple()`调用在缺少请求认证时会同步抛出异常。

每个非终端事件的`partial`是共享的实时响应辅助工具。它故意不是事件时间点的快照：提供程序可能会在生成过程中修改相同的消息和内容块，包括当较早的事件等待在流队列中时。处理事件时请检查它，而不是将其保留为历史状态。当其`*_start`事件发出时，文本和普通思考块为空，并且仅通过匹配`*_delta`事件不断增长，直到权威`*_end`；被删减的思考可能在开始时已经完整，不会发出任何增量更改。`toolcall_start`的工具调用参数是提供程序特定的；`toolcall_delta`携带后续JSON更新。

在助手消息生成期间发出的所有流事件：

| 事件类型 | 描述 | 关键属性 |
|----------|------|----------|
| `start` | 流开始 | `partial`：初始助手消息结构 |
| `text_start` | 文本块开始 | `contentIndex`：内容数组中的位置 |
| `text_delta` | 文本片段接收 | `delta`：新文本，`contentIndex`：位置 |
| `text_end` | 文本块处理完成 | `content`: 完整文本，`contentIndex`: 位置 |
| `thinking_start` | 思考块开始 | `contentIndex`: 内容数组中的位置 |
| `thinking_delta` | 思考片段接收 | `delta`: 新文本，`contentIndex`: 位置 |
| `thinking_end` | 思考块处理完成 | `content`: 完整思考内容，`contentIndex`: 位置 |
| `toolcall_start` | 工具调用开始 | `contentIndex`: 内容数组中的位置 |
| `toolcall_delta` | 工具参数流式传输 | `delta`: JSON片段，`partial.content[contentIndex].arguments`: 部分解析参数 |
| `toolcall_end` | 工具调用完成 | `toolCall`: 完整但未经过模式验证的工具调用，包含`id`、`name`、`arguments` |
| `done` | 流式传输完成 | `reason`: 停止原因（"stop"、"length"、"toolUse"），`message`: 最终助手消息 |
| `error` | 发生错误 | `reason`: 错误类型（"error"或"aborted"），`error`: 包含部分内容的AssistantMessage |

不同内容块的流式事件并不保证连续。提供方可能会在一个上游片段中发出文本、思考和工具调用的增量（delta），pi可能会交错地呈现对应的事件，例如`text_start`、`text_delta`、`toolcall_start`、`text_delta`、`toolcall_delta`。消费者必须使用`contentIndex`将每个增量/结束事件与其所属块关联，并且不能假设一个块的`*_start`/`*_delta`/`*_end`序列不会被其他块的事件打断。

<a id="compact-assistant-message-frames"></a>
### 紧凑型助手消息帧

`AssistantMessageFrameEncoder`将一个流转换为紧凑、可持久化的`AssistantMessageFrame`值。为每个流创建一个编码器，并按顺序输入每个事件。编码器理解`partial`是实时的：在消费块开始事件后，提供方已排队后续增量，会快照当前块一次，已覆盖的文本/思考增量不会产生重复帧。它仅保留每个打开块的计数器，以及临时的原始前缀，用于同步已提前的工具调用。它从不克隆正在增长的完整部分（按token计）。

起始帧包含消息元数据，内容为空。文本和思考帧在权威结束帧之前最多存储每个生成字符一次。那些在起始事件被消费时工具调用已提前的调用，使用一个紧凑的JSON检查点，随后普通增量恢复。终端`done`和`error`事件不产生帧，因为最终消息结算独立进行。预生成的`error`因此不产生任何帧。

`reduceAssistantMessageFrames()`是纯粹的归约器。它重构文本、思考和工具调用参数，包括通过`contentIndex`标识的交错块，并拒绝格式错误的序列。它对可迭代项进行单次遍历，当没有起始帧时返回`undefined`。结束帧用提供方的权威完成内容和元数据替换块。归约器不验证工具参数是否符合TypeBox模式；执行前请先调用`validateToolCall`。

```typescript
import {
  AssistantMessageFrameEncoder,
  reduceAssistantMessageFrames,
  type AssistantMessageFrame,
} from '@earendil-works/pi-ai';

const encoder = new AssistantMessageFrameEncoder();
const frames: AssistantMessageFrame[] = [];
for await (const event of s) {
  const frame = encoder.encode(event);
  if (frame) frames.push(frame);
}

const reconstructedPartial = reduceAssistantMessageFrames(frames);
const finalMessage = await s.result(); // Persist terminal settlement separately.
```

编码器拒绝重复的起始、更新前于起始、`done`前于起始、终端事件后的事件、重复的块起始以及块类型不匹配。`error`前于起始是有效的，且不返回帧。

<a id="image-input"></a>
## 图像输入

具备视觉能力的模型可以处理图像。您可以通过`input`属性检查模型是否支持图像。如果向不支持图像的模型传递图像，它们会被静默忽略。

```typescript
import { readFileSync } from 'fs';

const model = models.getModel('openai', 'gpt-4o-mini')!;

// Check if model supports images
if (model.input.includes('image')) {
  console.log('Model supports vision');
}

const imageBuffer = readFileSync('image.png');
const base64Image = imageBuffer.toString('base64');

const response = await models.complete(model, {
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image', data: base64Image, mimeType: 'image/png' }
    ],
    timestamp: Date.now()
  }]
});

// Access the response
for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  }
}
```

<a id="image-generation"></a>
## 图像生成

图像模型位于与聊天模型相同的`Models`集合和`Provider`上，因此一个提供方的凭证可同时覆盖两者。它们是`ImageModel`类型，使用`type: "image"`，并通过`generateImages()`（一次性API，等待提供方响应并返回最终`AssistantImages`结果）使用。请勿使用聊天/流式API处理它们；`stream()`会拒绝图像模型。

### 基础图像生成

```typescript
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

const models = builtinModels();

const model = models.getModelOfType('image', 'openrouter', 'google/gemini-2.5-flash-image')!;

// Auth resolves through the provider (OPENROUTER_API_KEY here); explicit apiKey wins
const result = await models.generateImages(model, {
  input: [{ type: 'text', text: 'Generate a red circle on a plain white background.' }]
});

for (const block of result.output) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'image') {
    console.log(block.mimeType);
    console.log(block.data.substring(0, 32));
  }
}
```

`generateImages()`仅接受`ImageModel`类型的值。如果上游模型同时支持聊天和图像生成，则目录中包含具有相同提供商和ID的独立条目：`getModel()`返回其聊天操作，`getModelOfType('image', ...)`返回其图像操作。失败情况不会拒绝，而是返回一个`AssistantImages`，其中包含`stopReason: "error"`，包括未知提供商、未配置的认证以及没有图像实现的提供商。

提供商通过`images`选项的[`createProvider()`](#createprovider)声明图像支持：一个从`model.api`映射到具有`generateImages()`实现的条目。图像模型与聊天模型共享同一`models`列表。当`images`存在时，`api`变为可选，因此仅支持图像的提供商就是没有聊天模型的提供商：

```typescript
import { createProvider, envApiKeyAuth } from '@earendil-works/pi-ai';

const pixels = createProvider({
  id: 'pixels',
  auth: { apiKey: envApiKeyAuth('Pixels API key', ['PIXELS_API_KEY']) },
  models: [{
    type: 'image',
    id: 'flux-pro',
    name: 'FLUX Pro',
    api: 'pixels-images',
    provider: 'pixels',
    baseUrl: 'https://api.pixels.test/v1',
    input: ['text'],
    output: ['image'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }],
  images: {
    'pixels-images': { generateImages: async (model, context, options) => { /* ... */ } },
  },
});
models.setProvider(pixels);
```

旧的全局API（`getImageModel()` / `getImageModels()` / `getImageProviders()` / `generateImages()`）仍可通过[兼容入口](#migrating-from-the-old-global-api)访问：

```typescript
import { getImageModel, generateImages } from '@earendil-works/pi-ai/compat';

const model = getImageModel('openrouter', 'google/gemini-2.5-flash-image');
const result = await generateImages(model, {
  input: [{ type: 'text', text: 'Generate a red circle on a plain white background.' }]
}, {
  apiKey: process.env.OPENROUTER_API_KEY
});
```

部分模型也支持图像输入：

```typescript
import { readFileSync } from 'fs';

const imageBuffer = readFileSync('input.png');
const result = await models.generateImages(model, {
  input: [
    { type: 'text', text: 'Create a variation of this image with a blue background.' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ]
});
```

请在模型元数据中检查能力：

```typescript
console.log(model.input);  // ['text'] or ['text', 'image']
console.log(model.output); // ['image'] or ['image', 'text']
```

### 注意事项与限制

- 图像模型和聊天模型共享`Models`和`Provider`；请使用`getModelsOfType('image')`进行列表管理，并使用`generateImages()`运行，绝不使用聊天/流式API。
- 图像生成模型不参与工具调用。
- 输出以`AssistantImages.output`形式返回，可能包含base64编码的`ImageContent`块和`TextContent`块。
- 部分模型仅返回图像，部分模型返回图像加文本。请参阅`model.output`。
- 部分模型接受图像输入，部分模型仅支持文本转图像。请参阅`model.input`。
- 与流式API类似，图像生成支持`apiKey`、`signal`、`headers`、`onPayload`和`onResponse`等选项，结果可能包含`stopReason`、`responseId`和`usage`。
- 如果您希望模型在对话或调用工具时分析图像，请使用支持图像输入的常规聊天API。
- 目前，图像生成仅通过一个提供商OpenRouter提供。

<a id="classification"></a>
## 分类

分类器模型消耗结构化的JSON状态并回答一个或多个类型化的问题。它们不使用聊天或图像生成API。TypeSafe的Jev模型可通过以下内置提供商获取：

| 提供商 | 模型ID | 认证 |
| --- | --- | --- |
| `typesafe` | `jev-latest` | `TYPESAFE_API_KEY` |
| `openrouter` | `typesafe/jev-1.13`, `~typesafe/jev-latest` | `OPENROUTER_API_KEY`或OpenRouter OAuth |
| `cloudflare-workers-ai` | `typesafe/jev`, `@cf/cloudflare/clef`, `@cf/cloudflare/clef-flash` | `CLOUDFLARE_API_KEY`和`CLOUDFLARE_ACCOUNT_ID` |
| `vercel-ai-gateway` | `typesafe-ai/jev` | `AI_GATEWAY_API_KEY` |
| `opencode` | `jev-1.13`, `jev-1.13-free` | `OPENCODE_API_KEY` |

```typescript
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

const models = builtinModels();
const model = models.getModelOfType('classifier', 'typesafe', 'jev-latest')!;
const result = await models.classify(model, {
  state: { message: 'The change works perfectly, thanks.' },
  questions: {
    category: {
      type: 'choice',
      instructions: 'Classify the message.',
      criteria: {
        approval: 'The user approves of the result',
        correction: 'The user requests a correction'
      }
    },
    satisfaction: {
      type: 'score',
      instructions: 'Score user satisfaction.',
      criteria: ['dissatisfied', 'neutral', 'satisfied']
    },
    approved: {
      type: 'bool',
      instructions: 'Does the user approve?',
      criteria: { true: 'Approval', false: 'No approval' }
    }
  }
});

console.log(result.answers);
```

公共契约使用`bool`问题和`{ type: "bool", probability }`答案。TypeSafe适配器将其转换为其`noul`线协议表示。与图像生成类似，`classify()`解析为包含`stopReason: "error"`的结果，而非因提供商、认证或响应错误而拒绝。

当服务报告令牌计数时，`result.usage`携带其成本及模型目录价格，与聊天消息相同的`Usage`形状。所有System One服务均报告令牌计数；即使答案格式错误，已回答的请求仍保留其使用记录。本地分类器如`llama-cpp-classify`不报告使用记录。

`ClassifierOptions.temperature`在归一化前将答案logits除以给定值；值大于1时会软化分布。无法应用的API（如System One）会忽略此选项。

### 基于llama.cpp的聊天模型
`llama-cpp-classify`接口将由llama.cpp提供的`llama-server`聊天模型转换为分类器。每个问题都成为一个聊天提示：状态、请求中的每个问题、状态再次出现，以及带有单标记标签的问题和答案（字母表示选择，`Yes`/`No`表示布尔值，数字表示分数）。请求中所有问题共享提示的前部分内容，因此服务器的提示缓存每个请求只对状态进行一次评估。服务器返回下一个标记的对数概率，答案是标签标记的softmax。选择支持最多62个选项，分数支持最多10个级别。模型的`baseUrl`是服务器的URL；末尾的`/v1`会被忽略。在路由模式下，模型ID选择具体的模型。

```typescript
import { createProvider } from '@earendil-works/pi-ai';
import { llamaCppClassifyApi } from '@earendil-works/pi-ai/api/llama-cpp-classify.lazy';

const provider = createProvider({
  id: 'local-llama',
  auth: { apiKey: { name: 'llama.cpp', resolve: async () => ({ auth: {} }) } },
  models: [{
    type: 'classifier',
    id: 'qwen3-4b',
    name: 'Qwen3 4B',
    api: 'llama-cpp-classify',
    provider: 'local-llama',
    baseUrl: 'http://127.0.0.1:8080',
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32768
  }],
  classifiers: { 'llama-cpp-classify': llamaCppClassifyApi() }
});
```

原始标签概率通常过于自信；将`temperature`设置为大于1可以软化它们。

自定义提供者通过API ID注册分类器模型和实现：

```typescript
createProvider({
  id: 'classifier-service',
  auth,
  models: [model],
  classifiers: {
    'classifier-api': { classify: async (model, context, options) => result }
  }
});
```

<a id="thinkingreasoning"></a>
## 思考与推理

许多模型支持思考/推理能力，即它们可以展示内部的思考过程。您可以通过`reasoning`属性检查模型是否支持推理。如果向不支持推理的模型传递推理选项，它们会被静默忽略。

<a id="unified-interface-streamsimplecompletesimple"></a>
### 统一接口（streamSimple/completeSimple）

```typescript
// Many models across providers support thinking/reasoning
const model = models.getModel('anthropic', 'claude-sonnet-4-5')!;
// or models.getModel('openai', 'gpt-5-mini');
// or models.getModel('google', 'gemini-2.5-flash');
// or models.getModel('xai', 'grok-4.7');

// Check if model supports reasoning
if (model.reasoning) {
  console.log('Model supports reasoning/thinking');
}

// Use the simplified reasoning option
const response = await models.completeSimple(model, {
  messages: [{ role: 'user', content: 'Solve: 2x + 5 = 13', timestamp: Date.now() }]
}, {
  reasoning: 'medium'  // 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
});

// Access thinking and text blocks
for (const block of response.content) {
  if (block.type === 'thinking') {
    console.log('Thinking:', block.thinking);
  } else if (block.type === 'text') {
    console.log('Response:', block.text);
  }
}
```

`xhigh`和`max`是模型特定的、可选的级别。使用`getSupportedThinkingLevels(model)`来确定具体模型是否暴露这两种级别之一；例如，GPT-5.6模型可以同时暴露这两种级别。

<a id="provider-specific-options-streamcomplete"></a>
### 提供商专用选项（stream/complete）

`models.stream()`/`complete()`接受其所属API的完整选项集。使用`hasApi()`来将动态查找的模型限定为其API，以实现完整选项的类型检查：

```typescript
import { hasApi } from '@earendil-works/pi-ai';

// OpenAI Reasoning (o1, o3, gpt-5)
const openaiModel = models.getModel('openai', 'gpt-5-mini')!;
if (hasApi(openaiModel, 'openai-responses')) {
  await models.complete(openaiModel, context, {
    reasoningEffort: 'medium',
    reasoningSummary: 'detailed'  // OpenAI Responses API only
  });
}

// Anthropic Thinking
const anthropicModel = models.getModel('anthropic', 'claude-sonnet-4-5')!;
if (hasApi(anthropicModel, 'anthropic-messages')) {
  await models.complete(anthropicModel, context, {
    thinkingEnabled: true,
    thinkingBudgetTokens: 8192  // Optional token limit
  });
}

// Google Gemini Thinking
const googleModel = models.getModel('google', 'gemini-2.5-flash')!;
if (hasApi(googleModel, 'google-generative-ai')) {
  await models.complete(googleModel, context, {
    thinking: {
      enabled: true,
      budgetTokens: 8192  // -1 for dynamic, 0 to disable
    }
  });
}
```

<a id="streaming-thinking-content"></a>
### 流式输出思考内容

在流式传输时，思考内容通过特定事件传递：

```typescript
const s = models.streamSimple(model, context, { reasoning: 'high' });

for await (const event of s) {
  switch (event.type) {
    case 'thinking_start':
      console.log('[Model started thinking]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);  // Stream thinking content
      break;
    case 'thinking_end':
      console.log('\n[Thinking complete]');
      break;
  }
}
```

<a id="stop-reasons"></a>
## 停止原因

每个`AssistantMessage`都包含一个`stopReason`字段，指示生成如何结束：

- `"pending"` - 仅在部分消息中出现，且我们尚不确定停止原因
- `"stop"` - 这是模型本轮将产生的最终消息
- `"length"` - 输出达到最大token限制
- `"toolUse"` - 模型正在调用工具并期待工具结果
- `"error"` - 生成过程中发生错误
- `"aborted"` - 通过abort信号取消请求

`AssistantMessage`还可能包含`responseId`，这是提供者特定的上游响应或消息标识符（当底层API暴露时）。不要假设它在所有提供者之间总是存在。

<a id="error-handling"></a>
## 错误处理

请求失败后返回流式数据永远不会抛出异常：当请求以错误结束（包括中止和工具调用验证错误）时，流式API会发出错误事件，最终消息会携带详细信息。设置失败可能会发出`error`而没有`start`；生成开始后失败会发出`start`，随后是观察到的更新，最后是`error`。直接API `streamSimple()`调用在缺少请求认证时会同步抛出异常：

```typescript
// In streaming
for await (const event of s) {
  if (event.type === 'error') {
    // event.reason is either "error" or "aborted"
    // event.error is the AssistantMessage with partial content
    console.error(`Error (${event.reason}):`, event.error.errorMessage);
    console.log('Partial content:', event.error.content);
  }
}

// The final message will have the error details
const message = await s.result();
if (message.stopReason === 'error' || message.stopReason === 'aborted') {
  console.error('Request failed:', message.errorMessage);
  // message.content contains any partial content received before the error
  // message.usage contains partial token counts and costs
}
```

当使用提供者集合时，认证失败（OAuth刷新失败、未知提供者）会作为流式错误以`stopReason: "error"`形式呈现。直接API `streamSimple()`调用在缺少其必需认证时会同步抛出异常。

<a id="aborting-requests"></a>
### 中止请求

abort信号允许您取消正在进行的请求。被中止的请求具有`stopReason === 'aborted'`：

```typescript
const controller = new AbortController();

// Abort after 2 seconds
setTimeout(() => controller.abort(), 2000);

const s = models.stream(model, {
  messages: [{ role: 'user', content: 'Write a long story', timestamp: Date.now() }]
}, {
  signal: controller.signal
});

for await (const event of s) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.delta);
  } else if (event.type === 'error') {
    // event.reason tells you if it was "error" or "aborted"
    console.log(`${event.reason === 'aborted' ? 'Aborted' : 'Error'}:`, event.error.errorMessage);
  }
}

// Get results (may be partial if aborted)
const response = await s.result();
if (response.stopReason === 'aborted') {
  console.log('Request was aborted:', response.errorMessage);
  console.log('Partial content received:', response.content);
  console.log('Tokens used:', response.usage);
}
```

<a id="continuing-after-abort"></a>
### 中止后继续

被中止的消息可以添加到对话上下文中，并在后续请求中继续：

```typescript
const context = {
  messages: [
    { role: 'user', content: 'Explain quantum computing in detail', timestamp: Date.now() }
  ]
};

// First request gets aborted after 2 seconds
const controller1 = new AbortController();
setTimeout(() => controller1.abort(), 2000);

const partial = await models.complete(model, context, { signal: controller1.signal });

// Add the partial response to context
context.messages.push(partial);
context.messages.push({ role: 'user', content: 'Please continue', timestamp: Date.now() });

// Continue the conversation
const continuation = await models.complete(model, context);
```

<a id="debugging-provider-payloads"></a>
### 调试提供商请求负载

使用`onPayload`回调来检查发送给提供者的请求负载。这对调试请求格式问题或提供者验证错误非常有用。

```typescript
const response = await models.complete(model, context, {
  onPayload: (payload) => {
    console.log('Provider payload:', JSON.stringify(payload, null, 2));
  }
});
```

该回调由`stream`、`complete`、`streamSimple`和`completeSimple`支持。

<a id="observing-provider-stream-events"></a>
### 观察提供商流事件
`onProviderStreamEvent` 用于检查 Pi 未包含在 `AssistantMessage` 中的提供商特定字段。回调会在适配器解析事件之前接收 Pi 未规范化的事件。由于突变可能会影响规范化，因此将事件视为只读。这并不保证是原始 HTTP 字节或 SSE 帧。

```typescript
const openRouterModel = models.getModel('openrouter', 'openrouter/auto')!;
const response = await models.complete(openRouterModel, context, {
  headers: { "X-OpenRouter-Metadata": "enabled" },
  onProviderStreamEvent: (data) => {
    const chunk = data as Record<string, unknown>;
    if (chunk.openrouter_metadata) {
      console.log(chunk.openrouter_metadata);
    }
  },
});
```

回调按流顺序等待，因此慢速回调会延迟流消费，抛出的错误会导致请求失败。由 SDK 支持的适配器只能暴露其 SDK 保留的字段。

<a id="custom-providers"></a>
##  自定义提供商

<a id="createprovider"></a>
###  createProvider()

`createProvider()` 从身份、认证、模型列表和 API 实现（`api` 用于聊天模型，`images` 用于图像生成，`classifiers` 用于分类；至少需要一个，详见 [图像生成](#image-generation)）构建提供商。可用于本地推理服务器、代理或任何与 OpenAI/Anthropic 兼容的端点：

```typescript
import { createModels, createProvider, envApiKeyAuth, type Model } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';

const ollamaModel: Model<'openai-completions'> = {
  id: 'llama-3.1-8b',
  name: 'Llama 3.1 8B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 32000
};

const ollama = createProvider({
  id: 'ollama',
  name: 'Ollama',
  baseUrl: 'http://localhost:11434/v1',
  // Every provider declares auth; keyless local servers resolve as configured with no key.
  auth: { apiKey: { name: 'Ollama', resolve: async () => ({ auth: {} }) } },
  models: [ollamaModel],
  api: openAICompletionsApi(),
});

const models = createModels();
models.setProvider(ollama);

await models.complete(models.getModel('ollama', 'llama-3.1-8b')!, context);
```

对于带有真实密钥的提供商，`envApiKeyAuth(displayName, envVars)` 会提供标准行为（存储凭证优先，然后是第一个设置的环境变量）：

```typescript
const proxy = createProvider({
  id: 'my-proxy',
  auth: { apiKey: envApiKeyAuth('My proxy API key', ['MY_PROXY_API_KEY']) },
  models: [/* ... */],
  api: openAICompletionsApi(),
});
```

混合 API 的提供商传递一个以 `model.api` 为键的映射；每个模型会路由到其 API 实现：

```typescript
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy';

const gateway = createProvider({
  id: 'my-gateway',
  auth: { apiKey: envApiKeyAuth('Gateway key', ['GATEWAY_API_KEY']) },
  models: [/* models with api: 'anthropic-messages' or 'openai-responses' */],
  api: {
    'anthropic-messages': anthropicMessagesApi(),
    'openai-responses': openAIResponsesApi(),
  },
});
```

提供商范围的端点或请求转换应放在提供商的 API 实现中：将你传递的 `ProviderStreams` 包装为 `api`，确保每个请求在分发前都经过转换。Cloudflare 提供商通过这种方式将已解析的提供商环境中的账户/网关端点占位符具体化：

```typescript
function tenantStreams(streams: ProviderStreams): ProviderStreams {
  const withTenant = (model: Model<Api>) => ({ ...model, baseUrl: model.baseUrl.replace('{tenant}', tenantId) });
  return {
    stream: (model, context, options) => streams.stream(withTenant(model), context, options),
    streamSimple: (model, context, options) => streams.streamSimple(withTenant(model), context, options),
  };
}

const tenantGateway = createProvider({
  id: 'tenant-gateway',
  auth: { apiKey: envApiKeyAuth('Gateway key', ['GATEWAY_API_KEY']) },
  models: [/* ... */],
  api: tenantStreams(openAICompletionsApi()),
});
```

动态模型列表使用 `fetchModels`，该方法可以返回所有类型的模型。`Models.refresh()` 会刷新所有已配置的动态提供商，传递其有效的 API 密钥或已刷新的 OAuth 凭证。`ModelsStore` 用于持久化动态目录；两个存储默认为内存实现。其 `read`、`write` 和 `delete` 操作可选取消，`Models` 会将这些等待与提供商刷新信号绑定。

```typescript
const models = createModels({ credentials, modelsStore });
const llamacpp = createProvider({
  id: 'llamacpp',
  auth: { apiKey: { name: 'llama.cpp', resolve: async () => ({ auth: {} }) } },
  models: [],
  fetchModels: async ({ signal }) => fetchModelsFromServer('http://localhost:8080', signal),
  api: openAICompletionsApi(),
});

models.setProvider(llamacpp);
const result = await models.refresh({ signal });
if (result.aborted) console.log('refresh cancelled');
for (const [provider, error] of result.errors) console.error(provider, error);
```

`Models.refresh()` 在省略可选信号时是无界的。提供商总会收到具体的 `RefreshModelsContext.signal`，并必须遵守它以进行网络请求和其他阻塞操作。当调用者提供信号时，`Models.refresh()` 会立即返回 `aborted: true`，即使自定义提供商未能合作；提供商仍必须遵守信号以停止其底层工作。

使用 `models.refresh({ providers: ['openrouter'] })` 限制工作到选定的提供商，`models.refresh({ allowNetwork: false })` 用于在没有网络访问的情况下恢复持久目录，或 `models.refresh({ force: true })` 用于绕过提供商新鲜度检查。模型读取保持同步，并返回最后恢复或刷新的列表。

`createProvider()` 会自动处理动态发布和持久化。手写的 `Provider.refreshModels()` 实现会接收只读的 `context.stored` 快照并通过 `context.publish({ persist?, update? })` 发布。省略 `persist` 会保持存储不变，传递 `ModelsStoreEntry` 用于写入，或传递 `persist: null` 用于删除。`ModelsStoreEntry.models` 包含所有类型的模型。发布时会进行生成检查；请将同步的内存目录更改放在 `update` 中，而不是在发布前修改状态。

自定义模型可以携带 `headers`（例如，代理后的机器人检测）和 `compat` 标志。`Models.getAuth(model)` 会包含这些模型头，并在显式请求头和 `transformHeaders` 之前合并流方法。详见 [OpenAI 兼容性设置](#openai-compatibility-settings)。

某些 OpenAI 兼容的服务器不理解 `developer` 角色（用于推理能力模型）。对于这些提供商，将 `compat.supportsDeveloperRole` 设置为 `false`，以便系统提示作为 `system` 消息发送。如果服务器也不支持 `reasoning_effort`，则将 `compat.supportsReasoningEffort` 设置为 `false`。这通常适用于 Ollama、vLLM、SGLang 等 OpenAI 兼容的服务器。
```typescript
const ollamaReasoningModel: Model<'openai-completions'> = {
  id: 'gpt-oss:20b',
  name: 'GPT-OSS 20B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: true,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 131072,
  maxTokens: 32000,
  thinkingLevelMap: {
    minimal: null,
    low: null,
    medium: null,
    high: 'high',
    xhigh: null,
  },
  compat: {
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
  }
};
```

使用模型级别的 `thinkingLevelMap` 描述模型特定的思维控制。键为 pi 思维等级（`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`）。缺少标准等级（通过 `high`）时使用提供方默认值；`xhigh` 和 `max` 为可选功能，需要非空映射条目。字符串值将发送给提供方，`null` 标记该等级不支持，映射可能跳过某些等级。

<a id="calling-api-implementations-directly"></a>
###  直接调用 API 实现

API 实现可以单独导入。每个模块导出与该 API 完整选项类型对应的 `stream` 和 `streamSimple`。直接调用会绕过提供方认证和上下文规范化——请显式传递 `apiKey` 并将上下文包装在 `normalizeContext()` 中：

```typescript
import { normalizeContext } from '@earendil-works/pi-ai';
import { stream } from '@earendil-works/pi-ai/api/anthropic-messages';

const s = stream(claudeModel, normalizeContext(context), {
  apiKey: process.env.ANTHROPIC_API_KEY,
  thinkingEnabled: true,
  thinkingBudgetTokens: 2048,
});
```


内置 API 实现位于 `./api/<api-id>`：

| API id | 选项类型 |
|--------|----------|
| `anthropic-messages` | `AnthropicOptions` |
| `openai-completions` | `OpenAICompletionsOptions` |
| `openai-responses` | `OpenAIResponsesOptions` |
| `openai-codex-responses` | `OpenAICodexResponsesOptions` |
| `azure-openai-responses` | `AzureOpenAIResponsesOptions` |
| `google-generative-ai` | `GoogleOptions` |
| `google-vertex` | `GoogleVertexOptions` |
| `mistral-conversations` | `MistralOptions` |
| `bedrock-converse-stream` | `BedrockOptions` |

导入实现模块会加载其 SDK。`./api/<id>.lazy` 包装器（由提供方工厂使用）会将加载推迟到首次请求，前提是运行时或打包器支持动态导入分块。旧版本中遗留的原始 API 子路径（`./anthropic`、`./google`、`./mistral`、`./openai-completions`、...）已移除；请使用 `@earendil-works/pi-ai/api/<api-id>`。

<a id="openai-compatibility-settings"></a>
###  OpenAI 兼容性设置

许多提供方实现了 `openai-completions` API，且存在细微差异。默认情况下，库会根据 `baseUrl` 自动检测一组已知 OpenAI 兼容提供方（如 Cerebras、xAI、Chutes、DeepSeek、NVIDIA NIM、Together AI、zAi、OpenCode、Cloudflare Workers AI 等）的兼容性设置。对于自定义代理或未知端点，您可以通过 `compat` 字段覆盖这些设置。对于 `openai-responses` 模型，compat 字段支持特定于响应的标志。
```typescript
interface OpenAICompletionsCompat {
  supportsStore?: boolean;           // Whether provider supports the `store` field (default: true)
  supportsDeveloperRole?: boolean;   // Whether provider supports `developer` role vs `system` (default: true)
  supportsReasoningEffort?: boolean; // Whether provider supports `reasoning_effort` (default: true)
  supportsUsageInStreaming?: boolean; // Whether provider supports `stream_options: { include_usage: true }` (default: true)
  supportsStrictMode?: boolean;      // Whether provider supports `strict` in tool definitions (default: false; enabled in metadata for capable built-in models)
  supportsOpenAIGrammarTools?: boolean; // Whether to emit OpenAI custom Lark/regex grammar tools; false falls back to normal function tools (default: false; the generated catalog enables it for capable models)
  supportsMidConvoSystemMessages?: boolean; // Whether the model accepts system messages after the conversation started; false folds them into the leading prompt (default: false; the generated catalog enables it for verified models)
  supportsMidConvoToolAdditions?: boolean; // Whether system messages can add tools mid-conversation via Kimi-style `tools` system messages; requires supportsMidConvoSystemMessages (default: false)
  sendSessionAffinityHeaders?: boolean; // Send session-affinity data from `sessionId` (default: true for OpenRouter, false otherwise)
  sessionAffinityFormat?: 'openai' | 'openai-nosession' | 'openrouter'; // Format for session affinity: 'openai' uses `prompt_cache_key`, `session_id`, `x-client-request-id`, and `x-session-affinity`; 'openai-nosession' uses `prompt_cache_key`, `x-client-request-id`, and `x-session-affinity`; 'openrouter' uses `x-session-id` (default: auto-detected)
  maxTokensField?: 'max_completion_tokens' | 'max_tokens';  // Which field name to use (default: max_completion_tokens)
  requiresToolResultName?: boolean;  // Whether tool results require the `name` field (default: false)
  requiresAssistantAfterToolResult?: boolean; // Whether tool results must be followed by an assistant message (default: false)
  requiresThinkingAsText?: boolean;  // Whether thinking blocks must be converted to text (default: false)
  requiresReasoningContentOnAssistantMessages?: boolean; // Whether all replayed assistant messages must include empty reasoning_content when reasoning is enabled (default: auto-detected for DeepSeek)
  thinkingFormat?: 'openai' | 'openrouter' | 'deepseek' | 'together' | 'baseten' | 'zai' | 'qwen' | 'chat-template' | 'qwen-chat-template' | 'string-thinking' | 'ant-ling'; // Format for reasoning param: 'openai' uses reasoning_effort, 'openrouter' uses reasoning: { effort }, 'deepseek' uses thinking: { type } plus reasoning_effort when supported, 'together' uses reasoning: { enabled } plus reasoning_effort when supported, 'baseten' uses configurable chat_template_args plus reasoning_effort when supported, 'zai' uses thinking: { type }, 'qwen' uses enable_thinking, 'chat-template' uses configurable chat_template_kwargs, 'qwen-chat-template' uses chat_template_kwargs.enable_thinking and preserve_thinking, 'string-thinking' uses top-level thinking, 'ant-ling' uses reasoning: { effort } only for mapped efforts (default: openai)
  chatTemplateKwargs?: Record<string, string | number | boolean | null | { '$var': 'thinking.enabled' | 'thinking.effort' | 'thinking.budget'; omitWhenOff?: boolean }>; // chat_template_kwargs values; use $var for pi-controlled thinking values
  chatTemplateArgs?: Record<string, string | number | boolean | null | { '$var': 'thinking.enabled' | 'thinking.effort' | 'thinking.budget'; omitWhenOff?: boolean }>; // chat_template_args values for thinkingFormat: 'baseten'; use $var for pi-controlled thinking values
  thinkingTokenBudgetField?: 'thinking_token_budget' | 'thinking_budget' | 'thinking_budget_tokens'; // Top-level field that caps reasoning tokens from thinkingBudgets (vLLM / Qwen / llama.cpp). Off by default.
  supportsThinkingTokenBudget?: boolean; // Alias for thinkingTokenBudgetField: 'thinking_token_budget' (vLLM). Prefer thinkingTokenBudgetField. Default: false.
  cacheControlFormat?: 'anthropic';  // Anthropic-style cache_control on system prompt, last tool, and last user/assistant text content
  openRouterRouting?: OpenRouterRouting; // OpenRouter routing preferences (default: {})
  vercelGatewayRouting?: VercelGatewayRouting; // Vercel AI Gateway routing preferences (default: {})
}

interface OpenAIResponsesCompat {
  supportsDeveloperRole?: boolean;   // Whether provider supports `developer` role vs `system` (default: true)
  sessionAffinityFormat?: 'openai' | 'openai-nosession' | 'openrouter'; // Session-affinity header format: 'openai' sends `session_id` and `x-client-request-id`; 'openai-nosession' sends `x-client-request-id`; 'openrouter' sends `x-session-id`. Does not affect the `prompt_cache_key` body param (default: auto-detected)
  supportsLongCacheRetention?: boolean; // Whether provider supports `prompt_cache_retention: "24h"` (default: true)
  supportsStrictMode?: boolean;      // Whether provider supports strict JSON-schema function tools (default: false; enabled in metadata for built-in OpenAI models)
  supportsOpenAIGrammarTools?: boolean; // Whether to emit OpenAI custom Lark/regex grammar tools; false falls back to normal function tools (default: false; the generated catalog enables it for capable models)
}
```

向OpenRouter发送请求时，如果启用了提示缓存，会从`sessionId`中获取`x-session-id`。Chat Completions和Anthropic消息都会自动检测OpenRouter端点，除非`sendSessionAffinityHeaders`被显式设置为false。在兼容Anthropic的模型上，`sessionAffinityFormat: "openrouter"`会选择`x-session-id`；如果未设置，则使用现有的`x-session-affinity`格式。显式请求头优先于自动生成的头。

如果`compat`未设置，库将回退到基于URL的检测。如果`compat`部分设置，未指定的字段将使用检测到的默认值。这在以下情况下很有用：

- **LiteLLM代理**：可能不支持`store`字段  
- **自定义推理服务器**：可能使用非标准字段名  
- **自托管端点**：可能有不同的功能支持  

<a id="faux-provider-for-tests"></a>
## 用于测试的模拟提供商

`fauxProvider()`构建了一个内存提供程序，用于测试和演示的脚本响应：

```typescript
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from '@earendil-works/pi-ai';

const faux = fauxProvider({
  tokensPerSecond: 50 // optional
});

const models = createModels();
models.setProvider(faux.provider);

const model = faux.getModel();
const context = {
  messages: [{ role: 'user', content: 'Summarize package.json and then call echo', timestamp: Date.now() }]
};

faux.setResponses([
  fauxAssistantMessage([
    fauxThinking('Need to inspect package metadata first.'),
    fauxToolCall('echo', { text: 'package.json' })
  ], { stopReason: 'toolUse' })
]);

const first = await models.complete(model, context, {
  sessionId: 'session-1',
  cacheRetention: 'short'
});
context.messages.push(first);

context.messages.push({
  role: 'toolResult',
  toolCallId: first.content.find((block) => block.type === 'toolCall')!.id,
  toolName: 'echo',
  content: [{ type: 'text', text: 'package.json contents here' }],
  isError: false,
  timestamp: Date.now()
});

faux.setResponses([
  fauxAssistantMessage([
    fauxThinking('Now I can summarize the tool output.'),
    fauxText('Here is the summary.')
  ])
]);

const s = models.stream(model, context);
for await (const event of s) {
  console.log(event.type);
}

// Optional: multiple faux models for model-switching tests
const multiModel = fauxProvider({
  provider: 'faux-multi',
  models: [
    { id: 'faux-fast', reasoning: false },
    { id: 'faux-thinker', reasoning: true }
  ]
});
models.setProvider(multiModel.provider);
const thinker = multiModel.getModel('faux-thinker');

console.log(thinker?.reasoning);
console.log(faux.getPendingResponseCount());
console.log(faux.state.callCount);
```

注意事项：
- 响应按请求启动顺序从队列中消费。  
- 如果队列为空，伪提供程序将返回一条助手错误消息，内容为`errorMessage: "No more faux responses queued"`。  
- 使用`faux.setResponses([...])`替换剩余队列，并使用`faux.appendResponses([...])`添加更多响应。  
- `faux.models`暴露所有伪模型。`faux.getModel()`返回第一个模型，`faux.getModel(id)`返回特定模型。  
- 使用`fauxAssistantMessage(...)`进行脚本助手回复。使用`fauxText(...)`、`fauxThinking(...)`和`fauxToolCall(...)`构建内容块，无需手动填充低级字段。  
- 估算使用量约为每4个字符1个token。当`sessionId`存在且`cacheRetention`不等于`"none"`时，自动模拟提示缓存的读写操作。  
- 工具调用参数通过`toolcall_delta`分块增量流式传输。  
- 默认情况下，每个分块单独通过微任务发出。设置`tokensPerSecond`以实时控制分块交付速度。
- 预期用途是每个句柄一个确定性的脚本流程。如果您需要独立并发的流程，请创建具有不同`provider` ID的独立伪装提供者。

<a id="cross-provider-handoffs"></a>
## 跨提供者交接

该库支持在同一对话中不同LLM提供者之间的无缝交接。这允许您在对话中切换模型时保持上下文，包括思考块、工具调用和工具结果。

当来自一个提供者的消息发送到另一个提供者时，库会自动将它们转换为兼容格式：

- **用户和工具结果消息**将保持不变
- **来自同一提供者/API的助手消息**将保持原样
- **来自不同提供者的助手消息**会将思考块转换为带`<thinking>`标签的文本
- **工具调用和普通文本**将保持不变

```typescript
import { createModels, type Context } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { googleProvider } from '@earendil-works/pi-ai/providers/google';

const models = createModels();
models.setProvider(anthropicProvider());
models.setProvider(openaiProvider());
models.setProvider(googleProvider());

const context: Context = { messages: [] };

// Start with Claude
const claude = models.getModel('anthropic', 'claude-sonnet-4-5')!;
context.messages.push({ role: 'user', content: 'What is 25 * 18?', timestamp: Date.now() });
context.messages.push(await models.completeSimple(claude, context, { reasoning: 'medium' }));

// Switch to GPT-5 - it will see Claude's thinking as <thinking> tagged text
const gpt5 = models.getModel('openai', 'gpt-5-mini')!;
context.messages.push({ role: 'user', content: 'Is that calculation correct?', timestamp: Date.now() });
context.messages.push(await models.complete(gpt5, context));

// Switch to Gemini
const gemini = models.getModel('google', 'gemini-2.5-flash')!;
context.messages.push({ role: 'user', content: 'What was the original question?', timestamp: Date.now() });
const geminiResponse = await models.complete(gemini, context);
```

所有提供者都可以处理来自其他提供者的消息——文本、工具调用和结果（包括图片）、思考块（转换为带标签的文本），以及带有部分内容的已中止消息。这使得工作流程更加灵活：可以先用快速模型，再切换到更强大的模型进行复杂推理，或者在提供者中断时保持连续性。

<a id="system-messages"></a>
## 系统消息

`Context.systemPrompt`和`Context.tools`是前置系统消息的简写。公共入口点（`Models.stream()`、`streamSimple()`、`complete()`、`completeSimple()`）接受一个`Context`并调用一次`normalizeContext()`；它们下方的所有内容，包括`Provider.stream()`、`ProviderStreams`以及API实现模块，都会收到结果`TranscriptContext`，该结果仅包含`messages`。对话的后续部分也可以携带系统消息，以更改提示或工具集，而无需重写历史：

```typescript
interface SystemMessage {
  role: "system";
  content: string | TextContent[];             // leading: base prompt; later: added instructions
  sections?: Record<string, string | null>;    // named prompt sections; later messages patch by name, null removes
  toolsAdded?: Tool[];                         // tools that become available here
  toolsRemoved?: ToolReference[];              // tools that stop being available here
  timestamp: number;
}
```

段落是`content`之后的纯文本，用空行连接。请保持每个段落自包含（如标签或标题），以便模型能够将更新与原始内容关联。按顺序回放所有系统消息即可获得当前提示和工具；回放助手会处理消息列表：
```typescript
import { getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";

const messages: Message[] = [
  { role: "system", content: "You are helpful.", sections: { rules: "<rules>Be brief.</rules>" }, toolsAdded: [readTool], timestamp: 1 },
  { role: "user", content: "hi", timestamp: 2 },
  { role: "system", content: "", sections: { rules: "<rules>Be thorough.</rules>" }, toolsRemoved: [{ name: "read" }], timestamp: 3 },
];
getCurrentSystemPrompt(messages); // "You are helpful.\n\n<rules>Be thorough.</rules>"
getCurrentTools(messages);        // []
```

自定义`Provider`或`ProviderStreams`实现以与`context.messages`相同的方式读取提示和工具；`context.systemPrompt`和`context.tools`在该层不存在。

接受对话中途系统消息的模型（`supportsMidConvoSystemMessages`在模型的兼容设置中，由生成目录为已验证模型设置）会将每个后续系统消息替换进来，因此缓存的前缀保持完整；模型通过名称对章节变更进行框定。其他所有模型接收`collapseSystemMessages(transcript)`：重放的提示和当前工具作为首要系统消息，后续系统消息被丢弃。同时设置`supportsMidConvoToolChanges`的Anthropic模型会将工具变更作为原生块（`inline-tools-2026-09-15` beta）发送：顶层工具列表保持初始工具和一个稳定的延迟占位符，永不变更，后续工具在`tool_addition`块中按值定义（在现有名称下新增定义会替换旧定义），移除操作为`tool_removal`引用，因此工具变更不会使提示缓存失效。这需要至少一个初始工具；否则，当前工具列表会与系统文本一同作为顶层发送。带有`supportsAdditionalTools`或`supportsToolSearch`锚点的OpenAI Responses模型会将增量工具变更锚定在消息中；其他模型会将当前工具列表作为顶层发送。

<a id="context-serialization"></a>
## 上下文序列化

`Context`对象可以轻松使用标准JSON方法进行序列化和反序列化，便于持久化对话、实现聊天历史或在服务间传递上下文：

```typescript
const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: 'What is TypeScript?', timestamp: Date.now() }
  ]
};

const model = models.getModel('openai', 'gpt-4o-mini')!;
const response = await models.complete(model, context);
context.messages.push(response);

// Serialize the entire context
const serialized = JSON.stringify(context);

// Save to database, localStorage, file, etc.
localStorage.setItem('conversation', serialized);

// Later: deserialize and continue the conversation
const restored: Context = JSON.parse(localStorage.getItem('conversation')!);
restored.messages.push({ role: 'user', content: 'Tell me more about its type system', timestamp: Date.now() });

// Continue with any model
const newModel = models.getModel('anthropic', 'claude-3-5-haiku-20241022')!;
const continuation = await models.complete(newModel, restored);
```

模型本身也是纯序列化数据——没有附加函数或实现——因此持久化“本次对话使用了哪个模型”非常简单，只需`JSON.stringify`即可。

> **注意**：如果上下文包含图片（如图片输入部分所示，以base64编码），这些图片也会被序列化。

<a id="browser-usage"></a>
## 浏览器使用
该库支持浏览器环境。核心入口和提供程序工厂无副作用且打包干净。浏览器中不可用环境变量，因此请显式传递API密钥——或注入`CredentialStore`（例如基于localStorage的）并让提供程序认证从存储凭证中解析：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';

const models = createModels();
models.setProvider(anthropicProvider());

const model = models.getModel('anthropic', 'claude-3-5-haiku-20241022')!;
const response = await models.complete(model, {
  messages: [{ role: 'user', content: 'Hello!', timestamp: Date.now() }]
}, {
  apiKey: 'your-api-key'
});
```

> **安全警告**：在前端代码中暴露API密钥非常危险。任何人都可以提取并滥用您的密钥。仅建议用于内部工具或演示。生产应用请使用后端代理以确保API密钥安全。

浏览器兼容性说明：

- Amazon Bedrock（`bedrock-converse-stream`）不支持浏览器环境。它仍可能出现在模型列表中；调用会在运行时失败。
- OAuth登录流程仅限Node环境。它们通过打包器透明导入懒加载，因此注册支持OAuth的提供程序不会将Node代码拉入浏览器包——只有实际登录时才会加载。
- 如果您需要从网页应用中使用Bedrock或基于OAuth的认证，请使用服务器端代理或后端服务。

<a id="bundling-and-tree-shaking"></a>
## 打包与树摇

对于小包和低开销的独立脚本，请导入模型运行时和仅需的提供程序：

```typescript
import { createModels } from '@earendil-works/pi-ai/models';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';

const models = createModels();
models.setProvider(openaiProvider());
```

规则：

- `@earendil-works/pi-ai/models`导出模型运行时（`createModels`、`createProvider`、模型助手及其类型）但不包含TypeBox、内置目录或SDK实现。其他类型仍可从根目录使用`import type`。
- `@earendil-works/pi-ai`为核心入口，不导入内置目录、真实提供程序工厂或SDK实现，但会主动导入TypeBox和模式验证。独立Node脚本不会树摇其未使用的导出项；仅需时请优先使用`./models`、`./providers/faux`及特定`./utils/*`子路径。
- `@earendil-works/pi-ai/providers/<provider>`仅导入该提供程序的目录和懒加载API包装器。
- `@earendil-works/pi-ai/providers/all`导入所有内置提供程序工厂和目录。仅当需要完整内置集时使用。
- 使用代码分割时，提供程序SDK会保留在懒加载的chunk中并在首次请求时加载。
- 不使用代码分割时，打包器会将可达的懒加载API实现折叠进单一包。单一提供程序包则包含该提供程序的SDK；`providers/all`包含所有静态可见的SDK。Bedrock是特例：其AWS SDK实现通过打包器透明的Node导入加载。
- 直接导入`@earendil-works/pi-ai/api/<api-id>`会立即加载该API实现及其SDK。

避免在新打包应用中使用`@earendil-works/pi-ai/compat`；它保留了旧的全局API并导入完整的内置目录表面。

对于单文件Node ESM打包，某些SDK依赖项仍可能内部使用动态CommonJS `require()`。若出现`Dynamic require of "child_process" is not supported`错误，请为打包添加Node `require`垫片。使用esbuild：

```bash
esbuild app.js --bundle --platform=node --format=esm \
  --banner:js='import { createRequire } from "module";const require = createRequire(import.meta.url);' \
  --outfile=app.bundle.js
```

此方法仅适用于Node打包，非浏览器或Cloudflare Workers的解决方案。

Bedrock仅限Node。添加方式与其他提供程序相同：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { amazonBedrockProvider } from '@earendil-works/pi-ai/providers/amazon-bedrock';

const models = createModels();
models.setProvider(amazonBedrockProvider());
```

在正常Node包使用和代码分割包中，Bedrock会懒加载其AWS SDK实现。若为必须包含Bedrock支持的单文件独立包，请显式注册实现模块：

```typescript
import { setBedrockProviderModule } from '@earendil-works/pi-ai/api/bedrock-converse-stream.lazy';
import { bedrockProviderModule } from '@earendil-works/pi-ai/bedrock-provider';

setBedrockProviderModule(bedrockProviderModule);
```

该显式覆盖会打包AWS SDK。否则，Bedrock的透明运行时导入期望在运行时可用该包的Bedrock实现文件。

### 提供程序作用域环境覆盖

通过stream选项传递`env`以将提供程序配置作用域到请求。`env`中的值会在提供程序认证和配置（如Cloudflare账号ID、Azure OpenAI设置、Vertex项目/位置、Bedrock设置、`PI_CACHE_RETENTION`、`HTTP_PROXY`/`HTTPS_PROXY`）中优先于process环境变量。

```typescript
const models = builtinModels();
const model = models.getModel('cloudflare-ai-gateway', 'workers-ai/@cf/moonshotai/kimi-k2.6')!;

const response = await models.complete(model, context, {
  env: {
    CLOUDFLARE_API_KEY: '...',
    CLOUDFLARE_ACCOUNT_ID: 'account-id',
    CLOUDFLARE_GATEWAY_ID: 'gateway-id'
  }
});
```

在需要每个请求不同提供程序设置或环境变量不应泄露到提供程序调用时使用。

<a id="oauth-providers"></a>
## OAuth提供程序

多个提供程序支持OAuth认证而非静态API密钥：

- **Anthropic**（Claude Pro/Max订阅）
- **OpenAI**（使用ChatGPT登录：使用ChatGPT订阅的OpenAI API）
- **OpenAI Codex（旧版）**（ChatGPT Plus/Pro 订阅，可访问 GPT-5.x Codex 模型）
- **GitHub Copilot**（Copilot 订阅）
- **OpenRouter**（OAuth PKCE，铸造用户控制的 API 密钥）
每个提供程序都携带一个 `OAuthAuth`，该提供程序在 `provider.auth.oauth` 上执行三个操作：`login(interaction)` 使用通用的 `AuthInteraction.prompt()`/`notify()` 协议并返回凭证，`refresh(credential, signal)` 在适用时刷新过期凭证，`toAuth(credential)` 生成请求授权（GitHub Copilot 的每个账户基础 URL 即由此获取）。提供程序的登录交互和刷新调用始终携带明确的中止信号。刷新是自动的：`models.getAuth(providerId)` 和请求路径在凭证存储锁定下刷新过期令牌，因此并发请求和进程无法重复刷新。OpenRouter 的 OAuth 流程返回的是永久 API 密钥，因此其刷新操作是无效操作。
```typescript
import { createModels } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';

const models = createModels({ credentials: myStore }); // persistent CredentialStore
models.setProvider(anthropicProvider());

// Login: Models drives the flow and persists the credential
await models.login('anthropic', 'oauth', {
  prompt: async (p) => {
    // p.type: 'text' | 'secret' | 'select' | 'manual_code'
    // manual_code prompts race a local callback server; p.signal aborts them when the server wins
    return await askUser(p.message);
  },
  notify: (event) => {
    // event.type: 'info' | 'auth_url' | 'device_code' | 'progress'
    if (event.type === 'info') {
      console.log(event.message);
      for (const link of event.links ?? []) console.log(`${link.label ?? 'More information'}: ${link.url}`);
    }
    if (event.type === 'auth_url') console.log(`Open: ${event.url}`);
    if (event.type === 'device_code') console.log(`Code: ${event.userCode} at ${event.verificationUri}`);
    if (event.type === 'progress') console.log(event.message);
  },
});

// From here on, requests resolve and refresh the token automatically
const model = models.getModel('anthropic', 'claude-sonnet-4-5')!;
await models.complete(model, context);

// Logout
await models.logout('anthropic');
```

<a id="vertex-ai"></a>
### Vertex AI

Vertex AI 模型支持 Google Cloud API 密钥或应用默认凭据（ADC）。其由提供商拥有的 API 密钥登录流程可以配置这两种方法中的任意一种：
- **API密钥**：设置`GOOGLE_CLOUD_API_KEY`，或在调用选项中传递`apiKey`。
- **本地开发（ADC）**：运行`gcloud auth application-default login`
- **CI/生产环境（ADC）**：设置`GOOGLE_APPLICATION_CREDENTIALS`，使其指向服务账户的JSON密钥文件

使用ADC时，还需设置`GOOGLE_CLOUD_PROJECT`（或`GCLOUD_PROJECT`）和`GOOGLE_CLOUD_LOCATION`。你也可以在调用选项中传递`project`/`location`。使用`GOOGLE_CLOUD_API_KEY`时，`project`和`location`无需设置。

```bash
# Local (uses your user credentials)
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT="my-project"
export GOOGLE_CLOUD_LOCATION="us-central1"

# CI/Production (service account key file)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

官方文档：[应用默认凭证](https://cloud.google.com/docs/authentication/application-default-credentials)

<a id="cli-login"></a>
### CLI登录

最快捷的认证方式：

```bash
npx @earendil-works/pi-ai login              # interactive provider selection
npx @earendil-works/pi-ai login anthropic    # login to specific provider
npx @earendil-works/pi-ai list               # list available providers
```

凭证会保存到当前目录下的`auth.json`。

<a id="programmatic-oauth"></a>
### 程序化OAuth

内置的登录和刷新流程是私有提供商的实现。使用提供商拥有的`OAuthAuth`，它与`CredentialStore`组合，并通过`Models`实现自动刷新锁定。`@earendil-works/pi-ai/oauth`入口点仅保留编码代理扩展OAuth兼容性所需的类型声明。
提供者说明：

**OpenAI Codex（旧版）**：已被 OpenAI 提供商上的“使用 ChatGPT 登录”功能取代。需要 ChatGPT Plus 或 Pro 订阅。可访问 GPT-5.x Codex 模型，具备扩展的上下文窗口和推理能力。库会自动处理基于会话的提示缓存，当流选项中提供 `sessionId` 时生效，除非 `cacheRetention` 等于 `"none"`。您可以在流选项中将 `transport` 设置为 `"sse"`、`"websocket"` 或 `"auto"`，以选择 Codex 响应的传输方式。当使用 WebSocket 并且 `sessionId` 启用了缓存保留时，连接会按会话复用，且在 5 分钟内无活动后过期。完成时调用 `cleanupSessionResources(sessionId)`，以防止池化连接使进程保持运行。

**Azure OpenAI（响应）**：仅使用响应 API。设置 `AZURE_OPENAI_API_KEY` 和 `AZURE_OPENAI_BASE_URL` 或 `AZURE_OPENAI_RESOURCE_NAME`。`AZURE_OPENAI_BASE_URL` 支持 `https://<resource>.openai.azure.com` 和 `https://<resource>.cognitiveservices.azure.com`；根端点会自动规范化为 `.../openai/v1`。如需覆盖 API 版本，可使用 `AZURE_OPENAI_API_VERSION`（默认为 `v1`）。部署名称默认作为模型 ID 处理，如需覆盖，可用 `azureDeploymentName` 或 `AZURE_OPENAI_DEPLOYMENT_NAME_MAP`，以逗号分隔 `model-id=deployment` 对（例如 `gpt-4o-mini=my-deployment,gpt-4o=prod`）。不支持旧版基于部署的 URL。
**GitHub Copilot**：如果您收到“The requested model is not supported”错误，请在VS Code中手动启用该模型：打开Copilot聊天窗口，点击模型选择器，选择模型（警告图标），然后点击“启用”。

<a id="migrating-from-the-old-global-api"></a>
## 迁移自旧的全局API

旧版本暴露了一个全局API：`stream()`/`complete()`通过`model.api`的全局注册表进行分发，同步`getModel()`/`getModels()`/`getProviders()`目录读取，`registerApiProvider()`，`getEnvApiKey()`，以及每个API的懒加载流函数。该接口在**兼容入口点**中保持不变：

```typescript
// Before
import { getModel, complete } from '@earendil-works/pi-ai';

// After (verbatim behavior, one import-path change)
import { getModel, complete } from '@earendil-works/pi-ai/compat';
```

兼容入口是根入口的严格超集，因此文件可以完全切换导入路径。它将在未来的版本中移除；请迁移到`createModels()` + provider工厂：

| 旧版 | 新版 |
|-----|-----|
| `getModel('openai', 'gpt-4o-mini')` | `models.getModel('openai', 'gpt-4o-mini')` or `getBuiltinModel()` from `providers/all` |
| `getModels('anthropic')` / `getProviders()` | `models.getModels('anthropic')` / `models.getProviders()` or `getBuiltin*` |
| `stream(model, ctx, opts)` (env-key injection) | `models.stream(model, ctx, opts)` (provider auth resolution) |
| `registerApiProvider({ api, stream, streamSimple })` | `createProvider({ id, auth, models, api })` + `models.setProvider()` |
| `getEnvApiKey('openai')` | `await models.getAuth(model.provider)` |
| `streamAnthropic(model, ctx, opts)` | 来自 `@earendil-works/pi-ai/api/anthropic-messages` 的 `stream`，或集合中的提供商 |
| `registerFauxProvider()` | `fauxProvider()` + `models.setProvider()` |
| `getImageModel('openrouter', id)` / `generateImages(model, ctx, { apiKey })` | `models.getModelOfType('image', 'openrouter', id)` / `models.generateImages(model, ctx)` |

曾经短暂存在的 `ImagesModels`/`ImagesProvider` 集合已删除（`createImagesModels()`、`createImagesProvider()`、`openrouterImagesProvider()`、`builtinImagesModels()`）：图像模型现已直接托管在常规提供商上。将 `builtinImagesModels()` 替换为 `builtinModels()`，将 `imagesModels.getModel()` 替换为 `models.getModelOfType('image', ...)`，将 `createImagesProvider({ models, api })` 替换为 `createProvider({ models, images })`。已移除旧的复数图像类型名称；使用 `ImageModel` 和 `ImageApi`，并向图像模型字面量中添加 `type: "image"`。

<a id="development"></a>
##  开发

###  添加新提供商

添加新的大语言模型（LLM）提供商需要对多个文件进行修改。分层布局如下：API 实现位于 `src/api/`，提供商工厂位于 `src/providers/`，稳定的生成目录包装器位于 `src/providers/<id>.models.ts`，而 `src/models.generated.ts` 负责注册它们。此检查清单涵盖了所有必要步骤：

####  1. 核心类型（`src/types.ts`）

-  如果是新 API，请将 API 标识符添加到 `KnownApi`（例如 `"bedrock-converse-stream"`）
-  将提供商名称添加到 `KnownProvider`（例如 `"amazon-bedrock"`）
-  将选项类型添加到 `ApiOptionsMap`

####  2. API 实现（`src/api/<api-id>.ts`，仅限新 API）

创建一个新的 API 实现文件（例如 `bedrock-converse-stream.ts`），该文件仅导出 `stream` 和 `streamSimple`，并包含：

-  一个继承自 `StreamOptions` 的选项接口（例如 `BedrockOptions`）
-  消息转换函数，用于将 `TranscriptContext` 消息转换为提供商格式；使用 `getInitialSystemMessage()`、`getCurrentTools()` 和 `resolveTranscript()` 读取提示和工具。
- 工具转换，如果提供方支持工具  
- 响应解析以发出标准化事件（`text`，`tool_call`，`thinking`，`usage`，`stop`）  

添加一个懒加载包装器 `src/api/<api-id>.lazy.ts`（通过 `lazyApi()` 使用 `<name>Api()`），以便提供方可以引用实现而无需导入其SDK。在 `src/index.ts` 中添加任何根级别的 `export type` 重导出，这些应继续从 `@earendil-works/pi-ai` 中可用。  

#### 3. 模型生成（`scripts/generate-models.ts`）  

- 添加逻辑以从提供方源（例如 models.dev API）获取和解析模型  
- 将聊天/工具型提供方数据映射到 `Model`，图像生成数据映射到 `ImageModel`，models.dev `type: "decision"` 条目映射到 `ClassifierModel`；通过 API 对忽略的 `src/providers/data/<id>.json` 值进行分组，而稳定的 `src/providers/<id>.models.ts` 包装器直接从这些 JSON 键派生出精确的模型/API 类型  
- 保持每个提供方和模型类型的模型ID唯一；当上游模型支持多个操作时，发出单独条目  
- 处理提供方特定的异常（价格格式、能力标志、模型ID转换等）  

#### 4. 提供方工厂（`src/providers/<id>.ts`）  

- `createProvider()` 线路目录 + 认证 + 懒加载API包装器  
- 认证：`envApiKeyAuth` 用于标准密钥提供方，用于环境认证（AWS配置文件、ADC）的自定义 `ApiKeyAuth`，以及存在OAuth流程时的 `lazyOAuth`  
- 将工厂注册到 `src/providers/all.ts`  
- 如果是新API：将其注册到 `src/compat.ts` 内置列表，并在 `package.json` 中添加包子路径导出  

#### 5. 测试（`test/`）  

创建或更新测试文件以覆盖新提供方：  

- `stream.test.ts` - 基本流式传输和工具使用  
- `tokens.test.ts` - 令牌使用报告  
- `abort.test.ts` - 请求取消  
- `empty.test.ts` - 空消息处理  
- `context-overflow.test.ts` - 上下文限制错误
- `image-limits.test.ts` - 图像支持（如适用）
- `unicode-surrogate.test.ts` - Unicode 处理
- `tool-call-without-result.test.ts` - 遗弃的工具调用
- `image-tool-result.test.ts` - 工具结果中的图像
- `total-tokens.test.ts` - 令牌计数准确性
- `cross-provider-handoff.test.ts` - 跨提供商上下文回放
- `providers.test.ts` - 提供商列表和身份验证解析

对于 `cross-provider-handoff.test.ts`，请至少添加一个提供商/模型对。如果提供商暴露了多个模型家族（例如 GPT 和 Claude），则每个家族至少添加一对。

对于具有非标准身份验证的提供商（AWS、Google Vertex），创建类似于 `bedrock-utils.ts` 的实用工具，用于凭证检测。

#### 6. 代码智能体集成（`../coding-agent/`）

更新 `src/core/model-resolver.ts`：

- 为提供商在 `DEFAULT_MODELS` 中添加默认模型 ID

更新 `src/cli/args.ts`：

- 在帮助文本中添加环境变量文档

更新 `README.md`：

- 将提供商添加到提供商部分，并包含设置说明

#### 7. 文档

更新 `packages/ai/README.md`：

- 添加到支持的提供商表中
- 记录任何提供商特定的选项或身份验证要求
- 将环境变量添加到环境变量部分

#### 8. 版本更新日志

在 `packages/ai/CHANGELOG.md` 下的 `## [Unreleased]` 中添加条目：

```markdown
### Added
- Added support for [Provider Name] provider ([#PR](link) by [@author](link))
```

<a id="license"></a>
## 许可证

MIT

