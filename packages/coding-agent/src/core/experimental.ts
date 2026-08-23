/**
 * 【文件职责】实验特性开关：按环境变量判断是否启用实验功能。
 * 【新手阅读建议】半分钟读完即可。
 */
export function areExperimentalFeaturesEnabled(): boolean {
	return process.env.PI_EXPERIMENTAL === "1";
}
