// Current workbench-dev application layer. Historical UI reports remain source evidence,
// never a claim that every configured field or external integration is operational.
export const workbenchModules = [
  ['workbench-web', '工作台 · 浏览器界面', 'apps/agent-web/src/', '多页签、原生会话、运行检查器、配置与模块操作。', '应用能力', 'apps/agent-web/README.md'],
  ['workbench-protocol', '工作台 · HTTP / 事件契约', 'packages/agent-protocol/src/', '浏览器 DTO、输入校验、事件序号与终端协议。', '协议契约', 'packages/agent-protocol/README.md'],
  ['workbench-server', '工作台 · 本地服务与模块宿主', 'apps/agent-server/src/', '认证、授权、会话 worker、持久事件、文件、终端与十模块执行。', '宿主能力', 'apps/agent-server/README.md'],
  ['workbench-runtime', '工作台 · 原生会话适配', 'packages/agent-runtime-adapter/src/', '受控装配 coding-agent，转换事件并限定模型与工具。', '运行时适配', 'packages/agent-runtime-adapter/README.md']
];

export const workbenchFeatures = {
  'workbench-web': [
    ['startup', '页面启动、路由与多页签', ['main.ts', 'app/', 'layout/', 'state/tabs.ts'], '装配工作台，按业务页面打开、切换、关闭页签并同步深链接。', 'bootstrap / workspace-router / TabBar', '关闭页签与清除草稿不同；键盘菜单、右侧工作区和窄屏布局分别维护。'],
    ['session', '原生会话列表与聊天', ['features/coding-agent/page.ts', 'features/coding-agent/Sessions.ts', 'features/coding-agent/Chat.ts', 'features/coding-agent/Composer.ts', 'state/agent.ts'], '创建或选择会话，提交提示，呈现消息和运行状态。', '#/coding-agent → Sessions → Composer', '浏览器通过宿主操作会话；没有宿主时显示不可连接，不生成假模型回复。'],
    ['events', 'HTTP 客户端与 SSE 事件恢复', ['services/host-client.ts', 'services/host-events.ts', 'state/agent.ts', 'features/coding-agent/derived.ts'], '请求同源 API，消费带序号的事件并恢复浏览器状态。', 'host-client / host-events', '事件回放与快照兜底处理断线；最终 message_end 替换增量拼接结果，避免重复文本。'],
    ['attachments', '图片附件与输入校验', ['features/coding-agent/Attachments.ts', 'features/coding-agent/Composer.ts'], '将用户选择的图片整理为提示附件，并反馈类型或容量错误。', 'Attachments → prompt 请求', '前端反馈不替代服务端严格校验；图片能力仍由宿主模型声明。'],
    ['inspect', '运行、上下文、变更与资源检查器', ['features/coding-agent/Inspector.ts', 'features/coding-agent/RunInspector.ts', 'features/coding-agent/ContextInspector.ts', 'features/coding-agent/ChangesInspector.ts', 'features/coding-agent/RuntimePanel.ts', 'features/coding-agent/Dock.ts'], '检查工具、队列、用量、上下文投影、文件差异与运行时信息。', 'Inspector / RuntimePanel', 'canonical-projection 是当前分支模型上下文；未知费用保留未知，不由 token 数伪造账单。'],
    ['files', '文件浏览、搜索和编辑冲突', ['features/coding-agent/FilesInspector.ts'], '在授权工作区内浏览、查找、新建和修改文件。', 'FilesInspector → workspace files API', '保存带 etag；冲突时重新读取，不把浏览器编辑内容自动覆盖新版本。'],
    ['terminal', '终端面板与显式创建', ['features/coding-agent/Terminal.ts'], '操作宿主允许的 PTY，发送输入、调整尺寸并观察退出。', 'Terminal → terminal routes', '查看面板不启动 shell；只有宿主启用且用户创建后才有真实终端。'],
    ['settings', '原生设置、模型与诊断入口', ['features/coding-agent/Entries.ts', 'features/coding-agent/entries/', 'features/coding-agent/entries.css'], '提供会话、模型、参考资料、原生设置和诊断的独立入口。', 'Entries → NativeSettings / Models / Diagnostics', 'native settings 仅保存非秘密白名单；保存影响下一次 runtime 创建，项目范围需要宿主信任。参考清单不是全部已接通的 API。'],
    ['drafts', '内存草稿、JSON 编辑与导入导出', ['state/store.ts', 'state/editor.ts', 'services/drafts.ts', 'services/json.ts', 'services/fields.ts', 'components/ImportDialog.ts', 'components/JsonEditor.ts'], '保留页内配置与未应用文本，校验整份草稿后再原子导入。', 'drafts / store / JsonEditor', '浏览器草稿刷新会丢失；导出 pi-workbench-draft 不等于可直接传给 SDK 的完整配置。'],
    ['config', '保存配置、继承解析与生效回执', ['features/saved-config/', 'services/effectiveness.ts'], '读取 global/workspace/session 配置，显示来源与实际操作回执。', 'SavedConfiguration → resolution / receipt', 'revisionVector 约束继承快照；保存成功、参数发出和行为实测是不同证据。'],
    ['modules', '十模块页面与显式运行', ['features/ModuleOperations.ts', 'features/FeaturePage.ts', 'features/ai/', 'features/agent-core/', 'features/durable/', 'features/codemode/', 'features/mcp/', 'features/env/', 'features/chord/', 'features/telemetry/', 'features/tui/', 'features/evals/'], '将模块表单、能力索引、示例和宿主 operation 组合成独立页面。', 'ModuleOperations → /api/modules/capabilities', '按宿主支持状态开放操作；本地 fixture、真实模型和外部 daemon 的结果须按各自边界理解。'],
    ['catalog', '能力、字段与固定模型目录', ['data/', 'models.json', 'services/source.ts'], '提供参数元数据、源码链接、模型选择与能力帮助。', 'data/catalog / feature-specs / models.json', '目录来自源码快照；可选择不代表当前账号能调用，字段可编辑不代表已运行验证。'],
    ['presentation', '双语、可访问控件与响应式样式', ['i18n/', 'components/', 'styles/', 'style.css', 'index.html', 'types/'], '集中管理中英文文案、DOM 控件、选择器和布局。', 'i18n / Select / Field / styles', '语言切换保留编辑状态；文本、属性和交互分别更新。']
  ],
  'workbench-protocol': [
    ['types', '浏览器安全 DTO 与请求响应类型', ['types.ts', 'index.ts'], '定义会话、消息、工作区、配置、能力与运行请求的传输结构。', '@pi-workbench/protocol', 'wire v1 与 npm 包版本不同；私有磁盘路径和凭据不应进入浏览器 DTO。'],
    ['validation', '严格 JSON、提示与配置校验', ['validation.ts'], '拒绝未知字段、非法标识、危险对象结构与过量图片。', 'parsePromptRequest / parseConfigWriteRequest / parseFileWriteRequest', '最多 8 张图片，单张 5 MiB、合计 7 MiB；revision/etag 用于冲突检查。解析不代替所有者授权。'],
    ['events', '单调事件序号与消息归约', ['events.ts'], '用完整消息和事件序号建立可恢复的浏览器投影。', 'events.ts', '先持久化再广播；增量是临时呈现，最终消息为权威结果。'],
    ['terminal', '终端屏幕与输入输出协议', ['terminal.ts'], '描述终端尺寸、状态、屏幕和控制请求。', 'terminal.ts', '协议支持不证明平台 PTY 已安装或宿主已授权。']
  ],
  'workbench-server': [
    ['startup', '回环 HTTP 服务装配与关闭', ['main.ts', 'server.ts', 'index.ts', 'operation-gate.ts'], '准备仓外数据根、锁、服务组件和请求收尾，提供同源静态资源。', 'startServer(ServerOptions) / start:workbench', '只绑定 127.0.0.1 或 ::1；close 等待所拥有的工作收尾。Windows IPC 停机与强杀不同。'],
    ['auth', '逐请求身份、工作区授权与来源检查', ['auth.ts', 'http.ts', 'routes.ts', 'errors.ts', 'audit.ts'], '核验身份、会话所有者、工作区权限与 Host/Origin，记录最小审计。', 'authenticate → route → authorizeWorkspace', 'configured 默认拒绝匿名业务 API；faux local-owner 仅开发用。Origin 防护不能代替认证。'],
    ['sessions', '会话、幂等请求与持久事件', ['sessions.ts', 'storage.ts', 'events.ts', 'runtime-events.ts', 'lock.ts'], '保存工作区、消息、运行与事件序号，使断线后可回放。', 'SessionStore / EventStreams', '同一 requestId 避免重复提交；重启将未结束运行标为中断，不自动重新调用模型。'],
    ['workers', '每会话 worker 与 IPC 生命周期', ['workers.ts', 'worker.ts', 'worker-process.ts', 'worker-messages.ts'], '隔离会话运行进程，转交 prompt、abort 和运行时操作，汇总事件。', 'WorkerManager → worker-process → worker', '子进程使用白名单环境；进程分离不是 OS 沙箱。运行结束要考虑 agent_settled 与取消。'],
    ['runtime', '模型工具选择、会话树与导出', ['runtime-routes.ts', 'fork-session.ts', 'local-model.ts'], '转交队列、模型/思考/工具选择、分支、压缩、上下文与 JSONL 导出。', '/api/sessions/:id/runtime/:action', '所有权检查先于运行；工具选择不可超过宿主允许集合，分叉会创建独立会话记录。'],
    ['files', '授权文件读写、搜索与 etag', ['files.ts'], '解析工作区相对路径，限制链接与越界读写并检测冲突。', '/api/workspaces/:id/files', 'etag 保证基于读取版本保存；路径保护不是任意 shell 的系统隔离。'],
    ['config', '三层模块配置与修订校验', ['config.ts', 'config-validation.ts', 'config-routes.ts', 'config-fields.ts'], '持久化按主体隔离的 global/workspace/session 配置并解析继承。', '/api/config', 'PUT 替换 values；null 是值。选择保存版本或完整 revisionVector，过期运行结果不登记为当前生效。'],
    ['native-settings', '原生 global/project 设置', ['native-settings.ts', 'native-settings-routes.ts'], '把安全白名单设置交给原生设置读写与锁定路径。', '/api/settings', '独立于 /api/config；projectTrusted 由宿主给出，浏览器不能提升信任。null patch 删除当前覆盖。'],
    ['terminal', 'Linux PTY / Windows ConPTY 与屏幕', ['terminal/', 'terminal-routes.ts'], '管理显式创建的终端、屏幕、输入、resize、退出及拥有者断连清理。', 'TerminalManager / windows-worker', 'Windows x64 使用校验过的 ConPTY 资源；默认关闭，不能把 cwd 当作权限沙箱。'],
    ['module-dispatch', '模块能力发布、字段证据与操作门控', ['module-routes.ts', 'modules/index.ts', 'modules/common.ts', 'modules/fields.ts', 'modules/field-targets.ts', 'modules/verify-field-report.ts'], '公开可用 operation、读取保存配置并标记字段消费与实测结果。', '/api/modules/capabilities / /api/modules/:module/:operation', 'supported 依赖宿主配置；发送、消费、行为观察和未验证分别记录，不能仅凭成功响应宣称全部参数有效。'],
    ['ai', 'AI 真实生成与边界实验', ['modules/ai-'], '使用宿主固定模型生成；另用受控响应检查请求、传输、deferred、图像和分类协议。', 'ai/generate；request-boundary；transport-boundary', '真实 generate 采用受控 SSE；工具声明只返回建议调用，不执行工具。fixture 结果不能当真实推理。'],
    ['agent', 'Agent 循环与真实单次执行', ['modules/agent'], '在本地 faux 或宿主模型上运行原生 Agent，处理工具、排队与取消。', 'agent/tool-run；agent/live-run', 'live-run 不是持久聊天；工具是宿主允许的 read/write/edit 子集，write/edit 可真实改工作区。'],
    ['durable', 'Durable 持久任务、检查与显式恢复', ['modules/durable', 'durable-storage.ts'], '按主体和工作区保存 JSONL，运行、只读检查、显式恢复提交，并演练调度/压缩/扩展。', 'durable/live-run；live-inspect；live-resume', 'run 要求新的 operationId；inspect 不推理，resume 复用输入。写工具不默认 replay-safe；宿主额外授权的原生工具独立限制。'],
    ['codemode', 'QuickJS 执行与确定性重放演练', ['modules/codemode.ts'], '运行有界脚本、局部 echo 工具与 store 快照，比较固定时钟和随机种子。', 'codemode/execute；codemode/replay', '返回 storeWrites 不自动持久化；没有任意文件、网络或 shell 工具。'],
    ['mcp', 'MCP 内存、stdio 与 HTTP 传输演练', ['modules/mcp'], '通过实际 MCP SDK 验证初始化、请求关联、取消与受控传输行为。', 'mcp/roundtrip；mcp/stdio；mcp/http', 'stdio 只运行固定 Node fixture，HTTP 注入 fetch；不能据此声称外部 OAuth 或服务连通。'],
    ['env', 'Env 规划、协议演练与受控 daemon', ['modules/env', 'modules/storage.ts'], '分开演示 SSH 规划、本地文件、协议对端，以及显式 provision 的真实 Linux daemon。', 'env/connection-plan；runtime；live-runtime；local-file', 'live-runtime 才触达宿主授权 daemon；浏览器不能提供任意可执行命令、SSH 目标或挂载。'],
    ['chord', 'Chord 1.3 对象与复制状态演练', ['modules/chord-host.ts', 'modules/local.ts'], '创建受控 host、契约、对象持有、状态复制与 JSON delta。', 'chord/host；chord/delta', '局部 host 与进程内链路不代表远端身份或生产 WebSocket 验收；使用 1.3 state/resource API。'],
    ['tui-telemetry', 'TUI 无头组件与内存遥测', ['modules/tui.ts', 'modules/local.ts'], '验证文本宽度、嵌套滚动、组件渲染与真实内存 span/schema。', 'tui/headless；overscroll；text；telemetry/span；schema', '无头终端与内存 span 不等于真实终端视觉或外部遥测 exporter 已验收。'],
    ['evals', '评测计划、配对报告与显式 Docker 评测', ['modules/evals'], '解析选择、展开计划、校验报告，并在受信镜像与模型下发现或执行真实评测。', 'evals/plan；report；selection；live-discover；live-evaluate', 'discover 不请求模型；evaluate 可产生真实用量，只允许宿主批准的镜像、文件与参数。缺失配对阻止总提升结论。'],
    ['restore', '停机备份跨目录恢复', ['restore.ts', 'durable-storage.ts'], '离线复制校验备份，重写受控会话路径及 Durable 命名空间。', 'scripts/restore-workbench.mjs', '目标必须尚不存在，拒绝链接、重叠和仓内路径；不改消息内容，不恢复凭据，不自动续跑。']
  ],
  'workbench-runtime': [
    ['assembly', '受控装配原生 AgentSession', ['runtime.ts', 'types.ts', 'index.ts'], '创建或恢复原生会话，把模型、设置、工具、扩展组合成 WorkbenchRuntime。', 'createWorkbenchRuntime', 'cwd、agentDir、sessionDir 为授权绝对路径；默认不启用工具，不读取真实凭据存储。'],
    ['models', '固定模型运行时与请求来源限制', ['models.ts'], '提供显式 faux 或宿主配置的模型，阻止替换身份及越权目标。', 'configured model runtime / faux provider', 'allowedOrigins 与 redirect:error 限制请求；不回退到其他模型，未知费用保持 null。'],
    ['operations', '运行操作、分叉、压缩与上下文投影', ['operations.ts'], '实现模型/工具切换、树导航、分叉、压缩、导出和上下文查询。', 'WorkbenchRuntime 方法', '分支投影不同于全历史；已有会话选择优先于新的默认设置。'],
    ['events', '原生事件到浏览器安全投影', ['events.ts', 'tool-data.ts'], '转换消息、thinking、工具结果、费用、队列和结束事件。', 'RuntimeEvent → worker IPC', 'message_end 为最终消息，agent_settled 才表示自动收尾结束；私有 sessionFile 不转发浏览器。'],
    ['tools', '工作区文件工具与差异隔离', ['workspace-tools.ts', 'workspace-diff.ts', 'workspace-diff-worker.ts'], '将原生 read/write/edit 限定在授权工作区并生成有界差异。', 'createWorkspaceTools', 'allowedTools 是权限上限，tools 是激活子集；限制路径和容量不等于 OS 沙箱。'],
    ['extensions', '显式 MCP / codemode 扩展装配', ['extensions.ts', 'testing.ts'], '按宿主选项注册内置扩展，连接工具发现、脚本编排和状态查询。', 'WorkbenchExtensionsOptions', 'MCP 需要显式工厂与许可；local echo 仅 faux 测试，脚本能力仍受工具上限约束。']
  ]
};

