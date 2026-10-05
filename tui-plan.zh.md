# 替代屏幕布局系统计划

## 目的

为`TuiAltScreen`实现受约束的布局系统，并用其保持编码代理转录内容的可滚动性，同时将待办/状态/小部件/编辑器/页脚区域固定在底部。

本文件为实现交接文档。它记录了设计讨论中做出的决策，除非实现过程中有新发现，否则应视为预期范围。

## 核心决策

1. 该受约束的布局系统是一个替代屏幕功能。
2. `TuiMainScreen`保持其现有的终端滚动回显渲染模型。
3. 交互模式使用两种不同的组合，但共享相同的组件实例和行为。
4. 公开的布局原语最初包括：
   - `VStack`
   - `HStack`
   - `ScrollView`
   - 现有叠加层
5. 帧特定的布局树为内部结构。API用户构建组件树，但绝不操作布局框、矩形、点击测试节点或滚动祖先。
6. 每次请求渲染时重建内部布局树。不重建组件状态。
7. 依赖现有的叶子渲染缓存，尤其是`Markdown`、`Text`、`Image`和`Box`。最初不引入第二层框架级渲染缓存。
8. `Editor`目前不缓存其渲染的行，但它体积小且活跃；这预计不会成为主要成本。
9. 保持`interactive-mode.ts`的变更声明式且简洁。布局、裁剪、滚动、点击测试和事件路由应保留在`packages/tui`中。
10. 鼠标滚轮支持为增强功能。始终必须提供可配置的键盘滚动。

## 为什么主屏幕和替代屏幕布局不同

终端在主屏幕模式下拥有滚动功能。应用程序无法可靠提供：

- 粘性行
- 可独立滚动的嵌套区域
- 全高度并排面板
- 终端滚动回显中移动内容的可靠鼠标点击测试
- 任意重绘离屏区域而不重播或清除滚动回显

因此，不要假装`TuiMainScreen`具有相同的受约束视口语义。

主屏幕交互模式仍为垂直渲染的文档：

```text
header
loaded resources
chat
pending messages
status
widgets above
editor / replacement UI
widgets below
footer
```

替代屏幕交互模式变为：

```text
┌─────────────────────────────────────────────┐
│ scrollable transcript                       │
│                                             │
│ header                                      │
│ loaded resources                            │
│ chat/messages/tool output                   │
│                                             │
├─────────────────────────────────────────────┤
│ pending messages                            │
│ working/retry/compaction status             │
│ widgets above editor                        │
│ editor or temporary replacement UI          │
│ widgets below editor                        │
│ footer                                      │
└─────────────────────────────────────────────┘
```

待办消息和状态应位于固定区域。在用户阅读较旧输出时隐藏活动队列/工作状态会令人惊讶。

## 目标

### 第一版实现所需

- `TuiAltScreen`中的受约束根布局。
- 垂直和水平堆叠布局。
- 垂直滚动及跟随末尾行为。
- 粘性编码代理停靠区。
- 现有鼠标滚轮和键盘转录滚动。
- 基于指针所处区域的滚轮路由。
- 嵌套滚动视图的滚动链。
- 现有叠加层渲染必须继续工作。
- 现有光标定位和输入法支持必须继续工作。
- 现有超链接点击和鼠标文本选择必须继续工作。
- 现有Kitty图像行为在转录用例中不得退化。
- `TuiMainScreen`行为和输出顺序必须保持不变。
- 退出alt模式时仍需打印完整的逻辑最终文档。

### 设计启用的未来用途

- 宽终端侧边栏。
- 可独立滚动的转录和侧边栏。
- 粘性顶部区域。
- 布局感知叠加层。
- 滚动条和未读行指示器。
- 转录虚拟化。

## 第一版实现不目标

- 与CSS兼容的弹性盒子。
- 网格布局。
- 换行弹性行。
- 任意绝对定位；叠加层已满足此需求。
- 除非自然从现有尺寸工具得出，否则不支持百分比尺寸。
- 转录渲染虚拟化。
- 增量布局树突变。
- 为自定义组件提供公共API，用于创建或突变内部布局节点。
- 重构所有现有组件，以理解高度约束。
- 为主屏幕模式提供虚假的粘性或嵌套滚动语义。

## 公共API

### 堆栈条目

为垂直和水平堆栈使用一种轴中立的条目类型。

