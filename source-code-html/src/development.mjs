// Local workflow derived from package scripts, pi-test.sh, the source resolver and release helpers.
// Historical workbench commands remain in workbench.mjs and history/.
const launch = {
  version: '0.2.0',
  configurations: [
    {
      name: 'Pi 源码 · 启动检查（不调用模型）', type: 'node', request: 'launch',
      runtimeExecutable: 'node', runtimeArgs: ['--import', './packages/coding-agent/src/experimental/source-resolver.ts'],
      program: '${workspaceFolder}/packages/coding-agent/src/cli.ts', cwd: '${workspaceFolder}',
      args: ['--offline', '--no-approve', '--no-extensions', '--help'],
      console: 'integratedTerminal', sourceMaps: false, skipFiles: ['<node_internals>/**'],
      env: { PI_CODING_AGENT_DIR: '${env:TEMP}/pi-source-dev-agent', PI_TELEMETRY: '0' }
    },
    {
      name: 'Pi 源码 · 交互断点', type: 'node', request: 'launch',
      runtimeExecutable: 'node', runtimeArgs: ['--import', './packages/coding-agent/src/experimental/source-resolver.ts'],
      program: '${workspaceFolder}/packages/coding-agent/src/cli.ts', cwd: '${workspaceFolder}',
      args: ['--offline', '--no-approve', '--no-session', '--tui-mode', 'regular'],
      console: 'integratedTerminal', sourceMaps: false, skipFiles: ['<node_internals>/**'],
      env: { PI_CODING_AGENT_DIR: '${env:TEMP}/pi-source-dev-agent', PI_TELEMETRY: '0' }
    },
    {
      name: 'Pi 源码 · 附加 9229', type: 'node', request: 'attach', address: '127.0.0.1', port: 9229,
      sourceMaps: false, skipFiles: ['<node_internals>/**']
    }
  ]
};

const deploy = `import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { produceArtifactSet } from "../scripts/package-artifacts.mjs";
import { installConsumer, smokeTestNpmConsumer } from "../scripts/local-package-install.mjs";

if (!process.argv[2]) throw new Error("传入仓库外的新输出目录");
const repository = process.cwd();
const output = resolve(process.argv[2]);
const rel = relative(repository, output);
if (!rel || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel))) {
  throw new Error("输出目录必须在仓库外");
}
if (existsSync(output)) throw new Error("目录已存在，请改用新的目录名");
mkdirSync(output, { recursive: true });
const artifactSet = produceArtifactSet({ repoRoot: repository, outDir: join(output, "artifacts"), build: false });
const installation = join(output, "node");
const packageName = "@earendil-works/pi-coding-agent";
installConsumer({ artifactSet, directory: installation, packageNames: [packageName] });
smokeTestNpmConsumer({ directory: installation, artifactSet, packageName });
console.log("本地定制版安装成功：", installation);
`;

