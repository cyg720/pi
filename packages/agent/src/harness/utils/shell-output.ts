/**
 * 【文件职责】带“尾部捕获 + 全量落盘”的 shell 执行封装：边执行边维护受截断限制的尾部输出，
 *              超限时自动把全量输出写入临时文件，并向调用方提供实时进度快照。
 * 【技术维度】流式回调聚合 stdout/stderr；UTF-8 字节级裁剪（不破坏多字节字符）；Promise 链串行化文件追加写；
 *              Result 风格错误处理；二进制控制字符清洗。
 * 【产品维度】bash 工具的底层支撑：模型看到的是被截断的尾部输出，用户仍可通过 fullOutputPath 查看完整日志，
 *              兼顾上下文经济性与可追溯性。
 * 【逻辑维度】executeShellWithCapture 内部：onChunk 累计字节/行数 → 超限触发 ensureFullOutputFile/appendFullOutput
 *              → 尾部缓冲裁剪到 2×上限；结束后统一生成进度快照并按中止/失败/成功三种路径返回。
 * 【关键边界】尾部缓冲上限为 DEFAULT_MAX_BYTES×2；fullOutputPath 仅在超限后才会创建；
 *              returnExecutionErrors=true 时执行失败也以 ok 返回（错误放在 executionError 字段）。
 * 【新手阅读建议】先看三个导出接口的数据形状 → 再读 onChunk 的统计与落盘触发逻辑 →
 *              最后看主函数结尾的三分支返回策略。
 */
import { type ExecutionEnv, ExecutionError, err, ok, type Result, type ShellExecOptions, toError } from "../types.ts";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, type TruncationResult, truncateTail } from "./truncate.ts";

/** 捕获进度快照（中文说明）：当前尾部输出、其截断信息、全量文件路径（如有）与未完成行的字节数。 */
export interface ShellCaptureProgress {
	// 当前保留的尾部输出文本
	output: string;
	// 该输出的截断诊断信息
	truncation: TruncationResult;
	// 全量输出的临时文件路径；仅在发生截断后创建
	fullOutputPath?: string;
	// 当前未完成行的累计字节数
	lastLineBytes: number;
}

/** 捕获选项（中文说明）：继承 ShellExecOptions 并替换输出回调——onChunk 同时拿到文本与进度快照生成器。 */
export interface ShellCaptureOptions extends Omit<ShellExecOptions, "onStdout" | "onStderr"> {
	onChunk?: (chunk: string, getProgress: () => ShellCaptureProgress) => void;
	/** Return shell execution failures with captured output instead of as a failed Result. */
	// 为 true 时执行失败不以 err 返回，而是把错误放进结果的 executionError 字段
	returnExecutionErrors?: boolean;
}

/** 捕获结果（中文说明）：进度快照 + 退出码/取消标记/截断标记/可能的执行错误。 */
export interface ShellCaptureResult extends ShellCaptureProgress {
	// 进程退出码；取消或无退出时为 undefined
	exitCode: number | undefined;
	// 是否因中止信号而取消
	cancelled: boolean;
	// 输出是否触发了截断
	truncated: boolean;
	// returnExecutionErrors 模式下携带的执行错误
	executionError?: ExecutionError;
}

// 把任意抛出值规范化为 ExecutionError（私有）：已是该类型则原样返回，否则包装为 unknown 错误码
function toExecutionError(error: unknown): ExecutionError {
	if (error instanceof ExecutionError) return error;
	const cause = toError(error);
	return new ExecutionError("unknown", cause.message, cause);
}

/**
 * 清洗二进制输出（中文说明）：过滤掉除 \t \n \r 外的全部 C0 控制字符及 U+FFF9~FFFB 内嵌交互字符，
 * 保留其余 Unicode。参数 str —— 原始输出块；返回安全文本。
 */
