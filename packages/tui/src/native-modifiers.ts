/**
 * 【文件职责】提供 macOS 原生修饰键（shift/command/control/option）的实时按下状态查询：
 *              通过按需加载的预编译原生插件实现，加载失败时安全降级为“始终未按下”。
 * 【技术维度】createRequire 在 ESM 中加载 CJS 的 .node 原生模块；鸭子类型接口校验；
 *              多候选路径探测（兼容不同打包布局）；模块级缓存避免重复加载。
 * 【产品维度】让编辑器能区分“点击终端”与“修饰键+点击”（如 option+点击精确定位光标），
 *              仅在 macOS 上生效，其他平台零开销。
 * 【逻辑维度】loadNativeModifiersHelper：缓存判定 → 平台/架构过滤 → 三个候选路径逐个尝试 require →
 *              校验通过则缓存并返回；isNativeModifierPressed 对外暴露同步布尔查询。
 * 【关键边界】仅 darwin + x64/arm64 会尝试加载；任何异常都静默降级返回 false，绝不抛错；
 *              加载结果（含失败）会被缓存，进程内不重试。
 * 【新手阅读建议】先看 ModifierKey 类型与对外唯一的 isNativeModifierPressed → 再读加载函数理解
 *              三个候选路径分别对应什么打包场景。
 */
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// 在 ESM 环境中创建 CJS require，用于加载 .node 原生模块
const cjsRequire = createRequire(import.meta.url);

// 支持查询的修饰键类型
export type ModifierKey = "shift" | "command" | "control" | "option";

// 原生插件需导出的最小接口：给定修饰键名返回是否按下
type NativeModifiersHelper = {
	isModifierPressed: (name: ModifierKey) => boolean;
};

// 已加载的原生助手缓存；null 表示尝试过但失败；undefined 表示尚未尝试
let nativeModifiersHelper: NativeModifiersHelper | null | undefined;

// 鸭子类型校验（私有）：对象且 isModifierPressed 为函数即认为合法
function isNativeModifiersHelper(value: unknown): value is NativeModifiersHelper {
	if (typeof value !== "object" || value === null) return false;
	const candidate = (value as { isModifierPressed?: unknown }).isModifierPressed;
	return typeof candidate === "function";
}

/**
 * 按需加载原生助手（私有）：仅 macOS x64/arm64 尝试；
 * 依次探测“模块上级目录/本目录/可执行文件目录”下的预编译产物；全部失败缓存 null。
 */
function loadNativeModifiersHelper(): NativeModifiersHelper | undefined {
	// 命中缓存（成功或失败都不再重试）
	if (nativeModifiersHelper !== undefined) return nativeModifiersHelper ?? undefined;
	nativeModifiersHelper = null;
	if (process.platform !== "darwin") return undefined;
	const arch = process.arch;
	if (arch !== "x64" && arch !== "arm64") return undefined;

	// 当前模块所在目录（用于推导相对路径）
	const moduleDir = path.dirname(fileURLToPath(import.meta.url));
	// 相对布局：native/darwin/prebuilds/darwin-<arch>/darwin-modifiers.node
	const nativePath = path.join("native", "darwin", "prebuilds", `darwin-${arch}`, "darwin-modifiers.node");
	const candidates = [
		path.join(moduleDir, "..", nativePath),
		path.join(moduleDir, nativePath),
		path.join(path.dirname(process.execPath), nativePath),
	];

	for (const modulePath of candidates) {
		try {
			const helper = cjsRequire(modulePath) as unknown;
			if (isNativeModifiersHelper(helper)) {
				nativeModifiersHelper = helper;
				return helper;
			}
		} catch {
			// Try the next possible packaging location.
			// 该路径不存在或加载失败：尝试下一个打包位置
		}
	}

	return undefined;
}

/**
 * 查询指定修饰键当前是否被物理按下（公开）：原生能力不可用时恒为 false；
 * 查询过程抛出的任何异常都被吞掉以保证调用方安全。参数 key —— 修饰键名。
 */
export function isNativeModifierPressed(key: ModifierKey): boolean {
	const helper = loadNativeModifiersHelper();
	if (!helper) return false;
	try {
		return helper.isModifierPressed(key) === true;
	} catch {
		return false;
	}
}
