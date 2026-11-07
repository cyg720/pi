# Pi 项目记忆

- 2026-10-27：原型已选文件/文件夹标签移到输入框外上方，左对齐、可换行，空时隐藏；新会话与已有对话一致。浏览器核对位置与移除正常，语法通过；根 check 仍被既有入口依赖错误阻断。

## 审查原型宽度（2026-10-27）

- 审查准备、执行和报告页统一 1100px 上限并居中，与项目总览一致；底部配置/输入区同宽，智能体、模型、思考等级左侧横排。文件分栏按可用空间收缩。
- 浏览器验证三类页 1100px、报告分栏 340px 无横向溢出；语法通过，无浏览器 error。根 check 仍停在既有入口依赖图错误。仅原型及说明变更。

用于后续任务的项目导航、依赖准备和验证。最后核实：2026-11-07，工作目录 `D:\code\CYG\pi`，分支 `LG-Workbench`，最新提交以 `git log -1` 为准。本文件记录事实，不替代根目录 [AGENTS.md](../AGENTS.md)；分支、工具版本和安装状态需在后续任务中重新确认。当前依赖已安装、模型数据已生成，根目录完整构建及构建后 CLI 启动检查已通过。

## 工作约定

- 用户此前要求的依赖安装与构建已完成。后续目标已明确为单用户、本地部署、Web 优先的智能体平台，首个智能体为 `lg-codeing-agent`；具体 1.0 范围见本文末尾与 `PRD/产品构思/`。
- 用户要求先查接口、对齐边界、制定计划、验证后修改，保持简洁中文沟通。问题先回答，收到反馈先说明同意或不同意。
- 修改前完整阅读目标文件；优先复用已有接口。删除有意设计的功能或代码须先确认。
- 不擅自提交，不切换分支，不清理其他会话的改动。开始和结束工作均检查 `git status --short`。
- 本次安装构建开始前，工作区已有未提交改动：`AGENTS.md`（M）、`.pi/PROJECT_MEMORY.md`（??）和 `source-code-html/`（??）。保留其他会话的改动，不要清理或提交。
- 代码改动后必须运行完整 `npm run check`；新增或修改的测试必须运行。不得自行运行 `npm run build`、`npm test` 或完整 Vitest 套件。
- 本分支不是 `main`，按当前 AGENTS.md 不添加 changelog。若后续目标转为 main，重新核对规则。

## 仓库与包结构

这是 ESM TypeScript monorepo，使用 npm workspaces 和根目录 `package-lock.json`。根包版本 `0.0.3`，当前 11 个一级包版本均为 `1.4.0`；不能用根包版本代替 CLI 版本。

| 目录 | 职责 | 直接内部运行时依赖 |
| --- | --- | --- |
| `packages/telemetry` | 遥测契约、适配器及类型 schema | 无 |
| `packages/chord` | 插件宿主、契约、状态复制与 JSON RPC | telemetry |
| `packages/ai` | 多提供商模型 API、认证、模型信息 | telemetry |
| `packages/agent` | Agent 循环、工具调用及状态；包名为 `pi-agent-core` | ai |
| `packages/tui` | 终端组件、差异渲染及原生平台能力 | 无 |
| `packages/codemode` | 基于 QuickJS/WASM 的 JavaScript 工具执行沙箱 | 无 |
| `packages/mcp` | 独立 MCP 客户端、传输及 OAuth | 无 |
| `packages/coding-agent` | CLI、会话管理、SDK、交互/print/JSON/RPC 模式 | agent、ai、codemode、mcp、tui |
| `packages/durable` | 持久化会话、任务、文档及存储适配器 | chord、ai、codemode、telemetry |
| `packages/env` | Durable 的远程执行客户端及 Rust daemon | chord、durable |
| `packages/evals` | 私有评测包；普通测试与模型评测分开 | 无；开发依赖 ai、coding-agent |

表中关系来自各包 `package.json`，不是推测出的运行链。尤其不要将 Durable 直接当作当前 CLI 的底层：coding-agent 未声明 durable 运行时依赖。

根 workspace 还列出 `apps/*` 和五个扩展示例包；当前 checkout 没有 `apps/`。README 的包表不是完整包清单。

## 实现入口与阅读路径

- CLI：`packages/coding-agent/src/cli.ts` 调用 `cli/setup.ts` 和 `main.ts`；模式实现位于 `src/modes/`。
- 会话：`packages/coding-agent/src/core/agent-session.ts`、`agent-session-runtime.ts`、`agent-session-services.ts`、`session-manager.ts`；SDK 入口 `core/sdk.ts`。
- 工具与扩展：`packages/coding-agent/src/core/tools/`、`core/extensions/`；设置和模型配置集中在 `core/settings-*`、`model-*` 等文件。
- Agent 基础层：`packages/agent/src/agent.ts`、`agent-loop.ts`、`types.ts`。
- AI 边界：`packages/ai/src/index.ts` 是无副作用核心入口；provider 工厂在 `providers/*`，API 实现在 `api/*`，旧全局接口在 `compat`。新增功能应保持入口隔离。
- Durable：`packages/durable/src/index.ts`、`harness/`、`session/`、`storage/`；存储公开入口包括 memory、JSONL、SQLite、IndexedDB。
- 包资源路径使用 `packages/coding-agent/src/config.ts` 的 helper；不能直接依赖 `__dirname`。
- 总体行为读 [how-pi-works.md](../packages/coding-agent/docs/how-pi-works.md)：活动会话分支组成上下文，模型回复可触发工具调用，工具结果进入下一轮；会话以带父节点关系的 JSONL 保存。
- 具体接口先读 [文档索引](../packages/coding-agent/docs/index.md)，再按任务阅读 `sdk.md`、`extensions.md`、`rpc.md`、`settings.md`、`session-format.md` 等全文及实现，不凭本文猜参数。

## 依赖与编译约束

以下为仓库声明的版本；依赖已于 2026-10-24 按此清单安装（见本机环境快照）：

| 类别 | 版本 |
| --- | --- |
| Node 最低要求 | `>=22.19.0` |
| TypeScript / Node 类型 | `7.0.2` / `22.19.19` |
| Biome / esbuild | `2.3.5` / `0.28.2` |
| Vitest | `4.1.12` |
| TypeBox | `1.3.27` |
| OpenAI / Anthropic SDK | `7.19.0` / `0.129.0` |
| Google GenAI / Bedrock SDK | `2.21.0` / `3.1127.0` |
| undici / quickjs-wasi | `8.10.2` / `3.6.2` |

- 所有 registry 直接依赖（含内部包）固定精确版本；`.npmrc` 设置 `save-exact=true`、`min-release-age=2`。README 中“内部依赖保持范围版本”的表述与当前清单、检查脚本和 AGENTS.md 不一致，以后者为准。
- 安装使用 `npm install --ignore-scripts`；干净安装使用 `npm ci --ignore-scripts`。本机 PowerShell 改用 `npm.cmd`。不要擅自运行生命周期脚本。
- 依赖元数据变动后用 `npm install --package-lock-only --ignore-scripts` 更新锁；CLI 安装锁由 `scripts/generate-coding-agent-install-lock.mjs` 生成，新生命周期依赖须审查并显式允许。
- 更新 undici 前必须阅读目标版本发布说明，评估行为影响；本轮未更新任何依赖。
- `tsconfig.base.json`：ES2024、strict、erasableSyntaxOnly、verbatimModuleSyntax；根检查配置覆盖为 NodeNext。源码相对导入使用 `.ts`，构建时重写扩展名。
- 禁止动态/内联 import、enum、参数属性等需 JS 转换的语法；除绝对必要外不用 `any`。Biome 没有启用 `noExplicitAny`，但这不放宽 AGENTS.md 的要求。
- `tsconfig.json` 的 paths、`vitest.base.ts` 的别名和源码 resolver 各有作用；直接运行 Node 不会自动应用 tsconfig paths。
- 源码启动脚本通过 `src/experimental/source-resolver.ts` 注册 Node resolve hook，将内部包指向源码，避免加载旧 dist。
- `packages/ai/src/models.generated.ts` 不可手改；修改生成脚本后再生成。`src/providers/data/` 是被忽略的生成数据，不要提交，也不要在 Git 历史中寻找。
- 全新 checkout 未生成 `src/providers/data/` 时，`tsc --noEmit` 会因缺失 JSON 模块失败，先执行 `npm.cmd run hydrate:model-data`。`check:browser-smoke` 对缺失 catalog 有容错，不能据此判断数据已就绪。

## 本机环境快照

2026-10-24 环境记录（含后续安装构建复核；不同工具宿主需分别识别）：

| 项目 | 实测 |
| --- | --- |
| DSH `pwsh` 工具宿主 | Windows PowerShell `5.1.26100.9444`（Desktop），`pwsh.exe` 不在 PATH。只能用 PS 5.1 语法，`??`、`&&`、`-Parallel` 等会解析失败 |
| Codex `exec_command` 工具宿主 | 本次安装构建实测 PowerShell `7.6.5`；不要将 DSH 宿主限制套用到所有终端 |
| Node | `v24.18.0`，满足仓库最低版本 |
| npm | `npm.cmd --version` 为 `11.16.0`；`npm` 走 `npm.ps1` 会被 RemoteSigned 策略拒绝，统一用 `npm.cmd` |
| Git | `2.55.0.windows.2` |
| Git Bash | `E:\software\Git\bin\bash.exe`，`5.3.15(1)-release` |
| npm 依赖 | 已安装；本次 `npm.cmd install --ignore-scripts` 退出 0，报告 changed 2 packages、audited 319 packages；package.json 和 package-lock.json 均无 Git 差异 |
| npm 漏洞 | `npm ci` 报告 6 个（2 moderate、4 high）。`npm audit --omit=dev` 报 3 个 high：`undici@8.10.2`（可升 8.12.3）、`zod@3.25.76`（建议 4.6.6，跨大版本）、`@anthropic-ai/sandbox-runtime@0.0.26`（经 zod）。本轮未改依赖 |
| 模型数据 | 已生成：`npm.cmd run hydrate:model-data` 成功写入 `packages/ai/src/providers/data/`（43 个 JSON + manifest），`check:model-data` 通过 |
| TUI Windows 预构建 | `native/win32/prebuilds/win32-x64/win32-platform.node` 已实测 `require` 加载成功，导出 `enableVirtualTerminalInput,isModifierPressed,getText,setText,getImage` |
| 其他工具 | `rg` 15.1.0（WinGet）可用；cargo、rustc、clang、gcc、tmux、fd、pwsh 未找到 |
| 用户/临时目录 | 用户 `18010`；`TEMP` 为 `C:\Users\18010\AppData\Local\Temp`（不要假设 `C:\Users\Administrator`） |
| Git 远端 | origin 为 `cyg720/pi`，upstream 为 `earendil-works/pi` |

