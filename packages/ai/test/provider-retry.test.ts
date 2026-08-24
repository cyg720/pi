/**
 * 文件职责：验证提供商请求重试对状态码、响应头延迟上限、禁用上限和中止信号的处理。
 * 技术维度：使用 Vitest 假计时器、模拟异步请求、Headers 和 AbortController 测试重试工具。
 * 产品维度：让临时限流请求可靠恢复，同时避免服务端异常长等待阻塞用户或忽略取消操作。
 * 逻辑维度：构造带状态和头的错误，覆盖正常重试、明确拒绝、超限、无限制和中止五种路径。
 * 关键边界：假计时器必须在每例后恢复；maxRetryDelayMs 为 0 表示禁用等待上限。
 * 新手阅读建议：先看 providerError 的错误形状，再按五例比较 request 调用次数和计时推进。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { retryProviderRequest } from "../src/utils/provider-retry.ts";

/**
 * 创建带 HTTP 状态和响应头的模拟提供商错误。
 * 参数：status 为可选状态码，headers 为控制重试行为的响应头。
 * 返回值：附加 status 和 Headers 的 Error。
 * 使用示例：`providerError(429, { "retry-after": "2" })`。
 */
function providerError(status: number | undefined, headers?: Record<string, string>): Error {
	return Object.assign(new Error(`Provider error: ${status}`), {
		status,
		headers: new Headers(headers),
	});
}

describe("provider request retries", () => {
	// 每个用例后恢复真实计时器；无参数，无返回值。
	afterEach(() => {
		vi.useRealTimers();
	});

	// 验证 429 与 retry-after-ms 会在指定延迟后重试一次；无参数，无返回值。
	it("retries retryable provider errors", async () => {
		vi.useFakeTimers();
		// request 第一次返回限流错误，第二次成功返回 ok。
		const request = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(providerError(429, { "retry-after-ms": "1000" }))
			.mockResolvedValue("ok");

		// result 是包含等待和第二次请求的重试结果 Promise。
		const result = retryProviderRequest(request, { maxRetries: 1 });
		await vi.advanceTimersByTimeAsync(999);
		expect(request).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);

		await expect(result).resolves.toBe("ok");
		expect(request).toHaveBeenCalledTimes(2);
	});

	// 验证 x-should-retry=false 会阻止重试并保留原错误；无参数，无返回值。
	it("does not retry errors the provider marks as non-retryable", async () => {
		// error 是提供商明确标为不可重试的 429 错误。
		const error = providerError(429, { "x-should-retry": "false" });
		// request 每次调用都抛出同一个不可重试错误。
		const request = vi.fn<() => Promise<string>>().mockRejectedValue(error);

		await expect(retryProviderRequest(request, { maxRetries: 2 })).rejects.toBe(error);
		expect(request).toHaveBeenCalledTimes(1);
	});

	// 验证服务端要求的延迟超过客户端上限时立即拒绝；无参数，无返回值。
	it("rejects a provider-requested retry delay above the limit", async () => {
		// request 返回要求等待 277403 秒的限流错误。
		const request = vi.fn<() => Promise<string>>().mockRejectedValue(providerError(429, { "retry-after": "277403" }));

		await expect(retryProviderRequest(request, { maxRetries: 1, maxRetryDelayMs: 1000 })).rejects.toThrow(
			"Server requested 277403s retry delay (max: 1s)",
		);
		expect(request).toHaveBeenCalledTimes(1);
	});

	// 验证把延迟上限设为 0 后允许服务端指定等待时间；无参数，无返回值。
	it("allows disabling the provider-requested retry delay cap", async () => {
		vi.useFakeTimers();
		// request 第一次要求等待两秒，第二次成功。
		const request = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(providerError(429, { "retry-after": "2" }))
			.mockResolvedValue("ok");

		// result 是等待两秒后重试的结果 Promise。
		const result = retryProviderRequest(request, { maxRetries: 1, maxRetryDelayMs: 0 });
		await vi.advanceTimersByTimeAsync(1999);
		expect(request).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);

		await expect(result).resolves.toBe("ok");
		expect(request).toHaveBeenCalledTimes(2);
	});

	// 验证 AbortSignal 会取消正在等待的超长重试计时器；无参数，无返回值。
	it("aborts a provider-requested retry delay", async () => {
		vi.useFakeTimers();
		// controller 用于主动中止重试等待。
		const controller = new AbortController();
		// request 返回带超长等待时间的限流错误。
		const request = vi.fn<() => Promise<string>>().mockRejectedValue(providerError(429, { "retry-after": "277403" }));

		// result 是绑定 controller.signal 的重试 Promise。
		const result = retryProviderRequest(request, { maxRetries: 2, maxRetryDelayMs: 0, signal: controller.signal });
		await vi.advanceTimersByTimeAsync(0);
		expect(request).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(1);

		controller.abort();

		await expect(result).rejects.toMatchObject({ name: "AbortError" });
		expect(request).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});
});
