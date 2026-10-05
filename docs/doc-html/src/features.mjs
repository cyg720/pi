// 中文能力地图。paths 是相对于模块 root 的精确文件或目录前缀。
// 索引器额外列出全部扫描文件，未解释的实现不会伪装成人工说明。
export const featureModules = [
  ['coding', '编码智能体 · 产品能力', 'packages/coding-agent/src/', '从输入、配置和工具，到会话管理与终端工作流。', '产品能力', 'packages/coding-agent/docs/cli.md'],
  ['agent', 'Agent · 执行与 Harness', 'packages/agent/src/', '低层模型/工具循环，以及会话、分支和持久执行接口。', '运行时机制', 'packages/agent/README.md'],
  ['ai', 'AI · 模型与提供商', 'packages/ai/src/', '统一消息、流式请求、认证、模型目录与协议适配。', '库能力', 'packages/ai/README.md'],
  ['tui', 'TUI · 终端界面', 'packages/tui/src/', '渲染、布局、编辑、补全、键鼠输入和终端能力。', '库能力', 'packages/tui/README.md'],
  ['chord', 'Chord · 服务与插件组合', 'packages/chord/src/', 'Facet 组合、服务绑定、复制状态与不可变 delta。', '库能力', 'packages/chord/README.md'],
  ['durable', 'Durable · 持久任务与文档', 'packages/durable/src/', '会话事务、任务阶段、文档与存储实现。', '库能力', 'packages/durable/README.md'],
  ['client', 'Client · 远程客户端', 'packages/client/src/', '实验性服务协议的连接、请求与订阅客户端。', '实验性', 'packages/client/README.md'],
  ['server', 'Server · 会话服务端', 'packages/server/src/', '实验性连接、会话路由与 attachment 生命周期。', '实验性', 'packages/server/README.md'],
  ['protocol', 'Protocol · 通信协议', 'packages/protocol/src/', '消息信封、CBOR 编码和字节流分帧。', '实验性', 'packages/protocol/README.md'],
  ['sqlite', 'SQLite · Agent 会话后端', 'packages/session-backends/sqlite-node/src/', '为 Agent Session 提供 Node SQLite 持久化。', '库能力', 'packages/session-backends/sqlite-node/README.md'],
  ['telemetry', 'Telemetry · 遥测契约', 'packages/telemetry/src/', '显式上下文、span、类型化事件和参考实现。', '库能力', 'packages/telemetry/README.md'],
  ['evals', 'Evals · 行为评测', 'packages/evals/src/', '隔离评测、实验分组、重复运行和结果配对。', '开发工具', 'packages/evals/README.md'],
  ['experimental', '实验应用 · 服务化探索', 'packages/coding-agent/src/experimental/', '独立服务、worker、应用插件与 mini/micro 示例入口。', '实验性', 'packages/coding-agent/src/experimental/services/README.md'],
  ['examples', '示例 · 扩展与 SDK', 'packages/coding-agent/examples/', '可阅读、可改写的扩展、SDK 和插件示例；不等于默认启用。', '示例', 'packages/coding-agent/examples/extensions/README.md'],
  ['native', '原生集成 · 平台能力', 'packages/tui/native/', 'Windows、macOS、Linux 原生剪贴板与平台适配。', '平台支撑', 'packages/tui/README.md'],
  ['engineering', '工程 · 构建与维护', 'scripts/', '依赖校验、构建发布、模型目录生成和开发统计。', '开发工具', 'AGENTS.md']
].map(([id, title, root, description, status, doc]) => ({ id, title, root, description, status, doc }));

