# @earendil-works/pi-tui

最简终端用户界面框架，支持差异渲染和同步输出，适用于无闪烁的交互式命令行应用。

## 功能

- **可互换渲染器**：与主屏幕和备用屏幕实现共享`TUI`接口
- **差异渲染**：仅更新已更改的行或视口行
- **应用自有滚动**：备用屏幕视口支持鼠标、触控板和键盘导航
- **同步输出**：使用CSI 2026进行原子级屏幕更新（无闪烁）
- **括号粘贴模式**：正确处理大段粘贴，并对超过10行的粘贴添加标记
- **组件化**：简单组件接口，带render()方法
- **主题支持**：组件可接受主题接口以实现自定义样式
- **内置组件**：Text、TruncatedText、Input、Editor、Markdown、Loader、SelectList、SettingsList、MouseRegion、Spacer、Image、Box、Container、VStack、HStack、ScrollView
- **内嵌图片**：在支持Kitty或iTerm2图形协议的终端中渲染图片
- **自动补全支持**：文件路径和斜杠命令

## 快速入门

```typescript
import { type TUI, Text, Editor, ProcessTerminal, TuiMainScreen, matchesKey } from "@earendil-works/pi-tui";

// Create terminal
const terminal = new ProcessTerminal();

// Create the default main-screen renderer through the shared TUI interface
const tui: TUI = new TuiMainScreen(terminal);

// Add components
tui.addChild(new Text("Welcome to my app!"));

import { defaultEditorTheme as editorTheme } from './test/test-themes.ts';
const editor = new Editor(tui, editorTheme);
editor.onSubmit = (text) => {
  console.log("Submitted:", text);
  tui.addChild(new Text(`You said: ${text}`));
};
tui.addChild(editor);

// Focus the editor so it receives keyboard input
tui.setFocus(editor);

// In raw mode Ctrl+C doesn't send SIGINT — intercept it here to allow exit
tui.addInputListener((data) => {
  if (matchesKey(data, 'ctrl+c')) {
    tui.stop();
    process.exit(0);
  }
});

// Start
tui.start();
```

## 核心API

### TUI接口和渲染器

`TUI`是组件管理、焦点、覆盖层、输入、生命周期、终端查询和渲染的共享接口。仅在构建应用时选择具体的渲染器：

- `TuiMainScreen`渲染到主终端缓冲区，并保留终端回滚缓冲区。
- `TuiAltScreen`在备用终端缓冲区渲染固定高度视口，并支持应用自有滚动。停止时恢复主缓冲区并打印完整最终文档。

```typescript
import { type TUI, TuiAltScreen, TuiMainScreen } from "@earendil-works/pi-tui";

const tui: TUI = new TuiMainScreen(terminal);
// To use an application-owned viewport in the alternate terminal buffer instead:
// const tui: TUI = new TuiAltScreen(terminal);

tui.addChild(component);
tui.removeChild(component);
tui.start();
tui.stop();
tui.requestRender(); // Request a re-render

// Global debug key handler (Shift+Ctrl+D)
tui.onDebug = () => console.log("Debug triggered");
```

### 颜色和终端样式

颜色是可在终端渲染前转换或混合的值：

```typescript
import {
  colorToRgb,
  foregroundAnsi,
  getTerminalColorMode,
  mixColors,
  parseColor,
  rgbColor,
  styleText,
} from "@earendil-works/pi-tui";

const accent = parseColor("oklch(70% 0.12 220)");
const background = parseColor("#20242a");
const foreground = mixColors(accent, background, 0.2);

const text = styleText(
  "Ready",
  { fg: foreground, bg: background, bold: true },
  getTerminalColorMode(),
);
```

`Color`是索引ANSI颜色、sRGB颜色或OKLCH颜色。每种颜色都可转换为sRGB，因此如`mixColors()`所示的颜色数学始终有效。索引0-15遵循用户终端调色板，因此其sRGB值为近似值。`styleText()`根据请求的终端模式将颜色转换为真彩色或256色输出。