```ts
export interface StackEntryOptions {
	/** Initial size on the stack's main axis. Defaults to "auto". */
	basis?: number | "auto";
	/** Share of positive remaining space. Defaults to 0. */
	grow?: number;
	/** Relative willingness to shrink when content overflows. Defaults to 1. */
	shrink?: number;
	/** Minimum allocated size on the main axis. Defaults to 0. */
	minSize?: number;
	/** Maximum allocated size on the main axis. */
	maxSize?: number;
	/** Conditionally omit this entry for a viewport size. */
	visible?: (viewport: { width: number; height: number }) => boolean;
}

export interface StackEntry extends StackEntryOptions {
	component: Component;
}

export type StackChild = Component | StackEntry;

export interface StackOptions {
	gap?: number;
	align?: "stretch" | "start" | "center" | "end";
}
```

在实现中使用显式字段。不要使用TypeScript参数属性，因为根配置源必须在Node仅剥离模式下保持可擦除。

### `VStack`

```ts
export class VStack implements Component {
	constructor(children?: StackChild[], options?: StackOptions);

	addChild(component: Component, options?: StackEntryOptions): void;
	removeChild(component: Component): void;
	clear(): void;
	invalidate(): void;
	render(width: number): string[];
}
```

行为：

- 公共`render(width)`提供无界高度渲染，以兼容性和调试目的。
- 受约束行为由`TuiAltScreen`通过内部布局引擎内部调用。
- 子元素从上到下排列。
- `gap`行仅在可见子元素之间出现。
- 交叉轴默认为`stretch`。

### `HStack`

```ts
export class HStack implements Component {
	constructor(children?: StackChild[], options?: StackOptions);

	addChild(component: Component, options?: StackEntryOptions): void;
	removeChild(component: Component): void;
	clear(): void;
	invalidate(): void;
	render(width: number): string[];
}
```

行为：

- 子元素从左到右排列。
- 子元素宽度从`basis`、`grow`、`shrink`、`minSize`和`maxSize`分配。
- 较短的子元素根据`align`进行填充。
- 使用现有ANSI感知的切片/合成工具组合ANSI行。绝不使用纯字符串长度或原始子字符串进行终端列处理。
- 初始图像支持仅需保持当前垂直转录行为。有关水平限制，请参见图像部分。

### `ScrollView`

```ts
export interface ScrollViewOptions {
	axis?: "vertical";
	/** Follow content growth while positioned at the end. */
	follow?: "none" | "end";
	/** Designate this view as the fallback target for global scroll actions. */
	primary?: boolean;
	/** Bubble unused wheel delta to an outer scroll view. */
	overscroll?: "chain" | "contain";
	/** Reserved for a later visible scrollbar implementation. */
	scrollbar?: "hidden" | "auto" | "always";
}

export class ScrollView implements Component {
	constructor(component: Component, options?: ScrollViewOptions);

	get scrollTop(): number;
	get isFollowingEnd(): boolean;

	scrollBy(lines: number): number;
	scrollToStart(): void;
	scrollToEnd(): void;
	invalidate(): void;
	render(width: number): string[];
}
```

`scrollBy()`返回未使用的delta，以便嵌套滚动可以链接：

```ts
const remaining = scrollView.scrollBy(delta);
```

示例：

- 请求`+3`，移动`+3`：返回`0`。
- 请求`+3`，仅剩一行：移动一行并返回`+2`。
- 请求`-3`，已到达顶部：返回`-3`。

行为：

- 在受约束布局中，子元素以无界高度测量/渲染，并裁剪到分配的视口。
- 在公共无界`render(width)`中，渲染完整子元素。这对于最终文档输出和调试是必需的，而不是在主屏幕模式下模拟视口行为。
- `follow: "end"`的行为类似于当前`TuiAltScreen.stickToBottom`：
  - 开始跟随模式
  - 内容增长保持视图在末尾
  - 远离末尾的滚动禁用跟随模式
  - 到达或明确滚动到末尾启用跟随模式
- 滚动必须请求渲染。
- 当视口高度变化时，保持`scrollTop`，除非正在跟随末尾。

### 视口能力

不要向每个`TUI`实现添加受约束布局方法，仿佛主屏幕模式支持它们。

添加一个显式能力：

```ts
export interface ViewportTUI extends TUI {
	setLayoutRoot(component: Component | undefined): void;
}

export function isViewportTUI(tui: TUI): tui is ViewportTUI;
```