PowerShell 下 `npm` 优先匹配 `npm.ps1`，因脚本未签名而被当前 RemoteSigned 策略拒绝；`npm.cmd` 可用，无需修改系统策略。`NoDefaultCurrentDirectoryInExePath=1`，`cmd /c "pi-test.bat ..."` 找不到当前目录的批处理，需用绝对路径；PowerShell 中 `.\pi-test.bat` 正常。

PATH 中首先匹配的 `bash.exe` 位于 WindowsApps，不能据此认定它是 Git Bash 或可用的 WSL。当前 Git 安装在 E 盘；需要 Git Bash 时显式使用上表路径。Pi 的 Bash 发现顺序见 [windows.md](../packages/coding-agent/docs/windows.md)，必要时按该文档配置 `shellPath`；本轮未修改用户配置。

`pi-env` daemon 使用 Rust 2024 edition，单独通过 `packages/env` 的 `build:daemon` 构建；常规 TypeScript 包构建不负责生成它。TUI 原生模块重编译另需 Visual Studio C++ workload 或文档指定的 MinGW 工具链。

## 验证状态与 Windows 限制

依赖安装和模型数据准备已完成。2026-10-24 实测结论：

- `npm.cmd run check` 在 Windows 上不能整链通过，失败点是 `check:entry-graphs`，与代码无关：
  `scripts/check-entry-graphs.mjs` 用 `path.relative()` 得到反斜杠路径，而预算的 `forbid`/`allow` 文案用正斜杠（第 153、162 行）。表现为 `packages/ai` 的 `./models` 被判定 “must not reach index.ts: packages\telemetry\src\index.ts”。用正斜杠归一化的临时副本运行通过，说明预算本身达标；同时说明 Windows 上 `forbid` 的正斜杠模式会静默失配。
- 完整 check 除 entry-graphs 外的步骤已分别通过：`biome-check --write`（1546 文件，无修复）、`check:pinned-deps`、`check:runtime-deps`、`check:ts-imports`、`check:install-lock:coding-agent`、`tsc --noEmit`、`check:browser-smoke`。
- `npm.cmd run test:scripts`：48/49 通过。失败项 `scripts/local-package-install.test.mjs` 用 `spawnSync("npm", ...)`；Windows 只有 `npm.cmd`，报 `spawnSync npm ENOENT`。`scripts/npm-audit.mjs` 也用裸 `npm`，Windows 上会同样失败。
- `packages/durable` 的 test 脚本含 `PI_DURABLE_DOCUMENT_RETENTION_MS=0 vitest --run`。npm 默认 `script-shell` 为 null、`ComSpec` 为 `cmd.exe`；`cmd` 对 POSIX 赋值语法报 “not recognized”。因此 Windows 下该 workspace 的 `npm test` 不能直接运行。
- 指定测试已通过：telemetry（5/5）、ai 模型测试（1/1）、coding-agent suite harness（15/15，离线 faux provider）、tui node 测试（4/4）。
- 源码 CLI 可启动：PowerShell 中 `.\pi-test.bat --help` 退出 0，输出 195 行帮助。依赖真实模型/API key 的 `--print` 路径未验证。
- 用户明确要求构建后，`npm.cmd run build` 已通过：10 个目标包编译完成，模型数据生成及校验成功，CLI bundle 为 82 个文件、8.8 MiB。该根构建不包含 Rust daemon、原生模块重编译或独立可执行文件打包。
- 构建后 `node packages/coding-agent/dist/bundle/cli.js --version` 与 `node packages/coding-agent/dist/cli.js --version` 均返回 `1.4.0`；bundle 的 `--help` 退出 0。
- 完整 `./test.sh` 和 `npm test` 未运行；上面的 check 与测试限制仍保留，本次构建成功不表示这些问题已修复。本次未修改代码或锁文件，未重跑完整 check。

常用命令与边界：

- Windows 源码 CLI：根目录 `.\pi-test.bat --help`；它启动 PowerShell 包装脚本，预加载源码 resolver。`pi-test` 是 CLI 启动器，不是单元测试入口。
- 指定 Vitest：切换到目标包目录后执行 `node D:/code/CYG/pi/node_modules/vitest/dist/cli.js --run test/<具体文件>.test.ts`。`test/suite/` 下的文件路径要带 `suite/`，否则报 “No test files found”。先读测试，避免选择依赖真实服务的 e2e。
- TUI 指定测试：在 `packages/tui` 下执行 `node --test test/<具体文件>.test.ts`。
- 全部非 e2e 测试走根目录 `./test.sh`；该脚本隔离 HOME、临时目录和凭据环境，再运行工作区测试。它不是完全断网保证，且 npm 子脚本在 Windows 仍走 cmd.exe。
- 完整 check 或入口图检查在 Windows 失败时，先区分上述路径分隔符误报，不要据此修改入口或预算。若后续获准修改该脚本，把图路径统一为 `/` 即可同时修复误报和 `forbid` 静默失配。
- `coding-agent/test/suite/` 必须使用 `harness.ts` 和 `packages/ai/src/providers/faux.ts`，禁止真实 API、网络请求、密钥或付费 token；见 [suite 说明](../packages/coding-agent/test/suite/README.md)。
- 交互测试先读 [.pi/skills/interactive-testing.md](skills/interactive-testing.md)；发布任务先读 [.pi/skills/release.md](skills/release.md)。
- 当前 CI 使用 Ubuntu + Node 22，安装系统图形库、fd、rg 后安装依赖，再构建、检查、构建 daemon、测试；CI 命令不覆盖本地 AGENTS.md 对执行权限的约束。
- 依赖更新（尤其 undici 8.10.2→8.12.3、zod 3.25.76→4.x）需按 AGENTS.md 阅读发布说明并单独评估；本轮未改 lockfile。

## 本轮验证记录

| 检查 | 结果 |
| --- | --- |
| `npm.cmd ci --ignore-scripts` | 通过，298 包，退出 0；报告 6 个漏洞（含生产依赖问题见上） |
| 本次 `npm.cmd install --ignore-scripts` | 通过，changed 2 packages、audited 319 packages；仍报告 2 moderate、4 high，未自动升级 |
| 本次 `npm.cmd run build` | 完整通过，含模型生成、10 个包编译及 CLI 打包；未产生受跟踪源码或锁文件差异 |
| 构建后 CLI `--version` / `--help` | bundle 与 unbundled 的版本均为 `1.4.0`，bundle 帮助输出正常，退出码均为 0 |
| 本次安装锁校验、`git diff --check` | 通过 |
| `npm.cmd run hydrate:model-data` | 通过，43 个 provider JSON + `.manifest.json`；1598 tool-capable、1351 reasoning |
| `npm.cmd run check:model-data` | 通过 |
| `npm.cmd run check`（完整链路） | 失败于 `check:entry-graphs`，仅 Windows 路径分隔符误报；前面各步骤通过 |
| `check` 的其余独立步骤 | `biome --write`（无改动）、pinned-deps、runtime-deps、ts-imports、install-lock、`tsc --noEmit`、browser-smoke 全部通过 |
| entry-graphs 正斜杠归一化临时副本 | 通过，证明预算本身达标 |
| `npm.cmd run test:scripts` | 48 通过、1 失败（`local-package-install` 裸 `npm` spawn ENOENT） |
| 指定测试：telemetry / ai / coding-agent suite / tui | 5+1+15+4 个测试全部通过 |
| `.\pi-test.bat --help` | 退出 0，195 行帮助 |
| TUI `win32-platform.node` 加载 | 通过，导出原生函数 |
| `npm audit --omit=dev` | 3 个 high：undici、zod、@anthropic-ai/sandbox-runtime；未处理 |
| `./test.sh`、`npm test` | 未运行（规则或 Windows 限制） |

## 记忆维护

任务结束后只补充已验证、会影响后续决策的信息：稳定的模块边界、接口入口、环境解决办法、必要验证命令及结果。注明日期和条件，用新结论替换过期状态，不累积聊天流水或凭据。接口细节以当前源码、依赖类型及文档为准。

## 离线源码导览维护（2026-10-24）

- 当前导览位于根目录 `source-code-html/`，入口 `index.html`；生成命令 `node source-code-html/build.mjs`，定向回归 `node --test --test-isolation=none source-code-html/*.test.mjs`（含图和课件同步的 73 项通过）。旧 `docs/doc-html` 路径不适用于此 checkout。
- 导览按实际文件识别当前模块；当前无工作台 apps，不能从 LG-Workbench 分支名推断存在。旧 2026-10-20 workbench-dev 完整导览在 `source-code-html/history/workbench-2026-10-20.html`，缺失历史资料在 `reference/legacy/`。
- 稳定编号源文件现在是 `source-code-html/reference/pi-feature-catalog.zh.md`。业务源码与 Git 索引自动刷新，中文语义仍需维护；源码哈希变化的目录说明保留待复核。
- 2026-10-24 后续更新已重制五幅图和八份可编辑 PPTX（132 页），并接入内嵌下载。旧图在 `diagrams/original`，旧课件在 `history/learning-slides-2026-10-17`。图规格在 `src/diagrams`，`update-diagrams.mjs` 生成；课件由 `src/slides.mjs` 从同一份课程转换，`build-slides.mjs` 生成候选，再经演示文稿验证器和逐页检查后交付。
- `build.mjs` 不再覆盖当前图，先核验图的源码、规格、原始交付与离线封装指纹；PPTX 按源码基线、课程和正文转换指纹判断过期。五图通过确定性检查；132 页课件结构、字体、尺寸、重新导入正文/备注比对及逐页渲染复核通过。浏览器工具拒绝 file://，真实浏览器视觉与图内导出未验收；未实测原生 PowerPoint。详见 `source-code-html/VALIDATION.md`。
- 本轮完整 check 重现 Windows entry-graphs 路径问题；安装锁、tsc 和 browser-smoke 单独通过，未改业务源码、依赖或锁文件。

## 跨行业智能体平台方案（2026-10-24）

