/**
 * 【文件职责】实现内置 edit 工具：对单个文件执行一处或多处“精确文本替换”，
 *              保留原文件的 BOM 与换行风格，并生成可读 diff 与 unified patch 作为详情返回。
 * 【技术维度】typebox schema；prepareArguments 兼容旧版单编辑参数与字符串化 edits；
 *              edit-diff 的模糊匹配/行级回写；文件变更队列保证并发安全。
 * 【产品维度】模型修改代码的主要手段：多处小步替换 + 唯一性校验，配合差异预览让用户可控地审查每次改动。
 * 【逻辑维度】validateEditInput 校验入参 → 解析绝对路径并入队 → 读文件 → 剥 BOM/归一化 LF →
 *              applyEditsToNormalizedContent 执行替换 → 还原换行与 BOM 写回 → 生成 diff 详情。
 * 【关键边界】每个 oldText 必须在文件中唯一且互不重叠；目标必须是文件或符号链接；
 *              各阶段（读前/读后/替换后/写后）均检查中止信号；details 恒有 diff/patch。
 * 【新手阅读建议】先看两个 schema 了解参数契约 → 再看 prepareEditArguments 的兼容逻辑 →
 *              最后按 execute 的六步流程走一遍。
 */
import { type Static, Type } from "typebox";
import type { AgentHarnessTool, FileError } from "../types.ts";
import {
	applyEditsToNormalizedContent,
	detectLineEnding,
	type Edit,
	generateDiffString,
	generateUnifiedPatch,
	normalizeToLF,
	restoreLineEndings,
	stripBom,
} from "./edit-diff.ts";
import { withFileMutationQueue } from "./file-mutation-queue.ts";
import { resolveToolPath } from "./path-utils.ts";
import type { ExecutionToolContext } from "./tool-context.ts";

// 单条替换的 schema：oldText 必须唯一且与其他编辑不重叠
const replaceEditSchema = Type.Object(
	{
		oldText: Type.String({
			description:
				"Exact text for one targeted replacement. It must be unique in the original file and must not overlap with any other edits[].oldText in the same call.",
		}),
		newText: Type.String({ description: "Replacement text for this targeted edit." }),
	},
	{},
);

// edit 工具整体 schema：path 目标文件；edits 替换列表
const editSchema = Type.Object(
	{
		path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
		edits: Type.Array(replaceEditSchema, {
			description:
				"One or more targeted replacements. Each edit is matched against the original file, not incrementally. Do not include overlapping or nested edits. If two changes touch the same block or nearby lines, merge them into one edit instead.",
		}),
	},
	{},
);

/** edit 工具输入类型 */
export type EditToolInput = Static<typeof editSchema>;
/** 旧版输入形状（中文说明）：早期版本直接传顶层 oldText/newText，用于兼容识别。 */
type LegacyEditToolInput = EditToolInput & { oldText?: unknown; newText?: unknown };

/** 编辑工具详情（中文说明）：可读 diff、unified patch 与新文件首处变更行号。 */
export interface EditToolDetails {
	diff: string;
	patch: string;
	firstChangedLine?: number;
}

/**
 * 参数预处理（私有）：兼容两种历史形态——
 * 1) edits 是 JSON 字符串时尝试解析为数组；2) 存在顶层 oldText/newText 时包装为一条编辑。
 * 参数 input —— 原始参数对象。返回规范化的 EditToolInput。
 */
function prepareEditArguments(input: unknown): EditToolInput {
	if (!input || typeof input !== "object") return input as EditToolInput;
	const args = input as Record<string, unknown>;
	if (typeof args.edits === "string") {
		try {
			const parsed: unknown = JSON.parse(args.edits);
			if (Array.isArray(parsed)) args.edits = parsed;
		} catch {}
	}

	const legacy = args as LegacyEditToolInput;
	if (typeof legacy.oldText !== "string" || typeof legacy.newText !== "string") return args as EditToolInput;
	const edits = Array.isArray(legacy.edits) ? [...legacy.edits] : [];
	edits.push({ oldText: legacy.oldText, newText: legacy.newText });
	// 剥离已消费的顶层字段
	const { oldText: _oldText, newText: _newText, ...rest } = legacy;
	return { ...rest, edits } as EditToolInput;
}

