import type { ProviderClassifier, ProviderEnv, ProviderStreams } from "../types.ts";

const CLOUDFLARE_ACCOUNT_ID = "CLOUDFLARE_ACCOUNT_ID";
const CLOUDFLARE_GATEWAY_ID = "CLOUDFLARE_GATEWAY_ID";

<<<<<<< HEAD
/**
 * 【文件职责】Cloudflare 流式封装：Workers AI 的流处理辅助。
 * 【新手阅读建议】看流处理。
 */
export function resolveCloudflareModel<TApi extends Api>(
	model: Model<TApi>,
=======
export function resolveCloudflareModel<TModel extends { baseUrl: string }>(
	model: TModel,
>>>>>>> main
	env: ProviderEnv | undefined,
): TModel {
	if (!env) return model;
	const baseUrl = model.baseUrl
		.replaceAll(`{${CLOUDFLARE_ACCOUNT_ID}}`, env[CLOUDFLARE_ACCOUNT_ID] ?? `{${CLOUDFLARE_ACCOUNT_ID}}`)
		.replaceAll(`{${CLOUDFLARE_GATEWAY_ID}}`, env[CLOUDFLARE_GATEWAY_ID] ?? `{${CLOUDFLARE_GATEWAY_ID}}`);
	return baseUrl === model.baseUrl ? model : { ...model, baseUrl };
}

/**
 * Wrap an API implementation so Cloudflare account/gateway endpoint
 * placeholders materialize from the resolved provider env before dispatch.
 */
export function cloudflareStreams(streams: ProviderStreams): ProviderStreams {
	return {
		stream: (model, context, options) =>
			streams.stream(resolveCloudflareModel(model, options?.env), context, options),
		streamSimple: (model, context, options) =>
			streams.streamSimple(resolveCloudflareModel(model, options?.env), context, options),
	};
}

/** Classifier counterpart of {@link cloudflareStreams}. */
export function cloudflareClassifier(classifier: ProviderClassifier): ProviderClassifier {
	return {
		classify: (model, context, options) =>
			classifier.classify(resolveCloudflareModel(model, options?.env), context, options),
	};
}
