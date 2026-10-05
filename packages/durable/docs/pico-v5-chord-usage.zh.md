# Pico5 文档通过 Chord

本指南使用 [Pico5 规范](spec.md) 中的合约。其代码可编译并运行为 `test/chord-guide.test.ts`；请保持两者同步。

- **会话**：用于对话、条目、任务和文档的持久化容器；它将变异序列化到单个提交行上。
- **方面**：Chord 主机中某个功能的设置单元。设置会同步声明服务和依赖；`onActivate` 在依赖就绪后运行。
- **上下文**：显式传递的取消和调用值。转发调用者的上下文。
- **服务**：通过 `env.use` 获取的类型化令牌和实现。远程服务包含复制状态和异步方法，参数为 JSON，末尾带 `Context`。
- **持久化文档**：作为完整基础的 JSON 持久化，包含 Chord 操作和检查点。其定义令牌声明模式、版本、作用域和初始化；对话作用域还声明历史和分叉行为。
- **事务草稿**：来自 `await tx.doc` 的可撤销写时复制对象，仅在该提交回调内有效，包括所有嵌套对象。
- **文档状态**：绑定到单一文档实例的可丢弃只读 Chord 状态。
- **复制状态**：通过 `value` 和 `subscribe(listener)` 实现的 Chord 不可变完整值。`value` 是 `undefined` 在未加载或断开连接前的状态。监听器接收 `(value, context, delivery)`；交付内容包含 `kind`（`hydrate` 或 `update`）和流 `sequence`，而非会话提交号。

文档直接作用于会话、对话或任务。任务是附属于对话的持久化工作；其文档在任务变为终端状态时退役，不再参与对话分叉。

## 导入和适配器边界

示例相互关联。`ConversationRecord`、`EntryRecord` 和 `TaskRecord` 是持久化记录，而 `Conversation` 是公共对话对象，`Entry`/`Task` 是类型定义。导入：

```ts
import {
  createFacetHost, createRemoteServiceBinding, defineFacet, defineService,
  type Context, type Facet, type FacetHost, type RemoteServiceTransport, type ReplicatedState,
} from "@earendil-works/chord";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  type ConversationId, defineDoc, defineDocFamily, type DocumentObserver,
  type Harness, type Session, type TaskId, type TaskRuntime,
} from "@earendil-works/pi-durable";
```

一个 `Harness` 是一个 `Session`，因此下面每个函数也接受已打开的 Harness。

`documentState()` 内部执行 Chord 采用操作：它原子地捕获已提交的快照，注册后续精确帧，并返回已加载的只读状态。快照覆盖的操作不会被重发。丢弃状态会释放观察，而非文档本身。Pico 仍是唯一可变器。

## 1. 会话级画布

本会话中所有对话共享一个画布。会话文档仅包含当前状态，无历史或分叉设置。

```ts
type Stroke = { color: string; points: { x: number; y: number }[] };
type CanvasState = { strokes: Stroke[] };

const CanvasDoc = defineDoc<CanvasState>({
  kind: "app.canvas", version: 1, scope: "session",
  initial: () => ({ strokes: [] }),
  // Store a complete base after at most 99 replayed deltas.
  checkpointWhen: (_value, _ops, info) => info.deltasSinceBase >= 99,
});

interface CanvasService {
  readonly state: ReplicatedState<CanvasState | null>;
  addStroke(stroke: Stroke, context: Context): Promise<void>;
}
const Canvas = defineService<CanvasService>("app.canvas");

async function createCanvasFacet(session: Session, context: Context): Promise<Facet> {
  // Creation is explicit; observation never writes.
  await session.commit(async tx => {
    await tx.doc(CanvasDoc);
  }, context);
  const state = await session.documentState(CanvasDoc, context);
  if (state === undefined) throw new Error("canvas was retired during setup");
  return defineFacet({
    id: "app.canvas/session",
    setup(env) {
      env.own(() => state.dispose());
      env.provide(Canvas, {
        state,
        async addStroke(stroke, context) {
          await session.commit(async tx => {
            const draft = await tx.doc(CanvasDoc);
            draft.strokes.push(stroke); // Chord copies the assigned stroke by value.
          }, context);
        },
      });
    },
  });
}

const CanvasConsumer = defineFacet({
  id: "app.canvas/consumer",
  setup(env) {
    const canvas = env.use(Canvas); // Declare now; access only after activation.
    env.onActivate(() => {
      env.own(canvas.state.subscribe((value, _context, delivery) => {
        console.log(delivery.kind, delivery.sequence, value?.strokes.length ?? "retired");
      })); // subscribe delivers the current hydrated value, then updates.
    });
  },
});

async function runCanvasExample(session: Session): Promise<void> {
  const context = BACKGROUND_CONTEXT;
  const provider = await createCanvasFacet(session, context);
  const host = await createFacetHost({ facets: [provider, CanvasConsumer] });
  try {
    await host.services.use(Canvas).addStroke({
      color: "black", points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    }, context);
  } finally {
    await host.dispose(); // Unsubscribes; does not delete the canvas or close Session.
  }
}
```