// 入参校验（私有）：edits 至少包含一条替换
function validateEditInput(input: EditToolInput): { path: string; edits: Edit[] } {
	if (!Array.isArray(input.edits) || input.edits.length === 0) {
		throw new Error("Edit tool input is invalid. edits must contain at least one replacement.");
	}
	return { path: input.path, edits: input.edits };
}

// 统一构造“无法访问文件”错误（私有）：携带原始 FileError 作为 cause
function editAccessError(path: string, error: FileError): Error {
	return new Error(`Could not edit file: ${path}. Error code: ${error.code}.`, { cause: error });
}

/**
 * 创建 edit 工具实例（中文说明）：无构造选项；泛型 TContext 支持上下文扩展。
 * 返回带 prepareArguments 兼容层的 AgentHarnessTool。
 */
export function createEditTool<TContext extends ExecutionToolContext = ExecutionToolContext>(): AgentHarnessTool<
	TContext,
	typeof editSchema,
	EditToolDetails | undefined
> {
	return {
		name: "edit",
		label: "edit",
		description:
			"Edit a single file using exact text replacement. Every edits[].oldText must match a unique, non-overlapping region of the original file. If two changes affect the same block or nearby lines, merge them into one edit instead of emitting overlapping edits. Do not include large unchanged regions just to connect distant changes.",
		parameters: editSchema,
		// schema 校验前先做历史形态兼容
		prepareArguments: prepareEditArguments,
		async execute(_toolCallId, input, signal, _onUpdate, { env }) {
			const { path, edits } = validateEditInput(input);
			const absolutePath = await resolveToolPath(env, path, signal);
			// 进入同路径串行队列，避免并发编辑冲突
			return withFileMutationQueue(env, absolutePath, async () => {
				if (signal?.aborted) throw new Error("Operation aborted");
				// 目标必须是普通文件或符号链接
				const info = await env.fileInfo(absolutePath, signal);
				if (!info.ok) throw editAccessError(path, info.error);
				if (info.value.kind !== "file" && info.value.kind !== "symlink") {
					throw new Error(`Could not edit file: ${path}. Path is not a file.`);
				}

				// 读取原文
				const readResult = await env.readTextFile(absolutePath, signal);
				if (!readResult.ok) throw editAccessError(path, readResult.error);
				if (signal?.aborted) throw new Error("Operation aborted");

				// 剥离 BOM 并统一换行为 LF 后应用替换
				const { bom, text: content } = stripBom(readResult.value);
				const originalEnding = detectLineEnding(content);
				const normalizedContent = normalizeToLF(content);
				const { baseContent, newContent } = applyEditsToNormalizedContent(normalizedContent, edits, path);
				if (signal?.aborted) throw new Error("Operation aborted");

				// 还原 BOM 与原换行风格后写回
				const finalContent = bom + restoreLineEndings(newContent, originalEnding);
				const writeResult = await env.writeFile(absolutePath, finalContent, signal);
				if (!writeResult.ok) throw editAccessError(path, writeResult.error);
				if (signal?.aborted) throw new Error("Operation aborted");

				// 生成展示用差异与标准补丁
				const diffResult = generateDiffString(baseContent, newContent);
				return {
					content: [{ type: "text", text: `Successfully replaced ${edits.length} block(s) in ${path}.` }],
					details: {
						diff: diffResult.diff,
						patch: generateUnifiedPatch(path, baseContent, newContent),
						firstChangedLine: diffResult.firstChangedLine,
					},
				};
			});
		},
	};
}
