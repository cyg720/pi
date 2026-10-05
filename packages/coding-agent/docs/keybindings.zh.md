# 快捷键参考

Pi 暴露了命名操作，例如 `app.session.new`，可以为其分配快捷键。你可以更改默认分配，或为 Pi 的 [用户配置](configuration.md#agent-directory) 中未分配的操作绑定快捷键。

运行 `/hotkeys` 可以查看主编辑器和应用当前的快捷键。

## 分配快捷键

创建 `<agent-dir>/keybindings.json`。代理目录默认为 `~/.pi/agent`，详情见 [代理目录](configuration.md#agent-directory)。

将每个操作标识符映射到一个键或一组键：

```json
{
  "app.session.new": "ctrl+shift+n",
  "app.session.tree": ["ctrl+shift+t", "alt+shift+t"]
}
```

为该操作设置的值将覆盖默认值。使用空列表可禁用操作的快捷键：

```json
{
  "tui.altScreen.pageUp": []
}
```

编辑文件后，运行 `/reload` 以将更改应用到当前会话。

## 快捷键语法

将键写为 `modifier+key`。修饰符包括 `ctrl`、`shift`、`alt` 和 `super`。可以组合使用修饰符。有效键包括：

- **字母：** `a-z`
- **数字：** `0-9`
- **特殊符号：** `escape`、`esc`、`enter`、`return`、`tab`、`space`、`backspace`、`delete`、`insert`、`clear`、`home`、`end`、`pageUp`、`pageDown`、`up`、`down`、`left`、`right`
- **功能键：** `f1`-`f12`
- **符号：** `` ` ``, `-`, `=`, `[`, `]`, `\`, `;`, `'`, `,`, `.`, `/`, `!`, `@`, `#`, `$`, `%`, `^`, `&`, `*`, `(`, `)`, `_`, `+`, `|`, `~`, `{`, `}`, `:`, `<`, `>`, `?`

示例：`ctrl+shift+x`、`alt+ctrl+x`、`ctrl+shift+alt+x`、`super+k`、`ctrl+super+k` 和 `ctrl+1`。

`super` 快捷键需要终端单独报告修饰符，通常通过 Kitty 键盘协议实现。在不支持该功能的终端中可能无法工作。

## 操作

### 终端用户界面

#### 光标移动

| 快捷键ID | 默认值 | 描述 |
|---|---|---|
| `tui.editor.cursorUp` | `up` | 光标向上移动，浏览历史记录顶部较早的内容 |
| `tui.editor.cursorDown` | `down` | 光标向下移动，浏览历史记录底部较新的内容 |
| `tui.editor.historyPrevious` | 无 | 选择上一个提示历史记录条目 |
| `tui.editor.historyNext` | 无 | 选择下一个提示历史记录条目 |
| `tui.editor.cursorLeft` | `left`、`ctrl+b` | 光标向左移动 |
| `tui.editor.cursorRight` | `right`、`ctrl+f` | 光标向右移动 |
| `tui.editor.cursorWordLeft` | `alt+left`、`ctrl+left`、`alt+b` | 光标向左移动一个单词 |
| `tui.editor.cursorWordRight` | `alt+right`、`ctrl+right`、`alt+f` | 光标向右移动一个单词 |
| `tui.editor.cursorLineStart` | `home`、`ctrl+home`、`ctrl+a` | 移动到行首 |
| `tui.editor.cursorLineEnd` | `end`、`ctrl+end`、`ctrl+e` | 移动到行尾 |
| `tui.editor.jumpForward` | `ctrl+]` | 跳转到指定字符位置 |
| `tui.editor.jumpBackward` | `ctrl+alt+]` | 跳转到指定字符位置后退 |
| `tui.editor.pageUp` | `pageUp`、`ctrl+pageUp` | 向上翻页滚动 |
| `tui.editor.pageDown` | `pageDown`、`ctrl+pageDown` | 向下翻页滚动 |

专用历史记录操作会忽略光标位置，优先于使用相同键的应用操作。

#### 文本编辑

| 快捷键ID | 默认值 | 描述 |
|---|---|---|
| `tui.editor.deleteCharBackward` | `backspace` | 向后删除字符 |
| `tui.editor.deleteCharForward` | `delete`、`ctrl+d` | 向前删除字符 |
| `tui.editor.deleteWordBackward` | `ctrl+w`、`alt+backspace` | 向后删除单词 |
| `tui.editor.deleteWordForward` | `alt+d`、`alt+delete` | 向前删除单词 |
| `tui.editor.deleteToLineStart` | `ctrl+u` | 删除到行首 |
| `tui.editor.deleteToLineEnd` | `ctrl+k` | 删除到行尾 |
| `tui.editor.yank` | `ctrl+y` | 粘贴最近删除的文本 |
| `tui.editor.yankPop` | `alt+y` | 循环切换已剪切的文本 |
| `tui.editor.undo` | `ctrl+-` (`ctrl+z` on Windows; `alt+z` on WSL) | 撤销上次编辑 |

#### 输入和选择

| 快捷键ID | 默认值 | 描述 |
|---|---|---|
| `tui.input.newLine` | `shift+enter`, `ctrl+j` | 插入新行 |
| `tui.input.submit` | `enter` | 提交输入 |
| `tui.input.tab` | `tab` | Tab补全 |
| `tui.input.copy` | `ctrl+c` | 复制选中内容 |
| `tui.select.up` | `up` | 选择内容向上移动 |
| `tui.select.down` | `down` | 选择内容向下移动 |
| `tui.select.pageUp` | `pageUp` | 在列表中向上翻页 |
| `tui.select.pageDown` | `pageDown` | 在列表中向下翻页 |
| `tui.select.confirm` | `enter` | 确认选择 |
| `tui.select.cancel` | `escape`, `ctrl+c` | 取消选择 |

#### 全屏模式

在全屏模式下，这些操作控制转录内容，并优先于使用相同键的编辑器操作。

| 快捷键ID | 默认值 | 描述 |
|---|---|---|
| `tui.altScreen.pageUp` | `pageUp` | 转录内容向上滚动一页 |
| `tui.altScreen.pageDown` | `pageDown` | 转录内容向下滚动一页 |
| `tui.altScreen.halfPageUp` | 无 | 转录内容向上滚动半页 |
| `tui.altScreen.halfPageDown` | 无 | 转录内容向下滚动半页 |
| `tui.altScreen.lineUp` | 无 | 转录内容向上滚动一行 |
| `tui.altScreen.lineDown` | 无 | 转录内容向下滚动一行 |
| `tui.altScreen.previousPrompt` | `ctrl+shift+up`, `ctrl+up` (`ctrl+up`仅在Windows和WSL有效) | 跳转到上一个标记的消息 |
| `tui.altScreen.nextPrompt` | `ctrl+shift+down`, `ctrl+down` (`ctrl+down`仅在Windows和WSL有效) | 跳转到下一个标记的消息 |
| `tui.altScreen.search` | `ctrl+shift+f` (`ctrl+f`仅在Windows和WSL有效) | 在渲染的转录内容中搜索 |
| `tui.altScreen.searchNext` | `enter`, `ctrl+g` | 搜索时选择下一个匹配项 |
| `tui.altScreen.searchPrevious` | `shift+enter`, `ctrl+shift+g` | 搜索时选择上一个匹配项 |
| `tui.altScreen.searchClose` | `escape` | 关闭转录内容搜索 |
| `tui.altScreen.top` | `home` | 滚动到转录内容的开头 |
| `tui.altScreen.bottom` | `end` | 滚动到转录内容末尾并跟随新输出 |

### 应用程序

| 快捷键ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.interrupt` | `escape` | 取消/中止 |
| `app.clear` | `ctrl+c` | 清除编辑器（第一次）/退出（第二次） |
| `app.exit` | `ctrl+d` | 退出（当编辑器为空时） |
| `app.suspend` | `ctrl+z` (Windows上无对应项) | 挂起至后台 |
| `app.editor.external` | `ctrl+g` | 在外部编辑器中打开（`externalEditor`, `$VISUAL`, `$EDITOR`, Windows上的Notepad，或`nano`等其他环境） |
| `app.clipboard.pasteImage` | `ctrl+v` (`alt+v`仅在Windows和WSL有效) | 在macOS上粘贴文件、图片或从剪贴板粘贴文本 |

在原生Windows环境下，`app.suspend`没有默认值，因为Windows终端不支持Unix作业控制。若手动指定，Pi会显示状态信息而非挂起。WSL使用正常的`ctrl+z`和`fg`行为。

### 会话

| 快捷键ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.session.new` | 无 | 启动新会话（`/new`） |
| `app.session.tree` | 无 | 打开会话树导航器（`/tree`） |
| `app.session.fork` | 无 | 分叉当前会话（`/fork`） |
| `app.session.resume` | 无 | 打开会话恢复选择器（`/resume`） |
| `app.session.togglePath` | `ctrl+p` | 切换路径显示 |
| `app.session.toggleSort` | `ctrl+s` | 切换排序模式 |
| `app.session.toggleNamedFilter` | `ctrl+n` | 切换仅显示命名过滤 |
| `app.session.rename` | `ctrl+r` | 重命名会话 |
| `app.session.delete` | `ctrl+d` | 删除会话 |
| `app.session.deleteNoninvasive` | `ctrl+backspace` | 当查询为空时删除会话 |

### 模型与思考

| 快捷键ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.model.select` | `ctrl+l` | 打开模型选择器 |
| `app.model.cycleForward` | `ctrl+p` | 切换到下一个模型 |
| `app.model.cycleBackward` | `shift+ctrl+p` (`alt+p`仅在Windows和WSL有效) | 切换到上一个模型 |
| `app.models.save` | `ctrl+s` | 将选中的默认模型或作用域模型配置保存到设置中 |
| `app.thinking.cycle` | `shift+tab` | 思维循环层级 |
| `app.thinking.save` | `ctrl+s` | 保存当前思维层级到设置 |
| `app.thinking.toggle` | `ctrl+t` | 折叠或展开思维区块 |

###  显示与消息队列

| 快捷键ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.tools.expand` | `ctrl+o` | 折叠或展开工具输出 |
| `app.message.copy` | `ctrl+x` | 复制`/tree`中选中的消息；在全屏模式下，当`fullscreenCopyOnSelect`为`false`时，复制活动选区；否则复制最后一个助手消息。在OAuth登录界面，复制登录链接 |
| `app.message.followUp` | `alt+enter` (`ctrl+q`在Windows和WSL) | 将后续消息入队 |
| `app.message.dequeue` | `alt+up` (`alt+q`在Windows和WSL) | 恢复排队消息到编辑器 |

###  树导航

| 快捷键ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.tree.foldOrUp` | `ctrl+left`, `alt+left` | 折叠当前分支段，或跳转到上一段起始位置 |
| `app.tree.unfoldOrDown` | `ctrl+right`, `alt+right` | 展开当前分支段，或跳转到下一段起始位置或分支结束位置 |
| `app.tree.editLabel` | `shift+l` | 编辑选中树节点的标签 |
| `app.tree.toggleLabelTimestamp` | `shift+t` | 切换树中标签时间戳的显示 |
| `app.tree.filter.default` | `ctrl+d` | 将树过滤器设置为默认视图 |
| `app.tree.filter.noTools` | `ctrl+t` | 切换隐藏工具结果的树过滤器 |
| `app.tree.filter.userOnly` | `ctrl+u` | 切换仅显示用户消息的树过滤器 |
| `app.tree.filter.labeledOnly` | `ctrl+l` | 切换仅显示带标签条目的树过滤器 |
| `app.tree.filter.all` | `ctrl+a` | 切换显示所有条目的树过滤器 |
| `app.tree.filter.cycleForward` | `ctrl+o` | 树过滤器向前循环 |
| `app.tree.filter.cycleBackward` | `shift+ctrl+o` | 树过滤器向后循环 |

###  作用域模型选择器

在通过`/scoped-models`打开的作用域模型选择器内使用。

| 快捷键ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.models.enableAll` | `ctrl+a` | 启用所有模型（或启用当前搜索匹配的所有模型） |
| `app.models.clearAll` | `ctrl+x` | 清除所有模型（或清除当前搜索匹配的所有模型） |
| `app.models.toggleProvider` | `ctrl+p` | 切换当前提供商的所有模型 |
| `app.models.reorderUp` | `alt+up` | 在循环顺序中将选中模型上移 |
| `app.models.reorderDown` | `alt+down` | 在循环顺序中将选中模型下移 |

