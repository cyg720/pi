import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** 模型数据清单格式版本；结构不兼容时必须递增。 */
export const MODEL_DATA_SCHEMA_VERSION = 3;
/** 每个模型数据目录中的清单文件名。 */
export const MODEL_DATA_MANIFEST_FILE = ".manifest.json";

/** 提供商到“模型 ID—API 类型”映射的完整结构。 */
export type ModelDataStructure = Record<string, Record<string, string>>;

/** 描述一次模型数据生成结果及各文件哈希的清单。 */
export interface ModelDataManifest {
	schemaVersion: number;
	generatedAt: string;
	structureHash: string;
	files: Record<string, string>;
}

/** 从 models.generated.ts 提取提供商分片导入名的固定格式正则。 */
const MODEL_DATA_IMPORT_PATTERN =
	/^import \{ [A-Z][A-Z0-9_]*_MODELS \} from "\.\/providers\/([^"/]+)\.models\.ts";$/gm;

/** 计算字符串的 SHA-256 十六进制摘要。参数 value 为原文；返回稳定哈希。示例：sha256(content)。 */
function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

/** 按字符串键排序条目并转换为普通对象。返回插入顺序稳定的记录。示例：sortedRecord(map.entries())。 */
function sortedRecord<T>(entries: Iterable<readonly [string, T]>): Record<string, T> {
	return Object.fromEntries(Array.from(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** 判断两个字符串数组是否逐项完全一致。返回布尔值。示例：sameStrings(expected, actual)。 */
function sameStrings(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** 描述期望集合与实际集合的缺失项和多余项。返回可直接放入错误消息的文本。示例：describeSetDifference(expected, actual)。 */
function describeSetDifference(expected: readonly string[], actual: readonly string[]): string {
	/** 期望值集合，用于查找实际多余项。 */
	const expectedSet = new Set(expected);
	/** 实际值集合，用于查找缺失项。 */
	const actualSet = new Set(actual);
	/** 期望存在但实际缺失的值。 */
	const missing = expected.filter((value) => !actualSet.has(value));
	/** 实际存在但不在期望中的值。 */
	const extra = actual.filter((value) => !expectedSet.has(value));
	return [missing.length > 0 ? `missing: ${missing.join(", ")}` : "", extra.length > 0 ? `extra: ${extra.join(", ")}` : ""]
		.filter(Boolean)
		.join("; ");
}

/** 判断未知值是否为非空且非数组的普通对象。返回类型守卫结果。示例：isRecord(parsed)。 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 读取并解析 JSON 对象；错误会写入 errors 而非立即抛出。返回对象或 undefined。示例：readJsonObject(path, label, errors)。 */
function readJsonObject(path: string, description: string, errors: string[]): Record<string, unknown> | undefined {
	/** 文件解析后的未知值，随后由 isRecord 收窄。 */
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		errors.push(`${description} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
		return undefined;
	}
	if (!isRecord(parsed)) {
		errors.push(`${description} must contain a JSON object`);
		return undefined;
	}
	return parsed;
}

/** 读取单个提供商 JSON，并建立模型 ID 到 API 分组的映射。返回排序后的记录。示例：readProviderStructure(path, providerId)。 */
function readProviderStructure(path: string, providerId: string): Record<string, string> {
	/** 读取 JSON 时收集的错误消息。 */
	const errors: string[] = [];
	/** 提供商 JSON 顶层的 API 分组对象。 */
	const groups = readJsonObject(path, `${providerId}.json`, errors);
	if (!groups) throw new Error(errors.join("\n"));

	/** 已发现模型到所属 API 的映射，用于检测重复模型。 */
	const models = new Map<string, string>();
	for (const [api, value] of Object.entries(groups)) {
		if (!isRecord(value)) throw new Error(`${path} API group ${JSON.stringify(api)} must be an object`);
		for (const modelId of Object.keys(value)) {
			if (models.has(modelId)) throw new Error(`${path} contains model ${modelId} in more than one API group`);
			models.set(modelId, api);
		}
	}
	if (models.size === 0) throw new Error(`${path} contains no generated model data`);
	return sortedRecord(models);
}

/** 从生成聚合文件读取并校验提供商 ID。参数 packageRoot 为 ai 包根目录；返回排序后的 ID。示例：readModelDataProviderIds(root)。 */
export function readModelDataProviderIds(packageRoot: string): string[] {
	/** 模型聚合生成文件路径。 */
	const aggregatorPath = join(packageRoot, "src", "models.generated.ts");
	/** 聚合生成文件的原始文本。 */
	const aggregator = readFileSync(aggregatorPath, "utf8");
	/** 正则提取并排序后的提供商 ID。 */
	const providerIds = Array.from(aggregator.matchAll(MODEL_DATA_IMPORT_PATTERN), (match) => match[1]).sort();
	if (providerIds.length === 0) throw new Error(`No generated provider imports found in ${aggregatorPath}`);
	if (new Set(providerIds).size !== providerIds.length) {
		throw new Error(`Generated model aggregator contains duplicate provider imports: ${aggregatorPath}`);
	}
	return providerIds;
}

/** 对照聚合导入和提供商分片，读取完整模型结构。返回稳定排序的结构。示例：readModelDataStructure(root)。 */
export function readModelDataStructure(packageRoot: string): ModelDataStructure {
	/** 生成提供商 TypeScript 分片所在目录。 */
	const providersDir = join(packageRoot, "src", "providers");
	/** 提供商 JSON 数据目录。 */
	const dataDir = join(providersDir, "data");
	/** 聚合文件声明的提供商 ID。 */
	const providerIds = readModelDataProviderIds(packageRoot);
	/** 根据聚合文件推导出的期望分片文件名。 */
	const expectedShards = providerIds.map((providerId) => `${providerId}.models.ts`).sort();
	/** 文件系统中实际存在的模型分片文件名。 */
	const actualShards = readdirSync(providersDir)
		.filter((entry) => entry.endsWith(".models.ts"))
		.sort();
	if (!sameStrings(expectedShards, actualShards)) {
		throw new Error(
			`Generated model aggregator and provider shards do not match (${describeSetDifference(expectedShards, actualShards)})`,
		);
	}

	return sortedRecord(
		providerIds.map((providerId) => [
			providerId,
			readProviderStructure(join(dataDir, `${providerId}.json`), providerId),
		]),
	);
}

/** 对模型结构做稳定排序后计算哈希。返回 SHA-256 摘要。示例：modelDataStructureHash(structure)。 */
export function modelDataStructureHash(structure: ModelDataStructure): string {
	/** 提供商和模型两级均按键排序的规范结构。 */
	const normalized = sortedRecord(
		Object.entries(structure).map(
			([providerId, models]) => [providerId, sortedRecord(Object.entries(models))] as const,
		),
	);
	return sha256(JSON.stringify(normalized));
}

/** 创建带结构哈希和逐文件哈希的数据清单。返回可序列化的清单对象。示例：createModelDataManifest(structure, files, now)。 */
export function createModelDataManifest(
	structure: ModelDataStructure,
	fileContents: Readonly<Record<string, string>>,
	generatedAt: string,
): ModelDataManifest {
	return {
		schemaVersion: MODEL_DATA_SCHEMA_VERSION,
		generatedAt,
		structureHash: modelDataStructureHash(structure),
		files: sortedRecord(Object.entries(fileContents).map(([file, content]) => [file, sha256(content)] as const)),
	};
}

/** 校验单个模型对象的身份、API、能力、上下文和费用字段；错误追加到 errors，无返回值。示例：validateModelValue(model, providerId, modelId, api, errors)。 */
function validateModelValue(
	value: unknown,
	providerId: string,
	modelId: string,
	expectedApi: string,
	errors: string[],
): void {
	/** 用于错误消息的“提供商/模型”可读标签。 */
	const label = `${providerId}/${modelId}`;
	if (!isRecord(value)) {
		errors.push(`${label} must be an object`);
		return;
	}
	if (value.id !== modelId) errors.push(`${label} has id ${JSON.stringify(value.id)}, expected ${JSON.stringify(modelId)}`);
	if (value.provider !== providerId) {
		errors.push(`${label} has provider ${JSON.stringify(value.provider)}, expected ${JSON.stringify(providerId)}`);
	}
	if (value.api !== expectedApi) {
		errors.push(`${label} has api ${JSON.stringify(value.api)}, expected ${JSON.stringify(expectedApi)}`);
	}
	if (typeof value.name !== "string" || value.name.length === 0) errors.push(`${label} has no model name`);
	if (typeof value.baseUrl !== "string") errors.push(`${label} has no baseUrl string`);
	if (typeof value.reasoning !== "boolean") errors.push(`${label} has no reasoning boolean`);
	if (
		!Array.isArray(value.input) ||
		value.input.length === 0 ||
		value.input.some((entry) => entry !== "text" && entry !== "image")
	) {
		errors.push(`${label} has invalid input modalities`);
	}
	if (typeof value.contextWindow !== "number" || !Number.isFinite(value.contextWindow) || value.contextWindow <= 0) {
		errors.push(`${label} has invalid contextWindow`);
	}
	if (typeof value.maxTokens !== "number" || !Number.isFinite(value.maxTokens) || value.maxTokens <= 0) {
		errors.push(`${label} has invalid maxTokens`);
	}
	if (!isRecord(value.cost)) {
		errors.push(`${label} has invalid cost metadata`);
	} else {
		for (const field of ["input", "output", "cacheRead", "cacheWrite"] as const) {
			/** 当前费用维度的数值候选。 */
			const cost = value.cost[field];
			if (typeof cost !== "number" || !Number.isFinite(cost)) {
				errors.push(`${label} has invalid cost.${field}`);
			}
		}
	}
}

/** 将校验错误压缩为单个异常并抛出；函数不会返回。示例：throwValidationErrors(errors)。 */
function throwValidationErrors(errors: string[]): never {
	/** 为避免错误消息过长而展示的前 30 条。 */
	const visible = errors.slice(0, 30);
	/** 被省略错误的数量提示。 */
	const suffix = errors.length > visible.length ? `\n  ... and ${errors.length - visible.length} more` : "";
	throw new Error(`Invalid generated model data:\n${visible.map((error) => `  - ${error}`).join("\n")}${suffix}`);
}

/** 校验数据目录、清单哈希和每个模型字段。发现问题时统一抛出，无返回值。示例：validateModelDataDirectory(structure, dataDir)。 */
export function validateModelDataDirectory(structure: ModelDataStructure, dataDir: string): void {
	if (!existsSync(dataDir) || !statSync(dataDir).isDirectory()) {
		throw new Error(`Generated model data directory does not exist: ${dataDir}`);
	}

	/** 本轮验证累计的全部错误。 */
	const errors: string[] = [];
	/** 根据结构推导出的期望 JSON 文件名。 */
	const expectedFiles = Object.keys(structure)
		.map((providerId) => `${providerId}.json`)
		.sort();
	/** 数据目录中实际的提供商 JSON 文件名。 */
	const actualFiles = readdirSync(dataDir)
		.filter((entry) => entry.endsWith(".json") && entry !== MODEL_DATA_MANIFEST_FILE)
		.sort();
	if (!sameStrings(expectedFiles, actualFiles)) {
		errors.push(`provider data files do not match the generated catalog (${describeSetDifference(expectedFiles, actualFiles)})`);
	}

	/** 模型数据清单的完整路径。 */
	const manifestPath = join(dataDir, MODEL_DATA_MANIFEST_FILE);
	/** 解析后的清单对象，格式错误时为 undefined。 */
	const manifest = readJsonObject(manifestPath, "model data manifest", errors);
	if (manifest?.schemaVersion !== MODEL_DATA_SCHEMA_VERSION) {
		errors.push(
			`model data schema is ${JSON.stringify(manifest?.schemaVersion)}, expected ${MODEL_DATA_SCHEMA_VERSION}`,
		);
	}
	if (typeof manifest?.generatedAt !== "string" || Number.isNaN(Date.parse(manifest.generatedAt))) {
		errors.push("model data manifest has an invalid generation timestamp");
	}
	/** 由当前生成结构计算出的期望哈希。 */
	const expectedStructureHash = modelDataStructureHash(structure);
	if (manifest?.structureHash !== expectedStructureHash) {
		errors.push("model data generation stamp does not match the generated catalog");
	}
	/** 清单中的逐文件哈希对象。 */
	const manifestFiles = isRecord(manifest?.files) ? manifest.files : undefined;
	if (!manifestFiles) errors.push("model data manifest has no file hashes");
	else {
		/** 清单实际记录的文件名。 */
		const manifestFileNames = Object.keys(manifestFiles).sort();
		if (!sameStrings(expectedFiles, manifestFileNames)) {
			errors.push(`manifest file hashes do not match provider data files (${describeSetDifference(expectedFiles, manifestFileNames)})`);
		}
	}

	for (const [providerId, expectedModels] of Object.entries(structure)) {
		/** 当前提供商的数据文件名。 */
		const filename = `${providerId}.json`;
		/** 当前提供商数据文件的完整路径。 */
		const path = join(dataDir, filename);
		if (!existsSync(path)) continue;
		/** 当前文件原文，用于验证清单哈希。 */
		const content = readFileSync(path, "utf8");
		if (manifestFiles && manifestFiles[filename] !== sha256(content)) {
			errors.push(`${filename} does not match its manifest hash`);
		}
		/** 当前文件解析出的 API 分组对象。 */
		const groups = readJsonObject(path, filename, errors);
		if (!groups) continue;

		/** 实际模型 ID 到 API 分组的映射。 */
		const actualModels = new Map<string, string>();
		for (const [api, value] of Object.entries(groups)) {
			if (!isRecord(value)) {
				errors.push(`${filename} API group ${JSON.stringify(api)} must be an object`);
				continue;
			}
			for (const [modelId, model] of Object.entries(value)) {
				if (actualModels.has(modelId)) {
					errors.push(`${providerId}/${modelId} appears in more than one API group`);
					continue;
				}
				actualModels.set(modelId, api);
				validateModelValue(model, providerId, modelId, api, errors);
			}
		}

		/** 当前提供商期望的模型 ID 列表。 */
		const expectedModelIds = Object.keys(expectedModels).sort();
		/** 当前提供商文件实际包含的模型 ID 列表。 */
		const actualModelIds = Array.from(actualModels.keys()).sort();
		if (!sameStrings(expectedModelIds, actualModelIds)) {
			errors.push(`${filename} model IDs do not match the generated catalog (${describeSetDifference(expectedModelIds, actualModelIds)})`);
		}
		for (const [modelId, expectedApi] of Object.entries(expectedModels)) {
			/** 当前模型在 JSON 中实际所属的 API。 */
			const actualApi = actualModels.get(modelId);
			if (actualApi !== undefined && actualApi !== expectedApi) {
				errors.push(
					`${providerId}/${modelId} is grouped under API ${JSON.stringify(actualApi)}, expected ${JSON.stringify(expectedApi)}`,
				);
			}
		}
	}

	if (errors.length > 0) throwValidationErrors(errors);
}

/** 从包根目录读取生成结构并验证标准数据目录。无返回值。示例：validateGeneratedModelData(packageRoot)。 */
export function validateGeneratedModelData(packageRoot: string): void {
	/** 从生成 TypeScript 和 JSON 文件建立的期望结构。 */
	const structure = readModelDataStructure(packageRoot);
	validateModelDataDirectory(structure, join(packageRoot, "src", "providers", "data"));
}
/**
 * 文件职责：读取、生成并验证模型目录的数据结构、清单哈希和提供商 JSON 分片。
 * 技术维度：使用 Node.js 文件 API、SHA-256、正则提取生成代码导入以及运行时结构守卫完成一致性校验。
 * 产品维度：保证发布包中的模型清单完整且未过期，避免用户看到缺失、重复或字段错误的模型配置。
 * 逻辑维度：先从生成聚合文件确定提供商，再读取 JSON 结构、计算稳定哈希，最后逐文件校验清单和模型字段。
 * 关键边界：依赖生成文件的固定导入格式；只接受 JSON 对象；发现任一错误会汇总后抛出，最多展示前 30 条。
 * 新手阅读建议：先看 ModelDataManifest 与 readModelDataStructure，再看 createModelDataManifest，最后跟读 validateModelDataDirectory。
 */
