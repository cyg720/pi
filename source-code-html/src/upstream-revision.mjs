// Reviewed teaching changes for the 2026-11-07 upstream merge. Historical source tables stay available.
export const upstreamBaseline = 'cf43eea7e741ae899ad4609233084c43ec5274f9';

export const upstreamModules = [
  ['schema', 'Schema · JSON Schema 构造与校验', 'packages/schema/src/', '无 eval 的 JSON Schema 构造、编译、校验与参数转换。', '库能力', 'packages/schema/README.md'],
  ['p2', 'p2 · 实验应用宿主', 'apps/p2/src/', 'Chord v2 插件装配、Web/TUI 入口与会话 worker；官方声明将被替换的实验原型。', '实验原型', 'apps/p2/README.md'],
  ['p2-plugins', 'p2 · 应用插件', 'apps/p2/plugins/', '会话、模型、MCP、环境、终端、文件与子智能体插件。', '实验原型', 'apps/p2/README.md'],
  ['ai-catalog', 'AI · 模型目录生成定义', 'packages/ai/catalog/', 'models.dev v2 等来源、逐 provider 定义、模型家族规则与生成顺序。', '开发工具', 'packages/ai/catalog/README.md'],
  ['chord-examples', '示例 · Chord v2', 'packages/chord/test/examples/', '按层提供对象、持久状态、插件与应用示例。', '示例', 'packages/chord/README.md']
].map(([id, title, root, description, status, doc]) => ({ id, title, root, description, status, doc }));