`TuiAltScreen`实现`ViewportTUI`。`TuiMainScreen`不实现。

类型守卫应测试稳定的能力，而不是依赖应用级`instanceof`。具体实现可能使用符号或方法存在检查。

`TuiAltScreen`当没有显式布局根设置时的行为必须与当前`addChild()`用户保持兼容。将其现有子元素视为隐式垂直堆叠文档，位于隐式主`ScrollView`中。

## 内部布局API

不要从`packages/tui/src/index.ts`导出这些类型。

建议模块：`packages/tui/src/layout.ts`。

```ts
interface LayoutConstraints {
	width: number;
	/** Undefined means unbounded height. */
	height: number | undefined;
}

interface LayoutRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface LayoutBox {
	component: Component;
	rect: LayoutRect;
	clip: LayoutRect;
	children: LayoutBox[];
	parent?: LayoutBox;
	/** Leaf-rendered lines. Keep the returned array by reference. */
	lines?: readonly string[];
	/** Present when this box represents a ScrollView viewport. */
	scrollView?: ScrollView;
	/** Z/layer ordering for hit testing when needed. */
	layer: number;
}

interface LayoutFrame {
	root: LayoutBox;
	width: number;
	height: number;
	lines: string[];
	primaryScrollView?: ScrollView;
}
```

确切形状可能在实现过程中改变，但必须支持：

- 绘制可见终端行
- 裁剪嵌套子元素
- 从终端坐标进行点击测试
- 转换为组件本地坐标
- 遍历祖先
- 识别滚动祖先
- 定位光标标记
- 保留足够的映射以供选择和超链接使用

### 组件树与布局树

公共组件树是持久且有状态的：

```text
VStack
├─ ScrollView
│  └─ chat container
└─ dock VStack
   ├─ editor container
   └─ footer container
```

内部布局树是瞬时帧快照：

```text
box root       rect 0,0,120,40
├─ scroll box  rect 0,0,120,31 clip 0,0,120,31
│  └─ content  rect 0,-85,120,116
└─ dock box    rect 0,31,120,9
```

重建每个请求帧的布局树。在成功绘制后，原子替换已提交的帧，以确保输入始终路由到最后显示的几何结构。

不要仅为了生成布局几何结构而突变组件状态，除非是故意的`ScrollView`约束/跟随状态。

## 渲染和缓存策略

### 重建几何结构，重用叶节点线条

一个新帧执行：

```ts
const nextLayout = layout(root, terminalBounds);
const nextScreen = paint(nextLayout);
writeScreenDiff(previousScreen, nextScreen);
currentLayout = nextLayout;
```

对于叶组件：

```ts
const lines = component.render(width);
```

通过引用在布局框中保留`lines`。最昂贵的叶节点已经按内容和宽度缓存：

- `Markdown`缓存文本、宽度和渲染的线条。
- `Text`缓存文本、宽度和渲染的线条。
- `Image`缓存宽度和渲染的线条。
- `Box`基于宽度/背景/子输出进行缓存。
- 多个编码代理动画和工具组件有自己的缓存。

`Editor`、`Input`、选择器、页脚和一些小叶节点重新计算。这在初始阶段是可以接受的。

除非性能分析显示需要，否则不要在布局引擎中添加单独的`WeakMap<Component, RenderCache>`。第二个缓存可能会过期，因为现有组件拥有自己的无效语义。

### 尽量避免不必要的扁平化

第一个正确实现可能会调用现有的`Container.render(width)`，该方法会扁平化子数组。Markdown解析/高亮仍然会被缓存，因此这对初始实现是可以接受的。

如果容易且安全，优化确切的基`Container`实例作为结构化的垂直堆栈，以便布局可以保留子线条数组和高度，而无需扁平化整个转录。不要绕过`Container`子类（如消息/工具组件）中重写的渲染。除非它们明确选择内部结构布局，否则将子类视为叶节点。

不要将此优化作为正确性的先决条件。

### 无渲染即无布局

只有在`requestRender()`调度渲染后才重建布局帧。不存在独立的布局循环。

## 堆栈布局算法

实现应使用一个共享堆栈分配器，参数化为轴。
### 可见性

1. 根据终端视口尺寸评估`visible`。
2. 在计算间隙或大小分布前，移除不可见条目。

### 固有尺寸