export function sanitizeBinaryOutput(str: string): string {
	return Array.from(str)
		.filter((char) => {
			const code = char.codePointAt(0);
			if (code === undefined) return false;
			if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
			if (code <= 0x1f) return false;
			if (code >= 0xfff9 && code <= 0xfffb) return false;
			return true;
		})
		.join("");
}

/**
 * 把文本裁剪到末尾 maxBytes 字节以内（私有）：先整体编码为 UTF-8，
 * 从裁剪点向后跳过 continuation 字节（形如 10xxxxxx）避免拆坏多字节字符，再解码返回。
 */
function trimToLastUtf8Bytes(text: string, maxBytes: number, encoder: { encode(input?: string): Uint8Array }): string {
	const bytes = encoder.encode(text);
	if (bytes.byteLength <= maxBytes) return text;
	let start = bytes.byteLength - maxBytes;
	while (start < bytes.byteLength && ((bytes[start] ?? 0) & 0xc0) === 0x80) start++;
	return new TextDecoder().decode(bytes.subarray(start));
}

/**
 * 执行 shell 并捕获输出（中文说明）：
 * 参数 env —— 执行环境；command —— 命令；options —— 捕获选项。
 * 返回 ok(ShellCaptureResult) 或 err(ExecutionError)；stdout/stderr 统一流入同一处理器。
 */