export const upstreamFeatures = {
  chord: [
    ['contracts', 'Chord v2 对象契约与宿主地址', ['contracts/'], '以 pi-schema 定义 params、members、variants 与版本。', 'local / remote / method / hostKind', 'remote 使用 hostAddress 决定宿主地址；提供远程对象的 host 必须有 address 和 principal。'],
    ['host', 'Facet 声明、Host 激活与引用', ['host/'], '工厂只声明对象，Host 负责激活、失败重试、持有与释放。', 'createHost / defineFacet / host.load / host.get / host.hold / host.root', 'get 等待 live 且状态已就绪；hold 立即给引用，最后释放与调用、job 等持有共同决定存活。'],
    ['state', '持久文档、派生状态与原生资源', ['state/', 'documents/'], 'defineState 声明文档，self.state 取得状态，self.tx 在事务内修改。', 'defineState / self.state / self.derive / self.open / self.on', 'self.open 管理原生资源；watchable 发布失败与恢复。旧版本的命名 cell 迁移接口不能直接复用。'],
    ['links', '远程路由、链路与状态同步', ['link/', 'remote/'], '在浏览器、server、worker 间路由对象引用和调用。', 'memoryLinkPair / ipcLink / webSocketLink / host.route', '断链后引用进入 loading 并可重新绑定；已经发出的调用和远端副作用仍需按结果边界核对。调用响应排在其状态更新之后。'],
    ['reload', '插件重载与旧工作收尾', ['host/reload-cycle.ts', 'node/plugins/'], '插件变更逐宿主展开；受影响对象重新启动。', 'host.reload / createPlugins', '采用 restart-only 重载；旧工作沿旧代码收尾，新对象重新激活，持久数据由 store 保存。不能沿用旧 cell version/migrate 的说明。'],
    ['registry', '注册表贡献与组合', ['registries/'], '插件声明提供者与贡献，通过可观察组合值装配应用能力。', 'defineRegistry / self.registry / host.registry', '注册表跟随生命周期与批次发布；Durable registryReader 可以读取注册表组合。'],
    ['manager', '按地址启动 worker 与基础代码快照', ['node/workers/', 'node/plugins/'], '按 host kind 和地址路由到进程，空闲退出并管理插件代码。', 'createWorkers / workerMain / processLock / createPluginRuntime', 'worker 基础代码在 server 启动时打包；新的 worker 仍使用该快照，基础代码变化需要重启 server。'],
    ['delta', '事务 JSON 增量与不可变应用', ['delta/'], '计算候选变更，采用后发布新的权威值。', 'track / beginChange / prepare / adopt / applyImmutable', 'prepare 不改变权威值，adopt 才切换；传出后不可变是所有权约定。'],
    ['json', 'JSON 边界与带类型错误', ['json.ts', 'data/'], '描述 JSON 值、失败与错误分类。', 'JsonValue / copyJson / ChordError / broken', '在外部输入边界验证；同宿主的已类型化值按不可变约定传递。'],
    ['watch', 'WatchCall 与结束原因', ['watch.ts'], '统一 tagged value/failed 通知、增量合并与永久结束。', 'Watch / NativeWatch / WatchCall / WatchEnd', '监听者接收 call 和 context；retired 是 value 通知字段，不是永久结束。JSON 增量超过 10000 个待处理操作后用根替换；NativeWatch 超过 100 个待处理值时合并。'],
    ['store', '持久 Store、表与批量提交', ['store/'], '保存对象文档、表、事务与任务，供 Durable StoreStorage 复用。', 'openStore / defineTable', '一批存储调用保留各提交的结果；复制是另外的实验 sync 层。'],
    ['app-kit', 'HTTP、应用与 Web/TUI 客户端', ['node/app/', 'node/http/', 'node/surfaces/', 'surfaces/', 'web/', 'react/', 'tui/'], '提供应用装配、身份、设备配对、文件和界面插件基础能力。', 'startServer / startWorker / createHttp / startPage / startTerminal', 'Node 服务端、浏览器与终端入口隔离；应用负责具体工具授权与部署。'],
    ['sync', '实验性 Store 复制', ['sync/'], '将 outbox 提交上传到远端槽位，在副本拉取并折叠快照。', 'uploadSession / pullSession / foldSession / FlushScheduler', '这是实验复制接口，不代表应用自动获得多写入者冲突处理。']
  ],
  durable: [
    ['events', '会话视图与完整 Transcript', ['harness/transcript.ts', 'harness/harness.ts'], '从有界会话视图合并长历史，按需补齐缺口。', 'Conversation.watch / ConversationTranscript / entries / context', 'watchEvents 已移除。默认视图从最新 50 条开始，超过 100 条收缩至 50；模型上下文使用 context()，历史使用 entries()。'],
    ['views', '文档与任务图观察', ['session/session.ts', 'harness/transcript.ts', 'harness/task-graph.ts'], '订阅文档、会话和任务图状态，不再从消息事件组装视图。', 'watchDoc / Conversation.watch / watchTaskGraph', 'WatchCall 以 kind 区分 value 与 failed，WatchEnd 以 kind 区分结束原因；文档退休后地址观察仍可等待新文档。'],
    ['read-only', '只读 Harness 与批量提交接收', ['harness/harness.ts', 'harness/types.ts', 'session/session.ts', 'types.ts'], '只读查看会话；批量存储逐项确认已耐久的提交。', 'HarnessOptions.readOnly / Storage.commit(batches, receive, context)', 'receive(index, seq) 对每个已存批次调用一次；返回 stored/refused。I/O 失败是结果未知，不是业务拒绝；已收到的回执仍有效。'],
    ['crash-guard', '无进展重启上限与运行失败', ['harness/scheduler.ts', 'harness/task-graph.ts', 'harness/harness.ts'], '重启连续到达 restartLimit 后结束任务，公开失败原因。', 'restartLimit / runFailure / compactionFailure', '默认上限 5；任务不再停放，旧 retryTask 已移除。工具返回 restart_limit，重新执行需提交新的工作。'],
    ['group-commit', '分组提交与延迟进度落盘', ['session/session.ts', 'types.ts', 'storage/'], '多个会话共享存储往返；partial 可以先展示再合并落盘。', 'Storage.commit(batches, receive, context) / observeCommits / progress.persistWithinMs', '默认进度最长延迟 1000ms 落盘；崩溃可丢失该窗口的 partial。观察视图不等于耐久回执，observeCommits 只观察已存提交。'],
    ['conversation-control', '继续、轮数上限与运行后任务', ['harness/submissions.ts', 'harness/types.ts', 'harness/generation.ts'], '提供 continue、turnLimit、事务内 submit、afterRun 与逐会话压缩设置。', 'submit(tx, draft) / whenIdle / afterRun / configure({ compaction })', '输入接纳与应用记录可在一个事务内完成；回答已提交后 afterRun 子任务仍可使会话保持忙碌，不能把 Submission.wait 等同于完全 idle。']
  ],
  schema: [
    ['builders', 'JSON Schema 构造与静态类型', ['builders.ts', 'types.ts', 'index.ts'], '构建普通 JSON Schema 并推导 Static 类型。', 'obj / str / num / opt / Static', 'obj 默认拒绝额外字段，open: true 才开放；TypeBox 常用类型可推导，不等于支持所有非 JSON Schema 扩展。'],
    ['validation', '无 eval 校验与参数转换', ['validator.ts'], '编译为闭包并提供 check/errors/validate，可选 coerce/parse。', 'compile(schema, { coerce: true })', 'coerce 只复制变动路径；普通校验不插入 default。外部 schema 的引用策略需要显式选择。']
  ],
  p2: [
    ['hosts', 'Server、会话 worker 与客户端入口', ['hosts/'], '在多个进程中装配 Chord 与 Durable。', 'apps/p2/src/hosts/', 'p2 是上游实验原型，不等于本分支 prototype 或计划中的正式工作台。']
  ],
  'p2-plugins': [
    ['sessions', '项目、会话树与分支', ['sessions/'], '组织项目、会话、分支与 Web/TUI 会话视图。', 'Sessions / SessionTree / /tree / /move', '会话在其 worker 和 store 中运行；前端根据状态观察展示。'],
    ['capabilities', '按插件提供工具与界面', [''], '工具的执行定义与 Web/TUI 呈现由各插件提供。', 'apps/p2/plugins/*/server.ts / worker.ts / web.tsx / tui.ts', '包含模型、MCP OAuth、文件、终端、环境与子智能体；具体启用由插件配置决定，目录存在不表示已在本机运行。']
  ],
  'ai-catalog': [
    ['generation', '目录源、Provider 与模型家族规则', ['generate.ts', 'build.ts', 'define.ts', 'providers/', 'families/', 'sources/'], '聚合所有来源后按 provider 顺序构造、应用共享规则，再 finalize。', 'node packages/ai/catalog/generate.ts', '维护 catalog 定义，再生成 models.generated.ts；生成数据仍不入库。']
  ],
  engineering: [
    ['model-hydration', '模型目录水合与检查', ['check-model-data.ts', 'model-data.ts'], 'hydrate:model-data 调用 catalog/generate.ts --strict --data-only，从目录服务准备生成数据。', 'hydrate:model-data / check:model-data', '需联网访问目录来源；不请求模型推理。生成 models.generated.ts 与仅水合数据是不同操作。']
  ],
  coding: [
    ['edit', 'edit：保留行尾并在写入前计算差异', ['core/tools/edit.ts', 'core/tools/edit-diff.ts'], '仅替换目标内容，保留未变行的 CRLF/LF。', 'edit / computeDiff', '差异围绕变动计算并在写文件前完成，避免大文件写完后才因 diff 内存不足报错。'],
    ['auth', '认证存储与命令行登录退出', ['core/auth-storage.ts', 'core/runtime-credentials.ts', 'cli/auth-command.ts'], '支持 pi auth login/logout，并持久保存刷新凭据。', 'pi auth login / pi auth logout / /login / /logout', '退出等待已开始的 OAuth refresh 保存；离线导览不读取凭据或发起授权。']
  ]
};