- `basis: "auto"`在主轴上使用子元素的固有尺寸。
- 数字`basis`使用给定的单元格数量。
- 将基准限制为`minSize`/`maxSize`。
- 对于换行叶子节点，宽度分配必须在固有高度已知之前进行。
- `HStack`因此在测量子元素高度之前先分配宽度。
- `VStack`在分配宽度后，才渲染/测量自动高度的子元素，然后分配剩余高度。

### 正剩余空间

将正剩余空间按`grow > 0`分配给条目，比例为`grow`，同时遵守`maxSize`。

采用确定性整数舍入法。将剩余单元格按子元素顺序分配，以避免布局在帧间抖动。

### 溢出

当总基准超过可用尺寸时：

1. 计算可缩小的条目（`shrink > 0`且当前尺寸超过`minSize`）。
2. 按`shrink`和当前基准的比例，或另一项确定性文档政策，分配所需缩小比例。
3. 如果条目在溢出解决前达到`minSize`，重复上述步骤。
4. 如果约束仍无法满足，裁剪至父元素边界。

聚焦光标不应仅因叶子节点被裁剪而消失。当垂直裁剪叶子节点且其行包含`CURSOR_MARKER`时，尽可能选择包含标记的可见行窗口。

### 初始交互式布局尺寸

转录内容应灵活，且停靠栏应优先采用固有高度：

```ts
new VStack([
	{
		component: transcriptScrollView,
		basis: 0,
		grow: 1,
		shrink: 1,
		minSize: 1,
	},
	{
		component: dock,
		basis: "auto",
		grow: 0,
		shrink: 1,
		minSize: 1,
	},
]);
```

实现必须定义对极小终端和超大自定义小部件的合理行为。优先级如下：

1. 终端高度允许时，至少保留一行转录内容。
2. 保留聚焦的编辑器/选择器光标。
3. 至少保留一个页脚行。

4. 在隐藏聚焦编辑器之前，裁剪/截断小部件和待办/状态内容。

这可能需要针对编码代理特定堆栈条目的 `minSize`/`shrink`设置，而不是向通用TUI布局添加域特定优先级规则。

## 绘制

### 框架表面

布局引擎可能继续使用ANSI字符串按终端行处理，而不是引入完整的单元格对象模型。

绘制必须：

- 创建恰好 `terminal.rows` 基础行，受限于alt模式
- 尊重每个框的矩形和累积剪裁
- 使用ANSI感知的列切片
- 在独立绘制的区域之间重置样式
- 保留 `CURSOR_MARKER`，直到提取光标
- 组合水平子元素时避免样式泄漏
- 生成的行宽度不超过终端宽度

重用：

- `sliceByColumn()`
- `compositeTuiLine()`
- `visibleWidth()`
- 已有的行重置规范化

### 垂直堆叠

在分配的 `y` 处绘制每个子元素。跳过不与累积剪裁相交的子元素和行范围。

### 水平堆叠

在分配的 `x` 处绘制每个子元素。在组合相邻子元素之前，将短行填充到分配的宽度。应用重置边界，使一个子元素的样式或OSC 8超链接不会泄漏到另一个子元素。

### 滚动视图

- 子内容按其完整自然高度布局。
- 子元素的绘制原点通过 `-scrollTop` 进行平移。
- 将滚动视图的矩形累积到剪裁中。
- 仅绘制与视口相交的子行。
- 在布局树中记录滚动框，用于点击测试和祖先遍历。

## 输入和事件路由

### 规范化鼠标事件

保持终端鼠标解析在 `TuiAltScreen`，但将解析的序列转换为规范化事件后再路由：

```ts
interface TuiMouseEvent {
	type: "press" | "release" | "move" | "wheel";
	x: number;
	y: number;
	button: number;
	deltaX: number;
	deltaY: number;
}
```

该类型的公共可见性是可选的。初始轮询路由器可以保留在内部。

### 点击测试

对已提交的布局框架进行点击测试，而不是当前正在构建的框架。

1. 拒绝超出其剪裁范围的框。
2. 优先遍历更高层次/最前端的子元素。
3. 返回包含终端坐标的最深层可见框。
4. 保留祖先链以供事件冒泡。

### 滚轮路由

对于滚轮事件：

1. 在指针处进行点击测试。
2. 从最深层的框开始，向根节点遍历。
3. 向每个遇到的 `ScrollView` 提供增量。
4. 如果 `overscroll` 是 `"chain"`，则将未使用的增量传递给下一个滚动祖先。
5. 如果 `overscroll` 是 `"contain"`，则即使增量剩余也不再继续。
6. 如果没有点击祖先消耗增量，则将增量提供给框架的主要滚动视图。
7. 消费已识别的鼠标序列，使原始鼠标字节永远不会到达编辑器。

