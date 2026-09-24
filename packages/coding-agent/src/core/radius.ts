<<<<<<< HEAD
/**
 * 【文件职责】Radius 网关集成：pi-messages 网关供应商的配置与注册。
 * 【产品维度】让 Radius 网关作为模型供应商可用。
 * 【新手阅读建议】看注册与配置解析。
 */
=======
import { DEFAULT_RADIUS_GATEWAY, normalizeRadiusGatewayUrl } from "@earendil-works/pi-ai/providers/radius-config";

>>>>>>> main
export const RADIUS_PROVIDER_ID = "radius";
export const ENV_RADIUS_GATEWAY = "PI_RADIUS_GATEWAY";

/** Radius gateway origin, honoring the `PI_RADIUS_GATEWAY` override. */
export function getRadiusGatewayUrl(): string {
	return normalizeRadiusGatewayUrl(process.env[ENV_RADIUS_GATEWAY] ?? DEFAULT_RADIUS_GATEWAY);
}
