# 快速入门

Pi可在您的终端中运行，并与您本地机器上的文件协同工作。要使用Pi，您需要通过支持的提供商访问一个模型。这可以是订阅、API密钥或本地模型。

对于Windows原生环境，请参阅[Windows设置](windows.md)。对于Android设备，请参阅[Termux设置](termux.md)。

## 1. 安装Pi

在macOS或Linux系统上，您可以使用安装程序：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

安装程序会将所有依赖项打包，并使用`pi update`更新Pi。您也可以通过npm安装Pi，这不会打包跨依赖项。此方法要求Node.js 22.19或更高版本：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

对于正常的npm安装，Pi不需要依赖生命周期脚本。

如果您使用Nix（macOS或Linux），可以从Pi的flake安装最新版本。Nix会从源代码构建Pi：

```bash
nix profile add github:earendil-works/pi/stable
```

较旧版本的Nix使用`nix profile install`。使用`nix profile upgrade pi`进行更新；`pi update`无法更新Nix安装。要固定一个版本，可以使用如`github:earendil-works/pi/v1.0.0`这样的标签。

验证安装：

```bash
pi --version
```

## 2. 启动Pi

切换到您希望Pi工作的文件夹，然后启动它：

```bash
cd /path/to/folder
pi
```

工作文件夹有助于Pi发现相关的文件、指令和配置。Pi还会使用它来分组保存的会话。

<p align="center"><img src="images/interactive-mode.png" alt="Pi running in a terminal with a conversation, input editor, and status footer" width="750"></p>

界面显示您的对话、用于提示和命令的编辑器，以及包含当前文件夹、模型和会话状态的页脚。有关如何在终端中使用Pi，请参阅[终端中使用Pi](usage.md)，以了解如何添加文件、运行命令、指导正在进行的工作以及管理结果。

## 3. 选择模型

**模型**生成Pi的响应。**提供商**是Pi用来访问该模型的服务或账户。

在Pi中运行：

```text
/login
```

选择一个提供商，然后按照提示使用订阅或存储API密钥。运行`/model`后，如果要选择另一个可用的模型。

有关支持的提供商、环境变量认证、本地模型和自定义端点，请参阅[选择模型和提供商](models.md)。

## 4. 给Pi分配任务

Pi会显示每个读取、搜索、命令和编辑操作。它不会在每次工具调用前询问。

输入与您的工作匹配的任务，例如：

```text
Summarize @meeting-notes.md and save the action items to action-items.md.
```

```text
Explain how this repository is structured and how to run its checks.
```

```text
Compare @previous.csv with @current.csv and summarize the important changes.
```

在编辑器中输入`@`以搜索文件，而不是输入完整路径。Pi完成后，审阅其响应和任何更改的文件。对于重要工作，请使用版本控制或备份。对于不信任或无人看管的工作，请使用容器或其他沙箱。有关安全信息，请参阅[安全](security.md)。

## 稍后继续

Pi会自动保存会话。退出Pi后，使用：

```bash
pi --continue
```

为同一工作文件夹恢复最近的会话。使用`/resume`选择另一个保存的会话。有关会话命名、分支、压缩、导出和共享，请参阅[继续或分支会话](sessions.md)。

## 下一步

- [交互式使用Pi](usage.md)，以了解输入、命令、快捷键和排队消息。
- [添加指令](configuration.md#context-files)，让Pi在工作于某个文件夹时遵循这些指令。
- [选择模型和提供商](models.md)。

### 选择如何自定义Pi

从最弱的机制开始，满足您的需求：

| 需求                      | 从...开始 |
|-------------------------|----------|
| 给Pi提供文件夹的持久化指令 | [`AGENTS.md`](configuration.md#context-files) |
| 重用来自`/`菜单的提示 | [提示模板](prompt-templates.md) |
| 添加任务特定的指令和支持文件 | [技能](skills.md) |
| 添加可执行工具、命令或事件处理器 | [扩展](extensions.md) |
| 构建自定义终端组件       | [终端UI](tui.md) |
| 连接不支持的模型服务     | [自定义提供商](custom-provider.md) |
| 安装或分发多个资源       | [Pi包](packages.md) |

## 卸载Pi

如果您通过npm安装了Pi，请运行：

```bash
npm uninstall -g @earendil-works/pi-coding-agent
```

如果您使用了安装程序，请再次运行并选择**卸载Pi**：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

如果您使用Nix安装了Pi，请运行：

```bash
nix profile remove pi
```

以上方法均不会删除配置、凭证、会话或安装的Pi包，这些内容存储在`~/.pi/agent/`中。

