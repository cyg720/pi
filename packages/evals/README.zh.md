# Pi 评估

Pi编码代理的行为评估，使用`vitest-evals`构建。

## 文件规范

评估定义直接位于`evals/`下：

- `*.docs.eval.ts`是文档提升评估。`eval:docs`在隔离的`without_docs`和`with_docs`容器中运行每个用例，并报告提升结果。
- 其他`*.eval.ts`文件是主机评估。`eval:host`使用Vitest在本机运行它们。它们是普通的vitest-evals套件，不是配对比较。

运行代码位于`src/`：

- `cli.ts`负责比较调度
- `docker.ts`构建镜像、发现用例并运行一个隔离的臂
- `plan.ts`将用例扩展为`(case, variant, repetition)`任务
- `report.ts`读取Vitest JSON、配对臂并计算提升
- `harness.ts`是vitest-evals适配器

评估套件及其固定装置位于`evals/`。镜像构建文件位于`docker/`。

## 运行评估

主机评估（烟雾测试、文档审计）和文档提升评估需要`PI_PROVIDER`和`PI_MODEL`。

```bash
PI_PROVIDER=openai-codex PI_MODEL=gpt-5.6-sol npm run eval -w packages/evals
```

该命令先运行主机评估，然后是文档比较。`--`之后的额外CLI标志仅传递给`eval:docs`。

仅主机：

```bash
PI_PROVIDER=openai-codex PI_MODEL=gpt-5.6-sol npm run eval:host -w packages/evals
```

一个主机套件：

```bash
PI_PROVIDER=openai-codex PI_MODEL=gpt-5.6-sol \
  npm run eval:host -w packages/evals -- evals/documentation-audit.eval.ts
```

## 运行文档比较

从仓库根目录：

```bash
npm run eval:docs -w packages/evals -- \
  --provider openai-codex \
  --model gpt-5.6-sol
```

`PI_PROVIDER`和`PI_MODEL`提供相同的默认值。这两个值都是必需的。

默认情况下，每个变体只运行一次。当测量稳定性时，显式增加重复次数：

```bash
npm run eval:docs -w packages/evals -- \
  evals/extensions.docs.eval.ts \
  --runs-per-variant 5
```

`PI_EVAL_RUNS_PER_VARIANT=5`等效。Vitest在发现过程中会应用过滤器：

```bash
npm run eval:docs -w packages/evals -- -t "adds the model"
```

运行器：

1. 将仓库临时挂载以进行Docker构建，使用仓库的consumer-install机制打包当前工作区的包，然后从暂存的运行时创建独立的`without_docs`和`with_docs`镜像。
2. 在两个镜像中发现所选用例，并要求相同的群体。
3. 在执行前为每个`(case, variant, model, runNumber)`臂规划。
4. 在每个新鲜容器中运行每个臂。失败或缺失的臂会被记录，计划的群体继续。
5. 通过`@vitest-evals/core/node`读取原生Vitest JSON，当报告存在时。
6. 配对精确的臂并写入比较报告。被阻塞的配对会抑制头条提升；过程退出非零状态。

重复顺序按运行编号交替以减少顺序偏差。

## 文档变体

`without_docs`省略编码代理的`README.md`、`CHANGELOG.md`、`docs/`和`examples/`，并从默认系统提示中移除Pi文档路由部分。

`with_docs`包含这些文件并使用未更改的默认提示。

两个变体安装相同的本地工作区tarball。现有的npm覆盖确保编码代理的内部Pi依赖也来自当前仓库而非注册表。对内部依赖包的文档和源文件对称移除，以免作为替代指令。启动时验证镜像白名单并验证安装的编码代理包从`dist/`解析。评估定义、评估辅助程序、固定装置和Vitest配置是根拥有的且在枢纽降权为非特权UID后不可读。每个运行获得新的家目录、代理目录、工作区、会话目录和容器文件系统。

文档评估默认只允许`read`、`write`、`edit`、`grep`、`find`和`ls`。它们不暴露shell或web-search工具。提供者流量仍需要容器网络访问，因此仅Docker无法证明由代理编写的任意代码从未使用网络。

## 结果

每次调用创建一个被忽略的`.eval/<timestamp>_<id>/`目录，其中包含：

- `protocol.json`：模型、镜像ID、用例、任务和协议摘要。
- `expected-runs.json`：完整的计划群体。
- `observations.jsonl`：归一化结果和遥测数据。
- `tasks/*/vitest.json`：每个隔离臂的原生JSON。
- `<variant>/sessions/*/session.jsonl`：原生Pi会话。
- `report.json` 和 `report.txt`：配对比较。

只有当配对的两个分支都产生且仅产生一个分数时，该配对才对通过率有贡献。缺失、重复、跳过、待处理、未评分或出错的分支会阻塞该配对。如果评估集中的任何配对被阻塞，头条通过率将不予发布。缺失的遥测数据保持不可用状态，而非视为零。

报告中标记了无提升、负向变化、饱和的对照组或处理组，以及观察到的不稳定性。单次重复无法确立稳定性。

工件可能包含提示、响应、生成的代码和工具输出。

## 编写评估

每个案例使用一个普通 `describeEval(...)` 套件和一个显式 `run(...)` 调用：

```ts
import { describeEval, StructuredOutputJudge } from "vitest-evals";
import { createPiDocumentationEvalHarness } from "../src/harness.ts";

const harness = createPiDocumentationEvalHarness();
const judge = StructuredOutputJudge({ expected: { ok: true }, match: "strict", allowExtras: false });

describeEval("Target workflow", { harness, judges: [judge], judgeThreshold: null }, (it) => {
  it("completes the task", async ({ run }) => {
    await run("Complete the target task.");
  });
});
```

外部运行器负责变体、重复、隔离、身份、持久性和报告。评估文件应仅包含场景设置、模型任务和确定性评分。

使用 `judgeThreshold: null` 进行比较评分。低分是数据，而非基础设施故障。保留 Vitest 断言用于已损坏套件的不变量。

