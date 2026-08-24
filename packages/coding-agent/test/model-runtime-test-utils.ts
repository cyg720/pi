/**
 * 文件职责：为模型运行时测试创建受控 ModelRegistry，并保留注册表到内部运行时的关联。
 * 技术维度：使用 WeakMap 隐式关联对象，统一关闭模型网络访问并支持磁盘或内存模型配置。
 * 产品维度：让测试通过公共注册表接口验证行为，同时在必要时访问底层运行时做精确断言。
 * 逻辑维度：wrap 建立映射；两个创建函数选择模型路径策略；查询函数取回映射并校验来源。
 * 关键边界：只有本工具创建的注册表才能反查运行时；WeakMap 不阻止对象被垃圾回收。
 * 新手阅读建议：先理解 runtimes 的键值关系，再比较两个创建函数对 modelsPath 的不同设置。
 */
import type { CredentialStore } from "@earendil-works/pi-ai";
import { ModelRegistry } from "../src/core/model-registry.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";

/** 注册表到其底层运行时的弱引用映射；键被回收后记录自动消失，外部无法直接修改。 */
const runtimes = new WeakMap<ModelRegistry, ModelRuntime>();

/**
 * 用运行时创建注册表并记录两者关联。
 * @param runtime 已初始化的模型运行时。
 * @returns 包装该运行时的新 ModelRegistry。
 * @example `const registry = wrap(runtime)`（仅供本文件创建函数内部使用）。
 */
function wrap(runtime: ModelRuntime): ModelRegistry {
	/** 暴露给测试调用方的模型注册表；其底层运行时会立即写入弱映射。 */
	const registry = new ModelRegistry(runtime);
	runtimes.set(registry, runtime);
	return registry;
}

/**
 * 创建禁用模型网络访问的测试注册表。
 * @param credentials 测试使用的凭据存储。
 * @param modelsPath 可选模型配置文件路径；省略时使用运行时默认规则。
 * @returns 异步返回已初始化并记录关联的 ModelRegistry。
 * @example `await createModelRegistry(store, "/tmp/models.json")`。
 */
export async function createModelRegistry(credentials: CredentialStore, modelsPath?: string): Promise<ModelRegistry> {
	return wrap(await ModelRuntime.create({ credentials, modelsPath, allowModelNetwork: false }));
}

/**
 * 创建完全不读取模型配置文件的内存测试注册表。
 * @param credentials 测试使用的凭据存储。
 * @returns 异步返回 modelsPath 为 null 且禁用网络访问的注册表。
 * @example `await createInMemoryModelRegistry(store)`。
 */
export async function createInMemoryModelRegistry(credentials: CredentialStore): Promise<ModelRegistry> {
	return wrap(await ModelRuntime.create({ credentials, modelsPath: null, allowModelNetwork: false }));
}

/**
 * 取回测试注册表对应的底层模型运行时。
 * @param modelRegistry 必须由本文件创建函数返回的注册表。
 * @returns 与注册表关联的 ModelRuntime。
 * @throws 传入外部创建的注册表时抛出错误。
 * @example `const runtime = getModelRuntime(registry)`。
 */
export function getModelRuntime(modelRegistry: ModelRegistry): ModelRuntime {
	/** 从弱映射读取的运行时；来源不合法时为 undefined。 */
	const runtime = runtimes.get(modelRegistry);
	if (!runtime) throw new Error("ModelRegistry was not created by the test helper");
	return runtime;
}
