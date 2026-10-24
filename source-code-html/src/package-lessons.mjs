// 中文教学层。路径与定位文本由生成器核验；参数全文来自源码索引与原始资料。
import { workbenchLessons } from './workbench.mjs';
const step = (title, path, needle, text) => ({ title, path, needle, text });
export const packageLessons = {
  ...workbenchLessons,
  agent: {
    intro: '把一次模型回答变成可持续执行工具的智能体。Agent 管理内存中的消息、队列、取消和事件；模型接入由 ai 提供，磁盘会话与产品界面由上层负责。适合构建自己的聊天、自动化或服务端代理。',
    focus: ['AgentMessage 可包含应用自己的消息，发送前先经过 transformContext，再经 convertToLlm 转成模型消息。界面消息并不必然进入模型上下文。', '并行工具的完成事件按完成顺序发出，但最终 toolResult 按模型原始调用顺序排列。任何工具要求 sequential 时整批顺序执行。', 'Agent 的异步订阅者会被等待；agent_end 之后，prompt / waitForIdle 还需等待订阅者收尾。底层循环的观察事件流不提供同样的处理屏障。'],
    usage: ['先创建 Models 集合、注册 provider，取得模型，再把 models.streamSimple.bind(models) 交给 Agent 的 streamFn。', '订阅 message_update 处理流式显示，await agent.prompt 完成本轮；需要工具时提供 AgentTool 的 schema 与 execute。', '先用 faux provider 或已有测试验证事件顺序，再接入有凭据的真实模型；页面中的资料不会自动发起请求。'],
    config: [['AgentOptions', 'initialState 初始化模型、消息与工具；streamFn 是必填执行入口。steeringMode / followUpMode 管理每次取一条还是全部队列。'], ['工具与请求钩子', 'beforeToolCall 在参数验证后拦截，afterToolCall 修改结果；prepareRequest 在每次请求前准备最终上下文，finishTurn 决定是否继续。不要无条件返回 continue。'], ['推理、重试与传输', 'thinkingBudgets、transport、maxRetryDelayMs 和 sessionId 交给调用链处理；具体类型、可选性及注释见下方全量声明。工具批次只有所有结果都要求 terminate 才提前结束。']],
    flow: [step('创建状态与排队', 'packages/agent/src/agent.ts', 'export class Agent', '从构造器到 prompt / continue，观察运行状态、消息复制和重复运行限制。'), step('执行一轮', 'packages/agent/src/agent-loop.ts', 'runAgentLoop', '追踪输入事件、请求准备、模型响应、工具预检与完成事件。'), step('核对协议', 'packages/agent/src/types.ts', 'AgentLoopConfig', '把事件、钩子、工具结果和队列类型逐项与执行分支对照。')],
    extend: ['新增 AgentTool；跨 MCP / codemode 的嵌套调用使用 runToolCall，使前后钩子仍然生效。', '自定义消息配合 convertToLlm；上下文裁剪配合 transformContext；模型网络代理配合 streamFn。'],
    mastery: ['画出一条带两次工具调用的事件序列，并区分事件完成顺序与消息保存顺序。', '分别验证工具抛错、取消、steer 和 followUp；说明每种情况下一轮是否发生。', '给异步 agent_end 订阅者加延迟，理解运行完成与事件已发出的差别。', '最后阅读 proxy.ts，比较远程流接入和本地循环的职责。']
  },
  ai: {
    intro: '统一模型目录、认证、消息结构和流式事件的接入层。它提供聊天、图像生成与分类等操作，不负责自动执行模型提出的工具调用。适合需要切换提供商但保留同一应用消息结构的项目。',
    focus: ['Models 是 provider 的集合；模型目录、认证与 API 实现分开组织。选择模型和真正发送请求是两个阶段。', 'streamSimple 使用统一的推理选项；stream 使用具体 API 的选项。telemetry 接收父 TelemetrySpan；AI_TELEMETRY_SCHEMA 记录请求/轮询与用量，取消和 provider_error 分别标记。', '工具参数可能以不完整 JSON 片段流入；必须等待完成并验证后才能执行。stopReason、取消和 usage 应分别处理。'],
    usage: ['按需导入 provider 工厂并注册到 createModels；查找模型时处理不存在的结果。', '构建消息与工具 schema，消费 stream 事件或者等待 complete；由应用决定工具执行与下一轮请求。', '测试先使用 faux provider；真实调用还需要对应凭据，模型数据准备见本地开发说明。'],
    config: [['Models 与 provider', 'CreateModelsOptions、CreateProviderOptions 以及各 provider 工厂决定目录、认证和传输组合；包 exports 区分根入口与子路径。'], ['请求与采样', 'StreamOptions / SimpleStreamOptions、各 API 的 Options、ConstrainedSamplingConfig 保留各自约束。使用完整签名核对 signal、maxTokens、temperature 和推理选项。'], ['认证与诊断', 'AuthOperationOptions、LoginOptions、环境变量与凭据存储是不同入口；onPayload / onResponse / onProviderStreamEvent 用于请求诊断。不要把诊断回调视作业务状态。']],
    flow: [step('查找与派发', 'packages/ai/src/models.ts', 'createModels', '从集合查找模型，跟到 provider，再跟到具体 API。'), step('消息和选项契约', 'packages/ai/src/types.ts', 'StreamOptions', '读消息、事件、工具、usage 与停止原因；先明确输入输出再读转换逻辑。'), step('一个具体请求', 'packages/ai/src/api/openai-responses.ts', 'OpenAIResponsesOptions', '选一个实现观察参数转换与错误处理，再比较另一家实现。')],
    extend: ['用 createProvider 组合新目录和 API；已有兼容 API 可以复用，但仍需明确兼容参数。', '扩展认证存储、请求头变换和自定义网络实现；新增模型通过生成流程维护，不能手改生成表。'],
    mastery: ['逐步跟踪一条 system / user 消息到供应商请求体，再跟踪 text_delta 回到 AssistantMessage。', '分别阅读聊天、图像、分类的类型，解释它们为什么不能共用一个能力判断。', '用 faux provider 验证取消、工具参数和异常，不依赖真实模型输出。', '对照两个 API 实现分析同一个 thinking 选项如何转换，并检查对应测试。']
  },
  chord: {
    intro: '跨进程对象运行时：通过契约定义对象，由 Host 提供实例，调用者持有 Ref，并订阅可观察状态。它还负责生命周期、principal 隔离、连接与热重载。适合共享应用状态与跨进程服务。',
    focus: ['对象是状态与代码；调用者拿到的是句柄。持有关系决定对象存活，root 的结束会释放该作用域的引用；await get 等待 live 和初始状态就绪。', 'principal 参与对象身份和可用变体，不应把一个用户的句柄或状态直接当作另一个用户的授权。', '热重载时在途工作使用旧 codeVersion，命名 state 按版本保留或迁移；派生节点重建、监听重新协调，资源根据 version/deps 复用或替换。JSON 状态采用所有权约定，发布后不能直接修改共享容器。'],
    usage: ['从 README 的 Counter 入门，再读 docs/tutorial.md 的共享待办应用。先在一个进程完成契约、serve、root 和调用。', '加入 memoryLinkPair 模拟远程两端，再切换 IPC 或 WebSocket；先理解 root 的生命周期再增加连接。', '用 test/tutorial.test.ts 对照教程中的行为与断言，而不是仅检查控制台打印。'],
    config: [['契约与对象', 'remote / local、method、variants 与 TypeBox schema 定义输入、状态和方法；remote 必须给出 host 放置位置，createHost 必须给出 self principal；HostOptions、RootOptions、GetOptions 决定运行与引用上下文。'], ['连接与进程', 'LinkOptions、AcceptOptions、WebSocketAcceptOptions、HostManagerOptions 和 ForkDriverOptions 分别作用于连接、接受端与子进程。'], ['状态与重载', 'SourceOptions、ReplicatedStateSourceOptions 与 ReloadOptions 控制来源、错误观察和迁移；self.state/resource/on/derive/task 的命名与选项分别核对。delta 的 prepare 不提交，adopt 才切换权威版本。共享 /output 与 /sqlite 提供输出节奏和数据库驱动。']],
    flow: [step('定义契约', 'packages/chord/src/contract.ts', 'remote', '先读输入、变体和方法 schema 的验证。'), step('Host 与根作用域', 'packages/chord/src/host.ts', 'createHost', '跟踪注册服务、root、句柄取得和释放。'), step('远程链路', 'packages/chord/src/connection.ts', 'LinkOptions', '区分本地对象操作与连接上传输的消息。'), step('状态发布', 'packages/chord/src/state.ts', 'replicatedState', '观察快照、提交帧和订阅回调的顺序。'), step('热重载', 'packages/chord/src/reload.ts', 'ReloadOptions', '核对在途调用、代码切换与迁移边界。'), step('共享输出与节奏', 'packages/chord/src/output.ts', 'ProgressClock', '追踪输出裁剪、提交起点与定时器；当前默认时钟为 Date.now。'), step('共享 SQLite', 'packages/chord/src/sqlite/index.ts', '', '从公共导出区分数据库契约、迁移器及各平台驱动。')],
    extend: ['用 defineFacet / defineRegistry 组织应用对象；通过 self.state / self.resource / self.on / self.derive 扩展状态行为；旧独立声明函数已移除。', '适配 link 或 Node loader；需要纯 JSON 增量处理时独立使用 /delta，不必引入全部 Host 功能。'],
    mastery: ['完成教程待办应用，再解释对象身份与 principal 的关系。', '人为断开连接，验证句柄、订阅与资源释放的边界。', '阅读 delta tracker 的 prepare / adopt，写一个回调抛错不发布的例子。', '对照 spec.md 阅读重载测试，区分兼容更新与需要迁移的变化。']
  },
  codemode: {
    intro: '在 QuickJS WebAssembly 虚拟机中执行模型编写的 JavaScript，并且只暴露注入的工具。脚本可以组合多次工具调用，模型上下文只接收脚本输出和返回值。',
    focus: ['脚本环境没有 fetch、process、模块加载或计时器；宿主注入什么工具，脚本才具有什么能力。工具参数和结果经过 JSON 往返。', '工具 schema 用于生成模型看到的声明，不自动验证实际参数；验证应由工具边界负责。', 'Node Worker、Inline 和 Remote 三类沙箱共用语义但阻塞与取消边界不同。远程计算中的 VM 不一定在调用者超时时立刻停止。'],
    usage: ['Node / Bun 从根入口构建 CodemodeSandbox，注入最小 tools，execute 一段只调用这些工具的脚本，finally 中 close。', '需要跨次保存值时把 store 传入，只有成功结果中的 storeWrites 才用于更新宿主存储。', 'Cloudflare 示例将 sandbox 部署到单独 Worker；源码示例展示配置，离线页面不会替你部署。'],
    config: [['沙箱限制', 'CodemodeSandboxBaseOptions 的 tools、globals、timeoutMs、memoryLimitBytes；Node 版本还可指定 wasm 和 workerUrl。默认值以原始注释和实现为准。'], ['执行与重放', 'CodemodeExecuteOptions 管理 signal / store；CodemodeRunOptions 配合 startedAt、seed、onCall 与有序 deliver 支持确定性重放。'], ['脚本头与远程模式', 'CodemodeSourceOptions 的 max_output_tokens / timeout_ms 由调用方解释；portable 的 interruptBudget、remote 及服务端限制需要分别核对。']],
    flow: [step('脚本格式', 'packages/codemode/src/source.ts', 'parseCodemodeSource', '验证首行选项，保留源码行号。'), step('宿主执行', 'packages/codemode/src/runtime/host.ts', 'CodemodeSandbox', '建立 Worker，处理取消与工具回调。'), step('虚拟机', 'packages/codemode/src/runtime/vm.ts', 'StartVmOptions', '观察 Promise 驱动、工具桥接和确定性执行。'), step('返回契约', 'packages/codemode/src/types.ts', 'CodemodeResult', '成功、失败、输出、调用记录和 storeWrites 分开处理。')],
    extend: ['注入新的 tools / globals，并用 renderDeclarations 生成模型可读的声明。', '通过 portable 接入其他运行环境；Agent 集成需通过 runToolCall 保留工具钩子。'],
    mastery: ['依次实验正常返回、工具抛错、超时、取消和未等待 Promise。', '验证失败执行不提交 storeWrites，理解输出与持久状态的区别。', '用同一 seed 和结果序号重放，比较调用记录；读 fingerprint 的兼容约束。', '比较 Inline 阻塞调用线程和 Worker 隔离的实现，不把超时等同于宿主副作用回滚。']
  },
  'coding-agent': {
    intro: '用户直接使用的编码产品：CLI、交互界面、会话、工具、配置、扩展与 SDK 装配都在这里。它组合 agent、ai、tui、mcp 与 codemode，把底层能力接成可使用的工作流。',
    focus: ['CLI、SDK、RPC 是不同使用入口，共同围绕 AgentSession 装配。读源码前先明确要改产品界面还是执行逻辑。', '用户配置位于 agentDir，项目配置位于 .pi；项目加载受到 trust 约束，sessionDir 是文档注明的特殊处理项。', '扩展加载、工具注册、事件、资源重载与会话持久化分开负责。事件可改变处理流程，需要理解取消、异常与状态保存。'],
    usage: ['先按“本地开发说明”准备依赖、模型目录和 source-resolver，从 src/cli.ts 启动；用独立 agentDir 隔离开发设置。', 'SDK 用户从 examples/sdk 的最小例子开始，创建会话后订阅事件、发送 prompt，并释放资源。', '二次开发先用 -e 显式加载一个扩展；改变核心装配时再进入 sdk.ts 和 agent-session.ts。'],
    config: [['配置文件', 'settings.json 管理默认行为；keybindings.json 管理按键；mcp.json 管理服务；models.json 管理兼容端点与模型；auth.json 保存凭据。完整 schemas 与文档在下方。'], ['CLI 与 SDK', 'cli/args.ts、CreateAgentSessionOptions、PromptOptions 和 AgentSessionConfig 分别是命令行、SDK 构建、单次输入和会话装配契约。'], ['覆盖与重载', '结合 configuration.md、settings.md、project-trust.ts 理解作用域；修改后用 /reload 刷新可重载资源。配置值解析器还处理环境变量和命令形式，不能把所有字符串当字面值。']],
    flow: [step('CLI 启动', 'packages/coding-agent/src/cli.ts', '', '找到实际启动入口，不用已删除的旧入口路径。'), step('模式选择与装配', 'packages/coding-agent/src/main.ts', '', '跟踪参数、设置、资源和运行模式。'), step('SDK 会话构建', 'packages/coding-agent/src/core/sdk.ts', 'createAgentSession', '查清模型、会话管理器与资源装载器由谁创建。'), step('输入与会话', 'packages/coding-agent/src/core/agent-session.ts', 'AgentSession', '从 prompt 跟进扩展事件、上下文、压缩和运行准备。'), step('扩展契约', 'packages/coding-agent/src/core/extensions/types.ts', 'ExtensionAPI', '修改工具和事件前先明确允许的输入、返回值和模式差异。')],
    extend: ['工具、命令、快捷键、事件、消息渲染、provider 与自定义 UI；具体注册接口以 ExtensionAPI 为准。', '通过 SDK 嵌入应用，或用 RPC 集成其他界面；现成扩展示例可作为实现起点。'],
    mastery: ['用一个输入画出 main → SDK → AgentSession → Agent 的装配与执行链。', '给会话构建、prompt 与工具执行下断点，对照一轮事件。', '用扩展实现小功能，再检查配置重载和会话恢复后行为是否一致。', '在 suite harness / faux provider 下复现问题；区分纯单元测试、网络测试和真实模型评测。']
  },
  durable: {
    intro: '实验性的持久智能体运行层：输入、模型轮次、工具调用和应用状态先提交到存储，再对外显示。进程退出后通过任务检查点继续工作。它的核心不是给内存 Agent 加一个保存按钮，而是提交与任务状态机。',
    focus: ['Harness 管理存储和调度；Conversation 是句柄；Entry 是不可变记录；Document 是事务中的 JSON 状态；Task 有持久检查点。', '取消 wait 只取消等待，不等于取消已持久接纳的工作。requestId 用于重复提交去重。', '工具意图先提交；崩溃中断后仅声明 replay: safe 的工具可自动重跑。外部副作用并不会因事务失败自动回滚。'],
    usage: ['从 MemoryStorage + Harness.open + root + submit + wait 入门，先理解一次输入如何变成提交和任务。', '需要恢复时换 SQLite / JSONL 后端；浏览器可用 IndexedDbStorage。重开同一存储后 resume；readOnly Harness 只供查看，拒绝恢复执行与写入。当前 SQLite schema v2 不能由 1.3.0 或更早版本打开；JSONL 旧版也不会恢复 sleeping 任务，升级前应记录提交并备份。', '依次阅读 test/examples 的编号示例：配置、工具、扩展、状态、恢复、子任务和 codemode。'],
    config: [['装配与会话设置', 'HarnessOptions、HarnessSettings、Settings、ConversationCreateOptions 管理 models、registry、会话模型、扩展选择与工作目录；持久设置与进程对象要区分。models/settings 可为动态函数，使用时读取；afterFailedRun 的 keep/continue/withdraw 控制失败后队列，compaction.modelOverrides 按模型覆写阈值；telemetry 显式传入父 span。'], ['工具与运行环境', 'defineTool 的参数和结构化输出 schema、replay、hooks、ExecutionEnv，以及模型图像限制分别决定校验、恢复与文件操作。'], ['存储和任务', 'NodeSqliteStorageOptions、JsonlStorageOptions、TaskOptions 与调度选项作用于不同层；事务、观察游标、压缩和恢复需一起理解。Storage.commit(writes, adopt, context) 持久化后同步调用 adopt(seq) 一次；watchDoc/watch/watchTaskGraph 统一使用 Chord Watch，旧状态 getter 已移除。sleepUntil 以 checkpoint 结束阶段，setTimer 在阶段内定时；wake/onWake 连接宿主唤醒。restartLimit 默认 5，retryTask 显式重试。']],
    flow: [step('打开运行层', 'packages/durable/src/harness/harness.ts', 'Harness', '连接存储、会话、registry 与调度器。'), step('接纳输入', 'packages/durable/src/harness/submissions.ts', '', '追踪 submission 的接纳、等待和完成状态。'), step('生成任务', 'packages/durable/src/harness/generation.ts', '', '构造上下文、请求模型并保存轮次。'), step('工具任务', 'packages/durable/src/harness/tool.ts', '', '观察工具意图、执行、结果与中断恢复。'), step('事务提交', 'packages/durable/src/session/transaction.ts', '', '核对文档、记录和任务如何原子变更。'), step('睡眠与重启保护', 'packages/durable/src/harness/scheduler.ts', 'sleepUntil:', '比较 sleeping 的到期恢复和无进展重启的停放；沿 retryTask 返回执行路径。'), step('存储失败边界', 'packages/durable/src/session/session.ts', 'async #call', '区分读取请求错误与 commit/mintId 失败，观察何时终止会话。'), step('运行遥测', 'packages/durable/src/harness/telemetry.ts', 'DURABLE_TELEMETRY_SCHEMA', '对照任务、模型和提交 span；业务结果仍由事务确定。')],
    extend: ['defineExtension 组合 tools、sections、hooks、wraps 与 tasks；registry 进程内安装代码，会话保存名称。', '实现 Storage 或 ExecutionEnv 适配器并运行对应 conformance；用 Documents、子任务与任务图构建自己的工作流。'],
    mastery: ['用一次带工具的输入标记每个持久提交点和对外可见点。', '分别在模型请求中与工具执行中模拟退出，解释重新打开后的行为。', '比较 replay safe 与默认工具中断策略；模拟五次无新提交的崩溃，观察 restart_limit 与 retryTask，再验证 sleeping 不占 invocation。', '阅读 codemode 与 task graph 示例，再追踪调度器如何恢复嵌套任务。']
  },
  env: {
    intro: '将 Durable 的文件与命令操作送到远端机器。TypeScript 端管理 Connection 和 RemoteExecutionEnv；Rust daemon 处理帧协议与实际操作，模型凭据和存储仍可留在本地。',
    focus: ['远程协议是本包的帧协议，不是 MCP。Connection 管理请求编号、进度、取消和 daemon 会话。', 'SSH 使用独立 known-hosts 文件及严格主机校验；扫描指纹和接受主机是分开的操作。', '远端文件句柄与 daemon 会话绑定；重连后不能把旧句柄当成新会话的句柄。pi-env daemon 当前不支持 Windows PTY；旧工作台 ConPTY 后端不在当前 checkout。'],
    usage: ['先读 docs/protocol.md 和 docs/semantics.md，理解 RemoteExecutionEnv 与 NodeExecutionEnv 的语义对齐。', '由使用者核对主机指纹后 acceptHostKey；connectSsh 或 lazy sshConnection 准备 daemon，再构造 RemoteExecutionEnv。', '终端用 openTerminal 独立管理输入、输出、窗口大小与结束；普通执行与 PTY 不要混用。'],
    config: [['连接', 'ConnectionOptions.command 指定 daemon 启动命令或计算它的函数；env 显式替换子进程环境，省略则继承；onLog 接收诊断；RequestOptions.signal / onEvent / session 管理单次请求。'], ['SSH 与环境', 'SshConnectOptions、RemoteExecutionEnvOptions 指定主机、身份、knownHostsFile、环境 id 与 cwd；先查类型再按平台配置。'], ['终端与测试', 'TerminalOptions、RemoteWatchOptions 管理终端和文件观察；PI_ENV_DAEMON 指向测试 daemon，PI_ENV_SSH_HOST 会启用真实 SSH 测试。']],
    flow: [step('SSH 检测与部署', 'packages/env/src/ssh.ts', 'connectSsh', '核对信任、目标平台与 daemon 启动。'), step('连接与帧', 'packages/env/src/connection.ts', 'ConnectionOptions', '追踪 hello、request、result、event 和 cancel。'), step('环境适配', 'packages/env/src/remote-env.ts', 'RemoteExecutionEnv', '比较远程返回值和本地环境契约。'), step('交互终端', 'packages/env/src/terminal.ts', 'openTerminal', '处理输入、resize、退出和清理。')],
    extend: ['替换 Connection 的启动通道或将 RemoteExecutionEnv 接入自己的 Durable 配置。', '新增操作需同步 TS、Rust 协议和语义测试；用已有 env conformance 检查兼容性。'],
    mastery: ['先用本地 daemon 观察协议，再引入 SSH，把网络问题与操作语义分开。', '跟踪一次取消与一次断连，验证 pending 请求和会话句柄如何结束。', '对照 daemon 源码实现相同文件操作的跨平台差异。', '阅读 conformance 和随机操作测试，明确错误消息与返回语义的边界。']
  },
  evals: {
    intro: '私有工作区评测工具，用 vitest-evals 测量编码智能体行为，以及附带文档是否改善结果。它不是公开发布的普通运行时库，评测可能运行容器并调用真实模型。',
    focus: ['host eval 与 *.docs.eval.ts 的成对文档比较不同；后者保持相同代码包，只改变文档暴露。', '先确定全部 case、variant 和 repetition，再执行每个独立 arm。失败或缺失不能偷偷移出样本。', '缺失、重复或未评分的 arm 会阻止对应 pair；缺少 telemetry 不等于零用量，一次重复也不能证明稳定性。'],
    usage: ['先准备评测所需 Docker 与模型配置，阅读 README 的实际命令；本页面不运行评测。', '从已有 *.docs.eval.ts 复制场景结构，使用 describeEval 与一次明确的 run；评分低是数据，不必变成基础设施异常。', '读取 .eval 下 protocol、expected-runs、observations 和 report，先检查阻塞配对再看 lift。'],
    config: [['模型与重复次数', 'PI_PROVIDER / PI_MODEL 或 CLI --provider / --model 选择模型；--runs-per-variant 或 PI_EVAL_RUNS_PER_VARIANT 控制重复次数。'], ['运行层', 'PiCodingAgentHarnessOptions 与 cli.ts 的参数解析共同构成运行配置；private 包不作为公开 npm 产品发布；当前没有 /workbench 子路径。cli.ts 顶层会启动评测流程；只读计划和报告应从 plan.ts、report.ts 追踪。'], ['评分与隔离', 'Vitest 过滤影响发现集合；judgeThreshold: null 用于比较评分。容器、工具白名单和独立目录的约束见 README 与 docker.ts。']],
    flow: [step('解析入口', 'packages/evals/src/cli.ts', '', '读取模型、过滤和重复次数。'), step('展开计划', 'packages/evals/src/plan.ts', '', '生成完整的 case / variant / repetition 队列。'), step('隔离执行', 'packages/evals/src/docker.ts', '', '构建环境、发现集合、运行独立 arm。'), step('记录与评分适配', 'packages/evals/src/harness.ts', '', '衔接 Agent 与 vitest-evals。'), step('成对报告', 'packages/evals/src/report.ts', '', '校验完整性，再计算比较指标。')],
    extend: ['新增评测场景和确定性 judge；让 runner 继续负责隔离、重复与持久记录。', '扩展报告时同时保留 blocked、缺失遥测和波动信息，不只增加一个平均值。'],
    mastery: ['不用模型先读 plan/report 单元测试，手工构造缺失 arm 的预期。', '核对两组安装的是同一批源码 tarball，文档是受控变量。', '理解 case 标识与重复编号，跟踪一个 pair 从计划到报告。', '最后再做真实小样本评测，观察结果是否饱和或有波动。']
  },
  mcp: {
    intro: '独立 MCP 客户端库，核心处理 JSON-RPC 请求关联、初始化、超时与取消；stdio 和 Streamable HTTP 负责传输，OAuth 通过独立子路径提供。产品级 mcp.json 加载在 coding-agent 中。',
    focus: ['传输负责分帧与 I/O，McpClient 负责协议状态。连接成功前先完成初始化和能力协商。', '协议异常与工具返回 isError 不同；包装 AgentTool 时需保留工具错误，不能把失败结果当正常文本。', 'OAuth provider 不替应用打开浏览器，也不替应用决定凭据保存位置；使用者提供回调和状态存储。'],
    usage: ['构造 StdioTransport 或 StreamableHttpTransport，与 McpClient.connect 连接；列工具后调用，结束时 close。', '把 MCP schema 和内容转换成 AgentTool 时核对名称、parameters、signal、进度和 structuredContent。', '先用 testing 子路径的内存传输做适配测试，再连接真实服务。'],
    config: [['客户端与请求', 'McpClientOptions 包含 name/version、capabilities、protocolVersion、requestTimeoutMs、roots；每次请求可指定 signal、timeoutMs、onProgress。'], ['传输', 'StdioTransportOptions 管理 command / args 等进程选项；StreamableHttpTransportOptions 管理 url、headers、fetch、认证与重连。'], ['OAuth', 'McpOAuthProviderOptions、OAuthFlowOptions、OAuthCallbackServerOptions 管理发现、回调、授权与状态存储；持久凭据由应用提供。']],
    flow: [step('初始化与请求', 'packages/mcp/src/client.ts', 'McpClient', '跟踪请求 ID、pending 表、超时和通知。'), step('传输契约', 'packages/mcp/src/transports/transport.ts', '', '核对单个 JSON-RPC 消息如何跨边界。'), step('HTTP 生命周期', 'packages/mcp/src/transports/streamable-http.ts', 'StreamableHttpTransportOptions', '读会话、SSE、重连与取消。'), step('认证', 'packages/mcp/src/oauth/provider.ts', 'McpOAuthProvider', '将授权状态和普通请求流程分开追踪。')],
    extend: ['实现新的 McpTransport，或者注入 HTTP fetch / OAuth 状态存储。', '在应用层适配模型工具、资源和通知；不要把客户端库误作 MCP 服务端实现。'],
    mastery: ['用内存传输手写一次初始化和工具响应，观察 pending 请求清理。', '分别模拟协议错误、工具 isError、取消与断连。', '跟踪分页 tools/list 和 progress 对超时的影响。', '读 OAuth 并发刷新测试，理解多个 401 如何共享刷新。']
  },
  telemetry: {
    intro: '与供应商无关的遥测契约。通过显式 context 建立 span 树，提供 no-op、内存参考实现、类型化 schema 和适配器一致性测试；不内置 exporter 或全局当前 span。',
    focus: ['span 描述一次操作，不是业务状态。记录遥测不能决定业务是否执行或持久化。', 'startSpan 接收回调，回调结束时 span 收尾；没有手动 end。子工作显式接收父 span。', 'start 属性、结束属性与事件属性有不同的必填性；schema 推导帮助类型检查，适配器仍要遵守运行语义。'],
    usage: ['在可观察操作中传入 TelemetryContext，默认使用 NOOP_TELEMETRY_CONTEXT。', '用 InMemoryTelemetryContext 检查 span 树、属性和异常结果，再接入外部后端。', '定义领域 schema，绑定 typed starter，让事件名和属性在编译时受到约束。'],
    config: [['span 与属性', 'SpanOptions 定义 name 与起始 attributes；SpanStatus 表达 ok/error，事件与属性支持的值见 AttributeValue。'], ['schema', 'TelemetrySchemaDefinition、TelemetrySpanDefinition 与属性 metadata 描述父关系、必填、敏感性及基数。'], ['适配器验证', 'TelemetryAdapterFixtureFactory 提供新上下文和快照读取器；createTelemetryAdapterConformance 输出可由测试框架执行的用例。']],
    flow: [step('契约与类型', 'packages/telemetry/src/index.ts', 'TelemetryContext', '从 startSpan、事件、属性、状态读起。'), step('禁用路径', 'packages/telemetry/src/noop.ts', '', '确认不采集时业务回调仍然执行。'), step('参考实现', 'packages/telemetry/src/memory.ts', 'InMemoryTelemetryContext', '观察 span 建树、错误归一化和结束状态；内存参考实现不记录时间戳。'), step('一致性测试', 'packages/telemetry/src/testing/conformance.ts', 'createTelemetryAdapterConformance', '用同一组契约检查自定义适配器。')],
    extend: ['编写 OpenTelemetry、日志或其他后端适配器，保持显式 context 和回调语义。', '为自己的业务包添加独立 schema；不要让通用包承担某个产品的事件词汇。'],
    mastery: ['分别执行同步返回、Promise、抛错和正常返回错误对象的 span。', '理解自动错误状态和显式 setStatus 的关系。', '写适配器并通过 conformance，再接真实后端。', '检查属性敏感性与高基数字段设计，避免把完整消息当常规标签。']
  },
  tui: {
    intro: '终端 UI 框架，负责组件、输入、焦点、布局和差分渲染。主屏模式保留终端滚动历史，备用屏模式管理固定视口与应用滚动。它不负责模型或会话业务。',
    focus: ['共享 TUI 接口与具体 renderer 分开；不能把备用屏布局功能假设为主屏也支持。', '组件输出终端行，render 结果、光标、宽度和 ANSI 序列必须协调；字节长度不等于显示宽度。', '输入包含普通按键、转义序列、粘贴和鼠标事件；需要按键绑定层而不是散布硬编码键值。'],
    usage: ['从 ProcessTerminal + TuiMainScreen + Text / Editor 入门，设置焦点并 start，结束时 stop。', '需要应用滚动和分区布局时换 TuiAltScreen，结合 VStack / HStack / ScrollView。', '先用现有测试终端验证组件，再在真实终端检查宽度、输入法、粘贴、鼠标和图像能力。'],
    config: [['渲染与覆盖层', 'TuiAltScreenOptions、OverlayOptions、TuiStopOptions 管理视口、覆盖层尺寸/位置及停止行为。'], ['组件', 'EditorOptions、InputOptions、MarkdownOptions、ImageOptions、ScrollViewOptions 和 StackOptions 分别配置编辑、展示、滚动和布局。'], ['输入与终端', 'KeybindingsConfig、StdinBufferOptions、ImageRenderOptions 与颜色模式需要结合终端能力选择；默认快捷键经统一配置入口修改。']],
    flow: [step('接口与组件', 'packages/tui/src/tui.ts', '', '从组件 render、焦点与 TUI 契约建立地图。'), step('主屏渲染', 'packages/tui/src/tui-main-screen.ts', '', '跟踪 requestRender 到差分输出。'), step('备用屏', 'packages/tui/src/tui-alt-screen.ts', '', '读视口布局、滚动和退出时恢复。'), step('终端 I/O', 'packages/tui/src/terminal.ts', 'ProcessTerminal', '理解原始输入、输出与终端生命周期。'), step('编辑组件', 'packages/tui/src/components/editor.ts', 'Editor', '追踪按键到编辑状态再到重绘。')],
    extend: ['实现自己的 Component、主题接口、自动补全和覆盖层；复用已有容器与布局组件。', '扩展终端适配器或图像支持时同时验证宽字符、清理和不同 renderer 的能力边界。'],
    mastery: ['写一个带输入与状态行的小界面，解释每一次 requestRender 的来源。', '用测试检查连续重绘只更新变化区域，再测试窗口缩放。', '跟踪多行粘贴、宽字符、ANSI 和鼠标焦点，避免只测英文单行。', '比较主屏/备用屏的滚动所有权，最后进入原生模块与性能分析。']
  }
};

export function historicalLesson(id, hasDocs) {
  return {
    intro: hasDocs ? `${id} 的当前目录没有工作区 package.json 和 src，保留下来的中文文档用于回溯旧设计，不能直接作为当前版本的安装或运行教程。` : `${id} 没有当前已跟踪的源码与包清单。本地目录或缓存不构成可运行子包；待源码重新加入后再补充教程。`,
    focus: ['目录存在与当前包存在是两件事；不使用被忽略的 dist 或 node_modules 推断当前接口。', '历史接口应先核对提交版本。当前持久化后端请查看 durable，当前对象与连接模型请查看 chord；两者不保证与旧包一一对应。'],
    usage: ['先阅读本页的状态及历史原文；如需复原旧环境，应在选定历史版本中单独核对依赖、入口和测试。'],
    config: [], flow: [], extend: ['没有当前源码依据，暂不提供可运行扩展接口或参数默认值。'],
    mastery: ['通过 Git 时间线定位相关包的移除与迁移提交。', '先学当前 chord / durable 的概念，再对照历史设计；不要复制旧接口到当前入口。']
  };
}
