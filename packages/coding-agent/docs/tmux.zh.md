# 在 tmux 中运行 Pi

Pi 可以在 tmux 中运行，但 tmux 可能会将 `Shift+Enter`、`Ctrl+Enter` 和普通的 `Enter` 报告为同一个按键。启用扩展按键，以便 Pi 可以区分它们。

## 检查您的 tmux 版本

```bash
tmux -V
```

对于 tmux 3.5 或更新版本，请使用下面推荐的 CSI-u 配置。对于 tmux 3.2 到 3.4 版本，请使用较旧版本的配置。

## 在 tmux 3.5 或更新版本中启用扩展按键

将以下行添加到 `~/.tmux.conf`：

```tmux
set -g extended-keys on
set -g extended-keys-format csi-u
```

当终端没有直接提供 Kitty 键盘协议时，Pi 请求扩展按键报告。CSI-u 是最可靠的格式，用于通过 tmux 转发修改后的按键。

## 重启 tmux

该配置适用于 tmux 服务器。为了确保其生效，请关闭您的 tmux 会话并启动新的服务器。

如果您选择从命令行停止服务器，请先保存您的工作。此命令终止由该服务器管理的所有会话：

```bash
tmux kill-server
tmux
```

## 验证修改后的按键

在新的 tmux 会话中启动 Pi，并检查以下内容：

1. `Shift+Enter` 在编辑器中插入新行。
2. `Enter` 提交提示符。
3. `Alt+Enter` 在 macOS 和 Linux 上排队后续操作。Windows 和 WSL 默认使用 `Ctrl+Q`。

如果这些按键仍然像普通的 `Enter` 一样工作，请验证终端外部是否可以报告修改后的按键。请参见 [配置您的终端](terminal-setup.md)。

## 使用 tmux 3.2 到 3.4 版本

这些版本支持扩展按键，但不支持 `extended-keys-format csi-u`。仅添加：

```tmux
set -g extended-keys on
```

Pi 支持这些版本使用的 xterm `modifyOtherKeys` 格式。重启 tmux 并重复验证步骤。

对于更旧的版本，请升级 tmux 或在 tmux 外部使用 Pi，而不是依赖修改后的 Enter 快捷键。

