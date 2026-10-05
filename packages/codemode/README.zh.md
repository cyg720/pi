# @earendil-works/pi-codemode

在 QuickJS 虚拟机（编译为 WebAssembly）中运行模型编写的 JavaScript 代码，该虚拟机中唯一的功能是调用注入的工具。嵌套的工具调用不会进入大语言模型（LLM）上下文；只有脚本的输出和返回值才会进入。

脚本可以使用 `tools`、`ALL_TOOLS`、`text`、`image`、`exit`、`store` 和 `load`，并且可以以 `// @options:` 行开头。编码代理使用它来调用其内置的 `codemode` 工具。它没有 pi 依赖，可以单独使用，将任何函数（远程 API、MCP 服务器、应用服务）暴露给模型编写的脚本。

## 用法

```ts
import { CodemodeSandbox } from "@earendil-works/pi-codemode";

const sandbox = new CodemodeSandbox({
	timeoutMs: 60_000,
	tools: [
		{
			name: "read",
			execute: async (args, { signal }) => {
				const { path } = args as { path: string };
				return await readFile(path, "utf8");
			},
		},
	],
});

const result = await sandbox.execute(`
	const source = await tools.read({ path: "package.json" });
	text("bytes " + source.length);
	return JSON.parse(source).name;
`);

console.log(result.output); // [{ type: "text", text: "bytes 1234" }]
if (result.ok) console.log(result.value); // "@earendil-works/pi-codemode"
else console.error(result.error.kind, result.error.message);

await sandbox.close();
```

`code` 是一个异步函数的主体：`return` 和顶层 `await` 一起工作。在脚本内部：