- 用户明确平台面向各行各业；1.0 单用户、本地私有化部署、直接调用云端模型 API，优先 Web，不建设权限、账号、角色或审批模块；桌面、手机、多用户后续再扩展。首个内置智能体按用户拼写命名 `lg-codeing-agent`。
- `PRD/产品构思/AGENT-EXTENSION-PLAN.md` 已整体重写为 1.0 产品方案，`TECHNICAL-REVIEW.md` 已重写为编码智能体技术实施说明。仅修改文档，没有实施平台。
- 在 HEAD `136b87e8a` 再次确认：当前仓库无 `apps/`、`agent-runtime-adapter`、`agent-protocol` 和工作台脚本。参考方案来自另一目录 `D:\code\CYG\pi-workbench-source`，其已有工作台不能当作本仓库能力。
- 用户已明确并确认采用 `pi-durable`，不再保留运行时选型阶段。其 storage 单进程所有且无跨进程锁，watch 重连以快照恢复。产品恢复测试仍属于实施验收，不是重新选型的前置条件。
- 文档采用用户允许的直接重写路线：新建 `lg-codeing-agent`，基于 Durable 的公开接口和编码工具，参考当前 coding-agent 的工作流程；保留原包，不接旧 SDK/RPC。Durable 已有 `test/examples/25-coding-agent.ts` 和 `src/tools/index.ts`，后者默认包含 read/write/edit/bash，PowerShell 需单独注册；示例使用 MemoryStorage，产品计划用 SQLite。
- `Agent.subscribe()` 等待异步监听器；不得在监听器内等待同一个 Agent 的 `waitForIdle()`。内存凭据仓也不等于关闭环境认证，需检查 `createModels` 的 `authContext` 与 provider 行为。
- 定向验证：`packages/agent/test/agent.test.ts` 41 通过；Durable `harness-tools-recovery.test.ts` 按 `unsafe tool interrupted|both the stored|reruns beforeTool` 筛选 3 通过、6 未选中。仅模拟流/faux、本地 SQLite close/reopen；不代表生产故障注入或负载验收。本轮未运行 build 或完整 check。
- 后续任务拆分已写入 `PRD/1.0/`：`01-功能清单.md`、`02-开发任务.md`、`03-验收用例.md`，共 14 项界面功能、19 项后台功能、28 项待开发任务、25 组待执行验收。每项任务列前置、拟改文件、实现内容和验收编号；用户明确本轮仅写文档，不实施代码。
- 本次任务拆分在 HEAD `de21da3f8dc94578db1d7ce283a7c47e7abf61c5` 复核：仍无工作台 apps，根 TypeScript 检查未覆盖 apps；计划中的五个模块和文件名属于拟新增。恢复方案对已开始但结果不明的写操作先待核对，不能把实际尚未产生效果推断为可安全重跑。
- 同一 HEAD 的源码复审已直接修正 `PRD/1.0` 三文档：工具必须注入 env；工具默认并行，队列默认 one-at-a-time；read 也未默认声明 replay safe；abort 默认不含后台压缩；requestId 不比较正文；watch 仅挂活动上下文与内置 docs。平台需补完整历史、归档日志、稳定任务标识、控制请求去重与核对流程。源码依据已列在开发任务第 8 节；仍仅文档，所有产品验收待执行。

## 1.0 模型设置范围补充（2026-10-25）

- 用户要求将 packages/ai 已接入的全部厂商加入本版界面，在一页配置多家连接和多个常用模型；仍只改 PRD，不实施代码。已同步 `PRD/1.0` 三文档，保留 28 项任务、25 组验收，细化模型、认证与页面子步骤。
- 在 HEAD `de21da3f8dc94578db1d7ce283a7c47e7abf61c5` 核实 `providers/all.ts` 的 builtinProviders 共 42 项，含厂商、网关、地区/产品版本与纯动态 Radius。静态 getBuiltinProviders 和生成 JSON 数量不能用作实际接入覆盖清单。
- 认证不局限于 API Key：包含 OAuth、Bedrock、Vertex、Azure、Cloudflare 专用配置；厂商授权不属于平台账号权限模块。Models.login 会持久写入所注入的 CredentialStore 并返回凭据，Web 接口必须截留返回凭据；默认存储为内存，平台要提供本地适配。logout 删除保存凭据不等于禁用环境认证，平台须显式控制。
- 首版每个 provider ID 一份生效连接，可同时配置多家并选多个模型。保存不自动生成；checkAuth 不等于远端调用验证。42 项界面/配置测试与实际厂商连接验证分开记录，未实连不能写已验证。
- 本轮文档校验通过：42 项清单与工厂一致、8 项双认证与源码一致、28 项任务依赖无环、25 组验收编号及相对链接有效。只做文档检查，未运行产品测试或真实模型调用。
- `PRD/产品构思/AGENT-EXTENSION-PLAN.md` 与 `TECHNICAL-REVIEW.md` 已同步上述模型需求：产品行为、认证边界、保存/验证区别、开发顺序及验收一致；完整厂商清单与任务细节统一链接到 `PRD/1.0`。

## 1.0 第二个内置智能体 lg-examine（2026-10-25）

- 用户确认将 lg-examine 纳入 1.0，基于 pi-durable，独立包/身份/指令/工具/会话，可单独审查文本或引用已结束任务；与 lg-codeing-agent 并列，共用平台、模型连接及同项目唯一 Harness。只更新产品构思两文档和 PRD/1.0 三文档，未实施代码。
- 现有编号保留，新增 U15—U19、H20—H25、T29—T38、A26—A35；现共 19 项界面、25 项后台、38 项任务、35 组验收。T26 等待审查后端 T36，T27 等待审查页面 T37，T38 汇总专项，T28 最后验收双智能体。
- 首批审查本地文本/代码/差异/任务与检查记录，手动发起审查和整改复核，不做自动派单、自动修复或循环互审；两个智能体均不默认接入 codemode。默认只读，检查只能引用用户登记的 checkId，在独立工作副本执行；副本不是 OS 沙箱，不承诺恶意脚本隔离。
- 在 HEAD de21da3f8dc94578db1d7ce283a7c47e7abf61c5 核实：AgentChange 可选 extensions/tools 对象；未指定扩展时可能默认选全部已安装项，modelTools 仅控制提供给模型的工具。计划显式固定会话身份和启用清单，限制直接/嵌套/延迟调用，不靠提示词隔离。
- 审查保存标准版本、材料快照、证据、问题和版本报告；结论为通过/不通过/暂不能判定。证据不足不能通过，整改后新建轮次，历史报告不覆盖。等待确认结束执行并释放项目，确认后重新取材；恢复检查快照/预算/未完成命令，报告引用证据纳入备份保留。模拟流程测试与真实模型发现能力验收分开。
- 文档验证通过：五文档的编号/66 个链接有效，38 项任务依赖无环，42 项模型清单未丢失；T30 显式等待差异/结果来源，T10 将公共命令执行与进程跟踪规划在 R，避免 E 依赖 A。未创建 lg-examine 包，未运行产品测试、构建或真实模型调用。

## 双智能体文档源码复审（2026-10-25）

- 同一 HEAD de21da3f8dc94578db1d7ce283a7c47e7abf61c5 再查：control.addTools 能扩展启用清单；缺失扩展/工具名称可被略过，registry 可替换同名扩展；safe 工具从 execute 检查点恢复不再调用 beforeTool。计划补齐固定清单、版本指纹、工具执行/宿主入口校验和返回控制校验；不把受信内置工具隔离描述为恶意插件沙箱。
- Harness 的 models 是 Models 或无参数工厂；env 参数含 conversationId。公开 ProviderDoc.sessionId 随生成/压缩请求传入 Models，可供平台建立轮次映射；延迟轮询不传此值，1.0 计划关闭 stream.deferred。模型适配仍须保持 streamSimple 同步返回流，预算提交放异步转发前，不能改成 Promise 接口。
- Durable 任务结束会退休任务级文档；watchDoc 不创建缺失文档，可能返回 undefined。审查长期数据规划用项目级/会话级文档，建轮时初始化并保存请求结果；记录工具按宿主解析的轮次与工具 API 的 conversationId/taskId/callId 保存幂等回执，先查回执再验预期版本。
- 一轮对应一个新 ownerless 会话，复核不复用/fork 旧上下文；草稿续查用 parentRoundId，正式复核另带 parentReportId。审查运行中补充先留草稿，不进入 steer/followUp；模型仅保存候选结果，宿主确认主任务/后台任务/进程/队列全部收尾后发布，停止与发布串行校验。检查每轮每项最多启动一次，分别使用新副本；未知效果核对后结束旧执行，再由用户另开轮次。
- submit/wait/abort 会开启整个 Harness 调度，恢复必须先查全项目会话并建立工具/模型入口检查；不能只检查当前会话。检查输出与生成证据须独立归档，不能随副本和普通日志清理。
- 已直接修正产品构思两文档和 PRD/1.0 三文档，补齐检查配置/限额页面、公共模块回接及 A26—A35 故障场景。文档校验通过：38 项任务依赖无环，35 组验收、19 项界面、25 项后台编号完整，86 个本地链接有效，42 个 provider 与工厂清单一致。仅文档及项目记忆修改；没有实施产品代码或运行产品测试、构建、真实模型调用。

## 项目与智能体分离、同项目并发（2026-10-25）

- 用户纠正：页面应有新建项目，项目与平台专业智能体独立；同一个项目可让多个智能体同时参与。此要求替代此前“同项目只允许一个会话执行”的计划限制。项目保存名称/目标/工作目录；平台统一登记智能体定义，会话引用 projectId + agentId；不复制定义进项目，也不新增账号权限或自动派单。
- 五文档已同步：独立项目/智能体入口、项目总览；新建项目不要求选择智能体，可关联已有目录或创建空工作目录。U20/U21 为独立目录和总览；保留 38 项任务，在 T02/T05/T12/T17—T21/T29/T37 补接线，新增 A36/A37。
- 同一 HEAD 已核实 scheduler.ts 的 #reserve 返回多项，#drain 分别 #start，任务处理异步执行；一个 Harness 并不限制一个智能体。新计划按资源并发：编码独占可写目录，审查取材短时读占用，快照发布后释放来源目录，后续审查/独立副本可与编码并发。目录别名/父子/跨项目重叠检查冲突，通用 Shell 仍不承诺系统隔离。
- 并发上限与资源登记由平台新增，短锁只保护准入/登记；运行中停止按目标会话及所属进程处理。恢复先扫描全部会话及跨项目资源，无冲突任务可一起恢复；未知命令影响仍可保守阻止该项目自动恢复。报告发布只等本轮收尾，不等其他智能体空闲。
- 文档校验通过：38 项任务依赖无环、37 组验收、21 项界面、25 项后台、88 个本地链接有效、42 个接入项与源码一致；旧正常运行项目串行要求已移除。仅修改文档和本记忆，没有产品代码或产品测试执行。

## 并发方案源码复审（2026-10-25）

