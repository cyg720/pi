/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `harness/result` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 语言内建能力与本文件声明，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `harness/result` 对应的子能力。
 * 【逻辑维度】对外入口包括 `Result`、`TaggedErrorValue`、`TaggedErrorFactory`、`TaggedError`、`ErrorMatchers`、`matchError`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `Result`、`TaggedErrorValue`、`TaggedErrorFactory`、`TaggedError`、`ErrorMatchers`、`matchError` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
export type Result<TValue, TError> = { ok: true; value: TValue } | { ok: false; error: TError };

export const Result = {
	ok<TValue>(value: TValue): Result<TValue, never> {
		return { ok: true, value };
	},
	err<TError>(error: TError): Result<never, TError> {
		return { ok: false, error };
	},
	isOk<TValue, TError>(result: Result<TValue, TError>): result is { ok: true; value: TValue } {
		return result.ok;
	},
	isErr<TValue, TError>(result: Result<TValue, TError>): result is { ok: false; error: TError } {
		return !result.ok;
	},
};

export interface TaggedErrorValue<Tag extends string> extends Error {
	readonly _tag: Tag;
	toJSON(): { _tag: Tag; message: string } & Record<string, unknown>;
}

export interface TaggedErrorFactory<Tag extends string> {
	new <Props extends { message: string }>(props: Props): TaggedErrorValue<Tag> & Readonly<Props>;
	is(value: unknown): value is TaggedErrorValue<Tag>;
}

export function TaggedError<Tag extends string>(tag: Tag): TaggedErrorFactory<Tag> {
	class TaggedErrorClass extends Error {
		readonly _tag = tag;

		constructor(props: { message: string } & Record<string, unknown>) {
			super(props.message);
			this.name = tag;
			Object.assign(this, props);
		}

		toJSON(): { _tag: Tag; message: string } & Record<string, unknown> {
			const payload: Record<string, unknown> = {};
			for (const key of Object.keys(this)) {
				if (key !== "_tag") payload[key] = (this as unknown as Record<string, unknown>)[key];
			}
			return { _tag: tag, message: this.message, ...payload };
		}

		static is(value: unknown): value is TaggedErrorValue<Tag> {
			return value instanceof TaggedErrorClass;
		}
	}
	return TaggedErrorClass as unknown as TaggedErrorFactory<Tag>;
}

export type ErrorMatchers<TError extends TaggedErrorValue<string>, TValue> = {
	[Tag in TError["_tag"]]: (error: Extract<TError, { _tag: Tag }>) => TValue;
};

export function matchError<TError extends TaggedErrorValue<string>, TValue>(
	error: TError,
	matchers: ErrorMatchers<TError, TValue>,
): TValue {
	const matcher = (matchers as unknown as Record<string, (value: TError) => TValue>)[error._tag];
	return matcher(error);
}
