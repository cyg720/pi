/**
 * 【文件职责】TypeBox 辅助构造器：提供与 Google 等不支持 anyOf/const 模式的供应商
 *              兼容的字符串枚举 schema。
 * 【技术维度】Type.Unsafe 构造裸 JSON Schema（type: "string" + enum）。
 * 【产品维度】让工具参数枚举在更广泛的供应商上可用，避免 schema 兼容性问题。
 * 【逻辑维度】StringEnum 把字符串数组转为 string+enum schema，可选 description/default。
 * 【关键边界】返回 TUnsafe 类型：Static 推导出字面量联合。
 * 【新手阅读建议】半分钟读完即可。
 */
import { type TUnsafe, Type } from "typebox";

/**
 * Creates a string enum schema compatible with Google's API and other providers
 * that don't support anyOf/const patterns.
 *
 * @example
 * const OperationSchema = StringEnum(["add", "subtract", "multiply", "divide"], {
 *   description: "The operation to perform"
 * });
 *
 * type Operation = Static<typeof OperationSchema>; // "add" | "subtract" | "multiply" | "divide"
 */
// 创建字符串枚举 schema（公开）：兼容 Google 等不支持 anyOf/const 的供应商；
// 返回 type:string + enum 的裸 schema，Static 推导为字面量联合
export function StringEnum<T extends readonly string[]>(
	values: T,
	options?: { description?: string; default?: T[number] },
): TUnsafe<T[number]> {
	return Type.Unsafe<T[number]>({
		type: "string",
		enum: values as any,
		...(options?.description && { description: options.description }),
		...(options?.default && { default: options.default }),
	});
}