应用拥有已打开的会话。异步获取文档状态后，再同步执行 `setup`，然后将丢弃转移给方面；`env.provide` 不能在 `onActivate` 中运行。每个会话主机安装一个提供者。Chord 可独立重新加载呈现方面。会话侧工具、钩子、任务和提示部分通过 Harness 注册表重新加载：在相同名称下安装替换扩展（规范第 7.5 节）。已运行的工作会保留旧代码，因此方面自行管理其旧资源的生命周期。

远程客户端提供连接到主机 `services` 提供者的 `RemoteServiceTransport`；Chord 不规定套接字协议。`CanvasConsumer` 在配置为远程服务源的 UI 主机中同样有效。

```ts
async function connectCanvas(transport: RemoteServiceTransport, context: Context) {
  const services = createRemoteServiceBinding({ services: [Canvas], transport });
  const canvas = services.use(Canvas);
  const stop = canvas.state.subscribe((value, _context, delivery) => {
    console.log(delivery.kind, delivery.sequence, value?.strokes ?? "retired");
  });
  try {
    await services.ready(context); // Initial snapshot installed; not all future updates.
  } catch (error) {
    stop();
    await services.dispose(BACKGROUND_CONTEXT);
    throw error;
  }
  return async () => {
    stop();
    await services.dispose(BACKGROUND_CONTEXT);
  };
}
```

```text
explicit first tx.doc -> commit base { strokes: [] }
addStroke(A)       -> commit A -> local and remote subscribers see A
worker restarts   -> open same durable storage; install canvas facet again
acquire source    -> load base + committed deltas, without rerunning initial()
late client       -> hydrate complete canvas including A, then ordered updates
conversation fork -> still uses this same Session canvas
```

使用持久化存储以实现重启生存能力。内存后端非持久化。方法成功提交并不保证所有远程回调均已运行。

反向关闭：断开客户端，丢弃主机方面，后者撤回服务并丢弃其拥有的文档状态，最后关闭 Harness。若先关闭 Harness，仍连接的客户端会保留最后值且不再更新。

```ts
async function shutdown(host: FacetHost, detachClients: () => Promise<void>, harness: Harness, context: Context) {
  await detachClients();
  await host.dispose();
  await harness.close(context);
}
```

## 2. 对话级差异审查

一个**文档家族**使用单一定义创建多个实例。逻辑键为 `(kind, conversationId, key)`；持久化数值型文档 ID 识别一个实例且永不重复。创建种子不属于键。

