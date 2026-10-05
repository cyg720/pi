# 设置参考

本参考列出了用户可配置的设置、类型、默认值和用途。项目设置会覆盖代理目录设置。资源列表会合并。有关文件位置和信任行为，请参见[配置](configuration.md)。

## 模型与思考

<a id="model-cycling"></a>

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `defaultProvider` | string | Automatic | 启动AI提供商。 |
| `defaultModel` | string | Automatic | 启动模型ID。 |
| `defaultThinkingLevel` | `"off" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "max"` | `"medium"` | 启动思考级别。 |
| `modelThinkingLevels` | object | None | 按精确`provider/modelId`键存储的每种模型启动思考级别。 |
| `thinkingBudgets` | object | Built-in budgets | `minimal`、`low`、`medium`和`high`思考级别的令牌预算。 |
| `enabledModels` | `string[]` | All available models | 用于启动选择和模型循环的模型模式。格式与`--models`相同。 |
| `hideThinkingBlock` | boolean | `false` | 在转录中隐藏思考块。 |
| `showCacheMissNotices` | boolean | `false` | 显示重要缓存缺失通知、成功缓存预热、压缩使用和提供商恢复通知。 |
| `cacheWarming` | `"off" \| "streaming" \| "idle"` | `"streaming"` | 在活动运行期间或与`"idle"`一起，在运行之间保持符合条件的提供商提示缓存预热。仅全局设置。 |

