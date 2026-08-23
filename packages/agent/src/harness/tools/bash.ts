/**
 * 【文件职责】实现内置 bash 工具：在当前工作目录执行 shell 命令，流式捕获输出（尾部截断 + 全量落盘），
 *              以节流的进度更新推送给 UI，并把超时/中止/非零退出等状态编码为工具错误结果。
 * 【技术维度】typebox 参数 schema；executeShellWithCapture 提供输出捕获；100ms 节流的 onUpdate 进度回调；
 *              抛异常式错误传递（由循环转错误结果）。
 * 【产品维度】模型执行命令、查看输出的主要通道：截断提示与完整日志路径兼顾上下文经济性与可追溯性。
 * 【逻辑维度】校验 timeout → 组装 BashExecution（可加 commandPrefix，prepare 钩子可改写）→
 *              发起空进度 → 捕获执行并按需推送中间进度 → 结束后拼装最终输出与截断说明 →
 *              按 cancelled/timeout/executionError/exitCode 顺序判定失败。
 * 【关键边界】无默认超时；进度更新最多每 100ms 一次；被中止抛 "Command aborted"；
 *              超时与非零退出都携带已捕获输出便于排查；details 仅在发生截断时提供。
 * 【新手阅读建议】先看 bashSchema 与 BashToolOptions 了解契约 → 再读 execute 主流程 →
 *              最后研究 scheduleOutputUpdate/emitOutputUpdate 的节流机制。
 */
import { type Static, Type } from "typebox";
import type { AgentHarnessTool } from "../types.ts";
import { getOrThrow } from "../types.ts";
import { executeShellWithCapture, type ShellCaptureProgress } from "../utils/shell-output.ts";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, type TruncationResult } from "../utils/truncate.ts";
import type { ExecutionToolContext } from "./tool-context.ts";

// 超时上限（秒）：受 setTimeout 32 位毫秒上限约束
const MAX_TIMEOUT_SECONDS = 2_147_483_647 / 1000;
// 输出进度更新的最小间隔（毫秒）
const BASH_UPDATE_THROTTLE_MS = 100;

// bash 工具参数 schema：command 必填；timeout 可选（秒）
const bashSchema = Type.Object({
	command: Type.String({ description: "Bash command to execute" }),
	timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (optional, no default timeout)" })),
});

/** bash 工具输入类型（schema 推导） */
export type BashToolInput = Static<typeof bashSchema>;

/** bash 工具详情（中文说明）：仅在发生截断时填充——截断诊断信息与全量输出文件路径。 */
export interface BashToolDetails {
	truncation?: TruncationResult;
	fullOutputPath?: string;
}

/** 一次命令执行的描述（中文说明）：供 prepare 钩子检查或改写的执行参数快照。 */
export interface BashExecution {
	command: string;
	cwd: string;
	env: Record<string, string>;
	inheritEnv: boolean;
}

/**
 * prepare 钩子类型（中文说明）：在真正执行前调用，允许宿主校验/修改 execution
 * （如注入环境变量、改写命令）；可异步。返回值被忽略。
 */
export type BashPrepare<TContext extends ExecutionToolContext = ExecutionToolContext> = (
	execution: BashExecution,
	context: TContext,
	signal?: AbortSignal,
) => void | Promise<void>;

/** bash 工具选项（中文说明）：commandPrefix 会被拼接在用户命令之前；prepare 为执行前钩子。 */
export interface BashToolOptions<TContext extends ExecutionToolContext = ExecutionToolContext> {
	commandPrefix?: string;
	prepare?: BashPrepare<TContext>;
}

// 校验 timeout 合法性（私有）：必须为正的有限秒数且不超过系统上限
function validateTimeout(timeout: number | undefined): void {
	if (timeout === undefined) return;
	if (!Number.isFinite(timeout) || timeout <= 0) {
		throw new Error("Invalid timeout: must be a finite number of seconds");
	}
	if (timeout > MAX_TIMEOUT_SECONDS) {
		throw new Error(`Invalid timeout: maximum is ${MAX_TIMEOUT_SECONDS} seconds`);
	}
}

/**
 * 创建 bash 工具实例（中文说明）：泛型 TContext 支持应用扩展上下文；
 * options 可选——commandPrefix 前缀命令、prepare 执行前钩子。返回 AgentHarnessTool。
 */