```ts
type ReviewInput = { path: string; patch: string };
type ReviewComment = { id: string; line: number; text: string };
type ReviewState = ReviewInput & { comments: ReviewComment[] };
const ReviewDoc = defineDocFamily<ReviewState, ReviewInput>({
  kind: "app.diff-review", version: 1, family: true, scope: "conversation",
  history: "latest", fork: "current",
  initial: seed => ({ path: seed.path, patch: seed.patch, comments: [] }),
  checkpointWhen: (_value, _ops, info) => info.deltasSinceBase >= 49,
});
interface DiffReviewService {
  readonly state: ReplicatedState<ReviewState | null>;
  identity(context: Context): Promise<{ conversationId: ConversationId; key: string }>;
  addComment(comment: ReviewComment, context: Context): Promise<void>;
}
const DiffReviews = defineService<DiffReviewService>("app.diff-reviews");

function reviewFacet(
  session: Session, conversationId: ConversationId,
  reviews: readonly { key: string; seed: ReviewInput }[], context: Context,
): Facet {
  return defineFacet({
    id: "app.diff-reviews/session",
    setup(env) {
      const instances = env.provideMany(DiffReviews);
      env.onActivate(async () => {
        for (const review of reviews) {
          await session.commit(async tx => {
            await tx.doc(ReviewDoc, conversationId, review.key, review.seed);
          }, context);
          const state = await session.documentState(ReviewDoc, conversationId, review.key, context);
          if (state === undefined) throw new Error("review was retired during setup");
          env.own(() => state.dispose());
          // Chord instance keys route services; they are not numeric document incarnation IDs.
          instances.spawn(JSON.stringify([conversationId, review.key]), {
            state,
            async identity() { return { conversationId, key: review.key }; },
            async addComment(comment, context) {
              await session.commit(async tx => {
                const draft = await tx.doc(ReviewDoc, conversationId, review.key, review.seed);
                draft.comments.push(comment); // Chord copies the assigned comment by value.
              }, context);
            },
          }); // The facet owns spawned service lifetimes automatically.
        }
      });
    },
  });
}
```

示例输入：`[{ key: "review-7", seed: { path: "a.ts", patch: "-old\n+new" } }]`。
传递独立的家庭密钥和真实的对话ID；按照上述方式安装面相。

密钥消费者使用`env.observe(DiffReviews, handler)`，而不是`env.use`。处理器接收`(review, context)`；调用`review.identity(context)`来识别它，并调用`review.state.subscribe`来观察评论。

这些评论是对话范围的：结束生成任务或卸载面相不会使它们退役。`current`在分支提交时将每个逻辑上存在的评论复制到具有新数字ID的独立子实例中，保留家庭密钥。父实例和子实例随后分叉。

```text
parent review-7: comment A -> transcript entry E -> comment B
fork at E with current: child review-7 contains A and B
child adds C: parent still contains only A and B
```
  
使用`fork: "initial"`时，不会复制任何实例；第一个子实例`tx.doc()`使用其提供的种子。`latest`无法读取历史记录或分支`asOf`；使用`history: "rewindable"`和`asOf`来反映E的提交。重新访问会忽略后来的种子；更新补丁需要显式的变异或不同的评论密钥。

## 3. 任务范围的输出和工具/任务监视

这是一个有界的进度窗口，而不是永久结果。范围本身赋予了它任务生命周期；不需要历史记录、分支、所有者或对话设置。

```ts
type JobInput = { command: string };
type JobOutput = { stdout: string; chunks: number };
const JobOutputDoc = defineDoc<JobOutput>({
  kind: "app.job-output", version: 1, scope: "task",
  initial: () => ({ stdout: "", chunks: 0 }),
  checkpointWhen: (_value, _ops, info) => info.deltasSinceBase >= 99,
});
async function appendJobOutput(
  runtime: TaskRuntime<JobInput, { phase: "running" }, null, object>,
  chunk: string, context: Context,
): Promise<void> {
  // Read process output outside this callback. The runtime gates the live task.
  await runtime.commit(async tx => {
    const draft = await tx.doc(JobOutputDoc, runtime.taskId);
    draft.stdout = (draft.stdout + chunk).slice(-50_000);
    draft.chunks += 1;
  }, context);
}
async function observeJob(
  api: DocumentObserver, producerTaskId: TaskId,
  finished: Promise<void>, context: Context,
): Promise<void> {
  const watch = await api.watchDoc(JobOutputDoc, producerTaskId, context);
  if (watch === undefined) return;
  console.log(watch.value === null ? "retired" : watch.value.stdout);
  try {
    watch.start(async (value, ops, _context) => {
      await sendCommittedFrame(value, ops);
      await render(value === null ? "retired" : value.stdout);
    }); // Serialized callbacks never overlap.
    await finished; // Caller-supplied observation lifetime; outside any commit.
  } finally {
    await watch.stop(); // Idempotent; prevents another callback from starting.
  }
}
```
  
