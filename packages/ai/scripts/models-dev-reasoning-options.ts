/**
 * 文件职责：把 models.dev 的推理选项描述转换为 Pi 可选择的思考等级映射。
 * 技术维度：使用 TypeScript 判别联合、只读数组、Set 和扁平映射完成类型安全转换。
 * 产品维度：让用户只看到模型真实支持的思考强度，并正确处理关闭推理的选项。
 * 逻辑维度：提取 effort 值，判断是否存在 Pi 可识别等级，再生成 off 与六档等级映射。
 * 关键边界：default 和 JSON null 没有 Pi 等价项会被忽略；没有有效等级时返回 undefined。
 * 新手阅读建议：先看 ModelsDevReasoningOption 的三种形态，再沿 effortValues、supported、map 阅读。
 */
import type { ThinkingLevel, ThinkingLevelMap } from "../src/types.ts";

/** models.dev 可能返回的推理控制方式：开关、强度枚举或 token 预算范围。 */
export type ModelsDevReasoningOption =
	| { type: "toggle" }
	| {
			type: "effort";
			values: Array<"none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "default" | null>;
	  }
	| { type: "budget_tokens"; min?: number; max?: number };

/** Pi 界面支持的六个非关闭思考等级，按由低到高排序且不可修改。 */
const THINKING_LEVELS: readonly ThinkingLevel[] = ["minimal", "low", "medium", "high", "xhigh", "max"];

/**
 * Converts models.dev verified effort values into Pi's selectable thinking levels.
 * Values without a Pi equivalent (`default` and JSON `null`) are intentionally
 * omitted.
 */
/**
 * 将 models.dev 已验证的 effort 值转换为 Pi 思考等级映射；default 与 null 会主动忽略。
 * @param options 模型的只读推理选项数组，可混合开关、effort 和预算描述。
 * @returns 存在可用 effort 时返回各等级映射，否则返回 undefined。
 * @example `getEffortThinkingLevelMap([{ type: "effort", values: ["low", "high"] }])`。
 */
export function getEffortThinkingLevelMap(options: readonly ModelsDevReasoningOption[]): ThinkingLevelMap | undefined {
	/** 所有 effort 选项中的原始值；非 effort 选项贡献空数组。 */
	const effortValues = options.flatMap((option) => (option.type === "effort" ? option.values : []));
	if (effortValues.length === 0) return undefined;

	/** 去重后的支持值集合；可能含 none、default 或 null。 */
	const supported = new Set(effortValues);
	// level 是 Pi 的一个标准思考等级；至少命中一个等级或 none 才值得生成映射。
	if (!THINKING_LEVELS.some((level) => supported.has(level)) && !supported.has("none")) return undefined;

	/** 转换结果；off 用 none 表示明确关闭，不支持关闭时用 null。 */
	const map: ThinkingLevelMap = { off: supported.has("none") ? "none" : null };
	// level 按低到高遍历；支持时映射到自身，不支持时明确记为 null。
	for (const level of THINKING_LEVELS) {
		map[level] = supported.has(level) ? level : null;
	}
	return map;
}