`parseColor()`也接受OKHSL，如`okhsl(250 60% 55%)`所示；`okhslColor()`在代码中构建它，`colorToOkhsl()`可读取任何颜色的OKHSL通道。OKHSL饱和度相对于sRGB色域在该色相和亮度下的最大允许值，因此每个值都在色域内且等饱和度的颜色在不同色相下同样鲜艳。OKHSL颜色创建时会转换为sRGB。

转换不缓存。尤其是超出sRGB色域的OKLCH颜色，转换成本高于sRGB或索引颜色。对于每次渲染都使用的颜色，转换一次并复用结果：

```typescript
const { r, g, b } = colorToRgb(mixColors(accent, background, 0.2));
const foreground = rgbColor(r, g, b); // cheap to render repeatedly
const foregroundCode = foregroundAnsi(foreground, getTerminalColorMode());
```

### 备用屏幕视口布局

`TuiAltScreen`可渲染显式终端高度布局。`VStack`和`HStack`分配受约束的区域，而`ScrollView`拥有一个区域的滚动。这些语义有意在`TuiMainScreen`中不可用，因为终端拥有回滚缓冲区。

```typescript
import {
  Container,
  isViewportTUI,
  ScrollView,
  Text,
  VStack,
} from "@earendil-works/pi-tui";

const transcript = new Container();
transcript.addChild(new Text("History"));

const editorAndFooter = new VStack([
  editor,
  new Text("status"),
]);

if (isViewportTUI(tui)) {
  tui.setLayoutRoot(new VStack([
    {
      component: new ScrollView(transcript, {
        follow: "end",
        primary: true,
        overscroll: "chain",
      }),
      basis: 0,
      grow: 1,
      minSize: 1,
    },
    {
      component: editorAndFooter,
      basis: "auto",
      shrink: 1,
      minSize: 1,
    },
  ]));
}
```

堆栈条目支持 `basis`、`grow`、`shrink`、`minSize`、`maxSize` 和响应 `visible` 回调。鼠标滚轮输入默认将目标定位到指针下方的滚动视图，并将未使用的增量链传递给外层滚动视图。主滚动视图接收键盘导航操作和非滚动区域的滚轮输入。它还可以在 OSC 133 语义提示标记之间跳转，匹配常见终端提示导航快捷键。按 `Ctrl+Shift+F` 可以打开或关闭其边框搜索面板。面板显示已配置的前后快捷键，并提供可点击的箭头控件；默认情况下，`Enter`/`Ctrl+G` 和 `Shift+Enter`/`Ctrl+Shift+G` 用于在匹配项之间切换，`Escape` 也用于关闭搜索。`TuiAltScreenOptions.searchMatchStyle` 和 `searchCurrentMatchStyle` 用于自定义匹配项高亮，`searchNavigationButtonStyle` 用于样式化每个箭头按钮并接收其悬停状态。`TuiAltScreenOptions.scrollToEndIndicator` 渲染一个可点击的标签，位于 `follow: "end"` 主滚动视图最后一行的正中央，当滚动远离末尾时显示；点击它可恢复末尾跟随。

每个请求帧都会重建布局几何结构。状态组件会保留，其已渲染的行缓存仍然有效。直接调用 `render(width)` 会在这些布局组件上生成无边界的文档，该文档也用于 alt 模式恢复主屏幕时。

###  覆叠层

覆叠层会在现有内容之上渲染组件，而不会替换它。适用于对话框、菜单和模态 UI。