运行阶段调用`appendJobOutput`，并且必须也提交其下一个检查点或最终结果。`api`是调用的`DocumentObserver`；`TaskRuntime`包含该接口。`tx.doc()`的创建会验证目标任务是否处于活动状态，并从任务记录中派生其对话。稍后非创建监视的查找在任务终止且其文档退役后返回`undefined`。

```text
watchDoc: capture immutable V0 + register for later exact committed frames
producer commits D1 and D2 before start: buffer (V1, D1), (V2, D2)
start: caller has initialized from V0; deliver D1, then D2 serially
producer commits D3 while listener awaits: buffer D3; never overlap callbacks
101 pending frames: replace the pending suffix with [["r", newestValue]]
producer becomes terminal: deliver [["r", null]], then close as retired
```
  
监视器在其调用结束时会自动停止。通过会话获取的监视器是调用者拥有的，并在会话关闭时停止。之前已交付的快照永远不会变异。缓慢或未开始的交付会保留最多100个精确帧，然后用一个完整的值根替换未交付的后缀。监视器是收敛状态观察，而不是转换日志。退役会结束实例的流；暴露该状态的服务必须撤回或在`null`保持终止状态。重新创建需要新的监视器/状态和数字文档ID。终止任务无法创建更多输出。任务范围的文档永远不会复制到分支中。请在结果条目、会话或
在终端提交退休前，会保留会话范围的文档。仅在单个任务需要多个独立键值的文档时，才使用任务范围的家族。

## 4. 内置会话视图和提交交付

`ConversationView` 包含 `conversation`、原始转录 `entries` 和 `docs: Readonly<Record<string, JsonObject>>`。选定的内置单例按稳定文档种类挂载于 `docs`，而非数字实例ID。规范的示例路径映射如下：

```text
document ["s", ["generation", "message"], value]
 -> view ["s", ["docs", "pi.live", "generation", "message"], value]
```

`pi.live` 在 `spec.md` 第8.2节中指定。
挂载操作会为每个完整的会话提交发布一批数据：entry/head变更和已挂载文档一起发布，不带跟踪器或语义投影。
第三方文档不会自动挂载；请使用其自身的Chord服务或受信任的调用监视器。已退休的源会发布 `null`；动态服务应撤回其实例，而非暴露过期数据。

```text
addStroke -> hold Session mutation line -> await tx.doc -> mutate tracker change draft
callback succeeds -> tracker prepare: immutable candidate + immutable ops
Session checkpoint predicate selects a base or delta exactly once
atomic storage commit: persist selected document and record writes
storage succeeds -> adopt candidate + enqueue candidate/ops, still on line
release line -> deliver committed source ops -> adapter -> local/remote Chord consumers
late subscriber -> atomically capture committed value + adapter sequence + subscription
```

不存在可见且持久的路径。回调、跟踪器准备和检查点失败通常会在存储准入前中止。不确定的存储失败会发布空内容并毒化已打开的会话；请关闭并重新打开会话，而非继续。

##  踩雷

-  不要在提交间保留草稿、嵌套代理或绑定的数组方法；它们会被撤销。分配的容器按值复制。
-  异步提交会在存储结算和基线采纳期间保持稳定。请在文档访问处等待，而非模型、进程、网络调用或人类。
-  仅 `tx.doc()` 能创建。`snapshot`、`documentState` 和 `watchDoc` 在缺失时返回 `undefined`，且永不写入。仅在首次`tx.doc()`创建实例时使用种子；后续种子会被忽略。
-  在 `watch.value` 固定路径下初始化，再进行 `start()`。慢速或未启动的交付会保留最多100个精确帧，然后用一个完整值根替换待处理后缀。不进行序列化字节计费。请勿将监视器用作审计日志。
- `stop()`阻止未来的回调，但不会中断或加入已经运行的回调。
- 定义自己的检查点，而不是存储启发式。保持文档种类、版本、分叉策略和公共路径稳定；模式更改需要迁移，而不是仅源重命名。

Chord 源：[types](../../chord/src/types.ts)，[facet examples](../../chord/test/facets.test.ts)，[state](../../chord/src/services/state.ts)，[provider](../../chord/src/services/provider.ts)，[Context](../../chord/src/context/index.ts)，[Delta](../../chord/src/delta/README.md)。

