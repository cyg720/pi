/**
 * 【文件职责】HTML 工具：转义/生成 HTML 片段（导出页面/错误页用）。
 * 【新手阅读建议】半分钟读完。
 */
export interface DecodedHtmlEntity {
	text: string;
	length: number;
}

function decodeCodePoint(codePoint: number): string | undefined {
	if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
		return undefined;
	}
	return String.fromCodePoint(codePoint);
}

export function decodeHtmlEntity(entity: string): string | undefined {
	switch (entity) {
		case "amp":
			return "&";
		case "lt":
			return "<";
		case "gt":
			return ">";
		case "quot":
			return '"';
		case "apos":
			return "'";
	}

	if (entity.startsWith("#x") || entity.startsWith("#X")) {
		return decodeCodePoint(Number.parseInt(entity.slice(2), 16));
	}

	if (entity.startsWith("#")) {
		return decodeCodePoint(Number.parseInt(entity.slice(1), 10));
	}

	return undefined;
}

export function decodeHtmlEntityAt(html: string, index: number): DecodedHtmlEntity | undefined {
	const semicolonIndex = html.indexOf(";", index + 1);
	if (semicolonIndex === -1 || semicolonIndex - index > 16) {
		return undefined;
	}

	const entity = html.slice(index + 1, semicolonIndex);
	const decoded = decodeHtmlEntity(entity);
	if (decoded === undefined) {
		return undefined;
	}

	return { text: decoded, length: semicolonIndex - index + 1 };
}
