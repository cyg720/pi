/**
 * 文件职责：验证输入转换扩展示例在空闲、steer、followUp 和 Git 失败场景下的行为。
 * 技术维度：使用 Vitest、ExtensionAPI 模拟、ExecResult 夹具和输入事件回调进行单元测试。
 * 产品维度：展示扩展如何在匹配请求时注入 git diff 摘要，又不干扰流式转向输入。
 * 逻辑维度：setup 捕获 input 处理器并模拟 exec，六个用例覆盖触发、跳过和失败分支。
 * 关键边界：不执行真实 Git；输入处理器必须在扩展注册后存在，测试用非空断言调用。
 * 新手阅读建议：先看 setup 如何搭建扩展 API，再比较三种执行结果和两种 streamingBehavior。
 */
import { describe, expect, it, vi } from "vitest";
import inputTransformStreaming from "../examples/extensions/input-transform-streaming.ts";
import type {
	ExecResult,
	ExtensionAPI,
	ExtensionContext,
	InputEvent,
	InputEventResult,
} from "../src/core/extensions/index.ts";

/** 表示扩展注册的异步输入处理器签名。 */
type InputHandler = (event: InputEvent, ctx: ExtensionContext) => Promise<InputEventResult | undefined>;

/**
 * 用固定命令结果初始化扩展示例测试环境。
 * 参数：execResult 为每次 api.exec 返回的结果。
 * 返回值：发送输入的 emit 函数和 exec 模拟函数。
 * 使用示例：`const { emit, exec } = setup(gitSuccess)`。
 */
function setup(execResult: ExecResult) {
	// handler 保存扩展注册的 input 回调，注册前允许未定义。
	let handler: InputHandler | undefined;

	// exec 是始终返回指定 ExecResult 的 ExtensionAPI 命令模拟。
	const exec = vi.fn<ExtensionAPI["exec"]>().mockResolvedValue(execResult);

	// api 只实现示例扩展需要的事件注册和命令执行成员。
	const api = {
		// event 是事件名，h 是待注册处理器；只捕获 input 事件。
		on: (event: string, h: InputHandler) => {
			if (event === "input") handler = h;
		},
		exec,
	} as unknown as ExtensionAPI;

	inputTransformStreaming(api);

	// ctx 是示例处理器当前不读取的最小扩展上下文。
	const ctx = {} as ExtensionContext;

	/** 发送一条模拟交互输入；返回处理结果 Promise，示例：`emit("review my changes")`。 */
	function emit(text: string, streamingBehavior?: "steer" | "followUp") {
		return handler!({ type: "input", text, source: "interactive", streamingBehavior }, ctx);
	}

	return { emit, exec };
}

describe("input-transform-streaming example", () => {
	// diffOutput 是成功 git diff --stat 的固定输出文本。
	const diffOutput = " src/index.ts | 5 ++---\n 1 file changed, 2 insertions(+), 3 deletions(-)";
	// gitSuccess 表示带差异摘要的成功命令结果。
	const gitSuccess: ExecResult = { stdout: diffOutput, stderr: "", code: 0, killed: false };
	// gitEmpty 表示命令成功但仓库没有差异。
	const gitEmpty: ExecResult = { stdout: "", stderr: "", code: 0, killed: false };
	// gitFail 表示当前目录不是 Git 仓库的失败结果。
	const gitFail: ExecResult = { stdout: "", stderr: "not a git repo", code: 128, killed: false };

	// 验证 steer 输入直接继续且不运行 Git；无参数，无返回值。
	it("skips exec during steering", async () => {
		// emit 发送输入，exec 记录命令调用。
		const { emit, exec } = setup(gitSuccess);
		// result 是 steer 输入的扩展处理结果。
		const result = await emit("what changes did I make?", "steer");
		expect(result).toEqual({ action: "continue" });
		expect(exec).not.toHaveBeenCalled();
	});

	// 验证空闲且命中触发词时注入差异摘要；无参数，无返回值。
	it("transforms when idle and text matches trigger", async () => {
		// emit 发送输入，exec 返回成功差异摘要。
		const { emit, exec } = setup(gitSuccess);
		// result 是预期 action 为 transform 的处理结果。
		const result = await emit("review my changes");
		expect(exec).toHaveBeenCalledWith("git", ["diff", "--stat"]);
		expect(result).toMatchObject({ action: "transform" });
		// text 是转换结果中包含原问题和差异摘要的新输入文本。
		const text = (result as { text: string }).text;
		expect(text).toContain("review my changes");
		expect(text).toContain("src/index.ts");
	});

	// 验证 followUp 排队输入仍允许转换；无参数，无返回值。
	it("transforms when queued as follow-up", async () => {
		// emit 发送 followUp，exec 记录 Git 调用。
		const { emit, exec } = setup(gitSuccess);
		// result 是排队跟进输入的转换结果。
		const result = await emit("show me the diff", "followUp");
		expect(exec).toHaveBeenCalled();
		expect(result).toMatchObject({ action: "transform" });
	});

	// 验证未命中触发词时直接继续且不执行命令；无参数，无返回值。
	it("continues when text does not match trigger", async () => {
		// emit 发送普通输入，exec 应保持未调用。
		const { emit, exec } = setup(gitSuccess);
		// result 是未匹配输入的 continue 结果。
		const result = await emit("explain this function");
		expect(result).toEqual({ action: "continue" });
		expect(exec).not.toHaveBeenCalled();
	});

	// 验证 Git 差异为空时不转换输入；无参数，无返回值。
	it("continues when git diff is empty", async () => {
		// emit 使用空标准输出的成功 Git 结果。
		const { emit } = setup(gitEmpty);
		// result 是无差异情况下的 continue 结果。
		const result = await emit("any changes?");
		expect(result).toEqual({ action: "continue" });
	});

	// 验证 Git 执行失败时保留原输入继续处理；无参数，无返回值。
	it("continues when git fails", async () => {
		// emit 使用非零退出码的 Git 结果。
		const { emit } = setup(gitFail);
		// result 是 Git 失败情况下的 continue 结果。
		const result = await emit("show modified files");
		expect(result).toEqual({ action: "continue" });
	});
});