export const developmentGuide = {
  id: 'development', title: '本地开发说明', eyebrow: 'DEV / SOURCE TO DELIVERY',
  intro: '照着步骤准备环境、修改源码、运行和打断点，再验证、打包与部署自己的定制版。默认使用 Windows PowerShell；标为 Bash 的命令在 Git Bash 或对应 Linux 环境执行。',
  sections: [
    {
      title: '01 · 先看开发路线与终点',
      text: '当前 checkout 是包含 11 个包的 CLI / SDK monorepo，没有 apps 工作台。01–17 阶段介绍当前源码开发；旧工作台命令只在历史快照中保留。源码开发先跑 .ts，交付时再构建 dist、安装本地 tarball 或运行独立可执行文件。命令块只提供复制，不会在阅读器中执行。',
      table: [['阶段', '你要完成的事', '完成信号'], ['准备', '确认 Node、依赖和模型数据', '依赖版本匹配；check:model-data 通过'], ['运行', '用源码解析器启动', '--version 为当前包版本；--help 能退出'], ['开发', '先选扩展或核心实现', '最小改动可复现，不混入无关文件'], ['调试', '断点跟随实际 .ts 调用链', '命中目标代码，能看参数与调用栈'], ['验证', '定向测试、仓库检查', '相关用例通过，整体检查无阻断'], ['交付', '构建并在仓库外安装/运行', '定制行为仍存在，不依赖原工作区']],
      callout: '离线的是导览。首次 npm 安装、模型目录水合、真实模型调用和包消费者安装可能需要网络。--offline 只关闭 Pi 的自动联网，不会禁止你主动提交的模型请求或工具网络操作。',
      refs: [['README.md', '## Development'], ['package.json', '"engines"'], ['packages/coding-agent/docs/cli.md', '--offline']]
    },
    {
      title: '02 · 环境、目录与改动基线',
      text: '先安装满足仓库 engines 的 Node（至少 22.19.0）、npm 与 Git。本文源码运行路径使用 registerHooks 和原生 TypeScript，示例验证环境为 Node 24.18.0。编辑器使用 VS Code 的内置 Node 调试器。只在制作独立二进制时需要 Bun；Bash 脚本需要 Git Bash 或 Linux/WSL。',
      commands: [
        { title: '进入你的项目并记录当前状态', shell: 'powershell', code: `Set-Location -LiteralPath 'D:\\code\\CYG\\pi'
node --version
npm.cmd --version
git --version
git status --short
git rev-parse --short HEAD`, expected: '位于含 package.json、packages、scripts 的仓库根目录。先辨认已有改动，后续只修改自己的文件。' },
        { title: '可选：在确认当前分支后创建开发分支', shell: 'powershell', code: 'git switch -c codex/my-feature', expected: '在当前提交上创建新分支；若名称已存在，改用其他名称，不覆盖旧分支。' }
      ],
      steps: ['用 VS Code 打开整个 pi 根目录，而不是只打开 packages/coding-agent。', '保存一个最小复现输入、预期行为和要修改的模块；从“功能清单详情”定位来源文件。', '暂时保留已有依赖和锁文件；不同机器的全局 pi 不代表这份源码。'],
      refs: [['AGENTS.md', '## Git'], ['package.json', '"node": ">=22.19.0"'], ['tsconfig.json', '"paths"']]
    },
    {
      title: '03 · 安装依赖，先解决升级残留',
      text: '在根目录安装全部工作区依赖，不要只给 coding-agent 单独装一份。已有 checkout 升级后用 install 同步；全新、干净 checkout 可用 ci 按锁文件安装。两个方案二选一。--ignore-scripts 遵守项目规则，避免自动执行依赖生命周期脚本。',
      commands: [
        { title: '已有工作区：同步依赖', shell: 'powershell', code: 'npm.cmd install --ignore-scripts', expected: '安装完成；随后查看 Git diff，确认锁文件是否发生变化。' },
        { title: '全新干净工作区：按锁文件安装', shell: 'powershell', code: 'npm.cmd ci --ignore-scripts', expected: '仅用于可替换 node_modules 的干净环境；ci 会重建依赖目录。' },
        { title: '对照声明与已安装的 TypeScript', shell: 'powershell', code: `node -p "require('./package.json').devDependencies.typescript"
node -p "require('./node_modules/typescript/package.json').version"
git diff -- package.json package-lock.json`, expected: '已安装版本应与本 checkout 的精确声明一致；不要为旧依赖错误删除类型或降级实现。' }
      ],
      callout: '仓库声明 TypeScript 7.0.2；导览生成器与仓库检查器使用其 unstable AST / sync API。升级后先核对实际依赖版本。npm.ps1 被签名策略拦截时改用 npm.cmd；若把含中文的命令保存为 .ps1，Windows PowerShell 5.1 使用 UTF-8 with BOM，PowerShell 7 可使用 UTF-8。',
      refs: [['AGENTS.md', '## Dependency and Install Security'], ['package.json', '"typescript": "7.0.2"'], ['.npmrc', 'save-exact=true']]
    },
    {
      title: '04 · 模型目录数据是启动前置条件',
      text: 'providers/data 是生成资料；当前 providers/data 被 Git 忽略，首次 checkout 需要水合，之后仍须校验它与生成代码一致。包加载时就会读取其中的 JSON，所以缺失时连 --help / --version 都可能失败。先检查；只有失败时再水合（下载与本源码匹配的数据），成功后复查。',
      commands: [
        { title: '先检查模型数据', shell: 'powershell', code: 'npm.cmd run check:model-data', expected: '显示 Generated model data is valid. 才继续；缺失或陈旧时执行下一块。' },
        { title: '检查失败时补齐数据，然后复查', shell: 'powershell', code: 'npm.cmd run hydrate:model-data\nnpm.cmd run check:model-data', expected: '数据与生成代码匹配，manifest 与内容指纹校验通过。水合需要可访问目录服务。' }
      ],
      callout: '模型数据是否可用以本次 check:model-data 输出为准，不能沿用旧验证记录。不要手写空 JSON、删除 imports，或直接修改 models.generated.ts。离线构建需要预先准备与源码一致的数据。',
      refs: [['packages/ai/scripts/check-model-data.ts', 'Model data is missing or stale'], ['packages/ai/scripts/model-data.ts', 'validateGeneratedModelData'], ['.gitignore', 'packages/ai/src/providers/data/']]
    },
    {
      title: '05 · PowerShell：建立源码启动命令',
      text: '下面整块在仓库根目录执行一次，创建当前终端中的 Invoke-PiSource 函数。它预加载仓库现有 source-resolver，直接运行当前 src/cli.ts 入口；cwd 仍是你调用时的工作目录。换终端后需重新定义。独立 agentDir 避免开发设置混入日常 Pi 配置；登录不会自动继承。',
      commands: [
        { title: '定义源码启动器并做无模型检查', shell: 'powershell', code: `Set-Location -LiteralPath 'D:\\code\\CYG\\pi'
$piRepository = (Resolve-Path -LiteralPath '.').Path
$piResolverUrl = node -p "require('node:url').pathToFileURL(require('node:path').resolve('packages/coding-agent/src/experimental/source-resolver.ts')).href"
$env:PI_CODING_AGENT_DIR = Join-Path $env:TEMP 'pi-source-dev-agent'
$env:PI_TELEMETRY = '0'
function Invoke-PiSource {
    node --import $piResolverUrl "$piRepository/packages/coding-agent/src/cli.ts" @args
}
Invoke-PiSource --offline --version
Invoke-PiSource --offline --no-approve --no-extensions --help`, expected: '在依赖和模型数据准备好后，版本为当前包版本；帮助正常退出，不发模型请求。' },
        { title: '验证工作区包确实解析到源码', shell: 'powershell', code: `node --import $piResolverUrl --input-type=module -e "console.log(import.meta.resolve('@earendil-works/pi-coding-agent'))"`, expected: '输出 packages/coding-agent/src/index.ts 的 file URL，而不是 dist/index.js。' }
      ],
      steps: ['不要用全局 pi 来检验核心源码改动，它通常运行另一份安装。', '普通模块源码改动后重启进程；仅扩展/资源更新可按其生命周期使用 /reload。', '结束开发后关闭该终端；上述环境变量只影响这个终端及其子进程。'],
      refs: [['pi-test.sh', 'RESOLVER_URL='], ['packages/coding-agent/src/experimental/source-resolver.ts', 'registerHooks'], ['packages/coding-agent/src/cli.ts', 'main(process.argv.slice(2))'], ['packages/coding-agent/docs/configuration.md', 'PI_CODING_AGENT_DIR']]
    },
    {
      title: '06 · Git Bash / Linux：直接运行源码',
      text: 'Git Bash 在 Windows 原生目录运行时使用对应的 Windows Node；WSL 是独立 Linux 环境，应在该环境准备 Node 与依赖，不共用 Windows node_modules。当前 pi-test.sh、pi-test.ps1 和 pi-test.bat 均通过 source-resolver 启动 src/cli.ts。Windows 可直接运行 .\\pi-test.bat --help；下面也给出显式 Node 入口，便于理解解析过程。',
      commands: [
        { title: 'Git Bash 的源码运行方式', shell: 'bash', code: `cd /d/code/CYG/pi
export PI_CODING_AGENT_DIR="$(mktemp -d)/agent"
export PI_TELEMETRY=0
node --import ./packages/coding-agent/src/experimental/source-resolver.ts ./packages/coding-agent/src/cli.ts --offline --no-approve --no-extensions --help
node --import ./packages/coding-agent/src/experimental/source-resolver.ts ./packages/coding-agent/src/cli.ts --offline --no-approve --no-session --tui-mode regular`, expected: '帮助退出后可打开源码 TUI；在 Linux/WSL 把 cd 路径改成自己的 Linux checkout。' }
      ],
      refs: [['pi-test.sh', 'node --import'], ['packages/coding-agent/docs/environment-variables.md', 'PI_CODING_AGENT_DIR']]
    },
    {
      title: '07 · 决定改扩展还是改核心',
      text: '先用最小扩展证明需求。只有需要改变默认会话、模型协议、调度或终端行为时才进入核心；复用现有 API，不另造平行的工具执行入口。',
      table: [['目标', '起点', '建议验证'], ['新工具/命令/事件', 'examples/extensions/hello.ts、docs/extensions.md', '注册、错误、取消、重载、print/JSON 行为'], ['CLI 参数/装配', 'cli/args.ts、main.ts、core/sdk.ts', '解析结果、创建的模式与会话'], ['会话/上下文/重试', 'core/agent-session.ts、session-manager.ts', '分支、恢复、取消、收尾边界'], ['工具循环', 'agent/src/agent-loop.ts、types.ts', 'Hook、参数校验、并发、toolResult'], ['提供商与协议', 'ai/src/providers、ai/src/api', '模型类型、认证、流式事件转换'], ['终端显示与输入', 'tui/src、coding-agent/src/modes/interactive', '窄屏、滚动、键鼠与消息显示'], ['MCP / codemode', 'mcp/src、codemode/src 及产品 extensions', '连接/授权、隔离、工具桥接、嵌套结果'], ['持久任务', 'durable/src/harness、test/examples', '意图提交、重放安全、重启恢复']],
      refs: [['CONTRIBUTING.md', 'core is minimal'], ['packages/coding-agent/docs/extensions.md', '## Choose an integration point'], ['packages/coding-agent/examples/extensions/hello.ts', 'const helloTool']]
    },
    {
      title: '08 · 第一个二次开发：修改 Hello 扩展',
      text: '复制现有完整示例到一个新的项目扩展文件，避免改动原示例。若目标文件已经存在，先检查内容，不覆盖自己的旧实现。然后把 Hello, 的返回文字改为“你好，”，保存。',
      commands: [
        { title: '仅在目标不存在时复制示例', shell: 'powershell', code: `New-Item -ItemType Directory -Force -Path '.pi/extensions' | Out-Null
if (Test-Path -LiteralPath '.pi/extensions/local-hello.ts') {
    throw 'local-hello.ts 已存在，请换名或直接编辑它'
}
Copy-Item -LiteralPath 'packages/coding-agent/examples/extensions/hello.ts' -Destination '.pi/extensions/local-hello.ts'`, expected: '新增 local-hello.ts；保留 defineTool、schema、execute 和 factory 契约。' },
        { title: '仅加载这个扩展进行演练', shell: 'powershell', code: 'Invoke-PiSource --offline --no-approve --no-extensions -e ./.pi/extensions/local-hello.ts --no-session --tui-mode regular', expected: '显式 -e 仍可加载扩展；没有混入发现到的其他扩展或内置 MCP 连接。' }
      ],
      steps: ['在扩展的 pi.registerTool(helloTool) 行放断点，重新启动可验证注册，不需要发模型请求。', '真实工具执行需要先 /login、/model；发送“调用 hello，name 为开发者”，确认返回修改后的文字。', '修改扩展后输入 /reload，重新验证；若同时修改核心模块，停止后重启整个源码进程。', '为正常参数、schema 错误、抛错和取消补相关定向用例；不要把所有功能都堆进 hello。'],
      callout: '项目自动发现的扩展需要信任；本例明确使用 -e 并关闭其他扩展。不要为了开发便利无条件信任陌生项目。',
      refs: [['packages/coding-agent/examples/extensions/hello.ts', 'pi.registerTool(helloTool)'], ['packages/coding-agent/docs/cli.md', 'Explicit `-e` paths still load'], ['packages/coding-agent/docs/extensions.md', '## Understand the runtime lifecycle']]
    },
    {
      title: '09 · 运行交互、print、JSON 与 RPC',
      text: '先在真实终端登录并选择可用模型，再做最小请求。--offline 关闭自动刷新，但主动模型请求仍可能联网并产生用量；首次登录或目录不足时可在准备阶段暂不传 --offline。没有凭据时，停留在启动/注册/定向测试验证即可。',
      commands: [
        { title: '交互模式：选择账户与模型', shell: 'powershell', code: 'Invoke-PiSource --no-approve --no-session --tui-mode regular', expected: '在 Pi 内依次输入 /login、/model；凭据保存到前面设置的独立 agentDir。regular 便于查看调试日志。' },
        { title: '一次性请求和协议入口', shell: 'powershell', code: `Invoke-PiSource --offline --no-approve --no-session -p '只输出 ok'
Invoke-PiSource --offline --no-approve --no-session --mode json '只输出 ok'
Invoke-PiSource --offline --no-approve --no-session --mode rpc`, expected: '前两条完成后退出；第三条持续等待 JSONL 命令。RPC 协议见下方原始文档，结束时关闭客户端或终端。' }
      ],
      callout: 'JSON/RPC 的 stdout 保留给协议，不要在核心或扩展里随意 console.log。需要临时日志时用 stderr；TUI 日志会扰动屏幕，优先断点。默认禁用项目资源便于隔离复现，确认自己项目后才按需启用。',
      refs: [['packages/coding-agent/docs/cli.md', '## Invocation and output'], ['packages/coding-agent/docs/rpc.md', ''], ['packages/coding-agent/docs/usage.md', '/debug']]
    },
    {
      title: '10 · VS Code：可复制的断点配置',
      text: '在仓库根目录创建 .vscode/launch.json，把下方 JSON 合并进去（已有配置时只追加 configurations）。配置由导览提供，仓库目前没有预置 launch.json。第一项检查启动，第二项运行终端交互，第三项附加到已开启 Inspector 的进程。此处直接运行 .ts，关闭 sourceMaps 以免误匹配旧 dist。',
      commands: [{ title: '保存为 .vscode/launch.json', shell: 'json', code: JSON.stringify(launch, null, 2), expected: '选择对应调试项按 F5。启动检查在依赖与模型数据准备好后可运行；交互使用集成终端输入。' }],
      steps: ['打开 packages/coding-agent/src/cli.ts，在 setupCli() 或 main(process.argv.slice(2)) 的可执行行按 F9。', '选“启动检查”并 F5；命中后在 VARIABLES 和 CALL STACK 看 process.argv 与调用位置。', 'F10 单步跳过，F11 进入，Shift+F11 返回，F5 继续；在 type/interface 或空白行上的断点不会执行。', '调试扩展时，在“交互断点”的 args 中加入 --no-extensions、-e、./.pi/extensions/local-hello.ts。', '修改核心后停止并重新启动；不要指望已加载的 Node 模块随文件保存自动更新。'],
      external: [{ title: 'VS Code 官方 Node 调试文档（联网参考）', url: 'https://code.visualstudio.com/docs/nodejs/nodejs-debugging' }, { title: 'Node 24 原生 TypeScript 文档（联网参考）', url: 'https://nodejs.org/docs/latest-v24.x/api/typescript.html' }],
      refs: [['packages/coding-agent/src/cli.ts', 'setupCli()'], ['packages/coding-agent/src/experimental/source-resolver.ts', 'stale package dist files'], ['tsconfig.base.json', '"sourceMap"']]
    },
    {
      title: '11 · 附加调试与断点阅读路线',
      text: '若先从终端启动，用 --inspect-brk 在入口前等待调试器，再选择“附加 9229”并 F5。监听只放在本机 127.0.0.1。下面是实际源码阅读路线；经过模型/工具的断点需要对应请求，帮助模式不会触发它们。',
      commands: [{ title: 'PowerShell 终端启动 Inspector', shell: 'powershell', code: 'node --inspect-brk=127.0.0.1:9229 --import $piResolverUrl "$piRepository/packages/coding-agent/src/cli.ts" --offline --no-approve --no-session --tui-mode regular', expected: '出现 Debugger listening 后等待附加。连接并继续后进入 TUI；端口被占用时换端口并同步修改 attach 配置。' }],
      table: [['断点入口', '观察重点', '触发方式'], ['cli.ts → main.ts', 'args、模式与运行时装配', '启动；--help 可只验证入口'], ['core/sdk.ts → new Agent / new AgentSession', '模型、streamFn、工具和会话依赖', '进入会话启动'], ['core/agent-session.ts → prompt', 'input / before_agent_start、排队与上下文', '提交一条用户输入'], ['agent/src/agent-loop.ts → streamAssistantResponse', '统一消息与注入的模型流', '正常请求或 faux provider 测试'], ['agent/src/agent-loop.ts → prepareToolCall / executePreparedToolCall', 'schema、Hook、结果与错误', '触发工具或定向测试'], ['core/tools/read.ts → execute', '路径、截断与返回内容', '触发 read 工具'], ['core/session-manager.ts', '追加条目、分支与持久化', '运行持久会话；此时移除 --no-session']],
      callout: '灰色断点先查 Loaded Scripts 是否加载了正确的 .ts、入口是否经过目标行、cwd 与大小写是否一致。扩展由 jiti 加载，或代码在 Worker/子进程执行时，需确认实际执行上下文；普通主进程断点不保证覆盖 QuickJS VM 内的模型脚本。',
      external: [{ title: 'Node 24 Inspector 命令参数（联网参考）', url: 'https://nodejs.org/docs/latest-v24.x/api/cli.html#--inspect-brkhostport' }],
      refs: [['packages/coding-agent/src/main.ts', 'const createRuntime'], ['packages/coding-agent/src/core/sdk.ts', 'const session = new AgentSession'], ['packages/coding-agent/src/core/agent-session.ts', 'async prompt(text: string'], ['packages/agent/src/agent-loop.ts', 'async function executePreparedToolCall'], ['packages/coding-agent/src/core/tools/read.ts', 'execute'], ['packages/coding-agent/src/core/session-manager.ts', 'appendMessage']]
    },
    {
      title: '12 · 定向测试与改动验收',
      text: '不要直接跑全量 vitest 或 npm test，它们可能发现带凭据的端到端测试。日常先跑与修改有关的具体文件；新的 coding-agent 会话用例使用 test/suite/harness.ts 和 faux provider，不调用真实模型。运行下面不同包的命令前注意工作目录。',
      commands: [
        { title: '会话边界用例：从包根执行', shell: 'powershell', code: `Push-Location -LiteralPath 'packages/coding-agent'
try {
    node ../../node_modules/vitest/dist/cli.js --run test/suite/agent-session-boundaries.test.ts
} finally {
    Pop-Location
}`, expected: '使用仓库的 vitest 跑一个会话用例文件；替换为你的相关 suite 文件。' },
        { title: 'TUI 输入用例：从包根执行', shell: 'powershell', code: `Push-Location -LiteralPath 'packages/tui'
try {
    node --test test/keys.test.ts
} finally {
    Pop-Location
}`, expected: 'node:test 定向验证键盘解析；不是完整 TUI 视觉验收。' },
        { title: '仓库整体检查：回到根目录', shell: 'powershell', code: 'npm.cmd run check\ngit diff --check\ngit status --short', expected: 'check 包含 Biome、依赖边界、TS 导入、入口、安装锁、类型和浏览器 smoke；不运行单元测试，Biome 可能自动改格式。' },
        { title: '需要非 e2e 全量回归时：使用隔离入口', shell: 'bash', code: './test.sh', expected: 'test.sh 创建隔离 home，并从空环境只保留必要变量，再运行仓库测试。' }
      ],
      table: [['维度', '最小验收'], ['正常/错误', '正常结果、schema 错误、execute 抛错'], ['并发/取消', '兄弟工具、用户 abort、嵌套工作收尾'], ['模式', 'TUI、print、JSON、RPC 对应能力'], ['持久化', '继续、分支、reload、重启后状态'], ['平台', 'Windows 路径、换行、窄屏与键鼠']],
      refs: [['AGENTS.md', '## Commands'], ['test.sh', 'env -i'], ['packages/coding-agent/test/suite/README.md', 'Use `test/suite/harness.ts`'], ['packages/coding-agent/test/suite/agent-session-boundaries.test.ts', ''], ['packages/tui/test/keys.test.ts', '']]
    },
    {
      title: '13 · 构建自己的交付产物',
      text: 'CLI 可直接运行源码；发布产物与消费者 smoke 需要最新 dist。准备部署时才从根目录按依赖顺序构建；build:offline 使用已验证的模型数据，build 会先刷新它。--ignore-scripts 安装不代表永远不执行项目构建：这里是你显式执行已阅读的仓库脚本。',
      commands: [
        { title: '使用已准备的数据构建全部包', shell: 'powershell', code: 'npm.cmd run check:model-data\nnpm.cmd run build:offline', expected: '各包 dist 生成。第一条失败时先回到数据准备步骤，不继续构建。' },
        { title: '检查构建后的 CLI', shell: 'powershell', code: 'node ./packages/coding-agent/dist/bundle/cli.js --offline --version\nnode ./packages/coding-agent/dist/bundle/cli.js --offline --no-approve --no-extensions --help', expected: '运行 package.json 的实际 bin 入口；此时是 dist 路径，要重新构建才能反映下一次核心修改。' }
      ],
      callout: '正常联网刷新并构建的替代命令是 npm.cmd run build。不要手改 dist；以根构建顺序处理包依赖。单包 build:unbundled 只适用于所需依赖已经构建的情况。官方已移除旧 client/server/protocol 三包及实验服务应用；当前 checkout 也没有 apps/agent-web、apps/agent-server、agent-protocol 或 agent-runtime-adapter。源码解析器仍在 experimental 下，该目录被产品构建排除；发布入口以当前 package.json 为准。',
      refs: [['package.json', '"build:offline"'], ['packages/coding-agent/package.json', '"pi": "dist/bundle/cli.js"'], ['packages/coding-agent/tsconfig.build.json', '"exclude"'], ['packages/ai/package.json', '"build:offline"']]
    },
    {
      title: '14 · 部署 A：本地定制 npm 包，不发布 registry',
      text: '源码已构建且检查通过后，将下面 JavaScript 保存为 dev/deploy-local.mjs（先创建 dev 目录）。模板复用 package-artifacts 与 local-package-install，生成带完整性校验的 artifact manifest，为所有公开包打 tarball，再用 overrides 在仓库外安装。build: false 只打包已有产物；源码有变化必须先重建。',
      commands: [
        { title: '保存为 dev/deploy-local.mjs 的模板', shell: 'javascript', code: deploy, expected: '仅添加开发辅助文件；模板不会删除旧目录。保存位置决定 ../scripts 的相对导入。' },
        { title: '生成一个新的仓库外安装目录', shell: 'powershell', code: `New-Item -ItemType Directory -Force -Path 'dev' | Out-Null
# 先把上方模板保存为 dev/deploy-local.mjs，再运行：
$piDelivery = Join-Path (Split-Path -Parent (Get-Location).Path) ('pi-local-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
node ./dev/deploy-local.mjs $piDelivery`, expected: '生成 artifacts/manifest.json、artifacts/tarballs 与 node/；消费者检查核验安装版本、导出文件和本地依赖解析并导入包。下一步另验 CLI 版本。这一步安装外部依赖可能联网。' },
        { title: '离开仓库后验证自己的定制版', shell: 'powershell', code: `Push-Location -LiteralPath (Join-Path $piDelivery 'node')
try {
    & './node_modules/.bin/pi.cmd' --offline --version
    & './node_modules/.bin/pi.cmd' --offline --no-approve --no-extensions --help
    & './node_modules/.bin/pi.cmd' --offline --no-approve --tui-mode regular
} finally {
    Pop-Location
}`, expected: '启动与版本检查通过后，再验收你修改的具体行为；启动成功不等于功能验证完成。' }
      ],
      steps: ['迁移到同系统/同架构机器时保留整个安装目录和 artifacts；目标机需要满足 engines 的 Node。跨平台应在目标环境用 tarballs 重新安装。', '给交付物记录源码 commit、包版本、修改点与检查结果；上游包版本相同不代表定制内容相同。', '开发时用 Invoke-PiSource，部署时用上面的绝对安装路径或明确 PATH；不要让全局 pi 混淆结果。', '升级采用新的交付目录，验证后切换启动路径；回退时切回上一份完整交付物。'],
      refs: [['scripts/package-artifacts.mjs', 'export function produceArtifactSet'], ['scripts/local-package-install.mjs', 'export function installConsumer'], ['scripts/local-package-install.mjs', 'export function smokeTestNpmConsumer'], ['scripts/pack-packages.mjs', '--skip-build'], ['scripts/use-local-packages.mjs', '--consumer']]
    },
    {
      title: '15 · 部署 B：独立可执行文件与完整资源',
      text: '要给不安装 Node 的使用者交付，使用仓库二进制脚本。先准备 Bun、Bash、zip/unzip、模型数据与对应原生 prebuild。下面以 Windows x64 为例，ARM64 改 windows-arm64；Linux 使用 linux-x64/linux-arm64，在对应环境完成构建与验证。',
      commands: [
        { title: '在 Git Bash 的仓库根目录构建', shell: 'bash', code: `bun --version
./scripts/build-binaries.sh --skip-install --offline-model-data --platform windows-x64`, expected: '脚本重新构建各包，生成 packages/coding-agent/binaries/pi-windows-x64.zip 及 windows-x64 目录。需要 zip/unzip 可执行命令。' },
        { title: '用完整输出目录验证 Windows 产物', shell: 'powershell', code: `& './packages/coding-agent/binaries/windows-x64/pi.exe' --offline --version
& './packages/coding-agent/binaries/windows-x64/pi.exe' --offline --no-approve --no-extensions --help`, expected: '版本与帮助通过；解压 zip 到仓库外，再验证你的定制行为。' }
      ],
      callout: 'build-binaries.sh 会重建默认 binaries 输出目录，不要把它用作自己的源码或数据目录。交付完整压缩包或目录，不能只复制 pi.exe：WASM、theme、assets、export-html、docs、examples 和 native helpers 都是运行资源。--skip-install 只用于依赖已准备好的情况。',
      table: [['部署场景', '操作边界'], ['单机/团队定制 CLI', '解压完整产物；为各使用者配置账户与工作目录'], ['脚本/自动化集成', '使用 print/JSON/RPC；RPC 是 stdin/stdout，不是已部署的 HTTP 服务'], ['Linux 容器', '放入匹配架构的 Linux 产物及完整资源，准备 bash/git/ripgrep/ca-certificates，按容器文档设计目录挂载'], ['正式上游发布', '遵守 release.md 的版本、changelog、检查、tag 和 CI 流程；会提交并推送，不能作为普通本地部署步骤']],
      refs: [['scripts/build-binaries.sh', 'Copy shared files'], ['packages/coding-agent/docs/containerization.md', '## Run Pi in plain Docker'], ['.pi/skills/release.md', '# Releasing pi'], ['scripts/local-release.mjs', 'Builds and packs']]
    },
    {
      title: '16 · 按现象排错，不从错误码猜业务',
      table: [['现象', '优先核查', '处理与复验'], ['typescript/unstable/ast 缺失', 'node_modules 版本是否落后于根声明', '同步锁定依赖后重跑 check，不修改检查器'], ['providers/data/*.json 缺失/陈旧', 'check:model-data 与生成 manifest', 'hydrate:model-data 后复查，再 --version'], ['修改 .ts 后没有变化', '全局 pi、dist 或缺少 source-resolver', '查 import.meta.resolve；重启源码进程'], ['灰色断点/未命中', '实际 Loaded Scripts、可执行行与分支', '使用启动断点或本机 Inspector，确认进程/Worker'], ['扩展没有加载', '-e 路径、--no-extensions 和项目信任', '用显式 -e 最小加载，检查工厂导出与加载错误'], ['无模型/未登录', '独立 agentDir 的 /login 与 /model', '选择该环境可用模型，区分启动与模型请求'], ['TUI 错位/日志覆盖', '终端支持、regular/fullscreen、stdout 日志', '用 regular 复现并 /debug；终端问题单独验收'], ['发布版缺资源', 'assets/helpers/WASM 与平台架构', '重建并迁移完整产物，在仓库外测试'], ['npm.ps1 无法执行', 'PowerShell 脚本策略', '使用 npm.cmd，不修改系统执行策略'], ['Windows check:entry-graphs 误报', 'path.relative 的反斜杠与正斜杠预算匹配', '2026-10-24 已复现；记录平台限制，不删除入口或放宽预算'], ['local-package-install 的 npm ENOENT', '脚本 spawnSync 使用 npm 而本机为 npm.cmd', 'Windows 本地 tarball 部署有已知阻断，先修复或在 Linux 环境验证']],
      outcome: '一次开发的完成标准：可复现、命中正确源码、相关测试通过、整体检查通过、仓库外仍保留定制行为，并有可回退的交付物。本文模板未替你安装依赖、调用模型、构建或发布。',
      refs: [['AGENTS.md', '## Code Quality'], ['packages/coding-agent/docs/usage.md', '## Collect diagnostic information'], ['packages/coding-agent/src/config.ts', '']]
    },
    {
      title: '17 · 修改源码后同步这份导览',
      text: '功能索引只扫描 Git 已跟踪的源码；新增文件纳入跟踪后才进入功能索引。“源码目录说明”同时登记未忽略的新文件，未初始化的作用描述保留为空。语义讲解需要同步维护；自动扫描不会替你解释业务。Markdown 新增稳定编号时，同步更新 src/capability-bindings.mjs 的源码专题映射；生成器会拒绝重复编号、漏映射及失效来源；功能专题的每条路径规则和参考文档也单独校验。先补充说明依据，再用 --initialize-directory 填充有依据的空项；已有非空说明会保留。正式提交遵守 AGENTS.md，仅明确暂存自己修改的路径，不提交账户数据。',
      commands: [{ title: '重新生成并验证离线页面', shell: 'powershell', code: 'node source-code-html/build.mjs\n# 补充中文讲解后，填充有依据的空目录说明：\n# node source-code-html/build.mjs --initialize-directory\nnode --test --test-isolation=none source-code-html/catalog.test.mjs source-code-html/capabilities.test.mjs source-code-html/development.test.mjs source-code-html/directory.test.mjs source-code-html/verify.test.mjs source-code-html/package-tutorials.test.mjs source-code-html/mastery.test.mjs source-code-html/versions.test.mjs source-code-html/workbench.test.mjs', expected: '更新 index.html；正文来源、源码指纹、功能归属、目录覆盖及说明保留、开发说明命令与渲染测试通过。' }],
      refs: [['AGENTS.md', 'Only commit files YOU changed'], ['CONTRIBUTING.md', '## Before Submitting a PR']]
    }

  ]
};
