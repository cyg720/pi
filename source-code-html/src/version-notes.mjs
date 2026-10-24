// 中文解说逐项核对对应版本的英文 CHANGELOG；历史条目保持所属版本。
export const versionNotes = {
  "Unreleased": {
    "title": "提交采用、统一 Watch 与只读 Harness",
    "intro": "当前包版本为 1.4.0；此栏列出该版本之后、当前 HEAD 已包含的源码变更。发布状态不能由包版本或本地标签推断。",
    "audience": "Durable 存储适配器、观察界面与 CLI 集成维护者。",
    "points": [
      { "package": "durable", "needle": "Storage.commit(writes, adopt, context)", "title": "持久化与内存采用有了明确顺序", "before": "旧 Storage.commit 不接收采用回调。", "after": "存储持久化后、下次提交开始前同步调用 adopt(seq) 一次，再完成 Promise。", "why": "让持久提交顺序和内存状态采用顺序一致；采用后失败不能回滚已经采用的状态。", "action": "自定义存储和 wrapper 转发 adopt，运行存储一致性用例并检查失败窗口。" },
      { "package": "durable", "needle": "Removed the Chord state getters", "title": "统一使用 Watch 观察当前状态", "before": "documentState、viewState 和 taskGraph getter 暴露 Chord 状态。", "after": "改用 watchDoc、Conversation.watch 和 watchTaskGraph；统一 WatchHandle 与 WatchEnd。", "why": "退休由显式事件确认，null 值不代表退休；结束的观察释放 Session 引用。", "action": "迁移 getter 调用及 session_closed/session_failed 结束原因，验证停止、退休、失败与慢监听恢复。" },
      { "package": "durable", "needle": "HarnessOptions.readOnly", "title": "只查看其他进程驱动的会话", "before": "打开 Harness 会按正常运行方式恢复任务。", "after": "readOnly 打开为查看器，保留已提交运行状态，拒绝写入和任务执行。", "why": "检查持久状态时避免意外开始运行。", "action": "分别测试读取、写入、resume 和其他执行入口，确认 ReadOnlySession。" },
      { "package": "coding-agent", "needle": "not `http:` or `https:`", "title": "MCP 授权地址限制协议", "before": "授权元数据可能把 file 或自定义协议地址交给系统处理。", "after": "拒绝非 HTTP/HTTPS 的授权端点和相关 OAuth 元数据 URL。", "why": "外部服务器元数据不能直接决定任意系统 URL 操作。", "action": "验证正常 HTTPS 登录与非法协议拒绝路径。" }
    ]
  },
  "1.4.0": {
    "title": "1.3.0 之后：持久睡眠、崩溃保护与显式遥测",
    "intro": "1.4.0 日志于 2026-10-21 归档持久睡眠、崩溃保护、IndexedDB、客户端身份、分类器图像输入与摘要预算等变化。当前 HEAD 还有后续 Unreleased 变更，需继续阅读上一栏。",
    "audience": "持久任务、存储适配器、遥测与模型接入维护者。",
    "points": [
      {
        "package": "durable",
        "needle": "TaskRuntime.sleep()",
        "title": "等待变为可持久睡眠",
        "before": "在 phase 内等待占用 invocation，重启可能重新开始等待。",
        "after": "用 sleepUntil(until, checkpoint, context) 或 commit 返回 sleeping 结束阶段，到期从 checkpoint 继续；setTimer 只用于阶段内节奏。",
        "why": "睡眠任务不持有 invocation，可跨重启；switch TaskState 时必须处理 sleeping。",
        "action": "把等待后的工作放入下一阶段，按宿主 clock 验证重启与 wake/onWake。SQLite 自动迁移到 schema v2，不能回退到 1.3.0 或更早版本读取。"
      },
      {
        "package": "durable",
        "needle": "restartLimit",
        "title": "连续崩溃的任务会停放",
        "before": "异常重启可能持续重新执行同一任务。",
        "after": "连续 5 次未提交新状态的崩溃会触发 restart_limit，inspect 与任务图呈现阻塞，retryTask 可显式重试。",
        "why": "区分运行中断和业务新状态，避免无限崩溃循环。",
        "action": "观察 onReport 与 blocked 原因；只有明确需要旧行为时才使用 Infinity。"
      },
      {
        "package": "chord",
        "needle": "chord/sqlite",
        "title": "SQLite 基础层迁入 Chord",
        "before": "通用 SQLite 接口、驱动和迁移器位于 Durable。",
        "after": "Chord 提供 sqlite、sqlite/node、sqlite/cloudflare；Durable 保留存储实现与公开名称再导出。",
        "why": "共享数据库基础层可供宿主使用，不必依赖持久 Agent 的业务存储。",
        "action": "区分通用数据库迁移与 Durable 自身 schema 迁移，核验前缀与元数据表名限制。"
      },
      {
        "package": "ai",
        "needle": "telemetryContext",
        "title": "请求遥测传入 span 而非 adapter",
        "before": "旧选项名为 telemetryContext。",
        "after": "改为 telemetry?: TelemetrySpan，无兼容别名；Models 可记录 request/poll、用量和固定错误状态。",
        "why": "显式传递父 span 保持调用归属；不能把全局适配器当作当前操作。",
        "action": "同步调用方与测试替身，取消仍保持 ok 且 stop=aborted；检查错误诊断与内容边界。"
      },
      {
        "package": "coding-agent",
        "needle": "reserveTokens",
        "title": "摘要输出上限与压缩触发阈值分离",
        "before": "固定摘要输出上限可能被 reasoning 消耗，产生 token cap 错误。",
        "after": "摘要使用模型输出上限，reserveTokens 仅控制压缩开始时机；generateSummary 相关参数不再约束输出。",
        "why": "压缩触发容量和摘要生成预算是两个维度。",
        "action": "分别验证触发阈值与高推理摘要，不用调 reserveTokens 来声称提高摘要输出限制。"
      }
    ]
  },
  "1.1.0": {
    "title": "耗时可观测、可取消授权与持久上下文读取",
    "intro": "本版将模型响应和工具执行的耗时贯通到 SDK、持久会话和界面，同时改进授权取消、存储扫描方向及上下文缓存。对普通使用者是展示和稳定性更新；对流提供商和 Storage 作者则包含接口契约变化。",
    "audience": "自定义模型提供商、工具渲染器、MCP 授权接入、Durable Storage 实现者。",
    "points": [
      {
        "package": "agent",
        "needle": "durationMs",
        "title": "工具耗时有了统一定义",
        "before": "调用者可能自己用事件间隔推测执行时长，把排队和钩子开销也算进去。",
        "after": "工具结果、AgentToolCallOutcome 和 tool_execution_end 提供 durationMs，以单调时钟计量 execute 的耗时并排除 hooks；未执行的调用没有该字段。",
        "why": "统一数据可用于展示与分析，但 undefined 不表示耗时为零。各执行框架对中断结果的细节仍需读各包记录。",
        "action": "渲染与聚合时允许字段缺省；不要将缺失值转成 0 后参与平均值。"
      },
      {
        "package": "ai",
        "needle": "AssistantMessageEventStream",
        "title": "自定义 stream 返回值需要使用规定的事件流类",
        "before": "提供商可能返回自建的 EventStream 子类。",
        "after": "stream 函数要求返回 AssistantMessageEventStream，从而统一响应流的结果与耗时处理。",
        "why": "外形相似的事件流不一定满足新契约；这是自定义提供商接入的迁移点。",
        "action": "检查所有自定义 provider 与 proxy 的返回类型，并在结束、错误和取消路径读取完整结果。"
      },
      {
        "package": "durable",
        "needle": "ScanOrder",
        "title": "存储分页支持双向读取，游标方向必须一致",
        "before": "适配器可能只按固定方向扫描；runtime.context 的截止点曾直接作为参数传入。",
        "after": "查询支持 ascending/descending，游标延续其建立时的方向；条目默认从新到旧，其余默认从旧到新。context 截止点改为 { at } 选项对象。",
        "why": "忽略 order 会产生错序分页；不能仅靠类型通过确认适配器正确。",
        "action": "核对自定义 Storage 的四类扫描及游标行为；针对两个方向验证无重复、无漏项，以及反向使用游标的拒绝行为。"
      },
      {
        "package": "durable",
        "needle": "contextRetentionMs",
        "title": "上下文增量读取减少重复扫描",
        "before": "每次模型请求都可能重新扫描并推导整段会话。",
        "after": "相同 head 标记下利用缓存，只推导新提交条目；空闲上下文由 contextRetentionMs 控制保留时长，默认十分钟。",
        "why": "长会话中读取成本更可控。它与未发布章节的文档缓存 documentRetentionMs 是两个配置维度。",
        "action": "分别观察忙碌与空闲会话的读取量；自定义缓存策略应验证 compaction、reset 和 fork 后的上下文一致性。"
      },
      {
        "package": "mcp",
        "needle": "signal",
        "title": "授权与发现请求可取消，关闭连接减少额外刷新",
        "before": "取消刷新可能又退回启动新授权；关闭 transport 时获取 token 可能触发网络刷新。",
        "after": "authorizeMcp、registerClient、token 和发现函数接受 signal；取消刷新不再转为新授权。关闭时 DELETE 复用最近请求的 token。",
        "why": "取消和关闭应能结束正在做的事，避免在退出途中重新开启认证工作。",
        "action": "让 UI 取消信号贯穿授权链，测试取消后不弹出新的授权流程，以及关闭期间没有意外刷新。"
      },
      {
        "package": "codemode",
        "needle": "console: true",
        "title": "console 输出与正式结果可以区分",
        "before": "宿主收到文本输出后，不容易判断它来自 console 还是 text()。",
        "after": "console.* 产生的文本项带 console: true。",
        "why": "宿主可将调试日志和给用户的结果分别呈现。",
        "action": "自定义 codemode 渲染器读取可选标记；没有标记的文本不要误归为日志。"
      }
    ]
  },
  "1.0.4": {
    "title": "远程执行环境加入，工具选择与沙箱收束更可靠",
    "intro": "本版新增 Env 包，用 SSH 部署并连接远端执行守护进程；同时调整工具选择的匹配规则，并修复 MCP 连接关闭、OAuth 注册和 codemode 内建对象修改带来的问题。",
    "audience": "远程开发、定制工具集合、MCP 服务接入和自定义执行环境的开发者。",
    "points": [
      {
        "package": "env",
        "needle": "RemoteExecutionEnv",
        "title": "把执行环境放到另一台机器",
        "before": "本机 NodeExecutionEnv 只代表本机的文件和进程环境。",
        "after": "RemoteExecutionEnv 与 Connection 把 Durable 执行环境接到远端 daemon；connectSsh 负责系统识别、部署和连接，sshConnection 可延迟到首次操作。",
        "why": "远程执行需要兼顾二进制校验、输出窗口、连接丢失和文件监听；不是简单把命令前加 ssh。",
        "action": "确认远端平台、主机密钥信任、daemon 校验和监听 overflow 恢复。Windows 与网络文件系统使用轮询等行为见原文。"
      },
      {
        "package": "coding-agent",
        "needle": "--no-mcp",
        "title": "一次运行关闭 MCP，工具过滤保留明确边界",
        "before": "日志记录旧 --tools 行为可能移走所有 MCP 工具，导致只选择 codemode 时看不到 MCP 服务器。",
        "after": "新增 --no-mcp；--tools 保留 MCP 工具，除非条目明确以 mcp__ 开头；工具选择同时支持模式匹配和排除。",
        "why": "内置工具集合和外接 MCP 工具需要分别控制，避免一个过滤选项产生超出预期的影响。",
        "action": "用自己的工具命名验证 --tools、mcp__ 模式和 --no-mcp 的组合，检查最终暴露给模型的列表。"
      },
      {
        "package": "codemode",
        "needle": "Built-ins are frozen",
        "title": "脚本不能通过修改内建对象破坏宿主桥接",
        "before": "修改 Array.prototype.toJSON 等内建对象曾导致宿主崩溃或 execute 无法结束。",
        "after": "脚本运行前冻结内建对象并将内建全局设为只读；畸形 worker 载荷使执行以 sandbox 错误结束。",
        "why": "脚本的原型修改不能继续影响宿主解释消息的方式。原文列有实例仍可覆盖的成员，不能概括成所有对象都不可变。",
        "action": "移除对全局内建原型打补丁的脚本；用局部函数替代，并验证异常时宿主能收到终态。"
      },
      {
        "package": "durable",
        "needle": "permission_denied",
        "title": "自定义 watch 实现要区分无权限与不存在",
        "before": "无法读取的监听目标曾被当作缺失目标；部分目录和符号链接行为缺少约束测试。",
        "after": "无权限时返回 permission_denied，并增加符号链接目标、监听范围重叠和同路径目录替换的约束测试。",
        "why": "错误类型会影响上层是否重试和如何提示；通过旧版测试不等于符合新行为。",
        "action": "重新验证自己执行环境的 watch 适配器；覆盖初次建立监听与后续 rescan 两种失败。"
      }
    ]
  },
  "1.0.3": {
    "title": "Azure 提供商更名，图像文件与终端按键行为更新",
    "intro": "本版最需要人工迁移的是 Azure provider key。它还让 codemode 生成的图像有文件落点，调整临时输出文件权限与 Home/End 行为，并修复取消 OAuth 刷新后的认证状态。",
    "audience": "Azure 用户、读取模型配置的扩展、使用图像生成和全屏终端的用户。",
    "points": [
      {
        "package": "coding-agent",
        "needle": "Renamed the Azure provider",
        "title": "Azure 名称变更会影响多份配置",
        "before": "provider 名称是 azure-openai-responses。",
        "after": "provider 改为 azure，并支持 Foundry Chat Completions。需要更改 auth.json、models.json 和 settings.json 中相应键与模式；AZURE_OPENAI_* 环境变量保持不变。",
        "why": "旧会话恢复时可能回退到其他模型且不复用旧提示缓存；不能只改一处显示名称。",
        "action": "检查 defaultProvider、enabledModels、modelThinkingLevels 和认证键；SDK 调用方还要对照 AI 包记录检查 getModel 与导入使用。"
      },
      {
        "package": "coding-agent",
        "needle": "temp file",
        "title": "图像可继续被后续轮次使用",
        "before": "codemode image() 的图像输出缺少供后续文件操作使用的明确落点。",
        "after": "每张图像也保存到临时文件，并在结果中给出路径；输出文件权限仅允许当前用户读取。",
        "why": "模型下一轮可以操作文件，但临时路径不代表长期存储承诺。",
        "action": "需要长期保存时明确复制到项目目标目录；检查运行账户和文件权限。"
      },
      {
        "package": "coding-agent",
        "needle": "Home",
        "title": "编辑器导航与全文导航分开",
        "before": "Home/End 与全屏历史位置的行为容易混在一起。",
        "after": "Home/End 总是到编辑行的首尾；Ctrl+Home/Ctrl+End 用于全屏会话顶部与底部，不再移动编辑光标。",
        "why": "同一按键动作现在对应更明确的区域。",
        "action": "按自己的终端实际发送的键序列检查编辑与滚动行为；自定义键位时参考当前配置文档。"
      }
    ]
  },
  "1.0.2": {
    "title": "按思考级别定制采样参数",
    "intro": "本版的产品重点是模型配置：同一个 OpenAI-compatible 模型可以随 thinking level 切换采样覆盖值。它不是所有 provider 通用的自动调参机制。",
    "audience": "维护 models.json、自定义模型接入和需要比较思考级别输出的人。",
    "points": [
      {
        "package": "coding-agent",
        "needle": "samplingParamsByThinkingLevel",
        "title": "思考级别可以关联不同的采样参数",
        "before": "仅有一组采样设置时，不同 thinking level 难以采用不同 temperature 或 top_p。",
        "after": "models.json 增加 samplingParamsByThinkingLevel，为 OpenAI-compatible APIs 按级别覆盖采样参数。",
        "why": "采样参数是请求行为的一部分；设置是否受支持还取决于目标服务。",
        "action": "阅读当前 models 配置文档，选定模型支持的参数；记录请求参数再比较效果，不把一次输出差异视为确定性结论。"
      }
    ]
  },
  "1.0.1": {
    "title": "MCP 项目覆盖、工具渲染与安装依赖策略",
    "intro": "这是 1.0.0 后一轮覆盖面较大的改进：项目级 MCP 控制、更灵活的工具渲染和 OAuth 客户端注册，同时约束脚本输出内存，并调整 npm 与托管安装的依赖固定策略。",
    "audience": "多项目 MCP 使用者、工具 UI 扩展作者、安装维护者与 SDK 消费者。",
    "points": [
      {
        "package": "coding-agent",
        "needle": "project overrides",
        "title": "项目能覆盖用户级 MCP 服务器的部分设置",
        "before": "用户级服务器设置难以仅为某个项目改变暴露方式。",
        "after": "项目 .pi/mcp.json 中没有 command/url 的条目可只覆盖 enabled、exposure 和 toolExposure；/mcp 支持按项目启停。",
        "why": "服务器连接定义和项目内可用性可以分层管理。",
        "action": "核对项目覆盖最终生效值，尤其是同名服务器和工具暴露范围；不要把覆盖条目误写成缺失连接信息的新服务器。"
      },
      {
        "package": "mcp",
        "needle": "clientMetadataDocument",
        "title": "OAuth 客户端元数据从静态 URL 变成按服务器提供",
        "before": "OAuthClientProvider 使用 clientMetadataUrl。",
        "after": "改为 clientMetadataDocument(metadata)，返回文档 URL 与 redirect URI，也可返回 undefined 采用动态注册；文档不再存为 client information。",
        "why": "不同授权服务器可能需要不同注册方式。",
        "action": "自定义 OAuthClientProvider 必须迁移方法签名并测试有无已存客户端信息的路径；不要只替换属性名。"
      },
      {
        "package": "coding-agent",
        "needle": "pi.registerToolRenderer()",
        "title": "尚未注册的工具也能使用定制渲染器",
        "before": "恢复会话里的 MCP 工具可能尚未连接，不能立即得到期望的渲染。",
        "after": "registerToolRenderer 可选择工具调用的绘制方式，即使工具尚未注册。",
        "why": "历史会话展示不必等待外部服务器成功连接。",
        "action": "测试连接前、连接后与始终连接失败的会话展示；渲染器要能接受历史结果。"
      },
      {
        "package": "coding-agent",
        "needle": "npm-shrinkwrap.json",
        "title": "npm 安装与托管安装的依赖约束不同",
        "before": "发布包带 npm-shrinkwrap.json，固定传递依赖，也限制库消费者覆盖依赖。",
        "after": "发布包移除 shrinkwrap；npm 安装不再固定传递依赖，库消费者能覆盖它们。日志建议需要固定依赖的安装使用 pi.dev 托管安装器。",
        "why": "选择安装方式会影响可复现性和依赖维护方式，不只是安装命令变化。",
        "action": "维护私有包时记录自己的锁文件与安装路径；原文同时记录 brace-expansion 修复，不能把移除 shrinkwrap 理解为不再需要依赖审查。"
      },
      {
        "package": "codemode",
        "needle": "MAX_OUTPUT_CHARS",
        "title": "脚本输出超限会明确失败",
        "before": "无限打印可能持续增长宿主内存直至崩溃。",
        "after": "输出限制为 16 Mi 个字符或 100000 个输出项，越界以 RangeError 结束。",
        "why": "这里单位是字符和条目，不是模型 token，也不等同于最终展示截断预算。",
        "action": "脚本在循环中汇总信息再输出；分别测试字符多和输出项多的情况。"
      }
    ]
  },
  "1.0.0": {
    "title": "产品进入 1.0：默认全屏，Agent 与持久会话职责分离",
    "intro": "1.0.0 既有面向使用者的默认交互改变，也有 SDK 层的减重与迁移。理解这个版本有助于解释为什么旧教程中的 AgentHarness 等入口在当前 agent 包里已经找不到。",
    "audience": "从 0.x 升级的用户、旧 harness 使用者、维护扩展与二次发行版的人。",
    "points": [
      {
        "package": "agent",
        "needle": "Removed the experimental harness",
        "title": "实验 harness 从 Agent 包移出",
        "before": "pi-agent-core 曾包含 AgentHarness、会话存储、durable runtime、pico3、压缩和部分辅助能力，并提供多个子路径导出。",
        "after": "包保留 Agent、agent loop、proxy stream 及类型；持久会话应使用 pi-durable。./node、./harness/*、./experimental/pico3 等旧入口移除。",
        "why": "内存中的代理循环与持久恢复是不同层次的职责，旧导入不再只是过期写法。",
        "action": "先按是否需要持久恢复选择 Agent 或 Durable 教程；梳理旧 API 的状态与生命周期，不做机械的包名替换。"
      },
      {
        "package": "coding-agent",
        "needle": "Fullscreen by default",
        "title": "全屏成为默认终端模式",
        "before": "用户可能依赖终端原生 scrollback 进行阅读。",
        "after": "默认全屏；设置 tuiMode 为 regular 可保留终端普通滚动历史。",
        "why": "升级后最明显的变化可能是交互区域和滚动方式，不是模型行为。",
        "action": "在自己的终端核对滚动、复制和按键；需要旧阅读方式时显式设置 regular。"
      },
      {
        "package": "coding-agent",
        "needle": "Image generation in codemode",
        "title": "Codemode 扩展到图像生成",
        "before": "脚本主要围绕工具编排与文本输出。",
        "after": "models.generateImages() 使用会话凭据生成图像；日志还记录声明提示词精简与更可恢复的错误说明。",
        "why": "图像能力与使用的模型、凭据和输出处理一起工作，并非任意文本模型都能生成图像。",
        "action": "按图像模型配置和 codemode 使用文档完成最小流程，再处理图像展示与保存；离线导览只展示代码和记录，不执行真实生成。"
      }
    ]
  },
  "0.87.0": {
    "title": "代理循环钩子明确：请求前准备与轮次结束决策",
    "intro": "这一版是理解当前 Agent 循环控制的重要节点。新 finishTurn 不只是 shouldStopAfterTurn 的改名，还改变了触发范围和决策表达；prepareRequest 将每次请求前的上下文准备单独列出。",
    "audience": "自定义 Agent 循环、上下文注入、停止条件和消息队列的开发者。",
    "points": [
      {
        "package": "agent",
        "needle": "shouldStopAfterTurn",
        "title": "停止条件迁移到 finishTurn",
        "before": "shouldStopAfterTurn 只为正常响应执行，返回是否停止。",
        "after": "finishTurn 在 assistant 和工具结果完成后、turn_end 前执行；返回 action: end 结束正常运行，决策在 turn_end 后生效。错误与中止也会触发钩子，但其决策被忽略。",
        "why": "原条件函数如果有副作用，迁移后不能在错误或中止时无条件调用。结束时消息队列不会被消耗。",
        "action": "保留 error/aborted 分支保护，对照原文迁移示例；验证 end 不会多执行一次 prepareNextTurn。"
      },
      {
        "package": "agent",
        "needle": "prepareRequest",
        "title": "每次 provider 请求都有独立准备点",
        "before": "只依赖下一轮钩子不容易覆盖首次请求。",
        "after": "prepareRequest 在包括第一次在内的每次 provider 请求前执行，可替换 context；peekQueuedMessages 可查看将选取的队列批次而不消费。",
        "why": "上下文准备、轮次调度与队列消费需要分开理解。",
        "action": "用首次请求、工具后续轮次和排队消息三个场景追踪调用顺序；不要把窥视队列当作出队操作。"
      }
    ]
  },
  "1.2.0": {
    "title": "工具编排、持久恢复与 Chord 新运行时",
    "intro": "1.2.0 将原先未发布的扩展、持久工具调用、缓存与 Chord 运行时变更正式归档。下列解说对照本版本日志；后续 1.3.0 再次调整 Chord 引用与声明 API，实际编程请继续读当前教程。",
    "audience": "扩展作者、Durable 存储与工具开发者、Chord 宿主开发者、维护私有发行版的人。",
    "points": [
      {
        "package": "coding-agent",
        "needle": "messageType",
        "title": "扩展启动事件覆盖自定义触发消息",
        "before": "处理 before_agent_start 时，旧处理器可能直接读取 prompt 或 images，并默认它是用户文本。",
        "after": "自定义消息通过 triggerTurn 启动空闲会话也触发这个事件。事件用 messageType 区分 user 与 custom，前者带 prompt/images，后者带 message。",
        "why": "同一个启动钩子能覆盖更多输入，但事件的字段不能再无条件读取。",
        "action": "为 user/custom 分支分别处理输入；同时检查启动处理器期间的 isIdle、队列投递与取消行为，避免把正在启动的会话当作空闲。"
      },
      {
        "package": "chord",
        "needle": "typed host runtime",
        "title": "Chord 从旧 facet/service 体系迁移到类型化 host",
        "before": "旧实现围绕 facet/service runtime、defineService、远程 service helpers 和 bundler 入口组织。",
        "after": "contract 由 TypeBox 描述，host 提供对象，handle 访问对象，memory、IPC、WebSocket link 传递 JSON frame；插件支持热重载。",
        "why": "这涉及运行时和接口替换，不是只调整一个 import。旧 client、protocol、server 包也退出发布。",
        "action": "从当前 Chord 教程重新理解 contract → host → handle → link。逐一核查旧入口；同名 defineFacet 也不能据名称认定契约相同。"
      },
      {
        "package": "durable",
        "needle": "ToolExecutionApi.executeTool",
        "title": "工具调用工具有了持久任务与重放边界",
        "before": "宿主若自己在工具内部直接调用另一工具，需要自行处理调用归属、取消、校验和恢复。",
        "after": "executeTool 创建带父子关系的嵌套 pi.tool 任务，结果提供结构化输出、诊断、耗时等；重放安全的调用者可通过 key 重接子调用。",
        "why": "嵌套结果给程序调用者，不能简单当成另一条模型工具回复；父工具结束时还要收束未完成的子调用。",
        "action": "核对 callers、modelTools、structuredOutputSchema、重放 key 与 replay policy。非零 shell 退出是含 exit_code 的错误结果，不能只依赖捕获异常。"
      },
      {
        "package": "durable",
        "needle": "SessionFailed",
        "title": "Storage 故障现在有明确的会话失败边界",
        "before": "旧接入可能认为读取失败只影响当前请求，或由 Session 自动重试后继续使用。",
        "after": "Storage 方法抛出的普通错误会使 Session 失败并关闭，后续调用和等待以 SessionFailed 拒绝；StorageRequestError 只使该请求失败。存储自行重试暂时性故障。",
        "why": "继续使用写入状态不确定的会话会放大一致性问题；错误恢复必须由存储层和宿主明确分工。",
        "action": "区分请求错误与存储故障，观察 Session.closed，检查 onReport 及关闭清理路径；在自己的适配器测试中覆盖读取失败与提交失败。"
      },
      {
        "package": "durable",
        "needle": "documentRetentionMs",
        "title": "长会话的缓存与任务调度不再无限积累",
        "before": "日志记录旧实现会保留曾访问的文档，且部分调度步骤扫描过多任务；大量会话与嵌套调用容易放大内存和调度成本。",
        "after": "文档按使用保留，documentRetentionMs 默认十分钟；调度使用活跃任务索引，结束任务的归属索引也会回收。",
        "why": "这改变的是长期运行成本。日志内基准来自项目记录，不能直接视为你的机器或负载能达到的吞吐量。",
        "action": "按真实会话数量测缓存命中、内存与存储读次数；保留时间设为 0 会更快释放，也可能增加重新加载。"
      },
      {
        "package": "codemode",
        "needle": "sandbox.start()",
        "title": "Codemode 增加可重放的执行协议与多种沙箱",
        "before": "execute() 面向一次脚本执行；宿主缺少一个逐次接管工具调用结果的确定性恢复协议。",
        "after": "start() 允许宿主响应 onCall 并通过 deliver 回送结果，具有种子、虚拟时钟、结果顺序与指纹；同时增加 inline、remote 与 portable 入口。",
        "why": "可重放需要稳定的输入与交付顺序，不等于任意脚本都能安全恢复。原 execute() 仍保留。",
        "action": "先选宿主运行环境和沙箱类型，再阅读 start 的状态边界。恢复时验证指纹、模块版本、日志顺序和超时，不把重跑外部副作用当成重放。"
      },
      {
        "package": "mcp",
        "needle": "OAuthIssuerMismatchError",
        "title": "MCP 授权更严格地处理无法核对的 issuer",
        "before": "缺少授权服务器元数据时，授权码响应中的 iss 无法完成核对。",
        "after": "authorizeMcp 会拒绝这种交换并抛 OAuthIssuerMismatchError，此时 expected 为 undefined。",
        "why": "无法确定目标授权服务器时，继续交换授权码会失去 issuer 校验的意义。",
        "action": "排查元数据发现和授权服务器配置；区分“元数据缺失”与“已知 issuer 不匹配”，保留可诊断错误信息。"
      }
    ]
  },
  "1.3.0": {
    "title": "会话恢复与模型切换修复，Chord 引用契约升级",
    "intro": "本版提升恢复工具集合、模型切换和取消收尾，同时对 Chord 的放置、principal、引用就绪与声明进行不兼容调整。当前接口还需结合 1.4.0 与 Unreleased 栏核对。",
    "audience": "工作台/Chord 宿主、扩展作者与维护会话恢复的开发者。",
    "points": [
      {
        "package": "chord",
        "needle": "self.state(name, schema, initial",
        "title": "声明迁移到 self 上的命名调用",
        "before": "cell、resource、listener 等独立声明函数与声明映射组织对象。",
        "after": "self.state、self.resource、self.on、self.derive、self.task 替换旧声明；状态版本与迁移归属各 cell。",
        "why": "不能只改 import；重复名称、资源版本和监听器重建都有运行语义。",
        "action": "对照当前 tutorial，迁移工厂与 reload 测试；旧 epoch 名称改 codeVersion，Handle 改 Ref。"
      },
      {
        "package": "chord",
        "needle": "hostNamed",
        "title": "远程放置与身份变为显式契约",
        "before": "调用者指定目标 host，宿主可能生成默认 principal。",
        "after": "remote 声明 hostNamed/hostFamily；createHost.self、connect.principal、upstream 的 link/principal 显式给出。",
        "why": "放置参与契约指纹，身份来自应用；异版本链路不能随意互通。",
        "action": "同时迁移消费端和提供端，await get 等初始状态就绪，检查 lifetime:host 与 awaitHostObjects。"
      },
      {
        "package": "coding-agent",
        "needle": "resumed sessions dropping tools",
        "title": "恢复会话保留已激活工具",
        "before": "继续会话可能丢失运行时激活的工具。",
        "after": "恢复保存集合，增减形式 --tools +name/-name 在其上应用；显式完整集合或禁用选项仍优先。",
        "why": "恢复后的模型能力应对应已有会话选择。",
        "action": "分别验证默认恢复、增减选择和明确覆盖，工作台原生设置不能偷偷重写既有会话选择。"
      },
      {
        "package": "coding-agent",
        "needle": "drop thinking blocks",
        "title": "切换模型不把旧 reasoning 当普通回复",
        "before": "上一模型 thinking 可能以可见文本传给新模型。",
        "after": "来自其他模型的历史 thinking 块被丢弃。",
        "why": "防止新模型把内部推理误学成可见回复格式。",
        "action": "核对切换前后请求体与用户可见内容，保留其他历史消息。"
      },
      {
        "package": "coding-agent",
        "needle": "sessionShareDestination",
        "title": "分享位置可配置",
        "before": "分享上传位置由自动选择决定。",
        "after": "sessionShareDestination 可选 auto、gist、radius。",
        "why": "导出本地文件与上传分享是不同操作。",
        "action": "按组织要求选择目的地，阅读会话分享文档后显式执行。"
      },
      {
        "package": "coding-agent",
        "needle": "surviving workers",
        "title": "取消后的脚本 worker 纳入容量上限",
        "before": "反复超时或取消可能累积尚未退出的 worker。",
        "after": "限制跨会话同时存活 worker 为两个，取消后直到实际退出仍计数。",
        "why": "取消通知不等于底层执行资源已释放。",
        "action": "测试连续超时、取消与下一次启动，观察真实退出边界。"
      }
    ]
  }
};
