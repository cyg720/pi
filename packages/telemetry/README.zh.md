# @earendil-works/pi-telemetry

与 pi 包兼容的厂商中立遥测合约和带类型模式的实用工具。

本包提供：

- 一个基于回调的 `TelemetryContext` / `TelemetrySpan` 合约；
- 一个共享的 `NOOP_TELEMETRY_CONTEXT`；
- 一个引用实现的 `InMemoryTelemetryContext`；
- 支持序列化的模式定义，推断出 TypeScript 类型；
- 不依赖导出器、全局当前跨度状态或遥测后端。

应用程序可以使用内存中的引用实现，或为 OpenTelemetry、Sentry、日志或其他后端提供适配器。pi 包通过显式传递遥测上下文，并单独定义其领域模式。
## 目录

- [安装](#installation)
- [遥测概念](#telemetry-concepts)
- [核心上下文API](#core-context-api)
- [适配器契约](#adapter-contract)
- [无操作上下文](#no-op-context)
- [内存引用适配器](#in-memory-reference-adapter)
- [适配器符合性](#adapter-conformance)
- [类型模式](#typed-schemas)
  - [开始和结束属性](#start-and-completion-attributes)
- [模式元数据](#schema-metadata)
- [Pi 包集成](#pi-package-integration)
- [安全性和可移植性](#security-and-portability)
- [API 参考](#api-reference)
- [开发](#development)
- [许可证](#license)

<a id="installation"></a>
## 安装

```bash
npm install @earendil-works/pi-telemetry
```

<a id="telemetry-concepts"></a>
## 遥测概念

遥测描述程序运行时的行为。该包使用跨度、属性、事件、状态和显式上下文来建模这些工作：

| 概念 | 大白话解释 |
|---|---|
| **跨度** | 对一个操作的计时记录，例如加载账户或发起AI请求。它在工作开始前开始，工作完成后结束。 |
| **父跨度和子跨度** | 操作可以包含更小的操作。一个请求跨度可能包含缓存查询和数据库查询。它们共同构成一棵树，显示时间的消耗分布。 |
| **属性** | 附加到跨度（span）上的命名事实，例如 `provider: "openai"`、`cache.hit: true` 或 `item_count: 12`。属性描述操作及其结果。 |
| **事件** | 在跨度（span）的某个时间点发生的命名事件，例如 `retry.scheduled` 或 `cache.lookup`。事件没有持续时间，可能带有其自身的属性。 |
| **状态** | 操作的结果：`ok` 或 `error`。错误状态可能包含错误名称和消息。 |
| **上下文** | 用于标识新工作在跨度树中所属位置的句柄。从上下文开始一个跨度，使其成为该上下文的子跨度。 |

例如，加载账户可能会产生以下遥测数据：

```text
example.account.load                         span
├─ attributes: account.id=123, found=true   facts about the span
├─ event: example.cache.lookup              occurrence during the span
│  └─ attribute: cache.hit=false            fact about the event
└─ status: ok                               final outcome
```

跨度是诊断数据，不是业务状态。记录它不应改变账户加载是否运行、是否成功、是否失败或是否被持久化。适配器将这些通用概念转换为 OpenTelemetry、Sentry、日志或其他后端所使用的相应概念。

<a id="core-context-api"></a>
## 核心上下文 API

一个 `TelemetryContext` 在回调周围启动一个跨度。回调接收一个 `TelemetrySpan`，这也是显式父上下文，用于子跨度。

```typescript
import {
  NOOP_TELEMETRY_CONTEXT,
  type TelemetryContext,
} from '@earendil-works/pi-telemetry';

async function loadAccount(
  accountId: string,
  telemetryContext: TelemetryContext = NOOP_TELEMETRY_CONTEXT,
) {
  return telemetryContext.startSpan(
    {
      name: 'example.account.load',
      attributes: { 'example.account.id': accountId },
    },
    async (span) => {
      const account = await readAccount(accountId);
      span.setAttributes({ 'example.account.found': account !== undefined });
      return account;
    },
  );
}
```

将回调跨度传递给下层工作，以创建显式嵌套：

```typescript
return telemetryContext.startSpan({ name: 'example.parent' }, async (parentSpan) => {
  return parentSpan.startSpan({ name: 'example.child' }, async (childSpan) => {
    childSpan.addEvent('example.cache.lookup', { 'example.cache.hit': true });
    return performWork();
  });
});
```

不存在公共 `end()` 方法。`startSpan()` 负责结束操作，并保持跨度打开，直到回调的返回值或 Promise 完成。对于用正常返回值表示的预期失败，显式设置状态：

```typescript
return telemetryContext.startSpan({ name: 'example.save' }, async (span) => {
  const result = await save();
  if (!result.ok) {
    span.setStatus({
      status: 'error',
      error: { name: 'SaveError', message: result.reason },
    });
  }
  return result;
});
```

<a id="adapter-contract"></a>
## 适配器契约

适配器实现 `TelemetryContext`，并将通用 API 桥接到其后端。它必须：

- 创建一个子跨度并同步调用回调，且仅调用一次；
- 保留回调的返回值和拒绝值；同步抛出异常时，返回以同一值拒绝的 Promise；
- 保持原生跨度打开，直到返回的 Promise 完成；
- 将正常完成视为 `ok`，并将抛出和拒绝视为错误，除非显式设置了状态；
- 对重复 `setStatus()` 调用采取最后写入获胜原则；
- 合并`setAttributes()`调用，用后来定义的值替换先前的值，忽略`undefined`；
- 使记录方法同步、被动且不抛出异常；
- 忽略结算后的调用；
- 原子地忽略失败的记录调用，抑制后端失败，但仍然精确执行业务回调一次。

适配器可内部激活后端原生的环境上下文以自动进行仪器化，但pi代码始终通过`TelemetryContext`参数传递父上下文。导出器的缓冲、刷新、采样、后端ID和后端特定的上下文对象属于适配器。使用[适配器符合套件](#adapter-conformance)检查这些可观测的语义。

<a id="no-op-context"></a>
## 无操作上下文

在遥测为可选时使用`NOOP_TELEMETRY_CONTEXT`：

```typescript
import { NOOP_TELEMETRY_CONTEXT } from '@earendil-works/pi-telemetry';

const result = await NOOP_TELEMETRY_CONTEXT.startSpan(
  { name: 'example.operation' },
  () => runOperation(),
);
```

无操作上下文：

- 同步调用回调；
- 保留返回值和异步拒绝，并将同步抛出转换为带有相同值的Promise拒绝；
- 使用一个共享的冻结惰性跨度，包括嵌套跨度；
- 不检查或保留名称、属性、事件或状态。

<a id="in-memory-reference-adapter"></a>
## 内存引用适配器

`InMemoryTelemetryContext`是后端中立的参考实现。它适用于测试、本地诊断和有意希望本地进程捕获而无需导出器的应用程序：

```typescript
import { InMemoryTelemetryContext } from '@earendil-works/pi-telemetry';

const telemetry = new InMemoryTelemetryContext();

await telemetry.startSpan(
  { name: 'example.operation', attributes: { input: 'demo' } },
  async (span) => {
    span.addEvent('example.started');
    span.setAttributes({ output_count: 3 });
  },
);

console.log(telemetry.getSpans());
```

`getSpans()`返回跨度启动顺序的分离快照。每个`RecordedTelemetrySpan`包含确定性的数字ID、父ID、合并的属性、有序事件、最终状态、结算状态和确定性的结束序列。它不记录任何时间戳。

该适配器可安全地作为普通的`TelemetryContext`使用，但存储无界且为本地进程。为隔离测试或记录范围，请创建新的实例，并且除非调用者的数据策略允许，否则不要捕获敏感属性。

<a id="adapter-conformance"></a>
## 适配器符合

`@earendil-works/pi-telemetry/testing`导出一个独立于运行器的符合套件，模型为分组用例。一个固定装置提供新鲜上下文，并将其后端的已完成跨度转换为标准化的`RecordedTelemetrySpan`快照：

```typescript
import {
  createTelemetryAdapterConformance,
  type TelemetryAdapterFixture,
} from '@earendil-works/pi-telemetry/testing';
import { describe, it } from 'vitest';

const conformance = createTelemetryAdapterConformance(async () => {
  const adapter = createMyTelemetryAdapter();
  return {
    context: adapter.context,
    getSpans: async () => adapter.normalizedSpans(),
    async [Symbol.asyncDispose]() {
      await adapter.close();
    },
  } satisfies TelemetryAdapterFixture;
});

for (const group of new Set(conformance.map((testCase) => testCase.group))) {
  describe(group, () => {
    for (const testCase of conformance.filter((candidate) => candidate.group === group)) {
      it(testCase.name, () => testCase.run());
    }
  });
}
```

该套件检查同步单次准入、结果和拒绝身份、自动和显式状态、属性合并、事件顺序、惰性后结算调用、嵌套和并发父子关系，以及抑制不可读遥测负载失败。`getSpans()`可能在返回前刷新异步导出器。测试子路径使用Node的断言API；根遥测包保持运行时中立。

<a id="typed-schemas"></a>
## 类型化模式

低级跨度API有意接受开放名称和属性包，以便适配器保持通用性。领域包可以定义封闭、可序列化的模式，并从它们推断精确的TypeScript类型。

```typescript
import {
  createTypedSpanStarter,
  defineTelemetrySchema,
} from '@earendil-works/pi-telemetry';

export const EXAMPLE_TELEMETRY_SCHEMA = defineTelemetrySchema({
  version: 1,
  spans: {
    'example.read': {
      description: 'Read one resource',
      parents: { kind: 'any' },
      startAttributes: {
        'example.resource': {
          type: 'string',
          required: true,
          values: ['account', 'project'],
          description: 'Resource kind',
        },
      },
      endAttributes: {
        'example.item_count': {
          type: 'number',
          description: 'Number of returned items',
        },
      },
      events: {
        'example.cache': {
          description: 'Cache lookup result',
          attributes: {
            'example.cache.hit': {
              type: 'boolean',
              required: true,
              description: 'Whether the cache contained the resource',
            },
          },
        },
      },
      status: {
        default: 'ok',
        errorWhen: 'The read throws or returns an error result',
      },
    },
  },
} as const);

const startSpan = createTypedSpanStarter(
  telemetryContext,
  [EXAMPLE_TELEMETRY_SCHEMA],
);
```

启动器对每个跨度提供一个重载，并在编译时检查名称和属性。联合值的名称必须在调用前缩小范围，保持每个运行时名称与其属性模式之间的关系。其回调接收一个绑定到回调跨度的子启动器，使用相同的模式：

```typescript
await startSpan(
  'example.read',
  { 'example.resource': 'account' },
  async (span, startChildSpan) => {
    span.addEvent('example.cache', { 'example.cache.hit': true });
    const accounts = await readAccounts();
    span.setAttributes({ 'example.item_count': accounts.length });

    await startChildSpan(
      'example.read',
      { 'example.resource': 'project' },
      async (childSpan) => {
        const projects = await readProjects();
        childSpan.setAttributes({ 'example.item_count': projects.length });
      },
    );

    return accounts;
  },
);
```

<a id="start-and-completion-attributes"></a>
### 启动和完成属性

`startAttributes`和`endAttributes`描述属性何时通常已知，而非独立运行时存储：

| 模式字段 | 如何记录值 | 必需性 |
|---|---|---|
| `startAttributes` | 在跨度创建时通过类型启动器的`attributes`参数传递 | 每个定义显式设置`required: true`或`false` |
| `endAttributes` | 通过跨度的`setAttributes()`方法在稍后添加 | 始终可选 |

两组都成为后端跨度上的普通属性。没有单独的结束属性负载或结束回调。在前面的例子中，`example.resource`在`example.read`开始时已知，而`example.item_count`仅在`readAccounts()`返回后才已知：

```typescript
await startSpan(
  'example.read',
  { 'example.resource': 'account' }, // required start attribute
  async (span) => {
    const accounts = await readAccounts();
    span.setAttributes({
      'example.item_count': accounts.length, // optional completion attribute
    });
    return accounts;
  },
); // resolving the callback settles the span
```

“结束”意味着完成增强：结束属性可在回调活动期间的任何时间设置，并且在不可用时可以省略。调用`setAttributes()`零次是有效的。这对早期失败、取消和特定提供者的数据很重要，这些数据可能不存在于每个路径上。
重复的 `setAttributes()` 调用会合并到同一个属性集合中。同一键后来设置的已定义值会替换先前的值，而 `undefined` 会被忽略。受结构定义约束的方法只接受当前跨度声明的结束属性。
属性不会结束该范围。从回调返回、解析、抛出或拒绝控制结算；`startSpan()`执行实际的结束操作。结算后发出的适配器调用是无效的。
一个启动器可以组合多个独立版本的模式：

```typescript
import { AGENT_TELEMETRY_SCHEMAS } from '@earendil-works/pi-agent-core';

const startAgentSpan = createTypedSpanStarter(
  telemetryContext,
  AGENT_TELEMETRY_SCHEMAS,
);
```

内联模式数组会自动保留元组类型。单独声明的数组应使用 `as const`。数组中字面量重复的 span 名称在编译时被拒绝；模式不会被合并、检查或在运行时保留。
根据模式派生的类型会拒绝缺失的必需属性、未知的键、无效的闭合集值、未声明的事件以及空模式上的属性。终结属性始终是可选的丰富属性；类型系统不要求 `setAttributes()` 被调用。

`defineTelemetrySchema()` 是一个带类型的标识函数。它返回普通的可 JSON 序列化数据，并不执行运行时验证或父规则强制。
<a id="schema-metadata"></a>
## 模式元数据

支持的属性类型有：

- `string`、`number`和`boolean`；
- `string[]`、`number[]`和`boolean[]`。

属性定义支持：

- `values`：标量值的封闭集合；
- `elementValues`：数组元素的封闭集合；
- `examples`：文档示例；
- `sensitive`：标记需要特殊处理的数据；
- `cardinality`：记录预期的`low`或`high`基数。

起始和事件属性声明`required`。结束属性不声明；请参见[起始和完成属性](#start-and-completion-attributes)。

父级元数据是描述性模式数据：

- `{ kind: 'any' }`：根或任何调用者跨度；
- `{ kind: 'root_or_external' }`：根或模式外部的调用者拥有的跨度；
- `{ kind: 'spans', spans: [...] }`：仅列出的模式跨度。

适配器无需理解模式对象。仪器辅助工具和测试用它们来保持发出的名称和属性一致。
<a id="pi-package-integration"></a>
## Pi 包集成

包所有权有意拆分：

- `@earendil-works/pi-telemetry`拥有供应商中立合约、无操作和内存引用上下文、模式实用工具以及适配器符合套件；
- `@earendil-works/pi-ai`接受并传播`telemetryContext`作为提供方请求选项，但不拥有任何遥测模式；
- `@earendil-works/pi-agent-core`拥有并导出pi AI请求和框架模式、它们的组合只读模式元组以及类型化跨度助手。

```typescript
import {
  AGENT_TELEMETRY_SCHEMAS,
  AI_TELEMETRY_SCHEMA,
  HARNESS_TELEMETRY_SCHEMA,
  startAiSpan,
  startHarnessSpan,
} from '@earendil-works/pi-agent-core';
```

pi模式使用pi自有`pi.ai.*`、`pi.harness.*`和`pi.session.*`名称。适配器可将其转换为后端约定，而不更改发出的pi词汇表。

<a id="security-and-portability"></a>
## 安全性和可移植性

遥测是进程本地诊断，不是持久化应用状态。不要在记录、消息、快照或延迟句柄中持久化`TelemetryContext`、`TelemetrySpan`或后端原生跟踪对象。

属性值有意限制为原始标量和数组。领域仪器应避免提示、补全、工具参数或输出、文件内容、提供方负载、头部、凭据和自由格式错误详情，除非其模式和数据策略明确允许。

该包不使用`AsyncLocalStorage`或另一个运行时特定的环境API。它适用于Node.js、Bun、浏览器和工作线程；后端适配器仍需负责其自身的运行时兼容性。

<a id="api-reference"></a>
## API参考

### 核心类型和值

| 导出项       | 用途                                                         |
|--------------|--------------------------------------------------------------|
| `TelemetryContext` | 启动由回调管理的子跨度                                         |
| `TelemetrySpan` | 记录属性、事件和状态；也可作为子上下文                         |
| `SpanOptions` | 跨度名称和可选起始属性                                         |
| `SpanAttributes` / `AttributeValue` | 开放的适配器级属性袋及其支持的值                               |
| `SpanStatus` | 显式`ok`或`error`状态                     |
| `NOOP_TELEMETRY_CONTEXT` | 禁用遥测的共享被动上下文                                       |
| `InMemoryTelemetryContext` | 参考适配器，具有确定性进程本地记录                             |
| `RecordedTelemetrySpan` | 已归一化的捕获跨度快照 |
| `RecordedTelemetryEvent` | 已归一化的捕获事件快照 |

### 模式定义与推断

| 导出 | 目的 |
|---|---|
| `defineTelemetrySchema()` | 用于序列化模式数据的类型化标识辅助工具 |
| `createTypedSpanStarter()` | 将父上下文绑定到一个或多个模式词汇表 |
| `TypedSpanStarter` | 带有递归子绑定回调的精确起始类型 |
| `TelemetrySchemaDefinition` | 顶层模式形状 |
| `TelemetrySpanDefinition` | 跨度元数据、父级、属性、事件和状态规则 |
| `TelemetryAttributeType` | 支持的标量和数组类型名称 |
| `TelemetryAttributeMetadata` | 描述、敏感度和基数元数据 |
| `TelemetryAttributeDefinition` | 属性类型、允许值、示例和元数据 |
| `TelemetryStartAttributeDefinition` | 带有必填属性的起始属性定义 |
| `TelemetryEventAttributeDefinition` | 带有必填属性的事件属性定义 |
| `TelemetryEventDefinition` | 事件描述和属性定义 |
| `TelemetryParentDefinition` | 开放、外部根或有限模式父规则 |
| `TelemetrySchemaSpanName` | 声明的跨度名称的并集 |
| `TelemetrySchemaSpanStartAttributes` | 对单个跨度精确推断的起始属性 |
| `TelemetrySchemaSpanEndAttributes` | 对单个跨度可选推断的结束属性 |
| `TelemetrySchemaSpanEventName` | 由单个跨度声明的事件的并集 |
| `TelemetrySchemaSpanEventAttributes` | 对单个事件精确推断的属性 |
| `SchemaTelemetrySpan` | 限制为单个模式跨度的跨度视图 |
| `TelemetrySchemaSpanUnion` | 所有跨度的区分联合 |
| `InferStartAttributes` | 从起始定义推断的必填和可选值 |
| `InferOptionalAttributes` | 从结束定义推断的可选值 |
| `InferEventAttributes` | 从事件定义推断的必填和可选值 |
| `InferRequiredAndOptionalAttributes` | 用于带有必填属性定义的共享推断实用工具 |
| `ExactTelemetryAttributes` | 拒绝预期属性集之外的键 |

### 测试子路径

| 导出 | 目的 |
|---|---|
| `createTelemetryAdapterConformance()` | 创建与运行器无关的适配器符合用例 |
| `TelemetryAdapterFixture` | 为单个用例创建的新上下文和已归一化快照读取器 |
| `TelemetryAdapterFixtureFactory` | 创建隔离的测试套件 |
| `TelemetryAdapterConformanceCase` | 测试运行器执行的分组用例 |

<a id="development"></a>
## 开发

从此包目录：

```bash
npm test
npm run build
```

全仓库类型检查、格式化、代码检查和冒烟测试运行于：

```bash
npm run check
```

<a id="license"></a>
## 许可证

MIT

