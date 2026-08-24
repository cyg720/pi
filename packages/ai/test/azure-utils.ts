/**
 * 文件职责：提供 Azure OpenAI 测试的凭据检测和模型到部署名解析工具。
 * 技术维度：读取 Node.js 环境变量，用逗号与等号解析映射并保存为 Map。
 * 产品维度：支持用户以自定义 Azure 部署名运行模型测试，并在凭据不全时安全跳过在线测试。
 * 逻辑维度：内部函数解析映射；公开函数分别检查凭据组合和按模型 ID 查询部署名。
 * 关键边界：映射格式为 model=deployment 的逗号分隔文本，畸形条目会被忽略；不验证远端部署存在。
 * 新手阅读建议：先手工拆解一个映射示例，再顺着 parseDeploymentNameMap 到公开查询函数阅读。
 */
/**
 * Utility functions for Azure OpenAI tests
 */
/** Azure OpenAI 测试工具函数集合。 */

/**
 * 解析模型 ID 到 Azure 部署名的环境变量文本。
 * @param value 逗号分隔的 `模型ID=部署名` 字符串；允许 undefined 和条目前后空白。
 * @returns 有效条目组成的 Map；空值或全是畸形条目时返回空 Map。
 * @example `parseDeploymentNameMap("gpt-4=prod,gpt-4o=fast")`。
 */
function parseDeploymentNameMap(value: string | undefined): Map<string, string> {
	/** 解析结果映射；键和值都会去除两端空白，重复键以后出现的值为准。 */
	const map = new Map<string, string>();
	if (!value) return map;
	// entry 是一个待解析的逗号分隔片段，可能为空或缺少等号。
	for (const entry of value.split(",")) {
		/** 去除两端空白后的条目；空字符串会直接跳过。 */
		const trimmed = entry.trim();
		if (!trimmed) continue;
		/** 等号两侧的模型 ID 与部署名；任一缺失都会忽略该条目。 */
		const [modelId, deploymentName] = trimmed.split("=", 2);
		if (!modelId || !deploymentName) continue;
		map.set(modelId.trim(), deploymentName.trim());
	}
	return map;
}

/**
 * 判断 Azure OpenAI 在线测试的基础凭据是否齐全。
 * @returns API 密钥存在，且基础 URL 或资源名至少存在一个时返回 true。
 * @example `const canRun = hasAzureOpenAICredentials();`
 */
export function hasAzureOpenAICredentials(): boolean {
	/** API 密钥是否为非空字符串；不验证密钥真伪。 */
	const hasKey = !!process.env.AZURE_OPENAI_API_KEY;
	/** 是否提供了可定位服务的基础 URL 或资源名。 */
	const hasBaseUrl = !!(process.env.AZURE_OPENAI_BASE_URL || process.env.AZURE_OPENAI_RESOURCE_NAME);
	return hasKey && hasBaseUrl;
}

/**
 * 查询模型对应的 Azure 自定义部署名。
 * @param modelId 模型目录中的模型 ID，必须与映射键去空白后的文本完全一致。
 * @returns 找到时返回部署名，否则返回 undefined。
 * @example `resolveAzureDeploymentName("gpt-4o")`。
 */
export function resolveAzureDeploymentName(modelId: string): string | undefined {
	/** 原始部署映射环境变量；未设置时无需创建 Map。 */
	const mapValue = process.env.AZURE_OPENAI_DEPLOYMENT_NAME_MAP;
	if (!mapValue) return undefined;
	return parseDeploymentNameMap(mapValue).get(modelId);
}