```typescript
// Show overlay with default options (centered, max 80 cols)
const handle = tui.showOverlay(component);

// Show overlay with custom positioning and sizing
// Values can be numbers (absolute) or percentage strings (e.g., "50%")
const handle = tui.showOverlay(component, {
  // Sizing
  width: 60,              // Fixed width in columns
  width: "80%",           // Width as percentage of terminal
  minWidth: 40,           // Minimum width floor
  maxHeight: 20,          // Maximum height in rows
  maxHeight: "50%",       // Maximum height as percentage of terminal

  // Anchor-based positioning (default: 'center')
  anchor: 'bottom-right', // Position relative to anchor point
  offsetX: 2,             // Horizontal offset from anchor
  offsetY: -1,            // Vertical offset from anchor

  // Percentage-based positioning (alternative to anchor)
  row: "25%",             // Vertical position (0%=top, 100%=bottom)
  col: "50%",             // Horizontal position (0%=left, 100%=right)

  // Absolute positioning (overrides anchor/percent)
  row: 5,                 // Exact row position
  col: 10,                // Exact column position

  // Margin from terminal edges
  margin: 2,              // All sides
  margin: { top: 1, right: 2, bottom: 1, left: 2 },

  // Responsive visibility
  visible: (termWidth, termHeight) => termWidth >= 100  // Hide on narrow terminals

  // Focus behavior
  nonCapturing: true       // Don't auto-focus when shown
});

// OverlayHandle methods
handle.hide();              // Permanently remove the overlay
handle.setHidden(true);     // Temporarily hide (can show again)
handle.setHidden(false);    // Show again after hiding
handle.isHidden();          // Check if temporarily hidden
handle.focus();             // Focus and bring to visual front
handle.unfocus();           // Release focus to normal fallback
handle.unfocus({ target: baseComponent }); // Release this overlay to a specific component
handle.unfocus({ target: null });   // Release this overlay and leave focus empty
handle.isFocused();         // Check if overlay has focus
handle.getBounds();         // Get last rendered terminal-relative bounds

handle.unfocus();
// Overlay loses focus; TUI falls back to another visible capturing overlay or the previous focus target.

handle.unfocus({ target: null });
// Overlay loses focus; no component receives input until focus is set again.

// A focused visible overlay reclaims keyboard input after temporary replacement UI
// releases focus. If you want a specific component to receive input while overlays remain
// visible, call handle.unfocus({ target: component }).

// Hide topmost overlay
tui.hideOverlay();

// Check if any visible overlay is active
tui.hasOverlay();
```

**锚点值**：`'center'`、`'top-left'`、`'top-right'`、`'bottom-left'`、`'bottom-right'`、`'top-center'`、`'bottom-center'`、`'left-center'`、`'right-center'`

**分辨率顺序**：
1. `minWidth` 在宽度计算后作为底层应用
2. 位置：绝对 `row`/`col` > 百分比 `row`/`col` > `anchor`
3. `margin` 会将最终位置限制在终端边界内
4. `visible` 回调控制覆叠层是否渲染（每帧调用）

### 组件接口
```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  handleMouse?(event: TuiMouseEvent): TuiMouseEventResult | undefined;
  invalidate(): void;
}
```

| 方法 | 描述 |
|--------|-------------|
| `render(width)` | 返回一个字符串数组，每行一个字符串。每行字符串不得超过 `width`，否则 TUI 会报错。请使用 `truncateToWidth()` 或手动换行以确保此限制。 |
| `handleInput?(data)` | 组件获得焦点并接收到键盘输入时调用。`data` 字符串包含原始终端输入（可能包含 ANSI 逃逸序列）。 |
| `handleMouse?(event)` | `TuiAltScreen` 调用此方法，用于处理针对组件的规范化指针输入。 |
| `invalidate()` | 必须实现。清除任何缓存的渲染状态，以便下一个 `render()` 从头开始。没有缓存渲染状态的组件可以使用空实现。 |

TUI 在每条渲染行的末尾追加完整的 SGR 重置和 OSC 8 重置。样式不会跨行传递。如果您输出带样式的多行文本，请每行重新应用样式，或使用 `wrapTextWithAnsi()` 以确保每行换行后的样式得以保留。

### 鼠标输入

`TuiAltScreen` 会规范化 SGR 鼠标输入并进行组件和覆盖层的点击测试。事件包含组件本地的 `x`/`y`、绝对坐标的 `screenX`/`screenY`、边界、按钮、修饰符、点击次数和滚轮偏移量。`TuiMainScreen` 不捕获鼠标输入，因为终端拥有其滚动缓存。

```typescript
import type { TuiMouseEvent, TuiMouseEventResult } from "@earendil-works/pi-tui";

handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
  if (event.type === "click" && event.button === "left") {
    this.expanded = !this.expanded;
    return { handled: true };
  }
  if (event.type === "press" && event.button === "left") {
    return { handled: true, capture: true, focus: true };
  }
  if (event.type === "drag") {
    this.updateFromPointer(event.x, event.y);
    return { handled: true, render: true };
  }
  return undefined;
}
```

