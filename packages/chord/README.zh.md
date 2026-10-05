# @earendil-works/chord

Chord 是一个用于由插件/扩展组成的系统的应用编排运行时。它提供方面、服务、复制状态和可插拔的远程服务边界。它作为 Pi 单仓库中的独立包进行开发，但它并不是 Pi 包：它不依赖于任何其他 Pi 工作区包，可以被无关的应用程序使用。

## Chord 的用途是什么

单个应用程序功能可能需要在多个环境中运行：例如，代理工作者、终端用户界面和远程 WebUI。Chord 提供了编写此类扩展的通用机制，既对人类用户友好，也对代理友好。

该设计由几个相互关联的部分组成：

- **插件**是同步设置单元，声明它们提供的服务和需求。在每个插件都声明其形状后，主机将验证完整的依赖关系图，绑定服务，先激活提供者再激活消费者，并按反向依赖顺序释放资源。这些单元称为 *方面*。

- **方面**是插件的一部分。每个方面单独打包并在其应运行的进程或环境中运行。你可以使用方面将插件拆分为需要加载到不同进程和环境中的独立部分（例如后端、浏览器、TUI 等）。

- **服务**是类型化、稳定的令牌，要么有一个提供者（**单例**），要么是动态键控实例（**键控**）。服务可以是进程本地的，具有不受限的 JavaScript 合约，也可以是远程可暴露的。消费者保留稳定的外观，而提供者断开连接或被替换时。

- **复制状态**将权威状态暴露给本地和远程连接的消费者。生产者使用 `change(context, callback)` 发布原子叠加交易；消费者接收完整的不可变值。草稿代理仅在回调期间存在，之后变得不可用。准备阶段会生成结构共享的不可变候选值和一个精确解码的操作批次，每个远程客户端/状态流拥有独立的路径编码状态。副本在断开连接或被替换时会变得不可用，直到重新加载。

- **变更跟踪**记录并合并对普通 JSON 的操作。它保留常见的字符串和数组操作，支持持久化批次，并在应用过程中验证不受信任的操作。批次保证收敛，但并非规范或最小。

- **远程服务源**广告外部方面主机可用的服务，并为其方面所需的服务打开绑定。绑定通过应用程序提供的适配器传递逻辑调用和订阅。Chord 要求严格的 JSON 参数、结果、快照、更新和目录，但不规定框架、路由、传输或应用程序线协议。`JsonRepresentation<T>` 为具有未知有效载荷的应用数据推导出线安全类型，而 `isJsonValue()` 在适配器边界验证接收到的值。对称 RPC 对等体计划作为此边界的可选实现。

- **上下文**Chord 提供了 Go 风格的上下文系统，用于取消和作用域应用值。应用程序可以通过这些值携带权限或遥测数据，而 Chord 不依赖于这些。

当前运行时导出服务令牌、单例和键控提供者、远程绑定、复制状态、方面主机和方面加载器，来自 `@earendil-works/chord`。从包根导入公共类型和通用运行时 API。上下文常量和函数位于 `@earendil-works/chord/context`，因为它们的通用名称不应污染根 API。Chord 所有权的标识符使用 `chord.*` 命名空间，其保留服务前缀为 `$chord.*`。

## 远程服务适配器

Chord 拥有其传输无关的服务线语法。消费者适配器使用 `createServiceCatalogueCall()`、`createServiceSubscribeCall()` 和 `createServiceUnsubscribeCall()` 进行 `$chord.service` 控制调用。`createRemoteServiceEndpoint()` 处理单个提供者消费者的相关调用，包括订阅激活和清理。`parseServiceCall()`、`parseServiceCatalogue()` 以及解码/线快照和更新解析器在适配器建立严格的 JSON 边界后验证 Chord 语义。`RemoteServiceErrorCode` 和 `REMOTE_SERVICE_ERROR_CODES` 定义了
服务错误可能会跨越该边界。

复制状态操作在提供方使用一个`createServiceStateEncoder()`，在消费方使用一个`createServiceStateDecoder()`，每个订阅各一份。这些注册表为每个实例/成员状态创建独立的Delta路径字典，并在替换、不可用、关闭或新鲜水合时重置。应用程序可将这些值放入任何路由、请求、响应或事件信封中；Chord不对外层协议做任何规定。

提供方订阅会原子性地捕获一个快照，并缓冲后续更新直到激活。激活和重入发布使用相同的FIFO队列。提供方每个订阅最多保留100条待处理更新，不包括正在运行的交付。添加第101条更新会用`{ type: "reset", snapshot }`替换整个待处理队列：一个完整的订阅快照，其状态成员包含`[["r", value]]`及其新的序列基线。它还捕获当前实例成员资格，因此废弃的生成/关闭/替换事件不会留下陈旧实例。实时键生成保留其现有句柄。重置携带触发溢出的发布上下文。

消费者和编解码器必须在接受后续普通Delta之前处理此显式重置。在普通`state`更新中的根操作不允许序列间隙。重置会重启订阅的路径字典，后续Delta必须从每次重置基线开始连续。传输适配器必须保持快照/重置/更新顺序；它们不能丢弃编码的Delta批次，也不能假设自己的异步队列受提供方队列的限制。

## 跟踪JSON Delta

从`@earendil-works/chord/delta`导入独立的事务跟踪器：

```ts
import { applyImmutable, track } from "@earendil-works/chord/delta";

const tracker = track({ output: "", count: 0 });
const change = tracker.beginChange();
change.state.output += "done\n";
change.state.count += 1;
const prepared = change.prepare();

tracker.adopt(prepared);
const replica = applyImmutable(prepared.base, prepared.ops);
```
  
