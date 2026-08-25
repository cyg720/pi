/**
 * 文件职责：验证生成模型数据目录的聚合器、分片、清单哈希、Schema 版本和生成时间保持一致。
 * 技术维度：使用 Vitest、临时文件树和真实 model-data 脚本构造可控模型分片与 manifest。
 * 产品维度：防止发布包携带缺失、过期、重复或字段错配的模型目录，避免运行时展示错误模型信息。
 * 逻辑维度：创建一套最小合法夹具，再逐项破坏目录、字段、API 分组、哈希、版本、时间和分片匹配关系。
 * 关键边界：夹具模拟自动生成文件但只存在临时目录；每个用例后必须清理；manifest 必须与内容逐字匹配。
 * 新手阅读建议：先看 createFixture/writeFixtureData 的合法结构，再观察每个用例只改变一个不变量。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	createModelDataManifest,
	MODEL_DATA_MANIFEST_FILE,
	MODEL_DATA_SCHEMA_VERSION,
	type ModelDataStructure,
	readModelDataStructure,
	validateModelDataDirectory,
} from "../scripts/model-data.ts";

// GENERATED_AT 是合法 manifest 使用的固定 ISO 生成时间。
const GENERATED_AT = "2026-07-23T10:00:00.000Z";
// temporaryRoots 收集测试创建的包根目录，便于统一清理。
const temporaryRoots: string[] = [];

// 每个用例后删除全部临时模型数据树。
afterEach(() => {
	/** root 是当前待删除的临时目录；数组会在遍历前被原地清空。 */
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

/**
 * 创建包含聚合器、单个提供商分片、数据 JSON 和清单的合法临时包。
 * @returns 关键路径、结构和模型值；例如 `const fixture = createFixture()`。
 */
function createFixture(): {
	dataDir: string;
	packageRoot: string;
	structure: ModelDataStructure;
	values: Record<string, unknown>;
} {
	// packageRoot 是模拟 packages/ai 的临时根目录。
	const packageRoot = mkdtempSync(join(tmpdir(), "pi-model-data-"));
	temporaryRoots.push(packageRoot);
	// providersDir 是模拟源码提供商目录。
	const providersDir = join(packageRoot, "src", "providers");
	// dataDir 是生成 JSON 数据和清单目录。
	const dataDir = join(providersDir, "data");
	mkdirSync(dataDir, { recursive: true });
	writeFileSync(
		join(packageRoot, "src", "models.generated.ts"),
		'import { TEST_PROVIDER_MODELS } from "./providers/test-provider.models.ts";\n',
	);
	writeFileSync(
		join(providersDir, "test-provider.models.ts"),
		'import values from "./data/test-provider.json" with { type: "json" };\nimport { flattenModelCatalog, type ModelCatalog } from "../model-catalog.ts";\n\nexport const TEST_PROVIDER_MODELS: ModelCatalog<typeof values, "test-provider"> =\n\tflattenModelCatalog("test-provider", values);\n',
	);

	// structure 描述聚合器中 provider/model 到 API 的期望关系。
	const structure: ModelDataStructure = {
		"test-provider": {
			"model-a": "openai-completions",
		},
	};
	// values 是 test-provider.json 中的完整模型数据。
	const values: Record<string, unknown> = {
		"model-a": {
			id: "model-a",
			name: "Model A",
			api: "openai-completions",
			provider: "test-provider",
			baseUrl: "https://example.test/v1",
			reasoning: false,
			input: ["text"],
			cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 1000,
			maxTokens: 100,
		},
	};
	writeFixtureData(dataDir, structure, values);
	return { dataDir, packageRoot, structure, values };
}

/**
 * 把模型值和对应 manifest 写入夹具数据目录。
 * @param dataDir 目标 data 目录。
 * @param structure 期望模型结构。
 * @param values 模型 ID 到元数据的映射。
 * @param manifestSchemaVersion 清单 Schema 版本，默认当前版本。
 * @param apiGroup 数据所属 API 分组。
 * @returns 无返回值；例如 `writeFixtureData(dir, structure, values)`。
 */
function writeFixtureData(
	dataDir: string,
	structure: ModelDataStructure,
	values: Record<string, unknown>,
	manifestSchemaVersion = MODEL_DATA_SCHEMA_VERSION,
	apiGroup = "openai-completions",
): void {
	// filename 是夹具唯一提供商数据分片名。
	const filename = "test-provider.json";
	// content 是按 API 分组并带末尾换行的 JSON 文本。
	const content = `${JSON.stringify({ [apiGroup]: values })}\n`;
	writeFileSync(join(dataDir, filename), content);
	// manifest 根据当前结构和文件内容生成，随后可覆盖版本制造错误。
	const manifest = createModelDataManifest(structure, { [filename]: content }, GENERATED_AT);
	manifest.schemaVersion = manifestSchemaVersion;
	writeFileSync(join(dataDir, MODEL_DATA_MANIFEST_FILE), `${JSON.stringify(manifest)}\n`);
}

