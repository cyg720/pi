# 终端用户界面

`@earendil-works/pi-tui`提供了Pi终端组件系统所使用的组件。扩展在需要内置对话框、通知、状态文本和小部件无法满足交互需求时使用它。

从[扩展](extensions.md#interact-with-the-user)的`ctx.ui`方法开始。仅在UI需要自己的渲染、键盘或鼠标输入、焦点、布局或生命周期时才创建自定义组件。

## 选择集成点

| 需求                     | 使用                                                         |
|-------------------------|--------------------------------------------------------------|
| 选择、确认、输入或多行编辑器 | `ctx.ui.select()`、`confirm()`、`input()`或`editor()` |
| 非阻塞反馈               | `ctx.ui.notify()`或`setStatus()`                           |
| 编辑器附近持久内容       | `ctx.ui.setWidget()`                                            |
| 替换页眉、页脚或编辑器   | 对应的`ctx.ui`组件工厂                               |
| 临时交互屏幕或覆盖层     | `ctx.ui.custom()`                                            |
| 工具或会话入口的自定义渲染 | 扩展渲染器                                                   |

这些API会接收Pi的活动主题和必要的快捷键。不要在扩展内部创建第二个终端渲染器。

## 理解组件模型

组件为可用宽度渲染一组终端行。它可选地处理键盘和鼠标输入，并且当其状态或主题相关的内容发生变化时，必须使缓存的输出失效。

每条渲染的行必须适合提供的宽度。测量可见终端列而不是字符串长度，因为ANSI转义序列、宽字符、表情符号和组合字符会改变显示宽度。

使用`visibleWidth()`、`truncateToWidth()`、`sliceByColumn()`和`wrapTextWithAnsi()`，而不是自己实现终端宽度处理。Pi在每行之后重置样式和超链接，因此必须在每行渲染时重新应用样式。

更改组件状态后，使受影响的组件失效，并调用注入的`tui.requestRender()`。TUI会合并渲染请求并更新终端。

## 组合内置组件

该包包括常见布局和控件的组件：

- `Text`、`Markdown`、`Image`和`TruncatedText`渲染内容。
- `Container`、`VStack`、`HStack`、`Box`和`Spacer`组合布局。
- `Input`和`Editor`接受文本。
- `SelectList`和`SettingsList`实现可搜索的选择和设置流程。
- `ScrollView`提供有边界的可滚动视口。
- `Loader`和`CancellableLoader`报告正在进行的工作。
- `MouseRegion`为另一个组件添加指针行为。

优先使用这些组件而不是重建选择、滚动、文本编辑或宽度处理。扩展示例展示了如何将它们与Pi的边框和主题结合使用。

## 处理键盘输入和焦点

使用`matchesKey()`和`Key`处理终端键盘输入。解析器考虑了支持的终端协议和键修饰符。扩展组件应使用注入的`KeybindingsManager`进行可配置的应用程序操作。

显示文本光标的组件应实现`Focusable`，并立即将`CURSOR_MARKER`放置在其视觉光标之前。TUI使用该标记来为输入法编辑器定位硬件光标。

包裹`Input`或`Editor`的容器必须将其`focused`状态传递给子组件。如果不传递，中文、日文、韩文及其他IME候选项窗口可能会出现在错误的屏幕位置。

在替换主编辑器时扩展Pi的`CustomEditor`。它保留了应用程序快捷键和代理控制。

将你不拥有的编辑器的键转发到基础实现，并通过清除自定义编辑器工厂来恢复默认设置。

## 处理鼠标输入

全屏模式将标准化的鼠标事件路由到组件。处理程序可以标记事件已处理、捕获拖动序列、请求焦点或请求渲染。

未处理的滚轮事件会滚动最近的`ScrollView`。未处理的主按钮拖动仍可用于转录选择。OSC 8链接优先于包含的点击区域。

常规模式将鼠标输入留给终端，因为终端拥有滚动缓存。即使全屏鼠标输入可用，也要为每个交互设计键盘路径。
## 使用自定义屏幕和覆盖层

`ctx.ui.custom()`暂时将一个组件的交互区域控制权交给该组件，并在该组件调用提供的完成回调时恢复。

将`overlay: true`传递给draw，以在现有内容之上绘制。覆盖层选项控制大小、锚点、偏移量、边距和响应式可见性。覆盖层句柄可以在交互保持激活时，通过`setHidden()`改变焦点或暂时隐藏和显示覆盖层。

聚焦的覆盖层在普通渲染过程中会保持输入所有权。如果希望在覆盖层仍可见时将输入交给其他组件，应通过句柄显式释放或重定向焦点。

将每个自定义组件实例视为属于一个交互。在重新开始该交互时，创建新的实例。

通过传递给组件工厂的完成回调结束交互。它会解析`ctx.ui.custom()`的承诺并释放组件。不要对`ctx.ui.custom()`创建的覆盖层调用`OverlayHandle.hide()`。

有关定位、堆叠、焦点、响应式可见性和动画行为，请参见[`overlay-qa-tests.ts`](../examples/extensions/overlay-qa-tests.ts)。

## 正确应用主题

使用传递给扩展或组件回调的主题。主题助手会为语义颜色（如强调色、淡化文本、成功、警告、错误、工具输出和Markdown）生成ANSI样式字符串。

使用`theme.style()`将前景和背景颜色与文本属性结合：

```typescript
return new Text(
  theme.style("Done!", {
    fg: "success",
    bg: "toolSuccessBg",
    bold: true,
  }),
  0,
  0,
);
```

一种样式颜色可以是语义主题标记或具体的`Color`。接受作为`fg`的前景标记和作为`bg`的背景标记；若要将标记的颜色用于另一个位置，请传递其具体颜色，例如`{ fg: theme.colors.userMessageBg }`。通过`theme.colors`访问具体颜色，并在需要进行颜色计算时使用`@earendil-works/pi-tui`中的实用工具`mixColors()`。如果主题将某些标记设置为终端默认颜色，这些标记将使用终端自身的颜色渲染；`theme.colors`会报告终端宣布的颜色，或在终端未宣布时的猜测。使用`theme.appearance`（`"dark"`或`"light"`）决定，例如，是将颜色变亮还是变暗。Pi会根据终端能力将结果转换为真彩色或256色输出。主题标记每次主题转换时只转换一次；尽可能在渲染路径之外计算具体颜色。

现有的`theme.fg()`和`theme.bg()`助手仍可用于应用单个语义颜色。

除非`invalidate()`重建，否则不要永久存储带有主题颜色的字符串。主题变更会清除渲染缓存，但无法移除已嵌入应用状态中的旧ANSI颜色。

在渲染期间评估的主题回调无需特殊重建。无状态组件也可以在每次渲染时计算主题输出。

使用[Themes](themes.md)创建终端调色板。在渲染应与当前应用主题匹配的Markdown时，使用Pi的`getMarkdownTheme()`。

## 保持渲染响应式

渲染运行在交互路径上。通过宽度和内容缓存昂贵的布局和高亮工作，然后通过`invalidate()`清除该缓存。

保持默认视图紧凑，并通过扩展或专用屏幕揭示详细信息。对于自定义工具渲染，处理部分结果并在安全的情况下复用之前的组件。

使用`PI_TUI_WRITE_LOG`捕获原始ANSI流以诊断渲染问题。测试窄宽度、宽字符、重置事件、主题变更、焦点过渡以及常规模式和全屏模式。

## 示例和源码

已检查的扩展示例覆盖了主要模式：

- [`preset.ts`](../examples/extensions/preset.ts)和[`tools.ts`](../examples/extensions/tools.ts)使用选择和设置列表。
- [`qna.ts`](../examples/extensions/qna.ts)使用可取消的异步UI。
- [`modal-editor.ts`](../examples/extensions/modal-editor.ts)替换编辑器。
- [`custom-footer.ts`](../examples/extensions/custom-footer.ts)替换页脚。
- [`widget-placement.ts`](../examples/extensions/widget-placement.ts)在编辑器周围放置持久内容。
- [`doom-overlay/`](../examples/extensions/doom-overlay/)演示了连续渲染的覆盖层。

公共导出定义在[`packages/tui/src/index.ts`](https://github.com/earendil-works/pi/blob/main/packages/tui/src/index.ts)。有关扩展生命周期、状态、工具、事件和模式行为，请参见[Extensions](extensions.md)。

