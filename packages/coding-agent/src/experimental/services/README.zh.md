# 实验型客户端/服务端切片

面相设置根据每个主机提供的非本地令牌生成其RPC服务目录。远程服务源获取这些目录，并仅绑定消费面相所需的服务；没有手工内置的服务目录。未选择Session时，其延迟源将未解析的需求视为不可用，并保持其句柄断开连接。附件会将其与工作者生成的目录进行验证，该目录会被缓存以供后续分离生成使用。键控服务在其拥有特性未生成实例前，会以空目录形式加载。

从仓库根目录运行仅源码的服务器和客户端：

```bash
PI_EXPERIMENTAL=1 ./pi-test.sh server
PI_EXPERIMENTAL=1 ./pi-test.sh client
```
  
`PI_SERVER_DIR`覆盖服务器配置文件和套接字目录，默认为`~/.pi/server`。`PI_SERVER_ID`在省略`--server-id`时选择逻辑服务器ID。服务器、客户端和实验包子路径不会包含在npm包和独立二进制文件中。

| 范围 | 服务 | 当前切片 | 续接点 |
|---|---|---|---|
| 服务器 | `SessionDirectory` | 已实现状态复制 | 身份落地时添加认证客户端投影 |
| 服务器 | `SessionManagement` | 已实现创建、移除、附加、分离 | 添加认证工作区授权 |
| 服务器 | `PresentationPlugins` | 准备所选Session分支的匹配TUI工件并重新加载该分支 | 添加认证插件策略 |
| Session | `SessionPlugins` | 重新加载已配置的Session面相生成 | 添加协调多工作者重新加载报告 |
| Session | `Models` | 已实现状态、默认持久化选择、思考、刷新 | 将提供者/认证组合移至插片面相后方 |
| Session | `AgentController` | 为提示、引导、后续操作、队列取消、中止、压缩和等待提示答案提供根持久对话的安全展示面 | 仅在演示需求时添加新对话操作 |
| Session | `Transcript` | 根对话的持久`ConversationView`作为复制状态 | 仅在另一演示需要时添加投影 |
| Presentation | `SlashCommands` | 处理本地贡献注册表，含模型、思考、压缩、重新加载和示例hello命令 | 仅在具体插片面需求时添加更多演示钩点 |
| Presentation | `PresentationUI` | 处理本地选择和状态能力 | 仅在命令需求时添加窄范围UI能力 |

`ServerServiceSource.connection`和`SessionServiceSource.attachment`为本地控制状态。Session目录、创建和地址DTO由这些编码代理服务契约拥有，而非`pi-protocol`；传输层将其负载视为透明服务数据。

使用`PI_EXPERIMENTAL=1`，交互式`pi client`会在打开仅服务端聊天TUI前创建并附加Session。`pi client -c`和`pi client -r`会附加最新存在的Session，保持其持久模型和思考配置。模型选择通过`/model`按需提供，绝不会作为启动界面。演示始终使用稳定编码代理的备用屏幕渲染器和共享转录/停靠视口。它加载已配置的主题资源，并使用稳定终端的亮/暗检测及外观变更通知。其复制状态为稳定编辑器、消息、工具、状态、主题和工具渲染器组件提供数据。演示通过`AgentController`驱动工作者拥有的根对话，并在控制器调用挂起时渲染`Transcript`服务的完整复制值。`Transcript`直接服务`Conversation.viewState()`：持久化框架按提交精确发布操作，工作者无需自有归约器。Chord每次发布后会清空压缩操作，每个客户端/状态配对使用独立路径字典编码它们。Chord重建演示副本并负责加载、排序和间隙检测。
服务器将每个会话（Session）保存在其专用目录中，位于会话目录下：`meta.json`保存了ID、创建时间和工作目录，而`session.sqlite`是`@earendil-works/pi-durable`存储的容器。服务器仅从`meta.json`中列出和创建会话。会话工作者锁定该目录，打开存储并持有其所有权直至退休；工作者在Harness任务图仍有活跃任务时保持存活。

