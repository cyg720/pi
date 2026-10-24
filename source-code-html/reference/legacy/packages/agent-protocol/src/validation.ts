import type {
	ConfigPatchRequest,
	ConfigScope,
	FileWriteRequest,
	JsonObject,
	JsonValue,
	NewSessionRequest,
	PromptImage,
	PromptRequest,
	ReplayRequest,
} from "./types.ts";

export const REQUEST_LIMITS = Object.freeze({
	jsonCharacters: 1_048_576,
	depth: 20,
	nodes: 20_000,
	objectKeys: 1_000,
	id: 128,
	name: 200,
	prompt: 131_072,
	fileContent: 524_288,
	promptJsonCharacters: 8_388_608,
	imageCharacters: 5_242_880,
	imageTotalCharacters: 7_340_032,
	imageCount: 8,
});
const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);

export class ProtocolValidationError extends Error {
	readonly code = "INVALID_REQUEST";
	readonly path: string;
	constructor(path: string, message: string) {
		super(`${path}: ${message}`);
		this.name = "ProtocolValidationError";
		this.path = path;
	}
}

function fail(path: string, message: string): never {
	throw new ProtocolValidationError(path, message);
}

/** Validate and copy untrusted input without invoking getters or retaining object references. */
export function parseJsonValue(input: unknown, maxCharacters: number = REQUEST_LIMITS.jsonCharacters): JsonValue {
	if (!Number.isSafeInteger(maxCharacters) || maxCharacters < 1 || maxCharacters > REQUEST_LIMITS.promptJsonCharacters)
		fail("$", "Invalid JSON size limit");
	let nodes = 0;
	let characters = 0;
	const ancestors = new Set<object>();
	function visit(value: unknown, path: string, depth: number): JsonValue {
		if (++nodes > REQUEST_LIMITS.nodes || depth > REQUEST_LIMITS.depth) fail(path, "JSON complexity limit exceeded");
		if (value === null || typeof value === "boolean") return value;
		if (typeof value === "string") {
			characters += value.length;
			if (characters > maxCharacters) fail(path, "JSON size limit exceeded");
			return value;
		}
		if (typeof value === "number") {
			if (!Number.isFinite(value)) fail(path, "Expected finite number");
			return value;
		}
		if (typeof value !== "object") fail(path, "Expected JSON value");
		if (ancestors.has(value)) fail(path, "Cyclic JSON value");
		const isArray = Array.isArray(value);
		if (!isArray && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
			fail(path, "Expected plain object");
		ancestors.add(value);
		const keys = Reflect.ownKeys(value);
		if (keys.length > (isArray ? REQUEST_LIMITS.nodes : REQUEST_LIMITS.objectKeys)) fail(path, "Too many entries");
		const result: JsonObject = {};
		const array: JsonValue[] = [];
		for (const key of keys) {
			if (typeof key !== "string") fail(path, "Symbol keys are not JSON");
			if (isArray && key === "length") continue;
			if (unsafeKeys.has(key)) fail(`${path}.${key}`, "Unsafe property name");
			if (isArray && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) !== array.length))
				fail(path, "Expected dense JSON array without extra properties");
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
				fail(`${path}.${key}`, "Expected enumerable data property");
			characters += key.length;
			if (characters > maxCharacters) fail(path, "JSON size limit exceeded");
			const parsed = visit(descriptor.value, `${path}.${key}`, depth + 1);
			if (isArray) array.push(parsed);
			else result[key] = parsed;
		}
		if (isArray && array.length !== value.length) fail(path, "Sparse arrays are not supported");
		ancestors.delete(value);
		return isArray ? array : result;
	}
	const result = visit(input, "$", 0);
	if (JSON.stringify(result).length > maxCharacters) fail("$", "JSON size limit exceeded");
	return result;
}

/** Call after enforcing a transport byte limit; this limit bounds decoded JSON characters. */
export function parseJsonText(text: string, maxCharacters: number = REQUEST_LIMITS.jsonCharacters): JsonValue {
	if (text.length > maxCharacters) fail("$", "JSON size limit exceeded");
	let input: unknown;
	try {
		input = JSON.parse(text);
	} catch {
		return fail("$", "Malformed JSON");
	}
	return parseJsonValue(input, maxCharacters);
}

