/**
 * 【文件职责】时间有序的 UUIDv7 生成器：在 48 位毫秒时间戳基础上加入 14 位序列号与随机位，
 *              保证 ID 单调递增、跨进程低碰撞，同时可排序。
 * 【技术维度】手写 UUIDv7 位布局（RFC 9562）；Crypto.getRandomValues 或 Math.random 兜底；
 *              模块级时间/序列状态。
 * 【产品维度】为会话、条目、请求等提供稳定可排序的唯一 ID，是树形会话与日志排序的基础。
 * 【逻辑维度】fillRandomBytes 取随机 → 与上一时间戳比较决定序列号 → 组装 16 字节 → 转十六进制。
 * 【关键边界】同一毫秒内序列号回绕时时间戳自增；crypto 不可用时退化为 Math.random
 *              （碰撞概率略升，仍可用于非安全场景）。
 * 【新手阅读建议】先理解"时间戳+序列+随机"三段式布局，再读 fillRandomBytes 的降级分支即可。
 */

// 上一个时间戳（用于序列号推进）
let lastTimestamp = -Infinity;
// 当前毫秒内的序列号
let sequence = 0;

// 填充随机字节（私有）：优先 Web Crypto，否则用 Math.random 兜底
function fillRandomBytes(bytes: Uint8Array<ArrayBuffer>): void {
	if (globalThis.crypto?.getRandomValues) {
		globalThis.crypto.getRandomValues(bytes);
		return;
	}
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Math.floor(Math.random() * 256);
	}
}

/** Generate a time-ordered UUIDv7. */
// 生成时间有序的 UUIDv7（公开）：返回标准 8-4-4-4-12 格式字符串
export function uuidv7(): string {
	// 16 字节随机种子（其中前 6 字节被时间戳覆盖）
	const random = new Uint8Array(16);
	fillRandomBytes(random);
	const timestamp = Date.now();

	// 时间前进则重置序列号；否则自增（回绕时推进时间戳）
	if (timestamp > lastTimestamp) {
		sequence = random[6] * 0x1000000 + random[7] * 0x10000 + random[8] * 0x100 + random[9];
		lastTimestamp = timestamp;
	} else {
		sequence = (sequence + 1) >>> 0;
		if (sequence === 0) lastTimestamp++;
	}

	// 组装 16 字节：前 6 字节为 48 位毫秒时间戳
	const bytes = new Uint8Array(16);
	bytes[0] = (lastTimestamp / 0x10000000000) & 0xff;
	bytes[1] = (lastTimestamp / 0x100000000) & 0xff;
	bytes[2] = (lastTimestamp / 0x1000000) & 0xff;
	bytes[3] = (lastTimestamp / 0x10000) & 0xff;
	bytes[4] = (lastTimestamp / 0x100) & 0xff;
	bytes[5] = lastTimestamp & 0xff;
	// 第 7 字节高位为版本号 7，第 9 字节高位为变体 10
	bytes[6] = 0x70 | ((sequence >>> 28) & 0x0f);
	bytes[7] = (sequence >>> 20) & 0xff;
	bytes[8] = 0x80 | ((sequence >>> 14) & 0x3f);
	bytes[9] = (sequence >>> 6) & 0xff;
	// 其余为随机位
	bytes[10] = ((sequence & 0x3f) << 2) | (random[10] & 0x03);
	bytes[11] = random[11];
	bytes[12] = random[12];
	bytes[13] = random[13];
	bytes[14] = random[14];
	bytes[15] = random[15];

	// 转标准十六进制格式
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
