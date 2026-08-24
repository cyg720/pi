/**
 * 文件职责：验证包版本比较、最新版 API 请求、更新元数据和自动检查禁用开关。
 * 技术维度：使用 Vitest 全局 fetch 模拟、环境变量隔离和版本检查纯函数。
 * 产品维度：准确提示用户可用更新，同时在离线或显式关闭时不产生后台网络请求。
 * 逻辑维度：先测语义版本比较，再模拟 API 响应，最后覆盖自动调用禁用与直接调用。
 * 关键边界：每例后恢复 fetch 与两个环境变量；测试不访问真实 pi.dev。
 * 新手阅读建议：先看比较用例，再跟踪 fetchMock 的响应如何映射到版本、包名和说明。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	checkForNewPiVersion,
	comparePackageVersions,
	getLatestPiRelease,
	getLatestPiVersion,
	isNewerPackageVersion,
} from "../src/utils/version-check.ts";

// originalSkipVersionCheck 保存测试前自动版本检查开关。
const originalSkipVersionCheck = process.env.PI_SKIP_VERSION_CHECK;
// originalOffline 保存测试前离线模式开关。
const originalOffline = process.env.PI_OFFLINE;

// 每例后恢复全局 fetch 和环境变量；无参数，无返回值。
afterEach(() => {
	vi.unstubAllGlobals();
	if (originalSkipVersionCheck === undefined) {
		delete process.env.PI_SKIP_VERSION_CHECK;
	} else {
		process.env.PI_SKIP_VERSION_CHECK = originalSkipVersionCheck;
	}
	if (originalOffline === undefined) {
		delete process.env.PI_OFFLINE;
	} else {
		process.env.PI_OFFLINE = originalOffline;
	}
});

describe("version checks", () => {
	// 验证普通版本、预发布数字和“是否更新”辅助函数；无参数，无返回值。
	it("compares package versions", () => {
		expect(comparePackageVersions("0.70.6", "0.70.5")).toBeGreaterThan(0);
		expect(comparePackageVersions("0.70.5", "0.70.5")).toBe(0);
		expect(comparePackageVersions("0.70.4", "0.70.5")).toBeLessThan(0);
		expect(comparePackageVersions("5.0.0-beta.20", "5.0.0-beta.9")).toBeGreaterThan(0);
		expect(isNewerPackageVersion("0.70.5", "0.70.5")).toBe(false);
		expect(isNewerPackageVersion("0.70.6", "0.70.5")).toBe(true);
	});

	// 验证自动检查只返回严格更新的版本；无参数，无返回值。
	it("returns only newer versions", async () => {
		// fetchMock 固定返回 1.2.3 最新版本。
		const fetchMock = vi.fn(async () => Response.json({ version: "1.2.3" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(checkForNewPiVersion("1.2.3")).resolves.toBeUndefined();
		await expect(checkForNewPiVersion("1.2.2")).resolves.toEqual({ version: "1.2.3" });
	});

	// 验证请求目标、用户代理和 JSON accept 头；无参数，无返回值。
	it("uses the pi.dev version check api with a pi user agent", async () => {
		// fetchMock 返回 1.2.4 并记录调用参数。
		const fetchMock = vi.fn(async () => Response.json({ version: "1.2.4" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestPiVersion("1.2.3")).resolves.toBe("1.2.4");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://pi.dev/api/latest-version",
			expect.objectContaining({
				headers: expect.objectContaining({
					"User-Agent": expect.stringMatching(/^pi\/1\.2\.3 /),
					accept: "application/json",
				}),
			}),
		);
	});

	// 验证最新版响应保留活动包名与版本；无参数，无返回值。
	it("returns the active package metadata from the version check api", async () => {
		// fetchMock 返回迁移后的包作用域元数据。
		const fetchMock = vi.fn(async () =>
			Response.json({
				packageName: "@new-scope/pi",
				version: "1.2.4",
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestPiRelease("1.2.3")).resolves.toEqual({
			packageName: "@new-scope/pi",
			version: "1.2.4",
		});
	});

	// 验证更新说明被去除首尾空白后返回；无参数，无返回值。
	it("returns update notes from the version check api", async () => {
		// fetchMock 返回带 Markdown 和多余空白的说明。
		const fetchMock = vi.fn(async () => Response.json({ note: " **Read this** ", version: "1.2.4" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestPiRelease("1.2.3")).resolves.toEqual({ note: "**Read this**", version: "1.2.4" });
	});

	// 验证禁用自动检查时不调用 fetch；无参数，无返回值。
	it("skips automatic api calls when version checks are disabled", async () => {
		process.env.PI_SKIP_VERSION_CHECK = "1";
		// fetchMock 用于确认没有网络调用。
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(checkForNewPiVersion("1.2.3")).resolves.toBeUndefined();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	// 验证禁用自动检查不影响调用方显式查询 API；无参数，无返回值。
	it("allows direct api calls when automatic version checks are disabled", async () => {
		process.env.PI_SKIP_VERSION_CHECK = "1";
		// fetchMock 为直接查询返回 1.2.4。
		const fetchMock = vi.fn(async () => Response.json({ version: "1.2.4" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestPiVersion("1.2.3")).resolves.toBe("1.2.4");
		expect(fetchMock).toHaveBeenCalledOnce();
	});
});