返回 `handled` 会抑制渲染器级别的回退行为。`capture` 保持后续的拖拽和释放事件路由到同一组件。`focus` 请求键盘焦点。可选的 `render` 标志控制重绘：默认情况下，按下、点击、拖拽和滚轮事件都会触发渲染；移动和释放事件不会。设置 `render: true` 以表示视觉上发生变化的悬停状态，或设置 `render: false` 以表示已处理的无操作。渲染请求会被合并，终端输出保持差异性。

未处理的手势将保留备用屏幕的默认行为：滚轮输入会滚动最近的 `ScrollView` 并链式传递未使用的偏移量，主按钮拖拽会选择文本，OSC 8 链接会在父点击处理器之前打开，未处理的右键点击会保留配置的粘贴行为。只有在按下/释放操作完成且没有拖拽的情况下才会发出点击事件。
`MouseRegion`
```typescript
const collapsible = new MouseRegion(content, (event) => {
  if (event.type !== "click" || event.button !== "left") return undefined;
  expanded = !expanded;
  return { handled: true };
});
```

`Container`和`Box`利用上一帧渲染时记录的几何信息将事件路由到嵌套子元素，因此鼠标移动不会因简单的点击测试而重新渲染子元素。显式的`VStack`、`HStack`和`ScrollView`布局则直接使用备用屏幕布局帧。

### 可聚焦接口（IME支持）

需要显示文本光标并支持输入法编辑器（IME）的组件应实现`Focusable`接口：

