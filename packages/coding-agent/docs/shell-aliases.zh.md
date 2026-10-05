# 配置 shell 命令

Pi 为每个 Bash 命令启动一个独立的非交互式 shell 进程。非交互式 Bash 默认不展开别名，通常也不加载与交互式终端相同的启动文件。

使用 `shellPath` 选择 Bash 可执行文件，并使用 `shellCommandPrefix` 在每个命令前运行 setup。

## 了解 Pi 使用的 shell

| 命令来源                     | shell                                                                                   |
|------------------------------|------------------------------------------------------------------------------------------|
| 模型调用内置 `bash` 工具 | Pi 解析后的 Bash 可执行文件                                                                |
| 您输入 `!command` 或 `!!command` | 同一解析后的 Bash 可执行文件                                                                |
| 模型调用可选 `powershell` 工具 | PowerShell 7（`pwsh.exe`）或 Windows PowerShell                                     |
| 扩展提供或替换 shell 工具       | 该扩展实现的操作                                                                           |

Pi 通常以 `bash -c` 启动 Bash。在类 Unix 系统中，使用 `/bin/bash`，然后在 `PATH` 上使用 `bash`，最后在 Bash 无法使用时使用 `sh`。在原生 Windows 上，首先检查配置路径，然后是 Git Bash，最后是 `bash.exe` 在 `PATH` 上。

## 选择 Bash 可执行文件

在 `~/.pi/agent/settings.json` 中设置 `shellPath`，使 Pi 使用特定的可执行文件：

```json
{
  "shellPath": "~/.local/bin/bash"
}
```

在 Windows 上，使用正斜杠或转义反斜杠：

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```

更改设置后，运行 `/reload`。有关原生 Windows 默认值，请参见 [在 Windows 上运行 Pi](windows.md)。

## 在每个 Bash 命令前运行 setup

设置 `shellCommandPrefix` 以在 Pi 的内置 `bash` 工具和用户输入的 `!` 或 `!!` 命令前添加 shell setup：

```json
{
  "shellCommandPrefix": "export CI=1"
}
```

Pi 用换行符连接前缀和请求的命令。前缀会为每个命令再次运行，因此请保持其快速且无交互提示。

## 启用 Bash 别名

将 Pi 需要的别名存储在 Bash 兼容的文件中，而不是解析整个交互式 shell 配置。

创建 `~/.bash_aliases`：

```bash
alias ll='ls -la'
alias gs='git status --short'
```

然后配置 Pi 启用别名展开并加载该文件：

```json
{
  "shellCommandPrefix": "shopt -s expand_aliases\nsource ~/.bash_aliases"
}
```

运行 `/reload`，然后通过 Pi 验证别名：

```text
!ll
```

该命令应产生与 `ls -la` 相同的列表。

别名必须使用 Bash 兼容的语法。不要将任意 `.zshrc` 源文件导入 Bash，因为 zsh 选项、函数和插件可能无法正确解析或运行。

## 故障排除

### 前缀对 `!` 有效但对扩展工具无效

`shellCommandPrefix` 配置 Pi 的内置 Bash 执行。如果扩展替换了 `bash` 工具或提供了自己的 shell 操作，则由该扩展控制其自身的 setup。请查阅该扩展的文档。

### `shopt` 未找到

Pi 已回退到 `sh` 或 `shellPath` 指向非 Bash shell。安装 Bash 或在使用 Bash 特定 setup（如 `shopt`）前设置 `shellPath` 为 Bash 可执行文件。

### setup 命令等待输入

从 `shellCommandPrefix` 中移除交互式命令。前缀会在每个 Bash 命令前在非交互式进程中运行。

有关完整设置定义，请参见 [Shell 设置](settings.md#shell)。

