<p align="center">
  <a href="https://pi.dev">
    <img alt="Pi logo" src="https://pi.dev/logo-auto.svg" width="128">
  </a>
</p>
<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square&logo=npm&logoColor=white" /></a>
</p>

> 新贡献者的新问题和PR会自动关闭。维护者每天都会审核已关闭的提交。详见[CONTRIBUTING.md](https://github.com/earendil-works/pi/blob/main/CONTRIBUTING.md)。

# Pi

Pi是一个极简、可扩展的代理框架，你可以自定义它。

让 Pi 适应你的工作流，而不是让你去适应 Pi。通过[扩展](docs/extensions.md)、[技能](docs/skills.md)、[提示模板](docs/prompt-templates.md)和[主题](docs/themes.md)来自定义 Pi。将它们打包为[Pi 包](docs/packages.md)，并通过 npm 或 git 分享。

Pi自带强大的默认配置，但省略了子代理和计划模式等功能。你可以让Pi帮你构建你需要的功能，或者安装一个符合你需求的包。

你可以通过[交互式](docs/usage.md)方式使用Pi，也可以在[打印或JSON模式](docs/cli.md)下自动化它，通过[RPC](docs/rpc.md)远程控制它，或者用[Pi TypeScript SDK](docs/sdk.md)构建应用。详见[OpenClaw](https://github.com/OpenClaw/OpenClaw)以了解实际集成案例。

## 入门指南

安装命令行界面：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

在Windows上：

```shell
powershell -c "irm https://pi.dev/install.ps1 | iex"
```

安装程序会锁定所有依赖项，并用`pi update`更新Pi。或者，你可以直接用npm安装，npm不会锁定传递依赖项：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

Pi需要Node.js 22.19或更高版本。macOS、Linux和Windows安装程序可以自行安装。对于普通的npm安装，Pi不需要依赖生命周期脚本。
在macOS和Linux上，Nix用户可以通过`nix profile add github:earendil-works/pi/stable`安装最新版本。有关更新和固定版本的详细信息，请参见[快速入门](docs/quickstart.md#1-install-pi)。

在您希望Pi工作的目录中启动Pi：

```bash
cd /path/to/project
pi
```

对于内置的AI提供商，请在Pi中运行`/login`以连接订阅或API密钥。然后给Pi分配任务。

有关完整设置和使用说明，请参见[文档](docs/index.md)。

## 分享您的开源编码代理会话

如果您使用Pi进行开源工作，请分享您的编码代理会话。

公开的开源会话数据有助于通过实际的开发工作流改进模型、提示、工具和评估。

有关完整说明，请参见[X上的这篇帖子](https://x.com/badlogicgames/status/2037811643774652911)。

要发布会话，请使用Hugging Face帐户和Hugging Face CLI运行[`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。

- [演示视频](https://x.com/badlogicgames/status/2041151967695634619)展示了如何发布Pi会话

- 已发布的Pi开发会话：[`badlogicgames/pi-mono`在Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)。

## 开发

克隆仓库，安装其依赖项，然后从源代码运行Pi：

```bash
git clone https://github.com/earendil-works/pi
cd pi
npm install --ignore-scripts
./pi-test.sh
```

`pi-test.sh`可以从任何目录调用，并保留调用者的当前工作目录。

在提交更改之前，请运行：

```bash
npm run check
./test.sh
```

在打开问题或拉取请求之前，请先阅读[CONTRIBUTING.md](https://github.com/earendil-works/pi/blob/main/CONTRIBUTING.md)。它定义了贡献门禁、问题质量标准和必需的检查项。有关仓库特定的实现、测试、依赖和发布规则，请参阅[AGENTS.md](https://github.com/earendil-works/pi/blob/main/AGENTS.md)。

## 许可证

MIT