预期行为：

- 滚轮经过转录区：滚动转录区。
- 滚轮经过未来侧边栏：滚动侧边栏。
- 滚轮经过嵌套滚动视图：滚动内视图，然后在其边界处链式处理。
- 滚轮经过不可滚动的停靠/页脚：滚动主转录区。
- 滚轮交互不应从编辑器窃取键盘焦点。

### 轨迹球

保持当前行为，即忽略仅垂直滚动视图的水平滚轮事件。如果事件包含两个轴，仅消费支持的垂直部分，并记录该策略。

### 鼠标禁用回退

不要依赖检测鼠标支持。终端无法提供足够可靠的通用能力信号。

键盘导航始终可通过现有可配置操作访问：

- `tui.altScreen.pageUp`
- `tui.altScreen.pageDown`
- `tui.altScreen.top`
- `tui.altScreen.bottom`

将这些操作路由到：

1. 如果未来多窗格导航设置了，则路由到显式激活的滚动区域
2. 否则路由到主滚动视图
对于第一个编码代理布局，只有一个滚动视图，因此转录始终是键盘的目标。

如果未来的布局引入多个可键盘选择的滚动区域，请为`TUI_KEYBINDINGS`添加可配置的操作；绝不硬编码按键检查。

## 焦点和光标行为

- 现有的`TUI.setFocus(component)`仍然是公共键盘焦点API。
- 键盘焦点和滚轮滚动目标是分开的。滚动侧边栏时，除非明确请求，否则焦点不应离开编辑器。
- 在绘制过程中，查找最终合成帧中的`CURSOR_MARKER`。
- 光标行/列必须包含堆栈偏移、滚动转换、叠加偏移和水平面板偏移。
- 仅根据现有的`showHardwareCursor`行为显示硬件光标。
- 用于叠加焦点恢复的布局包含检查必须理解布局根和嵌套布局组件。

## 选择和超链接

当前的alt渲染器将选择行直接映射到一个全局逻辑文档。一旦存在固定和水平区域，该假设不再成立。

对于第一个实现，保持屏幕可见区域的选择语义：

- 锚点和焦点从终端屏幕坐标开始。
- 根据当前提交的可见帧应用高亮。
- 使用ANSI感知切片和`stripTerminalSequences()`从选定的可见行/列复制文本。
- 空白/填充区域仅在需要行分隔时才贡献文本。
- 继续将选择列捕捉到图形边界。

如果需要跨帧保持选择，存储足够的源映射以将屏幕行转换为叶行引用。不要将固定停靠行映射到无关的转录行。

点击超链接可以继续从点击列的提交屏幕行读取OSC 8元数据。确保使用最终合成行，而不是未偏移的子行。

保持当前行为：

- 点击无拖动可能调用`openUrl`
- 拖动不会激活URL
- 拖动后释放会通过OSC 52复制

## 图片

初始要求的图片情况是现有的垂直滚动转录。

保持：

- Kitty图片元数据和保留行
- 当Kitty图片顶部超出滚动视口时进行裁剪
- 当包含图片的行更改时进行删除/重绘
- iTerm2的备用文本模式

水平组合图片协议行在第一个实现中不需要完全通用。终端图片放置不像普通ANSI文本。记录并防御性处理该限制：

- 承载图片的`HStack`组件可能需要占用整行/宽度
- 不要静默地破坏相邻面板输出
- 为所选的备用策略添加聚焦测试

不要退化现有的垂直图片测试。

## 叠加层

保持当前的叠加层堆栈和定位API。

初始集成：

1. 将基础受限布局绘制到终端高度的行中。
2. 使用现有叠加逻辑将现有叠加层叠加到这些行上。
3. 从最终结果中提取光标。
4. 应用差异渲染。

现有的叠加层在第一个实现中不需要成为嵌套的`ScrollView`布局根。然而，基础布局的点击测试必须不会破坏叠加层焦点或输入所有权。

后续阶段可以为每个叠加层提供自己的受限布局树，并将叠加层框作为更高层次的点击测试层。

## `TuiAltScreen`重构

建议变更后的状态：

```ts
private layoutRoot?: Component;
private currentLayout?: LayoutFrame;
private implicitScrollView?: ScrollView;
```