export function createBashTool<TContext extends ExecutionToolContext = ExecutionToolContext>(
	options?: BashToolOptions<TContext>,
): AgentHarnessTool<TContext, typeof bashSchema, BashToolDetails | undefined> {
	return {
		name: "bash",
		label: "bash",
		description: `Execute a bash command in the current working directory. Returns stdout and stderr. Output is truncated to last ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). If truncated, full output is saved to a temp file. Optionally provide a timeout in seconds.`,
		parameters: bashSchema,
		async execute(_toolCallId, { command, timeout }, signal, onUpdate, context) {
			// 先校验超时参数
			validateTimeout(timeout);
			const { env } = context;
			// 组装执行描述：前缀命令以换行拼接；默认继承环境变量
			const execution: BashExecution = {
				command: options?.commandPrefix ? `${options.commandPrefix}\n${command}` : command,
				cwd: env.cwd,
				env: {},
				inheritEnv: true,
			};
			// 允许宿主在执行前检查/修改参数
			await options?.prepare?.(execution, context, signal);
			// 最新进度快照生成器（由捕获层回填）
			let getLatestProgress: (() => ShellCaptureProgress) | undefined;
			// 待触发的节流定时器
			let updateTimer: ReturnType<typeof setTimeout> | undefined;
			// 是否有未发送的新输出
			let updateDirty = false;
			// 上次实际发送时间戳
			let lastUpdateAt = 0;

			// 立即发送一次当前进度（私有闭包）
			const emitOutputUpdate = (): void => {
				if (!onUpdate || !updateDirty || !getLatestProgress) return;
				updateDirty = false;
				lastUpdateAt = Date.now();
				const progress = getLatestProgress();
				onUpdate({
					content: [{ type: "text", text: progress.output }],
					details: {
						truncation: progress.truncation.truncated ? progress.truncation : undefined,
						fullOutputPath: progress.fullOutputPath,
					},
				});
			};
			// 清理待触发的定时器（私有闭包）
			const clearUpdateTimer = (): void => {
				if (!updateTimer) return;
				clearTimeout(updateTimer);
				updateTimer = undefined;
			};
			// 标记有新输出并按节流策略调度发送（私有闭包）
			const scheduleOutputUpdate = (): void => {
				if (!onUpdate) return;
				updateDirty = true;
				const delay = BASH_UPDATE_THROTTLE_MS - (Date.now() - lastUpdateAt);
				if (delay <= 0) {
					clearUpdateTimer();
					emitOutputUpdate();
					return;
				}
				updateTimer ??= setTimeout(() => {
					updateTimer = undefined;
					emitOutputUpdate();
				}, delay);
			};

			// 先发一个空内容进度，让 UI 立即出现“运行中”占位
			onUpdate?.({ content: [], details: undefined });
			try {
				const capture = getOrThrow(
					await executeShellWithCapture(env, execution.command, {
						cwd: execution.cwd,
						env: execution.env,
						inheritEnv: execution.inheritEnv,
						timeout,
						abortSignal: signal,
						returnExecutionErrors: true,
						onChunk: (_chunk, getProgress) => {
							getLatestProgress = getProgress;
							scheduleOutputUpdate();
						},
					}),
				);
				clearUpdateTimer();
				// 结束后以最终捕获结果为准再发一次
				getLatestProgress = () => capture;
				updateDirty = true;
				emitOutputUpdate();

				let outputText = capture.output;
				let details: BashToolDetails | undefined;
				if (capture.truncation.truncated) {
					// 截断时记录详情并在输出末尾追加说明（含保留区间与完整文件位置）
					details = { truncation: capture.truncation, fullOutputPath: capture.fullOutputPath };
					const startLine = capture.truncation.totalLines - capture.truncation.outputLines + 1;
					const endLine = capture.truncation.totalLines;
					if (capture.truncation.lastLinePartial) {
						const lastLineSize = formatSize(capture.lastLineBytes);
						outputText += `\n\n[Showing last ${formatSize(capture.truncation.outputBytes)} of line ${endLine} (line is ${lastLineSize}). Full output: ${capture.fullOutputPath}]`;
					} else if (capture.truncation.truncatedBy === "lines") {
						outputText += `\n\n[Showing lines ${startLine}-${endLine} of ${capture.truncation.totalLines}. Full output: ${capture.fullOutputPath}]`;
					} else {
						outputText += `\n\n[Showing lines ${startLine}-${endLine} of ${capture.truncation.totalLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Full output: ${capture.fullOutputPath}]`;
					}
				}

				// 在已有输出基础上追加状态行的辅助函数
				const appendStatus = (status: string): string => `${outputText ? `${outputText}\n\n` : ""}${status}`;
				// 失败判定顺序：取消 → 超时 → 其他执行错误 → 非零退出码
				if (capture.cancelled) throw new Error(appendStatus("Command aborted"));
				if (capture.executionError?.code === "timeout") {
					throw new Error(appendStatus(`Command timed out after ${timeout} seconds`), {
						cause: capture.executionError,
					});
				}
				if (capture.executionError) throw capture.executionError;
				if (capture.exitCode !== 0 && capture.exitCode !== undefined) {
					throw new Error(appendStatus(`Command exited with code ${capture.exitCode}`));
				}
				return { content: [{ type: "text", text: outputText || "(no output)" }], details };
			} finally {
				clearUpdateTimer();
			}
		},
	};
}
