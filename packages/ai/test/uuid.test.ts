/**
 * 文件职责：验证 UUIDv7 符合 RFC 9562 格式并在随机序列溢出时保持单调递增。
 * 技术维度：使用 Vitest 模拟 crypto 与 Date.now，解析 UUID 前 48 位时间戳。
 * 产品维度：保证消息和会话 ID 可按时间排序且不会在同毫秒内重复或倒退。
 * 逻辑维度：固定时间与三组随机字节，生成三个 UUID，检查文本、时间戳和顺序。
 * 关键边界：测试会替换全局 crypto，afterEach 必须恢复；时间戳按 48 位十六进制解析。
 * 新手阅读建议：先看两个常量，再跟踪随机值如何触发同毫秒递增与下一毫秒进位。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { uuidv7 } from "../src/utils/uuid.ts";

/** RFC 9562 UUIDv7 的小写十六进制格式正则。 */
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** 固定测试毫秒时间戳，恰好占 48 位。 */
const TIMESTAMP = 0x0123456789ab;

/** @param uuid UUIDv7 文本。@returns 前 48 位解析出的毫秒时间戳。@example `parseTimestamp(uuidv7())`。 */
function parseTimestamp(uuid: string): number {
	return Number.parseInt(uuid.replaceAll("-", "").slice(0, 12), 16);
}

/** 每例后恢复所有全局替身。 */
afterEach(() => {
	vi.unstubAllGlobals();
});

/** UUIDv7 格式与单调性测试组。 */
describe("uuidv7", () => {
	/** 验证固定时间下随机尾部递增，溢出后时间戳增加一毫秒。 */
	it("uses the RFC 9562 layout and preserves monotonic order", () => {
		/** 三次 crypto 调用依次使用的确定字节数组。 */
		const randomValues = [
			new Uint8Array([0, 0, 0, 0, 0, 0, 0xff, 0xff, 0xff, 0xfe, 0x01, 0x11, 0x22, 0x33, 0x44, 0x55]),
			new Uint8Array(16),
			new Uint8Array(16),
		];
		/** 模拟 getRandomValues：取下一数组写入目标并返回目标。 */
		const getRandomValues = vi.fn((bytes: Uint8Array) => {
			bytes.set(randomValues.shift() ?? new Uint8Array(bytes.length));
			return bytes;
		});
		vi.stubGlobal("crypto", { getRandomValues });
		/** 固定 Date.now 的 spy，finally 中恢复。 */
		const dateNow = vi.spyOn(Date, "now").mockReturnValue(TIMESTAMP);

		try {
			/** 同一固定时间下生成的第一个 UUID。 */
			const first = uuidv7();
			/** 随机部分单调递增后的第二个 UUID。 */
			const second = uuidv7();
			/** 尾部溢出并把时间推进一毫秒的第三个 UUID。 */
			const third = uuidv7();

			expect(first).toBe("01234567-89ab-7fff-bfff-f91122334455");
			expect(second).toBe("01234567-89ab-7fff-bfff-fc0000000000");
			expect(third).toBe("01234567-89ac-7000-8000-000000000000");
			expect(first).toMatch(UUID_V7_RE);
			expect(second).toMatch(UUID_V7_RE);
			expect(third).toMatch(UUID_V7_RE);
			expect(parseTimestamp(first)).toBe(TIMESTAMP);
			expect(parseTimestamp(second)).toBe(TIMESTAMP);
			expect(parseTimestamp(third)).toBe(TIMESTAMP + 1);
			expect(first < second).toBe(true);
			expect(second < third).toBe(true);
			expect(getRandomValues).toHaveBeenCalledTimes(3);
		} finally {
			dateNow.mockRestore();
		}
	});
});
