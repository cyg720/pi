// Chinese explanations grounded in current repository docs and named implementation files.
// Seventh field adds primary evidence documents to the module's overview document.
export const additionalFeatures = {
  coding: [
    ['builtin', '内置扩展装配与替换', ['extensions/index.ts','core/extensions/loader.ts','core/resource-loader.ts'], 'CLI 把 llama.cpp、codemode、tool-search、MCP 作为内置扩展装配；同名用户扩展可替换可替换项。', 'builtInExtensions；pi config；builtin: 资源设置', 'SDK 默认不加载内置扩展；宿主需要显式加入对应工厂。', ['packages/coding-agent/docs/sdk.md','packages/coding-agent/docs/mcp.md']],
    ['mcp-config', 'MCP 分层配置与服务器注册', ['core/mcp-servers.ts','extensions/mcp/config.ts','extensions/mcp/index.ts'], '合并用户 mcp.json、已信任项目配置与扩展注册，验证服务器及单工具暴露设置。', 'pi.registerMcpServer；~/.pi/agent/mcp.json；.pi/mcp.json', '同名文件配置优先于扩展；项目仅覆盖开关或暴露时保留用户端连接配置。项目来源受信任控制。', ['packages/coding-agent/docs/mcp.md']],
    ['mcp-runtime', 'MCP 后台连接、等待与重连', ['extensions/mcp/runtime.ts','extensions/mcp/runtime.lazy.ts'], '会话启动时后台连接服务器，按需等待、更新工具目录，并在断连后下一次调用重连。', 'session_start；MCP 工具调用；/reload', '首个 prompt 只为 direct 服务器等待；调用工具不会因临时错误盲目重试，资源读取可重试。', ['packages/coding-agent/docs/mcp.md']],
    ['mcp-tools', 'MCP 工具命名、暴露与结果适配', ['extensions/mcp/tools.ts','core/mcp-servers.ts'], '把服务器工具接入 Pi 工具管线，规范化名称，传递 structuredContent、isError 和安全提示。', 'direct / codemode / deferred / hidden；toolExposure', '规范化后的重名工具带 hash 后缀；模型端大文本截断并保留完整临时文件，脚本可收到完整结果。', ['packages/coding-agent/docs/mcp.md']],
    ['mcp-resources', 'MCP 资源、URI 模板与二进制读取', ['extensions/mcp/resources.ts'], '注册资源列表、模板列表和读取工具，统一输出文本、图像或二进制临时文件路径。', 'list_mcp_resources；list_mcp_resource_templates；read_mcp_resource', '仅面向启用且非 hidden 的资源服务器；当前不渲染 MCP Apps 的 ui:// 与 HTML 资源。', ['packages/coding-agent/docs/mcp.md']],
    ['mcp-auth', 'MCP OAuth 登录与提供商凭据转接', ['extensions/mcp/oauth.ts','core/mcp-servers.ts'], '管理服务器 OAuth 凭据、回调与增量授权；HTTP 服务器也可采用已登录提供商的 token。', '/mcp login/logout；oauth；auth.provider', '凭据按服务器名和 URL 隔离；项目配置不可使用 auth.provider；配置元数据 URL 与 clientRegistration 影响授权流程。', ['packages/coding-agent/docs/mcp.md']],
    ['mcp-management', 'MCP 管理命令、UI 与日志', ['extensions/mcp/cli.ts','extensions/mcp/cli.lazy.ts','extensions/mcp/ui.ts','extensions/mcp/log.ts'], '添加、移除、检查、登录服务器，在交互会话中显示状态、工具与配置来源，并记录服务日志。', 'pi mcp add/remove/list/login/logout；/mcp', 'Shell 命令不加载扩展；已连接工具暴露和开关可按所属配置文件保存。', ['packages/coding-agent/docs/mcp.md','packages/coding-agent/docs/cli.md']],
    ['codemode', 'codemode：脚本编排与并行工具', ['extensions/codemode/index.ts','extensions/codemode/tool.ts','extensions/codemode/execute.ts','extensions/codemode/execute.lazy.ts','extensions/codemode/worker.ts'], '让模型用 JavaScript 编排工具、并行调用与过滤大结果，仅把脚本输出送回模型。', '--tools codemode；defaultTools；codemode.mode', 'on 保留直接工具，only 调整模型可见工具；QuickJS 没有文件、网络、Node 或 timer 能力，外部操作通过注入工具。', ['packages/coding-agent/docs/codemode.md']],
    ['codemode-store', 'codemode 跨调用状态与分支恢复', ['extensions/codemode/tool.ts','extensions/codemode/execute.ts'], '成功脚本把 store/load 修改保存为 codemode-store 条目，在继续、分叉和切换分支后恢复各自状态。', 'store(key,value)；load(key)；CODEMODE_STORE_ENTRY_TYPE', '失败脚本不提交 store 写入；工具已经造成的外部效果不会因此回滚，存储有值大小和总量限制。', ['packages/coding-agent/docs/codemode.md']],
    ['codemode-models', '脚本分类模型、图像模型与用量', ['extensions/codemode/execute.ts','core/model-registry.ts','core/model-runtime.ts'], '向脚本暴露分类与图像模型目录及执行接口，沿会话凭据调用，并汇总用量。', 'models.classify；models.generateImages；getAvailableOfType', '脚本不能执行对话模型；每脚本最多同时运行四个此类模型调用，需检查返回的 stopReason。', ['packages/coding-agent/docs/codemode.md','packages/coding-agent/docs/models.md']],
    ['output-files', '脚本图像落盘与完整输出文件', ['utils/output-files.ts','extensions/codemode/execute.ts','utils/tool-result-images.ts'], '保存 image() 的图像和被截断的完整文本，让后续工具能用真实文件路径处理结果。', 'image(block)；fullOutputPath', '图像只接受支持格式的 base64 数据，不把远程 URL 当作图像数据；临时文件生命周期由输出文件实现管理。', ['packages/coding-agent/docs/codemode.md']],
    ['tool-search', 'tool_search：BM25 搜索与延迟工具加载', ['extensions/tool-search/index.ts','extensions/tool-search/tool.ts'], '按名称、描述、参数与命名空间检索未声明工具，激活匹配项供下一次模型请求直接调用。', 'tool_search；Bm25Ranker；searchTools', 'tool_search 改变工具集合并写入会话；脚本 searchTools 只查找可调用工具，两者职责不同。', ['packages/coding-agent/docs/codemode.md','packages/coding-agent/docs/mcp.md']],
    ['loadout', '工具暴露、命名空间与请求 Loadout', ['core/extensions/types.ts','core/extensions/runner.ts','core/agent-session.ts','extensions/codemode/tool.ts'], '把工具注册、激活、模型声明和脚本可调用性分开管理，扩展可为每次请求准备工具集。', 'ToolExposure；prepareLoadout；getAllTools；namespace', '模型声明不代表所有注册工具；annotations、outputSchema 与 structuredContent 承载额外契约。', ['packages/coding-agent/docs/extensions.md']],
    ['nested-tools', '嵌套工具管线、父子事件与用量记录', ['core/nested-tool-calls.ts','core/agent-session.ts','core/extensions/types.ts'], 'ctx.executeTool 将脚本发起的子调用交给同一校验、拦截和结果管线，汇总到父工具。', 'ctx.executeTool；parentToolCallId；nestedCalls', '子调用收到取消信号，串行策略由队列处理；嵌套结果不逐条进入模型上下文，记录有界。', ['packages/coding-agent/docs/extensions.md','packages/coding-agent/docs/codemode.md']],
    ['fullscreen', '全屏终端、普通模式与启动显示', ['modes/interactive/interactive-mode.ts','modes/interactive/tui-renderer.ts','cli/startup-ui.ts','core/settings-manager.ts'], '默认全屏呈现聊天，提供 regular 模式保留终端滚动历史，支持安静启动时只显示 header。', '--tui-mode；tuiMode；quietStartup: header', 'fullscreen/regular 是终端呈现选择，不改变底层 Agent 消息循环。', ['packages/coding-agent/docs/settings.md']],
    ['system-theme', '系统主题与终端调色板', ['modes/interactive/theme/'], '默认从终端调色板派生颜色，并支持独立主题切换与重载。', 'system 主题；/settings；主题资源', '主题改变显示颜色；终端能力和调色板读取决定最终效果。', ['packages/coding-agent/docs/themes.md']],
    ['radius-login', 'Radius 登录与 MCP 一步配置', ['modes/interactive/components/radius-login-selector.ts','core/radius.ts','extensions/mcp/oauth.ts'], '在登录菜单中提供 Radius 认证，并在完成登录后引导配置其 MCP 服务。', '/login → Sign in with Radius', '模型凭据与 MCP 连接属于不同对象，服务采用提供商认证配置复用 token。', ['packages/coding-agent/docs/providers.md']],
    ['catalog-refresh', '模型目录刷新与搜索界面', ['modes/interactive/model-catalog-refresh.ts','modes/interactive/model-search.ts','core/remote-catalog-provider.ts'], '读取更新目录并在模型选择界面中查找可用模型，维护本地目录与提供商声明的组合。', '/model；模型目录刷新', '目录记录不保证认证有效；查找与刷新和实际发出模型请求分开。', ['packages/coding-agent/docs/models.md']],
    ['experimental-cli', '实验服务命令与客户端入口', ['cli/experimental/','core/experimental.ts','client/'], '解析实验 client/server 子命令并转到服务化应用入口。', '实验服务 CLI', '独立于默认 Pi 交互模式与 JSONL RPC；当前实验目录还包含 Durable 和 Vacation 应用。', ['packages/coding-agent/src/experimental/services/README.md']]
  ],
  mcp: [
    ['client', 'MCP 握手、请求关联与取消', ['client.ts','protocol/jsonrpc.ts','protocol/types.ts'], '提供传输中立客户端，管理 initialize、请求 ID、取消、超时与通知。', 'McpClient.connect；listTools；callTool；close', '传输负责 I/O，客户端负责协议；不是 MCP 服务端，当前不支持 batch、sampling 与 tasks。'],
    ['stdio', 'stdio 进程传输与进程组关闭', ['transports/stdio.ts','transports/transport.ts'], '启动本地 MCP 子进程，用标准输入输出交换 JSON-RPC 消息，捕获 stderr 并关闭整组进程。', 'StdioTransport', '停止时先关 stdin，再使用终止与强制终止步骤；command 与 args 分开，不按 shell 字符串执行。'],
    ['http', 'Streamable HTTP、SSE 流与断点续接', ['transports/streamable-http.ts'], '通过 HTTP POST 和服务端流传输消息，管理 session、重连和 Last-Event-ID 续接。', 'StreamableHttpTransport；注入 fetch', '使用 Streamable HTTP 协议中的事件流，不等于旧 HTTP+SSE 传输；调用是否重放要按协议/应用边界判断。'],
    ['oauth-discovery', 'OAuth 资源与授权服务器发现', ['oauth/discovery.ts','oauth/types.ts'], '读取受保护资源元数据和授权服务器元数据，为授权选择真实端点。', 'OAuth discovery；authServerMetadataUrl', '这是 MCP OAuth 子路径的能力；配置和 issuer 校验需对照实际返回数据。'],
    ['oauth-flow', 'OAuth PKCE、注册、刷新与升级授权', ['oauth/flow.ts','oauth/provider.ts','oauth/errors.ts','auth-provider.ts'], '实现授权码 PKCE、动态注册或 CIMD、共享刷新和 insufficient_scope 的升级授权。', 'authorizeMcp；McpOAuthProvider；adaptOAuthProvider', '凭据持久化由注入 StateStore 完成；库不自行打开浏览器或选择保存目录。'],
    ['oauth-callback', 'OAuth 回环回调与状态校验', ['oauth/callback.ts'], '监听本机回调并等待授权结果，核对 state 和预期 issuer。', 'OAuthCallbackServer.listen；waitForCallback', '回调 URI、端口与 CIMD 路径受配置约束，授权响应不能只取 code 而跳过校验。'],
    ['content', 'MCP 内容转为模型消息', ['protocol/content.ts'], '把工具结果中的文本、图像和嵌入资源转为 LLM 内容，纯 structuredContent 转成 JSON。', 'toLlmContent', '音频、资源链接与其他二进制返回短占位；Pi 产品层资源工具还有独立临时文件处理。'],
    ['testing', '内存传输与协议测试支撑', ['transports/in-memory.ts','testing/index.ts'], '在进程内成对交换 MCP 消息，为客户端与适配器验证提供无需网络的传输。', 'createInMemoryTransportPair', '用于测试与宿主适配，不是生产外部服务器。']
  ],
  codemode: [
    ['source', '脚本格式、选项行与语法契约', ['source.ts'], '解析原始脚本和首行 @options，保留行号，并提供支持语法约束模型的 Lark grammar。', 'parseCodemodeSource；CODEMODE_SOURCE_GRAMMAR', '解析器不自行执行 timeout/output 选项；宿主决定策略。'],
    ['declarations', '工具 TypeScript 声明与标识符映射', ['declarations.ts','identifier.ts'], '从 JSON Schema 生成模型可读工具声明，规范化工具与命名空间标识符。', 'renderDeclarations；toCodemodeIdentifier', '声明不是运行时参数校验；递归或远程 schema 引用降为 unknown。'],
    ['host', '沙箱宿主、工具桥接与截止时间', ['index.ts','runtime/host.ts','runtime/protocol.ts','types.ts'], '每次 execute 创建 Worker 和独立 VM，向宿主转发工具消息并管理取消、超时与关闭。', 'CodemodeSandbox.execute；close', '脚本错误以结果返回；未等待工具在结束时取消，外部操作副作用不自动回滚。'],
    ['worker', 'QuickJS Worker 与能力隔离', ['runtime/worker.ts','runtime/prelude-source.ts'], '在 WebAssembly 的 QuickJS 实例内执行 async 函数体，注册工具与输出、存储 globals。', 'worker 入口；prelude', '脚本没有 Node、fetch、模块或 timer；宿主注入函数是外部能力边界。'],
    ['store', 'JSON Store 复制与容量限制', ['runtime/prelude-source.ts','types.ts'], '为脚本提供同步 store/load 与 JSON 值副本，成功结果报告 set/delete 写入。', 'store；load；result.storeWrites', '库不持久化 store；宿主负责保存，失败执行不提交 storeWrites。'],
    ['output', '文本图像输出、调用状态与错误分类', ['runtime/host.ts','runtime/prelude-source.ts','types.ts'], '收集 text、image、console、return，记录工具完成/错误/取消及脚本失败原因。', 'result.output；result.calls；result.error.kind', '仅支持 base64 图像，存在总输出大小和条数限制；图像落盘由 coding-agent 产品层实现。'],
    ['wasm', 'WASM 编译缓存与打包宿主接入', ['wasm.ts','index.ts'], '加载缓存 QuickJS wasm，允许打包宿主显式传入 wasm 与 Worker 位置。', 'loadQuickJSWasm；wasm；workerUrl', '包资源路径不一定存在于单文件可执行程序，打包宿主需提供相应入口。']
  ],
  durable: [
    ['registry', '扩展注册、工具覆写与在线替换', ['harness/registry.ts','harness/define.ts'], '把工具、提示区块、hook、wrapper 与任务定义组成命名扩展，支持同名替换。', 'createRegistry；defineExtension；defineTool；wrapTool', '运行中的阶段保留已解析代码，新阶段使用新注册表；会话保存名字而不是代码对象。'],
    ['agent-config', '逐会话模型、工具和工作目录配置', ['harness/agent.ts','harness/types.ts'], '在 pi.agent 文档保存会话级 agent 选择，继承或修改宿主默认配置。', 'Conversation.configure；agent；extensions/tools 选择', '请求准备时固定模型和提示；当前 cwd 与扩展在后续工具阶段可重新解析。'],
    ['prompt', '提示区块、上下文投影与位置化系统条目', ['harness/prompt.ts','harness/json.ts'], '按已选扩展组织 system sections、会话说明、上下文重置与压缩投影。', 'section；Conversation.reset；pi.system', '提示或工具变化被记录成系统条目；只发变化可保留提供商缓存，历史不会被 reset 物理删除。'],
    ['generation', '持久模型生成、重试与续轮', ['harness/generation.ts','harness/provider.ts'], '将请求意图、流式 partial、模型回答和下一轮工具计划作为任务阶段提交。', 'GenerationTask；pi.generation；pi.provider', '模型调用与可观察状态以提交为边界，重启恢复工作；provider session identity 持久保存。'],
    ['tool-tasks', '工具任务、重放安全与结果控制', ['harness/tool.ts','harness/output.ts'], '在执行之前提交工具意图，持久化输出，并运行前后 hook、用量与 terminate/handoff。', 'ToolTask；replay: safe；api.output', '重启只重跑显式安全任务；其他中断调用形成 interrupted 结果，避免重复外部副作用。'],
    ['inbox', '持久输入队列、幂等提交与撤回', ['harness/inbox.ts','harness/submissions.ts'], '在忙碌会话中保存 steer、follow-up 和 write，提供可恢复的 Submission 等待/撤回。', 'submit；requestId；Submission.wait/abort', '同 requestId 重用原提交；取消等待只取消等待者，不自动终止底层工作。'],
    ['compaction', '后台压缩、溢出恢复与陈旧摘要处理', ['harness/compaction.ts','harness/generation.ts'], '把压缩做成独立任务，允许会话继续，按边界放置摘要并处理过时 cut。', 'Conversation.compact；CompactionTask；settings.compaction', '手动、后台和溢出压缩有不同触发；摘要费用计入用量，旧条目仍保留。'],
    ['views', '提交后结构视图、Watch 与背压', ['harness/view.ts','harness/live.ts','session/observation.ts'], '向 UI 提供会话条目、live、inbox、agent、usage 的 Chord 状态与逐提交 operations。', 'viewState；watch；watchDoc；documentState', '状态提交后才对外展示；慢监听超过有界积压后收到最新整份快照。'],
    ['events', '从提交派生 Agent 事件与晚加入快照', ['harness/events.ts'], '把持久提交转换为 message/tool/compaction 等事件，给已有事件式 UI 接口使用。', 'watchEvents；stream.snapshot', '事件由提交派生；超出积压上限用新快照恢复，不能当作无限历史重放流。'],
    ['task-graph', '任务所有权、子任务等待与实时任务图', ['harness/task-graph.ts','harness/scheduler.ts','tasks.ts'], '观察活跃任务状态及 owner/子会话关系，调度 allSettled 或 failFast 等待并收尾。', 'taskGraph；watchTaskGraph；waiting；completing', '后台任务构成取消与空闲边界；任务图显示活跃任务，不替代完整审计历史。'],
    ['subagents', '持久子会话、背景任务与取消传播', ['harness/harness.ts','harness/scheduler.ts','session/transaction.ts'], '工具在原子提交中创建 task-owned 子会话，由所有权传播终止；背景锚点让子会话独立继续。', 'createConversation ownership；abort；background: true', '安全重放需复用子会话和 requestId；前台和后台的取消/空闲行为不同。'],
    ['usage', '按模型、工具与会话累计用量', ['harness/usage.ts'], '把生成、压缩、嵌套工具的 token 和费用写入 pi.usage，支持会话和整个 Harness 汇总。', 'Harness.usage；pi.usage', '失败或取消但已有用量的尝试也计入；数值依赖提供商实际报告。'],
    ['coding-tools', 'Durable 编码工具与环境隔离', ['tools/'], '提供 read/write/edit/bash 与 CodingTools 扩展，通过逐调用的 ExecutionEnv 访问文件与进程。', 'CodingTools；createReadTool；createBashTool', '当前 README 声明 read 不支持图像；文件修改按 env.id 与路径串行，避免并发覆盖。'],
    ['watch', '文件监视、字节解码与大文件扫描', ['env/node-watch.ts','env/decode.ts','env/line-scan.ts','env/node.ts'], '为执行环境提供可靠监视、分块解码、行扫描、目录分页与字节范围读取。', 'NodeExecutionEnv；openBinaryReader；openDirReader', 'Windows 监视采用轮询以避免目录句柄阻止重命名；实际平台分支以实现为准。']
  ],
  ai: [
    ['chatgpt-login', 'OpenAI ChatGPT 登录与 OAuth 回调', ['auth/oauth/openai-chatgpt.ts','auth/oauth/callback-server.ts','providers/openai.ts'], '让 OpenAI 提供商使用 ChatGPT 登录凭据，并支持浏览器回调处理。', '/login openai；OpenAI OAuth 子路径', '认证方法选择与模型服务不同；deviceId 和凭据由产品层配置存储。'],
    ['classifiers', '类型化分类问题、评分与选择', ['classifier.ts','classifiers.ts','classifier-models.ts','classifiers-api-registry.ts','api/typesafe-system-one.ts','api/constrained-sampling.ts','api/system-one-shared.ts'], '对 JSON state 提 choice/score/bool 问题，返回答案、概率或评分，而非聊天文本。', 'Models.classify；ClassifierContext', '具体可选 ID、支持协议与认证由模型目录和提供商决定。'],
    ['strict-tools', 'Anthropic 严格工具 Schema 适配', ['api/anthropic-messages.ts'], '转换统一消息与工具定义，区分支持 strict 的参数 schema，并处理提供商流式结果。', 'Anthropic Messages adapter', 'strict 能力取决于 schema 关键词及提供商契约；工具参数最终仍经执行层校验。'],
    ['federation', 'Anthropic 工作负载联合身份', ['auth/resolve.ts','auth/oauth/anthropic.ts','providers/anthropic.ts'], '从提供商支持的环境配置解析身份认证，可使用 API key、OAuth 或联合身份路径。', 'ANTHROPIC_FEDERATION_RULE_ID / ORGANIZATION_ID / IDENTITY_TOKEN_FILE', '是否可用由所选提供商声明与实际凭据决定；文档快照不读取用户认证文件。'],
    ['oauth-remote', '远端浏览器与复制代码登录', ['auth/oauth/anthropic.ts','auth/oauth/callback-server.ts','auth/oauth/openrouter.ts'], '在浏览器不运行于 Pi 所在机器时处理复制代码/回调的授权流程。', 'Anthropic copy code；OAuth callback', '这是认证交互路径，不改变模型消息与工具契约。']
  ],
  tui: [
    ['search', '全屏搜索与匹配导航', ['alt-screen-search.ts','tui-alt-screen.ts'], '在全屏终端维护匹配与搜索高亮，支持定位当前渲染内容。', '替代屏搜索交互', '检索的是终端呈现内容，源码、MCP 工具与会话存储检索属于其他功能。'],
    ['layout', '布局节点、测量与滚动几何', ['layout.ts','layout-node.ts','components/scroll-view.ts'], '按可用列宽和行数测量布局，安排组件及滚动范围。', 'Layout / LayoutNode / ScrollView', '终端列宽与文本字符数不同，测量结果服务于屏幕渲染。'],
    ['wheel', '滚轮累计与平台修饰键', ['wheel-scroll.ts','mouse.ts','native-modifiers.ts'], '处理高精度滚轮和平台修饰状态，避免小滚轮增量丢失或重复。', '鼠标滚轮；终端输入', '终端协议与平台报告会影响可用事件。'],
    ['editing-history', '撤销、Kill Ring 与词边界导航', ['undo-stack.ts','kill-ring.ts','word-navigation.ts'], '保存编辑撤销栈、剪切文本环与单词移动边界，供编辑组件复用。', 'Editor；配置的编辑动作', '编辑历史属于输入状态，不等同于 Agent 会话树。']
  ],
  experimental: [
    ['durable-app', 'Durable 编码应用与持久 TUI', ['durable/'], '一个进程组合模型运行时、SQLite Harness 和 TUI，提交后渲染所有状态并支持前台子智能体。', 'experimental/durable/main.ts；--continue；/agents；/tasks', '这是独立实验入口；恢复由 Harness 完成，界面只呈现 viewState，不具有完整默认 CLI 命令集。', ['packages/coding-agent/src/experimental/durable/README.md']],
    ['vacation-app', 'Vacation 背景研究与恢复示例', ['vacation/'], '展示旅行规划应用的背景子会话、持久并行工具、重启恢复和报告回传。', 'experimental/vacation/main.ts；research/search', '搜索结果是示例预设数据；使用请求 ID 避免重启时重复请求与报告，不是已接入真实旅行服务。', ['packages/coding-agent/src/experimental/vacation/README.md']],
    ['session-catalog', '实验会话目录与发现', ['session-catalog.ts','durable/sessions.ts','vacation/sessions.ts'], '按工作目录组织实验存储、发现可继续会话，并为单进程所有权提供锁。', '--continue；实验 session 目录', '目录锁与存储单写入者配合，区别于主 CLI SessionManager。']
  ],
  engineering: [
    ['model-hydration', '离线模型数据检查与目录水合', ['hydrate-model-catalog.ts','check-model-data.ts','model-data.ts','generate-models.ts','scripts/hydrate-model-catalog.ts'], '同步固定模型目录数据与生成器所需输入，验证 checkout 中的数据可供离线构建。', 'hydrate:model-data；check:model-data；build:offline', '导览生成本身只读本地目录，不执行这些可能联网的维护命令。'],
    ['install-lock', '安装锁生成与生命周期脚本审查', ['generate-coding-agent-install-lock.mjs'], '生成并核验独立安装时使用的固定依赖图与批准的生命周期脚本清单。', 'install-lock:coding-agent；check:install-lock:coding-agent', '当前使用 install-lock；旧发布 npm-shrinkwrap 已移除，常规 npm 使用其自身依赖解析。']
  ]
};