- 同一 HEAD `de21da3f8dc94578db1d7ce283a7c47e7abf61c5`：conversation.abort/waitForIdle 会 resume 整个 Harness；公开 Harness.abortTask 只调用任务停止标记，不主动 resume。未开启调度时可先标记用户要结束的旧任务，全部未知效果达到可调度条件后再清理，不能处理一项时启动其他待核对项。此结论只适用于该启动阶段，不能把 abortTask 当作运行中的暂停接口。
- NodeExecutionEnv 的 cwd 可变，cleanup 处理该实例全部 activeChildPids，不等待确认整棵进程树退出。规划改为每执行/检查独立环境，按身份跟踪进程；不能跨会话共享实例后改 cwd，也不能仅凭重启前 PID 杀进程。
- 五文档补充应用 admissionId：submit 前登记，覆盖宿主取材、提交、队列与收尾；旧停止/释放不能操作后来执行。资源与名额一次准入，不按超时自动释放；停止先落盘，模型/工具复查。结束差异归档后才释放编码写占用。均为待开发平台机制，不是 Durable 现有接口。
- T12 提前实现公共模型归属/准入检查并依赖 T10，T33 只增审查预算；T11 同事务维护会话发现索引，T19 增依赖 T18。补取材取消/中断、坏库保守占用、连接变更前的准入检查、可恢复临时文件保留。当前源版本核对与旧快照报告发布分开，不等待并发编码结束。
- 结构校验通过：38 项任务依赖无环，37 组验收、21 项界面、25 项后台连续；91 个本地链接有效；42 个 provider 与源码工厂一致。A37 增 14 类竞态/故障场景，A25 补真实双智能体并发。仅修改五文档及本记忆，没有实现产品代码、运行产品测试或模型调用。

## 原型需求与布局（2026-10-25）

- 用户指定原型放根目录 prototype：左侧项目列表，各项目下有多个会话；右侧项目文件、变更等；设置固定左下角，集中配置连接与相关参数。要求先梳理需求和规划，再制作界面。
- 已新增 prototype/01-需求梳理.md、02-原型设计规划.md，映射 21 项 U 功能到 10 个视图及六条操作路径；强调项目会话导航不等于智能体归属，右栏当前文件与审查快照必须区分。原五份 PRD 未改。
- 当前仅完成需求与规划，尚无 HTML 或可点击原型。可点击静态原型、完整设置页为已提出的建议，不能当作用户已确认；相关偏好问题已发出。后续拟用独立 HTML/CSS/JS 与演示数据，不接真实模型、授权、命令或文件读写。

## 可点击原型交付（2026-10-25）

- 用户已确认可点击静态原型和完整设置页，覆盖上一条待确认状态。prototype/index.html 已制作，配套 styles.css、fixtures.js、app.js、README.md、VALIDATION.md 和三张浏览器截图；更新两份原型规划文件。未修改五份 PRD、产品包、依赖或锁文件。
- 原型支持项目/独立会话、编码补充/队列/停止、审查标准/快照/报告/新轮复核、右栏文件/差异/成果、42 项 provider 配置与模拟认证、全局/项目设置。右上角场景菜单推进结果、异常、无模型与重置；仅内存样例，不调用模型、执行命令或读取真实项目文件，刷新重置。
- 浏览器实测：设置返回保留草稿、独立停止、报告新轮、空项目创建与独立文本审查、建议标准确认、差异预览、队列撤回、Cloudflare 参数保存/密钥清空、模拟 OAuth 保存、无模型引导后返回新建草稿。未见浏览器 error；42 项 ID 与 PRD 比对和 JS 语法通过。未声称所有认证类型、异常组合或窄窗口均已验收，详见 VALIDATION.md。
- 本轮 npm.cmd run check 再次停在既有 Windows entry-graphs 路径分隔符问题；Biome 未修改文件，前三项检查通过，后续链路未执行。没有修改上游检查逻辑。静态预览用 Python 在 127.0.0.1:8765 仅服务 prototype 目录；也可直接用浏览器打开 index.html，不需构建。

## 原型智能体导航（2026-10-27）

- 用户指定查看文件时中间分成窄会话区和宽文件查看区，右侧资源列表保留；文件多标签、逐项关闭、整体隐藏，隐藏后会话恢复全宽，再从顶部恢复标签。prototype 已实现，标签按项目保存，同路径不同执行/快照分别识别，来源文字固定在打开时；浏览器验证草稿、隐藏恢复、末项关闭、项目隔离、快照来源、搜索定位和设置返回通过。

- 用户要求所有下拉统一为圆角、选中高亮、间距更大的菜单。prototype/selects.js + selects.css 装饰原生 select 并保留表单值，自动处理新渲染页面和 dialog、上下展开与键盘选择。当前预览浏览器未采用 appearance:base-select，最终使用页面内浮层；实际验证筛选、表单提交、认证联动、20 项滚动及 Esc 行为通过。

- 用户新增右侧项目搜索，入口在文件与变更之间。原型已支持字面内容匹配、大小写、路径包含筛选、文件分组折叠、计数、行号定位和高亮；查询按项目隔离，仅检索 fixtures 当前文件，不搜索审查快照、不替换、不读真实磁盘。真实搜索后台现已纳入五份 PRD 的 T39/T40/T43，仍待产品实现，见下节。

- 用户继续要求去掉正文重复会话标题栏和右侧“项目资源”标题栏；已在编码、审查共用布局移除。会话名保留顶部导航，执行状态移入底栏；文件标签置顶，右上角面板开关保留并实测可用。

- 用户进一步指定会话配置移到页面最底部状态栏：智能体、模型、思考档、审查轮次。编码和审查已统一调整，保留模型切换及忙时限制；总览/目录/设置不展示旧会话配置。浏览器验证通过，截图见 prototype/screenshots/session-bottom-bar.png。

- 用户指定智能体移至左侧底部、设置上方；头像、名称、简介，默认列表，可切换方块，最多四项后内部滚动。prototype 已实现；点击预选当前项目及智能体创建会话，区域标题保留完整目录入口。正式清单仍为两个内置智能体。
- 1280×720 浏览器实测列表/方块、两个智能体预选、目录和设置返回；临时六项验证两种模式可见四项且可滚动，临时文件已删除。截图和记录见 prototype/VALIDATION.md。语法通过，根 check 仍受既有 Windows entry-graphs 问题阻断，未修改产品包。

## 原型调整同步到 1.0 文档（2026-10-27）

刷新保留尺寸补充：resizers.js 使用 `lg-workbench.layout-sizes.v1` 本地键保存五个有限数值，拖动完成/键盘/复位时保存；取消不保存，窗口自动限宽不覆盖偏好。实际刷新前后 295/340/295/77/173px 完全一致，顶部双击复位后刷新仍 62px。五份 PRD 同步持久偏好规则，业务样例/文件标签仍不持久保存。根 check 仍失败于已记录 entry-graphs，未改上游代码。

后续新增：用户要求五处分界线可拖动且有最小宽高。prototype/resizers.js/css 已实现，index.html 接入；不改 app.js 或产品包。项目栏/会话/文件/资源栏最低 220/280/320/240px，顶部/智能体区最低 44/100px，尺寸共用，现按用户后续要求保存在浏览器本地，刷新恢复原值，双击复位。五份 PRD 在 T19/T42、A38/A41 补对应规则，无新增任务编号。浏览器实测五处拖动、下限、键盘最大值保护文件区、双击复位、设置及隐藏返回保留草稿通过；窄窗和指针取消等未逐项实测。完整根 check 仍复现既有 Windows entry-graphs 问题。详见 prototype/VALIDATION.md。

- 按用户要求更新产品构思两文档、PRD/1.0 三文档；未改产品或原型代码。补齐底部智能体区、完整设置返回、底栏、去重标题、右栏搜索、多文件分栏与统一下拉。
- 保留旧编号，新增 U22—U24、H26、T39—T43、A38—A42。T39 统一文件来源/读取契约，T40 真实搜索服务，T41 共享下拉先于 T19，T42 分栏依赖 T23/T36，T43 搜索界面依赖 T40/T42；T26/T27 等新增能力，T28 仍最后交付。
- 页面搜索是本地只读服务，不调用智能体，不占执行名额或整目录读占用；允许观察编码写入中的当前内容，不提供一致快照或审查证据。审查取材仍按原资源规则执行。结果绑定内容摘要与查询序号；变化不沿用旧行号，迟到响应不串项目。
- 文件标签按项目、路径、来源及执行/快照区分；隐藏保留标签，关闭末项恢复全宽，切会话不改变旧快照。搜索条件、标签和列表/方块模式仅页面内保留，刷新重置；服务端执行/历史不受影响。
- HEAD 仍为 de21da3f8dc94578db1d7ce283a7c47e7abf61c5；核实 Durable 工具导出不含项目内容搜索，旧 grep 仅参考其 argv/字面/取消处理，不能当 Web API。42 个厂商清单与工厂一致。
- 临时文档校验脚本通过：43 项任务依赖无环且全部可从 T28 的前置链到达；42 组验收、24 项界面、26 项后台连续，100 个本地链接有效。只做文档校验，未运行产品测试、构建或模型请求。

## 原型工作位置保存（2026-10-27）

- 用户进一步要求刷新保留当前项目、会话和打开文件。prototype/workspace-state.js 使用 lg-workbench.workspace.v1 保存页面导航、每项目标签/来源/显隐、搜索条件、设置返回位置及演示项目/会话记录；app.js 渲染前恢复、渲染后保存、输入延迟保存及 pagehide 补存。模型连接与授权表单不保存。先前“刷新重置标签/搜索”的原型记录已被此规则替代。
- 原型新建项目/会话也保留；缓存按白名单与关联校验，失效会话回项目总览，失效标签跳过。模拟取材/停止/收尾计时被刷新打断时显示待核对，不自动重跑。场景重置只清工作记录，独立的五处布局尺寸仍保留。
- 定向测试 node --test prototype/workspace-state.test.mjs 六项通过；浏览器实测多标签、活动文件、切项目/会话、草稿、隐藏查看区、设置分类及返回、新建记录与重置均通过，无 error。截图 prototype/screenshots/restored-workspace.png。根 check 仍停在已有 Windows entry-graphs 问题；未改产品包或依赖。

## 刷新恢复同步产品文档（2026-10-27）

- 产品构思两份和 PRD/1.0 三份已同步五处尺寸及页面刷新保留，替代此前“标签/搜索/模式刷新重置”的产品规则。当前项目/会话、总览/目录/设置分类及返回位置、文件标签顺序/活动项/来源/显隐、搜索条件、显示模式和草稿纳入浏览器偏好。
- 产品与原型分开：项目/会话/消息和执行事实仍在服务端；浏览器只存白名单偏好、草稿及查询用请求引用，不存模型连接凭据、文件全文、搜索结果或执行快照。T02/T03/T17 拟新增稳定服务数据实例标识和初始化只读查询，防同地址换库串 ID；不声称现有 Durable 提供这些接口。
- T19 分五步做存储/恢复/拖拽基础，T20/T21/T24 接设置、草稿、提交核对和当前快照，T42 接第五处及文件恢复，T43 接搜索条件与重新查询，T27 汇总。A38/A40/A41 补五处实值、隐藏/末项关闭、失效引用、版本变化、断网、坏缓存/满额和旧后台页覆盖；刷新不提交、停止、确认或发布。
- 本轮只改文档。临时校验脚本通过：43 项任务依赖无环，全部可由 T28 前置链到达；42 组验收、24 项 U、26 项 H 连续，100 个本地链接有效，无旧刷新重置规则。未运行产品测试、构建或根代码检查。


