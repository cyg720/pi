> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# F08 真实交互终端后端

2026-10-14 UTC。仅实现本目录及 `test/terminal.test.ts`；没有改部署、系统安全设置、根配置或锁文件，没有安装软件/运行网络或付费 API，没有提交。

## 实现

- `manager.ts`：默认禁用；Linux `/usr/bin/script` 分配真实 PTY，固定 `/bin/bash --noprofile --norc -i`，禁止客户端提供 shell、tty 或进程 ID。
- `types.ts`：session 绑定的稳定接口与错误码。
- `screen.ts`：使用已有 `@xterm/headless` 5.5.0 的真实 ANSI parser；屏幕 runs 保留颜色、样式、宽字符位置、光标、normal/alternate buffer、应用方向键与 bracketed-paste 模式。没有 strip ANSI 伪终端。
- `index.ts`：公共导出，HTTP 路由由 server 工作项集成。
- 测试：真实 TTY、双向输入、resize/SIGWINCH、Ctrl-C、exit code、session 隔离、安全参数、配额与清理。

## API

- `new TerminalManager({workspaceRoot, enabled?: false, ...limits})`
- `create(sessionId, cwd, {cols?, rows?}?) -> Promise<TerminalSnapshot>`
- `write(sessionId, id, data) -> Promise<void>`
- `resize(sessionId, id, cols, rows) -> Promise<TerminalSnapshot>`
- `snapshot(sessionId, id)`, `list(sessionId)`
- `subscribe(sessionId, id, listener) -> unsubscribe`
- `close(sessionId, id) -> Promise<TerminalSnapshot>`，幂等；`closeAll()` 永久关闭 manager。

每个读取/写入/resize/close 都核对 sessionId。`TerminalError` 带 code/statusCode。snapshot 不暴露宿主 PID、tty 路径或临时 HOME。

## 边界与资源限制

- server 必须额外保证 loopback、Origin 和 owner/session 鉴权；manager 自己不创建监听 socket。显式开启不可代替上述门禁。
- cwd realpath 必须在批准 workspaceRoot 内，拒绝 symlink 逃逸。此检查只管初始 cwd，不是 OS 沙箱；交互 shell 继承服务进程的 OS 权限。
- spawn 环境仅 PATH、隔离临时 HOME、LANG、TERM、COLORTERM、PS1；不继承 provider keys、NODE_OPTIONS、BASH_ENV、用户 rc。
- fd3 的专用启动握手给出可信 shell PID 和 tty；客户端输入在启动后才开放。tty 必须是本 uid 拥有的 `/dev/pts/<数字>` 字符设备。不能从混合终端输出猜 tty。
- 每次输入最多 64 KiB、待写入最多 256 KiB；默认最多 8 活动终端、保留最多 32 个记录；屏幕 1–300 列、1–120 行、scrollback 500；默认累计输出 4 MiB。
- stdout/stderr 在 ANSI 解析期间暂停形成背压；输出越限终止并显示错误。屏幕订阅合并通知。
- 默认 startup 5 秒、空闲 30 分钟、总时长 2 小时；超时关闭。退出后拒绝输入/resize；重复 close/closeAll 安全。
- 关闭先向受信 shell PID 发 SIGHUP，使交互 bash 清理附属 jobs，再 SIGTERM script；3 秒后兜底杀 script。只发 SIGTERM script 的旧尝试会留下 job，已由回归测试发现并修正。
- 正常 shell 与附属 sleep job 的退出均经 process.kill(pid,0) 返回 ESRCH 验证。不能声称能清除主动 disown/nohup/setsid 逃离终端的进程；本功能不是执行隔离。

## 验证

- `node --test test/terminal.test.ts`：5/5 通过，约 13 秒。
  - stdin/stdout `test -t` 真值、24×80 → 37×113 与 SIGWINCH、Ctrl-C 中断 sleep 返回 130、随后继续输入、exit 7。
  - 默认禁用、非法尺寸、cwd/符号链接越界、跨 session 全操作拒绝、输入/实例限制、多终端独立、敏感环境变量未继承。
  - 真实 ANSI parser：红色宽字符、绝对光标位置、备用屏幕进出、光标显隐。
  - 关闭后 shell 与附属后台 job 均消失；生命周期超时。
  - 输出限额、idle timeout、订阅、重复关闭与 manager 停止后拒绝新建。
- 本目录及测试的 Biome check：5 files，零警告/错误。
- 独立严格 TypeScript：`tsc --ignoreConfig --noEmit --target ES2024 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --allowImportingTsExtensions --types node src/terminal/index.ts test/terminal.test.ts` 通过。
- 完整 server TypeScript 检查曾被并行 adapter 的 RuntimeSnapshot 缺 thinkingLevel/queue 阻塞，未修改其文件。

## 尚待集成

- server 增加精确 runtime 依赖 `@xterm/headless: 5.5.0`（仓库已存在包，仅需正确生产声明）；不新增浏览器 xterm。
- server 路由、owner/origin/loopback 门禁、session 解析与关闭期间 `closeAll`。
- 浏览器消费 screen runs，用 textContent 渲染，处理键码、resize、状态和用户显式启用。不要使用 innerHTML 或假定输出可信。
- F08 整项仍需 HTTP 与浏览器端到端证据；本记录不把后端单元通过当 UI 完成。

## 2026-10-14 02:27 UTC：受信 Node 工具路径复核

- 修复 PATH 仅 `/usr/bin:/bin` 导致云端 Node/npm 不可用：在终端 env PATH 前置 `dirname(process.execPath)`，再拼 `/usr/bin:/bin`。来源是当前服务的可信可执行文件，不是客户端参数或继承 PATH。
- 没有增加任意工具路径，也没有改变 server/协议接口；后续若需额外路径，应新增明确的仅宿主选项，不能透传客户端或全部宿主环境。
- 新增真实 PTY 回归：`node --version` 等于服务进程版本；`node -p process.execPath` 等于当前服务 Node；`command -v npm` 指向同一 Node 安装目录；PATH 精确匹配受信前缀。
- 测试向父进程设置非敏感合成 provider marker 和 NODE_OPTIONS，终端内验证它们以及常见 provider 变量均不存在，只输出布尔结果，不输出任何凭据值。
- 指定终端测试现为 6/6 通过，约 15 秒；未重跑根 check，未修改根配置或锁文件。
