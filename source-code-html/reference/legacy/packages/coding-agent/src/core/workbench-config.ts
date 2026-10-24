import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONFIG_DIR_NAME } from "../config.ts";
import { FileSettingsStorage, SettingsManager, type SettingsScope } from "./settings-manager.ts";

/** Deliberately excludes credential, command, path and arbitrary extension settings. */
export interface WorkbenchSettings {
	defaultProvider?: string;
	defaultModel?: string;
	defaultThinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
	defaultTools?: string[];
	codemode?: { mode?: "on" | "only"; inlineBudget?: number };
}

export interface WorkbenchSettingsTarget {
	cwd: string;
	agentDir: string;
	projectTrusted: boolean;
}

export interface WorkbenchSettingsSnapshot {
	global: WorkbenchSettings;
	project: WorkbenchSettings;
	effective: WorkbenchSettings;
}

/** null deletes an override so the setting inherits its parent/default again. */
export type WorkbenchSettingsPatch = {
	[K in keyof WorkbenchSettings]?: WorkbenchSettings[K] | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validatePatch(value: unknown): asserts value is WorkbenchSettingsPatch {
	if (!isRecord(value)) throw new Error("Settings patch must be an object");
	for (const [key, entry] of Object.entries(value)) {
		if (!["defaultProvider", "defaultModel", "defaultThinkingLevel", "defaultTools", "codemode"].includes(key)) {
			throw new Error(`Unsupported workbench setting: ${key}`);
		}
		if (entry === null) continue;
		if (key === "defaultProvider" || key === "defaultModel") {
			if (typeof entry !== "string" || !entry.trim() || entry.length > 256) throw new Error(`Invalid ${key}`);
		} else if (key === "defaultThinkingLevel") {
			if (
				typeof entry !== "string" ||
				!["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(entry)
			) {
				throw new Error("Invalid defaultThinkingLevel");
			}
		} else if (key === "defaultTools") {
			if (
				!Array.isArray(entry) ||
				entry.length > 256 ||
				entry.some((name: unknown) => typeof name !== "string" || !/^[a-zA-Z0-9_.*+:-]{1,128}$/.test(name))
			) {
				throw new Error("Invalid defaultTools");
			}
		} else if (key === "codemode") {
			if (!isRecord(entry)) throw new Error("Invalid codemode settings");
			for (const [field, setting] of Object.entries(entry)) {
				if (field === "mode" && (setting === "on" || setting === "only")) continue;
				if (
					field === "inlineBudget" &&
					typeof setting === "number" &&
					Number.isSafeInteger(setting) &&
					setting >= 0
				)
					continue;
				throw new Error(`Invalid codemode setting: ${field}`);
			}
		}
	}
}

function projectSettings(value: WorkbenchSettings): WorkbenchSettings {
	const picked: Record<string, unknown> = {};
	for (const key of ["defaultProvider", "defaultModel", "defaultThinkingLevel", "defaultTools"] as const) {
		if (value[key] !== undefined) picked[key] = value[key];
	}
	if (isRecord(value.codemode)) {
		const codemode: Record<string, unknown> = {};
		for (const key of ["mode", "inlineBudget"] as const) {
			if (value.codemode[key] !== undefined) codemode[key] = value.codemode[key];
		}
		picked.codemode = codemode;
	}
	validatePatch(picked);
	return structuredClone(picked) as WorkbenchSettings;
}

/** Reads through SettingsManager so merge and trust semantics remain native Pi behavior. */
export function readWorkbenchSettings(target: WorkbenchSettingsTarget): WorkbenchSettingsSnapshot {
	const manager = SettingsManager.create(target.cwd, target.agentDir, { projectTrusted: target.projectTrusted });
	const errors = manager.drainErrors();
	if (errors.length) throw new Error(`Cannot read ${errors[0].scope} settings`, { cause: errors[0].error });
	return {
		global: projectSettings(manager.getGlobalSettings()),
		project: projectSettings(manager.getProjectSettings()),
		effective: projectSettings(manager.getSettings()),
	};
}

/**
 * Applies only the supported fields under Pi's file lock, preserving unrelated
 * settings. This persists defaults; it does not claim an active session reloaded.
 */
export function patchWorkbenchSettings(
	target: WorkbenchSettingsTarget,
	scope: SettingsScope,
	patch: WorkbenchSettingsPatch,
): WorkbenchSettingsSnapshot {
	validatePatch(patch);
	if (scope !== "global" && scope !== "project") throw new Error("Invalid settings scope");
	if (scope === "project" && !target.projectTrusted) throw new Error("Project is not trusted");
	// Do not commit one layer only to discover another required layer is corrupt
	// while preparing the result. Report the existing read error before writing.
	readWorkbenchSettings(target);
	const path =
		scope === "global" ? join(target.agentDir, "settings.json") : join(target.cwd, CONFIG_DIR_NAME, "settings.json");
	// Materialize an empty file exclusively before taking the native file lock;
	// concurrent first writes then both read the current contents while locked.
	mkdirSync(dirname(path), { recursive: true });
	try {
		writeFileSync(path, "{}\n", { flag: "wx", mode: 0o600 });
	} catch (error) {
		if (!isRecord(error) || error.code !== "EEXIST") throw error;
	}
	const storage = new FileSettingsStorage(target.cwd, target.agentDir);
	storage.withLock(scope, (current) => {
		const parsed: unknown = JSON.parse(current ?? "{}");
		if (!isRecord(parsed)) throw new Error("Existing settings must be an object");
		for (const [key, value] of Object.entries(patch)) {
			if (value === null) delete parsed[key];
			else if (key === "codemode" && isRecord(value))
				parsed.codemode = { ...(isRecord(parsed.codemode) ? parsed.codemode : {}), ...value };
			else parsed[key] = value;
		}
		return `${JSON.stringify(parsed, null, 2)}\n`;
	});
	return readWorkbenchSettings(target);
}
