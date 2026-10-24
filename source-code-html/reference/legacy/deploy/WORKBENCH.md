> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# 单机工作台部署与验收

状态：实施中。功能/测试/外部条件以 `docs/workbench/TASKS.md` 为准。本说明不代表已部署生产服务。

## 1. 组成与环境

- 单台服务器运行 Web 静态文件、Node 平台服务及按会话隔离的 Pi worker；不要求 Kubernetes 或独立多机服务。
- Node >=22.19.0；构建工具沿用锁文件中的 TypeScript 7.0.2、esbuild 0.28.2、Biome 2.3.5。
- 全部 npm 依赖按根 package-lock.json 安装，禁止用 `latest` 替换。
- 当前 Pi evals 的 `/workbench` 是源码 TypeScript 窄入口；部署须保留仓库中的 packages/evals/src 与对应依赖，不能只拷贝 server/dist。
- Linux 真正交互终端的可选后端使用系统 `/usr/bin/script`、`/usr/bin/stty`、`/bin/bash`，屏幕解析使用同仓已有版本的 @xterm/headless 5.5.0。默认关闭，不把它当沙箱。
- Windows 可选后端使用固定 node-pty@1.1.0 的 Windows x64 预构建与系统 ConPTY，启动 `cmd.exe /d /q`；本机 Node 24 / Windows build 26200 已实际验证，不外推其他架构。安装仍用 `--ignore-scripts`，不运行依赖生命周期；部署须保留 `apps/agent-server/dist/terminal/windows-worker.js`。
- Linux 容器启用终端时必须使用 init/reaper（例如 Docker `--init`）；无 init 的实际测试中退出作业成为 PID 1 下的僵尸进程，不能按已彻底清理验收。
- 原生 pi-env daemon 如未预置，SSH/daemon/原生 PTY 不能宣称可用。可选 Linux PTY 后端与原生 daemon 分别验收。

## 2. 安装、构建与本地检查

在可信、具备依赖缓存的构建环境执行：

```sh
npm ci --ignore-scripts --offline --no-audit --no-fund
npm run build:offline
npm run check
npm run test:workbench
```

无缓存时，先在获准联网的准备环境下载并审核固定依赖与 Pi 模型目录数据，再转移到内网。`build:offline` 不会自动准备缺失依赖、模型权重或 MCP 服务；`PI_OFFLINE` 也不是网络隔离策略。

Windows PowerShell 使用 `npm.cmd`。Durable 固定命令验收依赖 Git Bash；安装位置不在 Pi 默认搜索路径时，先设置 `$env:PI_WORKBENCH_BASH='E:\software\Git\bin\bash.exe'`（按本机实际路径调整）。这仅指定受控探针的 shell，不开启 Windows PTY。

`test:workbench` 只运行新增工作台目录的指定测试及四个显式列出的原生 TUI 回归文件，不调用上游全量 provider/e2e 测试；每轮使用临时 HOME、白名单环境与 faux provider。报告在 `.artifacts/workbench/test-results.json`，其中浏览器验证单独记载，不能由 Node 测试推定。生产产物烟测依赖前一步已经构建的 dist/main.js 与 dist/worker.js，不会用源码 loader 替代交付物。

## 3. 数据与运行模式

- 设置绝对路径 `PI_WORKBENCH_DATA_ROOT`，它必须在源码仓库之外，且不能通过符号链接指向仓库。
- 默认端口 4317，只绑定回环地址；数据包含工作区、会话、事件、配置和审计。不要放到静态 Web 目录。
- `PI_WORKBENCH_MODE=faux` 是明确的无外部模型测试模式，UI 应标出测试 provider。它不能验证真实模型推理。
- `configured` 模式要求宿主显式提供模型和认证/工作区授权。没有认证提供方时拒绝业务 API；不能为了上线方便去掉验证。
- 外部 HTTPS 模型必须由宿主明确允许目标 origin，凭据仅注入服务端内存；前端不接收或回显凭据。不要使用聊天记录中的旧密钥。
- configured 模型执行路径强制 SSE、逐请求核验 origin，并禁止 HTTP 重定向；模块页里的 WebSocket 参数边界实验不代表该受限生产路径支持 WebSocket。
- 本地模型通过明确的 loopback OpenAI-compatible HTTP 端点接入；模型 ID、API、上下文长度、输出上限及能力须与实际服务一致。兼容协议并不证明所有 thinking/图片/工具功能均支持。
- 宿主可在 capabilities 中显式传入 Pi 的 thinkingLevelMap（须 reasoning=true）：键为 off/minimal/low/medium/high/xhigh/max，字符串为供应商值，null 表示不支持。未声明的 xhigh/max 会按 Pi 默认逻辑降级；必须核对实际 wire 请求，不能只凭界面选择认定该等级生效。映射只来自受信宿主配置，不从聊天请求读取，不自动套用其他模型目录。

