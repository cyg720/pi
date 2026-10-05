# Chord Delta

Chord Delta 生成不可变的 JSON 版本和精确的操作批次，用于有序副本。从 `@earendil-works/chord/delta` 导入。

不可变性是一种所有权契约。没有内容被冻结或进行防御性复制，因此无法检测到非法变异。它会静默地破坏状态。

```ts
import { applyImmutable, applyImmutableBatches, track } from "@earendil-works/chord/delta";

const initial = { output: "", entries: [] as { id: number }[] };
const tracker = track(initial); // `initial` is transferred: never mutate it again

const change = tracker.beginChange();
change.state.output += "done\n"; // the draft is mutable only while the change is open
change.state.entries.push({ id: 1 }); // placed values are cloned; the caller keeps its object
const prepared = change.prepare(); // draft handles are unusable from here on

// tracker.value, prepared.base, prepared.value, and prepared.ops (including paths
// and payloads) are immutable by contract.
tracker.adopt(prepared); // tracker.value === prepared.value

// Shares containers with prepared.base and the op payloads: never mutate it either.
const replica = applyImmutable(prepared.base, prepared.ops);
```

## 变异权限

| 值 | 可否变异？ |
| --- | --- |
| 传递给 `track()`、`prepareReplace()`、`replicatedState()` 或 `replace()` 的根 | 不可。所有权已转移给跟踪器。 |
| `change.state` 及从此读取的句柄 | 可以，但仅在变更打开期间。变更提交后（`prepare()`、`abort()` 或其他采纳），每次使用都会抛出异常。通过已从草稿中移除元素的句柄写入将被忽略。 |
| 赋值或插入到草稿中的外部值 | 可以。草稿存储了已验证的克隆。 |
| `tracker.value`、`prepared.base`、保留旧版本 | 不可。 |
| `prepared.value`、`prepared.ops`、操作元组、路径、排列、载荷 | 不可。载荷可能与 `prepared.value` 的部分共享同一对象。 |
| `applyImmutable()` / `applyImmutableBatches()` 的输入和结果 | 不可。结果与两个输入共享容器。 |
| 来自复制状态的值（`value`、监听器值、回环消费者） | 不可。进程内消费者可能与提供者共享容器。 |
| 传递给 `apply()` 的可变副本 | 仅通过 `apply()`，且必须拥有独占批次。代码在批次之间编辑副本会破坏收敛性。 |
| 传递给 `apply()` 的批次 | 消费完毕。`apply()` 会将载荷容器采纳进副本。为单个副本使用分离副本，且绝不再次触碰。 |

## 重放批次

不可变重放是首选的进程内路径。一个批次可以分发到任意数量的不可变副本：

```ts
let replica = tracker.value; // shared with authority; never mutated
// For each adopted batch, in order:
replica = applyImmutable(replica, prepared.ops); // replica must equal prepared.base
```

仅当需要有序回滚的最终结果时，可不合并操作直接重放其批次。整个调用共享一个写时复制作用域，因此不会暴露或安全保留任何中间版本：

```ts
replica = applyImmutableBatches(
  replica,
  queuedFrames.map((frame) => frame.ops),
);
```

若需发布或保留每个中间版本，则使用独立的 `applyImmutable()` 调用。

可变重放需要为每个副本准备分离的起始根和每个批次的分离副本。绝不可将一个内存批次应用到两个可变副本：

```ts
import { apply } from "@earendil-works/chord/delta";

const detach = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let replica = detach(tracker.value); // exclusively owned starting root
// For each adopted batch, in order:
replica = apply(replica, detach(prepared.ops)); // fresh copy for this replica only
// Only apply() may change `replica`; do not edit it in application code.
```

为每个副本单独序列化消息也是一种有效的分离方式。`decode()` 不复制载荷，因此解码一个内存 `WireOp[]` 用于两个可变副本会导致它们相互别名。

## 该做该不做

- 应构建新鲜根并转移；在入口边界验证不可信根。
- 应保持修订之间的结构共享，例如 `replace(ctx, { ...state.value, changed })`。
- 应克隆或序列化后再将任何已发布的值交给可能变异的代码。
- 应通过 `prepare()` 或 `abort()` 完成每次变更。
- 不要在转移的根中重复使用同一个容器。
- 不要变异跟踪器拥有、已发布或从批次接收的任何内容。
- 不要在变更结束后仍保留草稿句柄。
- 不要从操作形状推断含义。仅结果值具有契约效力。

## 根与放置

完整根受信任。`track()` 和 `prepareReplace()` 在 O(1) 时间内取得所有权，且不会遍历树。根必须无别名、无环、严格 JSON：密集普通数组、普通或 null 原型对象（具有可枚举自有数据属性）、字符串、布尔值、有限数字和 `null`。违反此规则将导致未定义行为。例如，两个键共享的容器可能导致 `prepared.value` 与 `prepared.ops` 计算出的副本不一致。