缓存预热仅在模型声明缓存生命周期且Pi估算至少避免$0.05缓存缺失成本时才进行。刷新使用计入会话总计，但不会进入模型上下文。`/session`显示下一个决策；扩展可覆盖它，使用`cache_warming_decision`。有关提示缓存生命周期，请参见[提示缓存生命周期](models.md#prompt-cache-lifetimes)。

有关模型选择和思考控制，请参见[选择模型](models.md)。

## 交互

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `steeringMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 队列中的转向消息如何交付。 |
| `followUpMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 队列中的后续消息如何交付。 |
| `externalEditor` | string | `$VISUAL`, `$EDITOR`, then platform default | 由外部编辑器快捷键打开的命令。 |
| `doubleEscapeAction` | `"tree" \| "fork" \| "none"` | `"tree"` | 双击 Escape 且编辑器为空时的操作。 |
| `treeFilterMode` | `"default" \| "no-tools" \| "user-only" \| "labeled-only" \| "all"` | `"default"` | `/tree` 使用的初始过滤器。 |
| `defaultProjectTrust` | `"ask" \| "always" \| "never"` | `"ask"` | 备用项目信任行为。**仅能在代理目录设置中设置。** |

## 工具

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `defaultTools` | `string[]` | `read`, `bash`, `edit`, `write` | 启动时启用的工具。普通名称可替换默认值；`+name` 可添加工具，`-name` 可移除工具。空数组禁用所有内置工具，但不禁止扩展或 SDK 工具。 |
| `codemode.mode` | `"on"` \| `"only"` | `"on"` | `codemode` 工具处于活动状态时，工具的呈现方式。`on`：已声明的工具会在调用脚本时在其描述中添加备注；`codemode`：仅列出未声明的工具。`only`：`codemode` 列出所有脚本可调用的工具，且活动的内置和扩展工具被隐藏，需通过 `codemode` 访问。 |
| `codemode.inlineBudget` | number | `3000` | `codemode` 工具描述中对工具声明可能使用的预估令牌数（字符 / 4）。不匹配的工具会被忽略，可通过 `searchTools()` 查找。`0` 仅列出命名空间。 |

内置可用工具包括 `read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find` 和 `ls`。`defaultTools` 还可以命名 `codemode` 和 `tool_search`，这些是内置扩展注册的非活动工具，以及其他扩展工具注册的非活动工具。

仅包含 `+name` 和 `-name` 的列表会改变继承的选择，而不是替换它。例如，这可以在默认工具旁边启用 `codemode`：

```json
{
  "defaultTools": ["+codemode"]
}
```

这将 `bash` 替换为 `powershell`，并启用 `grep`：`["-bash", "+powershell", "+grep"]`。项目设置优先于用户设置：仅包含 `+name` 和 `-name` 项目的列表会改变用户的选择，包含普通名称的项目列表则会覆盖它。在一个列表中，普通名称形成选择，然后按顺序应用 `+name` 和 `-name`。

`/reload` 使 `defaultTools` 中新增的工具可用。它不会禁用从中移除的工具，也不会重新启用你关闭后未更改的工具。`--tools`、`--no-tools` 和 `--no-builtin-tools` 会覆盖 `defaultTools`，包括在重新加载时。

CLI 工具选项会覆盖此设置，仅对一次调用有效；`--tools` 不接受 `+name` 或 `-name`。详情请参见 [Command Line](cli.md#tools)。

##  会话和上下文

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `sessionDir` | string | Agent 会话目录 | 会话存储目录。相对路径从工作目录解析。`PI_CODING_AGENT_SESSION_DIR` 和 `--session-dir` 会覆盖此设置。 |

###  压缩

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `compaction.enabled` | boolean | `true` | 启用自动压缩。 |
| `compaction.reserveTokens` | number | `16384` | 为模型响应保留的标记数。 |
| `compaction.keepRecentTokens` | number | `20000` | 不进行摘要保留的最近标记数。 |
| `compaction.modelOverrides` | object | 无 | 按确切 `provider/modelId` 命名的每种模型标记设置。 |

<a id="per-model-compaction-overrides"></a>

压缩标记值必须为非负安全整数。每个值独立于匹配模型覆盖，然后是普通压缩设置，最后是内置默认值。项目和用户对象合并后再查找模型。

有关触发、摘要和验证行为的详细信息，请参见 [Compaction Reference](compaction.md)。

###  分支摘要

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `branchSummary.reserveTokens` | number | `16384` | 摘要分支历史时保留的标记数。 |
| `branchSummary.skipPrompt` | boolean | `false` | 跳过分支摘要提示，默认不摘要。 |
## 终端和显示

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `theme` | 字符串 | `"system"` | 内置或自定义主题名称。`system`从终端主题中提取颜色。 |
| `quietStartup` | 布尔值 \| `"header"` | `false` | `true`隐藏启动头和加载资源列表。`"header"`保留头（版本和快捷键提示）但隐藏模型范围行和加载资源列表。 |
| `tuiMode` | `"regular" \| "fullscreen"` | `"fullscreen"` | 交互式终端UI模式。 |
| `fullscreenExitOutput` | `"transcript" \| "resume-hint"` | `"transcript"` | 退出全屏模式时打印的输出。 |
| `fullscreenScrollbar` | `"auto" \| "always" \| "hidden"` | `"auto"` | 全屏转录滚动条行为。 |
| `fullscreenCopyOnSelect` | 布尔值 | `true` | 在全屏模式下自动复制选中的文本。 |
| `fullscreenWheelScrollLines` | `"auto"` \| 数值 | `"auto"` | 全屏模式下鼠标滚轮事件的行数，从1到100。`"auto"`在本地macOS终端中每次事件移动一行，macOS终端已加速滚轮和触控板输入；在其他系统或通过SSH时，快速滚轮最多可每次移动6行。按住Alt键滚动可移动五倍距离。 |
| `editorPaddingX` | 数值 | `0` | 水平编辑器填充，从0到3个单元格。 |
| `outputPad` | `0 \| 1` | `1` | 水平转录填充。 |
| `autocompleteMaxVisible` | 数值 | `5` | 可见的自动补全条目数，从3到20。 |
| `showHardwareCursor` | 布尔值 | `false` | 当Pi定位光标用于输入法时显示终端光标。 |
| `terminal.showImages` | 布尔值 | `true` | 支持时显示内联图片。 |
| `terminal.imageWidthCells` | 数值 | `60` | 首选内联图片宽度（以终端单元格计）。 |
| `terminal.clearOnShrink` | 布尔值 | `false` | 渲染内容缩小时清除空行。 |
| `terminal.showTerminalProgress` | 布尔值 | `false` | 在终端标签页中显示OSC 9;4进度。 |
| `terminal.hyperlinks` | `boolean \| "auto"` | `"auto"` | 覆盖OSC 8超链接检测。 |
| `terminal.images` | `"kitty" \| "iterm2" \| "auto" \| false` | `"auto"` | 重写内联图像协议检测。 |
| `terminal.trueColor` | `boolean \| "auto"` | `"auto"` | 重写真彩色检测。 |
| `images.autoResize` | boolean | `true` | 在将图像发送到模型之前，将其调整为最多2000x2000像素。 |
| `images.blockImages` | boolean | `false` | 阻止将图像发送到模型。 |
| `markdown.codeBlockIndent` | string | `"  "` | 用于缩进渲染代码块的前缀。 |
| `markdown.mermaid` | `"off" \| "final" \| "streaming"` | `"streaming"` | Mermaid渲染模式。 |

有关格式和平台详情，请参见[主题](themes.md)和[终端设置](terminal-setup.md)。

## 网络和重试

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `transport` | `"auto" \| "sse" \| "websocket" \| "websocket-cached"` | `"auto"` | 支持多种传输方式的AI提供商的首选传输方式。 |
| `httpProxy` | string | None | 作为`HTTP_PROXY`和`HTTPS_PROXY`应用于由Pi管理的HTTP客户端的代理URL。**只能在代理目录设置中设置。** |
| `httpIdleTimeoutMs` | number | `300000` | HTTP头部和主体空闲超时（毫秒）。设置为`0`以禁用。 |
| `websocketConnectTimeoutMs` | number | `15000` | WebSocket连接超时（毫秒）。设置为`0`以禁用。 |
| `retry.enabled` | boolean | `true` | 启用自动代理级重试以应对瞬时失败。 |
| `retry.maxRetries` | number | `3` | 最大代理级重试次数。 |
| `retry.baseDelayMs` | number | `2000` | 初始指数回退延迟（毫秒）。 |
| `retry.maxAgentDelayMs` | number | `60000` | 最大代理级重试延迟（毫秒）。 |
| `retry.provider.timeoutMs` | number | `httpIdleTimeoutMs` | 提供商请求超时（毫秒）。 |
| `retry.provider.maxRetries` | number | `0` | 提供商级重试次数。 |
| `retry.provider.maxRetryDelayMs` | number | `60000` | 最大服务器请求延迟（毫秒）。设置为`0`以禁用该限制。 |

除非需要提供程序级重试，否则请将`retry.provider.maxRetries`保持为`0`。提供程序级重试可能会延迟Pi处理配额和使用限制错误。

## Shell 配置

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `shellPath` | string | 平台默认值 | 自定义Shell可执行路径。支持以`~`开头。 |
| `shellCommandPrefix` | string | None | 每条Shell命令前缀。 |
| `npmCommand` | `string[]` | `npm` | 用于npm包查找和安装的命令及参数。 |

有关Shell设置，请参见[Shell别名](shell-aliases.md)，有关包管理器行为，请参见[Pi Packages](packages.md)。

## 资源

用户设置中的资源路径从代理目录解析。项目设置中的路径从项目`.pi`目录解析。支持绝对路径和`~`。

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `packages` | array | `[]` | npm、git或本地Pi包源。详见[Pi Packages](packages.md)。 |
| `extensions` | `string[]` | `[]` | 扩展文件或目录。 |
| `skills` | `string[]` | `[]` | 技能文件或目录。 |
| `prompts` | `string[]` | `[]` | 提示模板文件或目录。 |
| `themes` | `string[]` | `[]` | 主题文件或目录。 |
| `enableSkillCommands` | boolean | `true` | 将技能注册为`/skill:name`命令。 |

资源数组支持使用`!pattern`进行全局排除、使用`+path`进行精确包含和使用`-path`进行精确排除。Pi加载用户级和项目级设置中列出的所有资源。

内置扩展名为`builtin:mcp`、`builtin:llama.cpp`、`builtin:codemode`和`builtin:tool-search`的`extensions`。它们默认加载；`-builtin:mcp`禁用其中一个。项目设置中的`+builtin:<name>`或`-builtin:<name>`条目可覆盖用户设置。`pi config`在“内置”下列出它们。`--no-extensions`也禁用它们，`-e builtin:<name>`则显式加载其中一个。

## 更新、遥测和警告

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `collapseChangelog` | boolean | `false` | 更新后显示简要变更日志。 |
| `enableInstallTelemetry` | 布尔值 | `true` | 启用匿名安装/更新报告和选定的提供商属性标头。不控制更新检查。 |
| `enableAnalytics` | 布尔值 | `false` | 同意分析数据共享。目前仅用于实验性的首次运行设置。 |
| `warnings.anthropicExtraUsage` | 布尔值 | `true` | 提示Anthropic订阅身份验证可能使用付费额外用量。 |