export function reviseFeatureSpecs(specs) {
  for (const [module, updates] of Object.entries(upstreamFeatures)) {
    const replacements = new Map(updates.map(spec => [spec[0], spec]));
    const existing = specs[module] || [];
    specs[module] = [...existing.map(spec => replacements.get(spec[0]) || spec), ...updates.filter(spec => !existing.some(old => old[0] === spec[0]))];
  }
}

// Stable numbers retain their old source row; the current reading uses explicitly reviewed v2 topics.
const chordCapabilityTopics = ['contracts', 'host', 'contracts', 'host', 'state', 'host', 'host', 'contracts', 'host', 'host', 'host', 'state', 'state', 'links', 'state', 'state', 'store', 'host', 'registry', 'registry', 'manager', 'reload', 'reload', 'reload', 'reload', 'reload', 'links', 'links', 'links', 'manager', 'manager', 'store', 'delta', 'delta', 'watch', 'watch', 'context', 'json'];
const currentDocPaths = {
  'packages/chord/docs/guide.md': 'packages/chord/docs/guide-plugins-hosts/book.md',
  'packages/chord/docs/spec.md': 'packages/chord/docs/design.md',
  'packages/chord/src/manager.ts': 'packages/chord/src/node/workers/README.md'
};
export function reviseCapability(row) {
  const docs = row.docs.map(path => currentDocPaths[path] || path);
  const number = /^CHR-(\d+)$/.exec(row.id)?.[1];
  const topic = number && chordCapabilityTopics[Number(number) - 1];
  let replacement = topic && upstreamFeatures.chord.find(spec => spec[0] === topic);
  const durableTopics = { 'DUR-01': 'group-commit', 'DUR-21': 'views', 'DUR-22': 'events', 'DUR-23': 'events', 'DUR-48': 'views', 'DUR-57': 'views', 'DUR-69': 'crash-guard', 'DUR-71': 'crash-guard' };
  if (durableTopics[row.id]) replacement = upstreamFeatures.durable.find(spec => spec[0] === durableTopics[row.id]);
  if (!replacement) return { ...row, docs };
  return { ...row, title: replacement[1], purpose: `${replacement[3]} ${replacement[5]} 原编号沿用；旧版原文仅供历史对照。`, entry: row.id === 'DUR-21' ? '`Conversation.watch()`' : replacement[4], docs, status: row.id.startsWith('CHR-') ? '库／Chord v2' : row.status };
}