草稿放置是复制的，且该复制过程也进行验证。放置来源于属性写入、索引写入、`push`、`unshift`、`splice`、`fill` 和 `copyWithin`。非严格值会在草稿变更前抛出 `TypeError` 异常（例如 `push(valid, invalid)` 插入无效）。被拒绝的值包括：循环引用、访问器（永不调用）、符号键、类实例、稀疏或非普通数组、函数、bigint、`NaN`、无穷大和 `undefined`。null 原型对象可被接受并保留。放置草稿句柄会克隆。
其当前内容。在一个值放置到多个路径时，会生成独立的容器。

`undefined`规则：

- `draft.obj.key = undefined`会删除`key`。
- `arr[i] = undefined`、`push(undefined)`、`unshift`、`splice`和`fill`与`undefined`一起抛出异常。
- `undefined`嵌套在已放置的对象或数组内时会抛出异常。它不会像`JSON.stringify`那样被丢弃。

数组保持密集。写入超出下一个索引或删除元素会抛出异常。
扩展`length`会插入`null`；收缩它会移除元素。

## 生命周期

`tracker.value`是最新采纳的修订版本。`beginChange()`会在其上打开一个覆盖草稿，但不会修改它。草稿可能跨`await`保持打开状态。
`prepare()`会将候选版本和操作物化，但不会改变权威性。
`adopt()`会检查准备状态并交换根指针。

可能从同一个修订版本中打开或准备多个变更。采纳其中一个会使其他所有变更过期：打开的草稿变得不可用且抛出`prepare()`异常，准备好的竞争版本被`adopt()`拒绝。`adopt()`也会拒绝外部、已中止和已被消费的准备版本。`Change.abort()`或`Prepared.abort()`在`prepare()`之后会阻止采纳。候选版本保持可读。

无操作批处理：

- 空`ops`表示`prepared.value === prepared.base`。写入操作会恢复到其原始值，深度相等的容器赋值通常会归一化为空。
- 相等性忽略键顺序和原型。深度相等的赋值会保留前一修订版本的顺序和原型，即使草稿显示了新的顺序。
- 结构化数组编辑可能会在结果深度相等时仍发出非空精确批处理。
- 采纳无操作仍会推进`tracker.revision`并使竞争版本过期。复制状态不会发布无操作。

`prepareReplace(value)`是一个整体根操作，不是差异操作。如果`value`与当前根深度相等，`ops`为空且当前根被保留（比较可能遍历两个树）。否则`ops`是`[["r", value]]`和`prepared.value === value`，因此副本会接收完整的根。

数组变异器：`push`、`pop`、`shift`、`unshift`、`splice`、`reverse`、`sort`、`fill`和`copyWithin`。持有的句柄会随着重索引跟随元素。

## 操作

路径包含对象键和非负整数数组索引。

| 元组      | 含义                     |
| --------- | ------------------------ |
| `["r", value]` | 替换完整值。             |
| `["s", path, value]` | 设置对象属性或数组元素。 |
| `["d", path]` | 删除对象属性或移除数组元素。 |
| `["a", path, text]` | 追加到字符串。           |
| `["t", path, count]` | 从字符串前端移除`count` UTF-16码位。 |
| `["p", path, index, remove, items]` | 数组拼接。               |
| `["m", path, permutation]` | 重新排序数组：`new[i] = old[permutation[i]]`。 |

批处理是精确的但不是规范的。相同的变更可能使用不同的元组，且大型编辑集可能会折叠成区域拼接、祖先`s`或`r`。

保留键：跟踪器永远不会将`__proto__`、`constructor`或`prototype`作为路径段发出。在或低于此类键的变异会被折叠到最近的安全祖先，或在根处为`r`。`apply()`、`applyImmutable()`、`applyImmutableBatches()`和`decoder()`会拒绝这些段并抛出`UnsafePathError`。
应用者会将值作为自有数据属性写入，绝不会通过原型设置器。应用者会检查操作形状和路径安全性，但不会检查负载的严格性。Chord的复制状态副本会验证每个结果修订版本。

`encoder()`会将重复路径内联到`WireOp`元组；`decoder()`会验证和恢复`Op`元组。每个有序状态流使用一对编码器/解码器。路径ID跨批次，`r`会重置两个字典。发生解码或应用错误后，丢弃解码器和副本并从后续`r`中恢复。

## 限制和危险操作

- 不允许冻结。对任何不可变值的变异会悄悄破坏状态。
- 回环共享：进程内服务消费者可能会接收到提供者的容器。消费者变异会破坏权威性并使远程副本发散。
- A 在大型扁平数组内部进行更改时，会复制该数组的指针存储以供新版本使用。
- 批量插入时，放置验证会消耗时间和内存。在基准测试中，将10万个三字段对象进行未移位操作时，增加了约19毫秒和20兆字节的临时堆内存。
- 外部代理作为放置项，会改变草案的参数强制回调，非原始数组索引，以及非数值比较器结果均超出合同范围。同样，会改变、准备、中止或采用的排序比较器也超出合同范围。行为未指定。
- 对象身份不进行复制。每个路径都是独立的值放置。
- 一个跟踪器对应一个修订序列。交付顺序和持久性属于外部协议。

