/**
 * 文件职责：验证编码代理生成的 pi.dev User-Agent 字符串格式。
 * 技术维度：使用 Vitest、Node.js process 平台信息和正则表达式做精确及结构双重断言。
 * 产品维度：保证服务端能稳定识别客户端版本、运行时、操作系统与 CPU 架构。
 * 逻辑维度：根据 Bun 或 Node 选择运行时标识，生成 User-Agent 后校验完整文本和通用格式。
 * 关键边界：测试依赖当前进程的平台字段；仅验证格式，不验证服务端是否接受该标识。
 * 新手阅读建议：先拆解期望字符串的四个组成部分，再对照 getPiUserAgent 的实现理解格式约束。
 */
import { describe, expect, it } from "vitest";
import { getPiUserAgent } from "../src/utils/pi-user-agent.ts";

/** User-Agent 格式测试组，集中描述 getPiUserAgent 的外部协议约束。 */
describe("getPiUserAgent", () => {
	/** 验证固定版本号在当前运行环境中会生成服务端预期的文本与分隔结构。 */
	it("formats the user agent expected by pi.dev", () => {
		/** 当前测试进程的运行时标识；Bun 优先，否则使用 Node 版本，值形如 bun/1.x 或 node/v22.x。 */
		const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
		/** 被测函数生成的完整 User-Agent；版本参数固定为 1.2.3，便于构造确定期望值。 */
		const userAgent = getPiUserAgent("1.2.3");

		expect(userAgent).toBe(`pi/1.2.3 (${process.platform}; ${runtime}; ${process.arch})`);
		expect(userAgent).toMatch(/^pi\/[^\s()]+ \([^;()]+;\s*[^;()]+;\s*[^()]+\)$/);
	});
});
