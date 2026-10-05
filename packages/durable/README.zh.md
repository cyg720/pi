# @earendil-works/pi-durable

> **实验性质。**API将在不同版本之间无通知地变更。

持久化智能体运行框架。对话、模型轮次、工具调用以及你自己的状态会在任何内容展示前先提交到存储中。如果进程在轮次中间崩溃，重新打开存储即可从断点继续。

基于 [`@earendil-works/pi-ai`](../ai/README.md) 进行模型访问和 `@earendil-works/chord` 进行文档状态管理。

## 目录

- [安装](#installation)
- [快速开始](#quick-start)
- [概念](#concepts)
- [持久化与恢复](#persist-and-resume)
- [扩展](#extensions)
- [工具](#tools)
- [系统提示词](#system-prompt)
- [每对话智能体](#per-conversation-agent)
- [设置](#settings)
- [环境](#environment)
- [重载](#reload)
- [监控对话](#watching-a-conversation)
- [繁忙对话](#busy-conversations)
- [重置与交接](#reset-and-handoff)
- [压缩](#compaction)
- [智能体事件（实验性）](#agent-events-experimental)
- [钩子](#hooks)
- [更多对话与分支](#more-conversations-and-forks)
- [中止与子智能体](#abort-and-subagents)
- [子任务](#child-tasks)
- [任务图](#task-graph)
- [你自己的状态](#your-own-state)
- [使用与成本](#usage-and-cost)
- [存储](#storage)
- [示例](#examples)
- [设计文档](#design-documents)

<a id="installation"></a>
## 安装

```bash
npm install @earendil-works/pi-durable @earendil-works/pi-ai @earendil-works/chord
```

<a id="quick-start"></a>
## 快速开始

```typescript
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { AssistantEntry, createRegistry, Harness, MemoryStorage } from "@earendil-works/pi-durable";

const context = BACKGROUND_CONTEXT;

const models = createModels();
models.setProvider(openaiProvider()); // reads OPENAI_API_KEY

const harness = await Harness.open(new MemoryStorage(), { models, registry: createRegistry() }, context);
const root = await harness.root(context, { agent: { model: { provider: "openai", modelId: "gpt-6-sol" } } });

const submission = await root.submit({ type: "input", content: "What is the capital of France?" }, context);
const settled = await submission.wait(context);
if (settled.status === "done" && settled.type === "input") {
	const answer = await root.commit((tx) => tx.entry(AssistantEntry, settled.answer), context);
	console.log(answer?.model?.[0]);
}
await harness.close(context);
```


发生了什么：

- `Harness.open()` 通过存储后端开启一个会话。`MemoryStorage` 将所有内容保留在内存中。
- `root()` 返回根对话，首次使用时根据给定的智能体选项创建。对话是不可变条目组成的转录记录。
- `submit()` 持久化你的输入并返回 `Submission`。内置生成任务调用模型并将答案追加进去。
- `wait()` 在输入被回答（`done`）或失败（`unanswered`，附带原因）时解析完成。

每个异步调用携带一个 Chord `Context`，负责携带取消信号。`BACKGROUND_CONTEXT` 本身不会被取消。取消等待操作只会取消该等待，不会影响实际工作。

<a id="concepts"></a>
## 概念

- **运行框架**：一个打开的存储加上在该存储上运行智能体的机制。所有变更都通过一条原子提交链，且不会在提交存储前展示任何内容。
- **对话**：转录记录。`root()` 在首次使用时创建根对话；你可以创建更多并对其进行分支。`Conversation` 的句柄不持有状态；通过 `id` 比较句柄。
- **条目**：一个不可变的转录记录，如用户消息（`pi.user`）、模型响应（`pi.assistant`）、工具结果（`pi.tool-result`）、系统提示词变更（`pi.system`）、重置（`pi.reset`）或你自定义的类型。模型从最近一次重置的条目开始看到这些条目。
- **提交**：原子写入。`conversation.commit((tx) => ...)` 可以追加条目、编辑文档或创建任务；要么全部存储，要么全部不存储。
- **文档**：与转录记录相邻存储的类型化JSON状态，通过提交进行变更。内置文档包含每个对话的智能体选项（`pi.agent`）、面向提供方的会话身份（`pi.provider`）、正在运行的生成和工具（`pi.live`）、排队提交（`pi.inbox`）和花费（`pi.usage`）。
- **任务**：持久化状态机，每一步保存一个检查点，以便重启进程可从中断点继续。每个任务都有一个所有者：其对话或另一个任务。运行框架作为内置任务运行答案：`pi.generation` 调用模型并拥有其工具调用的 `pi.tool` 任务，等待它们并把运行结果交给下一个生成任务。
- **提交**：你交给对话的内容，可以是用户输入或要写入的条目，你可以等待其结果。
- **转并运行**：一次“转”是一个模型响应及其工具调用；一次“运行”是从输入到最终答案的所有轮询。会话繁忙时，运行正在进行。
- **扩展**：一组打包的工具、系统提示片段、钩子、包装器和任务，按名称管理。
- **注册表**：本进程安装的所有扩展。它在运行过程中可能会变化；新工作使用新的状态。
- **代理**：会话运行时所依赖的内容：模型、思考层级、选中的扩展、工具、指令和工作目录。按会话存储，名称存于`pi.agent`，每次使用时根据注册表解析。

一个已回答的输入，作为条目和任务：

```text
submit(input) → pi.user
  pi.generation → pi.system (only if the prompt or tools changed), pi.assistant (tool calls)
    pi.tool × n → pi.tool-result × n   (owned by the generation, which waits for them)
  pi.generation → pi.assistant (answer) → submission done
```

<a id="persist-and-resume"></a>
## 持久化与恢复

使用SQLite或JSONL存储，以跨重启保持会话：

```typescript
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

const harness = await Harness.open(await openNodeSqliteStorage("./session.sqlite"), { models, registry }, context);
const root = await harness.root(context); // the same root as last time
harness.resume(); // continue any run the last process left unfinished
```

因崩溃或关闭中断的工作会保持挂起状态。`resume()`启动任务调度器；提交或等待也会启动它。每个会话拥有独立的持久化UUIDv7，存于`pi.provider`，转发给pi-ai作为`sessionId`，用于提供方的提示缓存和会话关联。它能经受住重新打开、重试、重置、压缩和模型变更；子会话或分叉会获得全新的身份。旧会话在首次生成或压缩请求前会接收并持久化一个。

使用相同`requestId`重试提交时，会返回已有的提交记录，而非重复提交：

```typescript
const submission = await root.submit({ type: "input", content: "Hello", requestId: "greeting-1" }, context);
// After a restart: the same request ID finds the same submission.
const again = await root.submit({ type: "input", content: "Hello", requestId: "greeting-1" }, context);
// again.id === submission.id
```

`harness.submission(id)`可通过ID重新获取提交记录，例如重启后等待该提交。

<a id="extensions"></a>
## 扩展

除内置任务外，Harness运行的代码以注册表中你进程拥有的命名扩展形式提供：

```typescript
import { createRegistry, defineExtension, defineTool, hook, section, ToolTask } from "@earendil-works/pi-durable";
import { CodingTools } from "@earendil-works/pi-durable/tools";

const Coding = defineExtension({
	name: "coding",
	sections: [section("preamble", () => "You are a concise coding assistant.", { tag: false })],
	hooks: [hook(ToolTask, { beforeTool: (call) => (isDangerous(call) ? { block: "Needs approval" } : undefined) })],
});

const registry = createRegistry();
registry.install(CodingTools);
registry.install(Coding);
```

扩展可提供`tools`、`sections`、`hooks`、`wraps`（通过名称装饰工具或片段）和`tasks`。默认情况下，每个会话选择所有已安装扩展，按安装顺序。注册表本身不存储任何内容；会话仅存储扩展名称。

<a id="tools"></a>
## 工具

`@earendil-works/pi-durable/tools`提供`read`、`write`、`edit`、`bash`，以及包含所有四项的`CodingTools`扩展。它们仅通过调用环境与文件和进程交互（详见[环境](#environment)）。目前尚不支持读取图片。

你可以定义自己的工具，使用TypeBox模式。`defineTool()`将`args`类型化为`parameters`，Harness会在调用`execute()`前验证。`api.output()`流式输出运行结果，当`execute()`返回无`content`时，该输出即为结果：

```typescript
import { Type } from "@earendil-works/pi-ai";

const count = defineTool({
	name: "count",
	description: "Count from 1 to n",
	parameters: Type.Object({ n: Type.Number() }),
	execute: async (args, api) => {
		for (let i = 1; i <= args.n; i++) api.output(`${i}\n`);
		return {};
	},
});
registry.install(defineExtension({ name: "count", tools: [count] }));
```

每次调用均作为独立的持久化任务运行。其意图在`execute()`运行前即被提交。若进程在调用中途死亡，工具仅在声明为`replay: "safe"`时重启；否则模型会收到`interrupted`错误结果及已提交的输出。从`execute()`抛出异常也会给模型返回错误结果。结果也可返回`usage`，该内容会被添加至会话的[用量](#usage-and-cost)中。结果也可返回`control: { terminate: true }`：当每轮结果均要求时，运行结束，不再发起模型请求。

后续扩展的同名工具会覆盖先前的工具，且`wrapTool()`会装饰胜出的工具：

```typescript
const Venv = defineExtension({ name: "venv", tools: [createBashTool({ commandPrefix: "source .venv/bin/activate" })] });
const Timing = defineExtension({
	name: "timing",
	wraps: [wrapTool(createBashTool(), (bash) => ({ ...bash, execute: (args, api, ctx) => timed(() => bash.execute(args, api, ctx)) }))],
});
```

<a id="system-prompt"></a>
## 系统提示

系统提示由选中扩展的片段组成，按顺序渲染，每次请求前生成。片段可见已解析的代理、为请求构建的环境及已提交的文档：

```typescript
section("cwd", (input) => input.env?.cwd); // rendered as <cwd>\n...\n</cwd>; undefined omits it
```

会话的`instructions`片段最后渲染，作为`instructions`片段。片段和工具变更以位置方式存储在转录中。仅变更部分会被重新发送，以保持提供方提示缓存的热度。若片段每次返回内容不同，如当前时间，将无法达到此效果。

<a id="per-conversation-agent"></a>
## 每会话代理

每个会话在其`pi.agent`文档中存储其运行配置。`configure()`可在一次提交中修改它；未设置的字段继承自主机：

```typescript
await root.configure(
	{
		model: { provider: "openai", modelId: "gpt-6-sol" },
		thinkingLevel: "high",
		extensions: { remove: [Coding] }, // edits the host default; an array selects exactly these, in order
		tools: [readTool, bashTool], // an array offers exactly these; { remove: [...] } drops some
		instructions: "Only read; never edit files.",
		cwd: "/work/repo",
	},
	context,
);
await root.configure({ tools: null }, context); // null clears a field back to the host default
const agent = await root.agent(context); // resolved: model, extensions, tools, sections, cwd
```

扩展和工具以对象形式传递并按名称存储，因此存储的名称会超出其代码的生命周期：卸载扩展后，选择它的对话会停止获取它，直到再次安装。`createConversation()`、`fork()`和`root()`的变更与`agent`相同。一个任务拥有的对话（例如子代理的对话）开始时是其所有者对话代理的副本。一个分支开始时使用其父分支在分支入口处的代理。请求的模型、提示和提供的工具在准备时固定；变更从下一个请求开始生效。工具调用和钩子在其任务阶段解析代理时使用，环境在每次使用时都基于当前`cwd`构建，因此`cwd`或扩展的变更可以影响模型已经做出的调用。

<a id="settings"></a>
## 设置

每个对话共享的运行策略以`settings`形式传递。它在每次使用时读取，从不存储，因此getter使其生效，例如由设置文件支持：

```typescript
const harness = await Harness.open(storage, {
	models,
	registry,
	settings: {
		extensions: [CodingTools, Coding], // default selection; absent: every installed extension
		stream: { timeoutMs: 120_000 },
		retry: { maxRetries: 3 },
		compaction: { reserveTokens: 16384 },
		progress: { partialIntervalMs: 100, outputIntervalMs: 100 },
		toolExecution: "parallel",
		get followUpMode() {
			return userSettings.followUpMode;
		},
	},
}, context);
```

<a id="environment"></a>
## 环境

`env`为每个工具调用、章节渲染和`runtime.env()`构建执行环境。它接收对话的ID、其代理`cwd`和已提交的读取内容，因此一个函数可以为每个对话或容器提供一个目录：

```typescript
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node";

const harness = await Harness.open(storage, {
	models,
	registry,
	env: ({ cwd }) => new NodeExecutionEnv({ cwd: cwd ?? process.cwd() }),
}, context);
```

`env`抛出的异常会成为调用的错误结果。没有环境时，内置工具会以错误结果失败。每次调用使用一个全新的环境对象是可以的：`edit`和`write`将变更序列化到由环境的`id`和路径指定的一个文件中。自定义`ExecutionEnv`可以设置`id`，使得相同ID的对话看到相同路径下的相同文件，例如每个容器对应一个ID。

主机也可以直接使用环境，例如展示项目的文件。`openBinaryReader()`读取已打开文件的字节范围，`openDirReader()`分页目录，`exec()`通过argv数组运行程序而不使用shell，并报告每个输出片段来自哪个流：

```typescript
const status = { stdout: "", stderr: "" };
await env.exec(["git", "status", "--porcelain=v2", "-z"], {
	onOutput: (text, _context, { stream }) => {
		status[stream] += text;
	},
}, context);
```

终止上下文以停止一个调用；`cleanup()`用于关闭环境。自定义环境可以使用`registerEnvConformance()`和`@earendil-works/pi-durable/testing`中的方法检查自身，例如存储。
<a id="reload"></a>
## 重新加载

安装带有已安装名称的扩展程序会将其就地替换，一步完成：

```typescript
registry.install(await loadCodingExtension()); // same name "coding": replaces the installed one
```

`registry.uninstall(extension)`会移除已安装的该名称扩展程序，无论其对象是什么。

已经开始的工作会保留其代码：运行中的工具调用会在旧实现下完成，每个任务阶段会从阶段开始时的注册表中解析一次钩子和代理。下一个阶段、请求或调用会使用新代码。重启后，再次安装相同的扩展程序；扩展程序的`tasks`待处理任务会在其安装后恢复。

<a id="watching-a-conversation"></a>
## 观察对话

UI所需的一切都是提交状态。`viewState()`会将对话的结构视图作为只读Chord状态返回，每次提交操作更新后都会更新：

```typescript
const view = await root.viewState(context);
view.subscribe((value) => {
	// value.entries: the active transcript
	// value.docs["pi.live"]: the running generation (streamed partial, retry, deferred) and tool calls (output, details)
	// value.docs["pi.inbox"], value.docs["pi.usage"], value.docs["pi.agent"], value.docs["pi.provider"]
	render(value);
});
// later: view.dispose();
```

`watch()`会以每次提交的精确Chord操作将相同视图交付给用户，一次回调一次：

```typescript
const watch = await root.watch(context);
render(watch.value); // the state at attachment
watch.start(async (value, ops) => {
	await send(ops); // for example to a remote client that applies them
});
// later: await watch.stop();
```

慢速观察最多保留100个未交付的帧。超过后，待处理帧会被一个帧替换，该帧包含最新视图的完整内容。客户端如果延迟加入或重新连接，会从当前视图开始；不会重放任何内容。

部分答案和工具输出默认每100毫秒提交一次，因此崩溃最多会丢失该窗口的内容。`settings.progress`会更改这些间隔；存储在远程的主机可以更少地提交，例如`{ partialIntervalMs: 500, outputIntervalMs: 500 }`。

<a id="busy-conversations"></a>
## 繁忙的对话

对话在处理输入时处于忙碌状态。向繁忙的对话提交会将提交排队到对话的收件箱中，`docs["pi.inbox"]`在视图中显示：

```typescript
await root.submit({ type: "input", content: "Also run the tests" }, context); // follow-up (default)
await root.submit({ type: "input", content: "Use pnpm, not npm", whenBusy: "steer" }, context);
await root.submit({ type: "input", content: "Only if idle", whenBusy: "reject" }, context); // throws ConversationBusy
await root.submit({ type: "write", entry: { kind: "app.note", data: "user opened a file" } }, context);
```

- **Steers**会在当前工具轮次之后放置，并加入正在运行的工作。
- **Follow-ups**会在运行回答时放置，并启动下一轮。
- **Writes**会直接追加条目，无需询问模型。
- `await submission.abort(context)`会撤回排队的提交。
- [设置](#settings) `steeringMode: "all"`和`followUpMode: "all"`会将所有排队项一次性放置，而不是每次一个轮次。
如果运行失败，排队的项目将保留在收件箱中，直到下次提交时按先进先出的顺序处理。

<a id="reset-and-handoff"></a>
## 重置与交接

`reset()`开始新的上下文。模型不再看到较早的条目，但它们仍保留在存储中：

```typescript
await root.reset(undefined, context);                                  // start from nothing
await root.reset("We were fixing the flaky login test. Continue.", context); // start from a handoff note
```

忙时，重置会被排队，如同写入。当它在工具轮询期间被放置时，当前运行结束。工具可以使用`control: { handoff: "..." }`请求相同的操作。

<a id="compaction"></a>
## 压缩

压缩会缩小模型所见的内容：它会总结较早的条目，并追加一个`pi.compaction`条目，该条目包含总结并指向它保留的第一个条目。较早的条目仍保留在存储中。

```typescript
const id = await root.compact("Keep the failing test names", context); // manual, with optional instructions
const { outcome } = (await harness.waitForTask(id, context)).state;
if (outcome.status === "completed" && outcome.result.submissionId !== undefined) {
	const placed = await (await harness.submission(outcome.result.submissionId, context))!.wait(context);
	console.log(placed.status); // "done", or "unanswered" with reason "stale"
}
```

在制作总结的同时，对话会继续进行。总结会在对话空闲时立即放置，否则在下一个轮询边界时放置。按下Esc键（`abort()`）可取消手动压缩。

生成也会自行压缩，受以下[设置](#settings)控制：

```typescript
settings: {
	compaction: {
		enabled: true, // automatic compaction; manual compact() always works
		reserveTokens: 16384, // above contextWindow - reserveTokens, the next request waits for a compaction
		keepRecentTokens: 20000, // roughly how much recent context stays verbatim
		backgroundTokens: 32768, // this far below that, a compaction starts in the background; 0 disables it
	},
}
```

当提供方因上下文过长而拒绝请求时，生成会压缩并重试一次。在当前上下文开始之前，任何可能的总结会被放置为`stale`，因此当多个总结同时在进行时，最远的裁剪版本生效。总结的花费计入`pi.usage`。`beforeCompact`钩子可在`CompactionTask`上拒绝或提供自己的总结。

正在进行的压缩操作及其原因、尝试次数和重试回退时间会在`docs["pi.live"].compactions`中列出。代理事件会添加`compaction_start`和`compaction_end`，并在快照中添加`compactions`字段。

<a id="agent-events-experimental"></a>
## 代理事件（实验性）

对于希望使用编码代理风格事件（`message_start`、`message_update`、`tool_execution_start`等）而不是结构化状态的消费者：

```typescript
import { watchEvents } from "@earendil-works/pi-durable";

const stream = await watchEvents(harness, root.id, context);
initialize(stream.snapshot); // entries, run, in-flight generation, tools, compactions, inbox, agent, usage
stream.start(async (events) => {
	for (const event of events) console.log(JSON.stringify(event));
});
```

事件来源于提交，每个提交一批，叠加在快照之上。消息和工具更新携带增量：文本和思考的追加、追加的工具调用参数文本、输出的裁剪和追加。当消费者落后超过100批时，它会收到一个全新的`snapshot`事件。有关单次运行完整流的详细信息，请参见`test/examples/19-json.ts`。
<a id="hooks"></a>
## 钩子

钩子让扩展可以观察或调整内置任务，在选择它们的对话中：

```typescript
import { GenerationTask, hook, ToolTask } from "@earendil-works/pi-durable";

const Guard = defineExtension({
	name: "guard",
	hooks: [
		hook(ToolTask, { beforeTool: (call) => (call.name === "bash" ? { block: "bash is disabled here" } : undefined) }),
		hook(GenerationTask, { onYield: (answer) => (needsMoreWork(answer) ? { continue: "Keep going." } : undefined) }),
	],
});
```

- **生成：** `beforeRequest`（替换请求的消息），`afterResponse`，`onYield`（继续用另一个用户消息运行），以及`afterTools`（工具运行完成后，每轮运行一次）。
- **工具：** `beforeTool`（拦截或重写参数）和`afterTool`（替换结果）。

要限制钩子只在某些对话中生效，只需在这些对话中选择其扩展，例如使用`configure({ extensions: { add: [Guard] } })`。

<a id="more-conversations-and-forks"></a>
## 更多对话和分支

```typescript
const other = await harness.createConversation({ ownership: { kind: "ownerless" } }, context);
const fork = await root.fork(entryId, { ownership: { kind: "ownerless" } }, context);
```

分支会看到其父级的条目直到`entryId`，并独立继续运行。它保留父级条目时的代理，但会获得一个新的提供者会话身份。两者都应用了`agent`和`init`，并在创建提交时应用。

<a id="abort-and-subagents"></a>
## 中止和子代理

`await root.abort(context)`会停止一个对话：排队的输入被撤回（排队的写入保持），当前工作的每个任务都被中止，调用会在对话空闲时解析完成。

一个对话可以被一个任务**拥有**。子代理工具会在`api.commit()`中创建其子级，并使用`ownership: { kind: "task", taskId: api.taskId }`，然后通过`api.conversation(id)`驱动它：

```typescript
const Subagent: Extension = defineExtension({
	name: "subagent",
	tools: [
		defineTool({
			name: "subagent",
			description: "Delegate a self-contained task to a subagent and get its answer back.",
			parameters: Type.Object({ task: Type.String() }),
			replay: "safe", // a rerun after a crash finds the same child and submission
			execute: async (args, api, context) => {
				const child = await api.commit(async (tx) => {
					// The ownership index remembers the child, so a rerun reuses it.
					const existing = (await tx.scanConversations({ ownerTaskId: api.taskId }, 1)).items[0];
					if (existing !== undefined) return existing.id;
					// Starts as a copy of this conversation's agent: model, extensions, tools, cwd.
					const created = await tx.createConversation({ ownership: { kind: "task", taskId: api.taskId } });
					// A cheaper model, and no subagents of its own.
					await configure(tx, created.id, { model: haiku, extensions: { remove: [Subagent] } });
					return created.id;
				}, context);
				await api.details({ conversationId: child }, context); // lets a UI attach to the child
				const request = { type: "input", content: args.task, requestId: `subagent:${api.taskId}` } as const;
				const settled = await (await (await api.conversation(child, context))!.submit(request, context)).wait(context);
				return { content: [{ type: "text", text: settled.status }] };
			},
		}),
	],
});
```

拥有工作的任务属于其所有者：

- 中止调用会中止子级。调用失败也会中止子级：`execute()`抛出异常，或中断一个不支持回放的调用。
- 只有当子级空闲时，父级才空闲。
- 使用`{ background: true }`创建的任务是一个边界：它拥有的工作会存活于父级的中止之外，并不会让父级保持忙碌。`root.abort(context, { background: true })`也会中止它。

示例展示了这两种模式作为产品代码：

- [`22-subagent-foreground.ts`](test/examples/22-subagent-foreground.ts)：上面的工具，返回子级的答案。UI通过调用的`details`找到子级，并将子级的事件缩进打印在调用下方。
- [`23-subagent-background.ts`](test/examples/23-subagent-background.ts): 作为`subagent`工具的持久化子代理，负责生成、发送消息（引导或跟进）、等待、停止和列出。每个子代理由后台锚任务拥有，因此父代理的Esc和空闲等待不会影响它。每个消息由后台报告任务发送，一旦到达，报告任务会将结果作为跟进输入反馈给父代理；请求ID确保重启时不会重复发送消息或报告。

<a id="child-tasks"></a>
## 子任务

任务可以拥有子任务，通过`ownership: { kind: "task", taskId }`创建，并通过提交`waiting`状态来等待它们：

```typescript
pay: async (task, runtime, context) => {
	await runtime.commit(async (tx) => {
		const payments = [];
		for (const card of task.input.cards) {
			payments.push(await tx.createTask(Payment, { card }, { ownership: { kind: "task", taskId: task.id } }));
		}
		// Resume in `decide` once every payment is done; the first failure aborts the rest.
		return { status: "waiting", checkpoint: { phase: "decide", payments }, on: payments, policy: "failFast" };
	}, context);
},
decide: async (task, runtime, context) => {
	const outcomes = await runtime.outcomes(task.state.checkpoint.payments, context);
	// ...commit the checkout's own outcome
},
```

- **等待：**任务在等待期间不执行任何代码。使用`allSettled`时，一旦`on`中的所有任务完成即恢复；使用`failFast`时，第一个失败的子任务也会中止其他任务。`on`还可以命名其他任务，通过`allSettled`。

- **完成：**一个正在完成但其拥有的工作仍在运行的任务是`completing`：其结果已决定，但任务变为终端状态，`waitForTask()`返回，仅当其拥有的工作完成后才返回。失败或中止的结果会先中止其拥有的工作。

- [`24-child-tasks.ts`](test/examples/24-child-tasks.ts)运行一次带四个支付的检查：一张被拒的卡、一次被取消的检查、以及一次重启，支付过程同时进行。

<a id="task-graph"></a>
## 任务图

`harness.taskGraph(context)`展示了会话中每个活跃任务作为Chord状态，用于任务面板或调试。每个节点包含其拥有者边（`owner`任务，或其对话拥有者为null）、状态、是否为`background`或被中止标记，以及其拥有的对话。`harness.watchTaskGraph(context)`传递的值与观察值相同，如同对话的`watch()`。

```typescript
const graph = await harness.taskGraph(context);
graph.subscribe((value) => {
	for (const node of Object.values(value.tasks)) {
		const status = node.state.status === "waiting" ? `waiting on ${node.state.on.join(", ")}` : node.state.status;
		console.log(`${node.id} ${node.kind} ${status}`, node.owner ?? `conversation ${node.conversationId}`);
	}
});
```

任务在创建提交中出现，并在使其变为终端的提交中离开。状态为已提交的状态：`pending`、`running`、`waiting`（与`on`和`policy`一起）、以及`completing`（与持有的结果状态一起）。重启后，之前为`running`的任务会显示为`pending`，直到它们再次运行。任务是否因缺少定义而被阻塞不属于图的一部分；`harness.inspect()`会报告这一点。图中仅列出活跃任务：一旦子代理的拥有者任务变为终端，其对话中的后续任务成为顶层节点，对话的`ConversationRecord.owner`（也在其视图的`conversation`中）将其链接到父节点。[`24-child-tasks.ts`](test/examples/24-child-tasks.ts)在支付运行时打印检查树。

<a id="your-own-state"></a>
## 你自己的状态

文档是与条目一起提交的类型化JSON对象。定义一个，并在提交中编辑它：

```typescript
import { defineDoc } from "@earendil-works/pi-durable";

const Todos = defineDoc<{ items: string[] }>({
	kind: "app.todos",
	version: 1,
	scope: "conversation",
	history: "latest", // or "rewindable" to read old values with snapshotAsOf()
	fork: "initial", // what a fork starts with: "initial", "current", or "asOf"
	initial: () => ({ items: [] }),
});

await root.commit(async (tx) => {
	(await tx.doc(Todos, root.id)).items.push("write docs");
}, context);
console.log(await harness.snapshot(Todos, root.id, context));
```

`harness.watchDoc()`和`harness.documentState()`观察如上视图中的一个文档。`HarnessOptions.conversationCreated(tx, conversation)`在每次创建或分叉对话的提交中运行，包括工具的原始`tx.createConversation()`，因此每个对话都会获得你的文档；`init`在`createConversation()`、`fork()`和`root()`中按调用写入相同提交中的数据。扩展的工具、部分和钩子通过`api`或`input.read`读取自己的文档，并将缺失的文档视为其默认值（[`11-extension-state.ts`](test/examples/11-extension-state.ts)）。

<a id="usage-and-cost"></a>
## 使用和成本

每个对话在`docs["pi.usage"]`中维护令牌和成本总计：每个`provider/model`对应模型响应的成本，每个工具名称对应报告使用情况的工具结果。失败和中止的尝试也会计入。对于整个会话：

```typescript
const usage = await harness.usage(context); // { models: { "openai/gpt-6-sol": Usage }, tools: {...} }
```

<a id="storage"></a>
## 存储

| 后端 | 导入 | 备注 |
|---|---|---|
| 内存 | `MemoryStorage`来自包根目录 | 无数据持久化。 |
| SQLite | `openNodeSqliteStorage(file)`来自`@earendil-works/pi-durable/storage/sqlite/node` | 一个数据库文件。使用`synchronous = NORMAL`的WAL模式：提交在进程崩溃时得以保存；电源故障或主机故障时，最新提交可能丢失。 |
| JSONL | `openNodeJsonlStorage(directory, context)`来自`@earendil-works/pi-durable/storage/jsonl/node` | 一个目录中的追加只写文件。每次提交标记前传递`{ fsync: true }`以刷新。 |
一个进程一次只拥有一个存储；不存在进程间锁。可移植的 SQLite 和 JSONL 核心（`/storage/sqlite`，`/storage/jsonl`）无需 Node APIs 即可运行，例如在 Bun 或 Cloudflare Durable Objects 上，通过异步的 `SqliteDatabase` 接口或 `FileSystem`（来自 `@earendil-works/pi-durable/env`）即可。

SQLite 适配器实现基于 promise 的 `exec`、`run`、`get`、`all`、`transaction` 和 `close`。`run`、`get` 和 `all` 接受 SQL 文本和位置绑定；适配器可按 SQL 文本缓存预编译语句。事务回调接收一个事务句柄；事务内的所有操作都必须使用它，句柄在回调结束时失效。适配器必须排队无关操作和其他事务直到事务完成，因此在回调内调用 `database` 本身永远不会结束：

```typescript
await database.transaction(async (transaction) => {
	await transaction.exec("CREATE TABLE example (value TEXT)");
	await transaction.run("INSERT INTO example (value) VALUES (?)", "stored atomically");
});
```

自定义后端可以使用任何与 Vitest 或 Jest 兼容的运行器运行共享的符合性测试套件：

```typescript
import { registerStorageConformance } from "@earendil-works/pi-durable/testing";
import { describe, expect, it } from "vitest";

registerStorageConformance({ describe, expect, it }, "My Storage", async (use) => {
	const storage = await openMyStorage();
	try {
		await use(storage);
	} finally {
		await closeMyStorage(storage);
	}
});
```

包根目录加载了 TypeBox，因为工具任务使用 pi-ai 的 `validateToolArguments()` 验证参数。这在未拆包的情况下会占用约 23 MB 的峰值 RSS，打包后约 4 MB。

<a id="examples"></a>
## 示例

可运行的示例位于 [`test/examples`](test/examples)。从该包目录运行其中一个示例：

```bash
node --conditions=source --experimental-strip-types test/examples/14-chat.ts
```

| 示例 | 展示内容 |
|---|---|
| [14-chat](test/examples/14-chat.ts) | 一问一答 |
| [16-real-model](test/examples/16-real-model.ts) | 从 OpenAI 流式输出答案 |
| [17-coding-tools](test/examples/17-coding-tools.ts) | 在 JSONL 存储上使用工具的交互轮次 |
| [18-print](test/examples/18-print.ts) | 打印模式：提交提示，打印答案 |
| [19-json](test/examples/19-json.ts) | JSON 模式：代理事件或原始视图操作，支持 SQLite、JSONL 或内存 |
| [20-inbox](test/examples/20-inbox.ts) | 忙碌时的引导、跟进、写作和撤回 |
| [21-late-join](test/examples/21-late-join.ts) | 在运行中附加视图和事件流 |
| [22-subagent-foreground](test/examples/22-subagent-foreground.ts) | 一个可回放的安全子代理工具，其子代理由调用拥有，子代理事件位于调用之下 |
| [23-subagent-background](test/examples/23-subagent-background.ts) | 持久化子代理：生成、引导、停止、列出，答案反馈，支持重启 |
| [24-child-tasks](test/examples/24-child-tasks.ts) | 一个拥有并等待四个支付的分支：failFast、abort、restart |
| [25-compaction](test/examples/25-compaction.ts) | 背景压缩的长对话，手动触发，或在上下文溢出后自动触发 |
| [26-coding-agent](test/examples/26-coding-agent.ts) | CodingTools，实时从设置对象获取，环境跟随对话目录 |
| [27-plan-mode](test/examples/27-plan-mode.ts) | 仅读取的计划模式作为独立文档的扩展，通过 `configure()` 切换 |
| [28-reviewer](test/examples/28-reviewer.ts) | 带有独立模型、扩展、工具、目录和评审循环的评审对话 |
| [29-sandbox-per-conversation](test/examples/29-sandbox-per-conversation.ts) | 每个对话对应一个环境，从应用文档中查找 |
| [30-tool-override](test/examples/30-tool-override.ts) | 某些对话的同名 bash，以及一个计时 whichever bash 的包装器 |
| [31-reload-and-restart](test/examples/31-reload-and-restart.ts) | 中断调用时重新加载扩展，以及重启后保存的选择 |
| [00](test/examples/00-conversation.ts)–[13](test/examples/13-recovery.ts) | 底层层：会话、文档、分支、监视、框架、代理配置、重载、扩展状态、任务、恢复 |

调用 OpenAI 的示例需要 `OPENAI_API_KEY`；大多数其他示例使用伪提供者。

<a id="design-documents"></a>
## 设计文档

- [`docs/spec.md`](https://github.com/earendil-works/pi/blob/main/packages/durable/docs/spec.md)：规范说明  
- [`docs/pico-v5-handoff.md`](https://github.com/earendil-works/pi/blob/main/packages/durable/docs/pico-v5-handoff.md)：实现计划  
- [`docs/pico-v5-chord-usage.md`](https://github.com/earendil-works/pi/blob/main/packages/durable/docs/pico-v5-chord-usage.md)：包如何使用 Chord

基准测试：`npm run bench:storage`、`npm run bench:storage:memory` 和 `npm run bench:tool-output`。

## 许可证

MIT