const ref = path => [path, ''];
export const workbenchChapter = {
  id: 'workbench', title: '工作台：浏览器到原生运行时', eyebrow: 'WORKBENCH / CURRENT SOURCE',
  intro: 'workbench-dev 在官方 1.3.0 主线上保留本地工作台。用一次“读取工作区文件并总结”的请求贯穿界面、协议、宿主、会话和事件恢复。',
  sections: [
    { title: '01 · 四层地图与两个版本', text: 'apps/agent-web 是浏览器界面；agent-protocol 定义 DTO 和输入验证；apps/agent-server 提供回环 HTTP 与 worker 管理；agent-runtime-adapter 装配原生 coding-agent。工作台私有包有自己的版本，不能用核心 1.3.0 推断全部应用功能。旧 packages/server/client/protocol 已移除，与这些新目录不是同一实现。', refs: ['package.json', 'docs/workbench/MAIN-INTEGRATION.md'].map(ref) },
    { title: '02 · 先区分草稿、fixture 和真实执行', table: [['层次', '实际发生什么', '不能据此推断'], ['浏览器草稿', '在内存编辑字段、JSON 和示例', '模型或 daemon 已运行'], ['受控 operation', '原生 SDK + faux / 注入响应 / 内存链路', '真实外部服务可用'], ['宿主授权的 live operation', '固定模型、工作区工具或受控 daemon / Docker', '其他供应商、任意参数或所有平台通过验收']], text: '能力由 /api/modules/capabilities 的 supported、requirements、limitations 决定。原 README 的一期说明属于历史；当前路线以 operation 注册表和分派实现为准。', refs: ['apps/agent-server/src/modules/index.ts', 'apps/agent-web/src/features/ModuleOperations.ts'].map(ref) },
    { title: '03 · 浏览器提交与协议边界', text: '选择会话后，Composer 通过 host-client 提交 text、requestId 和可选图片。路由先检查身份与工作区，再用协议解析器校验请求。requestId 将同一次提交与重试关联；它不是替代所有者校验的凭证。', refs: ['apps/agent-web/src/features/coding-agent/Composer.ts', 'apps/agent-web/src/services/host-client.ts', 'packages/agent-protocol/src/validation.ts', 'apps/agent-server/src/routes.ts'].map(ref) },
    { title: '04 · 从宿主进入原生调用链', text: 'WorkerManager 为会话管理进程与 IPC，worker 调用 createWorkbenchRuntime，再由适配器创建 AgentSession。随后进入既有 AgentSession.prompt → Agent → agent-loop → modelRuntime / tools。工作台 HTTP 与 CLI 的 stdin/stdout RPC 是不同入口，复用的是原生会话执行核心。', refs: ['apps/agent-server/src/workers.ts', 'apps/agent-server/src/worker.ts', 'packages/agent-runtime-adapter/src/runtime.ts', 'packages/coding-agent/src/core/agent-session.ts'].map(ref) },
    { title: '05 · 事件如何回来，刷新如何继续', text: '原生事件先转换成安全 RuntimeEvent，经 IPC 交给宿主。宿主写入会话及序号后广播 SSE；浏览器按序归约。message_end 替换此前临时增量，避免重放重复内容。重连从 afterSeq 继续，不可用时取快照；恢复页面不代表重新发送模型请求。', refs: ['packages/agent-runtime-adapter/src/events.ts', 'apps/agent-server/src/runtime-events.ts', 'apps/agent-server/src/events.ts', 'apps/agent-web/src/services/host-events.ts', 'packages/agent-protocol/src/events.ts'].map(ref) },
    { title: '06 · 取消、队列与最终完成', text: '运行中 steer / followUp 按原生边界入队；abort 沿 worker 和运行时传播。agent_end 后仍可能重试或压缩，所以适配器以 agent_settled 表示自动收尾完成。服务重启遇到未结束运行会记录失败/中断，不自动重复推理或文件副作用。', refs: ['packages/agent-runtime-adapter/src/runtime.ts', 'packages/agent-runtime-adapter/src/events.ts', 'apps/agent-server/src/sessions.ts'].map(ref) },
    { title: '07 · 会话树与模型上下文', text: '树保存全部可回溯条目，上下文面板展示当前分支 canonical-projection。fork、navigateTree、compact 和 exportSession 各有独立语义；压缩生成摘要不删除原始历史。宿主隐藏原生 sessionFile，浏览器通过 DTO 获取允许的数据。', refs: ['packages/agent-runtime-adapter/src/operations.ts', 'apps/agent-server/src/runtime-routes.ts', 'apps/agent-web/src/features/coding-agent/ContextInspector.ts'].map(ref) },
    { title: '08 · 三种配置不要混用', table: [['配置', '存放 / 应用', '冲突与边界'], ['浏览器草稿', '内存 store / editor，显式导出', '刷新丢失；不是 SDK 完整配置'], ['/api/config', '主体隔离的 global → workspace → session', 'revision / revisionVector；保存不等于生效'], ['/api/settings', '原生 agentDir / 可信项目 .pi/settings.json', 'revision；白名单；下次 runtime 创建消费']], text: '原生会话已有的模型、思考和工具选择可能覆盖新的默认值。字段回执要读具体 operation 的证据；发出 temperature 并不证明某次回复的采样行为。', refs: ['apps/agent-server/src/config.ts', 'apps/agent-server/src/native-settings.ts', 'apps/agent-server/src/module-routes.ts'].map(ref) },
    { title: '09 · 文件、终端与模型授权', text: '文件 API 检查路径、链接和 etag；模型工具另受 allowedTools 上限约束。终端需宿主显式启用且用户创建，Linux PTY 与 Windows ConPTY 有独立平台实现。终端继承宿主实际权限，文件 API 的路径检查不约束任意 shell。模型端点及凭据来自宿主，浏览器不能提交任意 URL 或密钥。', refs: ['apps/agent-server/src/files.ts', 'packages/agent-runtime-adapter/src/workspace-tools.ts', 'apps/agent-server/src/terminal/manager.ts', 'apps/agent-server/src/local-model.ts'].map(ref) },
    { title: '10 · 怎样验证自己的修改', text: '从本页引用图定位到负责层，再找对应定向测试。界面交互使用 mocked DOM / 浏览器分别验证；HTTP 使用临时数据根；runtime 用 faux；真实供应商、SSH、daemon 与 Docker 需要各自条件。当前任务验证离线导航，不重新宣称所有外部集成已经验收。操作步骤、断点和备份恢复见“本地开发说明”的工作台阶段。', refs: ['scripts/test-workbench.mjs', 'deploy/WORKBENCH.md', 'docs/workbench/MAIN-INTEGRATION.md'].map(ref) }
  ]
};

