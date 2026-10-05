<p align="center">  
  <a href="https://pi.dev">  
    <img alt="pi logo" src="https://pi.dev/logo-auto.svg" width="128">  
  </a>  
</p>  
<p align="center">  
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>  
  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square" /></a>  
</p>  

> 新贡献者的新问题和拉取请求默认会被自动关闭。维护者会每天审核自动关闭的问题。详情见 [CONTRIBUTING.md](CONTRIBUTING.md)。

# Pi  

Pi 是一个极简且可扩展的智能体框架，你可以根据自己的需求进行定制。  

让 Pi 适应你的工作流，而不是反过来。你可以通过 [扩展](packages/coding-agent/docs/extensions.md)、[技能](packages/coding-agent/docs/skills.md)、[提示模板](packages/coding-agent/docs/prompt-templates.md) 和 [主题](packages/coding-agent/docs/themes.md) 来定制 Pi。你可以将它们打包成 [Pi 包](packages/coding-agent/docs/packages.md)，并通过 npm 或 git 分享。  

Pi 默认自带强大的功能，但省略了一些特性，如子智能体和计划模式。你可以让 Pi 根据需求构建，或者安装一个符合你需求的包。  

你可以通过 [交互式方式](packages/coding-agent/docs/usage.md) 使用 Pi，也可以在 [打印或 JSON 模式](packages/coding-agent/docs/cli.md) 下自动化操作，通过 [RPC](packages/coding-agent/docs/rpc.md) 进行控制，或者使用 [Pi TypeScript SDK](packages/coding-agent/docs/sdk.md) 构建应用。有关实际集成示例，请参见 [OpenClaw](https://github.com/OpenClaw/OpenClaw)。  

## 开始使用  

安装命令行界面：  

```bash
curl -fsSL https://pi.dev/install.sh | sh
```
  
在 Windows 上：  

```shell
powershell -c "irm https://pi.dev/install.ps1 | iex"
```
  
安装程序会锁定所有依赖项，并通过 `pi update` 更新 Pi。你也可以直接通过 npm 安装，npm 不会锁定传递依赖项：  

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```
  
Pi 需要 Node.js 22.19 或更高版本。macOS、Linux 和 Windows 安装程序可以自行安装。Pi 的正常 npm 安装不需要依赖生命周期脚本。  

在你希望 Pi 工作的目录中启动 Pi：  

```bash
cd /path/to/project
pi
```
  
对于内置的 AI 服务提供商，运行 `/login` 以连接订阅或 API 密钥。然后给 Pi 分配任务。  

完整设置和使用说明请参见 [文档](https://pi.dev/docs/latest)，或访问 [pi.dev](https://pi.dev) 查看演示。  

## 使用 Nix  

```bash
nix run github:earendil-works/pi/stable
```
  
`stable` 指向最新版本。使用 `nix profile add github:earendil-works/pi/stable` 安装，`nix profile upgrade pi` 更新。你可以使用 `github:earendil-works/pi/v1.0.0` 固定版本，或者 `github:earendil-works/pi` 获取 `main` 上未发布的变更。Nix 会从源代码构建 Pi。  

支持 Linux 和 macOS 的 ARM64 和 x86-64 架构。使用 `nix build .` 或 `nix run .` 构建或运行你的代码仓库。  

Nix 构建是离线的，因此内置模型数据来自 `nix/model-catalog.json` 固定的 pi.dev 模型目录版本。运行时，Pi 仍会叠加 pi.dev 上的最新目录数据。当 `main` 上的内容不再匹配时（例如添加了新的提供商或模型类型），Nix 工作流会自动更新。手动刷新方法如下：  

```bash
npm run update:model-catalog-pin
```
  

## 包  

本单仓库包含 Pi CLI 及其支持库。  

| 包名 | 描述 |  
|---------|-------------|  
| **[@earendil-works/chord](packages/chord)** | 服务、复制状态、RPC 和插件的独立应用编排运行时 |  
| **[@earendil-works/pi-telemetry](packages/telemetry)** | 供应商中立的遥测协议、参考适配器、符合性测试和类型化模式 |  
| **[@earendil-works/pi-ai](packages/ai)** | 统一多供应商大语言模型 API（OpenAI、Anthropic、Google 等） |  
| **[@earendil-works/pi-durable](packages/durable)** | 持久化对话、任务和文档运行时 |  
| **[@earendil-works/pi-agent-core](packages/agent)** | 带有工具调用和状态管理的智能体运行时 |  
| **[@earendil-works/pi-coding-agent](packages/coding-agent)** | 交互式编码智能体命令行界面 |  
| **[@earendil-works/pi-tui](packages/tui)** | 带有差异渲染的终端用户界面库 |  

有关 Slack/聊天自动化和工作流，请参见 [earendil-works/pi-chat](https://github.com/earendil-works/pi-chat)。  

## 权限与容器化  

Pi 不内置文件系统、进程、网络或凭证访问的权限系统。默认情况下，它将以启动它的用户和进程权限运行。  

如果你需要更强的隔离，可以将 Pi 容器化或沙箱化。有关三种模式，请参见 [packages/coding-agent/docs/containerization.md](packages/coding-agent/docs/containerization.md)：  

- **Gondolin 扩展**：保持 `pi` 和提供商认证在主机上，同时将内置工具和 `!` 命令路由到本地 Linux 微虚拟机。
- **普通 Docker**：在本地容器中运行整个 `pi` 进程，实现简单的隔离。
- **OpenShell**：在受控的沙箱环境中运行整个 `pi` 进程。

## 贡献

有关贡献指南，请参见 [CONTRIBUTING.md](CONTRIBUTING.md)，有关项目特定规则（适用于人类和代理），请参见 [AGENTS.md](AGENTS.md)。Pi 的长期计划也可在 [RFCs](https://rfc.earendil.com/keyword/pi/) 中找到。

## 开发

```bash
npm install --ignore-scripts  # Install all dependencies without running lifecycle scripts
npm run build         # Refresh model data, then build all packages
npm run build:offline # Rebuild using existing model data without network access
npm run check         # Lint, format, and type check
./test.sh            # Run tests (skips LLM-dependent tests without API keys)
./pi-test.sh         # Run pi from sources (can be run from any directory)
```

## 从发布源构建独立二进制文件

GitHub 发布包含受 `SHA256SUMS` 文件约束的版本化源存档。解压后，运行与官方独立二进制文件相同的构建脚本：

```bash
VERSION="<release-version>"
tar -xzf "pi-${VERSION}-source.tar.gz"
cd "pi-${VERSION}"
./scripts/build-binaries.sh --offline-model-data --platform linux-x64 --out "$PWD/out"
```

该存档包含发布模型数据和原生预构建文件。`--offline-model-data` 使用该模型数据，无需刷新提供程序目录。脚本会安装依赖项并构建可执行文件及其运行时资产；如果依赖项已提供，请传递 `--skip-install`。

## 供应链加固

我们将 npm 依赖项变更视为已审核的代码变更。

- 直接外部依赖项被固定到确切版本。内部工作区包保持版本范围。
- `.npmrc` 设置 `save-exact=true` 和 `min-release-age=2`，以避免 npm 解析时同日发布依赖项。
- `package-lock.json` 是依赖项的真实基准。预提交会阻止意外提交锁文件，除非设置了 `PI_ALLOW_LOCKFILE_CHANGE=1`。
- `npm run check` 验证固定直接依赖项、原生 TypeScript 导入兼容性以及生成的编码代理安装锁。
- pi.dev 安装程序从 `packages/coding-agent/install-lock/`（由根锁文件生成）安装以固定传递依赖项。npm 包本身不固定传递依赖项。
- 发布冒烟测试使用 `npm run release:local` 构建、打包，并在标记发布之前，在仓库外部创建隔离的 npm 和 Bun 安装。
- 本地发布安装、文档化的 npm 安装以及 `pi update --self` 在支持的地方使用 `--ignore-scripts`。
- CI 安装使用 `npm ci --ignore-scripts`，并且 GitHub 工作流定期运行 `npm audit --omit=dev` 和 `npm audit signatures --omit=dev`。
- 锁文件生成对依赖项生命周期脚本有明确的允许列表；新的生命周期脚本依赖项在审核通过之前会失败检查。

## 分享您的开源编码代理会话

如果您使用 Pi 或其他编码代理进行开源工作，请分享您的会话。

公开的 OSS 会话数据有助于通过真实任务、工具使用、故障和修复（而非玩具基准测试）改进编码代理。

有关完整说明，请参见 [X 上的这篇帖子](https://x.com/badlogicgames/status/2037811643774652911)。

要发布会话，请使用 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。阅读其 README.md 以获取设置说明。您只需要一个 Hugging Face 账户、Hugging Face CLI 和 `pi-share-hf`。

您还可以观看 [这个视频](https://x.com/badlogicgames/status/2041151967695634619)，我演示了如何发布我的 `pi-mono` 会话。

我定期在此处发布我的 `pi-mono` 工作会话：

- [badlogicgames/pi-mono 在 Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)

## 许可证

MIT

<p align="center">
  <a href="https://pi.dev">pi.dev</a> 域名由以下方慷慨捐赠
  <br /><br />
  <a href="https://exe.dev"><img src="packages/coding-agent/docs/images/exy.png" alt="Exy mascot" width="48" /><br />exe.dev</a>
</p>

