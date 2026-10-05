# 变更日志

## [未发布]

### 修复

- 修复 OAuth 凭证在请求或模型刷新被取消或在令牌刷新期间被覆盖时失效的问题：已开始的令牌刷新现在会完成并持久化旋转后的刷新令牌

## [1.0.2] - 2026-10-04

### 添加

- 为 `openai-completions`、`openai-responses` 和 `azure-openai-responses` 请求添加了按思考层级采样参数覆盖（`samplingParamsByThinkingLevel`）（[#9776](https://github.com/earendil-works/pi/pull/9776) by [@mrexodia](https://github.com/mrexodia)）

## [1.0.1] - 2026-10-03

### 添加

- 向 `cloudflare-workers-ai` 提供商添加了 Cloudflare 的 Clef 和 Clef Flash 分类器模型（`@cf/cloudflare/clef`、`@cf/cloudflare/clef-flash`）（[#10316](https://github.com/earendil-works/pi/pull/10316) by [@ndisidore](https://github.com/ndisidore)，[#10322](https://github.com/earendil-works/pi/pull/10322) by [@RealAlexandreAI](https://github.com/RealAlexandreAI)）

### 更改

- 具有原生对话中工具变更的 Anthropic 模型现在使用 `inline-tools-2026-09-15` beta：后续工具在 `tool_addition` 块中按值定义，而不是附加到顶层工具列表，且在相同名称下重新定义工具不再回退为重新发送完整工具列表，因此提示缓存得以保留。将 `@anthropic-ai/sdk` 升级至 0.129.0。
- 已弃用 `hasToolRedefinitions()`；不再需要内置传输。

### 修复

- 修复“选定模型已达容量”提供商错误在回合结束时触发，而非重试（[#10278](https://github.com/earendil-works/pi/issues/10278)）

- 修复Cloudflare AI网关Claude模型因使用短横线模型ID（`claude-opus-5-5`而非`claude-opus-5.5`）返回404错误，Anthropic要求使用此类ID

- 修复“使用ChatGPT登录时，若回调端口被其他登录占用，浏览器显示OAuth状态不匹配”的问题；现改为端口被占用时直接报错（[#10265](https://github.com/earendil-works/pi/issues/10265)）

- 修复Amazon Bedrock OpenAI模型在输入token超过272k时按短上下文计费；Bedrock模型现已包含models.dev上列出的定价层级（[#10326](https://github.com/earendil-works/pi/issues/10326)）

- 修复Amazon Bedrock Claude请求在系统提示词或工具变更后出现“Invalid `signature` in `thinking` block”错误；Claude Opus 4.7+、Sonnet 5+和Fable 5会丢弃陈旧的思考块，与Anthropic提供商一致（[#10324](https://github.com/earendil-works/pi/issues/10324)）
- 修复了Together DeepSeek V4 Pro在Together重命名为`deepseek-ai/DeepSeek-V4-Pro-0813`后丢失思考等级控制的问题（[#10336](https://github.com/earendil-works/pi/pull/10336) 由 [@cv](https://github.com/cv) 提交）

## [1.0.0] - 2026-10-01

### 新增

- 新增了Anthropic OAuth的复制代码登录方式。登录时可以选择浏览器登录（默认）或复制代码登录，后者会在Anthropic页面显示授权码，便于粘贴到pi中，且当浏览器运行在另一台机器上时也能正常工作（[#10194](https://github.com/earendil-works/pi/pull/10194) 由 [@lucasmeijer](https://github.com/lucasmeijer) 提交）。

### 修改

- 将OAuth浏览器页面的配色改为使用Pi的Logo。

### 修复

- 修复了OpenAI响应请求在回放语法工具调用（如`codemode`）时，从其他提供商或网关（如Radius）重放时失败的问题（`Expected an ID that begins with 'ctc'`）。

## [0.99.2] - 2026-09-30

### 新增

- 新增了轻量级的`@earendil-works/pi-ai/models`入口点，用于模型集合和提供商构建，无需加载TypeBox、内置目录或提供商SDK。
- 已将Anthropic工作负载身份联合从Anthropic SDK环境变量`ANTHROPIC_FEDERATION_RULE_ID`、`ANTHROPIC_ORGANIZATION_ID`和`ANTHROPIC_IDENTITY_TOKEN_FILE`（可选`ANTHROPIC_SERVICE_ACCOUNT_ID`和`ANTHROPIC_WORKSPACE_ID`）中添加。API密钥和`ANTHROPIC_AUTH_TOKEN`优先级更高（[#10177](https://github.com/earendil-works/pi/issues/10177)，[#10242](https://github.com/earendil-works/pi/pull/10242) 由[@philfreo](https://github.com/philfreo) 提交）

### 修复

- 修复了Z.AI CN端点`Prompt exceeds max length`错误中的上下文溢出检测问题（[#10208](https://github.com/earendil-works/pi/issues/10208)）
- 修复了当`strict: "prefer"`工具模式使用关键词Anthropic严格工具使用拒绝时，Anthropic请求失败的情况，例如`minimum`/`maximum`；此类工具现在发送非严格请求（[#9953](https://github.com/earendil-works/pi/issues/9953)）
- 修复了当`Retry-After`头部包含无法解析的日期时，提供程序重试立即触发的问题；现在它们使用指数回退（[#9571](https://github.com/earendil-works/pi/issues/9571)）

## [0.99.1] - 2026-09-29

### 添加
- 已将GPT-6.1 Sol (`gpt-6.1-sol`)添加到OpenAI、Azure OpenAI Responses和OpenAI Codex提供商中。

## [0.99.0] - 2026-09-29

### 重大变更

- 将图像模型统一到常规`Provider`/`Models`表层。已移除独立的`ImagesModels`集合：`createImagesModels()`、`createImagesProvider()`、`ImagesProvider`、`openrouterImagesProvider()`、`builtinImagesProviders()`和`builtinImagesModels()`已不存在。请改用`builtinModels()`、`models.getModelOfType("image", ...)`、`models.generateImages()`和`createProvider({ models, images })`。现有未限定读取操作仍为仅聊天模式。

- 图像模型现为`ImageModel`，需`type: "image"`，并与聊天模型共享`BaseModel`。已移除旧的复数图像类型名称（`ImagesModel`、`ImagesApi`、`KnownImagesApi`、`KnownImagesProvider`和`ImagesProviderId`）。`generateImages()`仅接受图像模型。输出模态（`output`）仍仅限图像模型。

- 生成模型数据模式现为版本6：每项条目携带`type`，操作特定目录包含聊天、图像和分类器模型，且上游ID可能有按类型分开的独立条目。OpenRouter图像模型位于`openrouter-images` api组的`openrouter.json`中；`image-models.generated.ts`和`scripts/generate-image-models.ts`已移除。运行`npm run hydrate:model-data`。

### 已添加

- 已添加`Models.generateImages()`，采用由`Provider.generateImages?`和`createProvider({ images })`（按`model.api`键值）解析的提供商认证，`createProvider()` `models`和`fetchModels`接受所有类型模型，`api`在提供`images`或`classifiers`时可选。

- 已添加可选模型`type`（`"chat"`、`"image"`或`"classifier"`）。聊天模型可省略此项，因此现有聊天模型、提供商和存储器无需更改。可通过新`isModelType()`保护或读取有效类型（`getModelType()`）来缩小混合列表。

- 已添加`getModelsOfType()`、`getModelOfType()`、`getAvailableOfType()`、`getAllModels()`和`getAllAvailable()`（按`Models`）；可选`Provider.getAllModels()`和`Provider.filterAllModels()`；对应生成目录访问器；以及`AnyModel`和`ModelTypeMap`类型。`hasApi()`、`calculateCost()`和`modelsAreEqual()`接受`AnyModel`。

- 已支持所有类型模型的`ModelsStoreEntry.models`。未知类型的存储和获取模型将被丢弃，而非刷新失败。

- 已添加分类器模型和`Models.classify()`，采用与提供商无关的JEV风格`choice`/`score`/`bool`合约。内置TypeSafe提供商通过System One API暴露模型.dev的`jev-latest`，并将公共`bool`问题转换为TypeSafe的`noul`线格式。

- 已通过其TypeSafe兼容的System One端点在OpenRouter（`typesafe/jev-1.13`、`~typesafe/jev-latest`）和Cloudflare Workers AI（`typesafe/jev`）上添加JEV分类器模型，通过新`cloudflare-workers-ai-system-one`分类器API。

- 已通过其TypeSafe兼容的System One端点在Vercel AI Gateway（`typesafe-ai/jev`，源自其评估模型目录）和OpenCode Zen（`jev-1.13`、`jev-1.13-free`）上添加JEV分类器模型。

- 已将`usage`添加到`ClassifierResult`：System One分类报告令牌计数，按模型目录如聊天使用计费。

- 已在`Models`流入口点添加运行时聊天模型检查，使非聊天模型以明确的`ModelsError`失败，而非缺失API流错误。

- 已为生成和发布JSON目录添加基于数组的`models.all.json`和`providers/{id}.all.json`变体，允许每个模型类型一次使用同一上游ID；现有按键的`models.json`和`providers/{id}.json`仍为已发布客户端的仅聊天模式。

- 已添加`onProviderStreamEvent`，用于在归一化前观察解析的提供商流事件，包括未保留在助手消息中的提供商特定字段（[#9784](https://github.com/earendil-works/pi/issues/9784)、[#9901](https://github.com/earendil-works/pi/pull/9901)由[@davidbrai](https://github.com/davidbrai)提出）。

- 已将Claude Sonnet 5.5添加到内置的Anthropic模型目录，具备自适应思维、对话中努力、1M上下文和官方定价元数据。
- 在`openai`提供商中添加了“使用ChatGPT登录”功能，这是一种使用ChatGPT订阅和OpenAI API的OAuth登录方式。`Models.login()`接受`LoginOptions`，`getDeviceId()`提供稳定的安装ID以供需要的登录流程使用。订阅使用限制错误不会重试，并链接到ChatGPT使用页面；临时使用错误会重试。

- 添加了`llama-cpp-classify`分类器API，该API可根据llama-server的下一个token概率回答分类器问题，用于单token标签答案。

- 添加了可选的`AssistantMessage.thinkingLevel`，用于记录代理循环请求的思考等级，以供响应使用。

### 更改了

- 将OpenAI Codex提供商重命名为“OpenAI Codex（旧版）”；`openai`提供商上的“使用ChatGPT登录”已取代它。

- 将Anthropic、OpenAI Codex、OpenRouter和Radius浏览器登录回调服务器统一为一个共享实现，使用相同的浏览器页面。OAuth页面助手现在可用作`@earendil-works/pi-ai/utils/oauth-page`。

- 将Radius浏览器登录改为在显示浏览器页面之前先交换授权码，因此令牌交换失败会在浏览器中显示。

### 修复了

- 修复了Vercel AI Gateway报告的Anthropic缓存写入问题，即流式增量被按5分钟费率计费（[#9210](https://github.com/earendil-works/pi/issues/9210)）。

- 修复了直接通过`stream()`/`complete()`调用时，OpenAI兼容API会丢弃模型级别的`samplingParams`（[#9506](https://github.com/earendil-works/pi/issues/9506)）。

- 修复了Mistral GLM模型产生空文本块和分割思考块的问题，这些空内容增量可能导致后续请求失败，提示“Expected at most one leading ThinkChunk”（[#9674](https://github.com/earendil-works/pi/issues/9674)）。

- 修复了OpenAI快速模式请求在报告`service_tier: "fast"`时仍按标准费率计费的问题，如同GPT-6模型一样（[#10034](https://github.com/earendil-works/pi/issues/10034)）。

- 修复了Mistral推理模型忽略请求的思考等级：GLM 5.3现在使用`reasoning_effort`而非`prompt_mode`，GLM 5.2接受`max`，Mistral模型仅提供API支持的努力等级（[#9678](https://github.com/earendil-works/pi/issues/9678)）。
-  修复了 OpenCode Zen 和 OpenCode Go `qwen3.8-flash` 思考内容在后续轮次中以纯文本形式回放的问题，因为端点返回了空的思考签名（[#10047](https://github.com/earendil-works/pi/issues/10047)）。
-  修复了 OpenAI 响应流返回未完成的工具调用作为可运行命令的问题，这使得某些服务器（如 `output_index`）在省略时会运行混乱的命令；现在这些流将以错误结束（[#9974](https://github.com/earendil-works/pi/issues/9974)）。
-  修复了 Anthropic 和 OpenAI Codex 浏览器登录在提供程序重定向出现授权错误后无限等待的问题；现在登录会以提供程序的错误描述失败。
-  修复了 Anthropic 浏览器登录在回调端口被占用时失败的问题；现在它会回退为粘贴重定向 URL。
-  修复了 GitHub Copilot Claude Opus 5.5 在上游模型元数据不完整时提供不支持的思考层级的问题；现在它会提供最低到最高层级。

## [0.87.1] - 2026-09-22

###  增加了

-  增加了 Claude Opus 5.5、GPT-6 Sol 和 GPT-6 Luna 到 GitHub Copilot 目录中。
- 增加了GPT-6 Sol和GPT-6 Luna，用于OpenAI API密钥和OpenAI Codex订阅，支持完整的推理努力、提示缓存、工具搜索、长上下文定价以及官方成本元数据。
- 将Claude Opus 5.5添加到内置的Anthropic模型目录，支持自适应思维、1M上下文以及官方定价元数据。
- 将Grok 4.7添加到内置的xAI模型目录，支持长上下文定价元数据。

### 修复了

- 修复了某些OpenAI兼容提供商因用户消息包含空文本部分而拒绝纯图片消息的问题（[#9797](https://github.com/earendil-works/pi/issues/9797)）
- 修复了Anthropic OAuth请求报告Claude Code版本过旧的问题。

## [0.87.0] - 2026-09-21

### 增加了

- 在生成目录中增加了模型图片输入限制和缓存安全缩放元数据（[#9631](https://github.com/earendil-works/pi/issues/9631)）。

### 修复了
- 修复了无法识别OpenAI兼容的Chat Completions端点，除非它们明确声明支持，否则会接收严格的工具模式，同时保留了内置模型的严格工具功能（[#9816](https://github.com/earendil-works/pi/issues/9816)）。

## [0.86.1] - 2026-09-20

### 添加

- 添加了Meta提供者（模型API密钥和Muse订阅OAuth），支持Muse Spark模型（[#9096](https://github.com/earendil-works/pi/pull/9096) 由[@xl0](https://github.com/xl0)提交）。

### 修复

- 修复了z.ai `Prompt too long`错误未被识别为上下文溢出（[#9805](https://github.com/earendil-works/pi/issues/9805)）。

- 修复了Cerebras模型错误地宣传不支持严格的工具模式，导致当混合使用严格和非严格工具时出现HTTP 400错误（[#9804](https://github.com/earendil-works/pi/pull/9804) 由[@EdenGottlieb](https://github.com/EdenGottlieb)提交）。

## [0.86.0] - 2026-09-19

### 不兼容变更

- 更改了面向提供者的`ProviderStreams`和`StreamFunction`输入，从`Context`更改为标准化的`TranscriptContext`值。系统提示和工具声明现在位于转录系统消息中；自定义提供者必须使用`getCurrentSystemPrompt()`和`getCurrentTools()`读取它们。详见[System Messages](README.md#system-messages)。

- 限制了`ToolCall.arguments`和`ToolResultMessage.details`为JSON兼容值，将`ToolResultMessage`更改为条件类型，并使`JsonValue`数组变为只读。

### 添加

- 添加了基于转录的对话中间系统提示和工具更改，支持模型的原生回放和自动折叠。详见[System Messages](README.md#system-messages)（[#9548](https://github.com/earendil-works/pi/pull/9548)）。

- 添加了一个生成的公共Radius模型目录，用于同步API查找，支持缓存和实时网关目录在运行时叠加。

- 启用了Fireworks Messages模型的原生延迟工具加载。使用`ToolSearch`或`tool_search`作为加载器名称进行提示前缀延迟（[#9323](https://github.com/earendil-works/pi/issues/9323)）。

- 添加了`RetryPolicy.maxAgentDelayMs`支持，以限制共享助手的重试回退，用于摘要调用（[#8826](https://github.com/earendil-works/pi/issues/8826)）。

- 添加了`Model.promptCache`生命周期元数据，以支持短、长保留级别的提示缓存预热决策（[#9668](https://github.com/earendil-works/pi/pull/9668)）。
### 修复

- 修复GitHub Copilot GPT模型（包括GPT-6 Astra）使用Chat Completions适配器而非必需的Responses适配器（[#9253](https://github.com/earendil-works/pi/pull/9253) 由 [@petrroll](https://github.com/petrroll) 提交）。
- 修复DeepSeek V4.1在OpenRouter和OpenCode Go上的思考层级，同时保留提供方努力元数据（[#9485](https://github.com/earendil-works/pi/issues/9485)）。
- 修复非Cerebras提供方的无正文HTTP 400/413错误被误分类为上下文溢出（[#9482](https://github.com/earendil-works/pi/issues/9482)）。
- 修复Vercel AI Gateway将未签名的思考重放为助手文本（[#9676](https://github.com/earendil-works/pi/issues/9676)）。
- 修复Google生成式AI和Vertex AI在省略推理或同一Gemini家族内模型能力不同时使用不支持的思考层级（[#9455](https://github.com/earendil-works/pi/issues/9455)）。
- 修复与Anthropic兼容的中继在报告不同响应模型时破坏已签名的思考重放，同时保留回退计费（[#9188](https://github.com/earendil-works/pi/issues/9188)）。
- 修复Amazon Bedrock一小时缓存写入按五分钟费率计费（[#9457](https://github.com/earendil-works/pi/issues/9457)）。
- 修复从缓冲区中排空`EventStream`事件时的二次CPU使用（[#9055](https://github.com/earendil-works/pi/issues/9055)）。
- 修复Mistral Medium推理请求使用`reasoning_effort`替代不支持的`prompt_mode`，针对所有具备推理能力的`mistral-medium-*`模型ID（[#8700](https://github.com/earendil-works/pi/issues/8700)）。
- 修复OpenCode和OpenCode Go请求在所有支持的API适配器间发送`x-opencode-session`至`sessionId`（[#9326](https://github.com/earendil-works/pi/issues/9326)）。
- 修复OpenAI Codex请求发送模型的Off推理努力而非省略，同时尊重不支持的Off映射（[#9191](https://github.com/earendil-works/pi/issues/9191)）。
- 修复Fireworks未签名思考重放及推理努力选择使用目录元数据，保留DeepSeek V4和Qwen3.8验证回退并移除冗余的GLM 5.2和Kimi K3努力别名（[#9323](https://github.com/earendil-works/pi/issues/9323)）。
-  修复了当提示缓存功能启用时，OpenRouter 请求将 `x-session-id` 从 `sessionId` 发送到 Chat Completions 和 Anthropic Messages 模型的情况 [#9102](https://github.com/earendil-works/pi/issues/9102)。
-  修复了 DeepSeek 目录，使其为 DeepSeek V4.1 Flash 广告 `deepseek-flash`，而不是已退役的 Flash 别名，并更新了 DeepSeek 价格元数据 [#9423](https://github.com/earendil-works/pi/issues/9423)。
-  修复了 Mistral-hosted GLM-5.2 推理请求使用 `reasoning_effort`，而不是被忽略的 `prompt_mode` [#9375](https://github.com/earendil-works/pi/issues/9375)。
-  修复了 OpenAI 兼容的响应错误，使其能够识别实际提供商，而不是始终将其标记为 OpenAI 错误 [#9298](https://github.com/earendil-works/pi/issues/9298)。
-  修复了 Baseten 请求发送会话亲和力头部，从 `sessionId` 进行自动提示缓存路由 [#9629](https://github.com/earendil-works/pi/issues/9629)。
-  修复了 Cloudflare 520 响应的重试分类 [#9627](https://github.com/earendil-works/pi/issues/9627)。
-  修复了 Azure 临时峰值负载容量错误的重试分类 [#9669](https://github.com/earendil-works/pi/issues/9669)。

###  已移除

-  已移除 GPT-5.4 和 GPT-5.4 mini 从 OpenAI Codex 目录，因为它们已不可用于 ChatGPT 账户 [#9394](https://github.com/earendil-works/pi/issues/9394)。

## [0.85.1] - 2026-09-05

###  增加

-  增加了 GPT-6 Astra，适用于 OpenAI API 密钥和 OpenAI Codex 订阅。

###  修复

-  修复了 GPT-5.6+ 响应模型的长提示缓存请求，使用 `prompt_cache_options.ttl: "30m"` 而不是 `prompt_cache_retention: "24h"`。

## [0.85.0] - 2026-09-04

###  重大变更

-  将 `createGatewayBindingFetch()` 替换为 `createAiBindingFetch()`，用于 Cloudflare Workers AI 绑定。直接配置模型的 Workers AI Gateway 通道 `baseUrl`；请求现在会原样通过绑定传递 [#8287](https://github.com/earendil-works/pi/pull/8287) 由 [@Maximo-Guk](https://github.com/Maximo-Guk) 提交。

###  增加

-  增加了带 `AssistantMessageFrameEncoder` 和 `reduceAssistantMessageFrames()` 的紧凑、可持久化的助手消息帧。
-  增加了 `vllmPriority` OpenAI 兼容模型设置，用于转发调度器优先级到 vLLM [#9004](https://github.com/earendil-works/pi/pull/9004) 由 [@AppleDannyClegg](https://github.com/AppleDannyClegg) 提交。
-  增加了 `supportsMaxOutputTokens` OpenAI 响应兼容性设置 [#8941](https://github.com/earendil-works/pi/pull/8941) 由 [@scturtle](https://github.com/scturtle) 提交。
-  增加了可选的时间戳参数到 `uuidv7()`，用于跟随者 ID。
-  增加了窄 `api`、`providers` 和 `utils` 的子路径导出，支持直接导入而无需加载整个包。
-  增加了 Anthropic 每轮努力持久化、确定性历史努力标记和已签名思考不匹配恢复，适用于 Claude 模型的 Anthropic Messages 传输，包括 OpenRouter。
-  增加了 Meta 提供商（模型 API 密钥和 Muse 订阅 OAuth）以及 Muse Spark 模型。

###  修复

-  移除了不可用的 Grok Build 0.1 模型，从内置 xAI 目录中移除 [#9093](https://github.com/earendil-works/pi/pull/9093) 由 [@Jaaneek](https://github.com/Jaaneek) 提交。
-  修复了助手消息帧，保持提供商思考级别。
-  修复了简单提供商流，使其始终发出标准流事件和自定义工具调用增量。
-  修复了 Qwen Token Plan Individual 目录，包含 Qwen3.8 Flash [#9021](https://github.com/earendil-works/pi/issues/9021)。
-  修复了 Baseten GLM-5.2 模型错误地宣传图像输入支持 [#8293](https://github.com/earendil-works/pi/pull/8293) 由 [@Panoplos](https://github.com/Panoplos) 提交。
-  修复了 Fireworks GLM 模型使用错误的 API 适配器。
-  移除了 pi-ai 中不必要的 Chord 依赖，直接定义其导出的 `JsonValue` 类型。
-  修复了 GitHub Copilot Claude Fable 5 请求，使其使用 Anthropic Messages 适配器发送所选推理级别 [#8961](https://github.com/earendil-works/pi/issues/8961)。
-  修复了 OpenAI Codex SSE 解析，处理未被空白行跟随的终端事件 [#9047](https://github.com/earendil-works/pi/issues/9047)。
-  修复了 `NO_PROXY`，使其匹配根域和子域 [#8737](https://github.com/earendil-works/pi/pull/8737) 由 [@MeiSiristhebest](https://github.com/MeiSiristhebest) 提交。

## [0.84.4] - 2026-08-28

###  增加

-  增加了实验性的视觉能力 `deepseek-v4-flash-vision-exp` 模型到 DeepSeek 目录。

###  修复
- 修复了OpenAI兼容的Chat Completions忽略显式请求的`toolChoice`，且未定义工具的情况。
- 修复了思维签名序列化，在签名完成后仅运行一次（[#8671](https://github.com/earendil-works/pi/pull/8671)）。
- 修复了Mistral工具调用拆分问题，当延续块省略工具调用ID时（[#8387](https://github.com/earendil-works/pi/issues/8387)）。
- 修复了OpenAI兼容的推理回放，合并连续流式文本和摘要`reasoning_details`增量。
- 修复了Cloudflare AI Gateway目录，包含models.dev遗漏支持的`workers-ai/*`直通模型。
- 修复了OpenRouter推理控制，根据OpenRouter模型元数据推导`off`支持及可用努力等级，防止强制推理模型接收`effort: "none"`（[#8614](https://github.com/earendil-works/pi/pull/8614)由[@davidbrai](https://github.com/davidbrai)提交）。

## [0.84.3] - 2026-08-24

### 重大变更

- 将`GoogleThinkingLevel`更名为`GoogleApiThinkingLevel`，并新增`ResolvedGoogleThinkingLevel`以标准化适配器等级。

### 新增

- 为简单流请求新增提供者无关的`toolChoice`支持。
- 为支持的一方模型新增自动Anthropic服务器端拒绝回退及返回模型用量计费（[#8017](https://github.com/earendil-works/pi/issues/8017)）。
- 为vLLM、Qwen/SGLang和llama.cpp服务器新增可配置的OpenAI兼容思维令牌预算字段（[#8275](https://github.com/earendil-works/pi/pull/8275)由[@bnsd55](https://github.com/bnsd55)提交）。
- 新增中国区ZAI Coding Plan模型，含GLM-4.6V视觉支持，并为有公开PAYG价格的模型提供API等效用量成本估算（[#8220](https://github.com/earendil-works/pi/issues/8220)）。
- 将`deepseek-v4-pro-0813`新增至Qwen Token Plan Individual目录（[#8194](https://github.com/earendil-works/pi/issues/8194)）。

### 变更

- 将内置的xAI模型改为使用带加密推理回放的Responses API，并将Grok 4.6设为默认xAI模型（[#8124](https://github.com/earendil-works/pi/pull/8124)由[@Jaaneek](https://github.com/Jaaneek)提交）。
- 变更Anthropic、Azure OpenAI、Google Generative AI、Google Vertex、Mistral、OpenAI Chat Completions及OpenAI Responses适配器，发送Pi默认`User-Agent`，除非被覆盖（[#8305](https://github.com/earendil-works/pi/issues/8305)）。

### 修复

- 修复OpenAI兼容的Chat Completions推理回放，保持并重发助手级`reasoning_details`（`reasoning.text`、`reasoning.summary`、`reasoning.encrypted`）原文及顺序（[#7994](https://github.com/earendil-works/pi/issues/7994)）。
- 修复Anthropic服务器端回退响应，计费使用请求模型而非回退模型（[#8285](https://github.com/earendil-works/pi/issues/8285)）。
- 修复GitHub Copilot登录触发模型策略速率限制，限制策略更新、模型发现重试一次并遵守服务器重试延迟（[#7850](https://github.com/earendil-works/pi/issues/7850)）。
- 修复Amazon Bedrock对非Anthropic模型的推理回放，恢复回退推理内容（[#8314](https://github.com/earendil-works/pi/pull/8314)由[@seiji](https://github.com/seiji)提交）。
- 修复Z.AI Coding Plan模型推理努力元数据不完整，含缺失GLM-5.3低、高、最高等级（[#8336](https://github.com/earendil-works/pi/issues/8336)）。
- 修复DeepSeek V4 Flash在OpenCode及OpenCode Go中省略支持的低思维等级（[#8181](https://github.com/earendil-works/pi/pull/8181)由[@tianshuang](https://github.com/tianshuang)提交）。
- 修复Azure OpenAI Responses在特定流请求中忽略`toolChoice`。
- 修复Amazon Bedrock`after_provider_response`/`onResponse`，转发原始响应头部而非仅合成请求ID头部（[#8234](https://github.com/earendil-works/pi/issues/8234)）。
- 修复Kimi OpenAI兼容用量报告，顶层`cached_tokens`计为缓存读取而非正常输入令牌（[#8075](https://github.com/earendil-works/pi/issues/8075)）。
- 修复Google Generative AI及Vertex AI自定义模型忽略`thinkingLevelMap`，导致扩展思维控制丢失（[#8135](https://github.com/earendil-works/pi/issues/8135)）。
- 修复Xiaomi模型目录生成，保留已废弃的MiMo V2模型名称（[#8187](https://github.com/earendil-works/pi/issues/8187)）。
- 修复了OpenRouter推理控制，通过从OpenRouter模型元数据中派生`off`支持和可用的努力级别，防止必须推理的模型接收到`effort: "none"`（[#8454](https://github.com/earendil-works/pi/issues/8454)）。

## [0.84.2] - 2026-08-14

### 新增

- 新增`createGatewayBindingFetch()`，用于通过Workers AI绑定路由Cloudflare AI Gateway请求，无需API令牌（[#7901](https://github.com/earendil-works/pi/pull/7901) by [@Maximo-Guk](https://github.com/Maximo-Guk)）。

- 新增`AssistantMessage.endTurn`，以保留OpenAI Codex的终端`end_turn`信号用于诊断（[#7766](https://github.com/earendil-works/pi/pull/7766)）。

### 变更

- 将Kimi Coding请求的运行时`User-Agent`头部更改为pi。

- 自动将支持的严格工具模式转换为与提供者兼容的封闭对象，保留原始工具定义，同时将可选非必需工具参数的`null`值视为省略。

- 更改OpenAI响应的延迟工具加载，优先使用支持的消息锚定`additional_tools`，同时保留工具搜索和顶层回退（[#7709](https://github.com/earendil-works/pi/issues/7709)）。

- 用原生的Chat Completions HTTP流替换了Mistral SDK传输，消除了其生成客户端和模式运行时的开销。

### 修复

- 修复了GitHub Copilot登录时触发API速率限制的问题，通过限制并发策略更新来启用模型策略（[#6187](https://github.com/earendil-works/pi/issues/6187)）。

- 修复了GitHub Copilot登录后API速率限制问题，仅更新未配置策略的账户模型，并尊重服务器重试延迟（[#7850](https://github.com/earendil-works/pi/issues/7850)）。

- 修复了上游请求缓冲区限制失败时自动助手重试的问题。

- 修复了OpenAI响应的函数和自定义工具调用，在流式传输、代理和回放过程中保留命名空间（[#7709](https://github.com/earendil-works/pi/issues/7709)）。

- 修复了内置和自定义DeepSeek API模型，使其通过支持的`max_tokens`字段发送输出限制。

- 修复了Google Generative AI和Vertex AI响应，使其在工具调用中正确处理输出限制或提供者错误停止，而不是将其视为正常工具使用（[#8059](https://github.com/earendil-works/pi/issues/8059)）。

- 修复了Amazon Bedrock回放拒绝包含空对象键的工具参数，同时保留所有有效嵌套值（[#7882](https://github.com/earendil-works/pi/pull/7882) by [@muyiyr](https://github.com/muyiyr)）。

- 修复了DeepSeek的兼容性检测，使其能够识别主机名包含大写字母的基URL（[#7933](https://github.com/earendil-works/pi/pull/7933) by [@yearth](https://github.com/yearth)）。

## [0.84.1] - 2026-08-07

### 新增

- 新增Qwen Token Plan Individual作为内置提供者，包含其文档化的订阅模型目录和共享国际`QWEN_TOKEN_PLAN_API_KEY`（[#7659](https://github.com/earendil-works/pi/pull/7659) by [@arasovic](https://github.com/arasovic)）。

## [0.84.0] - 2026-08-06

### 不兼容变更

- 将导出的`ModelsStreamTransforms`接口重命名为`ModelsRequestTransforms`，因为其头部转换现在适用于所有已认证的提供者请求。

- 要求动态模型提供者接受具体的`RefreshModelsContext.signal`；当调用者省略其可选信号时，`Models.refresh()`保持无界。

- 要求提供者登录、API密钥检查/解析和OAuth刷新实现接受具体的中止信号；公共认证和凭证操作在调用者省略其可选信号时保持无界。

- 用只读的`context.stored`快照和经过版本检查的`context.publish()`事务替换了原始的`RefreshModelsContext.store`访问。

  **`createProvider({ fetchModels })`：**无需目录发布迁移。前后均返回获取的列表；`createProvider()`恢复存储的模型并自行发布和持久化刷新后的模型。`signal`现在保证存在。

  ```ts
  // Before
  const beforeProvider = createProvider({
    // ...
    fetchModels: async ({ signal }) => {
      const response = await fetch(catalogUrl, { signal });
      return parseModels(await response.json());
    },
  });

  // After: unchanged
  const afterProvider = createProvider({
    // ...
    fetchModels: async ({ signal }) => {
      const response = await fetch(catalogUrl, { signal });
      return parseModels(await response.json());
    },
  });
  ```

  **手写`Provider.refreshModels()`：**用版本保护的发布替换直接存储访问和预发布突变。

  ```ts
  // Before
  refreshModels: async (context) => {
    const stored = await context.store.read();
    if (stored) currentModels = stored.models;
    if (!context.allowNetwork) return;

    const refreshed = await fetchModels(context.signal);
    currentModels = refreshed;
    await context.store.write({ models: refreshed, checkedAt: Date.now() });
  },

  // After
  refreshModels: async (context) => {
    if (context.stored) {
      const restored = context.stored.models;
      if (!(await context.publish({
        update: () => { currentModels = restored; },
      }))) return;
    }
    if (!context.allowNetwork) return;

    const refreshed = await fetchModels(context.signal);
    if (context.signal.aborted) return;
    await context.publish({
      persist: { models: refreshed, checkedAt: Date.now() },
      update: () => { currentModels = refreshed; },
    });
  },
  ```

  在`publish()`中，省略`persist`以保持存储不变，传递`ModelsStoreEntry`以写入，或传递`persist: null`以删除。省略`update`用于仅元数据持久化；省略`persist`用于临时内存发布。

### 新增
- 增加了可选的`OAuthAuth.isSubscription`元数据，用于区分订阅认证和通用OAuth登录。
- 增加了对流式、延迟和图片请求选项的显式`TelemetryContext`传播，使用通用的`@earendil-works/pi-telemetry`合约。
- 增加了延迟提供者请求合约、持久响应句柄、认证的获取/取消调度以及对挂起、就绪、失败和取消响应的伪提供者支持（[#7339](https://github.com/earendil-works/pi/pull/7339) 由 [@davidbrai](https://github.com/davidbrai) 提交）。
- 增加了内置的OpenAI兼容提供者Baseten，支持models.dev目录生成和原生的`chat_template_args`推理控制。
- 增加了通过`Model.samplingParams`和`StreamOptions.samplingParams`传递的任意OpenAI兼容采样参数，包括每个请求的覆盖项（[#7568](https://github.com/earendil-works/pi/pull/7568) 由 [@mrexodia](https://github.com/mrexodia) 提交）。
- 增加了对OpenAI兼容模型的可选vLLM `thinking_token_budget`支持，保留最终答案的输出令牌（[#7638](https://github.com/earendil-works/pi/pull/7638) 由 [@bnsd55](https://github.com/bnsd55) 提交）。
- 增加了`OpenAICompletionsCompat.supportsFinishReason`，用于省略流式`finish_reason`值的提供者，推断流结束时的正常和工具使用停止。
- 增加了结构化的Amazon Bedrock故障诊断，包含HTTP状态、建模错误代码和可用的AWS请求ID（[#7286](https://github.com/earendil-works/pi/pull/7286) 由 [@brianstanley](https://github.com/brianstanley) 提交）。

### 更改

- 增加了可选的`ModelsStore`读取、写入和删除的取消功能；目录编排将这些等待与提供者刷新信号绑定。

### 修复

- 修复GitHub Copilot Grok 4.5请求以使用支持的响应API（[#7560](https://github.com/earendil-works/pi/issues/7560)）。
- 限制OAuth令牌刷新，使停滞请求释放凭证存储锁（[#7508](https://github.com/earendil-works/pi/issues/7508)）。
- 修复工具参数验证，以保留已与`anyOf`/`oneOf`联合臂匹配的值，避免可空联合将`null`转换为其他原始值（[#7328](https://github.com/earendil-works/pi/issues/7328)）。
- 修复模型目录刷新的取消，使调用者即使自定义提供者忽略其中止信号也能停止等待（[#7027](https://github.com/earendil-works/pi/issues/7027)）。
- 修复认证解析、可用性检查、OAuth刷新、提供者登录和内存凭证队列等待，以尊重调用者取消。
- 修复较新提供者刷新被较早停滞生成阻塞或覆盖，包括持久目录发布。
- 更新了OpenAI和直通模型目录中的GPT-5.6 Terra和Luna定价。
- 修复Fireworks Kimi K3模型以使用兼容OpenAI的API，带有原生推理努力级别和延迟工具（[#7199](https://github.com/earendil-works/pi/issues/7199), [#7230](https://github.com/earendil-works/pi/pull/7230) 由 [@XBeg9](https://github.com/XBeg9) 提交）。
- 修复Fireworks GLM 5.2模型在启用长缓存保留时发送不支持的`prompt_cache_retention`字段，并启用了会话亲和力以自动提示缓存（[#7676](https://github.com/earendil-works/pi/issues/7676)）。
- 更新了Groq的Qwen推理覆盖，替换为`qwen/qwen3.6-27b`模型。
- 修复了OpenCode Go提供者的显示名称。
- 修复了提供者错误规范化将数组和类实例视为结构化响应体，而不是保留其原始错误（[#7205](https://github.com/earendil-works/pi/pull/7205) 由 [@erikogenvik](https://github.com/erikogenvik) 提交）。
- 修复了Anthropic流式传输在初始内容块事件中丢失文本或思考内容（[#7358](https://github.com/earendil-works/pi/pull/7358) 由 [@davidbrai](https://github.com/davidbrai) 提交）。
- 修复了Google历史转换丢失签名空文本和思考块，导致无法重放（[#7362](https://github.com/earendil-works/pi/pull/7362) 由 [@jingtao-wisdomgraph](https://github.com/jingtao-wisdomgraph) 提交）。
- 修复了OpenAI Codex缓存的WebSocket会话在不同账户凭证间共享（[#7364](https://github.com/earendil-works/pi/pull/7364)）。
- 修复了临时Google生成式AI和Vertex AI提供者错误绕过自动重试（[#7471](https://github.com/earendil-works/pi/pull/7471) 由 [@vish-pr](https://github.com/vish-pr) 提交）。
- 修复了Gemini 3工具调用ID在历史转换中被丢弃，导致签名多轮重播失败（[#7494](https://github.com/earendil-works/pi/pull/7494) 由 [@muyiyr](https://github.com/muyiyr) 提交）。
- 修复了OpenAI响应不完整的原因，仅将`max_output_tokens`视为长度终止符，并暴露了响应被截断低于预期输出限制的有界恢复检测机制（[#7540](https://github.com/earendil-works/pi/pull/7540) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

- 恢复了通过账户特定策略返回的GitHub Copilot模型响应（[#7672](https://github.com/earendil-works/pi/pull/7672) 由 [@muyiyr](https://github.com/muyiyr) 提交）。

- 用`qwen3.8-max`替换了已退役的Qwen Token Plan `qwen3.8-max-preview`模型（[#7670](https://github.com/earendil-works/pi/pull/7670) 由 [@QuintinShaw](https://github.com/QuintinShaw) 提交）。

## [0.83.0] - 2026-07-29

### 不兼容变更

- 将导出的TypeBox依赖升级到1.3.7，移除了包括`Type.Base`、`Type.Awaited`、`Type.Promise`、`Type.AsyncIterator`、`Type.Iterator`、`Type.Options`和`Value.Mutate`在内的废弃API，同时修复了可空数组工具参数的编译验证。使用已移除API的消费者必须迁移到受支持的TypeBox API（[#7243](https://github.com/earendil-works/pi/pull/7243) 由 [@petrroll](https://github.com/petrroll) 提交）。

### 新增

- 为支持文本和图像提供商的传输添加了每请求`fetch`注入；Google适配器拒绝非全局实现而非静默绕过。
- 为GitHub Copilot提供商添加了Claude Opus 5支持，通过Anthropic Messages API路由，具备自适应思维、1M上下文和Copilot `minimal`思维级别覆盖（[#7158](https://github.com/earendil-works/pi/pull/7158) 由 [@jay-aye-see-kay](https://github.com/jay-aye-see-kay) 提交）。
- 为部分流式消息添加了`"pending"`终止原因。详见[Stop Reasons](README.md#stop-reasons)（[#7151](https://github.com/earendil-works/pi/pull/7151) 由 [@lucasmeijer](https://github.com/lucasmeijer) 提交）。
- 为Google、Anthropic、Amazon Bedrock、Mistral和OpenAI流添加了`AssistantMessage.rawStopReason`，并将其填充；未映射的终端原因现在作为提供商错误显示而非成功终止（[#7272](https://github.com/earendil-works/pi/pull/7272)）。
- 为OpenRouter OAuth登录添加了手动重定向URL和授权码输入，适用于远程和无头环境（[#7114](https://github.com/earendil-works/pi/pull/7114) 由 [@rgarcia](https://github.com/rgarcia) 提交）。
- 添加了`AuthResolutionOverrides.minOAuthValidityMs`，使调用者可以要求并刷新OAuth凭证，确保其剩余有效期至少为最小值（[#7168](https://github.com/earendil-works/pi/pull/7168)）。

### 变更

- 将存储的OAuth凭证改为在剩余有效期少于五分钟时刷新，而非等待过期（[#7168](https://github.com/earendil-works/pi/pull/7168)）。

### 修复

- 修复了Qwen Token Plan推理模型，使其发送服务特定的思维控制和支持的推理努力级别（[#6951](https://github.com/earendil-works/pi/issues/6951)，[#6998](https://github.com/earendil-works/pi/issues/6998)）。
- 修复了Z.AI提供商和兼容的自定义端点，使其通过`max_tokens`发送输出限制，这些端点会遵守该限制（[#7174](https://github.com/earendil-works/pi/pull/7174) 由 [@HyeokjaeLee](https://github.com/HyeokjaeLee) 提交）。
- 修复了显式配置的Amazon Bedrock配置文件被环境AWS访问密钥覆盖的问题（[#7176](https://github.com/earendil-works/pi/pull/7176) 由 [@christianbasch](https://github.com/christianbasch) 提交）。
- 修复了OpenAI兼容工具调用增量中，同时包含有效`function`负载和空`custom`对象导致函数参数被丢弃的问题（[#7288](https://github.com/earendil-works/pi/pull/7288) 由 [@sunnyyoung](https://github.com/sunnyyoung) 提交）。

## [0.82.1] - 2026-07-25

### 新增

- 添加了`ModelsStoreEntry.etag`，使持久化提供商目录能够携带远程实体验证器（ETag）以支持条件刷新。
- 为Anthropic兼容网关添加了`ANTHROPIC_AUTH_TOKEN`承载式身份验证（[#5871](https://github.com/earendil-works/pi/issues/5871)）。
- 为Anthropic和Amazon Bedrock添加了Claude Opus 5支持，具备自适应思维、推理配置文件、提示缓存和保留的AWS验证消息（[#7081](https://github.com/earendil-works/pi/pull/7081) 由 [@unexge](https://github.com/unexge) 提交，[#7083](https://github.com/earendil-works/pi/pull/7083) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

### 变更

- 将Radius OAuth设备授权、令牌交换和刷新请求改为直接使用配置的网关。
- 将`ModelsError`消息修改为追加底层原因，使认证失败（如`OAuth refresh failed for openai-codex`）报告提供商响应而非仅包裹消息。

## [0.82.0] - 2026-07-24

### 不兼容变更
- 将`getBuiltinModelDataUrl(provider)`替换为`getBuiltinModelDataGeneratedAt()`，使内置目录的新鲜度使用其记录的生成时间，而非安装相关的文件元数据（[#7016](https://github.com/earendil-works/pi/pull/7016) by [@davidbrai](https://github.com/davidbrai)）。

### 添加

- 为`kimi-coding`提供程序添加了Kimi Code订阅OAuth登录，支持设备授权、令牌刷新和OAuth主机覆盖（[#6935](https://github.com/earendil-works/pi/pull/6935) by [@zaycruz](https://github.com/zaycruz)）。
- 添加了OpenRouter OAuth PKCE登录，可为聊天和图片提供程序生成用户控制的API密钥（[#6927](https://github.com/earendil-works/pi/pull/6927) by [@rsaryev](https://github.com/rsaryev)）。
- 添加了`Tool.constrainedSampling`，采用严格的JSON Schema（`prefer`/`require`）和OpenAI Lark/regex语法变体，强制在OpenAI、Anthropic、Amazon Bedrock、Google Gemini和Mistral提供程序端对工具采样进行约束。详见[Constrained Sampling for Tools](README.md#constrained-sampling-for-tools)。
- 添加了`supportsGrammarTools`和`supportsStrictTools`的兼容性标志，扩展了`supportsStrictMode`以支持Responses和Bedrock模型，并生成模型能力元数据以控制采样。

### 更改

- 将生成的模型目录更改为仅暴露来自models.dev的提供程序验证的推理努力等级（[#6928](https://github.com/earendil-works/pi/pull/6928) by [@davidbrai](https://github.com/davidbrai)）。

### 修复

- 修复了OpenAI Codex缓存WebSocket续接的问题，使其在语法工具调用后仅发送真实的工具结果增量。
- 修复了Google、Amazon Bedrock、Mistral和Azure OpenAI Responses适配器的约束工具采样，包括模型感知的严格工具能力、语法配置验证和格式错误的语法调用重播错误。
- 修复了`cacheRetention: "none"`，以禁用对支持的OpenAI模型的隐式提示缓存写入，并对OpenAI Codex启用基于会话的缓存（[#6618](https://github.com/earendil-works/pi/pull/6618) by [@tmustier](https://github.com/tmustier)）。
- 修复了DNS查找失败（如`getaddrinfo`、`ENOTFOUND`和`EAI_AGAIN`）以触发自动助手重试（[#6946](https://github.com/earendil-works/pi/pull/6946) by [@christianklotz](https://github.com/christianklotz)）。
- 修复了OpenAI Codex WebSocket会话，在`previous_response_not_found`错误后仅在缺少先前响应续接的情况下重试一次（[#6955](https://github.com/earendil-works/pi/pull/6955) by [@davidbrai](https://github.com/davidbrai)）。
- 修复了OpenAI和Anthropic提供程序的重试等待时间，使其尊重中止信号和配置的延迟限制（[#6980](https://github.com/earendil-works/pi/pull/6980) by [@petrroll](https://github.com/petrroll)）。
- 修复了OpenRouter Anthropic缓存断点，使其能够通过工具结果前进，并为`~anthropic/*-latest`别名启用缓存控制（[#6941](https://github.com/earendil-works/pi/pull/6941) by [@mteam88](https://github.com/mteam88)）。

## [0.81.1] - 2026-07-21

### 添加

- 添加了`retryAssistantCall()`，用于对瞬态助手失败进行有界重试，支持生命周期回调和中止处理（[#6901](https://github.com/earendil-works/pi/pull/6901) by [@davidbrai](https://github.com/davidbrai)）。

### 修复

- 修复了Moonshot AI和Moonshot AI China的Kimi K3模型，使其使用OpenAI的思考格式并暴露推理努力支持。

## [0.81.0] - 2026-07-21

### 添加

- 添加了Qwen Token Plan和Qwen Token Plan China作为内置提供程序，支持区域端点、API密钥认证和生成模型目录（[#6858](https://github.com/earendil-works/pi/pull/6858) by [@QuintinShaw](https://github.com/QuintinShaw)）。
- 添加了`contentText`，用于从消息内容中提取联合文本（[#6840](https://github.com/earendil-works/pi/pull/6840) by [@xl0](https://github.com/xl0)）。
- 添加了一个共享的`uuidv7`实用工具，用于时间顺序标识符（[#6834](https://github.com/earendil-works/pi/pull/6834) by [@xl0](https://github.com/xl0)）。
- 为工具结果消息添加了可选的使用元数据（[#6671](https://github.com/earendil-works/pi/pull/6671) by [@davidbrai](https://github.com/davidbrai)）。

### 更改

- 将生成的模型目录更改为将TypeScript模型形状与被忽略的JSON模型值分开，减少生成源的变更量（[#6765](https://github.com/earendil-works/pi/pull/6765) by [@mitsuhiko](https://github.com/mitsuhiko)）。
- 更改了模型生成，使其在编译前验证被忽略的提供程序数据；`npm run build`刷新模型数据如以前一样，而`npm run build:offline`则在没有网络访问的情况下重用现有数据。

### 修复
- 修复了存储的API密钥凭证，使其在身份验证解析时能够应用其提供者作用域的`env`值，包括Amazon Bedrock配置文件（[#6864](https://github.com/earendil-works/pi/pull/6864)由[@cristinaponcela](https://github.com/cristinaponcela)提交）。
- 修复了OpenAI兼容的跨提供者回放功能，以保持唯一工具调用ID，即使多个调用共享同一提供者调用ID（[#6854](https://github.com/earendil-works/pi/pull/6854)由[@cristinaponcela](https://github.com/cristinaponcela)提交）。
- 修复了Kimi K3，使其能够暴露其支持的低、高和最大思考级别，并将`k2p7`别名规范化为标准的`kimi-for-coding`模型。
- 修复了OpenCode Go提供者，以支持通过OpenAI Responses API路由的模型。
- 修复了`pi-ai`可执行路径，使其与npm注册表元数据匹配，避免重复的消费者锁定文件更改（[#6812](https://github.com/earendil-works/pi/pull/6812)由[@jmfederico](https://github.com/jmfederico)提交）。
- 修复了无状态OpenAI Codex WebSocket请求，使其使用UUIDv7请求ID，从而支持拒绝UUIDv4 ID的模型（[#6834](https://github.com/earendil-works/pi/pull/6834)由[@xl0](https://github.com/xl0)提交）。
- 修复了GitHub Copilot长上下文定价套餐在生成模型元数据中的显示（[#6668](https://github.com/earendil-works/pi/issues/6668)）。
- 修复了Kimi Coding订阅模型，在models.dev报告零定价时，报告与API等效的隐含成本。
- 修复了OpenAI Responses早期流结束被归类为可重试的提供者错误（[#6727](https://github.com/earendil-works/pi/issues/6727)）。
- 修复了GPT-5.6 Codex模型，默认使用272K上下文窗口，避免自动启用长上下文定价（[#6853](https://github.com/earendil-works/pi/pull/6853)由[@aadishv](https://github.com/aadishv)提交）。

## [0.80.10] - 2026-07-16

### 修复了

- 修复了Kimi Coding请求，使其使用Anthropic自适应思考努力且不涉及令牌预算，并为K3和`kimi-for-coding`启用空思考签名。
- 修复了Kimi K3的定价元数据，使其支持Moonshot AI和Moonshot AI China。
- 修复了Kimi Coding K3思考级别元数据，使其仅暴露受支持的`max`级别（[#6737](https://github.com/earendil-works/pi/issues/6737)）。
- 修复了目录生成，使其能够恢复在0.80.9版本中移除的xAI模型（[#6736](https://github.com/earendil-works/pi/issues/6736)）。

## [0.80.9] - 2026-07-16
### 新增

- 新增对Kimi Coding、Moonshot AI、Moonshot AI China、OpenRouter和Vercel AI Gateway的Kimi K3支持。
- 新增通过`compat.deferredToolsMode`实现的Kimi deferred工具加载，支持OpenAI兼容的Chat Completions。

### 修改

- 修改xAI设备OAuth，打开预填授权链接，并新增提供方特定的OAuth登录标签（[#6734](https://github.com/earendil-works/pi-mono/pull/6734) by [@Jaaneek](https://github.com/Jaaneek)）。

### 修复

- 修复Vercel AI Gateway和OpenRouter模型的Kimi K3输出限制。

### 移除

- 从内置xAI模型目录移除Grok 3、Grok 3 Fast、Grok 4.20变体及Grok Code Fast 1（[#6734](https://github.com/earendil-works/pi-mono/pull/6734) by [@Jaaneek](https://github.com/Jaaneek)）。

## [0.80.8] - 2026-07-16

### 重大变更

- 将运行时认证改为提供方作用域的`Models.checkAuth()`、`getAuth()`、`login()`和`logout()` API。`checkAuth()`现在返回`AuthCheck | undefined`，且API密钥认证解析器不再接收模型。
- 移除遗留的内置OAuth提供方对象、全局OAuth注册表API及公开的低级内置登录/刷新函数。建议使用标准`Provider.auth.oauth`方法；`oauth`子路径仅保留扩展兼容类型。
- 将标准登录交互接口从`AuthLoginCallbacks`重命名为`AuthInteraction`；它暴露了由API密钥和OAuth流程使用的提供方中立的`prompt()`/`notify()`协议。
- 修改`Models`请求契约：`getAuth(model)`现在包含模型头部，`getAuth(providerId)`仍为提供方作用域，且模型流选项可能包含`transformHeaders`。自定义`Models`实现必须在合并认证/模型和显式头部后执行转换，然后在提供方分发前移除。
- 将动态模型刷新改为`Models.refresh(options)`，该功能会刷新所有已配置的动态提供方并返回各提供方的错误/取消状态。`Provider.refreshModels(context)`现在接收有效凭证、作用域模型存储、网络策略和取消信号。
### 新增

- 新增了`Models`的提供商自有认证和可用性解析功能，包括通过`CredentialStore`支持的OAuth刷新和交互式登录。

- 新增了通过`CredentialStore.list()`的异步非机密凭证枚举功能和基于凭证的`Provider.filterModels()`可用性策略。

- 新增了中立认证流程信息/链接事件以及提供商自有Amazon Bedrock和Google Vertex AI凭证选择流程。

- 新增了`ModelsStore`，包含内存默认值，用于恢复和持久化动态提供商目录。

- 新增了动态Radius `pi-messages`网关提供商，支持OAuth和基于凭证的目录刷新。

- 新增了`Models.refresh({ force: true })`，允许提供商在显式刷新时绕过新鲜度检查。

- 新增了xAI设备码OAuth登录，并将Grok 4.5路由至OpenAI Responses，支持低、中、高思考模式（[#6651](https://github.com/earendil-works/pi-mono/pull/6651) 由 [@Jaaneek](https://github.com/Jaaneek) 提交）。

### 更改

- 将`Models.getAuth(model)`更改为包含模型头，并新增了仅限模型的`transformHeaders`流选项，该选项在认证和显式头部组装后运行，但不会转发给提供商。

### 修复

- 修复了Cloudflare Workers AI和AI网关流，使其在认证解析后填充账户和网关端点占位符，兼容自定义模型对象的流式传输。

- 修复了懒加载提供商流，在转发内层流时保留其最终助手消息。

- 修复了OpenAI Codex会话ID超过64字符的问题，以符合API限制（[#6630](https://github.com/earendil-works/pi-mono/issues/6630)）。

## [0.80.7] - 2026-07-14

### 破坏性更改

- 移除了`OpenAIResponsesCompat.sendSessionIdHeader`标志。会话亲和力行为现在由`compat.sessionAffinityFormat`（`"openai"`、`"openai-nosession"`或`"openrouter"`）控制。用`sessionAffinityFormat: "openai-nosession"`替换了`sendSessionIdHeader: false`（[#6496](https://github.com/earendil-works/pi-mono/pull/6496) 由 [@petrroll](https://github.com/petrroll) 提交）。

### 新增

- 新增了缓存友好的动态工具加载。`ToolResultMessage.addedToolNames`标记了`Context.tools`工具的可用性；Anthropic和OpenAI Responses使用原生延迟加载，以便较晚加载的工具不会出现在缓存前缀中，而其他提供商继续使用`Context.tools`（[#6474](https://github.com/earendil-works/pi-mono/pull/6474)）。

- 新增了Claude Fable 5的原生`xhigh`和`max`思考级别，适用于所有生成的提供商目录（[#6490](https://github.com/earendil-works/pi-mono/pull/6490) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

- 新增了`toolChoice`对OpenAI和Codex Responses的支持，包括必需和命名工具选择（[#6588](https://github.com/earendil-works/pi-mono/pull/6588) 由 [@xl0](https://github.com/xl0) 提交）。

### 修复

- 修复了OpenRouter模型上下文窗口，使其使用顶级提供商的实际上下文长度（[#6481](https://github.com/earendil-works/pi-mono/pull/6481) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

- 修复了GitHub Copilot `mai-code-1-flash-picker`模型，使其通过`/responses`端点路由（[#6544](https://github.com/earendil-works/pi-mono/pull/6544) 由 [@petrroll](https://github.com/petrroll) 提交）。

- 修复了Amazon Bedrock请求，使其使用通用`apiKey`流选项作为Bedrock承载令牌。

- 修复了OpenRouter OpenAI兼容会话ID，使其使用`x-session-id`头部，而非OpenAI特定的会话亲和力字段（[#6496](https://github.com/earendil-works/pi-mono/pull/6496) 由 [@petrroll](https://github.com/petrroll) 提交）。

- 修复了Amazon Bedrock的环境AWS凭证，使其继续使用SigV4认证，包括对自定义模型ID的支持（[#6532](https://github.com/earendil-works/pi-mono/pull/6532) 由 [@ribelo](https://github.com/ribelo) 提交）。

- 修复了Cloudflare Workers AI和AI网关认证，使其在存储凭证仅包含API密钥时，使用环境账户和网关ID（[#6292](https://github.com/earendil-works/pi-mono/pull/6292) 由 [@markphelps](https://github.com/markphelps) 提交）。

- 修复了Amazon Bedrock错误，使其报告未处理的提供商停止原因，而非仅`An unknown error occurred`（[#6598](https://github.com/earendil-works/pi-mono/pull/6598) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

- 修复了Azure OpenAI Responses的推理回放，当`encrypted_content`仅出现在终端响应事件中时（[#6608](https://github.com/earendil-works/pi-mono/pull/6608) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

- 修复了Anthropic兼容代理，使其在`message_delta`事件中包含`usage`（[#6611](https://github.com/earendil-works/pi-mono/pull/6611) 由 [@davidbrai](https://github.com/davidbrai) 提交）。
- 修复了OpenCode OpenAI响应模型，使其在省略不支持的`session-id`头部的同时，保留其他缓存亲和力数据（[#6645](https://github.com/earendil-works/pi-mono/pull/6645) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

## [0.80.6] - 2026-07-09

### 新增  
- 新增了一个独立的可选入内`max`思考级别，包括对GPT-5.6和Anthropic自适应思考的原生`xhigh`及`max`支持。所有自适应Claude模型均支持与Anthropic文档一致的元数据（`max`），Opus 4.7/4.8、Sonnet 5和Fable 5仅支持原生`xhigh`。

- 新增请求级输入token定价层级，以完善模型成本元数据和使用成本计算。

### 修复

- 修复了紧凑输出后token预算，使其忽略紧凑边界前的过期助手使用情况（[#6464](https://github.com/earendil-works/pi/issues/6464)）。  
- 修复了GPT-5.4和GPT-5.5的长上下文成本核算，同时保留了对需要显式覆盖的模型的272K默认上下文限制。  
- 修复了GPT-5.6的元数据，使其在短上下文层级保留直接OpenAI请求，同时暴露Codex后端的372K上下文窗口及长上下文定价，并移除了OpenAI和Azure OpenAI响应目录中不存在的裸`gpt-5.6`别名。  
- 修复了Anthropic消息转换，使其保留带有有效签名但思考文本为空的思考块，避免在新版Claude模型上出现思考块错误（[#6457](https://github.com/earendil-works/pi/pull/6457) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

## [0.80.5] - 2026-07-09

## [0.80.4] - 2026-07-09

### 修复

- 修复了gRPC `ResourceExhausted`提供程序错误的重试分类，例如NVIDIA NIM临时耗尽响应（[#6449](https://github.com/earendil-works/pi/pull/6449) 由 [@davidbrai](https://github.com/davidbrai) 提交）。  
- 修复了底层消息转换，使其在提供程序转换前标准化`null`消息内容，避免在导入的转录文件较宽松时崩溃（[#6343](https://github.com/earendil-works/pi/pull/6343)）。  
- 修复了小米Token Plan模型元数据，使其遵循models.dev的token-plan目录，移除了不支持的`mimo-v2-omni`变体（[#6204](https://github.com/earendil-works/pi/issues/6204)）。  
- 修复了GitHub Copilot设备码登录轮询，在首次token轮询前等待，避免在浏览器授权后部分用户出现设备码失败（[#6187](https://github.com/earendil-works/pi/issues/6187)）。  
- 修复了OAuth设备码轮询，使其尊重服务器提供的`slow_down`间隔，而非仅应用RFC 8628的5秒增量，使GitHub Copilot登录恢复，而非在轮询提前到达时（如WSL/VM时钟漂移）挂起（[#6187](https://github.com/earendil-works/pi/issues/6187)）。  
- 修复了OpenAI Codex用户代理构建，使其同步加载Node OS元数据，避免启动竞态导致报告`pi (browser)`（在Node/Bun中）。  
- 修复了Fireworks GLM 5.2 Fast，使其使用兼容OpenAI的端点和`thinkingLevelMap`，与GLM 5.2保持一致（[#6195](https://github.com/earendil-works/pi/issues/6195)）。  
- 修复了Amazon Bedrock Claude Fable 5和Sonnet 5的提示缓存点（[#6235](https://github.com/earendil-works/pi/issues/6235)）。  
- 修复了Amazon Bedrock Claude 5的提示缓存定价元数据，移除了过期的回退覆盖项。  
- 修复了DS4服务器上下文溢出检测中的`Prompt has ... tokens, but the configured context size is ... tokens`错误（[#6262](https://github.com/earendil-works/pi/issues/6262)）。  
- 修复了OpenAI Codex WebSocket会话，在后端60分钟限制前轮换缓存连接，避免长时间会话出现连接限制失败（[#6268](https://github.com/earendil-works/pi/issues/6268)）。  
- 修复了Cloudflare Workers AI/AI Gateway认证，使其在存储凭证仅包含API密钥时回退到环境`CLOUDFLARE_ACCOUNT_ID`（及`CLOUDFLARE_GATEWAY_ID`），从而解决了仅凭`/login`风格密钥凭证导致`{CLOUDFLARE_ACCOUNT_ID}`占位符未解析返回404的问题（[#6021](https://github.com/earendil-works/pi/issues/6021)）。  
- 修复了OpenAI完成和响应提供程序，在工具结果为空文本且无图片内容时发送`(no tool output)`而非`(see attached image)`，防止模型虚构图片附件。  
- 修复了OpenAI响应和Azure OpenAI响应请求，避免发送低于提供程序最低值的`max_output_tokens`（[#6265](https://github.com/earendil-works/pi/issues/6265)）。
- 修复了Cloudflare 524超时响应的重试分类（[#6239](https://github.com/earendil-works/pi/issues/6239)）。
- 修复了Bun获取socket-drop错误（如`socket connection was closed`）的重试分类，使短暂的流断开连接能够自动重试（[#6431](https://github.com/earendil-works/pi/issues/6431)）。
- 修复了GitHub Copilot扩展上下文窗口模型（Claude Opus 4.7/4.8，Claude Opus 4.6，Claude Sonnet 4.6/5，Claude Fable 5，GPT-5.3 Codex，GPT-5.4，GPT-5.5）以使用`contextWindow: 1000000`，防止过早压缩和预算不足（[#6439](https://github.com/earendil-works/pi/issues/6439)）。

### 新增

- 新增了OpenAI GPT-5.6模型的元数据（`gpt-5.6`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`），并验证了`openai-codex`对`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`的支持。
- 新增了通过`Tool.constrainedSampling`对工具的提供方侧约束采样：对OpenAI和Anthropic工具调用严格执行JSON-schema约束，以及OpenAI自定义语法工具（Lark/regex）。语法工具能力来源于模型目录的`supportsGrammarTools`兼容标志，该标志已启用，适用于OpenAI、OpenAI Codex、Azure OpenAI、GitHub Copilot、opencode和Cloudflare AI Gateway上的GPT-5+模型（[#6341](https://github.com/earendil-works/pi/pull/6341)）。
- 刷新了从models.dev生成的模型目录，新增了包括GitHub Copilot的Kimi K2.7 Code和Fable 5在内的多个提供方的模型（[#6256](https://github.com/earendil-works/pi/issues/6256)）。
- 将Claude Sonnet 5添加到GitHub Copilot模型目录（[#6200](https://github.com/earendil-works/pi/issues/6200)）。
- 为OpenAI Codex Responses SSE传输新增了zstd请求体压缩。当Node/Bun支持zstd时，请求会携带`Content-Encoding: zstd`；WebSocket传输保持不变。

## [0.80.3] - 2026-06-30

### 新增

- 新增了Anthropic Claude Sonnet 5模型的元数据，适用于Anthropic兼容、Bedrock、OpenRouter和Vercel AI Gateway提供方。
- 新增了对现代Microsoft Foundry端点URL的Azure OpenAI响应支持（[#6004](https://github.com/earendil-works/pi/pull/6004)由[@gukoff](https://github.com/gukoff)提交）。
- 新增了一个可选的`reasoning`字段到`Usage`，用于报告`output`中推理/思考令牌计数的子集。该字段已填充Anthropic（`output_tokens_details.thinking_tokens`）、OpenAI Responses/Codex/Azure（`output_tokens_details.reasoning_tokens`）、OpenAI Completions（`completion_tokens_details.reasoning_tokens`）和Google Generative AI / Vertex（`thoughtsTokenCount`）。Bedrock Converse和Mistral未填充，因为这些API不返回推理令牌细分（[#6057](https://github.com/earendil-works/pi/issues/6057)）。

### 更改

- 更改了OpenAI Codex Responses SSE响应头等待，使用配置的HTTP超时，而非之前的固定20秒超时，减少了慢连接上的虚假超时（[#4945](https://github.com/earendil-works/pi/issues/4945)）。

### 修复

- 修复了Claude Sonnet 5元数据，使其在Anthropic兼容和Bedrock请求中使用自适应思考负载。
- 修复了生成的Xiaomi MiMo模型定价，使其与models.dev当前的按使用付费定价保持一致（[#6138](https://github.com/earendil-works/pi/issues/6138)）。
- 修复了提供方HTTP错误，使其包含响应体而非晦涩的SDK消息（[#5832](https://github.com/earendil-works/pi/pull/5832)由[@stephanmck](https://github.com/stephanmck)提交）。
- 修复了`streamSimple()`，使其发送上下文感知的最大令牌限制，以便那些按上下文窗口计算输入和输出的提供方不会拒绝长请求（[#5595](https://github.com/earendil-works/pi/issues/5595)）。
- 修复了OpenAI Responses流，使其在输出项按顺序完成时仍能保留推理重播状态（[#6009](https://github.com/earendil-works/pi/issues/6009)）。
- 修复了提供方错误的重试分类，这些错误明确指示调用者应重试请求（[#6019](https://github.com/earendil-works/pi/issues/6019)）。
- 修复了Z.AI保留的思考请求，在启用思考时发送`thinking.clear_thinking: false`，允许重播的`reasoning_content`参与提供方缓存（[#6083](https://github.com/earendil-works/pi/issues/6083)）。

## [0.80.2] - 2026-06-23

### 更改

- 更改了`ApiKeyCredential`，使其使用与`auth.json`兼容的`type: "api_key"`区分器和提供方范围的`env`值，而非`type: "api-key"`和元数据。

### 修复

- 修复了Anthropic兼容的自定义模型，使其使用明确的兼容性元数据，而非提供方名称启发式方法，用于会话亲和力头和不支持的工具字段省略。
-  修复了请求范围 `apiKey` 和 `env` 值参与提供者认证解析的问题，使 Cloudflare 等提供者能够从显式调用选项中派生出请求特定的基础 URL ([#6021](https://github.com/earendil-works/pi/issues/6021))。  
-  恢复了兼容入口点上的临时遗留单个 API 流式别名（如 `streamSimpleOpenAICompletions`）([#6016](https://github.com/earendil-works/pi/issues/6016), [#6017](https://github.com/earendil-works/pi/issues/6017))。  
-  恢复了模型没有显式兼容元数据时 `detectCompat` 的运行时回退机制（在 `openai-completions` 中）([#6020](https://github.com/earendil-works/pi/issues/6020))。

## [0.80.1] - 2026-06-23

###  修复了  
-  修复了 Amazon Bedrock 范围内 `AWS_PROFILE` 端点解析的回归问题（针对内置推理配置文件端点）。  
-  修复了 Fireworks Anthropic 兼容请求，使其正确应用会话亲和力及对自定义 Fireworks 模型不支持的工具字段默认值。  
-  修复了 Together MiniMax M2.7 元数据，避免不支持的 Together 推理切换功能。

## [0.80.0] - 2026-06-23

###  重大变更  
-  根入口点（`@earendil-works/pi-ai`）现为仅核心模块且无副作用。旧的全局 API 已迁移到临时 `@earendil-works/pi-ai/compat` 入口点（为根入口点的严格超集）；切换文件导入路径是唯一的迁移步骤。迁移的符号包括 `stream`/`complete`/`streamSimple`/`completeSimple`，`getModel`/`getModels`/`getProviders`（现为 `getBuiltinModel`/`getBuiltinModels`/`getBuiltinProviders` 在 `@earendil-works/pi-ai/providers/all` 中的已弃用别名），`registerApiProvider`/`unregisterApiProviders`/`resetApiProviders`/`getApiProvider`，`getEnvApiKey`/`findEnvKeys`，`setBedrockProviderModule`，各 API 的懒加载流式包装器（`anthropicMessagesApi` 等），以及图像生成 API。  
-  将 `Provider` 类型重命名为 `ProviderId`。`Provider` 现在命名了运行时提供者接口（包含 id、name、认证、模型列表及流式行为）。  
-  API 实现模块已从 `src/providers/` 迁移到 `@earendil-works/pi-ai/api/*`，并按 API ID 重命名（`anthropic` -> `api/anthropic-messages`，`google` -> `api/google-generative-ai`，`mistral` -> `api/mistral-conversations`，`amazon-bedrock` -> `api/bedrock-converse-stream`），每个模块均导出 `stream` 和 `streamSimple`。旧的单个实现导出名（`streamAnthropic`，`streamSimpleAnthropic`，...）及遗留原始 API 子路径（`./anthropic`，`./google`，`./openai-completions`，...）已移除；通过 `@earendil-works/pi-ai/api/*` 导入原始 API 实现。  
-  移除了选择性提供者入口点 `@earendil-works/pi-ai/base`；使用根核心 API 并配合显式的 `createModels()` 集合及提供者工厂即可实现隔离化包。

迁移指南：

-  请完整阅读 `packages/ai/README.md` 以了解新 `Models` API、提供者工厂、认证配置、图像生成及自定义提供者示例。  
-  为临时保留旧全局 API，将导入路径从 `@earendil-works/pi-ai` 更改为 `@earendil-works/pi-ai/compat`。兼容入口点仍保留 `stream`/`complete`、生成目录读取、API 注册辅助、环境 API 密钥辅助、懒加载 API 包装器及图像全局变量，但将在后续版本移除。  
-  迁移到新运行时，请创建 `Models` 集合并调用其方法：

  ```ts
  import { builtinModels } from "@earendil-works/pi-ai/providers/all";

  const models = builtinModels();
  const model = models.getModel("anthropic", "claude-haiku-4-5");
  if (!model) throw new Error("model not found");

  const message = await models.complete(model, {
    messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
  });
  ```
  
-  对于隔离提供者集，请显式注册提供者工厂：

  ```ts
  import { createModels } from "@earendil-works/pi-ai";
  import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";

  const models = createModels();
  models.setProvider(anthropicProvider());
  ```
  
-  要直接调用原始 API 实现，请从 `@earendil-works/pi-ai/api/*` 导入并自行传入兼容模型及认证/选项。原始 API 模块导出 `stream` 和 `streamSimple`；对返回流使用 `.result()` 可实现 `complete`/`completeSimple` 行为：

  ```ts
  import { streamSimple } from "@earendil-works/pi-ai/api/anthropic-messages";
  import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";

  const model = getBuiltinModel("anthropic", "claude-haiku-4-5");
  const stream = streamSimple(
    model,
    { messages: [{ role: "user", content: "Hello", timestamp: Date.now() }] },
    { apiKey: process.env.ANTHROPIC_API_KEY },
  );

  const message = await stream.result();
  ```
  
自定义原始模型必须设置匹配的 `api` 值（例如 `"anthropic-messages"` 对 `api/anthropic-messages`）及 `model.compat` 中任何必需的提供者兼容元数据。

###  增加了
- 新的`Models`运行时：`createModels()`构建了一个隔离的提供者集合，采用同步模型读取（`getModels`/`getModel`返回最后已知的列表），一个显式的异步`refresh(provider?)`用于动态提供者，身份认证解析（`getAuth`），以及`stream`/`complete`/`streamSimple`/`completeSimple`，这些会通过拥有者提供者来解析身份认证。`createProvider()`从部件构建提供者（单个API实现或在`model.api`上分发的映射；静态`models`数组加上一个可选的`refreshModels`获取器，支持正在进行中的去重）；`hasApi()`动态缩小列出的模型。

- 提供者身份认证基底：`ProviderAuth`（`{ apiKey?, oauth? }`），每个提供者一个类型标记的凭证，`CredentialStore`（`read`/`modify`/`delete`，支持序列化写入；内存默认），`envApiKeyAuth()`，`lazyOAuth()`，以及可注入的`AuthContext`。OAuth刷新在存储锁下运行，并进行双重检查过期；存储的凭证拥有其提供者（没有静默环境回退）。

- 每个内置提供者在`@earendil-works/pi-ai/providers/*`下有一个提供者工厂（例如`anthropicProvider()`，`openrouterProvider()`），再加上`@earendil-works/pi-ai/providers/all`，支持`builtinProviders()`/`builtinModels()`和类型化的`getBuiltin*`目录读取。生成的目录按提供者拆分，因此导入一个提供者会拉取一个目录；`sideEffects`元数据使包具备树摇功能。

- Anthropic、OpenAI Codex、GitHub Copilot等OAuth流程获得了`OAuthAuth`适配器（`login`/`refresh`/`toAuth`），并在统一的`prompt()`/`notify()`登录回调上运行；Copilot的每个凭证基础URL在`toAuth()`中推导。

- `fauxProvider()`返回一个基于显式的`Models`集合构建的伪`Provider`，用于测试。

- 图像生成与聊天端设计一致：`createImagesModels()`/`ImagesProvider`/`createImagesProvider()`采用同步模型读取，显式的`refresh()`，通过提供者解析的身份认证，以及永不拒绝的`generateImages()`；`openrouterImagesProvider()`工厂加上`builtinImagesProviders()`/`builtinImagesModels()`在`providers/all`中。`ImagesProvider`的id类型别名重命名为`ImagesProviderId`；旧的全局图像API保留在`/compat`。

- 提供者身份认证结果可以携带提供者范围的环境值，这些值由`Models`和`ImagesModels`合并到API实现选项中。

### 修复

- 修复OpenAI响应流在终端响应事件之前结束时会失败，并将`response.incomplete`视为长度停止（[#5526](https://github.com/earendil-works/pi/pull/5526)由[@dmmulroy](https://github.com/dmmulroy)提交）。

- 修复Amazon Bedrock端点解析，使其尊重作用域的`AWS_PROFILE`值。

- 修复Cloudflare提供者，要求账户/网关配置，并将内置的`/compat`请求路由通过提供者身份认证。

- 修复`/compat`API密钥注入，使其尊重请求范围的`env`值。

- 修复OpenAI Codex响应WebSocket会话，在OpenAI连接限制达到输出开始前时，仅在需要时重新连接一次（[#5973](https://github.com/earendil-works/pi/issues/5973)）。

- 修复OpenCode Go GLM-5.2元数据，使其暴露`xhigh`推理并发送`reasoning_effort: "max"`（[#5967](https://github.com/earendil-works/pi/issues/5967)）。

## [0.79.10] - 2026-06-22

### 修复

- 修复OpenAI兼容的流式传输，使其在加密的`reasoning_details`到达之前保持匹配工具调用增量的加密（[#5114](https://github.com/earendil-works/pi/issues/5114)）。

## [0.79.9] - 2026-06-20

### 添加

- 添加了对OpenAI兼容提供者（如DeepSeek模型在vLLM后端）的可配置`chat-template`思考支持，这些提供者使用`chat_template_kwargs`（[#5673](https://github.com/earendil-works/pi/issues/5673)）。

### 修复

- 修复Fireworks GLM-5.2元数据，使其使用支持`reasoning_effort`的OpenAI兼容聊天补全端点（[#5923](https://github.com/earendil-works/pi/issues/5923)）。

- 修复OpenRouter GLM-5.2元数据，使其暴露`xhigh`推理并发送OpenRouter的原生`xhigh`努力（[#5770](https://github.com/earendil-works/pi/issues/5770)）。

- 修复GitHub Copilot OAuth模型可用性，使其使用已认证账户的模型选择器目录（[#5897](https://github.com/earendil-works/pi/issues/5897)）。

## [0.79.8] - 2026-06-19

### 添加
- 增加了`@earendil-works/pi-ai/base`以及打包程序选择性提供程序传输所需的直接提供程序注册导出功能（[#5348](https://github.com/earendil-works/pi/pull/5348)由[@FredKSchott](https://github.com/FredKSchott)提交）。

- 增加了使用pi会话ID作为`prompt_cache_key`的Mistral请求提示缓存，包括缓存令牌使用和成本核算（[#5854](https://github.com/earendil-works/pi/issues/5854)）。

- 增加了OpenRouter Fusion别名作为`openrouter/fusion`（[#5866](https://github.com/earendil-works/pi/pull/5866)由[@dannote](https://github.com/dannote)提交）。

## [0.79.7] - 2026-06-18

### 增加了

- 将GLM-5.2模型添加到OpenCode Go订阅模型目录中（[#5860](https://github.com/earendil-works/pi/issues/5860)）。

## [0.79.6] - 2026-06-16

### 修复了

- 修复了OpenCode Go DeepSeek V4在发送提供程序的`thinking: { type: "disabled" }`兼容性参数时的思考偏移请求。

## [0.79.5] - 2026-06-16

### 增加了

- 增加了提供程序范围的`StreamOptions.env`覆盖项，包括Cloudflare端点占位符、Azure OpenAI、Google Vertex、Amazon Bedrock、缓存保留和代理环境查找（[#5728](https://github.com/earendil-works/pi/issues/5728)）。

### 修复了

- 修复了OpenAI响应流以兼容在工具调用前OpenAI兼容服务器返回的null消息内容（[#5819](https://github.com/earendil-works/pi/issues/5819)）。
- 修复了OpenCode DeepSeek V4的思考请求，避免同时发送`thinking`和`reasoning_effort`（[#5818](https://github.com/earendil-works/pi/issues/5818)）。
- 修复了Z.AI GLM-5.2的思考请求，使其发送`reasoning_effort`，并与提供方的`high`/`max`努力映射相关（[#5770](https://github.com/earendil-works/pi/issues/5770)）。
- 修复了Google和`google-vertex` Gemini模型元数据，使其将`latest`别名映射到当前模型，为Vertex添加Gemini 3.5 Flash，修正Gemini 2.5 Flash Vertex缓存定价，并移除已关闭的Vertex预览模型（[#5761](https://github.com/earendil-works/pi/issues/5761)）。
- 修复了Moonshot AI中国模型元数据，包含Kimi K2.7 Code，并移除了Kimi K2.7 Code模型不支持的思考关闭负载（[#5760](https://github.com/earendil-works/pi/issues/5760)）。

## [0.79.4] - 2026-06-15

### 修复

- 修复了Anthropic 1小时提示缓存写入成本核算，将1小时缓存写入按2倍输入计费，而非5分钟缓存写入速率（[#5738](https://github.com/earendil-works/pi/pull/5738)由[@theBucky](https://github.com/theBucky)提交）。
- 修复了GitHub Copilot Claude自适应思维努力的元数据，使其与手动检查的Copilot模型能力相匹配（[#4637](https://github.com/earendil-works/pi/issues/4637)）。

- 修复了OpenCode/OpenCode Go补全模型，这些模型拒绝`prompt_cache_retention`，从而在`cacheRetention`为`long`时省略长时间缓存字段（[#5702](https://github.com/earendil-works/pi/issues/5702)）。

## [0.79.3] - 2026-06-13

### 修复

- 恢复了OpenAI GPT-5.4/GPT-5.5和OpenAI Codex GPT-5.4/GPT-5.4 mini/GPT-5.5上下文窗口元数据，使其与观察到的272k-token Codex后端限制一致，避免因发送超出Codex接受限制的提示而导致计费风险（由[@trethore](https://github.com/trethore)报告）。

## [0.79.2] - 2026-06-12

### 添加

- 添加了AWS数据保留文档链接，用于Amazon Bedrock不支持的数据保留模式验证错误（[#5561](https://github.com/earendil-works/pi/pull/5561)由[@unexge](https://github.com/unexge)提交）。

### 修复

- 修复了OpenAI兼容的上下文溢出检测，用于带括号的`maximum context length (N)`错误（[#5677](https://github.com/earendil-works/pi/issues/5677)）。

- 修复了OpenAI GPT-5.4/GPT-5.5和OpenAI Codex GPT-5.4/GPT-5.4 mini/GPT-5.5上下文窗口元数据，使其与当前OpenAI限制匹配（[#5644](https://github.com/earendil-works/pi/issues/5644)）。

- 将OpenAI Codex响应的SSE响应头超时增加到20秒，以减少假阳性停滞，同时保留对零事件挂起引入的有界等待（[#4945](https://github.com/earendil-works/pi/issues/4945)）。

- 修复了Anthropic拒绝停止，以保留提供商`stop_details`解释在错误消息中的显示（[#5666](https://github.com/earendil-works/pi/pull/5666)由[@rwachtler](https://github.com/rwachtler)提交）。

- 修复了Claude Fable 5的思维关闭请求，省略了Anthropic不支持的`thinking.type: "disabled"`负载（[#5567](https://github.com/earendil-works/pi/pull/5567)由[@tmustier](https://github.com/tmustier)提交）。

## [0.79.1] - 2026-06-09

### 添加

- 添加了Claude Fable 5到Anthropic和Amazon Bedrock模型元数据，支持自适应思维和`xhigh`努力。

### 修复
- 修复了Amazon Bedrock推理配置文件的ARN区域解析，优先使用ARN内嵌的区域而非`AWS_REGION`（[#5527](https://github.com/earendil-works/pi/pull/5527) 由 [@AJM10565](https://github.com/AJM10565) 提交）。
- 修复了z.ai离线思考请求，使其发送提供者的`thinking: { type: "disabled" }`兼容性参数（[#5330](https://github.com/earendil-works/pi/issues/5330)）。
- 修复了OpenCode补全模型元数据，使其发送明确的`maxTokens`作为`max_tokens`（[#5331](https://github.com/earendil-works/pi/issues/5331)）。
- 修复了Moonshot Kimi离线思考请求，使其发送提供者的`thinking: { type: "disabled" }`兼容性参数（[#5531](https://github.com/earendil-works/pi/issues/5531)）。
- 修复了Azure OpenAI响应请求，禁用服务器端响应存储（[#5530](https://github.com/earendil-works/pi/issues/5530)）。
- 修复了Azure GPT-5.4和GPT-5.5的上下文窗口元数据，调整为1,050,000个token，与Azure Foundry部署匹配，而非OpenAI的272k限制（[#5559](https://github.com/earendil-works/pi/issues/5559)）。
- 修复了OpenAI和Azure GPT-5 Pro的`maxTokens`元数据，调整为128,000，修正了上游重复272,000输入子限制为输出限制的值（[#5559](https://github.com/earendil-works/pi/issues/5559)）。

## [0.79.0] - 2026-06-08

### 修复

- 修复了OpenAI响应的自定义提供者，使其尊重`compat.supportsDeveloperRole: false`用于推理模型（[#5456](https://github.com/earendil-works/pi/issues/5456)）。
- 修复了OpenRouter路由偏好，使其在OpenAI兼容的自定义提供者上发送`compat.openRouterRouting`，即使`baseUrl`并未直接指向OpenRouter（[#5347](https://github.com/earendil-works/pi/issues/5347)）。

## [0.78.1] - 2026-06-04

### 添加

- 添加了Ant Ling作为内置的OpenAI兼容提供者，支持Ling 2.6和Ring 2.6模型。
- 将MiniMax-M3模型添加到`minimax`和`minimax-cn`的直接提供者中，并移除了强制覆盖上下文窗口的硬编码值，使其恢复使用models.dev中的实际值（[#5313](https://github.com/earendil-works/pi/issues/5313)）。
- 添加了NVIDIA NIM作为内置的OpenAI兼容提供者，公开支持工具调用的NIM模型。

### 修复

- 修复了Amazon Bedrock请求，将空白的必需用户/工具结果文本替换为占位符，并跳过空白的重放文本块（[#4975](https://github.com/earendil-works/pi/issues/4975)）。
- 修复了Anthropic Claude Opus 4.7+的请求，屏蔽了已弃用的温度参数（[#5251](https://github.com/earendil-works/pi/pull/5251) 由 [@yzhg1983](https://github.com/yzhg1983) 提交）。
- 修复了OpenAI GPT-5.5生成的元数据，以省略不支持的最小思考功能（[#5243](https://github.com/earendil-works/pi/issues/5243)）。
- 修复了OpenRouter Kimi K2.6的思考回放，并保留了OpenRouter OpenAI和Anthropic模型的开发者角色指令（[#5309](https://github.com/earendil-works/pi/issues/5309)）。
- 修复了OpenRouter推理指令请求，以在需要时保留系统角色（[#5221](https://github.com/earendil-works/pi/pull/5221)由[@PriNova](https://github.com/PriNova)提交）。
- 恢复了NVIDIA Qwen 3.5 122B NIM模型。

## [0.78.0] - 2026-05-29

### 重大变更

- 将直接提供商流函数更改为需要显式`options.apiKey`；顶级`stream*`/`complete*`辅助函数仍然解析内置环境认证。

### 新增

- 通过`StreamOptions.headers`新增对Amazon Bedrock请求头部的自定义支持，排除了保留的AWS签名头部（[#5178](https://github.com/earendil-works/pi-mono/pull/5178)由[@stephanmck](https://github.com/stephanmck)提交）。

### 修复

- 修复了OpenRouter Moonshot Kimi K2.6请求，以使用`system`代替不支持的`developer`消息（[#5159](https://github.com/earendil-works/pi-mono/issues/5159)）。
- 修复了OpenCode Go Kimi K2.6的思考请求，以发送`thinking`对象而不是无效的字符串值，并修复了OpenCode Zen Grok Build的思考请求，以省略不支持的`reasoning_effort`（[#5169](https://github.com/earendil-works/pi-mono/issues/5169)）。
- 修复了OpenAI Codex响应的SSE流，以在终端事件后停止读取响应体。
- 修复了OpenCode Kimi K2.6生成的元数据，以使用Anthropic风格的思考元数据，而不是无效的reasoning-effort参数。

## [0.77.0] - 2026-05-28

### 新增

- 新增了OpenAI Codex订阅设备码登录作为无头登录的可选替代方案，同时保持浏览器登录为默认方式（[#4911](https://github.com/earendil-works/pi/pull/4911)由[@vegarsti](https://github.com/vegarsti)提交）。
- 新增了Claude Opus 4.8模型的元数据，并更新了Opus的自适应思考覆盖范围以使用该模型。

### 修复
-  修复了将 OpenRouter DeepSeek V4 的 `xhigh` 推理元数据更改为保留 OpenRouter 原生努力，而不是发送 DeepSeek 的 `max` 努力（[#4801](https://github.com/earendil-works/pi/issues/4801)）。
-  修复了从 Anthropic 延伸思维会话切换后，OpenAI Codex 响应的 replay 问题，通过为转换后的思维/文本块生成唯一的回退消息项 ID（[#5148](https://github.com/earendil-works/pi/issues/5148)）。
-  修复了 Anthropic 兼容 replay，针对返回空思维签名的提供者，增加了可选的 `allowEmptySignature` 兼容性标志（[#4464](https://github.com/earendil-works/pi/issues/4464)）。
-  修复了 OpenAI 和 OpenRouter GPT-5.5 Pro 的思维层级元数据，仅暴露受支持的中、高、超高（medium, high, xhigh）努力级别。
-  修复了 OpenCode Go Kimi K2.6 的思维关闭请求，改为发送 `thinking: "none"`（[#5078](https://github.com/earendil-works/pi/issues/5078)）。
-  修复了小米 Token Plan 模型元数据，剔除了不支持的 `mimo-v2-flash` 变体（[#5075](https://github.com/earendil-works/pi/issues/5075)）。

## [0.76.0] - 2026-05-27

###  修复

-  修复了 OpenAI Codex 响应的缓存亲和力头部，改为发送 `session-id`，而非代理不兼容的 `session_id`（[#4967](https://github.com/earendil-works/pi/issues/4967)）。
-  修复了 `openai-codex/gpt-5.3-codex-spark` 生成的元数据，使其使用 128k 上下文窗口（[#4969](https://github.com/earendil-works/pi/issues/4969)）。
-  修复了 OpenRouter/Poolside 的上下文溢出检测，针对 `maximum allowed input length` 错误（[#4943](https://github.com/earendil-works/pi/issues/4943)）。
-  修复了 OpenAI Codex 响应的 WebSocket 流和 SSE 响应头部等待，改为应用有界的超时，而非无限等待无事件到达的情况（[#4945](https://github.com/earendil-works/pi/issues/4945)）。
-  修复了提供者重试控制，使 OpenAI Codex 响应遵守 `maxRetries`，SDK 默认重试为 `0`，且配额/计费 429 错误不会在 Pi 的重试处理机制下被重试（[#4991](https://github.com/earendil-works/pi-mono/pull/4991) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交）。

## [0.75.5] - 2026-05-23

###  破坏性变更

-  将 `OAuthLoginCallbacks` 修改为要求 `onDeviceCode` 和 `onSelect`，以便 OAuth 提供者可以依赖 pi 提供设备码和选择 UI 回调（[#4788](https://github.com/earendil-works/pi-mono/pull/4788) 由 [@vegarsti](https://github.com/vegarsti) 提交）。

###  修复

-  修复了自定义 Anthropic 兼容模型别名，通过增加 `compat.forceAdaptiveThinking` 模型元数据，并将内置自适应思维选择移出提供者 ID 子串检查（[#4797](https://github.com/earendil-works/pi-mono/pull/4797) 由 [@mbazso](https://github.com/mbazso) 提交）。
-  修复了 GitHub Copilot OAuth 登录，使其依赖必需的设备码回调，而非运行时回调可用性保护（[#4788](https://github.com/earendil-works/pi-mono/pull/4788) 由 [@vegarsti](https://github.com/vegarsti) 提交）。
-  修复了 Amazon Bedrock 提供者在严格包管理器下的加载问题，声明其直接依赖 `@smithy/node-http-handler`（[#4842](https://github.com/earendil-works/pi/issues/4842)）。
-  修复了 Amazon Bedrock Claude 请求，使其默认发送模型输出令牌上限，与 Anthropic 请求保持一致，避免 Bedrock 的 4096 令牌默认截断问题（[#4848](https://github.com/earendil-works/pi/issues/4848)）。

## [0.75.4] - 2026-05-20

###  变更

-  将源语法更改为避免需要 JavaScript 编译的 TypeScript 结构，保持包兼容 Node.js 仅检查 TypeScript 剥离兼容源。
-  移除了包级开发时的监控脚本，因为根目录 TypeScript 检查已验证仅兼容源。

###  增加

-  增加了一流的 OAuth 设备码回调元数据、共享轮询支持和 GitHub Copilot OAuth 集成。

###  修复

-  修复了 OpenAI 兼容的 `streamSimple()` 请求，停止发送基于模型的默认输出令牌上限，避免在如 vLLM 等服务器上的上下文窗口预留失败，同时保留显式的 `maxTokens` 和必需的 Anthropic `max_tokens` 处理（[#4675](https://github.com/earendil-works/pi/issues/4675)）。
-  修复了 OpenAI 提示缓存键，将会话派生值限制在 64 字符 API 限制内，适用于 OpenAI 响应、聊天补全、Codex 响应和 Azure OpenAI 响应（[#4720](https://github.com/earendil-works/pi/issues/4720)）。

## [0.75.3] - 2026-05-18

## [0.75.2] - 2026-05-18

###  修复

-  修复了小米 MiMo 生成的模型元数据，使其在思维模式多轮请求中，使用 `reasoning_content` 回放助手调用消息（[#4678](https://github.com/earendil-works/pi/issues/4678)）。

## [0.75.1] - 2026-05-18

###  修复
-  修复了 Anthropic 兼容的 API 密钥请求，使其忽略与 `ANTHROPIC_AUTH_TOKEN` 环境变量无关的值，避免了小米 MiMo 等提供商出现无效的承载凭证（[#4342](https://github.com/earendil-works/pi/issues/4342)）。
-  修复了 Amazon Bedrock 消息转换，使其跳过未知的内容块，而不是在流处理中失败（[#4223](https://github.com/earendil-works/pi/issues/4223)）。
-  修复了 Azure OpenAI 响应和 OpenAI 响应的错误格式，使其在 `errorMessage` 前缀 HTTP 状态码，以便瞬态 5xx 和 429 错误能够被代理级别的自动重试分类器正确匹配（[#4232](https://github.com/earendil-works/pi/issues/4232)）。
-  修复了小米 MiMo 模型元数据，使其使用 OpenAI 兼容的端点和 `openai-completions` API，恢复了多轮思考/工具调用会话（[#4505](https://github.com/earendil-works/pi/issues/4505)）。
-  修复了 OpenCode Go Kimi 推理回放，通过将流式 `reasoning` 字段标准化回 `reasoning_content`（仅限 OpenCode Go），使其正常工作（[#4251](https://github.com/earendil-works/pi/issues/4251)）。

###  已移除

-  已移除不工作的 OpenAI Codex 快速模型变体。

## [0.75.0] - 2026-05-17

###  破坏性变更

-  将最低支持的 Node.js 版本提升至 22.19.0。

###  修复

-  修复了 OpenAI Codex 生成的模型元数据，使其使用当前的上游模型列表（[#4603](https://github.com/earendil-works/pi-mono/pull/4603) 由 [@mattiacerutti](https://github.com/mattiacerutti) 提交）。
-  修复了 GitHub Copilot GPT 模型思考元数据，使其将不支持的最小思考映射为低（[#4622](https://github.com/earendil-works/pi-mono/pull/4622) 由 [@mattiacerutti](https://github.com/mattiacerutti) 提交）。
-  修复了 `streamSimple()` 模型的默认设置，当模型宣布的有效输出限制等于其完整上下文窗口时，避免了不可能的默认请求（[#4614](https://github.com/earendil-works/pi/issues/4614)）。

## [0.74.1] - 2026-05-16

###  增加

-  增加了图像生成 API、图像模型元数据，并内置了 OpenRouter 图像生成支持（[#3887](https://github.com/earendil-works/pi-mono/pull/3887) 由 [@cristinaponcela](https://github.com/cristinaponcela) 提交）。
-  增加了 Together AI 作为内置的 OpenAI 兼容提供商，包含生成的模型元数据和 `TOGETHER_API_KEY` 认证（[#3624](https://github.com/earendil-works/pi-mono/pull/3624) 由 [@Nutlope](https://github.com/Nutlope) 提交）。

###  修复

-  修复了 GitHub Copilot 模型可用性，使其忽略通用的 `GH_TOKEN` 和 `GITHUB_TOKEN` 环境变量，要求使用 OAuth 登录或 `COPILOT_GITHUB_TOKEN`（[#4485](https://github.com/earendil-works/pi/issues/4485)）。
-  修复了 `openai-completions` 流，使其在流结束前未出现任何终端 `finish_reason` 时显示错误，以便截断的响应可以重试而不是被接受为成功（[#4345](https://github.com/earendil-works/pi/issues/4345)）。
-  修复了 Fireworks 提供商缓存兼容性，通过添加会话亲和力头部和模型元数据兼容设置实现（[#4358](https://github.com/earendil-works/pi-mono/pull/4358) 由 [@yanirz](https://github.com/yanirz) 提交）。
-  修复了 OpenAI Codex WebSocket 传输，在 Bun 环境下尊重代理环境变量（[#4354](https://github.com/earendil-works/pi-mono/pull/4354) 由 [@haoqixu](https://github.com/haoqixu) 提交）。
-  修复了 OpenRouter 缓存使用标准化，保持缓存令牌语义，而不将其视为缓存写入。
-  修复了 Bedrock 代理处理，使其在使用 HTTP(S) 仅代理代理时保留 `NO_PROXY` 排除项。
-  修复了编译后的 Bun 二进制文件在 Bedrock 代理支持尝试从外部 `node_modules` 解析 `proxy-from-env` 时无法在仓库外启动（[#4513](https://github.com/earendil-works/pi/issues/4513)）。
-  修复了 GitHub Copilot Claude 测试覆盖率，使其使用当前的 Claude Sonnet 4.6 模型 ID。
-  修复了 OpenAI 响应请求，对于支持禁用推理的模型，当推理关闭时发送 `reasoning.effort: "none"`。
-  修复了 OpenRouter 上的 Inception Mercury 2 工具调用，通过在 `thinkingLevelMap` 中将 `off` 标记为不支持，使 openai-completions 提供程序省略推理参数（而不是默认为 `{reasoning:{effort:"none"}}`，这会将 Mercury 2 置于即时模式，禁用工具调用）。
-  修复了 OpenAI Codex SSE 重试，使其在回退到指数回退之前尊重 `retry-after-ms` 和 `retry-after` 头部。
-  修复了 LiteLLM 包装的 OpenAI 兼容错误中的上下文溢出检测，使用 `exceeds the model's maximum context length of ... tokens` 用语（[#4563](https://github.com/earendil-works/pi/issues/4563)）。
-  修复 `streamSimple()` 默认行为，使其尊重模型输出令牌上限（超过32000令牌），而非限制提供商请求为32000令牌（[#4539](https://github.com/earendil-works/pi/issues/4539)）。

## [0.74.0] - 2026-05-07

## [0.73.1] - 2026-05-07

###  增加

-  增加 OAuth 登录流程元数据，以便客户端在登录时可呈现交互式提供商选择（[#4190](https://github.com/earendil-works/pi-mono/pull/4190) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交）。

###  修复

-  修复 OpenAI 响应推理文本流式传输，适用于 LM Studio 和其他兼容提供商（发出 `response.reasoning_text.delta` 事件）（[#4191](https://github.com/badlogic/pi-mono/pull/4191) 由 [@yaanfpv](https://github.com/yaanfpv) 提交）。

-  修复 OpenAI 兼容聊天完成流式传输时，当 WebSocket 设置失败时回退到 SSE，并将传输诊断附加到助手消息（[#4141](https://github.com/badlogic/pi-mono/issues/4141)）。

-  修复 OpenAI 兼容聊天完成流式传输，使其支持内容和工具调用增量在同一选择中交错。

-  修复 Kimi K2 P6 模型别名，使其规范化为 `kimi-for-coding`（[#4218](https://github.com/earendil-works/pi-mono/issues/4218)）。

-  修复 OpenAI Codex 响应请求，确保发送非空系统提示（[#4184](https://github.com/earendil-works/pi-mono/issues/4184)）。

## [0.73.0] - 2026-05-04

###  重大变更

-  将内置 `xiaomi` 提供商端点从 Token 计划 AMS（`https://token-plan-ams.xiaomimimo.com/anthropic`）切换到 API 计费（`https://api.xiaomimimo.com/anthropic`）。`XIAOMI_API_KEY` 现在指向 [platform.xiaomimimo.com](https://platform.xiaomimimo.com) 的 API 计费密钥。仍在使用 Token 计划的用户必须迁移到相应的 `xiaomi-token-plan-*` 提供商，并设置对应的环境变量（[#4112](https://github.com/badlogic/pi-mono/pull/4112) 由 [@Phoen1xCode](https://github.com/Phoen1xCode) 提交）。

###  增加

-  增加小米 MiMo Token 计划区域提供商及对应区域环境变量：`xiaomi-token-plan-cn`（`XIAOMI_TOKEN_PLAN_CN_API_KEY`）、`xiaomi-token-plan-ams`（`XIAOMI_TOKEN_PLAN_AMS_API_KEY`）和 `xiaomi-token-plan-sgp`（`XIAOMI_TOKEN_PLAN_SGP_API_KEY`）（[#4112](https://github.com/badlogic/pi-mono/pull/4112) 由 [@Phoen1xCode](https://github.com/Phoen1xCode) 提交）。

-  增加 `registerSessionResourceCleanup()` 和 `cleanupSessionResources()`，以便提供商可注册会话范围资源的清理钩子。

###  修复

-  修复生成的 OpenAI 兼容模型元数据，使其与 models.dev 和 OpenCode Go 保持一致（[#4110](https://github.com/badlogic/pi-mono/pull/4110) 由 [@jsynowiec](https://github.com/jsynowiec) 提交）。

-  修复 Bedrock Converse 思考努力映射，以保留 Claude Opus 4.7 的原生 `xhigh`。

-  修复 OpenAI Codex 响应 WebSocket 传输，在流式传输开始前设置失败时回退到 SSE，并将传输诊断附加到助手消息（[#4133](https://github.com/badlogic/pi-mono/issues/4133)）。

## [0.72.1] - 2026-05-02

## [0.72.0] - 2026-05-01

###  重大变更

-  将 `OpenAICompletionsCompat.reasoningEffortMap` 替换为顶层 `Model.thinkingLevelMap`，用于模型特定的思考控制（[#3208](https://github.com/badlogic/pi-mono/issues/3208)）。迁移：将 `model.compat.reasoningEffortMap` 的映射移动到 `model.thinkingLevelMap`。详见 `packages/ai/README.md#custom-models` 和 `packages/coding-agent/docs/models.md#thinking-level-map`。映射值保持与提供商特定字符串语义一致，`null` 标记不支持 pi 思考级别。示例：
  ```ts
  // Before
  compat: { reasoningEffortMap: { high: "high", xhigh: "max" } }

  // After
  thinkingLevelMap: { minimal: null, low: null, medium: null, high: "high", xhigh: "max" }
  ```
 - 已移除 `supportsXhigh()`。迁移：改用 `getSupportedThinkingLevels(model).includes("xhigh")` 或 `clampThinkingLevel(model, requestedLevel)`（[#3208](https://github.com/badlogic/pi-mono/issues/3208)）。

###  增加

-  增加小米 MiMo Token 计划提供商（兼容 Anthropic），支持 `XIAOMI_API_KEY` 认证（[#4005](https://github.com/badlogic/pi-mono/pull/4005) 由 [@Phoen1xCode](https://github.com/Phoen1xCode) 提交）。

-  增加 `Model.thinkingLevelMap`、`getSupportedThinkingLevels()` 和 `clampThinkingLevel()`，以便模型元数据可描述支持的思考级别及提供商特定级别值（[#3208](https://github.com/badlogic/pi-mono/issues/3208)）。

###  修复

-  修复 OpenAI Codex 响应 `streamSimple()`，使其尊重已配置的传输方式，而非始终使用 SSE，并将 `auto` 设为默认传输方式，缓存 WebSocket 上下文（[#4083](https://github.com/badlogic/pi-mono/issues/4083)）。

-  修复小米 MiMo 模型目录，使其使用 Token 计划 Anthropic 端点而非直接 API（[#3912](https://github.com/badlogic/pi-mono/issues/3912)）。

## [0.71.1] - 2026-05-01

###  增加

-  增加 `websocket-cached` 传输支持，用于 OpenAI Codex 响应与 ChatGPT 订阅认证。此功能保持会话内 WebSocket 长连接，首次请求后仅发送新对话内容，而非重发完整聊天历史（如可能）。

## [0.71.0] - 2026-04-30

###  重大变更
- 已移除内置的Google Gemini CLI和Google反重力支持，包括提供商注册、模型元数据、OAuth和包导出。现有调用者必须切换到另一个支持的提供商。

### 已添加

- 已添加Cloudflare AI网关作为内置提供商，支持OpenAI、Anthropic和Workers AI网关路由，以及`CLOUDFLARE_API_KEY`/`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_GATEWAY_ID`认证（[#3856](https://github.com/badlogic/pi-mono/pull/3856)由[@mchenco](https://github.com/mchenco)提交）。
- 已添加Moonshot AI作为内置的OpenAI兼容提供商，支持模型目录生成和`MOONSHOT_API_KEY`认证。
- 已添加Mistral Medium 3.5模型元数据和推理模式处理（[#4009](https://github.com/badlogic/pi-mono/pull/4009)由[@technocidal](https://github.com/technocidal)提交）。
- 已添加`AssistantMessage.responseModel`，位于openai-completions路径：当实际返回的模型ID与请求的ID不一致时（例如OpenRouter `auto` -> `anthropic/...`），会返回具体的`chunk.model`（[#3968](https://github.com/badlogic/pi-mono/pull/3968)由[@purrgrammer](https://github.com/purrgrammer)提交）。

### 已修复

- 已修复Google Vertex Gemini 3工具调用回放问题，不再发送非Vertex `skip_thought_signature_validator`哨兵用于未签名工具调用（[#4032](https://github.com/badlogic/pi-mono/issues/4032)）。
- 已将`@anthropic-ai/sdk`更新为`^0.91.1`，以清除GHSA-p7fg-763f-g4gf审计发现（[#3992](https://github.com/badlogic/pi-mono/issues/3992)）。
- 已修复DeepSeek V4 Flash的`xhigh`推理支持，使请求能够保留`xhigh`，并映射到DeepSeek的`max`推理努力（[#3944](https://github.com/badlogic/pi-mono/issues/3944)）。
- 已修复Anthropic流式处理在`message_stop`之前结束的情况，将其视为错误而非成功的部分响应（[#3936](https://github.com/badlogic/pi-mono/issues/3936)）。
- 已修复生成的OpenAI兼容DeepSeek V4模型，使其在非直接DeepSeek提供商下也能携带特定提供商的推理努力映射（[#3940](https://github.com/badlogic/pi-mono/issues/3940)）。
- 已修复DeepSeek V4 Flash和V4 Pro的价格元数据，使其与当前官方费率一致（[#3910](https://github.com/badlogic/pi-mono/issues/3910)）。
- 修复了DeepSeek提示缓存命中情况的追踪，从`prompt_cache_hit_tokens`开始在OpenAI兼容的使用响应中进行追踪（[#3880](https://github.com/badlogic/pi-mono/issues/3880)）。

### 移除了

- 移除了内置的Google Gemini CLI以及Google Antigravity提供商、模型、OAuth和导出支持。

## [0.70.6] - 2026-04-28

### 添加了

- 添加了Cloudflare Workers AI作为内置提供商，支持模型目录生成、`CLOUDFLARE_API_KEY`/`CLOUDFLARE_ACCOUNT_ID`认证以及OpenAI兼容的流式传输支持（[#3851](https://github.com/badlogic/pi-mono/pull/3851) by [@mchenco](https://github.com/mchenco)）。

### 修复了

- 移除了生成的Cloudflare Workers AI `User-Agent`模型头部，以便调用者可以控制归属权。

- 修复了Bedrock推理配置文件能力检查，通过将配置文件ARN规范化为底层模型名称来实现。

## [0.70.5] - 2026-04-27

## [0.70.4] - 2026-04-27

## [0.70.3] - 2026-04-27

### 添加了

- 添加了对Azure OpenAI Responses基础URL的Azure认知服务端点支持（[#3799](https://github.com/badlogic/pi-mono/pull/3799) by [@marcbloech](https://github.com/marcbloech)）。

### 更改了

- 将OpenAI Codex响应的默认文本详尽度更改为`low`，当未指定详尽度时。

### 修复了

- 修复了API密钥环境发现，当Bun的沙箱使`process.env`为空时，会回退到`/proc/self/environ`（[#3801](https://github.com/badlogic/pi-mono/pull/3801) by [@mdsjip](https://github.com/mdsjip)）。

- 修复了Bedrock提示缓存和自适应思维能力检查，当模型ID是推理配置文件ARN时，使用模型名称（[#3527](https://github.com/badlogic/pi-mono/pull/3527) by [@anirudhmarc](https://github.com/anirudhmarc)）。

- 修复了Anthropic SSE解析，忽略未知代理事件，例如OpenAI风格的`done`终止符（[#3708](https://github.com/badlogic/pi-mono/issues/3708)）。

- 修复了OpenAI兼容的提示缓存测试，以覆盖明确禁用长时间缓存保留的代理。
- 停止在无工具活动时（例如 `pi --no-tools`）向 OpenAI 兼容、Anthropic、OpenAI Responses、OpenAI Codex Responses 和 Azure OpenAI Responses 请求发送 `tools: []`。DashScope/Aliyun Qwen（OpenAI 兼容）会因 `"[] is too short - 'tools'"`（HTTP 400）拒绝空工具数组；该字段现在仅在对话存在工具历史时才保留（现有 LiteLLM/Anthropic-proxy 临时解决方案）（[#3650](https://github.com/badlogic/pi-mono/pull/3650) by [@HQidea](https://github.com/HQidea)）。

- 修复 `supportsXhigh()` 以识别 DeepSeek V4 Pro，并保持 `xhigh` 推理请求，使其映射到 DeepSeek 的 `max` 努力（[#3662](https://github.com/badlogic/pi-mono/issues/3662)）。

- 修复 OpenAI 兼容 DeepSeek V4 模型回放，使其在需要时包含空 `reasoning_content` 副助手消息，防止 OpenRouter DeepSeek V4 会话在无推理增量响应后失败（[#3668](https://github.com/badlogic/pi-mono/issues/3668)）。

## [0.70.2] - 2026-04-24

### 修复

- 修复 OpenAI/Azure/Anthropic 提供商请求选项转发，以省略未定义的 `timeout`/`maxRetries`，避免 SDK 验证错误 `timeout must be an integer`（当未设置提供商控制时）（[#3627](https://github.com/badlogic/pi-mono/issues/3627)）。

## [0.70.1] - 2026-04-24

### 添加

- 添加 DeepSeek 作为内置 OpenAI 兼容提供商，支持 V4 Flash 和 V4 Pro 模型及 `DEEPSEEK_API_KEY` 认证。

### 修复

- 修复 DeepSeek V4 会话回放 400 错误，通过添加 `thinkingFormat: "deepseek"`（发送 `thinking: { type }` + `reasoning_effort`）、`reasoningEffortMap` 和 `requiresReasoningContentOnAssistantMessages` 兼容性，注入空 `reasoning_content` 到所有回放助手消息（当推理启用时）（[#3636](https://github.com/badlogic/pi-mono/issues/3636)）。

- 修复 GPT-5.5 生成的上下文窗口元数据，使其使用观察到的 272k 限制。

- 修复提供商请求控制，使 `timeoutMs` 和 `maxRetries` 在流选项中可见，并通过 OpenAI/Azure/Anthropic 请求选项转发，防止未配置 SDK 超时/重试默认值在长时间本地推理请求中出现（[#3627](https://github.com/badlogic/pi-mono/issues/3627)）。

## [0.70.0] - 2026-04-23

### 添加

- 添加 GPT-5.5 到 OpenAI Codex 模型生成。

- 添加 `findEnvKeys()`，使调用者可识别已配置的提供商 API-key 环境变量，而不暴露凭证值，同时保留 `getEnvApiKey()` 作为凭证值 API。

### 修复

- 修复 `google-vertex`，使其转发自定义 `model.baseUrl` 值到 `@google/genai`，启用 Vertex 代理和网关端点（[#3619](https://github.com/badlogic/pi-mono/issues/3619)）。

- 修复 OpenAI 兼容完成使用解析，停止对 `completion_tokens` 中已包含的推理令牌重复计数（[#3581](https://github.com/badlogic/pi-mono/issues/3581)）。

- 修复长缓存保留兼容性，添加 `compat.supportsLongCacheRetention`，允许 Anthropic Messages 和 OpenAI 兼容代理显式禁用长保留字段，同时在请求时默认启用长保留（[#3543](https://github.com/badlogic/pi-mono/issues/3543)）。

- 修复 `openai-responses` 兼容性，添加 `compat.sendSessionIdHeader: false`，允许严格的 OpenAI 兼容代理省略包含下划线的 `session_id` 头部，但仍发送其他会话亲和力头部（[#3579](https://github.com/badlogic/pi-mono/issues/3579)）。

- 修复 `anthropic-messages` 工具流兼容性，添加 `compat.supportsEagerToolInputStreaming`，允许 Anthropic 兼容提供商省略每个工具的 `eager_input_streaming`，改用旧版细粒度工具流 Beta 头部（[#3575](https://github.com/badlogic/pi-mono/issues/3575)）。

- 修复 `supportsXhigh()` 以识别 `openai-codex` `gpt-5.5`，并保持 `xhigh` 推理请求，而非将其限制为 `high`。

- 修复 `openai-completions` 流式工具调用组装，通过稳定工具索引合并增量，防止 OpenAI 兼容网关在流中修改工具调用 ID 时产生畸形 Kimi K2.6/OpenCode 工具流（[#3576](https://github.com/badlogic/pi-mono/issues/3576)）。

- 修复 `packages/ai` 端到端覆盖，使用当前支持的 OpenAI Responses 和 OpenAI Codex 模型，并更新 Bedrock 适应性思维负载期望以匹配当前 `display: "summarized"` 形状。
- 修复内置`kimi-coding`模型生成，将`User-Agent: KimiCLI/1.5`附加到所有生成的Kimi模型，覆盖Anthropic SDK默认UA，使直接Kimi Coding请求使用提供方预期的客户端身份（[#3586](https://github.com/badlogic/pi-mono/issues/3586)）

- 修复GPT-5.5 Codex能力处理，将不支持的最小推理限制为`low`，并应用该模型的2.5倍优先级服务层价格倍数（[#3618](https://github.com/badlogic/pi-mono/pull/3618) 由[@markusylisiurunen](https://github.com/markusylisiurunen) 提交）

## [0.69.0] - 2026-04-22

### 不兼容变更
- 将TypeBox支持从`@sinclair/typebox` 0.34.x及AJV迁移到`typebox` 1.x以及TypeBox内置的验证器和值转换API。工具参数验证现在可在如Cloudflare Workers等限制性JavaScript运行时环境中运行，这些环境不允许`eval`和`new Function`。 迁移：安装并从 `typebox` 导入，而不是 `@sinclair/typebox`，并重新测试任何对工具路径敏感的类型转换，这些路径将模式序列化为纯 JSON，因为它们现在通过基于 TypeBox 的验证和转换路径，而不是 AJV（[#3112](https://github.com/badlogic/pi-mono/issues/3112)）
### 已修复

- 已修复 `google-gemini-cli` 内置模型发现功能，使其包含 `gemini-3.1-flash-lite-preview`，因此 Cloud Code Assist 模型列表无需手动 `--model` 备选选择即可暴露该模型（[#3545](https://github.com/badlogic/pi-mono/issues/3545)）
- 修复`transformMessages()`，以合成直接低级历史回放中以未解决的助手工具调用结束的转录的缺失尾部工具结果（[#3555](https://github.com/badlogic/pi-mono/issues/3555)）
## [0.68.1] - 2026-04-22

### 添加
- 通过Fireworks的Anthropic兼容消息API增加了烟花提供商支持，包括内置的来自models.dev和`FIREWORKS_API_KEY`授权的模型（[#3519](https://github.com/badlogic/pi-mono/issues/3519)）
### 修复

- 通过拥有安全的SSE解析和防御性JSON修复，对损坏的工具调用JSON进行Anthropic流处理，将已弃用的`fine-grained-tool-streaming` beta头部替换为每个工具的`eager_input_streaming`，并更新过时的测试模型引用（[#3175](https://github.com/badlogic/pi-mono/issues/3175)）
- 修复了Bedrock运行时端点解析，停止强制绑定内置区域端点（覆盖`AWS_REGION` / `AWS_PROFILE`），并在v0.68.0之后恢复`us.*`和`eu.*`推理配置文件支持，同时保留自定义VPC/代理端点覆盖（[#3481](https://github.com/badlogic/pi-mono/issues/3481)，[#3485](https://github.com/badlogic/pi-mono/issues/3485)，[#3486](https://github.com/badlogic/pi-mono/issues/3486)，[#3487](https://github.com/badlogic/pi-mono/issues/3487)，[#3488](https://github.com/badlogic/pi-mono/issues/3488)）
## [0.68.0] - 2026-04-20

### 已添加
- 已添加`PI_OAUTH_CALLBACK_HOST`对内置Anthropic、Gemini的支持 CLI、Google反重力和OpenAI Codex OAuth流程，允许本地 回调服务器绑定到自定义接口，而不是硬编码的`127.0.0.1`（[#3409](https://github.com/badlogic/pi-mono/pull/3409) by [@Michaelliv](https://github.com/Michaelliv)）
### 变更

- 变更要求在模型令牌限制未知时省略`inferenceConfig.maxTokens`，在未设置时省略`temperature`，允许Bedrock使用模型默认值并避免不必要的TPM配额预留（[#3400](https://github.com/badlogic/pi-mono/pull/3400) 由 [@wirjo](https://github.com/wirjo) 提交）

### 修复
- 修复了`openai-completions` `compat.requiresThinkingAsText`助手回放功能，以保持文本部分序列化，并避免在先前助手消息同时包含思考和文本时发生同一模型崩溃（[#3387](https://github.com/badlogic/pi-mono/issues/3387)）
- 修复了云代码助手工具模式，剥离JSON模式元声明键（如`$schema`、`$defs`和`definitions`），在发送OpenAPI `parameters`之前，避免工具启用请求的提供者验证失败（[#3412](https://github.com/badlogic/pi-mono/pull/3412) 由[@vladlearns](https://github.com/vladlearns)提交）
- 修复了非视觉模型请求，将用户和工具结果的图像块替换为明确的文本占位符，而不是在提供者负载转换时静默丢弃它们（[#3429](https://github.com/badlogic/pi-mono/issues/3429)）
- 修复了直接OpenAI聊天补全请求，将`sessionId`和`cacheRetention`映射到OpenAI提示缓存字段，启用缓存时发送`prompt_cache_key`，并在直接`api.openai.com`请求且保留时间较长时发送`prompt_cache_retention: "24h"`（[#3426](https://github.com/badlogic/pi-mono/issues/3426)）
- 修复了OpenAI兼容的Chat Completions请求，可选地通过`compat.sendSessionAffinityHeaders`从`sessionId`发送对齐的`session_id`、`x-client-request-id`和`x-session-affinity`会话亲和力头部，从而为Fireworks等后端启用缓存亲和路由（[#3430](https://github.com/badlogic/pi-mono/issues/3430)）  
- 修复了直接Bedrock运行时客户端构建，将`model.baseUrl`作为SDK的`endpoint`传递，恢复对自定义Bedrock端点（如VPC或代理路由）的支持（[#3402](https://github.com/badlogic/pi-mono/pull/3402) by [@wirjo](https://github.com/wirjo)）  
- 修复了OpenAI兼容的Chat CompletionsAnthropic风格的提示缓存，将`cache_control`标记应用于系统提示、最后一个工具定义和最后一个用户/助手文本内容（通过`compat.cacheControlFormat`），并为OpenCode/OpenCode Go Qwen 3.5/3.6 Plus模型启用兼容性，使提示缓存在此类模型上也能正常工作（[#3392](https://github.com/badlogic/pi-mono/issues/3392)）  

## [0.67.68] - 2026-04-17

### 修复  

- 修复了Bedrock承载令牌认证，使用SDK原生令牌认证路径，并省略针对GovCloud目标的`thinking.display`，避免重复`Authorization`头部和GovCloud Converse验证错误（[#3359](https://github.com/badlogic/pi-mono/issues/3359)）  
- 修复了直接Mistral工具定义，在传递给SDK之前剥离TypeBox符号元数据，恢复SDK更严格的出站验证后的工具调用（[#3361](https://github.com/badlogic/pi-mono/issues/3361)）  

## [0.67.67] - 2026-04-17

### 新增  

- 新增了通过`AWS_BEARER_TOKEN_BEDROCK`的Bedrock Converse承载令牌认证，实现API密钥风格访问而无需SigV4凭证（[#3125](https://github.com/badlogic/pi-mono/pull/3125) by [@wirjo](https://github.com/wirjo)）  

### 修复  

- 修复了Anthropic和Bedrock的自适应思考负载测试，使其在启用推理时默认期望`display: "summarized"`字段  
- 修复了Mistral Small 4推理请求，使用`reasoning_effort`而非`prompt_mode`，恢复`mistral-small-2603`和`mistral-small-latest`的默认思考支持（[#3338](https://github.com/badlogic/pi-mono/issues/3338)）  
- 修复了`qwen-chat-template`的OpenAI兼容请求，设置`chat_template_kwargs.preserve_thinking: true`，保持先前Qwen思考在多轮间传递，确保多轮工具调用保留参数而非降级为空`{}`负载（[#3325](https://github.com/badlogic/pi-mono/issues/3325)）  
- 修复了OpenAI Codex服务层级计费，当API响应中回显默认层级时，信任显式请求的层级，保持下游用量成本与调用者选择的层级一致（[#3307](https://github.com/badlogic/pi-mono/pull/3307) by [@markusylisiurunen](https://github.com/markusylisiurunen)）  

## [0.67.6] - 2026-04-16

### 新增  

- 新增了`onResponse`到`StreamOptions`，使调用者可在每次响应到达后、响应流被消费前检查提供程序HTTP状态和头部（[#3128](https://github.com/badlogic/pi-mono/issues/3128)）  
- 新增了`thinkingDisplay`（`"summarized" | "omitted"`）到`AnthropicOptions`和`BedrockOptions`，并将其连接到Anthropic/Bedrock的`thinking`配置。默认为`"summarized"`，以便Claude Opus 4.7和Mythos Preview继续返回思考文本；设置为`"omitted"`可跳过思考流以加快首次文本标记返回速度。  

### 修复  

- 修复了OpenAI响应提示缓存，针对非`api.openai.com`基础URL（如OpenAI兼容代理litellm、theclawbay）的OpenAI兼容代理，通过提供`sessionId`时无条件发送`session_id`和`x-client-request-id`缓存亲和力头部，匹配官方Codex CLI行为（[#3264](https://github.com/badlogic/pi-mono/pull/3264) by [@vegarsti](https://github.com/vegarsti)）  

## [0.67.5] - 2026-04-16

### 修复  

- 修复了Anthropic和Bedrock提供商的Opus 4.7自适应思考配置，通过识别Opus 4.7自适应思考支持并映射`xhigh`推理到提供商支持的努力值（[#3286](https://github.com/badlogic/pi-mono/pull/3286) by [@markusylisiurunen](https://github.com/markusylisiurunen)）  

## [0.67.4] - 2026-04-16

### 变更  

- 新增了`claude-opus-4-7`模型，支持Anthropic和OpenRouter  
- 变更了Anthropic提示缓存，对最后一个工具定义添加`cache_control`断点，使工具模式可独立于对话更新缓存，同时保持现有缓存保留行为（[#3260](https://github.com/badlogic/pi-mono/issues/3260)）
- 将Kimi编码模型生成更改为将models.dev数据中已弃用的`k2p5`标准化为`kimi-for-coding`，并删除了旧的静态回退模型列表（[#3242](https://github.com/badlogic/pi-mono/issues/3242)）

## [0.67.3] - 2026-04-15

### 修复

- 修复`google-vertex` API密钥解析，将`gcp-vertex-credentials`视为应用默认凭证标记而非字面API密钥，使基于标记的配置正确回退到ADC（[#3221](https://github.com/badlogic/pi-mono/pull/3221) 由[@deepkilo](https://github.com/deepkilo)提交）

## [0.67.2] - 2026-04-14

### 修复

- 修复直接OpenAI响应请求，在提供`sessionId`时发送对齐的`prompt_cache_key`、`session_id`和`x-client-request-id`值，提高仅追加会话的提示缓存亲和力（[#3018](https://github.com/badlogic/pi-mono/pull/3018) 由[@steipete](https://github.com/steipete)提交）

- 修复仅流式传输的`partialJson`临时缓冲区泄露到持久化OpenAI响应工具调用，可能导致恢复对话时后续负载损坏。

## [0.67.1] - 2026-04-13

## [0.67.0] - 2026-04-13

### 添加

- 添加对`OpenRouterRouting`字段的完整支持，包括回退、参数要求、数据收集、ZDR、忽略列表、量化、提供者排序、最高价格以及首选吞吐量和延迟约束（[#2904](https://github.com/badlogic/pi-mono/pull/2904) 由[@zmberber](https://github.com/zmberber)提交）

### 修复

- 将默认的反重力用户代理版本提升到`1.21.9`（[#2901](https://github.com/badlogic/pi-mono/pull/2901) 由[@aadishv](https://github.com/aadishv)提交）

- 修复Gemma 4模型的思考层级，使用`thinkingLevel`，并将Pi推理层级映射到模型支持的思考层级（[#2903](https://github.com/badlogic/pi-mono/pull/2903) 由[@aadishv](https://github.com/aadishv)提交）

- 修复Gemini 2.5 Flash Lite的最小思考预算，使用模型支持的512个令牌最小值而非常规Flash的128个令牌最小值，避免无效思考预算错误（[#2861](https://github.com/badlogic/pi-mono/pull/2861) 由[@JasonOA888](https://github.com/JasonOA888)提交）

- 修复OpenAI Codex响应请求，转发已配置的`serviceTier`值，恢复Codex会话的服务层级选择（[#2996](https://github.com/badlogic/pi-mono/pull/2996) 由[@markusylisiurunen](https://github.com/markusylisiurunen)提交）
## [0.66.1] - 2026-04-08

## [0.66.0] - 2026-04-08

### 已固定
- 修复了裸 `readline`导入，使其使用 `node:readline`前缀以实现Deno兼容性（[#2885](https://github.com/badlogic/pi-mono/issues/2885) 由 [@milosv-vtool](https://github.com/milosv-vtool) 提交）
## [0.65.2] - 2026-04-06

## [0.65.1] - 2026-04-05

### 已固定
- 将OpenAI兼容的流式补全使用情况固定化，以保留`prompt_tokens_details.cache_write_tokens`，并将OpenRouter `cached_tokens`标准化为仅限于先前请求缓存命中，防止在`usage`中缓存读写双重计数及成本计算（[#2802](https://github.com/badlogic/pi-mono/issues/2802)）
## [0.65.0] - 2026-04-03

### 已添加
- 为更新的Z.ai模型添加了工具流支持（[#2732](https://github.com/badlogic/pi-mono/pull/2732)由[@kaofelix](https://github.com/kaofelix)提交）
### 修复

- 修复Anthropic上下文溢出检测，以识别HTTP 413 `request_too_large`错误，使调用者能够触发压缩并重试，而不是在重复的大图片请求中卡住（[#2734](https://github.com/badlogic/pi-mono/issues/2734)）
- 修复OpenAI响应工具调用流，当函数调用参数仅在`response.function_call_arguments.done`到达时发出`toolcall_delta`，并且当`.done`提前扩展已流式传输的参数时，仅发出缺失的后缀（[#2745](https://github.com/badlogic/pi-mono/issues/2745)）
- 修复了固定岩层节流错误被误识别为上下文溢出的问题，导致不必要的压缩而不是重试（[#2699](https://github.com/badlogic/pi-mono/pull/2699) 由 [@xu0o0](https://github.com/xu0o0) 提交）

## [0.64.0] - 2026-03-29

### 添加

- 添加了可选的伪提供程序助手，用于确定性测试和脚本演示：`registerFauxProvider()`、`fauxAssistantMessage()`、`fauxText()`、`fauxThinking()` 和 `fauxToolCall()`。

## [0.63.2] - 2026-03-29

## [0.63.1] - 2026-03-27

### 添加

- 为 `google-vertex` 提供程序添加了 `gemini-3.1-pro-preview-customtools` 模型支持（[#2610](https://github.com/badlogic/pi-mono/pull/2610) 由 [@gordonhwc](https://github.com/gordonhwc) 提交）

### 修复

- 修复了上下文溢出检测，使其能够识别像 `prompt too long; exceeded max context length ...` 这样的 Ollama 错误响应，以便调用者可以触发压缩和重试，而不是显示原始溢出错误（[#2626](https://github.com/badlogic/pi-mono/issues/2626)）

## [0.63.0] - 2026-03-27

### 不兼容变更
- 已移除已弃用的直接 `minimax` 和 `minimax-cn` 模型ID，仅保留 `MiniMax-M2.7` 和 `MiniMax-M2.7-highspeed`。请将固定模型ID更新为上述任一支持的直接MiniMax模型，或使用仍暴露旧ID的其他供应商路由（[#2596](https://github.com/badlogic/pi-mono/pull/2596) 由 [@liyuan97](https://github.com/liyuan97) 提交）

### 修复

- 修复GitHub Copilot OpenAI响应请求，在未请求推理时完全省略`reasoning`字段，避免Copilot `gpt-5-mini`在内部摘要调用时因拒绝`reasoning: { effort: "none" }`而产生`400`错误（[#2567](https://github.com/badlogic/pi-mono/issues/2567)）

- 修复Google和Vertex的成本计算，改为从计费输入令牌中减去缓存提示令牌，避免`cachedContentTokenCount`重复计费（[#2588](https://github.com/badlogic/pi-mono/pull/2588) 由 [@sparkleMing](https://github.com/sparkleMing) 提交）

## [0.62.0] - 2026-03-23

### 新增

- 新增`requestMetadata`选项至`BedrockOptions`，用于AWS成本分配标签；键值对将转发至Bedrock Converse API `requestMetadata`字段，并出现在AWS Cost Explorer拆分成本分配数据中（[#2511](https://github.com/badlogic/pi-mono/pull/2511) 由 [@wjonaskr](https://github.com/wjonaskr) 提交）

- 导出`BedrockOptions`类型至包根入口点，与其他供应商选项类型保持一致。

### 修复

- 修复OpenAI响应回放，对外国工具调用项ID通过哈希外国`function_call.id`值生成受控`fc_<hash>`ID，而非保留后端特定的规范化形状，避免OpenAI Codex拒绝。

- 修复Anthropic推理禁用处理，当推理明确关闭时发送`thinking: { type: "disabled" }`给具备推理能力的模型，并为Anthropic供应商增加端到端覆盖（[#2022](https://github.com/badlogic/pi-mono/issues/2022)）

- 修复Google、Google Vertex、Gemini CLI、OpenAI响应、Azure OpenAI响应及OpenRouter支持的OpenAI兼容补全的显式推理禁用处理。Gemini 3模型在不支持完全禁用时将回退至最低支持的推理等级，OpenAI/OpenRouter推理模型将发送显式`none`努力而非依赖供应商默认值（[#2490](https://github.com/badlogic/pi-mono/issues/2490)）

- 修复OpenAI兼容补全流，忽略null片段而非崩溃（[#2466](https://github.com/badlogic/pi-mono/pull/2466) 由 [@Cheng-Zi-Qing](https://github.com/Cheng-Zi-Qing) 提交）

## [0.61.1] - 2026-03-20

### 更改

- 更改MiniMax模型元数据，为`minimax`和`minimax-cn`供应商补充缺失`MiniMax-M2.1-highspeed`条目，并将MiniMax Anthropic兼容上下文限制规范化至供应商支持的模型集（[#2445](https://github.com/badlogic/pi-mono/pull/2445) 由 [@1500256797](https://github.com/1500256797) 提交）

## [0.61.0] - 2026-03-20

### 新增

- 为`openai-codex`供应商新增`gpt-5.4-mini`模型支持，包含Codex定价元数据和单元覆盖（[#2334](https://github.com/badlogic/pi-mono/pull/2334) 由 [@justram](https://github.com/justram) 提交）

### 修复

- 修复`validateToolArguments()`，在AJV模式编译被阻塞的受限运行时（如Cloudflare Workers）中优雅回退，允许工具执行而不进行模式验证（[#2395](https://github.com/badlogic/pi-mono/issues/2395)）

- 修复`google-vertex`API密钥解析，忽略占位符认证标记如`<authenticated>`，回退至ADC而非发送字面API密钥（[#2335](https://github.com/badlogic/pi-mono/issues/2335)）

- 修复OpenRouter推理请求，使用供应商嵌套`reasoning.effort`负载而非OpenAI的`reasoning_effort`，恢复OpenRouter模型的推理等级支持（[#2298](https://github.com/badlogic/pi-mono/pull/2298) 由 [@PriNova](https://github.com/PriNova) 提交）

- 修复Bedrock提示缓存，允许在应用推理配置文件未暴露底层Claude模型名时通过`AWS_BEDROCK_FORCE_CACHE=1`强制缓存点（[#2346](https://github.com/badlogic/pi-mono/pull/2346) 由 [@haoqixu](https://github.com/haoqixu) 提交）

## [0.60.0] - 2026-03-18

### 修复

- 修复Gemini 3和Antigravity图像工具结果，保持为多模态工具响应而非路由至单独后续消息（[#2052](https://github.com/badlogic/pi-mono/issues/2052)）

- 修复Bedrock Claude 4.6模型元数据，使用正确的20万上下文窗口而非100万（[#2305](https://github.com/badlogic/pi-mono/issues/2305)）
- 修复了内置提供程序的懒加载注册，使得编译后的 Bun 可执行文件在首次使用时仍能加载提供程序，而无需急切地打包提供程序 SDK ([#2314](https://github.com/badlogic/pi-mono/issues/2314))
- 修复了内置 OAuth 回调流程，使其在 Anthropic、Gemini CLI、Antigravity 和 OpenAI Codex 之间共享对齐的回调处理，并修复了 OpenAI Codex 登录以在回调完成后立即解决 ([#2316](https://github.com/badlogic/pi-mono/issues/2316))
- 修复了 OpenAI 兼容的 z.ai `network_error` 响应，使其显示为错误，以便调用方可以重试而不是将其视为成功的助手消息 ([#2313](https://github.com/badlogic/pi-mono/issues/2313))
- 修复了 OpenAI 响应回放，以在发送回 Codex 和其他响应兼容的目标之前，对过大的恢复工具调用 ID 进行标准化 ([#2328](https://github.com/badlogic/pi-mono/issues/2328))

## [0.59.0] - 2026-03-17

### 新增

- 新增了 `client` 注入支持到 `AnthropicOptions`，允许调用方提供预构建的 Anthropic 兼容客户端，而不是内部构建一个。

### 变更

- 懒加载内置提供程序模块和根提供程序包装器，因此导入 `@mariozechner/pi-ai` 不再急切加载提供程序 SDK，显著降低了基础启动成本，而不会改变依赖安装的占用量 ([#2297](https://github.com/badlogic/pi-mono/issues/2297))

### 修复

- 新增了 `responseId` 在 `AssistantMessage` 上的提供程序特定支持，适用于暴露上游响应或消息标识符的提供程序，包括 Anthropic、OpenAI、Google、Gemini CLI 和 Mistral，并为支持的 OAuth 和 API 密钥提供程序新增了端到端覆盖 ([#2245](https://github.com/badlogic/pi-mono/issues/2245))
- 修复了 Claude 4.6 上下文窗口覆盖，在生成的模型元数据中，使构建时目录反映预期值 ([#2286](https://github.com/badlogic/pi-mono/issues/2286))

## [0.58.4] - 2026-03-16

## [0.58.3] - 2026-03-15

## [0.58.2] - 2026-03-15

### 修复

- 修复了 Anthropic OAuth 手动登录和令牌刷新，通过使用本地回叫 URI 处理粘贴的重定向/代码流程，并在刷新令牌请求中省略 `scope` ([#2169](https://github.com/badlogic/pi-mono/issues/2169))

## [0.58.1] - 2026-03-14

### 修复

- 修复了 OpenAI Codex WebSocket 协议，以包含必需的头部并在连接关闭时正确终止 SSE 流 ([#1961](https://github.com/badlogic/pi-mono/issues/1961))
- 修复了 Bedrock 提示缓存对非 Claude 模型启用，导致 API 错误 ([#2053](https://github.com/badlogic/pi-mono/issues/2053))
- 修复了 Qwen 模型，通过添加 `qwen-chat-template` 兼容模式，使用 Qwen 原生聊天模板格式 ([#2020](https://github.com/badlogic/pi-mono/issues/2020))
- 修复了 Bedrock 未签名思考回放，以处理空或格式不正确的思考块的边缘情况 ([#2063](https://github.com/badlogic/pi-mono/issues/2063))
- 修复了 Claude Opus 4.6 的高推理努力检测，改为按模型 ID 匹配，而不是要求显式能力标志 ([#2040](https://github.com/badlogic/pi-mono/issues/2040))
- 处理 `finish_reason: "end"` 来自 Ollama/LM Studio，将其映射为 `"stop"` 而不是抛出异常 ([#2142](https://github.com/badlogic/pi-mono/issues/2142))

## [0.58.0] - 2026-03-14

### 新增

- 新增了 `GOOGLE_CLOUD_API_KEY` 环境变量支持，作为 `google-vertex` 提供程序的替代方案（应用默认凭据）([#1976](https://github.com/badlogic/pi-mono/pull/1976) 由 [@gordonhwc](https://github.com/gordonhwc) 提交)

### 变更

- 将 Claude Opus 4.6、Sonnet 4.6 及相关 Bedrock 模型的上下文窗口从 20 万 token 提升到 100 万 token ([#2135](https://github.com/badlogic/pi-mono/pull/2135) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交)

### 修复

- 修复了 GitHub Copilot 设备码登录轮询，使其尊重 OAuth 慢速间隔，在首次令牌轮询前等待，并在 WSL/VM 环境中，当重复慢速导致超时发生时，提供更清晰的时钟漂移提示。
- 修复了 OpenAI 兼容提供程序的使用统计信息未被捕获，这些提供程序返回 `choice.usage` 而不是标准 `chunk.usage`（例如 Moonshot/Kimi）([#2017](https://github.com/badlogic/pi-mono/issues/2017))
- 修复了 OpenAI 响应 API 提供程序的 `function_call_output` 项目中未发送工具结果图像，导致图像数据在工具结果中被静默丢弃 ([#2104](https://github.com/badlogic/pi-mono/issues/2104))
-  修复了助手内容以结构化内容块而非纯文本的形式发送给`openai-completions`提供程序的问题，导致某些OpenAI兼容后端出现错误（[#2008](https://github.com/badlogic/pi-mono/pull/2008) 由 [@geraldoaax](https://github.com/geraldoaax) 提交）

-  修复了OpenAI响应`response.failed`处理器中的错误详情，使其包含状态码、错误码和消息，而非通用的失败信息（[#1956](https://github.com/badlogic/pi-mono/pull/1956) 由 [@drewburr](https://github.com/drewburr) 提交）

## [0.57.1] - 2026-03-07

###  修复了

-  修复了上下文溢出检测，使其能够识别通过OpenAI兼容的停止原因处理表面的z.ai `model_context_window_exceeded`错误（[#1937](https://github.com/badlogic/pi-mono/issues/1937)）

## [0.57.0] - 2026-03-07

###  增加了

-  增加了通过`beforeProviderRequest`的请求负载检查和替换钩子支持，允许调用者在发送之前检查或替换提供程序的负载。

## [0.56.3] - 2026-03-06

###  增加了

-  增加了`claude-sonnet-4-6`提供程序的`google-antigravity`模型（[#1859](https://github.com/badlogic/pi-mono/issues/1859)）。

-  将默认的Antigravity User-Agent版本提升到`1.18.4`（[#1859](https://github.com/badlogic/pi-mono/issues/1859)）。

###  修复了
- 修复了Antigravity Claude思维beta头部检测，改为使用提供者和模型能力，而非`-thinking`后缀，使模型如`claude-sonnet-4-6`能够正确接收头部信息（[#1859](https://github.com/badlogic/pi-mono/issues/1859)）。

- 修复了OpenAI响应推理回放的回归问题，即在后续轮次中丢失推理块（[#1878](https://github.com/badlogic/pi-mono/issues/1878)）。

## [0.56.2] - 2026-03-05

### 新增

- 新增了对`gpt-5.4`模型的支持，适用于`openai`、`openai-codex`、`azure-openai-responses`和`opencode`提供者，GPT-5.4被视作xhigh-capable，并在内置元数据中限制为272000的上下文窗口。

- 新增了`gpt-5.3-codex`作为`github-copilot`的备用模型，直到上游模型目录包含它为止（[#1853](https://github.com/badlogic/pi-mono/issues/1853)）。

### 修复

- 保持了OpenAI响应助手`phase`的元数据（`commentary`、`final_answer`）跨轮次，通过将`id`和`phase`编码到`textSignature`中实现会话持久性和回放，同时保持对旧版plain签名的向后兼容（[#1819](https://github.com/badlogic/pi-mono/issues/1819)）。
- 修复了OpenAI响应回放，以省略空的思考区块，避免在后续轮次中出现无效的无操作推理项。
- 将Mistral提供程序从OpenAI兼容的补全路径切换到Mistral的原生SDK和对话API，保留原生思考区块和Mistral特有的消息语义跨轮次传递（[#1716](https://github.com/badlogic/pi-mono/issues/1716)）。
- 修复了反重力端点的回退机制：403/404响应现在会级联到下一个端点而不是立即抛出异常，将`autopush-cloudcode-pa.sandbox`端点添加到回退列表中，并从反重力请求中移除了多余的指纹头部（`X-Goog-Api-Client`，`Client-Metadata`）（[#1830](https://github.com/badlogic/pi-mono/issues/1830)）。
- 修复了`@mariozechner/pi-ai/oauth`包导出，使其直接指向构建好的`dist`文件，避免通过未发布的包装目标导致的TypeScript解析失败（[#1856](https://github.com/badlogic/pi-mono/issues/1856)）。
- 修复了Gemini 3未签名工具调用回放：使用`skip_thought_signature_validator`哨兵代替将函数调用转换为文本，保持结构化工具调用上下文在多轮对话中的完整性（[#1829](https://github.com/badlogic/pi-mono/issues/1829)）。
## [0.56.1] - 2026-03-05

## [0.56.0] - 2026-03-04

### 重大变更

- 将节点OAuth运行时导出从顶级包入口移除。从`@mariozechner/pi-ai/oauth`而非`@mariozechner/pi-ai`导入OAuth登录/刷新函数（[#1814](https://github.com/badlogic/pi-mono/issues/1814)）

### 添加

- 添加`gemini-3.1-flash-lite-preview`回退模型条目，以支持`google`提供程序，确保其在上游模型目录包含之前仍可选中（[#1785](https://github.com/badlogic/pi-mono/issues/1785)，感谢[@n-WN](https://github.com/n-WN)）
- 增加了OpenCode Go提供程序支持，包含`opencode-go`模型目录条目和`OPENCODE_API_KEY`环境变量支持（[#1757](https://github.com/badlogic/pi-mono/issues/1757)）。

### 更改了

- 更新了反重力双子座3.1模型元数据和请求头，以匹配当前上游行为。

### 修复了
- 修复了在`google`和`google-vertex`提供者中对Gemini 3.1思考级别检测的固定，以便`gemini-3.1-*`模型使用基于Gemini 3级别的思考配置，而不是预算回退（[#1785](https://github.com/badlogic/pi-mono/issues/1785)，感谢[@n-WN](https://github.com/n-WN)）。
- 通过懒加载Bedrock提供者并从默认浏览器导入图中移除仅Node的副作用来修复浏览器捆绑失败（[#1814](https://github.com/badlogic/pi-mono/issues/1814)）。
- 通过用浏览器安全提供者加载路径中的模块动态导入替换`Function`基于的动态导入来修复`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`的失败（[#1814](https://github.com/badlogic/pi-mono/issues/1814)）。
- 修复了`AWS_PROFILE`的固定基岩区域分辨率，通过尊重选中配置文件中存在的`region`来实现（[#1800](https://github.com/badlogic/pi-mono/issues/1800)）。

- 修复了Groq Qwen3推理努力映射，通过将不支持的努力值转换为供应商支持的值（[#1745](https://github.com/badlogic/pi-mono/issues/1745)）。

## [0.55.4] - 2026-03-02

## [0.55.3] - 2026-02-27

## [0.55.2] - 2026-02-27

### 修复

- 在取消动态注册的提供商ID时恢复内置OAuth提供商，并为注册表重置流程添加了`resetOAuthProviders()`。
- 修复了Z.ai思维控制使用错误的参数名称（`thinking`而不是`enable_thinking`），导致思维始终处于开启状态并浪费代币/延迟（[#1674](https://github.com/badlogic/pi-mono/pull/1674)由[@okuyam2y](https://github.com/okuyam2y)提交）
- 修复了`redacted_thinking`块在Anthropic流式传输过程中被静默丢弃的问题。它们现在被记录为`ThinkingContent`，并与`redacted: true`一起捕获，返回到API，在多轮对话中处理，并在跨模型消息转换中处理（[#1665](https://github.com/badlogic/pi-mono/pull/1665)由[@tctev](https://github.com/tctev)提交）
- 修复了`interleaved-thinking-2025-05-14` beta头部在自适应思维模型（Opus 4.6，Sonnet 4.6）中被发送的问题，该头部已被废弃或冗余（[#1665](https://github.com/badlogic/pi-mono/pull/1665)由[@tctev](https://github.com/tctev)提交）
- 修复了温度与扩展思维一起发送的问题，这与自适应和预算型思维模式都不兼容（[#1665](https://github.com/badlogic/pi-mono/pull/1665)由[@tctev](https://github.com/tctev)提交）
- 修复了导致Anthropic设置token端点出现401错误的`(external, cli)`用户代理标志（[#1677](https://github.com/badlogic/pi-mono/pull/1677)由[@LazerLance777](https://github.com/LazerLance777)提交）
- 修复了当OpenAI兼容提供商返回没有`choices`数组的片段时崩溃的问题，通过添加可选链实现（[#1671](https://github.com/badlogic/pi-mono/issues/1671)

## [0.55.1] - 2026-02-26

### 添加了
- 添加了`gemini-3.1-pro-preview`模型支持到`google-gemini-cli`提供商（[#1599](https://github.com/badlogic/pi-mono/pull/1599)由[@audichuang](https://github.com/audichuang)提交）

### 修复了
- 修复了Anthropic和Bedrock提供商中Claude Sonnet 4.6的自适应思考，并将不支持的`xhigh`努力值限制到支持的级别（[#1548](https://github.com/badlogic/pi-mono/pull/1548)由[@tctev](https://github.com/tctev)提交）

- 修复了Vertex ADC凭证检测竞态条件，通过避免在异步导入初始化时缓存假负值实现（[#1550](https://github.com/badlogic/pi-mono/pull/1550)由[@jeremiahgaylord-web](https://github.com/jeremiahgaylord-web)提交）

## [0.55.0] - 2026-02-24

## [0.54.2] - 2026-02-23

## [0.54.1] - 2026-02-22

## [0.54.0] - 2026-02-19

## [0.53.1] - 2026-02-19

## [0.53.0] - 2026-02-17

### 添加了
- 添加了Anthropic `claude-sonnet-4-6`备用模型条目到生成的模型定义中。

## [0.52.12] - 2026-02-13

### 添加了
- 添加了`transport`到`StreamOptions`，支持值`"sse"`、`"websocket"`和`"auto"`（目前由`openai-codex-responses`支持）

- 为OpenAI Codex响应添加了WebSocket传输支持（`openai-codex-responses`）

### 更改了
- OpenAI Codex响应现在默认使用SSE传输，除非显式设置`transport`

- OpenAI Codex响应的WebSocket连接按`sessionId`缓存，且在5分钟内无活动后过期。

## [0.52.11] - 2026-02-13

### 添加了
- 为`minimax`、`minimax-cn`、`openrouter`和`vercel-ai-gateway`提供商添加了MiniMax M2.5模型条目，同时为`opencode`添加了`minimax-m2.5-free`。

## [0.52.10] - 2026-02-12

### 添加了
- 增加了可选的`metadata`字段到`StreamOptions`，用于传递提供方特定的元数据（例如，用于滥用追踪/速率限制的Anthropic `user_id`）([#1384](https://github.com/badlogic/pi-mono/pull/1384) by [@7Sageer](https://github.com/7Sageer))
- 增加了针对OpenAI和OpenAI Codex提供方的`gpt-5.3-codex-spark`模型定义（128k上下文，纯文本，研究预览版）。目前尚不可用，可能在接下来的几小时或几天内可用。

### 更改

- Routed GitHub Copilot Claude 4.x模型通过Anthropic Messages API，集中处理Copilot动态头部，并增加了Copilot Claude Anthropic流的覆盖范围([#1353](https://github.com/badlogic/pi-mono/pull/1353) by [@NateSmyth](https://github.com/NateSmyth))

### 修复

- 修复OpenAI补全和响应流，使其能够容忍格式不正确的尾部工具调用JSON而不会导致解析失败([#1424](https://github.com/badlogic/pi-mono/issues/1424))

## [0.52.9] - 2026-02-08

### 更改

- 更新了Antigravity系统指令，使其变为更紧凑的版本，以兼容Google Gemini CLI

### 修复

- 使用`parametersJsonSchema`为Google提供方工具声明支持完整的JSON Schema（anyOf, oneOf, const, 等）([#1398](https://github.com/badlogic/pi-mono/issues/1398) by [@jarib](https://github.com/jarib))
- 回滚了错误的Antigravity模型更改：将`claude-opus-4-6-thinking`改回`claude-opus-4-5-thinking`（模型在Antigravity端点不存在）
- 修正了Claude Sonnet 4和4.5的opencode上下文窗口([#1383](https://github.com/badlogic/pi-mono/issues/1383))

## [0.52.8] - 2026-02-07

### 增加

- 增加了OpenRouter `auto`模型别名以实现自动模型路由([#1361](https://github.com/badlogic/pi-mono/pull/1361) by [@yogasanas](https://github.com/yogasanas))

### 更改

- 将Claude Opus 4.5替换为Opus 4.6在模型定义中([#1345](https://github.com/badlogic/pi-mono/pull/1345) by [@calvin-hpnet](https://github.com/calvin-hpnet))

## [0.52.7] - 2026-02-06

### 增加

- 增加了`AWS_BEDROCK_SKIP_AUTH`和`AWS_BEDROCK_FORCE_HTTP1`环境变量，用于连接未认证的Bedrock代理([#1320](https://github.com/badlogic/pi-mono/pull/1320) by [@virtuald](https://github.com/virtuald))

### 修复

- 将OpenAI Responses API请求默认设置为`store: false`，以避免服务器端历史记录日志([#1308](https://github.com/badlogic/pi-mono/issues/1308))
- 重新导出了TypeBox `Type`、`Static`和`TSchema`，从`@mariozechner/pi-ai`中导出，以匹配文档并避免在pnpm设置中TypeBox类型身份重复问题([#1338](https://github.com/badlogic/pi-mono/issues/1338))
- 修复了Bedrock adaptive thinking处理，针对Claude Opus 4.6的interleaved thinking beta响应([#1323](https://github.com/badlogic/pi-mono/pull/1323) by [@markusylisiurunen](https://github.com/markusylisiurunen))
- 修复了`AWS_BEDROCK_SKIP_AUTH`环境检测，以避免在非Node.js环境中访问`process`

## [0.52.6] - 2026-02-05

## [0.52.5] - 2026-02-05

### 修复

- 修复了`supportsXhigh()`，将Anthropic Messages Opus 4.6模型视为xhigh-capable，以便`streamSimple`可以将`xhigh`映射到adaptive effort `max`

## [0.52.4] - 2026-02-05

## [0.52.3] - 2026-02-05

### 修复

- 修复了Bedrock Opus 4.6模型ID（移除了`:0`后缀）和`us.*`与`eu.*`变体的缓存定价
- 增加了模型目录中缺失的`eu.anthropic.claude-opus-4-6-v1`推理配置文件
- 修正了Claude Opus 4.6的上下文窗口元数据，将其设置为200000，适用于Anthropic和OpenCode提供方

## [0.52.2] - 2026-02-05

## [0.52.1] - 2026-02-05

### 增加

- 为Claude Opus 4.6增加了适应性思维支持，支持努力等级（`low`, `medium`, `high`, `max`）
- 增加了`effort`选项到`AnthropicOptions`，用于控制适应性思维深度
- `thinkingEnabled`现在会自动为Opus 4.6+模型使用适应性思维，为旧模型使用基于预算的思维
- `streamSimple`/`completeSimple`会自动将`ThinkingLevel`映射为Opus 4.6的努力等级

### 更改

- 更新`@anthropic-ai/sdk`到0.73.0
- 更新`@aws-sdk/client-bedrock-runtime`到3.983.0
- 更新`@google/genai`到1.40.0
- 移除了`fast-xml-parser`覆盖（不再需要）

## [0.52.0] - 2026-02-05

### 增加

- 将Claude Opus 4.6模型添加到生成的模型目录
- 添加了GPT-5.3 Codex模型到生成模型目录（仅限OpenAI Codex提供商）

## [0.51.6] - 2026-02-04

### 修复

- 修复OpenAI Codex响应提供商以尊重已配置的baseUrl（[#1244](https://github.com/badlogic/pi-mono/issues/1244)）

## [0.51.5] - 2026-02-04

### 更改

- 更改Bedrock模型生成以丢弃现在由上游处理的遗留变通方法（[#1239](https://github.com/badlogic/pi-mono/pull/1239)由[@unexge](https://github.com/unexge)提交）

## [0.51.4] - 2026-02-03

## [0.51.3] - 2026-02-03

### 修复

- 修复xhigh思考级别支持检查以接受gpt-5.2模型ID（[#1209](https://github.com/badlogic/pi-mono/issues/1209)）

## [0.51.2] - 2026-02-03

## [0.51.1] - 2026-02-02

### 修复

- 修复`cache_control`未应用于Anthropic提供商的字符串格式用户消息

## [0.51.0] - 2026-02-01

### 修复

- 修复`cacheRetention`选项未通过`buildBaseOptions`传递（[#1154](https://github.com/badlogic/pi-mono/issues/1154)）

- 修复OAuth登录/刷新未使用HTTP代理设置（`HTTP_PROXY`，`HTTPS_PROXY`环境变量）（[#1132](https://github.com/badlogic/pi-mono/issues/1132)）

- 修复OpenAI兼容的补全以省略不支持`strict`工具字段的提供商（[#1172](https://github.com/badlogic/pi-mono/issues/1172)）
## [0.50.9] - 2026-02-01

### 新增

- Added `PI_AI_ANTIGRAVITY_VERSION`环境变量，用于覆盖Google更新版本要求时的反重力User-Agent版本（[#1129](https://github.com/badlogic/pi-mono/issues/1129)）
- 添加了`cacheRetention`流选项，包含特定提供商的映射，用于提示缓存控制，默认采用短保留时间（[#1134](https://github.com/badlogic/pi-mono/issues/1134)）

## [0.50.8] - 2026-02-01
### 已添加

- 已添加 `maxRetryDelayMs` 选项到 `StreamOptions`，用于限制服务器请求的重试延迟。当提供方（例如 Google Gemini CLI）请求的延迟超过此值时，请求将立即失败并返回包含信息的错误，而不是静默等待。默认值：60000ms（60秒）。设置为 0 以禁用此限制。([#1123](https://github.com/badlogic/pi-mono/issues/1123))
- 通过`enable_thinking`增加了Qwen思维格式支持，用于OpenAI兼容的补全功能。 ([#940](https://github.com/badlogic/pi-mono/pull/940) by [@4h9fbZ](https://github.com/4h9fbZ))

## [0.50.7] - 2026-01-31

## [0.50.6] - 2026-01-30
## [0.50.5] - 2026-01-30

## [0.50.4] - 2026-01-30

### 新增

- Added Vercel AI Gateway routing support via `vercelGatewayRouting` option in model config ([#1051](https://github.com/badlogic/pi-mono/pull/1051) by [@ben-vargas](https://github.com/ben-vargas))
### 修复

- 将反重力用户代理从1.11.5更新到1.15.8以修复被拒绝的请求（[#1079](https://github.com/badlogic/pi-mono/issues/1079)）
- 固定工具调用参数默认值，用于Anthropic和Google历史转换，当提供者省略输入时（[#1065](https://github.com/badlogic/pi-mono/issues/1065)）

## [0.50.3] - 2026-01-29

### 添加

- 添加了Kimi For Coding提供者支持（Moonshot AI的Anthropic兼容编码API）
## [0.50.2] - 2026-01-29

### 新增

- Added Hugging Face provider support via OpenAI-compatible Inference Router ([#994](https://github.com/badlogic/pi-mono/issues/994))
- 增加了`PI_CACHE_RETENTION`环境变量，用于控制Anthropic（5分钟 vs 1小时）和OpenAI（内存 vs 24小时）的缓存TTL。设置为`long`以实现更长的保留时间。仅适用于直接API调用（api.anthropic.com，api.openai.com）。([#967](https://github.com/badlogic/pi-mono/issues/967))
### 已固定
- 修复了OpenAI补全`toolChoice`处理，以正确设置`type: "function"`包装器（[#998](https://github.com/badlogic/pi-mono/pull/998)由[@williamtwomey](https://github.com/williamtwomey)提交）
- 修复了跨供应商交接在从OpenAI响应API提供商（github-copilot、openai-codex）切换到其他提供商时失败的问题，原因是pipe分隔符的工具调用ID未标准化，以及截断ID末尾的下划线被OpenAI Codex拒绝（[#1022](https://github.com/badlogic/pi-mono/issues/1022)）
- 修复了429速率限制错误错误触发自动压缩，而不是重试加后退（[#1038](https://github.com/badlogic/pi-mono/issues/1038)）
- 修复了Anthropic提供商以处理`sensitive` stop_reason由API返回（[#978](https://github.com/badlogic/pi-mono/issues/978)）
- 修复了DeepSeek API兼容性，通过检测`deepseek.com` URL并禁用不支持的`developer`角色（[#1048](https://github.com/badlogic/pi-mono/issues/1048)）
- 修复了Anthropic提供商以在代理省略`message_delta`事件中的输入token计数时保留输入token计数（[#1045](https://github.com/badlogic/pi-mono/issues/1045)）

## [0.50.1] - 2026-01-26

### 修复了
- 修复了OpenCode Zen模型生成，排除已弃用的模型（[#970](https://github.com/badlogic/pi-mono/pull/970)由[@DanielTatarkin](https://github.com/DanielTatarkin)提交）

## [0.50.0] - 2026-01-26

### 新增

- 新增了通过`openRouterRouting`兼容字段支持自定义模型的OpenRouter提供商路由功能（[#859](https://github.com/badlogic/pi-mono/pull/859)由[@v01dpr1mr0s3](https://github.com/v01dpr1mr0s3)提交）
- 新增了`azure-openai-responses`提供商对Azure OpenAI Responses API的支持。（[#890](https://github.com/badlogic/pi-mono/pull/890)由[@markusylisiurunen](https://github.com/markusylisiurunen)提交）
- 新增了API请求的HTTP代理环境变量支持（[#942](https://github.com/badlogic/pi-mono/pull/942)由[@haoqixu](https://github.com/haoqixu)提交）
- 新增了`createAssistantMessageEventStream()`工厂函数，供扩展使用。
- 新增了`resetApiProviders()`，用于清除并重新注册内置API提供商。

### 更改

- 重构了API流式分发，使用API注册表和提供商拥有的`streamSimple`映射。
- 将环境API密钥解析移到`env-api-keys.ts`，并从包入口点重新导出。
- Azure OpenAI Responses提供商现在使用基础URL配置和部署感知的模型映射，不再包含服务层级处理。

### 修复

- 修复了Bun运行时在浏览器兼容模块（stream.ts，openai-codex-responses.ts，openai-codex.ts）中的动态导入检测（[#922](https://github.com/badlogic/pi-mono/pull/922)由[@dannote](https://github.com/dannote)提交）
- 修复了流式函数，改为使用`model.api`，而非硬编码的API类型
- 修复了Google提供商，在省略时将工具调用参数默认为空对象
- 修复了OpenAI Responses流式处理，以处理OpenAI兼容端点上的`arguments.done`事件（[#917](https://github.com/badlogic/pi-mono/pull/917)由[@williballenthin](https://github.com/williballenthin)提交）
- 修复了OpenAI Codex Responses工具严格性处理，修正了共享响应后的结果
- 修复了Azure OpenAI Responses流式处理，保护内容部分前的增量，并修正元数据和交接控制
- 修复了OpenAI补全工具结果图像批处理，在连续工具结果后（[#902](https://github.com/badlogic/pi-mono/pull/902)由[@terrorobe](https://github.com/terrorobe)提交）

## [0.49.3] - 2026-01-22

### 新增

- 新增了`headers`选项到`StreamOptions`，用于API请求的自定义HTTP头。除Amazon Bedrock（使用AWS SDK认证）外，所有提供商均支持。头信息将与提供商默认值和`model.headers`合并，`options.headers`优先。
- 新增了`originator`选项到`loginOpenAICodex()`，用于自定义OAuth客户端标识
- 增强了pi-ai的浏览器兼容性：用动态导入替换了顶级Node.js导入（[#873](https://github.com/badlogic/pi-mono/issues/873)）

### 修复

- 修复了OpenAI Responses API 400错误“function_call没有必需的reasoning项目”，当在不同模型间切换时（同一提供商，不同模型）。修复方案是省略不同模型的function_calls中的`id`字段，以避免触发OpenAI的reasoning/function_call配对验证（[#886](https://github.com/badlogic/pi-mono/issues/886)）

## [0.49.2] - 2026-01-19

### 新增

- 新增了AWS凭证检测，适用于ECS/Kubernetes环境：`AWS_CONTAINER_CREDENTIALS_RELATIVE_URI`，`AWS_CONTAINER_CREDENTIALS_FULL_URI`，`AWS_WEB_IDENTITY_TOKEN_FILE`（[#848](https://github.com/badlogic/pi-mono/issues/848)）

### 修复

- 修复了OpenAI Responses 400错误“reasoning没有跟随项目”，通过完全跳过transform-messages.ts中的出错/中止的助手消息来实现（[#838](https://github.com/badlogic/pi-mono/pull/838)）

### 移除

- 移除了`strictResponsesPairing`兼容选项（在transform-messages修复后已不再需要）

## [0.49.1] - 2026-01-18

### 新增

- 新增了`OpenAIResponsesCompat`接口和`strictResponsesPairing`选项，用于Azure OpenAI Responses API，该API要求在历史回放中严格匹配reasoning和消息配对（[#768](https://github.com/badlogic/pi-mono/pull/768)由[@prateekmedia](https://github.com/prateekmedia)提交）

### 更改

- 将`OpenAICompat`拆分为`OpenAICompletionsCompat`和`OpenAIResponsesCompat`，以实现类型安全的API特定兼容设置

### 修复

- 修复了跨提供商交接（例如Codex到Antigravity Claude）的工具调用ID规范化（[#821](https://github.com/badlogic/pi-mono/issues/821)）

## [0.49.0] - 2026-01-17

### 更改
- OpenAI Codex 的响应现在直接在指令字段中使用上下文系统提示。

### 修复

- 修复了因助手消息出错而导致的孤立工具结果问题，防止 Codex API 出现错误。当助手消息包含 `stopReason: "error"` 时，其工具调用现在将被排除在待处理工具跟踪之外，从而防止因提供方特定转换器丢弃而被调用的工具结果生成合成结果。([#812](https://github.com/badlogic/pi-mono/issues/812))

- 修复了 Bedrock Claude 的 max_tokens 处理，使其始终超出思考预算令牌，防止压缩失败。([#797](https://github.com/badlogic/pi-mono/pull/797) 由 [@pjtf93](https://github.com/pjtf93) 提交)

- 修复了 Claude Code 工具名称规范化，使其与 Claude Code 工具列表进行不区分大小写的匹配，并移除无效映射。

## [0.48.0] - 2026-01-16

### 修复

- 修复了 OpenAI 兼容提供商功能检测，使其除了 URL 之外还使用 `model.provider`，允许自定义基础 URL（例如代理）正确工作，并与提供方特定设置兼容。([#774](https://github.com/badlogic/pi-mono/issues/774))

- 修复了 Gemini 3 在切换提供方时上下文丢失的问题：未签名的工具调用现在会转换为带有防模仿注释的文本，而不是被跳过。

- 修复了工具参数中的字符串数字在验证时未被强制转换为数字的问题。([#786](https://github.com/badlogic/pi-mono/pull/786) 由 [@dannote](https://github.com/dannote) 提交)

- 修复了 Bedrock 工具调用 ID，使其仅使用字母数字字符，避免因无效字符导致的 API 错误。([#781](https://github.com/badlogic/pi-mono/pull/781) 由 [@pjtf93](https://github.com/pjtf93) 提交)

- 修复了空错误助手消息（来自 429/500 错误）破坏 tool_use 到 tool_result 链接的问题，通过在 `transformMessages` 中过滤这些消息。

## [0.47.0] - 2026-01-16

### 修复

- 修复了 OpenCode 提供方的 `/v1` 端点，使其使用 `system` 角色而不是 `developer` 角色，修复了使用 `openai-completions` API 的模型出现 `400 Incorrect role information` 错误的问题。([#755](https://github.com/badlogic/pi-mono/pull/755) 由 [@melihmucuk](https://github.com/melihmucuk) 提交)

- 为 OpenAI Codex 提供方添加了对瞬态错误（429、5xx、连接失败）的重试逻辑。使用指数回退，最多重试 3 次。([#733](https://github.com/badlogic/pi-mono/issues/733))

## [0.46.0] - 2026-01-15

### 添加

- 添加了 MiniMax China（`minimax-cn`）提供方支持。([#725](https://github.com/badlogic/pi-mono/pull/725) 由 [@tallshort](https://github.com/tallshort) 提交)

- 添加了 `gpt-5.2-codex` 模型，支持 GitHub Copilot 和 OpenCode Zen 提供方。([#734](https://github.com/badlogic/pi-mono/pull/734) 由 [@aadishv](https://github.com/aadishv) 提交)

### 修复

- 避免未签名的 Gemini 3 工具调用。([#741](https://github.com/badlogic/pi-mono/pull/741) 由 [@roshanasingh4](https://github.com/roshanasingh4) 提交)

- 修复了非 Anthropic 模型在 Amazon Bedrock 提供方中的签名支持。([#727](https://github.com/badlogic/pi-mono/pull/727) 由 [@unexge](https://github.com/unexge) 提交)

## [0.45.7] - 2026-01-13

### 修复

- 修复了 OpenAI 响应超时选项的处理。([#706](https://github.com/badlogic/pi-mono/pull/706) 由 [@markusylisiurunen](https://github.com/markusylisiurunen) 提交)

- 修复了 Bedrock 工具调用转换，使其应用消息转换。([#707](https://github.com/badlogic/pi-mono/pull/707) 由 [@pjtf93](https://github.com/pjtf93) 提交)

## [0.45.6] - 2026-01-13

### 修复

- 导出 `parseStreamingJson`，以兼容 tsx 开发模式。

## [0.45.5] - 2026-01-13

## [0.45.4] - 2026-01-13

### 添加

- 添加了 Vercel AI Gateway 提供方，支持模型发现和 `AI_GATEWAY_API_KEY` 环境变量。([#689](https://github.com/badlogic/pi-mono/pull/689) 由 [@timolins](https://github.com/timolins) 提交)

### 修复

- 修复了 z.ai 的思考/推理功能：z.ai 使用 `thinking: { type: "enabled" }` 而不是 OpenAI 的 `reasoning_effort`。添加 `thinkingFormat` 兼容标志以处理此问题。([#688](https://github.com/badlogic/pi-mono/issues/688))

## [0.45.3] - 2026-01-13

## [0.45.2] - 2026-01-13

## [0.45.1] - 2026-01-13

## [0.45.0] - 2026-01-13

### 添加

- 添加了 MiniMax 提供方支持，通过 Anthropic 兼容 API 提供 M2 和 M2.1 模型。([#656](https://github.com/badlogic/pi-mono/pull/656) 由 [@dannote](https://github.com/dannote) 提交)

- 添加了 Amazon Bedrock 提供方，支持 Claude 模型的提示缓存（实验性，仅与 Anthropic Claude 模型测试过）。([#494](https://github.com/badlogic/pi-mono/pull/494) 由 [@unexge](https://github.com/unexge) 提交)

- 为 OpenAI 响应请求添加了 `serviceTier` 选项。([#672](https://github.com/badlogic/pi-mono/pull/672) 由 [@markusylisiurunen](https://github.com/markusylisiurunen) 提交)
- **Anthropic缓存（OpenRouter）**：通过OpenRouter与Anthropic模型的交互现在会设置一个5分钟的缓存点，使用Anthropic风格的`cache_control`断点，基于最后的助手或用户消息。([#584](https://github.com/badlogic/pi-mono/pull/584) by [@nathyong](https://github.com/nathyong))
- **Google Gemini CLI提供程序改进**：增加了Antigravity端点的回退机制（每日沙箱尝试，`baseUrl`未设置时尝试生产环境），基于头部的重试延迟解析（`Retry-After`, `x-ratelimit-reset`, `x-ratelimit-reset-after`），从第一条用户消息稳定推导`sessionId`以实现缓存亲和力，对空SSE流进行重试并采用指数回退，以及`anthropic-beta`头部用于Claude思考模型。([#670](https://github.com/badlogic/pi-mono/pull/670) by [@kim0](https://github.com/kim0))

## [0.44.0] - 2026-01-12

## [0.43.0] - 2026-01-11

### 修复

- 修复Google提供程序的思考检测：`isThinkingPart()`现在仅检查`thought === true`，不再检查`thoughtSignature`。根据Google文档，`thoughtSignature`用于上下文回放，可能出现在任何部分类型中。同时移除了`id`字段（被Vertex AI和Cloud Code Assist拒绝），并在`functionCall`/`functionResponse`中添加了`textSignature`的往返流程，以支持多轮推理上下文。([#631](https://github.com/badlogic/pi-mono/pull/631) by [@theBucky](https://github.com/theBucky))

## [0.42.5] - 2026-01-11

## [0.42.4] - 2026-01-10

## [0.42.3] - 2026-01-10

### 更改

- OpenAI Codex：切换到内置系统提示匹配opencode，将发起者更改为"pi"，简化提示处理。

## [0.42.2] - 2026-01-10

### 添加

- 添加`GOOGLE_APPLICATION_CREDENTIALS`环境变量支持，用于Vertex AI凭证检测（CI/生产环境标准）。
- 添加`supportsUsageInStreaming`兼容性标志，用于拒绝`stream_options: { include_usage: true }`的OpenAI兼容提供程序。默认为`true`。在模型配置中设置为`false`，适用于gatewayz.ai等提供程序。([#596](https://github.com/badlogic/pi-mono/pull/596) by [@XesGaDeus](https://github.com/XesGaDeus))
- 改进Google模型定价信息([#588](https://github.com/badlogic/pi-mono/pull/588) by [@aadishv](https://github.com/aadishv))

### 修复

- 修复`os.homedir()`在模块加载时的调用；现在在需要时才延迟解析。
- 修复OpenAI响应工具的严格标志，使其兼容LM Studio，使用布尔类型。([#598](https://github.com/badlogic/pi-mono/pull/598) by [@gnattu](https://github.com/gnattu))
- 修复Google Cloud Code Assist OAuth：正确处理付费订阅的长运行操作（项目配置），支持`GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT_ID`环境变量，处理受VPC-SC影响的用户。([#582](https://github.com/badlogic/pi-mono/pull/582) by [@cmf](https://github.com/cmf))

## [0.42.1] - 2026-01-09

## [0.42.0] - 2026-01-09

### 添加

- 添加OpenCode Zen提供程序支持，包含26种模型（Claude、GPT、Gemini、Grok、Kimi、GLM、Qwen等）。设置`OPENCODE_API_KEY`环境变量以使用。

## [0.41.0] - 2026-01-09

## [0.40.1] - 2026-01-09

## [0.40.0] - 2026-01-08

## [0.39.1] - 2026-01-08

## [0.39.0] - 2026-01-08

### 修复

- 修复Gemini CLI的中止处理：在重试捕获块中检测原生`AbortError`，当中止信号触发时取消SSE读取器。([#568](https://github.com/badlogic/pi-mono/pull/568) by [@tmustier](https://github.com/tmustier))
- 修复Antigravity提供程序的429错误，使其与CLIProxyAPI v6.6.89对齐：注入Antigravity系统指令（`role: "user"`），设置`requestType: "agent"`，并使用`antigravity`用户代理。添加桥接提示，以覆盖Antigravity行为（身份、路径、Web开发指南），采用Pi默认设置。([#571](https://github.com/badlogic/pi-mono/pull/571) by [@ben-vargas](https://github.com/ben-vargas))
- 修复跨模型对话的思考块处理：当切换模型时，思考块现在会转换为纯文本（不再使用`<thinking>`标签）。之前，`<thinking>`标签会导致模型模仿该模式并输出字面量标签。同时修复了空思考块导致API错误的问题。([#561](https://github.com/badlogic/pi-mono/issues/561))

## [0.38.0] - 2026-01-08

### 添加

- 在`SimpleStreamOptions`中添加`thinkingBudgets`选项，用于在基于令牌的提供程序上自定义思考层级的令牌预算。([#529](https://github.com/badlogic/pi-mono/pull/529) by [@melihmucuk](https://github.com/melihmucuk))

### 重大变更
- 删除了OpenAI Codex模型别名（`gpt-5`、`gpt-5-mini`、`gpt-5-nano`、`codex-mini-latest`、`gpt-5-codex`、`gpt-5.1-codex`、`gpt-5.1-chat-latest`）。请使用规范模型ID：`gpt-5.1`、`gpt-5.1-codex-max`、`gpt-5.1-codex-mini`、`gpt-5.2`、`gpt-5.2-codex`。（[#536](https://github.com/badlogic/pi-mono/pull/536) by [@ghoulr](https://github.com/ghoulr)）

### 修复

- 将OpenAI Codex上下文窗口从400,000调整为272,000个token，以匹配Codex CLI默认值并防止400错误。（[#536](https://github.com/badlogic/pi-mono/pull/536) by [@ghoulr](https://github.com/ghoulr)）
- 修复Codex SSE错误事件，使其能够显示消息、代码和状态。（[#551](https://github.com/badlogic/pi-mono/pull/551) by [@tmustier](https://github.com/tmustier)）
- 修复上下文溢出检测，针对`context_length_exceeded`错误码。

## [0.37.8] - 2026-01-07

## [0.37.7] - 2026-01-07

## [0.37.6] - 2026-01-06

### 添加

- 导出了OpenAI Codex实用工具：`CacheMetadata`、`getCodexInstructions`、`getModelFamily`、`ModelFamily`、`buildCodexPiBridge`、`buildCodexSystemPrompt`、`CodexSystemPrompt`（[#510](https://github.com/badlogic/pi-mono/pull/510) by [@mitsuhiko](https://github.com/mitsuhiko)）

## [0.37.5] - 2026-01-06

## [0.37.4] - 2026-01-06

## [0.37.3] - 2026-01-06

### 添加

- 在`StreamOptions`中为支持基于会话缓存的提供商添加了`sessionId`选项。OpenAI Codex提供商使用此选项设置`prompt_cache_key`和路由头部。

## [0.37.2] - 2026-01-05

### 修复

- Codex提供商现在即使传递了自定义`include`选项，也会始终包含`reasoning.encrypted_content`。（[#484](https://github.com/badlogic/pi-mono/pull/484) by [@kim0](https://github.com/kim0)）

## [0.37.1] - 2026-01-05

## [0.37.0] - 2026-01-05

### 重大变更

- OpenAI Codex模型不再有按思考层级划分的变体（例如`gpt-5.2-codex-high`）。请使用基础模型ID，并单独设置思考层级。Codex提供商将推理努力限制在各模型内部支持的范围内。（最初由[@ben-vargas](https://github.com/ben-vargas)在[#472](https://github.com/badlogic/pi-mono/pull/472)实现）

### 添加

- 为所有回调服务器提供商（Google Gemini CLI、Antigravity、OpenAI Codex）添加了无头OAuth支持：当浏览器回调不可达时，粘贴重定向URL。（[#428](https://github.com/badlogic/pi-mono/pull/428) by [@ben-vargas](https://github.com/ben-vargas)，[#468](https://github.com/badlogic/pi-mono/pull/468) by [@crcatala](https://github.com/crcatala)）
- 支持取消GitHub Copilot设备代码轮询（AbortSignal）

### 修复

- 当思考关闭时，Codex请求将完全省略`reasoning`字段，让后端使用默认值而非强制赋值。（[#472](https://github.com/badlogic/pi-mono/pull/472)）

## [0.36.0] - 2026-01-05

### 添加

- 添加了支持Responses API流式传输的OpenAI Codex OAuth提供商：`openai-codex-responses`流式提供商，支持SSE解析、工具调用处理、用量/成本跟踪和PKCE OAuth流程。（[#451](https://github.com/badlogic/pi-mono/pull/451) by [@kim0](https://github.com/kim0)）

### 修复

- Vertex AI的`getEnvApiKey()`占位符：当配置了应用默认凭证（`~/.config/gcloud/application_default_credentials.json`存在）且同时设置了`GOOGLE_CLOUD_PROJECT`（或`GCLOUD_PROJECT`）和`GOOGLE_CLOUD_LOCATION`时，返回`"<authenticated>"`。这使得`streamSimple()`无需显式`apiKey`选项即可与Vertex AI配合使用。应用默认凭证文件存在性检查已缓存至进程内，以避免重复访问文件系统。

## [0.35.0] - 2026-01-05

## [0.34.2] - 2026-01-04

## [0.34.1] - 2026-01-04

## [0.34.0] - 2026-01-04

## [0.33.0] - 2026-01-04

## [0.32.3] - 2026-01-03

### 修复

- Google Vertex AI模型在未显式认证的情况下不再出现在可用模型列表中。此前`getEnvApiKey()`会返回`google-vertex`的占位符值，导致模型即使未配置Google Cloud ADC也会显示。

## [0.32.2] - 2026-01-03

## [0.32.1] - 2026-01-03

## [0.32.0] - 2026-01-03

### 添加

- 添加了支持应用默认凭证（ADC）的Vertex AI提供商。通过`gcloud auth application-default login`认证，设置`GOOGLE_CLOUD_PROJECT`和`GOOGLE_CLOUD_LOCATION`，即可通过Vertex AI访问Gemini模型。（[#300](https://github.com/badlogic/pi-mono/pull/300) by [@default-anton](https://github.com/default-anton)）

### 修复

- **Gemini CLI速率限制处理**：为429错误添加了自动重试功能，重试时会根据服务器提供的延迟进行等待。解析错误消息中的延迟（如“Your quota will reset after 39s”），并按此延迟等待。对于其他瞬时错误，回退至指数回退机制。（[#370](https://github.com/badlogic/pi-mono/issues/370)）

## [0.31.1] - 2026-01-02

## [0.31.0] - 2026-01-02

### 重大变更
- **Agent API moved**: 所有代理功能（`agentLoop`、`agentLoopContinue`、`AgentContext`、`AgentEvent`、`AgentTool`、`AgentToolResult`等）已迁移到 `@mariozechner/pi-agent-core`。请从该包导入，而非 `@mariozechner/pi-ai`。

### 新增

- **`GoogleThinkingLevel` 类型**: 导出的类型与 Google 的 `ThinkingLevel` 枚举值相对应（`"THINKING_LEVEL_UNSPECIFIED" | "MINIMAL" | "LOW" | "MEDIUM" | "HIGH"`）。允许在不导入 `@google/genai` 的情况下配置 Gemini 的思考级别。

- **`ANTHROPIC_OAUTH_TOKEN` 环境变量**: 现在在 `ANTHROPIC_API_KEY` 之前检查 `getEnvApiKey()`，允许 OAuth 令牌优先。

- **`event-stream.js` 导出**: `AssistantMessageEventStream` 工具现已从包索引导出。

### 变更

- **OAuth 使用 Web Crypto API**: PKCE 生成和 OAuth 流程现在使用 Web Crypto API（`crypto.subtle`）而非 Node.js `crypto` 模块。这提高了浏览器兼容性，同时仍可在 Node.js 20+ 上运行。

- **确定性模型生成**: `generate-models.ts` 现在会按字母顺序对提供者和模型进行排序，以确保多次运行输出一致。([#332](https://github.com/badlogic/pi-mono/pull/332) 由 [@mrexodia](https://github.com/mrexodia) 提交)

### 修复

- **OpenAI 响应中空内容块**: 助手消息中的空文本或思考块现在会在发送到 OpenAI 响应 API 之前被过滤掉，以防止验证错误。([#344](https://github.com/badlogic/pi-mono/pull/344) 由 [@default-anton](https://github.com/default-anton) 提交)

- **思考内容重复**: 修复了 chutes.ai 提供者中思考内容重复的问题。该提供者之前会在 `reasoning_content` 和 `reasoning` 字段中返回思考内容，导致每个片段被处理两次。现在仅使用第一个非空的推理字段。

- **zAi 提供者 API 映射**: 修复了 zAi 模型使用 `openai-completions` API 并使用正确的基础 URL（`https://api.z.ai/api/coding/paas/v4`），而非错误的 Anthropic API 映射。([#344](https://github.com/badlogic/pi-mono/pull/344)、[#358](https://github.com/badlogic/pi-mono/pull/358) 由 [@default-anton](https://github.com/default-anton) 提交)

## [0.28.0] - 2025-12-25

### 不兼容变更

- **OAuth 存储已移除** ([#296](https://github.com/badlogic/pi-mono/issues/296))：所有存储功能（`loadOAuthCredentials`、`saveOAuthCredentials`、`setOAuthStorage` 等）已移除。调用者需自行负责存储凭证。

- **OAuth 登录功能**: `loginAnthropic`、`loginGitHubCopilot`、`loginGeminiCli`、`loginAntigravity` 现在返回 `OAuthCredentials`，而非保存到磁盘。

- **refreshOAuthToken**: 现在接受 `(provider, credentials)` 并返回新的 `OAuthCredentials`，而非保存。

- **getOAuthApiKey**: 现在接受 `(provider, credentials)` 并返回 `{ newCredentials, apiKey }` 或 null。

- **OAuthCredentials 类型**: 不再包含 `type: "oauth"` 分辨器。调用者在存储时需自行添加分辨器。

- **setApiKey、resolveApiKey**: 已移除。调用者必须自行管理 API 密钥的存储和解析。

- **getApiKey**: 重命名为 `getEnvApiKey`。仅检查环境变量中已知提供者的 API 密钥。

## [0.27.7] - 2025-12-24

### 修复

- **思考标签泄漏**: 修复了 Claude 在响应中模仿字面 `</thinking>` 标签的问题。未签名的思考块（来自中止的流）现在会转换为无 `<thinking>` 标签的纯文本。TUI 仍将其显示为思考块。([#302](https://github.com/badlogic/pi-mono/pull/302) 由 [@nicobailon](https://github.com/nicobailon) 提交)

## [0.25.1] - 2025-12-21

### 新增

- **xhigh 思考级别支持**: 增加了 `supportsXhigh()` 函数以检查模型是否支持 xhigh 推理级别。同时对不支持 xhigh 的 OpenAI 模型，将其限制为 high。([#236](https://github.com/badlogic/pi-mono/pull/236) 由 [@theBucky](https://github.com/theBucky) 提交)

### 修复

- **Gemini 多模态工具结果**: 修复了 Gemini 模型中图像在工具结果中导致响应不稳定或损坏的问题。对于 Gemini 3，图像现在会嵌套在 `functionResponse.parts` 中（详见 [docs](https://ai.google.dev/gemini-api/docs/function-calling#multimodal)）。对于不支持多模态函数响应的旧模型，图像会单独作为用户消息发送。

- **排队消息引导**: 当提供 `getQueuedMessages` 时，代理循环会在每次工具调用后检查是否有排队的用户消息，并在当前助手消息中收到排队消息时跳过剩余的工具调用（发出错误工具结果）。
- **在Google提供程序URL中双倍API版本路径**：修复了在baseUrl支持添加后Gemini API调用返回404的问题。SDK会将其默认的apiVersion附加到已包含版本路径的baseUrl上。([#251](https://github.com/badlogic/pi-mono/pull/251) by [@shellfyred](https://github.com/shellfyred))

- **Anthropic SDK禁用重试**：重新启用了SDK级别的重试（默认2次）以应对短暂的HTTP失败。([#252](https://github.com/badlogic/pi-mono/issues/252))

## [0.23.5] - 2025-12-19

### 添加

- **Gemini 3 Flash思维支持**：扩展了Gemini 3 Flash模型（MINIMAL，LOW，MEDIUM，HIGH）的思维级别支持，以匹配Pro模型的能力。([#212](https://github.com/badlogic/pi-mono/pull/212) by [@markusylisiurunen](https://github.com/markusylisiurunen))

- **GitHub Copilot思维模型**：为更多Copilot模型（o3-mini，o1-mini，o1-preview）添加了思维支持。([#234](https://github.com/badlogic/pi-mono/pull/234) by [@aadishv](https://github.com/aadishv))

### 修复

- **Gemini工具结果格式**：修复了Gemini 3 Flash Preview的工具结果格式，该格式严格要求成功时使用`{ output: value }`，错误时使用`{ error: value }`。之前的格式使用`{ result, isError }`被更新的Gemini模型拒绝。同时通过移除`as any`类型转换，提高了类型安全。([#213](https://github.com/badlogic/pi-mono/issues/213)，[#220](https://github.com/badlogic/pi-mono/pull/220))

- **Google baseUrl配置**：Google提供程序现在会尊重`baseUrl`配置，以支持自定义端点或API代理。([#216](https://github.com/badlogic/pi-mono/issues/216)，[#221](https://github.com/badlogic/pi-mono/pull/221) by [@theBucky](https://github.com/theBucky))

- **GitHub Copilot视觉请求**：在向GitHub Copilot模型发送图片时添加了`Copilot-Vision-Request`头部。([#222](https://github.com/badlogic/pi-mono/issues/222))

- **GitHub Copilot X-Initiator头部**：修复了X-Initiator逻辑，改为检查最后一条消息的角色，而不是历史消息中的任意一条，以确保用户发送后续消息时计费正确。([#209](https://github.com/badlogic/pi-mono/issues/209))

## [0.22.3] - 2025-12-16

### 添加

- **图像限制测试套件**：为提供程序特定的图像限制（最大图像数，最大尺寸，最大分辨率）添加了全面的测试。实际限制如下：Anthropic（100张图像，5MB，8000像素），OpenAI（500张图像，≥25MB），Gemini（约2500张图像，≥40MB），Mistral（8张图像，约15MB），OpenRouter（上下文受限约40张图像，约15MB）。([#120](https://github.com/badlogic/pi-mono/pull/120))
- **工具结果流式传输**：添加了`tool_execution_update`事件和可选的`onUpdate`回调到`AgentTool.execute()`，以便在执行过程中流式传输工具输出。工具现在可以发出部分结果（例如bash stdout），并将结果转发给订阅者。([#44](https://github.com/badlogic/pi-mono/issues/44))

- **GitHub Copilot的X-Initiator头部**：为GitHub Copilot提供程序添加了X-Initiator头部处理，以确保正确的调用计费（代理调用不会被扣除配额）。根据最后一条消息的角色设置发起者。([#200](https://github.com/badlogic/pi-mono/pull/200) by [@kim0](https://github.com/kim0))

### 已更改

- **规范化tool_execution_end结果**：`tool_execution_end`事件现在始终包含`AgentToolResult`（不再包含`AgentToolResult | string`）。错误已包装在标准结果格式中。

### 已修复

- **默认禁用推理**：当`reasoning`选项未指定时，所有提供程序的推理现在明确被禁用。以前，像Gemini这样的提供程序会使用其默认的“动态推理”（推理开启），导致意外的token使用。这是最初的设计意图。([#180](https://github.com/badlogic/pi-mono/pull/180) by [@markusylisiurunen](https://github.com/markusylisiurunen))

## [0.22.2] - 2025-12-15

### 已添加

- **Anthropic的交错推理**：为`AnthropicOptions`添加了`interleavedThinking`选项。启用后，Claude 4模型可以在工具调用之间进行推理，并在接收到工具结果后进行推理。默认启用（无额外token成本，只是解锁了该功能）。将`interleavedThinking: false`设置为禁用。

## [0.22.1] - 2025-12-15

_谨致Peter的肩膀（[@steipete](https://twitter.com/steipete)）_

### 已添加

- **Anthropic的交错推理**：在Anthropic提供程序中启用了交错推理，允许Claude模型在文本响应中插入推理块。

## [0.22.0] - 2025-12-15

### 已添加
- **GitHub Copilot provider**: 已将 `github-copilot` 添加为已知提供程序，模型来源于 models.dev。包含 Claude、GPT、Gemini、Grok 及其他可通过 GitHub Copilot 访问的模型。([#191](https://github.com/badlogic/pi-mono/pull/191) by [@cau1k](https://github.com/cau1k))

### 修复

- **GitHub Copilot gpt-5 模型**：修复了 gpt-5 模型的 API 选择，改为使用 `openai-responses` 而非 `openai-completions`（gpt-5 模型无法通过 completions 端点访问）

- **GitHub Copilot 跨模型上下文交接**：修复了在 GitHub Copilot 模型之间切换（如 gpt-5 到 claude-sonnet-4）时上下文交接失败的问题。OpenAI Responses API 的工具调用 ID 与其他模型不兼容。([#198](https://github.com/badlogic/pi-mono/issues/198))

- **Gemini 3 Pro 思考层级**：思考层级配置现已正确适用于 Gemini 3 Pro 模型。此前所有层级均映射为 -1（最小思考）。现在 LOW/MEDIUM/HIGH 可正确控制测试时的计算。([#176](https://github.com/badlogic/pi-mono/pull/176) by [@markusylisiurunen](https://github.com/markusylisiurunen))

## [0.18.2] - 2025-12-11

### 更改

- **Anthropic SDK 重试禁用**：将 Anthropic 客户端设置为 `maxRetries: 0`，允许应用层处理重试逻辑。SDK 内置的重试机制干扰了编码代理的重试逻辑。([#157](https://github.com/badlogic/pi-mono/issues/157))

## [0.18.1] - 2025-12-10

### 添加

- **Mistral 提供程序**：已通过 OpenAI 兼容 API 支持 Mistral AI 模型。自动处理 Mistral 特定要求（工具调用 ID 格式）。设置 `MISTRAL_API_KEY` 环境变量即可使用。

### 修复

- 修复了 Mistral 400 错误，当助手消息被中止后跳过空助手消息（无内容、无工具调用）([#165](https://github.com/badlogic/pi-mono/issues/165))

- 移除了 Mistral 工具结果后的合成助手桥接消息（自 2025 年 12 月起不再需要）([#165](https://github.com/badlogic/pi-mono/issues/165))

- 修复了 `ANTHROPIC_API_KEY` 环境变量在首次 OAuth 令牌使用后被全局删除的 bug，导致后续提示失败的问题([#164](https://github.com/badlogic/pi-mono/pull/164))
## [0.17.0] - 2025-12-09

### 新增

- **`agentLoopContinue`功能**: 从现有上下文中继续代理循环，不增加新的用户消息。验证最后一个消息为`user`或`toolResult`。适用于上下文溢出后重试或从手动添加的工具结果恢复。

### 不兼容变更

- 移除了提供程序级别的工具参数验证。现在在`agentLoop`中通过`executeToolCalls`进行验证，允许模型在验证错误时重试。对于手动工具执行，请使用`validateToolCall(tools, toolCall)`或`validateToolArguments(tool, toolCall)`。

### 新增

- 添加了`validateToolCall(tools, toolCall)`助手，可根据名称查找工具并验证参数。

- **OpenAI兼容性覆盖**: 为`openai-completions` API在`Model`中添加了`compat`字段，允许显式配置提供程序的特殊之处（`supportsStore`、`supportsDeveloperRole`、`supportsReasoningEffort`、`maxTokensField`）。如果没有设置，则回退到URL检测。适用于LiteLLM、自定义代理和其他非标准端点。([#133](https://github.com/badlogic/pi-mono/issues/133)，感谢@fink-andreas的最初想法和PR)

- **xhigh推理级别**: 为OpenAI codex-max模型在`ReasoningEffort`类型中添加了`xhigh`。对于非OpenAI提供程序（Anthropic、Google），`xhigh`会自动映射为`high`。([#143](https://github.com/badlogic/pi-mono/issues/143))

### 变更

- **更新SDK版本**: OpenAI SDK 5.21.0 → 6.10.0，Anthropic SDK 0.61.0 → 0.71.2，Google GenAI SDK 1.30.0 → 1.31.0

## [0.13.0] - 2025-12-06

### 不兼容变更

- **在`Usage`类型中添加`totalTokens`字段**: 所有构造`Usage`对象的代码现在必须包含`totalTokens`字段。该字段表示LLM处理的总令牌数（输入+输出+缓存）。对于OpenAI和Google，使用原生API值（`total_tokens`、`totalTokenCount`）。对于Anthropic，计算方式为`input + output + cacheRead + cacheWrite`。

## [0.12.10] - 2025-12-04

### 新增

- 添加了`gpt-5.1-codex-max`模型支持

### 修复
- **OpenAI Token Counting**: 修复了`usage.input`，使其排除OpenAI提供商的缓存令牌。之前`input`包含了缓存令牌，导致通过`input + cacheRead`计算总上下文大小时出现重复计数。现在`input`表示所有提供商的非缓存输入令牌，`input + output + cacheRead + cacheWrite`成为计算总上下文大小的正确公式。

- **修复了Claude Opus 4.5缓存定价**（之前贵了3倍）
  - 缓存读取费用修正：$1.50 → $0.50每百万令牌
  - 缓存写入费用修正：$18.75 → $6.25每百万令牌
  - 在`scripts/generate-models.ts`中添加了手动覆盖选项，直到上游修复合并
  - 向models.dev提交了PR：https://github.com/sst/models.dev/pull/439

## [0.9.4] - 2025-11-26

首次发布，支持多提供商大语言模型。