## 新建会话原型调整（2026-10-27）

- 新建会话改为工作区 create 页面，不再弹窗；居中任务输入与页内项目/智能体/模型/思考档选择，首次发送才创建会话。编码发送后输入回到底部，审查带入原始要求后仍确认标准与材料。文件标签暂隐藏但保留。
- workspace-state 白名单新增新会话草稿和 create 返回位置；刷新与设置返回保留。存储回归 7 项通过；浏览器实测三入口、首次发送、审查要求带入、无模型配置返回及刷新草稿通过。根 check 仍被既有 Windows entry-graphs 阻断；仅改 prototype。


## 原型右键管理与新会话精简（2026-10-27）

- 用户要求项目路径移到顶部导航下、移除右栏底部路径；新会话的智能体/模型/思考档靠右且用纯文字下拉。移除会话名填写，首次消息开头 28 个字符自动命名。README 已同步替代旧可选名称规则。
- 项目和会话支持右键重命名/删除；删除确认只移除演示记录，运行/待核对/有队列时禁删。删除当前记录修正导航、来源标签及设置返回引用；最后一个项目删除后空状态可刷新保留。
- 浏览器独立 localhost 地址验证项目改名刷新、会话删除、当前项目及最后项目删除；主地址验证禁删与文字选择样式。存储回归 8 项通过，根 check 仍停于既有 Windows entry-graphs；仅改原型。

## 原型明暗主题（2026-10-27）

- 用户指定暗色参考深蓝/蓝灰/青绿配色，默认暗色，设置旁单图标切换。prototype/theme.js 在首屏读取独立 lg-workbench.theme.v1，theme.css 覆盖暗色；切换只改根主题属性与图标，不重绘工作区，演示重置不清主题。
- 浏览器验证明暗切换、刷新保留、草稿保持及设置/下拉/编码文件页面配色，无 error；语法通过，根 check 仍停于已有 Windows entry-graphs。仅调整原型，五份产品文档未同步本次主题需求。

## 原型模型名称精简（2026-10-27）

- 模型下拉与会话底栏仅显示模型名称，内部仍用完整厂商/模型值；同名项保持独立。右侧底部项目名和样例说明块移除。浏览器验证选择值仍为 deepseek/review-demo、右栏底部节点为零；仅改原型。

## 新会话、记录管理与主题同步产品文档（2026-10-27）

- 五份产品构思/PRD 已同步页内居中新会话、首次发送创建、首任务前 28 个 Unicode 字符命名、右侧文字下拉、导航路径、文件树缩进及资源底部精简；新会话草稿/设置返回可刷新恢复。
- 新增 T44 记录管理后台、T45 右键页面；产品删除采用持久逻辑标记，禁忙时/待核对/有队列删除，禁止后续执行但不删工作目录或证据。项目删除意图分步收敛，报告旧引用只读保留；不能照搬原型删除数组和清父引用。T26 等 T44，T27 等 T45。
- 默认暗色和单图标切换纳入 T41/T19；主题单独按同源保存，不等服务实例。模型名称与 provider/model 引用分离，产品用目录 name、缺省完整 ID，不裁模型自身命名空间，同名不合并。新增 A43—A46 覆盖首发断点、管理竞态/证据、主题和同名路由。
- 本轮只改五份文档及本记忆。临时校验通过：45 项任务无环且全部纳入 T28 前置链；46 组验收、26 项 U、27 项 H 连续，103 个本地链接有效，无旧不删/创建弹窗/仅浅色规则。未运行产品测试或构建，源码 HEAD 仍 de21da3f8dc94578db1d7ce283a7c47e7abf61c5。


## 原型使用源码型号和思考档（2026-10-27）

- prototype/generate-model-catalog.mjs 离线导入当前 MODELS、getSupportedThinkingLevels、clampThinkingLevel，生成 42 接入项/1,598 聊天模型的名称与档位快照；无网络、无产品代码改动。包括 Radius 的本地目录，不能凭旧“动态目录”观察推断当前静态数据为空。
- models.js 统一名称与完整引用、动态档位、源码回退、旧 coding-demo/review-demo 引用升级；保留原工作状态。设置目录、默认模型、新会话、会话切换和模拟测试改为源码型号。不支持思考显示禁用，未知型号无能力选项。README/VALIDATION 已同步。
- 13 项模型/工作状态测试通过；浏览器验证 GPT-5.4、DeepSeek V4 Pro、GPT-4.1 的选项差异、切换回退、刷新保留及 Baseten 14 型号目录，无 error。根 check 仍停在既有 Windows entry-graphs 问题，Biome 未修改文件。

## 原型左栏收起（2026-10-27）

- 用户要求左上角收起/展开，已加 60px 窄栏：项目简称及运行点、新建、智能体、设置、主题入口；sidebarCollapsed 纳入 workspace-state 白名单。只切 DOM 样式不重绘会话，刷新保留，展开恢复独立的原宽度与智能体区高度。
- resizers 按收起实际宽度计算中心空间；可变的 rail-projects 不算固定高度，切换同步重新布局，隐藏两处左栏拖拽线。实测 295→60→295px、智能体 173px 恢复、两个文件标签/草稿/设置返回/刷新与明暗通过，浏览器无 error。
- 既有 13 项测试通过；根 check 仍为既有入口图错误。顺带纠正上一轮 new-round 分支误插的未定义 values 引用。仅 prototype 与说明/本记忆更新，未改产品包或 PRD。

## 原型收起项目会话菜单（2026-10-27）

- 收起栏悬停项目简称显示右侧会话菜单，第一项新建会话；会话按项目过滤，显示名称与状态，复用已有跳转和新建入口。悬停不切换项目；菜单内移动保持展开，移出延迟关闭，支持键盘打开、导航和 Esc。
- 浏览器实测已有会话跳转、空项目新建、悬停及移出、Esc 焦点恢复通过，无 error；截图 prototype/screenshots/project-session-flyout.png。长列表和窄窗未逐项实测。
- app.js 语法通过；根 check 仍停在既有 Windows 入口依赖图错误。仅 prototype 和说明/记忆更新，未改产品包或 PRD。

## 对话内切换与会话分支（2026-10-27）

- 用户最终选择“切换新的会话分支”，覆盖前一条“留在同一会话”的回答。已有对话输入区右下角加入智能体、模型、思考等级；切智能体新建同项目独立分支，复制对话背景/草稿，不自动执行，不接管原任务/队列/快照。branchFrom、branchTitle、branchContext 单独保存，保留原作者和来源入口。
- prototype/session-options.js 提供分支构造和模型配置锁；审查准备页/报告页保留配置入口。执行中、收尾、unknown、有队列不能修改模型；冻结审查轮次另开一轮。模型和档位复用源码目录及现有回退规则。
- 新增 4 项隔离/刷新/锁定用例，合计 17 项测试通过；浏览器独立 localhost 实测运行中分支、原草稿保留、刷新保留 DeepSeek V4 Pro/最高档、停止后可切换及 GPT-4.1 禁用思考，无 error。用户 127.0.0.1 数据未加入测试分支。根 check 仍为既有入口依赖错误；仅原型和说明更新，五份 PRD 待用户要求同步。

## 会话右键新建分支（2026-10-27）

- 会话右键菜单在重命名下方增加“新会话分支”；项目菜单不增加。createSessionBranch 同时供右键和智能体切换使用，右键按目标会话 ID 创建同智能体分支，不依赖当前打开会话。
- 18 项测试通过；浏览器独立 localhost 验证从非当前审查会话创建分支，来源、模型、思考档、草稿及刷新恢复正确，无 error。根 check 仍被既有入口依赖图错误阻断。仅原型和说明更新。

## 原型审批选择与材料入口（2026-10-27）

- 用户要求输入框左下角加入审批选择及“＋”上弹菜单。prototype/composer-tools.js/css 实现手动/自动/完全访问三个演示模式（默认自动），以及当前项目样例文件/文件夹多选、可移除标签和 Skill 禁用占位。不接真实权限模块，不读写磁盘或调用模型；五份 PRD 未改。
- approvalMode 与 attachments 纳入新会话草稿、会话和分支保存；恢复按项目样例校验路径，跨项目选择清空。编码发送附上参考路径文本，成功或入队后清空标签；审查新会话将路径带入待确认材料。选择材料不能改变已选队列输入方式。
- 21 项定向测试通过；浏览器实测上弹、多选/移除、刷新保留、跨项目清理和 queue 模式保留，无 error；测试草稿与引用已清理。根 check 仍被既有 Windows 入口依赖错误阻断。真实审批设计与 1.0 范围变更须另行按用户要求同步产品文档。

## 最近原型交互同步五份产品文档（2026-10-27）

- 用户本轮明确确认：1.0 实现手动审批、自动审批、完全访问，替代原“不做工具审批”。仍不做平台账号、角色或多用户；原型选择器不能作为真实审批完成证据。文档新增持久待批、一次调用批准、自动评估失败转人工、停止/超时/重启与未知副作用核对；审批不扩大审查工具范围。
- 五份产品构思/PRD 同步源码真实型号与动态思考档、60px 收起栏/项目浮层、会话内选择与新会话分支、右键分支、材料菜单/框外标签和审查 1100px 居中限宽。切智能体以用户最后决定“新会话分支”为准；复制有来源的冻结背景/草稿，不复制执行、队列、快照、预算或审批决定；正式复核仍走旧报告/问题契约。
- 新增 T46—T51、A47—A52、U27—U29、H28—H30；T26 等分支/材料/审批后台，T27 等对应页面，T28 最后交付。审批实现先验证公开工具 API 与等待/恢复方式，不能虚构 Harness.approve/pause，不能仅用 beforeTool 拦截，不能把 unsafe 命令改成安全重放。
- 源码 HEAD 仍 de21da3f8dc94578db1d7ce283a7c47e7abf61c5；getSupportedThinkingLevels/clampThinkingLevel 为公开导出。文档检查：51 项任务无环且全部进入 T28 前置链，52 组验收、29 项 U、30 项 H 连续，108 个本地链接有效。本轮仅改五份文档和本记忆，未改产品/原型代码，未运行产品测试、构建或模型请求。

## 同会话复核与消息导航（2026-10-27）