const lesson = (intro, focus, usage, config, flow, extend, mastery) => ({ intro, focus, usage, config, flow: flow.map(([title, path, text]) => ({ title, path, needle: '', text })), extend, mastery });
export const workbenchLessons = {
  'agent-protocol': lesson('工作台浏览器与宿主共享的传输契约；保持 JSON、身份无关类型与严格校验，不装配模型或持久化。',
    ['DTO 不能暴露私有 sessionFile 或凭据。wire 版本与 npm 版本分开。', 'parse 函数只负责形状和限制；身份、所有权、能力上限由宿主处理。'],
    ['浏览器与服务端都从公开 index.ts 导入契约。', '先给无效值写解析测试，再新增字段；同步宿主消费与界面显示。'],
    [['输入契约', 'PromptRequest 的 requestId / text / images、ConfigWrite 的 revision 和 FileWrite 的 etag 见完整声明。'], ['限制', '图片最多 8 张、单张 5 MiB、总计 7 MiB；严格 JSON 拒绝原型污染键、getter、循环和过深结构。'], ['状态更新', '最终消息覆盖增量；seq 单调增长，回放游标不得领先会话。']],
    [['DTO', 'packages/agent-protocol/src/types.ts', '先确认请求和浏览器响应字段。'], ['解析', 'packages/agent-protocol/src/validation.ts', '沿未知字段、容量、标识与版本校验阅读。'], ['归约', 'packages/agent-protocol/src/events.ts', '对照重复、缺口与最终消息的处理。']],
    ['新增请求需同步解析器、路由、客户端和测试；不要只添加类型后假定运行时安全。'], ['手算一条消息的增量、完成、重复回放后状态。', '验证 revision 过期与 etag=null 创建场景。']),
  'agent-runtime-adapter': lesson('把 coding-agent 嵌入工作台的受控适配层；复用原生会话，限制模型、资源和文件工具，转换可公开事件。',
    ['allowedTools 为授权上限，tools 为当前激活集合。', 'agent_settled 表示自动处理结束，agent_end 仍可能有后续重试。', 'sessionFile 只用于服务端恢复，不进入浏览器快照。'],
    ['给 createWorkbenchRuntime 传入绝对 cwd / agentDir / sessionDir 和显式 mode。', '先用 fauxResponses / fauxResponseSteps 跑最小 prompt、abort 和恢复；结束 await dispose。', 'configured 需要宿主 ModelRuntime 与模型白名单，不从机器日常登录读取凭据。'],
    [['装配', 'WorkbenchRuntimeOptions 全量声明在 types.ts：路径、mode、model/allowedModels、thinkingLevel、compactionSettings、modelRuntime、tools/allowedTools、scopedSettings、faux 测试选项、extensions、onEvent。'], ['扩展', 'WorkbenchExtensionsOptions 管理显式 MCP/codemode；本地 echo 仅测试。'], ['操作', 'WorkbenchRuntime 的 prompt、clearQueue、setModel、setTools、fork、navigateTree、compact、exportSession、getContext、abort、dispose 各有独立输入与返回。']],
    [['创建', 'packages/agent-runtime-adapter/src/runtime.ts', '从选项到 AgentSession 与订阅。'], ['模型', 'packages/agent-runtime-adapter/src/models.ts', '固定身份、origin 与传输边界。'], ['操作', 'packages/agent-runtime-adapter/src/operations.ts', '从树操作回到原生会话。'], ['事件', 'packages/agent-runtime-adapter/src/events.ts', '追踪消息、工具和收尾事件。']],
    ['通过明确的宿主选项接入模型或内置扩展；复用工具管线和取消信号。'], ['用 faux 工具调用跟完一轮，再对比 AgentSession 原始事件与 RuntimeEvent。', '验证重开已有会话时选择优先级、越权工具拒绝、失败与 dispose。']),
  'agent-server': lesson('单机工作台宿主：同源静态服务、授权、会话进程、持久事件、配置、文件、PTY 和显式模块操作。',
    ['回环监听不等于认证；configured 无 authenticate 默认拒绝业务 API。', 'dataRoot 必须是仓外受控目录，服务锁、持久写入与事件发布顺序共同保证恢复。', '真实模型、daemon、终端和 Docker 都要由宿主明确提供，不从浏览器配置扩大权限。'],
    ['按本地开发说明安装并 build:offline，在仓外新目录运行 faux 模式。', '页面连接后创建会话，用无付费 faux 完成发送、取消、刷新恢复。', '部署使用 startServer 的认证集成，停机时 await close，保留整个部署单元。'],
    [['ServerOptions', 'dataRoot / repositoryRoot 必填；port 默认由 CLI 设为 4317，host 限回环；staticRoot、initialWorkspaceId、authenticate、terminalEnabled、approvedRemoteModel、envDaemon、dockerEvals、durableCodingTools 及 WorkerOptions 都在完整索引。'], ['WorkerOptions / CLI', 'mode、模型/工具/扩展/原生设置控制执行；main.ts 的 PI_WORKBENCH_* 是 CLI 入口，环境变量来源列表逐行保留。'], ['配置回执', '/api/config 的 scope 和 revisionVector 不替代原生 /api/settings；消费或实测证据必须匹配保存修订。']],
    [['启动', 'apps/agent-server/src/main.ts', '读取显式环境选项，调用 startServer。'], ['边界', 'apps/agent-server/src/server.ts', '检查来源、认证、初始化组件与 close。'], ['路由', 'apps/agent-server/src/routes.ts', '先授权再转交业务请求。'], ['进程', 'apps/agent-server/src/workers.ts', '查看会话状态、请求幂等与 IPC。'], ['模块', 'apps/agent-server/src/modules/index.ts', '比较 capabilities 与具体分派边界。']],
    ['在宿主入口注入真实 authenticate 与批准的模型；新增 operation 复用 module-routes、字段解析和门控。'], ['按“输入 → 授权 → 持久化 → worker → 事件”逐点下断点。', '验证重启不自动重跑、冲突拒绝、跨主体访问拒绝及停机备份。']),
  'agent-web': lesson('工作台前端：组件化 DOM、独立业务页、多页签、原生会话与宿主 operation。浏览器只展示或提交授权范围内的信息。',
    ['页签、表单草稿、未应用 JSON、服务器配置是不同状态。', '根据宿主能力显示真实运行入口；参考目录与示例不冒充运行结果。', '翻译与布局不应重建输入造成编辑丢失。'],
    ['先构建并用同源宿主打开 #/coding-agent；只打开前端文件不能获得 API。', '从 bootstrap 看页面注册，再选择一个 feature，沿 host-client 到服务端路由。', '改样式/控件后运行类型检查、定向 mocked DOM 测试，再用真实浏览器验证键盘和窄屏。'],
    [['字段', 'data/catalog 的字段与 feature-specs 定义编辑元数据，完整 API 类型由 protocol 提供。'], ['状态', 'store/editor/tabs/agent 分别维护草稿、编辑文本、页签与会话；语言偏好可本地保存，草稿不持久化。'], ['运行', 'ModuleOperations 读取 supported/requirements；SavedConfiguration 区分保存修订、继承合成与回执。']],
    [['启动', 'apps/agent-web/src/app/bootstrap.ts', '建立 Shell 与页面生命周期。'], ['业务', 'apps/agent-web/src/features/coding-agent/page.ts', '组合会话、聊天与检查器。'], ['通信', 'apps/agent-web/src/services/host-client.ts', '同源 HTTP 输入与错误处理。'], ['恢复', 'apps/agent-web/src/services/host-events.ts', 'SSE、序号与快照恢复。']],
    ['新增业务页复用 FeaturePage、控件、i18n 与 host-client；协议变更须同步服务端校验。'], ['追踪发送、收到增量、最终消息、切页、刷新五个时刻的状态。', '验证断网、409、空会话、权限未启用和中英文切换，保留当前表单。'])
};