export async function executeShellWithCapture(
	env: ExecutionEnv,
	command: string,
	options?: ShellCaptureOptions,
): Promise<Result<ShellCaptureResult, ExecutionError>> {
	// 尾部输出缓冲（会被持续裁剪）
	let tailOutput = "";
	// 尾部缓冲的字节上限：默认字节上限的 2 倍
	const maxOutputBytes = DEFAULT_MAX_BYTES * 2;
	const encoder = new TextEncoder();

	// 累计输出总字节数
	let totalBytes = 0;
	// 已完成的行数
	let completedLines = 0;
	// 是否存在未换行的“开放行”
	let hasOpenLine = false;
	// 开放行的当前字节数
	let currentLineBytes = 0;
	// 全量输出临时文件路径（创建后才有值）
	let fullOutputPath: string | undefined;
	// 是否已请求创建全量输出文件
	let fullOutputRequested = false;
	// 进程是否仍在产出输出（结束后丢弃迟到回调）
	let acceptingOutput = true;
	// 文件写入操作链：保证按序追加
	let writeChain: Promise<Result<void, ExecutionError>> = Promise.resolve(ok(undefined));
	// 输出处理过程中的捕获异常
	let captureError: ExecutionError | undefined;

	// 向全量文件追加文本（私有闭包）：串入 writeChain 保证顺序；未创建文件则记错
	const appendFullOutput = (text: string): void => {
		if (!fullOutputRequested || captureError) return;
		writeChain = writeChain.then(async (previous) => {
			if (!previous.ok) return previous;
			if (!fullOutputPath) return err(new ExecutionError("unknown", "Full output path was not created"));
			const appendResult = await env.appendFile(fullOutputPath, text);
			return appendResult.ok ? ok(undefined) : err(toExecutionError(appendResult.error));
		});
	};

	// 创建全量输出文件并写入初始内容（私有闭包）：用 bash-*.log 前后缀的临时文件
	const ensureFullOutputFile = (initialContent: string): void => {
		if (fullOutputRequested || captureError) return;
		fullOutputRequested = true;
		writeChain = writeChain.then(async (previous) => {
			if (!previous.ok) return previous;
			const tempFile = await env.createTempFile({ prefix: "bash-", suffix: ".log" });
			if (!tempFile.ok) return err(toExecutionError(tempFile.error));
			fullOutputPath = tempFile.value;
			const appendResult = await env.appendFile(tempFile.value, initialContent);
			return appendResult.ok ? ok(undefined) : err(toExecutionError(appendResult.error));
		});
	};

	// 生成当前进度快照（私有闭包）：对尾部做 truncateTail，并用累计计数覆盖总行数/总字节
	const createProgress = (): ShellCaptureProgress => {
		const tailTruncation = truncateTail(tailOutput);
		const totalLines = completedLines + (hasOpenLine ? 1 : 0);
		const truncated = totalLines > DEFAULT_MAX_LINES || totalBytes > DEFAULT_MAX_BYTES;
		const truncation: TruncationResult = {
			...tailTruncation,
			truncated,
			truncatedBy: truncated
				? (tailTruncation.truncatedBy ?? (totalBytes > DEFAULT_MAX_BYTES ? "bytes" : "lines"))
				: null,
			totalLines,
			totalBytes,
		};
		return {
			output: truncated ? truncation.content : tailOutput,
			truncation,
			fullOutputPath,
			lastLineBytes: currentLineBytes,
		};
	};

	// stdout/stderr 共用的分块处理器（私有闭包）：清洗 → 统计 → 触发落盘 → 裁剪缓冲 → 通知调用方
	const onChunk = (chunk: string): void => {
		if (!acceptingOutput) return;
		try {
			const text = sanitizeBinaryOutput(chunk).replace(/\r/g, "");
			const textBytes = encoder.encode(text).byteLength;
			totalBytes += textBytes;
			const newlineCount = text.split("\n").length - 1;
			completedLines += newlineCount;
			const lastNewline = text.lastIndexOf("\n");
			if (lastNewline >= 0) {
				const trailingText = text.slice(lastNewline + 1);
				currentLineBytes = encoder.encode(trailingText).byteLength;
				hasOpenLine = trailingText.length > 0;
			} else if (text.length > 0) {
				currentLineBytes += textBytes;
				hasOpenLine = true;
			}

			tailOutput += text;
			const totalLines = completedLines + (hasOpenLine ? 1 : 0);
			if ((totalBytes > DEFAULT_MAX_BYTES || totalLines > DEFAULT_MAX_LINES) && !fullOutputRequested) {
				// 首次超限：创建全量文件并把现有尾部全部写入
				ensureFullOutputFile(tailOutput);
			} else if (fullOutputRequested) {
				// 已在记录全量：追加本块
				appendFullOutput(text);
			}
			tailOutput = trimToLastUtf8Bytes(tailOutput, maxOutputBytes, encoder);
			options?.onChunk?.(text, createProgress);
		} catch (error) {
			captureError = toExecutionError(error);
		}
	};

	try {
		const result = await env.exec(command, {
			cwd: options?.cwd,
			env: options?.env,
			inheritEnv: options?.inheritEnv,
			timeout: options?.timeout,
			abortSignal: options?.abortSignal,
			onStdout: onChunk,
			onStderr: onChunk,
		});
		// 进程结束：不再接受输出回调
		acceptingOutput = false;
		let progress = createProgress();
		if (progress.truncation.truncated && !fullOutputRequested) ensureFullOutputFile(tailOutput);
		// 等待全部落盘写操作完成
		const writeResult = await writeChain;
		if (!writeResult.ok) return err(writeResult.error);
		if (captureError) return err(captureError);
		progress = createProgress();

		if (!result.ok) {
			// 中止场景：视为用户取消而非失败
			if (result.error.code === "aborted" || options?.abortSignal?.aborted) {
				return ok({
					...progress,
					exitCode: undefined,
					cancelled: true,
					truncated: progress.truncation.truncated,
				});
			}
			// 可选模式：把执行错误放进结果里一并返回
			if (options?.returnExecutionErrors) {
				return ok({
					...progress,
					exitCode: undefined,
					cancelled: false,
					truncated: progress.truncation.truncated,
					executionError: result.error,
				});
			}
			return err(result.error);
		}
		const cancelled = options?.abortSignal?.aborted ?? false;
		return ok({
			...progress,
			exitCode: cancelled ? undefined : result.value.exitCode,
			cancelled,
			truncated: progress.truncation.truncated,
		});
	} catch (error) {
		acceptingOutput = false;
		return err(toExecutionError(error));
	}
}