- 用户最新截图明确：编码空闲发送即开始，不再显示“开始新任务”；审查输入区三个配置项靠右；新一轮复核留在同一个可见会话；增加左侧细刻度与摘要定位。该复核规则取代之前新增左侧会话的行为，切智能体仍建立独立会话分支。
- prototype/review-rounds.js 分离当前轮次与只读 reviewRounds，保留 ID/名称，归档标准、材料标识、配置、结论；viewedRound 与历史材料标签一起刷新恢复。历史页不可编辑或触发复核，缺快照旧轮次不能借用当前轮次快照；新一轮生成独立快照标识。尚未实现产品 Durable 轮次持久化，五份 PRD 本轮未改。
- prototype/turn-navigation.js/css 实现编码消息与审查轮次刻度、聚焦/悬停摘要、点击定位。26 项定向测试通过；独立 localhost 实测同会话复核、旧报告刷新、输入区右对齐、直接发送和消息定位，页面无 error。截图 prototype/screenshots/review-round-navigation.png。测试编码执行已停止，用户 127.0.0.1 数据未改。
- 根 check 前置通过且 Biome 无修改，仍为既有 packages/ai ./models 到 telemetry/index.ts 的入口依赖图错误；后续检查未执行。仅原型、README、VALIDATION 和本记忆更新，无产品包改动。

## 会话统计底栏（2026-10-27）

- 按用户参考图将原型底栏改为轮次/步数/生成速度、累计 Token/缓存命中、圆环上下文占用三组；原智能体/模型/思考配置继续在输入区操作。usage-bar.css 跟随现有主题，右侧保留执行状态和“演示统计”。
- 只有轮次来自会话，其余数值为固定视觉样例；未执行时显示 0 或 —，不代表真实遥测。独立 localhost 验证暗亮主题、项目总览清空统计，无 error。语法通过，根 check 仍停在既有入口图错误；五份 PRD 未改。

## 同会话多轮、消息定位与统计同步产品文档（2026-10-27）

- 已更新产品构思两份及 PRD/1.0 三份文档。编码空闲直接发送；审查输入配置靠右；新轮复核留在同一页面会话，旧轮只读、查看轮次刷新保留；消息/轮次刻度支持摘要、键盘和分页定位；底栏改为三组统计与右侧状态。切智能体仍创建独立分支，三种真实审批范围不变。
- 平台拟新增 workbenchSessionId，区别于 Durable conversationId 与 ProviderDoc.sessionId：审查页面会话固定，每轮仍用新 ownerless conversationId 隔离上下文。建轮检查原轮结束及收尾，预期版本加 requestId 防重复；旧请求不能操作新轮。删除检查全部轮，历史材料缺失不借当前快照。
- 源码核对：UsageDoc 保存已提交 models/tools 用量，AssistantMessage.durationMs 可缺失；pi-ai/utils/estimate 为公开估算工具，Durable 内部 estimateContext 不公开且算法不同。文档明确轮/步/速度/缓存比例/累计 token/上下文估算口径、审批去重及未知/部分状态，固定原型数字不能当产品遥测。
- 新增 T52—T55、A53—A56、U30/H31；T26 等 T52/T54，T27 等 T53/T55，T38/T28 收口。文档校验通过：55 项任务无环且全部进入 T28 前置链，56 组验收、30 项 U、31 项 H 编号连续，119 个本地链接有效。源码基线仍 de21da3f8dc94578db1d7ce283a7c47e7abf61c5。
- 本轮仅改五份文档及本记忆；未改原型或产品代码，未运行产品测试、构建或真实模型请求。上述任务/用例均待实施，不是产品验收通过记录。

## 多轮、分支、统计与刷新源码复审（2026-10-27）

- 基线仍为 `de21da3f8dc94578db1d7ce283a7c47e7abf61c5`。五份产品构思/PRD 已修正：建轮先查幂等回执，再检查当前轮版本与完整收尾；原轮封存，恢复扫描全部轮。parentRoundId 固定指直接上一轮，更早参考报告单独记 sourceReportId，不回退当前轮。
- 分支先保存请求意图及固定历史尾，再用公开 entries 的 maxEntryId 分页复制可见对话背景。草稿由客户端显式带版本提交；不复制任务、工具结果、审批决定或审查快照。刷新只查询创建结果，迟到响应不能清掉新草稿或覆盖新导航。
- UsageDoc 是 models/tools 汇总且 history 为 latest，没有单次调用 ID 或缓存字段是否缺失的标记。此前“审批去重”应按来源隔离落实：审批只记独立账，工具仅报告自身消耗，不重复上报已记账的嵌套调用；不能从汇总桶事后去重。模型桶还包含没有 AssistantEntry 的压缩用量。
- 部分 ai 适配器将缺失缓存字段填零，不能区分未返回与真实零命中。文档规定全零/无分母显示未知，有缓存记录也标部分；历史上下文使用封存尾和保存的模型窗口，只作估算。统计读取采用同一只读提交快照，事务外再按固定边界分页，不嵌套 Harness 调用。
- T52 显式依赖审批后台 T50，历史分页后台归 T52 并纳入 T26，T53 负责页面。校验通过：55 项任务无环且全部进入 T28 依赖链，56 组验收、30 项界面、31 项后台连续，128 个本地链接有效。仅更新五份文档及本记忆，没有修改产品或原型代码，没有运行产品测试。

## 复审规则同步静态原型（2026-10-28）

- prototype 的新轮保留页面会话，独立 roundId/conversationId，封存旧轮并保留草稿；旧轮未收尾、队列、待批或 unknown 阻止后继轮。分支只复制固定边界内的可见文字、原作者及稳定来源，祖先背景去重，原执行与新分支独立。
- operations.js 是本地演示回执，不是 Durable 接口。创建前保存请求引用，重复请求先查回执；“响应丢失”“查无结果”场景刷新只查询，不重发、不自动跳页或清新草稿。历史缺失不借当前轮，取材/停止/收尾刷新中断显示待核对。
- usage.js 替代固定统计。缺回执显示 —；缓存全零未知，有值仍标部分；上下文仅用保存样例窗口且标约数。审查累计到所看轮，速度/上下文只取该轮，缺轮次回执不凑总数。统计样例仅用于原型，正式产品仍须由服务端读取。
- 33 项定向测试通过；独立 8766 浏览器验证复核、历史/草稿/文件标签刷新、运行中分支及固定背景、未知请求不重建、取材中断核对、暗亮统计，无 error。用户 8765 数据未改。根 check 前置通过，仍为已有 ai ./models 到 telemetry/index.ts 入口错误；未改产品包或 PRD。详见 prototype/VALIDATION.md 当前日期节。

## 焦点样式及原型与五份文档对照（2026-10-28）

- 用户要求输入/下拉焦点只改变原边框，不加外圈。prototype/focus.css 最后加载，暗色 #8bc4ed、亮色 #70a9d0；文字选择器保持无框，用颜色和下划线表示焦点，普通按钮仍有键盘焦点。
- 原型按项目保存新会话草稿、材料和配置，切换恢复目标自己的草稿，替代旧“换项目清空材料”表述；成功提交只清本项目草稿。审查关联任务和数值超时刷新保留；失效关联显式提示。资源页签按项目、变更范围按会话保存。
- 新轮准备仍可从成果栏查看旧报告，历史配置只读。缺失文件来源保留错误标签，不借当前文件替代；已知越项目引用拒绝。统计说明统一为累计截至所看轮，速度和上下文只取所看轮。
- 五份产品构思/PRD 和原型说明已对齐；任务 T37 补显式 T52 前置，验收补焦点、草稿、恢复和历史报告。原型规划能力矩阵明确真实审批、Durable、事务、多客户端恢复尚未实现，原型通过不能作为产品验收。
- app.js 语法及 37 项定向测试通过；171 个本地链接有效，55 项任务依赖无环。独立 8766 浏览器实测暗亮焦点、跨项目草稿材料、95 秒超时与任务恢复、旧报告/快照刷新和项目资源页签，无 error；8765 用户记录未改。根 check 仍停在已有 ai ./models → telemetry/index.ts 入口依赖错误。未改产品包或提交。

## 默认排队与底栏居中（2026-10-28）

- 用户要求移除执行中“补充当前任务 / 完成后执行”下拉，默认排队，并支持不打断当前操作的插队。prototype/message-queue.js/css 提供队列编辑、撤回、立即插入；插入先保存待边界状态，完成场景先模拟边界接收，原任务继续，再推进才消费普通队列。停止取消待插入项，编辑校验原队列避免覆盖已消费项；草稿独立。
- 底栏统计居中，状态仍靠右；1280px 浏览器实测中心均约 762px。独立 8766 实测默认排队、编辑、插入、刷新、完成后消费、撤回及暗亮样式，无 error，用户 8765 数据未改。
- 41 项定向测试通过；根 check 仍被已有 ai ./models → telemetry/index.ts 入口依赖错误阻断。仅改原型、README、VALIDATION 与本记忆，五份产品文档本轮未同步，未改产品包、未提交。

## 默认排队与底栏居中同步五份文档（2026-10-28）

- 产品构思两份及 PRD/1.0 三份已同步：编码发送默认 followUp，移除输入方式下拉；普通队列逐条编辑、撤回、立即插入，独立草稿；统计以左项目栏右侧的整个底栏居中，包含右资源栏，窄窗分行。审查冻结轮次仍只存草稿。
- 本轮源码核对：Durable 公开导出 InboxDoc，公开 commit/Tx 可读提交并修改文档，但没有编辑/提升便捷接口。T13 要先用真实 SQLite 和假模型验证平台封装；编辑/提升同事务校验条目版本、保留 ID/顺序并存回执。普通撤回复用 abortSubmission，意图及逐项结果需平台持久保存。
- postTools 是整轮工具边界，one-at-a-time 每次取一条 steer；final 可同时取一条 steer 与一条 followUp，再按原数组顺序放入。不能照搬原型“一次步骤推进多条”的模拟行为。afterFailedRun=keep 也保留 steer，平台失败收尾须取消未消费 steer、保留普通队列，恢复先补清理；不删除已 placed 历史。
- T13 拆为接口验证、默认排队、编辑、插入、撤回清空、失败恢复六步；T14/T17/T18/T21 补恢复与页面，T48/T50 回接材料审批，T55 补居中。A13 补边界竞争、版本、防重和中断，A21/A22/A56 补整链与布局。
- 文档校验通过：五份共 138 个本地链接有效；55 项任务依赖无环且全部进入 T28 前置链；56 组验收、30 项 U、31 项 H 编号连续；旧输入下拉规则已清理。本轮只改五份文档及本记忆，未改 prototype 或产品代码，未运行产品测试、未提交。

## 文件标签滚动与成果页签移除（2026-10-28）

- 用户要求文件标签栏隐藏滚动条、滚轮驱动横向滚动，右栏暂去掉成果页签。原型已实现；旧 results 页面、设置返回及项目偏好回退 files，历史报告仍从会话轮次查看。
- 独立 8766 浏览器验证明暗样式、滚轮双向滚动、选中文件不变、标签切换和刷新恢复，无 error。13 项状态测试通过，根 check 仍停在既有 ai ./models → telemetry/index.ts 入口图错误。仅改 prototype 和本记忆，五份产品文档本轮未同步，未改产品包、未提交。

## 设置统一全局（2026-10-28）