前台服务器使用可重复的`-e`选项来建立其默认会话和TUI（文本用户界面）方面。本地客户端也可以选择会话创建或恢复时使用的包；该分支选择与会话一起持久化，不会改变其他工作者或服务器默认配置。在附加之前，服务器会请求Chord构建常规的`src/session.ts`和`src/tui.ts`条目到独立的`plugin-builds/`目录中，将生成的清单路径传递给该会话工作者，并返回匹配的TUI工件。会话工作者加载内置方面和单独拥有的插件生成版本，然后创建一个活跃的`FacetHost`。`/reload`原子地重建包，加载新鲜的插件候选者，通过`FacetHost.reload()`进行裁剪，并处置已退休的生成版本。主机创建的实现依赖，如持久的`Harness`、其根`Conversation`、`ModelRuntime`和`SettingsManager`，会直接传递给内置方面工厂；它们不会作为服务暴露。TUI加载配置的呈现方面，并添加一个私有桥接方面，该方面消费连接的服务器和所选会话服务以供`ExperimentalClientTui`使用。其本地呈现服务为`SlashCommands`（负责命令贡献）和`PresentationUI`（负责选择和状态渲染，不暴露原始TUI）。命令回调直接接收Chord的`Context`。方面会显式消费`AgentController`以用于提示、引导或排队，并将结构化的控制器结果返回给命令调度器。

主机可以重新加载其声明的服务形状未改变的方面；保留的消费者保持相同的服务外观，而替换实现和单例快照会安装在它们后面。同步的设置时间`env.provide()`、`env.provideMany()`、`env.use()`和`env.observe()`调用会生成内部依赖图；设置不会重复声明的依赖列表，且服务句柄在完整图验证前保持断开连接。提供者在消费者之前激活，观察者与其消费的方面连接，而方面替换或主机关闭则按反向依赖顺序处置受影响的生命周期。服务器和会话服务令牌是非本地的，并由其提供主机自动发布。仅用于呈现的钩子点（如`SlashCommands`）是显式的本地钩子，永远不会进入RPC目录。

方面总是调用未限定的`env.use()`或`env.observe()`。主机会解析每个令牌，跨越方面提供的和连接的服务。示例插件包通过其TUI方面贡献`/hello`。`examples/plugins/pi-example-plugin/`是一个实际的`@earendil-works/pi-example-plugin`包：可重复的`-e`选项选择插件包作为服务器默认或单个会话分支，Chord会发现并构建其常规方面，附加的呈现会通过`PresentationPlugins`接收匹配的TUI工件。来自同一插件的其他主机方面保持为单独的捆绑条目，而非单一聚合插件对象。传输绑定保持为内部机制，而非方面环境的一部分。`ExperimentalClientTui`目前直接拥有终端渲染、状态订阅、导航和动作分发。服务器提供者会直接组装，直至其完整主机环境存在。`packages/durable/docs/pico-v5-chord-usage.md`中的canvas、diff-review和task-observation示例是扩展模式，而非内置编码代理服务。私有引用、追踪载体和流程控制保持为协议/主机基础设施切片，而非呈现服务令牌。

## TODO

待处理事项：工作者从已移除的`AgentHarness`移动到`@earendil-works/pi-durable`：

- 树导航：`AgentController.navigate()`被丢弃。持久分支通过分叉进入新对话实现，因此导航需要一个分叉操作、一个启动新上下文的摘要条目和一个指向会话当前对话的指针。
- 下一轮队列：`AgentController.nextRun()`被丢弃。仅持久化队列支持路由和后续输入。`resume()`也被丢弃：工人在打开会话时恢复中断的工作。
- 子代理：服务仅覆盖根对话。暴露子代理对话需要为每个对话提供带键的服务实例。
- 对话历史：`Transcript`状态是对话的视图，仅保存自最新重置或压缩以来的活跃上下文。较旧的条目需要通过`Conversation.entries()`进行分页。