const step = (title, path, needle, text) => ({ title, path, needle, text });
export const upstreamLessons = {
  chord: {
    intro: 'Chord v2 是已替换旧实现的对象与插件运行时。server、worker、浏览器和终端通过同一对象契约交互；持久状态在 store 中，插件可以按宿主重载。',
    focus: ['对象契约使用 pi-schema 的 params、members、variants 和 hostAddress；principal 与地址参与远程对象定位和权限边界。', '工厂只声明，host 激活；get 等待 live，hold 立即给引用。self.open 管理原生资源，self.state + self.tx 管理持久文档。', '重载重启受影响对象，旧工作使用旧代码收尾。状态恢复依赖 store，而不是旧版 cell 的 version/migrate。'],
    usage: ['先阅读 README 的 Greeter，再运行独立测试环境中的 test/examples/01-objects.ts。', '按 docs/guide-plugins-hosts/book.md 阅读 HTTP、worker 和插件组合。', '结合 p2 了解应用使用方式，但 p2 官方声明为将被替换的实验原型。'],
    config: [['对象', 'createHost、host.load、host.get、host.hold；remote 声明 hostAddress，提供端有 address 和 principal。'], ['持久化', 'openStore、defineTable、defineState；self.tx 提交文档和表。'], ['宿主边界', '/http、/workers、/plugins、/app 为 Node；/web、/react 为浏览器；/tui 区分 launcher 与沙箱。']],
    flow: [step('对象契约', 'packages/chord/src/contracts/index.ts', '', '先明确地址、参数和方法。'), step('宿主与引用', 'packages/chord/src/host/host.ts', 'createHost', '跟踪 load、get、hold 与释放。'), step('持久文档', 'packages/chord/src/documents/index.ts', '', '读取状态声明和事务接口。'), step('插件重载', 'packages/chord/src/host/reload-cycle.ts', '', '区分旧调用收尾与新对象激活。'), step('Watch 与 delta', 'packages/chord/src/watch.ts', 'WatchCall', '区分值、可恢复失败与永久结束。')],
    extend: ['从 defineFacet 和 defineRegistry 组织插件，复用 app kit、HTTP 和客户端 surfaces。', '需要 Durable 时使用 StoreStorage 和 registryReader；复制层 sync 仍为实验接口。'],
    mastery: ['解释一个远程引用如何经过 tab → server → worker。', '解释重载时已开始调用与新调用使用的代码。', '区分持久文档、原生资源、Watch 与审计记录。']
  },
  durable: {
    intro: '持久智能体运行层。输入、工具意图和最终结果经事务保存；流式 partial 可先展示，再按策略合并落盘。它与 CLI 的内存 Agent + SessionManager 是不同运行链。',
    focus: ['Harness 装配模型、registry、storage 和调度；Conversation 是会话句柄，任务有持久检查点。', 'Storage.commit(batches, receive, context) 批量提交，返回 stored/refused；receive(index, seq) 是逐提交耐久回执。', '视图以 Conversation.watch + ConversationTranscript 展示完整历史。默认最新 50 条，超过 100 条收缩；context() 才是模型活动上下文。', 'progress.persistWithinMs 默认 1000ms；崩溃可能丢失尚未落盘的 partial。工具副作用不因事务失败回滚。'],
    usage: ['从 MemoryStorage + Harness.open 的编号示例入门，再换 SQLite、JSONL 或 IndexedDB。', 'Chord 应用可使用 StoreStorage；只读查看使用 readOnly，不恢复执行。', '先跑离线 faux 与存储一致性用例，再验证具体部署的恢复边界。'],
    config: [['提交与观察', '批量 commit 与 observeCommits 面向耐久事实；watchDoc、Conversation.watch 面向可见状态，二者不能混用。'], ['运行控制', 'continue、turnLimit、whenIdle、事务内 submit(tx, draft)、afterRun 和逐会话 compaction。'], ['失败恢复', 'restartLimit 默认 5；达到上限结束并报告失败，旧 retryTask 已移除。未声明 replay: safe 的中断工具不能任意重跑。']],
    flow: [step('装配与输入', 'packages/durable/src/harness/harness.ts', 'Harness', '打开存储与调度。'), step('接纳', 'packages/durable/src/harness/submissions.ts', '', '对照去重、队列与事务内接纳。'), step('提交', 'packages/durable/src/types.ts', 'CommitResult', '核对 batches、receive、拒绝与未知结果。'), step('历史视图', 'packages/durable/src/harness/transcript.ts', 'ConversationTranscript', '合并窗口、补历史缺口。'), step('调度与失败', 'packages/durable/src/harness/scheduler.ts', '', '核对睡眠、恢复与重启上限。')],
    extend: ['defineExtension 组合工具、hooks、sections 与 tasks；工具 schema 使用 pi-schema。', '自定义 Storage 必须实现分组提交并通过 conformance；自定义 ExecutionEnv 单独验证文件和进程语义。'],
    mastery: ['标记输入、工具意图、partial 展示、落盘和最终结果的时刻。', '模拟提交已存但结果未知，以及工具已执行但结果未存的窗口。', '说明 Submission.wait 已返回时 afterRun 工作为何仍能保持会话 busy。']
  },
  schema: {
    intro: 'pi-schema 是本次新增的零依赖 JSON Schema 构造与校验包，编译为普通闭包，不使用 eval。',
    focus: ['构造器返回普通 JSON Schema；Static 推导输入类型。', 'obj 默认封闭；default 是说明，不自动填值。', 'check/errors/validate 与可选 coerce/parse 分开，TypeBox 的非 JSON Schema 功能不能假定仍有效。'],
    usage: ['从 obj({ path: str() }) 开始，compile 后分别检查有效值、缺字段和多余字段。', '模型参数需要转换时显式启用 coerce，并核对转换规则。'],
    config: [['编译', 'draft、formats、schemas、unresolvedRefs 与 coerce。'], ['外部引用', '缺失引用默认抛错；reject 策略只拒绝引用位置的值。']],
    flow: [step('构造类型', 'packages/schema/src/builders.ts', '', '观察普通对象与类型推导。'), step('编译验证', 'packages/schema/src/validator.ts', 'compile', '区分快速检查与错误收集。'), step('公共契约', 'packages/schema/src/types.ts', 'CompileOptions', '核对引用、格式与转换配置。')],
    extend: ['注入格式检查器；外部 schema 与本地构造器共用编译入口。'],
    mastery: ['比较 required、optional 和 null。', '区分 schema 编译错误和输入校验失败。']
  },
  p2: {
    intro: '上游新增的自托管 Durable UI，基于 Chord v2 独立插件，包含 Web 与 TUI。官方明确为将被替换、接口与数据格式不稳定的实验原型。它不是本仓库 prototype，也不是 LG 产品计划已完成。',
    focus: ['server 管理应用与连接，会话 worker 运行 Durable；工具与 UI 由插件提供。', '支持项目/会话树、分支、子智能体、MCP OAuth、环境、终端与文件。', '服务端 owner 具有完整 agent/shell 权限；访问者 TUI 的受限 worker 不等于服务端文件系统隔离。'],
    usage: ['阅读 README 和 docs/p2-notes.md；从 apps/p2 的 npm start 启动，默认 loopback:8788。', '本轮仅更新文档，没有启动服务、创建凭据或执行模型。P2_FAKE 只替换模型，工具仍会操作真实文件。'],
    config: [['服务端', 'Node >=22.19、PORT、P2_DATA_DIR；独立的包检查与测试。'], ['终端', 'TUI launcher 要求 Node >=26.5.1；不能沿用服务端最低版本判断。'], ['插件与部署', '按 README 配置 owner、设备、provider 与环境；这些不自动纳入本分支产品范围。']],
    flow: [step('服务入口', 'apps/p2/src/hosts/server.ts', '', '跟踪 server 与插件装配。'), step('会话插件', 'apps/p2/plugins/sessions/server.ts', '', '读取会话与项目管理入口。'), step('会话执行', 'apps/p2/plugins/sessions/worker.ts', '', '观察 worker 中的 Durable 集成。')],
    extend: ['阅读 docs/tool-ui.md 理解插件拥有的工具 UI；docs/workflows.md 展示 code mode 与子智能体编排。'],
    mastery: ['区分服务端、worker、Web、TUI 四个执行位置。', '比较 p2 与本地 prototype/PRD 的来源和实现状态。']
  }
};