// id、中文名、来源文件/目录、作用、入口/场景、处理与边界。
export const featureSpecs = {
  coding: [
    ['startup', 'CLI 启动与模式分派', ['cli.ts','main.ts','cli/setup.ts','cli/args.ts','bun/'], '解析命令行并创建与当前目录绑定的会话，选择交互、print、JSON 或 RPC。', 'pi；--print；--mode json|rpc', '启动装配设置、资源与模型运行时；实际模型循环由 Agent 执行。'],
    ['input', '文件附件、图片与管道输入', ['cli/file-processor.ts','cli/initial-message.ts','utils/image-resize.ts','utils/image-convert.ts','utils/mime.ts'], '将 @文件、图片和标准输入转成首条用户消息的内容。', '@path；管道输入；粘贴图片', '读取与规范化输入后组装消息；RPC 不接受 CLI 的 @file 参数。'],
    ['sdk', 'SDK 创建与替换运行时', ['core/sdk.ts','core/agent-session-services.ts','core/agent-session-runtime.ts'], '让应用在进程内创建、继续或替换编码智能体会话。', 'createAgentSession / createAgentSessionRuntime', 'SDK 注入流函数、配置、工具与存储；运行时负责会话替换和重新绑定。'],
    ['interactive', '交互聊天与终端工作流', ['modes/interactive/interactive-mode.ts','modes/interactive/chat-controller.ts','modes/interactive/chat-viewport.ts'], '接收用户交互并呈现模型消息、工具输出与运行状态。', 'pi（终端输入输出）', 'UI 订阅会话事件；不把 UI 控制逻辑等同于模型执行循环。'],
    ['print', '一次性文本与 JSON 事件输出', ['modes/print-mode.ts','modes/json-event.ts','core/output-guard.ts'], '适配脚本与管道：输出最终文本，或逐条输出 JSONL 事件。', '--print；--mode json', '提交输入，等待会话处理并清理；标准输出背压与协议输出单独处理。'],
    ['rpc', 'CLI RPC 与扩展 UI 代理', ['modes/rpc/'], '让外部程序通过标准输入输出控制会话，并处理支持的扩展交互。', '--mode rpc；RpcClient', 'JSONL 命令/响应协议，与 packages/protocol 的 CBOR 服务协议分开。'],
    ['prompt', '输入处理、排队与任务收尾', ['core/agent-session.ts','core/messages.ts'], '协调扩展命令、输入转换、steering/follow-up、重试与最终通知。', 'AgentSession.prompt / steer / followUp', 'agent_end 后仍可能继续；agent_settled 是完成自动处理后的通知边界。'],
    ['sessions', '会话保存、恢复与命名', ['core/session-manager.ts','core/session-cwd.ts','cli/session-picker.ts'], '保存树形会话记录，并按项目、路径或 ID 恢复。', '--continue；--resume；--session；--name', '当前分支重建下一次模型上下文，内存会话可关闭持久化。'],
    ['branch', '会话树、分叉与克隆', ['core/session-manager.ts','core/agent-session-runtime.ts','modes/interactive/components/tree-selector.ts'], '从历史位置继续，或复制历史创建独立会话。', '/tree；/fork；/clone', '区分同文件内的分支和新会话副本；分支敏感扩展状态需要重新恢复。'],
    ['compaction', '上下文压缩与分支摘要', ['core/compaction/'], '把长历史压缩为摘要，控制下一次请求的上下文规模。', '/compact；自动压缩', '摘要影响上下文投影，不直接等价于删除原始会话历史。'],
    ['export', '会话导入、导出与分享', ['core/session-export.ts','core/export-html/'], '将会话转为 JSONL 或可阅读 HTML，并支撑会话分享流程。', '/import；/export；/share；--export', '导出是格式转换，分享还涉及外部上传；资源与实现分别列在源码中。'],
    ['read', 'read：读取文本与图片', ['core/tools/read.ts'], '读取指定文件，把文本或支持的图像作为工具结果给模型。', '默认启用工具 read', '路径处理、输出限制与图片处理决定返回内容；可注入读取操作。'],
    ['write', 'write：创建或覆写文件', ['core/tools/write.ts'], '把模型给定内容写入目标文件。', '默认启用工具 write', '与 edit 的精确替换不同，write 可覆写内容；查看文件修改队列边界。'],
    ['edit', 'edit：精确替换与差异展示', ['core/tools/edit.ts','core/tools/edit-diff.ts'], '定位旧文本并应用新文本，生成差异信息供展示。', '默认启用工具 edit', '替换匹配失败需要返回可理解的错误；完整读改写需要避免并发冲突。'],
    ['bash', 'bash：Shell 执行与输出', ['core/tools/bash.ts','core/bash-executor.ts','utils/shell.ts'], '执行 shell 命令并将输出、退出状态和截断信息传回模型。', '默认启用工具 bash；用户 ! 命令', '信号、超时、子进程与输出捕获由执行层协作处理。'],
    ['powershell', 'powershell：Windows 命令执行', ['core/tools/powershell.ts'], '为 Windows 提供 PowerShell 工具定义与可注入的操作。', '--tools powershell', '不是所有平台的默认工具；平台、编码与进程行为以实现为准。'],
    ['grep', 'grep：内容检索', ['core/tools/grep.ts'], '搜索文件内容并返回匹配位置。', '--tools grep', '搜索范围与输出上限属于工具参数/实现；输出作为 toolResult 返回。'],
    ['find', 'find：文件路径搜索', ['core/tools/find.ts'], '通过路径模式查找文件。', '--tools find', '适合先定位路径，再调用 read；不同于 grep 的文件内容检索。'],
    ['ls', 'ls：目录枚举', ['core/tools/ls.ts'], '列出目录条目，帮助模型了解文件结构。', '--tools ls', '仅列目录不读取全部文件内容。'],
    ['tool-support', '工具选择、包装、截断与修改队列', ['core/tools/index.ts','core/tools/tool-definition-wrapper.ts','core/tools/file-mutation-queue.ts','core/tools/truncate.ts','core/tools/output-accumulator.ts','core/tools/path-utils.ts'], '把工具定义适配为执行对象，并统一路径、文件修改与输出限制。', '--tools；--exclude-tools；--no-tools；defaultTools', '白名单、禁用与扩展工具注册是不同阶段；修改队列包住完整读改写。'],
    ['extensions', '扩展发现、注册与事件分发', ['core/extensions/','core/event-bus.ts'], '加载 TS/JS 扩展，注册工具、命令、快捷键、提供商与事件。', '--extension；/reload；ExtensionAPI', '工厂负责注册，runner 提供上下文与分发；原始类型注释可在 API 清单中逐项阅读。'],
    ['skills', '技能发现与按需说明', ['core/skills.ts'], '发现技能元数据，把需要的完整说明提供给模型。', '--skill；/skill:name', '技能主要是说明和资源；可执行扩展是另一种机制。'],
    ['templates', '提示模板与参数展开', ['core/prompt-templates.ts'], '复用提示词文件并展开输入参数。', '--prompt-template；/模板名', '发生在模型请求组装之前；与系统提示配置分别管理。'],
    ['resources', '资源发现、来源与冲突诊断', ['core/resource-loader.ts','core/source-info.ts','core/pi-manifest.ts'], '统一发现扩展、技能、模板、主题与项目上下文文件。', 'DefaultResourceLoader.reload；资源路径设置', '记录来源并处理碰撞；项目资源需遵守信任加载顺序。'],
    ['settings', '分层设置与配置值解析', ['core/settings-manager.ts','core/settings-diagnostics.ts','core/resolve-config-value.ts','config.ts','cli/config-selector.ts'], '解析用户与项目设置，并提供跨安装形态的资源路径。', 'settings.json；环境变量；CLI 覆盖', '配置作用域和优先级以 settings/configuration 文档为准。'],
    ['trust', '项目资源信任决策', ['core/project-trust.ts','core/trust-manager.ts','cli/project-trust.ts'], '决定是否加载受信任控制的项目配置与可执行资源。', '/trust；--approve；--no-approve', '项目资源信任不是文件系统、网络或进程级通用沙箱。'],
    ['packages', 'Pi 包安装、移除与资源配置', ['core/package-manager.ts','cli/package-commands.ts','utils/self-update.ts'], '组织 npm、git 和本地资源包的安装、更新与发现。', 'pi install/remove/update/list/config', '区分 Pi 自身更新、扩展包更新与模型目录更新。'],
    ['models', '模型选择、目录与提供商组合', ['core/model-runtime.ts','core/model-registry.ts','core/model-resolver.ts','core/model-config.ts','core/models-store.ts','core/provider-composer.ts','core/remote-catalog-provider.ts','cli/list-models.ts'], '汇总可用模型、解析选择模式，并通过运行时派发请求。', '/model；--model；--models；models.json', '目录元数据不等同于可调用性；认证与具体提供商能力仍需满足。'],
    ['virtual', '虚拟模型与请求路由', ['core/virtual-models.ts'], '允许选择逻辑模型，并将每次请求路由到物理模型。', 'VirtualModelDefinition / ModelRoute', '虚拟模型不会直接到达提供商；路由状态可跟随会话分支保存。'],
    ['auth', '认证存储、检查与凭据解析', ['core/auth-storage.ts','core/runtime-credentials.ts','core/auth-guidance.ts','cli/auth-command.ts','cli/auth-check.ts','cli/credential-print.ts'], '存储/解析认证信息，并提供凭据有效性检查。', '/login；/logout；pi auth', '打印凭据的命令会写秘密到 stdout；此导览只索引实现，不读取用户凭据。'],
    ['cache', '提示缓存预热与用量统计', ['core/cache-warmer.ts','core/cache-stats.ts','core/usage-totals.ts'], '管理适用模型的空闲缓存预热并统计请求用量。', 'cacheWarming；会话统计', '缓存保留时间取决于模型声明；不能把预热当成所有提供商都有的保证。'],
    ['http', '网络代理、归因与连接管理', ['core/http-dispatcher.ts','core/provider-attribution.ts','core/radius.ts'], '集中处理请求的代理、连接超时与提供商归因等配置。', 'HTTP/提供商设置', '这些是请求基础设施，离线文档不会触发这些网络操作。'],
    ['system', '系统提示与上下文组装', ['core/system-prompt.ts','core/messages.ts'], '把工具、技能、项目说明与对话消息组织成请求内容。', '--system-prompt；--append-system-prompt', '扩展可变换上下文；模型投影与持久化消息并非完全相同。'],
    ['theme', '主题、颜色与代码高亮', ['modes/interactive/theme/'], '加载主题定义并为终端文本、Markdown 与代码提供样式。', '--theme；--use-theme；主题设置', '样式属于呈现层；主题资源有独立验证与重载机制。'],
    ['components', '选择器、消息与工具 UI 组件', ['modes/interactive/components/','core/tools/renderers/','core/tools/render-utils.ts'], '提供模型/会话/设置选择与不同消息、工具结果的呈现。', 'InteractiveMode；扩展自定义 UI', '组件清单按源码保留，可从符号和原始注释追踪每个组件。'],
    ['keys', '快捷键与斜杠命令', ['core/keybindings.ts','core/slash-commands.ts'], '集中定义可配置动作与内置命令清单。', '/hotkeys；keybindings.json；输入 /', '快捷键应复用命名配置；完整命令表在参考文档内。'],
    ['clipboard', '剪贴板与外部编辑器', ['utils/clipboard.ts','utils/clipboard-image.ts','utils/editor.ts'], '支持复制消息、接收剪贴板图片及外部编辑工作流。', '/copy；终端编辑器交互', '能力取决于操作系统与终端环境。'],
    ['llama', 'llama.cpp 路由器集成', ['extensions/llama/'], '发现并管理本地模型路由器中的模型。', '/llama；配置 llama.cpp router', '与兼容 API 的 models.json 配置路径区分。'],
    ['diagnostics', '诊断、错误记录与问题报告', ['core/bug-report.ts','core/bug-report-upload.ts','core/crash-log.ts','core/diagnostics.ts','core/timings.ts','core/telemetry.ts','modes/interactive/bug-report.ts'], '收集诊断信息、启动耗时与问题报告内容。', '/bug；诊断事件', '诊断数据可能含运行上下文；报告上传与本地记录分别处理。']
  ],
  agent: [
    ['loop','消息、工具与多轮循环',['agent.ts','agent-loop.ts','types.ts','stream-fn.ts'],'维护消息状态、工具批次、steering/follow-up 和取消。','Agent.prompt / continue / abort','流函数由调用者注入；低层循环与 coding-agent 的会话策略分开。'],
    ['harness','Harness 装配与资源管理',['harness/agent-harness.ts','harness/config.ts','harness/context.ts','harness/hooks.ts','harness/types.ts'],'把模型、工具、执行环境和会话资源组装成 Harness。','AgentHarness','契约定义依赖与 hook；不要与 CLI ExtensionAPI 混用。'],
    ['drive','持久执行驱动与恢复',['harness/runtime/'],'协调 lane、事件归约、检查点、生成、工具和重试恢复。','Harness runtime / drive','目录中不同驱动阶段分别处理响应、恢复与边界；索引展示其实现与引用。'],
    ['execution','模型与工具执行门控',['harness/execution/'],'在 Harness 中执行助手生成与工具操作。','Harness 执行接口','执行层承接上下文与 effect 边界，不承担终端 UI。'],
    ['session','Session、分支、提交与存储',['harness/session/'],'提供会话树操作、提交序列、分叉及内存/JSONL 后端。','Session / MemorySessionRepo / JSONL','testing 子目录属于契约测试辅助，不代表生产调度路径。'],
    ['tools','Harness 内置文件与 Shell 工具',['harness/tools/','harness/env/','harness/utils/'],'通过执行环境提供文件、Shell、图片与输出管理。','ExecutionEnv / FileSystem / Shell','与 CLI 的工具包装层区分，适配环境而不硬绑终端。'],
    ['context','技能、模板、提示与压缩',['harness/skills.ts','harness/prompt-templates.ts','harness/system-prompt.ts','harness/messages.ts','harness/compaction/'],'为 Harness 组装上下文并生成压缩/分支摘要。','Harness 资源与上下文 API','复用同类概念，不意味着与 CLI 使用同一实例。'],
    ['pico','Pico3 运行时实现',['harness/pico3/'],'包含任务、调度、会话、插件和 Chord 适配的运行时实现。','pico3 子路径','按目录单独识别，不把它标成 CLI 默认执行路径。'],
    ['search','会话搜索契约',['search/'],'提供会话搜索相关接口和投影边界。','search 导出','与 SQLite 后端的存储职责分开。'],
    ['proxy','代理流与 Node 入口',['proxy.ts','node.ts'],'支持代理流封装与 Node 环境入口。','代理/Node SDK 调用','是否使用由宿主装配决定。']
  ],
  ai: [
    ['contracts','统一消息、模型与工具契约',['types.ts','models.ts','session-resources.ts'],'定义统一请求/响应、模型能力和工具调用数据。','pi-ai 根导出','根入口保持核心能力；具体提供商通过子路径接入。'],
    ['catalog','模型目录、缓存与生成数据',['models-store.ts','model-catalog.ts','models.generated.ts'],'组织模型元数据与目录存储。','模型目录 API','自动生成数据列为资源，不能把每个模型记录当成独立执行功能。'],
    ['auth','凭据存储、解析与 OAuth',['auth/','oauth.ts','bun-oauth.ts','env-api-keys.ts'],'统一凭据来源、登录流程与刷新。','认证上下文 / OAuth 子路径','认证策略随提供商而异；平台差异通过入口隔离。'],
    ['images','图片模型与注册表',['images.ts','images-api-registry.ts','image-models.ts','providers/images/'],'提供图像生成相关模型与 API 注册机制。','图像 API','不等同于对话中的图片输入；两条路径分别有契约。'],
    ['api','模型协议适配与惰性加载',['api/'],'把统一请求映射到各模型协议，再规范化流式结果。','api/* 子路径','包含 OpenAI、Anthropic、Google、Bedrock、Mistral、分类/图像等适配；具体清单由文件索引列出。'],
    ['compat','兼容入口与 API 别名',['compat.ts','compat/','legacy-api-aliases.ts','bedrock-provider.ts'],'提供旧调用形态与兼容入口。','pi-ai/compat','兼容层是否使用取决于调用者；与无副作用根入口区分。'],
    ['utilities','流事件、校验、重试与转录工具',['utils/'],'支持增量 JSON、工具参数验证、消息转换、重试、取消和溢出判断。','工具函数 / Provider 实现','具体函数、参数与注释由 AST 提取，避免依名字猜契约。'],
    ['cli','AI 命令行入口',['cli.ts'],'提供 AI 包的命令行入口。','pi-ai','与 coding-agent 的 pi 产品入口分开。']
  ],
  tui: [
    ['render','主屏、替代屏与差分渲染',['tui.ts','tui-main-screen.ts','tui-alt-screen.ts','terminal.ts'],'将组件行合成为终端输出并管理屏幕模式。','TuiMainScreen / TuiAltScreen','渲染只处理展示，模型状态由上层传入。'],
    ['components','布局、滚动、输入与选择组件',['components/','editor-component.ts'],'提供盒子、横纵布局、编辑器、列表、Markdown、图像和加载指示。','Component / Editor / ScrollView 等','每种组件的具体属性与方法在符号清单中可查。'],
    ['complete','路径、斜杠命令与模糊补全',['autocomplete.ts','fuzzy.ts'],'根据输入生成补全候选与模糊排序。','CombinedAutocompleteProvider','补全逻辑与编辑器替换范围共同决定体验。'],
    ['input','键盘、鼠标与输入缓存',['keys.ts','keybindings.ts','stdin-buffer.ts','mouse.ts'],'解析终端输入事件并映射到可配置动作。','KeybindingsManager / parseKey','终端协议报告与普通输入需要分开处理。'],
    ['color','颜色空间、样式与终端色值',['colors.ts','oklab.ts','terminal-colors.ts'],'解析和转换颜色，组合文本样式并读取终端颜色。','Color / styleText','终端能力可能影响最终颜色显示。'],
    ['image','图像协议与能力探测',['terminal-image.ts','native-platform.ts'],'处理 Kitty/iTerm2 图像与原生平台能力发现。','renderImage / detectCapabilities','终端不支持时使用对应回退路径。'],
    ['text','Unicode 宽度、ANSI 与 LaTeX',['utils.ts','latex.ts'],'按终端显示列处理文本、链接、换行和公式。','visibleWidth / wrapTextWithAnsi / renderLatex','字符数量不等于终端列宽。']
  ],
  chord: [
    ['facets','Facet 定义、加载与生命周期',['api.ts','facets/'],'声明插件能力与依赖并由宿主管理激活和清理。','defineFacet / createFacetHost','依赖图先校验，提供者先激活，清理按反向依赖顺序。'],
    ['services','服务提供、消费与远程绑定',['services/','types.ts'],'暴露 singleton/keyed 服务、处理远程调用与订阅。','defineService / createRemoteServiceBinding','服务语义由 Chord 管理，传输信封由应用管理。'],
    ['delta','不可变 delta 与复制状态',['delta/'],'跟踪 JSON 修改、应用操作并维护不可变版本。','track / applyImmutable 等 delta API','draft 生命周期与严格 JSON 放置约束以原始注释和类型为准。'],
    ['context','取消上下文与调用数据',['context/'],'显式传递取消、截止时间和调用范围值。','Context','不依赖 Pi 遥测或权限系统；这些值由应用传入。'],
    ['bundle','插件包清单、打包与 Node 加载',['node/','node.ts','bundler.ts'],'支持插件包资源解析、打包与加载。','Node / bundler 子路径','环境相关能力与运行时中性根入口隔离。'],
    ['json','严格 JSON 校验与复制',['json.ts'],'验证跨服务数据并复制 JSON 值。','isJsonValue / copyJson','跨进程可传输数据与任意 JavaScript 对象并不等价。']
  ],
  durable: [
    ['session','会话事务、分叉与观察',['session/'],'组织持久会话、提交事务、分叉与观察。','createSession','存储事务与观察者通知有专门边界。'],
    ['records','文档、条目、任务与 ID 契约',['documents.ts','entries.ts','tasks.ts','types.ts','ids.ts','errors.ts'],'定义持久记录类型、文档语义和任务阶段。','defineDoc / defineEntry / defineTask','这些记录契约与 CLI JSONL 条目不是同一套 API。'],
    ['harness','会话执行、注册表与调度',['harness/'],'组合模型与工具注册、会话配置及任务调度。','Harness / createRegistry','以当前实现为准；设计文档不代表所有计划已经落地。'],
    ['memory','内存存储',['storage/memory.ts'],'提供进程内的持久记录契约实现。','MemoryStorage','内存实现不提供进程退出后的磁盘恢复。'],
    ['jsonl','JSONL 存储与 Node 文件适配',['storage/jsonl/'],'将持久提交写到文件记录和 sidecar。','openNodeJsonlStorage','单写入者所有权与 fsync 选项影响耐久性。'],
    ['sqlite','SQLite 存储、迁移与 Node 适配',['storage/sqlite/'],'用 SQLite 保存持久记录并执行有序 schema 迁移。','openNodeSqliteStorage','同步数据库 facade 不等同于远程异步 D1。'],
    ['env','执行环境与输出捕获',['env/'],'提供文件/进程环境与可截断输出管理。','env 子路径','运行环境相关实现与存储契约分别阅读。'],
    ['testing','存储一致性用例与基准',['testing/'],'让存储实现复用相同契约测试及读写负载。','testing 子路径','基准是比较基础，不是生产容量保证。']
  ],
  client: [
    ['client','请求、订阅与会话连接',['client.ts','connection.ts','types.ts'],'管理请求关联、服务订阅和实时 attachment。','Client / createClientServiceTransport','不自动重连重放；断线不保证远端操作未执行。'],
    ['transport','字节传输与 Unix 发现',['transport.ts','unix.ts'],'适配有序字节通道并发现 Unix socket 服务。','ByteTransportFactory','逻辑 serverId 与物理地址区分。'],
    ['errors','连接错误与 Promise 管理',['errors.ts','promise.ts'],'表示断线、销毁和服务器错误。','客户端错误处理','本地请求拒绝与远端业务结果需要区分。']
  ],
  server: [
    ['route','服务路由与 attachment 管理',['server.ts','connection.ts','session-router.ts','types.ts'],'验证路由并将调用交给拥有会话的应用服务。','Server / ServerHost','连接结束与已接纳调用的收尾由生命周期契约决定。'],
    ['transport','监听器与 Unix 服务端',['listener.ts','transports/'],'为路由服务提供传输监听与 Unix 预设。','createUnixServer','认证策略由宿主负责，不由实验性传输自动提供。'],
    ['testing','服务端测试宿主与客户端',['testing/','errors.ts'],'提供服务测试辅助对象与路由错误类型。','testing 子路径','关联测试仅表示引用，不表示用例已经运行。']
  ],
  protocol: [
    ['envelope','版本握手与路由信封',['protocol.ts'],'定义服务/会话目标、请求响应、取消和订阅消息。','PROTOCOL_VERSION / RpcTarget','信封承载 opaque strict-JSON，业务含义由服务解释。'],
    ['codec','消息编码与字节流分帧',['codec.ts','framing.ts'],'把消息编码成帧并处理任意分段、合并的输入字节。','encodeClientMessage / ServerMessageDecoder','帧长度与结构限制用于拒绝无效消息。'],
    ['cbor','CBOR 编解码与限制',['cbor/'],'实现二进制值编码和受限解码。','CBOR 子模块','严格 JSON 与协议结构校验是不同层的约束。']
  ],
  sqlite: [
    ['storage','SQLite 会话仓库与适配',['sqlite/','index.ts'],'提供会话创建、打开、列举、分叉、删除和存储适配。','SqliteSessionRepo / createNodeSqliteFactory','单会话单写入者由宿主保证；不包含跨进程租约接管或 FTS 服务。']
  ],
  telemetry: [
    ['schema','Span、事件与类型化 schema',['index.ts'],'定义操作跨度、属性与事件，并从 schema 推导调用类型。','defineTelemetrySchema / createTypedSpanStarter','上下文显式传入，没有全局当前 span 或内置 exporter。'],
    ['adapters','空操作与内存参考实现',['noop.ts','memory.ts'],'提供零记录开销路径和可检查的内存记录器。','NOOP_TELEMETRY_CONTEXT / InMemoryTelemetryContext','生产导出后端由应用提供适配。'],
    ['conformance','遥测适配器一致性验证',['testing/'],'检查第三方遥测适配器是否满足接口契约。','testing 子路径','测试入口不是自动启用的生产监控。']
  ],
  evals: [
    ['runner','评测计划与容器运行',['cli.ts','docker.ts','plan.ts'],'为不同文档条件、模型和重复次数安排隔离评测。','eval:docs / eval:host','可能需要真实模型与网络；本次索引不执行评测。'],
    ['report','结果配对与效果报告',['report.ts','harness.ts'],'读取评测观测并比较有/无文档的行为结果。','report / harness','缺失、重复或未计分的实验会阻止总体效果结论。']
  ],
  experimental: [
    ['services','应用服务声明与提供者',['services/'],'提供模型、会话、插件、转录和控制等应用服务。','Chord 服务绑定','与传输层分工：应用定义 payload 的业务含义。'],
    ['workers','协调器、服务与会话 worker',['coordinator.ts','coordinator-entry.ts','server.ts','session-worker.ts','session-worker-manager.ts','process.ts'],'在不同进程间组织连接、会话所有权与 worker 生命周期。','实验服务启动入口','不当作默认单进程 CLI 的必经路径。'],
    ['plugins','应用插件包与内置插件',['plugins/','plugin.ts','source-resolver.ts'],'解析并组合实验应用使用的插件能力。','实验插件系统','与 CLI TypeScript 扩展体系分别展示。'],
    ['clients','客户端、TUI 与认证中继',['client.ts','client-runtime.ts','client-tui.ts','client-tui-chat.ts','radius-auth.ts','radius-relay.ts','cli.ts','commands.ts'],'把实验服务连接到交互客户端和认证流程。','实验性客户端入口','服务连接与 CLI stdin/stdout RPC 不同。'],
    ['mini','Mini 多进程应用',['mini/'],'通过 server、worker、TUI 和共享协议演示服务化应用。','mini/main.ts','独立实验入口，不能推断为默认产品实现。'],
    ['micro','Micro 精简应用',['micro/'],'集中展示精简模型、工具、会话与 TUI 的组合。','micro/main.ts','用于实验阅读，功能契约以该目录为准。']
  ],
  native: [
    ['win','Windows 平台桥接',['win32/'],'提供 Windows 原生平台和剪贴板实现及构建。','native/win32','二进制预构建仅列入资源清单，不解析为 TypeScript 符号。'],
    ['mac','macOS 平台桥接',['darwin/'],'提供 macOS 原生平台能力与构建脚本。','native/darwin','Objective-C 代码保留全文，符号不由 TypeScript 解析。'],
    ['linux','Linux X11 平台桥接',['linux/'],'提供 Linux X11 剪贴板和工作线程适配。','native/linux','可用性取决于实际显示服务与平台条件。'],
    ['contracts','原生桥接头文件',['clipboard.h','napi.h'],'定义原生模块共享接口。','N-API / clipboard 头文件','属于平台实现支撑。']
  ],
  engineering: [
    ['checks','依赖、导入与构建边界校验',['check-'],'验证精确依赖、运行依赖、TS 导入、入口图与浏览器兼容。','npm run check','检查失败不是修改业务代码或降级依赖的理由。'],
    ['release','打包、发布与版本同步',['release','publish','package-workspaces','local-release','sync-versions','create-source-archive','build-','coding-agent-consumer'],'组织包发布、消费者安装、二进制与版本流程。','仓库维护脚本','涉及发布时必须遵守项目 release 技能；此清单只读。'],
    ['catalog','模型目录协议与生成维护',['model-catalog','generate-','diff-model-catalog'],'维护模型元数据协议、派生清单与锁定文件生成。','模型生成/差异脚本','生成代码应从其生成器维护。'],
    ['analysis','会话统计与性能分析',['stats','cost','tool-stats','read-tool-stats','edit-tool-stats','session-','profile-'],'分析会话、工具使用、上下文和性能。','本地统计脚本','这些脚本不是默认对话功能。']
  ]
};