- `tools.<name>(args)` 返回一个 Promise。参数和结果通过 JSON 进行往返传输。抛出异常的工具会携带 `Error` 并附带相同的消息。工具名称也作为标识符暴露出来：标识符中非法的字符会被转换为 `_`（`toCodemodeIdentifier`），因此 `my-tool` 既是 `tools.my_tool` 也是 `tools["my-tool"]`。
- `ALL_TOOLS` 列出 `{ name, description }` 中的所有工具，标识符为 `name`。
- `text(value)` 将文本项追加到 `result.output`；非字符串类型的值会被 JSON.stringify。`console.log/info/warn/error/debug` 也会追加文本项。
- `image(urlOrItem)` 追加一个图像项。它接受 base64 `data:` URL、`{ image_url }` 或 MCP `ImageContent` 块（`{ type: "image", data, mimeType }`）。远程 URL 会被拒绝。
- `exit()` 立即成功结束脚本，保留其输出和存储写入。
- `globals` 传递给沙箱的函数会被当作顶层函数调用，例如主机辅助函数 `image(ref)`。它们的行为类似于工具，但不会被记录在 `result.calls` 中。名称如 `models.classify` 会将函数挂载到一个冻结的 `models` 对象上。使用 `spread: true` 时，`execute` 会将所有调用参数作为数组传递而不是第一个参数，`signature` 会替换由模式生成的声明。
- `store(key, value)` 和 `load(key)` 可以同步读写 JSON 值。详见 [Store](#store)。
- 没有其他功能：没有计时器、`fetch`、`process`、`require`、模块或 `WebAssembly`。`eval` 和 `Function` 可以工作，但仅会在同一个 VM 内生成更多代码。

`timeoutMs: Infinity`禁用截止时间；脚本会一直运行直到其结束或 `signal` 中断它。如果脚本等待一个永远不会结束的 Promise（没有工具调用待处理，且 VM 没有时钟或 I/O），脚本会立即失败而不是挂起。

`memoryLimitBytes`限制 VM 的堆大小。超过该限制的分配会在脚本内部以 `InternalError: out of memory` 的形式失败。

<a id="store"></a>
## 存储

`store`/`load` 让脚本可以在多次执行间保持值。沙箱本身不会持久化任何内容：将当前值作为 `options.store` 传递，并且成功的结果会报告脚本更改的内容为 `result.storeWrites`（`{ set, delete }`）。失败的执行不会报告任何写入。

```ts
const result = await sandbox.execute(`store("runs", (load("runs") ?? 0) + 1)`, { store: saved });
if (result.ok) {
	for (const key of result.storeWrites.delete) delete saved[key];
	Object.assign(saved, result.storeWrites.set);
}
```

`load` 返回一个副本，因此修改它不会改变存储。存储 `undefined` 会删除对应的键。单个值的最大 JSON 字符数为 `MAX_STORE_VALUE_CHARS`（256 Ki），所有值的总和最大为 `MAX_STORE_TOTAL_CHARS`（1 Mi）；超过此限制的写入会在脚本内部抛出 `RangeError`。

## 源格式

`parseCodemodeSource()` 接受一个脚本，其第一行可以是一个选项行：

```js
// @options: {"max_output_tokens": 2000, "timeout_ms": 30000}
const source = await tools.read({ path: "package.json" });
text(JSON.parse(source).name);
```

支持的字段有 `max_output_tokens`（输出的令牌预算）和 `timeout_ms`（硬性截止时间）。沙箱不会处理这些字段；由调用者决定。选项行会被替换为空行，因此堆栈跟踪中的行号仍与输入匹配。空输入、无效 JSON、未知字段或没有代码的选项行会抛出 `CodemodeSourceError`。`CODEMODE_SOURCE_GRAMMAR` 是一个 Lark 语法，用于支持语法约束工具输入的提供者。两者也都可以从轻量级 `@earendil-works/pi-codemode/source` 入口获取。

## 捆绑的主机

默认情况下，沙箱会加载 `quickjs-wasi/quickjs.wasm` 并启动安装包旁边的 worker 文件。当主机被捆绑时，这两个文件都不存在于磁盘上，因此需要传递：
```ts
import { CodemodeSandbox, loadQuickJSWasm } from "@earendil-works/pi-codemode";

const sandbox = new CodemodeSandbox({
	tools,
	// Compiled once per path and cached.
	wasm: loadQuickJSWasm(pathToQuickJSWasm),
	// A file of your build containing `import "@earendil-works/pi-codemode/worker";`
	workerUrl: new URL("./codemode-worker.js", import.meta.url),
});
```

`workerUrl` 支持 URL 或字符串。对于 Bun 编译的可执行文件，将 worker 作为额外的构建入口点，并传递其相对源路径作为字符串，例如 `"./src/codemode-worker.ts"`；Bun 会从其嵌入的模块图中解析该形式。

##  模型的声明

工具和全局变量可以携带 `description`、`inputSchema` 和 `outputSchema`（JSON Schema）。`renderDeclarations()` 会将它们转换为面向模型的工具描述的 TypeScript 声明：

```ts
renderDeclarations({ tools: sandbox.tools, globals: sandbox.globals });
// declare const tools: {
//   /** Read a file */
//   read(args: {
//     path: string;
//   }): Promise<string>;
// };
```

模式仅塑造声明；不验证值。本地引用（`#/$defs/...`、`#/definitions/...`）会被展开；递归和远程引用会被渲染为 `unknown`。

##  与 pi-agent-core 一起使用

要给 `Agent` 提供一个 codemode 工具，需将其他工具暴露给沙箱，并将 `execute()` 包装为 `AgentTool`：

```ts
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
	type CodemodeJsonSchema,
	CodemodeSandbox,
	type CodemodeTool,
	renderDeclarations,
} from "@earendil-works/pi-codemode";
import { Type } from "typebox";

const sandboxTools: CodemodeTool[] = agentTools.map((tool) => ({
	name: tool.name,
	description: tool.description,
	inputSchema: tool.parameters as CodemodeJsonSchema,
	outputSchema: (tool.outputSchema as CodemodeJsonSchema | undefined) ?? { type: "string" },
	execute: async (args, { signal }) => {
		const result = await tool.execute("nested", args as never, signal);
		if (tool.outputSchema && result.structuredContent !== undefined) return result.structuredContent;
		return result.content.map((block) => (block.type === "text" ? block.text : "")).join("\n");
	},
}));

const codemodeTool: AgentTool = {
	name: "codemode",
	label: "Codemode",
	description: `Run JavaScript that calls tools as \`await tools.<name>(args)\`. Output with text() or return.\n\n${renderDeclarations({ tools: sandboxTools })}`,
	parameters: Type.Object({ code: Type.String() }),
	execute: async (_toolCallId, { code }, signal) => {
		const sandbox = new CodemodeSandbox({ tools: sandboxTools });
		try {
			const result = await sandbox.execute(code, { signal });
			const content = [...result.output];
			if (result.ok && result.value !== undefined) content.push({ type: "text", text: JSON.stringify(result.value) });
			if (!result.ok) content.push({ type: "text", text: result.error.stack ?? result.error.message });
			return { content, details: undefined, isError: !result.ok };
		} finally {
			await sandbox.close();
		}
	},
};
```

`result.output` 已经具备 `@earendil-works/pi-ai` 的 `TextContent` 和 `ImageContent` 的形状。直接调用 `tool.execute()` 会跳过代理的 `beforeToolCall` 和 `afterToolCall` 钩子。若要将它们也应用到嵌套调用，可将每个调用通过 `runToolCall()` 从 `@earendil-works/pi-agent-core` 进行处理，如 [mcp-codemode 示例](https://github.com/earendil-works/pi/tree/main/packages/agent/examples/mcp-codemode) 所示。该示例还会拒绝脚本内部的失败嵌套调用，并将 codemode 与 MCP 工具结合使用。

##  结果

`execute()` 不会因脚本失败而拒绝。`result.error.kind` 可能是：

| 类型      | 含义                                                                           |
| --------- | ----------------------------------------------------------------------------- |
| `script`  | 脚本抛出或解析失败；`stack` 指向 `codemode.js:<line>`                     |
| `timeout` | 超时；工作线程被终止                                                           |
| `aborted` | `options.signal` 触发或 `close()` 被调用；工作线程被终止                 |
| `sandbox` | 工作线程或虚拟机失败，例如 wasm 陷阱或缺失 worker 文件                           |

`result.output` 会按脚本生成顺序保存文本和图像项目，即使执行失败也是如此。主机在脚本结束前会保留所有内容，因此输出受限于 `MAX_OUTPUT_CHARS`（16 Mi）字符的文本和 base64 图像数据，以及 `MAX_OUTPUT_ITEMS`（100000）个项目。超过任一限制，脚本将以 `RangeError` 失败，即使它捕获了错误。`result.calls` 列出所有工具调用，每个调用带有 `status: "ok" | "error" | "cancelled"`。当脚本返回时（未等待），仍在运行的调用会被工具的 `signal` 中断并报告为 `cancelled`。

##  工作原理

每个 `execute()` 会启动一个工作线程（约 20 ms，包括 VM 创建），该线程从编译的 wasm 模块实例化一个全新的 QuickJS VM。该 VM 是独立的 wasm 实例，拥有自己的线性内存。其唯一导入是 WASI shim（时钟、随机数和 stdout/stderr 写入，worker 会丢弃）和一个主机调用入口点，因此脚本无法通过除 worker 注册的函数外的任何方式访问主机。

worker 在 VM 内部评估预引子，其中包含单个主机桥接函数的闭包，并在此基础上构建 `tools`、`console` 和全局变量。脚本被编译为异步函数体。

工具调用作为消息转发给主机线程；主机运行工具并将 JSON 结果发回。主机拥有截止时间和中断信号。任一触发时，会设置共享中断标志，VM 会轮询该标志，然后调用 `worker.terminate()`。该标志在 Bun 上是必需的，因为 `terminate()` 无法停止正在 wasm（`while (true) {}` 或 `while (true) await null`）中旋转的线程。

worker 保持脚本执行离开主机线程：QuickJS 同步运行，因此在主机线程上旋转的脚本会阻塞其事件循环。

##  运行时说明

-  在 Node 和 Bun 上行为一致，包括内存限制、中断和可捕获的 `RangeError`（深度递归）；QuickJS 的栈保护已启用，否则 wasm 栈会溢出并触发。

栈跟踪使用 QuickJS 框架（`at f (codemode.js:2:31)`），并以 `Name: message` 前缀，类似 V8。包装器前缀与脚本的第一行共享行号，因此行号精确；第一行的列号会偏移。

- 
- QuickJS 是一个解释器。粘合代码和过滤工具的结果足够快；而繁重的计算则比 V8 更慢。