const extensionAnchors = new Map([
  ['Only personal', '#### project_trust'], ['Reconstruct branch-sensitive', '## State Management'],
  ['### Errors and cleanup', '## Error Handling'], ['## Choose an integration point', '## Writing an Extension'],
  ['### Tools', '## Custom Tools'], ['### Events and concurrency', '## Events'], ['### State', '## State Management'],
  ['### Context and session changes', '## ExtensionCommandContext'], ['### UI and modes', '## Mode Behavior'],
  ['## Understand the runtime lifecycle', '## Events'], ['Tool exposure', '### Tool Exposure']
]);

export function reviseReferences(value) {
  if (Array.isArray(value)) return value.map(item => Array.isArray(item) && item[0] === 'packages/coding-agent/docs/extensions.md' ? [item[0], extensionAnchors.get(item[1]) || item[1]] : reviseReferences(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reviseReferences(item)]));
  return value;
}

export function reviseChapters(chapters) {
  return reviseReferences(chapters).map(chapter => {
    if (chapter.id === 'development') return { ...chapter, sections: chapter.sections.map((section, index) => index === 0 ? { ...section, text: '当前 checkout 包含 12 个一级包及 apps/p2 实验应用。01–17 阶段介绍 CLI / SDK 的源码开发；p2 的启动、运行时要求和独立检查见其包教程。旧工作台命令仅保留在历史快照。源码开发先跑 .ts，交付时再构建 dist；命令块只提供复制，不会在阅读器中执行。' } : index === 3 ? { ...section, text: 'providers/data 是 Git 忽略的生成资料，包加载时需要读取它。先运行 check:model-data；缺失或陈旧时运行 hydrate:model-data，当前命令调用 catalog/generate.ts --strict --data-only 从在线目录生成数据，再复查一致性。它不是下载旧版本的固定快照，也不执行模型推理。' } : section) };
    if (chapter.id === 'start') return { ...chapter, sections: [...chapter.sections.filter(s => !['这一版对应哪份源码？', '阅读边界'].includes(s.title)),
      { title: '本次上游合并：1.5.0 + Unreleased', text: '2026-11-07，LG-Workbench / cf43eea7e。合并上游 085c84e98，新增 526 个可达提交。12 个一级包为 1.5.0，apps/p2 为 0.0.1；根包 0.0.3 不是 CLI 版本。', refs: [['source-code-html/UPSTREAM-UPDATE.md', '#'], ['packages/coding-agent/package.json', '"version"']] },
      { title: '阅读边界', text: '当前有 apps/p2 实验原型、Chord v2 和 pi-schema；旧工作台 WBW/WBP/WBS/WBR 仍是另一套历史实现。PRD 与 prototype 属于本地产品计划和静态演示。本导览更新源码快照、中文专题及迁移重点，不声称逐函数审计或已运行各产品。' }] };
    if (chapter.id === 'workbench') return { ...chapter, title: 'p2、原型与历史工作台边界', intro: '按实际文件区分三套不同来源的界面。', sections: [
      { title: 'p2：上游实验原型', text: upstreamLessons.p2.intro, refs: [['apps/p2/README.md', '# p2'], ['apps/p2/src/hosts/server.ts', '']] },
      { title: '本分支 PRD 与 prototype', text: 'PRD 保存 LG 产品需求，prototype 是静态演示；它们已在合并前分批提交，不属于本次上游新增实现。p2 的出现不自动改变这些需求或完成其中的任务。', refs: [['prototype/README.md', '']] },
      { title: '旧工作台历史', text: 'WBW/WBP/WBS/WBR 对应旧 agent-web/server 等实现，不能映射成 p2 已实现功能。', external: [{ title: '2026-10-20 历史快照', url: 'history/workbench-2026-10-20.html' }] }
    ] };
    if (chapter.id === 'advanced') return { ...chapter, intro: '从 Chord v2、Schema 与持久提交边界理解当前架构。', sections: [
      { title: 'Chord v2：对象、地址与插件', text: upstreamLessons.chord.focus.join(' '), refs: upstreamLessons.chord.flow.map(s => [s.path, s.needle]) },
      { title: 'Durable：可见进度与已存结果', text: upstreamLessons.durable.focus.join(' '), refs: [['packages/durable/src/types.ts', 'CommitResult'], ['packages/durable/docs/group-commit.md', '']] },
      { title: '观察、历史和模型上下文', text: upstreamFeatures.durable[0].slice(3, 6).join(' '), refs: [['packages/durable/src/harness/transcript.ts', 'ConversationTranscript'], ['packages/durable/CHANGELOG.md', 'Removed `watchEvents()`']] },
      { title: '崩溃上限不再停放任务', text: upstreamFeatures.durable[3].slice(3, 6).join(' '), refs: [['packages/durable/src/harness/scheduler.ts', 'restartLimit']] },
      { title: 'Schema 与模型目录迁移', text: '工具参数统一使用 pi-schema；旧 TypeBox 非 JSON Schema 扩展不能假定有效。模型生成入口迁到 packages/ai/catalog/generate.ts，provider、family 与 source 分层维护。', refs: [['packages/schema/README.md', '## Usage'], ['packages/ai/catalog/README.md', '## Build order']] },
      { title: 'Env、Windows 与远程终端', text: 'Env 继续负责 SSH、文件、进程与远程终端。Windows 与 POSIX 的进程清理边界不同；上游修复宿主失联时 Stop/timeout 不结束的问题。本轮没有启动 SSH、daemon 或真实终端验收。', refs: [['packages/env/README.md', ''], ['packages/env/CHANGELOG.md', '']] },
      { title: '新增 p2 与现有 CLI 分开阅读', text: upstreamLessons.p2.intro, refs: [['apps/p2/README.md', '# p2'], ['packages/coding-agent/src/core/sdk.ts', 'createAgentSession']] }
    ] };
    return chapter;
  });
}

