// 课程按照学习依赖组织，流程步骤是教学追踪顺序，不宣称每条分支都会执行。
export const masteryStages = [
  { id: 'foundations', title: '01 读码基础', goal: '看懂目录、入口和类型，能够在本地定位一次调用。' },
  { id: 'models', title: '02 模型与配置', goal: '能够配置一个模型，并解释设置、凭据和请求如何关联。' },
  { id: 'conversation', title: '03 完整对话', goal: '从用户输入跟到模型、工具、会话和界面，解释失败与恢复。' },
  { id: 'tools', title: '04 工具与外部服务', goal: '理解本地工具、MCP 和脚本执行的能力边界。' },
  { id: 'extensions', title: '05 扩展与界面', goal: '使用扩展、SDK 和 RPC 定制行为，读懂终端输入输出。' },
  { id: 'durability', title: '06 持久化与跨进程', goal: '解释事务、任务恢复、对象句柄、状态同步和远程执行。' },
  { id: 'verification', title: '07 测试与排错', goal: '用确定性测试、日志与评测定位问题，而不是猜测。' },
  { id: 'mastery', title: '08 独立改造', goal: '完成可复现、可验证、可交付的一次源码改造。' }
];

export const masteryGlossary = [
  ['包 / package', '一组有自己 package.json 的代码。目录存在不一定代表当前还有可运行的包。'],
  ['入口 / entry', '外部开始调用代码的位置。CLI 入口、包 exports 和内部函数是不同层次。'],
  ['参数与类型', '参数是传给函数的数据，类型说明允许的形状。问号表示可以省略，默认值还要看实现。'],
  ['状态 / state', '程序在某一时刻保存的数据。内存状态与写入磁盘的状态寿命不同。'],
  ['事件 / event', '程序报告已经发生或正在发生的事情。订阅者是否会被等待要看具体契约。'],
  ['异步 / Promise', '操作稍后才有结果。await 等待这个结果，不代表其他任务都停止。'],
  ['流 / stream', '一段段到来的结果。最后完成消息与中间增量不能混为一谈。'],
  ['提供商 / provider', '模型目录、认证和请求实现的组合。模型 ID 只有放在提供商语境中才完整。'],
  ['工具 / tool', '模型提出调用请求，宿主验证参数并执行代码，再把结果交回模型。'],
  ['上下文 / context', '随场景变化的词。模型上下文是消息与工具，Chord Context 则携带取消和调用数据。'],
  ['会话 / session', '一次持续交互的记录与相关状态。恢复会话需要重建实际使用的上下文。'],
  ['轮次 / turn', '一次模型响应及其相关工具处理。一次用户输入可能引发多个轮次。'],
  ['Schema', '可在运行时检查数据结构的规则，和只在编译时检查的 TypeScript 类型需要区分。'],
  ['Hook', '程序在规定阶段调用的扩展回调。返回值、异常、等待和取消都有明确契约。'],
  ['事务 / commit', '把一组变更作为一个原子操作提交。外部网络或进程副作用不自动随它回滚。'],
  ['重放 / replay', '根据已保存的历史恢复计算。工具能否重新执行取决于幂等性与恢复策略。'],
  ['句柄 / handle', '访问对象的引用。句柄背后的对象可以在另一个进程，也有明确生命周期。'],
  ['断点', '让程序在特定代码位置暂停，以检查输入、状态和调用栈。'],
  ['测试替身 / faux', '用确定的模拟响应代替真实模型，便于验证顺序、取消和错误。'],
  ['静态引用', '从 import 等代码关系得到的文件关联。它不能证明某次运行真的经过这条路径。']
];

// 每步：标题、已核验专题 ID、需要执行的阅读动作、进入时的数据、完成后的数据或认识。
const step = (title, feature, explain, input, output) => ({ title, feature, explain, input, output });
const route = (id, stage, title, prerequisite, scenario, steps, failure, exercise, answer, extra = []) => ({
  id, stage, title, prerequisite, scenario, steps, failure, exercise, answer, extra
});

