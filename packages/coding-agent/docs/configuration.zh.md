# 配置

Pi支持用户级和项目级配置。用户级配置位于代理目录，默认为`~/.pi/agent`。项目级配置位于工作目录下的`.pi`中，获得[项目信任](security.md#understand-project-trust)后加载。唯一例外是`sessionDir`，Pi在解析信任前读取它，以便定位会话。

在交互模式下，使用`/settings`更改常用偏好设置。对于其他选项，请让Pi更新配置或直接编辑相关文件。手动更改设置、快捷键、指令或资源后，运行`/reload`。

## 代理目录

代理目录如下所示为`<agent-dir>`。可通过`PI_CODING_AGENT_DIR`环境变量或SDK的[`agentDir`](sdk.md)选项设置其位置。

| 路径 | 责任 |
|---|---|
| `<agent-dir>/settings.json` | 用户级[设置](settings.md)，包括偏好、默认值、资源路径和Pi包声明。 |
| `<agent-dir>/keybindings.json` | 自定义终端UI和应用[快捷键](keybindings.md)。 |
| `<agent-dir>/mcp.json` | 每个项目中可用的[MCP服务器](mcp.md)。 |
| `<agent-dir>/models.json` | [兼容端点、模型和模型覆盖](models.md#configure-a-compatible-endpoint)。 |
| `<agent-dir>/auth.json` | 保存的API密钥和OAuth凭证。 |
| `<agent-dir>/AGENTS.override.md`, `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`, 或 `CLAUDE.MD` | 跨工作目录应用的用户指令。 |
| `<agent-dir>/SYSTEM.md` | 替换Pi的默认系统提示符。 |
| `<agent-dir>/APPEND_SYSTEM.md` | 向Pi的系统提示符添加指令。 |
| `<agent-dir>/extensions/` | 用户 [扩展](extensions.md)。 |
| `<agent-dir>/skills/` | 用户 [技能](skills.md)及其支持文件。 |
| `<agent-dir>/prompts/` | 用户 [提示模板](prompt-templates.md)作为斜杠命令公开。 |
| `<agent-dir>/themes/` | 用户 [主题](themes.md)文件。 |

##  项目 `.pi` 目录

| 路径 | 职责 |
|---|---|
| `.pi/settings.json` | 项目级 [设置](settings.md)、资源路径及 Pi 包声明。 |
| `.pi/mcp.json` | 项目 [MCP 服务器](mcp.md)。 |
| `.pi/SYSTEM.md` | 替换项目系统提示。 |
| `.pi/APPEND_SYSTEM.md` | 向系统提示添加项目特定说明。 |
| `.pi/extensions/` | 项目扩展。 |
| `.pi/skills/` | 项目技能及其支持文件。 |
| `.pi/prompts/` | 项目提示模板作为斜杠命令公开。 |
| `.pi/themes/` | 项目主题文件。 |

对于 `SYSTEM.md` 和 `APPEND_SYSTEM.md`，受信任的项目文件优先于对应代理目录文件。同名文件不会合并。

##  上下文文件

上下文文件独立于项目 `.pi` 配置。Pi 从代理目录、工作目录及其父目录加载它们。只要 Pi 在其目录或其子目录运行，上下文文件即生效。

一个 `AGENTS.override.md` 仅在相同目录下替换 `AGENTS.md` 或 `CLAUDE.md`，不会抑制代理目录或其他目录的上下文文件。

上下文文件发现无需项目信任。

