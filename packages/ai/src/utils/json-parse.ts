import { parse as partialParse } from "partial-json";

/**
 * 【文件职责】JSON 容错解析工具：修复畸形 JSON（字符串内未转义控制字符、非法转义），
 *              并支持流式场景下"尽力解析不完整 JSON"。
 * 【技术维度】手写字符串状态机修复器；partial-json 库做不完整 JSON 解析；多级回退。
 * 【产品维度】容忍模型输出中常见的 JSON 格式瑕疵，让工具参数/结构数据可靠落地。
 * 【逻辑维度】repairJson 修复 → parseJsonWithRepair 先标准解析失败再修复重试 →
 *              parseStreamingJson 多级回退（修复 → partial-json → 修复+partial-json）。
 * 【关键边界】修复器只处理字符串内部问题；流式解析永远返回对象（最坏空对象）；
 *              非法 \u 序列按普通反斜杠处理。
 * 【新手阅读建议】先读 repairJson 的状态机 → 再看 parseStreamingJson 的回退链。
 */
// 合法 JSON 转义字符集合
const VALID_JSON_ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);

// 是否控制字符（私有）：码点在 0x00-0x1F 范围
function isControlCharacter(char: string): boolean {
	const codePoint = char.codePointAt(0);
	return codePoint !== undefined && codePoint >= 0x00 && codePoint <= 0x1f;
}

// 把控制字符转义为合法 JSON 形式（私有）：常用字符用简写，其余用 \uXXXX
function escapeControlCharacter(char: string): string {
	switch (char) {
		case "\b":
			return "\\b";
		case "\f":
			return "\\f";
		case "\n":
			return "\\n";
		case "\r":
			return "\\r";
		case "\t":
			return "\\t";
		default:
			return `\\u${char.codePointAt(0)?.toString(16).padStart(4, "0") ?? "0000"}`;
	}
}

/**
 * Repairs malformed JSON string literals by:
 * - escaping raw control characters inside strings
 * - doubling backslashes before invalid escape characters
 */
/**
 * 修复畸形 JSON（公开）：字符串内部的原始控制字符转义；
 * 反斜杠后跟非法转义字符时把反斜杠加倍（保留字面反斜杠）。
 */
export function repairJson(json: string): string {
	let repaired = "";
	let inString = false;

	for (let index = 0; index < json.length; index++) {
		const char = json[index];

		if (!inString) {
			repaired += char;
			if (char === '"') {
				inString = true;
			}
			continue;
		}

		if (char === '"') {
			repaired += char;
			inString = false;
			continue;
		}

		if (char === "\\") {
		// 遇到反斜杠：检查后继是否构成合法转义
			const nextChar = json[index + 1];
			if (nextChar === undefined) {
				repaired += "\\\\";
				continue;
			}

			if (nextChar === "u") {
			// \u 序列：校验 4 位十六进制
				const unicodeDigits = json.slice(index + 2, index + 6);
				if (/^[0-9a-fA-F]{4}$/.test(unicodeDigits)) {
					repaired += `\\u${unicodeDigits}`;
					index += 5;
					continue;
				}
			}

			if (VALID_JSON_ESCAPES.has(nextChar)) {
			// 合法转义：保留
				repaired += `\\${nextChar}`;
				index += 1;
				continue;
			}

			repaired += "\\\\";
			continue;
		}

		repaired += isControlCharacter(char) ? escapeControlCharacter(char) : char;
	}

	return repaired;
}

// 带修复的 JSON 解析（公开）：标准解析失败且修复后不同则重试；仍失败抛原错误
export function parseJsonWithRepair<T>(json: string): T {
	try {
		return JSON.parse(json) as T;
	} catch (error) {
		const repairedJson = repairJson(json);
		if (repairedJson !== json) {
			return JSON.parse(repairedJson) as T;
		}
		throw error;
	}
}

/**
 * Attempts to parse potentially incomplete JSON during streaming.
 * Always returns a valid object, even if the JSON is incomplete.
 *
 * @param partialJson The partial JSON string from streaming
 * @returns Parsed object or empty object if parsing fails
 */
// 流式 JSON 解析（公开）：多级回退尽力返回对象；彻底失败返回空对象
export function parseStreamingJson<T = Record<string, unknown>>(partialJson: string | undefined): T {
	if (!partialJson || partialJson.trim() === "") {
		return {} as T;
	// 空输入返回空对象
	}

	try {
		return parseJsonWithRepair<T>(partialJson);
	} catch {
		try {
			const result = partialParse(partialJson);
			return (result ?? {}) as T;
		} catch {
			try {
				const result = partialParse(repairJson(partialJson));
				return (result ?? {}) as T;
			} catch {
				return {} as T;
			}
		}
	}
}