export const masteryRoutes = [
  route('read-map', 'foundations', '从目录找到功能与公开入口', [], '你看到 packages 下许多目录，需要知道改一个功能应从哪个包进入。', [
    step('识别工作区和包清单', 'engineering-checks', '打开根 package.json 的 workspaces，再看一个子包的 exports。把发布入口和源码实现分别记在笔记中。', '仓库根目录', '工作区、包名和公开入口清单'),
    step('区分产品装配与执行循环', 'coding-sdk', '从 createAgentSession 看到产品如何创建模型运行时、设置、资源和会话，再辨认 Agent 与 AgentSession 的职责。', '一个 SDK 调用', '产品装配依赖图'),
    step('沿导入找到下一层', 'agent-loop', '打开 Agent 的调用和 agent-loop 实现，按一次 prompt 找到模型请求边界与工具处理。先跟成功路径，再看其他分支。', 'Agent.prompt', '一轮模型与工具循环'),
    step('用类型确认数据形状', 'ai-contracts', '对照 Message、Tool 和事件的联合类型。找到 role/type 等判别字段，解释每个分支接收什么数据。', '类型声明和实现', '输入、输出及事件词汇表')
  ], '旧目录可能只有 README 或被忽略的 dist。先核对 package.json 与当前 src，不按旧接口推断新实现。', '任选一个编号功能，从编号打开专题、源码、依赖和测试，记录至少两个跨文件引用。', '应能区分源码文件的静态引用与实际运行调用，并说明公开 exports 和内部声明的差别。'),
  route('source-debug', 'foundations', '本地源码启动与第一次断点', ['read-map'], '你改了 TypeScript 文件，却发现启动的 pi 没有变化。', [
    step('检查运行前置条件', 'engineering-model-hydration', '先检查 Node 与依赖版本，再核对模型数据是否齐全。理解 hydrate:model-data 与单纯安装依赖解决的是不同问题。', '源码工作区', '可定位的环境与数据问题'),
    step('启用源码解析器', 'coding-source-checkout', '从本地开发说明复制 source-resolver 的启动方式，检查包名导入实际解析到 src。不要把全局 pi 当成当前源码。', 'Node 与源码路径', '明确的源码入口'),
    step('观察启动参数', 'coding-startup', '在 src/cli.ts 和 main 的参数处理附近下断点，先用 --help 或 --version 观察入口，再进入需要模型的流程。', 'process.argv', '解析后的参数与模式'),
    step('完成一个最小验证', 'engineering-checks', '选择相关定向测试，记录预期与实际。缺依赖时先记录真实报错，不能通过删掉校验绕过。', '一个可复现修改', '测试结果与环境记录')
  ], '缺模型数据可能在 CLI 加载阶段报错。断点未命中也可能是启动了 dist 或全局安装，而非这份 src。', '让断点停在当前工作区的 cli.ts，记下绝对路径、argv 和调用栈。暂不调用真实模型。', '应证明运行的是源码路径；仅看到版本字符串不足以证明后续模型调用、工具和断点都可用。'),
  route('config-scope', 'models', '设置从哪里来，如何生效', ['source-debug'], '你修改了项目设置，但新会话没有按预期采用这些值。', [
    step('确定目录与作用域', 'coding-settings', '先确认 cwd 和 agentDir。对照 configuration.md，分别找到用户 settings.json 与项目 .pi/settings.json。', 'cwd、agentDir', '两层配置来源'),
    step('检查项目加载条件', 'coding-trust', '跟踪项目是否已受信任，辨认项目资源加载和上下文文件发现的差别。sessionDir 有定位会话所需的特殊读取时机。', '项目路径与信任状态', '允许加载的项目资源'),
    step('解析设置与配置值', 'coding-settings', '进入 SettingsManager 和 resolve-config-value，区分结构合并、字面值、环境变量和命令值。不要只看最终 JSON 猜执行时机。', '配置文件与覆盖选项', '运行时设置'),
    step('核对 Schema 和消费位置', 'coding-config-schemas', '查看 schema 中的字段、枚举与默认说明，再找到读取该字段的实现。保存设置后核对是否需要 /reload 或新建会话。', '一个具体配置字段', '字段校验、生效阶段和验证方法')
  ], '项目没有受信任、目录选错、字段拼写错误或仅修改默认值而未改变当前会话，都可能造成“设置没生效”。', '选择 defaultTools 或 tuiMode，记录它的用户配置、项目配置、CLI 覆盖及最后的消费位置。', '答案需要给出实际作用域和读取时机，不能简单断言所有配置都遵循同一种覆盖或重载规则。'),
  route('model-connect', 'models', '配置一个 AI 模型并完成选择', ['config-scope'], '你有订阅、API key 或本地兼容端点，希望 Pi 能选中并调用它。', [
    step('选择连接方式', 'coding-models', '先在 models.md 对照内置提供商、订阅登录、本地 llama.cpp 和兼容端点。只有缺少所需端点时才添加 models.json。', '已有服务与认证方式', '内置、兼容或自定义提供商方案'),
    step('准备认证入口', 'coding-auth', '阅读 /login 与 AuthStorage，辨认 runtime key、auth.json、models.json 和 provider 环境来源。凭据与模型元数据分开处理。', '提供商标识和凭据来源', '可用的认证上下文'),
    step('注册模型元数据', 'coding-models', '在 ModelConfig 与 provider composer 中追踪 baseUrl、api、models 和 modelOverrides。用真实 schema 校验，不凭服务名称猜兼容参数。', 'models.json 或内置目录', 'provider 下的模型记录'),
    step('选择模型和推理级别', 'coding-catalog-refresh', '从 /model 的刷新和筛选进入运行时。区分聊天模型与分类、图像目录，核对可用认证与模型支持的 thinking 级别。', '模型目录和认证状态', '本轮使用的模型与推理选项'),
    step('确认会话采用的值', 'coding-sdk', '回到 createAgentSession，核对显式 model、设置默认值以及恢复会话的选择。把最终 model.provider、id 和请求接口对应起来。', '显式参数、默认设置或恢复记录', 'AgentSession 实际模型')
  ], '能在目录中找到模型不代表凭据有效。模型 ID、端点 API、能力和认证不匹配应分别定位，不能一律归结为网络失败。', '用文档中的本地兼容端点示例解释每个字段，并追到 ModelConfig 和最终会话模型。没有服务时只完成配置追踪，不宣称调用成功。', 'baseUrl 是请求目的地，api 是协议适配器，id 是提供商模型标识。认证可用性、目录存在和真实请求成功是三个独立检查点。', ['coding-llama', 'coding-config-schemas']),
  route('auth-lifecycle', 'models', '认证、OAuth 与凭据刷新', ['model-connect'], '第一次登录成功，但后续请求或远程环境中的登录失败。', [
    step('区分凭据类型', 'ai-auth', '从 credential 类型和存储接口开始，分辨固定 API key 与会过期的 OAuth 凭据。避免把 UI 显示的已登录当作永远可用。', '登录方式', '凭据类型和存储归属'),
    step('追踪授权交互', 'ai-chatgpt-login', '对照回调、state 和 token 获取的实现。授权地址、回调监听与凭据写入分属不同阶段。', '授权请求', '可保存的授权结果'),
    step('处理远程与复制代码场景', 'ai-oauth-remote', '查看无法在当前主机接收浏览器回调时的交互分支，辨认用户输入与自动回调的验证要求。', '浏览器与 CLI 所在环境', '经过验证的授权完成信号'),
    step('在请求时解析凭据', 'coding-auth', '回到运行时的凭据解析，检查刷新、注销和替换如何影响下一次请求。读取失败与供应商拒绝应保留各自错误。', '保存的凭据与当前时间', '本次请求可用凭据或明确错误')
  ], '回调到达、token 获取、凭据保存与后续刷新都有独立失败点；不要在日志或练习笔记中输出真实密钥。', '在现有认证测试中找一个成功刷新和一个失败分支，画出旧凭据到新凭据的变化。', '应能说明谁负责保存、谁负责刷新，以及失败是否留下原凭据；答案必须对应所选提供商的实现。', ['ai-federation', 'coding-radius-login']),
  route('provider-request', 'models', '模型目录到供应商请求与流事件', ['model-connect'], '同一个应用消息需要经过不同供应商 API，并保持统一的上层事件。', [
    step('建立 provider 集合', 'ai-catalog', '阅读 Models 的目录注册、查找和刷新接口，区分静态目录与动态刷新。按凭据变化的目录需要重新检查可用项。', 'provider 与模型定义', '可查询的 Models 集合'),
    step('整理统一消息', 'ai-contracts', '确认 system、user、assistant 和 toolResult 的形状以及工具声明。转换前保留角色、关联 ID 与内容块。', '应用消息和工具', '统一请求上下文'),
    step('转换具体协议', 'ai-api', '选一份 API 实现跟踪消息、采样与推理参数的转换，再比较另一份实现。统一选项不保证供应商接受完全相同的字段。', '模型和标准上下文', '供应商请求体'),
    step('消费增量并结束', 'ai-utilities', '观察文本、思考和工具参数的增量事件，等到完成后再消费完整结果，并读取 stopReason、usage 与错误。', '供应商流响应', '统一 AssistantMessage 与结束原因')
  ], '半截工具 JSON 不具备可执行保证。中止、网络失败、协议错误和正常停止的结果应区别处理。', '跟踪一次包含 toolCall 的响应，写出调用 ID、参数何时完整、何时可以验证执行。', '执行点必须位于参数完成并校验之后；文本增量和工具参数增量都不能当作最终消息直接持久消费。', ['ai-openrouter-catalog', 'ai-strict-tools', 'ai-compat', 'ai-cli', 'coding-http', 'engineering-catalog']),
  route('special-models', 'models', '虚拟路由、分类模型与图像模型', ['provider-request'], '一次对话需要按内容选择模型，或在脚本中调用分类和图像生成。', [
    step('选择操作类型', 'ai-classifiers', '区分聊天、分类与图像操作，检查模型对应的目录和输入契约。分类回答结构化问题，不进入普通聊天模型选择器。', '任务目标', '聊天、分类或图像操作'),
    step('跟踪虚拟模型决策', 'coding-virtual', '阅读 route 决策怎样选出真实模型，并确认上一次响应和路由原因进入决策的位置。', '请求上下文与路由规则', '实际请求目标'),
    step('执行分类与图像调用', 'coding-codemode-models', '从脚本 models.classify / generateImages 跟到 model runtime，检查输入、结果、用量与失败分支。', '结构化问题或图像输入', '分类答案或图像块'),
    step('处理返回与展示', 'coding-output-files', '区分传给模型的内容、工具 details、完整输出文件和显式图像落盘路径。不要假设生成图像自动写入磁盘。', '脚本结果与图像块', '模型可见输出和可追踪用量')
  ], '分类和图像模型的认证、输入能力与聊天模型不同。正确的模型 ID 也可能不支持当前操作或图片输入。', '对照一个虚拟模型示例与一个 codemode 分类示例，记录两个地方的模型选择对象和结果形状。', '路由决定聊天请求目的地；分类/图像调用返回各自类型的结果。用量需要经过集成层汇入会话统计。', ['ai-images']),
  route('prompt-resources', 'models', '系统提示、上下文文件、技能与模板', ['config-scope'], '你希望给项目加入固定约定和可复用提示，同时知道哪些内容真的进入模型。', [
    step('发现资源并核对来源', 'coding-resources', '查看 DefaultResourceLoader 的资源发现与来源记录。先分清用户、项目、包和显式 CLI 路径。', '资源目录与配置', '已发现的资源及冲突诊断'),
    step('组装系统提示', 'coding-system', '查看 SYSTEM.md、APPEND_SYSTEM.md、上下文文件与工具说明如何影响系统提示。对照信任和同名覆盖规则。', '指令文件与工具环境', '本轮系统提示'),
    step('使用技能与提示模板', 'coding-skills', '比较技能发现、按需正文与提示模板展开。阅读名称冲突、参数替换和手动调用的入口。', '技能名或模板命令', '展开后的用户输入或指导内容'),
    step('刷新并核对实际消息', 'coding-templates', '修改后沿 /reload 与下一次 prompt 检查展开结果。以最终上下文为证据，避免只看文件保存就认为生效。', '更新后的资源', '实际进入本轮的消息内容')
  ], '资源发现成功不等于所有正文每轮全部发送。名字冲突、路径、模板参数与项目信任会影响结果。', '制作一个不调用模型的模板展开例子，标出参数替换前后的文本，并说明技能与模板的区别。', '模板主要展开调用文本，技能有自己的发现和加载语义；是否进入当前请求应以资源加载和消息组装结果确认。'),
  route('package-resources', 'models', '安装资源包到加载与重载', ['prompt-resources'], '你安装了一个 Pi 包，希望知道资源何时被发现、启用和替换。', [
    step('解析包来源', 'coding-packages', '从 install/update/list 的命令入口追踪包声明与来源，区分安装位置和配置中选择的资源。', '包声明', '可定位的包来源和安装结果'),
    step('筛选包内资源', 'coding-resources', '查看扩展、技能、模板和主题如何从包中发现，核对用户配置中的启用、屏蔽与路径。', '安装内容与资源配置', '本次加载资源集'),
    step('合并内置与用户扩展', 'coding-builtin', '理解 builtin 资源标识与内置扩展装配，确定替换或禁用的规则。', '内置扩展和用户资源', '实际注册的扩展'),
    step('触发重载并验证', 'coding-extensions', '沿 reload 检查旧资源清理、新资源注册和诊断。用可观察注册结果确认新版本确实生效。', '资源版本变化', '新的扩展运行时与诊断')
  ], '安装命令成功不能证明资源已启用。更新包、修改选择和重新加载是需要分别验证的阶段。', '选一个现有扩展示例，记录发现路径、注册入口、启用条件及重载后的验证方式。', '答案应指出实际资源来源和注册结果，不能仅以 node_modules 中存在文件作为加载成功证据。'),
  route('conversation-start', 'conversation', '一次对话的启动与会话装配', ['model-connect', 'prompt-resources'], '你从终端输入一句话，希望知道从 CLI 到 AgentSession 发生了什么。', [
    step('解析命令行和模式', 'coding-startup', '从 cli.ts 进入 main，查看参数诊断、text/json/rpc 模式与一次性输出选择。', '命令行参数与标准输入', '模式、消息与资源选项'),
    step('准备附件与输入', 'coding-input', '跟踪 @path、管道与图片内容处理，区分文件内容、提示文本和图像块。', '用户输入和附件', '可交给会话的输入'),
    step('创建或恢复会话', 'coding-sdk', '在 createAgentSession 看 ModelRuntime、SettingsManager、SessionManager 和 ResourceLoader 的装配关系。', '已解析选项与现有记录', '可运行的 AgentSession'),
    step('绑定运行模式与事件', 'coding-interactive', '交互模式把输入组件与 session.prompt 接起来，并订阅会话事件显示结果。一次性和 RPC 模式使用各自消费者。', '会话实例', '输入通道与事件消费者')
  ], '入口参数错误应在模型请求前暴露。恢复会话时保存的模型不可用可能走回退分支，需要读取提示信息。', '给出一张自己的装配清单：谁创建模型运行时、谁保存会话、谁显示事件。', 'AgentSession 负责产品流程，Agent 负责循环，显示由运行模式负责。对象创建顺序和一次请求的执行顺序应分开记录。', ['coding-print', 'coding-rpc']),
  route('conversation-round', 'conversation', '从一句输入到模型回答和工具续轮', ['conversation-start', 'provider-request'], '输入“读取配置并解释”，模型需要先调用工具再回答。', [
    step('处理用户输入并准备运行', 'coding-prompt', '进入 AgentSession.prompt，辨认命令、扩展输入处理和真正开始运行的条件；自定义消息也有运行准备入口。', '用户消息', '本轮输入和运行准备状态'),
    step('构造模型上下文与工具集', 'coding-loadout', '核对当前工具暴露和 Loadout，再追踪上下文转换。模型看到的声明与宿主可执行工具必须保持对应。', '会话消息与已注册工具', '本次请求的消息和工具声明'),
    step('调用模型并收集完整消息', 'agent-loop', '沿请求准备、流事件到 assistant 完成，标出消息入状态与工具预检之间的屏障。', '请求上下文', '文本或 toolCall 的完整 assistant 消息'),
    step('执行工具并决定下一轮', 'agent-run-tool', '跟踪参数验证、before/after hook、工具执行和结果。工具结果回到上下文后，循环再请求模型或按结束条件退出。', '工具名、调用 ID 和参数', 'toolResult 与续轮决定'),
    step('保存并更新界面', 'coding-sessions', '把事件消费者、会话追加和最终显示对照起来，确认哪些数据是增量、哪些已经成为记录。', '消息与工具完成事件', '会话历史和可见回答')
  ], '工具失败、模型错误、用户取消和正常完成是不同结束原因。工具返回 terminate 也要结合整批结果判断。', '列出这次输入产生的 user、assistant(toolCall)、toolResult、assistant(answer)，为每个记录写出产生者和关键关联字段。', 'toolCallId 将调用与结果关联；一个输入可包含多个模型轮次。工具完成事件顺序和最终消息顺序在并行模式中可能不同。', ['coding-run-triggers']),
  route('queue-cancel', 'conversation', '忙碌时输入、取消与运行收尾', ['conversation-round'], '模型或工具仍在运行时，用户补充要求或按下取消。', [
    step('区分输入队列', 'coding-prompt', '追踪 steer 与 followUp 的入口和队列模式，确认它们在哪个边界参与下一轮。', '运行中的 Agent 与新增消息', '待处理队列'),
    step('观察工具批次', 'agent-loop', '阅读并行与顺序模式，分别记录预检、执行完成和 toolResult 发出的顺序。', '多个 toolCall', '完成事件和最终结果顺序'),
    step('传播取消信号', 'agent-run-tool', '从 abort 到工具 signal 的消费位置，核对可中断操作和已经发生的副作用。', 'AbortSignal', '取消结果或已完成结果'),
    step('等待实际收尾', 'coding-program-status', '比较 agent_end、agent_settled 与 waitForIdle，观察异步订阅者是否仍在完成工作。', '循环终止与订阅者工作', '稳定的空闲状态和程序状态')
  ], '取消不会自动撤销已写文件。agent_end 发出也不一定说明所有被等待的订阅者已经结束。', '用 faux 测试设计：一个慢工具、一个快工具、一个排队输入；写出事件与消息的预期顺序。', '并行完成事件可按完成顺序发出，结果消息保持源顺序；下一轮取队列受模式和循环轮询点控制。'),
  route('session-restore', 'conversation', '保存、恢复、分叉与历史树', ['conversation-round'], '退出后继续之前的对话，或从旧消息开始探索另一条路线。', [
    step('识别记录类型', 'coding-sessions', '阅读 session-format，区分 header、message、模型变化、压缩与自定义条目，找到 id 和 parentId。', '会话 JSONL', '有父子关系的条目树'),
    step('定位当前分支', 'coding-branch', '沿 /tree、/fork 和分支切换找到当前叶节点；区分新建文件与在同一树中切换。', '目标历史节点', '新的活动分支'),
    step('重建模型上下文', 'coding-sessions', '从当前叶向前追溯，确认摘要和消息如何投影成上下文；文件所有行不等于当前请求所有消息。', '分支路径与摘要', '当前会话上下文'),
    step('恢复扩展状态', 'coding-extensions', '查看扩展 session_start / session_tree 等事件，使用保存条目重建状态，避免仅依赖进程内变量。', '恢复的会话和扩展条目', '与活动分支对应的运行状态')
  ], '保存成功不保证所有外部资源还能用。恢复时模型、扩展版本与工作目录变化都需要单独诊断。', '创建一条三条消息的纸面会话树，在第二条处分叉，标出两个叶节点分别会读取哪些条目。', '应沿各自 parentId 路径构建上下文，不能简单把整个 JSONL 文件顺序拼接。'),
  route('context-budget', 'conversation', '上下文压缩、重试与缓存统计', ['session-restore'], '对话很长，模型上下文溢出，或你想解释缓存用量。', [
    step('测量上下文和阈值', 'coding-compaction', '区分主动压缩、阈值触发和溢出后的恢复路径，查看保留最近内容和摘要输入的选择。', '历史消息与 token 估计', '压缩决策和待摘要内容'),
    step('保存摘要并重建', 'coding-compaction', '检查压缩结果条目和保留边界，跟踪下一轮上下文使用什么内容。摘要不应被理解为删掉全部原始历史。', '摘要结果', '可继续请求的上下文'),
    step('区分重试与新输入', 'ai-utilities', '查看可重试错误、退避、取消和最大延迟；把供应商重试与产品的上下文恢复分开标注。', '请求错误与重试策略', '再次请求或明确失败'),
    step('观察缓存和用量', 'coding-cache', '检查适用模型的预热条件、缓存统计和累计用量。不同模型的缓存能力与保留期不相同。', '模型能力和 usage', '缓存命中与会话用量记录')
  ], '摘要生成也可能失败或被取消。不能以估算 token 数量承诺所有供应商都接受请求。', '画出“正常响应、溢出后压缩、网络重试”三条分支，标记哪些会修改会话记录。', '压缩改变后续上下文构造；传输重试不等于用户又输入了一条消息；缓存统计来自适用的返回与记录。'),
  route('export-dialogue', 'conversation', '从消息到终端、JSON 与 HTML 导出', ['session-restore'], '同一段会话需要交互显示、给其他程序处理或离线分享。', [
    step('订阅结构化事件', 'coding-print', '观察 print 模式如何等待完成并输出 text/json，记录标准输出中哪些内容适合机器消费。', '会话事件', '文本或 JSON 记录'),
    step('渲染消息与工具', 'coding-components', '找到 user、assistant、tool result 组件与工具 renderer，区分 details 和给模型的 content。', '消息和显示细节', '终端可见内容'),
    step('导出当前会话', 'coding-export', '追踪 HTML exporter 与模板，检查嵌入资源、会话数据和自定义渲染的边界。', '会话文件与资源', '独立导出文档')
  ], '外观相同不代表数据相同；终端渲染、模型上下文和导出内容有各自转换层。', '选一个工具结果，分别记录模型 content、UI details 和导出结果如何处理。', '答案应引用对应 renderer / exporter，不能假设所有 details 都作为模型消息发送。'),
  route('file-tools', 'tools', '查找、读取、编辑与写入文件', ['conversation-round'], '模型要在仓库里定位代码并修改一段文本。', [
    step('搜索入口与路径', 'coding-find', '比较 find 的文件匹配与 ls 的目录列举，检查 cwd、路径展开和输出限制。', '路径与模式', '候选文件列表'),
    step('定位内容', 'coding-grep', '阅读搜索后端、忽略规则和截断逻辑，记录匹配行与路径，避免从截断输出推断不存在。', '搜索表达式与候选目录', '带位置的匹配'),
    step('读取目标片段', 'coding-read', '检查文本行范围、字节限制与图片路径处理，读取修改前的真实内容。', '文件与范围', '文本或图片结果'),
    step('执行修改并验证', 'coding-edit', '对比精确文本替换与 write 覆写语义，核对换行处理、匹配失败及差异输出，再运行相关测试。', '确认过的旧文本和新文本', '文件变化与可核验差异')
  ], '匹配失败必须重新读取；全文 write 与局部 edit 的影响不同。文件工具不提供自动版本回滚。', '在临时示例文件上分别设计匹配成功、匹配不到与歧义匹配三种测试输入。', '预期应从具体工具实现和测试取得；不要用模糊猜测的旧文本继续修改真实文件。', ['coding-ls', 'coding-write', 'coding-tool-support']),
  route('process-tools', 'tools', '命令执行、取消与大输出文件', ['file-tools'], '运行测试产生大量输出，并且可能超时或被取消。', [
    step('选择执行器', 'coding-bash', '检查 cwd、shell、超时与环境设置，区分终端 ! 命令和模型工具调用入口。', '命令与执行选项', '已启动进程'),
    step('跟踪平台差异', 'coding-powershell', '阅读 PowerShell 工具与平台选择规则，确认编码、进程终止和错误格式。', '目标平台', '对应的执行路径'),
    step('收集与限制输出', 'coding-output-files', '跟踪截断结果、完整输出文件及其清理生命周期，分别记录 exit code、stdout/stderr 和提示信息。', '进程输出与退出状态', '模型结果和完整输出引用'),
    step('完成取消与收尾', 'coding-program-status', '观察取消信号、后台状态与结果发出，检查进程是否仍存活而不只看界面提示。', '超时或用户取消', '实际运行状态')
  ], '命令失败不代表无副作用，截断也不代表完整日志已丢失；应根据返回的文件引用继续定位。', '阅读现有测试中超时和大输出用例，写出应断言的退出状态、截断标记和文件可读性。', '有效验证同时观察结果和进程生命周期，不能只匹配一段“已取消”文本。'),
  route('tool-exposure', 'tools', '工具选择、搜索、Loadout 与嵌套钩子', ['file-tools'], '可用工具很多，希望模型按需要发现，同时所有调用都经过同一条校验管线。', [
    step('确定工具注册与启用', 'coding-tool-selection', '区分已注册工具、默认工具和启用集合，检查命令与设置如何调整。', '工具注册与设置', '当前可用工具集合'),
    step('组织请求中的声明', 'coding-loadout', '跟踪 Loadout 选择和声明构造，明确本轮模型实际看到什么。', '可用工具与运行状态', '请求工具声明'),
    step('按需发现工具', 'coding-tool-search', '检查名称、描述搜索结果与暴露方式，区分发现工具与真正执行工具。', '工具查询', '可选择的工具描述'),
    step('保持嵌套调用一致', 'coding-nested-tools', '从 MCP/codemode 嵌套调用跟到 runToolCall，确认前后 hook、参数验证与错误结果仍然发生。', '嵌套工具调用', '一致的调用结果和事件')
  ], '直接调用 execute 会跳过统一管线。模型看到声明也不意味着工具在所有运行阶段都允许执行。', '设计一个 beforeToolCall 阻止调用的测试，分别从普通工具和嵌套入口触发。', '两条入口都必须体现同一阻止结果；如果只测普通调用，会漏掉嵌套绕过。'),
  route('mcp-connect', 'tools', 'MCP 配置、连接、发现与重连', ['tool-exposure'], '把一个本地 stdio 服务或远程 HTTP 服务接入会话。', [
    step('读取服务配置', 'coding-mcp-config', '沿 mcp.json 的作用域和 schema 检查传输、命令、URL 与环境配置。', '服务配置', '可连接的服务定义'),
    step('建立协议连接', 'mcp-client', '查看 client 初始化与 stdio/http transport，区分启动进程、协议握手和能力发现。', '传输和会话参数', '已初始化客户端'),
    step('合并工具与资源', 'coding-mcp-runtime', '观察服务状态、工具列表与资源注册进入产品的过程，区分 MCP 名称和本地暴露名称。', '远端能力列表', '产品中的 MCP 能力'),
    step('刷新或断开', 'coding-mcp-management', '跟踪管理命令、重连、取消和清理，确认旧客户端与失效能力不继续被使用。', '配置变化或连接错误', '新的连接状态与诊断')
  ], '进程启动成功不等于 MCP 握手成功；HTTP 可达也不代表认证完成或工具 schema 可用。', '用 mcp/testing 的测试服务器构造一个工具列表，再模拟断连，记录客户端和产品状态变化。', '测试应分别覆盖传输、初始化与能力注册；不需要连接真实外部服务。', ['mcp-stdio', 'mcp-http', 'mcp-testing']),
  route('mcp-auth-resources', 'tools', 'MCP OAuth、工具结果与资源读取', ['mcp-connect', 'auth-lifecycle'], '远端 MCP 要求登录，并返回文本、图像或资源内容。', [
    step('发现授权端点', 'mcp-oauth-discovery', '检查受保护资源和授权服务器元数据，辨认 URL 校验与发现失败。', '受保护服务响应', '授权服务器信息'),
    step('完成回调并保存授权', 'mcp-oauth-flow', '沿 state、PKCE、回调与 token 交换检查授权流程，再看 coding-agent 如何存储和使用凭据。', '授权请求与回调', 'MCP 会话可用凭据'),
    step('执行工具并转换内容', 'coding-mcp-tools', '查看 MCP 工具包装器的参数和结果映射，保留错误、内容块与调用关系。', 'MCP callTool 结果', 'Agent 工具结果'),
    step('列举并读取资源', 'coding-mcp-resources', '区分工具调用与 resources 的列举、模板和读取，跟踪内容进入模型上下文的位置。', '资源 URI 或模板参数', '可消费的资源内容')
  ], '外部资源内容不是程序指令。授权刷新失败、资源不存在与内容不支持应给出不同诊断。', '从内容转换测试找出文本、图像和错误三种结果，说明给模型的数据怎样变化。', '只转换受支持的内容形状，保留失败状态；OAuth 回调需要验证关联信息。', ['mcp-oauth-callback', 'coding-mcp-auth', 'mcp-content']),
  route('codemode-execute', 'tools', '脚本声明、沙箱执行与工具桥接', ['tool-exposure'], '让模型写一段脚本组合多次工具调用，减少中间结果占用上下文。', [
    step('解析脚本头和声明', 'codemode-source', '阅读 parseCodemodeSource 与声明生成，区分模型可读 TypeScript 声明和运行时参数校验。', '脚本与首行选项', '代码和执行选项'),
    step('建立隔离执行环境', 'codemode-host', '检查注入的 tools/globals、超时和内存限制，明确脚本没有任意宿主 API。', '受控能力与代码', 'QuickJS 执行环境'),
    step('桥接工具 Promise', 'codemode-wasm', '沿 VM 到宿主调用检查参数 JSON 转换、异步结果与取消，理解未等待 Promise 的结束规则。', '脚本工具调用', '宿主结果回到 VM'),
    step('返回输出并关闭', 'codemode-output', '区分输出日志、返回值、错误与调用记录，并在宿主完成后清理沙箱。', 'VM 执行结束', '结构化执行结果')
  ], '工具声明不是自动参数验证；超时终止 VM 不会回滚已经产生的宿主副作用。', '阅读示例后用一个纯本地加法工具设计成功、工具抛错、无限循环三个测试场景。', '分别断言结果、错误和超时，并确认 finally 的资源释放；不要给教学沙箱注入不必要能力。', ['codemode-declarations', 'codemode-worker', 'coding-codemode', 'agent-examples-mcp-codemode']),
  route('codemode-replay', 'tools', '脚本状态、确定性重放与远程沙箱', ['codemode-execute'], '脚本跨次保留值，或在退出后按记录继续，甚至在另一台运行时执行。', [
    step('区分本次值与持久值', 'codemode-store', '检查 store 的快照、读写和 storeWrites，明确宿主何时提交成功写入。', '旧 store 和脚本', '候选 storeWrites'),
    step('记录确定性输入', 'codemode-deterministic', '跟踪 startedAt、seed、调用编号与 deliver，解释有序结果对重放的影响。', '历史调用及结果', '可重放执行序列'),
    step('比较不同沙箱', 'codemode-portable', '对照 Inline、Worker、Remote 的阻塞、取消和能力边界，记录远端仍可能执行的情况。', '运行环境与请求', '对应沙箱的执行结果'),
    step('接入产品会话', 'coding-codemode-store', '跟踪宿主如何保存成功状态并关联会话，检查分支和恢复对存储的影响。', '成功执行与活动会话', '后续调用可见的状态')
  ], '失败执行不应按成功路径提交 storeWrites；远程请求超时不证明远端 VM 已停止。', '用相同 seed 和工具结果重放两次，比较调用序列，再改变结果顺序观察验证约束。', '确定性依赖固定输入与有序交付；外部工具的副作用仍需宿主设计幂等策略。'),
  route('extension-lifecycle', 'extensions', '扩展从加载、注册到事件与重载', ['package-resources', 'conversation-round'], '你要添加一个命令或工具，并在会话变化后保持正确状态。', [
    step('发现并加载工厂', 'coding-extensions', '跟踪 loader 如何加载扩展入口，再对照 ExtensionAPI 阅读注册函数。', '扩展文件与资源来源', '注册中的扩展'),
    step('注册受类型约束的能力', 'coding-extensions', '选择工具、命令或事件的一种扩展方式，查明参数 schema、上下文和返回值，不把内部方法当公共接口。', '扩展工厂回调', '已注册能力'),
    step('在事件阶段影响运行', 'coding-run-triggers', '区分 input、运行准备、工具调用和会话事件，核对哪个回调可修改结果、哪个只观察。', '用户动作和会话状态', '扩展处理后的运行输入'),
    step('保存状态与清理重载', 'coding-sessions', '通过会话条目重建状态，检查 reload 时监听器、资源和运行上下文的清理。', '会话变更或 reload', '一致的新扩展状态')
  ], '进程内变量不会自动随会话分支恢复；重复注册监听器会让一次事件产生多次副作用。', '选择现有扩展示例，分别模拟新会话、恢复、分叉和 /reload，并说明状态初始化位置。', '状态由对应会话数据恢复；资源由生命周期清理；所有行为应对应公开 ExtensionAPI 契约。'),
  route('extension-ui', 'extensions', '自定义组件、交互窗口与主题', ['extension-lifecycle'], '扩展要显示选择器、状态或自定义工具结果。', [
    step('核对 UI 能力', 'coding-extensions', '先检查当前运行模式和 ctx.ui 契约；交互终端与 RPC 的 UI 支持范围不同。', '扩展上下文', '当前可使用的 UI 接口'),
    step('选择已有组件', 'coding-components', '复用选择器、消息和工具 renderer，区分渲染字符串、组件实例与模型 content。', '工具详情或用户选择', '可显示组件'),
    step('布局与屏幕模式', 'coding-fullscreen', '查看全屏布局、浮层和焦点变化，确认退出后恢复原来的终端状态。', '组件与可用空间', '可交互布局'),
    step('应用主题与重载', 'coding-theme', '从语义颜色读取主题，观察系统主题变化与自定义主题验证，不把颜色硬编码进逻辑。', '主题设置与终端能力', '一致的界面样式')
  ], '渲染不能成为写入业务状态的隐式入口。无 UI 模式需要明确降级，不能等待永远不会出现的选择器。', '找一个自定义 UI 示例，记录输入、返回值、取消值以及清理步骤。', '答案需说明非交互模式的行为，且区分展示细节与发送给模型的内容。', ['coding-system-theme']),
  route('tui-input', 'extensions', '终端字节到按键、编辑与补全', ['extension-ui'], '输入中文、粘贴多行或按快捷键时，需要理解编辑器如何变化。', [
    step('拆分输入协议', 'tui-input', '阅读 stdin-buffer、keys 与 mouse，把转义序列、普通文字和协议报告分开。', '终端字节流', '键盘、鼠标或粘贴事件'),
    step('映射可配置动作', 'coding-keys', '查 DEFAULT_*_KEYBINDINGS 和配置读取，按命名动作定位处理逻辑，不增加硬编码按键判断。', '标准化按键与用户绑定', '编辑或应用动作'),
    step('更新编辑状态', 'tui-editing-history', '观察光标、选择、撤销与历史记录，在多字节字符和多行粘贴处检查边界。', '编辑动作', '文本、光标和历史'),
    step('生成和应用补全', 'tui-complete', '跟踪候选搜索、模糊排序和替换范围，核对补全结果如何进入编辑器。', '输入文本与位置', '候选和替换后的文本')
  ], '字节数、字符数与终端列宽不同；协议序列被拆分时不能立即当普通文本处理。', '从已有编辑器测试选择中文、组合字符和多行粘贴三个场景，标注光标的预期位置。', '依据编辑器和宽度函数的契约断言，而不是用 string.length 代替显示列宽。', ['tui-wheel', 'tui-search']),
  route('tui-render', 'extensions', '组件树到差分渲染、图像与原生桥接', ['tui-input'], '窗口缩小、主题改变或工具输出变长后，终端需要正确重绘。', [
    step('测量组件与布局', 'tui-layout', '从 Component.render(width) 和布局组件看行的组合、滚动与裁剪。', '组件树与窗口尺寸', '目标屏幕行'),
    step('按显示宽度处理文本', 'tui-text', '追踪 ANSI、Unicode、换行和截断，比较视觉列宽和原始字符串。', '带样式文本', '可显示的行'),
    step('更新终端屏幕', 'tui-render', '区分主屏、替代屏、全量重绘与差分更新，观察光标定位及 resize。', '新旧屏幕状态', '终端输出序列'),
    step('处理图像与平台能力', 'tui-image', '检查 Kitty/iTerm2 与 native-platform 能力检测、剪贴板和回退。平台二进制与 TypeScript 包是不同构建层。', '图片和终端能力', '图像输出或回退表现')
  ], '没有对应终端协议、显示服务或平台二进制时，图像与剪贴板能力可能降级。', '选一个 resize 测试解释哪些行重绘；再对照一个图像能力检测测试写出回退预期。', '状态验证需要包含窗口宽度和屏幕模式；图像能力不能由操作系统名称直接推断。', ['tui-components', 'tui-color', 'coding-clipboard', 'native-win', 'native-mac', 'native-linux', 'native-contracts']),
  route('sdk-rpc', 'extensions', 'SDK 嵌入、RPC 请求与代理流', ['conversation-round'], '把 Pi 嵌入自己的界面，或让另一个进程控制它。', [
    step('选择集成边界', 'coding-sdk', '比较直接创建 AgentSession 与启动 RPC 进程，确定谁持有生命周期、凭据和工作目录。', '应用集成目标', 'SDK 或进程协议方案'),
    step('关联命令和响应', 'coding-rpc', '阅读命令联合类型、请求 ID、响应和独立事件；响应确认不等于整轮生成完成。', 'JSON 请求', '命令结果与异步事件'),
    step('处理流与取消', 'agent-proxy', '比较代理流转换和直接模型流，把传输中断、用户 abort 和正常结束分开。', '远端事件流', 'Agent 可消费的事件'),
    step('释放进程和资源', 'coding-rpc', '跟踪关闭、错误与 UI 请求的处理，保证等待中的调用最终得到结果或明确失败。', '进程退出或会话关闭', '已收尾的客户端状态')
  ], '请求响应和异步事件可能交错；不要以收到任意 JSON 行就认定自己的请求完成。', '在 RPC 测试中跟踪一条 prompt 的 ID、事件和最终完成，写一个取消中的等待场景。', '请求按 ID 关联；事件按协议类型处理；进程异常时所有挂起等待需被处理。'),
  route('durable-basics', 'durability', '持久记录、事务与可恢复会话', ['session-restore'], '进程退出后，应用仍要知道已接纳输入、文档和任务到了哪一步。', [
    step('认识四类记录', 'durable-records', '区分不可变 Entry、可变 JSON Document、带检查点 Task 与会话标识，不复用 CLI JSONL 的语义猜测。', '业务状态和消息', '记录类型选择'),
    step('创建事务并提交', 'durable-session', '跟踪 transaction 中记录、文档与任务的原子变更，区分候选状态和已提交状态。', '一组关联变更', '持久提交'),
    step('选择存储实现', 'durable-memory', '先用内存后端理解契约，再对照 JSONL/SQLite 的持久化与关闭行为。', 'Storage 接口', '存储后端'),
    step('观察提交后的结果', 'durable-watch', '阅读观察游标和订阅流程，确认外部看见的是哪个已提交版本。', '提交序列与游标', '可消费的变化')
  ], '内存后端不提供进程退出后的恢复；事务也无法自动回滚已经发生的网络或文件副作用。', '构造两个文档同时更新的事务，解释失败时观察者应看到什么。', '观察者不能看到只有一半修改的提交；外部副作用需由应用另外保证。'),
  route('durable-submission', 'durability', '输入接纳、Inbox 与持久生成', ['durable-basics', 'provider-request'], '客户端提交一次输入，连接中断后重试仍不能重复工作。', [
    step('装配 Harness 与注册表', 'durable-harness', '检查 models、registry、storage 和调度的装配，区分会话保存的名字与进程内实现对象。', '宿主配置', 'Harness 与 Conversation'),
    step('接纳输入与去重', 'durable-inbox', '沿 submit/requestId 追踪接纳、排队与重复请求，比较取消 wait 和取消工作。', '输入与 requestId', '持久接纳结果'),
    step('构造生成上下文', 'durable-prompt', '检查提示 section、历史条目、工具和配置如何进入 generation。', '当前记录与会话设置', '模型请求上下文'),
    step('持久化生成结果', 'durable-generation', '标出模型轮次的任务检查点与结果提交，再看事件何时向外发布。', '模型输出', '已提交响应与后续任务')
  ], '取消等待不会自动取消已经接纳的输入。重连后重新提交不同 requestId 可能产生新的工作。', '对照 20-inbox 和恢复示例，画出提交、断连、相同 requestId 重试、wait 的过程。', '应保留原请求身份并观察同一持久工作；不把传输失败等同于接纳失败。', ['durable-input-entries', 'durable-agent-config', 'durable-events']),
  route('durable-tool-recovery', 'durability', '工具意图、检查点与崩溃恢复', ['durable-submission', 'process-tools'], '工具执行到一半时进程退出，重启后必须避免重复危险副作用。', [
    step('登记工具契约', 'durable-registry', '查看 defineTool 的输入输出 schema、hooks 和 replay 声明，并确认注册表中的稳定名称。', '工具定义', '可调度工具'),
    step('先提交执行意图', 'durable-tool-tasks', '标出 intent 提交、宿主执行和 result 提交的位置，比较每个位置崩溃后的记录。', '模型 toolCall', '工具任务与执行状态'),
    step('恢复中断任务', 'durable-failure-retention', '检查中断、错误保留和 replay safe 的策略；不能把所有工具自动重跑。', '未完成检查点', '重跑、失败或人工处理分支'),
    step('验证真实副作用', 'durable-coding-tools', '以文件或命令工具检查幂等性，设计能区分“执行成功但结果未提交”的验证。', '执行环境和持久记录', '可解释的恢复结果')
  ], '只有声明 replay: safe 的中断工具可走自动重放路径；该声明本身不能让非幂等操作变安全。', '设计一个计数器工具，分别在意图前、执行后和结果后模拟退出，写出允许的计数结果。', '需要解释每个提交窗口，特别是外部动作成功但结果未提交的窗口。', ['durable-env', 'durable-nested-output']),
  route('durable-storage', 'durability', 'JSONL、SQLite、事务与一致性验证', ['durable-basics'], '把内存教程改成真正可关闭后重开的应用。', [
    step('明确 Storage 契约', 'durable-testing', '先读 conformance 对读取、事务、游标和错误的要求，再选实现。', '存储使用场景', '必须满足的契约'),
    step('跟踪 JSONL 提交', 'durable-jsonl', '查看文件写入、sidecar、单写入者所有权与 fsync 选项，区分可读与已经耐久。', '持久提交', '文件记录'),
    step('跟踪 SQLite 事务', 'durable-sqlite', '阅读迁移和 Promise facade，确保事务内操作用事务句柄而非外部连接。', '数据库与 schema 版本', '原子提交或回滚'),
    step('关闭后重开验证', 'durable-testing', '用同一后端执行一致性测试与恢复测试，再比较性能基准；测试通过不是生产容量承诺。', '已关闭存储', '相同的已提交状态')
  ], '多写入者、未完成迁移或错误事务句柄会破坏假设；必须按后端规定配置所有权。', '对照内存和一个磁盘后端，写出重开后应保持的记录、版本与任务状态。', '内存关闭后不能当磁盘恢复使用；磁盘后端需要证明重新创建实例后读取一致。'),
  route('durable-subagents', 'durability', '子会话、子任务与任务图', ['durable-tool-recovery'], '主任务分出审查或检索子任务，并在重启后继续观察它们。', [
    step('确定会话所有权', 'durable-subagents', '从 foreground/background 子智能体示例理解父子会话、结果与生命周期。', '父任务与子输入', '子会话和归属关系'),
    step('建立子任务', 'durable-task-graph', '阅读任务图与 child tasks，标出调度依赖、等待与终止传播。', '持久任务检查点', '父子任务图'),
    step('重开并继续观察', 'durable-views', '使用视图与游标观察子任务当前状态，避免靠内存 Promise 作为唯一真相。', '恢复后的存储', '当前任务与会话视图'),
    step('汇总结果与用量', 'durable-usage', '检查各任务结果与 usage 的归属，避免把观察到的重复事件重复累加。', '已提交的子任务结果', '父流程可消费的结果')
  ], '父等待取消与子任务取消有不同语义；重启后需要从持久状态恢复关系。', '阅读 22、23、24 三个示例，比较前台、后台与普通子任务如何让父流程继续。', '答案要说清谁持有子会话、谁等待结果以及恢复依据，不把所有后台工作视为脱离管理。'),
  route('durable-context', 'durability', '持久压缩、阻塞恢复与上下文观察', ['durable-submission', 'context-budget'], '长时间运行的持久会话需要缩减上下文，并在重启后保持相同边界。', [
    step('决定压缩任务', 'durable-compaction', '读取压缩配置、触发条件和记录边界，区分普通生成和摘要任务。', '长会话与限制', '压缩计划'),
    step('处理阻塞与失败', 'durable-blocking-compaction', '观察 generation 被压缩阻塞的检查点，以及失败后允许怎样恢复。', '压缩进行中或失败', '可解释的等待/失败状态'),
    step('提交摘要与视图', 'durable-views', '检查摘要提交后下一轮上下文和观察视图怎样改变，保留原始条目的归属。', '摘要和保留记录', '新的模型上下文'),
    step('核对图像预算', 'durable-images', '检查图像输入和模型限制，在持久消息与请求投影之间核对处理阶段。', '图像消息与模型能力', '符合当前请求条件的输入')
  ], '摘要失败不能直接伪装为压缩成功；取消与任务恢复需要保留清晰状态。', '找出一项压缩测试，写出压缩前后仍应保留的信息及应变化的上下文内容。', '记录历史、模型投影和观察视图是三个层次，不能只断言消息数量减少。'),
  route('durable-codemode', 'durability', '持久脚本、工具发现与模型子操作', ['codemode-replay', 'durable-tool-recovery'], '在可恢复任务里执行脚本，同时允许按需工具发现与分类/图像调用。', [
    step('配置脚本能力', 'durable-codemode', '从 harness 的 codemode 装配确定注入工具、存储和运行环境。', '会话设置和 registry', '可恢复脚本任务'),
    step('发现并调用工具', 'durable-codemode-discovery', '比较工具搜索与脚本声明的关系，确认发现结果如何进入下一次执行。', '查询与工具目录', '可执行工具引用'),
    step('执行模型子操作', 'durable-codemode-models', '检查 classify / generateImages 的输入、结果与 usage，核对持久任务中的关联。', '脚本模型调用', '分类/图像结果与用量'),
    step('提交状态和输出', 'durable-codemode-output', '标出脚本状态、输出文件和嵌套任务结果的提交与保留点。', '执行结果与 storeWrites', '可恢复的脚本状态')
  ], '脚本可恢复不等于宿主副作用可随意重跑；工具发现结果也不能绕过授权或校验。', '对照持久 codemode 测试，追踪一个嵌套调用从脚本到工具任务再回到结果。', '应保留嵌套调用身份与检查点，并说明成功写入和失败状态的处理区别。', ['durable-tool-search']),
  route('chord-objects', 'durability', 'Chord 契约、Host、句柄与生命周期', ['durable-basics'], '让多个调用者访问同一对象，并在作用域结束时释放资源。', [
    step('定义契约和变体', 'chord-contracts', '从 remote/local/method 的 schema 明确对象输入、方法与状态，检查 principal 相关变体。', '对象能力要求', '契约和允许的方法'),
    step('提供对象实现', 'chord-host', '跟踪 serve、root 和 get，检查规范化输入与 principalKey 如何参与对象身份。', '对象类型与输入', '可用 Handle'),
    step('传递调用上下文', 'chord-context', '沿取消、deadline 和 scope value 观察调用传递；Context 不是自动认证系统。', '调用上下文', '受范围约束的执行'),
    step('释放持有与资源', 'chord-state', '检查 root 结束、依赖持有和 resource 清理，区分句柄存在与对象仍被有效持有。', '作用域结束', '资源释放或剩余持有')
  ], '不同 principal 的句柄和状态不能任意共享；调用返回不总意味着所有对象立即销毁。', '从 Counter 教程追踪两个 root 获取同一对象，再逐个结束，说明资源何时释放。', '答案取决于身份与持有关系；应引用 host 和 lifecycle 测试验证。'),
  route('chord-state', 'durability', 'JSON 所有权、delta 与复制状态', ['chord-objects'], '订阅者要看到一致状态，而更新计算可能失败。', [
    step('明确 JSON 边界', 'chord-json', '检查合法 JSON、复制与所有权约定，发布后不直接改共享容器。', '调用者持有的 JSON', '可安全交给运行时的值'),
    step('准备增量', 'chord-delta', '跟踪 track/prepare，理解候选变更尚未成为权威版本。', '旧版本和修改', '候选 delta'),
    step('提交并发布', 'chord-delta', '对照 adopt 与 applyImmutable，标记版本切换和订阅者可见点。', '已验证候选变更', '新权威状态'),
    step('观察积压行为', 'chord-state', '比较对象 state 与 replicatedState 的订阅语义，核对慢消费者的合并边界。', '连续状态更新', '订阅者得到的状态')
  ], 'replicatedState 的完整值积压会合并为最新值，不能当作无损审计事件流；需要审计时保存事件记录。', '设计 prepare 后抛错而不 adopt 的测试，证明权威版本不改变。', '候选状态与已提交状态必须隔离；观察到最新值不证明中间每次值都被消费。'),
  route('chord-links-reload', 'durability', '跨进程连接、动态注册与热重载', ['chord-objects', 'chord-state'], '代码变化时，希望对象状态保持，同时已有请求能够收尾。', [
    step('连通两个 Host', 'chord-links', '先用 memoryLinkPair 跟踪 JSON 帧，再比较 IPC/WebSocket 的 accept 与调用。', '两端 Host', '远程句柄与状态连接'),
    step('组织 Facet 与注册表', 'chord-registry', '查看 defineFacet/setup 和 defineRegistry，辨认实现装配与对象契约的关系。', '模块和提供者', '动态可见能力'),
    step('管理子宿主', 'chord-manager', '检查 nodeLoader、forkDriver 和进程锁，明确进程所有权与关闭责任。', '子进程配置', '受管理的 Host'),
    step('切换 epoch 并迁移', 'chord-reload', '沿准备、阻塞进入、迁移与提交，观察在途调用继续使用旧 epoch 的边界。', '新实现和现有状态', '新代码及收尾中的旧代码')
  ], '断线拒绝未完成调用且不提供连接恢复保证；断线不证明远端操作未执行。热重载也不是任意不兼容修改都能透明迁移。', '找一个 reload 测试，标出旧调用、新调用和状态迁移各自采用哪个 epoch。', '应区分代码切换和连接状态；在途调用有其原版本生命周期，迁移需满足契约。'),
  route('remote-env', 'durability', 'SSH、远程文件操作与终端', ['durable-tool-recovery'], '模型与会话留在本地，把文件修改和命令运行放到远端。', [
    step('检查主机与信任', 'env-ssh', '阅读指纹扫描、acceptHostKey 与严格 known-hosts 校验，检查 daemon 部署的平台条件。', '目标主机和身份', '已确认的 SSH 连接条件'),
    step('建立帧协议会话', 'env-remote', '沿 Connection 的 hello、request ID、result/event 与取消查看请求生命周期。', 'daemon 进程与协议', '远程会话'),
    step('注入 ExecutionEnv', 'durable-env', '把 RemoteExecutionEnv 接入文件与命令工具，比较本地环境的路径、句柄与输出语义。', '远程 cwd 和环境', '远端执行的工具'),
    step('单独管理 PTY', 'env-terminal', '检查终端输入、输出、resize 与关闭；PTY 是独立能力，需要符合当前平台支持范围。', '终端请求', '交互进程与退出状态')
  ], '旧文件句柄不能跨 daemon 会话复用；当前 Windows PTY 支持边界以包文档为准。', '对照协议测试画出普通 execute 与 terminal 的消息序列，不实际连接用户主机。', '远程协议不是 MCP；连接、工具操作与 PTY 各有生命周期和取消语义。'),
  route('test-faux', 'verification', '从复现到 faux 定向回归测试', ['conversation-round', 'source-debug'], '某个对话边界偶发出错，需要可重复的测试，不依赖模型随机输出。', [
    step('收缩复现条件', 'coding-diagnostics', '记录入口、参数、预期与实际，只保留触发问题的消息和工具，不记录真实凭据。', '问题现象', '最小复现描述'),
    step('构造确定响应', 'agent-loop', '阅读 faux provider 和现有 loop 测试，控制流事件、工具调用与取消时机。', '确定的模型脚本', '可重复事件序列'),
    step('在产品 harness 验证', 'coding-sdk', 'coding-agent suite 使用 suite/harness 与 faux，把资源、会话和模型装配纳入测试。', '最小会话与工具', '稳定的断言目标'),
    step('定向运行与复审', 'engineering-checks', '只运行相关测试文件，再执行仓库检查；不为文档任务调用真实模型或整套端到端测试。', '修改与测试文件', '可复核验证结果')
  ], '只断言内部函数被调用会漏掉实际行为错误；依赖真实模型的测试也难以证明时序边界。', '设计“工具被 hook 阻止时不产生副作用”的回归用例，写出输入、预期事件和最终状态。', '既断言工具未执行，又断言调用者得到正确失败/阻止结果；以行为验证约束。'),
  route('telemetry-diagnostics', 'verification', '日志、Span、事件与性能定位', ['test-faux'], '请求变慢或失败，但需要知道耗时发生在哪一层。', [
    step('明确观测数据', 'coding-diagnostics', '区分 crash log、timings、请求诊断和 bug report，检查本地收集与上传分开的入口。', '错误或耗时现象', '可定位的诊断记录'),
    step('定义类型化 Span', 'telemetry-schema', '阅读 schema、属性、事件和 createTypedSpanStarter，把上下文显式传入操作。', '操作边界与字段', '类型约束的观测事件'),
    step('选择记录适配器', 'telemetry-adapters', '比较 NOOP 与内存 recorder，检查包没有内置全局 current span 或生产 exporter。', 'TelemetryContext', '记录或无操作行为'),
    step('验证并分析', 'telemetry-conformance', '运行适配器一致性用例，再结合工程分析脚本定位热路径，避免从一次测量推出稳定性能结论。', '观测记录与测试', '可解释的耗时和错误位置')
  ], '诊断记录不是业务状态；异步操作跨越时遗漏上下文会断开关联，日志存在不代表 span 正确结束。', '构造父子操作和一次异常，用内存 recorder 断言事件、结束状态和上下文关联。', '适配器应满足一致性契约；生产导出需要应用自行接入。', ['engineering-analysis']),
  route('eval-quality', 'verification', '评测计划、隔离运行与结果比较', ['test-faux'], '你想知道文档或实现变化是否改善模型行为。', [
    step('制定比较计划', 'evals-runner', '从 plan 读取模型、文档条件、任务和重复次数，确认哪些条件应配对。', '评测问题', '可对照实验计划'),
    step('核对运行前置', 'evals-runner', '阅读 Docker/host runner 的环境、凭据与工作目录要求；源码学习阶段先检查计划而不发起付费运行。', '计划与运行环境', '可执行实验配置'),
    step('读取单次观测', 'evals-report', '区分任务成功、评分、缺失和重复记录，记录每个实验的有效性。', '评测产物', '可信的配对数据'),
    step('比较并解释限制', 'evals-report', '检查报告如何处理未计分和缺失样本，不能把不完整运行合成整体改善结论。', '有效配对观测', '有适用范围的报告')
  ], '真实评测需要网络、容器或模型成本；静态验证计划不能宣称模型效果已经改善。', '阅读一份报告逻辑，构造一个缺失配对的输入，说明为何不能给总体效果结论。', '先满足数据有效性和可比性，再计算效果；缺失或重复必须显式报告。'),
  route('change-deliver', 'mastery', '完成一次独立扩展与源码改造', ['extension-lifecycle', 'test-faux', 'telemetry-diagnostics'], '从需求到可审查修改，能说明每一处改变的理由。', [
    step('把需求变成行为', 'coding-extensions', '先写触发条件、预期结果、失败和取消行为，判断扩展接口能否完成，再决定是否修改核心。', '具体需求', '可测试的行为说明'),
    step('定位契约与调用者', 'coding-sdk', '找到公开类型、实际消费位置和相关测试，检查改动影响的配置、SDK 与界面路径。', '行为说明', '最小修改范围'),
    step('先定义回归用例', 'engineering-checks', '选择可复现行为断言，先验证旧实现的缺陷，再实现修改，避免把实现细节直接复制成测试。', '失败场景', '修复前失败、修复后通过的用例'),
    step('审查并交付', 'engineering-checks', '检查 diff、定向测试与整体检查结果，记录环境限制和剩余风险；提交仅在获得明确要求时执行。', '完成的修改', '可审查的变更与验证说明')
  ], '一个测试通过不能证明所有配置路径都正确。新增接口前应先查询已有契约及复用点。', '选择一个现成工具扩展示例，增加一个无外部副作用的能力，并提交一份行为、调用链和验证笔记。', '合格结果包含成功/失败/取消说明、真实源码依据、相关测试结果和明确扩展边界。'),
  route('release-upgrade', 'mastery', '生成数据、打包部署与版本升级核对', ['change-deliver'], '源码修改完成后，需要理解发布产物和升级时的变化范围。', [
    step('区分手写与生成文件', 'engineering-catalog', '跟踪模型生成器、数据水合和元数据来源；生成表通过生成器维护，不直接手改。', '模型或配置变更', '正确的生成入口'),
    step('检查依赖与安装锁', 'engineering-install-lock', '阅读精确依赖和 coding-agent install-lock 的生成/检查流程，核对生命周期脚本的显式允许项。', '依赖元数据', '一致的锁文件与检查'),
    step('理解发布产物', 'engineering-release', '只读追踪 workspace 打包、消费者验证、二进制与版本同步；真正发布需按项目 release 技能执行。', '源码与版本', '待验证发布产物'),
    step('回到用户运行场景', 'coding-source-checkout', '对照源码 resolver、npm 安装和 standalone 的资源路径，验证升级后的配置、会话与扩展入口。', '目标安装形态', '可复现的升级检查清单')
  ], '源码可运行不等于发布包完整；发布、部署和依赖安装不是阅读教程自动授权的动作。', '任选一个 release 脚本说明输入产物和消费者检查；再记录一项本版本接口变化及受影响例子。', '结论必须基于当前脚本与实际验证；历史资料不能代替当前包的 exports 与契约。'),
  route('design-history', 'mastery', '从历史设计到当前实现的证据审查', ['release-upgrade'], '仓库保留旧目录、设计提案和中文翻译，需要判断哪些还能直接使用。', [
    step('确认当前源码基线', 'engineering-checks', '核对 HEAD、工作区差异与 manifest，分别记录当前源码、未跟踪资料和历史快照。', '仓库与文档快照', '审查基线'),
    step('比较当前装配', 'coding-sdk', '以真实 exports、当前 src 和测试确定运行入口；旧 client/protocol/server 目录资料不能证明包仍可运行。', '历史设计与当前入口', '已实现和历史内容边界'),
    step('追踪演进证据', 'engineering-analysis', '用 Git 时间线与具体 diff 查明变化，再更新编号映射和离线资料。自动中文统计摘要不能替代逐个 diff 审查。', '提交和设计文档', '可追溯的变化说明')
  ], '未初始化目录的文件说明可以暂为空；没有实现和测试证据的设计能力不可写成现成接口。', '找一个历史目录，列出当前保留资料、缺少的运行入口和可继续追踪的提交线索。', '应明确标记“历史资料/设计方案”，并避免生成虚构调用链。')
];
