#!/usr/bin/env node
/**
 * 文件职责：校验生成的模型目录包，将不可变版本分片和可变索引发布到 S3 兼容对象存储。
 * 技术维度：使用 Node.js ESM、SHA-256、同步文件系统、AWS CLI、深度相等校验和语义版本排序。
 * 产品维度：为 pi 客户端提供可回滚、按最低客户端版本选择的远程模型目录，并防止发布不完整数据。
 * 逻辑维度：解析参数，校验 models/providers 分片，计算 revision，读取旧索引，上传分片后最后更新索引。
 * 关键边界：非 dry-run 会写远端对象；索引必须最后上传；模型数和必需提供商不足会拒绝发布。
 * 新手阅读建议：先看 main 的发布顺序，再读 validateBundle 的安全门，最后理解 buildIndex 的版本替换规则。
 */

import { createHash } from "node:crypto";
import {
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

/** 远程目录索引结构版本。 */
const CATALOG_SCHEMA_VERSION = 1;
/** 当前结构版本的对象键前缀。 */
const CATALOG_PREFIX = `models/v${CATALOG_SCHEMA_VERSION}`;
/** 可变目录索引对象键。 */
const CATALOG_INDEX_KEY = `${CATALOG_PREFIX}/index.json`;
// Bump this only when generated model metadata requires behavior unavailable in older pi clients.
// 只有模型元数据依赖旧客户端不具备的行为时才提高最低版本。
/** 能消费本目录元数据的最低 pi 版本。 */
const MINIMUM_PI_VERSION = "0.80.7";
/** 上传 JSON 对象使用的内容类型。 */
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
/** revision 分片的一年不可变缓存策略。 */
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
/** 可变 index.json 禁止缓存。 */
const INDEX_CACHE_CONTROL = "no-store";
/** 发布包必须包含的核心提供商。 */
const REQUIRED_PROVIDERS = ["anthropic", "openai", "openrouter"];
/** 防止错误发布空目录的最低模型数。 */
const MINIMUM_MODEL_COUNT = 500;

/**
 * 解析发布命令参数并验证必填项。
 * @param {string[]} args 命令行参数。
 * @returns {{input:string,bucket?:string,endpoint?:string,sourceCommit?:string,dryRun:boolean}} 发布选项。
 */
function parseArgs(args) {
	/** 逐项填充的发布选项。 */
	const options = {
		input: undefined,
		bucket: undefined,
		endpoint: undefined,
		sourceCommit: undefined,
		dryRun: false,
	};

	for (let index = 0; index < args.length; index++) {
		/** 当前参数。 */
		const arg = args[index];
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (arg === "--input" || arg === "--bucket" || arg === "--endpoint" || arg === "--source-commit") {
			/** 需要值的参数对应值。 */
			const value = args[++index];
			if (!value) throw new Error(`${arg} requires a value`);
			options[
				{
					"--input": "input",
					"--bucket": "bucket",
					"--endpoint": "endpoint",
					"--source-commit": "sourceCommit",
				}[arg]
			] = value;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (!options.input) throw new Error("--input is required");
	if (!options.dryRun && !options.bucket) throw new Error("--bucket is required when publishing");
	if (!options.dryRun && !options.endpoint) throw new Error("--endpoint is required when publishing");
	return options;
}

/**
 * 读取并解析 JSON 文件。
 * @param {string} path 文件路径。
 * @returns {unknown} JSON 值。
 */
function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * 完整校验模型目录包并计算内容 revision。
 * @param {string} inputDir 生成目录根路径。
 * @returns {object} 发布所需路径、计数和 SHA-256 revision。
 */
function validateBundle(inputDir) {
	/** 完整模型目录路径。 */
	const modelsPath = join(inputDir, "models.json");
	/** 提供商索引路径。 */
	const providerIndexPath = join(inputDir, "providers.json");
	/** 提供商分片目录。 */
	const providersDir = join(inputDir, "providers");
	/** models.json 原始字节，用于解析和摘要。 */
	const modelsBytes = readFileSync(modelsPath);
	/** 完整提供商到模型映射。 */
	const models = JSON.parse(modelsBytes.toString("utf8"));
	/** providers.json 中的排序提供商标识。 */
	const providerIds = readJson(providerIndexPath);

	if (typeof models !== "object" || models === null || Array.isArray(models)) {
		throw new Error("models.json must contain an object");
	}
	if (!Array.isArray(providerIds) || !providerIds.every((value) => typeof value === "string")) {
		throw new Error("providers.json must contain an array of provider IDs");
	}

	/** 从完整模型对象推导的期望提供商顺序。 */
	const expectedProviderIds = Object.keys(models).sort();
	if (!isDeepStrictEqual(providerIds, expectedProviderIds)) {
		throw new Error("providers.json does not match the sorted providers in models.json");
	}
	/** providerId 是必须存在的提供商标识；循环逐一确认聚合目录没有漏项。 */
	for (const providerId of REQUIRED_PROVIDERS) {
		if (!Object.hasOwn(models, providerId)) throw new Error(`Required provider is missing: ${providerId}`);
	}

	/** 跨所有提供商累计的模型数量。 */
	let modelCount = 0;
	for (const providerId of providerIds) {
		/** 当前提供商在 models.json 中的模型映射。 */
		const providerModels = models[providerId];
		if (typeof providerModels !== "object" || providerModels === null || Array.isArray(providerModels)) {
			throw new Error(`Provider catalog must be an object: ${providerId}`);
		}
		/** 当前提供商分片文件内容。 */
		const providerFile = readJson(join(providersDir, `${providerId}.json`));
		if (!isDeepStrictEqual(providerFile, providerModels)) {
			throw new Error(`Provider shard does not match models.json: ${providerId}`);
		}
		/** modelId 和 model 是当前分片中的模型标识与目录记录，用于执行字段级校验。 */
		for (const [modelId, model] of Object.entries(providerModels)) {
			if (
				typeof model !== "object" ||
				model === null ||
				Array.isArray(model) ||
				model.id !== modelId ||
				model.provider !== providerId
			) {
				throw new Error(`Invalid model entry: ${providerId}/${modelId}`);
			}
			modelCount++;
		}
	}

	/** 磁盘上实际存在的提供商分片文件。 */
	const shardFiles = readdirSync(providersDir).filter((name) => name.endsWith(".json")).sort();
	/** providers.json 推导的期望分片文件。 */
	const expectedShardFiles = providerIds.map((providerId) => `${providerId}.json`).sort();
	if (!isDeepStrictEqual(shardFiles, expectedShardFiles)) {
		throw new Error("Provider shard files do not match providers.json");
	}
	if (modelCount < MINIMUM_MODEL_COUNT) {
		throw new Error(`Refusing to publish only ${modelCount} models; expected at least ${MINIMUM_MODEL_COUNT}`);
	}

	/** models.json 原始字节的 SHA-256 十六进制摘要。 */
	const digest = createHash("sha256").update(modelsBytes).digest("hex");
	return {
		modelsPath,
		providerIndexPath,
		providersDir,
		providerIds,
		providerCount: providerIds.length,
		modelCount,
		revision: `sha256-${digest}`,
	};
}

/**
 * 读取当前 Git HEAD 提交标识。
 * @returns {string} 完整提交哈希。
 */
function gitSourceCommit() {
	/** git rev-parse 同步执行结果。 */
	const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
	if (result.status !== 0) throw new Error(`Unable to determine source commit: ${result.stderr.trim()}`);
	return result.stdout.trim();
}

/**
 * 执行 AWS CLI，并可将对象不存在视为 false。
 * @param {string[]} args aws 参数。
 * @param {{allowNotFound?:boolean}} options 是否允许 404/NoSuchKey。
 * @returns {boolean} 成功为 true，允许的不存在为 false。
 */
function aws(args, { allowNotFound = false } = {}) {
	/** 注入非交互 AWS 环境后的同步执行结果。 */
	const result = spawnSync("aws", args, {
		encoding: "utf8",
		env: {
			...process.env,
			AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || "auto",
			AWS_EC2_METADATA_DISABLED: "true",
		},
	});
	if (result.error) throw result.error;
	if (result.status === 0) return true;
	/** AWS 标准输出与错误输出合并文本。 */
	const message = `${result.stdout}\n${result.stderr}`.trim();
	if (allowNotFound && /(?:404|NoSuchKey|Not Found)/i.test(message)) return false;
	throw new Error(`aws ${args.slice(0, 2).join(" ")} failed:\n${message}`);
}

/** 从对象存储下载当前索引。 */
function downloadIndex(bucket, endpoint, outputPath) {
	return aws(
		[
			"s3",
			"cp",
			`s3://${bucket}/${CATALOG_INDEX_KEY}`,
			outputPath,
			"--endpoint-url",
			endpoint,
			"--only-show-errors",
		],
		{ allowNotFound: true },
	);
}

/** 上传带明确内容类型和缓存策略的 JSON 对象。 */
function uploadJson(bucket, endpoint, sourcePath, key, cacheControl) {
	aws([
		"s3",
		"cp",
		sourcePath,
		`s3://${bucket}/${key}`,
		"--endpoint-url",
		endpoint,
		"--content-type",
		JSON_CONTENT_TYPE,
		"--cache-control",
		cacheControl,
		"--only-show-errors",
	]);
}

/** 校验已有远程索引的结构和每个目录条目。 */
function validateIndex(index) {
	if (
		typeof index !== "object" ||
		index === null ||
		Array.isArray(index) ||
		index.schemaVersion !== CATALOG_SCHEMA_VERSION
	) {
		throw new Error(`Existing ${CATALOG_INDEX_KEY} has an unsupported schema`);
	}
	if (!Array.isArray(index.catalogs)) throw new Error(`Existing ${CATALOG_INDEX_KEY} has no catalogs array`);
	/** catalog 是索引中的当前历史目录记录；每项都必须符合既定对象结构。 */
	for (const catalog of index.catalogs) {
		if (
			typeof catalog !== "object" ||
			catalog === null ||
			Array.isArray(catalog) ||
			typeof catalog.minimumPiVersion !== "string" ||
			typeof catalog.revision !== "string"
		) {
			throw new Error(`Existing ${CATALOG_INDEX_KEY} contains an invalid catalog entry`);
		}
	}
	return index;
}

/**
 * 比较点分数字版本，非数字相等时用原文本兜底。
 * @param {string} left 左版本。
 * @param {string} right 右版本。
 * @returns {number} 排序差值。
 */
function comparePiVersions(left, right) {
	/** 左版本数字段。 */
	const leftParts = left.split(".").map(Number);
	/** 右版本数字段。 */
	const rightParts = right.split(".").map(Number);
	for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index++) {
		/** 当前版本位差值。 */
		const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
		if (difference !== 0) return difference;
	}
	return left.localeCompare(right);
}

/**
 * 用本次 publication 替换同最低版本条目并构造新索引。
 * @param {object|undefined} existingIndex 现有远程索引。
 * @param {object} publication 本次发布元数据。
 * @returns {object} 下一版索引。
 */
function buildIndex(existingIndex, publication) {
	/** 本次最低客户端版本对应的目录条目。 */
	const entry = {
		minimumPiVersion: MINIMUM_PI_VERSION,
		revision: publication.revision,
		sourceCommit: publication.sourceCommit,
		publishedAt: new Date().toISOString(),
		providerCount: publication.providerCount,
		modelCount: publication.modelCount,
	};
	/** 去掉同版本旧条目、加入新条目并按版本排序的目录列表。 */
	const catalogs = (existingIndex?.catalogs || [])
		.filter((catalog) => catalog.minimumPiVersion !== MINIMUM_PI_VERSION)
		.concat(entry)
		.sort((left, right) => comparePiVersions(left.minimumPiVersion, right.minimumPiVersion));
	return {
		schemaVersion: CATALOG_SCHEMA_VERSION,
		defaultRevision: publication.revision,
		catalogs,
	};
}

/** 执行校验、dry-run 或安全的分片后索引发布流程。 */
async function main() {
	/** 已校验的命令选项。 */
	const options = parseArgs(process.argv.slice(2));
	/** 绝对输入目录。 */
	const inputDir = resolve(options.input);
	/** 完整校验后的目录包信息。 */
	const bundle = validateBundle(inputDir);
	/** 写入 publication.json 并加入远程索引的发布元数据。 */
	const publication = {
		schemaVersion: CATALOG_SCHEMA_VERSION,
		minimumPiVersion: MINIMUM_PI_VERSION,
		revision: bundle.revision,
		sourceCommit: options.sourceCommit || gitSourceCommit(),
		providerCount: bundle.providerCount,
		modelCount: bundle.modelCount,
	};
	writeFileSync(join(inputDir, "publication.json"), `${JSON.stringify(publication, null, 2)}\n`);

	console.log(JSON.stringify(publication, null, 2));
	if (options.dryRun) {
		console.log(`Validated model catalog at ${inputDir}; no objects uploaded.`);
		return;
	}

	/** 下载旧索引和构造新索引使用的临时目录。 */
	const temporaryDir = mkdtempSync(join(tmpdir(), "pi-model-catalog-"));
	try {
		/** 当前远程索引下载路径。 */
		const currentIndexPath = join(temporaryDir, "index-current.json");
		/** 远程索引对象是否存在。 */
		const hasCurrentIndex = downloadIndex(options.bucket, options.endpoint, currentIndexPath);
		/** 已校验的当前远程索引。 */
		const currentIndex = hasCurrentIndex ? validateIndex(readJson(currentIndexPath)) : undefined;
		/** 当前最低 pi 版本对应的目录条目。 */
		const currentEntry = currentIndex?.catalogs.find(
			(catalog) => catalog.minimumPiVersion === MINIMUM_PI_VERSION,
		);
		if (currentIndex?.defaultRevision === bundle.revision && currentEntry?.revision === bundle.revision) {
			console.log(`Model catalog ${bundle.revision} is already current; no objects uploaded.`);
			return;
		}

		/** 本次 revision 的不可变对象前缀。 */
		const revisionPrefix = `${CATALOG_PREFIX}/revisions/${bundle.revision}`;
		uploadJson(options.bucket, options.endpoint, bundle.modelsPath, `${revisionPrefix}/models.json`, IMMUTABLE_CACHE_CONTROL);
		uploadJson(
			options.bucket,
			options.endpoint,
			bundle.providerIndexPath,
			`${revisionPrefix}/providers.json`,
			IMMUTABLE_CACHE_CONTROL,
		);
		/** providerId 是当前待上传的提供商分片标识，路径与汇总清单保持一致。 */
		for (const providerId of bundle.providerIds) {
			uploadJson(
				options.bucket,
				options.endpoint,
				join(bundle.providersDir, `${providerId}.json`),
				`${revisionPrefix}/providers/${providerId}.json`,
				IMMUTABLE_CACHE_CONTROL,
			);
		}

		/** 包含本次 publication 的下一版索引。 */
		const nextIndex = buildIndex(currentIndex, publication);
		/** 待上传的新索引临时文件。 */
		const nextIndexPath = join(temporaryDir, "index-next.json");
		writeFileSync(nextIndexPath, `${JSON.stringify(nextIndex, null, 2)}\n`);
		uploadJson(options.bucket, options.endpoint, nextIndexPath, CATALOG_INDEX_KEY, INDEX_CACHE_CONTROL);
		console.log(`Published ${bundle.revision} to s3://${options.bucket}/${revisionPrefix}`);
	} finally {
		rmSync(temporaryDir, { recursive: true, force: true });
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
