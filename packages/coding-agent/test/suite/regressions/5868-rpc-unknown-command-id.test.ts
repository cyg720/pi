/**
 * 文件职责：回归验证 RPC 收到未知命令时，错误响应仍保留原请求标识符。
 * 技术维度：使用 Vitest 模块模拟、JSONL 输入输出替身和进程监听器快照隔离 RPC 模式。
 * 产品维度：让调用方能够把未知命令错误准确关联到发出请求，避免客户端请求悬空。
 * 逻辑维度：模拟 RPC I/O，启动运行时，注入未知命令，解析输出并校验响应字段。
 * 关键边界：runRpcMode 会注册进程监听器，测试结束必须恢复原监听器并清理会话。
 * 新手阅读建议：先读最后的回归用例，再查看 rpcIo、三个模拟模块和监听器恢复函数。
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AgentSessionRuntime } from "../../../src/core/agent-session-runtime.ts";
import { runRpcMode } from "../../../src/modes/rpc/rpc-mode.ts";
import { createHarness, type Harness } from "../harness.ts";

// Regression for https://github.com/earendil-works/pi/issues/5868
// 中文说明：该回归覆盖问题 #5868，重点检查未知命令错误中的请求 id 不会丢失。

// RPC 输入输出的可变测试状态；每个用例结束都要重置，避免模拟模块共享数据。
const rpcIo = vi.hoisted(() => ({
	outputLines: [] as string[],
	lineHandler: undefined as ((line: string) => void) | undefined,
}));

vi.mock("../../../src/core/output-guard.js", () => ({
	flushRawStdout: vi.fn(async () => {}),
	takeOverStdout: vi.fn(),
	waitForRawStdoutBackpressure: vi.fn(async () => {}),
	writeRawStdout: (line: string) => {
		rpcIo.outputLines.push(line);
	},
}));

vi.mock("../../../src/modes/interactive/theme/theme.js", () => ({ theme: {} }));

vi.mock("../../../src/modes/rpc/jsonl.js", () => ({
	attachJsonlLineReader: vi.fn((_stream: NodeJS.ReadableStream, onLine: (line: string) => void) => {
		rpcIo.lineHandler = onLine;
		return () => {
			rpcIo.lineHandler = undefined;
		};
	}),
	serializeJsonLine: (value: unknown) => `${JSON.stringify(value)}\n`,
}));

// Node 进程事件监听函数类型，直接复用 process.on 的第二个参数类型以保持签名一致。
type NodeListener = Parameters<typeof process.on>[1];

// 进程监听器快照；分别保存 stdin end 与当前平台支持的信号监听器。
type ListenerSnapshot = {
	stdinEnd: NodeListener[];
	signals: Map<NodeJS.Signals, NodeListener[]>;
};

/** 功能：记录 RPC 运行前的监听器；参数：无；返回：可用于恢复的快照。示例：const snapshot = takeListenerSnapshot()。 */
function takeListenerSnapshot(): ListenerSnapshot {
	// 当前平台需要观察的信号；Windows 不支持测试中的 SIGHUP。
	const signals: NodeJS.Signals[] = process.platform === "win32" ? ["SIGTERM"] : ["SIGTERM", "SIGHUP"];
	return {
		stdinEnd: process.stdin.listeners("end") as NodeListener[],
		signals: new Map(signals.map((signal) => [signal, process.listeners(signal) as NodeListener[]])),
	};
}

/** 功能：移除快照之后新增的监听器；参数 snapshot 为原状态；返回：无。示例：finally 中调用 restoreListeners(snapshot)。 */
function restoreListeners(snapshot: ListenerSnapshot): void {
	for (const listener of process.stdin.listeners("end") as NodeListener[]) {
		// listener 是当前 stdin end 监听器；循环只移除快照中不存在的新增项。
		if (!snapshot.stdinEnd.includes(listener)) {
			process.stdin.off("end", listener);
		}
	}

	for (const [signal, previousListeners] of snapshot.signals) {
		// signal 是信号名，previousListeners 是运行 RPC 前已存在的监听器集合。
		for (const listener of process.listeners(signal) as NodeListener[]) {
			// listener 是当前信号监听器；保留快照中已有的函数。
			if (!previousListeners.includes(listener)) {
				process.off(signal, listener);
			}
		}
	}
}

/** 功能：把捕获的 JSONL 输出解析为对象数组；参数：无；返回：非空输出行对应的记录。示例：parseOutputLines()[0]。 */
function parseOutputLines(): Array<Record<string, unknown>> {
	return rpcIo.outputLines
		.flatMap((line) => line.split("\n"))
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** 功能：用测试会话构造 RPC 所需宿主；参数 harness 为测试夹具；返回：最小 AgentSessionRuntime。示例：runRpcMode(createRuntimeHost(harness))。 */
function createRuntimeHost(harness: Harness): AgentSessionRuntime {
	return {
		session: harness.session,
		newSession: vi.fn(async () => ({ cancelled: true })),
		switchSession: vi.fn(async () => ({ cancelled: true })),
		fork: vi.fn(async () => ({ cancelled: true, selectedText: "" })),
		dispose: vi.fn(async () => {}),
		setRebindSession: vi.fn(),
	} as unknown as AgentSessionRuntime;
}

describe("RPC unknown command responses (#5868)", () => {
	// 功能：重置共享 RPC 状态；参数：无；返回：无。示例：由 Vitest 在每个测试后调用。
	afterEach(() => {
		rpcIo.outputLines = [];
		rpcIo.lineHandler = undefined;
	});

	test("preserves the request id on unknown command errors", async () => {
		// RPC 启动前的进程监听器快照，用于 finally 精确恢复环境。
		const listenerSnapshot = takeListenerSnapshot();
		// 提供隔离会话的测试夹具，用例结束时必须 cleanup。
		const harness = await createHarness();

		try {
			void runRpcMode(createRuntimeHost(harness));
			await vi.waitFor(() => expect(rpcIo.lineHandler).toBeDefined());

			rpcIo.lineHandler?.(JSON.stringify({ id: "test", type: "foobar" }));

			await vi.waitFor(() => {
				expect(parseOutputLines()).toContainEqual({
					id: "test",
					type: "response",
					command: "foobar",
					success: false,
					error: "Unknown command: foobar",
				});
			});
		} finally {
			harness.cleanup();
			restoreListeners(listenerSnapshot);
		}
	});
});
