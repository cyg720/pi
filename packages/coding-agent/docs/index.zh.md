# Pi

Pi 是一个可扩展的AI智能体，可在终端中运行。只需设定目标和工作文件夹，Pi 就可以检查文件、运行命令、编辑内容，并完成多步骤任务。

您可以将 Pi 用于软件开发、研究笔记、写作项目、数据文件或爱好工作。您可以直接使用 Pi，也可以提示它根据您的工作流程进行自适应调整，还可以基于 Pi 的SDK构建其他应用程序。

## 开始使用 Pi

新用户？请按照 [快速入门](quickstart.md) 指引安装 Pi、连接模型并完成您的第一个任务。

如果 Pi 已经安装，您可以选择以下操作：

- [交互式使用 Pi](usage.md)，添加文件、运行命令、指导正在进行的工作并导出结果。
- [选择模型](models.md) 或连接订阅、API密钥、本地模型或兼容的端点。
- [继续或分支会话](sessions.md)，以恢复工作或探索其他方法，同时保留历史记录。
- [配置 Pi](configuration.md)，根据您的偏好、工作文件夹、指令和可重复使用的资源进行设置。
- [了解 Pi 的工作原理](how-pi-works.md)，包括工具、上下文、会话和智能体循环。

## 自定义 Pi

Pi 可以重用提示、加载专用指令、添加可执行集成、更改终端界面、连接模型服务，并将这些资源打包分发。
使用 [快速入门自定义选择器](quickstart.md#choose-how-to-customize-pi) 选择满足您需求的最小机制。

## 自动化或嵌入 Pi

- 使用 [打印模式](cli.md#invocation-and-output) 处理一次性或脚本任务。
- 使用 [JSON事件流模式](json.md) 消费单次运行的结构化事件。
- 使用 [RPC模式](rpc.md) 控制单独的 Pi 进程。
- 使用 [TypeScript SDK](sdk.md) 在应用程序内运行 Pi。

## 查找参考和设置信息

使用参考页面查找 [命令行选项](cli.md)、[设置](settings.md)、[提供商](providers.md)、[快捷键](keybindings.md) 和 [环境变量](environment-variables.md)。

如需平台特定帮助，请参阅 [终端设置](terminal-setup.md)、[Windows](windows.md)、[tmux](tmux.md)、[Android Termux](termux.md) 或 [容器化](containerization.md)。

## 安全工作

Pi 的工具和扩展以 Pi 进程的权限运行。项目信任控制 Pi 加载的项目资源，但不会对工具调用进行沙箱处理。在使用未受信任的文件、仓库、扩展或无人值守自动化之前，请查阅 [安全](security.md) 说明。