`tracker.value`始终是最新的采纳的不可变修订版本。准备过程不会改变权威；采纳过程会验证准备过程并交换根指针。分配的容器按值复制，未更改的子树可在不同修订版本间共享。

跟踪器使用可信的不可变所有权，而不是防御性复制或冻结。`track(initial)`、`prepareReplace(value)`、`replicatedState(initial)`和
`replace(context, value)` 拥有无别名的严格JSON根节点的所有权，但不遍历它们。调用者不得对传递或发布的数据进行变异。通过草稿放置的值已被复制，因此在草稿更改之前，walk也会拒绝非严格JSON。已发布的值不会被冻结。进程内回环消费者可能会与提供者共享其容器；变异已消费的值会违反约定并可能破坏权限。在任何可变信任边界处克隆或序列化。

复制状态通过回调提供相同的模型：

```ts
const initial = { output: "", count: 0 };
const status = env.replicatedState(initial); // transfers ownership of initial
status.change(context, (draft) => {
	draft.output += "done\n";
	draft.count += 1;
});
```

成功的`change()`发布恰好一个原子修订版本。如果其回调抛出异常，原始值和序列保持不变。回调返回后，草稿句柄将不可用。Chord发出字符串追加和前端截断操作、数组插入和置换、集合操作以及删除操作；大型编辑集可能会折叠为完整替换。远程连接管道为每个客户端/状态配对独立编码每个批次。

###  公共状态订阅

`state.subscribe(async (value, context, delivery) => { ... })` 独立为每个订阅序列化回调。当值可用时，hydrate立即开始，其返回的Promise必须在更新开始之前完成。同步回调仍然同步执行。在异步回调中读取捕获的`value`：`state.value`可能已引用到一个较晚的修订版本。

每个订阅最多保留100个待交付的完整值，不包括正在运行的回调。当溢出时，仅保留最新待交付的值、上下文和交付元数据；尚未开始的初始hydrate被保留。因此，公共交付序列可能会跳过某些值。这是一项帧计数策略，而非字节限制。内部精确操作订阅保持同步，独立接收每个修订版本，不受慢速公共回调的影响。

返回的取消订阅函数会立即丢弃待处理工作并阻止新回调。它既不中止也不等待正在运行的回调。同步抛出和Promise拒绝会被观察、报告，但不会停止其他订阅或后续回调。附加源和远程绑定使用
their `onError` 处理器；本地可变状态（以及没有处理器的附加源）通过在微任务中抛出异常报告失败。取消订阅不会隐藏后续的拒绝事件，不会影响正在运行的回调。

独立的 [Delta 指南](src/delta/README.md) 定义了完整的所有权、生命周期、操作和副本合约。

##  打包和加载方面

`@earendil-works/chord/bundler` 使用 esbuild 将 ESM 或 TypeScript 应用入口转换为独立的内容寻址 CommonJS 文件。包级 API 从 `package.json` 读取插件标识和构建配置，然后应用由宿主应用提供的方面路径约定：

```json
{
  "name": "@example/my-plugin",
  "version": "1.0.0",
  "type": "module",
  "peerDependencies": {
    "@earendil-works/chord": "^0.84.4"
  },
  "chord": {
    "facets": {
      "worker": "./src/custom-worker.ts",
      "presentation": false
    }
  }
}
```

```ts
import { bundleFacetPackage } from "@earendil-works/chord/bundler";

await bundleFacetPackage({
	packagePath: "/path/to/my-plugin",
	outdir: "/application-owned/plugin-builds/my-plugin",
	defaultFacets: {
		worker: "src/worker.ts",
		presentation: "src/presentation.ts",
	},
});
```

除非 `chord.facets` 覆盖或
禁用它们。依赖关系被外部化，并在加载时针对宿主进行解析。Chord 从不安装依赖项或运行包生命周期脚本。`bundleFacets()` 作为较低级别的 API 保持可用，供那些已经具有显式插件身份和入口映射的调用者使用。

输出目录中包含每个 `.cjs` 文件以及 `chord-facets.json`。通过 Node 专用加载器加载应用程序选择的入口：

```ts
import { createFacetBundleLoader } from "@earendil-works/chord/node";

const loader = createFacetBundleLoader({
	manifestPath: "/application-owned/plugin-builds/my-plugin/chord-facets.json",
	entry: "worker",
	resolveExternal: (specifier) => import.meta.resolve(specifier),
});
const loaded = await loader.load();
```

每个 `load()` 都会验证 SHA-256 完整性，并直接使用 `node:vm` 编译 CommonJS 主体，而不是将插件放入 Node 的 CommonJS 或 ESM 模块中。
cache。外部依赖由主机解析并通过受限`require`加载；esbuild将动态导入降级，使其使用相同的路径。释放一个退役的生成会释放加载器的面引用，使其编译代码在插件拥有的资源也消失后，有资格进行垃圾回收。

为了传输到另一个节点主机，`readFacetBundleArtifact()`会将一个已验证的清单条目与其源代码打包，而`createFacetBundleArtifactLoader()`则会生成新的临时生成并解析对外部依赖，针对接收主机。

重新加载时，加载一个候选者，将其面传递给`FacetHost.reload()`，如果失败则丢弃候选者，只有在成功切换后才丢弃退役的`LoadedFacets`。主机激活并验证候选者，同时当前活动的提供者保持路由，然后直接替换每个单例，无需不可用间隔。因此，稳定的服务处理程序在普通重新加载过程中不会断开连接。键控实例保持实例特定性，替换实例会获得新的生成。打包器在替换之前会写入一个完整的临时目录，因此加载器不会观察到部分构建的生成。

有关更广泛的RPC和生成加载架构，请参见[PLANNING.md](PLANNING.md)。

