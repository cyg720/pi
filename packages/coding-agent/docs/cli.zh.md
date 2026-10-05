<a id="cli-and-modes-reference"></a>

# 命令行

本页文档记录了Pi内置的命令行命令和选项。运行`pi --help`或在命令末尾追加`--help`，即可获得您已安装版本的确切界面。顶级帮助信息还包括已加载扩展注册的选项。

```sh
pi [options] [--] [@files...] [messages...]
pi install <source> [options]
pi remove <source> [options]
pi uninstall <source> [options]
pi update [target] [options]
pi list
pi config [options]
pi auth <check|print-api-key|print-bearer-token> [options]
pi mcp <list|login|logout> [options]
```
<a id="modes"></a>

## 调用与输出

```sh
pi
pi --print "Summarize this repository"
git diff | pi --print "Review this change"
pi --mode json "Inspect this repository" > events.jsonl
```

当标准输入和标准输出为终端且未选择JSON或RPC模式时，Pi将打开终端用户界面，除非选择了`--print`、`--mode json`或`--mode rpc`等其他界面。若任一数据流被重定向且未选择JSON或RPC模式，Pi将使用打印模式。有关交互式、打印、JSON、RPC及SDK集成模式的选择，请参见[CLI集成](cli-integration.md)。

| 输入 | 行为 |
|---|---|
| `message` | 提供初始提示符 |
| `@path` | 在第一个提示符中包含文本文件或图像 |
| 管道标准输入 | 将其内容前置到第一个提示符中 |
| `--` | 停止选项解析以便提示符以`-`开始 |

Pi从当前工作目录解析`@path`。工作目录也控制项目配置、资源发现和会话分组。

`--print`控制Pi是否只运行一次后退出。`--mode`选择输出界面。`--mode text`在标准输入和标准输出为终端时不强制单次执行；如需该行为，请使用`--print`。

| 选项 | 行为 |
|---|---|
| `-p`、`--print` | 运行提供的提示符，将最终助手文本写入标准输出，然后退出 |
| `--mode text` | 选择文本输出；当标准输入和标准输出为终端时仍保持终端用户界面 |
| `--mode json` | 运行提供的提示符，将JSONL事件写入标准输出，然后退出 |
| `--mode rpc` | 从标准输入读取JSONL命令，将响应和事件写入标准输出，直到关闭 |
| `--export <input> [output]` | 导出会话文件为HTML并退出；若未提供`output`，则推导目标路径 |

RPC模式拒绝`@file`参数。JSON和RPC模式将标准输出保留用于协议记录。有关[JSON事件流](json.md)和[RPC协议](rpc.md)的详细信息，请参见相应文档。

<a id="model-options"></a>

## 模型

```sh
pi --model sonnet:high
```

有关模型选择，请参见[选择模型](models.md)；有关凭证，请参见[提供商](providers.md)。

- `--provider <name>`<br>
限制`--model`的查找范围至单一提供商。需提供`--model`。
- `--model <pattern>`<br>
按精确ID或模糊ID/名称匹配选择。接受`provider/id`及可选的`:<thinking>`后缀。
- `--api-key <key>`<br>
使用非持久化API密钥覆盖。需通过`--model`或`--models`选择模型。
- `--thinking <level>`<br>
设置`off`、`minimal`、`low`、`medium`、`high`、`xhigh`或`max`。覆盖`--model`后缀并受模型能力限制。
- `--models <patterns>`<br>
设置以逗号分隔的作用域，用于启动和循环。接受精确ID、模糊匹配、大小写不敏感通配符及可选的`:<thinking>`后缀。
- `--list-models [search]`<br>
列出可用模型，可选地按模糊搜索过滤，然后退出。

<a id="session-options"></a>

## 会话

```sh
pi --continue
```

有关恢复、分叉、命名和存储会话，请参见[会话与上下文](sessions.md)。

