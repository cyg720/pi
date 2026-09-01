/**
 * 文件职责：验证 OAuth 设备码轮询的首次执行时机、间隔调整、服务端 slow_down 与取消行为。
 * 技术维度：使用 Vitest 假定时器、可控系统时间、模拟 poll 回调和 AbortController 精确推进时间。
 * 产品维度：让设备登录既及时响应又遵循授权服务器节流要求，并允许用户立即取消等待。
 * 逻辑维度：分别覆盖立即轮询、延迟首轮、默认加五秒、服务端指定间隔和中途取消五种场景。
 * 关键边界：所有时间均以毫秒精确断言；每个用例后必须恢复真实定时器避免污染其他测试。
 * 新手阅读建议：先看 intervalSeconds 输入，再逐步跟随 advanceTimersByTimeAsync 后的 pollTimes 变化。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { pollOAuthDeviceCodeFlow } from "../src/auth/oauth/device-code.ts";

const neverAbortedSignal = new AbortController().signal;

describe("OAuth device-code polling", () => {
	// 功能：恢复真实定时器；参数：无；返回：无。示例：Vitest 每个用例后自动调用。
	afterEach(() => {
		vi.useRealTimers();
	});

	it("polls immediately and returns the completed value", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-09T00:00:00Z"));

		// 每次 poll 实际发生的虚拟时间戳数组。
		const pollTimes: number[] = [];
		// 前一次返回 pending、第二次返回 token 的模拟轮询函数。
		const poll = vi.fn(async () => {
			pollTimes.push(Date.now());
			return pollTimes.length === 1
				? { status: "pending" as const }
				: { status: "complete" as const, value: "token" };
		});

		// 整个设备码轮询的待完成 Promise。
		const resultPromise = pollOAuthDeviceCodeFlow({
			intervalSeconds: 2,
			expiresInSeconds: 30,
			poll,
			signal: neverAbortedSignal,
		});

		await vi.advanceTimersByTimeAsync(0);
		expect(pollTimes).toEqual([new Date("2026-03-09T00:00:00Z").getTime()]);

		await vi.advanceTimersByTimeAsync(1999);
		expect(pollTimes).toEqual([new Date("2026-03-09T00:00:00Z").getTime()]);

		await vi.advanceTimersByTimeAsync(1);
		await expect(resultPromise).resolves.toBe("token");
		expect(pollTimes).toEqual([
			new Date("2026-03-09T00:00:00Z").getTime(),
			new Date("2026-03-09T00:00:02Z").getTime(),
		]);
	});

	it("can wait before the first poll", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-09T00:00:00Z"));

		// 延迟首轮场景记录的轮询时间。
		const pollTimes: number[] = [];
		// 开启 waitBeforeFirstPoll 后的待完成轮询 Promise。
		const resultPromise = pollOAuthDeviceCodeFlow({
			intervalSeconds: 2,
			expiresInSeconds: 30,
			waitBeforeFirstPoll: true,
			poll: async () => {
				pollTimes.push(Date.now());
				return { status: "complete" as const, value: "token" };
			},
			signal: neverAbortedSignal,
		});

		await vi.advanceTimersByTimeAsync(1999);
		expect(pollTimes).toEqual([]);

		await vi.advanceTimersByTimeAsync(1);
		await expect(resultPromise).resolves.toBe("token");
		expect(pollTimes).toEqual([new Date("2026-03-09T00:00:02Z").getTime()]);
	});

	it("increases the interval by 5 seconds after slow_down without a server interval", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-09T00:00:00Z"));
		// 本场景虚拟时间起点，用于计算七秒后的预期值。
		const startTime = Date.now();

		// slow_down 场景实际轮询时间数组。
		const pollTimes: number[] = [];
		// 模拟服务依次返回 slow_down 与完成的结果队列。
		const results = [{ status: "slow_down" as const }, { status: "complete" as const, value: "token" }];
		// 默认间隔两秒、收到 slow_down 后应改为七秒的轮询 Promise。
		const resultPromise = pollOAuthDeviceCodeFlow({
			intervalSeconds: 2,
			expiresInSeconds: 900,
			poll: async () => {
				pollTimes.push(Date.now());
				// 当前队首模拟结果；意外多轮询时为 undefined。
				const result = results.shift();
				if (!result) throw new Error("Unexpected extra poll");
				return result;
			},
			signal: neverAbortedSignal,
		});

		await vi.advanceTimersByTimeAsync(0);
		expect(pollTimes).toEqual([startTime]);

		await vi.advanceTimersByTimeAsync(6999);
		expect(pollTimes).toEqual([startTime]);

		await vi.advanceTimersByTimeAsync(1);
		await expect(resultPromise).resolves.toBe("token");
		expect(pollTimes).toEqual([startTime, startTime + 7000]);
	});

	it("honors a server-provided slow_down interval", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-09T00:00:00Z"));
		// 本场景虚拟时间起点，用于计算三十秒后的预期值。
		const startTime = Date.now();

		// 服务端指定间隔场景的实际轮询时间。
		const pollTimes: number[] = [];
		// 首次明确要求三十秒间隔、第二次完成的模拟结果队列。
		const results = [
			{ status: "slow_down" as const, intervalSeconds: 30 },
			{ status: "complete" as const, value: "token" },
		];
		// 应采用服务端 intervalSeconds=30 的轮询 Promise。
		const resultPromise = pollOAuthDeviceCodeFlow({
			intervalSeconds: 2,
			expiresInSeconds: 900,
			poll: async () => {
				pollTimes.push(Date.now());
				// 当前队首模拟结果；队列耗尽代表实现多轮询。
				const result = results.shift();
				if (!result) throw new Error("Unexpected extra poll");
				return result;
			},
			signal: neverAbortedSignal,
		});

		await vi.advanceTimersByTimeAsync(0);
		expect(pollTimes).toEqual([startTime]);

		await vi.advanceTimersByTimeAsync(29999);
		expect(pollTimes).toEqual([startTime]);

		await vi.advanceTimersByTimeAsync(1);
		await expect(resultPromise).resolves.toBe("token");
		expect(pollTimes).toEqual([startTime, startTime + 30000]);
	});

	it("cancels an in-flight wait", async () => {
		vi.useFakeTimers();
		// 用于主动取消设备码等待的控制器。
		const controller = new AbortController();

		// 首轮 pending 后等待五秒的轮询 Promise；将被 signal 取消。
		const resultPromise = pollOAuthDeviceCodeFlow({
			intervalSeconds: 5,
			expiresInSeconds: 30,
			poll: async () => ({ status: "pending" }),
			signal: controller.signal,
		});

		controller.abort();
		await expect(resultPromise).rejects.toThrow("Login cancelled");
	});
});