export const workbenchDevelopment = [
  { title: '18 · 工作台：构建并启动无付费演练', text: '工作台需要服务端、前端及 worker 产物，先构建再启动。使用新的仓外数据根，faux 模式没有真实模型调用；文件工具、终端与原生设置默认分别受控。', commands: [
    { title: '从仓库根准备并构建', shell: 'powershell', code: 'npm.cmd ci --ignore-scripts\nnpm.cmd run check:model-data\nnpm.cmd run build:offline', expected: '依赖和数据检查成功后生成包及 apps 产物。若某步失败先修复再继续；ci 会重建 node_modules。' },
    { title: '启动独立 faux 工作台', shell: 'powershell', code: "$env:PI_WORKBENCH_DATA_ROOT = Join-Path (Split-Path -Parent (Get-Location).Path) ('pi-workbench-dev-data-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))\n$env:PI_WORKBENCH_MODE = 'faux'\nnpm.cmd run start:workbench", expected: '打开 http://127.0.0.1:4317/#/coding-agent，创建会话并发送消息。使用新数据根防止与日常数据混用；端口占用先查已有进程。' }
  ], refs: ['package.json', 'apps/agent-server/src/main.ts', 'deploy/WORKBENCH.md'].map(ref) },
  { title: '19 · 工作台：源码调试与实际断点', text: '源码 loader 解析工作台及原生包别名。服务端入口可直接调试；前端仍需构建静态资源。会话 worker 是子进程，父进程 Inspector 不会自动覆盖它；使用 VS Code Auto Attach 并在 Loaded Scripts 确认实际文件。构建产物 smoke 仍用 dist，不能以源码调试替代。', commands: [
    { title: '沿用上一阶段环境，启动服务端 Inspector', shell: 'powershell', code: 'node --inspect-brk=127.0.0.1:9230 --import ./scripts/workbench-source-loader.mjs ./apps/agent-server/src/main.ts', expected: '在 VS Code 附加 9230；继续后服务启动。不要与上一实例同时占用端口或数据根。' }
  ], table: [['目标', '断点与观察'], ['宿主入口', 'server.ts startServer、routes.ts route：principal、workspaceId、requestId'], ['运行分派', 'workers.ts / worker.ts：会话进程、IPC、abort 与操作结果'], ['原生执行', 'agent-runtime-adapter/runtime.ts → AgentSession.prompt：工具与模型上限'], ['事件回传', 'runtime-events.ts / events.ts：持久化 seq、发布和 afterSeq'], ['浏览器', 'host-client / host-events / state/agent：请求、最终消息、恢复；以实际 bundle/source map 为准']], refs: ['scripts/workbench-source-loader.mjs', 'apps/agent-server/src/worker-process.ts', 'apps/agent-web/build.mjs'].map(ref) },
  { title: '20 · 工作台：按改动选择测试', text: '先做对应目录的定向用例，再跑仓库检查与工作台回归。test:workbench 使用显式测试清单、临时 HOME 和白名单环境；产物 smoke 需要最新 dist。faux 验证不代表真实供应商、Docker 或 SSH 验收。', commands: [
    { title: '协议与前端设置的定向测试', shell: 'powershell', code: 'node --import ./scripts/workbench-source-loader.mjs --test packages/agent-protocol/test/protocol.test.ts\nnode apps/agent-web/tests/agent-native-settings.test.mjs', expected: '协议解析与前端设置契约通过；按实际修改再选择相邻测试。' },
    { title: '整体检查与限定工作台回归', shell: 'powershell', code: 'npm.cmd run check\nnpm.cmd run test:workbench\ngit diff --check', expected: '所有相关检查通过；工作台报告位于 .artifacts/workbench/test-results.json，真实浏览器单独验收。' }
  ], refs: ['scripts/test-workbench.mjs', 'scripts/check-workbench.mjs', 'docs/workbench/MAIN-INTEGRATION.md'].map(ref) },
  { title: '21 · 工作台：部署、停机与跨目录恢复', text: '以仓库为部署单元，保留锁定依赖、各包产物、apps 静态文件、server dist/worker、Windows 终端资源及 evals 源码窄入口。真实服务使用 startServer({ authenticate, ... }) 集成身份与受信模型；faux 或本地免认证开发开关不是多用户部署方案。', steps: ['在新源码目录安装固定依赖、准备模型数据、构建并验收；记录源码提交和包版本。', '停止新请求，await server.close；Windows IPC 宿主发送 pi-workbench:shutdown 并等待正常退出，不以强杀代替停机。', '备份完整仓外 dataRoot；恢复到另一目录必须使用 restore-workbench，避免原生 JSONL 内绝对路径仍指向旧目录。', '先验证会话和配置，再由授权操作者显式恢复 Durable 未完成任务；查看页面和重启不自动续跑。'], commands: [
    { title: '离线恢复到尚不存在的目标目录（替换三个示例路径）', shell: 'powershell', code: "node --import ./scripts/workbench-source-loader.mjs scripts/restore-workbench.mjs 'D:\\backups\\pi' 'D:\\data\\pi' 'D:\\data\\pi-restored'", expected: '验证备份并重写受控路径后发布新目录；不恢复凭据，不跨操作系统转换路径格式。' }
  ], refs: ['deploy/WORKBENCH.md', 'apps/agent-server/src/restore.ts', 'apps/agent-server/native/conpty/README.md'].map(ref) }
];
