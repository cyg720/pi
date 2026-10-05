# 自定义Pi的主题

主题控制Pi在交互模式和HTML导出中使用的颜色。Pi内置了`system`、`dark`和`light`主题。你可以选择一个主题，跟随终端的亮色或暗色外观，或者创建你自己的调色板。

## 使用终端的颜色

`system`主题是默认主题。它从你的终端主题构建Pi的颜色，所以Pi匹配终端而不是自带调色板：

- Pi查询终端的默认前景色和背景色及其16种ANSI颜色。
- 每个Pi颜色从一个ANSI颜色取其色调，例如错误用红色，链接用蓝色。
- Pi设置每个颜色的明度，使其与背景至少有最小对比度。正文文本保持至少4.5:1的WCAG对比度。
- 当终端在亮色和暗色之间切换时，Pi再次查询颜色并重建主题。

主题会根据终端报告的内容进行适应：

| 终端报告 | 结果 |
|---|---|
| 背景和ANSI颜色 | 从终端调色板取颜色，放置在实际背景上。 |
| 仅背景 | Pi自定义色调，放置在实际背景上。 |
| 无 | 使用终端默认颜色和ANSI颜色索引，终端自行渲染。辅助文本变淡，面板无背景色。 |

Pi启动时会询问终端获取其颜色。终端通常在几毫秒内响应，Pi最多等待100毫秒才显示启动页头。如果终端未能及时响应，Pi会使用ANSI颜色降级，即使稍后收到颜色（例如通过慢速SSH连接）也会应用。`system`是保留名称：带有该名称的自定义主题会被忽略。

<a id="selecting-a-theme"></a>

## 选择主题

打开`/settings`并选择**主题**。你可以为每个终端外观使用一个主题，也可以为亮色和暗色终端选择不同的主题。

选择会被保存为`theme` [设置](settings.md#terminal-and-display)：

```json
{
  "theme": "dark"
}
```

如果没有`theme`设置，Pi使用`system`。

自动模式会先存储亮色主题，再存储暗色主题：

```json
{
  "theme": "light/dark"
}
```

Pi根据终端报告的背景和前景色判断终端是亮色还是暗色。如果终端未报告背景，Pi会依次使用终端的亮/暗通知、`COLORFGBG`环境变量，最后是暗色。相同的判断也决定了亮/暗主题对和`system`的外观。自动模式下，Pi会在终端报告外观变化时切换主题。主题名不能包含`/`，因为Pi保留该名称用于此设置格式。

使用`--use-theme`为单次调用选择初始主题而不更改保存的设置：

```bash
pi --use-theme light
pi --use-theme light/dark
```

可在[CLI资源](cli.md#resources)中查看命令行选项。

## 创建自定义主题

复制一个[内置主题](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/modes/interactive/theme)或创建一个符合[schema](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json)的新JSON文件。内置主题使用OKHSL颜色，带有共享颜色的变量，所以你可以直接调整色调、饱和度或明度。

1. 将文件保存为`<agent-dir>/themes/my-theme.json`。默认代理目录为`~/.pi/agent`。
2. 将其`name`设置为`my-theme`。
3. 修改`vars`和`colors`中的值。
4. 通过`my-theme`到`/settings`进行选择。

使用主题名作为文件名。Pi仅从`<agent-dir>/themes/<name>.json`热加载活动用户主题。在任何其他来源添加或更改主题后，运行`/reload`。

## 理解主题文件

| 属性 | 必填 | 责任 |
|---|---|---|
| `$schema` | 否 | 启用编辑器验证和Pi已发布schema的补全。 |
| `name` | 是 | 在选择器和设置中标识主题。必须唯一，不能包含`/`，也不能是`system`。 |
| `appearance` | 否 | `"dark"`或`"light"`：主题设计的背景。省略时Pi从主题颜色检测。 |
| `vars` | 否 | 定义可复用的颜色值。变量可引用其他变量。 |
| `colors` | 是 | 为终端UI角色分配颜色。该模式标识了必需和可选的角色。 |
| `export` | 否 | 覆盖HTML导出中的页面和面板背景。 |

颜色可以以六种形式书写：

| 形式 | 示例 | 含义 |
|---|---|---|
| RGB十六进制 | `"#0af"` 或 `"#00aaff"` | 三或六位的sRGB颜色。 |
| OKLCH | `"oklch(62% 0.1 200)"` | 基于感知的明度、色度和色调。 |
| OKHSL | `"okhsl(250 60% 55%)"` | 色相、饱和度和明度。饱和度相对于sRGB色域在该色相和明度下允许的最大值，因此每个值都在色域内，等饱和度看起来同样鲜艳。 |
| 256色索引 | `39` | `0`至`255`之间的ANSI调色板索引。 |
| 变量引用 | `"primary"` | `vars`中条目的值。 |
| 终端默认 | `""` | 终端的默认前景或背景颜色。 |

终端默认颜色将渲染为终端自身的颜色。Pi在需要具体值的地方（例如HTML导出或扩展颜色计算）使用终端报告的默认颜色，或基于主题外观猜测的黑/白。

Pi会解析链式变量引用。缺少变量或循环引用会使主题无效。Pi在可用时使用真彩色，将OKLCH映射到sRGB，并为256色终端近似颜色。HTML导出会将OKHSL值转换为十六进制，因为CSS不支持它们。如果颜色与源值不同，请检查终端的真彩色检测和对比度设置。详情见[配置终端](terminal-setup.md#override-detected-capabilities)。

使用[主题JSON模式](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json)获取确切属性、必需颜色和接受的值类型。

Pi在启动和`/reload`时会报告无效主题文件。

## 查找要更改的颜色

主题颜色描述界面角色而非单个组件。使用以下组在模式中查找相关部分：

| 区域 | 颜色名称 |
|---|---|
| 通用界面 | `accent`, `border*`, `text`, `muted`, `dim`, `success`, `error`, `warning` |
| 选择和全屏 | `selectedBg`, `searchMatch*`, `scrollbar*` |
| 消息 | `userMessage*`, `customMessage*`, `thinkingText` |
| 工具执行 | `toolPendingBg`, `toolSuccessBg`, `toolErrorBg`, `toolTitle`, `toolOutput` |
| Markdown | `md*` |
| 工具差异 | `toolDiff*` |
| 语法高亮 | `syntax*` |
| 编辑器模式 | `thinking*`, `bashMode` |
| HTML导出 | `export.pageBg`, `export.cardBg`, `export.infoBg` |

模式是格式参考。内置主题提供完整值，您可以复制并调整。

有五个可选颜色，省略时会继承另一颜色：

| 可选颜色 | 备用颜色 |
|---|---|
| `scrollbarTrack` | `muted` |
| `scrollbarThumb` | `text` |
| `searchMatchBg` | `selectedBg` |
| `searchMatchText` | `text` |
| `thinkingMax` | `thinkingXhigh` |

如果`export`颜色被省略，Pi将从`userMessageBg`推导HTML页面和面板背景。

## 从项目或包加载主题

将项目主题放置在`.pi/themes/`。项目主题仅在授予[项目信任](security.md#understand-project-trust)后加载。

您还可以通过`themes`设置加载主题文件和目录，或在Pi包中分发。详情见[配置](configuration.md)、[设置](settings.md#resources)和[Pi包](packages.md)。

每个加载的主题必须有唯一名称。Pi会报告重复名称作为资源冲突。