```typescript
import { CURSOR_MARKER, type Component, type Focusable } from "@earendil-works/pi-tui";

class MyInput implements Component, Focusable {
  focused: boolean = false;  // Set by TUI when focus changes
  
  render(width: number): string[] {
    const marker = this.focused ? CURSOR_MARKER : "";
    // Emit marker right before the fake cursor
    return [`> ${beforeCursor}${marker}\x1b[7m${atCursor}\x1b[27m${afterCursor}`];
  }

  invalidate(): void {}
}
```

当`Focusable`组件获得焦点时，TUI：
1. 在组件上设置`focused = true`
2. 扫描渲染输出以查找`CURSOR_MARKER`（零宽APC转义序列）
3. 将硬件终端光标定位到该位置
4. 仅当`showHardwareCursor`启用时才显示硬件光标

默认情况下光标隐藏。这样可以保持伪光标渲染，同时终端跟踪隐藏候选窗口的IME时仍能定位硬件光标。某些终端需要可见硬件光标以实现IME定位；可通过渲染器构造函数的`showHardwareCursor`参数或`setShowHardwareCursor(true)`启用。`Editor`和`Input`内置组件已实现此接口。

**包含嵌入输入的容器组件：**当容器组件（对话框、选择器等）包含`Input`或`Editor`子组件时，容器必须实现`Focusable`并将焦点状态传递给子组件：

```typescript
import { Container, type Focusable, Input } from "@earendil-works/pi-tui";

class SearchDialog extends Container implements Focusable {
  private searchInput: Input;

  // Propagate focus to child input for IME cursor positioning
  private _focused = false;
  get focused(): boolean { return this._focused; }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor() {
    super();
    this.searchInput = new Input();
    this.addChild(this.searchInput);
  }
}
```

若不进行此状态传递，使用IME（中文、日文、韩文等）输入时候选窗口将显示在错误位置。

## 内置组件

### 容器

组合子组件。

```typescript
const container = new Container();
container.addChild(component);
container.removeChild(component);
```

### Box

对所有子元素应用内边距和背景色的容器。

```typescript
const box = new Box(
  1,                              // paddingX (default: 1)
  1,                              // paddingY (default: 1)
  (text) => chalk.bgGray(text)   // optional background function
);
box.addChild(new Text("Content"));
box.setBgFn((text) => chalk.bgBlue(text));  // Change background dynamically
```

### Text

显示多行文本，支持单词换行和内边距。

```typescript
const text = new Text(
  "Hello World",                  // text content
  1,                              // paddingX (default: 1)
  1,                              // paddingY (default: 1)
  (text) => chalk.bgGray(text)   // optional background function
);
text.setText("Updated text");
text.setCustomBgFn((text) => chalk.bgBlue(text));
```

### TruncatedText

单行文本，宽度超出时截断。适用于状态行和标题。

```typescript
const truncated = new TruncatedText(
  "This is a very long line that will be truncated...",
  0,  // paddingX (default: 0)
  0   // paddingY (default: 0)
);
```

### Input

带水平滚动的单行文本输入。

```typescript
const input = new Input();
input.onSubmit = (value) => console.log(value);
input.setValue("initial");
input.getValue();
```

点击可定位光标并获得输入键盘焦点（备用屏幕模式）。

**快捷键绑定：**
- `Enter` - 提交
- `Ctrl+A` / `Ctrl+E` - 行首/行尾
- `Ctrl+W`或`Alt+Backspace` - 向后删除单词
- `Ctrl+U` - 删除到行首
- `Ctrl+K` - 删除到行尾
- `Ctrl+Left` / `Ctrl+Right` - 单词导航
- `Alt+Left` / `Alt+Right` - 单词导航
- 箭头键、退格键、删除键按预期工作

### Editor

支持自动补全、文件路径补全、粘贴处理和垂直滚动的多行文本编辑器（内容超出终端高度时）。

```typescript
interface EditorTheme {
  borderColor: (str: string) => string;
  selectList: SelectListTheme;
}

interface EditorOptions {
  paddingX?: number;  // Horizontal padding (default: 0)
}

const editor = new Editor(tui, theme, options?);  // tui is required for height-aware scrolling
editor.onSubmit = (text) => console.log(text);
editor.onChange = (text) => console.log("Changed:", text);
editor.disableSubmit = true; // Disable submit temporarily
editor.setAutocompleteProvider(provider);
editor.borderColor = (s) => chalk.blue(s); // Change border dynamically
editor.setPaddingX(1); // Update horizontal padding dynamically
editor.getPaddingX();  // Get current padding
```

**功能：**
- 点击定位光标和可点击的自动补全行（备用屏幕模式）
- 多行编辑，支持单词换行
- 斜杠命令自动补全（输入`/`）
- 文件路径自动补全（按`Tab`）
- 大段粘贴处理（超过10行创建`[paste #1 +50 lines]`标记）
- 编辑器上下方的水平线
- 伪光标渲染（隐藏真实光标）

**快捷键绑定：**
- `Enter` - 提交
- `Shift+Enter`、`Ctrl+Enter`或`Alt+Enter` - 换行（终端相关，Alt+Enter最可靠）
- `Tab` - 自动补全
- `Ctrl+K` - 删除到行尾
- `Ctrl+U` - 删除到行首
- `Ctrl+W`或`Alt+Backspace` - 向后删除单词
- `Alt+D`或`Alt+Delete` - 向前删除单词
- `Ctrl+A` / `Ctrl+E` - 行首/行尾
- `Ctrl+]` - 跳转到字符（等待下一个按键，然后将光标移动到首次出现的位置）
- `Ctrl+Alt+]` - 向后跳转到字符
- 箭头键、退格键、删除键按预期工作

### Markdown
渲染 Markdown 并支持语法高亮和主题。

```typescript
interface MarkdownTheme {
  heading: (text: string) => string;
  link: (text: string) => string;
  linkUrl: (text: string) => string;
  code: (text: string) => string;
  codeBlock: (text: string) => string;
  codeBlockBorder: (text: string) => string;
  quote: (text: string) => string;
  quoteBorder: (text: string) => string;
  hr: (text: string) => string;
  listBullet: (text: string) => string;
  bold: (text: string) => string;
  italic: (text: string) => string;
  strikethrough: (text: string) => string;
  underline: (text: string) => string;
  highlightCode?: (code: string, lang?: string) => string[];
}

interface DefaultTextStyle {
  color?: (text: string) => string;
  bgColor?: (text: string) => string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

const md = new Markdown(
  "# Hello\n\nSome **bold** text",
  1,              // paddingX
  1,              // paddingY
  theme,          // MarkdownTheme
  defaultStyle    // optional DefaultTextStyle
);
md.setText("Updated markdown");
```

**功能：**
-  标题、粗体、斜体、代码块、列表、链接、引用块
-  HTML 标签渲染为纯文本
-  可选的语法高亮功能（通过 `highlightCode` 实现）
-  支持内边距
-  渲染缓存以提升性能

###  加载器

动画加载旋转图标。

```typescript
const loader = new Loader(
  tui,                              // TUI instance for render updates
  (s) => chalk.cyan(s),            // spinner color function
  (s) => chalk.gray(s),            // message color function
  "Loading..."                      // message (default: "Loading...")
);
loader.start();
loader.setMessage("Still loading...");
loader.stop();
```

###  可取消加载器

在加载器基础上增加对 Escape 键的处理和 AbortSignal，用于取消异步操作。

```typescript
const loader = new CancellableLoader(
  tui,                              // TUI instance for render updates
  (s) => chalk.cyan(s),            // spinner color function
  (s) => chalk.gray(s),            // message color function
  "Working..."                      // message
);
loader.onAbort = () => done(null); // Called when user presses Escape
doAsyncWork(loader.signal).then(done);
```

**属性：**
-  `signal: AbortSignal` - 用户按下 Escape 时被中止
-  `aborted: boolean` - 加载器是否被中止
-  `onAbort?: () => void` - 用户按下 Escape 时的回调

###  选择列表

支持键盘导航的交互式选择列表。

```typescript
interface SelectItem {
  value: string;
  label: string;
  description?: string;
}

interface SelectListTheme {
  selectedPrefix: (text: string) => string;
  selectedText: (text: string) => string;
  description: (text: string) => string;
  scrollInfo: (text: string) => string;
  noMatch: (text: string) => string;
}

const list = new SelectList(
  [
    { value: "opt1", label: "Option 1", description: "First option" },
    { value: "opt2", label: "Option 2", description: "Second option" },
  ],
  5,      // maxVisible
  theme   // SelectListTheme
);

list.onSelect = (item) => console.log("Selected:", item);
list.onCancel = () => console.log("Cancelled");
list.onSelectionChange = (item) => console.log("Highlighted:", item);
list.setFilter("opt"); // Filter items
```

**控制方式：**
-  鼠标移动/滚轮：在替代屏幕模式下高亮行
-  点击：选择一行
-  方向键：导航
-  回车：选择
-  Escape：取消

###  设置列表

带值循环和子菜单的设置面板。

```typescript
interface SettingItem {
  id: string;
  label: string;
  description?: string;
  currentValue: string;
  values?: string[];  // If provided, Enter/Space cycles through these
  submenu?: (currentValue: string, done: (selectedValue?: string) => void) => Component;
}

interface SettingsListTheme {
  label: (text: string, selected: boolean) => string;
  value: (text: string, selected: boolean) => string;
  description: (text: string) => string;
  cursor: string;
  hint: (text: string) => string;
}

const settings = new SettingsList(
  [
    { id: "theme", label: "Theme", currentValue: "dark", values: ["dark", "light"] },
    { id: "model", label: "Model", currentValue: "gpt-4", submenu: (val, done) => modelSelector },
  ],
  10,      // maxVisible
  theme,   // SettingsListTheme
  (id, newValue) => console.log(`${id} changed to ${newValue}`),
  () => console.log("Cancelled")
);
settings.updateValue("theme", "light");
```

**控制方式：**
-  鼠标移动/滚轮：在替代屏幕模式下高亮行
-  点击：激活一行
-  方向键：导航
-  回车/空格：激活（循环值或打开子菜单）
-  Escape：取消

###  空行

用于垂直间距的空行。

```typescript
const spacer = new Spacer(2); // 2 empty lines (default: 1)
```

###  图片

在支持 Kitty 图形协议（Kitty、Ghostty、WezTerm）或 iTerm2 内联图片的终端中，渲染内联图片；在不支持的终端中，回退为文本占位符。

```typescript
interface ImageTheme {
  fallbackColor: (str: string) => string;
}

interface ImageOptions {
  maxWidthCells?: number;
  maxHeightCells?: number;
  filename?: string;
}

const image = new Image(
  base64Data,       // base64-encoded image data
  "image/png",      // MIME type
  theme,            // ImageTheme
  options           // optional ImageOptions
);
tui.addChild(image);
```

支持格式：PNG、JPEG、GIF、WebP。尺寸会自动从图片头部解析。

####  替代屏幕图片兼容性

`TuiAltScreen` 支持在实现 Kitty 图形协议的终端（包括 Kitty 和 Ghostty）中内联图片和部分视口裁剪。iTerm2 的内联图片协议不提供删除现有放置位置或滚动时裁剪源的操作。为防止过期图片覆盖重新绘制的内容，`TuiAltScreen` 在 iTerm2 中将图片组件渲染为文本占位符。`TuiMainScreen` 继续在 iTerm2 中正常渲染内联图片。

##  自动补全

###  组合自动补全提供者

支持斜杠命令和文件路径。

```typescript
import { CombinedAutocompleteProvider } from "@earendil-works/pi-tui";

const provider = new CombinedAutocompleteProvider(
  [
    { name: "help", description: "Show help" },
    { name: "clear", description: "Clear screen" },
    { name: "delete", description: "Delete last message" },
  ],
  process.cwd() // base path for file completion
);

editor.setAutocompleteProvider(provider);
```

**功能：**
-  输入 `/` 可以看到斜杠命令
-  按 `Tab` 可以完成文件路径
-  支持 `~/`、`./`、`../` 和 `@` 前缀
-  过滤可附加文件的 `@` 前缀

##  键检测

使用 `matchesKey()` 和 `Key` 辅助工具检测键盘输入（支持 Kitty 键盘协议）：

```typescript
import { matchesKey, Key } from "@earendil-works/pi-tui";

if (matchesKey(data, Key.ctrl("c"))) {
  process.exit(0);
}

if (matchesKey(data, Key.enter)) {
  submit();
} else if (matchesKey(data, Key.escape)) {
  cancel();
} else if (matchesKey(data, Key.up)) {
  moveUp();
}
```

**键标识符**（用于自动补全或字符串字面量，使用 `Key.*`）：
-  基本键：`Key.enter`、`Key.escape`、`Key.tab`、`Key.space`、`Key.backspace`、`Key.delete`、`Key.home`、`Key.end`
-  方向键：`Key.up`、`Key.down`、`Key.left`、`Key.right`
-  带修饰符的键：`Key.ctrl("c")`、`Key.shift("tab")`、`Key.alt("left")`、`Key.ctrlShift("p")`
-  字符串格式同样有效：`"enter"`、`"ctrl+c"`、`"shift+tab"`、`"ctrl+shift+p"`

##  渲染模式

`TuiMainScreen` 使用三种渲染策略：

1.  **首次渲染**：输出所有行，不清理滚动缓存
2.  **宽度改变或视口上方改变**：清理屏幕并完全重绘
3.  **正常更新**：将光标移动到第一个更改的行，清除到末尾，渲染更改的行
`TuiAltScreen`拥有终端高度的视口。如果没有显式的布局根节点，它会保留传统的单文档滚动行为。与`setLayoutRoot()`、`VStack`、`HStack`以及嵌套的`ScrollView`组件配合使用时，可以保留固定区域并独立滚动受限区域。它会就地更新更改的视口行，跟随流式输出并在底部滚动，同时保留手动选择的滚动位置，即使内容增长也是如此。鼠标滚轮和可配置的键盘导航滚动不会修改终端滚动缓存，包括在OSC 133语义提示标记之间跳转。滚动条支持悬停展开、拖动缩略图和点击轨道跳转。点击OSC 8超链接会使用配置的URL处理程序打开它。按住主鼠标按钮拖动可选择文本，除非`TuiAltScreenOptions.copyOnSelect`是`false`，否则会将文本复制到剪贴板（使用OSC 52）；在滚动视口的顶部或底部边缘拖动时会自动滚动并扩展选择范围，以包含屏幕外的内容。Kitty图片支持垂直视口裁剪；iTerm2内联图片会回退为文本，因为iTerm2协议无法在视口重绘时删除或裁剪放置。

两个渲染器都会将更新包裹在**同步输出**（`\x1b[?2026h` ... `\x1b[?2026l`）中，以实现原子化、无闪烁的渲染。

## 终端界面

TUI与任何实现`Terminal`接口的对象兼容：

```typescript
interface Terminal {
  start(onInput: (data: string) => void, onResize: () => void): void;
  stop(): void;
  write(data: string): void;
  get columns(): number;
  get rows(): number;
  moveBy(lines: number): void;
  hideCursor(): void;
  showCursor(): void;
  clearLine(): void;
  clearFromCursor(): void;
  clearScreen(): void;
}
```

**内置实现：**
- `ProcessTerminal` - 使用`process.stdin/stdout`
- `VirtualTerminal` - 用于测试（使用`@xterm/headless`）

## 工具

```typescript
import { visibleWidth, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

// Get visible width of string (ignoring ANSI codes)
const width = visibleWidth("\x1b[31mHello\x1b[0m"); // 5

// Truncate string to width (preserving ANSI codes, adds ellipsis)
const truncated = truncateToWidth("Hello World", 8); // "Hello..."

// Truncate without ellipsis
const truncatedNoEllipsis = truncateToWidth("Hello World", 8, ""); // "Hello Wo"

// Wrap text to width (preserving ANSI codes across line breaks)
const lines = wrapTextWithAnsi("This is a long line that needs wrapping", 20);
// ["This is a long line", "that needs wrapping"]
```

## 创建自定义组件

在创建自定义组件时，**由`render()`返回的每一行都不能超过`width`参数的限制**。如果任何一行超出终端宽度，TUI会报错。

### 处理输入

使用`matchesKey()`和`Key`辅助函数处理键盘输入：

```typescript
import { matchesKey, Key, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";

class MyInteractiveComponent implements Component {
  private selectedIndex = 0;
  private items = ["Option 1", "Option 2", "Option 3"];
  
  public onSelect?: (index: number) => void;
  public onCancel?: () => void;

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (matchesKey(data, Key.down)) {
      this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.selectedIndex);
    } else if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    return this.items.map((item, i) => {
      const prefix = i === this.selectedIndex ? "> " : "  ";
      return truncateToWidth(prefix + item, width);
    });
  }

  invalidate(): void {}
}
```

### 处理行宽

使用提供的工具确保行宽合适：

```typescript
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";

class MyComponent implements Component {
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  render(width: number): string[] {
    // Option 1: Truncate long lines
    return [truncateToWidth(this.text, width)];

    // Option 2: Check and pad to exact width
    const line = this.text;
    const visible = visibleWidth(line);
    if (visible > width) {
      return [truncateToWidth(line, width)];
    }
    // Pad to exact width (optional, for backgrounds)
    return [line + " ".repeat(width - visible)];
  }

  invalidate(): void {}
}
```

### ANSI代码注意事项

`visibleWidth()`和`truncateToWidth()`正确处理ANSI转义码：

- `visibleWidth()`在计算宽度时忽略ANSI代码
- `truncateToWidth()`保留ANSI代码并在截断时正确闭合

```typescript
import chalk from "chalk";

const styled = chalk.red("Hello") + " " + chalk.blue("World");
const width = visibleWidth(styled); // 11 (not counting ANSI codes)
const truncated = truncateToWidth(styled, 8); // Red "Hello" + " W..." with proper reset
```

### 缓存

为了性能考虑，组件应缓存其渲染输出，仅在必要时重新渲染：

```typescript
class CachedComponent implements Component {
  private text: string;
  private cachedWidth?: number;
  private cachedLines?: string[];

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines = [truncateToWidth(this.text, width)];

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
```

## 示例

请参见`test/chat-simple.ts`获取完整的聊天界面示例，其中包含：
- 带自定义背景颜色的Markdown消息
- 响应时的加载指示器
- 带自动补全和斜杠命令的编辑器
- 消息之间的间隔符

运行它：
```bash
node test/chat-simple.ts
```

## 开发

```bash
# Install dependencies (from monorepo root)
npm install

# Run type checking
npm run check

# Run the demo
node test/chat-simple.ts
```

### 调试日志

将`PI_TUI_WRITE_LOG`设置为捕获写入stdout的原始ANSI流。

```bash
PI_TUI_WRITE_LOG=/tmp/tui-ansi.log node test/chat-simple.ts
```


