/**
 * 文件职责：验证 RPC 的 JSONL 序列化与按行读取能正确处理 Unicode 分隔符、CRLF 和无尾换行。
 * 技术维度：使用 Vitest、Node Readable 流、Buffer 和 JSON.parse。
 * 产品维度：保证跨进程 RPC 不因 U+2028/U+2029 或不同平台换行而拆坏消息。
 * 逻辑维度：先测试单行序列化，再以三种边界输入驱动 attachJsonlLineReader 并检查行数组。
 * 关键边界：协议只以 LF 分帧，CR 会从 CRLF 尾部移除；最终残留也必须作为一行发出。
 * 新手阅读建议：先理解 JSONL 是“一行一个 JSON”，再比较四个测试的分隔符差异。
 */
import { Readable } from "node:stream";
import { describe, expect, test } from "vitest";
import { attachJsonlLineReader, serializeJsonLine } from "../src/modes/rpc/jsonl.ts";

/** RPC JSONL 分帧测试组。 */
describe("RPC JSONL framing", () => {
	/** 验证序列化保留 Unicode 行/段分隔符，只在记录末尾增加 LF。 */
	test("serializes strict JSONL records without escaping Unicode separators", () => {
		/** 含 U+2028 与 U+2029 的序列化行。 */
		const line = serializeJsonLine({ text: "a\u2028b\u2029c" });

		expect(line).toContain("a\u2028b\u2029c");
		expect(line.endsWith("\n")).toBe(true);
		expect(JSON.parse(line.trim())).toEqual({ text: "a\u2028b\u2029c" });
	});

	/** 验证 U+2028/U+2029 不会被误当作 JSONL 分隔符。 */
	test("splits on LF only and preserves U+2028/U+2029 inside payloads", async () => {
		/** 行读取回调收集到的字符串。 */
		const lines: string[] = [];
		/** 只含一条序列化记录的可读流。 */
		const stream = Readable.from([serializeJsonLine({ text: "a\u2028b\u2029c" })]);

		/** 流触发 end 时完成的等待 Promise。 */
		const done = new Promise<void>((resolve) => {
			stream.on("end", resolve);
		});

		// line 是读取器发出的完整 JSON 文本行。
		attachJsonlLineReader(stream, (line) => {
			lines.push(line);
		});

		await done;

		expect(lines).toHaveLength(1);
		expect(JSON.parse(lines[0])).toEqual({ text: "a\u2028b\u2029c" });
	});

	/** 验证 Windows CRLF 输入拆成不含 CR 的两行。 */
	test("handles CRLF-delimited input", async () => {
		/** 收集的两条 JSON 行。 */
		const lines: string[] = [];
		/** 含两条 CRLF 记录的字节流。 */
		const stream = Readable.from([Buffer.from('{"a":1}\r\n{"b":2}\r\n')]);

		/** 等待流结束的 Promise。 */
		const done = new Promise<void>((resolve) => {
			stream.on("end", resolve);
		});

		attachJsonlLineReader(stream, (line) => {
			lines.push(line);
		});

		await done;

		expect(lines).toEqual(['{"a":1}', '{"b":2}']);
	});

	/** 验证流结束时没有 LF 的残留文本仍会发出。 */
	test("emits a final line without trailing LF", async () => {
		/** 收集的最终行。 */
		const lines: string[] = [];
		/** 不含尾换行的单条 JSON 流。 */
		const stream = Readable.from([Buffer.from('{"a":1}')]);

		/** 等待流结束的 Promise。 */
		const done = new Promise<void>((resolve) => {
			stream.on("end", resolve);
		});

		attachJsonlLineReader(stream, (line) => {
			lines.push(line);
		});

		await done;

		expect(lines).toEqual(['{"a":1}']);
	});
});
