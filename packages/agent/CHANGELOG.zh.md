# 变更日志

## [未发布]

## [1.0.2] - 2026-10-04

## [1.0.1] - 2026-10-03

## [1.0.0] - 2026-10-01

### 重大变更

- 移除了从`@earendil-works/pi-agent-core`: `AgentHarness`、会话和会话存储、持久运行时、pico3、运行时工具、压缩、技能、提示模板、系统提示助手、遥测模式、搜索服务类型以及`uuidv7`和pi-telemetry重新导出的实验性运行时。`./node`、`./harness/*`和`./experimental/pico3`子路径导出已删除。该包现在仅包含`Agent`、代理流及其类型。使用`@earendil-works/pi-durable`进行持久会话。

## [0.99.2] - 2026-09-30

## [0.99.1] - 2026-09-29

## [0.99.0] - 2026-09-29

### 新增

- 新增了`onProviderStreamEvent`代理选项，该选项传递给提供者流以观察解析后的提供者事件（[#9784](https://github.com/earendil-works/pi/issues/9784)，[#9901](https://github.com/earendil-works/pi/pull/9901) 由[@davidbrai](https://github.com/davidbrai) 提交）。

- 代理循环现在会在每个助手消息中记录请求的思考级别作为`thinkingLevel`。

## [0.87.1] - 2026-09-22

## [0.87.0] - 2026-09-21

### 重大变更

- 移除了`AgentOptions.shouldStopAfterTurn`和`AgentLoopConfig.shouldStopAfterTurn`。使用`finishTurn`并返回`{ action: "end" }`以在完成的轮次后停止：

  ```ts
  // Before
  shouldStopAfterTurn: async (turn, signal) => await shouldStop(turn, signal),

  // After
  finishTurn: async (turn, signal) => {
    // shouldStopAfterTurn previously ran only for normal responses.
    if (turn.message.stopReason === "error" || turn.message.stopReason === "aborted") return;
    return (await shouldStop(turn, signal)) ? { action: "end" } : undefined;
  },
  ```

  `finishTurn`在助手和所有工具结果最终化后运行，但在`turn_end`之前；其决策在`turn_end`后应用。它也对错误和中止响应运行，但这些响应的决策被忽略，因为这些响应仍然是硬退出。迁移中的守卫保留了旧钩子的正常响应仅调用，包括避免硬退出的谓词副作用。返回`{ action: "end" }`后，转向和后续队列保持不变，跳过`prepareNextTurn`。

### 新增

- 新增了`prepareRequest`，它在每个提供者请求之前运行，包括第一个。例如，返回`{ context: { ...context, messages: persistedMessages } }`以在已选择的输入发出后安装规范上下文，而不引入另一个队列轮询。

- 新增了`finishTurn`，它在助手/工具结果最终化后运行，但在`turn_end`之前，用于正常、错误和中止响应。返回`{ action: "end" }`以在`turn_end`后结束正常运行，或返回`undefined`以保留正常调度。`{ action: "continue" }`确保下一个提供者请求：现有工具结果、转向或后续调度可以满足该请求，而无需添加另一个；否则循环会进行一次仅上下文请求。错误和中止响应仍然是硬退出。

- 新增了`Agent.peekQueuedMessages()`以预览下一个队列选择的批次，而不消耗它。

### 修复

- 修复了运行时将文本文件（以`GIF`开头）误分类为图像的问题（[#9755](https://github.com/earendil-works/pi/issues/9755)）。

## [0.86.1] - 2026-09-20

## [0.86.0] - 2026-09-19

## [0.85.1] - 2026-09-05

## [0.85.0] - 2026-09-04

### 修复

- 修复了代理助手响应丢失持久化提供者原生思考级别的问题。

- 修复了写工具将UTF-16代码单元计数误报为字节计数的问题（[#8979](https://github.com/earendil-works/pi/issues/8979)）。

## [0.84.4] - 2026-08-28

### 重大变更

- 将`prepareNextTurn`和`prepareNextTurnWithContext`改为仅在`shouldStopAfterTurn`和排队消息检查确定代理循环将启动另一个助手轮次后运行。它们不再在最终或终止轮次后运行；将运行结束工作移至`agent_end`处理（[#6879](https://github.com/earendil-works/pi/issues/6879)）。

### 修复

- 修复了Windows中`NodeExecutionEnv`中止时，`taskkill.exe`在`PATH`不可用时崩溃的问题（[#6596](https://github.com/earendil-works/pi/issues/6596)）。

### 移除

- 移除了从`AgentHarness`中撤回的手动驱动配置、操作检查方法、操作结果和快照操作字段。

## [0.84.3] - 2026-08-24

### 修复

- 修复了单对象`edit`工具输入验证失败的问题，允许它们作为单次编辑数组（[#7835](https://github.com/earendil-works/pi/issues/7835)）。

- 修复了技能目录中的根Markdown文件（如`README.md`和`AGENTS.md`）被报告为无效技能，除非它们声明有效的技能前置（[#7805](https://github.com/earendil-works/pi/issues/7805)）。

## [0.84.2] - 2026-08-14

### 修复
- 修复了`streamProxy()`丢弃已最终化工具调用元数据的问题，例如OpenAI响应命名空间（[#7709](https://github.com/earendil-works/pi/issues/7709)）。

## [0.84.1] - 2026-08-07

### 新增

- 新增了`BeforeToolCallResult.terminate`，使被阻塞的工具调用能够参与现有的批量早期终止规则（[#7715](https://github.com/earendil-works/pi/pull/7715) 由 [@muyiyr](https://github.com/muyiyr) 提交）。

### 修复

- 修复了`Agent.reset()`在主动运行时清除对话记录和运行时状态的问题；现在在代理空闲前会拒绝该操作（[#7717](https://github.com/earendil-works/pi/pull/7717) 由 [@wesleyzhangwq](https://github.com/wesleyzhangwq) 提交）。

## [0.84.0] - 2026-08-06

### 重大变更

- 用v4基于通道的`Session`、`SessionStorage`和`SessionRepo`API替换了遗留的运行时会话模型，包括持久化操作记录、全局事实、共享序列号和树域通道视图。

- 将v2会话和`AgentHarness`API从实验性入口提升为默认导出包，并移除了实验性子路径。

- 移除了遗留的JSONL和内存仓库API。请使用v4的`JsonlSessionRepo`或`InMemorySessionRepo`，两者均实现了新的`SessionRepo`契约。

- 为运行时环境添加了必需的`FileSystem.renameFile()`操作，以支持原子JSONL发布；自定义文件系统实现必须提供同一文件系统替换语义（[#7707](https://github.com/earendil-works/pi/pull/7707) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

### 新增

- 新增了带类型的AI请求和运行时监控数据模式，以及它们的组合模式元组、回调辅助函数和生成的模式参考。

- 新增了带显式遍历、过滤、排序和限制选项的`Session.findEntriesOnBranch()`和`findEntryOnBranch()`查询。

- 新增了完整的`AgentHarness` v2脚手架；未完成的操作路径在持久化执行实现前会拒绝`HarnessNotImplemented`。

- 新增了`JsonlSessionRepo`，这是一个v4仅追加JSONL会话仓库，带有元数据验证和共享存储语义（[#7611](https://github.com/earendil-works/pi/pull/7611) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

- 新增了带索引的`Session.findOpenOperations()`恢复查询和`RecordQuery.operationKind`过滤（[#7646](https://github.com/earendil-works/pi/pull/7646)）。

- 新增了`AgentOptions.shouldStopAfterTurn`，用于在完成一轮对话后优雅停止，避免后续消息或另一个模型调用被处理。详见[代理选项](README.md#agent-options)（[#7367](https://github.com/earendil-works/pi/pull/7367) 由 [@acmerfight](https://github.com/acmerfight) 提交）。

- 新增了对任意OpenAI兼容`samplingParams`的代理转发（[#7568](https://github.com/earendil-works/pi/pull/7568) 由 [@mrexodia](https://github.com/mrexodia) 提交）。

### 修复

- 修复了Windows路径处理中`NodeExecutionEnv`文件名、递归技能加载和提示模板名称的问题。

- 修复了`JsonlSessionRepo`在全局范围内强制会话ID；现在ID在每个工作目录内唯一。

- 修复了JSONL会话分叉和断尾修复，使其原子发布，避免在中断写入后出现部分写入或损坏的会话（[#7707](https://github.com/earendil-works/pi/pull/7707) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

## [0.83.0] - 2026-07-29

## [0.82.1] - 2026-07-25

## [0.82.0] - 2026-07-24

### 重大变更

- 替换了`AgentHarness`的`ExecutionEnv`依赖和无上下文`AgentTool`输入，改为应用定义的`toolContext`值和上下文感知的`AgentHarnessTool`定义。

### 新增

- 新增了基于`ExecutionEnv`的上下文感知`read`、`write`、`edit`和`bash`运行时工具，包括异步bash执行准备。

### 变更

- 对运行时工具路径处理、编辑序列化、shell输出捕获、显式非继承环境和跨平台进程清理进行了对齐，使其与编码代理行为一致。

### 修复

- 修复了压缩和分支摘要请求，在支持的情况下禁用提示缓存并使用新鲜路由会话ID（[#6618](https://github.com/earendil-works/pi/pull/6618) 由 [@tmustier](https://github.com/tmustier) 提交）。

## [0.81.1] - 2026-07-21

### 新增

- 新增了压缩和分支摘要操作的重试策略支持和生命周期事件（`AgentHarness`）（[#6901](https://github.com/earendil-works/pi/pull/6901) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

### 修复
- 恢复了`Agent` `streamFn`选项和主机可配置的省略代理循环流函数回退，而没有重新引入`pi-ai/compat`依赖（[#6915](https://github.com/earendil-works/pi/issues/6915)）。

## [0.81.0] - 2026-07-21

### 不兼容变更

- 将`SessionStorage`更改为使用`getPathToRootOrCompaction()`，要求会话名称和统计方法，支持基于游标的条目读取，并将保留的压缩尾部存储为独立检查点（[#6594](https://github.com/earendil-works/pi/pull/6594) 由 [@cristinaponcela](https://github.com/cristinaponcela) 提交）。
- 将`uuidv7`导出移动到`@earendil-works/pi-ai`（[#6834](https://github.com/earendil-works/pi/pull/6834) 由 [@xl0](https://github.com/xl0) 提交）。
- 用必需的`streamFunction`替换了可选的`Agent` `streamFn`回退，并将低级循环流函数设为必需，防止`@earendil-works/pi-ai/compat`及所有内置提供者进入选择性提供者捆绑包（[#6851](https://github.com/earendil-works/pi/issues/6851)）。

### 新增

- 在代理框架中为工具结果、压缩条目和分支摘要添加了使用元数据（[#6671](https://github.com/earendil-works/pi/pull/6671) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

## [0.80.10] - 2026-07-16

## [0.80.9] - 2026-07-16

## [0.80.8] - 2026-07-16

## [0.80.7] - 2026-07-14

### 新增

- 将`AgentToolResult.addedToolNames`传播到`ToolResultMessage`，以便由结果引入的工具可以从该转录点开始加载（[#6474](https://github.com/earendil-works/pi-mono/pull/6474)）。

## [0.80.6] - 2026-07-09

### 新增

- 在`xhigh`之后添加了`max`模型思考级别。

## [0.80.5] - 2026-07-09

## [0.80.4] - 2026-07-09

### 新增

- 添加了可配置的框架会话上下文条目转换和自定义条目消息投影器。
- 在JSONL会话头部添加了自定义元数据支持（[#6417](https://github.com/earendil-works/pi/pull/6417) 由 [@ArcadiaLin](https://github.com/ArcadiaLin) 提交）。
- 导出了`InMemorySessionStorage`和`JsonlSessionStorage`（[#6435](https://github.com/earendil-works/pi/issues/6435)）。

### 修复

- 修复了框架拆分轮次压缩，以序列化摘要请求，避免单并发提供者被要求运行重叠的世代（[#5536](https://github.com/earendil-works/pi/issues/5536)）。
- 修复了框架工具调用，当助手消息被截断时，调用会失败而不是等待缺失的工具结果（[#6285](https://github.com/earendil-works/pi/pull/6285)）。
- 修复了框架会话摄入，会在上下文投影前对`null`消息内容进行规范化，避免在导入宽松转录时崩溃（[#6343](https://github.com/earendil-works/pi/pull/6343)）。
- 修复了非正值或过大框架壳执行超时，会以清晰的验证错误失败，而不是被立即超时（[#6181](https://github.com/earendil-works/pi/issues/6181)）。
- 修复了框架会话存储短条目ID，使用生成uuidv7的随机尾部代替时间戳前缀，该前缀在多次调用间几乎恒定（[#6242](https://github.com/earendil-works/pi/issues/6242)）。

## [0.80.3] - 2026-06-30

### 新增

- 为需要下一轮循环上下文的`Agent`用户添加了`prepareNextTurnWithContext`。

### 修复

- 修复了`Agent.prepareNextTurn`，使其继续接收运行中止信号，而不是下一轮上下文。

## [0.80.2] - 2026-06-23

### 变更

- 将公共框架壳执行选项类型从`ExecutionEnvExecOptions`重命名为`ShellExecOptions`。

## [0.80.1] - 2026-06-23

## [0.80.0] - 2026-06-23

### 不兼容变更

- `AgentHarnessOptions.models`为必需且是唯一的认证路径：框架通过提供的`Models`实例（`models.streamSimple()`/`completeSimple()`）处理轮次、压缩和分支摘要，通过提供者进行认证。`AgentHarnessOptions.getApiKeyAndHeaders`已移除——应用现在通过在`Models`集合中的提供者上表达`ApiKeyAuth`/`OAuthAuth`（提供者认证）来实现每次请求解析密钥。使用`createModels()`和提供者工厂构建一个版本（或从`@earendil-works/pi-ai/providers/all`的`builtinModels()`）；测试使用`fauxProvider()`。
- `compact()`、`generateSummary()`和`generateBranchSummary()`接受`Models`参数，不再接受显式的`apiKey`/`headers`。
- 结构上定义了`StreamFn`（`(model, context, options?) => AssistantMessageEventStream | Promise<...>`）；`Models.streamSimple`满足该定义。
- 移除了`@earendil-works/pi-agent-core/base`选择性提供者入口点；使用根包和显式的`Models`实例代替。

### 修复
-  修复了 harness 会话名称，使其在存储标签前会标准化换行符 ([#5999](https://github.com/earendil-works/pi/pull/5999) 由 [@haoqixu](https://github.com/haoqixu) 提交)。

-  修复了 harness 压缩估算，使其忽略截断响应后所有零值辅助使用记录的异常情况 ([#5526](https://github.com/earendil-works/pi/pull/5526) 由 [@dmmulroy](https://github.com/dmmulroy) 提交)。

## [0.79.10] - 2026-06-22

## [0.79.9] - 2026-06-20

###  修复

-  修复了通过旧版 WSL `bash.exe` 执行节点环境命令，使脚本可通过标准输入传递，从而在目标 bash 中展开 shell 变量 ([#5893](https://github.com/earendil-works/pi/issues/5893))。

## [0.79.8] - 2026-06-19

###  增加

-  增加 `@earendil-works/pi-agent-core/base`，以便打包器可将其与选择性的 `@earendil-works/pi-ai/base` 提供者注册配对 ([#5348](https://github.com/earendil-works/pi/pull/5348) 由 [@FredKSchott](https://github.com/FredKSchott) 提交)。

## [0.79.7] - 2026-06-18

## [0.79.6] - 2026-06-16

## [0.79.5] - 2026-06-16

## [0.79.4] - 2026-06-15

## [0.79.3] - 2026-06-13

## [0.79.2] - 2026-06-12

###  修复

-  修复了工具进度回调在工具结算后被忽略的情况，而不是发出过期的 `tool_execution_update` 事件 ([#5573](https://github.com/earendil-works/pi/issues/5573))。

## [0.79.1] - 2026-06-09

## [0.79.0] - 2026-06-08

###  修复

-  修复了压缩摘要系统提示，使其对非编码代理使用中立的 AI 助手用语 ([#5401](https://github.com/earendil-works/pi/issues/5401))。

## [0.78.1] - 2026-06-04

## [0.78.0] - 2026-05-29

## [0.77.0] - 2026-05-28

###  重大变更

-  重命名了代理 harness 的 `model_select` 和 `thinking_level_select` 事件为 `model_update` 和 `thinking_level_update`。

###  增加

-  增加了代理 harness 的工具注册表 API、`tools_update` 事件、分支作用域的活动工具持久化以及重复工具验证功能。

## [0.76.0] - 2026-05-27

###  修复

-  修复了上下文令牌估算，使其在计算用户图像附件时与工具结果图像保持一致 ([#4983](https://github.com/earendil-works/pi/issues/4983))。

## [0.75.5] - 2026-05-23

## [0.75.4] - 2026-05-20

###  修改

-  修改了源语法，避免使用需要 JavaScript 编译的 TypeScript 语法，保持包兼容 Node.js 的仅移除类型检查。

-  移除了包级开发监视脚本，因为根目录的 TypeScript 检查已验证源代码的兼容性。

###  修复

-  修复了工具调用预检，使其在运行被中止后不再准备兄弟工具调用 ([#4276](https://github.com/earendil-works/pi/issues/4276))。

-  修复了尾部截断，使其对以换行符结尾的超长单行输出进行正确处理 ([#4715](https://github.com/earendil-works/pi/issues/4715))。

-  修复了 Windows 节点执行环境命令启动，隐藏辅助控制台窗口作为后台进程 ([#4699](https://github.com/earendil-works/pi/issues/4699))。

## [0.75.3] - 2026-05-18

## [0.75.2] - 2026-05-18

## [0.75.1] - 2026-05-18

## [0.75.0] - 2026-05-17

###  重大变更

-  将最低支持的 Node.js 版本提升至 22.19.0。

## [0.74.1] - 2026-05-16

## [0.74.0] - 2026-05-07

## [0.73.1] - 2026-05-07

## [0.73.0] - 2026-05-04

## [0.72.1] - 2026-05-02

###  修改

-  将默认代理传输更改为 `auto`，以便提供者可使用其最佳可用传输 ([#4083](https://github.com/badlogic/pi-mono/issues/4083))。

## [0.72.0] - 2026-05-01

###  增加

-  增加 `shouldStopAfterTurn` 到低级代理循环配置，以便在完成一轮后优雅退出，避免轮询排队消息或启动新的 LLM 调用。

## [0.71.1] - 2026-05-01

## [0.71.0] - 2026-04-30

## [0.70.6] - 2026-04-28

## [0.70.5] - 2026-04-27

## [0.70.4] - 2026-04-27

## [0.70.3] - 2026-04-27

## [0.70.2] - 2026-04-24

## [0.70.1] - 2026-04-24

## [0.70.0] - 2026-04-23

## [0.69.0] - 2026-04-22

###  重大变更

-  将公共 TypeBox 面向类型的迁移从 `@sinclair/typebox` 0.34.x 迁移到 `typebox` 1.x，安装和导入应使用 `typebox` 而非依赖 `@sinclair/typebox` 的传递性 ([#3112](https://github.com/badlogic/pi-mono/issues/3112))。

###  增加

-  增加 `terminate: true` 工具结果提示，当当前批次中每个最终工具结果都选择早期终止时，可跳过自动后续 LLM 调用 ([#3525](https://github.com/badlogic/pi-mono/issues/3525))。

## [0.68.1] - 2026-04-22

###  修复

-  修复 `streamProxy()`，以保留代理安全序列化子集的流选项，包括会话、传输、重试延迟、元数据、头部、缓存保留和思考预算设置 ([#3512](https://github.com/badlogic/pi-mono/issues/3512))。
- 修复了并行工具执行，使其在每个工具最终化时立即发出`tool_execution_end`，同时仍按助手源顺序发出持久化工具结果消息（[#3503](https://github.com/badlogic/pi-mono/issues/3503)）

## [0.68.0] - 2026-04-20

### 更改了

- 明确了并行工具执行顺序的文档，指明最终工具生命周期和工具结果工件将按工具完成顺序发出。

## [0.67.68] - 2026-04-17

## [0.67.67] - 2026-04-17

### 修复了

- 修复了并行工具调用最终化，将`afterToolCall`钩子抛出的错误转换为错误工具结果，而不是中止批次（[#3084](https://github.com/badlogic/pi-mono/issues/3084)）

## [0.67.6] - 2026-04-16

## [0.67.5] - 2026-04-16

## [0.67.4] - 2026-04-16

## [0.67.3] - 2026-04-15

## [0.67.2] - 2026-04-14

## [0.67.1] - 2026-04-13

## [0.67.0] - 2026-04-13

## [0.66.1] - 2026-04-08

## [0.66.0] - 2026-04-08

## [0.65.2] - 2026-04-06

## [0.65.1] - 2026-04-05

## [0.65.0] - 2026-04-03

### 破坏性变更

- `AgentState`已重塑：
  - `streamMessage`更名为`streamingMessage`
  - `error`更名为`errorMessage`
  - `isStreaming`、`streamingMessage`、`pendingToolCalls`和`errorMessage`现在在公共API中为只读属性
  - `pendingToolCalls`现在类型为`ReadonlySet<string>`
  - `tools`和`messages`现在为访问器属性，赋值任一字段会复制顶层数组，而非保持数组身份
- `AgentOptions.initialState`不再接受运行时拥有的字段。移除`isStreaming`、`streamingMessage`、`pendingToolCalls`和`errorMessage`从`initialState`值中。
- 移除了`Agent`的变异方法，改为直接属性访问：
  - `agent.setSystemPrompt(value)` -> `agent.state.systemPrompt = value`
  - `agent.setModel(model)` -> `agent.state.model = model`
  - `agent.setThinkingLevel(level)` -> `agent.state.thinkingLevel = level`
  - `agent.setTools(tools)` -> `agent.state.tools = tools`
  - `agent.replaceMessages(messages)` -> `agent.state.messages = messages`
  - `agent.appendMessage(message)` -> `agent.state.messages.push(message)`
  - `agent.clearMessages()` -> `agent.state.messages = []`
  - `agent.setToolExecution(mode)` -> `agent.toolExecution = mode`
  - `agent.setBeforeToolCall(fn)` -> `agent.beforeToolCall = fn`
  - `agent.setAfterToolCall(fn)` -> `agent.afterToolCall = fn`
  - `agent.setTransport(transport)` -> `agent.transport = transport`
- 移除了队列模式的获取器/设置器方法，改为属性：
  - `agent.setSteeringMode(mode)` -> `agent.steeringMode = mode`
  - `agent.getSteeringMode()` -> `agent.steeringMode`
  - `agent.setFollowUpMode(mode)` -> `agent.followUpMode = mode`
  - `agent.getFollowUpMode()` -> `agent.followUpMode`
- `Agent.subscribe()`监听器现在会被等待，并接收活动的`AbortSignal`：
  - `agent.subscribe((event) => { ... })` -> `agent.subscribe(async (event, signal) => { ... })`
  - `agent_end`现在是运行最终发出的事件，但不是空闲边界
  - `agent.waitForIdle()`、`agent.prompt(...)`和`agent.continue()`现在仅在等待`agent_end`监听器完成后才结算
  - `agent.state.isStreaming`在结算完成前保持为`true`

## [0.64.0] - 2026-03-29

### 增加了

- 增加了`AgentTool.prepareArguments`钩子，用于在模式验证前准备原始工具调用参数，从而兼容恢复会话中旧版工具模式的适配层

## [0.63.2] - 2026-03-29

### 增加了

- 增加了`Agent.signal`，用于暴露当前轮次的活动取消信号，允许调用者将取消操作传递给嵌套的异步工作（[#2660](https://github.com/badlogic/pi-mono/issues/2660)）

## [0.63.1] - 2026-03-27

## [0.63.0] - 2026-03-27

## [0.62.0] - 2026-03-23

## [0.61.1] - 2026-03-20

## [0.61.0] - 2026-03-20

## [0.60.0] - 2026-03-18

## [0.59.0] - 2026-03-17

## [0.58.4] - 2026-03-16

### 修复了

- 修复了引导消息，使其等待直到当前助手消息的工具调用批次完全完成，而不是跳过待处理的工具调用。

## [0.58.3] - 2026-03-15

## [0.58.2] - 2026-03-15

## [0.58.1] - 2026-03-14

## [0.58.0] - 2026-03-14

### 增加了

- 增加了`beforeToolCall`和`afterToolCall`钩子到`AgentOptions`和`AgentLoopConfig`，用于飞行前阻塞和执行后工具结果的变异。

### 更改了

- 增加了可配置的工具执行模式到`Agent`和`agentLoop`，通过`toolExecution: "parallel" | "sequential"`配置，`parallel`为默认值。并行模式下，飞行前按顺序预检工具调用，允许工具并发执行，并按助手源顺序发出最终工具结果。

## [0.57.1] - 2026-03-07
## [0.57.0] - 2026-03-07

## [0.56.3] - 2026-03-06

## [0.56.2] - 2026-03-05

## [0.56.1] - 2026-03-05

## [0.56.0] - 2026-03-04

## [0.55.4] - 2026-03-02

## [0.55.3] - 2026-02-27

## [0.55.2] - 2026-02-27

## [0.55.1] - 2026-02-26

## [0.55.0] - 2026-02-24

## [0.54.2] - 2026-02-23

## [0.54.1] - 2026-02-22

## [0.54.0] - 2026-02-19

## [0.53.1] - 2026-02-19

## [0.53.0] - 2026-02-17

## [0.52.12] - 2026-02-13

### 已添加
- 将`transport`添加到`AgentOptions`和`AgentLoopConfig`的转发中，允许流传输偏好（`"sse"`、`"websocket"`、`"auto"`）流入提供者呼叫。

## [0.52.11] - 2026-02-13

## [0.52.10] - 2026-02-12

## [0.52.9] - 2026-02-08
## [0.52.8] - 2026-02-07

## [0.52.7] - 2026-02-06

### 已固定
- 修复 `continue()`，使其在上下文当前以助手消息结束时恢复排队的转向/跟进消息，并在助手尾部恢复时保持一次性的转向顺序（[#1312](https://github.com/badlogic/pi-mono/pull/1312) 由 [@ferologics](https://github.com/ferologics) 提交）

## [0.52.6] - 2026-02-05

## [0.52.5] - 2026-02-05

## [0.52.4] - 2026-02-05

## [0.52.3] - 2026-02-05

## [0.52.2] - 2026-02-05

## [0.52.1] - 2026-02-05

## [0.52.0] - 2026-02-05

## [0.51.6] - 2026-02-04

## [0.51.5] - 2026-02-04

## [0.51.4] - 2026-02-03

## [0.51.3] - 2026-02-03

## [0.51.2] - 2026-02-03

## [0.51.1] - 2026-02-02
## [0.51.0] - 2026-02-01

## [0.50.9] - 2026-02-01

## [0.50.8] - 2026-02-01

### 已添加
- 在`AgentOptions`中添加了`maxRetryDelayMs`选项，以限制服务器请求的重试延迟。该选项已传递给底层流函数。([#1123](https://github.com/badlogic/pi-mono/issues/1123))

## [0.50.7] - 2026-01-31

## [0.50.6] - 2026-01-30

## [0.50.5] - 2026-01-30

## [0.50.3] - 2026-01-29

## [0.50.2] - 2026-01-29

## [0.50.1] - 2026-01-26

## [0.50.0] - 2026-01-26

## [0.49.3] - 2026-01-22

## [0.49.2] - 2026-01-19

## [0.49.1] - 2026-01-18

## [0.49.0] - 2026-01-17

## [0.48.0] - 2026-01-16

## [0.47.0] - 2026-01-16

## [0.46.0] - 2026-01-15

## [0.45.7] - 2026-01-13

## [0.45.6] - 2026-01-13

## [0.45.5] - 2026-01-13

## [0.45.4] - 2026-01-13

## [0.45.3] - 2026-01-13

## [0.45.2] - 2026-01-13

## [0.45.1] - 2026-01-13

## [0.45.0] - 2026-01-13

## [0.44.0] - 2026-01-12

## [0.43.0] - 2026-01-11

## [0.42.5] - 2026-01-11

## [0.42.4] - 2026-01-10

## [0.42.3] - 2026-01-10

## [0.42.2] - 2026-01-10

## [0.42.1] - 2026-01-09

## [0.42.0] - 2026-01-09

## [0.41.0] - 2026-01-09

## [0.40.1] - 2026-01-09

## [0.40.0] - 2026-01-08
## [0.39.1] - 2026-01-08

## [0.39.0] - 2026-01-08

## [0.38.0] - 2026-01-08

### 新增

- `thinkingBudgets`选项已添加到`Agent`和`AgentOptions`，用于自定义每个思考层级的token预算（[#529](https://github.com/badlogic/pi-mono/pull/529)由[@melihmucuk](https://github.com/melihmucuk)提交）
## [0.37.8] - 2026-01-07

## [0.37.7] - 2026-01-07

## [0.37.6] - 2026-01-06

## [0.37.5] - 2026-01-06

## [0.37.4] - 2026-01-06

## [0.37.3] - 2026-01-06

### 新增

- `sessionId`在`Agent`中增加转发会话标识符至LLM提供商的功能，用于基于会话的缓存。

## [0.37.2] - 2026-01-05

## [0.37.1] - 2026-01-05

## [0.37.0] - 2026-01-05

### 修复

- `minimal`的思考级别现在映射为`minimal`的推理努力，而非作为`low`处理。

## [0.36.0] - 2026-01-05

## [0.35.0] - 2026-01-05

## [0.34.2] - 2026-01-04

## [0.34.1] - 2026-01-04

## [0.34.0] - 2026-01-04

## [0.33.0] - 2026-01-04

## [0.32.3] - 2026-01-03

## [0.32.2] - 2026-01-03

## [0.32.1] - 2026-01-03

## [0.32.0] - 2026-01-03

### 不兼容变更

- **队列API已替换为steer/followUp**：`queueMessage()`方法已拆分为两个具有不同交付语义的方法（[#403](https://github.com/badlogic/pi-mono/issues/403)）：
  - `steer(msg)`：中断代理运行中。在当前工具执行完成后交付，跳过剩余工具。
  - `followUp(msg)`：等待代理完成。仅在没有更多工具调用或导航消息时交付。
- **队列模式重命名**：`queueMode`选项重命名为`steeringMode`。新增`followUpMode`选项。两者均控制消息是单条交付还是批量交付。
- **AgentLoopConfig回调重命名**：`getQueuedMessages`拆分为`getSteeringMessages`和`getFollowUpMessages`。
- **代理方法重命名**：
  - `queueMessage()` → `steer()`和`followUp()`
  - `clearMessageQueue()` → `clearSteeringQueue()`、`clearFollowUpQueue()`、`clearAllQueues()`
  - `setQueueMode()`/`getQueueMode()` → `setSteeringMode()`/`getSteeringMode()`和`setFollowUpMode()`/`getFollowUpMode()`

### 修复

- `prompt()`和`continue()`现在在代理正在流式输出时调用会抛出异常，防止竞态条件和状态损坏。流式输出期间可用`steer()`或`followUp()`排队消息，或使用`await`之前的调用。

## [0.31.1] - 2026-01-02

## [0.31.0] - 2026-01-02

### 不兼容变更
- **传输抽象已移除**：`ProviderTransport`、`AppTransport`和`AgentTransport`接口已移除。请直接使用`streamFn`选项进行自定义流实现。

- **代理选项已重命名**：
  - `transport` → 已移除（改用`streamFn`）
  - `messageTransformer` → `convertToLlm`
  - `preprocessor` → `transformContext`

- **`AppMessage`已重命名为`AgentMessage`**：所有`AppMessage`引用均已重命名为`AgentMessage`，以保持一致性。

- **`CustomMessages`已重命名为`CustomAgentMessages`**：声明合并接口已重命名。

- **`UserMessageWithAttachments`和`Attachment`类型已移除**：附件处理现由`convertToLlm`函数负责。

- **代理循环已从`@mariozechner/pi-ai`移除**：`agentLoop`、`agentLoopContinue`及相关类型已移至此包。请从`@mariozechner/pi-agent-core`导入。

### 已添加

- 为`Agent`添加`streamFn`选项，用于自定义流实现。默认使用pi-ai的`streamSimple`。

- 为浏览器应用提供`streamProxy()`实用函数，用于代理LLM调用通过后端服务器。替代已移除的`AppTransport`。

- 为动态API密钥解析提供`getApiKey`选项（适用于过期OAuth令牌，如GitHub Copilot）。

- 提供`agentLoop()`和`agentLoopContinue()`低级函数，用于在不使用`Agent`类包装器的情况下运行代理循环。

- 新增导出类型：`AgentLoopConfig`、`AgentContext`、`AgentTool`、`AgentToolResult`、`AgentToolUpdateCallback`、`StreamFn`。

### 已更改

- `Agent`构造函数现在所有选项均为可选（空选项将使用默认值）。

- `queueMessage()`现为同步方法（不再返回Promise）。

