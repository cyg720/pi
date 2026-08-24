/**
 * 文件职责：验证交互模式对 Anthropic 订阅认证可能产生额外用量的警告条件。
 * 技术维度：使用 Vitest 模拟设置管理器、模型运行时认证查询和 InteractiveMode 私有方法。
 * 产品维度：提醒订阅用户当前调用可能计入额外 API 用量，同时允许关闭提示且避免重复警告。
 * 逻辑维度：构造设置与认证运行时，覆盖令牌识别、已存 OAuth、非 Anthropic 和关闭警告。
 * 关键边界：使用 any 绑定内部方法和最小 this；不刷新或验证真实认证凭据。
 * 新手阅读建议：先看两个工厂函数，再比较四例中 checkAuth、getAuth 与 showWarning 调用次数。
 */
import { describe, expect, test, vi } from "vitest";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";

/** 创建返回固定警告设置的最小设置管理器；warnings 为覆盖值，返回含 getWarnings 的对象。 */
function createSettingsManager(warnings: { anthropicExtraUsage?: boolean } = {}) {
	return {
		getWarnings: vi.fn().mockReturnValue(warnings),
	};
}

/**
 * 创建固定认证查询结果的模型运行时。
 * 参数：credential 为可选 OAuth 标记，apiKey 为可选解析后密钥。
 * 返回值：含 checkAuth 和 getAuth 模拟函数的对象。
 * 使用示例：`createModelRuntime(undefined, "sk-ant-oat01-test")`。
 */
function createModelRuntime(credential: { type: "oauth" } | undefined, apiKey?: string) {
	return {
		checkAuth: vi.fn().mockResolvedValue(credential),
		getAuth: vi.fn().mockResolvedValue(apiKey ? { auth: { apiKey } } : undefined),
	};
}

describe("InteractiveMode.maybeWarnAboutAnthropicSubscriptionAuth", () => {
	// 验证识别订阅令牌后只显示一次警告并缓存状态；无参数，无返回值。
	test("warns once when Anthropic subscription auth is detected", async () => {
		// modelRuntime 返回带 Anthropic 订阅特征的 API 密钥。
		const modelRuntime = createModelRuntime(undefined, "sk-ant-oat01-test");
		// fakeThis 是警告方法所需的最小交互模式上下文。
		const fakeThis: any = {
			anthropicSubscriptionWarningShown: false,
			settingsManager: createSettingsManager(),
			session: { modelRuntime },
			showWarning: vi.fn(),
		};

		await (InteractiveMode as any).prototype.maybeWarnAboutAnthropicSubscriptionAuth.call(fakeThis, {
			provider: "anthropic",
		});
		await (InteractiveMode as any).prototype.maybeWarnAboutAnthropicSubscriptionAuth.call(fakeThis, {
			provider: "anthropic",
		});

		expect(fakeThis.showWarning).toHaveBeenCalledTimes(1);
		expect(modelRuntime.getAuth).toHaveBeenCalledTimes(1);
	});

	// 验证已存 OAuth 凭据无需刷新查询也会警告；无参数，无返回值。
	test("warns when Anthropic OAuth is stored even if token refresh lookup would fail", async () => {
		// modelRuntime 的 checkAuth 直接返回 OAuth 类型。
		const modelRuntime = createModelRuntime({ type: "oauth" });
		// fakeThis 是 OAuth 警告路径的最小上下文。
		const fakeThis: any = {
			anthropicSubscriptionWarningShown: false,
			settingsManager: createSettingsManager(),
			session: { modelRuntime },
			showWarning: vi.fn(),
		};

		await (InteractiveMode as any).prototype.maybeWarnAboutAnthropicSubscriptionAuth.call(fakeThis, {
			provider: "anthropic",
		});

		expect(fakeThis.showWarning).toHaveBeenCalledTimes(1);
		expect(modelRuntime.getAuth).not.toHaveBeenCalled();
	});

	// 验证非 Anthropic 模型不会执行认证查询或警告；无参数，无返回值。
	test("does not warn for non-Anthropic models", async () => {
		// modelRuntime 不含任何认证结果，且本路径不应访问它。
		const modelRuntime = createModelRuntime(undefined);
		// fakeThis 是传入 OpenAI 模型时的最小上下文。
		const fakeThis: any = {
			anthropicSubscriptionWarningShown: false,
			settingsManager: createSettingsManager(),
			session: { modelRuntime },
			showWarning: vi.fn(),
		};

		await (InteractiveMode as any).prototype.maybeWarnAboutAnthropicSubscriptionAuth.call(fakeThis, {
			provider: "openai",
		});

		expect(fakeThis.showWarning).not.toHaveBeenCalled();
		expect(modelRuntime.getAuth).not.toHaveBeenCalled();
	});

	// 验证用户关闭额外用量警告后跳过全部认证检查；无参数，无返回值。
	test("does not warn when Anthropic extra usage warning is disabled", async () => {
		// modelRuntime 不含认证，且警告关闭后不应调用。
		const modelRuntime = createModelRuntime(undefined);
		// fakeThis 的设置显式把 anthropicExtraUsage 设为 false。
		const fakeThis: any = {
			anthropicSubscriptionWarningShown: false,
			settingsManager: createSettingsManager({ anthropicExtraUsage: false }),
			session: { modelRuntime },
			showWarning: vi.fn(),
		};

		await (InteractiveMode as any).prototype.maybeWarnAboutAnthropicSubscriptionAuth.call(fakeThis, {
			provider: "anthropic",
		});

		expect(fakeThis.showWarning).not.toHaveBeenCalled();
		expect(modelRuntime.checkAuth).not.toHaveBeenCalled();
		expect(modelRuntime.getAuth).not.toHaveBeenCalled();
	});
});
