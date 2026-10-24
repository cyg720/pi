import {
	type CodemodeExtensionOptions,
	createCodemodeExtension,
	createMcpExtension,
	createToolSearchExtension,
	type InlineExtension,
	type McpExtensionOptions,
} from "@earendil-works/pi-coding-agent";

/** Host-only factories; never deserialize these callbacks from browser input. */
export interface WorkbenchExtensionsOptions {
	codemode?: boolean | CodemodeExtensionOptions;
	mcp?: McpExtensionOptions;
	toolSearch?: boolean;
}

export interface RuntimeExtensionStatus {
	name: "codemode" | "mcp" | "tool-search";
	loaded: boolean;
}

export function createWorkbenchExtensions(options: WorkbenchExtensionsOptions = {}, faux = false): InlineExtension[] {
	if (options.mcp && !options.mcp.loadConfig) {
		throw new Error("Workbench MCP requires explicit configuration; implicit home-directory discovery is disabled");
	}
	if (faux && options.mcp && (!options.mcp.loadConfig || !options.mcp.createTransport)) {
		throw new Error("Faux MCP requires explicit in-memory configuration and transport factories");
	}
	const factories: InlineExtension[] = [];
	if (options.codemode) {
		factories.push(createCodemodeExtension(typeof options.codemode === "boolean" ? {} : options.codemode));
	}
	if (options.toolSearch) factories.push(createToolSearchExtension());
	if (options.mcp) factories.push(createMcpExtension(options.mcp));
	return factories;
}
