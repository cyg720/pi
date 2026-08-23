/**
 * 【文件职责】User-Agent：生成请求头中的 UA 标识。
 * 【新手阅读建议】半分钟读完。
 */
export function getPiUserAgent(version: string): string {
	const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
	return `pi/${version} (${process.platform}; ${runtime}; ${process.arch})`;
}