将这些职责从`TuiAltScreen`全局字段中移出，并在适用时移入`ScrollView`：

- `scrollTop`
- `contentLineCount`
- `stickToBottom`
兼容性获取器/方法（如 `viewportTop`、`isFollowingOutput`、`scrollBy()`、`scrollToTop()` 和 `scrollToBottom()`）可能会委托给主/隐式滚动视图，以便现有测试和消费者继续正常工作。如果移除这些方法会实质性地使实现复杂化，且没有测试/公共API表明这些方法被依赖，则不要保持向后兼容；移除前请检查导出内容和使用情况。

`doRender()` 变为概念上：

```ts
const root = this.layoutRoot ?? this.getImplicitLegacyRoot();
const nextLayout = layoutConstrained(root, width, height);
let screen = paint(nextLayout);
screen = this.compositeOverlays(screen, width, height);
screen = this.applySelection(screen);
const cursor = this.extractCursorPosition(screen, height);
// Normalize, crop defensive overflow, diff, write.
this.currentLayout = nextLayout;
```

### Legacy 隐式根

当调用者仅使用 `tui.addChild()` 时：

```text
implicit ScrollView(primary, follow=end)
└─ implicit vertical document of TuiAltScreen.children
```

这保持了当前独立的 `TuiAltScreen` API 和测试。

隐式根必须遵循后续 `addChild()`、`removeChild()` 和 `clear()` 的变异。

### 最终文档停止

离开 alt 模式时，应以无界高度渲染显式或隐式根：

- `ScrollView` 会发出其完整子元素，而不是被裁剪的视口。
- 编码代理转录首先出现，然后是 dock。
- 不要打印终端高度的填充行。
- 剥离光标标记。
- 保留现有行重置和图像清理。

不要仅使用最后一个可见帧作为退出文档。

## 交互模式变更

文件：`packages/coding-agent/src/modes/interactive/interactive-mode.ts`

变更应保持较小。

### 添加稳定的分组容器

```ts
private documentContainer: Container;
private footerContainer: Container;
```

现有组件容器保持不变：

- `headerContainer`
- `loadedResourcesContainer`
- `chatContainer`
- `pendingMessagesContainer`
- `statusContainer`
- `widgetContainerAbove`
- `editorContainer`
- `widgetContainerBelow`

构建转录组一次：

```ts
this.documentContainer.addChild(this.headerContainer);
this.documentContainer.addChild(this.loadedResourcesContainer);
this.documentContainer.addChild(this.chatContainer);
```

构建页脚插槽一次：

```ts
this.footerContainer.addChild(this.footer);
```

### 主屏幕合成

保持当前顺序不变：

```ts
this.ui.addChild(this.documentContainer);
this.ui.addChild(this.pendingMessagesContainer);
this.ui.addChild(this.statusContainer);
this.ui.addChild(this.widgetContainerAbove);
this.ui.addChild(this.editorContainer);
this.ui.addChild(this.widgetContainerBelow);
this.ui.addChild(this.footerContainer);
```

因为 `documentContainer` 视觉上是透明的，其三个子元素会像今天一样精确渲染在原位。

### 备用屏幕合成

```ts
const transcript = new ScrollView(this.documentContainer, {
	follow: "end",
	primary: true,
	overscroll: "chain",
});

const dock = new VStack([
	{ component: this.pendingMessagesContainer, shrink: 1, minSize: 0 },
	{ component: this.statusContainer, shrink: 1, minSize: 0 },
	{ component: this.widgetContainerAbove, shrink: 1, minSize: 0 },
	{ component: this.editorContainer, shrink: 1, minSize: 3 },
	{ component: this.widgetContainerBelow, shrink: 1, minSize: 0 },
	{ component: this.footerContainer, shrink: 1, minSize: 1 },
]);

const root = new VStack([
	{ component: transcript, basis: 0, grow: 1, shrink: 1, minSize: 1 },
	{ component: dock, basis: "auto", grow: 0, shrink: 1, minSize: 1 },
]);

viewportTui.setLayoutRoot(root);
```

使用 `isViewportTUI(this.ui)` 进行缩小。由于 `options.alt` 选择了渲染器，未能获取能力是内部编程错误，而非静默降级。

### 自定义页脚替换

重构 `setExtensionFooter()`，使其永远不会移除/添加根 TUI 子元素：