- 用户要求 1.0 设置均为全局，取消项目运行及并发审查限额独立页，本地环境改名基础配置。原型已合并命令路径/超时、全局并发与新轮次限额、环境状态；去掉项目选择及单项目并发限制，目录冲突规则仍保留。
- 旧设置分类恢复到 basic；无项目也可配置。参数维持内存演示，不承诺刷新持久化。14 项恢复测试通过；跨项目共享和运行中命令参数限制浏览器验证通过。根 check 仍被既有入口图问题阻断。仅改原型及说明，五份产品文档尚未同步本次设置变更，未改产品包、未提交。

## 模型上下文（2026-10-28）

- 已核对 pi-ai Model.contextWindow/maxTokens；Durable generation.ts 的 thresholdCompaction 用 resolved.contextWindow 减 reserveTokens 计算阻塞压缩阈值。上下文窗口不是实际发送量，最大输出也不是输入窗口。
- 原型每个模型显示目录上下文/最大输出，提供按连接与模型的全局使用上限，默认跟随目录，允许调小；有未收尾执行时禁止改。仅内存演示，不接实际请求或压缩、不修改历史统计。六项模型测试（含全目录字段对照）及浏览器超限、隔离、占用、刷新检查通过。根 check 仍停在既有入口图错误；未改产品代码和五份 PRD。

- 2026-10-28：三个设置页签内容均居中；模型连接厂商列表与表单整体最大 1040px，常用默认模型与基础配置最大 800px。浏览器测量中心对齐，明暗主题及收起左栏后布局通过；仅改 prototype，根 check 仍停在既有入口图错误。

- 2026-10-28：用户要求移除连接占用提示，上下文提示改为仅新建会话生效。原型允许执行中修改上下文默认值，覆盖此前“占用时不能修改上下文”规则；首次发送和新分支复制默认值，旧会话及同会话复核不变，选择随会话刷新保存。全局默认仍只存内存，连接凭据修改规则未变。28 项定向测试及浏览器保存、提示验证通过；根 check 仍停在既有入口图错误。未改产品包和五份 PRD。

- 2026-10-28：常用与默认模型、基础配置新增配置目录，整体双栏最大 1040px 并居中，取代原单列 800px。点击目录滚动右侧并聚焦标题，不重绘或清除未保存输入。浏览器验证点击、Enter、输入保留、暗亮与 812px 内容宽度无溢出；根 check 仍停在既有入口图错误。只改原型及说明，五份 PRD 未同步本次变更。

## 源码参数扫描与原型设置（2026-10-28）

- 新增 prototype/runtime-settings.js、runtime-settings-ui.js/css 及定向测试。基础配置补模型重试、自动压缩、代理与空闲超时、图片处理、Code Mode 和无进展恢复；连接高级参数补请求超时、适配器重试、服务端等待上限、缓存及受能力限制的 transport；模型高级参数补默认思考档、输出预算、随机程度、压缩覆盖及条件显示的 thinkingBudgets。
- 模型目录生成器从源码新增 API/input/budgetControl，Google 判断复用 usesGoogleThinkingLevel；Codex Responses 不显示未消费的通用 maxTokens。Durable 标准请求类型尚无 thinkingBudgets/maxTokens/temperature/握手超时，均标平台适配，不能宣称直接接入。
- 新配置仅内存演示，页面切换保留、刷新恢复默认；未接真实模型或执行。52 项原型测试通过；独立 8766 浏览器核对保存、能力、参数隔离、非法值、两层重试、刷新、明暗，无 error。根 check 仍停在既有 ai ./models 到 telemetry/index.ts 入口图错误。仅改 prototype 和本记忆，未改产品包或五份 PRD。详见 prototype/03-源码配置扫描.md。

- 2026-10-28：按用户截图，prototype 基础配置移除“审查默认限额”目录和三项输入（模型请求尝试数、指定检查数量、每段执行时长），保存校验同步移除字段。仅移除设置入口，不改同会话多轮复核或历史轮记录。独立 8766 浏览器验证目录、保存及切页保留，通过且无 error；语法检查通过，根 check 仍为既有入口图错误。更新参数扫描说明，未改产品包或五份 PRD。


## 设置参数与布局同步五份 PRD（2026-10-28）

- 已同步产品构思两份和 PRD/1.0 三份：右栏去成果、标签隐滚动条/滚轮横滚、三类全局设置与 1040px 目录居中、模型上下文与高级参数、移除审查默认限额入口。新增 T56—T59、A57—A60；现为 59 项任务、60 组验收。仅编辑文档，未改产品或原型代码。
- 上下文及模型默认快照按页面会话冻结；新分支取新默认，同会话新复核轮沿用旧值。请求实际接线、有效容量/压缩、版本恢复必须验证，不能只保存 UI 值。Code Mode 纳入编码装配任务，审查仍禁止；图片仅编码读取合法项目材料，不扩展外部上传。
- 重核源码：HarnessSettings/stream 为全局动态读取，不提供会话参数回调。PRD 对全局引擎设置采用所有执行/队列/压缩/待核对空闲后发布；连接请求参数按连接空闲发布，由公开 Models 包装隔离。该限制是产品实施边界，原型内存演示不证明运行时支持。
- maxAgentDelayMs 在 ai/utils/retry.ts 用 min 截住指数间隔；maxRetryDelayMs 在 provider-retry.ts 对服务端建议等待超限报错，0 取消该上限。两者语义不同，不能互套。高级参数能力矩阵与实际请求验证列入交付门槛。
- 文档静态校验：59 个任务无重复、无依赖环，全部汇入 T28；A01—A60 齐全，编号引用与本地 Markdown 链接有效。文档改动未运行产品测试或 npm check。

## 2.0 在线创造智能体构思（2026-11-01）

- 用户明确：2.0 支持 Web 创建跨行业专业智能体，新增内置“智能体创造智能体”；所有自建智能体也基于 pi-durable。新增 `PRD/产品构思/创造智能体技术分析.md`，只记录方案及 1.0 最小预留，未改原五份文档、原型或产品代码。
- 推荐先做配置型定义与受控工具，创建助手技术 ID 暂建议 lg-agent-creator，尚未定名。1.0 预留定义契约、统一装配、会话版本绑定、执行检查、通用目录及备份恢复，映射既有任务；草稿、试用、发布及创建助手实现留到 2.0。
- 本次核对 HEAD 仍 de21da3f8dc94578db1d7ce283a7c47e7abf61c5：Registry 同名扩展会被替换，AgentState 按名称解析且缺失项可被忽略；defineExtension 不做完整业务校验。新文档据此要求版本绑定、显式工具清单、恢复前检查，未将平台拟增接口写成现成 API。

## 智能体工作室方案同步（2026-11-01）

- 用户确认更新产品构思三份：AGENT-EXTENSION-PLAN.md、TECHNICAL-REVIEW.md、创造智能体技术分析.md。每个内置、自建及创建助手都有工作室，七区为基础信息、人设与规则、Skills 与能力、记忆、知识库、自进化、运行轨迹；完整功能放 2.0，1.0 只预留通用身份/版本/范围/装配/记录与恢复。
- 本次方案取代上一条记忆中的配置草稿/试用/发布流程：只提供保存修改，后台校验并生成不可变版本。没有智能体专属模型/运行参数区，统一用全局设置。配置未保存输入不承诺刷新恢复，原消息和审查准备草稿规则不变。
- 工作室配置、技能/实现和长期记忆/知识版本只对新会话生效；旧会话、队列、停后继续、刷新重启及同会话复核保持绑定，显式新分支取当时有效版本。用户新材料、当前项目文件/AGENTS.md、已有全局参数分类生效与安全撤销规则不因此冻结。
- 区分平台全局、智能体、项目、智能体+项目、会话执行范围。MCP 凭据全局管理、工具按智能体选、业务资源按项目绑定；项目经验不自动跨项目或提升为通用。自进化自动发现/归并/建议，首版方案用户确认应用；全自动应用范围仍待定。轨迹简化展示，完整过程回原会话，底层恢复记录不删。
- 复核本地 HEAD 未变；Registry/AgentChange/init/文档作用域与上述边界一致。三份文档静态校验通过：81 个本地链接、任务引用、R01—R06/V01—V06 映射、空白格式有效。未改 PRD/1.0、prototype 或产品代码，未运行产品测试、未提交。

## 2026-11-01：智能体工作室三版设计稿
- 独立入口 prototype/studio-designs/index.html；A 目录式、B 总览式、C 分栏式，共用 studio.html 与演示逻辑。未替换现有原型首页。
- 对齐七区工作室、全局运行配置、项目范围和仅新会话生效规则；只做静态交互，无模型或 durable 接入。
- 浏览器验证了三版布局、范围切换、明暗、收起、保存版本与新会话演示。截图和验证说明在同目录。
- npm run check 仍在 entry-graphs 报 packages/ai ./models 可达 packages/telemetry/src/index.ts；本次未改相关产品源码。

## 2026-11-01：选定 B 版并合并主原型

- 用户选择 B 版。主原型左下列表、方块、收起头像及完整目录进入工作室，保留原侧栏与主题；身份总览、七区横向页签、1200px 居中，窄处单列。开始会话复用原页内创建；会话里的智能体切换仍是分支。
- 新增 prototype/agent-studio-state.js、agent-studio.js/css，以独立存储保存演示定义版本与工作室位置；不改主 app.js，不接真实 Durable。返回/刷新保留原项目、会话、文件和草稿。审查能力不含编码写入，项目改进按稳定 ID 隔离。
- 五份产品构思/1.0 文档同步，并校正创造智能体技术分析和三版选择记录。完整工作室仍为 2.0 预览；1.0 新增 T60/A61 预留收口，共 60 任务/61 用例。T60 复用已有注册/装配模块，T26/T27 等待它；目录页面仍 T37/T47，避免后台测试反向依赖 Web。
- 23 项定向测试通过；隔离浏览器验证入口、保存冲突/失败、项目隔离、返回、文件标签和草稿刷新、明暗及窄布局，未改用户浏览器数据。172 个本地链接有效，依赖无环且全部汇入 T28。详见 prototype/STUDIO-VALIDATION.md。
- 根 check 仍停在既有 ai/models → telemetry/index.ts 入口图错误，Biome 未修改文件。未改产品包、锁文件或依赖，未提交。自进化/知识/记忆/真实会话定义绑定仍待产品开发，不能用演示保存冒充实现。

## 2026-11-01：B 版原型与五份文档复审

- 修正通用范围混入项目轨迹、未选项目开始会话暗用原项目、损坏配置被内存旧值覆盖等问题。七区共用范围选择；项目删除清范围，通用表单保留；跳原会话再校验归属。工作室缓存仍与主工作区分开。
- 五份文档明确：打开新会话页不绑定定义，首次发送受理创建意图时固定；显式分支按创建意图固定，重试不漂移；同会话复核沿旧绑定。工作室仍是 2.0 预览，1.0 为 T60/A61 预留；M3 已包含 T60。
- 26 项定向测试、原 B 版浏览器回归及新增 10 项边界检查通过。60 个任务无依赖环，全部汇入 T28，61 组验收及 172 个本地链接有效。详见 prototype/STUDIO-VALIDATION.md。只改原型、文档与本记录；未改产品代码。

