/**
 * 文件职责：验证 RPC 客户端的 clone 方法会发送正确命令并返回解包后的克隆结果。
 * 技术维度：使用 Vitest 模拟函数，并通过测试专用结构类型替换客户端私有通信方法。
 * 产品维度：保证用户克隆会话时，客户端与 RPC 服务端遵循约定的命令和响应格式。
 * 逻辑维度：构造客户端，注入 send 与 getData 桩函数，调用 clone 后检查请求参数和结果。
 * 关键边界：测试绕过 TypeScript 私有边界，只应在测试中使用；不覆盖真实进程通信。
 * 新手阅读建议：先看 RpcClientPrivate 描述的两个替换点，再按注入、调用、断言顺序阅读。
 */
import { describe, expect, it, vi } from "vitest";
import { RpcClient } from "../src/modes/rpc/rpc-client.ts";

/** 测试需要访问的客户端私有方法最小视图；只描述本用例替换的 send 和 getData。 */
type RpcClientPrivate = {
	/** 发送一个带 type 的 RPC 命令并异步取得未知响应。 */
	send: (command: { type: string }) => Promise<unknown>;
	/** 从未知响应中取出调用方指定类型的数据。 */
	getData: <T>(response: unknown) => T;
};

/** RpcClient 克隆行为测试组。 */
describe("RpcClient clone", () => {
	/** 验证 clone 发送 `{ type: "clone" }` 并返回响应 data 字段。 */
	it("sends the clone RPC command", async () => {
		/** 被测 RPC 客户端；本测试不启动实际子进程。 */
		const client = new RpcClient();
		/** 同一客户端的测试私有视图；unknown 中转避免直接假定公开类型兼容。 */
		const privateClient = client as unknown as RpcClientPrivate;
		/** 模拟 send 方法；固定返回成功的 clone 响应，并记录调用参数。 */
		const send = vi.fn(async () => ({
			type: "response",
			command: "clone",
			success: true,
			data: { cancelled: false },
		}));
		privateClient.send = send;
		/** 测试版响应解包函数；response 必须含有与 T 对应的 data 字段。 */
		privateClient.getData = <T>(response: unknown): T => {
			return (response as { data: T }).data;
		};

		/** clone 公开方法返回的数据；预期为 `{ cancelled: false }`。 */
		const result = await client.clone();

		expect(send).toHaveBeenCalledWith({ type: "clone" });
		expect(result).toEqual({ cancelled: false });
	});
});
