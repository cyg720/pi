# 代码模式

`codemode`工具允许模型编写一个JavaScript脚本，调用pi的其他工具并运行非LLM模型，例如分类器和图像模型。只有脚本的输出会传递给模型，因此脚本可以并行执行调用并过滤模型看到之前的大结果。要启用它，请参见[启用代码模式](cli.md#enable-codemode)。

## 脚本

工具输入是原始JavaScript源代码，不是JSON也不是Markdown代码块。它在QuickJS沙箱中作为异步函数的主体运行，因此顶级`await`和`return`可以正常工作。沙箱没有Node API、文件系统、网络或计时器；脚本只能通过工具和`models`与外部世界通信。

脚本可以以一个选项行开始：

```js
// @options: {"max_output_tokens": 2000, "timeout_ms": 60000}
```

- `max_output_tokens`（默认值为10000）限制了输出长度。如果输出过长，会保留开头和结尾，并将完整文本写入一个临时文件，文件路径包含在结果中。当脚本输出的文本和base64图像数据超过16777216个字符或`text()`、`image()`和`console`调用超过100000次时，脚本会失败；请改用工具将大数据写入文件。

- `timeout_ms`是整个脚本的硬性截止时间。默认未设置。图像生成可能需要几分钟，因此请勿为生成图像的脚本设置过短的截止时间。

结果以`Script completed`或`Script failed`开头，接着是墙时间和输出。失败的脚本会保留其部分输出，然后是`Script error:`和错误信息。工具调用是真实的：失败前的调用不会被回滚。脚本结束时仍在运行的调用会被取消，未等待的Promise会被丢弃。

## 全局变量

| 全局变量 | 用途 |
|---|---|
| `tools.<name>(args)` | 调用工具。详见[调用工具](#call-tools)。 |
| `text(value)` | 向输出添加文本项。字符串会原样添加，其他值会以JSON形式添加。 |
| `image(value)` | 向输出添加图像：可以是base64 `data:` URL、`{ image_url }`对象或图像块`{ type: "image", data, mimeType }`（例如MCP工具和`models.generateImages()`返回的那些）。不支持远程URL。接受PNG、JPEG、GIF和WebP格式。每张图像也会保存到临时文件，结果中会包含图像前的文件路径。 |
| `console.log(...)` | 与 `text()`; `info`、`warn`、`error` 和 `debug` 功能相同。 |
| `return value` | 顶级 `return` 会添加 `text()` 的值。 |
| `exit()` | 成功结束脚本。 |
| `store(key, value)` / `load(key)` | 在 `codemode` 调用中跨调用保持小的 JSON 值。请参见 [Store values](#store-values)。 |
| `ALL_TOOLS` | 每个可调用工具均为 `{ name, description }`，包括描述中未列出的工具。 |
| `searchTools(query, { limit?, namespace? })` | 按相关性（BM25，默认限制为 8）对可调用工具进行排序。结果为 `{ name, description }[]`。 |
| `describeTool(name)` | 解析为工具的描述和 TypeScript 声明，或 `undefined`。 |
| `describeNamespace(name)` | 解析为命名空间（如 MCP 服务器）的 `{ name, description?, instructions?, tools }`，或 `undefined`。 |
| `models` | 列出并运行非 LLM 模型。请参见 [Models](#models)。 |

<a id="call-tools"></a>
##  调用工具

会话中可以调用的每个工具都是 `tools` 的一个方法，以它的标识符命名：JavaScript 标识符中无效的字符会变成 `_`，因此 MCP 工具 `mcp__dev-radius__search` 实际上是 `tools.mcp__dev_radius__search`。每个方法都接受一个包含工具参数的对象。
什么调用结果取决于工具：

- 输出模式的工具解析为结构化值。`bash`解析为`{ output, truncated, full_output_path?, exit_code, wall_time_seconds }`，也适用于非零退出代码。其`output`不受模型看到的2000行或50KB限制：它最多可容纳1 MiB，更长的输出会保留其前后各512 KiB，并用省略标记隔开，同时设置`truncated`，完整输出存储在`full_output_path`中。
- 工具解析为`CallToolResult`，包括`isError`和`structuredContent`。

- 其他工具，例如`read`、`edit`和`write`，解析为文本输出。

调用失败、被阻止或传递无效参数的调用将拒绝，并返回一个携带工具错误文本的`Error`。使用`Promise.allSettled()`来保持成功调用的结果。
`codemode` 说明按命名空间（例如单个MCP服务器）分组列出了带有 TypeScript 声明的工具。具有 `deferred` � 曝光的工具（包括具有默认 `codemode` 曝光的MCP工具）未列出，因此描述保持不变，MCP服务器连接时也是如此。列出的声明共享3000个预估令牌的预算（`codemode.inlineBudget`，见 [settings](settings.md#tools)）。脚本通过 `searchTools()`、`describeTool()`、`describeNamespace()` 或过滤 `ALL_TOOLS` 来查找其他工具。

当 `codemode` 活动时，`codemode.mode`（见 [settings](settings.md#tools)）决定其他工具的呈现方式。使用 `on`（默认）时，声明的工具保持可见，描述中说明了如何从脚本中调用它们。使用 `only` 时，工具将从模型中隐藏，并列在 `codemode` 描述中，模型通过脚本调用它们。

<a id="store-values"></a>
## Store 值

`store(key, value)` 在字符串键下保存一个 JSON 值，以便后续 `codemode` 调用；删除 `undefined` 会删除该键。`load(key)` 返回该值，或 `undefined`。写入操作仅在脚本成功时保留：每个成功存储值的脚本都会在会话中附加一个 `codemode-store` 自定义条目，因此恢复的会话会保留这些值，每个分支仅能看到其路径上写入的值。

该存储用于小状态，如ID、游标或摘要。单个值的JSON最多可有262144个字符，所有值加起来最多1048576个字符。不要存储图像数据；请使用 `image()` 显示图像，它也会将图像保存到临时文件中。

<a id="models"></a>
## 模型

`models` 访问模型目录并使用会话凭证运行非LLM模型：分类器，可对JSON状态进行结构化问答；图像模型，可生成图像。聊天模型已列出，但无法从脚本中运行。可用的分类器和图像模型详见 [Use classifier models](models.md#use-classifier-models) 和 [Use image models](models.md#use-image-models)。

```ts
type ModelType = "chat" | "image" | "classifier";

/** A catalog entry. `provider` and `id` identify it; other fields depend on the type. */
interface ModelInfo {
  type?: ModelType;
  provider: string;
  id: string;
  name: string;
  api: string;
  input: ("text" | "image")[];
  contextWindow?: number;
  [key: string]: unknown;
}

declare const models: {
  /** Every known model of a type, optionally for one provider. */
  getModelsOfType(type: ModelType, provider?: string): Promise<ModelInfo[]>;
  /** Models of a type whose provider has working credentials. */
  getAvailableOfType(type: ModelType, provider?: string): Promise<ModelInfo[]>;
  /** One catalog entry, or undefined. */
  getModelOfType(type: ModelType, provider: string, id: string): Promise<ModelInfo | undefined>;
  /** Answer `context.questions` about `context.state`; answers are in `result.answers` by question ID. */
  classify(model: ModelInfo, context: ClassifierContext): Promise<ClassifierResult>;
  /** Generate images from `context.input` text and image blocks; show `result.output` blocks with image(). Can take minutes. */
  generateImages(model: ModelInfo, context: ImagesContext): Promise<ImagesResult>;
};
```
  
`classify()` 和 `generateImages()` 仅使用 `provider` 和 `id` 的 `model`，因此 `{ provider, id }` 也可用。它们不会因提供方错误而抛出异常：请检查 `stopReason` 和 `errorMessage`。每次脚本最多可同时运行四个此类调用；更多调用会等待空闲槽位，因此 `Promise.all()` 处理大量项目是可行的。其使用情况会添加到 `codemode` 工具结果中，并计入会话成本。

不同提供方的模型ID不同，例如 `typesafe/jev-latest` 和 `openrouter/typesafe/jev-1.13`。使用 `models.getAvailableOfType(type)` 可查找与当前凭证兼容的ID。

### 分类

```ts
interface ClassifierContext {
  /** The data to classify. */
  state: Record<string, unknown>;
  /** Questions by ID. One call answers all of them. */
  questions: Record<string, ClassifierQuestion>;
}

type ClassifierQuestion =
  /** Pick one label. `criteria` maps each label to what it means. */
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  /** Score on an ordered scale. `criteria` describes each level, lowest first. */
  | { type: "score"; instructions: string; criteria: string[] }
  /** Yes or no. */
  | { type: "bool"; instructions: string; criteria: { true: string; false: string } };

interface ClassifierResult {
  provider: string;
  model: string;
  /** Answers by question ID. */
  answers: Record<string, ClassifierAnswer>;
  usage?: ModelUsage;
  stopReason: "stop" | "error" | "aborted";
  errorMessage?: string;
}

type ClassifierAnswer =
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  /** `score` is the expected level index, from 0 to `criteria.length - 1`. */
  | { type: "score"; score: number; confidence: number }
  /** Probability of `true`. */
  | { type: "bool"; probability: number };

/** Token counts and cost in USD, when the service reports them. */
type ModelUsage = { input: number; output: number; totalTokens: number; cost: { total: number } };
```
  
对多个项目进行分类，每次调用 `classify()` 处理一个项目。此脚本可对反馈消息进行排序，例如工具早先返回的消息：

```js
const jev = await models.getModelOfType("classifier", "typesafe", "jev-latest");
const results = await Promise.all(
  messages.map((message) =>
    models.classify(jev, {
      state: { message },
      questions: {
        sentiment: {
          type: "choice",
          instructions: "How does the user feel about the product?",
          criteria: { positive: "Satisfied or happy", negative: "Unhappy or frustrated", neutral: "Neither" },
        },
        urgency: {
          type: "score",
          instructions: "How urgently does this need a reply?",
          criteria: ["no reply needed", "reply this week", "reply today"],
        },
      },
    }),
  ),
);
return results.map((result, i) =>
  result.stopReason === "stop"
    ? { message: messages[i], sentiment: result.answers.sentiment.choice, urgency: result.answers.urgency.score }
    : { message: messages[i], error: result.errorMessage },
);
```
  
### 生成图像

```ts
interface ImagesContext {
  /** The prompt as text blocks, plus image blocks to edit or use as references. */
  input: (TextBlock | ImageBlock)[];
}

interface ImagesResult {
  provider: string;
  model: string;
  /** Generated images, and text blocks for models that also return text. */
  output: (TextBlock | ImageBlock)[];
  usage?: ModelUsage;
  stopReason: "stop" | "error" | "aborted";
  errorMessage?: string;
}

type TextBlock = { type: "text"; text: string };
/** `data` is base64. */
type ImageBlock = { type: "image"; data: string; mimeType: string };
```
  
使用 `image(block)` 显示生成的图像。不要用 `data`、`text()`、`console` 或 `return` 打印图像：它太大，模型无法将其作为文本读取。`image()` 也会将每个图像保存到临时文件，并在结果中放入路径，以便后续轮次可以复制或移动文件。

```js
// @options: {"timeout_ms": 300000}
const painter = await models.getModelOfType("image", "openrouter", "google/gemini-2.5-flash-image");
const result = await models.generateImages(painter, {
  input: [{ type: "text", text: "A red fox in the snow, watercolor" }],
});
if (result.stopReason !== "stop") return result.errorMessage;
for (const block of result.output) {
  if (block.type === "image") image(block);
  else text(block.text);
}
```
  
## 限制

- A 脚本的虚拟机有256MB内存。内存耗尽会抛出 `InternalError: out of memory`；请改用过滤或聚合大数据，而非累积。

- A 脚本如果等待永远不会就绪的承诺（无工具调用挂起）会立即失败，因为没有计时器。

- 脚本不能启动其他 `codemode` 脚本。