开发自检启动示例（faux 模式，不接真实模型）：

本机 PowerShell（本轮实际路径）：

```powershell
$env:PI_WORKBENCH_DATA_ROOT = 'D:\code\CYG\pi-workbench-local-acceptance'
$env:PI_WORKBENCH_MODE = 'faux'
$env:PI_WORKBENCH_TOOLS = 'read,write,edit'
$env:PI_WORKBENCH_NATIVE_SETTINGS = '1'
$env:PI_WORKBENCH_TRUST_PROJECT_SETTINGS = '1'
$env:PI_WORKBENCH_BASH = 'E:\software\Git\bin\bash.exe'
npm.cmd run start:workbench
```

页面为 `http://127.0.0.1:4317/#/coding-agent`。若已有本轮保留的实例，直接访问，不重复启动占用同一 dataRoot。此目录只含专用验收数据。真实 DeepSeek 宿主另在 4318，凭据仅内存；本命令不恢复该远程凭据。

POSIX 示例：

```sh
PI_WORKBENCH_DATA_ROOT=/absolute/path/outside/repository \
PI_WORKBENCH_MODE=faux \
npm run start:workbench
```

本地已安装模型可使用 CLI 的 PI_WORKBENCH_LOCAL_MODEL JSON 明确指定 loopback 端点，并显式设置 PI_WORKBENCH_TRUST_LOCAL_OWNER=1 进入单用户开发模式；未设置该开关或认证回调时 configured 模式业务 API 拒绝匿名。此开发开关不可用于网络反向代理或多用户生产，详细字段见 apps/agent-server/README.md。真实本地模型尚未在本次环境联调。

路径由操作者选择；示例不会自动创建生产凭据、开防火墙或暴露内网监听。配置真实模型/认证需在宿主入口调用 `startServer` 并注入受信配置；实际字段以 `ServerOptions` 和运行时公开类型为准。

需要编程文件工具时由宿主明确设置 `PI_WORKBENCH_TOOLS=read,write,edit`；不设置则无文件工具授权。`PI_WORKBENCH_CODEMODE=1` 与 `PI_WORKBENCH_TERMINAL=1` 分别控制内置代码模式和原生 PTY（Linux/Windows）。终端默认关闭，启用后仍须点击启动；有真实宿主权限，不应向不可信使用者开放。

`PI_WORKBENCH_NATIVE_SETTINGS=1` 启用原生设置读写；项目设置还需 `PI_WORKBENCH_TRUST_PROJECT_SETTINGS=1`。全局设置按用户隔离，项目设置在获授权工作区的 `.pi/settings.json`。修改只影响下一次 runtime 创建，已保存会话仍优先使用自己保存的模型/思考/工具选择。

一期模块配置可以明确执行当前 scope 的保存版本，也可以选择 global→workspace→session 的继承合成模式。后者必须提交读取时的完整 revisionVector；执行中来源改变只返回历史结果，不登记过期回执。它与 coding-agent 原生 global/project 设置是两条有明确说明的应用路径。

## 4. 内网入口与身份

- 回环服务前如放置反向代理，须由操作者配置 TLS、实际身份提供方和访问权限；当前代码不自动改防火墙、系统服务或代理配置。
- Host/Origin 防护防浏览器跨站访问，不能替代用户认证。
- 宿主认证回调返回 Principal 与工作区授权；会话所有者、工作区、配置和终端操作在服务端检查，不能信任浏览器传入的 owner。
- 不为让页面连通而开放通配 CORS、关闭 origin 检查、使用公开静态站点暴露源码/会话或明文凭据。
- 进程分离和路径校验不等于防御恶意代码的 OS 沙箱。启用任意 shell/扩展前应完成独立隔离与权限验收。