```ts
this.footerContainer.clear();
this.footerContainer.addChild(this.customFooter ?? this.footer);
this.ui.requestRender();
```

继续处理被替换的自定义页脚。

### 无需逻辑变更的功能

- 消息渲染
- 流式更新
- 工具更新
- 小部件 API
- 编辑器替换
- 扩展选择器/输入/编辑器
- 内置选择器
- 队列渲染
- 状态指示器
- 焦点变化
- 叠加层
- 主题失效

这些功能会变异现有稳定的容器，并应自动出现在正确布局中。

### 现有 alt 特定状态临时解决方案

重新审视此代码：

```ts
if (hadActiveStatusIndicator && !this.options.alt && this.ui.getClearOnShrink()) {
	this.statusContainer.addChild(this.idleStatus);
}
```

主屏幕的临时解决方案应仅限主屏幕。受约束的 alt 布局应自然清除已释放的行。

## 建议的文件

可能的新文件：

- `packages/tui/src/layout.ts` — 内部约束、盒子、布局、绘制、点击测试
- `packages/tui/src/components/v-stack.ts`
- `packages/tui/src/components/h-stack.ts`
- `packages/tui/src/components/scroll-view.ts`

可能修改的文件：

- `packages/tui/src/tui.ts`
- `packages/tui/src/tui-alt-screen.ts`
- `packages/tui/src/index.ts`
- `packages/tui/src/keybindings.ts` 仅当需要新的可配置操作时
- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/tui/test/tui-alt-screen.test.ts`
- 在 `packages/tui/test/` 下新增聚焦布局测试
- `packages/coding-agent/test/interactive-tui.test.ts`
- `packages/tui/README.md`
- `packages/coding-agent/docs/usage.md`
- `packages/coding-agent/docs/keybindings.md` 如果键盘行为改变
- `packages/tui/CHANGELOG.md`
- `packages/coding-agent/CHANGELOG.md`

不要修改已发布的变更日志部分。在现有 `## [Unreleased]` 子部分下添加条目。

## 测试计划

### 堆栈分配测试

为两个轴添加聚焦单元测试：

- 自适应大小子元素
- 数值基础
- 正向增长分布
- 缩小分布
- 最小/最大限制
- 确定性奇数单元格舍入
- 仅在可见子元素之间存在间隙
- 条件可见性
- 交叉轴对齐
- 子元素输出宽度超过分配宽度时安全裁剪
- ANSI样式/超链接不会在水平子元素间泄漏
- 水平裁剪中的CJK、emoji和组合字符边界

### ScrollView测试

- 初始`follow: "end"`位置
- 跟随过程中内容增长
- 手动向上滚动时禁用跟随
- 到达底部时重新启用跟随
- 显式`scrollToEnd()`重新启用跟随
- 跟随过程中视口增长/收缩
- 手动定位时视口增长/收缩
- `scrollBy()`返回未使用的正/负增量
- 嵌套滚动链
- `overscroll: "contain"`
- 子元素长度小于视口
- 空子元素
- 子元素宽度变化
- 焦点内容被裁剪时光标标记仍可见

### 布局框架测试

- 为嵌套的垂直/水平堆栈生成矩形
- 累积裁剪
- 点击测试返回最深层可见的盒子
- 被裁剪的盒子不可点击测试
- 局部坐标转换
- 图层排序
- 仅绘制滚动视口中的可见行
- 每个框架在调整大小或内容变化后使用新的几何结构
- 缓存的叶子线数组以引用方式接受且不被修改

### 备用屏幕渲染器测试

扩展`packages/tui/test/tui-alt-screen.test.ts`：

- 遗留的`addChild()`路径仍然遵循当前隐式滚动行为
- 显式布局根渲染终端高度框架
- 固定停靠区在转录内容滚动时保持不变
- 转录视口高度包含停靠区高度
- 跟随过程中停靠区增长/收缩
- 手动滚动时停靠区增长/收缩
- Shift+PageUp/Down目标为主ScrollView
- Ctrl+Home/End目标为主ScrollView
- 在转录内容上滚动时，鼠标滚轮滚动转录内容
- 在不可滚动的停靠区上滚动时，鼠标滚轮回退到主转录内容
- 嵌套滚动消费第一个滚动并冒泡未使用的增量
- 禁用鼠标模式仍支持键盘滚动
- 光标行在停靠区内正确
- 光标行在滚动内容内正确
- 叠加层合成保持屏幕相对
- 叠加层焦点行为保持正确
- OSC 8点击在水平/垂直偏移后仍正确
- 选择/复制在转录内容中正常工作
- 选择/复制在停靠区中正常工作且不映射到转录行
- 终端调整大小时重新计算布局
- 过大的停靠区不会丢失聚焦光标
- 停止打印时，完整转录内容和停靠区恰好打印一次
- 最终输出中没有终端填充行

