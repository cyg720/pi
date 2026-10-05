# 配置您的终端

大多数现代终端无需额外设置即可与Pi配合使用。当修改键、滚动、链接、图片、颜色或输入法编辑器（IME）定位等行为不符合预期时，请使用本页。

Pi使用扩展键协议，使终端能够区分如`Shift+Enter`和`Alt+Enter`等组合键与纯`Enter`。终端代理、多路复用器和内置IDE终端可能会更改或丢弃这些信息。

## 故障排除

| 症状 | 从这里开始 |
|---|---|
| `Shift+Enter`提交而非插入一行 | 请参阅您终端的相关部分；如使用tmux，请见[在tmux中运行Pi](tmux.md) |
| `Alt+Enter`未排队后续操作 | [WezTerm](#wezterm)、[Alacritty](#alacritty)或[Windows Terminal](#windows-terminal) |
| 全屏滚动异常缓慢 | [iTerm2](#iterm2) |
| 链接可用但无悬停预览 | [Ghostty](#ghostty) |
| 内联图片或颜色未被检测 | [覆盖检测能力](#override-detected-capabilities) |
| IME候选项窗口出现在错误位置 | [WezTerm](#wezterm)或[IntelliJ IDEA](#intellij-idea-integrated-terminal) |
| 修改键仅在tmux内失效 | [在tmux中运行Pi](tmux.md) |

使用`/hotkeys`检查Pi的活动快捷键。如需更改，请参见[快捷键](keybindings.md)。

## Kitty

Kitty支持所需的键盘协议，无需额外配置。

<a id="iterm2"></a>
## iTerm2

普通终端模式无需额外配置即可正常工作。

### 修复全屏滚动缓慢问题

在全屏模式下，Pi拥有视口控制权，因此iTerm2发送鼠标滚轮报告而非滚动本地终端历史。快速触控板手势每次只能移动大约一行。

要更改此行为：

1. 打开**iTerm2 > 设置 > 高级**。
2. 搜索**Trackpad scrolls fast?**。
3. 将其设置为**否**。

此为iTerm2全局设置，也可能影响本地触控板滚动。底层行为已跟踪在[iTerm2 issue 9619](https://gitlab.com/gnachman/iterm2/-/work_items/9619)中。

## Apple Terminal

Pi在可用时启用增强键报告。如果Terminal.app仍发送纯回车作为`Shift+Enter`，Pi将使用本地macOS修饰符回退，并将其视为`Shift+Enter`。

回退仅在Pi与Terminal.app在同一台Mac上运行时有效。当Pi通过SSH在另一台机器上运行时，无法检查本地修饰符状态。

<a id="ghostty"></a>
## Ghostty

如果`Alt+Backspace`不生效，请在Ghostty配置中添加此映射：

```text
keybind = alt+backspace=text:\x1b\x7f
```

配置文件在macOS上为`~/Library/Application Support/com.mitchellh.ghostty/config`，在Linux上为`~/.config/ghostty/config`。

较旧的Claude Code配置可能包含：

```text
keybind = shift+enter=text:\n
```

这会发送原始换行符，Pi无法将其与`Ctrl+J`区分开。如果仅因旧版Claude Code安装而添加了该映射，请移除。Pi已将`Ctrl+J`绑定为换行符替代，因此该映射可能看似有效，但仍会阻止Pi和tmux接收真正的`Shift+Enter`事件。

### 在全屏模式中打开链接

链接在全屏模式下仍可点击，但Ghostty不会显示其正常的悬停下划线或URL预览，因为Pi捕获了鼠标输入。在macOS上按住`Shift+Command`或在Linux上按住`Shift+Ctrl`，即可使用Ghostty的原生链接处理。

<a id="wezterm"></a>
## WezTerm

WezTerm通常通过xterm扩展键报告`Shift+Enter`。要显式启用Kitty键盘协议，请创建`~/.wezterm.lua`：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

### 在macOS上转发Alt+Enter

WezTerm默认将`Option+Enter`绑定为全屏。要将其用于Pi的后续队列，请将以下条目添加到您的`config.keys`表中：

```lua
{
  key = 'Enter',
  mods = 'ALT',
  action = wezterm.action.SendString('\x1b[13;3u'),
}
```

完整的最小配置如下：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.keys = {
  {
    key = 'Enter',
    mods = 'ALT',
    action = wezterm.action.SendString('\x1b[13;3u'),
  },
}
return config
```

### 在WSL中定位IME候选项窗口

如果WSL中的CJK IME候选项未跟随Pi的光标，请显示硬件光标：

```bash
export PI_HARDWARE_CURSOR=1
pi
```

您也可以在Pi设置中将`showHardwareCursor`设置为`true`。

<a id="alacritty"></a>
## Alacritty

Alacritty通常报告`Shift+Enter`。在macOS上，`Option+Enter`可能以纯`Enter`形式到达。请将以下内容添加到`~/.config/alacritty/alacritty.toml`以将其转发给Pi：

```toml
[[keyboard.bindings]]
key = "Enter"
mods = "Alt"
chars = "\u001b[13;3u"
```

更改文件后请重启Alacritty。

## VS Code集成终端
VS Code 1.109.5及更新版本默认在集成终端中启用Kitty键盘协议。

对于旧版本，请添加`Shift+Enter`终端绑定到`keybindings.json`：

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

用户`keybindings.json`文件通常位于：

- macOS：`~/Library/Application Support/Code/User/keybindings.json`
- Linux：`~/.config/Code/User/keybindings.json`
- Windows：`%APPDATA%\\Code\\User\\keybindings.json`

## Zed集成终端

将这些绑定添加到Zed的`keymap.json`中：

```json
{
  "context": "Terminal",
  "bindings": {
    "shift-enter": ["terminal::SendText", "\u001b[13;2u"],
    "ctrl--": ["terminal::SendText", "\u001b[45;5u"],
    "ctrl-alt-]": ["terminal::SendText", "\u001b[93;7u"]
  }
}
```

<a id="windows-terminal"></a>
## Windows Terminal

Windows Terminal使用Pi的Windows和WSL快捷键默认设置。请参见[Keybindings](keybindings.md)获取完整列表。

### 转发 Shift+Enter

打开Windows Terminal的`settings.json`，使用`Ctrl+Shift+,`或**设置 > 打开JSON文件**。将其添加到其`actions`数组中：

```json
{
  "command": { "action": "sendInput", "input": "\u001b[13;2u" },
  "keys": "shift+enter"
}
```

完全关闭并重新打开Windows Terminal，然后验证`Shift+Enter`是否在Pi中插入新行。

### 使用Alt+Enter进行后续操作

Windows Terminal默认将`Alt+Enter`绑定到全屏。因此，Pi在Windows和WSL上使用`Ctrl+Q`进行后续操作。

若要使用`Alt+Enter`，请将Windows Terminal配置为转发该键，并在Pi的`keybindings.json`中将`app.message.followUp`绑定到`alt+enter`。请参见[Keybindings](keybindings.md#assign-keybindings)。

## xfce4-terminal和Terminator

这些终端无法可靠地区分修改后的Enter键和平常的`Enter`。因此，自定义绑定如`Ctrl+Enter`或`Shift+Enter`可能无法正常工作。
使用支持现代扩展键的终端（如Kitty、Ghostty、WezTerm、iTerm2、Windows Terminal或兼容的Alacritty构建）以使用这些快捷键。

<a id="intellij-idea-integrated-terminal"></a>
## IntelliJ IDEA集成终端

IntelliJ IDEA内置终端无法可靠地区分`Shift+Enter`与普通`Enter`。使用`Ctrl+J`作为换行符，或在支持现代扩展键的终端中运行Pi。

如果输入法候选项窗口不跟随文本光标，请显示硬件光标：

```bash
export PI_HARDWARE_CURSOR=1
pi
```

<a id="override-detected-capabilities"></a>
## 检测到的能力覆盖

Pi会自动检测OSC 8超链接、内联图像协议和真彩色支持。终端代理或多重处理器可能会使该检测不准确。

| 能力         | 环境变量               | 设置         |
|--------------|------------------------|--------------|
| 超链接       | `PI_HYPERLINKS=1\|0\|auto`       | `terminal.hyperlinks: true\|false\|"auto"` |
| 内联图像     | `PI_IMAGE_PROTOCOL=kitty\|iterm2\|none\|auto`       | `terminal.images: "kitty"\|"iterm2"\|false\|"auto"` |
| 真彩色       | `PI_TRUE_COLOR=1\|0\|auto`       | `terminal.trueColor: true\|false\|"auto"` |

设置优先于环境变量。未设置的值或`auto`将保留自动检测。

仅强制终端路径完全支持的能力。不支持的转义序列可能会损坏渲染。有关标准值定义，请参见[环境变量](environment-variables.md#pi-process-configuration)和[设置](settings.md)。

