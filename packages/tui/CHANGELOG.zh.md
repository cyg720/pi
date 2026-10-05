# 变更日志

## [未发布]

## [1.0.2] - 2026-10-04

## [1.0.1] - 2026-10-03

### 新增

- 新增 `setImageTranscoder()`，该功能允许 `Image` 将 JPEG、GIF 和 WebP 图片转换为 PNG 格式，以适配 Kitty 图形协议（[#10292](https://github.com/earendil-works/pi/issues/10292)）

### 修复

- 修复非 PNG 图片在 Kitty 协议终端中渲染为空的问题：如果没有注册转换器，或转换失败时，`Image` 现在会显示其文本回退方案（[#10292](https://github.com/earendil-works/pi/issues/10292)）

- 修复在 WezTerm 中滚动时，全屏 Kitty 图片会压缩成一行的问题（[#10319](https://github.com/earendil-works/pi/issues/10319)）

## [1.0.0] - 2026-10-01

### 新增

- 新增 `TuiAltScreen.getScreenLines()`，该功能可返回最后渲染帧的行内容。

### 修复

- 修复在全屏模式下，鼠标选择和搜索高亮时颜色溢出的问题（当样式标记结束于高亮边界时）（[#10169](https://github.com/earendil-works/pi/issues/10169)）

- 修复每个渲染消息占用的内存：`Markdown` 弱引用其解析的标记，`Markdown`、`Text` 和 `Box` 会扁平化其缓存的行内容。一条长的助手消息现在占用的堆内存约为之前的五分之一。

- 修复以空白字符开头时，命令行自动补全功能无法触发的问题（[#10218](https://github.com/earendil-works/pi/pull/10218) 由 [@haoqixu](https://github.com/haoqixu) 提交）

## [0.99.2] - 2026-09-30

## [0.99.1] - 2026-09-29

## [0.99.0] - 2026-09-29

### 破坏性变更

- 用 `TUI.queryTerminalColors()` 替换了 `TUI.queryTerminalColorScheme()` 和 `TUI.queryTerminalBackgroundColor()`，该功能可在一个往返中查询默认的前景色、背景色和 16 种 ANSI 颜色（OSC 10、11 和 4），并返回 `TerminalColors`。移除了 `parseOsc11BackgroundColor()`。

### 新增

- 新增 `"auto"` 到 `TuiAltScreenOptions.wheelScrollLines`，该功能可加速终端发送单个事件时的快速滚轮操作，以及 `TuiAltScreen.setWheelScrollLines()` 用于运行时更新（[#9758](https://github.com/earendil-works/pi/issues/9758)）

- 新增颜色值和样式：新增 `Color` 类型（索引 ANSI、sRGB 或 OKLCH），以及 `parseColor()`、`#rgb`、`#rrggbb`、`oklch()`、`okhsl()` 的值，以及 `indexedColor()`、`rgbColor()`、`oklchColor()`、`okhslColor()`、`mixColors()`、`colorToHex()`、`colorToRgb()`、`colorToOklch()`、`colorToOkhsl()`、`styleText()`、`getTerminalColorMode()` 和相关辅助函数。

- 新增 `NativeClipboard.getFilePaths()`，该功能可从 macOS 系统剪贴板读取文件 URL（[#9999](https://github.com/earendil-works/pi/issues/9999)、[#10136](https://github.com/earendil-works/pi/pull/10136) 由 [@christianklotz](https://github.com/christianklotz) 提交）

### 变更

- 带有 `TERM=*-direct` 的终端现在被识别为真彩色。

### 修复

- 修复 `/skill` 自动补全为空的情况，当加载的技能名称中不包含 `skill` 中的字母时（[#9944](https://github.com/earendil-works/pi/issues/9944)）

- 修复路径和 `@` 自动补全在打开 `(`、`[`、`{`、`<` 或反引号（如 `(~/Dev<Tab>`）等包装器后无法正常工作的问题。

- 减少在使用 Kitty 图形协议的终端中图片拉伸的情况（[#8938](https://github.com/earendil-works/pi/issues/8938)、[#9957](https://github.com/earendil-works/pi/pull/9957) 由 [@rwachtler](https://github.com/rwachtler) 提交）

- 修复输入键盘事件丢失的问题，当组件（如 `SettingsList` 带有打开的子菜单）转发鼠标事件给子组件并移除该子组件时。

- 修复扩展关闭覆盖层时，shell 光标在退出后仍隐藏的问题（[#10026](https://github.com/earendil-works/pi/issues/10026)）

- 提升样式文本的渲染性能：`visibleWidth()` 不再对 ANSI 样式 ASCII 字符进行图形分割测量，`Box` 在检查渲染缓存时不重新填充每行，`Markdown` 在主题和宽度变化时复用已解析的标记。

## [0.87.1] - 2026-09-22

## [0.87.0] - 2026-09-21

## [0.86.1] - 2026-09-20

## [0.86.0] - 2026-09-19

### 新增

- 新增内置异步原生剪贴板读取器，支持 macOS、Windows 和 X11，通过导出的 `getNativeClipboard()` API 提供，替代了消费者中的外部原生剪贴板依赖（[#9163](https://github.com/earendil-works/pi/pull/9163)）

### 变更

- 通过使用原生子串搜索，减少长文本模糊搜索的延迟，替代了逐字符扫描的 JavaScript 实现（[#9267](https://github.com/earendil-works/pi/issues/9267)）

### 修复
- 修复了LaTeX遗留字体切换回原始源代码、居中`cases`布局围绕周围公式、以及垂直排列不支持和嵌套显示脚本的问题（[#8827](https://github.com/earendil-works/pi/issues/8827)，[#9564](https://github.com/earendil-works/pi/issues/9564)，[#7929](https://github.com/earendil-works/pi/issues/7929)）。
- 修复了全屏剪贴板失败时隐藏可操作的后台错误信息，将失败通知扩展到五秒（[#9618](https://github.com/earendil-works/pi/issues/9618)）。
- 修复了全屏Kitty图像被WezTerm后续行清除擦除的问题（[#9169](https://github.com/earendil-works/pi/issues/9169)）。
- 修复了技能/命令行自动补全按`skill:`前缀排序而非纯技能名（[#9120](https://github.com/earendil-works/pi/pull/9120)由[@yearth](https://github.com/yearth)提交）。
- 修复了文件自动补全边界和路径引号处理CJK标点符号（[#9746](https://github.com/earendil-works/pi/pull/9746)由[@haoqixu](https://github.com/haoqixu)提交）。

## [0.85.1] - 2026-09-05

### 新增

- 新增了在全屏模式下按住Alt时鼠标滚轮滚动速度提升五倍（[#9166](https://github.com/earendil-works/pi/pull/9166)由[@xl0](https://github.com/xl0)提交）。

### 修复

- 修复了鼠标悬停改变选择并重新居中自动补全和设置列表，导致点击目标不同项的问题。

## [0.85.0] - 2026-09-04

### 重大变更

- 移除了pi-tui的编码代理环境变量默认配置。应用程序必须通过渲染器构造函数和`setClearOnShrink()`配置硬件光标和缩小时的清除行为。`PI_DEBUG_REDRAW`现为`PI_TUI_DEBUG_REDRAW`；调试和崩溃日志文件名现在使用`pi-tui-`前缀。若未提供日志目录，重绘日志将被禁用，崩溃转储将写入操作系统的临时目录。（[#8699](https://github.com/earendil-works/pi/pull/8699)由[@geraschenko](https://github.com/geraschenko)提交）

### 新增

- 新增了`TuiAltScreen` `scrollToEndIndicator`选项，可在主滚动视图远离末尾时显示可点击的跳转到末尾标签（[#9080](https://github.com/earendil-works/pi/pull/9080)由[@rwachtler](https://github.com/rwachtler)提交）。
- 新增了关系代数连接符号的LaTeX渲染支持（[#9050](https://github.com/earendil-works/pi/pull/9050)由[@haoqixu](https://github.com/haoqixu)提交）。

### 变更

- 变更了`Loader`动画和编辑器集成以支持嵌入式工作指示器（[#8799](https://github.com/earendil-works/pi/pull/8799)由[@cristinaponcela](https://github.com/cristinaponcela)提交）。
- 通过缓存未变的搜索结果、索引ASCII序列、限制高亮工作仅针对可见匹配项，降低了大型转录本全屏搜索延迟（[#8800](https://github.com/earendil-works/pi/pull/8800)由[@cristinaponcela](https://github.com/cristinaponcela)提交）。

### 修复

- 修复了拖选继续跨过编辑器。
- 修复了在拒绝`SIGWINCH`自信号的受限seccomp策略下终端启动（[#8898](https://github.com/earendil-works/pi/pull/8898)由[@bartlomiejkida](https://github.com/bartlomiejkida)提交）。
- 修复了Zed终端图像能力检测（[#8828](https://github.com/earendil-works/pi/pull/8828)由[@Perlence](https://github.com/Perlence)提交）。

## [0.84.4] - 2026-08-28

### 新增

- 新增了对OSC 8超链接、内联图像协议和真彩色终端能力的环境和程序化覆盖（[#8665](https://github.com/earendil-works/pi/issues/8665)）。
- 新增了`TuiAltScreen` `copyOnSelect`选项及辅助功能，可程序化检测并复制活动全屏文本选择（[#7720](https://github.com/earendil-works/pi/issues/7720)）。

### 变更

- 变更了全屏滚动条为渲染静音细轨道、对比度两单元最小拇指、保留底层背景不继承前景样式、在`always`模式下保留无样式的列、鼠标指针进入时显示隐藏`auto`轨道、悬停时同色拇指扩展、支持轨道点击跳转及拇指拖拽。
- 变更了全屏转录本搜索为带边框、占位符输入的输入框，显示静音结果计数、右对齐可点击带箭头按钮、支持快捷键切换。

### 修复

- 修复了主屏幕渲染在图像密集输出超过V8字符串长度限制时崩溃（[#8028](https://github.com/earendil-works/pi/issues/8028)）。
- 修复了嵌套结果的自动补全排序（[#8669](https://github.com/earendil-works/pi/pull/8669)）。
-  修复全屏双击单词选择时路径和 kebab-case 标记的拆分问题，涉及 `/` 和 `-`（[#7746](https://github.com/earendil-works/pi/issues/7746)）。

## [0.84.3] - 2026-08-24

###  修复

-  修复 Windows 上基于 VS Code 的终端中全屏右键粘贴重复的问题（[#8186](https://github.com/earendil-works/pi/issues/8186)）。
-  修复文本填充超出窄终端宽度的问题（[#8252](https://github.com/earendil-works/pi/issues/8252)）。
-  修复 Markdown 表格链接换行时颜色泄漏到边框和相邻单元格的问题，包括嵌套在引用中的表格（[#8335](https://github.com/earendil-works/pi/issues/8335)）。

## [0.84.2] - 2026-08-14

###  增加

-  增加未绑定的单行转录滚动操作，涉及 `tui.altScreen.lineUp` 和 `tui.altScreen.lineDown`，用于全屏 TUI 键盘绑定（[#7903](https://github.com/earendil-works/pi/pull/7903) 由 [@midastruth](https://github.com/midastruth) 提交）。
-  增加全屏 TUI 的主滚动视图增量搜索，支持可配置的匹配样式，涉及 `Ctrl+Shift+F`，并增加 `Enter`/`Ctrl+G` 和 `Shift+Enter`/`Ctrl+Shift+G` 的前后导航。

###  修改

-  降低每帧交替屏幕分配抖动，通过将全宽布局行作为直接行引用绘制，而非每帧通过 ANSI/图形分割重组所有可见行，性能提升约 9-18 倍。

###  修复

-  修复全屏鼠标拖选和 OSC 8 链接激活在报告通用 SGR 鼠标释放按钮代码的终端中的问题（[#7963](https://github.com/earendil-works/pi/issues/7963)）。
-  修复全屏转录搜索在手动滚动和碎片化 SGR 鼠标输入时回退到当前匹配项，并修复搜索查询中泄漏。
-  修复 LaTeX 参数在新行开始时被解析为空（[#7760](https://github.com/earendil-works/pi/issues/7760)）。
-  修复 LaTeX 控制空格跨行分割导致完整表达式回退到原始源代码。
-  修复聚焦全屏覆盖层未接收鼠标滚轮或视口滚动键（如 PageUp 和 PageDown）（[#7894](https://github.com/earendil-works/pi/issues/7894)）。
-  修复通过 SSH 分割 `Alt+Enter` 输入被误读为 Escape，增加 `PI_TUI_ESC_TIMEOUT` 支持高延迟终端，并将该超时限制为单独的 Escape 输入（[#7899](https://github.com/earendil-works/pi/pull/7899) 由 [@powerfooI](https://github.com/powerfooI) 提交）。
-  修复终端失焦时全屏会话重新绘制和清除文本选择（[#7892](https://github.com/earendil-works/pi/pull/7892) 由 [@terrorobe](https://github.com/terrorobe) 提交）。
-  修复全屏选择复制在主机剪贴板不支持 OSC 52 时错误报告成功，改为允许主机剪贴板集成并报告已验证的失败（[#8110](https://github.com/earendil-works/pi/pull/8110) 由 [@Panoplos](https://github.com/Panoplos) 提交）。

## [0.84.1] - 2026-08-07

###  增加

-  增加未绑定的半页转录滚动操作，涉及 `tui.altScreen.halfPageUp` 和 `tui.altScreen.halfPageDown`，用于全屏 TUI 键盘绑定（[#7735](https://github.com/earendil-works/pi/issues/7735)）。
-  增加全屏 TUI 的双击单词和空白选择、感知粒度的拖选和三击段落选择（[#7725](https://github.com/earendil-works/pi/issues/7725)，[#7733](https://github.com/earendil-works/pi/pull/7733) 由 [@volsa](https://github.com/volsa) 提交）。
-  增加右键粘贴处理程序到交替屏幕 TUI，当前在 Windows 上启用。

###  修复

-  修复 LaTeX 关系、乘法和命名运算符间距，并正确组成带堆叠分数、运算符限制和相邻矩阵的矩阵。
-  降低在 tmux、Zellij 和 GNU Screen 下全屏鼠标事件的体积。

## [0.84.0] - 2026-08-06

###  增加

-  增加 LaTeX 表达式在 Markdown 中的终端友好 Unicode 渲染，包括内联和显示数学、分数、脚本、常见符号、对齐方程、分段和矩阵。
-  增加共享的 `TuiMode` 类型和 `mode` 区分度到主屏幕和交替屏幕 TUI 渲染器。
-  增加 TUI 生命周期和渲染状态传递 API，用于替换渲染器而不重播主屏幕内容。
-  导出捆绑的 `Marked` 解析器和标记类型。
-  增加宽度感知的源代码转换到 `Markdown` 组件。
- 增加了兼容界面的主屏幕和备用屏幕TUI渲染器，支持应用自有滚动功能（[#7304](https://github.com/earendil-works/pi/issues/7304)）。
- 增加了备用屏幕的`VStack`、`HStack`和嵌套`ScrollView`布局，支持受限尺寸、粘性区域和指针目标滚动。
- 增加了备用屏幕拖选时边缘自动滚动，支持超出屏幕滚动视图内容。
- 增加了比例滚动条，支持鼠标拖动、首页/末页文档导航、临时`auto`模式和保留最右列的`always`模式；滚动条模式可在运行时切换。
- 增加了页面滚动和OSC 133语义提示导航到备用屏幕视口。
- 增加了可配置的前后提示历史导航动作，独立于垂直光标移动。
- 增加了备用屏幕渲染器的堆叠临时通知（[#7361](https://github.com/earendil-works/pi/pull/7361)）。

### 更改

- 将备用屏幕鼠标滚轮默认步进从三行减少到一行，实现更精细滚动。

### 修复

- 修复Windows Shift+Enter检测，通过扩展原生Win32辅助程序上报修饰键状态。
- 修复npm包遗漏源码和构建脚本，导致无法重建Windows原生插件。
- 修复npm包遗漏源码和构建脚本，导致无法重建Darwin原生插件。
- 修复Windows控制台真彩色检测，当Windows Terminal未提供`WT_SESSION`给子shell时。
- 修复终端宽度计算未正确处理印地语连字符形素集群（[#6987](https://github.com/earendil-works/pi/pull/6987)由[@petrroll](https://github.com/petrroll)提交）。
- 修复切换终端窗格焦点时，未匹配鼠标事件导致备用屏幕文本选择幻影。
- 修复可搜索设置查询中空格导致选中值变化，而非多词标签过滤。
- 修复备用屏幕Kitty图像滚动时越界垂直布局剪裁边界并重叠粘性区域。
- 修复备用屏幕重绘重新传输Kitty图像数据，移动或重新出现在屏幕的图像导致相邻行内容丢失，固定基准滚动内容每帧渲染两次，以及绘制时扫描剪裁的转录行。
- 修复全屏转录导航后无编辑器可访问的`Home`、`End`、`PageUp`或`PageDown`变体，通过添加Ctrl修饰编辑器绑定（[#7574](https://github.com/earendil-works/pi/issues/7574)）。
- 修复Windows键盘输入渲染延迟，允许输入抢占节流渲染定时器。
- 修复嵌套堆叠布局忽略子元素最小尺寸。
- 修复批量终端颜色方案报告被解析为一个格式错误的响应（[#7550](https://github.com/earendil-works/pi/pull/7550)）。
- 修复终端进度清除，确保发出完整的OSC 9;4序列（[#7581](https://github.com/earendil-works/pi/pull/7581)）。
- 修复iTerm2图像负载遗漏xterm.js图像插件所需的尺寸元数据（[#7612](https://github.com/earendil-works/pi/pull/7612)）。
- 修复宽度截断导致OSC 8超链接未终止（[#7657](https://github.com/earendil-works/pi/pull/7657)由[@xXJSONDeruloXx](https://github.com/xXJSONDeruloXx)提交）。

## [0.83.0] - 2026-07-29

### 修复

- 修复长图像备用路径在窄终端溢出，缩短家目录路径，并使绝对路径在终端超链接可用时可点击（[#7262](https://github.com/earendil-works/pi/pull/7262)）。

## [0.82.1] - 2026-07-25

## [0.82.0] - 2026-07-24

### 修复

- 修复调试和崩溃日志使用配置的TUI日志目录（包括`PI_CODING_AGENT_DIR`），而非始终写入`~/.pi/agent`（[#6958](https://github.com/earendil-works/pi/pull/6958)由[@davidbrai](https://github.com/davidbrai)提交）。
- 修复窄终端在编辑器底部滚动指示超出终端宽度时崩溃（[#7015](https://github.com/earendil-works/pi/pull/7015)由[@christianklotz](https://github.com/christianklotz)提交）。

## [0.81.1] - 2026-07-21

## [0.81.0] - 2026-07-21

### 修复

- 修复终端关闭时先清除编辑器的软件光标反转状态，再恢复硬件光标，避免光标重复伪影（[#6790](https://github.com/earendil-works/pi/pull/6790)由[@dam9000](https://github.com/dam9000)提交）。
- 修复了ANSI感知的文本换行功能，使其能够识别CRLF和CR换行符，并在跨行时保持样式一致（[#6764](https://github.com/earendil-works/pi/pull/6764) 由 [@xz-dev](https://github.com/xz-dev) 提交）。

- 修复了编辑器粘贴注册表在删除粘贴标记时的损坏问题：撤销操作现在会同时恢复粘贴注册表和文本，并且标记重新编号会按递增ID顺序移动注册表条目，因此提交的提示不再包含字面意义的`[paste #N ...]`标记或错误的粘贴内容（[#6844](https://github.com/earendil-works/pi/issues/6844)）。

## [0.80.10] - 2026-07-16

## [0.80.9] - 2026-07-16

## [0.80.8] - 2026-07-16

### 修复了

- 修复了终端输出，使其能够一致地规范化制表符字符（[#6697](https://github.com/earendil-works/pi-mono/pull/6697) 由 [@xz-dev](https://github.com/xz-dev) 提交）。

## [0.80.7] - 2026-07-14

### 修复了

- 修复了对Alt+符号键组合（如`Alt+,`和`Alt+.`）的旧终端解码（[#6523](https://github.com/earendil-works/pi-mono/pull/6523) 由 [@ribelo](https://github.com/ribelo) 提交）。

## [0.80.6] - 2026-07-09

## [0.80.5] - 2026-07-09

## [0.80.4] - 2026-07-09

### 修复了

- 修复了编辑器粘贴标记的计数问题，当粘贴标记被删除或终端状态被清除时，防止在删除标记后出现过期的粘贴状态（[#6397](https://github.com/earendil-works/pi/pull/6397) 由 [@affanali2k3](https://github.com/affanali2k3) 提交）。

## [0.80.3] - 2026-06-30

### 增加了

- 增加了可选的Markdown渲染器选项，以保留源转义符用于转录渲染（[#6105](https://github.com/earendil-works/pi/issues/6105)）。

## [0.80.2] - 2026-06-23

## [0.80.1] - 2026-06-23

## [0.80.0] - 2026-06-23

### 更改了

- 将`Ctrl+J`作为默认换行键绑定，与`Shift+Enter`并列。

## [0.79.10] - 2026-06-22

## [0.79.9] - 2026-06-20

### 修复了

- 修复了Markdown流式代码块的渲染，使部分关闭的代码块不再在内容流式传输时收缩或闪烁（[#5846](https://github.com/earendil-works/pi/pull/5846) 由 [@xl0](https://github.com/xl0) 提交）。

## [0.79.8] - 2026-06-19

## [0.79.7] - 2026-06-18

### 增加了

- 增加了终端颜色方案查询和通知支持，用于检测亮/暗外观（`TUI.queryTerminalColorScheme()`、`TUI.onTerminalColorSchemeChange()`和`TUI.setTerminalColorSchemeNotifications()`）（[#5874](https://github.com/earendil-works/pi/pull/5874)）。

- 增加了对Kitty图形内联图像支持的Warp终端检测（[#5841](https://github.com/earendil-works/pi/pull/5841) 由 [@dodiego](https://github.com/dodiego) 提交）。
- 导出 `sliceByColumn`，支持 ANSI 意识的水平列切片。

## [0.79.6] - 2026-06-16

## [0.79.5] - 2026-06-16

### 更改

- 将 Markdown 解析更新为 `marked` 18.0.5。

### 修复

- 修复编辑器光标向上处理，使非空草稿在浏览输入历史前能跳转到行首（[#5789](https://github.com/earendil-works/pi/pull/5789) by [@4h9fbZ](https://github.com/4h9fbZ)）。

## [0.79.4] - 2026-06-15

### 添加

- 为 OSC 11 回复添加终端背景色查询支持（[#5385](https://github.com/earendil-works/pi/pull/5385) by [@vegarsti](https://github.com/vegarsti)）。

### 修复

- 修复覆盖层合成，使其在 CJK 宽字符上保持对齐（[#5297](https://github.com/earendil-works/pi/issues/5297)）。

- 修复 WezTerm 内嵌 Kitty 图像渲染，在全屏重绘回退时，确保图像填充行在绘制前被保留，避免高图像放置后退（[#5618](https://github.com/earendil-works/pi/issues/5618), [#4415](https://github.com/earendil-works/pi/issues/4415)）。

## [0.79.3] - 2026-06-13

## [0.79.2] - 2026-06-12

### 修复

- 修复 Markdown 源列表标记保留，包含无序标记，使独立 `+` 用户消息不再渲染为 `-`（[#5657](https://github.com/earendil-works/pi/issues/5657)）。

- 修复以斜杠分隔的模糊查询，使插入后 provider/model 补全仍可匹配。

- 修复 WezTerm 内嵌 Kitty 图像渲染，确保保留行清除不会擦除除顶部条带外的所有工具图像预览（[#5618](https://github.com/earendil-works/pi/issues/5618)）。

- 修复编辑器对 CJK 文本的换行，使其在字符边界处断行，而非留下大段尾部空白（[#5585](https://github.com/earendil-works/pi/pull/5585) by [@haoqixu](https://github.com/haoqixu)）。

- 修复松散 Markdown 列表渲染，保持列表项之间空白行的分隔（[#5562](https://github.com/earendil-works/pi/pull/5562) by [@Perlence](https://github.com/Perlence)）。

## [0.79.1] - 2026-06-09

### 添加

- 添加 `AutocompleteProvider.triggerCharacters`，使编辑器自动补全可自然触发于 provider 定义的 token 前缀（[#4703](https://github.com/earendil-works/pi/issues/4703)）。

### 修复
- 修复了在斜杠命令自动补全可见时IME硬件光标定位问题（[#5283](https://github.com/earendil-works/pi/pull/5283) by [@smoosex](https://github.com/smoosex)）。
- 修复了提示历史导航，以在从历史浏览返回时恢复当前草稿（[#5494](https://github.com/earendil-works/pi/issues/5494)）。
- 修复了混合拉丁字母和CJK文本的换行问题，使得未加空格的CJK连续文本可以在图形边界处断行，而不会留下过大的尾部空白（[#5495](https://github.com/earendil-works/pi/issues/5495)）。
## [0.79.0] - 2026-06-08

### 固定
- 将提示历史导航固定为向上浏览时将光标置于开头，向下浏览时置于结尾，从而实现对多行提示的重复上下遍历立即生效（[#5454](https://github.com/earendil-works/pi/issues/5454)）。
- 修复了对Shift+Enter的间歇性处理，将Kitty键盘协议的后备响应改为响应驱动，而非超时驱动（[#5188](https://github.com/earendil-works/pi/issues/5188)）。
- 修复了TUI渲染，在内容缩至零时清除陈旧行。
- 修复了自动补全建议，在编辑器光标移动后重新查询（[#5499](https://github.com/earendil-works/pi/pull/5499) 由 [@Roman-Galeev](https://github.com/Roman-Galeev) 提交）。
## [0.78.1] - 2026-06-04

### 固定
- 修复了覆盖层焦点恢复功能，使非捕获覆盖层在UI重新渲染和显式释放焦点后仍保持可交互状态（[#5235](https://github.com/earendil-works/pi/pull/5235) 由 [@nicobailon](https://github.com/nicobailon) 提交）。
- 修复了列切片和叠加合成中的制表符宽度会计，确保包含制表符的输出不会超出终端宽度（[#5218](https://github.com/earendil-works/pi/issues/5218)）。
## [0.78.0] - 2026-05-29

### 修复

- Fixed ANSI文本换行，避免在非常长的换行文本上发生堆栈溢出（[#5185](https://github.com/earendil-works/pi-mono/issues/5185)）。
- 澄清了IME硬件光标文档，说明光标可见性保持可选状态（[#5200](https://github.com/earendil-works/pi-mono/issues/5200)）。

- 修复了OSC 8超链接在tmux客户端支持时的穿透问题（[#5189](https://github.com/earendil-works/pi-mono/pull/5189) 由 [@mpazik](https://github.com/mpazik) 提交）。

## [0.77.0] - 2026-05-28

### 修复

- 修复了键盘协议协商，使其忽略不匹配或延迟的终端响应，避免了虚假的Kitty键盘协议检测（[#5091](https://github.com/earendil-works/pi/pull/5091) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交）。
## [0.76.0] - 2026-05-27

### 已添加
- 增加了一个可选的Markdown渲染器选项，用于保留源有序列表标记以进行转录渲染（[#5013](https://github.com/earendil-works/pi/issues/5013)）。
### 已修复

- 已修复 `Shift+Enter` 在 Apple Terminal 中，通过检测 Terminal.app 发送纯 Return 时本地 macOS 修改器状态。
- 修复了Windows终端能力检测，以启用OSC 8超链接，确保跨换行的可点击长URL得以保留([#4923](https://github.com/earendil-works/pi/issues/4923))。
- 修复JetBrains终端能力检测，以启用真彩色并禁用不支持的OSC 8超链接（[#5037](https://github.com/earendil-works/pi-mono/pull/5037) by [@Perlence](https://github.com/Perlence)）。
- 修复编辑器和输入单词导航/删除功能，使用Unicode单词边界同时保留ASCII标点边界（[#5022](https://github.com/earendil-works/pi-mono/pull/5022)由[@haoqixu](https://github.com/haoqixu)提交，[#5067](https://github.com/earendil-works/pi-mono/pull/5067)由[@haoqixu](https://github.com/haoqixu)提交，[#5068](https://github.com/earendil-works/pi-mono/pull/5068)由[@haoqixu](https://github.com/haoqixu)提交）。

## [0.75.5] - 2026-05-23

### 更改
- 将Windows VT输入的可选`koffi`依赖替换为一个微小的内置辅助程序，减小安装包体积的同时保持Shift+Tab处理功能（[#4480](https://github.com/earendil-works/pi/issues/4480)）。

## [0.75.4] - 2026-05-20

### 更改

- 移除包级开发监控脚本，因为根目录的TypeScript检查已验证仅支持strip的源文件。

### 修复

- 修复加载器初始化，确保启动指示器不会在帧初始化之前运行。

- 修复真彩色能力检测，使其与交互式主题检测器的终端图像渲染保持一致。

## [0.75.3] - 2026-05-18

## [0.75.2] - 2026-05-18

## [0.75.1] - 2026-05-18

## [0.75.0] - 2026-05-17

### 不兼容变更

- 将最低支持的Node.js版本提升至22.19.0。

## [0.74.1] - 2026-05-16

### 添加

- 添加markdown列表项换行功能，保持换行内容的缩进（[#4327](https://github.com/earendil-works/pi-mono/pull/4327) by [@Perlence](https://github.com/Perlence)）。

### 修复
- 修复markdown任务列表复选框渲染问题（[#4379](https://github.com/earendil-works/pi-mono/pull/4379)由[@Perlence](https://github.com/Perlence)提交）。
- 修复markdown渲染在处理非常大的markdown文件时的健壮性（[#4463](https://github.com/earendil-works/pi-mono/pull/4463)由[@ndanielherrera](https://github.com/ndanielherrera)提交）。
- 修复Kitty图片放置，当视口宽度小于渲染图片宽度时（[#4461](https://github.com/earendil-works/pi-mono/pull/4461)由[@xu0o0](https://github.com/xu0o0)提交）。
- 修复WezTerm Kitty键盘协议边缘情况，确保转义序列处理正确（[#4482](https://github.com/earendil-works/pi-mono/pull/4482)由[@Felixoid](https://github.com/Felixoid)提交）。
- 修复内联图片渲染，限制竖屏图片按高度裁剪，而非始终按配置的最大宽度缩放。

## [0.74.0] - 2026-05-07

## [0.73.1] - 2026-05-07

### 修复

- 修复包裹的OSC 8超链接，保留BEL终止符，确保OAuth登录URL在每行包裹中均可点击。
- 修复Kitty内联图片重绘，使其始终在TUI终端区域内，避免写入活动视口下方。
- 修复Kitty内联图片渲染，允许终端分配图片ID并将解析后的图片ID绑定到有效值。
- 修复内联图片能力检测，禁用cmux终端中的内联图片。

## [0.73.0] - 2026-05-04

### 修复

- 修复模糊排名，优先匹配selector和自动补全结果中的精确匹配项。

## [0.72.1] - 2026-05-02

## [0.72.0] - 2026-05-01

## [0.71.1] - 2026-05-01

## [0.71.0] - 2026-04-30

### 修复

- 修复`ProcessTerminal`，回退到`COLUMNS`和`LINES`，再默认使用80x24尺寸（[#4004](https://github.com/badlogic/pi-mono/issues/4004)）。
- 修复编辑器渲染伪字符，使泰文Sara Am和老挝AM元音字符正常显示（[#3904](https://github.com/badlogic/pi-mono/issues/3904)）。

## [0.70.6] - 2026-04-28

## [0.70.5] - 2026-04-27

## [0.70.4] - 2026-04-27

## [0.70.3] - 2026-04-27

### 修复

- 修复Kitty键盘协议CSI-u加上原始字符输入导致的重复可打印字符问题（在意大利语等布局上尤为明显）（[#3780](https://github.com/badlogic/pi-mono/issues/3780)）。

## [0.70.2] - 2026-04-24

## [0.70.1] - 2026-04-24

### 修复

- 修复CSI-u Ctrl+字母解码在带链接的粘贴模式中的问题，避免粘贴后修改的转义序列成为编辑器中的纯文本（[#3623](https://github.com/badlogic/pi-mono/pull/3623)由[@Exrun94](https://github.com/Exrun94)提交）。

## [0.70.0] - 2026-04-23

### 修复

- 保持OSC 9;4终端进度指示器的周期性更新，确保Ghostty在长时间运行的代理任务中不会清除指示器（[#3610](https://github.com/badlogic/pi-mono/issues/3610)）。

## [0.69.0] - 2026-04-22

### 新增

- 新增`setProgress(active: boolean)`到`Terminal`接口，支持OSC 9;4进度指示器
- 新增通用堆叠式自动补全支持，通过`AutocompleteProvider.shouldTriggerFileCompletion?()`和`#`扩展包装实现，作为自然自动补全触发器与`@`并存（[#2983](https://github.com/badlogic/pi-mono/issues/2983)）。

## [0.68.1] - 2026-04-22

### 修复

- 修复`@`自动补全模糊搜索，使其跟随符号链接目录并包含符号链接路径在结果中（[#3507](https://github.com/badlogic/pi-mono/issues/3507)）。

## [0.68.0] - 2026-04-20

### 新增

- 新增`LoaderIndicatorOptions`和`Loader.setIndicator()`对自定义加载器框架和动画间隔的支持，允许TUI消费者使用动画、静态或隐藏的加载指示器（[#3413](https://github.com/badlogic/pi-mono/issues/3413)）。

### 修复

- 修复`@`自动补全模糊搜索，停止对纯文本查询匹配完整基础路径，避免工作树或当前工作目录路径中的查询文本干扰真实结果（如`@plan`建议）（[#2778](https://github.com/badlogic/pi-mono/issues/2778)）。
- 修复xterm的`modifyOtherKeys`可打印输入，使编辑器中大写移位字母正确插入，且移位字母绑定解析和匹配一致（[#3436](https://github.com/badlogic/pi-mono/issues/3436)）。

## [0.67.68] - 2026-04-17

## [0.67.67] - 2026-04-17

## [0.67.6] - 2026-04-16

### 新增

- 新增markdown链接的OSC 8超链接渲染支持，当终端声明支持时。引入公共`hyperlink(text, url)`辅助函数和`setCapabilities()`测试覆盖项，位于`packages/tui`中（[#3248](https://github.com/badlogic/pi-mono/pull/3248)由[@ofa1](https://github.com/ofa1)提交）。
- 新增`argumentHint`到`SlashCommand`接口，显示在自动补全下拉菜单的描述之前（[#2780](https://github.com/badlogic/pi-mono/pull/2780)由[@andresvi94](https://github.com/andresvi94)提交）。

### 更改
- 将`detectCapabilities()`默认紧缩为`hyperlinks: false`，用于未知终端，并强制`hyperlinks: false`在tmux/screen（包括嵌套会话，其中外部终端否则会通告OSC 8）下生效。防止markdown链接URL在终端静默吞没OSC 8序列时消失（[#3248](https://github.com/badlogic/pi-mono/pull/3248)）。

## [0.67.5] - 2026-04-16

### 修复

- 修复Zellij `Shift+Enter`的回归问题，通过回滚Zellij特定的Kitty键盘查询绕过，并恢复之前的键盘协商行为（[#3259](https://github.com/badlogic/pi-mono/issues/3259)）

## [0.67.4] - 2026-04-16

### 修复

- 修复markdown删除线解析，要求严格使用双波浪号分隔符（`~~text~~`），并以非空白边界限定，防止因波浪号使用不严格导致的意外删除线。

## [0.67.2] - 2026-04-14

### 新增

- 新增对Kitty `super`修改快捷键的完整辅助支持，包括`super+k`、`super+enter`和`ctrl+super+k`等组合（[#2979](https://github.com/badlogic/pi-mono/issues/2979)）

### 修复

- 修复tmux中Ctrl+Alt字母键匹配问题，当旧式匹配不成功时，从带有ESC前缀的旧式处理中回退到CSI-u和xterm `modifyOtherKeys`解析（[#2989](https://github.com/badlogic/pi-mono/pull/2989)由[@kaofelix](https://github.com/kaofelix)提交）

## [0.67.1] - 2026-04-13

## [0.67.0] - 2026-04-13

### 修复

- 修复`Container.render()`在长会话中因栈溢出的问题，通过用循环式推送代替`Array.push(...spread)`，防止`RangeError: Maximum call stack size exceeded`在子输出超过V8调用栈参数限制时发生（[#2651](https://github.com/badlogic/pi-mono/issues/2651)）

- 修复编辑器粘性列跟踪在粘贴标记附近的行为，使垂直光标导航能恢复光标进入粘贴标记前的列，而不是跳入或跳过粘贴内容（[#3092](https://github.com/badlogic/pi-mono/pull/3092)由[@Perlence](https://github.com/Perlence)提交）

- 修复TUI测试套件因渲染节流调度导致的失败：新增`VirtualTerminal.waitForRender()`辅助函数，等待16ms节流渲染管道稳定后再断言视口状态（[#3076](https://github.com/badlogic/pi-mono/pull/3076)由[@aliou](https://github.com/aliou)提交）
## [0.66.1] - 2026-04-08

## [0.66.0] - 2026-04-08

## [0.65.2] - 2026-04-06

### 修复

- Fixed render scheduling under heavy streaming output by coalescing `requestRender()` calls to a 16ms frame budget while preserving immediate `requestRender(true)` behavior.
## [0.65.1] - 2026-04-05

## [0.65.0] - 2026-04-03

### 已固定
- 修复了Markdown H1标题结尾内联代码的下划线样式会泄漏到尾行填充的问题
- 修复了/命令参数自动补全，使其等待异步`getArgumentCompletions()`结果并忽略无效返回值，从而防止扩展命令提供异步补全时发生崩溃（[#2719](https://github.com/badlogic/pi-mono/issues/2719)）
- 修复了非捕获覆盖层填充导致滚动回放膨胀并损坏终端视口的问题（[#2758](https://github.com/badlogic/pi-mono/pull/2758) 由 [@dotBeeps](https://github.com/dotBeeps) 提交）

## [0.64.0] - 2026-03-29

### 修复了

- 修复了TUI单元格大小响应处理，使其仅消耗精确的`CSI 6 ; height ; width t`回复，因此在等待终端图像元数据时，裸`Escape`不再被吞没（[#2661](https://github.com/badlogic/pi-mono/issues/2661)）
- 修复了Kitty键盘协议小键盘功能键，使其规范化为逻辑数字、符号和导航键，因此在iTerm2等终端中，小键盘输入不再插入私用区乱码或被忽略[#2650](https://github.com/badlogic/pi-mono/issues/2650)

## [0.63.2] - 2026-03-29

## [0.63.1] - 2026-03-27

## [0.63.0] - 2026-03-27

### 添加

- 添加对`PI_TUI_WRITE_LOG`目录路径的支持，为每个实例创建唯一的日志文件（`tui-<timestamp>-<pid>.log`），便于调试多个Pi会话[#2508](https://github.com/badlogic/pi-mono/pull/2508)由[@mrexodia](https://github.com/mrexodia)提交

### 修复

- 修复了引文文本颜色在内联链接（及其他内联元素）后因缺少样式恢复前缀而断裂的问题
- 修复了斜杠命令Tab补全从命令名补全后立即链接到参数自动补全的流程，恢复了像`/model`那样提交到选择器对话框的流程[#2577](https://github.com/badlogic/pi-mono/issues/2577)
- 修复了在TUI内容缩小或临时组件扩展工作区域后，内容过期及视口跟踪错误的问题（[#2126](https://github.com/badlogic/pi-mono/pull/2126) 由 [@Perlence](https://github.com/Perlence) 提交）

- 修复了`@`自动补全功能，使其在编辑器触发的搜索时进行防抖处理，干净取消正在进行的`fd`查找，并在结果刷新时保持建议可见（[#1278](https://github.com/badlogic/pi-mono/issues/1278)）

## [0.62.0] - 2026-03-23

### 修复

- 修复了`truncateToWidth()`对非常大字符串的流式截断，保持连续前缀，并始终安全终止截断的SGR样式（[#2447](https://github.com/badlogic/pi-mono/issues/2447)）

- 修复了markdown标题样式在标题内包含内联代码时丢失的问题

## [0.61.1] - 2026-03-20

### 修复

- 修复了共享快捷键解析，阻止用户覆盖导致移除与默认快捷键（如选择确认和编辑光标键）无关的默认快捷键（[#2455](https://github.com/badlogic/pi-mono/issues/2455)）

- 修复了Termux软件键盘高度变化时，强制全屏重绘和每次切换都回放TUI历史记录的问题（[#2467](https://github.com/badlogic/pi-mono/issues/2467)）

## [0.61.0] - 2026-03-20

### 不兼容变更

- 将仅编辑器使用的快捷键存储替换为全局快捷键管理器（`@mariozechner/pi-tui`）。TUI快捷键ID现在已命名空间化：`cursorUp` -> `tui.editor.cursorUp`，`cursorDown` -> `tui.editor.cursorDown`，`cursorLeft` -> `tui.editor.cursorLeft`，`cursorRight` -> `tui.editor.cursorRight`，`cursorWordLeft` -> `tui.editor.cursorWordLeft`，`cursorWordRight` -> `tui.editor.cursorWordRight`，`cursorLineStart` -> `tui.editor.cursorLineStart`，`cursorLineEnd` -> `tui.editor.cursorLineEnd`，`jumpForward` -> `tui.editor.jumpForward`，`jumpBackward` -> `tui.editor.jumpBackward`，`pageUp` -> `tui.editor.pageUp`，`pageDown` -> `tui.editor.pageDown`，`deleteCharBackward` -> `tui.editor.deleteCharBackward`，`deleteCharForward` -> `tui.editor.deleteCharForward`，`deleteWordBackward` -> `tui.editor.deleteWordBackward`，`deleteWordForward` -> `tui.editor.deleteWordForward`，`deleteToLineStart` -> `tui.editor.deleteToLineStart`，`deleteToLineEnd` -> `tui.editor.deleteToLineEnd`，`yank` -> `tui.editor.yank`，`yankPop` -> `tui.editor.yankPop`，`undo` -> `tui.editor.undo`，`newLine` -> `tui.input.newLine`，`submit` -> `tui.input.submit`，`tab` -> `tui.input.tab`，`copy` -> `tui.input.copy`，`selectUp` -> `tui.select.up`，`selectDown` -> `tui.select.down`，`selectPageUp` -> `tui.select.pageUp`，`selectPageDown` -> `tui.select.pageDown`，`selectConfirm` -> `tui.select.confirm`，`selectCancel` -> `tui.select.cancel`。`keybindings.json`保持向后兼容，因为每个快捷键定义都将新的内部ID映射回现有公共配置键。应用通过声明合并扩展`interface Keybindings`，创建包含TUI和应用定义的单个管理器，然后通过`setKeybindings(...)`安装（[#2391](https://github.com/badlogic/pi-mono/issues/2391)）
### 修复

- 修复用户自定义快捷键绑定，使其在共享注册表中覆盖冲突的默认绑定，因此应用级别的默认设置不再在相同快捷键被显式重新分配时保持生效（[#2391](https://github.com/badlogic/pi-mono/issues/2391)）

## [0.60.0] - 2026-03-18

### 修复

- 修复tmux xterm `modifyOtherKeys`匹配`Backspace`、`Escape`和`Space`，并通过将Windows Terminal会话与传统终端区分开来，解决了原始`\x08`退格键的歧义问题（[#2293](https://github.com/badlogic/pi-mono/issues/2293)）
## [0.59.0] - 2026-03-17

## [0.58.4] - 2026-03-16

## [0.58.3] - 2026-03-15

## [0.58.2] - 2026-03-15

### 新增

- Added configurable `SelectList` primary column sizing via `SelectListLayoutOptions`, including custom primary-label truncation hooks ([#2154](https://github.com/badlogic/pi-mono/pull/2154) by [@markusylisiurunen](https://github.com/markusylisiurunen))
### 修复

- 修复了在全屏重绘（如会话切换）后残留的过期滚动回显，方法是在擦除滚动回显前先清屏（[#2155](https://github.com/badlogic/pi-mono/pull/2155) 由 [@Perlence](https://github.com/Perlence) 提交）
- 修复了Markdown块元素后紧跟下一块或文档末尾时出现的多余空白行（[#2152](https://github.com/badlogic/pi-mono/pull/2152) 由 [@markusylisiurunen](https://github.com/markusylisiurunen) 提交）
## [0.58.1] - 2026-03-14

### 固定
- 修复Windows shell和路径处理中的自动补全，以正确处理驱动器字母和混合路径分隔符
- 修复编辑器粘贴功能，以保留字面内容而非规范化换行，防止包含嵌入转义序列的文本内容被破坏（[#2064](https://github.com/badlogic/pi-mono/issues/2064)）
- 修复标签补全功能，补全相对路径时保留`./`前缀（[#2087](https://github.com/badlogic/pi-mono/issues/2087)）
- 修复`ctrl+backspace`在Windows Terminal上与普通`backspace`无法区分的问题。现在`0x08`被识别为`ctrl+backspace`而非`backspace`，使`ctrl+backspace`可在产生独特字节的终端上被绑定（[#2139](https://github.com/badlogic/pi-mono/issues/2139)）

## [0.58.0] - 2026-03-14

### 新增

- 新增编辑器粘贴标记原子段处理，将粘贴标记视为不可分割单元进行词换行和光标导航（[#2111](https://github.com/badlogic/pi-mono/pull/2111) 由[@haoqixu](https://github.com/haoqixu) 提交）

### 修复

- 修复`Input`在宽Unicode文本（CJK、全角字符）水平滚动时，使用视觉列宽和严格切片边界，防止渲染行溢出和TUI崩溃（[#1982](https://github.com/badlogic/pi-mono/issues/1982)）
- 修复了xterm `modifyOtherKeys`处理`Tab`时`matchesKey()`的问题，恢复了`shift+tab`及其他修改过的Tab绑定在tmux中的默认`extended-keys-format`状态`xterm`
- 修复了在窄终端宽度下编辑器滚动指示器渲染崩溃的问题（[#2103](https://github.com/badlogic/pi-mono/pull/2103) 由 [@haoqixu](https://github.com/haoqixu) 提交）
- 修复了编辑器`setText()`中的Tab字符以及输入路径未被标准化为空格的问题（[#2027](https://github.com/badlogic/pi-mono/pull/2027) 由 [@haoqixu](https://github.com/haoqixu) 提交）
- 修复了宽字符（CJK，全角）正好落在换行边界时`wordWrapLine`溢出的问题（[#2082](https://github.com/badlogic/pi-mono/pull/2082) 由 [@haoqixu](https://github.com/haoqixu) 提交）
- 修复了`Input`粘贴中的Tab字符未被标准化为空格的问题（[#1975](https://github.com/badlogic/pi-mono/pull/1975) 由 [@haoqixu](https://github.com/haoqixu) 提交）

## [0.57.1] - 2026-03-07

### 新增

- 新增了`treeFoldOrUp`和`treeUnfoldOrDown`编辑器操作，默认绑定为`Ctrl+←`/`Ctrl+→`和`Alt+←`/`Alt+→`（[#1724](https://github.com/badlogic/pi-mono/pull/1724) 由 [@Perlence](https://github.com/Perlence) 提交）
- 增加了数字键（`0-9`）到键绑定系统，包括Kitty CSI-u和xterm `modifyOtherKeys`对类似`ctrl+1`的绑定支持（[#1905](https://github.com/badlogic/pi-mono/issues/1905)）

### 修复

- 修复了自动补全选择忽略已输入文本：高亮现在会随着用户输入的第一个前缀匹配更新，且精确匹配在按下回车时始终被选中（[#1931](https://github.com/badlogic/pi-mono/pull/1931) 由[@aliou](https://github.com/aliou)提交）
- 修复了xterm `modifyOtherKeys`解析在`matchesKey()`和`parseKey()`中的问题，恢复了Ctrl类键绑定和tmux中修改后的回车键（当`extended-keys-format`保持默认`xterm`时）（[#1872](https://github.com/badlogic/pi-mono/issues/1872)）
- 修复了斜杠命令的Tab补全，使其在可用时立即打开参数补全（[#1481](https://github.com/badlogic/pi-mono/pull/1481) 由[@barapa](https://github.com/barapa)提交）

## [0.57.0] - 2026-03-07

### 增加了

- 增加了通过`OverlayOptions.nonCapturing`和新`OverlayHandle`方法（`focus()`、`unfocus()`和`isFocused()`）实现的非捕获覆盖层，用于程序化控制覆盖层焦点（[#1916](https://github.com/badlogic/pi-mono/pull/1916) 由[@nicobailon](https://github.com/nicobailon)提交）

### 更改

- 覆盖层合成顺序现在使用焦点顺序，使聚焦的覆盖层渲染在最上层，同时保留堆叠语义以维持显示/隐藏行为（[#1916](https://github.com/badlogic/pi-mono/pull/1916) 由[@nicobailon](https://github.com/nicobailon)提交）

### 修复

- 修复了自动焦点恢复，使其跳过非捕获覆盖层，并修复了`hideOverlay()`，使其仅在弹出的覆盖层原本拥有焦点时才重新分配焦点（[#1916](https://github.com/badlogic/pi-mono/pull/1916) 由[@nicobailon](https://github.com/nicobailon)提交）

## [0.56.3] - 2026-03-06

### 增加了

- 增加了当Kitty键盘协议不可用时，xterm modifyOtherKeys模式的2级回退，使tmux中支持修改后的回车键（Shift+Enter、Ctrl+Enter）（[#1872](https://github.com/badlogic/pi-mono/issues/1872)）

## [0.56.2] - 2026-03-05

### 增加了

- 导出了`decodeKittyPrintable()`以从`keys.ts`解码Kitty CSI-u序列为可打印字符

### 修复
- 修复 `Input` 组件在 Kitty 键盘协议激活时（例如 VS Code 1.110+）不接受输入字符的问题，导致模型选择器过滤器忽略按键输入（[#1857](https://github.com/badlogic/pi-mono/issues/1857)）。
- 修复终端调整大小时编辑器/页脚可见性偏移，通过强制在终端宽度或高度变化时进行完整重绘来解决（[#1844](https://github.com/badlogic/pi-mono/pull/1844) 由 [@ghoulr](https://github.com/ghoulr) 提交）。

## [0.56.1] - 2026-03-05

### 修复

- 修复 markdown 引用块渲染，以隔离引用块样式与默认文本样式，防止样式泄漏。

## [0.56.0] - 2026-03-04

### 修复
- 修复了区域指示符符号（例如流式传输中的部分旗帜序列如`🇨`）的TUI宽度计算，以防止换行偏移和微分渲染中出现陈旧字符伪影。
- 修复了Kitty CSI-u处理，使其忽略不支持的修饰符，从而防止仅修饰符事件插入多余的可打印字符（[#1807](https://github.com/badlogic/pi-mono/issues/1807)）
- 修复了单行粘贴性能，通过原子方式插入粘贴文本，而非逐字符插入，从而避免在粘贴过程中重复触发`@`自动补全扫描（[#1812](https://github.com/badlogic/pi-mono/issues/1812)）
- 修复了`visibleWidth()`对通用OSC转义序列的处理，包括OSC 133语义提示标记，防止终端发出语义区标记时出现宽度漂移（[#1805](https://github.com/badlogic/pi-mono/issues/1805)）
- 修复了markdown块引用导致嵌套列表内容丢失的问题，通过将块引用子元素渲染为块级令牌来解决（[#1787](https://github.com/badlogic/pi-mono/issues/1787)）

## [0.55.4] - 2026-03-02

## [0.55.3] - 2026-02-27

## [0.55.2] - 2026-02-27

## [0.55.1] - 2026-02-26

### 修复

- 修复了Windows VT输入初始化在ESM中的问题，通过加载`koffi`至`createRequire`，恢复VT输入模式，同时保持`koffi`外部化，避免编译进二进制文件（[#1627](https://github.com/badlogic/pi-mono/pull/1627) 由[@kaste](https://github.com/kaste)提交）

## [0.55.0] - 2026-02-24

## [0.54.2] - 2026-02-23

## [0.54.1] - 2026-02-22

### 修复

- 将koffi导入从顶层改为动态require至`enableWindowsVTInput()`，防止bun将所有18个平台`.node`文件（约74MB）嵌入到每个编译二进制文件中。koffi仅在Windows系统上需要。
## [0.54.0] - 2026-02-19

## [0.53.1] - 2026-02-19

## [0.53.0] - 2026-02-17

## [0.52.12] - 2026-02-13

## [0.52.11] - 2026-02-13

## [0.52.10] - 2026-02-12

### 已添加
- 在`TUI`（`addInputListener`和`removeInputListener`）中添加了终端输入监听器，以便调用者可以在组件处理之前拦截、转换或消费原始输入。
### 已修复

- 已修复 `@` 模糊匹配自动补全，根据路径段和前缀评分，减少嵌套路径的无关匹配 [#1423](https://github.com/badlogic/pi-mono/issues/1423)

## [0.52.9] - 2026-02-08
## [0.52.8] - 2026-02-07

### 添加
- 将 `pasteToEditor` 添加到 `EditorComponent` API 中，以支持程序化粘贴功能（[#1351](https://github.com/badlogic/pi-mono/pull/1351) 由 [@kaofelix](https://github.com/kaofelix) 提交）
- 增加了输入组件的杀环（Ctrl+k/Ctrl+y/Alt+y）和撤销（Ctrl+z）支持（[#1373](https://github.com/badlogic/pi-mono/pull/1373)由[@Perlence](https://github.com/Perlence)提交）
## [0.52.7] - 2026-02-06

## [0.52.6] - 2026-02-05

## [0.52.5] - 2026-02-05

## [0.52.4] - 2026-02-05

## [0.52.3] - 2026-02-05

## [0.52.2] - 2026-02-05

## [0.52.1] - 2026-02-05

## [0.52.0] - 2026-02-05

## [0.51.6] - 2026-02-04

### 已更改
- 命令行菜单现在即使其他行有内容，也会在第一行触发，允许将命令前置到现有文本中（[#1227](https://github.com/badlogic/pi-mono/pull/1227) 由 [@aliou](https://github.com/aliou) 提交）

### 修复

- 修复 `/settings` 在窄终端中崩溃的问题，通过处理设置列表中的小宽度实现（[#1246](https://github.com/badlogic/pi-mono/pull/1246) 由 [@haoqixu](https://github.com/haoqixu) 提交）

## [0.51.5] - 2026-02-04

## [0.51.4] - 2026-02-03

### 修复

- 修复输入滚动以避免拆分表情序列（[#1228](https://github.com/badlogic/pi-mono/pull/1228) 由 [@haoqixu](https://github.com/haoqixu) 提交）

## [0.51.3] - 2026-02-03

## [0.51.2] - 2026-02-03

### 新增

- 新增 `Terminal.drainInput()`，在退出前先清空标准输入（防止 Kitty 键释放事件通过慢速 SSH 泄漏）

### 修复

- 修复 Kitty 键释放事件通过慢速 SSH 连接泄漏到父 shell 的问题，通过最多清空标准输入 1 秒实现（[#1204](https://github.com/badlogic/pi-mono/issues/1204)）

- 修复编辑器中的旧版换行处理，以保持之前的换行行为
- 修复自动补全以包含隐藏路径
- 修复提交回退以尊重已配置的快捷键绑定

## [0.51.1] - 2026-02-02

### 新增

- 新增`PI_DEBUG_REDRAW=1`环境变量用于调试完整重绘（日志触发`~/.pi/agent/pi-debug.log`）

### 更改

- 终端高度变化不再触发完整重绘，减少缩放时的闪烁
- `clearOnShrink`现在默认为`false`（使用`PI_CLEAR_ON_SHRINK=1`或`setClearOnShrink(true)`启用）

### 修复

- 修复Input组件中的emoji光标定位（[#1183](https://github.com/badlogic/pi-mono/pull/1183) 由 [@haoqixu](https://github.com/haoqixu) 提交）

- 修复在内容先前已收缩后追加多行时不必要的完整重绘（视口检查现在使用实际先前内容大小而不是过期的最大值）
- 修复Ctrl+D退出时因stdin缓冲区竞争条件关闭父SSH会话（[#1185](https://github.com/badlogic/pi-mono/issues/1185)）

## [0.51.0] - 2026-02-01

## [0.50.9] - 2026-02-01

## [0.50.8] - 2026-02-01

### 新增

- 新增垂直光标导航的粘性列跟踪，以便编辑器在跨短行移动时恢复首选列。 ([#1120](https://github.com/badlogic/pi-mono/pull/1120) 由 [@Perlence](https://github.com/Perlence) 提交)

### 修复

- 修复Kitty键盘协议基础布局回退，使非QWERTY布局不会触发错误快捷键（[#1096](https://github.com/badlogic/pi-mono/pull/1096) 由 [@rytswd](https://github.com/rytswd) 提交）

## [0.50.7] - 2026-01-31

## [0.50.6] - 2026-01-30

### 更改

- 优化`isImageLine()`与`startsWith`的短路处理，以实现更快的图像行检测

### 修复

- 修复内容收缩时（例如关闭`/tree`，清空多行编辑器）下方出现空行的问题（[#1095](https://github.com/badlogic/pi-mono/pull/1095) 由 [@marckrenn](https://github.com/marckrenn) 提交）
- 修复通过`stop()`退出TUI时，终端光标在渲染挂起时仍保持隐藏（[#1099](https://github.com/badlogic/pi-mono/pull/1099) 由 [@haoqixu](https://github.com/haoqixu) 提交）

## [0.50.5] - 2026-01-30

### 修复

- 修复`isImageLine()`，检查图像转义序列时不再仅限于行首。这可防止渲染包含图像数据的行时出现TUI崩溃。 ([#1091](https://github.com/badlogic/pi-mono/pull/1091) 由 [@zedrdave](https://github.com/zedrdave) 提交)

## [0.50.4] - 2026-01-30

### 新增

- 新增Ctrl+B和Ctrl+F作为光标单词左/右导航的替代快捷键（[#1053](https://github.com/badlogic/pi-mono/pull/1053) 由 [@ninlds](https://github.com/ninlds) 提交）
- 新增字符跳转导航：Ctrl+]向前跳转到下一个字符，Ctrl+Alt+]向后跳转（[#1074](https://github.com/badlogic/pi-mono/pull/1074) 由 [@Perlence](https://github.com/Perlence) 提交）
- 编辑器在按下Up键时跳转到第一可视行的行首，按下Down键时跳转到最后一可视行的行尾（[#1050](https://github.com/badlogic/pi-mono/pull/1050) 由 [@4h9fbZ](https://github.com/4h9fbZ) 提交）

### 更改

- 优化图像行检测和盒子渲染缓存以提升性能（[#1084](https://github.com/badlogic/pi-mono/pull/1084) 由 [@can1357](https://github.com/can1357) 提交）

### 修复

- 修复带空格路径的自动补全，支持引号路径令牌（[#1077](https://github.com/badlogic/pi-mono/issues/1077)）
- 修复引号路径补全以避免自动补全时重复添加结束引号（[#1077](https://github.com/badlogic/pi-mono/issues/1077)）

## [0.50.3] - 2026-01-29

## [0.50.2] - 2026-01-29

### 新增

- 新增`autocompleteMaxVisible`选项至`EditorOptions`，带getter/setter方法用于可配置的自动补全下拉高度（[#972](https://github.com/badlogic/pi-mono/pull/972) 由 [@masonc15](https://github.com/masonc15) 提交）
- 新增`alt+b`和`alt+f`作为单词导航（`cursorWordLeft`，`cursorWordRight`）和`ctrl+d`的`deleteCharForward`的替代快捷键（[#1043](https://github.com/badlogic/pi-mono/issues/1043) 由 [@jasonish](https://github.com/jasonish) 提交）
- 编辑器在强制文件自动补全且仅有一个匹配项时自动应用单个建议（[#993](https://github.com/badlogic/pi-mono/pull/993) 由 [@Perlence](https://github.com/Perlence) 提交）

### 更改

- 改进`extractCursorPosition`性能：反向扫描行，光标在视口上方时提前退出，并限制扫描范围至终端底部高度（[#1004](https://github.com/badlogic/pi-mono/pull/1004) 由 [@can1357](https://github.com/can1357) 提交）
- 自动补全改进：更好地处理部分匹配和边缘情况（[#1024](https://github.com/badlogic/pi-mono/pull/1024) 由 [@Perlence](https://github.com/Perlence) 提交）

### 修复
-  修复了反斜杠输入缓冲区导致编辑器和输入组件中字符显示延迟的问题（[#1037](https://github.com/badlogic/pi-mono/pull/1037) 由 [@Perlence](https://github.com/Perlence) 提交）
-  修复了Markdown表格渲染，确保行分隔符正确且列宽符合最小要求（[#997](https://github.com/badlogic/pi-mono/pull/997) 由 [@tmustier](https://github.com/tmustier) 提交）

## [0.50.1] - 2026-01-26

## [0.50.0] - 2026-01-26

###  增加了

-  为TUI类增加了`fullRedraws`只读属性，用于跟踪全屏重绘
-  为`PI_TUI_WRITE_LOG`环境变量增加了捕获原始ANSI输出的功能，用于调试

###  修复了

-  修复了追加的行未提交到滚动缓冲区，导致视口填满时早期内容被覆盖的问题（[#954](https://github.com/badlogic/pi-mono/issues/954)）
-  斜杠命令菜单现在仅在编辑器输入为空时触发（[#904](https://github.com/badlogic/pi-mono/issues/904)）
-  居中锚定的覆盖层在终端拉长后重新调整大小时保持垂直居中（[#950](https://github.com/badlogic/pi-mono/pull/950) 由 [@nicobailon](https://github.com/nicobailon) 提交）
-  修复了编辑器多行插入处理和lastAction跟踪（[#945](https://github.com/badlogic/pi-mono/pull/945) 由 [@Perlence](https://github.com/Perlence) 提交）
-  修复了编辑器单词换行以保留光标列（[#934](https://github.com/badlogic/pi-mono/pull/934) 由 [@Perlence](https://github.com/Perlence) 提交）
-  修复了编辑器单词换行使用单次回溯处理空白字符（[#924](https://github.com/badlogic/pi-mono/pull/924) 由 [@Perlence](https://github.com/Perlence) 提交）
-  修复了Kitty图像ID分配和清理，防止模块间图像ID冲突

## [0.49.3] - 2026-01-22

###  增加了

-  为`MarkdownTheme`增加了`codeBlockIndent`属性，用于自定义代码块内容缩进（默认：2个空格）（[#855](https://github.com/badlogic/pi-mono/pull/855) 由 [@terrorobe](https://github.com/terrorobe) 提交）
-  增加了Alt+Delete作为删除单词向前的快捷键（[#878](https://github.com/badlogic/pi-mono/pull/878) 由 [@Perlence](https://github.com/Perlence) 提交）

###  修改了

-  模糊匹配现在对连续匹配评分更高，并对间隙进行更重的惩罚，以提高相关性（[#860](https://github.com/badlogic/pi-mono/pull/860) 由 [@mitsuhiko](https://github.com/mitsuhiko) 提交）

###  修复了

-  自动链接的电子邮件在Markdown输出中不再显示冗余的`(mailto:...)`后缀（[#888](https://github.com/badlogic/pi-mono/pull/888) 由 [@terrorobe](https://github.com/terrorobe) 提交）
-  修复了覆盖层和内容缩小场景下的视口跟踪和光标定位
-  自动补全现在允许搜索包含`/`字符的内容（例如`folder1/folder2`）（[#882](https://github.com/badlogic/pi-mono/pull/882) 由 [@richardgill](https://github.com/richardgill) 提交）
-  `@`文件附件的目录补全不再添加尾随空格，允许继续进入子目录的自动补全

## [0.49.2] - 2026-01-19

## [0.49.1] - 2026-01-18

###  增加了

-  为编辑器增加了Ctrl+-快捷键的撤销支持。撤销会将连续的单词字符合并为一个单位（fish风格）。（[#831](https://github.com/badlogic/pi-mono/pull/831) 由 [@Perlence](https://github.com/Perlence) 提交）
-  增加了对Ctrl+符号键（Ctrl+\, Ctrl+], Ctrl+-）及其Ctrl+Alt变体的旧终端支持。（[#831](https://github.com/badlogic/pi-mono/pull/831) 由 [@Perlence](https://github.com/Perlence) 提交）

## [0.49.0] - 2026-01-17

###  增加了

-  为`showHardwareCursor`增加了getter和setter，用于控制光标可见性，同时保持IME定位活动状态。（[#800](https://github.com/badlogic/pi-mono/pull/800) 由 [@ghoulr](https://github.com/ghoulr) 提交）
-  增加了Emacs风格的kill ring编辑，支持yank和yank-pop快捷键。（[#810](https://github.com/badlogic/pi-mono/pull/810) 由 [@Perlence](https://github.com/Perlence) 提交）
-  在编辑器键映射中增加了旧版Alt+字母处理和Alt+D删除单词向前支持。（[#810](https://github.com/badlogic/pi-mono/pull/810) 由 [@Perlence](https://github.com/Perlence) 提交）

## [0.48.0] - 2026-01-16

###  增加了

-  `EditorOptions`，可选`paddingX`用于水平内容填充，以及`getPaddingX()`/`setPaddingX()`方法（[#791](https://github.com/badlogic/pi-mono/pull/791) 由 [@ferologics](https://github.com/ferologics) 提交）

###  修改了

-  默认禁用硬件光标，以提高终端兼容性。设置`PI_HARDWARE_CURSOR=1`以启用（取代了禁用它的`PI_NO_HARDWARE_CURSOR=1`）。

###  修复了
- 在编辑器中解码 Kitty CSI-u 可打印序列，以便在终端启用 Kitty 键盘协议时，移位符号键（例如 `@`、`?`）能够正常工作。[#779](https://github.com/badlogic/pi-mono/pull/779) 由 [@iamd3vil](https://github.com/iamd3vil) 提交

## [0.47.0] - 2026-01-16

### 不兼容变更

- `Editor` 构造函数现在要求 `TUI` 作为第一个参数：`new Editor(tui, theme)`。这使得当内容超出终端高度时，能够自动实现垂直滚动。[#732](https://github.com/badlogic/pi-mono/issues/732)

### 新增

- 为 `Editor` 和 `Input` 组件添加了硬件光标定位，以支持 IME 功能。终端光标现在会跟随文本光标位置，从而实现 CJK 输入候选窗口的正确放置。[#719](https://github.com/badlogic/pi-mono/pull/719)

- `Focusable` 接口，用于需要硬件光标定位的组件。实现 `focused: boolean`，并在聚焦时在渲染输出中发出 `CURSOR_MARKER`。

- `CURSOR_MARKER` 常量和 `isFocusable()` 类型保护从包中导出

- 编辑器现在支持 Page Up/Down 键（MacBook 上的 Fn+Up/Down）用于滚动大量内容。[#732](https://github.com/badlogic/pi-mono/issues/732)

- 扩展了键位映射的覆盖范围，以提高终端兼容性：增加了 tmux 中 Home/End 键的支持，添加了额外的修饰符组合，并改进了键序列解析。[#752](https://github.com/badlogic/pi-mono/pull/752) 由 [@richardgill](https://github.com/richardgill) 提交

### 修复

- 编辑器不再会在文本超出屏幕高度时损坏终端显示。内容现在会垂直滚动，并显示视口上方和下方的行指示器。最大高度为终端的 30%（最小 5 行）。[#732](https://github.com/badlogic/pi-mono/issues/732)

- `visibleWidth()` 和 `extractAnsiCode()` 现在能够处理 APC 逃逸序列（`ESC _ ... BEL`），修复了包含光标标记字符串的宽度计算和字符串切片问题

- SelectList 现在能够处理多行描述，通过将换行符替换为空格来实现。[#728](https://github.com/badlogic/pi-mono/pull/728) 由 [@richardgill](https://github.com/richardgill) 提交

## [0.46.0] - 2026-01-15

### 修复

- 在支持 Kitty 键盘协议且启用了替代键报告的终端中，Ctrl+C、Ctrl+D 等快捷键现在能够在非拉丁键盘布局（如俄语、乌克兰语、保加利亚语等）下正常工作。[#718](https://github.com/badlogic/pi-mono/pull/718) 由 [@dannote](https://github.com/dannote) 提交

## [0.45.7] - 2026-01-13

## [0.45.6] - 2026-01-13

### 新增

- `OverlayOptions` API 支持使用类似 CSS 的值进行覆盖层定位和尺寸调整：`width`、`maxHeight`、`row`、`col` 可接受数字（绝对值）或百分比字符串（例如 `"50%"`）。也支持 `minWidth`、`anchor`、`offsetX`、`offsetY`、`margin`。[#667](https://github.com/badlogic/pi-mono/pull/667) 由 [@nicobailon](https://github.com/nicobailon) 提交

- `OverlayOptions.visible` 回调用于响应式覆盖层——接收终端尺寸，返回 false 以隐藏。[#667](https://github.com/badlogic/pi-mono/pull/667) 由 [@nicobailon](https://github.com/nicobailon) 提交

- `showOverlay()` 现在返回 `OverlayHandle`，包含 `hide()`、`setHidden(boolean)`、`isHidden()`，以实现程序化可见性控制。[#667](https://github.com/badlogic/pi-mono/pull/667) 由 [@nicobailon](https://github.com/nicobailon) 提交

- 新增导出类型：`OverlayAnchor`、`OverlayHandle`、`OverlayMargin`、`OverlayOptions`、`SizeValue`。[#667](https://github.com/badlogic/pi-mono/pull/667) 由 [@nicobailon](https://github.com/nicobailon) 提交

- `truncateToWidth()` 现在接受可选的 `pad` 参数，以将结果填充空格至正好 `maxWidth`。[#667](https://github.com/badlogic/pi-mono/pull/667) 由 [@nicobailon](https://github.com/nicobailon) 提交

### 修复

- 修复了覆盖层合成崩溃的问题，该问题发生在渲染行数超出终端宽度时，原因是复杂的 ANSI/OSC 序列（例如子代理输出中的超链接）。[#667](https://github.com/badlogic/pi-mono/pull/667) 由 [@nicobailon](https://github.com/nicobailon) 提交

## [0.45.5] - 2026-01-13

## [0.45.4] - 2026-01-13

## [0.45.3] - 2026-01-13

## [0.45.2] - 2026-01-13

## [0.45.1] - 2026-01-13

## [0.45.0] - 2026-01-13

## [0.44.0] - 2026-01-12

### 新增

- `SettingsListOptions` 和 `enableSearch` 用于 `SettingsList` 的模糊过滤。[#643](https://github.com/badlogic/pi-mono/pull/643) 由 [@ninlds](https://github.com/ninlds) 提交

- `pageUp` 和 `pageDown` 支持与 `selectPageUp`/`selectPageDown` 编辑器操作配合使用。[#662](https://github.com/badlogic/pi-mono/pull/662) 由 [@aliou](https://github.com/aliou) 提交

### 修复
- 有序列表项，所有项目均显示为“1.”，当代码块中断列表连续性时（[#660](https://github.com/badlogic/pi-mono/pull/660) 由 [@ogulcancelik](https://github.com/ogulcancelik) 提交）

## [0.43.0] - 2026-01-11

### 增加

- `fuzzyFilter()` 和 `fuzzyMatch()` 用于模糊文本匹配的实用工具
- 斜杠命令自动补全现在使用模糊匹配，而非前缀匹配

### 修复

- 光标在退出时移动到内容末尾，防止状态行被覆盖（[#629](https://github.com/badlogic/pi-mono/pull/629) 由 [@tallshort](https://github.com/tallshort) 提交）
- 每行渲染后重置 ANSI 样式，以防止样式泄漏

## [0.42.5] - 2026-01-11

### 修复

- 仅重新渲染更改的行，以减少闪烁（[#617](https://github.com/badlogic/pi-mono/pull/617) 由 [@ogulcancelik](https://github.com/ogulcancelik) 提交）
- 内容缩小时跟踪光标位置，剩余行未变
- 终端挂起/恢复后，若终端在挂起期间被调整尺寸，TUI 渲染尺寸错误（[#599](https://github.com/badlogic/pi-mono/issues/599)）
- 包含 Kitty 键释放模式的粘贴内容（例如 `:3F` 在 MAC 地址中）被错误过滤（[#623](https://github.com/badlogic/pi-mono/pull/623) 由 [@ogulcancelik](https://github.com/ogulcancelik) 提交）

## [0.42.4] - 2026-01-10

## [0.42.3] - 2026-01-10

## [0.42.2] - 2026-01-10

## [0.42.1] - 2026-01-09

## [0.42.0] - 2026-01-09

## [0.41.0] - 2026-01-09

## [0.40.1] - 2026-01-09

## [0.40.0] - 2026-01-08

## [0.39.1] - 2026-01-08

## [0.39.0] - 2026-01-08

### 增加

- **实验性功能：** 支持 `ctx.ui.custom()` 与 `{ overlay: true }` 选项的叠加合成（[#558](https://github.com/badlogic/pi-mono/pull/558) 由 [@nicobailon](https://github.com/nicobailon) 提交）

## [0.38.0] - 2026-01-08

### 增加

- `EditorComponent` 接口，用于自定义编辑器实现
- `StdinBuffer` 类，用于拆分批量 stdin 为单个序列（参考 [OpenTUI](https://github.com/anomalyco/opentui)，MIT 许可）

### 修复

- 通过 SSH 批量与其他事件一起按下按键时不再丢失（[#538](https://github.com/badlogic/pi-mono/pull/538)）

## [0.37.8] - 2026-01-07

### 增加

- `Component.wantsKeyRelease` 属性，用于启用按键释放事件（默认为 false）

### 修复

- TUI 现在默认过滤按键释放事件，防止编辑器和其他组件中按键重复处理

## [0.37.7] - 2026-01-07

### 修复

- `matchesKey()` 现在正确匹配 Kitty 协议中未修改字母键的序列（用于按键释放事件）

## [0.37.6] - 2026-01-06

### 增加

- 支持 Kitty 键盘协议标志 2 的按键释放事件。新增导出：`isKeyRelease(data)`、`isKeyRepeat(data)`、`KeyEventType` 类型。支持 Kitty 协议的终端（Kitty、Ghostty、WezTerm）现在会发送正确的键释放事件。

## [0.37.5] - 2026-01-06

## [0.37.4] - 2026-01-06

## [0.37.3] - 2026-01-06

## [0.37.2] - 2026-01-05

## [0.37.1] - 2026-01-05

## [0.37.0] - 2026-01-05

### 修复

- 粘贴文本末尾多余空格导致终端宽度超出时通过 Markdown 渲染引发崩溃（[#457](https://github.com/badlogic/pi-mono/pull/457) 由 [@robinwander](https://github.com/robinwander) 提交）

## [0.36.0] - 2026-01-05

## [0.35.0] - 2026-01-05

## [0.34.2] - 2026-01-04

## [0.34.1] - 2026-01-04

### 增加

- 符号键支持：`SymbolKey` 类型，包含 32 个符号键，`Key` 常量（例如 `Key.backtick`、`Key.comma`），更新 `matchesKey()` 和 `parseKey()` 以处理符号输入（[#450](https://github.com/badlogic/pi-mono/pull/450) 由 [@kaofelix](https://github.com/kaofelix) 提交）

## [0.34.0] - 2026-01-04

### 增加

- `Editor.getExpandedText()` 方法，返回已扩展粘贴标记的实际内容（[#444](https://github.com/badlogic/pi-mono/pull/444) 由 [@aliou](https://github.com/aliou) 提交）

## [0.33.0] - 2026-01-04

### 重大变更

- **按键检测函数已移除**：所有 `isXxx()` 按键检测函数（`isEnter()`、`isEscape()`、`isCtrlC()` 等）已移除。改用 `matchesKey(data, keyId)`（例如 `matchesKey(data, "enter")`、`matchesKey(data, "ctrl+c")`）。此变更影响使用 `ctx.ui.custom()` 处理键盘输入的钩子和自定义工具。（[#405](https://github.com/badlogic/pi-mono/pull/405)）

### 增加

- `Editor.insertTextAtCursor(text)` 方法，用于程序化文本插入（[#419](https://github.com/badlogic/pi-mono/issues/419)）
- `EditorKeybindingsManager` 用于可配置的编辑器快捷键绑定。现在组件使用 `matchesKey()` 和快捷键管理器，而不是单独的 `isXxx()` 函数。([#405](https://github.com/badlogic/pi-mono/pull/405) by [@hjanuschka](https://github.com/hjanuschka))

### 已更改

- 快捷键检测已重构：将 `is*()` 函数合并为通用的 `matchesKey(data, keyId)` 函数，该函数可接受如 `"ctrl+c"`、`"shift+enter"`、`"alt+left"` 等快捷键标识符。

## [0.32.3] - 2026-01-03

## [0.32.2] - 2026-01-03

### 已修复

- 斜杠命令自动补全现在会触发以 `.`、`-` 或 `_` 开头的命令（例如 `/.land`、`/-foo`）。([#422](https://github.com/badlogic/pi-mono/issues/422))

## [0.32.1] - 2026-01-03

## [0.32.0] - 2026-01-03

### 已更改

- 编辑器组件现在使用单词换行而不是字符级换行，以提高可读性。([#382](https://github.com/badlogic/pi-mono/pull/382) by [@nickseelert](https://github.com/nickseelert))

### 已修复

- Shift+Space、Shift+Backspace 和 Shift+Delete 现在在 Kitty 协议终端（Kitty、WezTerm 等）中能正常工作，而不是被静默忽略。([#411](https://github.com/badlogic/pi-mono/pull/411) by [@nathyong](https://github.com/nathyong))

## [0.31.1] - 2026-01-02

### 已修复

- `visibleWidth()` 现在会剥离 OSC 8 链接序列，修复了可点击链接的文本换行问题。([#396](https://github.com/badlogic/pi-mono/pull/396) by [@Cursivez](https://github.com/Cursivez))

## [0.31.0] - 2026-01-02

### 已添加

- `isShiftCtrlO()` 快捷键检测函数，用于 Shift+Ctrl+O（Kitty 协议）
- `isShiftCtrlD()` 快捷键检测函数，用于 Shift+Ctrl+D（Kitty 协议）
- `TUI.onDebug` 回调函数，用于全局调试快捷键处理（Shift+Ctrl+D）
- `wrapTextWithAnsi()` 工具现在导出（将文本换行到指定宽度，保留 ANSI 代码）

### 已更改

- README.md 完全重写，包含准确的组件文档、主题接口和示例
- `visibleWidth()` 重新实现，基于图形单位的宽度计算，Bun 上快 10 倍，Node 上快约 15%。([#369](https://github.com/badlogic/pi-mono/pull/369) by [@nathyong](https://github.com/nathyong))

### 已修复

- Markdown 组件现在会将 HTML 标签渲染为纯文本，而不是静默丢弃它们。([#359](https://github.com/badlogic/pi-mono/issues/359))
- 在 `visibleWidth()` 和图形单位迭代中遇到未定义代码点时不会崩溃。([#372](https://github.com/badlogic/pi-mono/pull/372) by [@HACKE-RC](https://github.com/HACKE-RC))
- WJ 表情序列（彩虹旗、家庭等）现在会正确渲染宽度，而不是被拆分成多个字符。([#369](https://github.com/badlogic/pi-mono/pull/369) by [@nathyong](https://github.com/nathyong))

## [0.29.0] - 2025-12-25

### 已添加

- **粘贴文件路径前自动加空格**：当粘贴以 `/`、`~` 或 `.` 开头的文件路径，并且光标在单词字符后时，会自动在前面加空格以提高可读性。适用于从 macOS 拖拽截图时。([#307](https://github.com/badlogic/pi-mono/pull/307) by [@mitsuhiko](https://github.com/mitsuhiko))
- **输入组件的单词导航**：已添加 Ctrl+Left/Right 和 Alt+Left/Right 支持，实现单词级光标移动。([#306](https://github.com/badlogic/pi-mono/pull/306) by [@kim0](https://github.com/kim0))
- **完整的 Unicode 输入**：输入组件现在可以接受超出 ASCII 的 Unicode 字符。([#306](https://github.com/badlogic/pi-mono/pull/306) by [@kim0](https://github.com/kim0))

### 已修复

- **类 Readline 的 Ctrl+W**：现在会跳过删除前单词前的尾部空格，符合标准 readline 行为。([#306](https://github.com/badlogic/pi-mono/pull/306) by [@kim0](https://github.com/kim0))