保留并继续所有现有图像测试：

- Kitty裁剪至视口顶部
- 图像删除/重绘
- iTerm2回退
- 无陈旧图像放置

### 主屏幕回归测试

- 现有主屏幕测试保持不变
- 交互式主屏幕子元素顺序/渲染输出保持不变
- 自定义页脚保持在底部流中
- 主屏幕模式下不安装布局根或应用程序滚动

### 编码代理集成测试

在`packages/coding-agent/test/interactive-tui.test.ts`或聚焦的新测试中：

- 仅在备用模式下暴露渲染器能力
- 主模式挂载流合成
- 备用模式挂载转录ScrollView和停靠区
- 待办/状态/小部件/编辑器/页脚位于停靠区
- 自定义页脚替换更新`footerContainer`
- 编辑器替换不重建根布局
- 小部件更新不重建公共组件合成

优先检查组件合成或使用`VirtualTerminal`；不要使用真实提供者API。

## 验证命令
1. 从相关包根目录运行每个已修改/新聚焦的测试，使用存储库规定的方式调用 Vitest。
2. 从存储库根目录运行 `npm run check` 并修复所有错误、警告和信息。
3. 不要运行 `npm test` 或完整的 Vitest 套件。
4. 如有需要，可选地使用存储库的 `./test.sh` 进行所有非 e2e 测试以进行更广泛的验证。
5. 手动在 tmux 中测试 alt 模式，操作流程见 `AGENTS.md`：
   - 长对话记录
   - 鼠标轨迹/触控板滚动
   - Shift+PageUp/Down
   - 手动滚动时的流式传输
   - 返回底部/跟随
   - 多行编辑器
   - 自动补全打开
   - 设置/模型/树选择器替换编辑器
   - 扩展小部件位于编辑器上方和下方
   - 自定义页脚
   - 终端大小调整
   - 超链接点击
   - 鼠标选择/复制
   - 可用时 Kitty 图像
6. 如有必要，手动对主屏幕模式进行冒烟测试，确保终端回滚行为未发生变化。

## 推荐的实现顺序

1. 增加堆分配单元测试和共享轴分配器。
2. 实现 `VStack` 无界渲染和受限内部布局。
3. 实现 `HStack`，使用 ANSI 安全的合成。
4. 实现 `ScrollView` 状态和单元测试，独立于终端 ANSI 输出。
5. 实现内部布局框架生成和绘制。
6. 增加点击测试和滚动祖先遍历。
7. 将显式和隐式布局根集成到 `TuiAltScreen` 中。
8. 将当前全局 alt 滚动行为置于隐式主 `ScrollView` 兼容路径之后。
9. 逐个子系统保留选择、超链接、光标、覆盖层和图像处理，每一步后运行现有测试。
10. 添加编码代理分组容器和两个小型组合分支。
11. 重构自定义页脚替换，使用 `footerContainer`。
12. 添加集成测试、文档和变更日志条目。
13. 运行聚焦测试和 `npm run check`。
14. 在两种模式下执行 tmux/手动冒烟测试。

## 验收标准

实现完成时：

- 主屏幕模式行为如旧，并保留终端回滚。
- alt 屏幕模式具有可滚动的转录文本和固定的底部停靠栏。
- 流式传输仅在跟随模式激活时跟随转录文本末尾。
- 手动滚动在新输出到达时保持稳定。
- 鼠标滚轮路由到适当的滚动视图并在边界处链式处理。
- 键盘导航在鼠标禁用时仍有效。
- 编辑器/选择器焦点和 IME 光标放置保持正确。
- 小部件和自定义页脚在 alt 模式下保持扩展兼容且固定。
- 超链接、选择、覆盖层和 Kitty 转录图像不出现退化。
- 离开 alt 模式时，一次打印完整的逻辑文档。
- 布局框为内部且按请求的帧重建。
- 昂贵的叶子渲染继续使用现有组件缓存。
- 所有聚焦测试和 `npm run check` 均通过。

