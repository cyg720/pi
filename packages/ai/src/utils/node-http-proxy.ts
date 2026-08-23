/**
 * 【文件职责】HTTP 代理解析：按标准代理环境变量（http_proxy/https_proxy/all_proxy/no_proxy）
 *              为请求目标解析应使用的代理 URL，兼容 Node fetch 的 dispatcher 用法。
 * 【技术维度】代理环境变量大小写兼容读取；no_proxy 通配/端口匹配；协议补全。
 * 【产品维度】让库内请求在受管控网络（需代理出口）环境下正常工作。
 * 【逻辑维度】getProxyEnv 读取 → parseProxyTargetUrl 解析目标 → shouldProxyHostname 判断豁免 →
 *              getProxyForUrl 选代理 → resolveHttpProxyUrlForTarget 校验并返回 URL。
 * 【关键边界】仅支持 http/https 代理，SOCKS/PAC 抛明确错误；no_proxy="*" 全部豁免；
 *              无协议前缀的代理值自动补全为协议。
 * 【新手阅读建议】先读 shouldProxyHostname 的豁免逻辑 → 再看 resolveHttpProxyUrlForTarget 的校验。
 */
import type { ProviderEnv } from "../types.ts";
import { getProviderEnvValue } from "./provider-env.ts";

// 常见协议默认端口（用于无端口目标/代理判定）
const DEFAULT_PROXY_PORTS: Record<string, number> = {
	ftp: 21,
	gopher: 70,
	http: 80,
	https: 443,
	ws: 80,
	wss: 443,
};

// 读取代理环境变量（私有）：同时尝试小写/大写键与 env 覆盖、process.env
function getProxyEnv(key: string, env?: ProviderEnv): string {
	const lowercaseKey = key.toLowerCase();
	const uppercaseKey = key.toUpperCase();
	return (
		env?.[lowercaseKey] ||
		env?.[uppercaseKey] ||
		getProviderEnvValue(lowercaseKey) ||
		getProviderEnvValue(uppercaseKey) ||
		""
	);
}

// 解析目标 URL（私有）：已实例或字符串；非法返回 undefined
function parseProxyTargetUrl(targetUrl: string | URL): URL | undefined {
	if (targetUrl instanceof URL) {
		return targetUrl;
	}

	try {
		return new URL(targetUrl);
	} catch {
		return undefined;
	}
}

// 判断主机是否应走代理（私有）：no_proxy 为空走代理；"*" 全豁免；
// 逐条规则匹配（host:port 形式比端口；*. 后缀匹配）
function shouldProxyHostname(hostname: string, port: number, env?: ProviderEnv): boolean {
	const noProxy = getProxyEnv("no_proxy", env).toLowerCase();
	if (!noProxy) {
		return true;
	}
	if (noProxy === "*") {
		return false;
	}

	return noProxy.split(/[,\s]/).every((proxy) => {
		if (!proxy) {
			return true;
		}

		// 规则可能带端口（host:port）
		const parsedProxy = proxy.match(/^(.+):(\d+)$/);
		let proxyHostname = parsedProxy ? parsedProxy[1] : proxy;
		const proxyPort = parsedProxy ? Number.parseInt(parsedProxy[2]!, 10) : 0;
		if (proxyPort && proxyPort !== port) {
			return true;
		}

		// 无通配符：精确主机名比较
		if (!/^[.*]/.test(proxyHostname)) {
			return hostname !== proxyHostname;
		}

		// 通配符：*.example.com 后缀匹配
		if (proxyHostname.startsWith("*")) {
			proxyHostname = proxyHostname.slice(1);
		}
		return !hostname.endsWith(proxyHostname);
	});
}

// 为给定目标选择代理（私有）：按协议取 *_proxy 或 all_proxy；无协议前缀补全
function getProxyForUrl(targetUrl: string | URL, env?: ProviderEnv): string {
	const parsedUrl = parseProxyTargetUrl(targetUrl);
	if (!parsedUrl?.protocol || !parsedUrl.host) {
		return "";
	}

	const protocol = parsedUrl.protocol.split(":", 1)[0]!;
	const hostname = parsedUrl.host.replace(/:\d*$/, "");
	const port = Number.parseInt(parsedUrl.port, 10) || DEFAULT_PROXY_PORTS[protocol] || 0;
	if (!shouldProxyHostname(hostname, port, env)) {
		return "";
	}

	let proxy = getProxyEnv(`${protocol}_proxy`, env) || getProxyEnv("all_proxy", env);
	if (proxy && !proxy.includes("://")) {
		proxy = `${protocol}://${proxy}`;
	}
	return proxy;
}

// 不支持的代理协议提示文案（SOCKS/PAC 不支持）
export const UNSUPPORTED_PROXY_PROTOCOL_MESSAGE =
	"Unsupported proxy protocol. SOCKS and PAC proxy URLs are not supported; use an HTTP or HTTPS proxy URL.";

// 为请求目标解析可用的 HTTP/HTTPS 代理 URL（公开）：无代理返回 undefined；
// 非法 URL 或不支持的协议抛错
export function resolveHttpProxyUrlForTarget(targetUrl: string | URL, env?: ProviderEnv): URL | undefined {
	const proxy = getProxyForUrl(targetUrl, env);
	if (!proxy) {
		return undefined;
	}

	let proxyUrl: URL;
	try {
		proxyUrl = new URL(proxy);
	} catch (error) {
		throw new Error(
			`Invalid proxy URL ${JSON.stringify(proxy)}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	if (proxyUrl.protocol !== "http:" && proxyUrl.protocol !== "https:") {
		throw new Error(`${UNSUPPORTED_PROXY_PROTOCOL_MESSAGE} Got ${proxyUrl.protocol}`);
	}

	return proxyUrl;
}
