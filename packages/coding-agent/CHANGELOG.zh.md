# 变更日志

## [未发布]

### 变更

- 代码模式 `image()` 现在也会将每个图像保存到临时文件，并在结果中命名路径，以便后续轮次可以复制或移动生成的图像（[#10310](https://github.com/earendil-works/pi/issues/10310)）
- 输出文件（截断工具输出的完整文本、二进制MCP资源、代码模式图像）现在仅对用户可读

### 修复

- 修复了订阅登录（如使用ChatGPT登录）在`refresh_token_invalidated`取消请求后OAuth令牌刷新期间失败的问题
- 修复了代码模式在会话其余部分失败的问题，当pnpm全局更新删除了正在运行的安装时，并在pi更新或从磁盘移除后发生错误时添加了重启提示（[#10439](https://github.com/earendil-works/pi/issues/10439)）
- 修复了交互式会话在终端丢失时（例如关闭窗口或恢复已关闭终端中的挂起pi）报告`read EIO`或`setRawMode EIO`崩溃（并提示运行/bug）

## [1.0.2] - 2026-10-04

### 新功能

- **按思考级别采样** — `samplingParamsByThinkingLevel`在`models.json`中为每个思考级别设置采样参数（如`temperature`和`top_p`）以适用于OpenAI兼容API。详见[按思考级别配置采样](docs/models.md#configure-sampling-by-thinking-level)。

### 添加

- 为`models.json`添加了`samplingParamsByThinkingLevel`，以实现对OpenAI兼容API的按思考级别采样参数覆盖。详见[按思考级别配置采样](docs/models.md#configure-sampling-by-thinking-level)（[#9776](https://github.com/earendil-works/pi/pull/9776) 由[@mrexodia](https://github.com/mrexodia) 提交）

## [1.0.1] - 2026-10-03

### 新功能

- **Nix flake** — `nix run github:earendil-works/pi/stable`运行最新版本，`nix profile add github:earendil-works/pi/stable`进行安装。详见[安装pi](docs/quickstart.md#1-install-pi)。
- **项目级MCP服务器覆盖** — `.pi/mcp.json`和`/mcp`可启用、禁用或更改用户级服务器在单个项目中的暴露情况。详见[配置服务器](docs/mcp.md#configure-servers)。
- **MCP客户端ID元数据文档** — `oauth.clientRegistration: "cimd"`允许授权服务器通过文档URL允许pi，而非动态注册。详见[OAuth认证](docs/mcp.md#authenticate-with-oauth)。
- **任何工具的渲染器** — `pi.registerToolRenderer()`可调用尚未注册的工具（如恢复会话中的MCP工具）。详见[工具渲染](docs/extensions.md#tool-rendering)。
- **Cloudflare Clef分类器** — `@cf/cloudflare/clef`和`@cf/cloudflare/clef-flash`可在代码模式脚本和扩展中使用。详见[使用分类器模型](docs/models.md#use-classifier-models)。

### 添加

- 为OAuth登录屏幕（`/login`、`/mcp`、`/mcp login`）添加了复制密钥（`app.message.copy`，默认`ctrl+x`），当浏览器无法打开或链接无法选择时，可复制登录URL。
- 为MCP服务器添加了`oauth.clientRegistration: "cimd"`，通过pi.dev上的Client ID元数据文档识别pi，而非动态客户端注册，以便授权服务器可通过URL允许pi（[#10302](https://github.com/earendil-works/pi/issues/10302)）
- 为用户级MCP服务器添加了项目覆盖：`.pi/mcp.json`条目不包含`command`或`url`时，仅设置用户级服务器的`enabled`、`exposure`和`toolExposure`，并且`/mcp`可启用或禁用当前项目的服务器（[#10277](https://github.com/earendil-works/pi/issues/10277)）
- 为`cloudflare-workers-ai`添加了Cloudflare的Clef和Clef Flash分类器模型，可在代码模式脚本和扩展中使用（[#10316](https://github.com/earendil-works/pi/pull/10316) 由[@ndisidore](https://github.com/ndisidore) 提交，[#10322](https://github.com/earendil-works/pi/pull/10322) 由[@RealAlexandreAI](https://github.com/RealAlexandreAI) 提交）
- 添加了`pi.registerToolRenderer()`，用于选择如何绘制对工具的调用，包括尚未注册的工具（[#10285](https://github.com/earendil-works/pi/issues/10285)）
- 为macOS和Linux添加了Nix flake：`nix run github:earendil-works/pi/stable`运行最新版本，`nix profile add github:earendil-works/pi/stable`进行安装。详见[安装pi](docs/quickstart.md#1-install-pi)（[#9137](https://github.com/earendil-works/pi/pull/9137)）

### 变更

- 全局npm安装的`pi update`现在推荐迁移到pi.dev安装程序的管理安装，该安装程序会固定所有依赖项。
- Anthropic 工具在对话中添加或重新定义时，现在会直接在对话中定义，因此在相同名称下重新定义工具会保留提示缓存，而不是重新发送完整的工具列表。

### 修复

- 修复了通过将 `brace-expansion` 5.0.12 固定为直接依赖项来解决 `brace-expansion` 5.0.9 存在漏洞的问题（GHSA-q2hr-2g5m-vwhr，GHSA-qhr7-859c-m2p7，GHSA-6j4f-fj2g-mc7p）（[#10288](https://github.com/earendil-works/pi/issues/10288)）
- 修复了 `--models` 中多余的逗号导致在模型循环中添加额外模型的问题（[#10334](https://github.com/earendil-works/pi/issues/10334)）
- 修复了 `codemode` 脚本打印循环导致内存耗尽崩溃的问题：脚本一旦输出超过 16 Mi 字符或 100000 个项目就会失败（[#10283](https://github.com/earendil-works/pi/issues/10283)）
- 修复了通过 `Image` 渲染的 JPEG、GIF 和 WebP 图片在 Kitty、Ghostty、WezTerm 和 Warp 中无法显示的问题（[#10292](https://github.com/earendil-works/pi/issues/10292)）
- 修复了恢复会话和 HTML 导出中 MCP 工具调用在服务器连接之前渲染为完全展开，或者如果服务器从未连接则永久保持的问题（[#10285](https://github.com/earendil-works/pi/issues/10285)）
- 修复了 WezTerm 中滚动后 Kitty 全屏图片崩溃为单行条的问题（[#10319](https://github.com/earendil-works/pi/issues/10319)）
- 修复了“选定模型容量已达上限”提供程序错误导致回合结束而不是重试的问题（[#10278](https://github.com/earendil-works/pi/issues/10278)）
- 修复了 Cloudflare AI Gateway Claude 模型使用短横线模型 ID（`claude-opus-5-5` 而不是 `claude-opus-5.5`）时出现 404 错误的问题
- 修复了 ChatGPT 登录回调端口被其他登录占用时继续登录的问题，浏览器会显示“OAuth 状态不匹配”；现在会以端口占用错误失败（[#10265](https://github.com/earendil-works/pi/issues/10265)）
- 修复了 Amazon Bedrock OpenAI 模型在输入令牌超过 272k 时按短上下文费率计费的问题；Bedrock 模型现在包含 models.dev 上列出的定价层级（[#10326](https://github.com/earendil-works/pi/issues/10326)）
- 修复了系统提示或工具更改后，Amazon Bedrock Claude 请求出现“`signature` 无效，`thinking` 块”错误的问题（[#10324](https://github.com/earendil-works/pi/issues/10324)）
- 修复了 Together DeepSeek V4 Pro 在 Together 重命名为 `deepseek-ai/DeepSeek-V4-Pro-0813` 后丢失思考级别控制的问题（[#10336](https://github.com/earendil-works/pi/pull/10336) 由 [@cv](https://github.com/cv) 提交）
- 修复了默认 NVIDIA 模型指向 `nvidia/nemotron-3-super-120b-a12b`，而 NVIDIA 不再提供服务的问题；默认模型现在为 `nvidia/nemotron-3-ultra-550b-a55b`

### 移除

- 移除 `npm-shrinkwrap.json` 于发布包中。npm 安装不再固定传递依赖，库消费者现在可以覆盖它们。使用 pi.dev 安装程序进行固定安装（[#5653](https://github.com/earendil-works/pi/issues/5653)）

## [1.0.0] - 2026-10-01

### 新功能

- **默认全屏**——TUI 现在默认全屏。设置 `tuiMode` 为 `"regular"` 可保持终端正常滚动回溯。详见 [终端与显示](docs/settings.md#terminal-and-display)。
- **更精简的代码模式**——约减少 40% 的提示词，且错误信息会指导模型如何恢复。详见 [代码模式](docs/codemode.md)。
- **代码模式中的图像生成**——脚本使用会话凭证调用 `models.generateImages()`。详见 [生成图像](docs/codemode.md#generate-images) 和 [使用图像模型](docs/models.md#use-image-models)。
- **Radius 在 `/login` 中**——通过 Radius 登录并一步设置其 MCP 服务器。详见 [Radius](docs/providers.md#radius)。
- **Anthropic 复制代码登录**——浏览器在另一台机器运行时登录。详见 [交互式认证](docs/providers.md#authenticate-interactively)。
- **MCP OAuth 加固**——支持 `oauth.authServerMetadataUrl`、RFC 9207 `iss` 检查、每服务器凭证和逐步登录以保持已授予权限。详见 [使用 OAuth 认证](docs/mcp.md#authenticate-with-oauth)。
- **仅头部静默启动**——`quietStartup: "header"` 保留版本和密钥提示，隐藏其余内容。详见 [终端与显示](docs/settings.md#terminal-and-display)。

### 增加

- 增加了 `oauth.authServerMetadataUrl` 设置，用于 MCP 服务器错误地广告 OAuth 授权服务器或未广告任何服务器的情况。Pi 会使用配置的元数据文档而不是发现机制（[#10172](https://github.com/earendil-works/pi/issues/10172)）
- 增加了 `quietStartup: "header"`，该设置保留启动头部的版本和密钥提示，但隐藏模型范围行和已加载资源列表。
- 已将`models.generateImages()`添加到codemode脚本中。它使用会话凭证运行图像模型（例如OpenRouter的模型），并返回`image()`可附加到结果中的base64图像块；使用次数计入会话成本，如同`models.classify()`。扩展可以调用`ctx.modelRegistry.generateImages()`。请参阅[使用图像模型](docs/models.md#use-image-models)。

- 已为无头环境（浏览器运行在另一台机器上）的Anthropic `/login`添加了复制代码登录方法（[#10194](https://github.com/earendil-works/pi/pull/10194) by [@lucasmeijer](https://github.com/lucasmeijer)）。

### 已更改

- 已将默认的TUI模式更改为全屏模式。将`tuiMode`设置为`"regular"`或传递`--tui-mode regular`，即可保持终端的正常滚动回显。

- 现在，`/login`在顶层提供了“使用Radius登录”选项（作为最后一个选项，并显示其状态）。完成Radius登录后，`/login`会提示用户配置全局`mcp.json`中的Radius MCP服务器（使用`"auth": { "provider": "radius" }`），并重新加载。取消登录将返回到启动时的菜单。
- 提供商文档页面已重命名为 [Providers](docs/providers.md)，其“Cloud Providers”部分现在为“Provider Specific Config”，并首先记录了Radius的相关内容。
- MCP OAuth凭据现在按服务器名称和URL存储，因此具有相同URL的MCP服务器可以使用不同的账户进行登录。仅按URL存储的凭据将移动到首次使用它们的服务器（[#10252](https://github.com/earendil-works/pi/issues/10252)）。
- 代码模式消耗的提示词远少：使用默认工具并启用代码模式后，GPT-5.6的请求从约5300个提示词减少到3300个。`codemode`描述中，脚本全局变量以每行一条的方式列出，并指向新的[Codemode](docs/codemode.md)参考文档，该文档是`models` API的一部分，模型在需要时会读取。声明的工具在一行中说明脚本如何调用它们以及调用结果是什么，而不是重复完整声明，系统提示的代码模式指导和MCP服务器部分也更短。

- 代码模式错误现在会说明如何恢复：读取不存在的工具或`models`成员时会列出相近的名称（`tools.Bash`建议`tools.bash`），`models.classify()`和`models.generateImages()`会拒绝格式错误的参数并指出期望的形状，未知模型会指向`models.getAvailableOfType()`，过大`store()`值会解释存储用途，生成图片但未显示的脚本会收到提示。尝试调用`typeof tools.name`工具的脚本必须使用`"name" in tools`。
- `/login`和`/logout`现在将未配置凭证的提供商标记为“未配置”，而不是“未配置”。

- OAuth浏览器页面现在显示Pi标志的颜色。

### 修复

- 修复了MCP OAuth登录接受一个授权响应，其`iss`参数名称指向另一个授权服务器的情况；代码现在在交换之前被拒绝（RFC 9207）。

- 修复了MCP OAuth登录在`Invalid scope`情况下，当令牌响应包含`"scope": ""`时失败，以及对其他空或`null`可选OAuth字段的类似失败（[#10266](https://github.com/earendil-works/pi/issues/10266)）。

- 修复了`/mcp login`打印的登录URL在换行时不可点击的问题（[#10186](https://github.com/earendil-works/pi/issues/10186)）。

- 修复了`--provider`在没有`--model`时被静默忽略并运行另一个提供商的默认模型；现在会以错误方式失败（[#10236](https://github.com/earendil-works/pi/issues/10236)）。

- 修复了MCP服务器要求更多范围（`insufficient_scope`）时反复请求登录的问题。新的登录仅请求缺失的范围，因此新令牌丢失了先前令牌的访问权限；现在会保留已授予的范围。

- 修复了转录中的用户消息，每行渲染时保留两个全角副本；现在每个渲染行仅保留一个，输出相同。

- 修复了`/login`和`/logout`将每个OAuth登录（包括Radius）标记为订阅的问题；仅订阅支持提供商显示“订阅”，其他OAuth登录显示“账户”。

- 修复了启动页头Logo在Apple Terminal中渲染时出现间隙的问题；现在显示带版本号的彩色“Pi”标志。
- 修复了当`tool_search`加载的工具在恢复时被丢弃，以及`/reload`即使在服务器重新连接之前，会话也恢复了工具的问题，因为MCP服务器在重新连接之前没有恢复工具。
- 修复了系统主题使柔和色系（如Catppuccin Frappe）更加生动；调色板颜色现在保持其色度（[#10255](https://github.com/earendil-works/pi/issues/10255)，[#10293](https://github.com/earendil-works/pi/pull/10293)由[@dgtlntv](https://github.com/dgtlntv)贡献）。
- 修复了以空白字符开头时，斜杠命令自动补全不会触发的问题（[#10218](https://github.com/earendil-works/pi/pull/10218)由[@haoqixu](https://github.com/haoqixu)贡献）。
- 修复了在全屏模式下，鼠标选择和搜索高亮时颜色溢出的问题，当样式化令牌结束在高亮边界时（[#10169](https://github.com/earendil-works/pi/issues/10169)）。
- 修复了转录中每个渲染消息保留的内存；一条长的助手消息大约只占用之前堆内存的五分之一。

## [0.99.2] - 2026-09-30

### 新功能

- MCP服务器保持低调：默认`codemode`暴露的服务器不再出现在`codemode`描述中，也不再阻塞第一个提示。它们出现在简短的系统提示部分，脚本通过`searchTools()`和`describeNamespace()`查找其工具。详见[控制工具暴露](docs/mcp.md#control-tool-exposure)。
- 更多MCP认证选项：`oauth.clientName`用于仅接受已知OAuth客户端的服务器，`"auth": { "provider": "<provider>" }`用于通过提供方的`/login`令牌认证HTTP服务器。详见[使用OAuth认证](docs/mcp.md#authenticate-with-oauth)。
- 从Anthropic SDK环境变量中引入Anthropic工作负载身份联邦认证。详见[从环境使用API密钥](docs/providers.md#use-an-api-key-from-the-environment)。
- `/reload`启用`defaultTools`设置中新增的工具。详见[工具](docs/settings.md#tools)。

### 添加

- 为MCP服务器（`pi mcp add --description`）添加了`description`字段，与服务器一同显示在系统提示中，并用于工具搜索中的工具排名，以及`describeNamespace(name)` codemode助手，返回命名空间的指令和工具名称。`describeNamespace()`和`searchTools()`接受`mcp__dev-radius`、`mcp__dev_radius`、`dev-radius`或`dev_radius`作为命名空间。
- 为MCP服务器（`pi mcp add --oauth-client-name`）添加了`oauth.clientName`设置，用于更改OAuth客户端注册时发送的客户端名称，适用于仅接受已知客户端的服务器（[#10226](https://github.com/earendil-works/pi/issues/10226)）。
- 为HTTP MCP服务器添加了`"auth": { "provider": "<provider>" }`，用于发送提供方当前`/login`令牌作为承载令牌，而非使用MCP OAuth。令牌在每次请求时读取，因此提供方刷新生效。仅允许在全局`mcp.json`和扩展中使用，且要求https（除回环主机外）。
- 从`ANTHROPIC_FEDERATION_RULE_ID`、`ANTHROPIC_ORGANIZATION_ID`和`ANTHROPIC_IDENTITY_TOKEN_FILE`环境变量中引入Anthropic工作负载身份联邦认证（详见[提供方](docs/providers.md)）（[#10177](https://github.com/earendil-works/pi/issues/10177)，[#10242](https://github.com/earendil-works/pi/pull/10242)由[@philfreo](https://github.com/philfreo)贡献）。
- `/reload`现在启用`defaultTools`设置中新增的工具。从该设置中移除的工具保持启用，会话中关闭的工具除非重新添加否则保持关闭，`--tools`、`--no-tools`和`--no-builtin-tools`仍会覆盖该设置（[#10245](https://github.com/earendil-works/pi/issues/10245)）。

### 更改

- 默认`codemode`暴露的MCP服务器不再出现在`codemode`描述中；脚本通过`searchTools()`查找它们。`codemode-deferred`现在是`codemode`的别名。使用`direct`暴露工具，模型无需搜索即可看到这些工具（[#10212](https://github.com/earendil-works/pi/issues/10212)）。
- `codemode`描述不再包含延迟工具、工具数量或MCP服务器指令，因此当MCP服务器连接或更改工具时，描述也不会改变。`tool_search`描述也不再列出可加载工具的服务器，原因相同。服务器信息现在以`mcp_servers`系统提示部分的形式列出，包含一行摘要，每次提示开始时更新；变更的部分会附加到对话中。脚本通过`describeNamespace()`读取服务器指令（[#10212](https://github.com/earendil-works/pi/issues/10212)）。
- 第一个提示不再等待没有`direct`工具的MCP服务器。它们会在后台连接，并在代码模式脚本调用它们、脚本搜索工具，或`tool_search`运行时等待（[#10212](https://github.com/earendil-works/pi/issues/10212)）。

### 修复

- 修复了新会话偶尔忽略已保存的默认模型，或警告没有可用模型的情况，当它属于一个已注册本地提供商的扩展且存储了凭证时（[#9962](https://github.com/earendil-works/pi/issues/9962)，[#10190](https://github.com/earendil-works/pi/pull/10190)由[@davidbrai](https://github.com/davidbrai)提交）。

- 修复了`/mcp`登录URL在换行时不可点击的问题，通过将其作为终端超链接输出，并带有类似`Cmd/Ctrl+click to open`的行（如`/login`）（[#10186](https://github.com/earendil-works/pi/issues/10186)）。

- 修复了代码模式`image()`接受格式错误的base64数据或不支持的图像类型，这会导致无效的图像块，使后续所有提供商请求都因HTTP 400失败（[#10215](https://github.com/earendil-works/pi/issues/10215)）。

- 修复了代码模式无法从独立的Windows可执行文件启动其脚本工作者（[#10204](https://github.com/earendil-works/pi/issues/10204)）。

- 修复了提示提交随会话长度增加而变慢的问题，因为解析会话的模型选择需要每次助手消息都查询一次模型目录（[#10198](https://github.com/earendil-works/pi/issues/10198)）。

- 修复了对于拥有刷新后的pi.dev目录的提供商，模型查询变慢的问题，因为合并远程目录模型需要二次时间。

- 修复了`built-in-tool-renderer.ts`和`minimal-mode.ts`扩展示例移除了内置工具的摘要和指南，导致系统提示受影响（[#10072](https://github.com/earendil-works/pi/issues/10072)，[#10193](https://github.com/earendil-works/pi/pull/10193)由[@christianklotz](https://github.com/christianklotz)提交）。

- 修复了Z.AI CN端点`Prompt exceeds max length`错误的上下文溢出检测（[#10208](https://github.com/earendil-works/pi/issues/10208)）。

- 修复了当工具模式使用Anthropic严格工具使用拒绝的关键词（如`minimum`/`maximum`）时，Anthropic请求失败的问题；此类工具现在发送非严格模式（[#9953](https://github.com/earendil-works/pi/issues/9953)）。

- 修复了当`Retry-After`头部包含无法解析的日期时，提供商重试立即触发的问题；现在它们使用指数回退（[#9571](https://github.com/earendil-works/pi/issues/9571)）。
- 修复了扩展命令在没有字符串名称或处理程序的情况下注册，导致输入 `/` 时崩溃 pi 的问题；扩展现在加载时会显示错误而不是崩溃（[#10054](https://github.com/earendil-works/pi/issues/10054)）。
- 修复了当输出为一行很长的内容（例如压缩后的 JSON）时，`codemode` 折叠内容和 MCP 工具结果填满屏幕的问题。类似 bash 输出，预览现在限制为换行显示，而非逻辑行。
- 修复了 `codemode.mode: "only"` 在系统提示符工具列表中列出 `read`、`bash`、`edit` 和 `write`，尽管请求仅声明 `codemode`（[#10192](https://github.com/earendil-works/pi/issues/10192)）。
- 修复了 codemode 脚本在两个工具名称仅在 `-` 和 `_` 上不同（例如 `read-file` 和 `read_file`）时调用错误 MCP 工具的问题。类似于 Codex，MCP 工具和命名空间名称现在用 `-` 替换了 `_`（`mcp__my-server__x` 现在是 `mcp__my_server__x`），服务器中所有冲突的工具都会加上哈希后缀，服务器名称仅在 `-` 和 `_` 上不同时会被拒绝（[#10239](https://github.com/earendil-works/pi/issues/10239)）。

## [0.99.1] - 2026-09-29

### 新特性

- **GPT-6.1 Sol** — 可用在 OpenAI、Azure OpenAI 和 OpenAI Codex 上，现在是 OpenAI Codex 的默认模型。请参阅 [选择模型](docs/models.md#select-a-model)。

### 添加了

- 添加了 GPT-6.1 Sol（`gpt-6.1-sol`）到 OpenAI、Azure OpenAI Responses 和 OpenAI Codex 提供商。

### 更改了

- 将默认的 OpenAI Codex 模型更改为 GPT-6.1 Sol（`gpt-6.1-sol`）。

### 修复了

- 修复了 `/login` 在捆绑发布版中使用 OpenAI 时因缺少 `openai-chatgpt.js` 模块而失败的问题。

## [0.99.0] - 2026-09-29

### 新特性

- **Codemode 和 MCP** — 可以连接 MCP 服务器，并让模型运行 JavaScript 调用工具的并行操作。请参阅 [MCP 服务器](docs/mcp.md) 和 [启用 codemode](docs/cli.md#enable-codemode)。
- **系统主题**——Pi的颜色现在默认来自终端自身的调色板。请参阅[使用终端颜色](docs/themes.md#use-your-terminals-colors)。
- **使用ChatGPT登录**——通过`/login openai`使用ChatGPT订阅和OpenAI提供商。请参阅[交互式身份验证](docs/providers.md#authenticate-interactively)。
- **虚拟模型**——扩展程序可以将每个请求路由到不同的物理模型。请参阅[虚拟模型](docs/virtual-models.md)。
- **分类器模型**——可以在codemode脚本中运行Jev分类器，或者使用任何llama.cpp模型作为分类器。请参阅[如何使用codemode](docs/cli.md#how-codemode-works)和[分类](docs/llama-cpp.md#classification)。

### 已添加

- 已添加codemode、工具搜索和MCP支持作为内置扩展。`codemode`工具在QuickJS沙箱中运行模型编写的JavaScript，调用Pi的工具；可通过`defaultTools`或`--tools`启用它，并通过`codemode.mode`和`codemode.inlineBudget`进行配置。`tool_search`会查找未向模型声明的工具并进行声明。MCP服务器通过stdio或可流式HTTP提供，支持OAuth，来自`mcp.json`（全局或项目级，一旦受信任）或`pi.registerMcpServer()`，并通过`/mcp`和`pi mcp add|remove|list|login|logout`进行管理。请参阅[MCP服务器](docs/mcp.md)和[启用codemode](docs/cli.md#enable-codemode)（[#10040](https://github.com/earendil-works/pi/issues/10040)）。
- 已添加用于编排工具的扩展工具API：`exposure`（`direct`、`model-only`、`codemode`、`deferred`或`hidden`）、`namespace`、`annotations`、`outputSchema`与`structuredContent`、`isError`结果、`prepareLoadout()`和`ctx.executeTool()`用于嵌套工具调用，这些调用会发出事件（`parentToolCallId`）并被记录为有边界的`nestedCalls`（在调用工具的结果中）。请参阅[工具暴露](docs/extensions.md#tool-exposure)。
- 当扩展程序注册的工具、命令或标志与内置扩展冲突时，会添加警告（[#10174](https://github.com/earendil-works/pi/pull/10174)，由[@cristinaponcela](https://github.com/cristinaponcela)提交）。
- 增加了实验性虚拟模型：扩展请在`pi.registerVirtualModel()`中注册，并为每个请求选择一个物理模型和思考层级。页脚显示路由模型，`/session`列出每个物理模型的成本，`examples/extensions/jev-router.ts`使用Jev分类器进行路由。请参阅[虚拟模型](docs/virtual-models.md)。
- 在`/login`的OpenAI提供商中增加了“使用ChatGPT登录”功能，该功能使用OpenAI API的ChatGPT订阅。Pi会将此登录方式的稳定配置（`deviceId`）存储在全局设置中，并在故障报告中省略。
- 增加了`system`主题，现为默认主题，该主题会根据终端报告的前景色、背景色和ANSI调色板获取Pi的颜色，并在终端在明暗模式间切换时重建颜色。请参阅[使用终端颜色](docs/themes.md#use-your-terminals-colors)。
- 增加了`#rgb`、`oklch()`和`okhsl()`颜色，以及主题文件中的可选`appearance`字段，并为扩展增加了`theme.style()`、`theme.colors`和`theme.appearance`。请参阅[主题](docs/themes.md)和[TUI](docs/tui.md)。
- 为每个llama.cpp聊天模型增加了分类器模型，答案基于下一个标记的概率标签。请参阅[分类](docs/llama-cpp.md#classification)。
- 在OpenRouter、Cloudflare Workers AI、Vercel AI Gateway和OpenCode Zen上增加了继承的Jev分类器模型。
- 增加了`fullscreenWheelScrollLines`设置和`/settings`条目，用于全屏鼠标滚轮滚动。默认的`"auto"`可加速本地macOS终端外的快速滚轮操作（[#9758](https://github.com/earendil-works/pi/issues/9758)）。
- 在成功的RPC `prompt`、`steer`和`follow_up`响应中增加了每个输入的处置；`AgentSession.steer()`/`followUp()`和`RpcClient.prompt()`/`steer()`/`followUp()`也支持；`RpcClient.prompt()`还接受`streamingBehavior`（[#9098](https://github.com/earendil-works/pi/issues/9098)，[#9803](https://github.com/earendil-works/pi/issues/9803)）。
- 已将图像生成功能添加到`ModelRuntime`：`generateImages()`（支持运行时解析的认证，包括存储凭证、OAuth、运行时API密钥、`models.json`请求头），以及`getModelsOfType()`、`getModelOfType()`、`getAvailableOfType()`、`getAllModels()`和`getAllAvailable()`。OpenRouter图像模型列在`openrouter`提供商下，并共享其凭证；上游ID可以拥有独立的聊天和图像条目。`models.json`提供商和没有模型列表的扩展注册表将内置图像生成功能。扩展模型列表可以包含区分的聊天、图像和分类器条目及其操作实现；当提供时，它们会替换提供商目录中的所有操作。面向聊天的读取功能（`getModels()`、`getAvailableSnapshot()`、模型选择器）保持不变。

- 已为`ModelRuntime`添加分类器支持，包括`classify()`分类器模型访问器、运行时解析的认证和内置的类型安全`jev-latest`模型。

- 已将`types=chat,image,classifier`添加到pi.dev模型目录请求中，以便远程刷新覆盖所有支持的模型类型；未知模型类型的条目将被忽略。

- 已添加`provider_stream_event`扩展事件，用于在归一化之前观察解析的提供商事件，带有一个可选的`/debug-provider`示例查看器（[#9784](https://github.com/earendil-works/pi/issues/9784)，[#9901](https://github.com/earendil-works/pi/pull/9901)由[@davidbrai](https://github.com/davidbrai)提供）。

- 已在HTML导出中为标记了`display: false`的自定义消息添加了显示/隐藏切换（`H`）。消息默认隐藏，也可以从侧边栏中显示（[#8896](https://github.com/earendil-works/pi/issues/8896)，[#10020](https://github.com/earendil-works/pi/pull/10020)由[@rwachtler](https://github.com/rwachtler)提供）。

- 已为Anthropic添加了继承的Claude Sonnet 5.5支持，具备适应性思维和1M上下文窗口。

- 已在`pi config`中添加了“内置”部分，用于全局或按项目禁用内置的`mcp`、`llama.cpp`、`codemode`和`tool-search`扩展，存储在`extensions`的`-builtin:<name>`设置中。SDK内联扩展通过`builtin: true`进行选入。

- 已在`defaultTools`设置中添加了`+name`和`-name`条目，用于添加或移除工具而无需重复默认值，例如`"defaultTools": ["+codemode"]`。此类项目条目将叠加在用户设置之上。文档说明了如何在不使用MCP的情况下启用`codemode`，以及如何在代码模式脚本中使用分类器模型（如Jev）。
- 已将 codemode `models.classify()`调用的令牌使用量和成本添加到 codemode 工具结果中，因此它们计入会话成本；codemode 结果中显示了每个调用的成本。

### 已更改

- 将构建从 TypeScript 原生预览版切换到 TypeScript 7.0（目标为 ES2024），并用 Node 自带的类型剥离功能替换了 `tsx`（运行源代码）[#9965](https://github.com/earendil-works/pi/issues/9965)。
- 移除了启动横幅中的 `[Themes]`部分。自定义主题仍可在 `/settings`中使用，主题冲突报告功能依然保留。
- 将启动页标题更改为显示 pi 图标和版本号，而非应用名称。
- 将内置的 `dark`和 `light`主题更改为修订后的 pi 颜色，采用 OKHSL 格式。
- 将亮/暗终端检测逻辑调整为优先使用报告的背景色，其次是终端的亮/暗报告，最后是 `COLORFGBG`。首次设置不再显示检测到的外观。
- 将继承的 OpenAI Codex 提供器重命名为“OpenAI Codex (legacy)”；在 OpenAI 提供器上使用 ChatGPT 登录已取代该提供器。
- 将继承的终端检测逻辑更改为将 `TERM=*-direct`视为真彩色。
- 内置扩展和工具在错误、诊断、RPC 源信息和 bug 报告中的名称更改为 `builtin:<name>`（例如 `builtin:mcp`和 `builtin:read`），而非 `<inline:name>`和 `<builtin:name>`。它们的斜杠命令不再带有 `[t]`自动补全标签。
- `--no-extensions`也禁用了内置扩展，包括 llama.cpp 提供器。可通过 `-e builtin:<name>`显式加载，例如 `pi -ne -e builtin:mcp`。
-  不带自定义调用渲染器的工具调用（包括直接的MCP工具调用）现在会显示其参数：折叠时在标题行显示为`key=value`，展开时每个参数占一行`key: value`。MCP调用的标题为`server/tool`，其结果折叠后显示为5行。

-  `bash`和`powershell`结构化结果，现在可接收的输出最大可达1 MiB，而非面向模型的2000行或50KB限制，并新增了`truncated`和`full_output_path`。较长的输出会保留其开头和结尾的512 KiB。空输出显示为`""`，而非`(no output)`。

###  修复

-  修复了X11剪贴板文本被错误识别为图像的情况，当剪贴板拥有者接受未明确的图像目标时（[#9786](https://github.com/earendil-works/pi/issues/9786)）。
-  防止托管的git包自动安装Pi对等依赖，并为在`dependencies`中列出主机提供模块的扩展包添加了警告（[#9863](https://github.com/earendil-works/pi/issues/9863)）。
-  修复了使用`-e`加载的固定git扩展在引用变更后仍使用首次下载的提交（[#9982](https://github.com/earendil-works/pi/issues/9982)）。
-  修复了`RpcClient`在处理事件时取消订阅监听器导致跳过下一个事件监听器的问题，这可能导致`waitForIdle()`在`collectEvents()`后超时（[#9990](https://github.com/earendil-works/pi/issues/9990)）。
-  修复了全文件`read`调用在模型发送`null`时被误渲染为`:1`，且`offset`和`limit`被省略（[#9996](https://github.com/earendil-works/pi/issues/9996)）。
-  修复了pi退出前丢失新会话的问题。会话文件现在在首次发送用户消息时创建（[#10000](https://github.com/earendil-works/pi/issues/10000)）。
-  修复了卸载的llama.cpp自动加载预设覆盖缓存运行时上下文窗口，导致使用了GGUF训练上下文（[#10077](https://github.com/earendil-works/pi/issues/10077), [#10158](https://github.com/earendil-works/pi/pull/10158) 由[@cristinaponcela](https://github.com/cristinaponcela) 提交）。
-  修复了自定义主题忽略`terminal.trueColor`和其他终端能力覆盖，导致以256色渲染（[#9973](https://github.com/earendil-works/pi/issues/9973), [#10039](https://github.com/earendil-works/pi/pull/10039) 由[@christianklotz](https://github.com/christianklotz) 提交）。
-  修复了在Finder中复制的文件粘贴时插入文件图标图像而非文件路径；在bash模式下路径已加引号（[#9999](https://github.com/earendil-works/pi/issues/9999), [#10136](https://github.com/earendil-works/pi/pull/10136) 由[@christianklotz](https://github.com/christianklotz) 提交）。
-  修复了启动页、加载资源和聊天通知在主题变更后仍保留旧颜色的问题。
-  修复了Fireworks默认模型指向已移除的Kimi K2.6模型；现在默认指向Kimi K3。
-  修复了OpenCode Go默认模型指向已移除的Kimi K2.6模型；现在默认指向Kimi K3。
-  修复了Together默认模型指向已移除的Kimi K2.6模型；现在默认指向Kimi K3。
-  在长会话和预览主题时降低CPU使用率：底部缓存会话使用总量，折叠的bash结果缓存其预览，且`sanitizeBinaryOutput()`不再将输出拆分为每个字符的数组。
-  修复了通过`ctx.executeTool()`调用的工具（例如codemode脚本）的使用量被忽略；现在会添加到调用工具的结果使用量中。
-  修复了继承的`/skill`自动补全在加载的技能名称中未包含`skill`中的字母时显示为空（[#9944](https://github.com/earendil-works/pi/issues/9944)）。
-  修复了继承的路径和`@`自动补全在打开如`(`、`[`、`{`、`<`或反引号的包裹后无法工作的问题。
-  修复了继承的图像在使用Kitty图形协议的终端中拉伸异常（[#8938](https://github.com/earendil-works/pi/issues/8938), [#9957](https://github.com/earendil-works/pi/pull/9957) 由[@rwachtler](https://github.com/rwachtler) 提交）。
-  修复了扩展在关闭时隐藏shell光标的问题（[#10026](https://github.com/earendil-works/pi/issues/10026)）。
-  修复了在`/settings`子菜单关闭时丢失键盘输入的问题。
-  修复了通过Vercel AI Gateway的1小时Anthropic缓存写入被按5分钟费率计费的问题（[#9210](https://github.com/earendil-works/pi/issues/9210)）。
- 修复了继承的模型级别`samplingParams`被直接通过OpenAI兼容API的`stream()`/`complete()`调用时被丢弃的问题（[#9506](https://github.com/earendil-works/pi/issues/9506)）。
- 修复了继承的Mistral GLM请求在内容增量为空时出现“Expected at most one leading ThinkChunk”错误的问题（[#9674](https://github.com/earendil-works/pi/issues/9674)）。
- 修复了继承的OpenAI快速模式请求被按标准费率计费的问题（[#10034](https://github.com/earendil-works/pi/issues/10034)）。
- 修复了继承的Mistral推理模型忽略请求的思考等级的问题（[#9678](https://github.com/earendil-works/pi/issues/9678)）。
- 修复了继承的OpenCode Zen和OpenCode Go `qwen3.8-flash`思考内容在后续轮次被重放为纯文本的问题（[#10047](https://github.com/earendil-works/pi/issues/10047)）。
- 修复了继承的OpenAI响应流从服务器（如llama.cpp）省略`output_index`时出现工具调用混乱的问题；此类流现在将以错误结尾（[#9974](https://github.com/earendil-works/pi/issues/9974)）。
- 修复了继承的Anthropic和OpenAI Codex浏览器登录在提供方重定向出现授权错误后无限等待，以及Anthropic登录在回调端口被占用时失败的问题。
- 修复了GitHub Copilot Claude Opus 5.5在上游模型元数据不完整时提供不支持的思考等级的问题。

## [0.87.1] - 2026-09-22

### 新功能

- **最新前沿模型** — 可通过支持的提供方使用Claude Opus 5.5、GPT-6 Sol和GPT-6 Luna。详见[选择模型](docs/models.md#select-a-model)。
- **默认xAI模型为Grok 4.7** — 新的xAI会话默认使用Grok 4.7。详见[提供方认证](docs/providers.md#use-an-api-key-from-the-environment)。

### 新增

- 新增继承的Claude Opus 5.5、GPT-6 Sol和GPT-6 Luna对GitHub Copilot的支持。
- 新增继承的GPT-6 Sol和GPT-6 Luna对OpenAI API密钥和OpenAI Codex订阅的支持。
- 新增继承的Claude Opus 5.5对Anthropic的支持，含自适应思考和1M上下文窗口。

### 变更

- 将默认的xAI模型更改为Grok 4.7。

### 修复

- 修复了Claude Fable 5.1拒绝拆分轮次压缩摘要的问题，通过清晰分离对话并使用面向延续的指令解决（[#9908](https://github.com/earendil-works/pi/pull/9908) 由[@davidbrai](https://github.com/davidbrai) 提交）。
- 修复了缺失或无效的`--mode`值被静默忽略而不是报错并退出（[#9045](https://github.com/earendil-works/pi/issues/9045)）。
- 修复了某些OpenAI兼容提供方拒绝纯图片用户消息的问题，因为这些消息包含空文本部分（[#9797](https://github.com/earendil-works/pi/issues/9797)）。
- 修复了继承的Anthropic OAuth请求报告过时的Claude Code版本。

## [0.87.0] - 2026-09-21

### 新功能

- **标准会话上下文和扩展边界** — 可编辑模型上下文而不重写历史，并添加可执行生命周期钩子。详见[上下文编辑项](docs/session-format.md#contexteditentry)和[扩展事件](docs/extensions.md#extension-events)。
- **完整转录上下文扩展** — 可使用`context_with_system`对每次请求的系统消息进行转换。详见[`context_with_system`](docs/extensions.md#context_with_system)。
- **每模型图片输入限制** — 可为附件、`read`和工具结果图片配置缓存安全的图片缩放。详见[图片输入限制](docs/models.md#image-input-limits)。

### 重大变更

- 移除了继承的`shouldStopAfterTurn`代理选项。改用`finishTurn`，并返回`{ action: "end" }`。`finishTurn`在`turn_end`之前运行但决策在后，且也会接收错误和中止响应；迁移正常响应谓词时，对硬退出返回`undefined`。详见`@earendil-works/pi-agent-core`变更日志中的完整前后例。
- 新增`ContextEditEntry`到导出的`SessionEntry`联合类型。TypeScript消费者必须处理`context_edit`；使用`replacement: null`进行省略和内容替换。
- 使`SessionManager`成为`AgentSession`提供方上下文的标准选项。不再用`session.agent.state.messages`覆盖未来请求历史；可通过`SessionManager.inMemory(cwd, { id }, entries)`恢复、`session.navigateTree()`导航或通过`session.sessionManager`追加后调用`session.refreshContext()`。
- 扩展了`TurnEndEvent`，增加了必要的边界字段，并将`AgentBeforeSettleEvent`添加到导出的`ExtensionEvent`联合体中。构建事件或对`ExtensionEvent`进行穷举切换的消费者必须处理新的形状。`ExtensionRunner.emit()`不再接受`turn_end`；主机集成通过`emitBoundary(baseEvent, buildContext)`分发可执行边界。

- 将`agent_settled`处理器请求的运行延迟，直到所有已结算的处理器完成。处理器仍然观察`ctx.isIdle() === true`，但在同一通知分发期间不再看到可重入的`agent_start`。

### 添加

- 添加了仅追加的模型上下文编辑。例如，`sessionManager.appendContextEdit(entryId, null)`在未来提供上下文时省略一条消息，而不更改原始历史、使用记录或用户界面历史。

- 添加了可执行的`turn_end`和`agent_before_settle`扩展边界。返回`{ entries: [...event.entries, draft], continue: true }`以保持结构化条目的顺序，并确保在不更改导航或后续调度的情况下发出下一个提供者请求。

- 添加了保留None压缩输入：`sessionManager.appendCompaction(summary, null, tokensBefore)`将压缩自身的ID作为其保留边界。

- 添加了`context_with_system`扩展事件，该事件在完整转录（包括系统消息）上运行`context`处理器，并将其结果原样返回。详见[`context_with_system`](docs/extensions.md#context_with_system)。

- 通过`inputLimits.images.resize`在`models.json`中添加了每个模型的图像缩放配置文件，应用于文件附件、图像读取和工具结果图像（[#9631](https://github.com/earendil-works/pi/issues/9631)）。

### 修复

- 修复了字符串上下文编辑替换产生无效助手和工具结果消息内容，而不是文本块的问题。

- 修复了上下文不可见边界元数据和替换编辑，导致新追加或替换的输入在首次提供者请求之前被总结。

- 修复了编辑上下文会计，解决了在最新上下文编辑后丢弃有效助手使用记录，以及在后续压缩使其过期后重新使用该使用记录的问题。

- 修复了选择错误重试和最终长度/溢出恢复，解决了废弃模型尝试在后续提供者上下文中保留的问题；运行后恢复省略现在被持久化，且不会隐藏原始转录历史或更改队列调度。

- 修复了`context`处理器过滤或切片消息时丢弃提示和工具声明，导致在扩展驱动压缩后请求中没有内置工具或使Codex输出原始工具调用文本。处理器不再看到系统消息；Pi在它们运行后恢复提示和工具状态。详见[`context`](docs/extensions.md#context)（[#9789](https://github.com/earendil-works/pi/issues/9789)，[#9822](https://github.com/earendil-works/pi/issues/9822)）。

- 修复了`/bug`允许离线模式上传，同时保留本地zip导出（[#9841](https://github.com/earendil-works/pi/pull/9841) by [@christianklotz](https://github.com/christianklotz)）。

- 修复了空闲提示缓存，在计时器或扩展决策延迟时重建过期缓存。

- 改进了崩溃诊断，提供了加载扩展的提示，这些扩展会出现在堆栈跟踪中。

- 修复了以`GIF`开头的文本文件被误分类为图像，并被`read`和CLI `@file`输入省略（[#9755](https://github.com/earendil-works/pi/issues/9755)）。

- 修复了格式不正确的提示模板前置元被静默忽略，而不是作为资源警告报告（[#9830](https://github.com/earendil-works/pi/pull/9830) by [@christianklotz](https://github.com/christianklotz)）。

- 修复了继承未知OpenAI兼容的Chat Completions端点，在没有明确广告支持的情况下接收严格工具模式（[#9816](https://github.com/earendil-works/pi/issues/9816)）。

## [0.86.1] - 2026-09-20

### 新功能

- **Meta Muse提供者**——使用`/login meta`或`META_API_KEY`登录Meta，访问Muse Spark模型。详见[Meta (Muse订阅)](docs/providers.md#meta-muse-subscription)。

### 添加

- 添加了通过`/login meta`的Meta（Muse订阅）登录，自动刷新模型API密钥，以及`META_API_KEY`支持（[#9096](https://github.com/earendil-works/pi/pull/9096) by [@xl0](https://github.com/xl0)）。

### 更改

- 在加载捆绑的CLI运行时之前启用Node的持久编译缓存，减少重复启动时间。

### 修复
- 修复了`/bug`描述中删除换行符的问题。
- 修复了`/bug`提示信息在用户取消操作和可重试的提供者故障（如服务不可用）时的显示问题。
- 修复了剪贴板复制在容器和无WSLg的WSL中失败的问题，通过恢复无显示时的OSC 52回退机制实现，并为WSL添加了经过验证的Windows剪贴板后端（[#9688](https://github.com/earendil-works/pi/issues/9688)）。
- 修复了继承自z.ai的`Prompt too long`错误未被识别为上下文溢出的问题（[#9805](https://github.com/earendil-works/pi/issues/9805)）。
- 修复了继承自Cerebras的模型广告不支持严格工具模式的问题，该问题会导致混合使用严格和非严格工具时出现HTTP 400错误（[#9804](https://github.com/earendil-works/pi/pull/9804) 由[@EdenGottlieb](https://github.com/EdenGottlieb)提交）。

## [0.86.0] - 2026-09-19

### 新特性

- **提示缓存预热** — 在长时间工具运行期间保持有价值的提示缓存，并可选地在空闲时使用成本感知的刷新机制。详见[缓存预热](docs/settings.md#cache-warming)。
- **问题报告** — 使用脱敏的诊断信息、可选的转录文件或导出的ZIP归档报告`/bug`的问题。详见[报告问题](docs/sessions.md#reporting-bugs)。
- **转录感知的提示和工具更新** — 在恢复和分支导航过程中保留指令和工具更改，同时保留缓存的前缀。详见[`before_agent_start`](docs/extensions.md#before_agent_start)。
- **离线Radius模型目录** — 立即选择Radius模型，缓存和实时目录叠加显示。详见[Radius](docs/providers.md#radius)。
- **每模型压缩预算** — 通过模型配置保留和最近令牌预算。详见[每模型覆盖](docs/compaction.md#per-model-overrides)。

### 重大变更

- 将继承自pi-ai提供者的流输入从`Context`更改为标准化的`TranscriptContext`值。自定义提供者必须从`context.messages`中读取系统提示和工具声明，并使用`getCurrentSystemPrompt()`和`getCurrentTools()`。详见[自定义流式API](docs/custom-provider.md#custom-streaming-api)。
- 限制了继承自`ToolCall.arguments`和`ToolResultMessage.details`的值为JSON兼容格式，将`ToolResultMessage`改为条件类型，并将`JsonValue`数组设为只读。
- `user_bash`现在会失败关闭：错误或无效的已定义结果会中止命令，不会调用后续处理器或本地执行。如需继续传播，请返回`undefined`；否则返回`{ operations }`或`{ result }`（[#9068](https://github.com/earendil-works/pi/issues/9068)）。

### 新增

- 新增了基于转录的对话中途系统提示和工具更改，使指令和工具更新能在恢复和分支导航中保留，同时支持缓存前缀。详见[`before_agent_start`](docs/extensions.md#before_agent_start)和[入口类型](docs/session-format.md#entry-types)（[#9548](https://github.com/earendil-works/pi/pull/9548)）。
- 新增了Fireworks Messages模型的原生延迟工具加载。使用`ToolSearch`或`tool_search`作为加载器名称以实现提示前缀的延迟（[#9323](https://github.com/earendil-works/pi/issues/9323)）。
- 新增了分支摘要、压缩摘要和技能调用条目的点击切换功能。
- 新增了公共Radius模型目录，支持立即和离线模型选择，缓存和实时网关目录叠加显示。
- 新增了`ctx.modelRegistry.stream()`和`streamSimple()`，用于通过已配置的提供者进行扩展模型调用并解决认证问题（[#8964](https://github.com/earendil-works/pi/issues/8964)）。
- 新增了通过`compaction.modelOverrides`配置的每模型`reserveTokens`和`keepRecentTokens`设置，普通压缩设置作为回退（[#8133](https://github.com/earendil-works/pi-mono/issues/8133)）。
- 新增了`compat.allowedFallbackModels`配置，用于覆盖或禁用Anthropic服务器端回退模型（[#9294](https://github.com/earendil-works/pi/issues/9294)）。
- 新增了从`pi.on()`中取消订阅的功能，以便扩展可以删除事件处理器。在调度期间添加或删除的处理器将应用于后续调度，而非当前调度（[#8967](https://github.com/earendil-works/pi/issues/8967)）。
- 导出了之前未包含在包入口点的扩展钩子事件和结果类型（[#9642](https://github.com/earendil-works/pi/pull/9642)）。
- 已将 `/bug [description]` 添加至向 Pi 开发者报告 bug 的流程。报告中包含环境、模型、提供商、扩展和设置元数据（机密信息已脱敏），会话中的助手消息诊断信息，可选地包含会话转录内容，或由模型生成的错误摘要。报告会上传至 Radius（无需登录；登录时会注明来源）或导出为 zip 压缩包，报告 ID 会记录在会话中作为 `pi.bug-report` 条目。崩溃信息记录在 `~/.pi/agent/crashes.json`，会在下次启动时通知一次，并附加到下一份报告中；无法解释的错误和耗尽的重试次数会在 `/bug` 中记录，每会话仅记录一次。

- 在长时间工具运行和空闲时增加了基于成本的提示缓存预热功能，支持可配置模式、模型缓存生命周期元数据、`/session` 诊断信息、转录通知以及 `cache_warming_decision` 扩展事件。详见 [缓存预热](docs/settings.md#cache-warming) ([#9668](https://github.com/earendil-works/pi/pull/9668))。

### 更改了

- 在加载捆绑的 CLI 运行时之前启用了 Node 的持久化编译缓存，从而减少了重复启动的时间。

- 使 `--resume` 会话结果逐步显示，利用文件修改时间优先加载整个文件夹，并在选择后取消未完成的转录读取。

- 通过按修改时间顺序检查候选会话头信息并在找到最新匹配会话后停止，将 `--continue` 启动时间缩短。

- 用内置的异步 macOS、Windows 和 X11 辅助程序替换了外部原生剪贴板依赖，同时保留了平台命令和 OSC 52 降级支持 ([#9163](https://github.com/earendil-works/pi/pull/9163))。

- 通过使用原生子串搜索而非逐字符扫描 JavaScript，降低了长文本继承模糊搜索的延迟 ([#9267](https://github.com/earendil-works/pi/issues/9267))。

- 将压缩、分支摘要和重试加载指示器移动到编辑器边框中，与工作指示器同处一栏。自定义编辑器对所有状态加载指示器采用相同的嵌入式选项。

- 启用了对内置 `read`、`bash`、`powershell`、`edit` 和 `write` 工具的严格优先 JSON 模板采样，无需 `PI_EXPERIMENTAL`。扩展可重新注册工具定义至 `constrainedSampling: false`。

- 将至少一分钟的 Bash 和 PowerShell 工具时长格式化为分钟和秒，必要时显示小时 ([#9628](https://github.com/earendil-works/pi/issues/9628))。

- 将扩展编译器和捆绑虚拟模块的加载推迟到文件系统扩展加载时，从而降低了基础 SDK 导入成本 ([#9540](https://github.com/earendil-works/pi/issues/9540))。

### 修复了

- 修复了 GitHub Copilot GPT 模型（包括 GPT-6 Astra）使用聊天补全适配器而非必需的响应适配器的问题 ([#9253](https://github.com/earendil-works/pi/pull/9253) 由 [@petrroll](https://github.com/petrroll) 提交)。

- 修复了 OpenRouter 和 OpenCode Go 上继承的 DeepSeek V4.1 思考层级，使其保留提供商努力元数据 ([#9485](https://github.com/earendil-works/pi/issues/9485))。

- 修复了非 Cerebras 提供商的无正文 HTTP 400/413 错误被误分类为上下文溢出的问题 ([#9482](https://github.com/earendil-works/pi/issues/9482))。

- 修复了 Vercel AI Gateway 上继承的无签名思考内容被重放为助手文本的问题 ([#9676](https://github.com/earendil-works/pi/issues/9676))。

- 修复了 Google 生成式 AI 和 Vertex AI 在省略推理或同一 Gemini 系列模型能力不同时使用不支持的思考层级的问题 ([#9455](https://github.com/earendil-works/pi/issues/9455))。

- 修复了 Anthropic 兼容中继在报告不同响应模型时破坏已签名思考重放的问题，同时保留降级计费 ([#9188](https://github.com/earendil-works/pi/issues/9188))。

- 修复了 Amazon Bedrock 一小时缓存写入被计费为五分钟速率的问题 ([#9457](https://github.com/earendil-works/pi/issues/9457))。

- 修复了从缓冲 `EventStream` 事件中消耗时的二次 CPU 使用问题 ([#9055](https://github.com/earendil-works/pi/issues/9055))。

- 修复了 Mistral Medium 推理请求使用 `reasoning_effort` 代替不支持的 `prompt_mode`，适用于所有支持推理的 `mistral-medium-*` 模型 ID ([#8700](https://github.com/earendil-works/pi/issues/8700))。

- 修复了 OpenCode 和 OpenCode Go 请求在所有支持的 API 适配器中发送 `x-opencode-session` 时使用 `sessionId` 的问题 ([#9326](https://github.com/earendil-works/pi/issues/9326))。
-  修复了继承自 OpenAI Codex 的请求，改为发送模型的 Off 推理努力，而不是省略，同时尊重不支持的 Off 映射（[#9191](https://github.com/earendil-works/pi/issues/9191)）。
-  修复了继承自 Fireworks 的未签名思考回放和推理努力选择，使用目录元数据，并验证了 DeepSeek V4 和 Qwen3.8 的回退，移除了冗余的 GLM 5.2 和 Kimi K3 努力别名（[#9323](https://github.com/earendil-works/pi/issues/9323)）。
-  修复了继承自 OpenRouter 的请求，当提示缓存启用时，发送 `x-session-id` 到 `sessionId` 用于 Chat Completions 和 Anthropic Messages 模型（[#9102](https://github.com/earendil-works/pi/issues/9102)）。
-  修复了继承自 DeepSeek 的目录，广告 `deepseek-flash` 用于 DeepSeek V4.1 Flash，而不是已退役的 Flash 别名，并刷新了 DeepSeek 价格元数据（[#9423](https://github.com/earendil-works/pi/issues/9423)）。
-  修复了继承自 Mistral-hosted 的 GLM-5.2 推理请求，使用 `reasoning_effort` 而不是被忽略的 `prompt_mode`（[#9375](https://github.com/earendil-works/pi/issues/9375)）。
-  修复了继承自 OpenAI 兼容的 Responses 错误，识别实际提供商，而不是始终标记为 OpenAI 错误（[#9298](https://github.com/earendil-works/pi/issues/9298)）。
-  修复了继承自 Baseten 的请求，发送会话亲和性头部从 `sessionId` 用于自动提示缓存路由（[#9629](https://github.com/earendil-works/pi/issues/9629)）。
-  修复了继承自 Cloudflare 的 520 响应的重试分类（[#9627](https://github.com/earendil-works/pi/issues/9627)）。
-  修复了继承自 Azure 的瞬时峰值负载容量错误的重试分类（[#9669](https://github.com/earendil-works/pi/issues/9669)）。
-  修复了会话树导航竞态，启用压缩并替换其进度用户界面（[#9179](https://github.com/earendil-works/pi/pull/9179) by [@acmerfight](https://github.com/acmerfight)）。
-  修复了精确会话 ID 查找，扫描完整转录体而不是读取会话头部（[#9601](https://github.com/earendil-works/pi/pull/9601) by [@metaist](https://github.com/metaist)）。
-  修复了重复的 Anthropic thinking-drop 通知，对相同丢弃块显示，并缩短通知同时保留会话中的细节（[#9391](https://github.com/earendil-works/pi/issues/9391)）。
-  修复了运行中阈值压缩静默跳过超大尾部工具结果（[#9740](https://github.com/earendil-works/pi/issues/9740)）。
-  修复了信号终止的本地 shell 命令被报告为成功但输出不完整（[#9577](https://github.com/earendil-works/pi/issues/9577) by [@BrendanJMurphy](https://github.com/BrendanJMurphy)）。
-  修复了本地剪贴板失败报告成功，尽管终端忽略了回退 OSC 52 写入，并添加了平台特定的设置指导（[#9618](https://github.com/earendil-works/pi/issues/9618)）。
-  限制了代理级别的重试回退到 `retry.maxAgentDelayMs`（默认 60 秒），以便在长时间瞬时故障期间保持响应性（[#8826](https://github.com/earendil-works/pi/issues/8826)）。
-  修复了直接 RPC `steer` 和 `follow_up` 命令绕过扩展 `input` 处理器（[#8718](https://github.com/earendil-works/pi/issues/8718)）。
-  修复了登录后过早的模型缺失错误，等待目录发现。Radius 现在默认为 `balanced`，需要时回退到第一个可用的 Radius 模型。
-  修复了全屏模式，为自定义脚注渲染零行时保留空白行（[#8919](https://github.com/earendil-works/pi/issues/8919)）。
-  修复了没有参数模式的扩展工具，在注册时被拒绝，而不是破坏提供商请求（[#9300](https://github.com/earendil-works/pi/issues/9300)）。
-  修复了 `before_agent_start` 处理器在模型中有对话中间系统消息时返回 `systemPrompt` 和 `forceSystemPrompt`：强制提示现在作为提供商的引导系统提示发送，而不是作为原始提示后的部分补丁。
-  修复了加载的 llama.cpp 模型，`enable_thinking` 聊天模板忽略 Pi 的思考级别（[#9528](https://github.com/earendil-works/pi/issues/9528)）。
-  修复了取消竞态，可能导致自动压缩启动、遗留重试状态或在等待摘要认证时错过取消（[#9340](https://github.com/earendil-works/pi/issues/9340), [#9777](https://github.com/earendil-works/pi/issues/9777)）。
-  修复了异步 Kitty 图像转换，替换较新的部分工具输出图像（[#8743](https://github.com/earendil-works/pi/pull/8743) by [@wutongyuonce](https://github.com/wutongyuonce)）。
- 修复了继承技能的斜杠命令自动补全，将`skill:`前缀优先于纯技能名称的排名（[#9120](https://github.com/earendil-works/pi/pull/9120) 由 [@yearth](https://github.com/yearth) 提交）。

- 修复了继承文件自动补全的边界和CJK标点符号周围的路径引号（[#9746](https://github.com/earendil-works/pi/pull/9746) 由 [@haoqixu](https://github.com/haoqixu) 提交）。

- 修复了继承的LaTeX旧版字体切换回原始源代码、`cases`布局围绕周围公式居中，以及垂直排列不支持和嵌套的显示脚本（[#8827](https://github.com/earendil-works/pi/issues/8827)，[#9564](https://github.com/earendil-works/pi/issues/9564)，[#7929](https://github.com/earendil-works/pi/issues/7929)）。

- 修复了继承的全屏Kitty图像被WezTerm后续行清除擦除的问题（[#9169](https://github.com/earendil-works/pi/issues/9169)）。

### 移除了

- 移除了不可用的继承GPT-5.4和GPT-5.4 mini模型，从OpenAI Codex选择中移除（[#9394](https://github.com/earendil-works/pi/issues/9394)）。

## [0.85.1] - 2026-09-05

### 新功能

- **GPT-6 Astra** — 可通过OpenAI API密钥和OpenAI Codex订阅获得。详见[API密钥](docs/providers.md#api-keys)和[OpenAI Codex](docs/providers.md#openai-codex)。
### 新增

- 新增 GPT-6 Astra 以支持 OpenAI API 密钥和 OpenAI Codex 订阅。
- 新增在全屏模式下按住 Alt 键时鼠标滚轮滚动速度提升五倍（[#9166](https://github.com/earendil-works/pi/pull/9166) 由 [@xl0](https://github.com/xl0) 提交）。

### 修复

- 修复模型和思考模式选择器中可配置的保存快捷键（[#9149](https://github.com/earendil-works/pi/pull/9149) 由 [@rwachtler](https://github.com/rwachtler) 提交）。
- 修复因意外发布内部实验代码和依赖导致的 SDK 导入失败问题。实验子路径 `client` 和 `experimental/plugin` 以及服务器/客户端命令现在仅通过 `pi-test.sh` 提供源码；本地 SDK 和 stdio RPC API 支持保持不变（[#9132](https://github.com/earendil-works/pi/issues/9132)）。
- 修复鼠标悬停导致选择改变并重新定位自动补全和设置列表，使点击目标变为不同项目的问题。
- 修复 GPT-5.6+ 响应模型的长提示缓存请求，改为使用 `prompt_cache_options.ttl: "30m"` 而非 `prompt_cache_retention: "24h"`。
## [0.85.0] - 2026-09-04

### 新功能

- **持久化的Claude思考努力** — 支持Anthropic传输，保留每轮思考努力，并安全恢复于已签名思考不匹配的情况。详见[模型配置](docs/models.md#model-configuration)。
- **全屏转录控制** — 可从滚动转录中跳转到最新消息并使用嵌入式工作指示器。详见[TUI全屏视口](docs/keybindings.md#tui-fullscreen-viewport)。
- **可恢复的内存会话** — 通过SDK恢复外部存储的会话条目。详见[会话管理](docs/sdk.md#session-management)。

### 已添加
- 增加了`SessionManager.inMemory()`对恢复外部管理会话条目的支持（[#8980](https://github.com/earendil-works/pi/pull/8980)由[@y-nk](https://github.com/y-nk)提交）。
- 增加了兼容OpenAI的`vllmPriority`和`supportsMaxOutputTokens`模型设置，用于vLLM调度器优先级和OpenAI响应输出令牌限制（[#9004](https://github.com/earendil-works/pi/pull/9004)由[@AppleDannyClegg](https://github.com/AppleDannyClegg)提交，[#8941](https://github.com/earendil-works/pi/pull/8941)由[@scturtle](https://github.com/scturtle)提交）。
- 增加了关系代数连接符号的继承 LaTeX 渲染功能（[#9050](https://github.com/earendil-works/pi/pull/9050) 由 [@haoqixu](https://github.com/haoqixu) 提交）。
- 添加了一个可点击的“跳转到最新消息”标签，带有`tui.altScreen.bottom`快捷键，当全屏转录向上滚动时显示（[#9080](https://github.com/earendil-works/pi/pull/9080) 由 [@rwachtler](https://github.com/rwachtler) 提交）。

- 添加了Meta（Muse订阅）登录功能，使用`/login meta`，并自动刷新模型API密钥，同时支持`META_API_KEY`。

### 更改了

- 将流式工作指示器移动到默认编辑器边框中，并将其默认的旋转加载器和标签颜色与思考级别边框颜色匹配。自定义编辑器在未选择嵌入指示器的情况下将保留独立指示器（[#8799](https://github.com/earendil-works/pi/pull/8799) 由 [@cristinaponcela](https://github.com/cristinaponcela) 提交）。

- 通过缓存未更改的搜索结果、对ASCII运行进行索引以及仅对可见匹配项进行高亮处理，降低了大型转录本全屏搜索的继承延迟（[#8800](https://github.com/earendil-works/pi/pull/8800) 由 [@cristinaponcela](https://github.com/cristinaponcela) 提交）。

### 修复了
- 修复了在Linux musl系统上对`fd`和ripgrep下载的管理问题（[#9070](https://github.com/earendil-works/pi/pull/9070) by [@Charlie0113-T](https://github.com/Charlie0113-T)）。
- 移除了`/model`中不可用的继承自Grok Build 0.1模型（[#9093](https://github.com/earendil-works/pi/pull/9093) by [@Jaaneek](https://github.com/Jaaneek)）。
- 修复了继承自provider的流，使其发出不兼容的事件序列和自定义工具调用增量。
- 恢复了`@earendil-works/pi-coding-agent/client`的兼容性入口点。
- 修复了继承自Qwen Token Plan Individual目录，使其包含Qwen3.8 Flash（[#9021](https://github.com/earendil-works/pi/issues/9021)）。
- 修复了继承自OpenAI Codex SSE解析，使其能够处理未被空白行跟随的终端事件（[#9047](https://github.com/earendil-works/pi/issues/9047)）。
- 修复了继承自GitHub Copilot Claude Fable 5的请求，使其发送所选推理级别（[#8961](https://github.com/earendil-works/pi/issues/8961)）。
- 修复了继承自Baseten GLM-5.2模型，错误地宣称支持图像输入（[#8293](https://github.com/earendil-works/pi/pull/8293) by [@Panoplos](https://github.com/Panoplos)）。
- 修复了当Bash是唯一启用的工具时，技能不可用的问题（[#8552](https://github.com/earendil-works/pi/pull/8552) by [@xl0](https://github.com/xl0)）。
- 修复了并发会话共享互相覆盖的问题（[#8613](https://github.com/earendil-works/pi/pull/8613) by [@wutongyuonce](https://github.com/wutongyuonce)）。
- 修复了图像方向检测在非EXIF APP1段后跳过EXIF数据（[#8616](https://github.com/earendil-works/pi/pull/8616) by [@wutongyuonce](https://github.com/wutongyuonce)）。
- 修复了导入的会话覆盖已有相同文件名的会话（[#8985](https://github.com/earendil-works/pi/pull/8985) by [@wutongyuonce](https://github.com/wutongyuonce)）。
- 修复了会话分叉在活跃轮次未确定时丢失压缩边界（[#8990](https://github.com/earendil-works/pi/pull/8990) by [@acmerfight](https://github.com/acmerfight)）。
- 修复了在活跃轮次未确定前的内存会话分叉（[#8937](https://github.com/earendil-works/pi/pull/8937) by [@acmerfight](https://github.com/acmerfight)）。
- 修复了继承自Fireworks GLM模型使用错误的API适配器。
- 修复了继承自`NO_PROXY`对根域名和子域名的匹配（[#8737](https://github.com/earendil-works/pi/pull/8737) by [@MeiSiristhebest](https://github.com/MeiSiristhebest)）。
- 修复了`bash`、`edit`、`find`、`grep`、`ls`、`read`和`write`工具忽略`ctx.cwd`（[#8627](https://github.com/earendil-works/pi/pull/8627) by [@vmizg](https://github.com/vmizg)）。
- 修复了在受限seccomp策略下，终端启动时拒绝`SIGWINCH`自信号的处理（[#8898](https://github.com/earendil-works/pi/pull/8898) by [@bartlomiejkida](https://github.com/bartlomiejkida)）。
- 修复了继承自Zed终端的图像能力检测（[#8828](https://github.com/earendil-works/pi/pull/8828) by [@Perlence](https://github.com/Perlence)）。
- 修复了拖拽选择在全屏编辑器中继续覆盖。
- 修复了管理`fd`和ripgrep下载需要GitHub Releases API（[#8708](https://github.com/earendil-works/pi/pull/8708) by [@Terminator666666](https://github.com/Terminator666666)）。
- 修复了推理消耗超过2048-token输出限制时，分支摘要失败的问题（[#8845](https://github.com/earendil-works/pi/issues/8845)）。
- 修复了写工具将UTF-16编码单元计数误报为字节计数，移除了误导性计数（[#8979](https://github.com/earendil-works/pi/issues/8979)）。
- 修复了代理的纯HTTP提供商请求在工具调用后挂起，通过CONNECT方式隧道化处理（[#8134](https://github.com/earendil-works/pi/issues/8134)）。
- 修复了RPC `abort`报告成功但未取消正在进行的手动压缩（[#8920](https://github.com/earendil-works/pi/issues/8920)）。

## [0.84.4] - 2026-08-28

### 新特性

- **终端能力覆盖** — 覆盖检测到的终端超链接、图像和真彩色支持。详见[能力覆盖](docs/terminal-setup.md#capability-overrides)。
- **扩展UI提示事件** — 集成可区分活跃代理工作与等待`ctx.ui`提示的时间。详见[扩展UI提示事件](docs/extensions.md#ui_prompt_start--ui_prompt_end)。
- **RPC队列清除** — 通过`clear_queue`检索并清除排队的导航和后续消息。详见[RPC `clear_queue`](docs/rpc.md#clear_queue)。
- **全屏选择复制控制** — 在全屏模式下禁用自动选择复制，使用Ctrl+X复制活动选择。详见[UI & Display](docs/settings.md#ui--display)。
- **DeepSeek V4 Flash Vision (experimental)** — 通过内置的 DeepSeek 提供器使用具备视觉能力的模型。请参见 [API Keys](docs/providers.md#api-keys)。

### 新增

- 将 `supportsMidConvoEffort` 添加至自定义 Anthropic Messages 模型兼容性设置。
- 当缓存未命中通知启用时，为 Anthropic 思考块恢复期间丢失的转录通知增加提示。
- 新增 `ui_prompt_start` 和 `ui_prompt_end` 扩展事件，以便主机集成可区分活跃代理工作与等待用户面对的 `ctx.ui` 提示（[#8355](https://github.com/earendil-works/pi/pull/8355) by [@cristinaponcela](https://github.com/cristinaponcela)）。
- 将 `detectSupportedImageMimeTypeFromFile()` 添加至公共库导出项（[#8600](https://github.com/earendil-works/pi/pull/8600) by [@xl0](https://github.com/xl0)）。
- 新增继承的实验性视觉能力 `deepseek-v4-flash-vision-exp` 模型支持。
- 当缓存未命中通知启用时，为压缩和分支摘要增加转录使用通知。
- 新增 RPC `clear_queue`，用于检索和移除排队的导航和后续消息（[#8432](https://github.com/earendil-works/pi/issues/8432)）。
- 新增环境变量和高级设置，用于覆盖自动检测的终端超链接、图像和真彩色能力（[#8665](https://github.com/earendil-works/pi/issues/8665)）。
- 新增 `fullscreenCopyOnSelect`，禁用自动全屏选择复制；禁用时，`Ctrl+X` 会在回退到上一条助手消息之前先复制当前文本选择，而 `/tree` 仍会复制选中的消息（[#7720](https://github.com/earendil-works/pi/issues/7720)）。

### 修改
- 将全屏滚动条改为在指针进入时显示，支持可选的 `scrollbarTrack` 和 `scrollbarThumb` 主题颜色（带静音和文本回退），保持正常和展开状态下的拇指颜色一致，并支持轨迹点击跳转。
- 将全屏转录搜索箭头改为悬停时下划线，并将搜索占位符改为大写。
- 修改 `/thinking`、`/model`、`/scoped-models`、`/trust`、每模型思考设置和主题设置中的选择器，保持活跃选项在浏览时被标记。`/scoped-models` 现在使用一致的每项切换按钮，并对不可用模型进行删除标记（[#8900](https://github.com/earendil-works/pi/pull/8900)）。
### 修复

- 修复了切换思考可见性时清除部分正在运行的Bash工具的输出（[#8611](https://github.com/earendil-works/pi/issues/8611)）。
- 修复了Windows shell中中止导致Pi崩溃的问题，当`taskkill.exe`不可用时，`PATH`（[#6596](https://github.com/earendil-works/pi/issues/6596)）。
- 恢复的会话在它们的JSONL文件缺少换行符时会损坏下一个追加的条目（[#8345](https://github.com/earendil-works/pi/issues/8345)）。
- 固定扩展消息在代理运行时与`triggerTurn: false`一起发送，将其插入到工具调用及其结果之间，这使得 提供程序验证消息顺序会拒绝重放历史记录。它们现在在回合的工具结果可用后被追加（[#8537](https://github.com/earendil-works/pi/issues/8537)）。
- 修复了强制执行分支摘要的压缩和分支摘要问题 `toolChoice: "none"` ([#8649](https://github.com/earendil-works/pi/issues/8649), [#8638](https://github.com/earendil-works/pi/issues/8638))。
- 修复了大型工具结果在自动压缩阈值之前发送给提供者的问题。Pi 现在会在工具执行和同一运行中的下一个助手响应之间进行压缩，并在该运行恢复时恢复交互式进度 ([#6879](https://github.com/earendil-works/pi/issues/6879))。
- 修复Google Vertex请求在`HttpsProxyAgent is not a constructor`时失败的问题 捆绑的 Node.js 运行时使用 HTTP(S) 代理（[#8610](https://github.com/earendil-works/pi/issues/8610)）。
- 修复了从非空模型范围保存默认模型的问题，使其在该范围内仍可使用。
- 修复了继承的`@`文件自动补全排名，使其优先匹配直接且较浅的路径，而非同样排名的嵌套路径([#8669](https://github.com/earendil-works/pi/pull/8669))。
- 修复了继承的OpenAI兼容流在流式传输过程中反复序列化思考签名的问题（[#8671](https://github.com/earendil-works/pi/pull/8671)）。
- 修复了因图像密集输出超过V8字符串长度限制而导致的主屏幕渲染崩溃问题（[#8028](https://github.com/earendil-works/pi/issues/8028)）。
- 修复了全屏双击单词选择时路径和kebab-case标记在`/`和`-`中的分割问题（[#8676](https://github.com/earendil-works/pi/pull/8676)）。
- 修复了继承自Cloudflare AI Gateway的目录，解决了省略支持的`workers-ai/*`透传模型的问题。
- 修复了继承自OpenAI兼容的推理回放，解决了合并连续流式文本和摘要`reasoning_details`增量的问题。
- 修复了继承自OpenRouter的推理控制，解决了推理强制模型未收到`effort: "none"`（[#8614](https://github.com/earendil-works/pi/pull/8614) 由 [@davidbrai](https://github.com/davidbrai) 提交）。
- 修复了继承自OpenAI兼容的Chat Completions，解决了在未定义工具时忽略显式请求的`toolChoice`。
- 修复了继承自Mistral的工具调用拆分问题，解决了延续块省略工具调用ID时的分割（[#8387](https://github.com/earendil-works/pi/issues/8387)）。

## [0.84.3] - 2026-08-24

### 新特性

- **PowerShell工具** — 可选的原生PowerShell命令执行（仅限Windows）。详见[PowerShell工具](docs/windows.md#powershell-tool)。
- **更安全的更新管理** — 支持安装程序管理的更新，实现分阶段、验证和原子化激活。详见[安装与管理](docs/packages.md#install-and-manage)。
- **模型与思维控制** — 可选择思维等级（`/thinking`）、搜索默认值、保持会话级选择，并通过Ctrl+S显式持久化。详见[模型与思维](docs/keybindings.md#models-and-thinking)。

### 重大变更

- 重命名了继承的`GoogleThinkingLevel`类型为`GoogleApiThinkingLevel`，并新增`ResolvedGoogleThinkingLevel`用于规范化适配器等级。

### 新增

- 新增可选的`powershell`工具（仅限Windows），可通过`defaultTools`及SDK配置。详见[PowerShell工具](docs/windows.md#powershell-tool)。
- 新增`/thinking`选择器及可搜索的默认选项，支持模型与思维选择器；Ctrl+S可将所选模型设为全局默认。详见[模型与思维](docs/keybindings.md#models-and-thinking)。
- 新增可选的路由会话ID至导出的压缩摘要辅助工具，以便调用方可在不启用提示缓存写入的情况下保留提供方路由。
- 新增摘要压缩和分支摘要的转录使用通知，当缓存未命中通知启用时显示。
- 新增`session_compact_failed`扩展事件，使压缩失败和中止操作可暴露其原因、重试状态、来源和错误信息给处理器（[#8175](https://github.com/earendil-works/pi/issues/8175)）。
- 新增继承的提供者中立的`toolChoice`支持，用于简单流请求。
- 新增继承的自动Anthropic服务器端拒绝回退（针对支持的一方模型），并包含返回模型的使用定价（[#8017](https://github.com/earendil-works/pi/issues/8017)）。
- 新增继承的可配置OpenAI兼容的思维令牌预算字段（适用于vLLM、Qwen/SGLang和llama.cpp服务器）。详见[OpenAI兼容性](docs/models.md#openai-compatibility)（[#8275](https://github.com/earendil-works/pi/pull/8275) 由 [@bnsd55](https://github.com/bnsd55) 提交）。
- 新增继承的中国区特定ZAI Coding Plan模型，包含GLM-4.6V视觉支持及API等效的用量成本估算（[#8220](https://github.com/earendil-works/pi/issues/8220)）。
- 新增继承的`deepseek-v4-pro-0813`支持至Qwen Token Plan Individual目录（[#8194](https://github.com/earendil-works/pi/issues/8194)）。

### 变更

- 变更实验性的安装程序管理安装，使`pi update`分阶段、验证并原子化激活所选版本。详见[安装与管理](docs/packages.md#install-and-manage)。
- 变更继承的xAI模型，使用加密推理回放的Responses API，并将Grok 4.6设为默认xAI模型（[#8124](https://github.com/earendil-works/pi/pull/8124) 由 [@Jaaneek](https://github.com/Jaaneek) 提交）。
- 变更继承的Anthropic、Azure OpenAI、Google、Mistral和OpenAI适配器，发送默认`User-Agent`（除非被覆盖）（[#8305](https://github.com/earendil-works/pi/issues/8305)）。
- 变更Windows和WSL快捷键默认值，避免终端保留快捷键冲突（如图像粘贴、模型循环、编辑器撤销、全屏转录导航与搜索、消息队列等）（[#8372](https://github.com/earendil-works/pi/issues/8372)）。
- 变更Bun发布归档，仅将原生剪贴板二进制文件打包在包装器内，移除每个归档中的重复平台包。
- 变更包资源全局展开，采用Node.js内置实现，确保路径可见性匹配，减少运行时依赖树。
- 将捆绑的Node.js运行时更改为仅在导入扩展时加载jiti，在未缓存源文件需要转换时才加载Babel，从而减少CLI启动时间和捆绑包大小。
- 将语法高亮更改为仅急切初始化二十种常用语言，并将剩余语法推迟到初始TUI渲染之后再加载，从而减少CLI启动时间。
- 将Node.js CLI和RPC入口点更改为加载捆绑运行时，减少启动时的文件系统读取，同时保持公共库和遗留模块路径在模块化运行时中以维持正常依赖身份。
- 将会话共享更改为渲染可点击的终端链接，仅显示标准Radius工件URL，并在Radius会话共享中包含当前系统提示和活动工具定义。

### 修复

- 修复失败的扩展工厂导致事件订阅、提供者注册和默认标志状态保持活动状态（[#8424](https://github.com/earendil-works/pi/pull/8424) 由 [@acmerfight](https://github.com/acmerfight) 提交）。
- 修复`models.json`类型省略了文档中说明的兼容OpenAI的`compat.supportsFinishReason`提供者和模型覆盖（[#8487](https://github.com/earendil-works/pi/pull/8487) 由 [@petrroll](https://github.com/petrroll) 提交）。
- 修复`/model`和`/thinking`的选择在未显式保存（Ctrl+S）的情况下全局持久化（[#5263](https://github.com/earendil-works/pi/issues/5263)）。
- 修复JSON和RPC `toolcall_start`事件省略了工具调用ID和名称（[#7953](https://github.com/earendil-works/pi/pull/7953) 由 [@christianklotz](https://github.com/christianklotz) 提交）。
- 修复当Node.js CLI以单可执行应用程序运行时扩展加载失败（[#8237](https://github.com/earendil-works/pi/issues/8237)）。
- 修复嵌套Markdown技能位于`.agents/skills/`分组目录中时未被发现。
- 修复压缩和分支摘要请求时将工具暴露给提供者。
- 修复单对象`edit`工具输入验证失败，允许它们在编码代理和框架编辑工具中作为单次编辑数组接受（[#7835](https://github.com/earendil-works/pi/issues/7835)）。
- 修复技能目录中的根级Markdown文件如`README.md`和`AGENTS.md`在未声明有效技能前置数据时被报告为损坏的技能（[#7805](https://github.com/earendil-works/pi/issues/7805)）。
- 修复默认的Cerebras模型引用了不可用的Z.AI模型。
- 修复继承的OpenAI兼容聊天补全推理回放以保持和重新发送助手级别的`reasoning_details`原文并按顺序发送（[#7994](https://github.com/earendil-works/pi/issues/7994)）。
- 修复继承的Anthropic服务器端回退响应以请求模型而非回退模型进行计费（[#8285](https://github.com/earendil-works/pi/issues/8285)）。
- 修复继承的GitHub Copilot登录触发模型策略速率限制，通过限制策略更新、模型发现重试一次并尊重服务器重试延迟来解决（[#7850](https://github.com/earendil-works/pi/issues/7850)）。
- 修复继承的Amazon Bedrock在非Anthropic模型中丢弃和失败回放不透明的脱敏推理（[#8314](https://github.com/earendil-works/pi/pull/8314) 由 [@seiji](https://github.com/seiji) 提交）。
- 修复继承的Z.AI编码计划模型推导出不完整的推理努力元数据，包括缺少GLM-5.3低、高和最大级别（[#8336](https://github.com/earendil-works/pi/issues/8336)）。
- 修复继承的DeepSeek V4 Flash在OpenCode和OpenCode Go中省略其支持的低思考级别（[#8181](https://github.com/earendil-works/pi/pull/8181) 由 [@tianshuang](https://github.com/tianshuang) 提交）。
- 修复继承的Azure OpenAI响应忽略`toolChoice`在提供者特定流请求中的支持。
- 修复继承的Amazon Bedrock响应钩子仅接收合成请求ID而非原始响应头（[#8234](https://github.com/earendil-works/pi/issues/8234)）。
- 修复继承的Kimi使用报告，使顶级`cached_tokens`计数作为缓存读取而非正常输入令牌（[#8075](https://github.com/earendil-works/pi/issues/8075)）。
- 修复继承的Google自定义模型忽略`thinkingLevelMap`，该功能已删除扩展的思考控制（[#8135](https://github.com/earendil-works/pi/issues/8135)）。
- 修复对`auth.json`和`models-store.json`的写入操作覆盖了管理员管理的文件权限和ACL（[#7779](https://github.com/earendil-works/pi/issues/7779)）。
- 修复UTF-8 BOM标记阻止前置数据和用户配置文件加载（[#8337](https://github.com/earendil-works/pi/issues/8337)）。
- 修复了在交互式启动过程中容易忽略无效设置文件的问题，通过在TUI中显示文件路径来渲染警告信息（[#7829](https://github.com/earendil-works/pi/issues/7829)）。
- 修复了子代理示例在受信任仓库中运行项目本地代理时反复提示的问题（[#8261](https://github.com/earendil-works/pi/issues/8261)）。
- 添加了`session_compact_failed`扩展事件，以便压缩失败和中止时能够向处理器暴露其原因、重试状态、来源和错误信息（[#8175](https://github.com/earendil-works/pi/issues/8175)）。
- 修复了当生成达到输出令牌限制时，截断的压缩和分支摘要仍会被持久化的问题（[#7048](https://github.com/earendil-works/pi/issues/7048)）。
- 修复了npm包更新检查将较旧的注册表版本视为可用更新，从而阻止`pi update`对已安装的新版本包进行降级的问题（[#8226](https://github.com/earendil-works/pi/issues/8226)）。
- 修复了内置的llama.cpp模型在`/model`刷新配置服务器（`PI_OFFLINE`）时从`/llama`中消失的问题，并在可选目录中包含了空闲睡眠的`sleeping`路由器模型及可自动加载的未加载预设（[#8558](https://github.com/earendil-works/pi/pull/8558) by [@cristinaponcela](https://github.com/cristinaponcela)）。
- 修复了`pi.registerFlag()`接受默认值但该值与声明的标志类型不匹配的问题（[#8064](https://github.com/earendil-works/pi/issues/8064)）。
- 修复了Z.AI编码计划默认值引用已移除的GLM-5.1模型的问题（[#8096](https://github.com/earendil-works/pi/issues/8096)）。
- 修复了重复的模糊截断响应恢复被误标记为上下文溢出的问题（[#8130](https://github.com/earendil-works/pi/issues/8130)）。
- 修复了在基于VS Code的终端上Windows系统中重复的全屏右键粘贴问题（[#8186](https://github.com/earendil-works/pi/issues/8186)）。
- 修复了继承的填充文本超出窄终端宽度的问题（[#8252](https://github.com/earendil-works/pi/issues/8252)）。
- 修复了继承的换行Markdown表格链接将颜色泄漏到边框和相邻单元格中，包括块引用内的表格问题（[#8335](https://github.com/earendil-works/pi/issues/8335)）。
- 修复了llama.cpp登录引导，当没有加载本地模型时，应先指向`/llama`再指向`/model`（[#8203](https://github.com/earendil-works/pi/issues/8203)）。
- 修复了挂起的pi.dev模型目录请求消耗完整刷新截止时间且不重试的问题（[#8198](https://github.com/earendil-works/pi/issues/8198)）。
- 修复了继承的Xiaomi模型目录在`/model`和`--list-models`中列出已关闭的MiMo V2模型（[#8187](https://github.com/earendil-works/pi/issues/8187)）。
- 修复了分支摘要条目记录导航目的地（`fromId`）而非预导航源叶的问题。
- 修复了当提供程序省略流式使用数据时，阈值自动压缩被跳过的问题（[#8328](https://github.com/earendil-works/pi/issues/8328)）。
- 修复了以连字符开头的提示被解析为选项，通过支持`--`作为选项结尾来实现（[#7269](https://github.com/earendil-works/pi/issues/7269)）。

## [0.84.2] - 2026-08-14

### 新特性

- **全屏转录搜索** — 可以在全屏模式下搜索和导航匹配项。详见[TUI全屏视口](docs/keybindings.md#tui-fullscreen-viewport)。
- **可配置默认工具** — 可以全局或按项目选择启动内置工具。详见[工具](docs/settings.md#tools)。
- **可配置全屏退出输出** — 可以选择退出时打印转录内容或仅显示续会提示。详见[交互模式](docs/usage.md#interactive-mode)。

### 新增

- 新增了针对思考部分和工具结果的每区块全屏鼠标扩展，同时保持拖选和链接激活功能。
- 新增了全屏转录搜索功能，支持`Ctrl+Shift+F`，增量匹配高亮，可配置搜索匹配主题颜色，以及通过`Enter`/`Ctrl+G`和`Shift+Enter`/`Ctrl+Shift+G`进行前后导航。
- 新增了对默认`read`、`bash`、`edit`和`write`工具在`PI_EXPERIMENTAL=1`下的实验性严格JSON模式约束采样。
- 新增了全屏退出输出设置，可以选择打印最终转录内容或仅显示会话续会提示。
- 新增了`defaultTools`设置，用于全局或按项目配置初始内置工具选择。
- 新增了`--use-theme <name[/name]>`，用于选择每次运行的交互主题，而无需更改保存的设置（[#7722](https://github.com/earendil-works/pi/pull/7722) by [@rwachtler](https://github.com/rwachtler)）。
- 已将 `expandPromptTemplates` 添加到扩展 `pi.sendUserMessage()` 的选项中，以明确分发命令并扩展技能和提示模板。详见 [`pi.sendUserMessage()`](docs/extensions.md#pisendusermessagecontent-options) ([#7857](https://github.com/earendil-works/pi/pull/7857) by [@mrexodia](https://github.com/mrexodia))。

- 已添加继承项 `createGatewayBindingFetch()`，用于将 Cloudflare AI Gateway 请求通过 Workers AI 绑定路由，无需 API 令牌 ([#7901](https://github.com/earendil-works/pi/pull/7901) by [@Maximo-Guk](https://github.com/Maximo-Guk))。

- 已添加继承项 `AssistantMessage.endTurn`，以保留 OpenAI Codex 的终端 `end_turn` 信号，用于诊断 ([#7766](https://github.com/earendil-works/pi/pull/7766))。

- 已添加继承项，支持全屏模式下的单行转录滚动操作。详见 [TUI Fullscreen Viewport](docs/keybindings.md#tui-fullscreen-viewport) ([#7903](https://github.com/earendil-works/pi/pull/7903) by [@midastruth](https://github.com/midastruth))。

### 已更改

- 已将继承项 Kimi Coding 请求的运行时 `User-Agent` 头部更改为使用 pi。

- 已将继承项 Mistral SDK 传输替换为原生的 Chat Completions HTTP 流，消除了其生成客户端和模式运行时的开销。

- 已记录通用 `AI_AGENT=pi` 进程标记及其与 `PI_CODING_AGENT=true` 的区别 ([#7747](https://github.com/earendil-works/pi/issues/7747))。

- 已更改继承项 OpenAI 响应的延迟工具加载，优先使用支持的消息锚定 `additional_tools`，同时保留工具搜索和顶层回退 ([#7709](https://github.com/earendil-works/pi/issues/7709))。

- 已减少继承项全屏渲染的分配抖动，通过直接绘制全宽布局行，而非在每一帧都重新合成。

### 已修复

- 已修复根 Markdown 文件（如 `README.md` 和 `AGENTS.md`）在技能目录中被报告为无效技能，除非它们声明有效的技能前置信息 ([#7805](https://github.com/earendil-works/pi/issues/7805))。

- 已修复单对象 `edit` 工具输入的验证失败问题，允许它们在编码代理和框架编辑工具中作为单次编辑数组使用 ([#7835](https://github.com/earendil-works/pi/issues/7835))。

- 已修复管理工具下载延迟 TUI 启动并在全屏模式下隐藏诊断的问题，通过先挂载 TUI 并在其中显示下载进度和警告。
- 修复了启动后立即打开模型选择器时，取消并重新启动正在进行的模型目录刷新的问题。
- 修复了继承自 GitHub Copilot 的登录会触发 API 速率限制，同时启用模型策略时限制了并发策略更新（[#6187](https://github.com/earendil-works/pi/issues/6187)）。
- 修复了全屏转录搜索在手动滚动和碎片化鼠标输入时，匹配项会回退到当前匹配项，并且输入会泄露到搜索查询中。
- 修复了继承自父级的必须 LaTeX 参数在新行开始时被解析为空的问题（[#7760](https://github.com/earendil-works/pi/issues/7760)）。
- 更新了转义的 `nanoid` 开发依赖项，以解决拒绝服务漏洞。
- 修复了扩展工具结果的回退渲染，以折叠长输出并尊重工具扩展（[#7979](https://github.com/earendil-works/pi/issues/7979)）。
- 修复了 JSON 和 RPC `message_update` 事件在流式传输过程中丢失累计使用量的问题。请参阅 [JSON 事件模式](docs/json.md) 和 [RPC `message_update`](docs/rpc.md#message_update-streaming)（[#7982](https://github.com/earendil-works/pi/pull/7982) 由 [@christianklotz](https://github.com/christianklotz) 提交）。
- 修复了 `pi.sendMessage(..., { triggerTurn: false })` 在活动运行中进行导航，而不是仅记录自定义消息（[#8022](https://github.com/earendil-works/pi/pull/8022) 由 [@cristinaponcela](https://github.com/cristinaponcela) 提交）。
- 修复了 `defaultTools` 设置在选择内置默认项时，会丢弃扩展和 SDK 自定义工具。
- 修复了子代理示例拒绝在 `tools` 前置数据字段中使用 YAML 数组语法（[#7598](https://github.com/earendil-works/pi/pull/7598) 由 [@alexsavio](https://github.com/alexsavio) 提交）。
- 修复了子代理示例在选择时会丢弃父会话模型、思考和工具配置（[#7897](https://github.com/earendil-works/pi/pull/7897) 由 [@virtuald](https://github.com/virtuald) 提交）。
- 修复了自定义系统提示将当前工作目录与后续追加的提示内容拼接在一起的问题（[#7887](https://github.com/earendil-works/pi/pull/7887) 由 [@distributedlock](https://github.com/distributedlock) 提交）。
- 修复了继承自 OpenAI 的响应函数和自定义工具调用在流式传输、代理和回放过程中丢失命名空间的问题（[#7709](https://github.com/earendil-works/pi/issues/7709)）。
- 修复了继承的上游请求缓冲区失败未触发自动助手重试的问题。
- 修复了继承的内置和自定义DeepSeek API模型通过不受支持的字段发送输出限制。
- 修复了继承的Amazon Bedrock回放拒绝包含空对象键的工具参数，同时保留所有有效嵌套值（[#7882](https://github.com/earendil-works/pi/pull/7882) 由 [@muyiyr](https://github.com/muyiyr) 提交）。
- 修复了继承的DeepSeek兼容性检测，当基础URL的主机名包含大写字母时（[#7933](https://github.com/earendil-works/pi/pull/7933) 由 [@yearth](https://github.com/yearth) 提交）。
- 修复了继承的Google Generative AI和Vertex AI响应，工具调用错误地将output-limit或provider-error停止视为正常工具使用（[#8059](https://github.com/earendil-works/pi/issues/8059)）。
- 修复了继承的全屏鼠标拖选和OSC 8链接激活，在终端报告通用SGR鼠标释放按钮代码时（[#7963](https://github.com/earendil-works/pi/issues/7963)）。
- 修复了继承的聚焦全屏覆盖层未接收鼠标滚轮或视口滚动键（如PageUp和PageDown）（[#7894](https://github.com/earendil-works/pi/issues/7894)）。
- 修复了继承的LaTeX控制空间跨行结束导致完整表达式回退到原始源代码。
- 修复了split `Alt+Enter`输入通过SSH被误读为Escape，为高延迟终端添加了`PI_TUI_ESC_TIMEOUT`，并将独Escape输入的超时限制（[#7899](https://github.com/earendil-works/pi/pull/7899) 由 [@powerfooI](https://github.com/powerfooI) 提交）。
- 修复了继承的空闲全屏会话在终端失去焦点时重绘和清除文本选择（[#7892](https://github.com/earendil-works/pi/pull/7892) 由 [@terrorobe](https://github.com/terrorobe) 提交）。
- 修复了全屏选择复制使用主机剪贴板并在不支持OSC 52时报告失败而非声称成功（[#8110](https://github.com/earendil-works/pi/pull/8110) 由 [@Panoplos](https://github.com/Panoplos) 提交）。

## [0.84.1] - 2026-08-07

### 新功能

- **Qwen Token Plan Individual** — 使用内置提供者以文档中Individual订阅支持的模型。见[API Keys](docs/providers.md#api-keys)。
- **认证准备检查** — 使用`pi auth check`验证提供者或模型凭证，可选地输出解析后的凭证。
- **改进全屏交互** — 支持多点击选择单词和段落，并可配置半页转录滚动。见[TUI Fullscreen Viewport](docs/keybindings.md#tui-fullscreen-viewport)。
- **终止被阻塞的工具调用** — 扩展`tool_call`处理器可停止所有终止批次而无需另一次模型调用。见[Tool Events](docs/extensions.md#tool-events)。

### 新增

- 新增Qwen Token Plan Individual作为内置提供者，包含其文档订阅模型目录及共享国际`QWEN_TOKEN_PLAN_API_KEY`。见[API Keys](docs/providers.md#api-keys)（[#7659](https://github.com/earendil-works/pi/pull/7659) 由 [@arasovic](https://github.com/arasovic) 提交）。
- 新增`pi auth check`提供者/模型认证预检，可选输出凭证（[#7152](https://github.com/earendil-works/pi/issues/7152)）。
- 新增`terminate`支持，使被阻塞的扩展`tool_call`事件支持所有终止批次跳过自动后续模型调用。见[Tool Events](docs/extensions.md#tool-events)（[#7715](https://github.com/earendil-works/pi/pull/7715) 由 [@muyiyr](https://github.com/muyiyr) 提交）。
- 新增继承的双击单词和空白选择、感知粒度的拖选、全屏模式下三击段落选择（[#7725](https://github.com/earendil-works/pi/issues/7725), [#7733](https://github.com/earendil-works/pi/pull/7733) 由 [@volsa](https://github.com/volsa) 提交）。
- 新增继承的未绑定半页转录滚动动作，全屏模式。见[TUI Fullscreen Viewport](docs/keybindings.md#tui-fullscreen-viewport)（[#7735](https://github.com/earendil-works/pi/issues/7735)）。

### 更改

- 软化了bash工具的`PI_*`环境指南，试图减少不必要的检查命令（[#7128](https://github.com/earendil-works/pi/issues/7128)）。
- 将最坏情况自动终端主题检测延迟从200毫秒减少到100毫秒，通过并发探测颜色方案和背景支持实现。

### 修复

- 修复了Bun独立二进制启动时崩溃的问题，当工作目录包含`bunfig.toml`且有`preload`时，通过编译`--no-compile-autoload-bunfig`解决（[#7685](https://github.com/earendil-works/pi/pull/7685) 由 [@geril07](https://github.com/geril07) 提交）。
- 修复了扩展 TUI 方法包装器在递归调用原始方法时无限递归的问题（[#7731](https://github.com/earendil-works/pi/issues/7731)）。
- 修复了在 Windows 全屏模式下右键点击无法粘贴剪贴板文本的问题。
- 修复了继承自 `Agent.reset()` 的清除转录和运行时状态问题；现在在代理忙碌时拒绝执行（[#7717](https://github.com/earendil-works/pi/pull/7717) 由 [@wesleyzhangwq](https://github.com/wesleyzhangwq) 提交）。
- 修复了继承自 LaTeX 的关系、乘法和命名运算符间距，以及堆叠分数、运算符极限和相邻矩阵的矩阵组合问题。
- 通过使用按钮运动跟踪代替所有运动跟踪，降低了在 tmux、Zellij 和 GNU Screen 下全屏鼠标事件的音量。

## [0.84.0] - 2026-08-06

### 新特性

- **全屏 TUI 模式**——可在运行时切换常规和全屏模式，带有粘性编辑器和页脚，独立可滚动的转录区，以及可拖动的滚动条。详见 [UI & Display](docs/settings.md#ui-display)。
- **Mermaid 和 LaTeX 渲染**——可在交互式转录中渲染 Mermaid 图表和终端友好的 Unicode 数学公式。详见 [Markdown 设置](docs/settings.md#markdown) 和 [TUI Markdown](../tui/README.md#markdown)。
- **目录级上下文覆盖**——使用 `AGENTS.override.md` 替换特定目录的上下文文件。详见 [Context Files](docs/usage.md#context-files)。
- **高级自定义模型采样**——配置任意 OpenAI 兼容的 `samplingParams`，并可选启用 vLLM `thinking_token_budget` 参数。详见 [Sampling Parameters](docs/models.md#sampling-parameters)。
- **Baseten 提供商**——使用内置 Baseten 认证和模型支持。详见 [API Keys](docs/providers.md#api-keys)。

### 重大变更

- 将继承自 pi-ai 的 `ModelsStreamTransforms` 接口重命名为 `ModelsRequestTransforms`，因为其头部转换现在适用于所有已认证提供商的请求。
- 将 JSON 和 RPC `message_update` 事件改为仅发出 `assistantMessageEvent` 增量，移除了导致输出二次增长的累计 `message` 和 `assistantMessageEvent.partial` 字段。需要部分消息的客户端必须在 `message_start` 和 `message_end` 之间组装增量；后者仍具权威性（[#7290](https://github.com/earendil-works/pi/issues/7290)）。
- `ModelRegistry.getApiKeyAndHeaders()` 现在返回 `ProviderHeaders`，使用 `string | null` 的值，并保留 `null` 头部删除标记。处理返回头部的扩展必须处理 `null`；将它们转发到 pi-ai 流的扩展应保持它们不变。这可以防止占位符 OpenAI 凭证通过 Cloudflare AI Gateway 发送 ([#7030](https://github.com/earendil-works/pi/issues/7030))。

- 将 `ModelRegistry.refresh()` 修改为接受 `ModelsRefreshOptions`，并返回 `ModelsRefreshResult`，而不是丢弃取消和提供方错误。

- 将 `ModelRuntime.setRuntimeApiKey()` 修改为接受身份验证取消选项，而不是目录刷新选项。当需要远程新鲜度时，单独调用 `refresh({ providers: [providerId], signal })`。

- 要求 config-form 扩展 OAuth `refreshToken(credentials, signal)` 回调必须接受并尊重具体的中止信号。

- 用只读 `context.stored` 快照和生成检查 `context.publish()` 事务替换了动态提供方刷新上下文存储访问。

  **使用 `createProvider({ fetchModels })` 构建的提供方：** 不需要目录发布迁移。前后，返回获取的模型并注册结果提供方；`createProvider()` 负责恢复、持久化和内存发布。

  ```ts
  // Before
  const beforeProvider = createProvider({
    // ...
    fetchModels: async ({ signal }) => {
      const response = await fetch(catalogUrl, { signal });
      return parseModels(await response.json());
    },
  });
  pi.registerProvider(beforeProvider);

  // After: unchanged
  const afterProvider = createProvider({
    // ...
    fetchModels: async ({ signal }) => {
      const response = await fetch(catalogUrl, { signal });
      return parseModels(await response.json());
    },
  });
  pi.registerProvider(afterProvider);
  ```

  **手写原生 `Provider.refreshModels()`：** 用生成保护的发布替换直接存储访问和预发布突变。

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

  对于 config-form `pi.registerProvider(name, { refreshModels })`，仅返回模型的回调保持不变；pi 会发布返回的列表。如果此类回调之前使用 `context.store` 进行自定义持久化，请读取 `context.stored` 并调用 `context.publish({ persist: entry })`。在 `publish()` 中，省略 `persist` 以保持存储不变，传递 `ModelsStoreEntry` 以写入它，或传递 `persist: null` 以删除它。

- 用继承自 pi-agent-core 框架的会话模型替换了 `Session`、`SessionStorage` 和 `SessionRepo` 的 v4 轨道基础 API，包括持久操作记录、全局事实、共享序列号和轨道范围视图。
- 将pi-agent-core继承的v2会话和`AgentHarness` API从实验性入口提升为默认导出，并移除了实验性子路径。
- 移除了pi-agent-core继承的旧版JSONL和内存仓库API。建议使用pi-agent-core的v4 `JsonlSessionRepo`或`InMemorySessionRepo`，两者均实现了新的`SessionRepo`契约。
- 增加了pi-agent-core继承的必需操作`FileSystem.renameFile()`，用于原子JSONL发布；自定义挂载文件系统实现必须提供相同的文件系统替换语义（[#7707](https://github.com/earendil-works/pi/pull/7707)，由[@davidbrai](https://github.com/davidbrai)提交）。
- 用持久化的`SessionMetadata`替换了实验性的远程会话列表摘要；`RemoteSession.sessions`不再暴露运行时阶段、模型、思考、附件或锁定状态，这些状态仍可通过已获取的`SessionSnapshot`值获得（[#7708](https://github.com/earendil-works/pi/pull/7708)）。

### 增加了

- 内置了Baseten提供程序支持，使用`BASETEN_API_KEY`进行身份验证，并将`zai-org/GLM-5.2`设为默认模型。
- 增加了实验性的远程会话客户端API：传输中立的`PiClient`、CBOR协议、Unix套接字传输，以及`@earendil-works/pi-coding-agent/client`和`RemoteSession`控制器与转录缩减器。详见[Pi客户端](../client/README.md)和[远程协议](../protocol/README.md)（[#7344](https://github.com/earendil-works/pi/pull/7344)，[#7348](https://github.com/earendil-works/pi/pull/7348)，[#7371](https://github.com/earendil-works/pi/pull/7371)，[#7409](https://github.com/earendil-works/pi/pull/7409)）。
- 增加了`CredentialSynchronizationError`，用于处理成功提交但未能同步本地模型状态的凭证变更。
- 增加了链式`pi.registerMarkdownTransformer()`钩子，用于仅显示转换用户和助手的Markdown。详见[`pi.registerMarkdownTransformer()`](docs/extensions.md#piregistermarkdowntransformertransformer)（[#7231](https://github.com/earendil-works/pi/pull/7231)，由[@xl0](https://github.com/xl0)提交）。
- 增加了一个实验性的全屏TUI模式，可通过`--tui-mode fullscreen`或`/settings`选择（[#7304](https://github.com/earendil-works/pi/issues/7304)）。
- 增加了通过`/settings`在运行时切换常规与全屏TUI模式的功能。
- 在全屏模式下增加了粘性编辑器、状态、小部件和页脚停靠区，同时保持转录内容独立可滚动。
- 增加了一个可拖动的全屏模式转录条，支持通过`/settings`配置`auto`、`always`和`hidden`模式；`always`保留最右侧的列。
- 为全屏模式增加了页面滚动和标记消息导航快捷键。
- 为全屏滚动条拇指添加了一个可选的`scrollbarThumb`主题颜色，退回到`selectedBg`。
- 为支持的Mermaid图表增加了可配置的主题Unicode渲染，适用于交互式消息，包括流式处理时的可选渲染。详见[Markdown设置](docs/settings.md#markdown) ([#7624](https://github.com/earendil-works/pi/pull/7624) by [@xl0](https://github.com/xl0))。
- 增加了可选的`Ctrl+P`/`Ctrl+N`提示历史导航，当编辑器聚焦时，显式的历史快捷键优先于应用快捷键。
- 增加了每个目录的`AGENTS.override.md`上下文文件，替换掉同一目录下的`AGENTS.md`或`CLAUDE.md`，同时保留其他目录的上下文。详见[上下文文件](docs/usage.md#context-files) ([#7681](https://github.com/earendil-works/pi/pull/7681) by [@Marvae](https://github.com/Marvae))。
- 在CLI和RPC子进程环境中增加了`AI_AGENT=pi`，用于通用代理归属。详见[环境变量](README.md#environment-variables) ([#7493](https://github.com/earendil-works/pi/pull/7493) by [@renaudhartert-db](https://github.com/renaudhartert-db))。
- 为Markdown中的LaTeX表达式增加了继承式的终端友好Unicode渲染。详见[TUI Markdown](../tui/README.md#markdown)。
- 在全屏模式下增加了堆叠的瞬态通知。
- 通过`samplingParams`在`models.json`、模型覆盖、扩展提供程序和流选项中增加了任意的OpenAI兼容模型采样参数。详见[采样参数](docs/models.md#sampling-parameters) ([#7568](https://github.com/earendil-works/pi/pull/7568) by [@mrexodia](https://github.com/mrexodia))。
- 增加了对OpenAI兼容模型的继承式可选vLLM `thinking_token_budget`支持，为最终答案预留输出令牌 ([#7638](https://github.com/earendil-works/pi/pull/7638) by [@bnsd55](https://github.com/bnsd55))。
- 增加了对OpenAI兼容流的支持，该流省略了`finish_reason`，并使用`compat.supportsFinishReason`推断正常和工具使用停止点（当流结束时）。请参阅[OpenAI 兼容性](docs/models.md#openai-compatibility)。
- 增加了对延迟提供程序请求契约、持久化响应句柄、身份验证的获取/取消分发以及对挂起、准备就绪、失败和取消响应的伪提供程序支持（[#7339](https://github.com/earendil-works/pi/pull/7339) 由 [@davidbrai](https://github.com/davidbrai) 提交）。
- 增加了对供应商中立遥测契约、代理拥有的类型化AI请求和框架模式、组合跨度启动器和回调助手的支持。请参阅[代理遥测模式参考](../agent/docs/telemetry-schema.md)。
- 增加了对结构化Amazon Bedrock故障诊断的支持，包括HTTP状态、模型错误代码和可用的AWS请求ID（[#7286](https://github.com/earendil-works/pi/pull/7286) 由 [@brianstanley](https://github.com/brianstanley) 提交）。
- 增加了`AgentOptions.shouldStopAfterTurn`，以便在完成一轮对话后优雅停止，然后再处理排队的消息或另一个模型调用。请参阅[代理选项](../agent/README.md#agent-options)（[#7367](https://github.com/earendil-works/pi/pull/7367) 由 [@acmerfight](https://github.com/acmerfight) 提交）。
- 增加了对v4 `JsonlSessionRepo`的附加工具（append-only JSONL）框架会话的支持（[#7611](https://github.com/earendil-works/pi/pull/7611) 由 [@davidbrai](https://github.com/davidbrai) 提交）。
- 增加了对v4会话API的分支入口限制和索引开放操作恢复查询的支持（[#7448](https://github.com/earendil-works/pi/pull/7448)，[#7646](https://github.com/earendil-works/pi/pull/7646)）。
- 增加了编译完成的`AgentHarness` v2脚手架；未完成的操作路径在持久化执行实现之前将返回`HarnessNotImplemented`。

### 更改

- 增加了对pi-ai `ModelsStore`读取、写入和删除的可选取消支持；目录编排将这些等待与提供程序刷新信号绑定。
- 将继承的默认全屏鼠标滚轮步长从三行减少到一行，以实现更精细的滚动。

### 修复

- 修复了在没有已知订阅的情况下显示`(sub)`的页脚，适用于通用OAuth/OpenID登录；扩展OAuth提供程序可以通过`isSubscription`选择参与。
- 修复了继承的OAuth令牌刷新，使停滞的请求在请求凭证存储锁定时释放（[#7508](https://github.com/earendil-works/pi/issues/7508)）。
- 修复了工具参数验证，以保留那些已经与`anyOf`/`oneOf`联合臂匹配的值，避免可空联合将`null`转换为另一个原始值（[#7328](https://github.com/earendil-works/pi/issues/7328)）。
- 修复了Fireworks GLM 5.2请求在启用长缓存保留时发送不受支持的`prompt_cache_retention`字段，并启用了会话亲和力以自动缓存提示（[#7676](https://github.com/earendil-works/pi/issues/7676)）。
- 修复了`JsonlSessionRepo`强制在所有工作目录中全局使用会话ID；现在每个工作目录内的ID是唯一的。
- 修复了JSONL会话分叉和撕裂尾部修复，使其原子发布，避免在中断写入后出现部分写入或损坏的会话（[#7707](https://github.com/earendil-works/pi/pull/7707) 由 [@davidbrai](https://github.com/davidbrai) 提交）。
- 修复了Windows上路径包含的`find`通配符返回空结果（[#6817](https://github.com/earendil-works/pi/issues/6817)）。
- 修复了在压缩完成之前，手动`/compact`排队的消息不会被发送。
- 修复了Git Bash、MSYS、Cygwin和WSL驱动路径传递给内置文件工具时，解析为当前Windows驱动而不是其本机驱动（[#7064](https://github.com/earendil-works/pi/issues/7064)，[#7547](https://github.com/earendil-works/pi/issues/7547)）。
- 修复了项目级嵌套提供程序重试设置覆盖未修改的全局提供程序重试设置（[#7572](https://github.com/earendil-works/pi/issues/7572)）。
- 修复了GitHub Copilot Grok 4.5请求以使用支持的响应API（[#7560](https://github.com/earendil-works/pi/issues/7560)）。
- 修复了全屏关闭时终端能力查询回复泄露到父shell提示中。
- 修复了多个提供程序共享的精确`--model` ID，选择第一个目录条目而不是唯一已认证的提供程序或明确的歧义错误（[#7327](https://github.com/earendil-works/pi/issues/7327)）。
-  修复了需要 Haswell 时代 AVX2/BMI2 指令的独立 x64 二进制文件，通过针对 Bun 基础运行时编译发布版本可执行文件来解决（[#7390](https://github.com/earendil-works/pi/pull/7390) 由 [@davidbrai](https://github.com/davidbrai) 提交）。
-  修复了 `Ctrl+X` 复制确认在全屏模式下显示转录状态行，而不是显示临时 `Copied!` 标记。
-  修复了 Kitty 图像预览在全屏模式下滚动时与粘性编辑器和页脚停靠区重叠的问题。
-  修复了图像密集型全屏会话在布局更改时重新传输可见的 Kitty 图像负载并每帧渲染两次转录的问题。
-  修复了 `/settings` 搜索中包含空格时，输入多词查询（如 **TUI mode** 或 **Quiet startup**）时高亮设置切换的问题。
-  修复了自定义编辑器未继承默认编辑器的自动补全下拉项限制（[#7333](https://github.com/earendil-works/pi/issues/7333)）。
-  修复了包清单中资源数组格式错误导致会话启动崩溃（[#7187](https://github.com/earendil-works/pi/issues/7187)）。
-  修复了 DOOM 覆盖示例从已失效的 URL 下载其共享软件 WAD 的问题。
-  修复了 `setToolsExpanded(false)` 在工具输出已折叠时为无操作，避免扩展重复发送 `Tool output: collapsed` 启动通知（[#7292](https://github.com/earendil-works/pi/issues/7292)）。
-  修复了自定义压缩、交接和问答示例中由扩展驱动的模型调用，通过编码代理模型运行时分发，以保持自定义提供程序和已解析的认证选项（[#7325](https://github.com/earendil-works/pi/pull/7325)）。
-  修复了长时间运行的会话在另一个进程更新 `auth.json` 后使用过期凭证，且未对并发凭证读取进行序列化和延迟启动的问题（[#7319](https://github.com/earendil-works/pi/issues/7319)）。
-  修复了并发 `models-store.json` 读取形成文件锁车队并延迟启动的问题。
-  将打包的 `brace-expansion` 依赖项更新到 5.0.8，以解决 GHSA-mh99-v99m-4gvg（[#7316](https://github.com/earendil-works/pi/issues/7316)）。
-  修复了强制模型可用性刷新被先前停滞的刷新阻塞的问题（[#7301](https://github.com/earendil-works/pi/issues/7301), [#7421](https://github.com/earendil-works/pi/pull/7421) 由 [@a-yeyang](https://github.com/a-yeyang) 提交）。
-  修复了 `/model` 目录刷新失败，未能识别所有失败的目录。
-  修复了保存凭证后，当模型目录刷新停滞时，提供商登录卡住的问题，通过分离本地凭证一致性与受限制的后台新鲜度（[#7027](https://github.com/earendil-works/pi/issues/7027), [#7113](https://github.com/earendil-works/pi/issues/7113), [#7418](https://github.com/earendil-works/pi/issues/7418)）。
-  修复了 `/scoped-models` 在渲染前等待远程目录刷新，而不是显示缓存模型，并在关闭时取消刷新（[#7153](https://github.com/earendil-works/pi/issues/7153)）。
-  修复了 `/model <name>` 在渲染前等待目录刷新以检查缓存模型匹配项（[#7443](https://github.com/earendil-works/pi/issues/7443)）。
-  修复了过期可用性快照和错误发布后，更新的可用性传递后的问题。
-  修复了过期 pi.dev、Radius、llama.cpp 和扩展目录刷新后，更新的提供商刷新发布的问题。
-  修复了等待文件背书凭证或模型目录锁时取消操作，防止取消的变更运行或提交。
-  修复了并发内存凭证变更丢失无关提供商更新的问题，通过序列化其读取-修改-写入部分。
-  将 `undici` 更新到 8.9.0，并将打包的 `brace-expansion` 更新到 5.0.9，以解决 GHSA-8xcm-r25x-g524, GHSA-4cwx-7wf7-3272, GHSA-m8rv-5g2x-5cg5, GHSA-jr45-8vmc-qm54, GHSA-v3r7-h72x-cjcm, 和 GHSA-rgw5-rvv9-x895。
-  修复了 GitHub Copilot 压缩和分支摘要使用个人端点，而不是凭据解析的企业或企业端点（[#6768](https://github.com/earendil-works/pi/issues/6768)）。
-  修复了扩展模型调用在转发请求认证时丢失凭据解析端点，包括使用 GitHub Copilot 企业账户的自定义压缩（[#7579](https://github.com/earendil-works/pi/issues/7579)）。
-  修复了全屏转录导航后，没有可编辑访问的 `Home`、`End`、`PageUp` 或 `PageDown` 变体，通过添加 Ctrl 修改的编辑器绑定（[#7574](https://github.com/earendil-works/pi/issues/7574)）。
- 修复扩展事件总线监听器在会话重新加载和释放时仍能存活 [#7656](https://github.com/earendil-works/pi/pull/7656) 由 [@tudoroancea](https://github.com/tudoroancea) 提交
- 修复`/copy`在Wayland环境下无法读取剪贴板文本，且无X11剪贴板可用时 [#7387](https://github.com/earendil-works/pi/pull/7387)
- 修复初始连接尝试时慢连接失败，通过增加连接超时时间解决 [#7435](https://github.com/earendil-works/pi/pull/7435) 由 [@muyiyr](https://github.com/muyiyr) 提交
- 修复扩展和内置工具返回的超大图片绕过自动图片缩放功能。详见[图片设置](docs/settings.md#terminal--images) [#7330](https://github.com/earendil-works/pi/pull/7330) 由 [@tizmagik](https://github.com/tizmagik) 提交
- 修复会话发现功能未能识别通过符号链接目录存储的会话 [#7552](https://github.com/earendil-works/pi/pull/7552) 由 [@muyiyr](https://github.com/muyiyr) 提交
- 修复手动压缩与阈值自动压缩并发时发生冲突 [#7370](https://github.com/earendil-works/pi/pull/7370) 由 [@davidbrai](https://github.com/davidbrai) 提交
- 修复响应内容被截断，低于预期输出限制导致运行结束而非自动压缩重试 [#7540](https://github.com/earendil-works/pi/pull/7540) 由 [@davidbrai](https://github.com/davidbrai) 提交
- 修复Git包更新后依赖项缺失，当`git clean`无法删除被忽略的依赖目录时 [#7570](https://github.com/earendil-works/pi/pull/7570) 由 [@mrexodia](https://github.com/mrexodia) 提交
- 修复`find`在POSIX和Windows文件系统根目录下结果丢失首个路径段或产生多余尾部分隔符 [#7569](https://github.com/earendil-works/pi/pull/7569) 由 [@petrroll](https://github.com/petrroll) 提交
- 修复短暂版本检查、目录、管理工具和包管理HTTP失败未被重试 [#7632](https://github.com/earendil-works/pi/pull/7632) 由 [@petrroll](https://github.com/petrroll) 提交
- 修复交互式错误忽略已配置的输出填充
- 修复继承的OpenCode Go提供程序显示名称
- 修复继承的提供程序错误规范化将数组和类实例误作为结构化响应体，而非保留原始错误 [#7205](https://github.com/earendil-works/pi/pull/7205) 由 [@erikogenvik](https://github.com/erikogenvik) 提交
- 修复继承的Anthropic流在初始内容块事件中丢失文本或包含的思考内容 [#7358](https://github.com/earendil-works/pi/pull/7358) 由 [@davidbrai](https://github.com/davidbrai) 提交
- 修复继承的Google历史转换丢失已签名空文本和思考块，导致无法回放 [#7362](https://github.com/earendil-works/pi/pull/7362) 由 [@jingtao-wisdomgraph](https://github.com/jingtao-wisdomgraph) 提交
- 修复继承的OpenAI Codex缓存WebSocket会话跨不同账户凭证共享 [#7364](https://github.com/earendil-works/pi/pull/7364)
- 修复继承的短暂Google生成式AI和Vertex AI提供程序错误绕过自动重试功能 [#7471](https://github.com/earendil-works/pi/pull/7471) 由 [@vish-pr](https://github.com/vish-pr) 提交
- 修复继承的Gemini 3工具调用ID在历史转换中被丢弃，导致多轮已签名回放中断 [#7494](https://github.com/earendil-works/pi/pull/7494) 由 [@muyiyr](https://github.com/muyiyr) 提交
- 恢复继承的GitHub Copilot模型通过账户特定策略响应返回 [#7672](https://github.com/earendil-works/pi/pull/7672) 由 [@muyiyr](https://github.com/muyiyr) 提交
- 替换继承的已退役Qwen Token Plan `qwen3.8-max-preview`模型为`qwen3.8-max` [#7670](https://github.com/earendil-works/pi/pull/7670) 由 [@QuintinShaw](https://github.com/QuintinShaw) 提交
- 修复继承的终端宽度计算未考虑印度连字符连缀图形集群 [#6987](https://github.com/earendil-works/pi/pull/6987) 由 [@petrroll](https://github.com/petrroll) 提交
- 修复继承的嵌套全屏堆栈布局忽略子组件最小尺寸
- 修复继承的批量终端颜色方案报告被解析为一个格式错误的响应 [#7550](https://github.com/earendil-works/pi/pull/7550)
- 修复继承的终端进度清除功能，确保完整输出OSC 9;4序列 [#7581](https://github.com/earendil-works/pi/pull/7581)
- 修复继承的iTerm2图片负载遗漏xterm.js图片插件所需的尺寸元数据 [#7612](https://github.com/earendil-works/pi/pull/7612)
- 修复继承的宽度截断导致OSC 8超链接未终止 [#7657](https://github.com/earendil-works/pi/pull/7657) 由 [@xXJSONDeruloXx](https://github.com/xXJSONDeruloXx) 提交
- 更新继承的GPT-5.6 Terra和Luna在OpenAI及直通模型目录中的定价
- 修复了继承自 Fireworks Kimi K3 的模型，使其能够使用与原生推理努力水平兼容的 OpenAI 兼容 API，并支持延迟工具功能（[#7199](https://github.com/earendil-works/pi/issues/7199)，[#7230](https://github.com/earendil-works/pi/pull/7230) 由 [@XBeg9](https://github.com/XBeg9) 提交）。

- 更新了继承自 Groq Qwen 的推理覆盖功能，以适配替换后的 `qwen/qwen3.6-27b` 模型。

- 修复了继承自 Windows 的 Shift+Enter 检测功能，通过读取原生 Win32 辅助程序的状态实现。

- 修复了继承自 pi-tui npm 包，在重建 Windows 和 Darwin 原生插件时遗漏了源码和构建脚本的问题。

- 修复了继承自 Windows 的控制台真彩色检测功能，当 Windows Terminal 未提供 `WT_SESSION` 传递给子 shell 时。

- 修复了继承自 phantom 的全屏文本选择功能，当切换终端面板焦点时，未匹配的鼠标事件会导致异常。

- 修复了继承自 Windows 的键盘输入渲染延迟问题，允许输入操作优先于节流渲染计时器。

- 修复了继承自 agent harness 的路径处理问题，涉及 Windows 下的文件名、递归技能加载和提示模板名称。

## [0.83.0] - 2026-07-29

### 新增功能

- **对外客户端凭证导出** — `pi auth print-api-key` 和 `pi auth print-bearer-token` 可导出已配置的凭证，支持自动 OAuth 刷新和最小有效期强制执行。

- **无头 OpenRouter 登录** — 可通过 SSH 完成 `/login`，当回环回调不可用时，可通过粘贴重定向 URL 或授权码实现。详见 [OpenRouter](docs/providers.md#openrouter)。

- **GitHub Copilot 上的 Claude Opus 5** — 可通过 GitHub Copilot 使用 Claude Opus 5，支持自适应思考和 1M 上下文窗口。详见 [GitHub Copilot](docs/providers.md#github-copilot)。

### 重大变更

- 升级了内置的 TypeBox 别名到 1.3.7 版本，移除了包括 `Type.Base`、`Type.Awaited`、`Type.Promise`、`Type.AsyncIterator`、`Type.Iterator`、`Type.Options` 和 `Value.Mutate` 在内的废弃 API，同时修复了对可空数组工具参数的编译验证。使用已移除 API 的扩展必须迁移到支持的 TypeBox API。详见 [Package Dependencies](docs/packages.md#dependencies)（[#7243](https://github.com/earendil-works/pi/pull/7243) 由 [@petrroll](https://github.com/petrroll) 提交）。

### 新增

- 新增 `pi auth print-api-key` 和 `pi auth print-bearer-token` 命令，用于导出已配置的凭证至外部客户端，支持自动 OAuth 刷新和可配置的最小令牌有效期（[#7168](https://github.com/earendil-works/pi/pull/7168)）。

- 将会话解析的模型作用域以 `ctx.scopedModels` 形式暴露给扩展。详见 [Extension Context](docs/extensions.md#ctxmodelregistry--ctxmodel--ctxthinkinglevel--ctxscopedmodels)（[#7191](https://github.com/earendil-works/pi/pull/7191) 由 [@pungggi](https://github.com/pungggi)、[#7215](https://github.com/earendil-works/pi/pull/7215) 提交）。

- 新增继承自请求的 `fetch` 注入功能，支持文本和图像提供商的传输。

- 新增继承自 `"pending"` 的停止原因，用于部分流式消息。详见 [Custom Provider Stream Pattern](docs/custom-provider.md#stream-pattern)（[#7151](https://github.com/earendil-works/pi/pull/7151) 由 [@lucasmeijer](https://github.com/lucasmeijer) 提交）。

- 新增继承自 Google、Anthropic、Amazon Bedrock、Mistral 和 OpenAI 流的原始提供商停止原因；终端未映射的停止原因现在作为提供商错误显示，而非成功的停止（[#7272](https://github.com/earendil-works/pi/pull/7272)）。

- 新增手动重定向 URL 和授权码输入，用于 OpenRouter 登录的远程和无头环境。详见 [OpenRouter](docs/providers.md#openrouter)（[#7114](https://github.com/earendil-works/pi/pull/7114) 由 [@rgarcia](https://github.com/rgarcia) 提交）。

- 新增继承自 Claude Opus 5 的 GitHub Copilot 支持，支持自适应思考和 1M 上下文窗口。详见 [GitHub Copilot](docs/providers.md#github-copilot)（[#7158](https://github.com/earendil-works/pi/pull/7158) 由 [@jay-aye-see-kay](https://github.com/jay-aye-see-kay) 提交）。

### 变更

- 将继承自 OAuth 的凭证解析逻辑修改为：当令牌有效期剩余不足五分钟时即刷新，而非等待过期（[#7168](https://github.com/earendil-works/pi/pull/7168)）。

### 修复

- 在工具输出扩展功能被切换时，新增状态行提示（[#7180](https://github.com/earendil-works/pi/issues/7180)）。

- 修复了基于文件的 `SYSTEM.md` 和 `APPEND_SYSTEM.md` 提示符在交互式启动上下文中被遗漏的问题。详见 [System Prompt Files](docs/usage.md#system-prompt-files)（[#7096](https://github.com/earendil-works/pi/issues/7096)）。
-  修复了当链接的 Git 工作树嵌套在其主仓库下时，上下文文件加载两次的问题。详见 [Context Files](docs/usage.md#context-files) ([#7221](https://github.com/earendil-works/pi/pull/7221) by [@arajkumar](https://github.com/arajkumar))。

-  修复了 llama.cpp 流式响应报告令牌使用量为零，并且会将会话上下文会计清空的问题。详见 [llama.cpp](docs/llama-cpp.md) ([#7258](https://github.com/earendil-works/pi/pull/7258) by [@SteveImmanuel](https://github.com/SteveImmanuel))。

-  修复了在活跃响应期间会话替换和提交树导航时，中止并持久化外出轮次，而不是留下悬空的工具调用。详见 [Sessions](docs/usage.md#sessions) ([#7022](https://github.com/earendil-works/pi/pull/7022) by [@tmustier](https://github.com/tmustier))。

-  修复了失败的 Git 包安装会留下部分目录，从而阻塞干净重试的问题。详见 [Install and Manage](docs/packages.md#install-and-manage) ([#7210](https://github.com/earendil-works/pi/pull/7210) by [@haoqixu](https://github.com/haoqixu))。

-  修复了 `/model` 选择器在过滤时保留过时选择，而不是高亮显示最佳匹配项的问题 ([#7211](https://github.com/earendil-works/pi/pull/7211) by [@christianbasch](https://github.com/christianbasch))。

-  修复了直接 RPC Bash 命令会绕过扩展 `user_bash` 处理器的问题。详见 [User Bash Events](docs/extensions.md#user-bash-events) ([#7214](https://github.com/earendil-works/pi/pull/7214))。

-  修复了技能、提示和主题在扩展重新加载资源后丢失包源元数据的问题。详见 [Resource Events](docs/extensions.md#resource-events) ([#6968](https://github.com/earendil-works/pi/issues/6968))。

-  修复了取消并发运行的用户 Bash 命令，确保每个活跃命令都被中止 ([#7103](https://github.com/earendil-works/pi/pull/7103) by [@yzhg1983](https://github.com/yzhg1983))。

-  修复了在交互式启动期间切换会话时重复消息出现的问题 ([#7110](https://github.com/earendil-works/pi/pull/7110) by [@yzhg1983](https://github.com/yzhg1983))。

-  修复了继承的 Qwen Token Plan 推理模型，使其能够发送其服务特定的思维控制和支持的推理努力级别 ([#6951](https://github.com/earendil-works/pi/issues/6951), [#6998](https://github.com/earendil-works/pi/issues/6998))。

-  修复了继承的 Z.AI 输出限制通过不支持的参数发送的问题。详见 [Providers](docs/providers.md) ([#7174](https://github.com/earendil-works/pi/pull/7174) by [@HyeokjaeLee](https://github.com/HyeokjaeLee))。

-  修复了显式配置的 Amazon Bedrock 配置文件被环境 AWS 访问密钥覆盖的问题。详见 [Amazon Bedrock](docs/providers.md#amazon-bedrock) ([#7176](https://github.com/earendil-works/pi/pull/7176) by [@christianbasch](https://github.com/christianbasch))。

-  修复了继承的图像回退路径在窄终端中溢出，缩短了主目录路径，并在终端超链接可用时使绝对路径可点击的问题 ([#7262](https://github.com/earendil-works/pi/pull/7262))。

-  修复了继承的 OpenAI 兼容工具调用在包含空 `custom` 对象的异常增量时丢失函数参数的问题 ([#7288](https://github.com/earendil-works/pi/pull/7288) by [@sunnyyoung](https://github.com/sunnyyoung))。

## [0.82.1] - 2026-07-25

###  新增功能

-  **Claude Opus 5** — 在 Anthropic 和 Amazon Bedrock 上可用，支持自适应思维（包括 `xhigh`）、推理配置文件和提示缓存。详见 [Providers](docs/providers.md#api-keys)。

-  **Anthropic gateway bearer auth** — `ANTHROPIC_AUTH_TOKEN` 用于验证需要 `Authorization: Bearer` 的 Anthropic 兼容网关，包括压缩和分支摘要。详见 [Environment Variables or Auth File](docs/providers.md#environment-variables-or-auth-file)。

-  **更快、更健壮的模型目录** — pi.dev 目录使用 `If-None-Match` 进行重新验证，未更改的提供者返回空 `304`，且 llama.cpp 模型会在重启后保持列表。详见 [llama.cpp](docs/llama-cpp.md)。

###  增加了

-  暴露了 `outputPad` 设置给自定义消息渲染器。详见 [Extensions](docs/extensions.md) ([#7045](https://github.com/earendil-works/pi/pull/7045) by [@xl0](https://github.com/xl0))。

-  增加了对 Anthropic 兼容网关的继承 `ANTHROPIC_AUTH_TOKEN` 托克授权。详见 [Providers](docs/providers.md#environment-variables-or-auth-file) ([#5871](https://github.com/earendil-works/pi/issues/5871))。

-  增加了对 Anthropic 和 Amazon Bedrock 的继承 Claude Opus 5 支持，支持自适应思维、推理配置文件、提示缓存和保留 AWS 验证消息 ([#7081](https://github.com/earendil-works/pi/pull/7081) by [@unexge](https://github.com/unexge), [#7083](https://github.com/earendil-works/pi/pull/7083) by [@davidbrai](https://github.com/davidbrai))。

###  修改了
- 将pi.dev模型目录刷新更改为与`If-None-Match`一起重新验证，因此未更改的提供程序目录会以空的`304`而不是完整下载进行响应。

- 将继承的Radius OAuth设备授权、令牌交换和刷新请求更改为直接使用配置的网关。

- 将继承的模型加载错误更改为追加底层原因，因此授权失败（如`OAuth refresh failed for openai-codex`）会报告提供程序响应，而不是仅返回一个空的包装消息。

### 修复了

- 修复了认证完全通过请求头进行解析的提供程序的压缩和分支摘要功能（[#5871](https://github.com/earendil-works/pi/issues/5871)）

- 修复了无法使用的限定范围模型被隐藏在`/models`中，允许它们在不手动编辑设置的情况下被移除（[#6949](https://github.com/earendil-works/pi/issues/6949)，[#7032](https://github.com/earendil-works/pi/pull/7032) 由[@christianklotz](https://github.com/christianklotz) 提交）。

- 修复了启动上下文文件发现功能，使其跳过与上下文文件名匹配的目录（如`AGENTS.md`），从而避免了`EISDIR`警告（[#7106](https://github.com/earendil-works/pi/pull/7106) 由[@mrexodia](https://github.com/mrexodia) 提交）。

- 修复了llama.cpp扩展，使其能够持久化模型目录，确保llama.cpp模型在首次成功刷新前仍会列出。有关[llama.cpp](docs/llama-cpp.md) ([#7072](https://github.com/earendil-works/pi/pull/7072) 由[@davidbrai](https://github.com/davidbrai) 提交)。

## [0.82.0] - 2026-07-24

### 新增功能

- **工具采样约束**——工具可以优先或强制使用严格的JSON Schema采样或OpenAI Lark/regex文法，模型能力元数据会阻止不支持的请求。详见[Constrained Sampling for Tools](../ai/README.md#constrained-sampling-for-tools)。

- **OpenRouter和Kimi Code登录**——使用`/login`即可授权OpenRouter或Kimi Code订阅，无需手动配置API密钥。详见[OpenRouter](docs/providers.md#openrouter)。

- **会话感知、流式bash集成**——bash工具会接收当前会话/模型元数据，而直接RPC bash命令会流式输出相关结果。详见[Bash Tool Session Environment](docs/environment-variables.md#bash-tool-session-environment) 和 [RPC bash events](docs/rpc.md#bash_execution_update)。

### 新增

- 新增继承的`Tool.constrainedSampling`，支持严格的JSON Schema（`prefer`/`require`）和OpenAI Lark/regex文法变体，覆盖OpenAI、Anthropic、Amazon Bedrock、Google Gemini和Mistral。详见[Constrained Sampling for Tools](../ai/README.md#constrained-sampling-for-tools)。

- 新增继承的`supportsGrammarTools`和`supportsStrictTools`兼容性标志，扩展了`supportsStrictMode`的覆盖范围，并生成模型能力元数据以控制约束采样。

- 新增继承的Kimi Code订阅OAuth登录，支持Kimi For Coding提供程序，包括设备授权和自动令牌刷新（[#6935](https://github.com/earendil-works/pi/pull/6935) 由[@zaycruz](https://github.com/zaycruz) 提交）。

- 新增继承的OpenRouter OAuth PKCE登录（`/login`），可生成用户控制的API密钥。详见[OpenRouter](docs/providers.md#openrouter) ([#6927](https://github.com/earendil-works/pi/pull/6927) 由[@rsaryev](https://github.com/rsaryev) 提交)。

- 将`PI_SESSION_ID`、`PI_SESSION_FILE`、`PI_PROVIDER`、`PI_MODEL`和`PI_REASONING_LEVEL`暴露给由内置和工厂创建的bash工具运行的命令。详见[Bash Tool Session Environment](docs/environment-variables.md#bash-tool-session-environment)。

- 新增流式`bash_execution_update`事件，用于直接RPC bash命令，与请求ID相关联。详见[RPC bash events](docs/rpc.md#bash_execution_update) ([#6971](https://github.com/earendil-works/pi/pull/6971) 由[@ananthakumaran](https://github.com/ananthakumaran) 提交)。

### 更改了

- 更改了继承的生成模型目录，仅暴露来自models.dev的提供程序验证的推理努力等级（[#6928](https://github.com/earendil-works/pi/pull/6928) 由[@davidbrai](https://github.com/davidbrai) 提交)。

### 修复了

- 修复了继承的DNS查找失败（如`getaddrinfo`、`ENOTFOUND`和`EAI_AGAIN`），触发自动助手重试（[#6946](https://github.com/earendil-works/pi/pull/6946) 由[@christianklotz](https://github.com/christianklotz) 提交)。

- 修复了继承的OpenRouter Anthropic缓存断点，使其能够通过工具结果前进，并为`~anthropic/*-latest`别名启用缓存控制（[#6941](https://github.com/earendil-works/pi/pull/6941) 由[@mteam88](https://github.com/mteam88) 提交)。

- 修复了继承的OpenAI Codex WebSocket会话，在`previous_response_not_found`错误后，若缺少之前的响应延续，会重试一次（[#6955](https://github.com/earendil-works/pi/pull/6955) 由[@davidbrai](https://github.com/davidbrai) 提交)。
- 修复了TUI调试和崩溃日志，使其尊重自定义代理目录，而不是总是写入`~/.pi/agent` ([#6958](https://github.com/earendil-works/pi/pull/6958) 由 [@davidbrai](https://github.com/davidbrai) 提交)。
- 修复了系统临时目录包含大量条目时，Ctrl+G外部编辑器启动缓慢的问题 ([#6903](https://github.com/earendil-works/pi/pull/6903) 由 [@christianklotz](https://github.com/christianklotz) 提交)。
- 修复了启动资源显示，使其在加载包的兄弟npm扩展时保留相对路径 ([#6964](https://github.com/earendil-works/pi/pull/6964) 由 [@davidbrai](https://github.com/davidbrai) 提交)。
- 修复了压缩和分支摘要请求，在不支持提示缓存时使用新鲜的路由会话ID ([#6618](https://github.com/earendil-works/pi/pull/6618) 由 [@tmustier](https://github.com/tmustier) 提交)。
- 修复了显式自更新功能，当`PI_SKIP_VERSION_CHECK`被设置时 ([#6977](https://github.com/earendil-works/pi/issues/6977))。
- 修复了作用域模型ID包含括号的情况，使其在进行字面精确匹配后再进行通配符匹配 ([#6210](https://github.com/earendil-works/pi/issues/6210))。
- 修复了继承自OpenAI和Anthropic提供商的重试等待时间，使其尊重中止信号和配置的延迟限制 ([#6980](https://github.com/earendil-works/pi/pull/6980) 由 [@petrroll](https://github.com/petrroll) 提交)。
- 修复了新安装时优先使用捆绑模型目录而非更新的远程目录，因为包文件的mtime较新 ([#7016](https://github.com/earendil-works/pi/pull/7016) 由 [@davidbrai](https://github.com/davidbrai) 提交)。
- 修复了继承编辑器滚动指示符在窄终端中溢出的问题 ([#7015](https://github.com/earendil-works/pi/pull/7015) 由 [@christianklotz](https://github.com/christianklotz) 提交)。
- 修复了llama.cpp模型，使其使用加载的上下文窗口作为输出令牌限制，而不是将其限制在16K ([#7034](https://github.com/earendil-works/pi/pull/7034) 由 [@christianklotz](https://github.com/christianklotz) 提交)。
- 修复了发布源归档，使其包含用于构建独立二进制文件的生成式提供商模型数据。
- 更新了打包的`protobufjs`依赖项到7.6.5版本，以解决GHSA-j3f2-48v5-ccww问题 ([#7005](https://github.com/earendil-works/pi/issues/7005))。
- 修复了`/copy`在Wayland上的问题，当`wl-copy`失败时，会回退到X11或OSC 52 ([#7009](https://github.com/earendil-works/pi/pull/7009) 由 [@rkfshakti](https://github.com/rkfshakti) 提交)。
- 修复了`/model`在打开模型选择器时重新加载更新的`models.json`配置 ([#6999](https://github.com/earendil-works/pi/issues/6999))。
## [0.81.1] - 2026-07-21

### 新功能

- **可验证的发布源归档**——GitHub 发布现在包含确定性、带校验和的源归档，并附有重建独立二进制文件的说明。详见 [从发布源构建独立二进制文件](../../README.md#building-standalone-binaries-from-release-source)。
- **健壮的压缩和分支摘要**——临时提供程序故障现在会遵循配置的重试策略，并向交互式、JSON、RPC 和 SDK 消费者提供重试生命周期事件。详见 [压缩与分支摘要](docs/compaction.md) 和 [RPC 重试事件](docs/rpc.md#summarization_retry_scheduled--summarization_retry_attempt_start--summarization_retry_finished)。

### 新增

- 新增确定性、带校验和的源归档到 GitHub 发布，并附有独立二进制文件重建说明（[#6913](https://github.com/earendil-works/pi/pull/6913) by [@christianklotz](https://github.com/christianklotz)）。

### 修复

- 修复压缩和分支摘要，使其在发生临时提供程序故障时能够使用配置的重试策略重试，并向交互式、JSON、RPC 和 SDK 消费者暴露重试生命周期事件（[#6901](https://github.com/earendil-works/pi/pull/6901) by [@davidbrai](https://github.com/davidbrai)）。
- 修复交互式启动时等待背景模型目录刷新以计算脚注提供程序计数的问题。
- 恢复使用预 0.81 版本 agent-core API 的扩展的默认流回退（[#6915](https://github.com/earendil-works/pi/issues/6915)）。
- 修复 Moonshot AI 和 Moonshot AI China 继承的 Kimi K3 模型，使其使用 OpenAI 思考格式并暴露推理努力支持。

## [0.81.0] - 2026-07-21

### 新功能

- **本地 llama.cpp 模型管理**——连接到 llama.cpp 路由器，搜索和下载 Hugging Face 模型，并可显式加载或卸载模型，同时支持实时进度。详见 [llama.cpp](docs/llama-cpp.md)。
- **完整的提供程序扩展**——扩展程序可以注册完整的 pi-ai 提供程序，支持身份验证、模型刷新、过滤和自定义流式处理。详见 [注册新提供程序](docs/custom-provider.md#register-new-provider)。
- **Qwen Token Plan 提供者** — 使用内置的国际和中国订阅提供者，支持区域端点和API密钥认证。详见 [API密钥](docs/providers.md#api-keys)。
- **扩展的用量统计** — 工具、压缩和分支摘要的用量会持久化并计入会话总计。详见 [压缩与分支摘要](docs/compaction.md)。

### 新增

- 新增Qwen Token Plan和Qwen Token Plan China至内置提供者设置、默认模型解析及提供者文档（[#6858](https://github.com/earendil-works/pi/pull/6858) by [@QuintinShaw](https://github.com/QuintinShaw)）。
- 新增`get_available_thinking_levels` RPC命令和`RpcClient.getAvailableThinkingLevels()`方法（[#6865](https://github.com/earendil-works/pi/pull/6865) by [@cristinaponcela](https://github.com/cristinaponcela)）。
- 导出消息和工具执行生命周期事件类型至包根目录（[#6772](https://github.com/earendil-works/pi/pull/6772) by [@davidbrai](https://github.com/davidbrai)）。
- 新增内置llama.cpp路由器支持，包含`/login`连接设置、`/llama` Hugging Face模型搜索与下载、显式加载与卸载及实时进度。详见 [llama.cpp](docs/llama-cpp.md)。
- 新增扩展注册，支持完整的pi-ai提供者，包括本地认证、模型刷新、过滤及流式行为。
- 新增工具、压缩及分支摘要的用量统计，持久化会话中包含底部总计和会话统计（[#6671](https://github.com/earendil-works/pi/pull/6671) by [@davidbrai](https://github.com/davidbrai)）。

### 修复

- 更新打包的`brace-expansion`依赖至5.0.7（[#6896](https://github.com/earendil-works/pi/pull/6896) by [@davidbrai](https://github.com/davidbrai)）。
- 修复升级后远程模型目录覆盖新捆绑目录的问题。
- 修复继承的API密钥凭证应用提供者范围的`env`值，包括Amazon Bedrock配置（[#6864](https://github.com/earendil-works/pi/pull/6864) by [@cristinaponcela](https://github.com/cristinaponcela)）。
- 修复跨提供者重放时多个调用共享提供者调用ID导致工具调用ID重复的问题（[#6854](https://github.com/earendil-works/pi/pull/6854) by [@cristinaponcela](https://github.com/cristinaponcela)）。
- 修复Kimi K3思考层级，暴露低、高和最大级别，并规范化`k2p7`别名为`kimi-for-coding`。
- 修复通过OpenAI响应API路由的OpenCode Go模型。
- 修复`pi-ai`包元数据，避免重复消费者锁文件变更（[#6812](https://github.com/earendil-works/pi/pull/6812) by [@jmfederico](https://github.com/jmfederico)）。
- 修复终端关闭时清除编辑器反转软件光标，再恢复硬件光标（[#6790](https://github.com/earendil-works/pi/pull/6790) by [@dam9000](https://github.com/dam9000)）。
- 修复ANSI感知文本换行，识别CRLF和CR换行符同时保留样式（[#6764](https://github.com/earendil-works/pi/pull/6764) by [@xz-dev](https://github.com/xz-dev)）。
- 修复编辑器粘贴注册表损坏，防止删除和撤销粘贴标记后出现字面或不匹配的粘贴标记（[#6844](https://github.com/earendil-works/pi/issues/6844)）。
- 修复无状态OpenAI Codex WebSocket请求使用UUIDv7请求ID（[#6834](https://github.com/earendil-works/pi/pull/6834) by [@xl0](https://github.com/xl0)）。
- 修复GPT-5.6 Codex模型默认上下文窗口为272K，避免自动长上下文计费（[#6853](https://github.com/earendil-works/pi/pull/6853) by [@aadishv](https://github.com/aadishv)）。
- 修复压缩期间排队的消息，保持引导和后续交付行为（[#6730](https://github.com/earendil-works/pi/pull/6730) by [@dannote](https://github.com/dannote)）。
- 修复读取工具错误被语法高亮显示为文件内容（[#6731](https://github.com/earendil-works/pi/pull/6731) by [@dannote](https://github.com/dannote)）。
- 修复llama.cpp路由器下载进度更新，移除模型操作确认中的冗余用词。
- 将自动模型目录网络刷新移出启动初始化，进入运行时交互和RPC模式。
- 修复打开会话时两次读取解析，降低大会话启动延迟（[#6793](https://github.com/earendil-works/pi/issues/6793)）。
- 修复所有参数（`${@:-default}`和`${ARGUMENTS:-default}`）的提示模板默认值（[#6695](https://github.com/earendil-works/pi/issues/6695)）。
- 修复扩展文档中过时的自定义UI、自定义工具和自定义编辑器示例（[#6735](https://github.com/earendil-works/pi/issues/6735)）。
- 修复Kimi Coding会话，使其显示订阅指示器中API等效的隐式成本。
- 修复OpenAI响应的早期流式处理结束，改为自动重试而非终止智能体运行（[#6727](https://github.com/earendil-works/pi/issues/6727)）。

## [0.80.10] - 2026-07-16

### 新功能

- **Kimi Coding思维兼容性** — Kimi Coding模型现在正确使用自适应思维；K3暴露其支持的`max`级别，并支持回放空签名思维块。详见[Kimi For Coding设置](docs/providers.md#api-keys)和[模型选项](docs/usage.md#model-options)。

### 修复

- 修复继承的Kimi Coding请求，使其使用Anthropic自适应思维而不使用令牌预算，并为K3和`kimi-for-coding`启用空思维签名。
- 修复继承的Kimi Coding K3定价元数据，使其适用于Moonshot AI和Moonshot AI China。
- 修复继承的Kimi Coding K3思维级别元数据，仅暴露支持的`max`级别（[#6737](https://github.com/earendil-works/pi/issues/6737)）。
- 修复继承的目录生成，恢复0.80.9版本中移除的xAI模型（[#6736](https://github.com/earendil-works/pi/issues/6736)）。

## [0.80.9] - 2026-07-16

### 新功能

- **Kimi K3和延迟工具加载** — 可在内置提供商中使用Kimi K3，包括通过Kimi原生协议进行渐进式扩展工具激活。详见[动态工具加载](docs/extensions.md#dynamic-tool-loading)、[OpenAI兼容性](docs/models.md#openai-compatibility)和[`kimi-deferred-tools.ts`](examples/extensions/kimi-deferred-tools.ts)示例。

### 添加

- 为Kimi Coding、Moonshot AI、Moonshot AI China、OpenRouter和Vercel AI Gateway添加继承的Kimi K3支持。
- 为扩展驱动工具激活添加Kimi延迟工具加载。详见[动态工具加载](docs/extensions.md#dynamic-tool-loading)、[OpenAI兼容性](docs/models.md#openai-compatibility)和[`kimi-deferred-tools.ts`](examples/extensions/kimi-deferred-tools.ts)示例。

### 更改

- 将xAI登录改为使用预填设备授权链接，标签为“使用SuperGrok或X Premium登录”，并将默认xAI模型更改为Grok 4.5（[#6734](https://github.com/earendil-works/pi-mono/pull/6734)由[@Jaaneek](https://github.com/Jaaneek)提交）。

### 修复

- 修复继承的Kimi K3输出限制，使其适用于Vercel AI Gateway和OpenRouter模型。
- 修复在会话首次助手响应前克隆或分叉会话，提示会话必须先保存。

### 移除

- 从内置xAI模型目录移除Grok 3、Grok 3 Fast、Grok 4.20变体和Grok Code Fast 1（[#6734](https://github.com/earendil-works/pi-mono/pull/6734)由[@Jaaneek](https://github.com/Jaaneek)提交）。

## [0.80.8] - 2026-07-16

### 新功能

- **统一模型运行时和提供商认证** — `ModelRuntime`集中管理模型配置、提供商拥有的`/login`和动态提供商目录。详见[提供商](docs/providers.md)。
- **实时模型目录刷新** — `/model`在后台刷新已配置的提供商，`pi update --models`强制立即刷新。详见[安装与管理](docs/packages.md#install-and-manage)。
- **xAI设备码OAuth和Grok 4.5响应支持** — 通过设备码登录xAI，并使用Grok 4.5进行低、中、高思维。详见[xAI](docs/providers.md#xai-grokx-subscription)。

### 重大变更

- 用异步`modelRuntime`选项替换SDK的`CreateAgentSessionOptions.authStorage`和`modelRegistry`选项。`AuthStorage`及其存储后端不再导出；使用`ModelRuntime`（或自定义pi-ai `CredentialStore`），或`readStoredCredential()`进行auth.json的一次性读取。
- 移除冗余的`ModelRuntime.getAll()`、`find()`、`getSnapshot()`和`getAuthOptions()`投影。直接使用pi-ai `Models`方法`getModels()`、`getModel()`、`getProviders()`和`checkAuth()`。
- 用`ModelRuntime.getAuth()`替换SDK请求认证组装（通过`ModelRegistry.getApiKeyAndHeaders()`）。传递提供商ID返回范围授权；传递模型也解析内置、`models.json`和扩展模型头。
- 将面向扩展的`ModelRegistry.refresh()`从同步`void`更改为`Promise<void>`，因为`models.json`加载是异步的。扩展必须等待它之后才能进行同步注册表读取。

- 将动态目录刷新的规范移动到异步`ModelRuntime.refresh()`/pi-ai `Models.refresh()`。旧版扩展OAuth `modifyModels`在凭证初始化后仍作为同步兼容性投影支持。

### 添加

- 将`ModelRuntime`作为规范的异步SDK和内部模型/认证门面，同时保留面向扩展的同步`ModelRegistry` API。`ModelRuntime.create()`可通过其`credentials`选项接受任何pi-ai `CredentialStore`。

- 添加了由提供者拥有的`/login`发现，可直接从已注册的pi-ai提供者获取，包括环境认证状态和信息链接。

- 添加了文件支持的动态目录（`models-store.json`），每个提供者的pi.dev目录覆盖层，以及Radius网关支持，包括从旧凭证缓存目录的离线迁移。

- 添加了扩展提供者`refreshModels(context)`对动态模型发现的支持，可选由提供者控制持久化。

- 添加了`pi update --models`，以强制立即刷新模型目录，而不更新pi或扩展。

- 添加了继承的xAI设备码OAuth登录和Grok 4.5 OpenAI响应支持，支持低、中、高思考级别（[#6651](https://github.com/earendil-works/pi-mono/pull/6651)由[@Jaaneek](https://github.com/Jaaneek)提交）。

### 更改

- 将`ModelRuntime`更改为通过pi-ai提供者方法组合内置提供者、不可变`models.json`配置和扩展覆盖。

- 将`ModelRuntime`更改为拥有最终请求组装：`getAuth(model)`包含已配置的模型头部，流方法在认证后仅解析一次，`before_provider_headers`作为仅模型头部转换运行，然后进行提供者分发。

- 将`/model`更改为立即渲染当前模型快照，在后台刷新已配置提供者，并在部分结果或超时错误时更新开放选择器。
### 修复

- 修复了configured-provider目录刷新，以解析pi.dev的基于model-ID的响应，将检查频率限制为每四小时一次，发送版本化的pi用户代理，将未实现的路由视为不可用的覆盖层，并在`/model`中显示简洁的刷新状态。
- 将相邻的助手思考块固定为一个思考区域。
- 修复了继承的OpenAI Codex会话ID超过64个字符的问题，以满足API限制（[#6630](https://github.com/earendil-works/pi-mono/issues/6630)）。
- 修复了终端输出的继承问题，以使制表符字符保持一致（[#6697](https://github.com/earendil-works/pi-mono/pull/6697) 由 [@xz-dev](https://github.com/xz-dev) 提交）。
- 修复了在检查npm包后Windows终端的标题([#6629](https://github.com/earendil-works/pi-mono/issues/6629))。

- 修复了Bun独立二进制文件，使其打包OAuth适配器以支持交互式登录。

## [0.80.7] - 2026-07-14

### 不兼容变更
- 已从`models.json`中移除`openai-responses`和`compat.sendSessionIdHeader`标志。会话关联行为现在由`compat.sessionAffinityFormat`（`"openai"`， `"openai-nosession"`，或 `"openrouter"`)。将 `sendSessionIdHeader: false` 替换为 `sessionAffinityFormat: "openai-nosession"` ([#6496](https://github.com/earendil-works/pi-mono/pull/6496) 由 [@petrroll](https://github.com/petrroll) 提交)。
### 新功能

- **缓存友好的动态工具加载** - 扩展程序可在执行过程中添加工具，同时支持Anthropic和OpenAI响应模型会保留提示缓存前缀。详见[动态工具加载](docs/extensions.md#dynamic-tool-loading)。
- **消息复制快捷方式** - `Ctrl+X`会复制对话记录中的最后一条助手消息，或在`/tree`中选中的消息，使较早或分支消息可直接复制。详见[显示与消息队列](docs/keybindings.md#display-and-message-queue)。
- **Fable 5 `xhigh`和`max`思考** - 生成器目录中支持原生`xhigh`和`max`思考等级。详见[模型选项](docs/usage.md#model-options)。

### 已添加
- 增加了针对由工具结果激活的扩展工具的缓存友好型动态工具加载。支持Anthropic和OpenAI响应模型加载定义在可用时加载，保持缓存的提示词前缀。详见[动态工具加载](docs/extensions.md#dynamic-tool-loading) ([#6474](https://github.com/earendil-works/pi-mono/pull/6474))。

- 增加了对Claude Fable 5的继承原生`xhigh`和`max`思考层级的支持，覆盖所有生成式提供商目录 ([#6490](https://github.com/earendil-works/pi-mono/pull/6490) 由[@davidbrai](https://github.com/davidbrai)提交)。

- 增加了`Ctrl+X`以复制最后一条助手消息，或在`/tree`中复制选定的消息。

- 增加了对OpenAI和Codex响应的继承`toolChoice`支持，包括必需和命名工具选择 ([#6588](https://github.com/earendil-works/pi-mono/pull/6588) 由[@xl0](https://github.com/xl0)提交)。

### 修复

- 修复了继承的OpenRouter模型上下文窗口，使其使用顶级提供商的实际上下文长度 ([#6481](https://github.com/earendil-works/pi-mono/pull/6481) 由[@davidbrai](https://github.com/davidbrai)提交)。

- 修复了继承的OpenRouter OpenAI兼容会话ID，使其使用`x-session-id`头部，而非OpenAI特定的会话关联字段 ([#6496](https://github.com/earendil-works/pi-mono/pull/6496) 由[@petrroll](https://github.com/petrroll)提交)。

- 修复了`Ctrl+V`在剪贴板不包含图片时粘贴剪贴板文本。

- 修复了`/login amazon-bedrock`，在提示并保存Bedrock API密钥时，而非仅显示环境AWS凭证设置说明。

- 修复了继承的Amazon Bedrock环境AWS凭证，使其继续使用SigV4认证，包括对自定义模型ID的支持 ([#6532](https://github.com/earendil-works/pi-mono/pull/6532) 由[@ribelo](https://github.com/ribelo)提交)。

- 修复了继承的Cloudflare Workers AI和AI Gateway认证，使其在存储凭证仅包含API密钥时，使用环境账户和网关ID ([#6292](https://github.com/earendil-works/pi-mono/pull/6292) 由[@markphelps](https://github.com/markphelps)提交)。

- 修复了继承的旧终端解码，针对Alt+符号键组合（如`Alt+,`和`Alt+.`）的处理 ([#6523](https://github.com/earendil-works/pi-mono/pull/6523) 由[@ribelo](https://github.com/ribelo)提交)。

- 修复了GitHub Copilot的`mai-code-1-flash-picker`模型，使其通过`/responses`端点路由 ([#6544](https://github.com/earendil-works/pi-mono/pull/6544) 由[@petrroll](https://github.com/petrroll)提交)。

- 修复了分支摘要，使其与使用环境认证而非API密钥的提供商兼容 ([#6595](https://github.com/earendil-works/pi-mono/pull/6595) 由[@davidbrai](https://github.com/davidbrai)提交)。

- 修复了继承的Amazon Bedrock错误，使其报告未处理的提供商停止原因，而非仅`An unknown error occurred` ([#6598](https://github.com/earendil-works/pi-mono/pull/6598) 由[@davidbrai](https://github.com/davidbrai)提交)。

- 修复了npm包移除，当已安装包存在冲突的同伴依赖时 ([#6604](https://github.com/earendil-works/pi-mono/pull/6604) 由[@davidbrai](https://github.com/davidbrai)提交)。

- 修复了继承的Azure OpenAI响应推理回放，当`encrypted_content`仅出现在终端响应事件中时 ([#6608](https://github.com/earendil-works/pi-mono/pull/6608) 由[@davidbrai](https://github.com/davidbrai)提交)。

- 修复了继承的Anthropic兼容代理，使其在`message_delta`事件中包含`usage` ([#6611](https://github.com/earendil-works/pi-mono/pull/6611) 由[@davidbrai](https://github.com/davidbrai)提交)。

- 修复了继承的OpenCode OpenAI响应模型，使其省略不支持的`session-id`头部，同时保持其他缓存亲和力数据 ([#6645](https://github.com/earendil-works/pi-mono/pull/6645) 由[@davidbrai](https://github.com/davidbrai)提交)。

- 修复了系统提示词缓存失效，通过从默认提示词中移除当前日期实现跨日期缓存 ([#6621](https://github.com/earendil-works/pi/issues/6621))。

## [0.80.6] - 2026-07-09

### 新增功能

- **`max`思考层级** - 新增可选的思考层级，位于`xhigh`之上，原生支持于GPT-5.6和自适应Claude模型，可在CLI（`--thinking max`）、SDK、RPC和模型选择中使用。自定义主题可定义`thinkingMax`。详见[CLI参考](docs/usage.md#cli-reference)。

- **基于输入的定价层级** - 支持请求范围内的输入令牌定价层级，用于准确的长上下文成本核算（例如GPT-5.4/5.5/5.6长上下文费率），也可在`models.json`和`modelOverrides`中为自定义模型配置。详见[模型配置](docs/models.md#model-configuration)。

### 增加了

- 增加了可选的`max`思考层级，覆盖CLI、SDK、RPC、模型选择和主题。自定义主题可定义`thinkingMax`；现有主题回退至`thinkingXhigh`。
- 增加了请求范围的input-token定价层级，应用于`models.json`、`modelOverrides`以及已注册扩展提供商的自定义模型成本。
- 增加了`~`（主目录）的扩展，用于`shellPath`设置（[#6470](https://github.com/earendil-works/pi/pull/6470) 由 [@aaronkyriesenbach](https://github.com/aaronkyriesenbach) 提交）。

### 修复

- 修复了继承式压缩后输出-token预算计算，使其忽略压缩边界前的过期助手使用情况（[#6464](https://github.com/earendil-works/pi/issues/6464)）。
- 修复了继承式GPT-5.4和GPT-5.5长上下文成本核算，同时保留了对需要显式覆盖的模型默认272K上下文限制的有意设定。
- 修复了继承式GPT-5.6元数据，使其在短上下文层级保留直接OpenAI请求的同时，暴露Codex后端的372K上下文窗口及长上下文定价，并移除了不存在的裸`gpt-5.6`别名。
- 修复了继承式Anthropic消息转换，使其保留带有有效签名但思考文本为空的思考区块，避免在新版Claude模型中出现思考区块错误（[#6457](https://github.com/earendil-works/pi/pull/6457) 由 [@davidbrai](https://github.com/davidbrai) 提交）。

## [0.80.5] - 2026-07-09

## [0.80.4] - 2026-07-09

### 新增功能

- **提示缓存未命中可见性** - 重要的缓存未命中可在转录中通过`showCacheMissNotices`显示。详见[模型与思考](docs/settings.md#model--thinking)。
- **项目本地资源配置** - `pi config -l`和Tab切换管理全局与项目本地包资源。详见[启用与禁用资源](docs/packages.md#enable-and-disable-resources)。
- **扩展生命周期和提供商钩子** - 扩展支持`agent_settled`、`before_provider_headers`、入口渲染器和`InlineExtension`。详见[agent_start / agent_end / agent_settled](docs/extensions.md#agent_start--agent_end--agent_settled)、[before_provider_headers](docs/extensions.md#before_provider_headers)和[InlineExtension](docs/sdk.md#inlineextension)。
- **新增继承式模型和传输支持** - GPT-5.6元数据、Copilot Claude Sonnet 5和zstd Codex SSE传输可通过继承式提供商支持获得。详见[提供商](docs/providers.md)和[模型选项](docs/usage.md#model-options)。

### 增加了

- 增加了继承式OpenAI GPT-5.6模型元数据，支持`gpt-5.6`、`gpt-5.6-sol`、`gpt-5.6-terra`和`gpt-5.6-luna`，同时验证了`openai-codex`对`gpt-5.6-sol`、`gpt-5.6-terra`和`gpt-5.6-luna`的支持。
- 增加了继承式Claude Sonnet 5至GitHub Copilot模型目录（[#6200](https://github.com/earendil-works/pi/issues/6200)）。
- 增加了继承式zstd请求体压缩，用于OpenAI Codex响应的SSE传输。
- 增加了`/login <provider>`提供商自动补全支持。
- 增加了CLI等效的模型和作用域模型解析的公共SDK导出（[#6201](https://github.com/earendil-works/pi/issues/6201)）。
- 增加了扩展和RPC的`agent_settled`事件及会话级空闲等待，用于完全就绪的代理运行（[#6363](https://github.com/earendil-works/pi/issues/6363)）。
- 增加了`before_provider_headers`扩展钩子支持，用于注入提供商请求头（[#6350](https://github.com/earendil-works/pi/pull/6350) 由 [@pmateusz](https://github.com/pmateusz) 提交）。
- 增加了`InlineExtension`类型，用于命名内联扩展工厂（[#6267](https://github.com/earendil-works/pi/pull/6267) 由 [@any-victor](https://github.com/any-victor) 提交）。
- 增加了扩展入口渲染器，用于持久化仅显示会话条目，在交互模式下渲染而不发送至模型上下文。
- 增加了项目本地资源覆盖管理至`pi config`，包括项目模式启动（`pi config -l`）和Tab切换（全局与项目范围）（[#6309](https://github.com/earendil-works/pi/pull/6309)）。
- 增加了继承式`InMemorySessionStorage`和`JsonlSessionStorage`导出，来自代理框架（[#6435](https://github.com/earendil-works/pi/issues/6435)）。
- 增加了继承式JSONL会话头的自定义元数据支持（[#6417](https://github.com/earendil-works/pi/pull/6417) 由 [@ArcadiaLin](https://github.com/ArcadiaLin) 提交）。
- 增加了一个`showCacheMissNotices`设置和`/settings`切换，用于显著提示缓存未命中转录通知。

### 修复

- 修复了继承式gRPC `ResourceExhausted`提供商错误的重试分类，例如NVIDIA NIM瞬时耗尽响应（[#6449](https://github.com/earendil-works/pi/pull/6449) 由 [@davidbrai](https://github.com/davidbrai) 提交）。
- 修复了对Cloudflare 524超时响应的继承重试分类问题（[#6239](https://github.com/earendil-works/pi/issues/6239)）。
- 修复了对GitHub Copilot设备码登录轮询的继承处理，使其在首次令牌轮询前等待，并尊重服务器提供的`slow_down`间隔，避免浏览器授权后出现错误或挂起的假象（[#6187](https://github.com/earendil-works/pi/issues/6187)）。
- 修复了对OpenAI Codex WebSocket会话的继承处理，使其在后端60分钟限制前轮换缓存连接，避免长时间会话出现连接限制失败（[#6268](https://github.com/earendil-works/pi/issues/6268)）。
- 修复了对DS4服务器上下文溢出检测的继承处理，以处理`Prompt has ... tokens, but the configured context size is ... tokens`错误（[#6262](https://github.com/earendil-works/pi/issues/6262)）。
- 修复了对Fireworks GLM 5.2 Fast的继承处理，使其使用兼容OpenAI的端点和`thinkingLevelMap`，并与GLM 5.2保持一致（[#6195](https://github.com/earendil-works/pi/issues/6195)）。
- 修复了分叉菜单忽略对同一入口重复选择的问题（[#6430](https://github.com/earendil-works/pi/pull/6430)由[@davidbrai](https://github.com/davidbrai)提交）。
- 修复了Bun独立发布版中的原生剪贴板支持（[#6418](https://github.com/earendil-works/pi/pull/6418)由[@davidbrai](https://github.com/davidbrai)提交）。
- 修复了对GitHub Copilot扩展上下文窗口模型的继承处理，使其使用`contextWindow: 1000000`，防止过早压缩和预算不足（[#6439](https://github.com/earendil-works/pi/issues/6439)）。
- 修复了对编辑器粘贴标记会计的继承处理，当粘贴标记被删除或终端状态被清除时（[#6397](https://github.com/earendil-works/pi/pull/6397)由[@affanali2k3](https://github.com/affanali2k3)提交）。
- 修复了`null`消息内容从导入的转录或自定义客户端中获取时，在摄入边界处进行规范化处理，而不是在上下文构建过程中失败（[#6343](https://github.com/earendil-works/pi/pull/6343)）。
- 修复了对继承工具调用的处理，当助手消息被截断时，工具调用应失败而不是等待缺失的工具结果（[#6285](https://github.com/earendil-works/pi/pull/6285)）。
- 修复了对OpenAI完成和响应提供程序的继承处理，当工具结果包含空文本且无图像内容时，应发送`(no tool output)`而不是`(see attached image)`。
- 修复了对OpenAI响应和Azure OpenAI响应请求的继承处理，避免发送低于提供程序最小值的`max_output_tokens`（[#6265](https://github.com/earendil-works/pi/issues/6265)）。
- 修复了继承自Amazon Bedrock的Claude Fable 5和Claude Sonnet 5的prompt-cache点位问题（[#6235](https://github.com/earendil-works/pi/issues/6235)）。
- 修复了继承自Amazon Bedrock的Claude 5的prompt-cache价格元数据，移除了过期的备用覆盖项。
- 修复了继承自OpenAI Codex的用户代理构建，使其能够同步加载Node OS元数据，避免启动时可能出现的与`pi (browser)`相关的竞态条件（在Node/Bun中）。
- 修复了`pi update`在pnpm安装中的问题，建议在可执行文件指向已移除缓存版本时修剪pnpm的自更新缓存（[#6279](https://github.com/earendil-works/pi/pull/6279)由[@rajp152k](https://github.com/rajp152k)提交）。
- 修复了Xiaomi Token Plan模型元数据，使其遵循上游models.dev的token-plan目录，移除了不支持的`mimo-v2-omni`变体（[#6204](https://github.com/earendil-works/pi/issues/6204)）。
- 修复了启动模型选择，跳过未认证的默认值，以便配置的本地自定义模型可以被选择（[#6231](https://github.com/earendil-works/pi/issues/6231)）。
- 修复了问题扩展示例，使其能够顺序运行问题工具调用，从而确保同一助理轮询中多个问题仍可被回答（[#6189](https://github.com/earendil-works/pi/issues/6189)）。
- 修复了`/login`，使其在`auth.json`被锁定时报告认证存储持久性失败，而非声称凭证已保存（[#6223](https://github.com/earendil-works/pi/issues/6223)）。
- 修复了分轮压缩，使其能够序列化摘要请求，避免单并发本地提供程序在429错误下失败（[#5536](https://github.com/earendil-works/pi/issues/5536)）。
- 修复了压缩保留令牌预算，使其能够计算上下文可见的自定义消息（[#6326](https://github.com/earendil-works/pi/issues/6326)）。
- 修复了在助理流式传输期间追加的自定义会话条目，使其在实时助理消息之前渲染，与持久化会话顺序保持一致。
- 修复了非正值或过大bash工具超时，使其在被立即超时限制前会返回清晰的验证错误（[#6181](https://github.com/earendil-works/pi/issues/6181)）。
- 修复了编辑工具模式，允许模型自行发明额外的替换字段，而非拒绝其他有效的编辑（[#6278](https://github.com/earendil-works/pi/issues/6278)）。
- 修复了新会话重置以清除缓存的标签时间戳的问题（[#6354](https://github.com/earendil-works/pi/issues/6354)）。
- 修复了Bun获取套接字断开错误（报告为`socket connection was closed`）的自动重试，这样短暂的提供商断开连接就不会在没有重试的情况下结束无头运行（[#6431](https://github.com/earendil-works/pi/issues/6431)）。
- 修复了`models.json`和`modelOverrides`，使其适用于已注册的扩展提供商模型（[#6367](https://github.com/earendil-works/pi/issues/6367)）。
- 修复了项目上下文文件发现，在Windows上使用稳定的父级遍历，因此启动时不再因加载AGENTS.md或CLAUDE.md而挂起（[#6369](https://github.com/earendil-works/pi/issues/6369)）。
- 修复了`--session-id`启动时的警告，当没有现有项目会话具有该ID且pi创建了新会话时（[#6407](https://github.com/earendil-works/pi/issues/6407)）。
- 修复了`/reload`帮助文本和文档，使其始终提及主题和上下文文件（[#6395](https://github.com/earendil-works/pi/issues/6395)）。

### 移除了

- 移除了Vercel AI网关请求中的默认归属头。

## [0.80.3] - 2026-06-30

### 新功能

- **Anthropic Claude Sonnet 5支持** - Claude Sonnet 5可通过继承的Anthropic兼容和Bedrock提供商目录使用，并启用了自适应思维。请参阅[提供商](docs/providers.md)和[模型选项](docs/usage.md#model-options)。
- **可配置输出间距** - `outputPad`控制用户消息、助手消息和思维块的水平内边距。请参阅[设置](docs/settings.md#ui--display)。
- **外部编辑器配置** - `externalEditor`允许Ctrl+G在`$VISUAL`/`$EDITOR`回退之前使用配置的编辑器。请参阅[设置](docs/settings.md#ui--display)和[快捷键](docs/keybindings.md)。
- **更丰富的RPC会话树访问** - RPC客户端可以使用`get_entries`和`get_tree`检查会话条目和树快照。请参阅[get_entries](docs/rpc.md#get_entries)和[get_tree](docs/rpc.md#get_tree)。
- **扩展会话元数据更新** - 扩展可以通过`session_info_changed`观察会话名称更改。请参阅[session_info_changed](docs/extensions.md#session_info_changed)。
- **现代Azure Foundry端点支持** - Azure OpenAI响应提供商设置支持当前的Microsoft Foundry端点URL。请参阅[Azure OpenAI](docs/providers.md#azure-openai)。

### 增加了

- 增加了继承的Anthropic Claude Sonnet 5模型支持。
- 增加了`get_entries`和`get_tree` RPC命令，用于通过RPC读取会话条目和树快照（[#6078](https://github.com/earendil-works/pi/pull/6078)由[@geraschenko](https://github.com/geraschenko)提交）。
- 增加了一个`./rpc-entry`包导出，用于直接在RPC模式下启动Pi。
- 增加了会话名称更改事件，供扩展使用（[#6175](https://github.com/earendil-works/pi/pull/6175)由[@xl0](https://github.com/xl0)提交）。
- 增加了继承的Azure OpenAI响应支持，用于现代Microsoft Foundry端点URL（[#6004](https://github.com/earendil-works/pi/pull/6004)由[@gukoff](https://github.com/gukoff)提交）。
- 增加了继承的`Usage.reasoning`令牌计数，用于报告推理/思维令牌使用情况的提供商（[#6057](https://github.com/earendil-works/pi/issues/6057)）。
- 增加了`externalEditor`的settings.json覆盖，用于Ctrl+G外部编辑器命令，默认情况下在Windows上回退到Notepad，在其他地方回退到`nano`（[#6122](https://github.com/earendil-works/pi/issues/6122)）。
- 增加了`outputPad`设置，用于用户消息、助手消息和思维的水平内边距（[#6168](https://github.com/earendil-works/pi/issues/6168)）。

### 更改了

- 将默认的OpenAI模型更改为`gpt-5.5`。
- 将继承的OpenAI Codex响应SSE响应头等待更改为使用配置的HTTP超时，而不是之前的固定20秒超时，从而减少了慢连接上的虚假超时（[#4945](https://github.com/earendil-works/pi/issues/4945)）。

### 修复了

- 修复了继承的Claude Sonnet 5元数据，使其在Anthropic兼容和Bedrock请求中使用自适应思维负载。
- 修复了继承的生成小米MiMo模型定价，使其与models.dev的当前按使用付费定价匹配（[#6138](https://github.com/earendil-works/pi/issues/6138)）。
- 修复了继承的提供商HTTP错误，使其包含响应体，而不是不透明的SDK消息（[#5832](https://github.com/earendil-works/pi/pull/5832)由[@stephanmck](https://github.com/stephanmck)提交）。
-  修复了继承的 `streamSimple()` 最大令牌限制，使那些将输入和输出计数视为同一上下文窗口的提供者不会拒绝长请求（[#5595](https://github.com/earendil-works/pi/issues/5595)）。
-  修复了继承的 OpenAI 响应流，以保持推理回放状态，即使输出项按顺序完成（[#6009](https://github.com/earendil-works/pi/issues/6009)）。
-  修复了继承的 Z.AI 保留思考请求，在启用思考时发送 `thinking.clear_thinking: false`，允许回放的 `reasoning_content` 参与提供者缓存（[#6083](https://github.com/earendil-works/pi/issues/6083)）。
-  修复了预提示压缩，使其在压缩后停止，而不是立即继续（[#6074](https://github.com/earendil-works/pi/pull/6074) 由 [@yzhg1983](https://github.com/yzhg1983) 提交）。
-  修复了资源通知，在恢复会话时保持在消息之前（[#6048](https://github.com/earendil-works/pi/pull/6048) 由 [@haoqixu](https://github.com/haoqixu) 提交）。
-  修复了启动基准测试时间输出，使其在 TUI 关闭后打印，保持扩展计时，并在停止基准模式前排空终端查询回复（[#6030](https://github.com/earendil-works/pi/pull/6030) 由 [@xl0](https://github.com/xl0) 提交，[#6063](https://github.com/earendil-works/pi/pull/6063) 由 [@xl0](https://github.com/xl0) 提交）。
-  修复了扩展工具更改，在同一代理运行中应用到下一个提供者请求之前，且不会丢失 `before_agent_start` 系统提示覆盖（[#6162](https://github.com/earendil-works/pi/issues/6162)）。
-  修复了 undici 在终止中间流 HTTP 响应时发出内部客户端错误导致的崩溃（[#6133](https://github.com/earendil-works/pi/issues/6133)）。
-  修复了压缩事件回归测试，以覆盖状态指示器清理并保持持续集成通过。
-  修复了交互式状态指示器，使结束工作、重试、压缩或分支摘要指示器在启用 clear-on-shrink 时不再缩小 TUI（[#6026](https://github.com/earendil-works/pi/pull/6026)）。
-  修复了 `--session` 和 `SessionManager.open()`，拒绝非空无效会话文件而不覆盖它们（[#6002](https://github.com/earendil-works/pi/issues/6002)）。
-  修复了用户消息转录渲染，保持可见的反斜杠，例如在 `\"` 等 Markdown 转义序列中（[#6105](https://github.com/earendil-works/pi/issues/6105)）。
-  修复了因输出长度停止的助手消息，显示可见的不完整响应错误（[#4290](https://github.com/earendil-works/pi/issues/4290)）。
-  修复了 `--no-session --session-id`，使短暂 CLI 运行可以使用确定性会话 ID 进行提供者缓存亲和力（[#6070](https://github.com/earendil-works/pi/issues/6070)）。
-  修复了磁盘 BMP 图像文件的检测、转换为 PNG 并通过 `read` 和 CLI `@file` 输入附加（[#6047](https://github.com/earendil-works/pi/issues/6047)）。
-  修复了对提供者流错误的自动重试，这些错误明确告诉调用者重试请求（[#6019](https://github.com/earendil-works/pi/issues/6019)）。

## [0.80.2] - 2026-06-23

### 变更

-  继承的 pi-ai `ApiKeyCredential` 改为使用 `auth.json` 兼容的 `type: "api_key"` 和提供者作用域 `env` 值，而不是 `type: "api-key"` 和元数据。

-  将继承的 agent-core 公共框架执行选项类型从 `ExecutionEnvExecOptions` 重命名为 `ShellExecOptions`。

### 修复

-  修复了继承的 Anthropic 兼容自定义模型，使用显式的兼容性元数据，而不是提供者名称启发式，以用于会话亲和力头和不支持的工具字段省略。
-  修复了继承的请求作用域 `apiKey` 和 `env` 值，使其参与提供者身份验证解析，使 Cloudflare 等提供者可以从显式调用选项中派生请求特定的基础 URL（[#6021](https://github.com/earendil-works/pi/issues/6021)）。
-  恢复了继承的临时遗留 per-API 流别名（如 `streamSimpleOpenAICompletions`）在 pi-ai 兼容入口点上的支持（[#6016](https://github.com/earendil-works/pi/issues/6016)，[#6017](https://github.com/earendil-works/pi/issues/6017)）。
-  恢复了继承的运行时 `detectCompat` 在 `openai-completions` 中的回退，用于没有显式兼容元数据的模型（[#6020](https://github.com/earendil-works/pi/issues/6020)）。

## [0.80.1] - 2026-06-23

### 修复

-  修复了继承的 Amazon Bedrock 作用域 `AWS_PROFILE` 端点解析，用于内置推理配置文件端点。
-  修复了继承的 Fireworks Anthropic 兼容请求，使其对自定义 Fireworks 模型应用会话亲和力和不支持的工具字段默认值。
-  修复了继承的 Together MiniMax M2.7 元数据，避免不支持的 Together 推理开关。

## [0.80.0] - 2026-06-23

### 变更
- 增加了`Ctrl+J`作为默认的换行键绑定，与`Shift+Enter`并列。
- 将显示的`zai`提供商标签重命名为“ZAI Coding Plan (Global)”以提高清晰度（[#5965](https://github.com/earendil-works/pi/issues/5965)）。
- pi-ai的旧版全局API（`stream`/`complete`/`completeSimple`，`getModel`/`getModels`/`getProviders`，`registerApiProvider`，`getEnvApiKey`，...）已从`@earendil-works/pi-ai`根入口点迁移到`@earendil-works/pi-ai/compat`。运行时扩展不受影响：扩展加载器会将pi-ai根解析为兼容入口点（严格超集），因此现有扩展无需更改即可继续工作。那些类型检查符合pi-ai已发布类型规范的扩展源应将导入切换到`@earendil-works/pi-ai/compat`（或迁移到新的`createModels()`/provider-factory API）。兼容入口点和加载器别名将在后续版本中移除，并附带迁移指南。

### 修复

- 修复了会话名称，使其在存储或显示标签前会规范化换行字符（[#5999](https://github.com/earendil-works/pi/pull/5999) 由 [@haoqixu](https://github.com/haoqixu) 提交）。
- 修复了会话选择器，使其按每个子树中最新活动对线程会话树进行排序（[#5784](https://github.com/earendil-works/pi/pull/5784) 由 [@Perlence](https://github.com/Perlence) 提交）。
- 修复了与扩展相关的崩溃和启动失败报告，建议重启时使用`pi -ne`。
- 修复了继承自OpenAI的响应流，使其在缺少终端事件前不会失败，并修复了上下文使用和压缩估算，使其忽略截断响应后全零的助手使用情况（[#5526](https://github.com/earendil-works/pi/pull/5526) 由 [@dmmulroy](https://github.com/dmmulroy) 提交）。
- 修复了继承自OpenAI Codex的WebSocket会话，在OpenAI连接限制达到前输出开始前仅重新连接一次（[#5973](https://github.com/earendil-works/pi/issues/5973)）。
- 修复了继承自Amazon Bedrock的端点解析，使其尊重作用域内的`AWS_PROFILE`值。
- 修复了继承自Cloudflare的提供商，使其要求配置账户/网关并路由内置兼容调用通过提供商认证。
- 修复了作用域认证环境值，使其能够达到继承的`Models`/`ImagesModels` API调用和兼容API密钥注入。
- 修复了继承自OpenCode Go GLM-5.2的元数据，使其暴露`xhigh`推理并发送提供商的最大推理努力（[#5967](https://github.com/earendil-works/pi/issues/5967)）。
- 修复了`pi --resume`以加载用户包主题并解析自动亮/暗主题设置。
- 修复了`models.json`自定义提供商，使其存储的凭证可在认证时满足需求而无需冗余的`apiKey`（[#5953](https://github.com/earendil-works/pi/issues/5953)）。

### 移除

- 移除了继承自选择性提供商的`@earendil-works/pi-ai/base`和`@earendil-works/pi-agent-core/base`入口点；请改用带有显式`Models`提供商工厂的根包。

## [0.79.10] - 2026-06-22

### 新功能

- **扩展压缩事件上下文** - `session_before_compact`和`session_compact`事件现在包含`reason`和`willRetry`，使扩展能够区分手动`/compact`、阈值自动压缩和溢出重试流程。详见[session_before_compact / session_compact](docs/extensions.md#session_before_compact--session_compact)和[Custom Summarization via Extensions](docs/compaction.md#custom-summarization-via-extensions)。
- **更安全的更新流程** - `pi update`安装确切的已检查Pi版本，更新通知显示变更日志URL，使升级更可预测。详见[Install and Manage](docs/packages.md#install-and-manage)。

### 添加

- 为扩展`session_before_compact`和`session_compact`事件添加了`reason`和`willRetry`元数据，以便扩展能够区分手动、阈值和溢出压缩流程（[#5962](https://github.com/earendil-works/pi/pull/5962) 由 [@PizzaMarinara](https://github.com/PizzaMarinara) 提交）。

### 修复

- 修复了`find`工具，使其在父`.gitignore`规则忽略嵌套仓库时仍尊重嵌套git仓库边界（[#5960](https://github.com/earendil-works/pi/issues/5960)）。
- 修复了使用文档/命令表，使其包含`/trust`和`/import`（[#5959](https://github.com/earendil-works/pi/issues/5959)）。
- 修复了继承自OpenAI的流式传输，使其保留匹配工具调用增量前到达的加密`reasoning_details`（[#5114](https://github.com/earendil-works/pi/issues/5114)）。
- 修复了计划模式扩展示例的TUI文档链接（[#5957](https://github.com/earendil-works/pi/issues/5957)）。
- 修复了临时扩展UI和会话开始消息，在会话替换或重载期间发出，使其保持可见，并在重载完成前保持重载输入被阻塞（[#5943](https://github.com/earendil-works/pi/issues/5943)）。
- 修复了计划模式示例，以保持活动自定义工具的可用性，在未找到计划时跳过操作提示，并正确排队细化/执行后续操作（源自`agent_end`）（[#5940](https://github.com/earendil-works/pi/issues/5940)）。
- 修复了`pi update`，使其安装由Pi更新检查返回的确切版本，使`--force`重新安装已检查的版本，当没有可用版本时，改为失败而不是回退到未版本化的重新安装，并报告旧版本和更新后的版本。
- 修复了更新通知，使其显示实际的变更日志URL作为超链接文本。

## [0.79.9] - 2026-06-20

### 新特性

- **聊天模板思维兼容性** - 支持OpenAI兼容的自定义提供商可以将Pi的思维等级映射到`chat_template_kwargs`，使vLLM/Hugging Face聊天模板模型（如DeepSeek）能够使用提供商原生的思维控制。请参阅[自定义提供商API类型](docs/custom-provider.md#api-types)和[OpenAI兼容性](docs/models.md#openai-compatibility)。
- **GLM-5.2 提供商改进** - GLM-5.2 现在已修正 Fireworks OpenAI 兼容路由和 OpenRouter `xhigh` 思维支持，改善了 `/model` 行为和高投入推理，提升了 GLM-5.2 用户的体验。请参阅 [模型选项](docs/usage.md#model-options)。

### 已添加

- 已添加可继承的可配置 `chat-template` 思维支持，适用于使用 `chat_template_kwargs` 的 OpenAI 兼容提供商，例如基于 vLLM 的 DeepSeek 模型 ([#5673](https://github.com/earendil-works/pi/issues/5673))。
### 已修复

- 已将继承的 Fireworks GLM-5.2 元数据固定为使用与 `reasoning_effort` 兼容的 OpenAI 兼容型 Chat Completions 接口 ([#5923](https://github.com/earendil-works/pi/issues/5923))。
- 修复了同一目录下的会话切换，以便在重用导入的扩展模块时保持新鲜的扩展实例和生命周期事件（[#5905](https://github.com/earendil-works/pi/issues/5905)）。
- 修复了深度会话分支构建上下文或分支路径时耗时二次方的问题（[#5909](https://github.com/earendil-works/pi/issues/5909)）。
- 修复了继承自OpenRouter GLM-5.2的元数据，以暴露`xhigh`推理过程，并发送OpenRouter的原生`xhigh`努力（[#5770](https://github.com/earendil-works/pi/issues/5770)）。
- 修复了继承自Markdown流式代码块渲染的问题，使部分关闭的代码块不再在内容流式传输时收缩或闪烁（[#5846](https://github.com/earendil-works/pi/pull/5846) 由[@xl0](https://github.com/xl0)提交）。
- 修复了模糊`edit`匹配，以保留未改动的行块，而不是通过规范化内容重写整个文件（[#5899](https://github.com/earendil-works/pi/issues/5899)）。
- 修复了通过旧版WSL `bash.exe`传递脚本到stdin，使目标bash中的shell变量能够展开（[#5893](https://github.com/earendil-works/pi/issues/5893)）。
- 修复了`/model`，以隐藏GitHub Copilot模型，这些模型对已认证账户不可用（[#5897](https://github.com/earendil-works/pi/issues/5897)）。
- 修复了`/model`选择器搜索，使其优先排名精确的提供者前缀匹配，然后再排名代理提供者模型ID匹配（[#5892](https://github.com/earendil-works/pi/issues/5892)）。

## [0.79.8] - 2026-06-19

### 新特性

- **选择性提供者基础入口点** - SDK用户可以将`@earendil-works/pi-ai/base`和`@earendil-works/pi-agent-core/base`与显式提供者注册搭配使用，以防止捆绑的应用程序包含未使用的提供者传输。详见[`pi-ai`基础入口点](../ai/README.md#base-entry-point)和[`pi-agent-core`基础入口点](../agent/README.md#base-entry-point)。
- **Mistral提示缓存** - Mistral会话现在使用提供者端的提示缓存，带有会话关联性和缓存令牌使用/成本会计。详见[API密钥](docs/providers.md#api-keys)和[环境变量](docs/usage.md#environment-variables)。
- **压缩后令牌估算** - 压缩结果和压缩事件现在包含压缩后的令牌计数，以便客户端可以显示近似的上下文减少量。详见[RPC压缩](docs/rpc.md#compact)和[压缩事件](docs/rpc.md#compaction_start--compaction_end)。
- **OpenRouter Fusion别名** - `openrouter/fusion`可用作内置的OpenRouter模型别名。详见[API密钥](docs/providers.md#api-keys)。
### 已添加

- 已继承 `@earendil-works/pi-ai/base` 和 `@earendil-works/pi-agent-core/base` 的入口点，用于捆绑应用中的选择性提供商注册 ([#5348](https://github.com/earendil-works/pi/pull/5348))，由 [@FredKSchott](https://github.com/FredKSchott) 提交。

- 已继承 Mistral 提示缓存，使用 pi 会话 ID 作为 `prompt_cache_key`，包括缓存令牌使用和成本核算 ([#5854](https://github.com/earendil-works/pi/issues/5854))。

- 已添加预估压缩后的令牌计数，用于压缩结果和压缩事件 ([#5877](https://github.com/earendil-works/pi/issues/5877))。

- 已添加继承的 OpenRouter Fusion 别名 `openrouter/fusion` ([#5866](https://github.com/earendil-works/pi/pull/5866))，由 [@dannote](https://github.com/dannote) 提交。

### 已修复

- 已更新易受攻击的运行时依赖项，包括 `undici` 和打包的 `protobufjs` 传递依赖项。

- 已修复压缩功能，拒绝没有合格消息的会话，而不是生成空摘要 ([#4811](https://github.com/earendil-works/pi/issues/4811))。

- 已修复成功溢出触发的自动压缩，避免对已完成的助手响应进行重试 ([#5720](https://github.com/earendil-works/pi/issues/5720))。

## [0.79.7] - 2026-06-18

### 新功能

- **自动主题模式** - `/settings` 可以选择独立的浅色和深色主题，并跟随终端颜色方案的变化。详见 [选择主题](docs/themes.md#selecting-a-theme)。

- **默认仅更新自身** - `pi update` 现在仅更新 pi，`pi update --all` 用于同时更新 pi 和包。详见 [安装与管理](docs/packages.md#install-and-manage)。

- **扩展 API 辅助工具** - 扩展程序可以使用 `CONFIG_DIR_NAME` 获取项目配置路径，并导入编辑差异辅助工具以实现编辑风格的差异对比。详见 [`ctx.cwd`](docs/extensions.md#ctxcwd) 和 [SDK 导出](docs/sdk.md#exports)。

- **Warp 内联图像** - Warp 终端现在可通过 Kitty 图形检测实现内联图像渲染。详见 [图像](docs/tui.md#image)。

### 已添加

- 已添加自动主题模式，使 `/settings` 可以使用独立的浅色和深色主题，并跟随终端颜色方案的变化 ([#5874](https://github.com/earendil-works/pi/pull/5874))。

- 已继承 Warp 终端图像能力检测，使内联图像可通过 Warp 的 Kitty 图形支持渲染 ([#5841](https://github.com/earendil-works/pi/pull/5841))，由 [@dodiego](https://github.com/dodiego) 提交。

- 已导出 `CONFIG_DIR_NAME` 作为编码代理公共 API，使扩展程序可以在不硬编码 `.pi` 的情况下解析项目配置路径 ([#5869](https://github.com/earendil-works/pi/pull/5869))，由 [@xl0](https://github.com/xl0) 提交。

- 已导出编辑差异辅助工具（`generateDiffString`、`generateUnifiedPatch` 和 `EditDiffResult`）作为公共 API，供需要编辑风格差异的扩展程序使用 ([#5756](https://github.com/earendil-works/pi/pull/5756))，由 [@xl0](https://github.com/xl0) 提交。

### 已更改

- 已将裸 `pi update` 修改为仅更新 pi，添加 `pi update --all` 用于同时更新 pi 和扩展程序，并澄清了扩展程序更新提示。

- 已在主题名称中保留 `/`，用于自动浅色/深色主题设置。

- 已更新扩展程序文档、示例、运行时帮助、信任提示和配置标签，使用已配置的项目配置目录，而非硬编码的 `.pi` 路径。

### 已修复

- 已修复 RPC 未知命令错误，包含请求 ID，以便客户端不会因等待响应而挂起 ([#5868](https://github.com/earendil-works/pi/issues/5868))。

- 已修复 `/model` 自动补全和模型选择搜索，使其无论先输入提供商令牌还是模型令牌，都能匹配提供商/模型查询。

- 已修复树导航器，在深度条目中水平滚动，以确保选中项仍可读 ([#5830](https://github.com/earendil-works/pi/issues/5830))。

## [0.79.6] - 2026-06-16

### 已修复

- 已修复 HTTP 调度程序配置，保留调用者的明确 `fetch` 覆盖，而非重新安装 undici 全局 fetch。

- 已修复继承的 OpenCode Go DeepSeek V4 思考请求，使其发送提供商的 `thinking: { type: "disabled" }` 兼容性参数。

## [0.79.5] - 2026-06-16

### 新功能

- **按提供商范围的 API 密钥环境** - `auth.json` API 密钥条目现在可以包含 `env` 覆盖，用于 Cloudflare、Azure OpenAI、Google Vertex、Amazon Bedrock、缓存保留和代理设置，无需更改项目 shell。详见 [认证文件](docs/providers.md#auth-file)。
- **全局HTTP代理设置** - 在全局设置中配置一次`httpProxy`，即可将`HTTP_PROXY`和`HTTPS_PROXY`应用到Pi管理的HTTP客户端。详见[网络](docs/settings.md#network)。
- **Vercel AI网关归属权标识** - Vercel AI网关的请求现在默认包含Pi归属权头部。详见[API密钥](docs/providers.md#api-keys)。

### 已增加

- 已增加Vercel AI网关请求归属权头部（`http-referer`和`x-title`）以支持Vercel AI网关模型（[#5798](https://github.com/earendil-works/pi/pull/5798) 由[@rwachtler](https://github.com/rwachtler) 提交）。
- 当实验功能启用时，已增加`xp`尾部标记。
- 已增加一个全局`httpProxy`设置，该设置将作为`HTTP_PROXY`和`HTTPS_PROXY`应用到Pi管理的HTTP客户端（[#5790](https://github.com/earendil-works/pi/issues/5790)）。
- 已增加`auth.json` API密钥`env`的值，以便特定提供商的环境覆盖配置可以作用于Pi并传递给继承的提供商配置（[#5728](https://github.com/earendil-works/pi/issues/5728)）。

### 已更改

- 已更新HTML会话导出所使用的内嵌Markdown解析器为`marked` 18.0.5。

### 已修复

- 已修复继承的OpenAI响应流，使其能够容忍来自OpenAI兼容服务器的null消息内容（在工具调用之前）（[#5819](https://github.com/earendil-works/pi/issues/5819)）。
- 已修复继承的OpenCode DeepSeek V4思考请求，避免同时发送`thinking`和`reasoning_effort`（[#5818](https://github.com/earendil-works/pi/issues/5818)）。
- 已修复设备码登录，使其不再自动打开浏览器。
- 已修复继承的编辑器光标上移处理，使非空草稿在浏览输入历史之前能跳转到行首（[#5789](https://github.com/earendil-works/pi/pull/5789) 由[@4h9fbZ](https://github.com/4h9fbZ) 提交）。
- 已修复继承的Z.AI GLM-5.2思考请求，使其发送`reasoning_effort`时包含提供商的`high`/`max`努力映射（[#5770](https://github.com/earendil-works/pi/issues/5770)）。
- 已修复Windows上的成功`pi update`退出，使其自然退出而不是调用`process.exit(0)`，避免版本检查网络请求后Node.js/libuv断言（[#5805](https://github.com/earendil-works/pi/issues/5805)）。
- 已修复继承的Google和`google-vertex` Gemini模型元数据，使其映射`latest`别名到当前模型，添加Vertex上的Gemini 3.5 Flash，修正Gemini 2.5 Flash Vertex缓存定价，并移除已关闭的Vertex预览模型（[#5761](https://github.com/earendil-works/pi/issues/5761)）。
- 已修复会话选择器，在当前文件夹和所有范围的会话列表都为空时保持打开并显示所有会话的空状态（[#5747](https://github.com/earendil-works/pi/issues/5747)）。
- 已修复继承的Moonshot AI中国模型元数据，包含Kimi K2.7 Code，并省略对Kimi K2.7 Code模型不支持的thinking-off负载（[#5760](https://github.com/earendil-works/pi/issues/5760)）。

## [0.79.4] - 2026-06-15

### 新功能

- **自动首次运行主题选择** - Pi会在首次运行时检测终端背景，并默认选择`dark`或`light`主题。详见[选择主题](docs/themes.md#selecting-a-theme)。
- **独立二进制完整性校验和** - GitHub发布资产现在包含`SHA256SUMS`文件，用于验证独立二进制下载。详见[快速入门安装](docs/quickstart.md#install)。

### 已增加

- 已增加`SHA256SUMS`完整性文件到独立二进制的GitHub发布资产中（[#5739](https://github.com/earendil-works/pi/issues/5739)）。
- 已增加首次运行时从终端背景进行的交互式主题检测（[#5385](https://github.com/earendil-works/pi/pull/5385) 由[@vegarsti](https://github.com/vegarsti) 提交）。

### 已修复

- 已修复bash工具输出收集，使其在子进程退出后仍继续从stdout/stderr读取，避免延迟输出被截断（[#5753](https://github.com/earendil-works/pi/pull/5753) 由[@Mearman](https://github.com/Mearman) 提交）。
- 已修复`/tree`帮助渲染，使其在窄终端上显示紧凑的换行控件而不是截断它们（[#5055](https://github.com/earendil-works/pi/issues/5055)）。
- 已修复SIGTERM/SIGHUP交互式关闭，使其在终端清理完成前保持信号处理器安装，防止`signal-exit`重新发送信号并使终端处于raw/Kitty键盘模式（[#5724](https://github.com/earendil-works/pi/issues/5724)）。
-  修复了文档，澄清了 `pi.getActiveTools()` 返回活动工具名称，而 `pi.getAllTools()` 返回工具元数据 ([#5729](https://github.com/earendil-works/pi/issues/5729))。
-  修复了问题和问卷扩展示例，使其在长提示、选项和帮助文本时进行换行，而不是截断 ([#5708](https://github.com/earendil-works/pi/pull/5708) 由 [@xl0](https://github.com/xl0) 提交)。
-  修复了 `pi list`、`pi install` 和 `pi update` 等包命令，在完成时终止，即使扩展程序未关闭后台句柄 ([#5687](https://github.com/earendil-works/pi/issues/5687))。
-  修复了 pnpm 全局安装的 `pi update`，当配置的 `global-bin-dir` 不再与活动 pnpm 主目录匹配时 ([#5689](https://github.com/earendil-works/pi/issues/5689))。
-  修复了使用范围或标签的 npm 包规范（例如 `@^1.2.7`），以确保安装的包资源仍可加载，而不是被视为不匹配的精确引脚 ([#5695](https://github.com/earendil-works/pi/issues/5695))。
-  修复了继承的 Anthropic 1 小时提示缓存写入成本核算，将 1 小时缓存写入成本按输入的 2 倍计费，而不是按 5 分钟缓存写入速率计费 ([#5738](https://github.com/earendil-works/pi/pull/5738) 由 [@theBucky](https://github.com/theBucky) 提交)。
-  修复了继承的 GitHub Copilot Claude 适应性思维努力元数据，使其与手动检查的 Copilot 模型能力匹配 ([#4637](https://github.com/earendil-works/pi/issues/4637))。
-  修复了继承的 OpenCode/OpenCode Go 完成模型元数据，省略了拒绝 `prompt_cache_retention` 的路由的长保留缓存字段 ([#5702](https://github.com/earendil-works/pi/issues/5702))。
-  修复了继承的叠加层合成对 CJK 宽字符的支持，使边框在叠加层开始于全宽单元格时仍保持对齐 ([#5297](https://github.com/earendil-works/pi/issues/5297))。
-  修复了继承的 WezTerm 在全屏重绘回退时的 inline Kitty 图像渲染，确保在绘制放置位置之前保留图像填充行，而不影响高图像放置 ([#5618](https://github.com/earendil-works/pi/issues/5618), [#4415](https://github.com/earendil-works/pi/issues/4415))。
-  修复了自定义提供程序配置，使纯大写 API 密钥和头部值保持字面量，而不是被视为遗留环境引用；使用显式的 `$ENV_VAR` 语法处理环境变量 ([#5661](https://github.com/earendil-works/pi/issues/5661))。
## [0.79.3] - 2026-06-13

### 修复

- 修复了继承的OpenAI GPT-5.4/GPT-5.5和OpenAI Codex GPT-5.4/GPT-5.4 mini/GPT-5.5上下文窗口元数据，使其使用观察到的272k-token Codex后端限制，避免因提示词超过Codex接受限制而产生的计费风险（由[@trethore](https://github.com/trethore)报告）。

## [0.79.2] - 2026-06-12

### 新增功能

- **更清晰的Bedrock验证指引** - Amazon Bedrock数据保留验证错误现在链接到AWS数据保留文档。详见[Amazon Bedrock](docs/providers.md#amazon-bedrock)。

### 新增

- 新增了一个实验性的首次设置流程（位于`PI_EXPERIMENTAL=1`后端），首次启动时会询问用户选择深色/浅色主题（默认选择检测到的外观）并同意分析数据共享，使用默认代理目录；同意后会将`trackingId`存储到`settings.json`中（[#5587](https://github.com/earendil-works/pi/pull/5587)由[@vegarsti](https://github.com/vegarsti)提交）。

- 新增了AWS数据保留文档链接，用于继承的Amazon Bedrock不支持数据保留模式验证错误（[#5561](https://github.com/earendil-works/pi/pull/5561)由[@unexge](https://github.com/unexge)提交）。

### 修复

- 修复了项目信任检测，使其在从`$HOME`运行时忽略全局`~/.pi/agent`状态，并使`pi update`仅使用保存或显式项目信任，不再提示（[#5619](https://github.com/earendil-works/pi/issues/5619)）。

- 修复了实验性首次设置，使其跳过分叉会话，而不是重新运行设置提示（[#5627](https://github.com/earendil-works/pi/pull/5627)由[@vegarsti](https://github.com/vegarsti)提交）。

- 修复了继承的OpenAI兼容上下文溢出检测，使其处理带括号的`maximum context length (N)`错误（[#5677](https://github.com/earendil-works/pi/issues/5677)）。

- 修复了继承的OpenAI GPT-5.4/GPT-5.5和OpenAI Codex GPT-5.4/GPT-5.4 mini/GPT-5.5上下文窗口元数据，使其匹配当前OpenAI限制（[#5644](https://github.com/earendil-works/pi/issues/5644)）。

- 修复了继承的Anthropic拒绝停止，使其在错误消息中保留提供方`stop_details`的解释（[#5666](https://github.com/earendil-works/pi/pull/5666)由[@rwachtler](https://github.com/rwachtler)提交）。
- 将继承的OpenAI Codex Responses SSE响应头超时增加到20秒，以减少误报阻塞，同时保留对零事件挂起情况引入的有界等待（[#4945](https://github.com/earendil-works/pi/issues/4945)）。
- 修复了继承的Claude Fable 5思考关闭请求，使其省略Anthropic不支持的`thinking.type: "disabled"`负载（[#5567](https://github.com/earendil-works/pi/pull/5567)由[@tmustier](https://github.com/tmustier)提交）。
- 修复了继承的工具进度回调，在工具结算后被忽略，而不是发出过时的`tool_execution_update`事件（[#5573](https://github.com/earendil-works/pi/issues/5573)）。
- 修复了继承的用户消息转录渲染，使独立的`+`消息不再渲染为`-`（[#5657](https://github.com/earendil-works/pi/issues/5657)）。
- 修复了继承的斜杠分隔模糊查询，使提供方/模型补全在插入后仍可匹配。
- 修复了继承的WezTerm内嵌Kitty图像渲染，使保留行清除不会擦除工具图像预览除顶部条带外的所有部分（[#5618](https://github.com/earendil-works/pi/issues/5618)）。
- 修复了继承的编辑器换行，CJK文本在插入后断行于字符边界，而非留下大段尾部空白（[#5585](https://github.com/earendil-works/pi/pull/5585)由[@haoqixu](https://github.com/haoqixu)提交）。
- 修复了继承的松散Markdown列表渲染，以保持列表项之间的空白行分隔（[#5562](https://github.com/earendil-works/pi/pull/5562)由[@Perlence](https://github.com/Perlence)提交）。
- 修复了`--model`，对于认证自定义模型ID，其斜杠前缀匹配未认证内置提供方时的解析问题（[#5643](https://github.com/earendil-works/pi/issues/5643)）。
- 修复了`/fork`，使会话父链在分叉路径包含标签时保持连接（[#5669](https://github.com/earendil-works/pi/issues/5669)）。
- 修复了`/share`和`/export`的HTML导出，使其在配置的自定义主题不再存在时使用活动的备用主题（[#5596](https://github.com/earendil-works/pi/issues/5596)）。
- 修复了带有`:<thinking>`后缀的自定义备用模型ID，使其在提供方模板模型未声明推理时仍保留请求的思考级别（[#5560](https://github.com/earendil-works/pi/pull/5560)由[@haoqixu](https://github.com/haoqixu)提交）。

## [0.79.1] - 2026-06-09
### 新功能

- **Claude Fable 5** - Claude Fable 5现已在Anthropic和Amazon Bedrock提供商上可用，支持自适应思维和`xhigh`努力支持。
- **提示模板默认值** - 提示模板可以使用默认的位置参数（如`${1:-7}`）作为可选值。详见[提示模板参数](docs/prompt-templates.md#arguments)。
- **可配置的项目信任默认值** - `defaultProjectTrust`允许用户选择默认情况下对未解决的项目信任请求是询问、始终信任还是永不信任，且扩展程序可以检查有效的信任决策。详见[项目信任](docs/security.md#project-trust)和[`ctx.isProjectTrusted()`](docs/extensions.md#ctxisprojecttrusted)。
- **自然的扩展自动补全触发器** - 扩展自动补全提供商可以声明触发字符（如`#`或`$`），以便在没有斜杠命令前缀的情况下打开建议。详见[自动补全提供商](docs/extensions.md#autocomplete-providers)。

### 新增

- 新增对提示模板位置参数默认值的扩展功能，例如`${1:-7}`（[#5553](https://github.com/earendil-works/pi/pull/5553) by [@dannote](https://github.com/dannote)）。
- 新增`areExperimentalFeaturesEnabled`功能门控，允许用户选择启用早期功能（[#5547](https://github.com/earendil-works/pi/pull/5547) by [@vegarsti](https://github.com/vegarsti)）。
- 新增`ctx.isProjectTrusted()`，使扩展程序能够观察到有效的项目信任决策，包括临时信任决策（[#5523](https://github.com/earendil-works/pi/issues/5523)）。
- 新增全局`defaultProjectTrust`设置，用户可选择默认情况下对未解决的项目信任请求是询问、始终信任还是永不信任。
- 新增对`ctx.ui.addAutocompleteProvider()`包装器的扩展自动补全触发字符支持（[#4703](https://github.com/earendil-works/pi/issues/4703)）。
- 新增对Anthropic和Amazon Bedrock提供商的Claude Fable 5模型支持，继承自`@earendil-works/pi-ai`，支持自适应思维和`xhigh`努力支持。

### 修复

- 修复了Amazon Bedrock推理配置文件ARN区域解析，优先使用ARN内嵌区域而非`AWS_REGION`（[#5527](https://github.com/earendil-works/pi/pull/5527) by [@AJM10565](https://github.com/AJM10565)）。
- 修复了在斜杠命令自动补全可见时继承的 IME 硬件光标定位问题（[#5283](https://github.com/earendil-works/pi/pull/5283) 由 [@smoosex](https://github.com/smoosex) 提交）。
- 修复了继承的 z.ai 关闭思考请求发送提供者的 `thinking: { type: "disabled" }` 兼容性参数问题（[#5330](https://github.com/earendil-works/pi/issues/5330)）。
- 修复了继承的 OpenCode 完成模型元数据，使其发送明确的 `maxTokens` 作为 `max_tokens`（[#5331](https://github.com/earendil-works/pi/issues/5331)）。
- 修复了继承的 Moonshot Kimi 关闭思考请求发送提供者的 `thinking: { type: "disabled" }` 兼容性参数问题（[#5531](https://github.com/earendil-works/pi/issues/5531)）。
- 修复了继承的 Azure OpenAI 响应请求，以禁用服务器端响应存储（[#5530](https://github.com/earendil-works/pi/issues/5530)）。
- 修复了继承的 Azure GPT-5.4 和 GPT-5.5 上下文窗口元数据，调整为 1,050,000 个标记，与 Azure Foundry 部署匹配，而非 OpenAI 的 272k 限制（[#5559](https://github.com/earendil-works/pi/issues/5559)）。
- 修复了继承的 OpenAI 和 Azure GPT-5 Pro `maxTokens` 元数据，调整为 128,000，修正了上游重复输入子限制为输出限制的错误（[#5559](https://github.com/earendil-works/pi/issues/5559)）。
- 修复了继承的提示历史导航，使其在从历史浏览返回时能恢复当前草稿（[#5494](https://github.com/earendil-works/pi/issues/5494)）。
- 修复了混合拉丁和CJK文本的换行处理，使无间距的CJK段落能在图形边界处断行，而不会留下大段尾部空白（[#5495](https://github.com/earendil-works/pi/issues/5495)）。
- 修复了扩展OAuth登录提示，使其在提交提示行时保持稳定，而非镜像当前输入值（[#5433](https://github.com/earendil-works/pi/issues/5433)）。
- 修复了 `/reload`，使其应用更新的 `steeringMode` 和 `followUpMode` 设置到当前会话（[#5377](https://github.com/earendil-works/pi/issues/5377)）。
- 修复了无效的 `models.json` 语法，使其跳过启动配置迁移，改为报告正常的文件路径感知模型错误，而非原始JSON解析堆栈追踪（[#5418](https://github.com/earendil-works/pi/issues/5418)）。
- 修复了GitHub发布说明和交互式变更日志链接，使其正确解析包相对路径的文档URL（[#5516](https://github.com/earendil-works/pi/issues/5516)）。
- 修复了CLI帮助和版本输出，包括直接重定向的 `--help`/`--version` 输出和简化的 `list`/`config` 帮助文本。
- 修复了 `/new`，使其从临时会话改为保持新会话为临时状态，而非默认持久化（[#5045](https://github.com/earendil-works/pi/issues/5045)）。
- 澄清了自定义模型文档，说明 `name` 和 `modelOverrides.name` 不会替换脚注或主模型列表中的模型ID（[#4841](https://github.com/earendil-works/pi/issues/4841)）。

## [0.79.0] - 2026-06-08

### 新特性

- **本地输入项目信任** - Pi 现在会在加载项目本地设置、资源、指令和包之前询问用户，保存决策并提供 `--approve` / `--no-approve` 控制，以支持非交互模式。详见 [项目信任](README.md#project-trust)。
- **扩展控制的信任决策** - 全局和CLI扩展可处理 `project_trust`，决定、记忆或延迟项目信任，再加载项目本地资源。详见 [`project_trust`](docs/extensions.md#project_trust)。
- **脚注中的缓存命中可见性** - 交互式脚注现在会显示最新的提示缓存命中率（`CH`）。详见 [交互模式](README.md#interactive-mode)。
- **更丰富的SDK和RPC扩展接口** - 公共导出现在包含RPC扩展UI请求/响应类型和包资产路径辅助函数。详见 [扩展UI协议](docs/rpc.md#extension-ui-protocol) 和 [SDK导出](docs/sdk.md#exports)。

### 新增

- 新增 `project_trust` 扩展事件，使全局和CLI扩展可在启动和运行时cwd切换时决定或延迟项目信任。
- 新增项目信任门控，用于项目本地设置、资源、指令和包的加载（[#5332](https://github.com/earendil-works/pi/pull/5332)）。
- 新增将最新的提示缓存命中率显示在交互式脚注中。
- 导出了RPC扩展UI请求和响应类型到公共API（[#5455](https://github.com/earendil-works/pi/issues/5455)）。
- 导出了编码代理包资产路径辅助函数到公共API（[#5415](https://github.com/earendil-works/pi/issues/5415)）。

### 修复
-  修复了包导出，移除了指向不存在的构建输出的过时 `./hooks` 子路径。
-  修复了继承的 TUI 渲染，当内容缩小到零时清除过时的行。
-  修复了继承的自动补全建议，在编辑器光标移动后刷新（[#5499](https://github.com/earendil-works/pi/pull/5499) by [@Roman-Galeev](https://github.com/Roman-Galeev)）。
-  修复了 `/reload`，使隐式受信任的会话创建项目 `.pi` 目录时能够持久化项目信任。
-  修复了项目信任输入发现，使其能够跨父目录便携式遍历。
- 修复了由Kitty键盘协议的后备响应驱动而非超时驱动引起的继承性间歇性Shift+Enter处理问题([#5188](https://github.com/earendil-works/pi/issues/5188))。
- 修复了压缩摘要系统提示，使其对非编码代理使用中立的AI助手措辞([#5401](https://github.com/earendil-works/pi/issues/5401))。
- 修复了`models.json`模式支持以及继承了`compat.supportsDeveloperRole: false`的OpenAI响应自定义提供程序处理([#5456](https://github.com/earendil-works/pi/issues/5456))。
- 修复了继承的提示历史导航，使向上浏览时光标置于开始位置，向下浏览时光标置于末尾位置（[#5454](https://github.com/earendil-works/pi/issues/5454)）。
- 修复了tmux设置文档，要求`extended-keys-format csi-u`使用tmux 3.5，并记录了tmux 3.2-3.4的回退方案（[#5432](https://github.com/earendil-works/pi/issues/5432)）。
- 修复了继承的OpenRouter路由偏好设置，使其在自定义提供商的基础URL不直接指向OpenRouter时也能正常工作（[#5347](https://github.com/earendil-works/pi/issues/5347)）。
- 修复了内置工具展开提示，使关闭括号的样式保持一致（[#5359](https://github.com/earendil-works/pi/issues/5359)）。
- 修复了技能包裹提示，使其在技能指令和用户消息之间插入间距（[#5371](https://github.com/earendil-works/pi/pull/5371) by [@Perlence](https://github.com/Perlence)）。

## [0.78.1] - 2026-06-04

### 新增功能

- **更多内置提供商覆盖** - 增加了Ant Ling和NVIDIA NIM提供商的设置，并为直接MiniMax提供商增加了MiniMax-M3支持。详见[提供商](docs/providers.md)。
- **更丰富的扩展上下文** - 扩展可以使用 `ctx.mode` 和 `ctx.getSystemPromptOptions()` 来适配 TUI、RPC、JSON 和打印模式的行为，并检查基础系统提示符输入。详见 [Extensions](docs/extensions.md)。

### 已添加

- 已添加容器化文档和一个 Gondolin 扩展示例，用于将内置工具路由到本地微虚拟机。
- 已添加 Ant Ling 提供器的选择和设置文档。
- 已添加从 `@earendil-works/pi-ai` 继承的 MiniMax-M3 模型支持，用于 `minimax` 和 `minimax-cn` 的直接提供器（[#5313](https://github.com/earendil-works/pi/issues/5313)）。
- 已添加 NVIDIA NIM 提供器的选择、设置文档和直接 NIM 请求归属头。
- 已添加 `ctx.mode` 到扩展上下文中，以便扩展可以区分 TUI、RPC、JSON 和打印模式。
- 已添加 `ctx.getSystemPromptOptions()`，供扩展命令检查当前基础系统提示符输入（[#5306](https://github.com/earendil-works/pi/pull/5306) 由 [@xl0](https://github.com/xl0) 提交）。

### 修复

- 修复临时扩展包安装，使其使用具有 `0700` 权限的私有 `~/.pi/agent/tmp/extensions` 目录，而不是 `os.tmpdir()/pi-extensions`。
- 修复 Git 包源处理，拒绝不安全的主机/路径组件，并保持管理克隆路径在安装根目录内。
- 修复存储的 XSS，通过在剥离控制字符后对 HTML 会话导出的 Markdown 链接和图片 URL 进行方案白名单清理。
- 修复 SDK 嵌入在捆绑的 Node 应用中失败的问题，当 `package.json` 不存在于捆绑入口点旁边时，会使用 `ENOENT`。包元数据读取器现在可以优雅地处理缺失的 `package.json`，使用默认值启用 `createAgentSession()`，无需在运行时要求包相邻文件（[#5226](https://github.com/earendil-works/pi/issues/5226)）。
- 修复了非Codex提供商（例如通过OpenAI兼容API的llama.cpp）不尊重HTTP超时设置的问题。现在，`httpIdleTimeoutMs`设置（通过`/settings` HTTP超时设置）作为默认的SDK请求超时，适用于所有支持它的提供商，而不仅仅是OpenAI Codex响应。禁用超时（HTTP超时 = false）现在会正确禁用所有支持提供商的SDK超时，通过发送最大int32值（实际上为无限大）来代替0，因为SDK会将timeout=0视为立即超时（[#5294](https://github.com/earendil-works/pi/issues/5294)）。
- 修复了继承自Amazon Bedrock的请求，将空白的必需用户/工具结果文本替换为占位符，并跳过空白的回放文本块（[#4975](https://github.com/earendil-works/pi/issues/4975)）。
- 修复了继承自Anthropic Claude Opus 4.7+的请求，抑制了已弃用的温度参数（[#5251](https://github.com/earendil-works/pi/pull/5251) 由[@yzhg1983](https://github.com/yzhg1983) 提交）。
- 修复了继承自OpenAI GPT-5.5的生成元数据，省略了不支持的最小思考（[#5243](https://github.com/earendil-works/pi/issues/5243)）。
- 修复了继承自OpenRouter Kimi K2.6的思考回放和开发者角色指令处理（[#5309](https://github.com/earendil-works/pi/issues/5309)）。
- 修复了继承自OpenRouter的推理指令请求，在必要时保留系统角色（[#5221](https://github.com/earendil-works/pi/pull/5221) 由[@PriNova](https://github.com/PriNova) 提交）。
- 修复了继承的叠加层焦点恢复，使非捕获叠加层在UI重新渲染和显式释放焦点后仍保持可交互状态（[#5235](https://github.com/earendil-works/pi/pull/5235) 由[@nicobailon](https://github.com/nicobailon) 提交）。
- 修复了继承的制表符宽度计算，在列切片和叠加层合成中，确保包含制表符的输出不会超过终端宽度（[#5218](https://github.com/earendil-works/pi/issues/5218)）。
- 修复了打开和列出非常大的JSONL会话文件的方式，改为逐行读取会话条目，而不是将整个文件作为单个字符串加载（[#5231](https://github.com/earendil-works/pi/issues/5231)）。
- 修复了WSL `/mnt/...`仓库中分支页脚的显示，在分支更改后刷新（[#5264](https://github.com/earendil-works/pi/pull/5264) 由[@psoukie](https://github.com/psoukie) 提交）。
- 修复了`renderShell: "self"`工具渲染器，当它们发出没有组件行时，不会留下空白的聊天行（[#5299](https://github.com/earendil-works/pi/issues/5299)）。
- 恢复并支持继承的 NVIDIA Qwen 3.5 122B NIM 模型。

## [0.78.0] - 2026-05-29

### 新功能

- **命名启动会话** - `--name` / `-n` 在启动前设置会话显示名称，适用于交互式、打印、JSON 和 RPC 模式。请参阅 [命名会话](docs/sessions.md#naming-sessions) 和 [会话选项](docs/usage.md#session-options)。
- **可点击的文件工具路径** - 内置文件工具标题在终端支持时渲染 OSC 8 `file://` 超链接，包括支持的 tmux 客户端。

### 新增

- 导出 `convertToPng` 供扩展作者使用 ([#5167](https://github.com/earendil-works/pi-mono/pull/5167) by [@xl0](https://github.com/xl0))。
- 导出 `parseArgs` 和类型 `Args` 供扩展作者使用 ([#5202](https://github.com/earendil-works/pi-mono/pull/5202) by [@xl0](https://github.com/xl0))。
- 新增 `--name` / `-n` 以在启动时设置会话显示名称 ([#5153](https://github.com/earendil-works/pi-mono/issues/5153))。
- 在退出交互式会话时增加恢复命令提示 ([#5176](https://github.com/earendil-works/pi-mono/pull/5176) by [@yzhg1983](https://github.com/yzhg1983))。
- 在内置文件工具标题显示的文件路径中添加 OSC 8 `file://` 超链接 ([#5189](https://github.com/earendil-works/pi-mono/pull/5189) by [@mpazik](https://github.com/mpazik))。
- 新增对继承自 `@earendil-works/pi-ai` 的自定义 Amazon Bedrock 请求头支持 ([#5178](https://github.com/earendil-works/pi-mono/pull/5178) by [@stephanmck](https://github.com/stephanmck))。

### 修复

- 澄清 WezTerm/WSL IME 硬件光标文档，说明光标可见性仍为可选功能 ([#5200](https://github.com/earendil-works/pi-mono/issues/5200))。
- 修复 GitLab Duo 自定义提供商示例，使其对 Claude 模型采用自适应思维，暴露 xhigh 思维，并包含更新的已验证模型 ID ([#5201](https://github.com/earendil-works/pi-mono/issues/5201))。
- 修复 Bun 释放归档创建，确保安装并复制匹配的 `@mariozechner/clipboard` 基础包和原生侧边包 ([#5184](https://github.com/earendil-works/pi-mono/issues/5184))。
- 修复早期交互式输入，在提示循环开始前输入的内容会被缓冲而不是丢弃 ([#5195](https://github.com/earendil-works/pi-mono/pull/5195) by [@yzhg1983](https://github.com/yzhg1983))。
- 修复了OpenRouter Moonshot Kimi K2.6请求使用`system`，而不是不支持的`developer`消息（[#5159](https://github.com/earendil-works/pi-mono/issues/5159)）。
- 修复了OpenCode Go Kimi K2.6思考请求发送`thinking`对象，而不是无效的字符串值，并修复了OpenCode Zen Grok构建思考请求省略不支持的`reasoning_effort`（[#5169](https://github.com/earendil-works/pi-mono/issues/5169)）。
- 修复了OpenAI Codex响应SSE流，在终端事件后中止响应体读取。
- 修复了OpenCode Kimi K2.6生成的元数据，使用Anthropic风格的思考元数据，而不是无效的reasoning-effort参数。
- 修复了OSC 8超链接在客户端支持时通过tmux（[#5189](https://github.com/earendil-works/pi-mono/pull/5189) 由[@mpazik](https://github.com/mpazik)提交）。
- 修复了ANSI文本换行，避免在非常长的换行上发生堆栈溢出（[#5185](https://github.com/earendil-works/pi-mono/issues/5185)）。

## [0.77.0] - 2026-05-28

### 新功能

- **Claude Opus 4.8支持** - 增加Anthropic Claude Opus 4.8元数据，并更新Opus自适应思考覆盖范围。
- **选择性工具禁用** - `--exclude-tools` / `-xt`可禁用特定内置、扩展或自定义工具，其余工具仍可用。详见[工具选项](docs/usage.md#tool-options)。
- **无头Codex订阅登录** - `/login`可使用设备码认证ChatGPT Plus/Pro Codex订阅。详见[订阅](docs/providers.md#subscriptions)和[OpenAI Codex](docs/providers.md#openai-codex)。
- **流感知扩展输入** - 扩展可区分空闲提示、流中转向和排队后续操作，使用`InputEvent.streamingBehavior`。详见[输入事件](docs/extensions.md#input-events)。

### 新增

- 新增`--exclude-tools` / `-xt`，用于禁用特定内置、扩展或自定义工具，其余工具仍可用（[#5109](https://github.com/earendil-works/pi/issues/5109)）。
- 新增OpenAI Codex订阅设备码登录作为可选的无头替代方案，浏览器登录仍为默认（[#4911](https://github.com/earendil-works/pi/pull/4911) 由[@vegarsti](https://github.com/vegarsti)提交）。
- 新增`streamingBehavior`到扩展输入事件，使扩展可区分空闲提示与流中转向和排队后续（[#5107](https://github.com/earendil-works/pi/pull/5107) 由[@DanielThomas](https://github.com/DanielThomas)提交）。
- 新增Claude Opus 4.8模型元数据支持Anthropic，并更新Opus自适应思考覆盖范围以使用该元数据。

### 修复

- 修复启动时间输出，`readPipedStdin`不再包含`createAgentSessionRuntime`工作（[#4829](https://github.com/earendil-works/pi/issues/4829)）。
- 修复OpenRouter DeepSeek V4的`xhigh`推理元数据，保留OpenRouter的原生努力，而不是发送DeepSeek的`max`努力（[#4801](https://github.com/earendil-works/pi/issues/4801)）。
- 修复自定义会话目录，使当前文件夹的恢复/继续查找限定于活动工作目录，所有会话列表覆盖自定义目录。
- 修复SIGTERM/SIGHUP退出，运行扩展`session_shutdown`清理并恢复终端：信号触发的关闭现在在任何终端写入之前发出`session_shutdown`，且SIGHUP不再强制退出，确保扩展资源（如套接字）即使终端消失也能释放（[#5080](https://github.com/earendil-works/pi/issues/5080)）。
- 修复键盘协议协商，忽略不匹配或延迟的终端响应，避免误判Kitty键盘协议（[#5091](https://github.com/earendil-works/pi/pull/5091) 由[@mitsuhiko](https://github.com/mitsuhiko)提交）。
- 修复Windows启动崩溃（在MSYS2 ucrt64 Node.js下），通过更新原生剪贴板插件到napi-rs 3.x（[#5028](https://github.com/earendil-works/pi/issues/5028)）。
- 修复API密钥和头部配置解析，将纯字符串视为字面量，支持`$ENV_VAR` / `${ENV_VAR}`插值和`$!`感叹号转义，并要求配置文件显式使用环境语法，避免Windows不区分大小写的环境匹配破坏字面量键（[#5095](https://github.com/earendil-works/pi/issues/5095)）。
- 修复会话处置，中止正在进行的代理、压缩、分支摘要、重试和bash工作（[#5029](https://github.com/earendil-works/pi/pull/5029) 由[@TerminallyChilI](https://github.com/TerminallyChilI)提交）。
- 修复`pi.getAllTools()`，使每个工具的`promptGuidelines`对需要每工具指南归属的扩展可见（[#4879](https://github.com/earendil-works/pi/issues/4879)）。
- 修复了从Anthropic扩展思维会话切换到OpenAI Codex响应时的回放问题，通过为转换后的思维/文本块生成唯一的回退消息项ID来实现（[#5148](https://github.com/earendil-works/pi/issues/5148)）。
- 修复了对返回空思维签名的提供商的Anthropic兼容回放问题，通过添加一个可选的`allowEmptySignature`兼容性标志来实现（[#4464](https://github.com/earendil-works/pi/issues/4464)）。
- 修复了OpenAI和OpenRouter GPT-5.5 Pro的思维层级元数据，使其仅暴露受支持的中、高和超高努力级别。
- 修复了OpenCode Go Kimi K2.6的思维关闭请求，使其发送`thinking: "none"`（[#5078](https://github.com/earendil-works/pi/issues/5078)）。
- 修复了小米Token Plan模型元数据，使其省略不受支持的`mimo-v2-flash`变体（[#5075](https://github.com/earendil-works/pi/issues/5075)）。
- 修复了由`agent_end`扩展处理器排队的后续消息，在代理空闲之前将其排空（[#5115](https://github.com/earendil-works/pi/pull/5115) by [@DanielThomas](https://github.com/DanielThomas)）。
- 修复了扩展输入事件，使其仅在流式处理期间排队提示时才报告`streamingBehavior`（[#5107](https://github.com/earendil-works/pi/pull/5107) by [@DanielThomas](https://github.com/DanielThomas)）。
- 修复了系统提示工具选择指导，避免优先选择不可用的文件探索工具（[#5132](https://github.com/earendil-works/pi/issues/5132)）。
- 修复了被`cli-highlight`替换后的主题感知语法颜色，确保fenced `diff`代码块和其他highlight.js作用域保持主题感知语法颜色（[#5092](https://github.com/earendil-works/pi/issues/5092)）。

## [0.76.0] - 2026-05-27

### 新特性

- **自动化专用的会话ID** - `--session-id <id>`允许脚本创建或恢复一个精确的项目本地会话。详见[会话](docs/usage.md#sessions)。
- **RPC bash输出可保持在模型上下文之外** - RPC客户端可以将`excludeFromContext`传递给`bash`，用于那些输出不应随下一个提示发送的命令。详见[RPC模式](docs/rpc.md#bash)。
- **更可预测的提供商重试和超时** - Codex WebSocket/SSE等待时间受限制，`retry.provider.maxRetries`控制提供商重试而非隐藏的SDK默认值。详见[重试设置](docs/settings.md#retry)。
- **跨环境更好的终端编辑体验** - Apple Terminal的Shift+Enter、Windows/JetBrains能力检测和Unicode感知的单词导航改进了交互式编辑。详见[终端设置](docs/terminal-setup.md)和[快捷键](docs/keybindings.md)。
### 已添加

- 已添加 `--session-id`，使 CLI 调用者能够使用精确的项目本地会话 ID，如果缺失则创建 ([#4874](https://github.com/earendil-works/pi/issues/4874))。

- 已添加 `excludeFromContext` 标志到 `bash` RPC 命令，以与内部 `executeBash` API 保持一致 ([#5039](https://github.com/earendil-works/pi/issues/5039))。

### 已修复

- 已修复用户消息转录以保留用户编写的有序列表标记 ([#5013](https://github.com/earendil-works/pi/issues/5013))。

- 已修复自更新命令以绕过 npm、pnpm 和 Bun 的最小发布版本年龄检查，以便显式 `pi update` 运行 ([#4929](https://github.com/earendil-works/pi/issues/4929))。

- 已修复上下文令牌估算以始终与工具结果图像一致地计算用户图像附件 ([#4983](https://github.com/earendil-works/pi/issues/4983))。

- 已修复 `httpIdleTimeoutMs` 以应用于 OpenAI Codex 响应的 WebSocket 空闲等待，添加了 `websocketConnectTimeoutMs` 以限制 WebSocket 连接等待，并添加了 10 秒的 Codex SSE 响应头超时 ([#4945](https://github.com/earendil-works/pi/issues/4945))。

- 已修复 `RpcClient` 以拒绝挂起的请求并在子进程意外退出时消费 stdin 管道错误 ([#4764](https://github.com/earendil-works/pi/issues/4764))。

- 已修复管理的 npm 扩展更新以避免包管理器将 pi 主机包安装或解析为同级依赖 ([#4907](https://github.com/earendil-works/pi/issues/4907))。

- 已修复 RPC 模式原始 stdout 写入以重试瞬时背压错误并在关闭时刷新排队的协议输出 ([#4897](https://github.com/earendil-works/pi/issues/4897))。

- 已修复 OpenAI Codex 响应的缓存亲和力头部以发送 `session-id` 而不是代理不兼容的 `session_id` ([#4967](https://github.com/earendil-works/pi/issues/4967))。

- 已修复 `openai-codex/gpt-5.3-codex-spark` 模型元数据以使用其 128k 上下文窗口 ([#4969](https://github.com/earendil-works/pi/issues/4969))。

- 已修复 OpenRouter/Poolside 上下文溢出检测以 `maximum allowed input length` 错误 ([#4943](https://github.com/earendil-works/pi/issues/4943))。
- 修复了提供程序重试控制，使`retry.provider.maxRetries`生效，SDK默认重试次数为`0`，并且配额/计费429错误不会在Pi的重试处理机制下被重试（[#4991](https://github.com/earendil-works/pi-mono/pull/4991) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交）。
- 修复了Apple终端`Shift+Enter`的问题，检测本地macOS修饰键状态以正确处理Terminal.app发送的纯回车。
- 修复了Windows终端能力检测，以启用OSC 8超链接，保持跨换行的可点击长URL（[#4923](https://github.com/earendil-works/pi/issues/4923)）。
- 修复了JetBrains终端能力检测，以启用truecolor并禁用不支持的OSC 8超链接（[#5037](https://github.com/earendil-works/pi-mono/pull/5037) 由 [@Perlence](https://github.com/Perlence) 提交）。
- 修复了编辑器和输入词导航/删除功能，使用Unicode词边界同时保持ASCII标点边界（[#5022](https://github.com/earendil-works/pi-mono/pull/5022) 由 [@haoqixu](https://github.com/haoqixu) 提交，[#5067](https://github.com/earendil-works/pi-mono/pull/5067) 由 [@haoqixu](https://github.com/haoqixu) 提交，[#5068](https://github.com/earendil-works/pi-mono/pull/5068) 由 [@haoqixu](https://github.com/haoqixu) 提交）。
- 修复了开发文档`AGENTS.md`链接，使其指向pi-mono指南（[#5041](https://github.com/earendil-works/pi/issues/5041)）。

## [0.75.5] - 2026-05-23

### 新增功能

- **更整洁的读取工具输出** - 默认折叠的`read`工具卡片仅显示读取行，而`Ctrl+O`仍展开完整文件内容。
- **Windows文件工具更快速** - 内置文件工具现在在流式处理时使用异步文件系统操作，图像缩放由主TUI线程在工作线程中执行。
- **更可靠的包更新** - `pi update`和git包安装现在会重新协商固定的git引用并保持包设置不变。详见[Packages](docs/packages.md)。
- **自定义Anthropic兼容的自适应思考** - 自定义提供程序模型配置可选择启用带`compat.forceAdaptiveThinking`的自适应思考Claude行为。详见[Custom providers](docs/custom-provider.md)和[Models](docs/models.md)。

### 新增

- 新增了`compat.forceAdaptiveThinking`对自定义Anthropic兼容模型配置文档和验证的支持（[#4797](https://github.com/earendil-works/pi-mono/pull/4797) 由 [@mbazso](https://github.com/mbazso) 提交）。
- 增加了一个标准统一的补丁，用于编辑工具结果详情，供SDK消费者使用（[#4821](https://github.com/earendil-works/pi/issues/4821)）。

- 增加了一个Codex订阅登录方法选择器，支持设备码认证的无头环境。

### 更改

- 更改折叠的阅读工具卡片，仅在展开时显示阅读行（[#4916](https://github.com/earendil-works/pi/issues/4916)）。

- 用一个微小的本地嵌入式辅助程序替换了Windows VT输入的继承可选`koffi`依赖，减小了安装包大小，同时保留了Shift+Tab处理（[#4480](https://github.com/earendil-works/pi/issues/4480)）。

- 更改了根开发安装文档，使用`npm install --ignore-scripts`（[#4868](https://github.com/earendil-works/pi/issues/4868)）。

### 修复

- 修复`pi update`，使其与git固定包与其配置引用保持一致（[#4869](https://github.com/earendil-works/pi/issues/4869)）。

- 修复Windows和glob/模式解析的包/资源路径处理（[#4873](https://github.com/earendil-works/pi-mono/pull/4873) 由[@mitsuhiko](https://github.com/mitsuhiko)提交）。

- 修复配置模式匹配，使其从正确的基础目录解析模式（[#4898](https://github.com/earendil-works/pi-mono/pull/4898) 由[@haoqixu](https://github.com/haoqixu)提交）。

- 修复主题选择器，按内容名称而非文件名列出主题（[#4830](https://github.com/earendil-works/pi-mono/pull/4830) 由[@Perlence](https://github.com/Perlence)提交）。

- 修复OpenCode Zen/Go请求，使其发送每会话的OpenCode路由头部（[#4847](https://github.com/earendil-works/pi/issues/4847)）。

- 修复Amazon Bedrock提供程序在严格包管理器下的加载，通过继承`@earendil-works/pi-ai`中声明的`@smithy/node-http-handler`依赖实现（[#4842](https://github.com/earendil-works/pi/issues/4842)）。

- 修复继承的Amazon Bedrock Claude请求，默认发送模型输出令牌限制，避免Bedrock的4096令牌默认截断（[#4848](https://github.com/earendil-works/pi/issues/4848)）。

- 修复导出的会话HTML，使其转义属性值中的引号字符（[#4832](https://github.com/earendil-works/pi/issues/4832)）。

- 修复GitHub Copilot设备码登录，在浏览器能力环境中保持打开验证URL，同时忽略无头模式下的浏览器启动失败（[#4788](https://github.com/earendil-works/pi-mono/pull/4788) 由[@vegarsti](https://github.com/vegarsti)提交）。
- 修复git包安装，以使现有检出与请求的引用保持一致，并更新包设置而不丢失过滤器（[#4870](https://github.com/earendil-works/pi/issues/4870)）。
- 发布了一个0.74.2紧急版本，提示Node 20用户在升级到新版本Pi之前先升级Node（[#4876](https://github.com/earendil-works/pi/issues/4876)）。
- 修复最终bash工具卡，避免渲染重复的完整输出路径截断（[#4819](https://github.com/earendil-works/pi/issues/4819)）。
- 修复bash工具截断行数，忽略尾部换行符作为额外输出行（[#4818](https://github.com/earendil-works/pi/issues/4818)）。
- 修复底部主目录缩写，避免缩短仅共享相同前缀的兄弟路径（[#4878](https://github.com/earendil-works/pi/issues/4878)）。
- 修复macOS Bun发布二进制文件，解决原生剪贴板侧边文件，使Ctrl+V图片粘贴可以加载`@mariozechner/clipboard`（[#4307](https://github.com/earendil-works/pi/issues/4307)）。
- 修复编码代理工具，避免在流式传输过程中进行同步文件系统操作，并将图像缩放移出主TUI线程（[#4756](https://github.com/earendil-works/pi-mono/pull/4756) by [@mitsuhiko](https://github.com/mitsuhiko)）。

## [0.75.4] - 2026-05-20

### 新特性

- **加固npm安装和发布路径** - Pi现在随CLI一起打包生成的缩小包装，阻止意外的锁文件更改，验证依赖项固定和生命周期脚本允许列表，禁用生命周期脚本的自我更新和本地发布安装（如支持），并在发布前对隔离的npm和Bun安装进行冒烟测试。详见[供应链加固](../../README.md#supply-chain-hardening)。

### 添加

- 在`pi update`运行后添加交互式更新说明，以便用户在继续之前可以看到已安装版本的变更日志（[#4724](https://github.com/earendil-works/pi-mono/pull/4724) by [@mitsuhiko](https://github.com/mitsuhiko)）。
- 将图像缩放实用工具导出到包根目录，供SDK消费者使用（[#4775](https://github.com/earendil-works/pi-mono/pull/4775) by [@xl0](https://github.com/xl0)）。

### 更改

- 更改源语法，避免需要JavaScript编译的TypeScript构造，保持核心源与仅支持Node.js的TypeScript检查兼容。
- 从CLI包中删除了Web UI工作区引用，并删除了包级别的开发监视脚本。
-  发布的 npm 安装包现在包括 `npm-shrinkwrap.json` 以锁定 CLI 包的传递性依赖项。
-  改进了终端主题检测，支持浅色/深色和 truecolor 处理。
-  将自更新包管理器命令的更改改为在重新安装时禁用生命周期脚本。

###  修复了

-  修复了系统提示，使模型在读取特定主题的相对引用之前，能够解析 pi 文档和示例的绝对包路径 ([#4752](https://github.com/earendil-works/pi/issues/4752))。
-  修复了扩展 `ctx.abort()` 在工具调用预检阶段的行为，以停止后续确认并恢复排队的交互式输入（如 Escape 键） ([#4276](https://github.com/earendil-works/pi/issues/4276))。
-  修复了 AgentSession 的重试、压缩和事件结算，使其使用等待的代理生命周期而不是单独的事件队列，并添加了 `willRetry` 到 `agent_end` 会话事件。
-  修复了分叉会话运行时状态，以保持活动会话 ID 与分叉目标的一致性 ([#4799](https://github.com/earendil-works/pi-mono/pull/4799) 由 [@Perlence](https://github.com/Perlence) 提交)。
-  修复了子代理扩展的并行模式，使其能够将有用的任务输出和失败任务的诊断返回给父模型，而不是 100 字符的预览 ([#4710](https://github.com/earendil-works/pi/issues/4710))。
-  修复了 Windows 本地 bash 执行，使其在从后台 SDK 进程启动时隐藏辅助控制台窗口 ([#4699](https://github.com/earendil-works/pi/issues/4699))。
-  修复了管理的 npm 扩展文件夹，以在支持的情况下设置云同步忽略元数据 ([#4763](https://github.com/earendil-works/pi/issues/4763))。
-  修复了 HTTP 空闲超时配置，以避免长时间运行的提供程序流因过早空闲而断开连接 ([#4759](https://github.com/earendil-works/pi-mono/pull/4759) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交)。
-  修复了默认系统提示边界，使用显式的 XML 标签以更清晰地区分文件 ([#4709](https://github.com/earendil-works/pi-mono/pull/4709) 由 [@herrnel](https://github.com/herrnel) 提交)。
-  修复了 HTML 分享/导出侧边栏点击共享工具条目的行为，使其滚动到渲染的工具调用 ([#4664](https://github.com/earendil-works/pi-mono/pull/4664) 由 [@yzhg1983](https://github.com/yzhg1983) 提交)。
- 修复了主题调色板，设置显式的文本颜色，避免终端默认颜色漂移。
- 修复了真彩色检测，使终端图像渲染与交互式主题决策保持一致。
- 修复了加载指示器启动，继承自`@earendil-works/pi-tui`，确保初始化不会在帧可用之前运行。
- 修复了OpenAI兼容的默认输出令牌请求，继承自`@earendil-works/pi-ai`，避免在服务器（如vLLM）上预留不可能的上下文窗口（[#4675](https://github.com/earendil-works/pi/issues/4675)）。
- 修复了OpenAI提示缓存键，继承自`@earendil-works/pi-ai`，确保在64字符提供者限制内（[#4720](https://github.com/earendil-works/pi/issues/4720)）。
- 修复了Windows npm系列包命令，适用于由fnm管理的Node.js安装，暴露了无扩展名的Unix脚本和`.cmd` shim（[#4793](https://github.com/earendil-works/pi/issues/4793)）。

## [0.75.3] - 2026-05-18

### 修复

- 修复了undici 8中HTTP/2销毁会话导致Node CLI崩溃的问题，保持了之前的HTTP/1.1仅fetch调度器行为（[#4681](https://github.com/earendil-works/pi/issues/4681)）。

## [0.75.2] - 2026-05-18

### 修复

- 修复了Bun编译的发布二进制文件启动失败的问题，当Bun内置的undici shim缺少npm undici的`install`导出时（[#4661](https://github.com/earendil-works/pi-mono/pull/4661) by [@dmasiero](https://github.com/dmasiero)）。
- 修复了Xiaomi MiMo生成的模型元数据，使其能够回放助手工具调用消息，支持`reasoning_content`的思考模式多轮请求，继承自`@earendil-works/pi-ai`（[#4678](https://github.com/earendil-works/pi/issues/4678)）。
- 修复了Windows外部编辑器交接，使vim/nvim在从TUI打开后能够接收输入（[#4612](https://github.com/earendil-works/pi/issues/4612)）。
- 修复了Windows npm自我更新，将已加载的本地依赖包移出活动安装目录，然后再重新安装pi（[#4157](https://github.com/earendil-works/pi/issues/4157)）。
- 修复了`pi update --self`检测，当pnpm v11全局安装的包路径通过pnpm store解析时（[#4647](https://github.com/earendil-works/pi/issues/4647)）。
- 修复了Windows pnpm自我更新，解决pnpm命令shim，通过pnpm运行而非手动更新（[#4157](https://github.com/earendil-works/pi/issues/4157)）。
- 修复了Windows npm系列命令执行，使用cross-spawn而非解析`.cmd` shim内部结构（[#4665](https://github.com/earendil-works/pi/issues/4665)）。

## [0.75.1] - 2026-05-18

### 修复

- 修复了配置选择器，使其可见行数根据终端高度缩放（[#4243](https://github.com/earendil-works/pi-mono/pull/4243) by [@samjonester](https://github.com/samjonester)）。
- 修复了Anthropic兼容的API密钥请求，忽略与`ANTHROPIC_AUTH_TOKEN`无关的环境变量，避免Xiaomi MiMo等提供商出现无效的承载凭证（继承自`@earendil-works/pi-ai`）（[#4342](https://github.com/earendil-works/pi/issues/4342)）。
- 修复了Amazon Bedrock消息转换，跳过未知的内容块，而不是使流失败（继承自`@earendil-works/pi-ai`）（[#4223](https://github.com/earendil-works/pi/issues/4223)）。
- 修复了Azure OpenAI和OpenAI响应的错误格式化，将HTTP状态码前缀添加到`errorMessage`，使短暂的5xx和429错误能够被继承自`@earendil-works/pi-ai`的智能体级自动重试分类器正确匹配（[#4232](https://github.com/earendil-works/pi/issues/4232)）。
- 修复了OpenCode Go Kimi推理回放，将流式`reasoning`字段标准化回`reasoning_content`（仅限OpenCode Go），继承自`@earendil-works/pi-ai`（[#4251](https://github.com/earendil-works/pi/issues/4251)）。
- 修复了Xiaomi MiMo模型元数据，使用OpenAI兼容的端点和`openai-completions` API，恢复多轮思考/工具调用会话（继承自`@earendil-works/pi-ai`）（[#4505](https://github.com/earendil-works/pi/issues/4505)）。
- 修复了Node 26.0下压缩fetch响应的JSON解析失败，通过安装undici fetch全局变量和pi的全局调度器解决（[#4650](https://github.com/earendil-works/pi/issues/4650), [#4652](https://github.com/earendil-works/pi/issues/4652), [#4653](https://github.com/earendil-works/pi/issues/4653)）。
- 修复了Windows上npm系列包命令，避免在安装前缀包含空格时发生shell参数拆分（[#4623](https://github.com/earendil-works/pi/issues/4623)）。

### 移除

- 移除了不工作的OpenAI Codex快速模型变体（继承自`@earendil-works/pi-ai`）。

## [0.75.0] - 2026-05-17

### 重大变更

- 将最低支持的Node.js版本提升至22.19.0。

### 修复
- 修复了压缩摘要调用，使其使用自定义代理流函数，保留基于代理的LLM路由（[#4484](https://github.com/earendil-works/pi/issues/4484)）。
- 修复了系统提示和上下文文件边界，使用显式的XML标签代替Markdown标题，减少模型对不一致边界的摄入（[#4541](https://github.com/earendil-works/pi-mono/pull/4541) 由 [@herrnel](https://github.com/herrnel) 提交）。
- 修复了OpenAI Codex生成的模型元数据，使其使用从`@earendil-works/pi-ai`继承的当前上游模型列表（[#4603](https://github.com/earendil-works/pi-mono/pull/4603) 由 [@mattiacerutti](https://github.com/mattiacerutti) 提交）。
- 修复了GitHub Copilot GPT模型思维元数据的继承，使其从`@earendil-works/pi-ai`映射不支持的最小思维到低（[#4622](https://github.com/earendil-works/pi-mono/pull/4622) 由 [@mattiacerutti](https://github.com/mattiacerutti) 提交）。
- 修复了用户作用域的npm包，使其安装在`~/.pi/agent/npm/`下，而不是npm的全局包根目录，避免系统管理的Node安装权限错误（[#4587](https://github.com/earendil-works/pi/issues/4587)）。
- 修复了Mistral请求在全局fetch代理/超时修复后失败的问题，移除了自定义fetch覆盖，改用undici 8调度器支持（[#4619](https://github.com/earendil-works/pi/issues/4619)）。
- 修复了默认输出令牌请求，对于广告输出限制实际上是其完整上下文窗口的模型，避免了不可能的提供商请求（[#4614](https://github.com/earendil-works/pi/issues/4614)），继承自`@earendil-works/pi-ai`。

## [0.74.1] - 2026-05-16

### 新特性

- **图像生成支持** - 增加了图像生成API、生成图像模型元数据和内置OpenRouter图像生成支持，继承自`@earendil-works/pi-ai`。
- **Together AI提供商** - 增加了Together AI作为内置提供商，支持`/login` API密钥认证、默认模型解析和设置文档。详见[README.md#providers--models](README.md#providers--models) 和 [docs/providers.md](docs/providers.md)。
- **Windows ARM64独立二进制文件** - 增加了Windows ARM64的独立发布工件。
- **改进终端和Markdown渲染** - 增加了Markdown列表缩进、任务列表复选框渲染、大型Markdown的健壮性和内联图像放置修复，继承自`@earendil-works/pi-tui`。

### 增加了

- 增加了图像生成支持（`@earendil-works/pi-ai`），包括图像生成API、图像模型元数据和内置OpenRouter图像生成支持（[#3887](https://github.com/earendil-works/pi-mono/pull/3887) 由 [@cristinaponcela](https://github.com/cristinaponcela) 提交）。
- 增加了Together AI到内置提供商设置、`/login` API密钥认证和默认模型解析（[#3624](https://github.com/earendil-works/pi-mono/pull/3624) 由 [@Nutlope](https://github.com/Nutlope) 提交）。
- 增加了Windows ARM64独立二进制文件发布工件（[#4458](https://github.com/earendil-works/pi/pull/4458) 由 [@brianmichel](https://github.com/brianmichel) 提交）。

### 修复了

- 修复了Node 26 OpenAI兼容流在五分钟后因空闲而超时，通过将全局fetch路由到pi的undici调度器进行处理（[#4519](https://github.com/earendil-works/pi/issues/4519)）。
- 修复了pnpm全局包安装，通过解析pnpm布局中的全局包根目录。
- 修复了macOS剪贴板访问错误在沙箱剪贴板拒绝下的情况，使其不会中止进程（[#4492](https://github.com/earendil-works/pi/issues/4492)）。
- 修复了配置模型周期快捷键的启动提示（[#4508](https://github.com/earendil-works/pi/issues/4508)）。
- 修复了资源路径显示，以解决跨包位置的包/资源名称冲突。
- 修复了`fd`在macOS x86_64的自动下载，通过固定发布版本以确保包含Intel macOS二进制文件（[#4559](https://github.com/earendil-works/pi/issues/4559)）。
- 修复了技能诊断，使其不再在技能名称与其父目录不一致时发出警告（[#4534](https://github.com/earendil-works/pi/issues/4534)）。
- 修复了提示模板参数解析，使其在多行输入未加引号时按换行符拆分（[#4553](https://github.com/earendil-works/pi/issues/4553)）。
- 修复了`--resume`会话列表，限制了飞行中会话元数据加载，避免大历史会话导致的OOM（[#4583](https://github.com/earendil-works/pi/issues/4583)）。
- 修复了交互式错误消息，使其在资源列表中渲染时带有尾随空格，避免重新加载错误与资源列表重叠（[#4510](https://github.com/earendil-works/pi/issues/4510)）。
- 修复了`.agents`包来源元数据，使其在包管理器扫描后仍能保留。
- 修复了Termux设置文档中的嵌套代码块，使示例AGENTS.md正确渲染[#4503](https://github.com/earendil-works/pi/issues/4503)。
- 修复了扩展确认对话框聚焦时工具输出扩展的问题[#4429](https://github.com/earendil-works/pi/issues/4429)。
- 修复了Anthropic流在`message_stop`之前结束时的自动重试功能（[#4433](https://github.com/earendil-works/pi/issues/4433)）。
- 修复了压缩摘要调用，将请求的输出令牌限制在模型范围内。
- 修复了交互模式异常未被捕获的情况，在退出前恢复终端（[#4426](https://github.com/earendil-works/pi-mono/pull/4426)由[@ofa1](https://github.com/ofa1)提交）。
- 修复 ANSI 剥离行为，使其与 `strip-ansi` 一致，移除依赖后生效。
- 修复 UUIDv7 序列生成，使其与会话 ID 共享，移除依赖后生效。
- 修复 OpenRouter 缓存令牌使用统计、Fireworks 缓存兼容性以及 OpenAI Codex WebSocket 代理处理，继承自 `@earendil-works/pi-ai`。
- 修复 markdown 列表换行、任务列表复选框、大段 markdown 渲染、WezTerm Kitty 键盘转义处理以及短视口内联图片放置，继承自 `@earendil-works/pi-tui`。
- 修复了主题在不同包作用域间共享的问题，使得扩展程序不再因`Theme not initialized`而崩溃（[#4333](https://github.com/earendil-works/pi/issues/4333)）。
- 固定快捷键提示，显示 Option 而不是 Alt 选项在 macOS 上（[#4289](https://github.com/earendil-works/pi/issues/4289)）。
- 修复了交互式更新通知，使其在终端支持超链接时将变更日志渲染为OSC 8超链接（[#4280](https://github.com/earendil-works/pi/issues/4280)）。
## [0.74.0] - 2026-05-07

### 已更改

- 更新了仓库链接和包引用，以迁移到 `earendil-works/pi-mono` 和 `@earendil-works/*` 包作用域。
## [0.73.1] - 2026-05-07

### 新功能

- **支持npm作用域迁移的自更新功能**：`pi update --self`现已支持从`@mariozechner/pi-coding-agent`更名为`@earendil-works/pi-coding-agent`的后续包。新包发布后，已有的全局安装可通过正常的自更新流程进行更新；pi将卸载旧的全局包，并安装版本检查端点返回的包名。
- **交互式OAuth登录选择**：OAuth提供商现在可以在`/login`中呈现多个登录选项，支持提供商特定的交互式认证流程。详见[Providers](docs/providers.md)。
- **JSONC风格的`models.json`解析**：`models.json`现在支持注释和尾逗号，便于自定义提供商和模型配置的维护。详见[Providers](docs/providers.md)和[Custom Providers](docs/custom-provider.md)。

### 新增

- 新增交互式登录选择支持，使OAuth提供商能够呈现多个登录选项（[#4190](https://github.com/earendil-works/pi-mono/pull/4190)，由[@mitsuhiko](https://github.com/mitsuhiko)提交）。

### 变更

- 变更`pi update --self`以尊重由Pi版本检查端点返回的活动包名，默认情况下省略时使用当前包，并在安装重命名包之前卸载旧的全局包。
- 变更扩展加载以使用上游`jiti` 2.7，而非`@mariozechner/jiti`的分支（[#4244](https://github.com/earendil-works/pi-mono/pull/4244)，由[@pi0](https://github.com/pi0)提交）。
- 变更`models.json`解析以允许注释和尾逗号（[#4162](https://github.com/earendil-works/pi-mono/pull/4162)，由[@julien-c](https://github.com/julien-c)提交）。

### 修复

- 修复`pi -p`将以YAML前置部分开头的提示视为扩展标志而非用户消息的问题（[#4163](https://github.com/badlogic/pi-mono/issues/4163)）。
- 修复在运行工具时切换思考块可见性后，待定工具结果未在实时TUI中更新的问题（[#4167](https://github.com/badlogic/pi-mono/issues/4167)）。
- 修复`/copy`在Linux上报告成功但仅在Wayland仅复合器（Hyprland、Niri等）下未写入剪贴板的问题，通过在Linux上跳过仅X11原生插件并路由至`wl-copy`/`xclip`/`xsel`（[#4177](https://github.com/badlogic/pi-mono/issues/4177)）。
- 修复HTML会话导出时从渲染的用户消息中剥离技能包装器XML的问题（[#4234](https://github.com/earendil-works/pi-mono/pull/4234)，由[@aliou](https://github.com/aliou)提交）。
- 修复与OpenAI兼容的聊天完成流，该流在同一选择中交错插入内容和工具调用增量。
- 修复了在TUI活动时直接向stderr写入的OpenAI Codex OAuth刷新失败问题（[#4141](https://github.com/badlogic/pi-mono/issues/4141)）。
- 修复了OpenAI Codex响应请求发送非空系统提示的问题（[#4184](https://github.com/earendil-works/pi-mono/issues/4184)）。
- 修复了Kimi For Coding模型解析的Kimi K2 P6别名问题（[#4218](https://github.com/earendil-works/pi-mono/issues/4218)）。
- 修复了Kitty内联图像重绘，使其保持在TUI拥有的终端区域内，避免写入活动视口下方。
- 修复了Kitty内联图像渲染，允许终端分配图像ID并将解析后的图像ID绑定到有效值。
- 修复了内联图像能力检测，以禁用cmux终端中的内联图像。

## [0.73.0] - 2026-05-04

### 新功能

- **小米MiMo API计费和区域Token计划提供商** - `xiaomi`现在使用API计费，带有独立的`xiaomi-token-plan-{cn,ams,sgp}`提供商。请参阅[docs/providers.md#api-keys](docs/providers.md#api-keys)和[README.md#providers--models](README.md#providers--models)。([#4112](https://github.com/badlogic/pi-mono/pull/4112)由[@Phoen1xCode](https://github.com/Phoen1xCode)提交)
- **增量bash输出流** - Bash工具输出现在在命令运行时出现，而不是仅在完成后出现。([#4145](https://github.com/badlogic/pi-mono/issues/4145))
- **紧凑型读取渲染** - Pi文档、上下文文件和技能的交互式`read`输出默认折叠，并显示选定的行范围。

### 重大变更

- 将内置`xiaomi`提供商从Token计划AMS切换到小米的API计费端点，并将`/login`显示名称从“Xiaomi MiMo Token Plan”更改为“Xiaomi MiMo”。`XIAOMI_API_KEY`现在指向[platform.xiaomimimo.com](https://platform.xiaomimimo.com)的API计费密钥。使用Token计划的用户应切换到适当的`xiaomi-token-plan-*`提供商，并设置相应的环境变量（[#4112](https://github.com/badlogic/pi-mono/pull/4112)由[@Phoen1xCode](https://github.com/Phoen1xCode)提交）。

### 新增

- 新增了三个在`/login`中可见的小米MiMo Token计划区域提供商：`xiaomi-token-plan-cn`（`XIAOMI_TOKEN_PLAN_CN_API_KEY`）、`xiaomi-token-plan-ams`（`XIAOMI_TOKEN_PLAN_AMS_API_KEY`）、`xiaomi-token-plan-sgp`（`XIAOMI_TOKEN_PLAN_SGP_API_KEY`）。每个默认为`mimo-v2.5-pro`（[#4112](https://github.com/badlogic/pi-mono/pull/4112)由[@Phoen1xCode](https://github.com/Phoen1xCode)提交）。
### 变更

- 变更 `read`工具渲染默认折叠Pi文档、AGENTS/CLAUDE上下文文件以及`SKILL.md`内容，以简化交互输出。

### 修复

- 修复了Qwen 3.5/3.6和MiniMax M2.7模型的生成式OpenAI兼容元数据，使这些模型能够通过内置的提供商目录正常使用（[#4110](https://github.com/badlogic/pi-mono/pull/4110) 由 [@jsynowiec](https://github.com/jsynowiec) 提交）。
- 修复了Bedrock Claude Opus 4.7 `xhigh`思考请求，保持提供商原生的努力值。
- 修复了OpenAI Codex WebSocket传输，在流式处理开始前，当设置失败时回退到SSE，并在助手消息中显示传输诊断（[#4133](https://github.com/badlogic/pi-mono/issues/4133)）。
- 修复了OpenAI Codex WebSocket传输在响应后保持`--print`和JSON模式进程活跃的问题，通过在会话关闭时关闭缓存的WebSocket会话来解决（[#4103](https://github.com/badlogic/pi-mono/issues/4103)）。
- 修复了紧凑`read`工具调用的渲染，使其能够直接渲染并包含选定的行范围，以简化交互输出。
- 修复了交互式会话，在终端输入丢失时退出，而不是继续处于损坏状态。
- 修复了bash工具输出，在命令运行时增量流式输出，而不是等待命令完成（[#4145](https://github.com/badlogic/pi-mono/issues/4145)）。
- 修复了选择器和自动补全的模糊排名，优先匹配精确匹配项。

## [0.72.1] - 2026-05-02

## [0.72.0] - 2026-05-01

### 新特性

- **小米MiMo Token计划提供商** - 新增兼容Anthropic的提供商，支持`XIAOMI_API_KEY`认证、默认模型（`mimo-v2.5-pro`）和`/login`显示。详见[docs/providers.md](docs/providers.md)。（[#4005](https://github.com/badlogic/pi-mono/pull/4005) 由 [@Phoen1xCode](https://github.com/Phoen1xCode) 提交）。
- **模型思考层级元数据** - 模型现在可以通过`thinkingLevelMap`声明其支持的思考层级，替代旧的`reasoningEffortMap`。详见[docs/models.md#thinking-level-map](docs/models.md#thinking-level-map)和[docs/custom-provider.md](docs/custom-provider.md)。（[#3208](https://github.com/badlogic/pi-mono/issues/3208)）
- **自定义提供商基础URL覆盖** - `pi.registerProvider()`现在会尊重每个模型的`baseUrl`设置。详见[docs/custom-provider.md](docs/custom-provider.md)。([#4063](https://github.com/badlogic/pi-mono/issues/4063))。

- **转义后停止回调** - 代理循环可以在完成一轮对话后通过`shouldStopAfterTurn`优雅退出。详见[`packages/agent/README.md`](https://github.com/badlogic/pi-mono/blob/main/packages/agent/README.md)。

- **自我更新检测修复** - `pi`现在可以正确识别并应用可用更新。([#3942](https://github.com/badlogic/pi-mono/issues/3942), [#3980](https://github.com/badlogic/pi-mono/issues/3980), [#3922](https://github.com/badlogic/pi-mono/issues/3922))。

### 不兼容变更

- Replaced `compat.reasoningEffortMap` in `models.json` and `pi.registerProvider()`模型定义，改用模型级别的`thinkingLevelMap`([#3208](https://github.com/badlogic/pi-mono/issues/3208))。迁移：将旧的映射从`compat.reasoningEffortMap`移动到`thinkingLevelMap`。对提供商特定的思考值使用字符串，`null`用于不应显示且应被跳过的不支持的pi级别。详见`docs/models.md#thinking-level-map`和`docs/custom-provider.md`。

### 新增

- Added Xiaomi MiMo Token Plan提供商支持，包含`XIAOMI_API_KEY`、默认模型解析、`/login`显示支持及提供商文档([#4005](https://github.com/badlogic/pi-mono/pull/4005) by [@Phoen1xCode](https://github.com/Phoen1xCode))。

- Added模型级别的`thinkingLevelMap`支持到`models.json`和`pi.registerProvider()`，允许模型仅暴露其实际支持的思考级别([#3208](https://github.com/badlogic/pi-mono/issues/3208))。

- Added `shouldStopAfterTurn`代理循环回调，用于控制转义后停止，继承自`@mariozechner/pi-agent-core`。详见[`packages/agent/README.md`](https://github.com/badlogic/pi-mono/blob/main/packages/agent/README.md)。

### 修复

- Fixed默认传输设置为使用`auto`，允许OpenAI Codex在可用时使用缓存的WebSocket上下文([#4083](https://github.com/badlogic/pi-mono/issues/4083))。

- Fixed `pi.registerProvider()`以尊重每个模型的`baseUrl`覆盖设置([#4063](https://github.com/badlogic/pi-mono/issues/4063))。

- Fixed自我更新检测，使`pi`能正确识别是否有新版本可用并应用更新([#3942](https://github.com/badlogic/pi-mono/issues/3942), [#3980](https://github.com/badlogic/pi-mono/issues/3980), [#3922](https://github.com/badlogic/pi-mono/issues/3922))。

## [0.71.1] - 2026-05-01

### 新增

- Added `websocket-cached`到OpenAI Codex提供商的传输设置选项（用于ChatGPT订阅认证）。这会保持会话的同一WebSocket连接，并在可能的情况下，首次请求后仅发送新的对话项，而不是重新发送完整的聊天历史。

## [0.71.0] - 2026-04-30

### 不兼容变更

- Removed内置的Google Gemini CLI和Google Antigravity支持。现有使用这些提供商的配置必须切换到其他支持的提供商。

### 新功能

- Cloudflare AI Gateway提供商支持，包含`CLOUDFLARE_API_KEY`/`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_GATEWAY_ID`、默认模型解析及`/login`显示。详见[docs/providers.md#cloudflare-ai-gateway](docs/providers.md#cloudflare-ai-gateway)。([#3856](https://github.com/badlogic/pi-mono/pull/3856) by [@mchenco](https://github.com/mchenco))。

- Moonshot AI提供商支持，包含`MOONSHOT_API_KEY`、默认模型解析及`/login`显示。

- 内置支持Mistral Medium 3.5模型。详见[docs/providers.md#api-keys](docs/providers.md#api-keys)。([#4009](https://github.com/badlogic/pi-mono/pull/4009) by [@technocidal](https://github.com/technocidal))。

- Extension APIs可以替换已定型的`message_end`消息、通过`ctx.ui.getEditorComponent()`包裹自定义编辑器工厂，并观察思考级别变化。详见[docs/extensions.md#message_start--message_update--message_end](docs/extensions.md#message_start--message_update--message_end)，[docs/extensions.md#widgets-status-and-footer](docs/extensions.md#widgets-status-and-footer)，和[docs/extensions.md#thinking_level_select](docs/extensions.md#thinking_level_select)。

- `PI_CODING_AGENT_SESSION_DIR`配置会从环境变量读取会话存储。详见[docs/usage.md#environment-variables](docs/usage.md#environment-variables)。

### 新增

- Added Cloudflare AI Gateway作为内置提供商，包含`CLOUDFLARE_API_KEY`/`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_GATEWAY_ID`设置、默认模型解析、`/login`显示支持及提供商文档([#3856](https://github.com/badlogic/pi-mono/pull/3856) by [@mchenco](https://github.com/mchenco))。

- Added Moonshot AI作为内置提供商，包含`MOONSHOT_API_KEY`设置、默认模型解析及`/login`显示支持。
- 增加了通过`@mariozechner/pi-ai`内置支持Mistral Medium 3.5模型（[#4009](https://github.com/badlogic/pi-mono/pull/4009)由[@technocidal](https://github.com/technocidal)提交）。

- 在助手消息中增加了路由的OpenAI兼容响应模型元数据，以便像OpenRouter这样的提供商可以暴露实际使用的模型（[#3968](https://github.com/badlogic/pi-mono/pull/3968)由[@purrgrammer](https://github.com/purrgrammer)提交）。

- 将`PI_CODING_AGENT_SESSION_DIR`作为与`--session-dir`等效的环境变量（[#4027](https://github.com/badlogic/pi-mono/issues/4027)）。

- 增加了对`message_end`扩展结果的支持，用于替换最终消息，使扩展能够覆盖助手的使用成本（[#3982](https://github.com/badlogic/pi-mono/issues/3982)）。

- 在`pi.registerProvider()`中增加了对`name`的顶级支持，以便已注册的扩展提供商可以在`/login`中显示友好的名称（[#3956](https://github.com/badlogic/pi-mono/issues/3956)）。

- 增加了`ctx.ui.getEditorComponent()`，使扩展能够包装当前配置的自定义编辑器工厂（[#3935](https://github.com/badlogic/pi-mono/issues/3935)）。

- 增加了一个`thinking_level_select`扩展事件，用于观察思考等级的变化（[#3888](https://github.com/badlogic/pi-mono/issues/3888)）。

### 修复

- 修复了通过直接传递PowerShell保存路径而不是通过自定义环境变量来实现WSL剪贴板图片粘贴的问题（[#2469](https://github.com/badlogic/pi-mono/issues/2469)）。

- 修复了对未签名工具调用的Google Vertex Gemini 3工具调用回放（[#4032](https://github.com/badlogic/pi-mono/issues/4032)）。

- 修复了交互式扩展确认后，被阻止的`edit`工具结果渲染时拒绝原因重复显示的问题（[#3830](https://github.com/badlogic/pi-mono/issues/3830)）。

- 修复了扩展触发的思考等级变化导致交互式编辑器边框立即刷新的问题（[#3888](https://github.com/badlogic/pi-mono/issues/3888)）。

- 修复了编码代理README中的See Also链接，使其指向`@mariozechner/pi-agent-core`（[#4023](https://github.com/badlogic/pi-mono/issues/4023)）。

- 修复了`grep`和`find`工具参数注入中对标志式搜索模式的支持（[#4018](https://github.com/badlogic/pi-mono/issues/4018)）。

- 修复了Windows上PowerShell shell命令输出，仅在Unix上以分离进程方式启动（[#4013](https://github.com/badlogic/pi-mono/pull/4013)由[@picasso250](https://github.com/picasso250)提交）。

- 修复了当`npmCommand`配置为使用Bun时，Bun包管理器`node_modules`的发现（[#3998](https://github.com/badlogic/pi-mono/pull/3998)由[@thirtythreeforty](https://github.com/thirtythreeforty)提交）。
- 修复了编辑和预览访问失败时正确报告文件系统错误的问题（[#3955](https://github.com/badlogic/pi-mono/pull/3955) 由 [@rwachtler](https://github.com/rwachtler) 提交）。
- 修复了`ProcessTerminal`的尺寸设置，优先使用`COLUMNS`和`LINES`，然后再回退到80x24（[#4004](https://github.com/badlogic/pi-mono/issues/4004)）。
- 更新了`@anthropic-ai/sdk`以清除GHSA-p7fg-763f-g4gf审计发现（[#3992](https://github.com/badlogic/pi-mono/issues/3992)）。
- 更新了`@mariozechner/clipboard`为已认证版本，以便带有信任策略的包管理器不会拒绝安装（[#3946](https://github.com/badlogic/pi-mono/issues/3946)）。
- 修复了项目上下文发现，使其能够加载`AGENTS.MD`文件，而不仅仅是`AGENTS.md`（[#3949](https://github.com/badlogic/pi-mono/issues/3949)）。
- 修复了`/handoff`，使其使用压缩后的会话上下文，而不是预压缩的原始消息（[#3945](https://github.com/badlogic/pi-mono/issues/3945)）。
- 修复了DeepSeek V4 Flash对`xhigh`的支持，使请求能够映射到DeepSeek的`max`推理努力（[#3944](https://github.com/badlogic/pi-mono/issues/3944)）。
- 修复了Anthropic流在结束前未达到`message_stop`时被错误地视为成功部分响应的问题（[#3936](https://github.com/badlogic/pi-mono/issues/3936)）。
- 修复了生成的OpenAI兼容DeepSeek V4推理与非直接DeepSeek提供商的兼容性问题（[#3940](https://github.com/badlogic/pi-mono/issues/3940)）。
- 修复了空闲时的后续提交，使其能够像正常消息提交一样清除编辑器（[#3926](https://github.com/badlogic/pi-mono/issues/3926)）。
- 修复了编辑器渲染的泰语Sara Am和Lao AM元音字符的渲染伪影（[#3904](https://github.com/badlogic/pi-mono/issues/3904)）。
- 修复了DeepSeek V4 Flash和V4 Pro的定价元数据，使其与当前官方费率匹配（[#3910](https://github.com/badlogic/pi-mono/issues/3910)）。
- 更新了沙箱扩展示例锁定文件，以解决易受攻击的`lodash-es`的传递性依赖问题（[#3901](https://github.com/badlogic/pi-mono/issues/3901)）。
- 修复了DeepSeek提示缓存命中，使其能够从OpenAI兼容的使用响应中进行跟踪（[#3880](https://github.com/badlogic/pi-mono/issues/3880)）。

### 移除了
- 删除了已停用的Qwen CLI OAuth自定义提供商扩展示例（[#3832](https://github.com/badlogic/pi-mono/pull/3832) 由 [@4h9fbZ](https://github.com/4h9fbZ) 提交）。

- 删除了Google Gemini CLI和Google Antigravity内置登录、默认模型、文档和示例扩展支持。

## [0.70.6] - 2026-04-28

### 新功能

- 支持Cloudflare Workers AI提供商，设置方法为`CLOUDFLARE_API_KEY`/`CLOUDFLARE_ACCOUNT_ID`。详情见[docs/providers.md#api-keys](docs/providers.md#api-keys)。[#3851](https://github.com/badlogic/pi-mono/pull/3851) 由 [@mchenco](https://github.com/mchenco) 提交)

- Pi版本检查现在使用`pi.dev`，并通过`pi/<version>`用户代理识别Pi。详情见[docs/packages.md](docs/packages.md)。[#3877](https://github.com/badlogic/pi-mono/pull/3877) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交)

### 添加

- 添加了内置的Cloudflare Workers AI提供商，设置方法为`CLOUDFLARE_API_KEY`/`CLOUDFLARE_ACCOUNT_ID`，支持默认模型解析、`/login`，并提供提供商文档。[#3851](https://github.com/badlogic/pi-mono/pull/3851) 由 [@mchenco](https://github.com/mchenco) 提交)

### 更改

- 更改Pi版本检查，通过`pi/<version>`用户代理识别Pi。[#3877](https://github.com/badlogic/pi-mono/pull/3877) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交)

### 修复

- 修复了配置选择器滚动指示器，使其显示项目数量而非行数。[#3820](https://github.com/badlogic/pi-mono/pull/3820) 由 [@aliou](https://github.com/aliou) 提交)

- 修复了导出的HTML，对嵌入的图像数据和会话元数据进行转义，防止定制会话内容注入标记。[#3819](https://github.com/badlogic/pi-mono/pull/3819) 由 [@justinpbarnett](https://github.com/justinpbarnett) 提交，[#3883](https://github.com/badlogic/pi-mono/pull/3883) 由 [@justinpbarnett](https://github.com/justinpbarnett) 提交)

- 修复了基于Bun的包管理器启动，通过定位全局`node_modules`相对于Bun安装布局。[#3861](https://github.com/badlogic/pi-mono/pull/3861) 由 [@thirtythreeforty](https://github.com/thirtythreeforty) 提交)

- 修复了Bedrock推理配置文件能力检查，将配置文件ARN规范化为底层模型名称。

- 修复了文件发现，当`fd`不可用时回退到`fdfind`。

- 修复了`pi update`，跳过已安装版本为当前版本时的自我更新重装。[#3853](https://github.com/badlogic/pi-mono/issues/3853)

- 修复了Cloudflare Workers AI的归属标头，尊重安装遥测设置。

- 修复了`pi update --self`在Windows包管理器符号链接全局包根目录下的检测和执行，并在自我更新失败时打印手动回退命令。[#3857](https://github.com/badlogic/pi-mono/issues/3857)

## [0.70.5] - 2026-04-27

### 修复

- 修复了HTML导出，保留ANSI渲染器的尾部填充作为额外的空行。

## [0.70.4] - 2026-04-27

### 修复

- 修复了打包的`pi`启动失败，因为会话选择器导入了仅源路径的实用工具。

## [0.70.3] - 2026-04-27

### 新功能

- `pi update`现在可以更新pi本身以及已安装的pi包。详情见[docs/packages.md](docs/packages.md)。[#3680](https://github.com/badlogic/pi-mono/pull/3680) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交)

- 支持Azure Cognitive Services端点，用于Azure OpenAI Responses部署。详情见[docs/providers.md#api-keys](docs/providers.md#api-keys)。[#3799](https://github.com/badlogic/pi-mono/pull/3799) 由 [@marcbloech](https://github.com/marcbloech) 提交)

- 可通过`warnings.anthropicExtraUsage`在`/settings`中抑制Anthropic额外用量计费警告。详情见[docs/settings.md](docs/settings.md)。[#3808](https://github.com/badlogic/pi-mono/issues/3808)

- 通过`ctx.ui.setWorkingVisible()`控制扩展的工作行可见性，允许扩展隐藏内置加载行并渲染自定义工作状态。详情见[docs/extensions.md](docs/extensions.md) 和 [examples/extensions/border-status-editor.ts](examples/extensions/border-status-editor.ts)。[#3674](https://github.com/badlogic/pi-mono/issues/3674)

### 添加

- 添加了`pi update`，支持更新pi本身以及已安装的pi包。[#3680](https://github.com/badlogic/pi-mono/pull/3680) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交)

- 添加了Azure Cognitive Services端点支持，用于Azure OpenAI Responses基础URL。[#3799](https://github.com/badlogic/pi-mono/pull/3799) 由 [@marcbloech](https://github.com/marcbloech) 提交)

- 添加了`warnings.anthropicExtraUsage`和`/settings`警告子菜单，用于抑制Anthropic额外用量计费警告。[#3808](https://github.com/badlogic/pi-mono/issues/3808)
- 增加了`ctx.ui.setWorkingVisible()`，使扩展可以隐藏内置的交互式工作加载器行，而无需保留布局空间，同时增加了一个边框状态编辑器示例，将工作状态移动到自定义编辑器边框中（[#3674](https://github.com/badlogic/pi-mono/issues/3674)）

### 修复了

- 修复了Kitty键盘协议CSI-u的重复可打印字符以及在意大利等布局上的原始字符输入（[#3780](https://github.com/badlogic/pi-mono/issues/3780)）。
- 修复了API密钥环境发现和Bun启动，当Bun的沙箱使`process.env`变为空时，回退到`/proc/self/environ`（[#3801](https://github.com/badlogic/pi-mono/pull/3801) 由[@mdsjip](https://github.com/mdsjip)提交）。
- 修复了当`process.env`为空时Bun沙箱化包管理命令（[#3807](https://github.com/badlogic/pi-mono/pull/3807) 由[@mdsjip](https://github.com/mdsjip)提交）。
- 修复了符号链接的包、资源、技能和会话在选择器和加载器中被重复（[#3818](https://github.com/badlogic/pi-mono/pull/3818) 由[@aliou](https://github.com/aliou)提交）。
- 修复了Bedrock提示缓存和自适应思维能力检查，用于推理配置ARN（[#3527](https://github.com/badlogic/pi-mono/pull/3527) 由[@anirudhmarc](https://github.com/anirudhmarc)提交）。
- 修复了OpenAI Codex响应的默认详细程度为`low`，当未指定详细程度时。
- 停止向拒绝工具禁用时的`tools`数组发送空数据（[#3650](https://github.com/badlogic/pi-mono/pull/3650) 由[@HQidea](https://github.com/HQidea)提交）。
- 修复了Anthropic SSE解析，忽略未知代理事件，例如OpenAI风格的`done`终止符（[#3708](https://github.com/badlogic/pi-mono/issues/3708)）。
- 修复了仅允许覆盖的`models.json`条目注册提供商，以保留内置模型列表（[#3651](https://github.com/badlogic/pi-mono/issues/3651)）。
- 修复了`/login`，以显示由`models.json`提供商定义提供的身份验证信息。
- 修复了HTML导出时扩展渲染工具输出和可展开输出提示周围的空白。
- 修复了bash执行器临时输出流在输出被行数限制时泄漏文件描述符（[#3786](https://github.com/badlogic/pi-mono/issues/3786)）。
- 修复了扩展`pi.setSessionName()`更新，以立即刷新交互式终端标题（[#3686](https://github.com/badlogic/pi-mono/issues/3686)）。
- 修复了通过`/tree`取消时，`session_before_tree`会话卡在压缩状态的问题（[#3688](https://github.com/badlogic/pi-mono/issues/3688)）
- 修复了扩展隐藏内置工作加载器行时，Escape中断处理的问题（[#3674](https://github.com/badlogic/pi-mono/issues/3674)）
- 修复了编码代理测试期望与当前默认模型及缺少认证指导不匹配的问题。
- 修复了长本地LLM SSE流在5分钟后因`UND_ERR_BODY_TIMEOUT`而中断的问题，通过在全局调度器禁用undici `bodyTimeout`/`headersTimeout`实现；提供程序SDK仍通过`retry.provider.timeoutMs`强制执行其自身的截止时间（[#3715](https://github.com/badlogic/pi-mono/issues/3715)）

## [0.70.2] - 2026-04-24

### 修复了

- 修复了提供程序重试/超时转发，以排除未定义的提供程序请求控制，避免下游SDK验证错误如`timeout must be an integer`，当`retry.provider.timeoutMs`未配置时（[#3627](https://github.com/badlogic/pi-mono/issues/3627)）

## [0.70.1] - 2026-04-24

### 新增功能

- DeepSeek提供程序支持V4 Flash/Pro模型及`DEEPSEEK_API_KEY`认证。详见[README.md#providers--models](README.md#providers--models)和[docs/providers.md#api-keys](docs/providers.md#api-keys)。
- 提供请求超时/重试控制，通过`retry.provider.{timeoutMs,maxRetries,maxRetryDelayMs}`，适用于长时间本地推理和提供程序SDK的重试行为。请参阅[docs/settings.md#retry](docs/settings.md#retry)。([#3627](https://github.com/badlogic/pi-mono/issues/3627))

### 新增

- 新增DeepSeek到内置提供程序设置、默认模型解析和提供程序文档。

### 修复

- 修复`/copy`，避免无界OSC 52写入和剪贴板竞争，防止终端渲染损坏或触发原生剪贴板插件崩溃（[#3639](https://github.com/badlogic/pi-mono/issues/3639)）

- 修复扩展标志文档，显示`pi.getFlag()`使用已注册的标志名称，无需CLI `--`前缀（[#3614](https://github.com/badlogic/pi-mono/issues/3614)）

- 修复提供程序重试/超时设置的连接，通过添加`retry.provider.{timeoutMs,maxRetries,maxRetryDelayMs}`，迁移旧版`retry.maxDelayMs`，并将提供程序控制转发到`streamSimple`请求选项（[#3627](https://github.com/badlogic/pi-mono/issues/3627)）
- 修复Windows git包安装，绕过`cmd.exe`以支持原生git命令，因此安装路径中包含空格不再导致`pi install git:...`与`fatal: Too many arguments`出错（[#3642](https://github.com/badlogic/pi-mono/issues/3642)）
- 修复DeepSeek V4会话回放400错误，通过发送DeepSeek兼容的思维控制和回放助手`reasoning_content`字段（[#3636](https://github.com/badlogic/pi-mono/issues/3636)）
- 修复GPT-5.5生成的上下文窗口元数据，使用观察到的272k限制。
- 修复CSI-u中Ctrl+字母在括号粘贴内的解码，因此粘贴后修改的键转义序列不再成为编辑器的字面文本（[#3623](https://github.com/badlogic/pi-mono/pull/3623) by [@Exrun94](https://github.com/Exrun94)）

## [0.70.0] - 2026-04-23

### 新特性

- 支持模糊搜索/过滤的认证提供商登录流程：`/login`提供商选择器现在支持模糊搜索/过滤，当配置了多个提供商时，查找提供商更快。详见[docs/providers.md](docs/providers.md)（[#3572](https://github.com/badlogic/pi-mono/pull/3572) by [@mitsuhiko](https://github.com/mitsuhiko)）
- GPT-5.5 Codex支持：`openai-codex/gpt-5.5`作为模型选项可用，包括`xhigh`推理支持和修正后的优先级套餐定价。
- 终端进度指示器现在为可选：OSC 9;4进度报告在流式处理/压缩期间默认关闭，可通过`terminal.showTerminalProgress`在`/settings`中切换（[#3588](https://github.com/badlogic/pi-mono/issues/3588)）
- `--no-builtin-tools` / `createAgentSession({ noTools: "builtin" })`现在仅正确禁用内置工具，同时保持扩展工具活跃。详见[docs/extensions.md](docs/extensions.md)和[README.md](README.md)（[#3592](https://github.com/badlogic/pi-mono/issues/3592)）

### 重大变更

- 默认禁用OSC 9;4终端进度指示器。如需重新启用，请将`terminal.showTerminalProgress`设置为`true`，再在`/settings`中配置（[#3588](https://github.com/badlogic/pi-mono/issues/3588)）

### 新增

- 新增支持模糊过滤的认证提供商登录流程（[#3572](https://github.com/badlogic/pi-mono/pull/3572) by [@mitsuhiko](https://github.com/mitsuhiko)）
- 新增GPT-5.5 Codex模型
- 在`/login`中新增认证来源标签，使提供商条目能够显示认证来源为`--api-key`、环境变量或自定义提供商回退，而无需暴露密钥。
### 变更

- 将默认模型选择更新为当前推荐的模型，适用于所有提供商。
- 优化了会话替换或重新加载后过期的扩展上下文错误，提示扩展作者避免使用`pi`/命令`ctx`，改用`withSession`进行替换后的操作。

### 修复

- 修复了`/model`选择器取消操作，改为请求渲染，而非错误地触发登录选择器。
- 调整了登录、OAuth和扩展选择器的样式，使其更加一致。
- 在`/login`中增加了Amazon Bedrock的设置引导，并更新了`/model`的说明，改为提及已配置的提供商，而非仅限API密钥。
- 优化了无模型和缺失认证的警告，引导用户前往`/login`进行OAuth或API密钥的设置。
- 修复了`/quit`的关闭顺序，确保在扩展UI销毁前停止TUI，从而保留最终渲染的帧，同时仍会在进程退出前发出`session_shutdown`。
- 修复了`SettingsManager.inMemory()`在SDK资源加载触发的重新加载后，初始设置丢失的问题（[#3616](https://github.com/badlogic/pi-mono/issues/3616)）。
- 修复了`models.json`提供商兼容性，接受`compat.supportsLongCacheRetention`，允许代理在长保留缓存字段启用时，根据需要选择退出长保留缓存（[#3543](https://github.com/badlogic/pi-mono/issues/3543)）。
- 修复了`--thinking xhigh`在`openai-codex` `gpt-5.5`场景下的降级问题，不再降级为`high`。
- 修复了使用自定义`npmCommand`值（如`pnpm`）的git包安装问题，避免在兼容路径中使用npm特定的生产环境标志（[#3604](https://github.com/badlogic/pi-mono/issues/3604)）。
- 修复了首次用户消息在已有通知（如压缩摘要或状态消息）后无间距渲染的问题（[#3613](https://github.com/badlogic/pi-mono/issues/3613)）。
- 修复了交接扩展示例，在创建新会话后使用替换会话上下文，避免安装生成的提示时出现`ctx`过期错误（[#3606](https://github.com/badlogic/pi-mono/issues/3606)）
- 修复了会话替换和`/quit`清理顺序，使其在`session_shutdown`处理器完成后同步清理主机拥有的扩展UI，但在无效旧扩展上下文之前，防止已废弃的扩展UI渲染到已处置的会话上（[#3597](https://github.com/badlogic/pi-mono/pull/3597) by [@vegarsti](https://github.com/vegarsti)）
- 修复了在`/quit`中扩展注册自定义页脚时出现的崩溃，该页脚的`render()`访问了`ctx`，通过在关闭时先清理扩展提供的UI，再无效扩展运行时来解决（[#3595](https://github.com/badlogic/pi-mono/issues/3595)）
- 修复了自动重试功能，将Bedrock/Smithy HTTP/2传输失败（如`http2 request did not get a response`）视为瞬时错误，因此代理会自动重试，而不是等待手动提示（[#3594](https://github.com/badlogic/pi-mono/issues/3594)）
- 修复了CLI/SDK工具选择拆分，使`--no-builtin-tools`和`createAgentSession({ noTools: "builtin" })`仅禁用内置默认工具，而保持扩展/自定义工具启用，而不是像`--no-tools`那样落入“禁用一切”的路径（[#3592](https://github.com/badlogic/pi-mono/issues/3592)）
- 修复了剩余的硬编码`pi` / `.pi`品牌标识，使其通过`APP_NAME`和`CONFIG_DIR_NAME`扩展点路由，以便SDK重品牌标识在`/quit`描述、`process.title`和项目本地扩展目录中保持命名一致（[#3583](https://github.com/badlogic/pi-mono/pull/3583) 由[@jlaneve](https://github.com/jlaneve)提交）
- 修复了`pi-coding-agent`打包`uuid@11`，该操作触发了`npm audit`中等漏洞报告，导致下游安装；该包现在依赖于`uuid@14`（[#3577](https://github.com/badlogic/pi-mono/issues/3577)）
- 修复了`openai-completions`流式工具调用组装，在OpenAI兼容网关变异工具调用ID时，通过稳定的工具索引合并差异，防止了Kimi K2.6/OpenCode工具流因中间变异而将一个调用拆分为多个虚假工具调用（[#3576](https://github.com/badlogic/pi-mono/issues/3576)）
- 修复`ctx.ui.setWorkingMessage()`以在加载器重建时保持持久化，行为与`ctx.ui.setWorkingIndicator()`一致（[#3566](https://github.com/badlogic/pi-mono/issues/3566)）
- 修复编码代理`fs.watch`的主题和git-footer监视器错误处理，主题和git-footer监视器在短暂监视器失败（如`EMFILE`）后重试，避免在大型仓库中启动崩溃（[#3564](https://github.com/badlogic/pi-mono/issues/3564)）
- 修复内置`kimi-coding`模型生成，以附加预期的`User-Agent`头部，使直接的Kimi编码请求使用提供方预期的客户端身份（[#3586](https://github.com/badlogic/pi-mono/issues/3586)）
- 修复扩展快捷方式冲突诊断，在启动时显示而非仅在刷新时显示，以便扩展作者能立即发现保留键绑定冲突，而不是通过用户反馈在后期才发现（[#3617](https://github.com/badlogic/pi-mono/issues/3617)）
- 修复`models.json`的Anthropic兼容提供方配置，以接受`compat.supportsEagerToolInputStreaming`，允许拒绝按工具区分的`eager_input_streaming`代理使用遗留的细粒度工具流Beta头部（[#3575](https://github.com/badlogic/pi-mono/issues/3575)）
- 修复启动横幅扩展标签，以剥离尾部的`index.js`/`index.ts`后缀（[#3596](https://github.com/badlogic/pi-mono/pull/3596) by [@aliou](https://github.com/aliou)）
- 修复OSC 9;4终端进度更新，在Ghostty等终端中长时间运行代理工作时保持活跃（[#3610](https://github.com/badlogic/pi-mono/issues/3610)）
- 修复OpenAI兼容的完成使用解析，避免对已包含在`completion_tokens`中的推理令牌重复计数（[#3581](https://github.com/badlogic/pi-mono/issues/3581)）
- 修复`openai-responses`的严格OpenAI兼容代理兼容性，允许`models.json`禁用包含下划线的`session_id`头部（使用`compat.sendSessionIdHeader: false`）（[#3579](https://github.com/badlogic/pi-mono/issues/3579)）
- 修复GPT-5.5 Codex能力处理，限制不支持的最小推理为`low`，并应用模型的2.5倍优先级服务层价格倍数（[#3618](https://github.com/badlogic/pi-mono/pull/3618) by [@markusylisiurunen](https://github.com/markusylisiurunen)）

## [0.69.0] - 2026-04-22

### 新功能
- TypeBox 1.x 版本的扩展和 SDK 集成迁移，包括 TypeBox 原生工具参数验证，现在可在 Cloudflare Workers 等 eval 限制运行时中正常工作。详见 [docs/extensions.md](docs/extensions.md) 和 [docs/sdk.md](docs/sdk.md)。
- 通过 `ctx.ui.addAutocompleteProvider(...)` 实现堆叠式扩展自动补全提供程序，允许扩展在内置斜杠和路径补全基础上叠加自定义补全逻辑。详见 [docs/extensions.md#autocomplete-providers](docs/extensions.md#autocomplete-providers) 和 [examples/extensions/github-issue-autocomplete.ts](examples/extensions/github-issue-autocomplete.ts)。
- 通过 `terminate: true` 实现工具结果终止，允许自定义工具在最终调用结束时停止，无需支付自动后续 LLM 轮次费用。详见 [docs/extensions.md](docs/extensions.md) 和 [examples/extensions/structured-output.ts](examples/extensions/structured-output.ts)。
- OSC 9;4终端在代理流和压缩过程中支持终端的进度指示器。

### 不兼容变更

- 已将第一方编码代理代码、SDK/示例/文档以及包元数据从`@sinclair/typebox` 0.34.x迁移到`typebox` 1.x。新扩展、SDK集成和pi包应依赖并导入`typebox`。旧版扩展加载仍别名为根`@sinclair/typebox`包，但`@sinclair/typebox/compiler`不再被模拟。此次迁移还引入了新的`@mariozechner/pi-ai` TypeBox原生验证路径，因此工具参数验证现在可在如Cloudflare Workers等eval受限运行时中正常工作，而非被跳过（[#3112](https://github.com/badlogic/pi-mono/issues/3112)）。
- 会话替换命令现在会在`ctx.newSession()`、`ctx.fork()`和`ctx.switchSession()`之后，使捕获的预替换会话绑定的扩展对象失效。旧的`pi`和命令`ctx`引用现在会抛出异常，而不是静默地针对已替换的会话。迁移：如果代码需要在这些调用之后的替换会话中继续工作，请将`withSession`传递给该方法，并在该方法中执行切换后的操作。实际上，应将切换后的`pi.sendUserMessage()`、`pi.sendMessage()`和命令上下文/会话管理器访问移动到`withSession`中，并仅使用传递给该回调的`ReplacedSessionContext`进行会话绑定操作。潜在风险：`withSession`在旧扩展实例已经收到`session_shutdown`之后运行，旧清理操作可能已经使捕获的状态失效，捕获的旧`pi`/旧命令`ctx`已过时，之前提取的原始对象如`const sm = ctx.sessionManager`仍由调用者负责，且在切换后不得重复使用。
### 新增

- 支持通过`terminate: true`终止工具结果，允许自定义工具在不触发自动后续LLM调用的情况下结束当前工具批次，同时新增`structured-output.ts`扩展示例及扩展文档，展示该模式（[#3525](https://github.com/badlogic/pi-mono/issues/3525)）
- 新增OSC 9;4终端进度指示器，用于代理流式处理和压缩过程中，使iTerm2、WezTerm、Windows Terminal和Kitty等终端在其标签栏显示活动状态
- 新增`ctx.ui.addAutocompleteProvider(...)`，支持在内置斜杠/路径提供程序之上堆叠扩展自动补全提供程序，同时新增`github-issue-autocomplete.ts`示例及扩展文档（[#2983](https://github.com/badlogic/pi-mono/issues/2983)）

### 修复

- 修复导出的会话HTML，对markdown链接URL进行净化处理后再渲染为锚点标签，阻止`javascript:`类payload注入，同时保留共享/导出会话中的安全链接（[#3532](https://github.com/badlogic/pi-mono/issues/3532)）
- 修复`ctx.getSystemPrompt()`在`before_agent_start`中的表现，使其能正确反映由早期`before_agent_start`处理器链式修改的系统提示符变化，并澄清扩展文档中关于提供程序-负载重写及`ctx.getSystemPrompt()`的报告范围（[#3539](https://github.com/badlogic/pi-mono/issues/3539)）
- 修复内置`google-gemini-cli`模型列表和选择器条目，新增`gemini-3.1-flash-lite-preview`，使云代码助手用户无需手动进行`--model`回退选择即可使用该功能（[#3545](https://github.com/badlogic/pi-mono/issues/3545)）
- 修复了扩展会话替换流程，使`ctx.newSession()`、`ctx.fork()`、`ctx.switchSession()`以及导入会话替换在执行post-switch操作之前完全重新绑定，添加了`withSession`替换回调和新鲜的`ReplacedSessionContext`辅助工具，并使过期的预替换`pi`/`ctx`会话绑定访问抛出异常而不是静默地指向错误的会话（[#2860](https://github.com/badlogic/pi-mono/issues/2860)）  
- 修复了`models.json`内置提供程序覆盖，允许其接受`headers`而无需`baseUrl`，因此仅请求头覆盖现在可以正确加载和应用（[#3538](https://github.com/badlogic/pi-mono/issues/3538)）

## [0.68.1] - 2026-04-22

### 新特性

- 支持Fireworks提供程序，内置模型和`FIREWORKS_API_KEY`认证。详见[README.md#providers--models](README.md#providers--models)和[docs/providers.md](docs/providers.md)。  
- 可通过`terminal.imageWidthCells`在`/settings`中配置内联工具图像宽度。详见[docs/settings.md#terminal--images](docs/settings.md#terminal--images)。

### 添加

- 添加了内置Fireworks提供程序支持，包括`FIREWORKS_API_KEY`设置/文档和默认Fireworks模型`accounts/fireworks/models/kimi-k2p6`（[#3519](https://github.com/badlogic/pi-mono/issues/3519)）  
### 修复

- 修复了交互式内联工具图像以尊重通过`/settings`配置的`terminal.imageWidthCells`，因此工具输出图像不再硬性限制为60个终端单元（[#3508](https://github.com/badlogic/pi-mono/issues/3508)）  
- 修复了`settings.json`中的`sessionDir`，使其展开`~`，因此可移植会话目录设置不再需要shell包装器（[#3514](https://github.com/badlogic/pi-mono/issues/3514)）  
- 修复了并行工具调用行，在每个工具最终化时立即将其处于待处理状态，同时仍按助手源顺序追加持久化工具结果（[#3503](https://github.com/badlogic/pi-mono/issues/3503)）  
- 修复了导出会话Markdown，使其在渲染Markdown时以明文方式显示HTML样式消息内容（如`<file name="...">...</file>`），从而使共享会话与TUI保持一致而不是让浏览器解释消息文本（[#3484](https://github.com/badlogic/pi-mono/issues/3484)）  
- 修复了导出会话HTML，使其通过现有TUI渲染器渲染`grep`和`find`输出，并通过原生模板渲染器渲染`ls`输出，避免共享会话中缺失的格式和间距瑕疵（[#3491](https://github.com/badlogic/pi-mono/pull/3491)由[@aliou](https://github.com/aliou)提交）  
- 修复了`@`模糊搜索以跟随符号链接目录并在结果中包含符号链接路径（[#3507](https://github.com/badlogic/pi-mono/issues/3507)）  
- 修复了代理代理流以保留代理安全可序列化的流选项子集，包括session、transport、retry-delay、metadata、header、cache-retention和thinking-budget设置（[#3512](https://github.com/badlogic/pi-mono/issues/3512)）  
- 强化了Anthropic流，通过拥有防御性JSON修复的SSE解析来抵御格式错误的工具调用JSON，并用每工具的`eager_input_streaming`替换了过时的`fine-grained-tool-streaming`beta头，并更新了陈旧的测试模型引用（[#3175](https://github.com/badlogic/pi-mono/issues/3175)）  
- 修复了Bedrock运行时端点解析，停止强制内置区域端点优先于`AWS_REGION`/`AWS_PROFILE`，恢复了`us.*`和`eu.*`推理配置文件支持（v0.68.0之后），同时保留了自定义VPC/代理端点覆盖（[#3481](https://github.com/badlogic/pi-mono/issues/3481)、[#3485](https://github.com/badlogic/pi-mono/issues/3485)、[#3486](https://github.com/badlogic/pi-mono/issues/3486)、[#3487](https://github.com/badlogic/pi-mono/issues/3487)、[#3488](https://github.com/badlogic/pi-mono/issues/3488)）

## [0.68.0] - 2026-04-20

### 新特性

- 通过`ctx.ui.setWorkingIndicator()`为扩展提供可配置的流式工作指示器，包括动画、静态和隐藏指示器。详见[docs/tui.md#working-indicator](docs/tui.md#working-indicator)、[docs/extensions.md](docs/extensions.md)和[examples/extensions/working-indicator.ts](examples/extensions/working-indicator.ts)。  
- `before_agent_start`现在暴露了`systemPromptOptions`（`BuildSystemPromptOptions`），使扩展能够检查结构化系统提示输入，而无需重新发现资源。详见[docs/extensions.md#before_agent_start](docs/extensions.md#before_agent_start)和[examples/extensions/prompt-customizer.ts](examples/extensions/prompt-customizer.ts)。  
- 配置了作用域模型选择器动作和会话树过滤器动作的快捷键。详见[docs/keybindings.md](docs/keybindings.md)。
- `/clone`将当前活动分支复制到新会话，而扩展程序可以选择通过`ctx.fork(..., { position })`分叉`before`或`at`条目。详见[README.md](README.md)、[docs/extensions.md](docs/extensions.md)和[docs/session.md](docs/session.md)。

### 不兼容变更

- 将SDK和CLI工具选择从cwd绑定的内置工具实例更改为工具名称允许列表。`createAgentSession({ tools })`现在期望`string[]`名称如`"read"`和`"bash"`，而不是`Tool[]`，`--tools`现在按名称允许内置、扩展和自定义工具，`--no-tools`现在默认禁用所有工具，而不是仅禁用内置工具。将SDK代码从`tools: [readTool, bashTool]`迁移到`tools: ["read", "bash"]`（[#2835](https://github.com/badlogic/pi-mono/issues/2835)，[#3452](https://github.com/badlogic/pi-mono/issues/3452)）

- 移除了`@mariozechner/pi-coding-agent`中的预构建cwd绑定工具和工具定义导出，包括`readTool`、`bashTool`、`editTool`、`writeTool`、`grepTool`、`findTool`、`lsTool`、`readOnlyTools`、`codingTools`以及相应的`*ToolDefinition`值。改用显式工厂导出，例如`createReadTool(cwd)`、`createBashTool(cwd)`、`createCodingTools(cwd)`和`createReadToolDefinition(cwd)`（[#3452](https://github.com/badlogic/pi-mono/issues/3452)）

- 移除了公共资源辅助函数中的环境`process.cwd()`/默认agent-dir回退行为。`DefaultResourceLoader`、`loadProjectContextFiles()`和`loadSkills()`现在需要显式的cwd/agent-dir风格输入，导出的system-prompt选项类型现在需要显式的`cwd`。显式传递会话或项目cwd，而不是依赖全局默认值（[#3452](https://github.com/badlogic/pi-mono/issues/3452)）

### 新增

- 增加了扩展程序对交互式流工作指示器的自定义支持，通过`ctx.ui.setWorkingIndicator()`，包括自定义动画帧、静态指示器、隐藏指示器、新的`working-indicator.ts`示例扩展以及更新的扩展程序/TUI/RPC文档（[#3413](https://github.com/badlogic/pi-mono/issues/3413)）

- 增加了`systemPromptOptions`（`BuildSystemPromptOptions`）到`before_agent_start`扩展事件，以便扩展程序可以检查用于构建当前系统提示的结构化输入（[#3473](https://github.com/badlogic/pi-mono/pull/3473)由[@dljsjr](https://github.com/dljsjr)）

- 增加了`/clone`以复制当前活动分支到新会话，同时保持`/fork`聚焦于从先前用户消息分叉（[#2962](https://github.com/badlogic/pi-mono/issues/2962)）

- 增加了`ctx.fork()`对`position: "before" | "at"`的支持，以便扩展程序和集成可以在用户消息之前分叉或复制当前对话点；交互式克隆/分叉用户体验建立在此运行时支持的基础上（[#3431](https://github.com/badlogic/pi-mono/pull/3431)由[@mitsuhiko](https://github.com/mitsuhiko)）

- 增加了可配置的快捷键ID用于作用域模型选择器操作和树过滤操作，以便这些交互式快捷键可以在`keybindings.json`中重新映射（[#3343](https://github.com/badlogic/pi-mono/pull/3343)由[@mpazik](https://github.com/mpazik)）

- 增加了`PI_OAUTH_CALLBACK_HOST`对内置OAuth登录流程的支持，允许`pi auth`使用的本地回调服务器绑定到自定义接口，而不是硬编码的`127.0.0.1`（[#3409](https://github.com/badlogic/pi-mono/pull/3409)由[@Michaelliv](https://github.com/Michaelliv)）

- 增加了`reason`和`targetSessionFile`元数据到`session_shutdown`扩展事件，以便扩展程序可以区分退出、重载、新会话、恢复和分叉清理路径（[#2863](https://github.com/badlogic/pi-mono/issues/2863)）

### 变更

- 将`pi update`更改为按作用域批量更新npm包，并以受限制的并行度运行git包更新，减少多包更新时间的同时保留已锁定和当前包的跳过行为（[#2980](https://github.com/badlogic/pi-mono/issues/2980)）

- 将Bedrock会话请求在模型令牌限制未知时省略`maxTokens`，在未设置时省略`temperature`，让Bedrock使用提供者默认值并避免不必要的TPM配额预留（[#3400](https://github.com/badlogic/pi-mono/pull/3400)由[@wirjo](https://github.com/wirjo)）

### 修复

- 修复了`AgentSession`系统提示选项初始化，避免构造无效的空`BuildSystemPromptOptions`，因此`npm run check`在`cwd`成为强制性后通过。
-  修复 shell 路径解析，停止在 bash 执行期间查询环境 `process.cwd()` 状态，因此会话/项目特定的 `shellPath` 设置现在会跟随当前编码代理会话的当前工作目录，而不是启动器的当前工作目录（[#3452](https://github.com/badlogic/pi-mono/issues/3452)）
-  修复 `ctx.ui.setWorkingIndicator()` 自定义框架以原样渲染，而不是强制使用主题强调色，因此扩展程序现在可以拥有自定义时的工作指示器颜色（[#3467](https://github.com/badlogic/pi-mono/issues/3467)）
-  修复 `pi update` 重新安装已达到最新发布版本的 npm 包，通过在运行 `npm install <pkg>@latest` 之前检查已安装包版本实现（[#3000](https://github.com/badlogic/pi-mono/issues/3000)）
-  修复 `@` 普通查询的自动补全，停止将其与完整的当前工作目录/基础路径进行匹配，因此工作目录名称中的路径片段不再挤占诸如 `@plan` 的预期结果（[#2778](https://github.com/badlogic/pi-mono/issues/2778)）
-  修复内置工具包装，使其使用与扩展工具相同的扩展运行器上下文路径，因此内置工具会接收执行上下文，并且 `read` 可以在当前模型不支持图像时发出警告（[#3429](https://github.com/badlogic/pi-mono/issues/3429)）
- 修复了`openai-completions`助手回放，以保留`compat.requiresThinkingAsText`文本部分序列化，避免在之前的助手消息中混用思考和文本时，相同模型后续出现崩溃的情况（[#3387](https://github.com/badlogic/pi-mono/issues/3387)）
- 修复了直接OpenAI聊天补全会话，将`sessionId`和`cacheRetention`映射到提示缓存字段，启用缓存时发送`prompt_cache_key`，直接`api.openai.com`请求时发送`prompt_cache_retention: "24h"`，并具有较长的保留时间（[#3426](https://github.com/badlogic/pi-mono/issues/3426)）
- 修复了OpenAI兼容的聊天补全会话，可选地通过`compat.sendSessionAffinityHeaders`从`sessionId`发送对齐的`session_id`、`x-client-request-id`和`x-session-affinity`头部，从而改进了对后端（如Fireworks）的缓存亲和路由（[#3430](https://github.com/badlogic/pi-mono/issues/3430)）
- 修复了线程`/resume`会话关系和当前会话检测，以规范化符号链接会话路径在选择器比较中的处理方式，因此共享会话目录不再破坏父子匹配或活动会话删除保护（[#3364](https://github.com/badlogic/pi-mono/issues/3364)）
- 修复了`/session`、会话文档和CLI帮助，使其始终记录会话重用支持文件路径和会话ID，并且`/session`显示了当前会话ID（[#3390](https://github.com/badlogic/pi-mono/issues/3390)）
- 修复了Windows pnpm全局安装检测，使其能够识别`\\.pnpm\\`存储路径，因此更新通知现在建议使用`pnpm install -g @mariozechner/pi-coding-agent`，而不是回退到npm（[#3378](https://github.com/badlogic/pi-mono/issues/3378)）
- 修复了`@sinclair/typebox`运行时依赖项在`@mariozechner/pi-coding-agent`中的缺失，因此严格的pnpm安装在启动`pi`时不再因`ERR_MODULE_NOT_FOUND`而失败（[#3434](https://github.com/badlogic/pi-mono/issues/3434)）
- 修复了xterm大写输入，在交互式编辑器中通过解码可打印的`modifyOtherKeys`输入并规范化移位字母匹配，因此`Shift+letter`不再在`pi`中消失（[#3436](https://github.com/badlogic/pi-mono/issues/3436)）
- 修复了`/compact`，使其重用会话思考级别用于压缩摘要，而不是强制要求`high`，避免了在配置了`medium`思考的`github-copilot/claude-opus-4.7`会话上出现无效推理错误（[#3438](https://github.com/badlogic/pi-mono/issues/3438)）
- 修复了共享/导出的纯文本工具输出，使其保留缩进，而不是在网页分享页面中折叠前导空白（[#3440](https://github.com/badlogic/pi-mono/issues/3440)）
- 修复了导出的分享页面，使其使用浏览器安全的`T`和`O`快捷键，并带有可点击的头部切换，用于显示思考和工具可见性，而不是使用浏览器保留的`Ctrl+T`/`Ctrl+O`绑定（[#3374](https://github.com/badlogic/pi-mono/pull/3374)由[@vekexasia](https://github.com/vekexasia)提交）
- 修复了技能解析，使其通过规范路径去重符号链接别名，因此`pi config`不再显示重复的技能条目，当`~/.pi/agent/skills`指向`~/.agents/skills`时（[#3417](https://github.com/badlogic/pi-mono/pull/3417)由[@rwachtler](https://github.com/rwachtler)提交）
- 修复了OpenRouter请求归属，使其在通过编码代理SDK创建会话且安装遥测功能已启用时，包含Pi应用头部（`HTTP-Referer: https://pi.dev`、`X-OpenRouter-Title: pi`、`X-OpenRouter-Categories: cli-agent`）（[#3414](https://github.com/badlogic/pi-mono/issues/3414)）
- 修复了自定义模型`compat`的schema/docs，以支持通过`cache_control`标记暴露Anthropic风格提示缓存的OpenAI兼容提供商的`cacheControlFormat: "anthropic"`（[#3392](https://github.com/badlogic/pi-mono/issues/3392)）  
- 修复了云代码助手工具schema，移除JSON模式元声明键以避免在使用`$schema`、`$defs`及相关元数据的工具会话中出现验证失败（[#3412](https://github.com/badlogic/pi-mono/pull/3412) by [@vladlearns](https://github.com/vladlearns)）  
- 修复了直接Bedrock会话，使其尊重`model.baseUrl`作为运行时客户端端点，恢复对自定义Bedrock VPC或代理路由的支持（[#3402](https://github.com/badlogic/pi-mono/pull/3402) by [@wirjo](https://github.com/wirjo)）  
- 修复了`edit`工具，强制将`edits` JSON字符串化后再验证，使发送数组负载作为JSON字符串的模型不再回退到临时shell编辑（[#3370](https://github.com/badlogic/pi-mono/pull/3370) by [@dannote](https://github.com/dannote)）  
- 修复了包清单正向通配符，在加载打包资源前展开，恢复`skills/**/*.md`等清单模式（[#3350](https://github.com/badlogic/pi-mono/pull/3350) by [@neonspectra](https://github.com/neonspectra)）  

## [0.67.68] - 2026-04-17  

## [0.67.67] - 2026-04-17  

### 新特性  

- Bedrock会话现在可通过`AWS_BEARER_TOKEN_BEDROCK`进行身份验证，无需本地SigV4凭证即可访问Converse API。详见[docs/providers.md#amazon-bedrock](docs/providers.md#amazon-bedrock)。  

### 新增  

- 新增Bedrock承载令牌身份验证支持（`AWS_BEARER_TOKEN_BEDROCK`），使编码代理会话可在没有本地SigV4凭证的情况下使用Bedrock Converse（[#3125](https://github.com/badlogic/pi-mono/pull/3125) by [@wirjo](https://github.com/wirjo)）  

### 修复  

- 修复了`/scoped-models` Alt+Up/Down在隐式`all enabled`状态下应保持无操作，而非生成完整显式启用模型列表并标记选择器脏（[#3331](https://github.com/badlogic/pi-mono/issues/3331)）  
- 修复了Mistral Small 4默认思维请求，使其使用模型支持的推理控制，避免在`mistral-small-2603`和`mistral-small-latest`上启动会话时出现`400`错误（[#3338](https://github.com/badlogic/pi-mono/issues/3338)）  
- 修复了Qwen聊天模板思维回放，保持多轮工具调用参数而非降级为空`{}`负载（[#3325](https://github.com/badlogic/pi-mono/issues/3325)）  
- 修复了导出的HTML转录文本，使其不再触发基于点击的展开/折叠切换（[#3332](https://github.com/badlogic/pi-mono/pull/3332) by [@xu0o0](https://github.com/xu0o0)）  
- 修复了git包更新通知的不稳定情况，等待捕获的git命令stdio完全排空后再比较本地和远程提交SHA（[#3027](https://github.com/badlogic/pi-mono/issues/3027)）  
- 修复了系统提示日期，使用稳定的`YYYY-MM-DD`格式而非本地依赖输出，保持提示在不同运行时和语言环境下的确定性（[#2814](https://github.com/badlogic/pi-mono/issues/2814)）  
- 修复了自动重试瞬时错误检测，将`Network connection lost.`视为可重试项，使断开的提供商连接重试而非终止代理（[#3317](https://github.com/badlogic/pi-mono/issues/3317)）  
- 修复了紧凑型交互式扩展启动摘要，通过使用包感知标签和最少父路径使本地`index.ts`条目唯一，以区分包扩展和重复本地条目（[#3308](https://github.com/badlogic/pi-mono/issues/3308)）  
- 修复了git包依赖安装，安装和更新流程均使用生产环境安装（`npm install --omit=dev`），确保扩展运行时依赖必须来自`dependencies`而非`devDependencies`（[#3009](https://github.com/badlogic/pi-mono/issues/3009)）  
- 修复了`tool_result` / `afterToolCall`扩展处理错误结果，通过`AgentSession`转发`details`和`isError`覆盖项，而非在`isError`已为真时丢弃（[#3051](https://github.com/badlogic/pi-mono/issues/3051)）  
- 修复了`RpcClient`和`@mariozechner/pi-coding-agent`的根导出，使ESM消费者可从主包入口导入这些协议类型（[#3275](https://github.com/badlogic/pi-mono/issues/3275)）
- 修复了OpenAI Codex服务层级成本核算，当API响应回显默认层级时，系统将信任用户明确请求的层级，确保会话成本显示与所选层级保持一致（[#3307](https://github.com/badlogic/pi-mono/pull/3307) 由 [@markusylisiurunen](https://github.com/markusylisiurunen) 提交）
- 修复了并行工具调用的最终化处理，将`afterToolCall`钩子抛出的异常转换为错误工具结果，而非中止剩余的工具批次（[#3084](https://github.com/badlogic/pi-mono/issues/3084)）
- 修复了Bun二进制资产路径解析，使其尊重`PI_PACKAGE_DIR`，用于内置主题、HTML导出模板和交互式打包资产（[#3074](https://github.com/badlogic/pi-mono/issues/3074)）
- 修复了交互模式中用户消息轮询的间距，通过在用户消息轮询前恢复消息间隔（除首个用户消息外），防止助手和用户区块渲染时紧贴在一起。
- 修复了交互式`/import`处理，支持带空格的引号JSONL路径，将缺失的JSONL文件路由至非致命的`SessionImportFileNotFoundError`路径，并文档化了`importFromJsonl()`异常（`SessionImportFileNotFoundError`，`MissingSessionCwdError`）。

## [0.67.6] - 2026-04-16

### 新特性

- 提示模板支持一个`argument-hint`前置字段，该字段在`/`自动补全下拉菜单中的描述前渲染，使用`<angle>`表示必填项和`[square]`表示可选项。详见[docs/prompt-templates.md#argument-hints](docs/prompt-templates.md#argument-hints)。
- 新增`after_provider_response`扩展钩子，允许扩展在每次接收响应后立即检查提供方HTTP状态码和头部，再开始流式消费前。详见[docs/extensions.md](docs/extensions.md)。
- 交互式启动头部已精简，以逗号分隔加载的AGENTS.md文件、提示模板、技能和扩展的视图。按`Ctrl+O`可切换展开列表。
- 助手输出中的Markdown链接现在在支持的终端上渲染为OSC 8超链接；未知终端和tmux/screen默认为纯文本，确保URL永不被静默丢弃。

### 新增

- 为提示模板新增`argument-hint`前置字段，显示在自动补全下拉菜单的描述前（[#2780](https://github.com/badlogic/pi-mono/pull/2780) 由 [@andresvi94](https://github.com/andresvi94) 提交）
- 新增`after_provider_response`扩展钩子，允许扩展在每次接收提供方响应后检查HTTP状态码和头部，再开始流式消费前（[#3128](https://github.com/badlogic/pi-mono/issues/3128)）
- 新增了Markdown链接在终端支持时的OSC 8超链接渲染（[#3248](https://github.com/badlogic/pi-mono/pull/3248) 由 [@ofa1](https://github.com/ofa1) 提交）

### 更改

- 交互式启动头部已改为紧凑的逗号分隔视图，显示加载的AGENTS.md文件、提示模板、技能和扩展，按`Ctrl+O`切换展开列表（[#3267](https://github.com/badlogic/pi-mono/pull/3267)）
- 收紧了超链接能力检测，默认`hyperlinks: false`用于未知终端，并在tmux/screen（包括嵌套会话）下强制关闭，防止Markdown链接URL在静默吞没OSC 8序列的终端上消失（[#3248](https://github.com/badlogic/pi-mono/pull/3248)）

### 修复

- 修复了交互式用户消息渲染，保持终端受OSC 133提示标记影响时底部填充可见，且不额外增加空行在后续助手消息前（[#3090](https://github.com/badlogic/pi-mono/issues/3090)）
- 修复了`--verbose`启动输出，在紧凑启动头部变更后，先显示扩展启动帮助和加载资源列表（[#3147](https://github.com/badlogic/pi-mono/issues/3147)）
- 修复了`find`工具在基于路径的glob模式（如`src/**/*.spec.ts`或`some/parent/child/**`）下无结果返回的问题，通过将fd切换为全路径模式并规范化模式（含`/`）实现（[#3302](https://github.com/badlogic/pi-mono/issues/3302)）
- 修复了`find`工具跨同级目录应用嵌套`.gitignore`规则（例如`a/.gitignore`规则隐藏`b/`下的匹配文件）的问题，移除手动`--ignore-file`收集，转而通过`.gitignore`的分层处理和`--no-require-git`实现（[#3303](https://github.com/badlogic/pi-mono/issues/3303)）
- 修复了非`api.openai.com`基础URL（如OpenAI兼容代理litellm、theclawbay）的OpenAI响应提示缓存，通过在提供`sessionId`时无条件发送`session_id`和`x-client-request-id`缓存亲和力头部，使其行为与官方Codex CLI一致（[#3264](https://github.com/badlogic/pi-mono/pull/3264) by [@vegarsti](https://github.com/vegarsti)）
- 修复了`preset`示例扩展，在首次预设应用时快照激活模型、思考等级和工具集，并在回退到`(none)`时恢复该状态，而非回退到硬编码默认工具列表（[#3272](https://github.com/badlogic/pi-mono/pull/3272) by [@stembi](https://github.com/stembi)）

## [0.67.5] - 2026-04-16

### 修复

- 修复了Anthropic和Bedrock提供商的Opus 4.7自适应思考配置，通过识别Opus 4.7自适应思考支持并映射`xhigh`推理到提供商支持的努力值（[#3286](https://github.com/badlogic/pi-mono/pull/3286) by [@markusylisiurunen](https://github.com/markusylisiurunen)）
- 修复了Zellij的`Shift+Enter`回归，回滚了Zellij特有的Kitty键盘查询绕过，恢复了之前的键盘协商行为（[#3259](https://github.com/badlogic/pi-mono/issues/3259)）

## [0.67.4] - 2026-04-16

### 新功能

- `--no-context-files`（`-nc`）禁用了自动`AGENTS.md`/`CLAUDE.md`发现，当你需要干净运行且不注入项目上下文时可用。详见[README.md#context-files](README.md#context-files)。
- `loadProjectContextFiles()`现作为独立实用工具导出，供扩展和SDK风格集成使用，用于检查CLI相同的上下文文件解析顺序。详见[README.md#context-files](README.md#context-files)。
- 新增`after_provider_response`扩展钩子，允许扩展在响应创建后立即检查提供商HTTP状态码和头部，再进行流消费。详见[docs/extensions.md](docs/extensions.md)。

### 新增

- 新增`--no-context-files`（`-nc`）以禁用`AGENTS.md`和`CLAUDE.md`上下文文件发现和加载（[#3253](https://github.com/badlogic/pi-mono/issues/3253)）
- 导出 `loadProjectContextFiles()` 作为独立实用工具，以便扩展可以发现项目上下文文件，而无需实例化完整的 `DefaultResourceLoader` ([#3142](https://github.com/badlogic/pi-mono/issues/3142))
- 增加了 `after_provider_response` 扩展钩子，以便扩展可以检查提供程序的 HTTP 状态码和头部，每个提供程序响应接收后、流消费开始前进行检查 ([#3128](https://github.com/badlogic/pi-mono/issues/3128))

### 更改了

- 增加了 `claude-opus-4-7` 模型，用于 Anthropic。
- 更改了 Anthropic 的提示缓存，使其在最后一个工具定义处添加 `cache_control` 断点，以便工具模式可以独立于转录更新进行缓存，同时保持现有缓存保留行为 ([#3260](https://github.com/badlogic/pi-mono/issues/3260))

### 修复了

- 修复了交互式渲染和 HTML 导出中 markdown 删除线解析的问题，要求严格的双波浪号分隔符（`~~text~~`）且非空白边界。
- 修复了关闭处理，以在退出信号时终止跟踪的分离 `bash` 工具子进程，防止产生孤儿后台进程。
-  修复了通过等待异步预览和预检错误渲染来代替依赖固定渲染帧的 `edit-tool-no-full-redraw` TUI 测试。
-  修复了 `kimi-coding` 默认模型选择使用 `kimi-for-coding` 而不是 `kimi-k2-thinking` ([#3242](https://github.com/badlogic/pi-mono/issues/3242))
-  修复了 `ctrl+z` 在原生 Windows 上避免交互模式崩溃，禁用默认的挂起绑定，并在手动调用挂起时显示状态信息 ([#3191](https://github.com/badlogic/pi-mono/issues/3191))
- 修复`find`工具取消和广度搜索响应性，使`.gitignore`发现和`fd`执行完全中止感知且非阻塞（[#3148](https://github.com/badlogic/pi-mono/issues/3148)）
- 修复`grep`广度搜索卡顿时，通过格式化匹配行实现`context=0` 从 ripgrep JSON 输出中获取数据，而不是进行同步的逐匹配文件读取（[#3205](https://github.com/badlogic/pi-mono/issues/3205)）
## [0.67.3] - 2026-04-15

### 新功能
- `renderShell: "self"` 用于自定义和内置工具渲染器，使工具可以拥有自己的外壳，而不是默认的带边框外壳。对于稳定的大型预览（如编辑差异预览）非常有用。详见 [docs/extensions.md#custom-rendering](docs/extensions.md#custom-rendering)。
-  交互式自动重试状态现在在回退期间会显示实时倒计时，而不是静态的重试延迟消息。

###  增加了

-  增加了 `renderShell: "self"` 用于自定义和内置工具渲染器，使工具可以拥有自己的外壳，而不是使用默认的带边框外壳。这对于稳定的大型预览（如编辑差异）非常有用 ([#3134](https://github.com/badlogic/pi-mono/issues/3134))

###  修复了

-  修复了编辑差异预览在编辑权限对话框和会话回放期间保持可见，而没有重新引入大型结果重绘闪烁的问题 ([#3134](https://github.com/badlogic/pi-mono/issues/3134))
-  修复了 `/reload` 以渲染静态的重新加载状态框，而不是动画加载图标，避免了交互式重载期间的重绘不稳定。
-  修复了 `plan-mode` 示例扩展，允许 `eza` 进入只读 Bash 允许列表，而不是已弃用的 `exa` 命令 ([#3240](https://github.com/badlogic/pi-mono/pull/3240) 由 [@rwachtler](https://github.com/rwachtler) 提交)
-  修复了 `google-vertex` API 密钥解析，将 `gcp-vertex-credentials` 视为应用默认凭证标记，而不是字面 API 密钥，以便基于标记的设置正确回退到 ADC ([#3221](https://github.com/badlogic/pi-mono/pull/3221) 由 [@deepkilo](https://github.com/deepkilo) 提交)
-  修复了 RPC `prompt` 在发出其唯一权威响应之前，等待提示预检成功，同时仍然将已处理和排队的提示视为成功 ([#3049](https://github.com/badlogic/pi-mono/issues/3049))
-  修复了 `/scoped-models` 重新排序，使其传播到 `/model` 作用域标签页，保持用户定义的作用域模型顺序，而不是重新排序它 ([#3217](https://github.com/badlogic/pi-mono/issues/3217))
-  修复了 `session_shutdown` 在交互式、打印和 RPC 模式下触发 `SIGHUP` 和 `SIGTERM`，以便扩展可以在这些信号驱动的退出时运行关闭清理操作 ([#3212](https://github.com/badlogic/pi-mono/issues/3212))
-  修复了截图路径解析，以处理 macOS 截图文件名中的小写 am/pm ([#3194](https://github.com/badlogic/pi-mono/pull/3194) 由 [@jay-aye-see-kay](https://github.com/jay-aye-see-kay) 提交)
- 修复了交互式自动重试状态更新，在回退期间显示实时倒计时，而不是静态的重试延迟消息（[#3187](https://github.com/badlogic/pi-mono/issues/3187)）

## [0.67.2] - 2026-04-14

### 新功能

- 支持多个`--append-system-prompt`标志，每个值用双换行符分隔追加到系统提示符中。详见[README.md#other-options](README.md#other-options)。
- 支持将内联扩展工厂传递给`main()`，用于嵌入式集成和自定义入口点。
- 支持Kitty `super`修改后的快捷键交互式键绑定，例如`super+k`、`super+enter`和`ctrl+super+k`。详见[docs/keybindings.md](docs/keybindings.md)。

### 新增

- 新增支持多个`--append-system-prompt`标志，每个值用双换行符分隔追加到系统提示符中（[#3171](https://github.com/badlogic/pi-mono/pull/3171)由[@aliou](https://github.com/aliou)提交）
- 新增Kitty `super`修改后的快捷键交互式键绑定支持，例如`super+k`、`super+enter`和`ctrl+super+k`（[#3111](https://github.com/badlogic/pi-mono/pull/3111)由[@sudosubin](https://github.com/sudosubin)提交）
- 新增将内联扩展工厂传递给`main()`，用于嵌入式集成和自定义入口点（[#3099](https://github.com/badlogic/pi-mono/pull/3099)由[@pmateusz](https://github.com/pmateusz)提交）

### 修复

- 修复了直接OpenAI响应和Codex SSE请求，使其与`prompt_cache_key`、`session_id`和`x-client-request-id`的值使用相同的会话派生标识符，从而提高仅追加式会话的提示缓存亲和力（[#3018](https://github.com/badlogic/pi-mono/pull/3018)由[@steipete](https://github.com/steipete)提交）
- 修复了仅流式`partialJson`临时缓冲区泄露到持久化OpenAI响应工具调用中，可能导致恢复对话时后续负载损坏的问题。
- 修复了tmux中Ctrl+Alt字母键匹配问题，通过从旧版ESC前缀处理回退到CSI-u和xterm `modifyOtherKeys`解析，当旧版形式不匹配时（[#2989](https://github.com/badlogic/pi-mono/pull/2989)由[@kaofelix](https://github.com/kaofelix)提交）
- 修复了已发货的`subagent`示例，以避免将Bun虚拟文件系统脚本路径泄露到子代理提示中（[#3002](https://github.com/badlogic/pi-mono/pull/3002) by [@nathyong](https://github.com/nathyong)）
- 修复了边框加载器，在被处置时停止其动画定时器，防止卸载后出现过时的加载器更新。

## [0.67.1] - 2026-04-13

### 遥测

交互模式现在会在写入`lastChangelogVersion`到`settings.json`后，向`https://pi.dev/install?version=x.y.z`发送一次轻量级的匿名安装/更新遥测心跳。

为什么需要这个功能：
- Pi需要一个可靠的每版本使用信号，以了解发布版本是否被采用，并帮助证明继续开发的资金合理性。
- npm下载统计并不是实际Pi使用情况的可靠代理。

它是如何工作的：
- 它仅在交互模式下运行。
- 它不会在RPC模式、打印模式、JSON模式或SDK模式下运行。
- 在全新的交互式安装中，Pi写入`lastChangelogVersion`，然后发送心跳。
- 在后续的交互式启动中，如果本地变更日志中包含比之前存储的`lastChangelogVersion`更新的日志条目，Pi会写入新的`lastChangelogVersion`，然后发送心跳。
- 该请求是“发送后忘记”类型。启动时不等待响应，任何错误都会被忽略。

收集了哪些数据：
- 仅收集请求路径中的Pi版本，例如`https://pi.dev/install?version=0.67.1`。
- 服务器仅存储每版本的聚合计数器，如`{ "0.67.1": 3 }`。
- 它不会存储IP地址、客户端标识符、提示、路径、模型、认证状态或任何其他与用户相关的数据。它仅仅为该版本递增一个计数器。

如何禁用它：
- `/settings` → disable `Install telemetry`
- `settings.json` → set `enableInstallTelemetry` to `false`
- `PI_OFFLINE=1`
- `PI_TELEMETRY=0`

### 新功能

- 在`models.json`中完全支持`openRouterRouting`，包括回退、参数要求、数据收集、ZDR、忽略列表、量化、提供者排序、最大价格以及首选吞吐量和延迟约束。详见[docs/models.md](docs/models.md)。
- `PI_CODING_AGENT=true` 环境变量在启动时设置，以便子进程可以检测到它们正在编码代理内部运行。
-  更新了 `antigravity-image-gen.ts` 示例扩展，以使用 User-Agent 版本 `1.21.9` ([#2901](https://github.com/badlogic/pi-mono/pull/2901) 由 [@aadishv](https://github.com/aadishv) 提交)
-  修复了 `--list-models` 静默吞掉 `models.json` 加载错误的问题；错误现在会打印到 stderr ([#3072](https://github.com/badlogic/pi-mono/issues/3072))
-  修复了内置提供商（例如 `openrouter`）的自定义模型被静默从 `--list-models` 中移除的问题，通过继承 `api`/`baseUrl` 于内置模型定义，不再需要 `apiKey` 于已有认证的提供商 ([#2921](https://github.com/badlogic/pi-mono/issues/2921) 和 [#3072](https://github.com/badlogic/pi-mono/issues/3072))
###  增加了

-  增加了 `openRouterRouting` 字段的完整支持于 `models.json`，包括回退、参数要求、数据收集、ZDR、忽略列表、量化、提供商排序、最高价格以及首选吞吐量和延迟约束 ([#2904](https://github.com/badlogic/pi-mono/pull/2904) 由 [@zmberber](https://github.com/zmberber) 提交)
-  在启动时设置 `PI_CODING_AGENT=true` 环境变量，以便子进程可以检测到它们正在编码代理内部运行 ([#2868](https://github.com/badlogic/pi-mono/issues/2868))

###  修复了

-  修复了遥测笔记的交互式变更日志渲染，通过将部分置于 `### Telemetry` 标题下，使启动时显示完整的发布说明而非仅版本标题。
-  更新了 `antigravity-image-gen.ts` 示例扩展，以使用 User-Agent 版本 `1.21.9` ([#2901](https://github.com/badlogic/pi-mono/pull/2901) 由 [@aadishv](https://github.com/aadishv) 提交)
-  将默认的反重力 User-Agent 版本提升至 `1.21.9` ([#2901](https://github.com/badlogic/pi-mono/pull/2901) 由 [@aadishv](https://github.com/aadishv) 提交)
-  修复了 Gemma 4 的思考级别映射，使其可在 `MINIMAL` 和 `HIGH` 之间路由，并将 Pi 推理级别映射到模型支持的思考级别 ([#2903](https://github.com/badlogic/pi-mono/pull/2903) 由 [@aadishv](https://github.com/aadishv) 提交)
- 修复了将 Gemini 2.5 Flash Lite 的最小思考预算固定为模型支持的 512-token 最小值，而非常规 Flash 的 128-token 最小值，避免无效思考预算错误（[#2861](https://github.com/badlogic/pi-mono/pull/2861) 由 [@JasonOA888](https://github.com/JasonOA888) 提交）
- 修复了 OpenAI Codex 响应请求，使其转发已配置的 `serviceTier` 值，恢复了 Codex 会话的服务层级选择（[#2996](https://github.com/badlogic/pi-mono/pull/2996) 由 [@markusylisiurunen](https://github.com/markusylisiurunen) 提交）
- 修复了新生成的会话ID，使其使用UUIDv7，从而提高了基于会话的请求路由的时间局部性（[#3018](https://github.com/badlogic/pi-mono/pull/3018) by [@steipete](https://github.com/steipete)）
- 修复了`Container.render()`在长会话中出现的堆栈溢出问题，通过用基于循环的推送替换`Array.push(...spread)`，防止了当子输出超过V8调用栈参数限制时出现的`RangeError: Maximum call stack size exceeded`（[#2651](https://github.com/badlogic/pi-mono/issues/2651)）
- 修复了编辑器粘性列跟踪在粘贴标记周围的处理方式，使垂直光标导航能够恢复光标进入粘贴标记前的列，而不是跳入或跳过粘贴内容。[#3092](https://github.com/badlogic/pi-mono/pull/3092) 由 [@Perlence](https://github.com/Perlence) 提交
- 修复了在`/tree`分支摘要过程中输入的排队消息，在导航完成后自动刷新，因此它们不再卡在转向队列中。[#3091](https://github.com/badlogic/pi-mono/pull/3091) 由 [@Perlence](https://github.com/Perlence) 提交
- 修复npm包更新检查，使其能够与非默认注册表上的包配合使用，方法是使用`npm view`代替硬编码的`registry.npmjs.org`进行获取（[#3164](https://github.com/badlogic/pi-mono/pull/3164) by [@aliou](https://github.com/aliou)）

## [0.67.0] - 2026-04-13

请参见[0.67.1]。版本0.67.0随附的变更日志格式错误导致交互式启动时仅显示版本标题，而非完整的发布说明。

## [0.66.1] - 2026-04-08

### 更改了

- 将Earendil公告从自动启动通知更改为隐藏的`/dementedelves`斜杠命令。

## [0.66.0] - 2026-04-08

### 新增功能

- Earendil启动公告，包含内置图片渲染和2026年4月8日及9日的关联博客文章。
- 当启用Anthropic订阅认证时，交互式显示Anthropic订阅认证警告，明确说明Anthropic第三方使用消耗额外配额并按令牌计费。
### 修复

- 修复裸`readline`导入，使用`node:readline`前缀以实现Deno兼容性（[#2885](https://github.com/badlogic/pi-mono/issues/2885) 由[@milosv-vtool](https://github.com/milosv-vtool) 提交）
- 修复自动重试，将流失败（如`request ended without sending any chunks`）视为瞬时错误（[#2892](https://github.com/badlogic/pi-mono/issues/2892)）
- 修复交互式启动通知，使其在初始资源列表之后渲染，并新增了Earendil启动公告，内嵌图片渲染，适用于2026年4月8日和9日。已将博客链接移至图片上方，避免与终端图片渲染重叠。
- 修复交互模式，当Anthropic订阅认证活动时会发出警告，以便用户了解Anthropic第三方使用会额外计费并按令牌计费。

## [0.65.2] - 2026-04-06

## [0.65.1] - 2026-04-05

### 修复

- 修复bash输出按行数截断，改为始终将完整输出持久化到临时文件，防止输出超过2000行但未超过字节阈值时的数据丢失（[#2852](https://github.com/badlogic/pi-mono/issues/2852)）
- RpcClient现将子进程stderr实时转发至父进程（[#2805](https://github.com/badlogic/pi-mono/issues/2805)）
- 主题文件监视器现处理异步`fs.watch`错误事件，而非导致进程崩溃（[#2791](https://github.com/badlogic/pi-mono/issues/2791)）
- 修复存储会话的当前工作目录（cwd）处理，当恢复或导入的会话原始工作目录已不存在时，交互式用户将提示继续在当前cwd，而非交互模式下直接报错。
- 修复资源冲突优先级，确保项目和用户技能、提示模板及主题能一致覆盖包资源，且命令行提供的路径优先于发现的资源（[#2781](https://github.com/badlogic/pi-mono/issues/2781)）
- 修复OpenAI兼容的流式补全使用统计，保持`prompt_tokens_details.cache_write_tokens`并规范化OpenRouter `cached_tokens`，防止pi中缓存读写令牌和成本报告错误（[#2802](https://github.com/badlogic/pi-mono/issues/2802)）
- 修复了CLI扩展路径的处理方式，如`git:gist.github.com/...`，之前错误地相对于cwd解析，现在已改为传递给包管理器（[#2845](https://github.com/badlogic/pi-mono/pull/2845) 由 [@aliou](https://github.com/aliou) 提交）
- 修复了使用`--mode json`管道stdin时，保持JSONL输出而不是回退到纯文本（[#2848](https://github.com/badlogic/pi-mono/pull/2848) 由 [@aliou](https://github.com/aliou) 提交）
- 修复了交互式命令文档，停止将已移除的`/exit`列为支持的退出命令（[#2850](https://github.com/badlogic/pi-mono/issues/2850)）

## [0.65.0] - 2026-04-03

### 新特性

- **会话运行时API**：`createAgentSessionRuntime()`和`AgentSessionRuntime`提供基于闭包的运行时，每次会话切换时都会重建cwd绑定的服务和会话配置。启动、`/new`、`/resume`、`/fork`和import均使用相同的创建路径。详见[docs/sdk.md](docs/sdk.md)和[examples/sdk/13-session-runtime.ts](examples/sdk/13-session-runtime.ts)。
- **在`/tree`中为条目添加标签时间戳**：可在`Shift+T`中切换树形条目的时间戳显示，支持智能日期格式化，并通过分支保持时间戳（[#2691](https://github.com/badlogic/pi-mono/pull/2691) 由 [@w-winter](https://github.com/w-winter) 提交）
- **`defineTool()`助手**：创建独立的自定义工具定义，支持完整的TypeScript参数类型推断，无需手动类型转换（[#2746](https://github.com/badlogic/pi-mono/issues/2746)）。详见[docs/extensions.md](docs/extensions.md)。
- **统一诊断信息**：参数解析、服务创建、会话选项解析和资源加载均返回结构化的诊断信息（`info`/`warning`/`error`），而非日志输出或退出。应用层决定展示和退出行为。

### 重大变更

- 移除了扩展后转换事件`session_switch`和`session_fork`。请使用`session_start`与`event.reason`（`"startup" | "reload" | "new" | "resume" | "fork"`）。对于`"new"`、`"resume"`和`"fork"`，`session_start`包含`previousSessionFile`。
- 移除了`AgentSession`中的会话替换方法。请使用`AgentSessionRuntime`进行`newSession()`、`switchSession()`、`fork()`和`importFromJsonl()`。跨cwd的会话替换会重建所有cwd绑定的运行时状态，并替换当前`AgentSession`实例。
- 移除了扩展和设置API中的`session_directory`。
- 未知的单短横线CLI标志（例如`-s`）现在会报错，而非静默忽略。

#### 迁移：扩展

之前：

```ts
pi.on("session_switch", async (event, ctx) => { ... });
pi.on("session_fork", async (_event, ctx) => { ... });
```

之后：

```ts
pi.on("session_start", async (event, ctx) => {
  // event.reason: "startup" | "reload" | "new" | "resume" | "fork"
  // event.previousSessionFile: set for "new", "resume", "fork"
});
```

#### 迁移：SDK会话替换

之前：

```ts
await session.newSession();
await session.switchSession("/path/to/session.jsonl");
```

之后：

```ts
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

await runtime.newSession();
await runtime.switchSession("/path/to/session.jsonl");
await runtime.fork("entry-id");

// After replacement, runtime.session is the new live session.
// Rebind any session-local subscriptions or extension bindings.
```

### 新增

- 新增`createAgentSessionRuntime()`和`AgentSessionRuntime`用于运行时支持的会话替换。运行时接受一个`CreateAgentSessionRuntimeFactory`闭包，闭包捕获全局固定输入，并为每个有效的cwd重建cwd绑定的服务和会话配置。启动及后续`/new`、`/resume`、`/fork`、import均使用相同的工厂函数。
- 新增统一诊断模型（`info`/`warning`/`error`），用于参数解析、服务创建、会话选项解析和资源加载。创建逻辑不再日志输出或退出。应用层决定展示和退出行为。
- 新增对缺失显式CLI资源路径的错误诊断（`-e`、`--skill`、`--prompt-template`、`--theme`）

- 新增`defineTool()`，使独立和数组式自定义工具定义保持推断的参数类型，无需手动类型转换（[#2746](https://github.com/badlogic/pi-mono/issues/2746)）

- 新增会话树的标签时间戳，通过`Shift+T`在`/tree`中的切换，支持智能日期格式化，并通过分支保持时间戳（[#2691](https://github.com/badlogic/pi-mono/pull/2691) 由 [@w-winter](https://github.com/w-winter) 提交）

### 修复

- 修复了启动资源加载，使其重用初始`ResourceLoader`以避免在会话启动前加载两次扩展，且`session_start`处理器仍对单例风格扩展触发（[#2766](https://github.com/badlogic/pi-mono/issues/2766)）
- 修复了重试结算逻辑，使重试的代理运行等待完整重试周期完成才声明空闲状态，避免因瞬时错误导致的陈旧状态
-  修复了主题 `export` 的颜色设置，使其与 `colors` 一样处理主题变量，因此 `/export` 的 HTML 背景现在会遵循 `pageBg: "base"` 类似的条目，而不是强制要求内联十六进制值（[#2707](https://github.com/badlogic/pi-mono/issues/2707)）
-  修复了 Bedrock 流量控制错误被误识别为上下文溢出，导致不必要的压缩而不是重试（[#2699](https://github.com/badlogic/pi-mono/pull/2699) 由 [@xu0o0](https://github.com/xu0o0) 提交）
-  为更新的 Z.ai 模型添加了工具流支持（[#2732](https://github.com/badlogic/pi-mono/pull/2732) 由 [@kaofelix](https://github.com/kaofelix) 提交）

## [0.64.0] - 2026-03-29

###  新特性

-  扩展和 SDK 调用者可以为任何工具定义附加 `prepareArguments` 钩子，以便在模式验证之前对原始模型参数进行规范化或迁移。内置的 `edit` 工具利用此功能，以透明方式支持使用旧版单编辑模式创建的会话。详见 [docs/extensions.md](docs/extensions.md)
-  扩展可以自定义折叠的思考块标签，使用 `ctx.ui.setHiddenThinkingLabel()`。详见 [examples/extensions/hidden-thinking-label.ts](examples/extensions/hidden-thinking-label.ts)（[#2673](https://github.com/badlogic/pi-mono/issues/2673)）

###  重大变更

-  `ModelRegistry` 不再具有公共构造函数。SDK 调用者和测试必须使用 `ModelRegistry.create(authStorage, modelsJsonPath?)` 用于文件支持的注册表，或 `ModelRegistry.inMemory(authStorage)` 用于仅内置注册表。直接调用 `new ModelRegistry(...)` 现在无法编译。

###  新增

-  为在模式验证之前准备原始工具调用参数添加了 `ToolDefinition.prepareArguments` 钩子，从而能够为恢复的会话与过时的工具模式兼容提供适配器
-  内置 `edit` 工具现在使用 `prepareArguments` 透明地将旧会话中的顶层 `oldText`/`newText` 折叠到 `edits[]`
-  添加了 `ctx.ui.setHiddenThinkingLabel()`，使扩展可以在交互模式下自定义折叠的思考标签，在 RPC 模式下为无操作，在 `examples/extensions/hidden-thinking-label.ts` 中提供可运行的示例扩展（[#2673](https://github.com/badlogic/pi-mono/issues/2673)）

###  修复

-  修复了扩展排队用户消息，使其能够刷新交互式待处理消息列表，因此在回合活跃期间提交的消息不再被静默丢弃（[#2674](https://github.com/badlogic/pi-mono/pull/2674) 由 [@mrexodia](https://github.com/mrexodia) 提交）
-  修复了 monorepo 中 `tsconfig.json` 路径映射，使其能够正确解析 `@mariozechner/pi-ai` 子路径导出到开发检出的源文件（[#2625](https://github.com/badlogic/pi-mono/pull/2625) 由 [@ferologics](https://github.com/ferologics) 提交）
-  修复了 TUI 单元格大小响应处理，使其仅消耗精确的 `CSI 6 ; height ; width t` 回复，因此在等待终端图像元数据时不再吞没 `Escape`（[#2661](https://github.com/badlogic/pi-mono/issues/2661)）
-  修复了 Kitty 键盘协议的功能键，使其规范化为逻辑数字、符号和导航键，因此在终端（如 iTerm2）中的小键盘输入不再插入私用区乱码或被忽略（[#2650](https://github.com/badlogic/pi-mono/issues/2650)）

## [0.63.2] - 2026-03-29

###  新特性

-  扩展处理器现在可以使用 `ctx.signal` 将取消操作传递给嵌套模型调用、`fetch()` 等其他感知取消的工作。详见 [docs/extensions.md#ctxsignal](docs/extensions.md#ctxsignal)（[#2660](https://github.com/badlogic/pi-mono/issues/2660)）
-  内置 `edit` 工具的输入现在仅使用 `edits[]` 作为替换形状，减少了因混合单编辑和多编辑模式导致的无效工具调用（[#2639](https://github.com/badlogic/pi-mono/issues/2639)）
-  大型多编辑结果在渲染最终差异时不再触发交互式 TUI 的全屏重绘（[#2664](https://github.com/badlogic/pi-mono/issues/2664)）

###  新增

-  为 `ExtensionContext` 添加了 `ctx.signal`，并将其与活动代理回合关联，使扩展处理器能够将取消操作传递给嵌套模型调用、`fetch()` 等感知取消的工作（[#2660](https://github.com/badlogic/pi-mono/issues/2660)）

###  修复

-  修复了内置 `edit` 工具的输入，使其仅使用 `edits[]` 作为替换形状，消除了混合单编辑和多编辑模式导致的重复无效工具调用和重试（[#2639](https://github.com/badlogic/pi-mono/issues/2639)）
-  修复了编辑工具的 TUI 渲染，使其将大型多编辑差异推迟到最终结果，避免在工具完成时全屏重绘（[#2664](https://github.com/badlogic/pi-mono/issues/2664)）

## [0.63.1] - 2026-03-27

###  新增
- 增加了`gemini-3.1-pro-preview-customtools`模型在`google-vertex`提供商中的可用性（[#2610](https://github.com/badlogic/pi-mono/pull/2610)由[@gordonhwc](https://github.com/gordonhwc)提交）

### 修复

- 文档化了`tool_call`输入变异作为受支持的扩展API行为，澄清了变异后输入不会重新验证，并为执行变异工具参数添加了回归覆盖（[#2611](https://github.com/badlogic/pi-mono/issues/2611)）

- 修复了重复压缩导致丢弃先前压缩保留的消息，通过从先前保留边界重新汇总并从重建的会话上下文中重新计算`tokensBefore`（[#2608](https://github.com/badlogic/pi-mono/issues/2608)）

- 修复了交互式压缩UI更新，使`ctx.compact()`通过统一压缩事件重建聊天，手动压缩不再重复摘要块，且`trigger-compact`示例仅在上下文使用超出阈值时触发（[#2617](https://github.com/badlogic/pi-mono/issues/2617)）

- 修复了交互式压缩完成，以在重建聊天后追加一个合成压缩摘要，确保最新压缩始终可见于底部

- 修复了技能发现，使其在目录包含`SKILL.md`时不再递归，并忽略`.agents/skills`中的根`*.md`文件，同时保持根markdown技能文件在`~/.pi/agent/skills`、`.pi/skills`和package `skills/`目录中的支持（[#2603](https://github.com/badlogic/pi-mono/issues/2603)）

- 修复了编辑工具的差异渲染，使其在多编辑操作且中间有大量未变区域时，不会将完整未变中间块全部输出，而是折叠中间上下文

- 修复了编辑工具的错误渲染，避免在预览和结果块中重复显示完全匹配的失败信息

- 修复了Ollama模型的自动压缩溢出恢复，当后端返回明确的`prompt too long; exceeded max context length ...`错误而非静默截断输入时（[#2626](https://github.com/badlogic/pi-mono/issues/2626)）

- 修复了内置工具覆盖，使其在重用内置参数模式时仍尊重交互式TUI中的自定义`renderCall`和`renderResult`渲染器，恢复了`minimal-mode`示例（[#2595](https://github.com/badlogic/pi-mono/issues/2595)）

## [0.63.0] - 2026-03-27

### 破坏性变更

- `ModelRegistry.getApiKey(model)`已被`getApiKeyAndHeaders(model)`替换，因为`models.json`认证和头部值现在可以在每次请求时动态解析。之前仅获取API密钥的扩展和SDK集成现在必须为每次调用获取请求认证并同时传递`apiKey`和`headers`。仅在您明确需要提供商级API密钥查找且不带模型头部或`authHeader`处理时使用`getApiKeyForProvider(provider)`（[#1835](https://github.com/badlogic/pi-mono/issues/1835)）

- 移除了已弃用的直接`minimax`和`minimax-cn`模型ID，仅保留`MiniMax-M2.7`和`MiniMax-M2.7-highspeed`。请将固定模型ID更新为这些支持的直接MiniMax模型之一，或使用仍暴露旧ID的其他提供商路由（[#2596](https://github.com/badlogic/pi-mono/pull/2596)由[@liyuan97](https://github.com/liyuan97)提交）

#### 迁移说明

之前：

```ts
const apiKey = await ctx.modelRegistry.getApiKey(model);
return streamSimple(model, messages, { apiKey });
```


之后：

```ts
const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
if (!auth.ok) throw new Error(auth.error);
return streamSimple(model, messages, {
  apiKey: auth.apiKey,
  headers: auth.headers,
});
```


### 增加了

- 增加了全局和项目`settings.json`中的`sessionDir`设置支持，以便会话存储可以在不每次调用时传递`--session-dir`的情况下进行配置（[#2598](https://github.com/badlogic/pi-mono/pull/2598)由[@smcllns](https://github.com/smcllns)提交）

- 在交互式头部添加了启动引导提示，告知用户pi可以解释其自身特性和文档（[#2620](https://github.com/badlogic/pi-mono/pull/2620)由[@ferologics](https://github.com/ferologics)提交）

- 增加了`edit`工具多编辑支持，使单次调用可以更新同一文件中多个独立、不相交的区域，同时将所有替换与原始文件内容匹配

- 增加了对`PI_TUI_WRITE_LOG`目录路径的支持，为每个实例创建唯一日志文件（`tui-<timestamp>-<pid>.log`），便于调试多个pi会话（[#2508](https://github.com/badlogic/pi-mono/pull/2508)由[@mrexodia](https://github.com/mrexodia)提交）

### 更改

### 修复

- 修复了文件变异队列的排序，使并发`edit`和`write`操作针对同一文件时，请求顺序保持串行化，而非在队列键解析过程中被重新排序
- 修复了`models.json` shell-command认证和请求头在请求时解析，而不是缓存到长期存活的模型状态中。pi现在将TTL、缓存和恢复策略留给用户提供的包装命令，因为任意shell命令需要提供者特定的策略（[#1835](https://github.com/badlogic/pi-mono/issues/1835)）
- 修复了Google和Vertex的成本计算，将缓存的提示词令牌从计费输入令牌中扣除，而不是在提供者报告`cachedContentTokenCount`时重复计算（[#2588](https://github.com/badlogic/pi-mono/pull/2588) 由[@sparkleMing](https://github.com/sparkleMing)提交）
- 添加了缺失的`ajv`直接依赖；之前依赖于通过`@mariozechner/pi-ai`的传递安装，这破坏了独立安装（[#2252](https://github.com/badlogic/pi-mono/issues/2252)）
- 修复了`/export` HTML背景，使其尊重`theme.export.pageBg`、`cardBg`和`infoBg`，而不是总是从`userMessageBg`派生（[#2565](https://github.com/badlogic/pi-mono/issues/2565)）
- 修复了交互式bash执行折叠预览，在渲染时重新计算视觉行换行，使预览在调整大小和分割窗宽度变化后尊重当前终端宽度（[#2569](https://github.com/badlogic/pi-mono/issues/2569)）
- 修复了RPC `get_session_stats`，使其暴露`contextUsage`，无头客户端可以读取实际当前上下文窗口使用情况，而不是从令牌总数派生（[#2550](https://github.com/badlogic/pi-mono/issues/2550)）
- 修复了`pi update`对于git包，仅使用`--no-tags`获取跟踪的目标分支，减少无关分支和标签的噪音，同时保持强制推送安全的更新（[#2548](https://github.com/badlogic/pi-mono/issues/2548)）
- 修复了打印和JSON模式，在退出前发出`session_shutdown`，以便扩展可以释放长期存活的资源，并且非交互式运行可以干净终止（[#2576](https://github.com/badlogic/pi-mono/issues/2576)）
- 修复了GitHub Copilot OpenAI响应请求，在没有请求推理努力时完全省略`reasoning`字段，避免`400`错误，防止Copilot `gpt-5-mini`在内部摘要调用时拒绝`reasoning: { effort: "none" }`（[#2567](https://github.com/badlogic/pi-mono/issues/2567)）
- 修复了引述文本颜色在内联链接（和其他内联元素）后断裂的问题，由于缺少样式恢复前缀
- 修复了slash-command Tab补全，从完成命令名后立即链接到参数自动补全，恢复像`/model`那样的流程，提交到选择器对话框（[#2577](https://github.com/badlogic/pi-mono/issues/2577)）
- 修复了TUI内容缩小或临时组件使工作区膨胀后的内容过期和视口跟踪错误（[#2126](https://github.com/badlogic/pi-mono/pull/2126) 由[@Perlence](https://github.com/Perlence)提交）
- 修复了`@`自动补全，对编辑器触发的搜索进行节流，干净取消正在进行的`fd`查找，并在结果刷新时保持建议可见（[#1278](https://github.com/badlogic/pi-mono/issues/1278)）

## [0.62.0] - 2026-03-23

### 新特性

- 内置工具作为可扩展的ToolDefinitions。扩展作者现在可以覆盖内置的读/写/编辑/bash/grep/find/ls工具的渲染，使用自定义`renderCall`/`renderResult`组件。详见[docs/extensions.md](docs/extensions.md)。
- 通过`sourceInfo`统一了源出处。所有资源、命令、工具、技能和提示模板现在都带有结构化的`sourceInfo`，包含路径、作用域和源元数据。在自动补全、RPC发现和SDK内省中可见。详见[docs/extensions.md](docs/extensions.md)。
- AWS Bedrock成本分配标签。`BedrockOptions`上的新`requestMetadata`选项将键值对转发给Bedrock Converse API，用于AWS Cost Explorer的成本分配。

### 破坏性变更

- 更改了`ToolDefinition.renderCall`和`renderResult`的语义。回退渲染仅在未为该插槽定义渲染器时发生。如果`renderCall`或`renderResult`已定义，它必须返回`Component`。
- 更改了slash命令出处，始终使用`sourceInfo`。RPC `get_commands`、`RpcSlashCommand`和SDK `SlashCommandInfo`不再暴露`location`或`path`。改用`sourceInfo`（[#1734](https://github.com/badlogic/pi-mono/issues/1734)）
- 从`Skill`和`PromptTemplate`中移除了遗留的`source`字段。使用`sourceInfo.source`作为出处（[#1734](https://github.com/badlogic/pi-mono/issues/1734)）
- 已移除`ResourceLoader.getPathMetadata()`。资源溯源现在通过`sourceInfo`直接附加到已加载的资源上（[#1734](https://github.com/badlogic/pi-mono/issues/1734)）  
- 已从`RegisteredCommand`和`RegisteredTool`中移除`extensionPath`。请改用`sourceInfo.path`作为溯源（[#1734](https://github.com/badlogic/pi-mono/issues/1734)）  

#### 迁移说明  

资源、命令和工具的溯源现在始终使用`sourceInfo`。  

常见更新：  
- RPC `get_commands`：将`path`和`location`替换为`sourceInfo.path`、`sourceInfo.scope`和`sourceInfo.source`  
- `SlashCommandInfo`：将`command.path`和`command.location`替换为`command.sourceInfo`  
- `Skill`和`PromptTemplate`：将`.source`替换为`.sourceInfo.source`  
- `RegisteredCommand`和`RegisteredTool`：将`.extensionPath`替换为`.sourceInfo.path`  
- 自定义`ResourceLoader`实现：移除`getPathMetadata()`，直接从已加载的资源读取溯源  

示例：  
- `command.path` -> `command.sourceInfo.path`  
- `command.location === "user"` -> `command.sourceInfo.scope === "user"`  
- `skill.source` -> `skill.sourceInfo.source`  
- `tool.extensionPath` -> `tool.sourceInfo.path`  

### 已更改  

- 内置工具现在与扩展中的自定义工具行为一致。要获取内置工具定义，请导入`readToolDefinition`/`createReadToolDefinition()`以及从`@mariozechner/pi-coding-agent`导入的等价`bash`、`edit`、`write`、`grep`、`find`和`ls`导出。  
- 清理了`buildSystemPrompt()`，使内置工具片段和工具本地指南来自内置`ToolDefinition`元数据，跨工具和全局提示规则保留在系统提示构造中。  
- 为内置、SDK和扩展工具的`pi.getAllTools()`结果增加了结构化`sourceInfo`（[#1734](https://github.com/badlogic/pi-mono/issues/1734)）  

### 已修复  

- 已修复扩展命令名冲突，使具有重复命令名的扩展可以同时加载。冲突的扩展命令现在会在加载顺序中附加数字后缀，例如`/review:1`和`/review:2`（[#1061](https://github.com/badlogic/pi-mono/issues/1061)）  
- 已修复扩展命令、提示模板和技能在自动补全和命令发现中的斜杠命令源归因（[#1734](https://github.com/badlogic/pi-mono/issues/1734)）  
- 已修复自动调整大小的图片处理，强制在最终base64负载中遵守内联图片大小限制，当调整大小无法生成安全图片时返回纯文本降级，并避免在`read`和`@file`自动调整大小路径中回退到原始图片（[#2055](https://github.com/badlogic/pi-mono/issues/2055)）  
- 已修复`pi update`，git包在已匹配本地检出目标时跳过破坏性重置、清理和重新安装步骤（[#2503](https://github.com/badlogic/pi-mono/issues/2503)）  
- 已修复打印和JSON模式，在非交互式启动时接管stdout，使包管理器和其他偶然的杂项内容不进入协议/输出stdout（[#2482](https://github.com/badlogic/pi-mono/issues/2482)）  
- 已修复cli-highlight对无语言代码块的自动检测，修正了将散文误判为编程语言并将随机英文单词着色为关键字的问题  
- 已修复Anthropic思维禁用处理，当思维明确关闭时发送`thinking: { type: "disabled" }`给具备推理能力的模型（[#2022](https://github.com/badlogic/pi-mono/issues/2022)）  
- 已修复Google、Google Vertex、Gemini CLI、OpenAI响应、Azure OpenAI响应和OpenRouter支持的OpenAI兼容补全中的显式思维禁用处理（[#2490](https://github.com/badlogic/pi-mono/issues/2490)）  
- 已修复OpenAI响应的重播，通过将外部工具调用项ID哈希为有界的`fc_<hash>` ID来处理  
- 已修复OpenAI兼容补全流，忽略null片段而非崩溃（[#2466](https://github.com/badlogic/pi-mono/pull/2466) 由[@Cheng-Zi-Qing](https://github.com/Cheng-Zi-Qing) 提交）  
- 已修复`truncateToWidth()`在处理非常大的字符串时的性能，通过流式截断实现（[#2447](https://github.com/badlogic/pi-mono/issues/2447)）  
- 已修复markdown标题样式在内联代码跨度内丢失的问题  

## [0.61.1] - 2026-03-20  

### 新功能  

- 通过`ToolCallEventResult`导出自顶级包和核心扩展入口的类型`tool_call`处理器返回值。详见[docs/extensions.md](docs/extensions.md)。
- 更新了`zai`、`cerebras`、`minimax`和`minimax-cn`的默认模型，并将MiniMax目录覆盖范围和限制与当前提供商阵容对齐。详见[docs/models.md](docs/models.md)和[docs/providers.md](docs/providers.md)。

### 新增

- 将`ToolCallEventResult`添加到`@mariozechner/pi-coding-agent`的顶级和核心扩展导出中，以便扩展作者可以显式返回`tool_call`处理器值（[#2458](https://github.com/badlogic/pi-mono/issues/2458)）

### 更改

- 将`zai`、`cerebras`、`minimax`和`minimax-cn`的默认模型更改为与当前提供商阵容匹配，并添加了缺失的`MiniMax-M2.1-highspeed`模型条目，采用规范化的MiniMax上下文限制（[#2445](https://github.com/badlogic/pi-mono/pull/2445) 由[@1500256797](https://github.com/1500256797)提交）

### 修复

- 修复了`ctrl+z`挂起和`fg`恢复的可靠性，确保进程在`SIGCONT`处理器恢复TUI之前保持活跃，避免在没有其他活动事件循环句柄的环境中立即退出进程（[#2454](https://github.com/badlogic/pi-mono/issues/2454)）

- 修复了`createAgentSession({ agentDir })`，使其能够从提供的`agentDir`中派生默认持久化会话路径，保持会话存储与设置、身份验证、模型和资源加载的一致性（[#2457](https://github.com/badlogic/pi-mono/issues/2457)）

- 修复了共享快捷键解析，阻止用户覆盖导致默认快捷键（如选择确认和编辑器光标键）被移除的情况（[#2455](https://github.com/badlogic/pi-mono/issues/2455)）

- 修复了Termux软件键盘高度变化时强制全屏重绘和每次切换都回放TUI历史记录的问题（[#2467](https://github.com/badlogic/pi-mono/issues/2467)）

- 修复了项目本地npm包更新，使其安装npm `latest`而不是重复使用陈旧的依赖范围，并在`pi update <source>`省略配置的npm或git源前缀时添加了`Did you mean ...?`建议（[#2459](https://github.com/badlogic/pi-mono/issues/2459)）

## [0.61.0] - 2026-03-20

### 新增功能

- 为应用和TUI统一了命名空间快捷键ID和快捷键管理器。详见[docs/keybindings.md](docs/keybindings.md)和[docs/extensions.md](docs/extensions.md)。
- JSONL 会话导出和导入功能通过 `/export <path.jsonl>` 和 `/import <path.jsonl>` 实现。详情请参阅 [README.md](README.md) 和 [docs/session.md](docs/session.md)。

- HTML 分享和导出视图中侧边栏支持调整大小。详情请参阅 [README.md](README.md)。

### 不兼容变更

- 交互式快捷键 ID 现在已命名空间化，`keybindings.json` 现在使用与之相同的规范命名空间 ID。旧版配置文件会在启动时自动迁移。自定义编辑器和扩展 UI 组件仍会接收注入的 `keybindings: KeybindingsManager`，但不会自行调用 `getKeybindings()` 或 `setKeybindings()`。声明合并适用于该注入类型（[#2391](https://github.com/badlogic/pi-mono/issues/2391)）

- 扩展作者迁移：更新 `keyHint()`、`keyText()` 和注入的 `keybindings.matches(...)` 调用，将旧版内置名称如 `"expandTools"`、`"selectConfirm"` 和 `"interrupt"` 更新为命名空间 ID 如 `"app.tools.expand"`、`"tui.select.confirm"` 和 `"app.interrupt"`。详细列表请参阅 [docs/keybindings.md](docs/keybindings.md)。`pi.registerShortcut("ctrl+shift+p", ...)` 保持不变，因为扩展快捷键仍使用原始键组合，而非快捷键 ID。

### 新增

- 将 `gpt-5.4-mini` 添加至 `openai-codex` 模型目录（[#2334](https://github.com/badlogic/pi-mono/pull/2334) by [@justram](https://github.com/justram)）

- 通过 `/export <path.jsonl>` 和 `/import <path.jsonl>` 实现 JSONL 会话导出和导入功能（[#2356](https://github.com/badlogic/pi-mono/pull/2356) by [@hjanuschka](https://github.com/hjanuschka)）

- 为 HTML 分享和导出视图添加可调整大小的侧边栏（[#2435](https://github.com/badlogic/pi-mono/pull/2435) by [@dmmulroy](https://github.com/dmmulroy)）

### 修复

- session-selector-rename 和 tree-selector 的测试现在与快捷键无关，每次测试前都会将编辑器快捷键重置为默认值，以防止用户 `keybindings.json` 导致测试失败（[#2360](https://github.com/badlogic/pi-mono/issues/2360)）

- 修复自定义 `keybindings.json` 覆盖以全局屏蔽冲突的默认快捷键，使如 `cursorUp: ["up", "ctrl+p"]` 等快捷键不再让默认操作（如模型循环）保持激活状态（[#2391](https://github.com/badlogic/pi-mono/issues/2391)）
-  修复了并发 `edit` 和 `write` 变更针对同一文件的执行，改为顺序执行，防止文件写入交叉覆盖 ([#2327](https://github.com/badlogic/pi-mono/issues/2327))  
-  修复了 RPC 模式，将意外的 stdout 写入重定向至 stderr，确保 JSONL 响应可解析 ([#2388](https://github.com/badlogic/pi-mono/issues/2388))  
-  修复了自动重试机制，确保 `session.prompt()` 在完整重试循环（包括工具执行）结束后才返回 ([#2440](https://github.com/badlogic/pi-mono/pull/2440) 由 [@pasky](https://github.com/pasky) 提交)  
-  修复了 `/model`，在 `models.json` 变更后刷新作用域模型列表，避免选择器内容过期 ([#2408](https://github.com/badlogic/pi-mono/pull/2408) 由 [@Perlence](https://github.com/Perlence) 提交)  
-  修复了 `validateToolArguments()`，在受限运行时（如 Cloudflare Workers）AJV 模式编译被阻塞时可优雅降级，允许工具执行而不进行模式验证 ([#2395](https://github.com/badlogic/pi-mono/issues/2395))  
-  修复了 CLI 启动，阻止进程警告泄露至终端、打印输出和 RPC 输出 ([#2404](https://github.com/badlogic/pi-mono/issues/2404))  
-  修复了 bash 工具渲染，显示工具块底部的已用时间 ([#2406](https://github.com/badlogic/pi-mono/issues/2406))  
-  修复了自定义主题文件监控，从磁盘重新加载更新的主题内容，而非保持过期缓存主题数据 ([#2417](https://github.com/badlogic/pi-mono/issues/2417), [#2003](https://github.com/badlogic/pi-mono/issues/2003))  
-  修复了页脚 Git 分支刷新，异步执行以避免分支监视器更新阻塞 UI ([#2418](https://github.com/badlogic/pi-mono/issues/2418))  
-  修复了无效扩展提供者注册，使其能显示扩展错误而不阻止其他提供者加载 ([#2431](https://github.com/badlogic/pi-mono/issues/2431))  
-  修复了 Windows 环境下 bash 执行挂起问题，解决了因子进程继承 stdout/stderr 处理导致 `agent-browser` 类命令无限循环的问题 ([#2389](https://github.com/badlogic/pi-mono/pull/2389) 由 [@mrexodia](https://github.com/mrexodia) 提交)  
-  修复了 `google-vertex` API 密钥解析，忽略类似 `<authenticated>` 的占位符认证标记，降级为使用 ADC 而非发送字面 API 密钥 ([#2335](https://github.com/badlogic/pi-mono/issues/2335))  
-  修复了桌面剪贴板文本复制，优先使用原生操作系统剪贴板集成，提高 macOS 和 Windows 的可靠性 ([#2347](https://github.com/badlogic/pi-mono/issues/2347))  
-  修复了 Bun Bedrock 提供者注册，使其在编译二进制文件中提供者重置和会话重新加载后仍能存活 ([#2350](https://github.com/badlogic/pi-mono/pull/2350) 由 [@unexge](https://github.com/unexge) 提交)  
-  修复了 OpenRouter 推理请求，使其使用提供者的嵌套推理负载，恢复对 OpenRouter 模型和自定义兼容设置的思考层级支持 ([#2298](https://github.com/badlogic/pi-mono/pull/2298) 由 [@PriNova](https://github.com/PriNova) 提交)  
-  修复了 Bedrock 应用推理配置文件，支持在 `AWS_BEDROCK_FORCE_CACHE=1` 设置时进行提示缓存，覆盖不暴露底层 Claude 模型名称的 ARN 配置文件 ([#2346](https://github.com/badlogic/pi-mono/pull/2346) 由 [@haoqixu](https://github.com/haoqixu) 提交)

## [0.60.0] - 2026-03-18

###  新特性

-  可直接通过 CLI 使用 `--fork <path|id>` 从现有会话分叉，将源会话复制到当前项目的新会话。详见 [README.md](README.md)。  
-  扩展和 SDK 调用者可通过 `createLocalBashOperations()` 重用 pi 内置本地 bash 后端，实现 `user_bash` 拦截和自定义 bash 集成。详见 [docs/extensions.md#user_bash](docs/extensions.md#user_bash)。  
-  启动时不再自动更新未固定版本的 npm 和 git 包。使用 `pi update` 显式更新，交互模式会在后台检查更新并通知可用新版本。详见 [README.md](README.md)。

###  破坏性变更

-  修改了包启动行为，不再在启动时检查或更新已安装的未固定包。使用 `pi update` 手动应用 npm/git 包更新，交互模式现在会在后台检查更新并通知可用版本 ([#1963](https://github.com/badlogic/pi-mono/issues/1963))

###  新增

-  新增 `--fork <path|id>` CLI 标志，可直接将现有会话文件或部分会话 UUID 分叉为新会话 ([#2290](https://github.com/badlogic/pi-mono/issues/2290))
- 增加了`createLocalBashOperations()`导出，以便扩展和SDK调用者可以为`user_bash`处理和其他自定义bash集成封装pi内置的本地bash后端([#2299](https://github.com/badlogic/pi-mono/issues/2299))

### 修复

- 修复了活动模型选择，在动态提供商注册或更新更改可用模型集后会立即刷新([#2291](https://github.com/badlogic/pi-mono/issues/2291))
- 修复了tmux xterm对`modifyOtherKeys`的匹配，修复了`Backspace`、`Escape`和`Space`，并通过将Windows Terminal会话与传统终端区分开来，解决了原始`\x08`退格键歧义问题([#2293](https://github.com/badlogic/pi-mono/issues/2293))
- 修复了Gemini 3和反重力图像工具结果，使其保持为多模态工具响应的内联内容，而不是通过单独的后续消息中转([#2052](https://github.com/badlogic/pi-mono/issues/2052))
- 修复了捆绑的Bedrock Claude 4.6模型元数据，使其使用正确的20万上下文窗口，而不是100万([#2305](https://github.com/badlogic/pi-mono/issues/2305))
- 修复了`/reload`，使其能够从磁盘重新加载键绑定，以便`keybindings.json`中的更改立即生效([#2309](https://github.com/badlogic/pi-mono/issues/2309))
- 修复了内置提供程序的懒加载注册，使得编译后的 Bun 可执行文件在首次使用时仍能加载提供程序，而无需急切地打包提供程序 SDK ([#2314](https://github.com/badlogic/pi-mono/issues/2314))
- 修复了内置 OAuth 登录流程，使其在 Anthropic、Gemini CLI、Antigravity 和 OpenAI Codex 之间使用对齐的回调处理，并修复了 OpenAI Codex 登录在浏览器回调成功后立即完成的问题 ([#2316](https://github.com/badlogic/pi-mono/issues/2316))
- 修复了 OpenAI 兼容的 z.ai `network_error` 响应，使其触发错误处理和重试，而不是被视为成功的助手输出 ([#2313](https://github.com/badlogic/pi-mono/issues/2313))
- 修复了打印模式，使其在同时提供 stdin 和显式提示时，能够将管道输入合并到初始提示中 ([#2315](https://github.com/badlogic/pi-mono/issues/2315))
- 修复了 OpenAI 响应在编码代理中的回放，使其在发送给 OpenAI Codex 和其他兼容响应的目标之前，能够对过大的恢复工具调用 ID 进行标准化 ([#2328](https://github.com/badlogic/pi-mono/issues/2328))
- 修复了tmux扩展键警告在tmux服务器不可达时保持隐藏的问题，避免在沙箱环境中出现虚假的启动警告（[#2311](https://github.com/badlogic/pi-mono/pull/2311) by [@kaffarell](https://github.com/kaffarell)）

## [0.59.0] - 2026-03-17

### 新特性

- 通过首次使用时懒加载`@mariozechner/pi-ai`提供者SDK，而非导入时加载，实现更快的启动（[#2297](https://github.com/badlogic/pi-mono/issues/2297)）

- 改进了提供者在返回错误消息作为响应时的重试行为（[#2264](https://github.com/badlogic/pi-mono/issues/2264)）

- 通过OSC 133命令执行标记，实现更好的终端集成（[#2242](https://github.com/badlogic/pi-mono/issues/2242)）

- 改进了使用reftable存储的Git仓库分支检测（[#2300](https://github.com/badlogic/pi-mono/issues/2300)）

### 重大变更

- 更改了自定义工具系统提示行为，只有当工具提供`promptSnippet`时，才会包含在默认的`Available tools`部分中。现在省略`promptSnippet`会将工具排除在该部分之外，而不是回退到`description`（[#2285](https://github.com/badlogic/pi-mono/issues/2285)）

### 更改

- 懒加载内置的`@mariozechner/pi-ai`提供者模块和根提供者包装器，使得编码代理启动不再在首次使用前急切地加载提供者SDK（[#2297](https://github.com/badlogic/pi-mono/issues/2297)）

### 修复

- 修复了`/tree`、压缩和分支摘要中的会话标题处理，使空标题能够正确清除渲染，并且`session_info`条目保持不在摘要中（[#2304](https://github.com/badlogic/pi-mono/pull/2304) by [@aliou](https://github.com/aliou)）

- 修复了使用reftable存储的Git仓库分支检测，确保分支名称仍然正确显示在页脚（[#2300](https://github.com/badlogic/pi-mono/issues/2300)）

- 修复了渲染的用户消息，在命令输出后发出OSC 133命令执行标记，从而改进终端提示符集成（[#2242](https://github.com/badlogic/pi-mono/issues/2242)）

- 修复了提供者重试处理，将提供者返回的错误消息视为可重试的失败，而不是成功的响应（[#2264](https://github.com/badlogic/pi-mono/issues/2264)）
- 修复了Claude 4.6上下文窗口覆盖问题，使打包模型元数据中的编码代理在重建生成目录后能够看到预期的模型限制（[#2286](https://github.com/badlogic/pi-mono/issues/2286)）

## [0.58.4] - 2026-03-16

### 修复

- 修复了转向消息，使其等待当前助手消息的工具调用批次完全完成，而不是跳过待处理的工具调用。

## [0.58.3] - 2026-03-15

## [0.58.2] - 2026-03-15

### 添加

- 通过使用可配置的选择列表主列尺寸，改进了设置、主题、思考和显示图像选择器的布局（[#2154](https://github.com/badlogic/pi-mono/pull/2154) 由[@markusylisiurunen](https://github.com/markusylisiurunen) 提交）
### 修复

- 修复了模糊匹配`edit`，以在比较之前标准化Unicode兼容变体，减少旧文本未找到的虚假失败，例如CJK和全角字符（[#2044](https://github.com/badlogic/pi-mono/issues/2044)）
- 修复了`/model <ref>`精确匹配和选择器搜索，使其能够识别当模型ID本身包含`/`时的规范`provider/model`引用，例如LM Studio模型如`unsloth/qwen3.5-35b-a3b`([#2174](https://github.com/badlogic/pi-mono/issues/2174))
- 修复了Anthropic OAuth手动登录和令牌刷新，通过使用localhost回调URI处理已复制的重定向/代码流程，并在刷新令牌请求中省略`scope`([#2169](https://github.com/badlogic/pi-mono/issues/2169))
- 修复会话切换后残留的滚动回显，通过在清除滚动回显前先清屏来解决（[#2155](https://github.com/badlogic/pi-mono/pull/2155) 由 [@Perlence](https://github.com/Perlence) 提交）
- 修复markdown块元素渲染后多余的空白行（[#2152](https://github.com/badlogic/pi-mono/pull/2152) 由 [@markusylisiurunen](https://github.com/markusylisiurunen) 提交）

## [0.58.1] - 2026-03-14

### 添加

- 添加 `pi uninstall` 的别名以方便 `pi install --uninstall` 使用

### 修复

- 修复OpenAI Codex websocket协议，使其包含必需的头部并在连接关闭时正确终止SSE流（[#1961](https://github.com/badlogic/pi-mono/issues/1961)）
- 修复WSL剪贴板图片回退，以正确处理缺失的剪贴板工具和权限错误（[#1722](https://github.com/badlogic/pi-mono/issues/1722)）
- 修复扩展`session_start`钩子在终端用户界面（TUI）准备就绪前触发，导致`session_start`处理器中的UI操作失败（[#2035](https://github.com/badlogic/pi-mono/issues/2035)）
- 修复了Windows shell和路径处理，使包管理器操作和自动补全能够正确处理驱动器字母和混合路径分隔符
- 修复了Bedrock提示缓存对非Claude模型启用的问题，导致API错误（[#2053](https://github.com/badlogic/pi-mono/issues/2053)）
- 修复了通过OpenAI兼容提供商使用Qwen模型的方法，增加了`qwen-chat-template`兼容模式，该模式使用Qwen的原生聊天模板格式（[#2020](https://github.com/badlogic/pi-mono/issues/2020)）
- 修复了Bedrock未签名思考回放，在处理空值或格式错误的思考区块边缘情况时（[#2063](https://github.com/badlogic/pi-mono/issues/2063)）
- 修复了无头剪贴板回退日志，在非交互式环境中不会产生多余的错误（[#2056](https://github.com/badlogic/pi-mono/issues/2056)）
- 修复了`models.json`提供商兼容标志在加载自定义模型定义时未被遵守的问题（[#2062](https://github.com/badlogic/pi-mono/issues/2062)）
- 修复了Claude Opus 4.6的高推理努力检测，改为通过模型ID匹配，而非要求显式能力标志（[#2040](https://github.com/badlogic/pi-mono/issues/2040)）
- 修复了包含Windows反斜杠的prompt当前工作目录，导致bash工具执行失败，已将其规范化为正斜杠（[#2080](https://github.com/badlogic/pi-mono/issues/2080)）
- 修复了编辑器粘贴，保留字面内容而非规范化换行，防止嵌入转义序列的文本内容被破坏（[#2064](https://github.com/badlogic/pi-mono/issues/2064)）
- 修复了技能发现，在存在嵌套SKILL.md文件时不会递归到技能根目录之外（[#2075](https://github.com/badlogic/pi-mono/issues/2075)）
- 修复了Tab补全，完成相对路径时保留`./`前缀（[#2087](https://github.com/badlogic/pi-mono/issues/2087)）
- 修复了npm包安装和查找与活动仓库的Node版本关联，增加了`npmCommand`作为argv风格的设置覆盖，用于包管理器操作（[#2072](https://github.com/badlogic/pi-mono/issues/2072)）
- 修复了`ctx.ui.getEditorText()`在扩展API中返回粘贴标记（例如`[paste #1 +24 lines]`）而非实际粘贴内容（[#2084](https://github.com/badlogic/pi-mono/issues/2084)）
- 修复了首次运行时下载`fd`/`ripgrep`时启动崩溃的问题，通过使用`pipeline()`替代`finished(readable.pipe(writable))`，使流错误能够正确捕获超时错误，并将下载超时时间从10秒增加到120秒（[#2066](https://github.com/badlogic/pi-mono/issues/2066)）

## [0.58.0] - 2026-03-14

### 新功能

- Claude Opus 4.6、Sonnet 4.6及相关Bedrock模型现在使用1M令牌的上下文窗口（从前的200K）（[#2135](https://github.com/badlogic/pi-mono/pull/2135) by [@mitsuhiko](https://github.com/mitsuhiko)）。

- 扩展工具调用现在默认并行执行，保持顺序`tool_call`预检以支持扩展拦截。

- 支持`GOOGLE_CLOUD_API_KEY`环境变量作为`google-vertex`提供者的替代方案（应用默认凭证）（[#1976](https://github.com/badlogic/pi-mono/pull/1976) by [@gordonhwc](https://github.com/gordonhwc)）。

- 扩展可提供确定性会话ID（`newSession()`）（[#2130](https://github.com/badlogic/pi-mono/pull/2130) by [@zhahaoyu](https://github.com/zhahaoyu)）。

### 新增

- 新增`GOOGLE_CLOUD_API_KEY`环境变量支持作为`google-vertex`提供者的替代方案（应用默认凭证）（[#1976](https://github.com/badlogic/pi-mono/pull/1976) by [@gordonhwc](https://github.com/gordonhwc)）。

- 新增`newSession()`扩展的自定义会话ID支持，用于需要确定性会话路径的场景（[#2130](https://github.com/badlogic/pi-mono/pull/2130) by [@zhahaoyu](https://github.com/zhahaoyu)）。

### 更改

- 更改扩展工具拦截，改用agent-core的`beforeToolCall`和`afterToolCall`钩子，而非基于wrapper的拦截。工具调用现在默认并行执行，扩展`tool_call`预检仍按顺序运行，最终工具结果按助手源顺序输出。

- 将Claude Opus 4.6、Sonnet 4.6及相关Bedrock模型的上下文窗口从200K提升至1M令牌（[#2135](https://github.com/badlogic/pi-mono/pull/2135) by [@mitsuhiko](https://github.com/mitsuhiko)）。

### 修复

- 修复`tool_call`扩展处理器在多工具轮询中观察到过期`sessionManager`状态的问题，通过在每次`tool_call`预检前清空排队的代理事件。在并行工具模式下，这保证了当前助手工具调用消息的状态，但不保证同一助手消息中的兄弟工具结果状态。

- 修复基于TUI的`Input`组件的交互输入字段，在处理宽Unicode文本（CJK、全宽字符）时按视觉列宽滚动，防止渲染行溢出和TUI崩溃（[#1982](https://github.com/badlogic/pi-mono/issues/1982)）。

- 修复`shift+tab`及其他修改后的Tab绑定在tmux中的问题，当`extended-keys-format`保持默认`xterm`时。

- 修复EXIF方向未在图像转换和缩放时应用，导致手机相机拍摄的JPEG和WebP图像显示旋转或镜像（[#2105](https://github.com/badlogic/pi-mono/pull/2105) by [@melihmucuk](https://github.com/melihmucuk)）。

- 修复默认编码代理系统提示符，仅包含当前日期的ISO格式，不包含当前时间，确保提示符前缀在重载和恢复会话中保持可缓存（[#2131](https://github.com/badlogic/pi-mono/issues/2131)）。

- 修复重试正则表达式，使其匹配`server_error`和`internal_error`等提供者的错误类型，提高自动重试覆盖范围（[#2117](https://github.com/badlogic/pi-mono/pull/2117) by [@MadKangYu](https://github.com/MadKangYu)）。

- 修复示例扩展，支持`PI_CODING_AGENT_DIR`环境变量用于自定义代理目录路径（[#2009](https://github.com/badlogic/pi-mono/pull/2009) by [@smithbm2316](https://github.com/smithbm2316)）。

- 修复`function_call_output`项目中OpenAI响应API提供者的工具结果图像未发送，导致工具结果中图像数据被静默丢弃（[#2104](https://github.com/badlogic/pi-mono/issues/2104)）。

- 修复`openai-completions`提供者发送的助手内容为结构化内容块而非纯字符串，导致与某些OpenAI兼容后端出现错误（[#2008](https://github.com/badlogic/pi-mono/pull/2008) by [@geraldoaax](https://github.com/geraldoaax)）。

- 修复OpenAI响应`response.failed`处理器的错误详情，包含状态码、错误码和消息，而非通用失败（[#1956](https://github.com/badlogic/pi-mono/pull/1956) by [@drewburr](https://github.com/drewburr)）。
- 修复GitHub Copilot设备码登录轮询，使其尊重OAuth慢速间隔，首次令牌轮询前等待，并在WSL/VM等环境中，当重复慢速导致超时时，提供更清晰的时钟漂移提示
- 修复对OpenAI兼容提供商的使用统计未被捕获的问题，这些提供商返回的使用数据遵循`choice.usage`而非标准的`chunk.usage`（例如Moonshot/Kimi）([#2017](https://github.com/badlogic/pi-mono/issues/2017))
- 修复在窄终端宽度下编辑器滚动指示器渲染崩溃([#2103](https://github.com/badlogic/pi-mono/pull/2103)由[@haoqixu](https://github.com/haoqixu)提交)
- 修复编辑器和输入粘贴中的制表符未被规范化为空格([#2027](https://github.com/badlogic/pi-mono/pull/2027), [#1975](https://github.com/badlogic/pi-mono/pull/1975)由[@haoqixu](https://github.com/haoqixu)提交)
- 修复`wordWrapLine`在宽字符（CJK、全角）正好位于换行边界时的溢出问题([#2082](https://github.com/badlogic/pi-mono/pull/2082)由[@haoqixu](https://github.com/haoqixu)提交)
- 修复编辑器单词换行和光标导航中，粘贴标记未被视为原子段([#2111](https://github.com/badlogic/pi-mono/pull/2111)由[@haoqixu](https://github.com/haoqixu)提交)

## [0.57.1] - 2026-03-07

### 新特性
- 在`/tree`中新增树分支折叠和段跳转导航，支持`Ctrl+←`/`Ctrl+→`及`Alt+←`/`Alt+→`快捷键，同时保留`←`/`→`及`Page Up`/`Page Down`用于分页。详见[docs/tree.md](docs/tree.md)和[docs/keybindings.md](docs/keybindings.md)。
- 新增`session_directory`扩展事件，用于会话管理器创建前定制会话目录路径。详见[docs/extensions.md](docs/extensions.md)。
- 在TUI键绑定系统中新增数字键绑定（`0-9`），包括修改后的组合键（如`ctrl+1`）。详见[docs/keybindings.md](docs/keybindings.md)。

### 新增
- 新增`/tree`分支折叠和段跳转导航，支持`Ctrl+←`/`Ctrl+→`及`Alt+←`/`Alt+→`，同时保留`←`/`→`及`Page Up`/`Page Down`用于分页([#1724](https://github.com/badlogic/pi-mono/pull/1724)由[@Perlence](https://github.com/Perlence)提交)
- 新增`session_directory`扩展事件，会在会话管理器创建前触发，允许扩展根据cwd等定制会话目录路径。CLI `--session-dir`标志优先于扩展提供的路径([#1730](https://github.com/badlogic/pi-mono/pull/1730)由[@hjanuschka](https://github.com/hjanuschka)提交)
- 新增数字键（`0-9`）到键绑定系统，支持Kitty CSI-u和xterm `modifyOtherKeys`的绑定（如`ctrl+1`）([#1905](https://github.com/badlogic/pi-mono/issues/1905))

### 修复
- 修复HTML导出中自定义工具折叠/展开的渲染问题。自定义工具在导出HTML时，若折叠与展开显示不同，将正确渲染可展开的节；若仅存在展开状态，则直接显示([#1934](https://github.com/badlogic/pi-mono/pull/1934)由[@aliou](https://github.com/aliou)提交)
- 修复tmux启动引导及键盘设置警告，包括Ghostty `shift+enter=text:\n`重映射引导和tmux `extended-keys-format`检测([#1872](https://github.com/badlogic/pi-mono/issues/1872))
- 修复z.ai上下文溢出恢复，使`model_context_window_exceeded`错误触发自动压缩，而非作为未处理的停止原因失败([#1937](https://github.com/badlogic/pi-mono/issues/1937))
- 修复自动补全选择忽略已输入文本：高亮跟随用户输入的第一个前缀匹配项，且精确匹配项在回车时始终被选中([#1931](https://github.com/badlogic/pi-mono/pull/1931)由[@aliou](https://github.com/aliou)提交)
- 修复斜杠命令Tab补全，使其在可用时立即打开参数补全([#1481](https://github.com/badlogic/pi-mono/pull/1481)由[@barapa](https://github.com/barapa)提交)
- 修复显式`pi -e <path>`扩展在命令和工具冲突时，优先级低于通过CLI加载的扩展([#1896](https://github.com/badlogic/pi-mono/issues/1896))
- 修复Windows外部编辑器启动（`Ctrl+G`和`ctx.ui.editor()`），使shell命令（如`EDITOR="code --wait"`）能正确工作([#1925](https://github.com/badlogic/pi-mono/issues/1925))

## [0.57.0] - 2026-03-07

### 新特性
- 扩展可以通过`before_provider_request`拦截并修改提供程序请求负载。请参阅[docs/extensions.md#before_provider_request](docs/extensions.md#before_provider_request)。
- 扩展UI可以使用显式焦点控制的非捕获叠加层，具体实现方式为`OverlayOptions.nonCapturing`和`OverlayHandle.focus()` / `unfocus()` / `isFocused()`。请参阅[docs/extensions.md](docs/extensions.md)和[../tui/README.md](../tui/README.md)。
- RPC模式现在使用严格的LF-only JSONL框架，以实现稳健的负载处理。请参阅[docs/rpc.md](docs/rpc.md)。

### 不兼容变更

- RPC模式现在使用严格的LF分隔JSONL框架。客户端必须仅在`\n`处拆分记录，而不是使用诸如Node `readline`之类的通用行读取器，后者也会在JSON负载内部分隔Unicode分隔符（[#1911](https://github.com/badlogic/pi-mono/issues/1911)）

### 新增

- 增加了`before_provider_request`扩展钩子，以便扩展可以在请求发出前检查或替换提供程序负载，示例见`examples/extensions/provider-payload.ts`
- 增加了非捕获叠加层焦点控制，用于扩展UI，具体实现方式为`OverlayOptions.nonCapturing`和`OverlayHandle.focus()` / `unfocus()` / `isFocused()`（[#1916](https://github.com/badlogic/pi-mono/pull/1916) by [@nicobailon](https://github.com/nicobailon)）

### 变更

- 扩展UI的叠加层合成现在使用焦点顺序，使聚焦的叠加层在保持堆叠语义的同时渲染在最上方（[#1916](https://github.com/badlogic/pi-mono/pull/1916) by [@nicobailon](https://github.com/nicobailon)）

### 修复

- 修复了RPC模式stdin/stdout框架，使其使用严格的LF分隔JSONL，而不是`readline`，因此不再因`U+2028`或`U+2029`导致命令或事件流损坏（[#1911](https://github.com/badlogic/pi-mono/issues/1911)）
- 修复了扩展UI中自动叠加层焦点恢复，跳过非捕获叠加层，并修复了叠加层隐藏行为，仅在隐藏的叠加层具有焦点时重新分配焦点（[#1916](https://github.com/badlogic/pi-mono/pull/1916) by [@nicobailon](https://github.com/nicobailon)）
- 修复了`pi config`在非git目录下误将`~/.agents/skills`识别为项目范围的问题，因此在`$HOME`下切换这些技能时不再向`.pi/settings.json`写入项目覆盖项（[#1915](https://github.com/badlogic/pi-mono/issues/1915)）
## [0.56.3] - 2026-03-06

### 新功能

- 可通过`google-antigravity`提供商获取`claude-sonnet-4-6`模型（[#1859](https://github.com/badlogic/pi-mono/issues/1859)）
- 自定义编辑器现在可以定义自己的`onEscape`/`onCtrlD`处理器，而不会被应用默认设置覆盖，从而支持vim-mode扩展（[#1838](https://github.com/badlogic/pi-mono/issues/1838)）
- Shift+Enter和Ctrl+Enter现在可通过xterm modifyOtherKeys回退在tmux中生效（[docs/tmux.md](docs/tmux.md)，[#1872](https://github.com/badlogic/pi-mono/issues/1872)）
- 自动压缩现在对持久化API错误（例如529 overloaded）具有鲁棒性，且压缩后不会误触发（[#1834](https://github.com/badlogic/pi-mono/issues/1834)，[#1860](https://github.com/badlogic/pi-mono/issues/1860)）

### 新增

- 为`google-antigravity`提供商新增`claude-sonnet-4-6`模型（[#1859](https://github.com/badlogic/pi-mono/issues/1859)）
- 新增[tmux设置文档](docs/tmux.md)以支持修改Enter键（[#1872](https://github.com/badlogic/pi-mono/issues/1872)）

### 修复

- 修复自定义编辑器的`onEscape`/`onCtrlD`处理器被应用级默认设置无条件覆盖的问题，使vim风格的转义处理成为可能（[#1838](https://github.com/badlogic/pi-mono/issues/1838)）
- 修复自动压缩在压缩后首次提示时因预压缩助手使用过期而误触发的问题（[#1860](https://github.com/badlogic/pi-mono/issues/1860)由[@joelhooks](https://github.com/joelhooks)提交）
- 修复在遇到持久化API错误（例如529 overloaded）时会话永远不会自动压缩的问题，通过从上次成功响应中估计上下文大小来解决（[#1834](https://github.com/badlogic/pi-mono/issues/1834)）
- 修复压缩摘要请求超出上下文限制的问题，通过将工具结果截断为2k字符来解决（[#1796](https://github.com/badlogic/pi-mono/issues/1796)）
- 修复`/new`启动时启动页内容（包括变更日志）仍然可见的问题（[#1880](https://github.com/badlogic/pi-mono/issues/1880)）
- 修复误导性的文档和示例，该示例暗示从工具的`execute`函数返回`{ isError: true }`会标记执行为失败；错误必须通过抛出异常来信号（[#1881](https://github.com/badlogic/pi-mono/issues/1881)）
-  修复了模型通过非推理模型切换以保留已保存的默认思考等级，而不是强制持久化能力限制的 `off` 限制 ([#1864](https://github.com/badlogic/pi-mono/issues/1864))
-  修复了并行 pi 进程因 `auth.json` 和 `settings.json` 的锁文件竞争导致的立即出现“未找到 API 密钥”错误的问题 ([#1871](https://github.com/badlogic/pi-mono/issues/1871))
-  修复了 OpenAI 响应推理回放的退化问题，该问题破坏了多轮推理的连续性 ([#1878](https://github.com/badlogic/pi-mono/issues/1878))

## [0.56.2] - 2026-03-05

###  新特性

-  支持 GPT-5.4 在 `openai`、`openai-codex`、`azure-openai-responses` 和 `opencode`，`gpt-5.4` 现在成为 `openai` 和 `openai-codex` 的默认值 ([README.md](README.md), [docs/providers.md](docs/providers.md))。
-  增加了 `treeFilterMode` 设置，用于选择默认的 `/tree` 过滤模式（`default`, `no-tools`, `user-only`, `labeled-only`, `all`） ([docs/settings.md](docs/settings.md), [#1852](https://github.com/badlogic/pi-mono/pull/1852) by [@lajarre](https://github.com/lajarre))。
-  Mistral 原生对话集成与 SDK 支持的提供者行为，保留 Mistral 特定的思考和回放语义 ([README.md](README.md), [docs/providers.md](docs/providers.md), [#1716](https://github.com/badlogic/pi-mono/issues/1716))。

###  增加了

-  增加了 `gpt-5.4` 模型在 `openai`、`openai-codex`、`azure-openai-responses` 和 `opencode` 提供者中的可用性。
-  增加了 `gpt-5.3-codex` 作为 `github-copilot` 的备用模型，直到上游模型目录包含它 ([#1853](https://github.com/badlogic/pi-mono/issues/1853))。
-  增加了 `treeFilterMode` 设置，用于选择默认的 `/tree` 过滤模式（`default`, `no-tools`, `user-only`, `labeled-only`, `all`） ([#1852](https://github.com/badlogic/pi-mono/pull/1852) by [@lajarre](https://github.com/lajarre))。

###  修改了

-  更新了 `openai` 和 `openai-codex` 提供者的默认模型为 `gpt-5.4`。

###  修复了

-  修复了 GPT-5.3 Codex 后续轮次中 OpenAI 响应助手 `phase` 元数据丢失的问题，通过在会话历史中保留可回放的签名并将 `phase` 回传至响应 API 来实现 ([#1819](https://github.com/badlogic/pi-mono/issues/1819))。
-  修复了 OpenAI 响应回放中省略空思考块，避免后续轮次出现无效的无操作推理项。
-  更新了 Mistral 集成，使用原生 SDK 支持的提供者和对话 API，包括编码代理模型/提供者连接和 Mistral 设置文档 ([#1716](https://github.com/badlogic/pi-mono/issues/1716))。
-  修复了反重力功能的可靠性：403/404 错误时的端点级联，增加了自动推送沙箱备用方案，移除了多余的指纹头部 ([#1830](https://github.com/badlogic/pi-mono/issues/1830))。
-  修复了 `@mariozechner/pi-ai/oauth` 扩展导入问题，通过直接从构建的 `dist` 文件中解析子路径，而不是通过包根目录的包装 shim 来解决 ([#1856](https://github.com/badlogic/pi-mono/issues/1856))。
-  修复了 Gemini 3 多轮工具使用中结构化上下文丢失的问题，通过使用 `skip_thought_signature_validator` 的哨兵代替文本回退来处理未签名函数调用 ([#1829](https://github.com/badlogic/pi-mono/issues/1829))。
-  修复了 VS Code 1.110+ 中模型选择器过滤器无法接受带类型字符的问题，原因是 `Input` 组件中缺少 Kitty CSI-u 可打印解码 ([#1857](https://github.com/badlogic/pi-mono/issues/1857))
-  修复了终端缩放时编辑器/页脚可见性漂移，强制在终端宽度或高度变化时进行完整重绘 ([#1844](https://github.com/badlogic/pi-mono/pull/1844) by [@ghoulr](https://github.com/ghoulr))。
-  修复了宽 Unicode 文本（会话名、模型、提供者）导致页脚宽度截断的问题，防止渲染行超出终端宽度时的 TUI 崩溃 ([#1833](https://github.com/badlogic/pi-mono/issues/1833))。
-  修复了 Windows 写入预览背景伪影，通过将 `\r\n` 的 CRLF 内容标准化为 LF 以实现工具输出预览的渲染 ([#1854](https://github.com/badlogic/pi-mono/issues/1854))。

## [0.56.1] - 2026-03-05

###  修复了

-  修复了扩展别名回退解析，使用 ESM 意识的解析方式处理全局安装中的 `jiti` 别名 ([#1821](https://github.com/badlogic/pi-mono/pull/1821) by [@Perlence](https://github.com/Perlence))
-  修复了 markdown 引用块渲染，隔离引用块样式与默认文本样式，防止样式泄漏。

## [0.56.0] - 2026-03-04
### 新功能

- 增加了对OpenCode Go提供程序的支持，包含`opencode-go`模型默认设置和`OPENCODE_API_KEY`环境变量支持（[docs/providers.md](docs/providers.md)，[#1757](https://github.com/badlogic/pi-mono/issues/1757)）。
- 增加了`branchSummary.skipPrompt`设置，用于跳过树导航时的分支摘要提示（[docs/settings.md](docs/settings.md)，[#1792](https://github.com/badlogic/pi-mono/issues/1792)）。
- 增加了`gemini-3.1-flash-lite-preview`备用模型，在Google提供程序目录中当上游模型元数据滞后时可用（[README.md](README.md)，[#1785](https://github.com/badlogic/pi-mono/issues/1785)）。

### 重大变更

- 更改了限定模型思考语义。没有显式`:<thinking>`后缀的限定条目，现在在被选中时会继承当前会话的思考层级，而不是应用启动时捕获的默认值。
- 将Node OAuth运行时导出移出顶层`@mariozechner/pi-ai`入口。OAuth登录和刷新必须从`@mariozechner/pi-ai/oauth`导入（[#1814](https://github.com/badlogic/pi-mono/issues/1814)）。

### 增加

- 增加了`branchSummary.skipPrompt`设置，用于跳过导航分支时的摘要提示（[#1792](https://github.com/badlogic/pi-mono/issues/1792)）。
- 增加了对OpenCode Go提供程序的支持，包含`opencode-go`模型默认设置和`OPENCODE_API_KEY`环境变量支持（[#1757](https://github.com/badlogic/pi-mono/issues/1757)）。
- 增加了`gemini-3.1-flash-lite-preview`备用模型，在提供程序目录中当上游目录滞后时可用（[#1785](https://github.com/badlogic/pi-mono/issues/1785)）。

### 更改

- 更新了Antigravity Gemini 3.1模型元数据和请求头，以匹配上游行为。

### 修复

- 修复了自定义扩展编辑器（`ctx.ui.editor()` / 扩展编辑器对话框）中IME硬件光标定位问题，通过将焦点传递给内部`Editor`，防止终端光标在输入过程中卡在右下角。
- 增加了OSC 133语义区域标记，用于在iTerm2、WezTerm、Kitty、Ghostty等兼容终端中支持用户消息的终端导航（[#1805](https://github.com/badlogic/pi-mono/issues/1805)）。
- 修复了TUI渲染器中markdown引用块导致嵌套列表内容丢失的问题（[#1787](https://github.com/badlogic/pi-mono/issues/1787)）。
- 修复了TUI宽度处理中区域指示符符号的问题，防止在流式处理过程中出现换行偏移和字符陈旧（[#1783](https://github.com/badlogic/pi-mono/issues/1783)）。
- 修复了Kitty CSI-u处理，忽略不支持的修饰符，使仅修饰符事件不会插入可打印字符（[#1807](https://github.com/badlogic/pi-mono/issues/1807)）。
- 修复了单行粘贴处理，确保文本原子插入，避免对大粘贴内容重复触发`@`自动补全扫描（[#1812](https://github.com/badlogic/pi-mono/issues/1812)）。
- 修复了扩展加载与新`@mariozechner/pi-ai/oauth`导出路径的兼容性，通过在扩展加载器和开发路径映射中别名oauth子路径（[#1814](https://github.com/badlogic/pi-mono/issues/1814)）。
- 修复了浏览器安全提供程序加载的回归问题，通过预加载Bedrock提供程序模块到编译后的Bun二进制文件，并针对新鲜工作区依赖重新构建二进制文件（[#1814](https://github.com/badlogic/pi-mono/issues/1814)）。
- 修复了GNU screen终端检测，将主题输出降级为256色模式以适配`screen*` TERM值（[#1809](https://github.com/badlogic/pi-mono/issues/1809)）。
- 修复了分支摘要队列处理，使在生成摘要时输入的消息能够被正确处理（[#1803](https://github.com/badlogic/pi-mono/issues/1803)）。
- 修复了压缩摘要请求，避免对非推理模型输出推理内容（[#1793](https://github.com/badlogic/pi-mono/issues/1793)）。
- 修复了溢出自动压缩的级联问题，防止单个溢出触发重复压缩循环。
- 修复了`models.json`，允许提供程序范围的自定义模型ID和模型级别的`baseUrl`覆盖（[#1759](https://github.com/badlogic/pi-mono/issues/1759)，[#1777](https://github.com/badlogic/pi-mono/issues/1777)）。
- 修复了会话选择器显示的净化，通过剥离会话显示文本中的控制字符（[#1747](https://github.com/badlogic/pi-mono/issues/1747)）。
- 修复了Groq Qwen3推理努力映射，使其兼容OpenAI模型（[#1745](https://github.com/badlogic/pi-mono/issues/1745)）。
- 修复了Bedrock `AWS_PROFILE`区域解析，使其尊重配置文件中的`region`值（[#1800](https://github.com/badlogic/pi-mono/issues/1800)）。
- 修复了Gemini 3.1思考层级检测，针对`google`和`google-vertex`提供程序（[#1785](https://github.com/badlogic/pi-mono/issues/1785)）。
- 修复了浏览器捆绑兼容性，通过从默认浏览器导入路径中移除仅Node的副作用来实现对`@mariozechner/pi-ai`的支持 ([#1814](https://github.com/badlogic/pi-mono/issues/1814))。

## [0.55.4] - 2026-03-02

### 新功能

- 运行时工具注册现在会在活跃会话中立即生效。通过`pi.registerTool()`在启动后注册的工具，可在`pi.getAllTools()`和LLM中使用，无需`/reload` ([docs/extensions.md](docs/extensions.md)，[examples/extensions/dynamic-tools.ts](examples/extensions/dynamic-tools.ts)，[#1720](https://github.com/badlogic/pi-mono/issues/1720))。

- 工具定义可自定义默认系统提示，使用`promptSnippet`（`Available tools`）和`promptGuidelines`（`Guidelines`）激活工具时生效 ([docs/extensions.md](docs/extensions.md)，[#1720](https://github.com/badlogic/pi-mono/issues/1720))。
-  自定义工具渲染器可以在交互式渲染时抑制转录输出，而不会留下额外的间距或空转录痕迹 ([docs/extensions.md](docs/extensions.md), [#1719](https://github.com/badlogic/pi-mono/pull/1719))。

###  增加了

-  增加了可选的 `promptSnippet` 到 `ToolDefinition`，用于默认系统提示符的 `Available tools` 部分的一行条目。已注册且处于活动状态的扩展工具会出现在那里 ([#1237](https://github.com/badlogic/pi-mono/pull/1237) by [@semtexzv](https://github.com/semtexzv))。
- 增加了可选的`promptGuidelines`到`ToolDefinition`，以便活动工具可以将工具特定的项目符号附加到默认系统提示`Guidelines`部分（[#1720](https://github.com/badlogic/pi-mono/issues/1720)）。

### 修复了

- 修复了`pi.registerTool()`会话初始化后的动态注册。在`session_start`及以后的处理程序中注册的工具现在会立即刷新、激活并可见于LLM，无需`/reload`（[#1720](https://github.com/badlogic/pi-mono/issues/1720)）。

- 修复了会话消息持久化顺序，通过序列化`AgentSession`事件处理，防止`toolResult`条目在异步扩展处理程序时被写入其对应助手工具调用消息之前（[#1717](https://github.com/badlogic/pi-mono/issues/1717)）。

- 修复了自定义工具渲染器有意抑制每次调用转录输出时出现的间距伪影，包括交互式流中的额外空白行和空自定义渲染器的非零转录足迹（[#1719](https://github.com/badlogic/pi-mono/pull/1719) 由[@alasano](https://github.com/alasano) 提交）
- 修复了`session.prompt()`在重试完成前提前返回的问题，通过在`agent_end`调度时同步创建重试承诺，解决了与早期排队事件处理器异步执行时的竞态问题（[#1726](https://github.com/badlogic/pi-mono/pull/1726) by [@pasky](https://github.com/pasky)）

## [0.55.3] - 2026-02-27

### 修复

- 将Windows系统的默认图片粘贴快捷键更改为`alt+v`，以避免与终端粘贴行为的`ctrl+v`冲突（[#1682](https://github.com/badlogic/pi-mono/pull/1682) by [@mrexodia](https://github.com/mrexodia)）

## [0.55.2] - 2026-02-27

### 新特性

- 扩展程序可通过`pi.unregisterProvider(name)`动态移除自定义提供程序，恢复任何被覆盖的内置模型，无需`/reload`（[docs](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/custom-provider.md)）。

- `pi.registerProvider()`在非初始扩展加载阶段调用时立即生效，无需`/reload`，解决了延迟注册的问题。

### 新增

- `pi.unregisterProvider(name)`可移除动态注册的提供程序及其模型，无需`/reload`。被提供程序覆盖的内置模型将被恢复（[#1669](https://github.com/badlogic/pi-mono/pull/1669) by [@aliou](https://github.com/aliou)）。

### 修复

- `pi.registerProvider()`在初始扩展加载阶段之后调用时立即生效（例如从命令处理器调用）。之前注册会处于待处理队列中，直到下一次`/reload`才被清空（[#1669](https://github.com/badlogic/pi-mono/pull/1669) by [@aliou](https://github.com/aliou)）。

- 修复了从无任何助手消息节点分叉时会重复出现会话头的问题。`createBranchedSession`现在会在分支路径无助手消息时，将文件创建操作推迟到`_persist()`，与`newSession()`的约定保持一致（[#1672](https://github.com/badlogic/pi-mono/pull/1672) by [@w-winter](https://github.com/w-winter)）。
- 修复了在进程挂起（例如通过`ctrl+z`）时SIGINT被传递给pi的问题，这可能会导致恢复时终端状态损坏（[#1668](https://github.com/badlogic/pi-mono/pull/1668) by [@aliou](https://github.com/aliou)）。
- 修复了Z.ai因使用错误的参数名称而导致思维功能始终启用并浪费令牌/延迟的问题（[#1674](https://github.com/badlogic/pi-mono/pull/1674) by [@okuyam2y](https://github.com/okuyam2y)）
- 修复了`redacted_thinking`块在Anthropic流式传输过程中被静默丢弃，以及与交错思维beta头部和温度参数一同发送的扩展思维相关的其他问题（[#1665](https://github.com/badlogic/pi-mono/pull/1665) by [@tctev](https://github.com/tctev)）
- 修复了`(external, cli)`用户代理标志导致Anthropic setup-token端点返回401错误的问题（[#1677](https://github.com/badlogic/pi-mono/pull/1677) by [@LazerLance777](https://github.com/LazerLance777)）
- 修复了当OpenAI兼容的提供者返回没有`choices`数组的片段时导致崩溃的问题（[#1671](https://github.com/badlogic/pi-mono/issues/1671)）

## [0.55.1] - 2026-02-26

### 新功能

- 通过`--offline`（或`PI_OFFLINE`）添加了离线启动模式，以禁用启动网络操作，同时添加启动网络超时以避免在受限或离线环境中卡顿。
- 为`google-gemini-cli`提供者添加了对`gemini-3.1-pro-preview`模型的支持（[#1599](https://github.com/badlogic/pi-mono/pull/1599) by [@audichuang](https://github.com/audichuang)）。

### 修复

- 修复了离线启动挂起的问题，通过在管理工具设置过程中添加离线启动行为和网络超时来实现（[#1631](https://github.com/badlogic/pi-mono/pull/1631) by [@mcollina](https://github.com/mcollina)）
- 修复了Windows VT输入初始化在ESM中的问题，通过加载koffi via createRequire来避免运行时和打包环境中的问题（[#1627](https://github.com/badlogic/pi-mono/pull/1627) by [@kaste](https://github.com/kaste)）
- 修复了Windows中Git Bash的管理`fd`/`rg`引导程序问题，通过使用`extract-zip`处理`.zip`归档、更健壮地搜索提取布局以及隔离提取临时目录来避免并发下载竞争（[#1348](https://github.com/badlogic/pi-mono/issues/1348)）
- 修复了Windows中解析`@sinclair/typebox`别名时加载扩展的问题，确保子路径导入如`@sinclair/typebox/compiler`能正确解析。
- 修复了Anthropic和Bedrock提供商中Claude Sonnet 4.6的自适应思维，并将不支持的`xhigh`努力值限制在支持的范围内（[#1548](https://github.com/badlogic/pi-mono/pull/1548) 由 [@tctev](https://github.com/tctev) 提交）
- 修复了Vertex ADC凭证检测竞态条件，通过避免在异步导入初始化时缓存错误的负结果来实现（[#1550](https://github.com/badlogic/pi-mono/pull/1550) 由 [@jeremiahgaylord-web](https://github.com/jeremiahgaylord-web) 提交）
- 修复了子代理扩展示例，使其从配置的代理目录解析用户代理，而不是硬编码路径（[#1559](https://github.com/badlogic/pi-mono/pull/1559) 由 [@tianshuwang](https://github.com/tianshuwang) 提交）

## [0.55.0] - 2026-02-24

### 不兼容变更

- 扩展、技能、提示、主题和斜杠命令名称冲突的资源优先级现在是项目优先（`cwd/.pi`）然后再是用户全局（`~/.pi/agent`）。如果你依赖于全局资源覆盖项目资源，需要重命名或调整资源顺序。
- 扩展注册冲突不再卸载整个后续扩展。所有扩展保持加载状态，冲突的命令/工具/标志名称通过加载顺序中的首次注册来解决。

## [0.54.2] - 2026-02-23

### 修复

- Fixed `.pi`文件夹在仅读取设置时不必要地创建。文件夹现在仅在写入项目特定设置时创建。
- Fixed扩展驱动的运行时主题更改以持久化设置，使`/settings`反映`currentTheme`在`ctx.ui.setTheme(...)`之后的活动状态（[#1483](https://github.com/badlogic/pi-mono/pull/1483) 由 [@ferologics](https://github.com/ferologics) 提交）
- Fixed交互模式在大流`write`工具调用时冻结，通过在部分参数流式传输时使用增量语法高亮，最终在工具调用参数完成后进行完整重高亮。

## [0.54.1] - 2026-02-22

### 修复

- 将koffi外部化到bun二进制构建中，每个平台的归档大小减少约15MB（例如darwin-arm64：43MB -> 28MB）。Koffi的Windows专用`.node`文件现在仅随Windows二进制文件一起分发。

## [0.54.0] - 2026-02-19

### 新增
- 增加默认技能自动发现功能，适用于`.agents/skills`位置。Pi现可从`.agents/skills`发现项目技能，并在`cwd`及其祖先目录（可达git仓库根目录，或非仓库环境下的文件系统根目录）中查找技能，同时还可以从`~/.agents/skills`获取全局技能，除了原有的`.pi`技能路径。

## [0.53.1] - 2026-02-19

### 更改

- 为所有内置提供者中当前暴露了它的提供者添加了Gemini 3.1模型目录条目：`google`、`google-vertex`、`opencode`、`openrouter`和`vercel-ai-gateway`。

- 将Claude Opus 4.6 Thinking添加到`google-antigravity`模型目录中。

## [0.53.0] - 2026-02-17

### 不兼容变更

- SDK消费者对`SettingsManager`持久化语义进行了更改。现在，设置项会立即更新内存状态并排队磁盘写入。需要持久化磁盘设置的代码必须调用`await settingsManager.flush()`。

- `AuthStorage`构造函数不再为公共权限。请使用静态工厂方法（`AuthStorage.create(...)`、`AuthStorage.fromStorage(...)`、`AuthStorage.inMemory(...)`）。这会破坏直接使用`new AuthStorage(...)`的代码。

### 增加

- 增加`SettingsManager.drainErrors()`，用于调用方控制的设置I/O错误处理，且无需管理端控制台输出。

- 增加认证存储后端（`FileAuthStorageBackend`、`InMemoryAuthStorageBackend`）和`AuthStorage.fromStorage(...)`用于以存储优先方式实现认证持久化。

- 增加Anthropic `claude-sonnet-4-6`模型降级条目至生成的模型定义中。

### 更改

- `SettingsManager`现在使用带作用域的存储抽象，对全局和项目设置采用基于作用域的锁定读/合并/写持久化。

### 修复

- 修复项目设置持久化，使其能够通过合并写入方式保留与外部无关的编辑，同时仍对已修改键的内存变更进行应用。

- 修复认证凭证持久化，使其能够通过锁定读/合并/写更新方式保留与外部无关的`auth.json`编辑。

- 修复认证加载/持久化错误提示，通过缓冲错误并借助`AuthStorage.drainErrors()`将其暴露出来。

## [0.52.12] - 2026-02-13
### 新增

- 新增 `transport`设置（`"sse"`、`"websocket"`、`"auto"`）到 `/settings`和`settings.json`，适用于支持多种传输方式的提供商（目前通过`openai-codex`的OpenAI Codex Responses）。

### 更改

- 交互模式现在会立即将传输更改应用到活动代理会话。
- 设置迁移现在会将旧版`websockets: boolean`映射到新的`transport`设置。

## [0.52.11] - 2026-02-13

### 新增

- 为`minimax`、`minimax-cn`、`openrouter`和`vercel-ai-gateway`提供商新增MiniMax M2.5模型条目，以及为`opencode`新增`minimax-m2.5-free`。

## [0.52.10] - 2026-02-12

### 新功能

- 通过`terminal_input`扩展终端输入拦截，允许扩展在常规TUI处理之前消费或转换原始输入。详见[docs/extensions.md](docs/extensions.md)。
- 扩展CLI模型选择：`--model`现在支持`provider/id`、模糊匹配和`:<thinking>`后缀。详见[README.md](README.md)和[docs/models.md](docs/models.md)。
- 更严格的git源解析和改进的本地路径规范化，提升了包源处理的安全性。详见[docs/packages.md](docs/packages.md)。
- 为OpenAI和OpenAI Codex提供商新增内置模型定义`gpt-5.3-codex-spark`。
- 改进了OpenAI流式传输的健壮性，以应对部分数据块中格式不正确的尾部工具调用JSON。
- 通过z.ai和OpenRouter提供商目录新增内置GLM-5模型支持。

### 重大变更

- `ContextUsage.tokens`和`ContextUsage.percent`现在为`number | null`。压缩后，上下文令牌计数在下一个LLM响应之前未知，因此这些字段返回`null`。读取`ContextUsage`的扩展必须处理`null`的情况。已从`ContextUsage`中移除`usageTokens`、`trailingTokens`和`lastUsageIndex`字段（不应公开的实现细节）([#1382](https://github.com/badlogic/pi-mono/pull/1382)由[@ferologics](https://github.com/ferologics)提交)
- Git 源解析现在严格，没有 `git:` 前缀：仅将协议 URL 视为 git（`https://`，`http://`，`ssh://`，`git://`）。简写源（如 `github.com/org/repo` 和 `git@github.com:org/repo`）现在需要 `git:` 前缀。([#1426](https://github.com/badlogic/pi-mono/issues/1426))

### 新增

- 新增扩展事件转发，用于消息和工具执行生命周期（`message_start`，`message_update`，`message_end`，`tool_execution_start`，`tool_execution_update`，`tool_execution_end`）([#1375](https://github.com/badlogic/pi-mono/pull/1375) 由 [@sumeet](https://github.com/sumeet) 提交)
- 新增 `terminal_input` 扩展事件，用于拦截、消费或转换原始终端输入，再进行正常 TUI 处理。
- 新增 `gpt-5.3-codex-spark` 模型定义，支持 OpenAI 和 OpenAI Codex 提供商（研究预览）。

### 变更

- 将 GitHub Copilot Claude 4.x 模型路由通过 Anthropic Messages API，并更新了 Copilot 头部处理，以适配 Claude 模型请求。

### 修复

- 修复了脚底栏中上下文使用百分比显示陈旧的预压缩值。压缩后，脚底栏将显示 `?/200k`，直到下一个 LLM 响应提供准确的使用数据（[#1382](https://github.com/badlogic/pi-mono/pull/1382) 由 [@ferologics](https://github.com/ferologics) 提交）
- 修复了 `_checkCompaction()` 使用第一条压缩条目而非最新条目，这可能导致在多次压缩时错误检测溢出（[#1382](https://github.com/badlogic/pi-mono/pull/1382) 由 [@ferologics](https://github.com/ferologics) 提交）
- `--model` 现在无需 `--provider`，支持 `provider/id` 语法、模糊匹配和 `:<thinking>` 后缀（例如 `--model sonnet:high`，`--model openai/gpt-4o`）([#1350](https://github.com/badlogic/pi-mono/pull/1350) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交）
- 修复了扩展源在路径规范化时使用第一条压缩条目而非最新条目，同时收紧了 git 源解析规则（[#1426](https://github.com/badlogic/pi-mono/issues/1426)）
- 修复了扩展终端输入监听器在会话重置时未被清除，可能导致残留监听器处于活动状态。
- 修复了 Termux 启动包名称，以支持 `fd` 安装（[#1433](https://github.com/badlogic/pi-mono/pull/1433)）
- 修复 `@` 文件自动补全的模糊匹配，优先匹配路径前缀和嵌套路径的段 ([#1423](https://github.com/badlogic/pi-mono/issues/1423))

- 修复 OpenAI 流式工具调用解析，允许容忍部分数据块中不规范的尾部 JSON ([#1424](https://github.com/badlogic/pi-mono/issues/1424))

## [0.52.9] - 2026-02-08

### 新特性

- 扩展功能可以通过 `ctx.reload()` 触发完整的运行时重载，适用于热重载配置或重启代理。详见 [docs/extensions.md](docs/extensions.md) 和 [`reload-runtime` 示例](examples/extensions/reload-runtime.ts) ([#1371](https://github.com/badlogic/pi-mono/issues/1371))

- 简短命令行禁用别名：`-ne` (`--no-extensions`)，`-ns` (`--no-skills`)，`-np` (`--no-prompt-templates`)，提升交互使用和脚本执行速度。

- `/export` HTML 现在包含可折叠的工具输入模式（参数名、类型和描述），改进了会话复审和共享流程 ([#1416](https://github.com/badlogic/pi-mono/pull/1416) 由 [@marchellodev](https://github.com/marchellodev) 提交)

- `pi.getAllTools()` 现在除了名称和描述外，还暴露了工具参数，支持更丰富的扩展集成 ([#1416](https://github.com/badlogic/pi-mono/pull/1416) 由 [@marchellodev](https://github.com/marchellodev) 提交)

### 新增

- 新增 `ctx.reload()` 到扩展 API，用于程序化运行时重载 ([#1371](https://github.com/badlogic/pi-mono/issues/1371))

- 新增禁用标志的简短别名：`-ne` 对 `--no-extensions`，`-ns` 对 `--no-skills`，`-np` 对 `--no-prompt-templates`

- `/export` HTML 现在在每个工具下方的可折叠区域包含工具输入模式（参数名、类型、描述） ([#1416](https://github.com/badlogic/pi-mono/pull/1416) 由 [@marchellodev](https://github.com/marchellodev) 提交)

- `pi.getAllTools()` 现在除了名称和描述外，还返回工具参数 ([#1416](https://github.com/badlogic/pi-mono/pull/1416) 由 [@marchellodev](https://github.com/marchellodev) 提交)

### 修复

- 修复扩展源解析，将点号前缀的本地路径（例如 `.pi/extensions/foo.ts`）视为本地路径而非 git URL
- 修复了Windows上因`unzip`不可用而导致的fd/rg下载失败问题；现在对`.tar.gz`和`.zip`的提取均使用`tar`，并带有正确的错误报告（[#1348](https://github.com/badlogic/pi-mono/issues/1348)）
- 修复了RPC模式文档中错误地将`ctx.hasUI`描述为`false`；实际应为`true`，因为对话框和即发即弃UI方法通过RPC子协议实现。同时补充了缺少的不支持/降级方法（`pasteToEditor`、`getAllThemes`、`getTheme`、`setTheme`）的文档（[#1411](https://github.com/badlogic/pi-mono/pull/1411) 由[@aliou](https://github.com/aliou)提交）
- 修复了`rg`在bash工具中不可用的问题，启动时会同时下载`fd`（[#1348](https://github.com/badlogic/pi-mono/issues/1348)）
- 修复了`custom-compaction`示例，改为使用`ModelRegistry`（[#1387](https://github.com/badlogic/pi-mono/issues/1387)）
- Google 提供商现在支持工具声明中的完整 JSON Schema（anyOf、oneOf、const 等）([#1398](https://github.com/badlogic/pi-mono/issues/1398) 由 [@jarib](https://github.com/jarib) 提交)
- 回滚了错误的反重力模型变更：将 `claude-opus-4-6-thinking` 回到 `claude-opus-4-5-thinking`（反重力端点上不存在该模型）
- 更新了反重力系统指令，使其成为更紧凑的版本，以兼容 Google Gemini CLI
- 修复了Claude Sonnet 4和4.5的opencode上下文窗口（[#1383](https://github.com/badlogic/pi-mono/issues/1383)）
- 修复了子代理示例中未知代理错误，使其包含可用代理名称（[#1414](https://github.com/badlogic/pi-mono/pull/1414) by [@dnouri](https://github.com/dnouri)）

## [0.52.8] - 2026-02-07
### 新功能

- 编辑器输入中的 Emacs 风格剪贴板（`ctrl+k`/`ctrl+y`/`alt+y`）和撤销（`ctrl+z`）（[#1373](https://github.com/badlogic/pi-mono/pull/1373) 由 [@Perlence](https://github.com/Perlence) 提交）
- OpenRouter `auto` 模型别名（`openrouter:auto`）实现自动模型路由（[#1361](https://github.com/badlogic/pi-mono/pull/1361) 由 [@yogasanas](https://github.com/yogasanas) 提交）
- 扩展程序可通过 `pasteToEditor` 在扩展程序 UI 上下文中将内容程序化地粘贴到编辑器中。详见 [docs/extensions.md](docs/extensions.md)（[#1351](https://github.com/badlogic/pi-mono/pull/1351) 由 [@kaofelix](https://github.com/kaofelix) 提交）
- 无效的 `pi <package> --help` 和无效子命令现在会显示有用的输出，而不是静默失败（[#1347](https://github.com/badlogic/pi-mono/pull/1347) 由 [@ferologics](https://github.com/ferologics) 提交）
### 已添加

- 已将 `pasteToEditor` 添加到扩展 UI 上下文中，以便程序编辑器粘贴（[#1351](https://github.com/badlogic/pi-mono/pull/1351) 由 [@kaofelix](https://github.com/kaofelix) 提交）
- 已添加包子命令帮助和无效命令的友好错误消息（[#1347](https://github.com/badlogic/pi-mono/pull/1347) 由 [@ferologics](https://github.com/ferologics) 提交）
- 已添加 OpenRouter `auto` 模型别名，实现自动模型路由（[#1361](https://github.com/badlogic/pi-mono/pull/1361) 由 [@yogasanas](https://github.com/yogasanas) 提交）
- 已将杀环（Ctrl+k/Ctrl+y/Alt+y）和撤销（Ctrl+z）支持添加到编辑器输入中（[#1373](https://github.com/badlogic/pi-mono/pull/1373) 由 [@Perlence](https://github.com/Perlence) 提交）

### 已更改
- 将默认模型替换为Opus 4.6（[#1345](https://github.com/badlogic/pi-mono/pull/1345) 由 [@calvin-hpnet](https://github.com/calvin-hpnet) 提交）

### 修复

- 修复临时git包缓存（`-e <git-url>`），使其在命中缓存时刷新未固定源，包括分离/无上游检出

- 修复当扩展自定义编辑器时中止重试（[#1364](https://github.com/badlogic/pi-mono/pull/1364) 由 [@Perlence](https://github.com/Perlence) 提交）

- 修复自动补全未传播到扩展创建的自定义编辑器（[#1372](https://github.com/badlogic/pi-mono/pull/1372) 由 [@Perlence](https://github.com/Perlence) 提交）

- 修复扩展关闭以使用干净的TUI关闭路径，防止遗留进程

## [0.52.7] - 2026-02-06

### 新特性

- 通过`modelOverrides`在`models.json`中实现按模型覆盖，允许自定义内置提供程序模型而不替换提供程序模型列表。详见[docs/models.md#per-model-overrides](docs/models.md#per-model-overrides)。

- `models.json`提供程序`models`现在通过`id`与内置模型合并，因此可以添加或替换匹配的内置模型而无需完全替换提供程序。详见[docs/models.md#overriding-built-in-providers](docs/models.md#overriding-built-in-providers)。

- 通过`AWS_BEDROCK_SKIP_AUTH`和`AWS_BEDROCK_FORCE_HTTP1`支持Bedrock代理对未认证端点的访问。详见[docs/providers.md](docs/providers.md)。
### 重大变更

- 将`models.json`提供者的`models`行为从完全替换更改为按ID合并内置模型。默认情况下，内置模型将被保留，自定义模型通过`id`进行合并更新。

### 新增

- 在`models.json`中新增`modelOverrides`，以实现每个提供者独立定制内置模型，而无需完全替换提供者（[#1332](https://github.com/badlogic/pi-mono/pull/1332)，由[@charles-cooper](https://github.com/charles-cooper)提交）
- 新增`AWS_BEDROCK_SKIP_AUTH`和`AWS_BEDROCK_FORCE_HTTP1`环境变量，用于连接未认证的Bedrock代理（[#1320](https://github.com/badlogic/pi-mono/pull/1320)，由[@virtuald](https://github.com/virtuald)提交）

### 修复

- 修复了仅思考型助手内容与后续工具执行区块之间存在多余空格的问题（当助手消息中无文本时）
- 修复了在阈值自动压缩后，排队的引导/后续/自定义消息仍卡住的问题，通过在代理层级队列中仍存在待处理消息时恢复代理循环来解决（[#1312](https://github.com/badlogic/pi-mono/pull/1312)，由[@ferologics](https://github.com/ferologics)提交）
- 修复了`tool_result`扩展处理器，使其能够跨处理器链式应用结果补丁，而非最后一处理器胜出的行为（[#1280](https://github.com/badlogic/pi-mono/issues/1280)）
- 修复了受损的认证锁文件处理，使其能优雅处理而非导致认证存储初始化崩溃（[#1322](https://github.com/badlogic/pi-mono/issues/1322)）
- 修复了Claude Opus 4.6中与交错式思维beta响应相关的固定基岩自适应思维处理（[#1323](https://github.com/badlogic/pi-mono/pull/1323) 由 [@markusylisiurunen](https://github.com/markusylisiurunen) 提交）
- 修复了OpenAI响应API请求，使其默认使用`store: false`，以避免服务器端历史记录日志（[#1308](https://github.com/badlogic/pi-mono/issues/1308)）
- 修复了交互模式启动，通过在加载资源后初始化自动补全来实现（[#1328](https://github.com/badlogic/pi-mono/issues/1328)）
- 修复了`modelOverrides`的合并行为，适用于嵌套对象，并记录了使用细节（[#1062](https://github.com/badlogic/pi-mono/issues/1062)）

## [0.52.6] - 2026-02-05

### 重大变更

- 移除了`/exit`命令处理。使用`/quit`退出（[#1303](https://github.com/badlogic/pi-mono/issues/1303)）

### 修复

- 修复了`/quit`被技能的模糊斜杠命令自动补全匹配遮蔽的问题，通过将`/quit`添加到内置命令自动补全中（[#1303](https://github.com/badlogic/pi-mono/issues/1303)）
- 修复了本地包源解析和设置规范化回归问题，该问题将相对路径误分类为git URL，并在重启后阻止了全局安装的本地包加载（[#1304](https://github.com/badlogic/pi-mono/issues/1304)）

## [0.52.5] - 2026-02-05

### 修复

- 修复了思维层级能力检测，使Anthropic Opus 4.6模型能够在选择器和循环中暴露`xhigh`

## [0.52.4] - 2026-02-05

### 修复
- 修复了当目录直接指定时，扩展设置不尊重`package.json` `pi.extensions`清单的问题（[#1302](https://github.com/badlogic/pi-mono/pull/1302)由[@hjanuschka](https://github.com/hjanuschka)提交）

## [0.52.3] - 2026-02-05

### 修复

- 修复了对未知主机的git包解析回退，使企业级git源（如`git:github.tools.sap/org/repo`）被当作git包处理，而非本地路径
- 修复了git包`@ref`的解析，支持简写、HTTPS和SSH源格式，包括带斜杠的分支引用
- 修复了Bedrock默认模型ID，从`us.anthropic.claude-opus-4-6-v1:0`更改为`us.anthropic.claude-opus-4-6-v1`
- 修复了Bedrock Opus 4.6模型元数据（ID、缓存定价），并添加了缺失的欧盟配置文件
- 修复了Claude Opus 4.6的上下文窗口元数据，Anthropic和OpenCode提供程序的上下文窗口调整为200000

## [0.52.2] - 2026-02-05

### 更改

- 将`anthropic`提供程序的默认模型更新为`claude-opus-4-6`
- 将`openai-codex`提供程序的默认模型更新为`gpt-5.3-codex`
- 将`amazon-bedrock`提供程序的默认模型更新为`us.anthropic.claude-opus-4-6-v1:0`
- 将`vercel-ai-gateway`提供程序的默认模型更新为`anthropic/claude-opus-4-6`
- 将`opencode`提供程序的默认模型更新为`claude-opus-4-6`

## [0.52.1] - 2026-02-05

## [0.52.0] - 2026-02-05

### 新增功能

- 支持Claude Opus 4.6模型。
- 支持GPT-5.3 Codex模型（仅限OpenAI Codex提供程序）。
- SSH URL支持git包。请参见[docs/packages.md](docs/packages.md)。
- `auth.json` API密钥现在支持Shell命令解析（`!command`）和环境变量查找。请参阅[docs/providers.md](docs/providers.md)。
- 模型选择器现在会显示所选模型名称。

### 已添加

- `auth.json`中的API密钥现在支持Shell命令解析（`!command`）和环境变量查找，与`models.json`中的行为一致
- 已添加`minimal-mode.ts`示例扩展，演示如何覆盖内置工具渲染以实现极简显示模式
- 已将Claude Opus 4.6模型添加到模型目录
- 已将GPT-5.3 Codex模型添加到模型目录（仅限OpenAI Codex提供者）
- 已支持SSH URL格式的git包（[#1287](https://github.com/badlogic/pi-mono/pull/1287) 由[@markusn](https://github.com/markusn) 提交）
- 模型选择器现在会显示所选模型名称（[#1275](https://github.com/badlogic/pi-mono/pull/1275) 由[@haoqixu](https://github.com/haoqixu) 提交）

### 修复了

- 修复了HTML导出时ANSI渲染的工具输出丢失缩进的问题（例如自定义工具结果中的JSON代码块）（[#1269](https://github.com/badlogic/pi-mono/pull/1269) 由[@aliou](https://github.com/aliou) 提交）
- 修复了在调用`prompt()`时，如果同时传入`images`和`streamingBehavior`，图像会被静默丢弃的问题。`steer()`、`followUp()`以及相应的RPC命令现在可选接收图像参数。（[#1271](https://github.com/badlogic/pi-mono/pull/1271) 由[@aliou](https://github.com/aliou) 提交）
- CLI `--help`, `--version`, `--list-models`, and `--export` 现在即使扩展保持事件循环活跃也会退出 ([#1285](https://github.com/badlogic/pi-mono/pull/1285) by [@ferologics](https://github.com/ferologics))
- 修复了模型发送格式错误的工具参数（对象而非字符串）时崩溃的问题 ([#1259](https://github.com/badlogic/pi-mono/issues/1259))
- 修复了自定义消息展开状态未被尊重的问题 ([#1258](https://github.com/badlogic/pi-mono/pull/1258) by [@Gurpartap](https://github.com/Gurpartap))
- 修复了技能加载器在扫描目录时对 .gitignore、.ignore 和 .fdignore 的支持

## [0.51.6] - 2026-02-04

### 新特性

- 可配置的恢复会话选择器的快捷键动作。详见 [docs/keybindings.md](docs/keybindings.md)。 ([#1249](https://github.com/badlogic/pi-mono/pull/1249) by [@juanibiapina](https://github.com/juanibiapina))

### 新增

- 新增 `resume` 为可配置的快捷键动作，允许用户绑定快捷键以打开会话恢复选择器（如 `newSession`、`tree` 和 `fork`） ([#1249](https://github.com/badlogic/pi-mono/pull/1249) by [@juanibiapina](https://github.com/juanibiapina))

### 更改

- 斜杠命令菜单现在即使其他行有内容也会在第一行触发，允许命令前置到已有文本中 ([#1227](https://github.com/badlogic/pi-mono/pull/1227) by [@aliou](https://github.com/aliou))

### 修复

- 加载技能时忽略未知的技能前置字段
- 修复 `/reload` 未能捕获全局设置.json 的更改 ([#1241](https://github.com/badlogic/pi-mono/issues/1241))
- 修复分叉会话，使分叉后用户消息得以持久化
- 修复分叉会话，改为写入新会话文件而非父会话文件（[#1242](https://github.com/badlogic/pi-mono/issues/1242)）
- 修复本地包移除功能，移除比较前统一路径格式（[#1243](https://github.com/badlogic/pi-mono/issues/1243)）
- 修复OpenAI Codex响应提供程序，使其尊重配置的baseUrl（[#1244](https://github.com/badlogic/pi-mono/issues/1244)）
- 修复`/settings`在窄终端崩溃的问题，通过处理设置列表中的小宽度实现（[#1246](https://github.com/badlogic/pi-mono/pull/1246) by [@haoqixu](https://github.com/haoqixu)）
- 修复Unix bash检测，当`/bin/bash`不可用时回退到PATH查找，包括Termux环境（[#1230](https://github.com/badlogic/pi-mono/pull/1230) by [@VaclavSynacek](https://github.com/VaclavSynacek)）

## [0.51.5] - 2026-02-04

### 更改

- 更改Bedrock模型生成，移除现已在上游处理的遗留临时解决方案（[#1239](https://github.com/badlogic/pi-mono/pull/1239) by [@unexge](https://github.com/unexge)）

### 修复

- 修复Windows包安装回归问题，采用shell执行而非`.cmd`解析（[#1220](https://github.com/badlogic/pi-mono/issues/1220)）

## [0.51.4] - 2026-02-03

### 新功能

- 分享链接默认改为pi.dev，由exe.dev捐赠。

### 更改

- 分享链接默认使用pi.dev，pi.dev和buildwithpi.ai仍可继续工作。
### 修复

- 修复输入滚动以避免表情符号序列拆分（[#1228](https://github.com/badlogic/pi-mono/pull/1228) by [@haoqixu](https://github.com/haoqixu)）

## [0.51.3] - 2026-02-03

### 新特性

- 通过 `ExtensionAPI.getCommands()` 实现扩展命令发现，附带 `commands.ts` 示例以展示调用模式。详见 [docs/extensions.md#pigetcommands](docs/extensions.md#pigetcommands) 和 [examples/extensions/commands.ts](examples/extensions/commands.ts)。

- 支持 `pi install` 和 `pi remove` 的本地路径，相对路径解析依据设置文件。详见 [docs/packages.md#local-paths](docs/packages.md#local-paths)。

### 重大变更

- RPC `get_commands` 响应和 `SlashCommandSource` 类型：为保持代码库一致性，将 `"template"` 重命名为 `"prompt"`

### 新增

- 新增 `ExtensionAPI.getCommands()`，允许扩展列出可用的斜杠命令（扩展、提示模板、技能），以便通过 `prompt` 调用（[#1210](https://github.com/badlogic/pi-mono/pull/1210) by [@w-winter](https://github.com/w-winter)）
- 新增 `commands.ts` 示例扩展，并导出 `SlashCommandInfo` 类型以支持命令发现集成（[#1210](https://github.com/badlogic/pi-mono/pull/1210) by [@w-winter](https://github.com/w-winter)）
- 新增 `pi install` 和 `pi remove` 的本地路径支持，相对路径存储于目标设置文件中（[#1216](https://github.com/badlogic/pi-mono/issues/1216)）

### 修复

- 修复默认思考等级持久化，确保根据设置推导出的默认值能正确保存和恢复
- 修复Windows包安装，通过解决`npm.cmd`，当`npm`不可直接执行时([#1220](https://github.com/badlogic/pi-mono/issues/1220))
- 修复xhigh思考级别支持检查，以接受gpt-5.2模型ID([#1209](https://github.com/badlogic/pi-mono/issues/1209))

## [0.51.2] - 2026-02-03

### 新功能

- 通过ExtensionUIContext的getToolsExpanded和setToolsExpanded控制扩展工具输出。详见[docs/extensions.md](docs/extensions.md)和[docs/rpc.md](docs/rpc.md)。

### 添加

- 添加ExtensionUIContext的getToolsExpanded和setToolsExpanded，用于控制工具输出扩展([#1199](https://github.com/badlogic/pi-mono/pull/1199)由[@academo](https://github.com/academo)提交)
- 添加安装方法检测，以显示特定包管理器的更新说明([#1203](https://github.com/badlogic/pi-mono/pull/1203)由[@Itsnotaka](https://github.com/Itsnotaka)提交)

### 修复

- 修复Kitty按键释放事件通过慢速SSH连接泄漏到父shell，通过退出时最多消耗1秒的stdin进行处理([#1204](https://github.com/badlogic/pi-mono/issues/1204))
- 修复编辑器中的旧版换行处理，以保持之前的换行行为
- 修复@自动补全以包含隐藏路径
- 修复提交回退以尊重配置的快捷键
- 修复扩展命令与内置命令冲突，通过跳过它们解决([#1196](https://github.com/badlogic/pi-mono/pull/1196)由[@haoqixu](https://github.com/haoqixu)提交)
- 修复以@开头的工具路径解析失败，通过剥离前缀解决([#1206](https://github.com/badlogic/pi-mono/issues/1206))
- 修复安装方法检测，避免使用过期缓存结果

## [0.51.1] - 2026-02-02

### 新功能

- **扩展API switchSession**：扩展现在可以通过`ctx.switchSession(sessionPath)`编程方式切换会话。详见[docs/extensions.md](docs/extensions.md)。([#1187](https://github.com/badlogic/pi-mono/issues/1187))

- **Clear on shrink设置**：新增`terminal.clearOnShrink`设置，当内容缩小时将编辑器和页脚固定在终端底部。由于重绘可能导致轻微闪烁。默认禁用。可通过`/settings`或`PI_CLEAR_ON_SHRINK=1`环境变量启用。

### 修复

- 修复注销后作用域模型无法找到有效凭证问题（[#1194](https://github.com/badlogic/pi-mono/pull/1194) 由[@terrorobe](https://github.com/terrorobe)提交）

- 修复Ctrl+D退出时因stdin缓冲区竞争导致关闭父SSH会话问题（[#1185](https://github.com/badlogic/pi-mono/issues/1185)）

- 修复编辑器输入中emoji光标定位问题（[#1183](https://github.com/badlogic/pi-mono/pull/1183) 由[@haoqixu](https://github.com/haoqixu)提交）

## [0.51.0] - 2026-02-01

### 破坏性变更
- **扩展工具签名变更**：`ToolDefinition.execute`现在使用`(toolCallId, params, signal, onUpdate, ctx)`参数顺序以匹配`AgentTool.execute`。之前是`(toolCallId, params, onUpdate, ctx, signal)`。这样将内置工具的包装变得非常简单，因为前四个参数现在对齐了。更新您的扩展，交换`signal`和`onUpdate`参数：
  ```ts
  // Before
  async execute(toolCallId, params, onUpdate, ctx, signal) { ... }

  // After
  async execute(toolCallId, params, signal, onUpdate, ctx) { ... }
  ```

### 新功能

- **Android/Termux支持**：Pi现在可通过Termux在Android上运行。安装方法：
  ```bash
  pkg install nodejs termux-api git
  npm install -g @mariozechner/pi-coding-agent
  mkdir -p ~/.pi/agent
  echo "You are running on Android in Termux." > ~/.pi/agent/AGENTS.md
  ```
剪贴板操作在`termux-api`不可用时可优雅回退。([#1164](https://github.com/badlogic/pi-mono/issues/1164))
- **Bash启动钩子**：扩展现在可通过`pi.setBashSpawnHook()`拦截并修改bash命令，执行前可调整命令字符串、工作目录或环境变量。详见[docs/extensions.md](docs/extensions.md)。([#1160](https://github.com/badlogic/pi-mono/pull/1160)由[@mitsuhiko](https://github.com/mitsuhiko)提交)
- **Linux ARM64 musl支持**：Pi现在可通过更新后的剪贴板依赖在Alpine Linux ARM64（linux-arm64-musl）上运行。
- **Nix/Guix支持**：`PI_PACKAGE_DIR`环境变量可覆盖内容寻址包管理器的包路径，适用于store路径分词较差的情况。详见[README.md#environment-variables](README.md#environment-variables)。([#1153](https://github.com/badlogic/pi-mono/pull/1153)由[@odysseus0](https://github.com/odysseus0)提交)
- **命名会话筛选器**：`/resume` 选择器现在支持通过 Ctrl+N 筛选，仅显示命名会话。可通过 `toggleSessionNamedFilter` 快捷键进行配置。详见 [docs/keybindings.md](docs/keybindings.md)。([#1128](https://github.com/badlogic/pi-mono/pull/1128) by [@w-winter](https://github.com/w-winter))

- **类型工具调用事件**：扩展开发者可使用 `isToolCallEventType()` 筛选 `ToolCallEvent` 类型，以获得更好的 TypeScript 支持。详见 [docs/extensions.md#tool-call-events](docs/extensions.md#tool-call-events)。([#1147](https://github.com/badlogic/pi-mono/pull/1147) by [@giuseppeg](https://github.com/giuseppeg))

- **扩展 UI 协议**：完整的 RPC 文档和示例，用于扩展对话框和通知，使无头客户端能够支持交互式扩展。详见 [docs/rpc.md#extension-ui-protocol](docs/rpc.md#extension-ui-protocol)。([#1144](https://github.com/badlogic/pi-mono/pull/1144) by [@aliou](https://github.com/aliou))

### 新增

- 新增 Linux ARM64 musl（Alpine Linux）支持，通过剪贴板依赖更新实现
- 新增 Android/Termux 支持，提供优雅的剪贴板回退功能 ([#1164](https://github.com/badlogic/pi-mono/issues/1164))
- 新增 bash 工具生成钩子支持，可在执行前调整命令、工作目录和环境变量 ([#1160](https://github.com/badlogic/pi-mono/pull/1160) by [@mitsuhiko](https://github.com/mitsuhiko))
- 新增带 `isToolCallEventType()` 类型保护的 `ToolCallEvent.input` 类型工具，以缩小内置工具事件范围 ([#1147](https://github.com/badlogic/pi-mono/pull/1147) by [@giuseppeg](https://github.com/giuseppeg))
- 导出 `discoverAndLoadExtensions` 以支持扩展测试，无需本地仓库克隆 ([#1148](https://github.com/badlogic/pi-mono/issues/1148))
- 增加了扩展UI协议的RPC文档，涵盖所有扩展对话和通知的请求/响应类型（[#1144](https://github.com/badlogic/pi-mono/pull/1144) by [@aliou](https://github.com/aliou)）
- 增加了`rpc-demo.ts`示例扩展，演示所有RPC支持的扩展UI方法（[#1144](https://github.com/badlogic/pi-mono/pull/1144) by [@aliou](https://github.com/aliou)）
- 增加了`rpc-extension-ui.ts` TUI示例客户端，演示带有交互式对话的扩展UI协议（[#1144](https://github.com/badlogic/pi-mono/pull/1144) by [@aliou](https://github.com/aliou)）
- 增加了`PI_PACKAGE_DIR`环境变量，用于覆盖内容寻址包管理器（Nix，Guix）的包路径，这些管理器在存储路径分词时表现不佳（[#1153](https://github.com/badlogic/pi-mono/pull/1153) by [@odysseus0](https://github.com/odysseus0)）
- `/resume` 会话选择器现在支持仅显示命名会话的过滤器切换（默认快捷键 Ctrl+N，可通过 `toggleSessionNamedFilter` 配置）  
[#1128](https://github.com/badlogic/pi-mono/pull/1128) 由 [@w-winter](https://github.com/w-winter) 提交

### 修复

- 修复 `pi update` 在未传入参数时无法更新 npm/git 包的问题  
[#1151](https://github.com/badlogic/pi-mono/issues/1151)

- 修复 `models.json` 验证要求字段被文档标记为可选。模型定义现在仅要求 `id`；其余字段（`name`、`reasoning`、`input`、`cost`、`contextWindow`、`maxTokens`）均设有合理的默认值。  
[#1146](https://github.com/badlogic/pi-mono/issues/1146)
- 修复了技能文件中相对路径从当前工作目录（cwd）而不是技能目录解析的问题，通过在技能前言中添加明确的指导来实现（[#1136](https://github.com/badlogic/pi-mono/issues/1136)）
- 修复了树选择器在导航条目时丢失焦点状态的问题（[#1142](https://github.com/badlogic/pi-mono/pull/1142)，由[@Perlence](https://github.com/Perlence)提交）
- 修复了`cacheRetention`选项未在`buildBaseOptions`中传递的问题（[#1154](https://github.com/badlogic/pi-mono/issues/1154)）
- 修复了OAuth登录/刷新未使用HTTP代理设置（`HTTP_PROXY`，`HTTPS_PROXY`环境变量）的问题（[#1132](https://github.com/badlogic/pi-mono/issues/1132)）
- 修复了`pi update <source>`在源仅全局注册时本地安装包的问题（[#1163](https://github.com/badlogic/pi-mono/pull/1163)，由[@aliou](https://github.com/aliou)提交）
- 修复了树导航总结功能覆盖编辑器内容的问题，即在总结等待期间输入的内容被覆盖（[#1169](https://github.com/badlogic/pi-mono/pull/1169)，由[@aliou](https://github.com/aliou)提交）

## [0.50.9] - 2026-02-01

### 新增

- 新增了`titlebar-spinner.ts`示例扩展，该扩展会在代理工作时在终端标题中显示盲文旋转动画。
- 新增了`PI_AI_ANTIGRAVITY_VERSION`环境变量文档说明，以帮助用户理解（[#1129](https://github.com/badlogic/pi-mono/issues/1129)）
- 新增了`cacheRetention`流选项，包含提供方特定的映射用于提示缓存控制，默认采用短时保留策略（[#1134](https://github.com/badlogic/pi-mono/issues/1134)）

## [0.50.8] - 2026-02-01

### 新增
- 添加了`newSession`、`tree`和`fork`快捷键操作，对应`/new`、`/tree`和`/fork`命令。默认未绑定。([#1114](https://github.com/badlogic/pi-mono/pull/1114) by [@juanibiapina](https://github.com/juanibiapina))
- 添加了`retry.maxDelayMs`设置，用于限制服务器请求的最大重试延迟。当提供程序请求更长的延迟（例如，Google的“配额将在5小时后重置”）时，请求将立即失败并返回信息性错误，而不是静默等待。默认值：60000毫秒（60秒）。([#1123](https://github.com/badlogic/pi-mono/issues/1123))
- `/resume`会话选择器：新的“线程”排序模式（现在为默认模式）基于分叉关系以树结构显示会话。紧凑的一行格式，右侧显示消息计数和年龄。([#1124](https://github.com/badlogic/pi-mono/pull/1124) by [@pasky](https://github.com/pasky))
- 添加了Qwen CLI OAuth提供程序扩展示例。([#940](https://github.com/badlogic/pi-mono/pull/940) by [@4h9fbZ](https://github.com/4h9fbZ))
- 添加了OAuth `modifyModels`钩子支持，允许在注册时为已注册的扩展提供程序添加支持。([#940](https://github.com/badlogic/pi-mono/pull/940) by [@4h9fbZ](https://github.com/4h9fbZ))
- 添加了Qwen思考格式支持，用于通过`enable_thinking`实现与OpenAI兼容的补全。([#940](https://github.com/badlogic/pi-mono/pull/940) by [@4h9fbZ](https://github.com/4h9fbZ))
- 添加了垂直光标导航的粘性列跟踪，以便编辑器在跨短行移动时恢复首选列。([#1120](https://github.com/badlogic/pi-mono/pull/1120) by [@Perlence](https://github.com/Perlence))
- 增加了`resources_discover`扩展钩子，以在启动和重新加载时提供额外的技能、提示和主题。

### 修复了

- 修复了`switchSession()`在恢复时将无用的`thinking_level_change`条目追加到会话日志的问题。`setThinkingLevel()`现在是幂等的。([#1118](https://github.com/badlogic/pi-mono/issues/1118))
- 修复了在WSL2/WSLg中粘贴剪贴板图像时，当剪贴板提供`image/bmp`格式时生成无效PNG文件的问题。现在BMP图像在保存前会转换为PNG。([#1112](https://github.com/badlogic/pi-mono/pull/1112) 由[@lightningRalf](https://github.com/lightningRalf)提交)
- 修复了Kitty键盘协议的基础布局回退，防止非QWERTY布局触发错误快捷键。([#1096](https://github.com/badlogic/pi-mono/pull/1096) 由[@rytswd](https://github.com/rytswd)提交)

## [0.50.7] - 2026-01-31

### 修复了

- 包中的多文件扩展现在可以正确工作。包解析现在使用与本地扩展相同的发现逻辑：仅从子目录加载`index.ts`（或清单中声明的条目），而不是辅助模块。([#1102](https://github.com/badlogic/pi-mono/issues/1102))

## [0.50.6] - 2026-01-30

### 增加了

- 在扩展上下文中增加了`ctx.getSystemPrompt()`，用于访问当前有效的系统提示。([#1098](https://github.com/badlogic/pi-mono/pull/1098) 由[@kaofelix](https://github.com/kaofelix)提交)

### 修复了

- 修复了内容缩小（例如关闭`/tree`、清空多行编辑器）时，页脚下方出现空行的问题。([#1095](https://github.com/badlogic/pi-mono/pull/1095) 由[@marckrenn](https://github.com/marckrenn)提交)
- 终端光标在通过`stop()`退出TUI时保持隐藏，即使有渲染任务待处理（[#1099](https://github.com/badlogic/pi-mono/pull/1099) by [@haoqixu](https://github.com/haoqixu)）

## [0.50.5] - 2026-01-30

## [0.50.4] - 2026-01-30

### 新功能

- **对SSH/mosh的OSC 52剪贴板支持** - `/copy`命令现在可通过使用OSC 52终端转义序列支持远程连接。不再需要在SSH下使用pi时的剪贴板烦恼。([#1069](https://github.com/badlogic/pi-mono/issues/1069) by [@gturkoglu](https://github.com/gturkoglu))

- **Vercel AI网关路由** - 通过Vercel的AI网关路由请求，支持提供商故障转移和负载均衡。可通过models.json中的`vercelGatewayRouting`进行配置。([#1051](https://github.com/badlogic/pi-mono/pull/1051) by [@ben-vargas](https://github.com/ben-vargas))
- **字符跳转导航** - Bash/Readline风格的字符搜索：Ctrl+]向前跳转到下一个字符出现的位置，Ctrl+Alt+]向后跳转。([#1074](https://github.com/badlogic/pi-mono/pull/1074) 由 [@Perlence](https://github.com/Perlence) 提交)
- **Emacs风格的Ctrl+B/Ctrl+F导航** - 编辑器中单词导航（光标向左/向右移动单词）的替代按键绑定。([#1053](https://github.com/badlogic/pi-mono/pull/1053) 由 [@ninlds](https://github.com/ninlds) 提交)
- **行边界导航** - 编辑器在按下向上键时跳转到第一可视行的行首，在按下向下键时跳转到最后一可视行的行尾。([#1050](https://github.com/badlogic/pi-mono/pull/1050) 由 [@4h9fbZ](https://github.com/4h9fbZ) 提交)
- **性能优化** - 优化了 TUI 中的图像行检测和盒子渲染缓存，以提高渲染性能。([#1084](https://github.com/badlogic/pi-mono/pull/1084) by [@can1357](https://github.com/can1357))
- **`set_session_name` RPC 命令** - 无头客户端现在可以编程设置会话显示名称。([#1075](https://github.com/badlogic/pi-mono/pull/1075) by [@dnouri](https://github.com/dnouri))
- **禁用双转义行为** - 新增 `"none"` 选项，用于完全禁用 `doubleEscapeAction` 的双转义快捷键。([#973](https://github.com/badlogic/pi-mono/issues/973) by [@juanibiapina](https://github.com/juanibiapina))

### 新增

- 新增 "none" 选项至 `doubleEscapeAction` 设置，以完全禁用双转义行为 ([#973](https://github.com/badlogic/pi-mono/issues/973) by [@juanibiapina](https://github.com/juanibiapina))
- 新增对 SSH/mosh 会话的 OSC 52 剪贴板支持。`/copy` 现在可在远程连接中使用。([#1069](https://github.com/badlogic/pi-mono/issues/1069) by [@gturkoglu](https://github.com/gturkoglu))
- 新增通过 `vercelGatewayRouting` 在 models.json 中对 Vercel AI Gateway 路由的支持 ([#1051](https://github.com/badlogic/pi-mono/pull/1051) by [@ben-vargas](https://github.com/ben-vargas))
- 新增 Ctrl+B 和 Ctrl+F 快捷键，用于编辑器中光标单词左右导航 ([#1053](https://github.com/badlogic/pi-mono/pull/1053) by [@ninlds](https://github.com/ninlds))
- 新增字符跳转导航：Ctrl+] 向前跳转到下一个字符，Ctrl+Alt+] 向后跳转 ([#1074](https://github.com/badlogic/pi-mono/pull/1074) by [@Perlence](https://github.com/Perlence))
- 编辑器现在在按下向上键时跳转到第一可视行的行首，在按下向下键时跳转到最后一可视行的行尾（[#1050](https://github.com/badlogic/pi-mono/pull/1050) by [@4h9fbZ](https://github.com/4h9fbZ)）
- 优化了图像行检测和盒子渲染缓存，以提高TUI性能（[#1084](https://github.com/badlogic/pi-mono/pull/1084) by [@can1357](https://github.com/can1357)）
- 为无头客户端添加了`set_session_name` RPC命令，用于设置会话显示名称（[#1075](https://github.com/badlogic/pi-mono/pull/1075) by [@dnouri](https://github.com/dnouri)）

### 修复

- 读取工具现在可以处理macOS文件名中的花括号引号（U+2019）和NFD Unicode归一化（[#1078](https://github.com/badlogic/pi-mono/issues/1078)）
- 扫描包资源以查找技能、提示、主题和扩展时，尊重.gitignore、.ignore和.fdignore文件（[#1072](https://github.com/badlogic/pi-mono/issues/1072)）
- 修复了当提供程序省略输入时工具调用参数默认值的问题（[#1065](https://github.com/badlogic/pi-mono/issues/1065)）
- settings.json中的无效JSON不再导致文件被重写为空设置（[#1054](https://github.com/badlogic/pi-mono/issues/1054)）
- 配置选择器现在会在扩展程序显示名称重复时显示文件夹名称（[#1064](https://github.com/badlogic/pi-mono/pull/1064) by [@Graffioh](https://github.com/Graffioh)）

## [0.50.3] - 2026-01-29

### 新功能

- **Kimi For Coding提供程序**：访问Moonshot AI的Anthropic兼容编码API。设置`KIMI_API_KEY`环境变量。详见[README.md#kimi-for-coding](README.md#kimi-for-coding)。

### 添加
- 增加了Kimi For Coding提供商支持（Moonshot AI的Anthropic兼容编码API）。设置`KIMI_API_KEY`环境变量。详见[README.md#kimi-for-coding](README.md#kimi-for-coding)。

### 修复了

- 恢复会话时，资源现在会出现在消息之前，防止已加载的上下文出现在聊天底部。

## [0.50.2] - 2026-01-29

### 新增功能

- **Hugging Face提供商**：通过OpenAI兼容的推理路由器访问Hugging Face模型。设置`HF_TOKEN`环境变量。详见[README.md#hugging-face](README.md#hugging-face)。
- **扩展提示缓存**：`PI_CACHE_RETENTION=long`启用Anthropic 1小时缓存（默认5分钟）和OpenAI 24小时缓存（默认内存）。仅适用于直接API调用。详见[README.md#prompt-caching](README.md#prompt-caching)。
- **可配置自动补全高度**：`autocompleteMaxVisible`设置（3-20个项目，默认5）控制下拉菜单大小。可通过`/settings`或`settings.json`调整。
- **Shell风格快捷键**：`alt+b`/`alt+f`用于单词导航，`ctrl+d`用于向前删除字符。详见[docs/keybindings.md](docs/keybindings.md)。
- **RPC `get_commands`**：无头客户端现在可以按程序方式列出可用命令。详见[docs/rpc.md](docs/rpc.md)。

### 增加了

- 通过OpenAI兼容的推理路由器增加了Hugging Face提供商支持（[#994](https://github.com/badlogic/pi-mono/issues/994)）。
- 增加了`PI_CACHE_RETENTION`环境变量，用于控制Anthropic（5分钟 vs 1小时）和OpenAI（内存 vs 24小时）的缓存TTL。设置为`long`以实现更长的保留时间。([#967](https://github.com/badlogic/pi-mono/issues/967))
- 增加了`autocompleteMaxVisible`设置，用于可配置自动补全下拉高度（3-20个项目，默认5）([#972](https://github.com/badlogic/pi-mono/pull/972) by [@masonc15](https://github.com/masonc15))
- 增加了`/files`命令，用于列出当前会话中的所有文件操作（读取、写入、编辑）
- 增加了shell风格的快捷键：`alt+b`/`alt+f`用于单词导航，`ctrl+d`用于删除光标前方字符（当编辑器中有文本时）([#1043](https://github.com/badlogic/pi-mono/issues/1043) by [@jasonish](https://github.com/jasonish))
- 增加了`get_commands` RPC方法，用于无头客户端列出可用命令([#995](https://github.com/badlogic/pi-mono/pull/995) by [@dnouri](https://github.com/dnouri))

### 更改了

- 优化了`extractCursorPosition`在TUI中的性能：反向扫描行，当光标在视口上方时提前退出([#1004](https://github.com/badlogic/pi-mono/pull/1004) by [@can1357](https://github.com/can1357))
- 自动补全改进：更好地处理部分匹配和边缘情况([#1024](https://github.com/badlogic/pi-mono/pull/1024) by [@Perlence](https://github.com/Perlence))

### 修复了
- 对`settings.json`的外部编辑现在在pi重新加载或保存无关设置时会保留。以前，直接编辑settings.json（例如从`packages`数组中移除一个包）会在下次pi启动时自动设置器（如`setLastChangelogVersion()`）触发保存时静默还原。
- 修复了启用`quietStartup`时自定义头部未正确显示的问题（[#1039](https://github.com/badlogic/pi-mono/pull/1039) 由 [@tudoroancea](https://github.com/tudoroancea) 提交）
- 空数组的包过滤现在会禁用所有资源，而不是回退到清单默认值（[#1044](https://github.com/badlogic/pi-mono/issues/1044)）
- 重试计数器现在会在每次成功的LLM响应后重置，而不是跨工具使用轮次累积（[#1019](https://github.com/badlogic/pi-mono/issues/1019)）
- 修复了警告消息中`.md`文件名错误的问题（[#1041](https://github.com/badlogic/pi-mono/issues/1041) 由 [@llimllib](https://github.com/llimllib) 提交）
- 修复了终端变窄时页脚中提供商名称隐藏的问题（[#981](https://github.com/badlogic/pi-mono/pull/981) 由 [@Perlence](https://github.com/Perlence) 提交）
- 修复了反斜杠输入缓冲导致编辑器中字符延迟显示的问题（[#1037](https://github.com/badlogic/pi-mono/pull/1037) 由 [@Perlence](https://github.com/Perlence) 提交）
- 修复了Markdown表格渲染，确保正确显示行分隔符和最小列宽（[#997](https://github.com/badlogic/pi-mono/pull/997) 由 [@tmustier](https://github.com/tmustier) 提交）
- 修复了OpenAI补全`toolChoice`处理的问题（[#998](https://github.com/badlogic/pi-mono/pull/998) 由 [@williamtwomey](https://github.com/williamtwomey) 提交）
- 固定跨提供商交接失败，当从OpenAI响应API提供商切换时，由于管道分隔的工具调用ID（[#1022](https://github.com/badlogic/pi-mono/issues/1022)）
- 修复了429速率限制错误错误触发自动压缩，而不是重试并回退（[#1038](https://github.com/badlogic/pi-mono/issues/1038)）
- 修复了Anthropic提供商以处理`sensitive` API返回的stop_reason（[#978](https://github.com/badlogic/pi-mono/issues/978)）
- 修复了DeepSeek API的兼容性，通过检测`deepseek.com` URL并禁用不支持的`developer`角色（[#1048](https://github.com/badlogic/pi-mono/issues/1048)）
- 修复了Anthropic提供商在代理省略`message_delta`事件中的输入token计数时保持输入token计数（[#1045](https://github.com/badlogic/pi-mono/issues/1045)）
- 修复了`autocompleteMaxVisible`设置未能持久化到`settings.json`

## [0.50.1] - 2026-01-26

### 修复了

- Git扩展更新现在会优雅地处理强制推送的远程，而不是失败（[#961](https://github.com/badlogic/pi-mono/pull/961)由[@aliou](https://github.com/aliou)提交）
- 扩展`ctx.newSession({ setup })`现在在设置回调运行后正确同步代理状态并渲染消息（[#968](https://github.com/badlogic/pi-mono/issues/968)）
- 修复了扩展UI绑定在没有扩展时启动时未初始化，这在`/reload`后破坏了UI方法
- 修复了`/hotkeys`输出到大写标题的扩展热键（[#969](https://github.com/badlogic/pi-mono/pull/969)由[@Perlence](https://github.com/Perlence)提交）
- 修复了模型目录生成以排除已弃用的OpenCode Zen模型（[#970](https://github.com/badlogic/pi-mono/pull/970)由[@DanielTatarkin](https://github.com/DanielTatarkin)提交）
- 修复了git扩展删除以修剪空目录

## [0.50.0] - 2026-01-26

### 新功能
- 包用于捆绑和安装扩展、技能、提示和主题。请参阅[docs/packages.md](docs/packages.md)。  
- 支持热重载（`/reload`）资源，包括AGENTS.md、SYSTEM.md、APPEND_SYSTEM.md、提示模板、技能、主题和扩展。请参阅[README.md#commands](README.md#commands)和[README.md#context-files](README.md#context-files)。  
- 通过`pi.registerProvider()`自定义提供程序支持代理、自定义端点、OAuth或SSO流程以及非标准流式API。请参阅[docs/custom-provider.md](docs/custom-provider.md)。  
- 支持Azure OpenAI响应提供程序，具备部署感知模型映射。请参阅[docs/providers.md#azure-openai](docs/providers.md#azure-openai)。  
- 支持通过`openRouterRouting`的OpenRouter路由自定义模型。请参阅[docs/providers.md#api-keys](docs/providers.md#api-keys)和[docs/models.md](docs/models.md)。  
- 技能调用消息现在可折叠，技能可通过`disable-model-invocation`选择不参与模型调用。请参阅[docs/skills.md#frontmatter](docs/skills.md#frontmatter)。  
- 会话选择器重命名及可配置快捷键绑定。请参阅[README.md#commands](README.md#commands)和[docs/keybindings.md](docs/keybindings.md)。  
- `models.json`头部可解析环境变量和shell命令。请参阅[docs/models.md#value-resolution](docs/models.md#value-resolution)。  
- `--verbose` CLI标志可覆盖安静启动。请参阅[README.md#cli-reference](README.md#cli-reference)。

请在`README.md`阅读完整重制的文档，或让您的clanker为您阅读。
### SDK 迁移指南

自 v0.49.3 版本以来，SDK 存在多项破坏性变更。为了实现最快迁移，请将您的代理指向 `packages/coding-agent/docs/sdk.md`，SDK 示例位于 `packages/coding-agent/examples/sdk`，SDK 源代码位于 `packages/coding-agent/src/core/sdk.ts` 及相关模块。

### 破坏性变更

- 在 `models.json` 中，头部值现在会解析环境变量（如果头部值与环境变量名称匹配，则使用环境变量的值）。如果字面量头部值意外与环境变量名称匹配，可能会导致行为改变。([#909](https://github.com/badlogic/pi-mono/issues/909))
- 外部包（npm/git）现在通过 settings.json 中的 `packages` 数组进行配置，而非 `extensions`。`extensions` 中现有的 npm:/git: 入口将自动迁移。([#645](https://github.com/badlogic/pi-mono/issues/645))
- 资源加载现在仅使用 `ResourceLoader`，settings.json 中的扩展、技能、提示和主题使用数组格式。([#645](https://github.com/badlogic/pi-mono/issues/645))
- 移除了 `discoverAuthStorage` 和 `discoverModels`。`AuthStorage` 和 `ModelRegistry` 现在默认使用 `~/.pi/agent` 路径，除非您传递 `agentDir`。([#645](https://github.com/badlogic/pi-mono/issues/645))

### 新增
- 通过`Ctrl+R`在不打开会话的情况下，对`/resume`选择器进行会话重命名（[#863](https://github.com/badlogic/pi-mono/pull/863) by [@svkozak](https://github.com/svkozak)）
- 会话选择器的快捷键现在可配置（[#948](https://github.com/badlogic/pi-mono/pull/948) by [@aos](https://github.com/aos)）
- 为技能添加`disable-model-invocation`前置字段，以防止代理调用，同时仍允许显式`/skill:name`命令（[#927](https://github.com/badlogic/pi-mono/issues/927)）
- 暴露`copyToClipboard`扩展工具（[#926](https://github.com/badlogic/pi-mono/issues/926) by [@mitsuhiko](https://github.com/mitsuhiko)）
- 技能调用消息现在可在聊天输出中折叠，默认折叠，显示技能名称和展开提示（[#894](https://github.com/badlogic/pi-mono/issues/894)）
- `models.json`中的头部值现在支持环境变量和shell命令，与`apiKey`匹配（[#909](https://github.com/badlogic/pi-mono/issues/909)）
- 为API请求添加HTTP代理环境变量支持（[#942](https://github.com/badlogic/pi-mono/pull/942) by [@haoqixu](https://github.com/haoqixu)）
- 通过`openRouterRouting`兼容字段添加OpenRouter提供商路由支持，用于自定义模型（[#859](https://github.com/badlogic/pi-mono/pull/859) by [@v01dpr1mr0s3](https://github.com/v01dpr1mr0s3)）
- 添加`azure-openai-responses`提供商支持Azure OpenAI Responses API（[#890](https://github.com/badlogic/pi-mono/pull/890) by [@markusylisiurunen](https://github.com/markusylisiurunen)）
- 在更新通知中添加变更日志链接（[#925](https://github.com/badlogic/pi-mono/pull/925) by [@dannote](https://github.com/dannote)）
- 增加了`--verbose` CLI标志以覆盖quietStartup设置（[#906](https://github.com/badlogic/pi-mono/pull/906)由[@Perlence](https://github.com/Perlence)提交）
- 增加了`markdown.codeBlockIndent`设置以自定义渲染输出中的代码块缩进
- 使用`pi install`、`pi remove`、`pi update`和`pi list`命令进行扩展包管理（[#645](https://github.com/badlogic/pi-mono/issues/645)）
- 包过滤：使用`packages`数组的对象形式选择性加载资源（[#645](https://github.com/badlogic/pi-mono/issues/645)）
- 在包过滤、顶级设置数组和pi清单中支持glob模式（例如`"!funky.json"`、`"*.ts"`）（[#645](https://github.com/badlogic/pi-mono/issues/645)）
- 增加了`/reload`命令以重新加载扩展、技能、提示和主题（[#645](https://github.com/badlogic/pi-mono/issues/645)）
- 增加了`pi config`命令，通过TUI启用/禁用包和顶级资源（[#938](https://github.com/badlogic/pi-mono/issues/938)）
- 为`--skill`、`--prompt-template`、`--theme`、`--no-prompt-templates`和`--no-themes`添加CLI标志（[#645](https://github.com/badlogic/pi-mono/issues/645)）
- 包去重：如果同一包出现在全局和项目设置中，项目设置优先（[#645](https://github.com/badlogic/pi-mono/issues/645)）
- 所有资源类型统一使用`ResourceDiagnostic`类型进行冲突报告（[#645](https://github.com/badlogic/pi-mono/issues/645)）
- 如果可用多个提供者，则在页脚同时显示提供者和模型
- 通过`pi.registerProvider()`支持自定义提供程序，使用`streamSimple`实现自定义API  
- 增加了`custom-provider.ts`示例扩展，演示带有OAuth的自定义Anthropic提供程序  

### 更改了  

- `/resume`选择器排序切换移动到`Ctrl+S`，以释放`Ctrl+R`用于重命名（[#863](https://github.com/badlogic/pi-mono/pull/863) by [@svkozak](https://github.com/svkozak)）  
- HTML导出：点击侧边栏消息现在会导航到其最新子节点并滚动到该位置，而不是截断分支（[#853](https://github.com/badlogic/pi-mono/pull/853) by [@mitsuhiko](https://github.com/mitsuhiko)）  
- HTML导出：活动路径现在以视觉方式高亮显示，非活动路径节点变暗（[#929](https://github.com/badlogic/pi-mono/pull/929) by [@hewliyang](https://github.com/hewliyang)）  
- Azure OpenAI响应提供程序现在使用基础URL配置，结合部署感知模型映射，不再包含服务层级处理  
- `/reload`现在重新渲染整个回滚内容，以便更新的扩展组件立即可见（[#928](https://github.com/badlogic/pi-mono/pull/928) by [@ferologics](https://github.com/ferologics)）  
- 技能、提示模板和主题发现现在使用设置和CLI路径数组，而非旧版过滤器（[#645](https://github.com/badlogic/pi-mono/issues/645)）  

### 修复了
- 扩展 `setWorkingMessage()` 调用现在可在 `agent_start` 处理器中正常工作；此前该消息因加载动画尚未存在而被静默忽略（[#935](https://github.com/badlogic/pi-mono/issues/935)）
- 修复了包自动发现以尊重加载器规则、配置覆盖和强制排除模式
- 修复了 /reload 重新加载后正确恢复编辑器（[#949](https://github.com/badlogic/pi-mono/pull/949) 由 [@Perlence](https://github.com/Perlence) 提交）
- 修复了分布式主题破坏 `/export`（[#946](https://github.com/badlogic/pi-mono/pull/946) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交）
- 修复了启动提示以澄清思维等级选择并扩展思维引导
- 修复了 SDK 初始模型解析以使用 `findInitialModel`，并默认为 Anthropic 模型使用 Claude Opus 4.5
- 修复了无模型警告以包含 `/model` 指令
- 修复了身份验证错误消息以指向身份验证文档
- 修复了 bash 输出提示行以截断至终端宽度
- 修复了自定义编辑器以尊重 `paddingX` 设置（[#936](https://github.com/badlogic/pi-mono/pull/936) 由 [@Perlence](https://github.com/Perlence) 提交）
- 修复了系统提示工具列表以仅显示内置工具
- 修复了包管理器以在使用缓存副本之前检查 npm 包版本
- 修复了包管理器在克隆包含 package.json 的 git 仓库后运行 `npm install`
- 修复了扩展提供商注册以在模型解析前应用
- 修复编辑器多行插入处理和lastAction跟踪（[#945](https://github.com/badlogic/pi-mono/pull/945) by [@Perlence](https://github.com/Perlence)）
- 修复编辑器单词换行以保留光标列（[#934](https://github.com/badlogic/pi-mono/pull/934) by [@Perlence](https://github.com/Perlence)）
- 修复编辑器单词换行以使用单次回溯处理空白字符（[#924](https://github.com/badlogic/pi-mono/pull/924) by [@Perlence](https://github.com/Perlence)）
- 修复Kitty图像ID分配和清理以防止图像ID冲突
- 修复终端缩放后覆盖层保持居中（[#950](https://github.com/badlogic/pi-mono/pull/950) by [@nicobailon](https://github.com/nicobailon)）
- 修复流式分发以使用模型API类型而非硬编码API默认值
- 修复Google提供商在省略时将工具调用参数默认为空对象
- 修复了将OpenAI响应流固定到处理`arguments.done`事件的OpenAI兼容端点的功能（[#917](https://github.com/badlogic/pi-mono/pull/917) 由 [@williballenthin](https://github.com/williballenthin) 提交）
- 修复了在共享响应重构后处理OpenAI Codex响应工具严格性的功能
- 修复了Azure OpenAI响应流以保护内容部分之前的数据差异并修正元数据和交接控制
- 修复了在连续工具结果后对OpenAI补全工具结果图像进行批处理的功能（[#902](https://github.com/badlogic/pi-mono/pull/902) 由 [@terrorobe](https://github.com/terrorobe) 提交）
- bash输出“更早行”计数的偏移错误，由将换行符空间计为隐藏内容引起（[#921](https://github.com/badlogic/pi-mono/issues/921)）
- 用户包过滤器现在叠加在清单过滤器之上，而不是替换它们（[#645](https://github.com/badlogic/pi-mono/issues/645)）
- 自动重试现在可以处理Codex API流式失败时的“终止”错误
- 后续队列（Alt+Enter）现在发送完整的粘贴内容，而不是`[paste #N ...]`标记（[#912](https://github.com/badlogic/pi-mono/issues/912)）
- 修复了Alt-Up未在压缩期间恢复排队消息的问题（[#923](https://github.com/badlogic/pi-mono/pull/923) 由[@aliou](https://github.com/aliou)提交）
- 修复了加载空或无效会话文件时因使用`--session`标志而导致的会话损坏问题（[#932](https://github.com/badlogic/pi-mono/issues/932) 由[@armanddp](https://github.com/armanddp)提交）
- 修复了当扩展程序也使用`setEditorComponent()`时，扩展程序快捷方式未触发的问题（[#947](https://github.com/badlogic/pi-mono/pull/947) 由[@Perlence](https://github.com/Perlence)提交）
- 会话“修改”时间现在使用最后一条消息的时间戳，而不是文件的mtime，因此重命名不会重新排序最近列表（[#863](https://github.com/badlogic/pi-mono/pull/863) 由[@svkozak](https://github.com/svkozak)提交）

## [0.49.3] - 2026-01-22

### 添加了

- `markdown.codeBlockIndent`设置，用于自定义渲染输出中代码块的缩进（[#855](https://github.com/badlogic/pi-mono/pull/855) 由[@terrorobe](https://github.com/terrorobe)提交）
- 增加了`inline-bash.ts`示例扩展，用于扩展`!{command}`提示中的模式（[#881](https://github.com/badlogic/pi-mono/pull/881) by [@scutifer](https://github.com/scutifer)）
- 增加了`antigravity-image-gen.ts`示例扩展，用于通过Google Antigravity进行AI图像生成（[#893](https://github.com/badlogic/pi-mono/pull/893) by [@ben-vargas](https://github.com/ben-vargas)）
- 增加了`PI_SHARE_VIEWER_URL`环境变量，用于自定义共享查看器URL（[#889](https://github.com/badlogic/pi-mono/pull/889) by [@andresaraujo](https://github.com/andresaraujo)）
- 增加了Alt+Delete作为快捷键，用于向前删除单词（[#878](https://github.com/badlogic/pi-mono/pull/878) by [@Perlence](https://github.com/Perlence)）

### 更改了

- 树选择器：将标签筛选快捷键从`l`更改为`Shift+L`，以便用户可以搜索包含“l”的条目（[#861](https://github.com/badlogic/pi-mono/pull/861) by [@mitsuhiko](https://github.com/mitsuhiko)）
- 模糊匹配现在会为连续匹配评分更高，以提高搜索相关性（[#860](https://github.com/badlogic/pi-mono/pull/860) by [@mitsuhiko](https://github.com/mitsuhiko)）

### 修复了

- 修复了错误消息显示硬编码的`~/.pi/agent/`路径，而不是尊重`PI_CODING_AGENT_DIR`（[#887](https://github.com/badlogic/pi-mono/pull/887) by [@aliou](https://github.com/aliou)）
- 修复了`write`工具在执行失败时未在UI中显示错误（[#856](https://github.com/badlogic/pi-mono/issues/856)）
- 修复了HTML导出使用默认主题，而不是用户激活的主题（[#870](https://github.com/badlogic/pi-mono/pull/870) by [@scutifer](https://github.com/scutifer)）
- 在页脚和终端/标签标题中显示会话名称（[#876](https://github.com/badlogic/pi-mono/pull/876) 由 [@scutifer](https://github.com/scutifer) 提交）
- 修复了Terminal.app中的256色回退，以防止颜色渲染问题（[#869](https://github.com/badlogic/pi-mono/pull/869) 由 [@Perlence](https://github.com/Perlence) 提交）
- 修复了视口跟踪和光标定位，适用于叠加层和内容缩小场景
- 修复了自动补全，允许搜索包含 `/` 字符（例如 `folder1/folder2`）（[#882](https://github.com/badlogic/pi-mono/pull/882) 由 [@richardgill](https://github.com/richardgill) 提交）
- 修复了自动链接邮件显示冗余 `(mailto:...)` 后缀（[#888](https://github.com/badlogic/pi-mono/pull/888) 由 [@terrorobe](https://github.com/terrorobe) 提交）
- 修复了`@`文件自动补全在目录后添加空格，导致无法继续在子目录中自动补全

## [0.49.2] - 2026-01-19

### 添加

- 添加了通过 `widgetPlacement` 在 `pi.addWidget()` 中对扩展小部件进行小部件放置的选项（[#850](https://github.com/badlogic/pi-mono/pull/850) 由 [@marckrenn](https://github.com/marckrenn) 提交）
- 添加了AWS凭证检测，适用于ECS/Kubernetes环境：`AWS_CONTAINER_CREDENTIALS_RELATIVE_URI`，`AWS_CONTAINER_CREDENTIALS_FULL_URI`，`AWS_WEB_IDENTITY_TOKEN_FILE`（[#848](https://github.com/badlogic/pi-mono/issues/848)）
- 在 `/settings` 中添加“安静启动”设置（[#847](https://github.com/badlogic/pi-mono/pull/847) 由 [@unexge](https://github.com/unexge) 提交）

### 更改

- HTML导出现在包含JSONL下载按钮，点击可跳转到最后一条消息，并修复了缺失的标签（[#853](https://github.com/badlogic/pi-mono/pull/853) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交）
- 优化OAuth认证失败的错误提示（凭证过期、离线状态）而非通用的“未找到API密钥”([#849](https://github.com/badlogic/pi-mono/pull/849) 由 [@zedrdave](https://github.com/zedrdave) 提交)

### 修复
- 修复`/model`选择器作用域切换功能，以便在保存作用域模型时可在所有模型和作用域模型之间切换([#844](https://github.com/badlogic/pi-mono/issues/844))
- 修复OpenAI响应400错误“推理未遵循项目”在回放中断的轮次时([#838](https://github.com/badlogic/pi-mono/pull/838))
- 修复pi在取消恢复会话选择时退出代码为0

### 移除

- 移除models.json模式中的`strictResponsesPairing`兼容选项（不再需要）

## [0.49.1] - 2026-01-18

### 添加

- 添加`strictResponsesPairing`兼容选项，用于Azure上的自定义OpenAI响应模型([#768](https://github.com/badlogic/pi-mono/pull/768) 由 [@prateekmedia](https://github.com/prateekmedia) 提交)
- 会话选择器（`/resume`）现在支持路径显示切换（`Ctrl+P`）和会话删除（`Ctrl+D`），并带有内联确认功能([#816](https://github.com/badlogic/pi-mono/pull/816) 由 [@w-winter](https://github.com/w-winter) 提交)
- 在交互模式中添加Ctrl+-快捷键的撤销支持功能([#831](https://github.com/badlogic/pi-mono/pull/831) 由 [@Perlence](https://github.com/Perlence) 提交)

### 更改
- 分享链接现在使用哈希片段（`#`）而不是查询字符串（`?`）来防止将会话ID发送到buildwithpi.ai（[#829](https://github.com/badlogic/pi-mono/pull/829) 由 [@terrorobe](https://github.com/terrorobe) 提交）
- 现在可以通过使用`!`前缀的shell命令从`models.json`中检索API密钥（例如，macOS Keychain的`"apiKey": "!security find-generic-password -ws 'anthropic'"`）（[#762](https://github.com/badlogic/pi-mono/pull/762) 由 [@cv](https://github.com/cv) 提交）

### 修复

- 修复了在使用输入法编辑器（例如中文输入法）过滤菜单时IME候选项窗口显示在错误位置的问题。具有搜索输入的组件现在能够正确传递焦点状态以进行光标定位。（[#827](https://github.com/badlogic/pi-mono/issues/827)）
- 修复了扩展快捷键冲突，使其在内置操作被重新映射时能够尊重用户的按键绑定。（[#826](https://github.com/badlogic/pi-mono/pull/826) 由 [@richardgill](https://github.com/richardgill) 提交）
- 修复了独立编译二进制文件中的固定光子 WASM 加载问题。
- 修复了跨供应商交接（例如 Codex 到反重力 Claude）的工具调用 ID 规范化问题 ([#821](https://github.com/badlogic/pi-mono/issues/821))

## [0.49.0] - 2026-01-17

### 添加了
- `pi.setLabel(entryId, label)`在 ExtensionAPI 中用于从扩展设置每条记录标签的功能 ([#806](https://github.com/badlogic/pi-mono/issues/806))
- 导出`keyHint`、`appKeyHint`、`editorKey`、`appKey`、`rawKeyHint`，以便扩展能够格式化快捷键提示，保持一致性（[#802](https://github.com/badlogic/pi-mono/pull/802) 由 [@dannote](https://github.com/dannote) 提交）
- 导出`VERSION`包索引并更新了自定义头部示例。([#798](https://github.com/badlogic/pi-mono/pull/798) by [@tallshort](https://github.com/tallshort))
- 添加`showHardwareCursor`设置以控制光标可见性，同时仍对其进行定位以支持IME功能。([#800](https://github.com/badlogic/pi-mono/pull/800) by [@ghoulr](https://github.com/ghoulr))
- 在交互式编辑器中添加了Emacs风格的kill ring编辑功能，支持yank和yank-pop快捷键，以及对旧版Alt+字母处理和Alt+D删除向前单词的支持。([#810](https://github.com/badlogic/pi-mono/pull/810) by [@Perlence](https://github.com/Perlence))
- 为扩展上下文添加了`ctx.compact()`和`ctx.getContextUsage()`，用于程序化压缩和上下文使用检查。
- 为交互模式下的delete word forward和kill ring快捷键添加了文档说明。([#810](https://github.com/badlogic/pi-mono/pull/810) by [@Perlence](https://github.com/Perlence))

### 更改

- 更新了默认系统提示词，以明确pi harness和文档范围。
- 简化了Codex系统提示处理，直接使用默认系统提示以处理Codex指令。

### 修复

- 修复了photon模块在ESM上下文中加载失败的问题，错误信息为“require is not defined”([#795](https://github.com/badlogic/pi-mono/pull/795) by [@dannote](https://github.com/dannote))
- 修复了扩展触发压缩时压缩UI未显示的问题。
- 修复了因助手消息出现错误而导致的Codex API错误所引发的孤立工具结果问题。当助手消息包含`stopReason: "error"`时，其工具调用将不再计入待处理工具跟踪中，从而防止因特定转换器丢弃调用而生成合成工具结果。([#812](https://github.com/badlogic/pi-mono/issues/812))

- 修复了Bedrock Claude的最大tokens处理，使其始终超出思考预算tokens，避免了压缩失败。([#797](https://github.com/badlogic/pi-mono/pull/797) by [@pjtf93](https://github.com/pjtf93))

- 修复了Claude Code工具名称的规范化，使其与Claude Code工具列表进行不区分大小写的匹配，并移除无效映射。

### 移除了

- 移除了`pi-internal://`路径解析功能，从读取工具中移除。

## [0.48.0] - 2026-01-16

### 添加了

- 添加了`quietStartup`设置，用于静音启动输出（版本标题、加载的上下文信息、模型范围行）。变更日志通知仍然会显示。([#777](https://github.com/badlogic/pi-mono/pull/777) by [@ribelo](https://github.com/ribelo))

- 添加了`editorPaddingX`设置，用于输入编辑器的水平内边距（0-3，默认值：0）

- 添加了`shellCommandPrefix`设置，用于在每次bash执行前添加命令，从而在非交互式shell中启用别名扩展（例如，`"shellCommandPrefix": "shopt -s expand_aliases"`）([#790](https://github.com/badlogic/pi-mono/pull/790) by [@richardgill](https://github.com/richardgill))

- 添加了bash风格的参数切片功能，用于提示模板([#770](https://github.com/badlogic/pi-mono/pull/770) by [@airtonix](https://github.com/airtonix))
- 扩展命令可通过`getArgumentCompletions`在`pi.registerCommand()`中提供参数自动补全（[#775](https://github.com/badlogic/pi-mono/pull/775) by [@ribelo](https://github.com/ribelo)）
- Bash工具现在在UI中显示超时值，当设置超时时（[#780](https://github.com/badlogic/pi-mono/pull/780) by [@dannote](https://github.com/dannote)）
- 导出`getShellConfig`，以便扩展检测用户的shell环境（[#766](https://github.com/badlogic/pi-mono/pull/766) by [@dannote](https://github.com/dannote)）
- 将`thinkingText`和`selectedBg`添加到主题模式中（[#763](https://github.com/badlogic/pi-mono/pull/763) by [@scutifer](https://github.com/scutifer)）
- `navigateTree()`现在支持`replaceInstructions`选项，可完全替换默认摘要提示，并支持`label`选项，可为分支摘要条目附加标签（[#787](https://github.com/badlogic/pi-mono/pull/787) by [@mitsuhiko](https://github.com/mitsuhiko)）

### 修复

- 修复了摘要失败时（例如配额超出）自动压缩崩溃的问题。现在会显示错误信息，而不是崩溃（[#792](https://github.com/badlogic/pi-mono/issues/792)）
- 修复了`--session <UUID>`，在本地未找到时可全局搜索其他项目，并支持从其他项目复制会话（[#785](https://github.com/badlogic/pi-mono/pull/785) by [@ribelo](https://github.com/ribelo)）
- 修复了Linux上独立二进制WASM加载问题（[#784](https://github.com/badlogic/pi-mono/issues/784)）
- 修复了工具参数中的字符串数字在验证时未被强制转换为数字的问题（[#786](https://github.com/badlogic/pi-mono/pull/786) by [@dannote](https://github.com/dannote)）
- 修复了`--no-extensions`标志未能阻止扩展发现的问题（[#776](https://github.com/badlogic/pi-mono/issues/776)）
- 修复了在启动时，当`pi.sendMessage({ display: true })`在`session_start`中被调用时，扩展消息渲染两次的问题（[#765](https://github.com/badlogic/pi-mono/pull/765) 由[@dannote](https://github.com/dannote)提交）
- 修复了`PI_CODING_AGENT_DIR`环境变量未能将波浪号（`~`）展开到主目录的问题（[#778](https://github.com/badlogic/pi-mono/pull/778) 由[@aliou](https://github.com/aliou)提交）
- 修复了会话选择器提示文本溢出的问题（[#764](https://github.com/badlogic/pi-mono/issues/764)）
- 修复了Kitty键盘协议中移位符号键（例如`@`，`?`）在编辑器中无法正常工作的现象（[#779](https://github.com/badlogic/pi-mono/pull/779) 由[@iamd3vil](https://github.com/iamd3vil)提交）
- 修复了Bedrock工具调用ID因无效字符导致API错误的问题（[#781](https://github.com/badlogic/pi-mono/pull/781) 由[@pjtf93](https://github.com/pjtf93)提交）

### 更改了

- 默认情况下已禁用硬件光标，以提高终端兼容性。设置`PI_HARDWARE_CURSOR=1`可启用（取代了已禁用它的`PI_NO_HARDWARE_CURSOR=1`）。

## [0.47.0] - 2026-01-16

### 重大变更

- 直接使用`Editor`的扩展必须将`TUI`作为第一个构造函数参数传递：`new Editor(tui, theme)`。`tui`参数现在可在扩展工厂函数中使用。（[#732](https://github.com/badlogic/pi-mono/issues/732)）

### 新增了
- **OpenAI Codex官方支持**：完全兼容OpenAI的Codex命令行模型（`gpt-5.1`，`gpt-5.2`，`gpt-5.1-codex-mini`，`gpt-5.2-codex`）。功能包括为OpenAI白名单提供静态系统提示、通过会话ID进行提示缓存，以及跨轮次保留推理签名。设置`OPENAI_API_KEY`并使用`--provider openai-codex`或选择Codex模型。([#737](https://github.com/badlogic/pi-mono/pull/737))
- `pi-internal://`读取工具中的URL方案，用于访问内部文档。模型可以从coding-agent包中读取文件（README、文档、示例）以了解如何扩展pi。
- 扩展系统新增`input`事件，用于拦截、转换或处理用户输入，使其在被代理处理之前生效。支持三种结果类型：`continue`（直通）、`transform`（修改文本/图片）、`handled`（不使用大语言模型响应）。处理器链式转换，并在处理后短路。([#761](https://github.com/badlogic/pi-mono/pull/761) by [@nicobailon](https://github.com/nicobailon))
- 扩展示例：`input-transform.ts`，演示输入拦截模式（快速模式、即时命令、源路由）([#761](https://github.com/badlogic/pi-mono/pull/761) by [@nicobailon](https://github.com/nicobailon))
- 自定义工具HTML导出：带有`renderCall`/`renderResult`的扩展现在可在`/share`和`/export`输出中渲染，支持ANSI到HTML的颜色转换。([#702](https://github.com/badlogic/pi-mono/pull/702) by [@aliou](https://github.com/aliou))
- 树模式下的直接过滤快捷键：Ctrl+D（默认），Ctrl+T（无工具），Ctrl+U（仅用户），Ctrl+L（仅带标签），Ctrl+A（全部）([#747](https://github.com/badlogic/pi-mono/pull/747) 由 [@kaofelix](https://github.com/kaofelix) 提交)

### 已更改

- 技能命令（`/skill:name`）现在在AgentSession中展开，而不是交互模式。这使得技能命令可以在RPC和打印模式中使用，并允许`input`事件在展开前拦截`/skill:name`。

### 已修复

- 编辑器不再在通过`setEditorText`加载大提示时损坏终端显示。内容现在可垂直滚动，指示器显示视口上方/下方的行。([#732](https://github.com/badlogic/pi-mono/issues/732))

- 已正确处理管道stdin：`echo foo | pi`等同于`pi -p foo`。当stdin被管道传输时，打印模式会自动启用，因为交互模式需要TTY（[#708](https://github.com/badlogic/pi-mono/issues/708)）

- 会话树现在在过滤器隐藏中间条目时，会保留分支连接器和缩进，以便子条目连接到最近的可见祖先，同级分支对齐。TUI和HTML导出均已修复（[#739](https://github.com/badlogic/pi-mono/pull/739) 由 [@w-winter](https://github.com/w-winter) 提交）

- 已添加`upstream connect`、`connection refused`和`reset before headers`模式以自动重试错误检测（[#733](https://github.com/badlogic/pi-mono/issues/733)）
-  多行 YAML 前置数据（frontmatter）在技能和提示模板中现在可以正确解析。使用 `yaml` 库实现了前置数据的集中解析。([#728](https://github.com/badlogic/pi-mono/pull/728) by [@richardgill](https://github.com/richardgill))
-  `ctx.shutdown()` 现在会在退出前等待待处理的 UI 渲染完成，确保通知和最终输出可见 ([#756](https://github.com/badlogic/pi-mono/issues/756))
-  OpenAI Codex 提供器现在会在瞬时错误（429、5xx、连接失败）时重试，并采用指数回退机制 ([#733](https://github.com/badlogic/pi-mono/issues/733))

## [0.46.0] - 2026-01-15

###  修复

-  命名空间模型（`--models` 或 `enabledModels`）现在会记住跨会话最后选择的模型，而不是每次都从作用域中的第一个模型开始 ([#736](https://github.com/badlogic/pi-mono/pull/736) by [@ogulcancelik](https://github.com/ogulcancelik))
-  在使用 Bun 运行时，更新通知中显示 `bun install` 而不是 `npm install` ([#714](https://github.com/badlogic/pi-mono/pull/714) by [@dannote](https://github.com/dannote))
-  `/skill` 提示现在包含技能路径 ([#711](https://github.com/badlogic/pi-mono/pull/711) by [@jblwilliams](https://github.com/jblwilliams))
-  使用可配置的 `expandTools` 快捷键，而不是硬编码的 Ctrl+O ([#717](https://github.com/badlogic/pi-mono/pull/717) by [@dannote](https://github.com/dannote))
-  压缩轮询前缀摘要现在可以正确合并 ([#738](https://github.com/badlogic/pi-mono/pull/738) by [@vsabavat](https://github.com/vsabavat))
-  避免使用未签名的 Gemini 3 工具调用 ([#741](https://github.com/badlogic/pi-mono/pull/741) by [@roshanasingh4](https://github.com/roshanasingh4))
- 在Amazon Bedrock提供商中为非Anthropic模型添加了签名支持（[#727](https://github.com/badlogic/pi-mono/pull/727) by [@unexge](https://github.com/unexge)）
- 键盘快捷键（Ctrl+C、Ctrl+D等）现在在支持Kitty键盘协议并启用替代键报告的终端中，非拉丁键盘布局（俄语、乌克兰语、保加利亚语等）也能正常工作（[#718](https://github.com/badlogic/pi-mono/pull/718) by [@dannote](https://github.com/dannote)）

### 添加了

- 编辑工具现在在无法精确匹配时，会使用模糊匹配作为后备方案，容忍多余的空白、智能引号、Unicode连字符和特殊空格（[#713](https://github.com/badlogic/pi-mono/pull/713) by [@dannote](https://github.com/dannote)）
- 支持`APPEND_SYSTEM.md`以附加指令到系统提示中（[#716](https://github.com/badlogic/pi-mono/pull/716) by [@tallshort](https://github.com/tallshort)）
- 会话选择器搜索：Ctrl+R可在排序方式之间切换，模糊匹配（默认）和最近使用；支持引号短语匹配和`re:`正则模式（[#731](https://github.com/badlogic/pi-mono/pull/731) by [@ogulcancelik](https://github.com/ogulcancelik)）
- 导出`getAgentDir`以供扩展使用（[#749](https://github.com/badlogic/pi-mono/pull/749) by [@dannote](https://github.com/dannote)）
- 启动时显示已加载的提示模板（[#743](https://github.com/badlogic/pi-mono/pull/743) by [@tallshort](https://github.com/tallshort)）
- MiniMax China（`minimax-cn`）提供商支持（[#725](https://github.com/badlogic/pi-mono/pull/725) by [@tallshort](https://github.com/tallshort)）
- 为GitHub Copilot和OpenCode Zen提供商添加`gpt-5.2-codex`模型（[#734](https://github.com/badlogic/pi-mono/pull/734) by [@aadishv](https://github.com/aadishv)）
### 修改

- 用`@silvia-odwyer/photon-node`替换了`wasm-vips`用于图像处理（[#710](https://github.com/badlogic/pi-mono/pull/710) by [@can1357](https://github.com/can1357)）
- 扩展示例：`plan-mode/`快捷键从Shift+P更改为Ctrl+Alt+P，以避免与输入大写P冲突（[#746](https://github.com/badlogic/pi-mono/pull/746) by [@ferologics](https://github.com/ferologics)）
- UI快捷键提示现在会尊重组件间配置的快捷键（[#724](https://github.com/badlogic/pi-mono/pull/724) by [@dannote](https://github.com/dannote)）
- CLI进程标题现在设置为`pi`，便于进程识别（[#742](https://github.com/badlogic/pi-mono/pull/742) by [@richardgill](https://github.com/richardgill)）

## [0.45.7] - 2026-01-13

### 添加

- 导出了`highlightCode`和`getLanguageFromPath`用于扩展（[#703](https://github.com/badlogic/pi-mono/pull/703) by [@dannote](https://github.com/dannote)）

## [0.45.6] - 2026-01-13

### 添加

- `ctx.ui.custom()`现在接受`overlayOptions`用于叠加层定位和尺寸（锚点、边距、偏移、百分比、绝对定位）（[#667](https://github.com/badlogic/pi-mono/pull/667) by [@nicobailon](https://github.com/nicobailon)）
- `ctx.ui.custom()`现在接受`onHandle`回调，以接收`OverlayHandle`，从而控制叠加层的可见性（[#667](https://github.com/badlogic/pi-mono/pull/667) by [@nicobailon](https://github.com/nicobailon)）
- 扩展示例：`overlay-qa-tests.ts`，包含10条命令，用于测试叠加层定位、动画和切换场景（[#667](https://github.com/badlogic/pi-mono/pull/667) by [@nicobailon](https://github.com/nicobailon)）
- 扩展示例：`doom-overlay/` - DOOM游戏以叠加方式运行，帧率为35 FPS（首次运行时自动下载WAD）([#667](https://github.com/badlogic/pi-mono/pull/667) 由 [@nicobailon](https://github.com/nicobailon) 提交)

## [0.45.5] - 2026-01-13

### 修复

- 跳过新安装时的变更日志显示（仅在升级时显示）

## [0.45.4] - 2026-01-13

### 更改

- 浅色主题颜色已调整为符合WCAG AA标准（与白色背景对比度为4.5:1）

- 用`wasm-vips`替换了`sharp`，用于图像处理（缩放、PNG转换）。消除了导致某些系统安装失败的原生构建需求。([#696](https://github.com/badlogic/pi-mono/issues/696))

### 添加

- 扩展示例：`summarize.ts`，用于使用自定义UI和外部模型总结对话([#684](https://github.com/badlogic/pi-mono/pull/684) 由 [@scutifer](https://github.com/scutifer) 提交)

- 扩展示例：`question.ts`，增强版，支持用户提问的自定义UI([#693](https://github.com/badlogic/pi-mono/pull/693) 由 [@ferologics](https://github.com/ferologics) 提交)

- 扩展示例：`plan-mode/`，增强版，支持显式步骤跟踪和进度小部件([#694](https://github.com/badlogic/pi-mono/pull/694) 由 [@ferologics](https://github.com/ferologics) 提交)

- 扩展示例：`questionnaire.ts`，支持多问题输入和标签栏导航([#695](https://github.com/badlogic/pi-mono/pull/695) 由 [@ferologics](https://github.com/ferologics) 提交)
- 实验性Vercel AI网关提供商支持：设置`AI_GATEWAY_API_KEY`并使用`--provider vercel-ai-gateway`。Anthropic兼容端点的令牌使用情况目前报告不正确。([#689](https://github.com/badlogic/pi-mono/pull/689) by [@timolins](https://github.com/timolins))

### 修复

- 通过使用提供商参数修复模型切换后的API密钥解析。([#691](https://github.com/badlogic/pi-mono/pull/691) by [@joshp123](https://github.com/joshp123))
- 修复z.ai思考/推理：思考切换现在正确启用了/禁用了z.ai模型的思考功能。([#688](https://github.com/badlogic/pi-mono/issues/688))
- 修复编译后的Bun二进制文件中的扩展加载：带有本地文件导入的扩展现在可以正常工作。已将`@mariozechner/jiti`更新到v2.6.5，该版本打包了Bun二进制文件兼容的babel。([#681](https://github.com/badlogic/pi-mono/issues/681))
- 修复通过mise安装时的主题加载：使用发布tar包中的wrapper目录以兼容mise的`strip_components=1`提取。([#681](https://github.com/badlogic/pi-mono/issues/681))

## [0.45.3] - 2026-01-13

## [0.45.2] - 2026-01-13

### 修复

- 扩展现在可以正确加载到编译后的Bun二进制文件中，使用了`@mariozechner/jiti`分支并支持`virtualModules`。打包的包（`@sinclair/typebox`，`@mariozechner/pi-tui`，`@mariozechner/pi-ai`，`@mariozechner/pi-coding-agent`）现在可供扩展访问，无需文件系统node_modules。

## [0.45.1] - 2026-01-13

### 更改

- `/share`现在输出`buildwithpi.ai`会话预览URL，而不是`pi.dev`

## [0.45.0] - 2026-01-13

### 添加
- MiniMax 供应商支持：设置 `MINIMAX_API_KEY` 并使用 `minimax/MiniMax-M2.1` ([#656](https://github.com/badlogic/pi-mono/pull/656) 由 [@dannote](https://github.com/dannote) 提交)  
- `/scoped-models`：启用按 Alt+Up/Down 重新排序模型。保存时按 Ctrl+S 会保留顺序，并决定 Ctrl+P 循环顺序。([#676](https://github.com/badlogic/pi-mono/pull/676) 由 [@thomasmhr](https://github.com/thomasmhr) 提交)  
- Amazon Bedrock 供应商支持（实验性，仅经过 Anthropic Claude 模型测试）([#494](https://github.com/badlogic/pi-mono/pull/494) 由 [@unexge](https://github.com/unexge) 提交)  
- 扩展示例：`sandbox/` 用于基于 `@anthropic-ai/sandbox-runtime` 的 OS 级 bash 沙箱，使用项目级配置 ([#673](https://github.com/badlogic/pi-mono/pull/673) 由 [@dannote](https://github.com/dannote) 提交)  
- 打印模式 JSON 输出现在将会话头作为第一行输出。

## [0.44.0] - 2026-01-12

### 重大变更

- `pi.getAllTools()` 现在返回 `ToolInfo[]`（带 `name` 和 `description`），而不是 `string[]`。仅需要名称的扩展可使用 `.map(t => t.name)`。([#648](https://github.com/badlogic/pi-mono/pull/648) 由 [@carsonfarmer](https://github.com/carsonfarmer) 提交)

### 新增

- 会话命名：`/name <name>` 命令设置显示名称，该名称会在会话选择器中显示而非第一条消息。适用于区分分叉会话。扩展可使用 `pi.setSessionName()` 和 `pi.getSessionName()`。([#650](https://github.com/badlogic/pi-mono/pull/650) 由 [@scutifer](https://github.com/scutifer) 提交)  
- 扩展示例：`notify.ts` 用于通过 OSC 777 逃逸序列发送桌面通知 ([#658](https://github.com/badlogic/pi-mono/pull/658) 由 [@ferologics](https://github.com/ferologics) 提交)
- 内联提示显示排队消息的`Alt+Up`恢复快捷键（[#657](https://github.com/badlogic/pi-mono/pull/657) by [@tmustier](https://github.com/tmustier)）
- 在`/resume`会话选择器中使用Page-up/down导航可按5个项目跳跃（[#662](https://github.com/badlogic/pi-mono/pull/662) by [@aliou](https://github.com/aliou)）
- 在`/settings`菜单中支持模糊搜索：输入内容可按标签过滤设置（[#643](https://github.com/badlogic/pi-mono/pull/643) by [@ninlds](https://github.com/ninlds)）

### 修复

- 会话选择器现在在当前文件夹无会话时保持打开状态，允许使用Tab切换至“全部”范围（[#661](https://github.com/badlogic/pi-mono/pull/661) by [@aliou](https://github.com/aliou)）
- 使用主题工具的扩展（如`getSettingsListTheme()`）现在可在开发模式下支持tsx运行

## [0.43.0] - 2026-01-11

### 重大变更

- 扩展编辑器（`ctx.ui.editor()`）现在使用Enter提交，Shift+Enter换行，与主编辑器一致。之前使用Ctrl+Enter提交。硬编码“ctrl+enter”提示的扩展需要更新（[#642](https://github.com/badlogic/pi-mono/pull/642) by [@mitsuhiko](https://github.com/mitsuhiko)）
- 将`/branch`命令重命名为`/fork`（[#641](https://github.com/badlogic/pi-mono/issues/641)）
  - RPC：`branch` → `fork`，`get_branch_messages` → `get_fork_messages`
  - SDK：`branch()` → `fork()`，`getBranchMessages()` → `getForkMessages()`
  - AgentSession：`branch()` → `fork()`，`getUserMessagesForBranching()` → `getUserMessagesForForking()`
  - 扩展事件：`session_before_branch` → `session_before_fork`，`session_branch` → `session_fork`
  - 设置：`doubleEscapeAction: "branch" | "tree"` → `"fork" | "tree"`
- `SessionManager.list()`和`SessionManager.listAll()`现在是异步的，返回`Promise<SessionInfo[]>`。调用者必须等待它们。([#620](https://github.com/badlogic/pi-mono/pull/620) by [@tmustier](https://github.com/tmustier))

### 新增
- `/resume`选择器现在通过Tab在当前文件夹和所有会话之间切换，显示“所有”视图中的会话cwd和加载进度。([#620](https://github.com/badlogic/pi-mono/pull/620) by [@tmustier](https://github.com/tmustier))
- `SessionManager.list()`和`SessionManager.listAll()`接受可选的`onProgress`回调以进行进度更新
- 包含会话工作目录的`SessionInfo.cwd`字段（旧会话为空字符串）
- `SessionListProgress` 导出进度回调类型
- `/scoped-models` 用于启用/禁用 Ctrl+P 循环模型的命令。更改默认为仅在会话中有效；按 Ctrl+S 可保存至 settings.json。([#626](https://github.com/badlogic/pi-mono/pull/626) 由 [@CarlosGtrz](https://github.com/CarlosGtrz) 提交)
- `model_select` 插件钩子在通过 `/model`、模型循环或使用 `source` 字段和 `previousModel` 恢复会话时触发模型变更。([#628](https://github.com/badlogic/pi-mono/pull/628) 由 [@marckrenn](https://github.com/marckrenn) 提交)
- `ctx.ui.setWorkingMessage()` 扩展 API，用于自定义流媒体过程中的“Working...”消息（[#625](https://github.com/badlogic/pi-mono/pull/625) by [@nicobailon](https://github.com/nicobailon)）
- 技能/斜杠命令：已加载的技能将作为 `/skill:name` 命令注册，便于快速访问。可在 settings.json 中通过 `/settings` 或 `skills.enableSkillCommands` 切换。[#630](https://github.com/badlogic/pi-mono/pull/630) by [@Dwsy](https://github.com/Dwsy)
- 斜杠命令自动补全现在使用模糊匹配（输入 `/skbra` 可匹配 `/skill:brave-search`）
- `/tree` 分支摘要现在提供三个选项：“不摘要”、“摘要”和“带自定义提示的摘要”。自定义提示将作为默认摘要指令的附加重点追加。[#642](https://github.com/badlogic/pi-mono/pull/642) by [@mitsuhiko](https://github.com/mitsuhiko)

### 修复

- 助手消息与文本编辑器之间缺少间距（[#655](https://github.com/badlogic/pi-mono/issues/655)）
- 会话选择器在使用 `--resume` 时尊重自定义快捷键（[#633](https://github.com/badlogic/pi-mono/pull/633) by [@aos](https://github.com/aos)）
- 自定义页脚扩展现在可以看到模型变化：`ctx.model` 现在是一个获取当前模型的方法，而不是创建上下文时的快照（[#634](https://github.com/badlogic/pi-mono/pull/634) by [@ogulcancelik](https://github.com/ogulcancelik)）
- 外部切换分支后页脚 git 分支未更新。Git 使用原子写入（临时文件 + 重命名），会改变 inode，导致 `fs.watch` 文件失效。现在改为监控目录。
- 现在会向用户显示扩展加载错误，而不是静默忽略（[#639](https://github.com/badlogic/pi-mono/pull/639) by [@aliou](https://github.com/aliou)）

## [0.42.5] - 2026-01-11

### 修复

- 仅重新渲染更改的行，减少闪烁（[#617](https://github.com/badlogic/pi-mono/pull/617) by [@ogulcancelik](https://github.com/ogulcancelik)）。不过别担心，VS Code终端中仍然有一点点闪烁。赞美闪烁。

- 内容缩小但剩余行未变时的光标位置跟踪

- 终端被挂起/恢复后，如果终端在挂起时被调整过大小，TUI将渲染错误的尺寸（[#599](https://github.com/badlogic/pi-mono/issues/599)）

- 粘贴内容中包含Kitty按键释放模式（例如，`:3F`在MAC地址中）被错误过滤（[#623](https://github.com/badlogic/pi-mono/pull/623) by [@ogulcancelik](https://github.com/ogulcancelik)）
## [0.42.4] - 2026-01-10

### 修复

- Bash输出扩展提示现在显示"(ctrl+o 折叠)" ([#610](https://github.com/badlogic/pi-mono/pull/610) by [@tallshort](https://github.com/tallshort))
- Fixed UTF-8文本在远程bash执行（SSH，容器）中使用流式TextDecoder修复文本损坏问题 ([#608](https://github.com/badlogic/pi-mono/issues/608))

## [0.42.3] - 2026-01-10

### 变更

- OpenAI Codex: 更新为使用上游捆绑的系统提示

## [0.42.2] - 2026-01-10

### 新增

- `/model <search>`现在预过滤模型选择器或在精确匹配时自动选择。使用`provider/model`语法进行歧义消除（例如，`/model openai/gpt-4`）。 ([#587](https://github.com/badlogic/pi-mono/pull/587) by [@zedrdave](https://github.com/zedrdave))
- `FooterDataProvider` 为自定义页脚：`ctx.ui.setFooter()` 现在接收第三个 `footerData` 参数，提供 `getGitBranch()`、`getExtensionStatuses()` 和 `onBranchChange()` 用于响应式更新（[#600](https://github.com/badlogic/pi-mono/pull/600) 由 [@nicobailon](https://github.com/nicobailon) 提交）

- `Alt+Up` 快捷键可将排队的转向/跟进消息恢复到编辑器中，而不停止当前运行（[#604](https://github.com/badlogic/pi-mono/pull/604) 由 [@tmustier](https://github.com/tmustier) 提交）

### 修复

- 修复 LM Studio 与 OpenAI 回答应工具严格映射的兼容性问题（[#598](https://github.com/badlogic/pi-mono/pull/598) 由 [@gnattu](https://github.com/gnattu) 提交）

## [0.42.1] - 2026-01-09

### 修复

- 符号链接目录现在在加载提示模板时会跟随 `prompts/` 文件夹中的路径（[#601](https://github.com/badlogic/pi-mono/pull/601) 由 [@aliou](https://github.com/aliou) 提交）

## [0.42.0] - 2026-01-09

### 添加

- 添加 OpenCode Zen 提供器支持。设置 `OPENCODE_API_KEY` 环境变量并使用 `opencode/<model-id>`（例如 `opencode/claude-opus-4-5`）。

## [0.41.0] - 2026-01-09

### 添加

- Anthropic OAuth 支持已恢复！使用 `/login` 进行 Claude Pro/Max 订阅身份验证。

## [0.40.1] - 2026-01-09

### 移除

- Anthropic OAuth 支持（`/login`）。改用 API 密钥。

## [0.40.0] - 2026-01-08
### 已添加

- 关于组件失效和主题变更的文档（`docs/tui.md`）

### 已修复

- 组件现在会在主题变更时正确重建其内容（工具执行、助手消息、bash执行、自定义消息、分支/压缩摘要）

## [0.39.1] - 2026-01-08

### 已修复

- `setTheme()`现在会触发完整重渲染，使之前渲染的组件能更新为新的主题颜色

- `mac-system-theme.ts`示例现在每2秒轮询一次，并使用`osascript`进行实时macOS外观检测

## [0.39.0] - 2026-01-08

### 重大变更

- `before_agent_start`事件现在会在事件对象中接收`systemPrompt`，并返回`systemPrompt`（完整替换），而不是`systemPromptAppend`。之前附加的扩展必须现在使用`event.systemPrompt + extra`模式。([#575](https://github.com/badlogic/pi-mono/issues/575))

- `discoverSkills()`现在返回`{ skills: Skill[], warnings: SkillWarning[] }`，而不是`Skill[]`。这允许调用方处理技能加载警告。([#577](https://github.com/badlogic/pi-mono/pull/577) 由[@cv](https://github.com/cv) 提交)

### 已添加

- 为扩展提供`ctx.ui.getAllThemes()`、`ctx.ui.getTheme(name)`和`ctx.ui.setTheme(name | Theme)`方法，用于运行时列出、加载和切换主题（[#576](https://github.com/badlogic/pi-mono/pull/576)）

- `--no-tools`标志，用于禁用所有内置工具，允许仅扩展工具的设置（[#557](https://github.com/badlogic/pi-mono/pull/557) 由[@cv](https://github.com/cv) 提交)
- 内置工具的插件式操作，可通过SSH或其他传输方式实现远程执行（[#564](https://github.com/badlogic/pi-mono/issues/564)）。接口：`ReadOperations`、`WriteOperations`、`EditOperations`、`BashOperations`、`LsOperations`、`GrepOperations`、`FindOperations`  
- `user_bash`事件，用于拦截用户`!`/`!!`命令，允许扩展将命令重定向到远程系统（[#528](https://github.com/badlogic/pi-mono/issues/528)）  
- `setActiveTools()`在ExtensionAPI中用于动态工具管理  
- 内置渲染器会自动用于工具覆盖，无需自定义`renderCall`/`renderResult`  
- `ssh.ts`示例：通过`--ssh user@host:/path`执行远程工具  
- `interactive-shell.ts`示例：通过`!i`前缀或自动检测，运行交互式命令（vim、git rebase、htop）并获得完整终端访问权限  
- Wayland剪贴板支持，使用`/copy`命令的wl-copy，并回退到xclip/xsel（[#570](https://github.com/badlogic/pi-mono/pull/570)由[@OgulcanCelik](https://github.com/OgulcanCelik)提交）  
- **实验性功能：**`ctx.ui.custom()`现在接受`{ overlay: true }`选项，用于浮动模态组件，可叠加在现有内容上而无需清除屏幕（[#558](https://github.com/badlogic/pi-mono/pull/558)由[@nicobailon](https://github.com/nicobailon)提交）  
- `AgentSession.skills`和`AgentSession.skillWarnings`属性，用于访问已加载的技能而无需重新发现（[#577](https://github.com/badlogic/pi-mono/pull/577)由[@cv](https://github.com/cv)提交）  

### 修复了
- 字符串`systemPrompt`在`createAgentSession()`中现在作为完全替换而不是 拥有上下文文件和附加技能，匹配文档行为（[#543](https://github.com/badlogic/pi-mono/issues/543)）
- 更新通知，bun二进制安装现在显示发布下载URL，而不是npm命令([#567](https://github.com/badlogic/pi-mono/pull/567)由[@ferologics](https://github.com/ferologics)提交)
- ESC键现在在“Working...”状态后自动重试时可以正常工作（[#568](https://github.com/badlogic/pi-mono/pull/568) by [@tmustier](https://github.com/tmustier)）
- 终止消息现在显示正确的重试尝试次数（例如，“终止后重试了2次”）([#568](https://github.com/badlogic/pi-mono/pull/568) 由 [@tmustier](https://github.com/tmustier))
- 修复了反重力提供商在可用配额下仍返回429错误的问题([#571](https://github.com/badlogic/pi-mono/pull/571) 由 [@ben-vargas](https://github.com/ben-vargas))
- 修复了Gemini/反重力响应中思维文本格式错误的问题，其中思维内容以普通文本或反之出现。跨模型对话现在可以正确地将思维块转换为纯文本。([#561](https://github.com/badlogic/pi-mono/issues/561))

- `--no-skills`标志现在可以正确阻止技能在交互模式下加载([#577](https://github.com/badlogic/pi-mono/pull/577) by [@cv](https://github.com/cv))

## [0.38.0] - 2026-01-08

### 不兼容变更

- `ctx.ui.custom()`工厂签名已从`(tui, theme, done)`更改为`(tui, theme, keybindings, done)`，以便在自定义组件中通过快捷键访问
- `LoadedExtension`类型已重命名为`Extension`
- `LoadExtensionsResult.setUIContext()` 已删除，替换为 `runtime: ExtensionRuntime`
- `ExtensionRunner` 现在需要 `runtime: ExtensionRuntime` 作为第二个参数
- `ExtensionRunner.initialize()` 从 options 对象更改为位置参数 `(actions, contextActions, commandContextActions?, uiContext?)`
- `ExtensionRunner.getHasUI()` 重命名为 `hasUI()`
-  OpenAI Codex 模型别名已移除（`gpt-5`、`gpt-5-mini`、`gpt-5-nano`、`codex-mini-latest`）。请使用规范 ID：`gpt-5.1`、`gpt-5.1-codex-mini`、`gpt-5.2`、`gpt-5.2-codex`。（[#536](https://github.com/badlogic/pi-mono/pull/536) 由 [@ghoulr](https://github.com/ghoulr) 提交）

###  增加了

- `--no-extensions` 标志，可在不发现扩展的情况下仍允许显式 `-e` 路径（[#524](https://github.com/badlogic/pi-mono/pull/524) 由 [@cv](https://github.com/cv) 提交）
- SDK: `InteractiveMode`、`runPrintMode()`、`runRpcMode()`导出用于构建自定义运行模式。详见`docs/sdk.md`。
- `PI_SKIP_VERSION_CHECK`环境变量，用于在启动时禁用新版本通知（[#549](https://github.com/badlogic/pi-mono/pull/549) by [@aos](https://github.com/aos)）
- `thinkingBudgets`设置，用于为基于令牌的提供商自定义每个思考级别的令牌预算（[#529](https://github.com/badlogic/pi-mono/pull/529) by [@melihmucuk](https://github.com/melihmucuk)）
- 扩展 UI 对话框（`ctx.ui.select()`，`ctx.ui.confirm()`，`ctx.ui.input()`）现在支持 `timeout`选项，带有实时倒计时显示（[#522](https://github.com/badlogic/pi-mono/pull/522) 由 [@nicobailon](https://github.com/nicobailon) 提交）
- 现在可以通过`ctx.ui.setEditorComponent()`提供自定义编辑器组件。请参见`examples/extensions/modal-editor.ts`和`docs/tui.md`模式7。
- 扩展工厂现在可以是异步的，从而支持动态导入和懒加载依赖项（[#513](https://github.com/badlogic/pi-mono/pull/513)由[@austinm911](https://github.com/austinm911)提交）
- `ctx.shutdown()`现在可以在扩展上下文中使用，用于请求优雅关闭。在交互模式下，关闭操作将延迟到代理空闲（处理完所有排队的导航和后续消息）之后。在RPC模式下，关闭操作将延迟到完成当前命令响应之后。在打印模式下，关闭操作是无效的，因为进程会在提示完成时自动退出。([#542](https://github.com/badlogic/pi-mono/pull/542)由[@kaofelix](https://github.com/kaofelix)提交)

### 修复

- 默认思维等级现在在`enabledModels`配置时正确应用（[#540](https://github.com/badlogic/pi-mono/pull/540)由[@ferologics](https://github.com/ferologics)提交）
- 当pi运行时对外部对`settings.json`的修改现在会在pi保存设置时被保留（[#527](https://github.com/badlogic/pi-mono/pull/527)由[@ferologics](https://github.com/ferologics)提交）
- 基于溢出的压缩现在会跳过，如果错误来自其他模型或已被之前的压缩处理（[#535](https://github.com/badlogic/pi-mono/pull/535)由[@mitsuhiko](https://github.com/mitsuhiko)提交）
- OpenAI Codex上下文窗口已从400k减少到272k个令牌，以匹配Codex CLI的默认设置并防止400错误（[#536](https://github.com/badlogic/pi-mono/pull/536)由[@ghoulr](https://github.com/ghoulr)提交）
-  现在可以识别 `context_length_exceeded` 错误。
-  SSH 批量输入时不再丢弃按键（[#538](https://github.com/badlogic/pi-mono/issues/538)）
-  剪贴板图片支持现已适用于 Alpine Linux 和其他基于 musl 的发行版（[#533](https://github.com/badlogic/pi-mono/issues/533)）

## [0.37.8] - 2026-01-07

## [0.37.7] - 2026-01-07

## [0.37.6] - 2026-01-06

###  添加

-  扩展 UI 对话框（`ctx.ui.select()`、`ctx.ui.confirm()`、`ctx.ui.input()`）现在可选接受 `AbortSignal` 以程序化方式关闭对话框。可用于实现超时功能。详见 `examples/extensions/timed-confirm.ts`。（[#474](https://github.com/badlogic/pi-mono/issues/474)）
-  HTML 导出现在会在 Codex 会话的模型变更消息中显示桥接提示（[#510](https://github.com/badlogic/pi-mono/pull/510) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交）

## [0.37.5] - 2026-01-06

###  添加

-  ExtensionAPI: `setModel()`、`getThinkingLevel()`、`setThinkingLevel()` 方法，允许扩展在运行时更改模型和思考级别（[#509](https://github.com/badlogic/pi-mono/issues/509)）
-  导出了用于自定义工具的截断实用工具：`truncateHead`、`truncateTail`、`truncateLine`、`formatSize`、`DEFAULT_MAX_BYTES`、`DEFAULT_MAX_LINES`、`TruncationOptions`、`TruncationResult`
-  新增示例 `truncated-tool.ts`，演示如何使用自定义渲染实现正确的输出截断
-  新示例 `preset.ts`，演示预设配置与模型/思考/工具切换 ([#347](https://github.com/badlogic/pi-mono/issues/347))
-  `docs/extensions.md` 输出截断最佳实践文档
-  导出所有UI组件用于扩展：`ArminComponent`、`AssistantMessageComponent`、`BashExecutionComponent`、`BorderedLoader`、`BranchSummaryMessageComponent`、`CompactionSummaryMessageComponent`、`CustomEditor`、`CustomMessageComponent`、`DynamicBorder`、`ExtensionEditorComponent`、`ExtensionInputComponent`、`ExtensionSelectorComponent`、`FooterComponent`、`LoginDialogComponent`、`ModelSelectorComponent`、`OAuthSelectorComponent`、`SessionSelectorComponent`、`SettingsSelectorComponent`、`ShowImagesSelectorComponent`、`ThemeSelectorComponent`、`ThinkingSelectorComponent`、`ToolExecutionComponent`、`TreeSelectorComponent`、`UserMessageComponent`、`UserMessageSelectorComponent`，以及工具 `renderDiff`、`truncateToVisualLines`
-  `docs/tui.md`：通用模式部分，包含SelectList、BorderedLoader、SettingsList、setStatus、setWidget、setFooter的复制粘贴代码
-  `docs/tui.md`：关键规则部分，记录扩展UI开发的关键模式
-  `docs/extensions.md`：所有ExtensionAPI方法和事件的完整示例链接
-  系统提示现在引用`docs/tui.md`进行TUI组件开发

## [0.37.4] - 2026-01-06

###  增加

-  会话选择器（`pi -r`）和`--session`标志现在支持按会话ID（UUID前缀）搜索/恢复 ([#495](https://github.com/badlogic/pi-mono/issues/495) 由[@arunsathiya](https://github.com/arunsathiya) 提交)
- 现在可以使用`ctx.ui.setHeader()`替换启动头，详见`examples/extensions/custom-header.ts`（[#500](https://github.com/badlogic/pi-mono/pull/500) by [@tudoroancea](https://github.com/tudoroancea)）

### 已更改

- 启动帮助文本：已修正误导性的“ctrl+k 删除行”为“ctrl+k 删除到行尾”
- 启动帮助文本和`/hotkeys`：已添加`!!`快捷方式，用于运行bash而不将输出添加到上下文中

### 已修复

- 排队的引导/跟进消息不再清除未发送的编辑器输入（[#503](https://github.com/badlogic/pi-mono/pull/503) by [@tmustier](https://github.com/tmustier)）
- OAuth令牌刷新失败不再导致应用启动时崩溃，允许用户`/login`重新认证（[#498](https://github.com/badlogic/pi-mono/issues/498)）

## [0.37.3] - 2026-01-06

### 已添加

- 现在可以使用`ctx.ui.setFooter()`替换扩展的页脚，详见`examples/extensions/custom-footer.ts`（[#481](https://github.com/badlogic/pi-mono/issues/481)）
- 会话ID现在已转发给LLM提供商，用于基于会话的缓存（OpenAI Codex用于提示缓存）。
- 已添加`blockImages`设置，防止图像发送到LLM提供商（[#492](https://github.com/badlogic/pi-mono/pull/492) by [@jsinge97](https://github.com/jsinge97)）
- 现在可以通过`pi.sendUserMessage()`发送用户消息（[#483](https://github.com/badlogic/pi-mono/issues/483)）

### 已修复

- 将`minimatch`作为直接依赖项进行显式导入。
- 状态栏现在显示正确的git分支，当在git工作树中运行时（[#490](https://github.com/badlogic/pi-mono/pull/490) by [@kcosr](https://github.com/kcosr)）
- 交互模式：现在可以通过 `wl-paste` 在 Wayland 会话中使用 Ctrl+V 粘贴剪贴板图片，回退使用 `xclip` ([#488](https://github.com/badlogic/pi-mono/pull/488) 由 [@ghoulr](https://github.com/ghoulr) 提交)

## [0.37.2] - 2026-01-05

### 修复

- 扩展目录现在会尊重 `settings.json` 中的 `package.json` 表现，匹配全局扩展行为 ([#480](https://github.com/badlogic/pi-mono/pull/480) 由 [@prateekmedia](https://github.com/prateekmedia) 提交)
- 分享查看器：通过 `/share` 打开时，深链接现在会滚动到目标消息
- Bash 工具现在会优雅处理启动错误，而不是导致代理崩溃（缺少当前工作目录、无效的 shell 路径）([#479](https://github.com/badlogic/pi-mono/pull/479) 由 [@robinwander](https://github.com/robinwander) 提交)

## [0.37.1] - 2026-01-05

### 修复

- 分享查看器：复制链接按钮现在会在会话通过 `/share`（iframe 上下文）查看时生成正确的 URL

## [0.37.0] - 2026-01-05

### 添加

- 分享查看器：消息中的复制链接按钮现在会共享可直接导航到特定消息的 URL ([#477](https://github.com/badlogic/pi-mono/pull/477) 由 [@lockmeister](https://github.com/lockmeister) 提交)
- 扩展示例：添加 `claude-rules` 以加载 `.claude/rules/` 项目到系统提示符中 ([#461](https://github.com/badlogic/pi-mono/pull/461) 由 [@vaayne](https://github.com/vaayne) 提交)
- 无头OAuth登录：所有提供商现在都显示粘贴输入，用于手动输入URL/代码，可通过SSH（无需DISPLAY）使用 ([#428](https://github.com/badlogic/pi-mono/pull/428) 由 [@ben-vargas](https://github.com/ben-vargas) 提交，[#468](https://github.com/badlogic/pi-mono/pull/468) 由 [@crcatala](https://github.com/crcatala) 提交)

### 更改

- OAuth登录UI现在使用专用对话组件，边框一致
- 假设所有终端都支持真彩色，除了`dumb`、空或`linux`（修复SSH下的颜色问题）
- OpenAI Codex清理：移除了按思考级别划分的模型变体，思考级别现在单独设置，提供商会根据每个模型内部支持的内容进行限制（初始实现见[#472](https://github.com/badlogic/pi-mono/pull/472) 由 [@ben-vargas](https://github.com/ben-vargas) 提交）

### 修复

- 压缩过程中提交的消息会被排队，在压缩完成后发送，以保持引导和后续行为。扩展命令在压缩过程中会立即执行。 ([#476](https://github.com/badlogic/pi-mono/pull/476) 由 [@tmustier](https://github.com/tmustier) 提交)
- 管理二进制文件（`fd`，`rg`）现在存储在`~/.pi/agent/bin/`中，而不是`tools/`，消除了虚假的弃用警告 ([#470](https://github.com/badlogic/pi-mono/pull/470) 由 [@mcinteerj](https://github.com/mcinteerj) 提交)
- 在`settings.json`中定义的扩展未被加载 ([#463](https://github.com/badlogic/pi-mono/pull/463) 由 [@melihmucuk](https://github.com/melihmucuk) 提交)
- OAuth刷新不再在多个pi实例运行时注销用户 ([#466](https://github.com/badlogic/pi-mono/pull/466) 由 [@Cursivez](https://github.com/Cursivez) 提交)
- 迁移警告现在会忽略 Windows 上的 `fd.exe` 和 `rg.exe` 中的 `tools/`（[#458](https://github.com/badlogic/pi-mono/pull/458) by [@carlosgtrz](https://github.com/carlosgtrz)）
- CI：将 `examples/extensions/with-deps` 添加到工作区以修复类型检查（[#467](https://github.com/badlogic/pi-mono/pull/467) by [@aliou](https://github.com/aliou)）
- SDK：传递 `extensions: []` 现在会如文档所述禁用扩展发现（[#465](https://github.com/badlogic/pi-mono/pull/465) by [@aliou](https://github.com/aliou)）

## [0.36.0] - 2026-01-05

### 已添加

- 实验性：支持 OpenAI Codex OAuth 提供者：通过 ChatGPT Plus/Pro 订阅使用 `/login openai-codex` 访问 Codex 模型（[#451](https://github.com/badlogic/pi-mono/pull/451) by [@kim0](https://github.com/kim0)）

## [0.35.0] - 2026-01-05

本版本将钩子和自定义工具统一为单一的“扩展”系统，并将“斜杠命令”更名为“提示模板”。（[#454](https://github.com/badlogic/pi-mono/issues/454)）

**迁移前，请阅读：**

- [docs/extensions.md](docs/extensions.md) - 完整 API 参考
- [README.md](README.md) - 带示例的扩展章节
- [examples/extensions/](examples/extensions/) - 可行示例

### 扩展迁移

钩子和自定义工具现在被统一为 **扩展**。两者都是导出工厂函数的 TypeScript 模块，接收 API 对象。现在只有一个概念、一个发现位置、一个 CLI 标志、一个 settings.json 项。

**自动迁移：**

- `commands/` 目录在启动时会自动更名为 `prompts/`（同时包含 `~/.pi/agent/commands/` 和 `.pi/commands/`）
**手动迁移必需：**

1. 将 `hooks/` 和 `tools/` 目录中的文件移动到 `extensions/`（启动时显示弃用警告）
2. 更新扩展代码中的导入和类型名称
3. 如果您配置了显式钩子和自定义工具路径，请更新 `settings.json`

**目录变更：**

```
# Before
~/.pi/agent/hooks/*.ts       →  ~/.pi/agent/extensions/*.ts
~/.pi/agent/tools/*.ts       →  ~/.pi/agent/extensions/*.ts
.pi/hooks/*.ts               →  .pi/extensions/*.ts
.pi/tools/*.ts               →  .pi/extensions/*.ts
```

**扩展发现规则**（在 `extensions/` 目录中）：

1. **直接文件**：`extensions/*.ts` 或 `*.js` → 直接加载
2. **带 index 的子目录**：`extensions/myext/index.ts` → 作为单个扩展加载
3. **带 package.json 的子目录**：`extensions/myext/package.json`，其中包含 `"pi"` 字段 → 加载声明的路径

```json
// extensions/my-package/package.json
{
  "name": "my-extension-package",
  "dependencies": { "zod": "^3.0.0" },
  "pi": {
    "extensions": ["./src/main.ts", "./src/tools.ts"]
  }
}
```

不递归超过一级。复杂包必须使用 `package.json` 清单。依赖项通过 jiti 解析，扩展可以从 npm 发布和安装。

**类型重命名：**

- `HookAPI` → `ExtensionAPI`
- `HookContext` → `ExtensionContext`
- `HookCommandContext` → `ExtensionCommandContext`
- `HookUIContext` → `ExtensionUIContext`
- `CustomToolAPI` → `ExtensionAPI`（合并）
- `CustomToolContext` → `ExtensionContext`（合并）
- `CustomToolUIContext` → `ExtensionUIContext`
- `CustomTool` → `ToolDefinition`
- `CustomToolFactory` → `ExtensionFactory`
- `HookMessage` → `CustomMessage`

**导入变更：**

```typescript
// Before (hook)
import type { HookAPI, HookContext } from "@mariozechner/pi-coding-agent";
export default function (pi: HookAPI) { ... }

// Before (custom tool)
import type { CustomToolFactory } from "@mariozechner/pi-coding-agent";
const factory: CustomToolFactory = (pi) => ({ name: "my_tool", ... });
export default factory;

// After (both are now extensions)
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => { ... });
  pi.registerTool({ name: "my_tool", ... });
}
```
  
**自定义工具现在可访问完整上下文。** 通过 `pi.registerTool()` 注册的工具现在会接收到与事件处理器相同的 `ctx` 对象。此前，自定义工具上下文有限。现在所有扩展代码共享相同能力：

- `pi.registerTool()` - 注册 LLM 可调用的工具  
- `pi.registerCommand()` - 注册类似 `/mycommand` 的命令  
- `pi.registerShortcut()` - 注册键盘快捷键（见 `/hotkeys`）  
- `pi.registerFlag()` - 注册 CLI 标志（见 `--help`）  
- `pi.registerMessageRenderer()` - 为消息类型定制 TUI 渲染  
- `pi.on()` - 订阅生命周期事件（tool_call、session_start 等）  
- `pi.sendMessage()` - 向对话中注入消息  
- `pi.appendEntry()` - 在会话中持久化自定义数据（重启/分支后仍保留）  
- `pi.exec()` - 运行 shell 命令  
- `pi.getActiveTools()` / `pi.setActiveTools()` - 工具动态启用/禁用  
- `pi.getAllTools()` - 列出所有可用工具  
- `pi.events` - 扩展间通信的事件总线  
- `ctx.ui.confirm()` / `select()` / `input()` - 用户提示  
- `ctx.ui.notify()` - 提示通知
- `ctx.ui.setStatus()` - 底部持久化状态（多个扩展可各自设置）
- `ctx.ui.setWidget()` - 小部件显示于编辑器上方
- `ctx.ui.setTitle()` - 设置终端窗口标题
- `ctx.ui.custom()` - 带键盘处理的全屏 TUI 组件
- `ctx.ui.editor()` - 支持外部编辑器的多行文本编辑器
- `ctx.sessionManager` - 读取会话条目，获取分支历史

**设置变更：**

```json
// Before
{
  "hooks": ["./my-hook.ts"],
  "customTools": ["./my-tool.ts"]
}

// After
{
  "extensions": ["./my-extension.ts"]
}
```


**CLI 变更：**

```bash
# Before
pi --hook ./safety.ts --tool ./todo.ts

# After
pi --extension ./safety.ts -e ./todo.ts
```

### Prompt 模板迁移

“Slash 命令”（通过 `/name` 调用的可复用提示的 markdown 文件）更名为“prompt 模板”，以避免与扩展注册的命令混淆。

**自动迁移：**程序启动时，若 `prompts/` 目录不存在，会自动将 `commands/` 目录更名为 `prompts/`。此功能对普通目录和符号链接均适用。

**目录变更：**

```
~/.pi/agent/commands/*.md    →  ~/.pi/agent/prompts/*.md
.pi/commands/*.md            →  .pi/prompts/*.md
```


**SDK 类型重命名：**

- `FileSlashCommand` → `PromptTemplate`
- `LoadSlashCommandsOptions` → `LoadPromptTemplatesOptions`

**SDK 函数重命名：**

- `discoverSlashCommands()` → `discoverPromptTemplates()`
- `loadSlashCommands()` → `loadPromptTemplates()`
- `expandSlashCommand()` → `expandPromptTemplate()`
- `getCommandsDir()` → `getPromptsDir()`

**SDK 选项重命名：**

- `CreateAgentSessionOptions.slashCommands` → `.promptTemplates`
- `AgentSession.fileCommands` → `.promptTemplates`
- `PromptOptions.expandSlashCommands` → `.expandPromptTemplates`

### SDK 迁移
**发现功能：**

- `discoverAndLoadHooks()` → `discoverAndLoadExtensions()`
- `discoverAndLoadCustomTools()` → 合并到 `discoverAndLoadExtensions()`
- `loadHooks()` → `loadExtensions()`
- `loadCustomTools()` → 合并到 `loadExtensions()`

**运行时和包装器：**

- `HookRunner` → `ExtensionRunner`
- `wrapToolsWithHooks()` → `wrapToolsWithExtensions()`
- `wrapToolWithHooks()` → `wrapToolWithExtensions()`

**CreateAgentSessionOptions：**

- `.hooks` → 已移除（路径请使用 `.additionalExtensionPaths`）
- `.additionalHookPaths` → `.additionalExtensionPaths`
- `.preloadedHooks` → `.preloadedExtensions`
- `.customTools` 类型已更改：`Array<{ path?; tool: CustomTool }>` → `ToolDefinition[]`
- `.additionalCustomToolPaths` → 合并到 `.additionalExtensionPaths`
- `.slashCommands` → `.promptTemplates`

**AgentSession：**

- `.hookRunner` → `.extensionRunner`
- `.fileCommands` → `.promptTemplates`
- `.sendHookMessage()` → `.sendCustomMessage()`

###  会话迁移

**自动。** 会话版本从 2 升级到 3。现有会话在首次加载时自动迁移：

-  消息角色 `"hookMessage"` → `"custom"`

###  重大变更
- **设置:** 将 `hooks` 和 `customTools` 数组替换为单个 `extensions` 数组  
- **命令行界面 (CLI):** 将 `--hook` 和 `--tool` 标志替换为 `--extension` / `-e`  
- **目录:** `hooks/`, `tools/` → `extensions/`; `commands/` → `prompts/`  
- **类型:** 请参见上面的类型重命名  
- **SDK:** 请参见上面的 SDK 迁移  

### 已更改  

- 扩展程序可以拥有自己的 `package.json`，并带有依赖项（通过 jiti 解析）  
- **文档:** 将 `docs/hooks.md` 和 `docs/custom-tools.md` 合并为 `docs/extensions.md`  
- **示例:** 将 `examples/hooks/` 和 `examples/custom-tools/` 合并为 `examples/extensions/`  
- README: 扩展程序部分增加了自定义工具、命令、事件、状态持久化、快捷键、标志和用户界面示例  
- SDK: `customTools` 选项现在可直接接受 `ToolDefinition[]`（简化自 `Array<{ path?, tool }>`）  
- SDK: `extensions` 选项可接受 `ExtensionFactory[]` 用于内联扩展  
- SDK: `additionalExtensionPaths` 替代 `additionalHookPaths` 和 `additionalCustomToolPaths`  

## [0.34.2] - 2026-01-04  

## [0.34.1] - 2026-01-04  

### 已添加  

- Hook API: `ctx.ui.setTitle(title)` 允许钩子设置终端窗口/标签页标题（[#446](https://github.com/badlogic/pi-mono/pull/446) 由 [@aliou](https://github.com/aliou) 提交）  

### 已更改
- 扩展快捷键文档，列出所有32个支持的符号键，并附带Ctrl+符号键的行为说明（[#450](https://github.com/badlogic/pi-mono/pull/450) 由 [@kaofelix](https://github.com/kaofelix) 提交）

## [0.34.0] - 2026-01-04

### 添加

- Hook API: `pi.getActiveTools()` 和 `pi.setActiveTools(toolNames)`，用于动态启用/禁用工具
- Hook API: `pi.getAllTools()`，用于枚举所有已配置的工具（内置通过 --tools 或默认，加上自定义工具）
- Hook API: `pi.registerFlag(name, options)` 和 `pi.getFlag(name)`，用于钩子注册自定义CLI标志（自动解析）
- Hook API: `pi.registerShortcut(shortcut, options)`，用于钩子注册自定义键盘快捷键，使用 `KeyId`（例如 `Key.shift("p")`）。与内置快捷键冲突的会跳过，钩子间冲突会以警告日志记录。
- Hook API: `ctx.ui.setWidget(key, content)`，用于编辑器上方的状态显示。接受字符串数组或组件工厂函数。
- Hook API: `theme.strikethrough(text)`，用于删除线文本样式
- Hook API: `before_agent_start` 处理器现在可以返回 `systemPromptAppend`，以动态追加系统提示词。多个钩子的追加内容会拼接。
- Hook API: `before_agent_start` 处理器现在可以返回多个消息（全部注入，而非仅第一个）
- 命令 `/hotkeys` 现在会在单独的“Hooks”部分显示钩子注册的快捷键
- 新增示例钩子：`plan-mode.ts` - Claude Code风格的只读探索模式
  - 通过 `/plan` 命令、`Shift+P` 快捷键或 `--plan` CLI 标志进行切换
  - 只读工具：`read`、`bash`、`grep`、`find`、`ls`（不包括 `edit`/`write`）
  - Bash 命令限制为非破坏性操作（阻止 `rm`、`mv`、`git commit`、`npm install` 等）
  - 每次响应后进行交互提示：执行计划、保持计划模式或优化
  - 待办事项小部件，显示带复选框和已完成项删除线的进度
  - 每个待办事项具有唯一 ID；代理通过输出 `[DONE:id]` 标记项目完成
  - 通过 `agent_end` 插件更新进度（解析最终消息中的已完成项）
  - 通过 `/todos` 命令查看当前计划进度
  - 在计划模式下在页脚显示 `⏸ plan` 指示器，执行时显示 `📋 2/5`
  - 状态跨会话持久化（包括待办事项进度）
- 新示例插件：`tools.ts` - 交互式 `/tools` 命令，用于启用/禁用工具并保持会话持久化
- 新示例插件：`pirate.ts` - 展示 `systemPromptAppend`，使代理能够像海盗一样说话
- 工具注册表现在包含所有内置工具（读取、bash、编辑、写入、grep、查找、ls），即使`--tools`限制了最初激活的工具集。钩子可以通过`pi.setActiveTools()`启用注册表中的任何工具。

- 系统提示现在会自动重建，当工具发生变化时通过`setActiveTools()`，更新工具描述和指南以匹配新的工具集。

- 钩子错误现在会显示完整的堆栈跟踪，便于调试。

- 事件总线（`pi.events`）用于工具/钩子通信：自定义工具和钩子之间的共享发布/订阅。

- 自定义工具现在可以通过`pi.sendMessage()`直接向代理会话发送消息，无需使用事件总线。

- `sendMessage()`支持`deliverAs: "nextTurn"`，用于为下一个用户提示排队消息。

### 已更改

- 复制粘贴后移除了图片占位符，改为直接插入图片文件路径。([#442](https://github.com/badlogic/pi-mono/pull/442) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交)

### 已修复

- 通过使用流式TextDecoder代替Buffer.toString()，修复了bash执行器中可能出现的文本解码问题。

- 外部编辑器（Ctrl-G）现在会显示完整的粘贴内容，而不是`[paste #N ...]`占位符。([#444](https://github.com/badlogic/pi-mono/pull/444) 由 [@aliou](https://github.com/aliou) 提交)

## [0.33.0] - 2026-01-04

### 重大变更
- **从 `@mariozechner/pi-tui` 移除了密钥检测功能**：所有 `isXxx()` 密钥检测功能（`isEnter()`、`isEscape()`、`isCtrlC()` 等）均已移除。请改用 `matchesKey(data, keyId)`（例如 `matchesKey(data, "enter")`、`matchesKey(data, "ctrl+c")`）。这会影响使用 `ctx.ui.custom()` 处理键盘输入的钩子和自定义工具。([#405](https://github.com/badlogic/pi-mono/pull/405))

### 已添加

- 通过 `Ctrl+V` 支持剪贴板图片粘贴。图片会保存到临时文件并附加到消息中。支持 macOS、Windows 和 Linux（X11）。([#419](https://github.com/badlogic/pi-mono/issues/419))
- 可通过 `~/.pi/agent/keybindings.json` 配置快捷键。所有键盘快捷方式（编辑器导航、删除、应用操作如模型循环等）现在均可自定义。支持每个操作多个绑定。([#405](https://github.com/badlogic/pi-mono/pull/405) 由 [@hjanuschka](https://github.com/hjanuschka) 提交)
- `/quit` 和 `/exit` 斜杠命令可优雅退出应用。与双击 Ctrl+C 不同，这些命令会在退出前等待钩子和自定义工具清理处理程序。([#426](https://github.com/badlogic/pi-mono/pull/426) 由 [@ben-vargas](https://github.com/ben-vargas) 提交)

### 已修复

- 子代理示例 README 引用的文件名 `subagent.ts` 有误，应为 `index.ts` ([#427](https://github.com/badlogic/pi-mono/pull/427) 由 [@Whamp](https://github.com/Whamp) 提交)

## [0.32.3] - 2026-01-03

### 已修复

- `--list-models` 不再显示未配置显式认证的 Google Vertex AI 模型
- JPEG/GIF/WebP图片在使用Kitty图形协议（Kitty、Ghostty、WezTerm）的终端中无法显示。该协议要求PNG格式，因此非PNG图片现在会在显示前进行转换。
- 版本检查URL中的拼写错误导致更新通知无法工作（[#423](https://github.com/badlogic/pi-mono/pull/423) 由[@skuridin](https://github.com/skuridin) 提交）
- 超过Anthropic 5MB限制的大图片现在会重试，采用渐进式质量/尺寸缩减（[#424](https://github.com/badlogic/pi-mono/pull/424) 由[@mitsuhiko](https://github.com/mitsuhiko) 提交）

## [0.32.2] - 2026-01-03

### 新增

- `$ARGUMENTS` 语法作为自定义斜杠命令的替代方案，用于替代`$@`（将所有参数连接）。该语法与Claude、Codex和OpenCode使用的模式保持一致。两种语法均保持完全支持。（[#418](https://github.com/badlogic/pi-mono/pull/418) 由[@skuridin](https://github.com/skuridin) 提交）

### 已更改

- **斜杠命令和钩子命令现在在流式处理时也能工作**：之前，当代理正在流式处理时使用斜杠命令或钩子命令会导致“代理正在处理中”的崩溃。现在：
  - 钩子命令立即执行（它们通过`pi.sendMessage()`管理自己的大语言模型交互）
  - 基于文件的斜杠命令通过steer/followUp进行展开和排队
  - `steer()`和`followUp()`现在展开基于文件的斜杠命令，并对钩子命令报错（钩子命令不能被排队）
  - `prompt()` 现在接受新的 `streamingBehavior` 选项（`"steer"` 或 `"followUp"`），用于指定流式处理期间的排队行为

  - RPC `prompt` 命令现在接受可选的 `streamingBehavior` 字段
    ([#420](https://github.com/badlogic/pi-mono/issues/420))

### 修复

- 斜杠命令参数替换现在会在所有参数（`$@`、`$ARGUMENTS` 等）之前处理位置参数（`$1`、`$2` 等），以防止当参数值包含类似 `$100` 的美元数字模式时发生递归替换。 ([#418](https://github.com/badlogic/pi-mono/pull/418) 由 [@skuridin](https://github.com/skuridin) 提交)

## [0.32.1] - 2026-01-03

### 添加

- 无上下文贡献的 shell 命令：使用 `!!command` 执行将在 TUI 中显示并保存到会话历史记录但不包含在 LLM 上下文中的 bash 命令。适用于运行 AI 无法看到的命令。 ([#414](https://github.com/badlogic/pi-mono/issues/414))

### 修复

- 编辑工具 diff 由于异步预览计算与工具执行之间的竞态条件，未在 TUI 中显示

## [0.32.0] - 2026-01-03

### 重大变更

- **队列 API 已替换为 steer/followUp**：`queueMessage()` 方法已拆分为两个具有不同交付语义的方法 ([#403](https://github.com/badlogic/pi-mono/issues/403))：

  - `steer(text)`：在代理运行中（输入时流式处理）中断。在当前工具执行之后交付。
  - `followUp(text)`：等待代理完成（边推流边按Alt+Enter）。仅在代理停止时交付。
- **设置已重命名**：`queueMode`设置已重命名为`steeringMode`。新增`followUpMode`设置。旧的settings.json文件将自动迁移。
- **AgentSession方法已重命名**：
  - `queueMessage()` → `steer()`和`followUp()`
  - `queueMode`获取器 → `steeringMode`和`followUpMode`获取器
  - `setQueueMode()` → `setSteeringMode()`和`setFollowUpMode()`
  - `queuedMessageCount` → `pendingMessageCount`
  - `getQueuedMessages()` → `getSteeringMessages()`和`getFollowUpMessages()`
  - `clearQueue()`现在返回`{ steering: string[], followUp: string[] }`
  - `hasQueuedMessages()` → `hasPendingMessages()`
- **Hook API签名已更改**：`pi.sendMessage()`第二个参数已从`triggerTurn?: boolean`更改为`options?: { triggerTurn?, deliverAs? }`。使用`deliverAs: "followUp"`进行后续交付。影响所有Hook和内部`sendHookMessage()`方法。
- **RPC API更改**：
  - `queue_message`命令 → `steer`和`follow_up`命令
  - `set_queue_mode`命令 → `set_steering_mode`和`set_follow_up_mode`命令
  - `RpcSessionState.queueMode` → `steeringMode`和`followUpMode`
- **设置UI**：“队列模式”设置已拆分为“转向模式”和“后续模式”

### 新增
- 可配置的双转义操作：选择双转义时打开`/tree`（默认）还是`/branch`。通过settings.json中的`/settings`或`doubleEscapeAction`进行配置（[#404](https://github.com/badlogic/pi-mono/issues/404)）  
- Vertex AI提供商（`google-vertex`）：通过Google Cloud Vertex AI的Application Default Credentials访问Gemini模型（[#300](https://github.com/badlogic/pi-mono/pull/300)，由[@default-anton](https://github.com/default-anton)提交）  
- 内置提供商覆盖配置（`models.json`）：仅覆盖`baseUrl`以代理内置提供商同时保留所有模型，或定义`models`以完全替换提供商（[#406](https://github.com/badlogic/pi-mono/pull/406)，由[@yevhen](https://github.com/yevhen)提交）  
- 自动图片缩放：大于2000x2000的图片将被缩放以提高模型兼容性。原始尺寸将注入提示中。通过settings.json中的`/settings`或`images.autoResize`控制（[#402](https://github.com/badlogic/pi-mono/pull/402)，由[@mitsuhiko](https://github.com/mitsuhiko)提交）  
- Alt+Enter快捷键用于排队等待代理流式传输的消息  
- 现在导出`Theme`和`ThemeColor`类型用于使用`ctx.ui.custom()`的钩子  
- 终端窗口标题现在显示“pi - dirname”以标识当前项目会话（[#407](https://github.com/badlogic/pi-mono/pull/407)，由[@kaofelix](https://github.com/kaofelix)提交）  

### 已更改
- 编辑器组件现在使用单词换行而不是字符级换行，以提高可读性（[#382](https://github.com/badlogic/pi-mono/pull/382) by [@nickseelert](https://github.com/nickseelert)）

### 修复

- `/model`选择器现在会立即打开，而不是等待OAuth令牌刷新。令牌刷新将延迟，直到实际使用模型。
- 在Kitty协议终端（Kitty、WezTerm等）中，Shift+Space、Shift+Backspace和Shift+Delete现在可以正常工作，而不是被静默忽略（[#411](https://github.com/badlogic/pi-mono/pull/411) by [@nathyong](https://github.com/nathyong)）
- `AgentSession.prompt()` 现在在代理正在流式传输时调用会抛出异常，防止竞态条件。使用 `steer()` 或 `followUp()` 在流式传输期间排队消息。
- Ctrl+C 现在在选择器组件中像 Escape 一样工作，因此不断按 Ctrl+C 最终会关闭程序（[#400](https://github.com/badlogic/pi-mono/pull/400) by [@mitsuhiko](https://github.com/mitsuhiko)）

## [0.31.1] - 2026-01-02

### 修复

- 模型选择器在模型加载完成前按箭头键不再允许输入负索引（[#398](https://github.com/badlogic/pi-mono/pull/398) by [@mitsuhiko](https://github.com/mitsuhiko)）

- 类型保护函数（`isBashToolResult` 等）现在在运行时导出，而不仅限于类型声明（[#397](https://github.com/badlogic/pi-mono/issues/397)）

## [0.31.0] - 2026-01-02

本版本引入了会话树以支持就地分支、钩子和自定义工具的主要 API 变更，以及带文件跟踪的结构化压缩。

### 会话树
会话现在使用树结构，包含`id`/`parentId`字段。这使得就地分支成为可能：通过`/tree`导航到任意之前的节点，从那里继续，并在保持所有历史记录的前提下在分支间切换，所有操作均在一个文件中完成。

**现有的会话会自动迁移**（v1 → v2），首次加载时完成。无需手动操作。

新增的条目类型：`BranchSummaryEntry`（来自废弃分支的上下文）、`CustomEntry`（钩子状态）、`CustomMessageEntry`（钩子注入的消息）、`LabelEntry`（书签）。

有关文件格式和`SessionManager` API，请参见 [docs/session.md](docs/session.md)。

### 钩子迁移

钩子API已重构，支持更细粒度的事件和更好的会话访问能力。

**类型重命名：**

- `HookEventContext` → `HookContext`  
- `HookCommandContext` 现在是一个新的接口，继承自`HookContext`，并增加了会话控制方法

**事件变更：**

-  原来的单体`session`事件已拆分为更细粒度的事件：`session_start`、`session_before_switch`、`session_switch`、`session_before_branch`、`session_branch`、`session_before_compact`、`session_compact`、`session_shutdown`  
-  `session_before_switch`和`session_switch`事件现在包含`reason: "new" | "resume"`，以区分`/new`和`/resume`  
-  新增`session_before_tree`和`session_tree`事件，用于`/tree`导航（钩子可提供自定义分支摘要）  
-  新增`before_agent_start`事件：在代理循环开始前注入消息
-  新 `context` 事件：在每次调用 LLM 之前，非破坏性地修改消息
-  会话条目不再通过事件传递。改用 `ctx.sessionManager.getEntries()` 或 `ctx.sessionManager.getBranch()`

**API 变更：**

-  `pi.send(text, attachments?)` → `pi.sendMessage(message, triggerTurn?)`（创建 `CustomMessageEntry`）
-  新增 `pi.appendEntry(customType, data?)` 用于钩子状态持久化（不在 LLM 上下文中）
-  新增 `pi.registerCommand(name, options)` 用于自定义斜杠命令（处理器接收 `HookCommandContext`）
-  新增 `pi.registerMessageRenderer(customType, renderer)` 用于自定义 TUI 渲染
-  新增 `ctx.isIdle()`、`ctx.abort()`、`ctx.hasQueuedMessages()` 用于智能体状态（所有事件均可用）
-  新增 `ctx.ui.editor(title, prefill?)` 用于支持 Ctrl+G 外部编辑器的多行文本编辑
-  新增 `ctx.ui.custom(component)` 用于带键盘焦点的完整 TUI 组件渲染
-  新增 `ctx.ui.setStatus(key, text)` 用于在页脚持久显示状态文本（多个钩子可各自设置）
-  新增 `ctx.ui.theme` 用于获取带主题颜色样式的文本
-  `ctx.exec()` 已迁移到 `pi.exec()`
-  `ctx.sessionFile` → `ctx.sessionManager.getSessionFile()`
-  新增 `ctx.modelRegistry` 和 `ctx.model` 用于 API 密钥解析

**HookCommandContext（仅限斜杠命令）：**

-  `ctx.waitForIdle()` - 等待智能体完成流式处理
- `ctx.newSession(options?)` - 创建新会话，可选设置回调
- `ctx.fork(entryId) - 从特定条目分叉，创建新会话文件
- `ctx.navigateTree(targetId, options?)` - 浏览会话树

这些方法仅在 `HookCommandContext`（非 `HookContext`）上可用，因为如果从代理循环内的事件处理器调用，可能会发生死锁。

**已移除：**

- `hookTimeout` 设置（钩子不再有超时；使用 Ctrl+C 中断）
- `resolveApiKey` 参数（使用 `ctx.modelRegistry.getApiKey(model)`）

有关当前 API，请参见 [docs/hooks.md](docs/hooks.md) 和 [examples/hooks/](examples/hooks/)。

###  自定义工具迁移

自定义工具 API 已重构为与钩子模式一致，使用上下文对象。

**类型重命名：**

- `CustomAgentTool` → `CustomTool`
- `ToolAPI` → `CustomToolAPI`
- `ToolContext` → `CustomToolContext`
- `ToolSessionEvent` → `CustomToolSessionEvent`

**执行签名已更改：**

```typescript
// Before (v0.30.2)
execute(toolCallId, params, signal, onUpdate)

// After
execute(toolCallId, params, onUpdate, ctx, signal?)
```

新的 `ctx: CustomToolContext` 提供 `sessionManager`、`modelRegistry`、`model` 和代理状态方法：

- `ctx.isIdle()` - 检查代理是否正在流式传输
- `ctx.hasQueuedMessages()` - 检查用户是否有排队的消息（跳过交互式提示）
- `ctx.abort()` - 中断当前操作（发布-即忘）

**会话事件更改：**

- `CustomToolSessionEvent` 现在仅包含 `reason` 和 `previousSessionFile`
- 会话条目不再在事件中。使用`ctx.sessionManager.getBranch()`或`ctx.sessionManager.getEntries()`重建状态
- 原因：`"start" | "switch" | "branch" | "tree" | "shutdown"`（无单独`"new"`原因；`/new`触发`"switch"`）
- `dispose()`方法已移除。使用`onSession`与`reason: "shutdown"`进行清理

有关当前API，请参见[docs/custom-tools.md](docs/custom-tools.md)和[examples/custom-tools/](examples/custom-tools/)。

### SDK迁移

**类型更改：**

- `CustomAgentTool` → `CustomTool`
- `AppMessage` → `AgentMessage`
- `sessionFile`返回`string | undefined`（原来是`string | null`）
- `model`返回`Model | undefined`（原来是`Model | null`）
- `Attachment`类型已移除。使用`ImageContent`替代`@mariozechner/pi-ai`。直接将图片添加到消息内容数组中。

**AgentSession API：**

- `branch(entryIndex: number)` → `branch(entryId: string)`
- `getUserMessagesForBranching()`返回`{ entryId, text }`而不是`{ entryIndex, text }`
- `reset()` → `newSession(options?)`，options可选`parentSession`用于血统跟踪
- `newSession()`和`switchSession()`现在返回`Promise<boolean>`（如果被钩子取消则为false）
- 新增`navigateTree(targetId, options?)`用于就地树导航

**钩子集成：**

- 新增`sendHookMessage(message, triggerTurn?)`用于钩子消息注入

**SessionManager API：**
- 方法重命名：`saveXXX()` → `appendXXX()`（例如，`appendMessage`，`appendCompaction`）
- `branchInPlace()` → `branch()`
- `reset()` → `newSession(options?)`，可选`parentSession`用于血统追踪
- `createBranchedSessionFromEntries(entries, index)` → `createBranchedSession(leafId)`
- `SessionHeader.branchedFrom` → `SessionHeader.parentSession`
- `saveCompaction(entry)` → `appendCompaction(summary, firstKeptEntryId, tokensBefore, details?)`
- `getEntries()`现在不包含会话头部（单独使用`getHeader()`）
- `getSessionFile()`返回`string | undefined`（内存会话中未定义）
- 新树方法：`getTree()`，`getBranch()`，`getLeafId()`，`getLeafEntry()`，`getEntry()`，`getChildren()`，`getLabel()`
- 新追加方法：`appendCustomEntry()`，`appendCustomMessageEntry()`，`appendLabelChange()`
- 新分支方法：`branch(entryId)`，`branchWithSummary()`

**ModelRegistry（新）：**

`ModelRegistry`是一个管理模型发现和API密钥解析的新类。它将内置模型与来自`models.json`的自定义模型结合，并通过`AuthStorage`解析API密钥。

```typescript
import {
  discoverAuthStorage,
  discoverModels,
} from "@mariozechner/pi-coding-agent";

const authStorage = discoverAuthStorage(); // ~/.pi/agent/auth.json
const modelRegistry = discoverModels(authStorage); // + ~/.pi/agent/models.json

// Get all models (built-in + custom)
const allModels = modelRegistry.getAll();

// Get only models with valid API keys
const available = await modelRegistry.getAvailable();

// Find specific model
const model = modelRegistry.find("anthropic", "claude-sonnet-4-20250514");

// Get API key for a model
const apiKey = await modelRegistry.getApiKey(model);
```

这替代了旧的`resolveApiKey`回调模式。钩子和自定义工具通过`ctx.modelRegistry`访问它。

**重命名导出：**

- `messageTransformer` → `convertToLlm`
- `SessionContext`别名`LoadedSession`已移除
请参阅 [docs/sdk.md](docs/sdk.md) 和 [examples/sdk/](examples/sdk/) 了解当前API。

### RPC 迁移

**会话命令：**

- `reset`命令 → 带有可选`parentSession`字段的`new_session`命令

**分支命令：**

- `branch`命令：`entryIndex` → `entryId`  
- `get_branch_messages`响应：`entryIndex` → `entryId`

**类型变更：**

- 消息现在为`AgentMessage`（原来是`AppMessage`）  
- `prompt`命令：`attachments`字段被`images`字段替换，使用`ImageContent`格式

**压缩事件：**

- `auto_compaction_start`现在包含`reason`字段（`"threshold"`或`"overflow"`）  
- `auto_compaction_end`现在包含`willRetry`字段  
- `compact`响应包含完整的`CompactionResult`（`summary`、`firstKeptEntryId`、`tokensBefore`、`details`）

请参阅 [docs/rpc.md](docs/rpc.md) 了解当前协议。

### 结构化压缩

压缩和分支摘要现在使用结构化输出格式：

- 清晰部分：目标、进度、关键信息、文件操作  
- 文件跟踪：`readFiles`和`modifiedFiles`数组在`details`中，累积多个压缩操作  
- 对话在摘要前被序列化为文本，以防止模型“继续”对话
`before_compact`和`before_tree`钩子事件允许自定义压缩实现。请参阅[docs/compaction.md](docs/compaction.md)。

### 交互模式

**`/tree`命令：**

- 在原地浏览完整的会话树  
- 通过输入搜索，页面使用←/→导航  
- 过滤模式（Ctrl+O）：默认 → 无工具 → 仅用户 → 仅标签 → 全部  
- 按`l`标记条目为书签  
- 选择分支会切换上下文，并可选地注入废弃分支摘要

**条目标签：**

- 通过`/tree` → 选择 → `l`为任何条目添加书签  
- 标签会在树视图中显示，并作为`LabelEntry`持久保存

**主题更改（自定义主题将中断）：**

自定义主题必须添加这些新的颜色令牌，否则将无法加载：

- `selectedBg`：树选择器和其他组件中选中/高亮项的背景色  
- `customMessageBg`：钩子注入消息的背景色（`CustomMessageEntry`）  
- `customMessageText`：钩子消息的文本颜色  
- `customMessageLabel`：钩子消息的标签颜色（`[customType]`前缀）

颜色总数从46增加到50。有关完整颜色列表，请参阅[docs/themes.md](docs/themes.md)，并从内置深色/浅色主题复制值。

**设置：**

- `enabledModels`：允许`settings.json`中的模型白名单（格式与`--models` CLI相同）

### 已添加
- `ctx.ui.setStatus(key, text)` 用于在页脚显示持久状态文本（[#385](https://github.com/badlogic/pi-mono/pull/385) 由 [@prateekmedia](https://github.com/prateekmedia) 提交）
- `ctx.ui.theme` 获取器，用于对状态文本和其他输出应用主题颜色
- `/share` 命令，用于将当前会话上传为秘密 GitHub Gist，并通过 pi.dev 获取可分享的链接（[#380](https://github.com/badlogic/pi-mono/issues/380)）
-  HTML 导出现在包含一个树形可视化侧边栏，用于导航会话分支（[#375](https://github.com/badlogic/pi-mono/issues/375)）
-  HTML 导出支持键盘快捷键：Ctrl+T 切换思维块，Ctrl+O 切换工具输出
-  HTML 导出支持通过主题 JSON 中的可选 `export` 部分配置背景颜色（[#387](https://github.com/badlogic/pi-mono/pull/387) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交）
- HTML导出语法高亮现在使用主题颜色，并与TUI渲染保持一致
- **蛇游戏示例钩子**：演示`ui.custom()`、`registerCommand()`和会话持久化。请参阅[examples/hooks/snake.ts](examples/hooks/snake.ts)。
- **`thinkingText`主题令牌**：可配置的思考块文本颜色。([#366](https://github.com/badlogic/pi-mono/pull/366)由[@paulbettner](https://github.com/paulbettner)提供)

### 已更改

- **入口ID**：会话条目现在使用简短的8位十六进制ID，而不是完整的UUID。
- **API key priority**: `ANTHROPIC_OAUTH_TOKEN` 现在优先于 `ANTHROPIC_API_KEY`
- HTML 导出模板已拆分为单独文件（template.html、template.css、template.js），便于维护

### 修复

- HTML 导出现在能正确清理用户消息中包含的 HTML 标签（如 `<style>`），防止破坏 DOM 渲染
- 显示包含 Unicode 格式字符（如 U+0600-U+0604）的 bash 输出时发生崩溃（[#372](https://github.com/badlogic/pi-mono/pull/372) 由 [@HACKE-RC](https://github.com/HACKE-RC) 提交）
- **页脚显示完整会话统计**：令牌使用量和费用现在包含所有消息，而不仅仅是压缩后的消息。[#322](https://github.com/badlogic/pi-mono/issues/322)
- **状态消息垃圾聊天日志**：快速更改设置（例如通过 Shift+Tab 更改思考等级）会添加多条状态行。现在连续的状态更新会合并成一条。([#365](https://github.com/badlogic/pi-mono/pull/365) by [@paulbettner](https://github.com/paulbettner))
- **流媒体期间切换思考块显示为空**：在流媒体期间按下 Ctrl+T 会隐藏当前消息，直到流媒体完成。
- **恢复会话将思考等级重置为关闭**：初始模型和思考等级未保存到会话文件，导致 `--resume`/`--continue` 默认为 `off`。([#342](https://github.com/badlogic/pi-mono/issues/342) by [@aliou](https://github.com/aliou))
- **Hook `tool_result`事件忽略自定义工具的错误**: 之前`tool_result`钩子事件在工具抛出错误时从未发出，且始终以`isError: false`表示执行成功。现在无论成功还是错误情况，都会发出带有正确`isError`值的事件。([#374](https://github.com/badlogic/pi-mono/issues/374) by [@nicobailon](https://github.com/nicobailon))
- **编辑工具在Windows上因CRLF换行符失败**: 现在文件中的CRLF换行符能正确匹配LLMs发送的仅含LF的文本。换行符在匹配前会被标准化，写入时恢复为原始样式。([#355](https://github.com/badlogic/pi-mono/issues/355) by [@Pratham-Dubey](https://github.com/Pratham-Dubey))
- **编辑工具在带有UTF-8 BOM的文件上失败**: 带有UTF-8 BOM标记的文件可能导致“文本未找到”错误，因为LLM不包含不可见的BOM字符。现在匹配前会剥离BOM，写入时再恢复。([#394](https://github.com/badlogic/pi-mono/pull/394) by [@prathamdby](https://github.com/prathamdby))
- **在 Unix 上使用 bash 代替 sh**：修复了 Unix 系统上使用 `/bin/sh` 代替 `/bin/bash` 的 shell 命令。([#328](https://github.com/badlogic/pi-mono/pull/328) by [@dnouri](https://github.com/dnouri))
- **OAuth 登录 URL 可点击**：使终端中的 OAuth 登录 URL 可点击。([#349](https://github.com/badlogic/pi-mono/pull/349) by [@Cursivez](https://github.com/Cursivez))
- **改进错误信息**：当 `apiKey` 或 `model` 缺失时，提供更好的错误信息。([#346](https://github.com/badlogic/pi-mono/pull/346) by [@ronyrus](https://github.com/ronyrus))
- **会话文件验证**：`findMostRecentSession()`现在会在返回之前验证会话头部，防止非会话JSONL文件被加载  
- **压缩错误处理**：`generateSummary()`和`generateTurnPrefixSummary()`现在会在LLM错误时抛出异常，而不是返回空字符串  
- **分支会话压缩**：修复了压缩时错误包含废弃分支条目，导致令牌溢出错误的问题。压缩现在仅使用`sessionManager.getPath()`处理当前分支路径，消除了`prepareCompaction()`和`compact()`之间80+行重复条目收集逻辑  
- **启用模型的glob模式支持**：`--models`和`enabledModels`现在支持如`github-copilot/*`或`*sonnet*`的glob模式。以前，模式只能按字面或子串匹配。([#337](https://github.com/badlogic/pi-mono/issues/337))

## [0.30.2] - 2025-12-26

### 已更改

- **迁移合并**：将认证迁移从`AuthStorage.migrateLegacy()`移动到新的`migrations.ts`模块。

## [0.30.1] - 2025-12-26

### 已修复

- **会话保存到错误目录**：在v0.30.0版本中，会话被保存到`~/.pi/agent/`而不是`~/.pi/agent/sessions/<encoded-cwd>/`，导致`--resume`和`/resume`无法正常工作。错位的会话会在启动时自动迁移。([#320](https://github.com/badlogic/pi-mono/issues/320) 由[@aliou](https://github.com/aliou) 提交)
- **自定义系统提示缺少上下文**：当使用自定义系统提示字符串时，未附加项目上下文文件（AGENTS.md）、技能、日期/时间以及工作目录。([#321](https://github.com/badlogic/pi-mono/issues/321))

## [0.30.0] - 2025-12-25

### 不兼容变更

- **SessionManager API**：`create()`、`continueRecent()`和`list()`的第二个参数已从`agentDir`更改为`sessionDir`。若提供，它将直接指定会话目录（不进行cwd编码）。若省略，则使用默认值（`~/.pi/agent/sessions/<encoded-cwd>/`）。`open()`不再接受`agentDir`。([#313](https://github.com/badlogic/pi-mono/pull/313))

### 新增

- **`--session-dir`标志**：使用自定义目录进行会话，而非默认的`~/.pi/agent/sessions/<encoded-cwd>/`。与`-c`（继续）和`-r`（恢复）标志兼容。([#313](https://github.com/badlogic/pi-mono/pull/313) by [@scutifer](https://github.com/scutifer))

- **反向模型循环和模型选择器**：Shift+Ctrl+P反向切换模型，Ctrl+L打开模型选择器（保持编辑器中的文本）。([#315](https://github.com/badlogic/pi-mono/pull/315) by [@mitsuhiko](https://github.com/mitsuhiko))

## [0.29.1] - 2025-12-25

### 新增

- **自动加载自定义系统提示**：Pi现在会自动加载`SYSTEM.md`文件以替换默认系统提示。项目本地的`.pi/SYSTEM.md`优先于全局的`~/.pi/agent/SYSTEM.md`。CLI的`--system-prompt`标志可覆盖两者。([#309](https://github.com/badlogic/pi-mono/issues/309))
- **统一 `/settings` 命令**：新建设置菜单，整合思考等级、主题、队列模式、自动压缩、显示图片、隐藏思考和折叠变更日志等设置。替代原有的 `/thinking`、`/queue`、`/theme`、`/autocompact` 和 `/show-images` 命令。([#310](https://github.com/badlogic/pi-mono/issues/310))

### 修复

- **带 typebox 子路径导入的自定义工具/钩子**：修复 `@sinclair/typebox` 的 jiti 别名，使其指向包根目录而非入口文件，从而允许 `@sinclair/typebox/compiler` 等导入正确解析。([#311](https://github.com/badlogic/pi-mono/issues/311) 由 [@kim0](https://github.com/kim0) 提交)

## [0.29.0] - 2025-12-25

### 重大变更

- **将 `/clear` 重命名为 `/new`**：启动新会话的命令现为 `/new`。钩子事件 `before_clear`/`clear` 现已更名为 `before_new`/`new`。圣诞快乐 [@mitsuhiko](https://github.com/mitsuhiko)！([#305](https://github.com/badlogic/pi-mono/pull/305))

### 新增

- **粘贴文件路径时自动添加空格**：当在单词字符后粘贴以 `/`、`~` 或 `.` 开头的文件路径时，会自动前置空格。([#307](https://github.com/badlogic/pi-mono/pull/307) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交)

- **输入字段中的单词导航**：新增 Ctrl+左/右 和 Alt+左/右，实现光标单词级移动。([#306](https://github.com/badlogic/pi-mono/pull/306) 由 [@kim0](https://github.com/kim0) 提交)
- **完整Unicode输入**: 输入框现在支持ASCII以外的Unicode字符。 ([#306](https://github.com/badlogic/pi-mono/pull/306) by [@kim0](https://github.com/kim0))

### 修复

- **类似readline的Ctrl+W**: 现在删除前一个单词时会跳过前面的空白字符，符合标准readline行为。 ([#306](https://github.com/badlogic/pi-mono/pull/306) by [@kim0](https://github.com/kim0))

## [0.28.0] - 2025-12-25

### 更改

- **凭证存储重构**: API密钥和OAuth令牌现在存储在`~/.pi/agent/auth.json`，而不是`oauth.json`和`settings.json`。现有凭证将在首次运行时自动迁移。 ([#296](https://github.com/badlogic/pi-mono/issues/296))

- **SDK API变更** ([#296](https://github.com/badlogic/pi-mono/issues/296))：

  - 增加了`AuthStorage`类用于凭证管理（API密钥和OAuth令牌）
  - 增加了`ModelRegistry`类用于模型发现和API密钥解析
  - 增加了`discoverAuthStorage()`和`discoverModels()`发现函数
  - `createAgentSession()`现在接受`authStorage`和`modelRegistry`选项
  - 移除了`configureOAuthStorage()`、`defaultGetApiKey()`、`findModel()`、`discoverAvailableModels()`
  - 移除了`getApiKey`回调选项（使用`AuthStorage.setRuntimeApiKey()`进行运行时覆盖）
  - 使用`getModel()`从`@mariozechner/pi-ai`获取内置模型，`modelRegistry.find()`获取自定义模型+内置模型
  - 请参阅更新后的[SDK文档](docs/sdk.md)和[README](README.md)
- **设置更改**：已从 `settings.json` 中移除 `apiKeys`，请改用 `auth.json`。([#296](https://github.com/badlogic/pi-mono/issues/296))

### 修复

- **符号链接的重复技能警告**：通过指向同一文件的符号链接加载的技能现在会静默去重，不再显示名称冲突警告。([#304](https://github.com/badlogic/pi-mono/pull/304) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交)

## [0.27.9] - 2025-12-24

### 修复

- **模型选择器和 --list-models 与 settings.json API 密钥**：配置在 settings.json 中（但未在环境变量中）的模型现在能正确出现在 /model 选择器和 `--list-models` 输出中。([#295](https://github.com/badlogic/pi-mono/issues/295))

## [0.27.8] - 2025-12-24

### 修复

- **API 密钥优先级**：OAuth 令牌现在优先于 settings.json 中的 API 密钥。之前，settings.json 中的 API 密钥会覆盖 OAuth，导致已登录用户（拥有无限令牌计划）被按 PAYG 方式计费。

## [0.27.7] - 2025-12-24

### 修复

- **思考标签泄漏**：修复了 Claude 在响应中模仿字面 `</thinking>` 标签的问题。未签名的思考块（来自中止的流）现在会转换为无 `<thinking>` 标签的纯文本。TUI 仍将其显示为思考块。([#302](https://github.com/badlogic/pi-mono/pull/302) 由 [@nicobailon](https://github.com/nicobailon) 提交)

## [0.27.6] - 2025-12-24

### 新增

- **压缩钩子改进**：`before_compact` 会话事件现在包括：
  - `previousSummary`：上次压缩的摘要（如果有），以便钩子可以保留累积的上下文
  - `messagesToKeep`：摘要之后保留的消息（最近的轮次），除了 `messagesToSummarize`
  - `resolveApiKey`：用于解析任何模型的API密钥的函数（检查设置、OAuth、环境变量）
  - 移除了 `apiKey` 字符串，改用 `resolveApiKey` 以获得更大的灵活性

- **SessionManager API 清理**：
  - 将 `loadSessionFromEntries()` 重命名为 `buildSessionContext()`（从条目构建LLM上下文，处理压缩）
  - 将 `loadEntries()` 重命名为 `getEntries()`（返回所有会话条目的防御性副本）
  - 为 SessionManager 添加了 `buildSessionContext()` 方法

## [0.27.5] - 2025-12-24

### 添加了

- **HTML 导出语法高亮**：Markdown和工具输出（读取、写入）中的代码块现在使用 highlight.js 进行语法高亮，颜色与TUI匹配。
- **HTML 导出改进**：服务器端渲染Markdown（表格、标题、代码块等），尊重用户选择的主题（亮色/暗色），为用户消息添加图片渲染，并为代码块添加类似TUI的语言标记。([@scutifer](https://github.com/scutifer))

### 修复了

- **Ghostty 在 tmux 中的内联图片**：修复了Ghostty在tmux中运行时的终端检测，通过检查 `GHOSTTY_RESOURCES_DIR` 环境变量。([#299](https://github.com/badlogic/pi-mono/pull/299) 由 [@nicobailon](https://github.com/nicobailon) 提交)

## [0.27.4] - 2025-12-24
### 修复

- **符号链接技能目录**：符号链接目录中的技能（例如 `~/.pi/agent/skills/my-skills -> /path/to/skills`）现在可以正确发现并加载。

## [0.27.3] - 2025-12-24

### 新增

- **settings.json 中的 API 密钥**：将 API 密钥存储在 `~/.pi/agent/settings.json` 下的 `apiKeys` 字段（例如 `{ "apiKeys": { "anthropic": "sk-..." } }`）。设置密钥优先于环境变量。([#295](https://github.com/badlogic/pi-mono/issues/295))

### 修复

- **允许未配置 API 密钥时启动**：交互模式不再在未配置 API 密钥时抛出错误。用户现在可以启动代理并使用 `/login` 进行身份验证。([#288](https://github.com/badlogic/pi-mono/issues/288))

- **`--system-prompt` 路径支持**：`--system-prompt` 参数现在可以正确解析文件路径（与 `--append-system-prompt` 一致）。([#287](https://github.com/badlogic/pi-mono/pull/287) 由 [@scutifer](https://github.com/scutifer) 提交)

## [0.27.2] - 2025-12-23

### 新增

- **分支时跳过会话恢复**：钩子可以从 `before_branch` 返回 `{ skipConversationRestore: true }`，以创建分支会话文件而不恢复对话消息。适用于单独恢复文件的检查点钩子。([#286](https://github.com/badlogic/pi-mono/pull/286) 由 [@nicobarray](https://github.com/nicobarray) 提交)

## [0.27.1] - 2025-12-22

### 修复
- **技能发现性能**：递归扫描技能时跳过`node_modules`目录。修复了当技能目录包含npm依赖时约60ms的启动延迟。

### 添加

- **启动时间监控**：设置`PI_TIMING=1`以查看启动性能分解（仅限交互模式）。

## [0.27.0] - 2025-12-22

### 破坏

- **会话钩子API重设计**：将`branch`事件合并到`session`事件。移除`BranchEvent`、`BranchEventResult`类型和`pi.on("branch", ...)`。改用`pi.on("session", ...)`与`reason: "before_branch" | "branch"`。`AgentSession.branch()`现在返回`{ cancelled }`而不是`{ skipped }`。`AgentSession.reset()`和`switchSession()`现在返回`boolean`（如果被钩子取消则为false）。RPC命令`reset`、`switch_session`和`branch`的响应数据现在包含`cancelled`。([#278](https://github.com/badlogic/pi-mono/issues/278))

### 添加

- **会话生命周期钩子**：添加`before_*`变体（`before_switch`、`before_clear`、`before_branch`），可在执行动作前触发且可被`{ cancel: true }`取消。添加`shutdown`以支持优雅退出处理。([#278](https://github.com/badlogic/pi-mono/issues/278))

### 修复

- **文件标签完成显示**：文件路径不再被过早截断。文件夹现在显示尾随的`/`，并移除冗余的“目录”/“文件”标签以最大化水平空间。([#280](https://github.com/badlogic/pi-mono/issues/280))
- **Bash工具视觉行截断修复**：已将bash工具输出在折叠模式下改为使用视觉行计数（考虑换行情况），而非逻辑行计数。现在与bash-execution.ts的行为一致。已提取共享`truncateToVisualLines`工具。([#275](https://github.com/badlogic/pi-mono/issues/275))

## [0.26.1] - 2025-12-22

### 修复

- **SDK工具尊重当前工作目录**：核心工具（bash、read、edit、write、grep、find、ls）现在正确使用`cwd`选项，该选项来源于`createAgentSession()`。为SDK用户提供工具工厂函数（`createBashTool`、`createReadTool`等），用户可指定自定义`cwd`及明确的工具。([#279](https://github.com/badlogic/pi-mono/issues/279))

## [0.26.0] - 2025-12-22

### 添加

- **SDK程序化使用支持**：新增`createAgentSession()`工厂，可完全控制模型、工具、钩子、技能、会话持久化和设置。哲学：“省略以发现，提供以覆盖”。包含12个示例和全面文档。([#272](https://github.com/badlogic/pi-mono/issues/272))

- **项目特定设置**：设置现在可从全局`~/.pi/agent/settings.json`和项目`<cwd>/.pi/settings.json`均加载。项目设置通过深度合并覆盖全局设置（嵌套对象）。项目设置为只读（便于版本控制）。([#276](https://github.com/badlogic/pi-mono/pull/276))

- **SettingsManager静态工厂**：`SettingsManager.create(cwd?, agentDir?)`用于文件式设置，`SettingsManager.inMemory(settings?)`用于测试。新增`applyOverrides()`用于程序化覆盖。
- **SessionManager静态工厂**：`SessionManager.create()`、`SessionManager.open()`、`SessionManager.continueRecent()`、`SessionManager.inMemory()`、`SessionManager.list()`，用于灵活的会话管理。

## [0.25.4] - 2025-12-22

### 修复

- **stderr垃圾日志语法高亮**：修复了当Markdown中包含格式错误的代码边界（例如，缺少反引号结尾处的换行）时，cli-highlight将错误日志输出到stderr的问题。现在会在高亮前验证语言标识符，若失败则静默回退为纯文本。([#274](https://github.com/badlogic/pi-mono/issues/274))

## [0.25.3] - 2025-12-21

### 新增

- **Gemini 3预览模型**：已将`gemini-3-pro-preview`和`gemini-3-flash-preview`添加到google-gemini-cli提供者中。([#264](https://github.com/badlogic/pi-mono/pull/264) by [@LukeFost](https://github.com/LukeFost))

- **外部编辑器支持**：按`Ctrl+G`可在外编辑器中编辑您的消息。使用`$VISUAL`或`$EDITOR`环境变量。保存成功后，消息会被替换；取消时，保持原始内容。([#266](https://github.com/badlogic/pi-mono/pull/266) by [@aliou](https://github.com/aliou))

- **进程挂起**：按`Ctrl+Z`可挂起pi并返回shell。如常使用`fg`恢复。([#267](https://github.com/badlogic/pi-mono/pull/267) by [@aliou](https://github.com/aliou))
- **可配置的技能目录**：通过 `enableCodexUser`、`enableClaudeUser`、`enableClaudeProject`、`enablePiUser`、`enablePiProject` 切换，以及 `customDirectories` 和 `ignoredSkills` 设置，增加了对技能源的细粒度控制。([#269](https://github.com/badlogic/pi-mono/pull/269) by [@nicobailon](https://github.com/nicobailon))

- **技能命令行过滤**：增加了 `--skills <patterns>` 标志，用于通过 glob 模式过滤技能。同时增加了 `includeSkills` 设置和 `ignoredSkills` 的 glob 模式支持。([#268](https://github.com/badlogic/pi-mono/issues/268))

## [0.25.2] - 2025-12-21

### 修复

- **工具输出中的图像偏移**：修复了每次展开或折叠工具输出（通过 Ctrl+O）时，工具输出中的图像会向下偏移（由于累积空格）的问题。

## [0.25.1] - 2025-12-21

### 修复

- **Gemini 图像读取故障**：修复了 `read` 工具返回图像导致与 Gemini 模型交互出现不稳定/故障响应的问题。工具结果中的图像现在已按 Gemini API 规范正确格式化。

- **绝对路径的 Tab 自动补全**：修复了 Tab 自动补全产生 `//tmp` 而非 `/tmp/` 的问题。同时修复了符号链接目录（如 `/tmp`）没有尾部斜杠，导致无法继续通过子目录进行 Tab 自动补全的问题。

## [0.25.0] - 2025-12-20

### 增加
- **中断工具执行**：在工具正在执行时排队消息会中断当前工具批次。剩余工具将被跳过并返回错误结果，您的排队消息将立即处理。适用于任务中途切换代理。([#259](https://github.com/badlogic/pi-mono/pull/259) by [@steipete](https://github.com/steipete))

- **Google Gemini CLI OAuth 提供者**：通过 Google Cloud Code Assist 免费访问 Gemini 2.0/2.5 模型。使用 `/login` 登录并选择 "Google Gemini CLI"。使用您的 Google 账号，有速率限制。

- **Google Antigravity OAuth 提供者**：通过 Google 的 Antigravity 沙盒免费访问 Gemini 3、Claude（sonnet/opus thinking 模型）和 GPT-OSS 模型。使用 `/login` 登录并选择 "Antigravity"。使用您的 Google 账号，有速率限制。

### 已更改

- **模型选择器尊重 --models 范围**：`/model` 命令现在仅在使用 `--models` 标志时显示通过该标志指定的模型，而不是显示所有可用模型。这可防止意外选择来自非预期提供者的模型。([#255](https://github.com/badlogic/pi-mono/issues/255))

### 已修复

- **连接错误不再重试**：已将 "connection error" 添加至可重试错误列表，因此当 Anthropic 连接断开时会自动重试，而不是静默失败。([#252](https://github.com/badlogic/pi-mono/issues/252))
- **模型切换时思维层级未限制**: 修复了在切换到不支持高思维层级的模型后，TUI界面仍显示xhigh思维层级的问题。思维层级现在会自动限制在模型能力范围内。([#253](https://github.com/badlogic/pi-mono/issues/253))

- **跨模型思维交接**: 修复了在不同思维签名格式的模型间切换时出现的错误（例如，从GPT-OSS切换到Claude思维模型）。没有签名的思维块现在会被转换为带有`<thinking>`分隔符的文本。

## [0.24.5] - 2025-12-20

### 已修复

- **iTerm2输入缓冲问题**: 修复了在iTerm2中Ctrl+C、Ctrl+D及其他需要多次按键的键无法正常输入的问题。之前的单元格大小查询响应解析器错误地拦截了键盘输入。

## [0.24.4] - 2025-12-20

### 已修复

- **选择器组件中的箭头键和回车键**: 修复了在模型选择器、会话选择器、OAuth选择器等组件中，当启用大写锁定或数字锁定时，箭头键和回车键无法正常工作的问题。([#243](https://github.com/badlogic/pi-mono/issues/243))

## [0.24.3] - 2025-12-19

### 已修复

- **窄终端底部溢出问题**: 修复了在终端宽度非常窄时，底部路径显示超出宽度导致渲染崩溃的问题。

## [0.24.2] - 2025-12-20

### 已修复
- **更多Kitty键盘协议修复**：修复了启用大写锁定时，退格、回车、主页、结束和删除键无法正常工作的问题。0.24.1的初始修复遗漏了仍在使用原始字节检测的几个按键处理程序。现在所有按键处理程序都使用辅助函数，能够正确屏蔽锁定键位。([#243](https://github.com/badlogic/pi-mono/issues/243))

## [0.24.1] - 2025-12-19
### 新增

- **OAuth和模型配置导出**：使用`AgentSession`的脚本现在可以从`@mariozechner/pi-coding-agent`导入`getAvailableModels`、`getApiKeyForModel`、`findModel`、`login`、`logout`和`getOAuthProviders`，以复用OAuth令牌存储和模型解析功能。([#245](https://github.com/badlogic/pi-mono/issues/245))

- **gpt-5.2模型的xhigh思考等级**：思考等级选择器和Shift+Tab循环现在为gpt-5.2和gpt-5.2-codex模型（除gpt-5.1-codex-max外）显示xhigh选项。([#236](https://github.com/badlogic/pi-mono/pull/236) 由[@theBucky](https://github.com/theBucky) 提交)

### 修复

- **钩子包裹自定义工具**：自定义工具现在通过钩子包装器执行，因此`tool_call`和`tool_result`钩子可以观察、阻止和修改自定义工具的执行（与钩子类型文档保持一致）。([#248](https://github.com/badlogic/pi-mono/pull/248) 由[@nicobailon](https://github.com/nicobailon) 提交)

- **钩子 onUpdate 回调转发**：`onUpdate`回调现在通过钩子包装器正确转发，修复了自定义工具进度更新的问题。([#238](https://github.com/badlogic/pi-mono/pull/238) 由[@nicobailon](https://github.com/nicobailon) 提交)

- **Ctrl+C在会话选择器中终端清理**：修复了在会话选择器中按下Ctrl+C时终端未能正确恢复的问题。([#247](https://github.com/badlogic/pi-mono/pull/247) 由[@aliou](https://github.com/aliou) 提交)

- **包含冒号的OpenRouter模型ID解析**：修复了包含冒号（例如`openrouter:meta-llama/llama-4-scout:free`）的OpenRouter模型ID解析问题。([#242](https://github.com/badlogic/pi-mono/pull/242) 由[@aliou](https://github.com/aliou) 提交)
- **全局 AGENTS.md 文件加载两次问题修复**：当 `~/.pi/agent/` 和当前目录均存在 AGENTS.md 时，已修复全局 AGENTS.md 文件被加载两次的问题。([#239](https://github.com/badlogic/pi-mono/pull/239) 由 [@aliou](https://github.com/aliou) 提交)

- **Linux 平台 Kitty 键盘协议修复**：修复了在 Linux 平台使用 Ghostty 时，启用 Num Lock 会导致键盘输入失效的问题。Kitty 协议将 Caps Lock 和 Num Lock 状态包含在修饰符值中，导致按键检测异常。现已正确屏蔽锁定键位，以匹配键盘快捷键。([#243](https://github.com/badlogic/pi-mono/issues/243))

- **Emoji 删除与光标移动修复**：Backspace、Delete 和方向键现能正确处理多代码点字符（如 Emoji）。此前删除 Emoji 会留下部分字节，导致编辑器状态损坏。([#240](https://github.com/badlogic/pi-mono/issues/240))

## [0.24.0] - 2025-12-19

### 新增

- **子代理编排示例**：新增完整的自定义工具示例，用于生成和编排具有隔离上下文窗口的子代理。包含侦察/规划/评审/执行代理及多代理流水线的工作流命令。([#215](https://github.com/badlogic/pi-mono/pull/215) 由 [@nicobailon](https://github.com/nicobailon) 提交)

- **`getMarkdownTheme()` 导出功能**：自定义工具现可从 `@mariozechner/pi-coding-agent` 导入 `getMarkdownTheme()`，以使用与主界面相同的 Markdown 样式。
- **`pi.exec()`信号和超时支持**：自定义工具和钩子现在可以将`{ signal, timeout }`选项传递给`pi.exec()`，用于取消和超时处理。结果包括在进程被终止时设置的`killed`标志。

- **Kitty键盘协议支持**：Shift+Enter、Alt+Enter、Shift+Tab、Ctrl+D以及所有Ctrl+键组合现在可在Ghostty、Kitty、WezTerm和其他现代终端中正常工作。([#225](https://github.com/badlogic/pi-mono/pull/225) by [@kim0](https://github.com/kim0))

- **动态API密钥刷新**：OAuth令牌（GitHub Copilot、Anthropic OAuth）现在会在每次大语言模型（LLM）调用前刷新，避免在长时间运行的代理循环中因令牌过期导致会话中断。([#223](https://github.com/badlogic/pi-mono/pull/223) by [@kim0](https://github.com/kim0))

- **`/hotkeys`命令**：以格式化表格形式显示所有键盘快捷键。

- **Markdown表格边框**：表格现在会正确渲染顶部和底部边框。

### 已更改

- **子代理示例改进**：并行模式现在会从所有任务中流式传输更新。链式模式在流式传输时会显示所有已完成的步骤。扩展视图使用正确的Markdown渲染并带有语法高亮。使用说明页底部会显示轮询次数。
- **技能标准合规**：技能现已遵循[代理技能标准](https://agentskills.io/specification)。验证名称（必须与父目录一致，小写，最大64个字符）、描述（必填，最大1024个字符）和前置数据字段。对违规行为发出警告但保持宽松。提示格式已更改为XML结构。移除了`{baseDir}`占位符，改用相对路径。([#231](https://github.com/badlogic/pi-mono/issues/231))

### 修复

- **JSON模式stdout刷新**：修复了`pi --mode json`可能在所有输出写入stdout之前退出的竞态条件，避免消费者错过最终事件。

- **符号链接工具、钩子和斜杠命令**：发现机制现在在扫描自定义工具、钩子和斜杠命令时会正确跟随符号链接。([#219](https://github.com/badlogic/pi-mono/pull/219), [#232](https://github.com/badlogic/pi-mono/pull/232)由[@aliou](https://github.com/aliou)提交)

### 重大变更

- **自定义工具现在需要`index.ts`入口点**：自动发现的自定义工具必须位于包含`index.ts`文件的子目录中。旧模式`~/.pi/agent/tools/mytool.ts`必须更改为`~/.pi/agent/tools/mytool/index.ts`。这允许多文件工具导入辅助模块。通过`--tool`或`settings.json`显式指定路径，仍可与任何`.ts`文件配合使用。

- **钩子`tool_result`事件重构**：`ToolResultEvent`现在会暴露完整的工具结果数据，而非仅文本。([#233](https://github.com/badlogic/pi-mono/pull/233))
  - 移除：`result: string`字段
  - 新增：`content: (TextContent | ImageContent)[]` - 完整内容数组
  - 新增：`details: unknown` - 针对特定工具的详细信息（通过`toolName`的区分联合类型输入）
  - `ToolResultEventResult.result`更名为`ToolResultEventResult.text`（已移除），请改用`content`
  - 钩子处理器返回值必须从`{ result: "..." }`更改为`{ content: [{ type: "text", text: "..." }] }`
  - 导出了内置工具的详细信息类型：`BashToolDetails`、`ReadToolDetails`、`GrepToolDetails`、`FindToolDetails`、`LsToolDetails`、`TruncationResult`
  - 导出了类型守卫以缩小范围：`isBashToolResult`、`isReadToolResult`、`isEditToolResult`、`isWriteToolResult`、`isGrepToolResult`、`isFindToolResult`、`isLsToolResult`

## [0.23.4] - 2025-12-18

### 新增

- **语法高亮**：为Markdown代码块、读取工具输出和写入工具内容添加了语法高亮。使用cli-highlight，并采用主题感知的颜色映射和VS Code风格的语法颜色。([#214](https://github.com/badlogic/pi-mono/pull/214) 由[@svkozak](https://github.com/svkozak) 提交)

- **行内差异高亮**：编辑工具现在会在单行修改时以反向高亮显示单词级别的更改。多行更改则先显示所有删除的行，然后显示所有添加的行。

### 修复

- **Gemini工具结果格式**：修复了Gemini 3 Flash Preview工具结果格式，该格式严格要求成功时使用`{ output: value }`，错误时使用`{ error: value }`。之前的格式使用`{ result, isError }`已被更新的Gemini模型拒绝。([#213](https://github.com/badlogic/pi-mono/issues/213), [#220](https://github.com/badlogic/pi-mono/pull/220))
- **Google baseUrl 配置**：Google 提供商现在会遵循 `baseUrl` 配置，用于自定义端点或 API 代理。([#216](https://github.com/badlogic/pi-mono/issues/216), [#221](https://github.com/badlogic/pi-mono/pull/221) 由 [@theBucky](https://github.com/theBucky) 提交)

- **Google 提供商 FinishReason**：增加了对新 `IMAGE_RECITATION` 和 `IMAGE_OTHER` 结束原因的处理。将 @google/genai 升级到 1.34.0。

## [0.23.3] - 2025-12-17

### 修复

- 在提交用户提示前检查是否需要进行压缩，而不仅仅是代理回合结束后。这样可以捕获用户中途取消响应且上下文已接近限制的情况。

### 更改

- 改进系统提示文档部分，提供更明确的指向，便于查找自定义模型、主题、技能、钩子、自定义工具和 RPC 的具体文档。

- 清理了文档：

  - `theme.md`：添加缺失的颜色令牌（`thinkingXhigh`，`bashMode`）
  - `skills.md`：重写，采用更好的框架和示例
  - `hooks.md`：修复超时/错误处理文档，添加导入别名部分
  - `custom-tools.md`：添加介绍，包含使用场景和对比表
  - `rpc.md`：添加缺失的 `hook_error` 事件文档
  - `README.md`：完善设置表，精简哲学部分，标准化OAuth文档

- Hook加载器现在支持与自定义工具相同的导入别名（`@sinclair/typebox`、`@mariozechner/pi-ai`、`@mariozechner/pi-tui`、`@mariozechner/pi-coding-agent`）。

### 不兼容变更

- **Hook**：`turn_end`事件的`toolResults`类型已从`AppMessage[]`更改为`ToolResultMessage[]`。如果您有处理`turn_end`事件的Hook并显式标注了结果类型，请更新您的类型注解。

## [0.23.2] - 2025-12-17

### 修复

- Fixed Claude模型通过GitHub Copilot在多轮对话中重复回答所有先前提示的问题。问题是助手消息内容被当作数组发送，而不是字符串，导致Copilot的Claude适配器误解析。同时添加了缺失的`Openai-Intent: conversation-edits`头部，并修复了`X-Initiator`逻辑，以检查历史记录中是否存在任何助手/工具消息。（[#209](https://github.com/badlogic/pi-mono/issues/209)）

- 通过文件魔术检测图片MIME类型（读取工具和`@file`附件），而不是通过文件扩展名。

- Fixed markdown表格超出终端宽度。表格现在会自动换行以适应可用宽度，而不是在行中间断开边框。（[#206](https://github.com/badlogic/pi-mono/pull/206) by [@kim0](https://github.com/kim0)）

## [0.23.1] - 2025-12-17

### 修复

- Fixed TUI性能倒退，原因是Box组件缺乏渲染缓存。内置工具现在直接使用Text（如同v0.22.5），Box为自定义工具渲染提供了适当的缓存。
- 修复了自定义工具在pi全局安装后无法从`~/.pi/agent/tools/`加载的问题。模块导入（`@sinclair/typebox`、`@mariozechner/pi-tui`、`@mariozechner/pi-ai`）现在通过别名解析。

## [0.23.0] - 2025-12-17

### 新增

- **自定义工具**：用TypeScript编写自定义工具扩展pi。工具可提供自定义TUI渲染，通过`pi.ui`与用户交互（select、confirm、input、notify），并通过`onSession`回调跨会话维护状态。详见[docs/custom-tools.md](docs/custom-tools.md)和[examples/custom-tools/](examples/custom-tools/)。([#190](https://github.com/badlogic/pi-mono/issues/190))

- **Hook和工具示例**：新增了`examples/hooks/`和`examples/custom-tools/`，包含可用的工作示例。示例现已打包进npm和二进制发布版本。

### 不兼容变更

- **Hooks**：用统一的`session`事件替换了`session_start`和`session_switch`事件。用`event.reason`（`"start" | "switch" | "clear"`）区分。事件现在包含`entries`数组用于状态重建。

## [0.22.5] - 2025-12-17

### 修复

- 修复了`--session`标志在打印模式（`-p`）下无法保存会话的问题。会话管理器从未收到事件，因为没有订阅者。

## [0.22.4] - 2025-12-17

### 新增

- 新增`--list-models [search]` CLI标志，可列出可用模型，支持可选模糊搜索。显示提供者、模型ID、上下文窗口、最大输出、思维支持和图像支持。仅列出已配置API密钥的模型。([#203](https://github.com/badlogic/pi-mono/issues/203))
### 修复

- 修复工具执行时显示绿色（成功）背景，但仍在运行。现在工具在运行完成前正确显示灰色（待处理）背景。

## [0.22.3] - 2025-12-16

### 新增

- **实时流式bash输出**：bash工具现在在执行过程中实时输出。TUI界面显示实时进度，最后5行可见（可按ctrl+o展开）。([#44](https://github.com/badlogic/pi-mono/issues/44))

### 修改

- **工具输出显示**：当工具输出被折叠时，现在显示最后N行而不是前N行，使流式输出更实用。

- 更新`@mariozechner/pi-ai`，增加对GitHub Copilot的X-Initiator头部支持，确保代理调用不被扣除配额。([#200](https://github.com/badlogic/pi-mono/pull/200) 由[@kim0](https://github.com/kim0) 提交)

### 修复

- 修复编辑器文本在压缩过程中被清除。现在在压缩运行时输入的文本将被保留。([#179](https://github.com/badlogic/pi-mono/issues/179))

- 改进RGB到256色的映射，终端不支持真彩色时，现在正确使用灰度渐变处理中性色，并保留语义色差（成功为绿色，错误为红色，待处理为蓝色），不再错误映射为立方体颜色。
- `/think off` 现在实际上会禁用所有提供商的思考功能。以前，像 Gemini 这类默认开启“动态思考”的提供商，即使关闭了思考功能，仍然会使用思考功能。([#180](https://github.com/badlogic/pi-mono/pull/180) by [@markusylisiurunen](https://github.com/markusylisiurunen))

## [0.22.2] - 2025-12-15

### 已更改

- 已更新 `@mariozechner/pi-ai`，启用 Anthropic Claude 4 模型的交错思考功能。

## [0.22.1] - 2025-12-15

_谨致 Peter 的肩膀 ([@steipete](https://twitter.com/steipete))_

### 已更改

- 已更新 `@mariozechner/pi-ai`，支持 Anthropic 模型的交错思考功能。

## [0.22.0] - 2025-12-15

### 已添加

- **GitHub Copilot 支持**：通过 OAuth 登录使用 GitHub Copilot 模型（`/login` -> "GitHub Copilot"）。支持 github.com 和 GitHub 企业版。模型来源于 models.dev，包括 Claude、GPT、Gemini、Grok 等多种模型。所有模型在登录后会自动启用。([#191](https://github.com/badlogic/pi-mono/pull/191) by [@cau1k](https://github.com/cau1k))

### 已修复

- 模型选择器的模糊搜索现在会匹配提供商名称（而不仅仅是模型 ID），并支持空格分隔的令牌，所有令牌必须匹配

## [0.21.0] - 2025-12-14

### 已添加
- **内联图像渲染**：支持Kitty图形协议（Kitty、Ghostty、WezTerm）或iTerm2内联图像的终端现在可在工具输出中内联渲染图像。通过查询终端单元格尺寸来保持纵横比。可通过`/show-images`命令或`terminal.showImages`设置进行切换。在不支持的终端或禁用时回退为文本占位符。([#177](https://github.com/badlogic/pi-mono/pull/177) by [@nicobailon](https://github.com/nicobailon))

- **Gemini 3 Pro思维层级**：思维层级选择器现在支持Gemini 3 Pro模型。最低/低级映射为Google的LOW，中级/高级映射为Google的HIGH。([#176](https://github.com/badlogic/pi-mono/pull/176) by [@markusylisiurunen](https://github.com/markusylisiurunen))

### 修复

- 修复了macOS截图文件名因时间戳中的Unicode Narrow No-Break Space（U+202F）导致读取工具失败的问题。添加了回退机制尝试macOS变体路径，并将重复的expandPath函数合并至共享path-utils.ts中。([#181](https://github.com/badlogic/pi-mono/pull/181) by [@nicobailon](https://github.com/nicobailon))

- 修复了markdown代码块后出现双空行的问题([#173](https://github.com/badlogic/pi-mono/pull/173) by [@markusylisiurunen](https://github.com/markusylisiurunen))

## [0.20.1] - 2025-12-13

### 添加

- **导出技能API**：`loadSkillsFromDir`、`formatSkillsForPrompt`及相关类型现在可供其他包使用（例如mom）。

## [0.20.0] - 2025-12-13

### 不兼容变更
- **Pi技能现在采用`SKILL.md`规范**：Pi技能必须以`SKILL.md`的名称存放在目录中，符合Codex CLI格式。以前任何`*.md`文件都被视为技能。迁移方法是将`~/.pi/agent/skills/foo.md`重命名为`~/.pi/agent/skills/foo/SKILL.md`。

### 已添加

- 启动交互模式时显示已加载的技能

## [0.19.1] - 2025-12-12

### 已修复

- 文档：已将技能系统文档添加至README（包含设置、使用方法、CLI标志和配置）

## [0.19.0] - 2025-12-12

### 已添加

- **技能系统**：按需自动发现并加载指令文件。支持Claude Code（`~/.claude/skills/*/SKILL.md`）、Codex CLI（`~/.codex/skills/`）和Pi原生格式（`~/.pi/agent/skills/`、`.pi/skills/`）。技能在系统提示中以列表形式展示并附带描述，代理在需要时通过read工具加载它们。支持`{baseDir}`占位符。可通过`--no-skills`或`skills.enabled: false`在设置中禁用该功能。（[#169](https://github.com/badlogic/pi-mono/issues/169)）

- **版本标志**：已添加`--version`/`-v`标志，用于显示当前版本并退出。（[#170](https://github.com/badlogic/pi-mono/pull/170)）

## [0.18.2] - 2025-12-11

### 已添加
- **自动重试瞬时错误**：当提供程序返回过载、速率限制或服务器错误（429、500、502、503、504）时，自动重试请求。采用指数回退（2秒、4秒、8秒）。在 TUI 中显示重试状态，可通过按 Escape 取消。可在 `settings.json` 中通过 `retry.enabled`、`retry.maxRetries`、`retry.baseDelayMs` 进行配置。RPC 模式会发出 `auto_retry_start` 和 `auto_retry_end` 事件。([#157](https://github.com/badlogic/pi-mono/issues/157))
- **HTML导出行号**：现在读取HTML导出中的工具调用时，当使用偏移/限制参数时，会显示行号范围（例如`file.txt:10-20`），与TUI显示格式保持一致。行号以黄色显示，便于查看。([#166](https://github.com/badlogic/pi-mono/issues/166))

### 修复

- **分支选择器现在支持单条消息**：以前，当只有一个用户消息时，分支选择器不会打开。现在，它能够正确地从任何消息进行分支，包括第一条消息。这对于检查点钩子从第一条消息之前的状态恢复是必需的。([#163](https://github.com/badlogic/pi-mono/issues/163))

- **内存分支支持`--no-session`模式**：分支功能现在在`--no-session`模式下正常工作，不会创建任何会话文件。对话内容在内存中被截断。

- **Git分支指示器现在支持子目录**：页脚的Git分支检测现在会向上遍历目录层级以查找Git根目录，因此在运行pi时位于仓库子目录下也能正常工作。([#156](https://github.com/badlogic/pi-mono/issues/156))

## [0.18.1] - 2025-12-10

### 新增

- **Mistral提供者**：增加了对Mistral AI模型的支持。设置`MISTRAL_API_KEY`环境变量即可使用。

### 修复

- 修复了打印模式（`-p`）在存在自定义主题时输出后不退出的问题（主题监视器现在能正确在打印模式停止）([#161](https://github.com/badlogic/pi-mono/issues/161))

## [0.18.0] - 2025-12-10

### 新增
- **钩子系统**：通过订阅生命周期事件来扩展代理行为的 TypeScript 模块。钩子可以拦截工具调用、提示确认、修改结果，并注入来自外部源的消息。自动从 `~/.pi/agent/hooks/*.ts` 和 `.pi/hooks/*.ts` 中发现。感谢 [@nicobailon](https://github.com/nicobailon) 对设计和实现的合作。([#145](https://github.com/badlogic/pi-mono/issues/145)，取代 [#158](https://github.com/badlogic/pi-mono/pull/158))

- **`pi.send()` API**：钩子可以从外部源（文件监视器、Webhooks、CI 系统）向代理会话注入消息。如果是流式处理，消息将排队；否则会立即启动新的代理循环。

- **`--hook <path>` 命令行标志**：可直接加载钩子文件进行测试，无需修改设置。

- **钩子事件**：`session_start`, `session_switch`, `agent_start`, `agent_end`, `turn_start`, `turn_end`, `tool_call`（可阻塞），`tool_result`（可修改），`branch`。

- **钩子用户界面原语**：`ctx.ui.select()`, `ctx.ui.confirm()`, `ctx.ui.input()`, `ctx.ui.notify()`，用于钩子的交互式提示。

- **钩子文档**：完整 API 参考见 `docs/hooks.md`，随 npm 包一同提供。

## [0.17.0] - 2025-12-09

### 已更改
- **简化压缩流程**：移除了主动压缩（即在接近阈值时中断回合）。压缩现在仅在两种情况下触发：（1）LLM发生溢出错误，触发压缩并自动重试；或（2）在成功完成回合后超过阈值，触发压缩但不重试。

- **压缩重试使用 `Agent.continue()`**：溢出后的自动重试现在使用新的 `continue()` API，而非重新发送用户消息，从而保持上下文状态的精确性。

- **合并回合前缀摘要**：当压缩过程中拆分回合时，回合前缀摘要现在会合并到主历史摘要中，而非单独存储。

### 添加

- **AgentSession 上的 `isCompacting` 属性**：检查当前是否正在运行自动压缩。

- **会话压缩指示器**：恢复压缩后的会话时，会显示“会话已压缩 N 次”的状态信息。

### 修复

- **压缩期间阻塞输入**：在自动压缩运行时，用户输入现在会被阻塞，以防止竞态条件。

- **跳过使用计算中的错误消息**：上下文大小估算现在会跳过已中止和错误消息，因为它们均无有效的使用数据。

## [0.16.0] - 2025-12-09

### 重大变更
- **新的RPC协议**：RPC模式（`--mode rpc`）已完全重设计，采用新的JSON协议。旧协议不再支持。有关新协议文档，请参见[`docs/rpc.md`](docs/rpc.md)，工作示例请参见[`test/rpc-example.ts`](test/rpc-example.ts)。包含`RpcClient` TypeScript类，便于快速集成。（[#91](https://github.com/badlogic/pi-mono/issues/91)）

### 已更改

- **README重构**：将文档从30多个平铺章节重构为10个逻辑组。将冗长的子章节转换为可扫描的表格。合并了哲学部分。文件大小缩减约60%，同时保留所有信息。

## [0.15.0] - 2025-12-09

### 已更改

- **重大代码重构**：重构代码库以提高可维护性和关注点分离。将文件移动到组织目录（`core/`，`modes/`，`utils/`，`cli/`）。将`AgentSession`类提取为中央会话管理抽象。将`main.ts`和`tui-renderer.ts`拆分为专注模块。有关新代码结构图，请参见`DEVELOPMENT.md`。（[#153](https://github.com/badlogic/pi-mono/issues/153)）

## [0.14.2] - 2025-12-08

### 已添加

- `/debug`命令现在在输出中以JSONL格式包含代理消息

### 已修复

- 修复当bash命令输出二进制数据（例如，`curl`下载视频文件）时崩溃的问题

## [0.14.1] - 2025-12-08

### 已修复

- 修复与tsgo 7.0.0-dev.20251208.1构建错误，通过正确导入`ReasoningEffort`类型解决
## [0.14.0] - 2025-12-08

### 不兼容变更

- **自定义主题需要新的颜色令牌**：主题现在必须包含 `thinkingXhigh` 和 `bashMode` 颜色令牌。主题加载器会提供有用的错误信息，列出缺少的令牌。可参考内置主题（dark.json，light.json）中的参考值。

### 新增

- **OpenAI 兼容性覆盖项在 models.json 中**：使用 `openai-completions` API 的自定义模型现在可以指定 `compat` 对象，以覆盖提供方的特殊行为（`supportsStore`，`supportsDeveloperRole`，`supportsReasoningEffort`，`maxTokensField`）。适用于 LiteLLM、自定义代理和其他非标准端点。([#133](https://github.com/badlogic/pi-mono/issues/133)，感谢 @fink-andreas 提出初始想法并提交 PR)

- **xhigh thinking level**：为 OpenAI codex-max 模型添加 `xhigh` 思考等级。按 Shift+Tab 循环切换思考等级；`xhigh` 仅在使用 codex-max 模型时出现。([#143](https://github.com/badlogic/pi-mono/issues/143))

- **折叠更新日志设置**：在 `~/.pi/agent/settings.json` 中添加 `"collapseChangelog": true`，更新后显示简化的“已更新至 vX.Y.Z”消息，而非完整更新日志。使用 `/changelog` 可查看完整更新日志。([#148](https://github.com/badlogic/pi-mono/issues/148))
- **Bash模式**：可在编辑器中直接通过`!`前缀执行shell命令（例如`!ls -la`）。输出流实时显示，会添加到LLM上下文中，并持久保存在会话历史中。支持多行命令、取消（按Escape键）、对大输出内容进行截断，并支持预览/展开切换（Ctrl+O）。也可通过`{"type":"bash","command":"..."}`进入RPC模式。([#112](https://github.com/badlogic/pi-mono/pull/112)，原实现来自[@markusylisiurunen](https://github.com/markusylisiurunen))

## [0.13.2] - 2025-12-07

### 已更改

- **工具输出截断**：所有工具现在强制执行一致的截断限制，并对LLM提供可操作的通知。([#134](https://github.com/badlogic/pi-mono/issues/134))
  - **限制**：2000行或50KB（先达到者为准），绝不截断部分行
  - **read**：显示`[Showing lines X-Y of Z. Use offset=N to continue]`。如果首行超过50KB，建议使用bash命令
  - **bash**：使用临时文件进行尾部截断。显示`[Showing lines X-Y of Z. Full output: /tmp/...]`
  - **grep**：预先截断匹配行至500字符。显示匹配限制和行截断通知
  - **find/ls**：显示结果/条目限制通知
  - TUI在工具输出底部以黄色显示截断警告（即使折叠也能看到）

## [0.13.1] - 2025-12-06

### 已添加
- **灵活的 Windows shell 配置**：bash 工具现在支持除 Git Bash 之外的多个 shell 源。解析顺序为：（1）settings.json 中的自定义 `shellPath`，（2）标准位置的 Git Bash，（3）PATH 中的任何 bash.exe。这使得 Cygwin、MSYS2 等其他 bash 环境得以启用。通过 `~/.pi/agent/settings.json` 配置 `{"shellPath": "C:\\cygwin64\\bin\\bash.exe"}`。
### 修复

- **Windows二进制检测**：通过检查URL编码的`%7EBUN`，同时检查`$bunfs`和`~BUN`在`import.meta.url`中的存在，修复了Windows上对Bun编译二进制文件的检测。这确保了二进制文件能够正确定位执行文件旁边的辅助文件（如package.json、主题等）。
## [0.12.15] - 2025-12-06
### 修复

- **编辑器崩溃与表情符号/中文字符**：修复了粘贴或输入包含宽字符（如表情符号✅、中文字符）导致行宽超过终端宽度时的崩溃问题。编辑器现在使用基于图形的文本换行，并正确计算可见宽度。

## [0.12.14] - 2025-12-06

### 添加
- **双Esc快捷分支**：在空编辑器中连续按两次Esc，可快速打开`/branch`对话分支选择器。

## [0.12.13] - 2025-12-05

### 已更改

- **更快启动**：版本检查现在与TUI初始化并行执行，不再阻塞启动长达1秒。检查完成后，更新通知将出现在聊天中。
## [0.12.12] - 2025-12-05

### 已更改
- **页脚显示**：代币计数现在使用M后缀表示百万（例如，`10.2M` 而不是`10184k`). 上下文显示已缩短自`61.3% of 200k` to `61.3%/200k`.
### 已固定
- **输入中的多键序列**：现在模型搜索等输入处理多键序列的方式与主提示编辑器相同。([#122](https://github.com/badlogic/pi-mono/pull/122) by [@markusylisiurunen](https://github.com/markusylisiurunen))
- **行内换行转义码**：修复了长URL换行时下划线样式溢出填充的问题。ANSI码现在会正确附加到对应内容，且行尾重置仅关闭下划线（保留背景色）。([#109](https://github.com/badlogic/pi-mono/issues/109))

### 添加

- **模糊搜索模型和会话**：实现了对模型和会话的简单模糊搜索（例如，`codexmax`现在可以找到`gpt-5.1-codex-max`）。([#122](https://github.com/badlogic/pi-mono/pull/122) by [@markusylisiurunen](https://github.com/markusylisiurunen))
- **提示历史导航**：当编辑器为空时，使用上下箭头键浏览之前提交的提示。按上箭头循环查看更早的提示，按下箭头返回较新的提示或清空编辑器。类似于shell历史和Claude Code的提示历史功能。历史记录按会话范围存储，最多保存100条记录。([#121](https://github.com/badlogic/pi-mono/pull/121) by [@nicobailon](https://github.com/nicobailon))
- **`/resume`命令**：可在对话中切换到不同会话。会打开一个交互式选择器，显示所有可用会话。等同于`--resume` CLI标志，但无需重启代理即可使用。([#117](https://github.com/badlogic/pi-mono/pull/117) by [@hewliyang](https://github.com/hewliyang))

## [0.12.11] - 2025-12-05

### 更改
- **压缩UI**：简化折叠的压缩指示器，显示带代币计数的警告色文本，而非带样式的横幅。删除了压缩后冗余的成功消息。([#108](https://github.com/badlogic/pi-mono/issues/108))

### 修复

- **打印模式错误处理**：`-p`标志现在在请求失败时输出错误消息并以代码1退出，而非静默无输出。
- **分支选择器崩溃**：修复了用户消息中包含Unicode字符（如`✔`或`›`）导致行宽超过终端宽度时TUI崩溃的问题。现在使用正确的`truncateToWidth`，而非`substring`。
- **Bash输出转义序列**：修复了bash工具输出中终端转义序列剥离不完整的问题。`stripAnsi`遗漏了一些序列，如独立的字符串终止符（`ESC \`），可能导致在显示捕获的TUI输出时出现渲染问题。
- **页脚溢出崩溃**：修复了终端宽度不足以容纳页脚统计行时TUI崩溃的问题。页脚现在会优雅地截断，而非溢出。

### 新增

- **`authHeader`选项在models.json中**：自定义提供者可以设置`"authHeader": true`，以自动添加`Authorization: Bearer <apiKey>`头部。对于需要显式授权头的提供者非常有用。([#81](https://github.com/badlogic/pi-mono/issues/81))
- **`--append-system-prompt` 标记**: 将额外的文本或文件内容追加到系统提示中。支持内联文本和文件路径。与 `--system-prompt` 配合使用，可在不替换基础系统提示的情况下叠加自定义指令。([#114](https://github.com/badlogic/pi-mono/pull/114) by [@markusylisiurunen](https://github.com/markusylisiurunen))
- **思维块切换**：新增 `Ctrl+T` 快捷方式，用于切换 LLM 思维块的可见性。关闭后显示静态 "Thinking..." 标签，而非完整内容。有助于在长对话中减少视觉杂乱。([#113](https://github.com/badlogic/pi-mono/pull/113) by [@markusylisiurunen](https://github.com/markusylisiurunen))

## [0.12.10] - 2025-12-04

### 已添加

- 已添加 `gpt-5.1-codex-max` 模型支持

## [0.12.9] - 2025-12-04

### 已添加

- **`/copy` 命令**：复制最后一个代理消息到剪贴板。跨平台支持（macOS、Windows、Linux）。可用于提取渲染后的 Markdown 输出中的文本。([#105](https://github.com/badlogic/pi-mono/pull/105) by [@markusylisiurunen](https://github.com/markusylisiurunen))

## [0.12.8] - 2025-12-04

- 修复：在压缩展开快捷键中始终使用 CTRL+O（非 Mac 上的 CMD+O）

## [0.12.7] - 2025-12-04

### 已添加

- **上下文压缩**：长会话现在可以压缩以减少上下文使用量，同时保留最近的对话历史。([#92](https://github.com/badlogic/pi-mono/issues/92)，[文档](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md#context-compaction))
  - `/compact [instructions]`：手动压缩上下文，支持可选的自定义摘要指令
  - `/autocompact`：切换自动压缩，当上下文超过阈值时生效
  - 压缩旧消息，同时保留最近消息（默认20k token）原文不变  
  - 自动压缩在上下文达到`contextWindow - reserveTokens`（默认16k保留）时触发  
  - 压缩后的会话在TUI显示可折叠摘要（可通过`o`键切换）  
  - HTML导出包含可折叠的压缩摘要部分  
  - RPC模式支持`{"type":"compact"}`命令和自动压缩（会发出压缩事件）  
- **分支源追踪**：分支会话现在将`branchedFrom`存储在会话头部，包含原始会话文件的路径。可用于追踪会话血统。  

## [0.12.5] - 2025-12-03  

### 新增  

- **分叉/重品牌支持**：所有品牌（应用名称、配置目录、环境变量名称）现在可通过`piConfig`在`package.json`中进行配置。分叉可以更改`piConfig.name`和`piConfig.configDir`以重品牌CLI，无需代码更改。影响CLI横幅、帮助文本、配置路径和错误消息。([#95](https://github.com/badlogic/pi-mono/pull/95))  

### 修复  

- **Bun二进制检测**：修复了Bun编译的二进制文件在Bun更新其虚拟文件系统路径格式从`%7EBUN`到`$bunfs`后无法启动的问题。([#95](https://github.com/badlogic/pi-mono/pull/95))  

## [0.12.4] - 2025-12-02  

### 新增
- **RPC 终止保护**：当作为 RPC 工作者运行（检测到标准输入管道）时，如果父进程意外终止，CLI 将立即退出。防止 RPC 工作者无限期残留并消耗系统资源。

## [0.12.3] - 2025-12-02

### 已修复

- **速率限制处理**：Anthropic 速率限制错误现在会触发自动重试，采用指数回退（基础 10 秒，最多 5 次重试）。之前这些错误会立即中止请求。

- **重试期间的使用情况跟踪**：重试的请求现在会正确累加所有尝试的令牌使用量，而不仅仅是最终成功的那次。修复了请求被重试时令牌计数过低的问题。

## [0.12.2] - 2025-12-02

### 已更改

- 已移除对 gpt-4.5-preview 和 o3 模型的支持（这些模型尚未可用）

## [0.12.1] - 2025-12-02

### 已添加

- **模型**：已添加对 OpenAI 新模型的支持：
  -  `gpt-4.1`（128K 上下文）
  -  `gpt-4.1-mini`（128K 上下文）
  -  `gpt-4.1-nano`（128K 上下文）
  -  `o3`（200K 上下文，推理模型）
  -  `o4-mini`（200K 上下文，推理模型）

## [0.12.0] - 2025-12-02

### 已添加
- **`-p, --print` 标志**: 以非交互式批处理模式运行。处理输入消息或管道标准输入，不使用 TUI，直接将代理响应打印到标准输出。适用于脚本、管道和 CI/CD 集成。响应后退出。
- **`-P, --print-streaming` 标志**: 与 `-p` 类似，但响应令牌随到随出。使用 `--print-streaming --no-markdown` 获取原始未格式化输出。
- **`--print-turn` 标志**: 继续处理工具调用和代理回合，直到代理自然结束或需要用户输入。与 `-p` 结合使用，可完成完整的多轮对话。
- **`--no-markdown` 标志**: 输出原始文本，不带 Markdown 格式化。适用于将输出传递给期望纯文本的工具。
- **流式打印模式**: 增加了内部 `printStreaming` 选项，用于非 TUI 模式的流式输出。
- **RPC 模式 `print` 命令**: 发送 `{"type":"print","content":"text"}` 可通过 `print_output` 事件获取格式化打印输出。
- **打印模式自动保存**: 打印模式的对话会自动保存到会话目录，允许后续通过 `--continue` 恢复。
- **思考等级选项**: 增加了 `--thinking-off`、`--thinking-minimal`、`--thinking-low`、`--thinking-medium`、`--thinking-high` 标志，可直接指定思考等级，无需选择器 UI。

### 已更改
- **简化RPC协议**：用直接的消息对象替换了`prompt`包装命令。发送`{"role":"user","content":"text"}`而不是`{"type":"prompt","message":"text"}`。更好地与代码库中的消息格式对齐。

- **RPC消息处理**：代理现在直接处理原始消息对象，如果缺失则自动填充`timestamp`。

## [0.11.9] - 2025-12-02

### 已更改

- 将Ctrl+I更改为Ctrl+P，以避免与某些终端的Tab键冲突，实现模型循环快捷键

## [0.11.8] - 2025-12-01

### 已修复

- 绝对全局模式（例如`/Users/foo/**/*.ts`）现已正确处理。之前会剥离前缀`/`，导致模式相对于当前目录进行解释。

## [0.11.7] - 2025-12-01

### 已修复

- 修复读取路径遍历漏洞。路径现在经过验证，防止读取超出工作目录或其父目录。`read`工具可以读取`cwd`及其祖先（用于配置文件）和所有子目录。符号链接在验证前已解析。

## [0.11.6] - 2025-12-01

### 已修复

- 修复`--system-prompt <path>`，防止路径参数被捕获到消息集合中，导致“文件未找到”错误。

## [0.11.5] - 2025-11-30

### 已修复

- 修复在`edit`工具中编辑空文件时出现的致命错误“Cannot set properties of undefined (setting '0')”。
- 简化 `edit`工具输出：仅显示“已编辑文件.txt”，而非详细的搜索/替换信息。
- 修复了当标记计数包含NaN值（由于缺少使用数据）时，页脚渲染出现致命错误的问题。

## [0.11.4] - 2025-11-30

### 修复

- 修复了当消息中包含预格式化/样式文本（例如带灰色斜体样式的思考轨迹）时，聊天渲染崩溃的问题。Markdown渲染器现在在内联元素之前保留现有的ANSI转义码。

## [0.11.3] - 2025-11-29

### 修复

- 修复了绝对路径文件拖放功能

## [0.11.2] - 2025-11-29

### 修复

- 修复了粘贴内容包含制表符时TUI崩溃的问题。制表符现在在插入前会转换为4个空格。

- 修复了当shell集成序列（OSC 133）出现在bash输出中时，退出后终端损坏的问题。这些序列现在会连同其他ANSI码一起被移除。

## [0.11.1] - 2025-11-29

### 添加

- 添加了`fd`的集成，用于文件路径自动补全。现在使用`fd`进行更快的模糊文件搜索

### 修复

- 修复了在VS Code集成终端和其他某些终端仿真器中，Ctrl+A、Ctrl+E、Ctrl+K、Ctrl+U、Ctrl+W和单词导航（Option+箭头）快捷键无法正常工作的问题

## [0.11.0] - 2025-11-29

### 添加
- **基于文件的斜杠命令**：创建可复用的自定义提示作为 `.txt` 文件存储在 `~/.pi/slash-commands/` 中。文件会作为 `/filename` 命令出现，第一行作为描述。支持 `{{selection}}` 占位符，用于引用选中的/附加的内容。
- **`/branch` 命令**：可以从任何之前的用户消息创建对话分支。打开一个选择器挑选消息，然后创建一个新的会话文件，从该点开始。原始消息文本会被放入编辑器中供修改。
- **统一内容引用**：现在消息中的 `@path` 和 CLI 参数中的 `--file path` 都使用相同的附件系统，并且 MIME 类型检测保持一致。
- **拖拽文件**：将文件拖拽到终端，即可将其附加到你的消息中。支持多个文件，以及文本和图片内容。

### 已更改

- **模型选择器带搜索**：`/model` 命令现在会打开一个可搜索的列表。输入文字可按名称过滤模型，使用箭头键导航，按回车键选择。
- **改进的文件自动补全**：`@` 后的文件路径补全现在支持模糊匹配，并会显示文件/目录指示符。
- **带搜索的会话选择器**：`--resume` 和 `--session` 标志现在会打开一个带模糊过滤的可搜索会话列表。
- **附件显示**：通过 `@path` 添加的文件现在会在用户消息中显示为“附加：文件名”，独立于提示文本。
- **Tab Completion**: Tab键现在可在编辑器任意位置触发文件路径自动补全，而不仅限于`@`符号后。

### 修复

- 修复自动补全z轴顺序问题，防止下拉框遮挡聊天消息
- 修复在编辑器中导航换行文本时的光标位置问题
- 修复会话续接时的附件处理，以保持文件引用

## [0.10.6] - 2025-11-28

### 更改

- 在工具输出中显示大图片的base64截断指示符

### 修复

- 修复从PNG/JPEG/GIF文件中正确读取图片尺寸的问题
- 修复PDF图片在显示时被错误截断为base64
- 允许从祖先目录读取文件（单体仓库配置所需）

## [0.10.5] - 2025-11-28

### 添加

- 完整的多模态支持：可使用`@path`语法或`--file`标志将图片（PNG、JPEG、GIF、WebP）和PDF文件附加到提示中

### 修复

- 修复`@`引用对文件名中特殊字符（空格、引号、Unicode）的处理
- 修复编辑器中多字节Unicode字符的光标定位问题

## [0.10.4] - 2025-11-28

### 修复

- 移除TUI中第一条用户消息的内边距，以提升视觉一致性。

## [0.10.3] - 2025-11-28

### 添加
- 增加了RPC模式（`--rpc`），用于程序集成。接受stdin中的JSON命令，通过stdout发出JSON事件。有关协议详情，请参见[RPC模式文档](https://github.com/nicobailon/pi-mono/blob/main/packages/coding-agent/README.md#rpc-mode)。

### 更改了

- 重构了内部架构，以支持多个前端（TUI、RPC），并共享代理逻辑。

## [0.10.2] - 2025-11-26

### 增加了

- 增加了思考层级持久化。默认层级存储在`~/.pi/settings.json`中，并在启动时恢复。会话级别的覆盖项保存在会话文件中。

- 增加了模型循环快捷键：`Ctrl+I`循环切换可用模型（或使用`-m`标志限定范围的模型）。

- 增加了对瞬态API错误（网络问题、500错误、过载）的自动重试，采用指数回退策略。

- 累计的token使用量现在显示在页脚（会话中所有消息使用的总token数）。

- 增加了`--system-prompt`标志，用于覆盖默认系统提示，支持自定义文本或文件内容。

- 页脚现在显示基于模型定价的预计总成本（美元）。

### 更改了

- 用支持多个值的`-m/--model`替换了`--models`标志。指定模型时使用`provider/model@thinking`（例如`anthropic/claude-sonnet-4-20250514@high`）。多个`-m`标志用于限定会话中可用的模型范围。

- 思考层级边框在选择器关闭后会视觉上持久保留。
- 改进工具结果展示，支持可折叠输出（默认折叠，展开请使用`Ctrl+O`）。

## [0.10.1] - 2025-11-25

### 增加

- 可通过`~/.pi/models.json`添加自定义模型配置

## [0.10.0] - 2025-11-25

首次公开发布。

### 增加

- 支持交互式TUI，支持流式响应

- 支持会话管理，使用`--continue`、`--resume`和`--session`标识

- 支持多行输入（按Shift+Enter或Option+Enter换行）

- 工具执行：`read`、`write`、`edit`、`bash`、`glob`、`grep`、`think`

- 支持Claude的Thinking模式，带视觉指示器和`/thinking`选择器

- 文件路径自动补全，使用`@`前缀

- 斜杠命令自动补全

- 支持`/export`命令，用于导出HTML会话

- 支持`/model`命令，用于运行时模型切换

- 支持`/session`命令，用于会话统计

- 模型提供商支持：Anthropic（Claude）、OpenAI、Google（Gemini）

- 在底部显示Git分支

- 流式响应时支持消息排队

- 集成OAuth，支持访问Gmail和Google Calendar

- 支持带语法高亮和可折叠区域的HTML导出