## 2026-11-01：用户取消工作室项目配置（替代此前范围方案）

- 工作室七区只管理智能体通用定义/记忆/知识/改进，不再设项目选择器或 agentId + projectId 配置层。项目记忆和规则由用户按需在项目根目录维护。当前 resource-loader.ts 支持 AGENTS.md，不自动加载 AGENT.md 或任意记忆文件；后者须显式读取或适配。
- 项目运行隔离继续保留；轨迹汇总该智能体各有效项目简要记录并标来源，进入原会话核对归属。“开始会话”在原新会话页选项目，无项目提示先创建。工作室不改主工作区选择。
- 页面缓存不再存 scope，旧字段刷新清除；旧项目改进不转换成通用批准，旧版本保留，新保存版本去掉项目标记。未保存输入、失败保护和返回文件/草稿继续有效。
- 同步五份主文档及创造智能体技术分析、原型说明和验证记录；27 项定向测试与 11 组独立浏览器走查通过。60 任务/61 用例/172 链接校验通过。根检查仍受既有 ai/models→telemetry/index.ts 入口图错误阻断。仅原型、文档，无产品包改动。

## 2026-11-01：工作室新增方案源码复审（仅文档）

- 基线仍为 de21da3f8dc94578db1d7ce283a7c47e7abf61c5。同步六份 PRD，补 T08/T29/T30/T60、A08/A61 和 2.0 V01—V06 的边界与验收。
- resource-loader.ts 会读 agentDir 及 cwd 到文件系统根的祖先规则，同目录按候选顺序取首个；不是 Durable 自动加载或项目隔离能力。平台 T08 明确只自动读取项目根至目标目录的 AGENTS.md，其他说明/记忆显式选取；审查使用的规则随轮次材料冻结。
- RegistrySnapshot 是内存快照；AgentState 按名称解析。跨扩展工具/段落可重名且后项覆盖，任务名全局唯一；计划要求显式选择版本化实现、检查选中集合与 wrapper、核对受信部署产物。conversationCreated 早于显式 agent 配置，init 不能读表；内部子会话的平台绑定须由宿主补齐。
- 工作室取消能力只影响新会话，与平台实际禁用/停止分开。2.0 完整资料清单与索引就绪才切当前版本；刷新按服务实例恢复引用、保存结果未知查原回执。自进化不汇入全部项目历史，应用前复查来源。创建/验证独立工作区为 2.0 拟建方案，不借当前项目，不扩展 1.0 范围。
- 文档校验通过：60 项任务无依赖环，全部汇入 T28；61 组验收、172 个本地链接有效。比对修改前哈希，prototype 与 packages 的 4850 个文件未变。未运行产品测试，未提交。

## 2026-11-01：工作室复审规则同步原型

- 主原型 B 版明确七区通用配置、项目文件规则边界、能力取消只影响新版本，以及首次发送/显式分支取新版、旧会话/队列/同会话复核/恢复沿原绑定。真实会话版本装配仍未接入，不把静态保存当作 T60 完成。
- 保存样例增加 SHA-256 请求指纹与同写回执；响应未知保留原请求，刷新只查询，不重存。待核对引用使用当前标签页 sessionStorage，不存表单正文；关页后的恢复未覆盖。位置增加固定演示实例和已见版本引用，旧 scope 清除。
- 读取失败、缓存损坏、已知版本移除/回退、双页冲突均保留当前输入并阻止覆盖。自进化演示实际追加通用规则，证据仍为固定样例；原项目文件和用户浏览器数据未操作。
- 31 项定向测试、13 组独立 Chromium 走查通过，无 pageerror；详见 prototype/STUDIO-VALIDATION.md。根 check 仍停在既有 ai/models → telemetry/index.ts 入口图错误，Biome 无修改。本轮只改原型、原型说明及本记录，未改 PRD、产品包或依赖，未提交。

## 2026-11-02：工作室灵魂与 MCP 独立页签

- 按用户标注把“人设与规则”改为“灵魂”，沿用原 role 内容；Skills 与 MCP 拆成独立页签，共八区。Skills 保留技能指引和工具能力；MCP 只选全局登记能力，仍为未连接样例。
- 页签使用固定标识保存；旧七区位置按原含义迁移，避免新增 MCP 导致记忆、自进化和轨迹错位。跨页编辑统一保存，旧版本及其他智能体保持独立。
- 32 项定向测试、7 组独立 Chromium 走查通过，无页面错误。根检查仍停在既有入口图错误，Biome 无修改。只改 prototype、原型说明与本记录；未改 PRD、产品包或依赖，未提交。

## 2026-11-03：审查简化为普通对话

- 用户取消审查轮次切换、准备表单和固定步骤流程，要求直接发消息审查，保留独立审查分支。原型已使用普通消息与输入框，支持排队、编辑、撤回、边界插入和后续复查。
- 旧审查请求/结论一次性整理为历史消息；保留材料引用、草稿、队列和未收尾记录，刷新不重复整理或自动重跑。分支仍不继承执行、队列或快照。历史辅助模块仅用于旧数据，不提供新轮次入口。
- 51 项定向测试与 5 组独立 Chromium 检查通过。根检查仍为既有 ai/models 到 telemetry/index.ts 的入口图错误。详见 prototype/REVIEW-CHAT-VALIDATION.md。本次未改产品包、PRD 或依赖，未提交。

## 2026-11-03：Skills 分类卡片与上传演示

- 工作室 Skills 去掉顶部技能指引占位条目，原工具能力改成分类卡片。分类为全部、开发、审查、通用、已上传；MCP 继续独立管理。
- 上传 ZIP 仅记录文件名、大小和选用状态，不读取、解压或安装内容，不授予工具权限。保存追加该智能体的新版本；旧版本和其他智能体不变，刷新恢复已保存记录与分类。
- 15 项工作室测试和 7 组独立 Chromium 走查通过，无页面错误；明暗及窄窗截图已复看。根检查仍停在既有入口图错误。只改 prototype、原型说明与本记录，未改产品包或 PRD，未提交。

## 2026-11-03：普通审查与工作室调整同步文档

- 同步产品构思三份、PRD/1.0 三份。工作室为八区：基础信息、灵魂、Skills、MCP、记忆、知识库、自进化、运行轨迹。Skills 分类卡片、ZIP 元数据演示和真实上传分开；完整工作室及上传后端仍属 2.0，V02.1—V02.4 拆细实施，1.0 T60/A61 预留定义、技能内容、MCP 引用和工具实现版本。
- 普通审查取代此前固定轮次架构：一个页面会话绑定一个 Durable 会话，后续复核继续原会话，不建轮次或准备/确认流程；材料、要求、证据按提交/执行关联。审查分支、只读边界、排队/插入、停止、有限执行预算和效果未知核对保留。此前记载的轮次绑定方案不再作为当前需求。
- 已保存工作室配置仅首次发送创建会话或显式新分支取得；旧会话、队列、后续审查及刷新沿用旧定义。页签按稳定 ID 恢复，旧位置按含义对应；上传不授予工具权限，原型元数据不代表技能安装成功。
- 本次文档校验：60 项任务无依赖环且全部汇入 T28，61 组验收、170 个本地链接与表格结构通过。仅改上述六份文档及本记录，未改原型或产品代码，未运行产品/浏览器验收，未提交。

## 2026-11-07：PRD 与原型分批提交

- 本轮只做提交整理，未改文件内容：工作区原有 AGENTS.md（M）、`.pi/PROJECT_MEMORY.md`、`PRD/`、`prototype/` 四类未提交文件。
- 按功能分 11 个提交入库（`de21da3f8..cae75df26`）：项目记忆规范（AGENTS.md + `.pi/PROJECT_MEMORY.md`）、PRD 1.0（3 文件）、产品构思（3 文件）、原型基础壳（13 文件）、模型目录（4）、工作区状态与用量统计（5）、会话输入/排队/审查对话（16）、运行设置（4）、智能体工作室（4）、原型文档（7）、截图与设计稿（69）。
- 提交后工作区干净，共 130 个文件入库（prototype 122、PRD 6、项目记忆 2）；未推送，未改产品包、依赖或包锁文件。
- prototype 为静态文件，无需构建：直接打开 `prototype/index.html`，或 `python -m http.server 8765 --bind 127.0.0.1 --directory prototype`。定向回归 `node --test prototype/*.test.mjs` 71 项通过（提交后重跑）。
- `prototype/model-catalog.generated.js` 由 `node prototype/generate-model-catalog.mjs` 从 `packages/ai` 源码与已生成的模型数据导出，不要手改；模型数据准备见“依赖与编译约束”。
- 根 check 未运行；此前记录的 Windows entry-graphs 路径分隔符问题仍在，不因本次提交改变。

## 2026-11-07：上游合并后的源码导览

- 当前 LG-Workbench HEAD 为 cf43eea7e，合并父提交 e49e3d5e8 / 085c84e98；新增上游可达提交 526。12 个一级包为 1.5.0，另含 Unreleased；新增 apps/p2 0.0.1 与 packages/schema。旧记录中的“11 包、无 apps”不再适用。
- Chord v2 重构契约、Host、Store、插件与应用层；Durable 改为 Storage.commit(batches, receive, context)，视图可先显示未落盘 partial，watchEvents 和 retryTask 已移除。复用前查当前 README、类型与 CHANGELOG。
- p2 官方定位为将被替换的实验原型，不能把它当作本地 PRD / prototype 或正式 LG 工作台已完成。服务端 Node >=22.19，TUI >=26.5.1。
- 模型生成入口已迁到 packages/ai/catalog/generate.ts；hydrate:model-data 通过 --strict --data-only 从在线目录生成数据，旧固定快照水合说明不再适用。生成 JSON 仍被忽略。
- npm ci --ignore-scripts 同步合并后的依赖、hydrate:model-data 后，完整 npm run check 退出 0；旧 Windows entry-graphs 阻塞已由上游修复。npm 对 min-release-age-exclude 仍有不识别提示，未修改配置或锁文件。
- 离线导览入口 source-code-html/index.html；本次更新报告 UPSTREAM-UPDATE.md，验证边界 VALIDATION.md。同步 13 个教程、44 条路线、5 图与 8 份 132 页课件。未运行产品 build、真实模型或 p2 服务；未提交。
- 本轮最终导览回归 75 项通过；离线 Chrome 宽窄屏与五图 browser check 通过，课件正文/备注匹配。验证不代表 p2 或所有业务能力已经运行验收。