// 验证生成模型数据的目录布局、内容和清单不变量。
describe("generated model data validation", () => {
	// 合法 API 分组数据应能从聚合器读取并通过目录校验。
	it("reads and validates API-grouped model data", () => {
		const { dataDir, packageRoot, structure } = createFixture();
		/** dataDir、packageRoot 和 structure 分别表示数据目录、临时包根目录与预期目录结构。 */
		expect(readModelDataStructure(packageRoot)).toEqual(structure);
		expect(() => validateModelDataDirectory(structure, dataDir)).not.toThrow();
	});

	// 数据目录缺失时应给出明确不存在错误。
	it("rejects a missing model data directory", () => {
		const { dataDir, structure } = createFixture();
		/** dataDir 是即将删除的数据目录，structure 是随后用于触发缺失目录校验的结构定义。 */
		rmSync(dataDir, { recursive: true });
		expect(() => validateModelDataDirectory(structure, dataDir)).toThrow("does not exist");
	});

	// id、provider 或 api 任一字段与目录结构不符都应拒绝。
	it.each([
		["id", "wrong-id", "has id"],
		["provider", "wrong-provider", "has provider"],
		["api", "anthropic-messages", "has api"],
	] as const)("rejects a wrong model %s", (field, value, expectedMessage) => {
		// fixture 是当前字段破坏用例的合法基础夹具。
		const fixture = createFixture();
		// model 是要修改指定字段的 model-a 数据对象。
		const model = fixture.values["model-a"] as Record<string, unknown>;
		model[field] = value;
		writeFixtureData(fixture.dataDir, fixture.structure, fixture.values);
		expect(() => validateModelDataDirectory(fixture.structure, fixture.dataDir)).toThrow(expectedMessage);
	});

	// 模型放入与结构声明不同的 API 分组时应拒绝。
	it("rejects a model in the wrong API group", () => {
		// fixture 是改写 API 分组的基础夹具。
		const fixture = createFixture();
		writeFixtureData(
			fixture.dataDir,
			fixture.structure,
			fixture.values,
			MODEL_DATA_SCHEMA_VERSION,
			"anthropic-messages",
		);
		expect(() => validateModelDataDirectory(fixture.structure, fixture.dataDir)).toThrow("grouped under API");
	});

	// 相同模型 ID 出现在多个 API 分组中会产生歧义，必须拒绝。
	it("rejects duplicate model IDs across API groups", () => {
		// fixture 是准备制造重复分组的合法夹具。
		const fixture = createFixture();
		// filename 是要覆盖的提供商数据文件。
		const filename = "test-provider.json";
		// content 把同一 values 同时放到两个 API 组。
		const content = `${JSON.stringify({
			"openai-completions": fixture.values,
			"anthropic-messages": fixture.values,
		})}\n`;
		writeFileSync(join(fixture.dataDir, filename), content);
		// manifest 与重复文件内容匹配，确保失败原因是重复 ID 而非哈希。
		const manifest = createModelDataManifest(fixture.structure, { [filename]: content }, GENERATED_AT);
		writeFileSync(join(fixture.dataDir, MODEL_DATA_MANIFEST_FILE), `${JSON.stringify(manifest)}\n`);
		expect(() => validateModelDataDirectory(fixture.structure, fixture.dataDir)).toThrow("more than one API group");
	});

	// 数据文件清空会同时造成模型缺失和 manifest 哈希过期。
	it("rejects missing model IDs and stale file hashes", () => {
		// fixture 是即将破坏数据文件的合法夹具。
		const fixture = createFixture();
		writeFileSync(join(fixture.dataDir, "test-provider.json"), "{}\n");
		expect(() => validateModelDataDirectory(fixture.structure, fixture.dataDir)).toThrow(/manifest hash|model IDs/);
	});

	// 清单 Schema 版本或结构生成戳不兼容时应拒绝。
	it("rejects incompatible schema and generation stamps", () => {
		// fixture 是用于依次破坏版本和结构哈希的夹具。
		const fixture = createFixture();
		writeFixtureData(fixture.dataDir, fixture.structure, fixture.values, MODEL_DATA_SCHEMA_VERSION + 1);
		expect(() => validateModelDataDirectory(fixture.structure, fixture.dataDir)).toThrow("model data schema");

		// manifestPath 指向待手工修改结构哈希的清单。
		const manifestPath = join(fixture.dataDir, MODEL_DATA_MANIFEST_FILE);
		// manifest 是解析后的可变清单对象。
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
		manifest.structureHash = "stale";
		writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
		expect(() => validateModelDataDirectory(fixture.structure, fixture.dataDir)).toThrow("generation stamp");
	});

	// generatedAt 必须是有效 ISO 时间。
	it("rejects an invalid generation timestamp", () => {
		// fixture 是待修改生成时间的合法夹具。
		const fixture = createFixture();
		// manifestPath 是清单文件路径。
		const manifestPath = join(fixture.dataDir, MODEL_DATA_MANIFEST_FILE);
		// manifest 是待写入非法时间的清单对象。
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
		manifest.generatedAt = "invalid";
		writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
		expect(() => validateModelDataDirectory(fixture.structure, fixture.dataDir)).toThrow("generation timestamp");
	});

	// 聚合器导入的提供商分片集合必须与实际分片一一对应。
	it("rejects missing provider shards imported by the aggregator", () => {
		const { packageRoot } = createFixture();
		/** packageRoot 是本用例临时模型包根目录，用于改写聚合器制造缺失分片。 */
		writeFileSync(
			join(packageRoot, "src", "models.generated.ts"),
			'import { TEST_PROVIDER_MODELS } from "./providers/test-provider.models.ts";\nimport { MISSING_MODELS } from "./providers/missing.models.ts";\n',
		);
		expect(() => readModelDataStructure(packageRoot)).toThrow("aggregator and provider shards do not match");
	});
});