- `-c`、`--continue`<br>
继续当前项目的最近会话。
- `-r`、`--resume`<br>
打开会话选择器。
- `--session <path|id>`<br>
按文件路径、精确ID或部分ID打开。Pi优先在当前项目中搜索，并提供跨项目匹配的分叉选项。
- `--session-id <id>`<br>
打开精确项目会话ID或若不存在则创建。ID可包含字母、数字、`.`、`_`和`-`。
- `--fork <path|id>`<br>
将现有会话分叉为当前项目的新会话。
- `--session-dir <dir>`<br>
重写存储和查找。它优先于 `PI_CODING_AGENT_SESSION_DIR` 和 `sessionDir` 设置。
- `--no-session`<br>
  使用不持久化的内存会话。
- `-n`, `--name <name>`<br>
  设置会话显示名称。

约束：
- 会话ID必须以字母或数字开头和结尾。
- `--fork` 不能与 `--session`、`--continue`、`--resume` 或 `--no-session` 组合使用。
- `--session-id` 不能与 `--session`、`--continue` 或 `--resume` 组合使用。请与 `--fork` 组合以选择新ID。

<a id="tool-options"></a>

## 工具

```sh
pi --tools read,grep,find,ls --print "Review this project"
```

  有关默认工具选择的配置，请参见 [设置](settings.md#tools)。

- `-t`, `--tools <list>`<br>
  用逗号分隔的内置、扩展或自定义工具白名单替换默认选择。
- `-xt`, `--exclude-tools <list>`<br>
  在所有其他选择选项之后，禁用逗号分隔的工具名称。
- `-nbt`, `--no-builtin-tools`<br>
禁用默认内置工具，同时保留扩展和自定义工具。

- `-nt`，`--no-tools`<br>

所有内置、扩展和自定义工具均处于禁用状态。

默认启用的工具为`read`、`bash`、`edit`和`write`，除非`defaultTools`进行了更改。`--tools`可替换整个选择，因此请为每个工具命名；`defaultTools`也接受`+name`和`-name`来更改默认设置。

| 内置工具 | 功能 |
|---|---|
| `read` | 读取文本文件和受支持的图像 |
| `bash` | 运行 shell 命令 |
| `powershell` | 在 Windows 上运行 PowerShell 命令 |
| `edit` | 对现有文件应用精确的文本替换 |
| `write` | 创建或覆盖文件 |
| `grep` | 搜索文件内容 |
| `find` | 使用 glob 模式查找路径 |
| `ls` | 列出目录内容 |

内置扩展增加了两个工具。它们默认关闭；MCP 扩展在需要时会开启它们（见 [MCP](mcp.md#exposure)）。要自行启用它们，请在 `--tools` 或 `defaultTools` 中命名它们。
| 内置扩展 | 用途 |
|---|---|
| `codemode` | 运行调用其他工具的JavaScript脚本，例如与`Promise.allSettled`并行执行；仅脚本输出传递给模型 |
| `tool_search` | 搜索未向模型声明的工具（如`codemode`和`deferred`暴露的MCP工具）并为下一次调用声明匹配项 |

### 启用代码模式

要为每个会话启用`codemode`，请将其添加到`~/.pi/agent/settings.json`的默认工具中或项目的`.pi/settings.json`中：

```json
{
  "defaultTools": ["+codemode"]
}
```

这会保留`read`、`bash`、`edit`和`write`，并添加`codemode`。对于单次调用，请列出所有工具，因为`--tools`会替换选择：

```sh
pi --tools read,bash,edit,write,codemode
```

代码模式在没有MCP的情况下也很有用：脚本可以并行运行多个工具调用、在传递给模型之前过滤大输出、通过`models.classify()`调用分类模型（如TypeSafe的Jev）（见[Classifier models](models.md#use-classifier-models)），以及通过`models.generateImages()`生成图像（见[Image models](models.md#use-image-models)）。

### 代码模式的工作原理

脚本在QuickJS沙箱中运行，并通过`tools.<name>(args)`访问其他工具。[Codemode](codemode.md)描述了脚本API、工具的列表和查找方式、`store()`和`models`全局变量以及限制。

### 工具搜索

`tool_search`默认关闭；通过`"defaultTools": ["+tool_search"]`或`--tools`启用。它使用与`searchTools()`相同的排名对尚未声明的工具进行搜索，并为下一次模型调用声明匹配项。加载的工具会像其他工具更改一样被记录在会话中，因此它们会在该分支上保持已声明状态。

<a id="resource-options"></a>

## 资源

```sh
pi --extension ./review.ts
```

有关常规目录和项目信任，请参见[Configuration](configuration.md)；有关配置路径，请参见[Settings](settings.md#resources)；有关包源，请参见[Pi Packages](packages.md)。
- `-e`, `--extension <path>`<br>
  加载扩展文件或目录，或内置扩展（如 `builtin:mcp`），可重复执行。
- `-ne`, `--no-extensions`<br>
  禁用已发现、已配置和内置的扩展。显式 `-e` 路径仍会加载，因此 `pi -ne -e builtin:mcp` 仅保留内置的 MCP 支持。
- `--skill <path>`<br>
  加载技能文件或目录，可重复执行。
- `-ns`, `--no-skills`<br>
  禁用已发现和已配置的技能。显式 `--skill` 路径仍会加载。
- `--prompt-template <path>`<br>
  加载提示模板文件或目录，可重复执行。
- `-np`, `--no-prompt-templates`<br>
  禁用已发现和已配置的模板。显式 `--prompt-template` 路径仍会加载。
- `--theme <path>`<br>
  加载主题文件或目录，可重复执行。
- `--use-theme <name[/name]>`<br>
  选择本次运行的初始交互式主题。
- `--no-themes`<br>
  禁用已发现和已配置的主题。显式 `--theme` 路径仍会加载。
- `-nc`, `--no-context-files`<br>
  禁用 `AGENTS.md` 和 `CLAUDE.md` 的发现功能。

资源路径仅适用于当前进程。相对路径从当前工作目录解析。

<a id="prompt-and-display-options"></a>

## 提示和进程

```sh
pi --append-system-prompt ./instructions.md
```

请参阅 [配置](configuration.md) 了解保存的配置，[安全](security.md#understand-project-trust) 了解项目信任，以及 [环境变量](environment-variables.md) 了解进程控制。

- `--system-prompt <text|path>`<br>
  用文本或现有文件的内容替换默认系统提示。
- `--append-system-prompt <text|path>`<br>
  将文本或现有文件追加到系统提示，可重复执行。
- `--tui-mode <mode>`<br>
  使用 `fullscreen`（默认）或 `regular` 终端模式。
- `--verbose`<br>
  显示详细的交互式启动信息，覆盖 `quietStartup`。
- `-a`, `--approve`<br>
  信任本项目本地的配置和资源。
- `-na`, `--no-approve`<br>
  忽略信任控制的项目本地配置和资源。
- `--offline`<br>
  禁用自动网络活动，包括模型目录刷新。等同于 `PI_OFFLINE=1`。
- `-h`, `--help`<br>
  显示帮助信息，包括已加载扩展注册的标志，然后退出。
- `-v`, `--version`<br>
  显示 Pi 版本信息，然后退出。

扩展可注册额外的长选项。未知的短选项将被拒绝。

## 包命令

```sh
pi install npm:@scope/package
```

请参阅 [Pi 包](packages.md) 了解源格式、过滤、安装和项目范围。

### 常见任务

| 任务                      | 命令                     |
|-------------------------|------------------------|
| 安装一个包                  | `pi install <source>`       |
| 列出已配置的包                | `pi list`       |
| 移除一个包及其设置项            | `pi remove <source>`       |
| 配置加载哪个包的资源            | `pi config`       |

将 `--local` 或 `-l` 添加到 `install`、`remove`、`uninstall` 或 `config` 中，以使用项目设置而非全局设置。

### 更新 Pi 或包

不带目标运行 `pi update` 会更新 Pi 本身。

| 任务                      | 命令                     |
|-------------------------|------------------------|
| 更新 Pi                    | `pi update`       |
| 更新所有已安装的包              | `pi update --extensions`       |
| 更新单个已安装的包              | `pi update <source>`       |
| 刷新模型目录                  | `pi update --models`       |
| 更新 Pi 和所有已安装的包          | `pi update --all`       |

添加 `--force` 以在所选更新包含 Pi 时重新安装 Pi。

`pi update` 无法在另一个包管理器提供 Pi 时更新 Pi（例如 Nix）。请使用该包管理器更新 Pi（例如 `nix profile upgrade pi`）。包和模型目录更新仍然有效。

### 别名和命令选项

- `pi uninstall <source>` 是 `pi remove <source>` 的别名。
- `pi update --self`、`pi update self`和`pi update pi`是`pi update`的别名。

- `pi update --extension <source>`是`pi update <source>`的别名。

- `-a`、`--approve`信任项目本地文件以执行某条命令。`-na`、`--no-approve`忽略受信任限制的项目本地文件。

- 请将`-h`或`--help`附加到命令中，以了解其确切用法和选项约束。

## 凭证命令

```sh
pi auth check --provider openai --json
```

身份验证命令需要`--provider <provider>`或`--model <model>`。有关支持的方法，请参见[提供程序](providers.md)。

| 命令 | 描述 |
|---|---|
| `pi auth check` | 打印`ready`、`not_ready`或`invalid`；分别以`0`、`1`或`2`状态退出 |
| `pi auth print-api-key` | 打印已解析的API密钥 |
| `pi auth print-bearer-token` | 打印已解析的OAuth访问令牌 |

| 选项 | 适用范围 | 描述 |
|---|---|---|
| `--provider <provider>` | 所有 | 为提供程序解析凭证 |
| `--model <model>` | 所有 | 从模型解析凭证；可与`--provider`组合使用 |
| `--json` | `auth check` | 将结构化结果以JSON格式输出 |
| `--credentials` | `auth check` | 凭证就绪时输出已解析的凭证 |
| `--no-refresh` | `auth check` | 不刷新过期的OAuth凭证；刷新是默认行为 |
| `--min-expiry <duration>` | `print-bearer-token` | 使用`ms`、`s`、`m`或`h`要求剩余令牌有效期，例如`30m` |

凭证打印命令将秘密写入stdout。

## MCP命令

这些命令可在非会话环境中运行，因此代理可通过`bash`运行它们。有关[MCP服务器](mcp.md)的更多信息，请参见。

| 命令 | 描述 |
|---|---|
| `pi mcp add <server> [options] -- <command> [args...]` | 在`mcp.json`中添加或替换stdio服务器；`--env KEY=VALUE`（可重复）和`--cwd <dir>`设置其环境和工作目录。命令后面的参数将传递给它 |
| `pi mcp add <server> [options] --url <url>` | 添加或替换流式HTTP服务器；`--header KEY=VALUE`（可重复）、`--bearer-token-env-var <NAME>`（发送`Authorization: Bearer ${NAME}`）、`--oauth-client-id`、`--oauth-client-secret`、`--oauth-callback-port`和`--oauth-client-name`配置身份验证 |
| `pi mcp remove <server>` | 从`mcp.json`中移除服务器；存储的OAuth凭证保留 |
| `pi mcp list [--json]` | 连接到所有已启用的服务器并打印其状态、工具和错误；当配置条目无效或已启用的服务器未连接时，以`1`状态退出 |
| `pi mcp login <server> [--timeout <seconds>]` | 登录OAuth服务器：打开授权页面并等待浏览器（默认300秒）；终端也可接受粘贴的重定向URL |
| `pi mcp logout <server>` | 删除服务器存储的OAuth凭证 |

`add`和`remove`更改`~/.pi/agent/mcp.json`，或使用`--local`（`-l`）在当前目录中的`.pi/mcp.json`。`add`还接受`--exposure <mode>`（参见[暴露](mcp.md#exposure)）和`--description <text>`，并且不连接；运行`pi mcp list`以检查服务器。

项目`.pi/mcp.json`文件仅在项目已被信任时读取。

