/**
 * 【文件职责】实现 `@earendil-works/pi-ai` 包中的 `utils/node-http-proxy` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../types.ts`、`./provider-env.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为不同大模型提供统一 API、模型发现和供应商配置能力；本文件负责其中与 `utils/node-http-proxy` 对应的子能力。
 * 【逻辑维度】对外入口包括 `UNSUPPORTED_PROXY_PROTOCOL_MESSAGE`、`resolveHttpProxyUrlForTarget`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `UNSUPPORTED_PROXY_PROTOCOL_MESSAGE`、`resolveHttpProxyUrlForTarget` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { ProviderEnv } from "../types.ts";
import { getProviderEnvValue } from "./provider-env.ts";

const DEFAULT_PROXY_PORTS: Record<string, number> = {
	ftp: 21,
	gopher: 70,
	http: 80,
	https: 443,
	ws: 80,
	wss: 443,
};

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

function stripBrackets(host: string): string {
	return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function parseNoProxyEntry(entry: string): { host: string; port: number } | undefined {
	const trimmed = entry.trim().toLowerCase();
	if (!trimmed) return undefined;

	if (trimmed.startsWith("[")) {
		const closingBracket = trimmed.indexOf("]");
		if (closingBracket !== -1) {
			const host = trimmed.slice(1, closingBracket);
			const rest = trimmed.slice(closingBracket + 1);
			if (rest.startsWith(":")) {
				const port = Number.parseInt(rest.slice(1), 10);
				return { host, port: Number.isNaN(port) ? 0 : port };
			}
			return { host, port: 0 };
		}
	}

	if (trimmed.includes(":") && trimmed.split(":").length > 2) {
		return { host: trimmed, port: 0 };
	}

	const colonIndex = trimmed.lastIndexOf(":");
	if (colonIndex !== -1 && colonIndex === trimmed.indexOf(":")) {
		const host = trimmed.slice(0, colonIndex);
		const port = Number.parseInt(trimmed.slice(colonIndex + 1), 10);
		if (!Number.isNaN(port)) {
			return { host, port };
		}
	}

	return { host: trimmed, port: 0 };
}

function shouldProxyHostname(hostname: string, port: number, env?: ProviderEnv): boolean {
	const noProxy = getProxyEnv("no_proxy", env).toLowerCase();
	if (!noProxy) {
		return true;
	}
	if (noProxy === "*") {
		return false;
	}

	const normalizedTargetHost = stripBrackets(hostname.toLowerCase());

	return noProxy.split(/[,\s]/).every((entry) => {
		const parsed = parseNoProxyEntry(entry);
		if (!parsed) {
			return true;
		}

		if (parsed.port && parsed.port !== port) {
			return true;
		}

		let domain = stripBrackets(parsed.host);
		if (domain.startsWith("*.")) {
			domain = domain.slice(2);
		} else if (domain.startsWith(".") || domain.startsWith("*")) {
			domain = domain.slice(1);
		}

		if (!domain) {
			return true;
		}

		if (normalizedTargetHost === domain) {
			return false;
		}

		if (normalizedTargetHost.endsWith(`.${domain}`)) {
			return false;
		}

		return true;
	});
}

function getProxyForUrl(targetUrl: string | URL, env?: ProviderEnv): string {
	const parsedUrl = parseProxyTargetUrl(targetUrl);
	if (!parsedUrl?.protocol || !parsedUrl.host) {
		return "";
	}

	const protocol = parsedUrl.protocol.split(":", 1)[0]!;
	const hostname = stripBrackets(parsedUrl.hostname || parsedUrl.host.replace(/:\d*$/, ""));
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

export const UNSUPPORTED_PROXY_PROTOCOL_MESSAGE =
	"Unsupported proxy protocol. SOCKS and PAC proxy URLs are not supported; use an HTTP or HTTPS proxy URL.";

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