function object(value: JsonValue | undefined, path: string): JsonObject {
	if (value === null || typeof value !== "object" || Array.isArray(value)) fail(path, "Expected object");
	return value;
}
function fields(value: JsonObject, allowed: string[], required: string[], path = "$"): void {
	for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${path}.${key}`, "Unknown field");
	for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "Required field");
}
function string(value: JsonValue | undefined, path: string, maximum: number): string {
	if (typeof value !== "string" || value.length === 0 || value.length > maximum || value.includes("\0"))
		fail(path, `Expected nonempty string of at most ${maximum} characters without NUL`);
	return value;
}
function id(value: JsonValue | undefined, path: string): string {
	const result = string(value, path, REQUEST_LIMITS.id);
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(result)) fail(path, "Invalid identifier");
	return result;
}
function revision(value: JsonValue | undefined, path: string): number {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
		fail(path, "Expected nonnegative safe integer");
	return value;
}

export function parseNewSessionRequest(input: unknown): NewSessionRequest {
	const value = object(parseJsonValue(input), "$");
	fields(value, ["workspaceId", "name"], ["workspaceId"]);
	const result: NewSessionRequest = { workspaceId: id(value.workspaceId, "$.workspaceId") };
	if (Object.hasOwn(value, "name")) result.name = string(value.name, "$.name", REQUEST_LIMITS.name);
	return result;
}
export function parsePromptRequest(input: unknown): PromptRequest {
	const value = object(parseJsonValue(input, REQUEST_LIMITS.promptJsonCharacters), "$");
	fields(value, ["text", "requestId", "images"], ["text", "requestId"]);
	if (typeof value.text !== "string" || value.text.length > REQUEST_LIMITS.prompt || value.text.includes("\0"))
		fail("$.text", "Expected bounded text without NUL");
	const text = value.text;
	const images: PromptImage[] = [];
	let total = 0;
	if (value.images !== undefined) {
		if (!Array.isArray(value.images) || value.images.length > REQUEST_LIMITS.imageCount)
			fail("$.images", "Expected at most eight images");
		for (const [index, item] of value.images.entries()) {
			const path = `$.images.${index}`;
			const image = object(item, path);
			fields(image, ["type", "mimeType", "data"], ["type", "mimeType", "data"], path);
			if (
				image.type !== "image" ||
				!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(String(image.mimeType))
			)
				fail(path, "Unsupported image type");
			const data = string(image.data, `${path}.data`, REQUEST_LIMITS.imageCharacters);
			if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data))
				fail(`${path}.data`, "Expected canonical base64, not a URL");
			total += data.length;
			if (total > REQUEST_LIMITS.imageTotalCharacters) fail("$.images", "Total image size exceeded");
			images.push({ type: "image", mimeType: image.mimeType as PromptImage["mimeType"], data });
		}
	}
	if (!text.trim() && images.length === 0) fail("$.text", "Prompt must contain text or an image");
	return { text, requestId: id(value.requestId, "$.requestId"), ...(value.images === undefined ? {} : { images }) };
}
export function parseConfigPatchRequest(input: unknown): ConfigPatchRequest {
	const value = object(parseJsonValue(input), "$");
	fields(value, ["scope", "moduleId", "revision", "values"], ["scope", "moduleId", "revision", "values"]);
	const candidate = object(value.scope, "$.scope");
	let scope: ConfigScope;
	if (candidate.kind === "global") {
		fields(candidate, ["kind"], ["kind"], "$.scope");
		scope = { kind: "global" };
	} else if (candidate.kind === "workspace" || candidate.kind === "session") {
		fields(candidate, ["kind", "id"], ["kind", "id"], "$.scope");
		scope = { kind: candidate.kind, id: id(candidate.id, "$.scope.id") };
	} else return fail("$.scope.kind", "Unknown configuration scope");
	return {
		scope,
		moduleId: id(value.moduleId, "$.moduleId"),
		revision: revision(value.revision, "$.revision"),
		values: object(value.values, "$.values"),
	};
}
export function parseFileWriteRequest(input: unknown): FileWriteRequest {
	const value = object(parseJsonValue(input), "$");
	fields(value, ["path", "content", "etag"], ["path", "content", "etag"]);
	const path = string(value.path, "$.path", 4096);
	if (
		path.startsWith("/") ||
		path.includes("\\") ||
		path.includes(":") ||
		path.split("/").some((part) => part === ".." || part === "." || !part)
	)
		fail("$.path", "Expected normalized workspace-relative path");
	if (
		typeof value.content !== "string" ||
		value.content.length > REQUEST_LIMITS.fileContent ||
		value.content.includes("\0")
	)
		fail("$.content", "Expected bounded UTF-8 text without NUL");
	return { path, content: value.content, etag: value.etag === null ? null : string(value.etag, "$.etag", 256) };
}
export function parseReplayRequest(input: unknown): ReplayRequest {
	const value = object(parseJsonValue(input), "$");
	fields(value, ["afterSeq"], ["afterSeq"]);
	return { afterSeq: revision(value.afterSeq, "$.afterSeq") };
}
