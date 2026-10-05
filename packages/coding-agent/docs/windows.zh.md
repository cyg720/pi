# 在Windows上运行Pi

可以将Pi作为原生Windows进程运行，也可以在Windows子系统for Linux（WSL）中运行。原生Windows默认使用Git Bash执行Bash命令，并可选地将PowerShell暴露给模型。Pi在WSL中使用Linux环境及其Bash安装。

请遵循主[快速入门](quickstart.md)页面安装和认证Pi。使用本页选择和配置其命令环境。

## 选择原生Windows或WSL

| 环境 | 命令环境 | 适用场景 |
|---|---|---|
| 原生Windows带Git Bash | Git Bash用于内置`bash`工具和`!`命令 | 您的文件和开发工具主要位于Windows上 |
| 原生Windows带`powershell`工具 | PowerShell用于模型工具调用；Bash仍可用于`!`命令 | 任务依赖PowerShell模块或Windows原生命令 |
| WSL | Linux Bash和所选WSL发行版中的工具 | 您的文件和工具链已在Linux或WSL中 |

## 在原生Windows上使用Git Bash

对于大多数原生Windows用户，安装[Git for Windows](https://git-scm.com/download/win)即可。

Pi按以下顺序解析Bash：

1. `shellPath`从`~/.pi/agent/settings.json`
2. Git Bash在`Program Files`或`Program Files (x86)`下
3. `bash.exe`在`PATH`，包括Cygwin、MSYS2或旧版WSL Bash

启动Pi并执行以下命令以验证shell：

```text
!printf 'Bash is working\n'
```

如果Pi无法找到Bash，它会报告已检查的位置。安装Git for Windows，将另一个Bash可执行文件放在`PATH`，或配置`shellPath`。

## 让模型使用PowerShell

可选的`powershell`工具在可用时通过`pwsh.exe`运行命令，然后回退到Windows PowerShell。它以`-NoProfile -NonInteractive -ExecutionPolicy Bypass`启动PowerShell。管理员强制执行策略仍可能优先。

要将模型面向的`bash`工具替换为`powershell`，请将以下内容添加到`~/.pi/agent/settings.json`：

```json
{
  "defaultTools": ["read", "powershell", "edit", "write"]
}
```

`["-bash", "+powershell"]`会保持您配置的任何其他默认工具。

重启Pi，然后要求它运行一个无害的PowerShell命令。`!`和`!!`编辑器命令继续使用Bash。`powershell`工具仅在Pi作为原生Windows进程运行时可用。

有关其他工具组合，请参见[设置](settings.md#tools)。

## 使用自定义Bash可执行文件

当Bash安装在Pi无法自动发现的位置时，设置`shellPath`：

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```

JSON使用反斜杠作为转义序列。当您写Windows路径时，每个反斜杠写两次，如上所示。

有关命令前缀、别名和完整shell解析行为，请参见[配置shell命令](shell-aliases.md)。

## 配置Windows终端

Windows终端保留或重写了一些修改后的按键。请参见[Windows终端](terminal-setup.md#windows-terminal)以配置`Shift+Enter`和`Alt+Enter`，并参见[快捷键](keybindings.md)以了解Pi的Windows和WSL默认快捷键。

