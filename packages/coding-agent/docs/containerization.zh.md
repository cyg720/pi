# 在隔离环境中运行 Pi

使用隔离环境来限制生成命令可访问或影响的文件、凭据、进程和网络服务。

您可以将整个 Pi 进程完全隔离，也可以将 Pi 保留在主机上，将选定的工具路由到隔离环境中。

## 选择隔离方法

| 方法 | Pi 运行位置 | 隔离内容 | 凭据处理 | 最佳用途 |
|---|---|---|---|---|
| 普通 Docker | 容器 | Pi、内置工具、`!`命令和扩展 | 凭据传递到容器内 | 简单的本地容器边界 |
| Docker 沙箱 | 管理沙箱 | Pi、内置工具、`!`命令和扩展 | 提供商凭据保留在主机上，由代理替换 | 本地隔离管理，不暴露真实提供商密钥 |
| OpenShell | 本地或远程沙箱 | Pi、内置工具、`!`命令和扩展 | 政策控制凭据和推理路由 | 文件系统、进程、网络和凭据策略 |
| Gondolin 扩展 | 主机 | 内置工具和 `!`命令 | 存储的 Pi 凭据保留在主机上，但命令继承主机环境变量 | 本地微虚拟机执行工具，同时保留主机接口 |

隔离方法会改变扩展的运行位置。当完整的 Pi 进程在隔离环境中运行时，其扩展也会运行在那里。当主机 Pi 通过 Gondolin 代理内置工具时，其他扩展工具仍运行在主机上，除非它们也委托了工作。

## 决定 Pi 可访问的内容

隔离进程仍可能影响您暴露给它的资源：

- 读写主机挂载允许 Pi 修改主机文件。
- 挂载 `~/.pi/agent`会暴露您的 Pi 凭据、设置、扩展和会话。
- 传递到容器的环境变量对容器内的进程可用。
- 网络访问可能允许代码或工具输出离开环境。
- 仅工具隔离不会约束主机 Pi 进程或不使用隔离后端的扩展工具。

仅暴露任务所需的作业文件夹、凭据和网络目的地。使用只读挂载或复制文件进出环境，当您不希望写入影响主机时。

## 在普通 Docker 中运行 Pi

普通 Docker 提供了最简单的完整进程容器边界。

### 构建镜像

创建 `Dockerfile.pi`：

```dockerfile
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

WORKDIR /workspace
ENTRYPOINT ["pi"]
```

从包含该文件的目录构建：

```bash
docker build -t pi-sandbox -f Dockerfile.pi .
```

### 启动 Pi

从您希望 Pi 访问的工作目录运行：

```bash
docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v pi-agent-home:/root/.pi/agent \
  pi-sandbox
```

将 `ANTHROPIC_API_KEY` 替换为您提供商所需的凭据。命名的 `pi-agent-home` 卷在运行之间保持容器本地设置、凭据和会话。

除非容器需要访问您的主机 Pi 配置和凭据，否则不要挂载主机的 `~/.pi/agent`。

### 验证工作区

在 Pi 内运行：

```text
!pwd
```

该命令应报告 `/workspace`。`/workspace` 下的更改会写入挂载的主机文件夹。移除绑定挂载或使用只读挂载，当这不可接受时。

## 使用 Docker 沙箱运行 Pi

[Docker 沙箱](https://docs.docker.com/ai/sandboxes/)在管理沙箱内运行完整的 Pi 进程。其代理可以将真实提供商凭据保留在主机上，并在请求离开沙箱时替换它。

在创建沙箱前配置凭据。不要在沙箱内运行 `/login`，因为这会将真实凭据写入沙箱。

### 使用 Claude Pro 或 Max 令牌

使用 `claude setup-token` 在安装了 Claude Code 的机器上生成令牌。如果已经配置了 `anthropic` 密钥，先移除它，以免代理在令牌旁添加 API 密钥头：

```bash
sbx secret rm anthropic

sbx secret set-custom \
  --host api.anthropic.com \
  --env ANTHROPIC_OAUTH_TOKEN \
  --placeholder 'sk-ant-oat01-{rand}'
```

`sbx secret set-custom` 从标准输入读取真实令牌。沙箱接收 OAuth 形状的占位符，代理仅在请求配置的主机时替换它。

对于 Anthropic API 密钥，请使用 `sbx secret set anthropic`。

### 启动 Pi

从您希望挂载的工作目录运行：

```bash
sbx run --kit "docker.io/sbx/pi-kit:latest" pi
```

对于现有沙箱，请以非交互方式运行 Pi：

```bash
sbx exec <sandbox-name> -- pi -p "list the failing tests"
```

请参阅 [Pi 套件文档](https://github.com/docker/sbx-kits-contrib/tree/main/pi)，了解其他提供商、排错和图像固定相关内容。

##  运行 Pi 与 OpenShell

[NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview) 提供本地或远程沙箱，支持文件系统、进程、网络、凭据和推理策略。

###  选择网关

每个沙箱都需要一个活动的网关：

```bash
openshell gateway add <gateway-url> --name <name>
openshell gateway select <name>
```

###  创建沙箱

```bash
openshell sandbox create --name pi-sandbox --from pi -- pi
```

Pi、其内置工具、`!` 命令和扩展工具均在 OpenShell 边界内运行。

###  向远程沙箱传输文件

远程网关不会将主机工作目录绑定挂载到沙箱。您可以在沙箱内克隆仓库，或显式传输文件：

```bash
openshell sandbox upload pi-sandbox ./working-folder /workspace
openshell sandbox download pi-sandbox /workspace/working-folder ./working-folder-out
```

OpenShell 推理路由可将原始模型凭据保留在沙箱外。配置完成后，将 Pi 指向网关暴露的对应 OpenAI 兼容或 Anthropic 兼容端点。

##  通过 Gondolin 路由工具

[Gondolin](https://github.com/earendil-works/gondolin) 是一个本地 Linux 微虚拟机。其示例扩展可将 Pi 进程和基于文件的提供商凭据保留在主机上，同时将内置工具和用户 `!` 命令路由到虚拟机。

虚拟机内的命令会继承主机进程环境。通过环境变量提供的密钥可能会在虚拟机内可见。除非您移除敏感变量或更改扩展的环境处理方式，否则请勿将此模式用作凭据边界。

Gondolin 需要 Node.js 23.6 或更高版本，并通过您的操作系统包管理器安装 QEMU。

###  安装扩展

从 Pi 源代码检出：

```bash
mkdir -p ~/.pi/agent/extensions
cp -R packages/coding-agent/examples/extensions/gondolin ~/.pi/agent/extensions/gondolin
cd ~/.pi/agent/extensions/gondolin
npm install --ignore-scripts
```

###  启动 Pi

从您希望挂载的工作目录运行 Pi：

```bash
cd /path/to/working-folder
pi -e ~/.pi/agent/extensions/gondolin
```

扩展会将主机工作目录挂载到 VM 的 `/workspace`，并覆盖 `read`、`write`、`edit`、`bash`、`grep`、`find` 和 `ls`。`/workspace` 下的文件更改会写入主机。

除非它们显式委派其操作，否则其他扩展工具仍在主机上运行。添加可能绕过虚拟机边界的工具前，请先查看 [Gondolin 示例](../examples/extensions/gondolin/)。