## 5. 停止、备份与恢复

1. 停止接收新请求，调用服务 `close()` 或向前台进程发送正常终止信号。
2. 等待 worker 中止、PTY/事件流关闭、配置/审计写入完成，再备份整个 dataRoot。热拷贝不保证跨文件一致性。
3. 备份同时记录源码提交、工作台版本、package-lock 校验、模型端点配置及外部资源版本；凭据另按组织安全流程备份，不写进普通源码 ZIP。
4. 恢复到同样受控且仓外的数据目录，先启动只读/受限验收，再验证会话、配置 revision、文件与归属。
5. 重启时遇到未结束的 run，应记录中断/失败；不得自动再次调用模型或重复工具副作用。

Windows 的 `child.kill("SIGTERM")` 会强制结束 Node。使用带 IPC 的父进程启动 CLI 时，发送 `pi-workbench:shutdown` 并等待退出码 0；父进程 IPC 断开也会触发 close。嵌入宿主直接调用 `server.close()`。不要把强制结束当作已完成停机备份。

恢复到不同目录时，不能直接复制后启动：会话记录与原生 JSONL 头部包含原数据目录的绝对路径。使用离线恢复命令，三个参数依次为停机备份目录、备份时原 dataRoot、尚不存在的新 dataRoot：

```powershell
node --import ./scripts/workbench-source-loader.mjs scripts/restore-workbench.mjs 'D:\backups\pi' 'D:\data\pi' 'D:\data\pi-restored'
```

工具锁定备份，拒绝链接、越界运行时引用、仓内/重叠/已有目标目录；先在临时目录完成复制与校验，再发布新目录。只调整会话路径与原生头部的 cwd/parentSession，正文、消息 ID、文件内容及配置版本保持不变。源码目录和依赖仍须按原部署要求提供；不包含凭据恢复，也不支持跨操作系统路径格式转换。首次启动前按组织要求校验备份来源与权限。

Durable 真实任务另保存私有 `namespace.json`，由授权宿主的运行/恢复操作记录身份与工作区。离线工具验证它与原隔离目录匹配后，将副本目录名迁移到新工作区对应的命名空间；不修改提示词、工具结果及持久任务 JSONL。非空旧目录缺少该元数据时明确拒绝恢复，须先在原授权宿主运行或恢复一次，再停机备份；不能手工猜写身份。实际跨目录验收见接续清单 R16.3e；启动新宿主和只读查看都不会自动续跑未完成的 Durable 任务。

## 6. 升级与回退

- 在独立源码目录构建新版本，先跑固定依赖、工作台定向测试及浏览器验收。
- 停机备份数据后切换运行版本。保留前一版源码/锁文件/静态构建和完整数据备份。
- 如果数据格式发生变化，必须有迁移和恢复测试；不直接用旧程序打开已不可逆升级的数据。
- 原一期 R09 独立目录与线上静态预览目前保留，迁移开发不自动覆盖它。

## 7. 验收口径

- HTTP/SSE、原生 Pi faux worker、队列/取消/恢复、权限和文件冲突必须有实际测试。
- 真正终端另测 TTY、交互输入、resize/SIGWINCH、Ctrl-C、退出码及后台进程清理；屏幕解析不等于所有全屏应用均验收。
- 浏览器必须与实际服务可互通，检查四个面板、布局、键盘、窄屏、中英文和刷新恢复。
- 旧云端报告中的 loopback 隔离已在本机环境复核：真实浏览器可以连接 4317/4318；具体页面与模型证据见 `docs/workbench/LOCAL-TAKEOVER-TASKS.md`，尚未勾选的视觉/交互项仍待验收。
- 真实供应商、离线本地模型、SSH、MCP OAuth、GPU/模型权重等按具体端点单独验证。未提供端点/授权的项目保留“未验证”。
