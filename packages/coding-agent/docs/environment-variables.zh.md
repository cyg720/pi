# 环境变量

Pi 通过三种方式使用环境变量：

- `PI_OFFLINE` 等变量用于配置 Pi 进程。
- Pi 设置进程标记，让子进程能识别启动它的智能体是 Pi。
- LLM 可调用的 shell 工具执行命令时，会获得描述当前会话的 `PI_*` 变量。

提供商 API 密钥变量单独记录在[提供商](providers.md#use-an-api-key-from-the-environment)文档中。

## 进程标记

CLI 和 RPC 入口设置两个进程标记：

- `AI_AGENT=pi` 是通用标记，让工具能识别启动进程的智能体是 Pi。
- `PI_CODING_AGENT=true` 是 Pi 专用标记，让子进程能检测自己运行于 Pi 内部。

子进程继承这两个标记。它们不与特定会话绑定；通过 SDK 嵌入 Pi 时，不会自动设置。

## Shell 工具的会话环境

`bash` 和 `powershell` 工具运行的命令会获得当前 Pi 会话状态：

| 变量 | 描述 |
|----------|-------------|
| `PI_SESSION_ID` | 当前会话 ID |
| `PI_SESSION_FILE` | 当前会话 JSONL 文件的绝对路径；临时会话不设置此变量 |
| `PI_PROVIDER` | 当前选择的模型提供商 |
| `PI_MODEL` | 当前选择的模型 ID |
| `PI_REASONING_LEVEL` | 当前生效的推理级别：`off`、`minimal`、`low`、`medium`、`high`、`xhigh` 或 `max` |

变量值在每次命令启动时解析。因此，切换模型或修改推理级别会影响下一条 shell 命令，无需重启 Pi。`PI_PROVIDER` 和 `PI_MODEL` 标识 Pi 中选择的模型，而不是路由器内部可能选择的其他上游模型。

被问及正在运行哪个模型或提供商时，请检查这些变量，不要根据系统提示词推断：

```bash
printf '%s/%s\n' "$PI_PROVIDER" "$PI_MODEL"
printf 'reasoning=%s session=%s\n' "$PI_REASONING_LEVEL" "$PI_SESSION_ID"
```

持久会话可以直接检查会话文件：

```bash
if [ -n "$PI_SESSION_FILE" ]; then
  tail -n 1 "$PI_SESSION_FILE"
fi
```

这些变量被注入 LLM 可调用的 `bash` 和 `powershell` 工具。它们不会注入用户输入的 `!` 或 `!!` 命令。

### 自定义 Shell 工具

通过 `createBashTool()` 或 `createPowerShellTool()` 创建的工具注册到 Pi 后，默认暴露会话环境。注入发生在 `spawnHook` 之前，因此钩子可以通过 `ctx.env` 获得这些变量：

```typescript
const bashTool = createBashTool(cwd, {
  spawnHook: (ctx) => ({
    ...ctx,
    env: { ...ctx.env, CI: "1" },
  }),
});
```

会话元数据可以独立于进程启动钩子禁用：

```typescript
const powershellTool = createPowerShellTool(cwd, {
  exposeSessionEnvironment: false,
  spawnHook: (ctx) => ctx,
});
```

禁用时，Pi 会移除这些变量的继承值，避免嵌套的 Pi 进程暴露过时的父会话元数据。

## Pi 进程配置

以下变量由 Pi 本身读取：

| 变量 | 描述 |
|----------|-------------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录；默认为 `~/.pi/agent` |
| `PI_CODING_AGENT_SESSION_DIR` | 覆盖会话存储位置；会被 `--session-dir` 覆盖 |
| `PI_PACKAGE_DIR` | 覆盖包目录，适用于 Nix/Guix 存储路径 |
| `PI_OFFLINE` | 禁用自动网络活动，包括模型目录刷新 |
| `PI_SKIP_VERSION_CHECK` | 禁用对 `pi.dev` 的最新版本请求 |
| `PI_TELEMETRY` | 覆盖安装/更新遥测及提供商归属请求头设置：`1`/`true`/`yes` 或 `0`/`false`/`no` |
| `PI_CACHE_RETENTION` | 设置为 `long`，在支持的提供商上延长提示词缓存保留时间 |
| `PI_SHARE_VIEWER_URL` | 覆盖 `/share` 使用的基础 URL |
| `PI_RADIUS_GATEWAY` | 覆盖 `/bug` 上传和 Radius 中继连接使用的 Radius 网关源地址 |
| `PI_HARDWARE_CURSOR` | 设置为 `1` 以显示硬件光标；参见[终端设置](terminal-setup.md) |
| `PI_HYPERLINKS` | 使用 `1`、`0` 或 `auto` 覆盖 OSC 8 超链接检测 |
| `PI_IMAGE_PROTOCOL` | 使用 `kitty`、`iterm2`、`none` 或 `auto` 覆盖内嵌图片检测 |
| `PI_TRUE_COLOR` | 使用 `1`、`0` 或 `auto` 覆盖真彩色检测 |
| `PI_TUI_ESC_TIMEOUT` | 单独收到 ESC 后，等待多久才将其视为 Escape，单位为毫秒；SSH 环境默认为 `100`，其他环境默认为 `10`。如果 Alt 组合键被误读为 Escape，请增大此值 |
| `VISUAL`、`EDITOR` | 未设置 `externalEditor` 时使用的外部编辑器回退选项 |
| `HTTP_PROXY`、`HTTPS_PROXY` | 为出站 HTTP 请求设置代理 |

`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等提供商凭据和提供商专用配置列在[提供商](providers.md#use-an-api-key-from-the-environment)文档中。