export function reviseRoutes(routes) {
  return routes.map(route => {
    if (route.id === 'durable-basics') return { ...route, steps: route.steps.map((s, i) => i === 3 ? { ...s, title: '区分可见状态与耐久提交', explain: '文档观察可以先显示 partial，observeCommits 才观察已存提交。对照分组提交的 receive 回执核对恢复边界。', input: '可见状态与存储回执', output: '已存提交和待落盘进度' } : s), answer: '同一事务的变更保持原子性；可见进度不等于已落盘，外部副作用也需应用另外保证。' };
    if (route.id === 'durable-submission') return { ...route, steps: route.steps.map((s, i) => i === 3 ? { ...s, explain: 'partial 可先展示、在默认 1000ms 内合并落盘；最终响应与运行后任务有独立提交点。' } : s), extra: [...route.extra, 'durable-conversation-control', 'durable-group-commit'] };
    if (route.id === 'chord-objects') return { ...route, title: 'Chord v2 契约、宿主地址与对象激活', exercise: '阅读 Greeter 与对象示例，比较 get 与 hold，再逐个释放引用。', answer: '工厂只声明；host 激活，get 等待 live，hold 返回可观察引用。释放须结合调用、job 与剩余持有。', steps: route.steps.map((s, i) => ({ ...s, explain: [upstreamLessons.chord.focus[0], upstreamLessons.chord.focus[1], s.explain, '用 self.open 管理原生资源；结合 root、依赖引用、在途调用与 job 核对最终释放时机。持久文档的保存和原生资源的关闭是不同边界。'][i] })) };
    if (route.id === 'chord-state') return { ...route, title: '持久文档、delta 与 Watch', failure: 'Watch 可以合并中间值；视图不是无损审计流。需要已存提交时使用对应持久观察接口。', steps: route.steps.map((s, i) => i === 3 ? { ...s, title: '观察状态与失败', feature: 'chord-watch', explain: upstreamFeatures.chord.find(f => f[0] === 'watch')[5] } : s) };
    if (route.id === 'chord-links-reload') return { ...route, scenario: '插件变化后重启受影响对象，持久状态保留，旧调用沿旧代码收尾。', failure: '断线后的引用可重新绑定，但不能推断远端副作用未发生；基础代码变化需要重启 server。', exercise: '沿 reload-cycle 和 worker README 区分对象重启、插件变化与基础代码重启。', answer: '旧工作在旧代码上收尾；新对象重新激活；store 持久数据与基础 bundle 有不同生命周期。', steps: route.steps.map((s, i) => ({ ...s, title: ['跨宿主路由', '注册表组合', '启动地址 worker', '重启受影响对象'][i], explain: upstreamFeatures.chord.find(f => f[0] === ['links', 'registry', 'manager', 'reload'][i])[5] })) };
    if (route.id === 'durable-storage') return { ...route, steps: route.steps.map((s, i) => i === 0 ? { ...s, feature: 'durable-group-commit', explain: upstreamLessons.durable.focus[1] } : s), extra: [...route.extra, 'durable-conversation-control'] };
    if (route.id === 'read-map') return { ...route, extra: [...route.extra, 'schema-builders', 'schema-validation', 'p2-hosts', 'p2-plugins-sessions', 'p2-plugins-capabilities', 'ai-catalog-generation', 'chord-store', 'chord-app-kit', 'chord-sync'] };
    return route;
  });
}
