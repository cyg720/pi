import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { type AgentSessionRuntime, convertToLlm, type ModelRuntime } from "@earendil-works/pi-coding-agent";
import type {
	RuntimeContext,
	RuntimeMessage,
	RuntimeResource,
	RuntimeSnapshot,
	RuntimeTree,
	WorkbenchRuntime,
} from "./types.ts";

export type RuntimeOperations = Pick<
	WorkbenchRuntime,
	| "setModel"
	| "setThinkingLevel"
	| "setTools"
	| "getTree"
	| "fork"
	| "navigateTree"
	| "compact"
	| "exportSession"
	| "getContext"
	| "listResources"
	| "clearQueue"
>;

export function createRuntimeOperations(
	runtime: AgentSessionRuntime,
	modelRuntime: ModelRuntime,
	allowedModels: ReadonlySet<string>,
	allowedTools: ReadonlySet<string>,
	snapshot: () => RuntimeSnapshot,
	runIdleOperation: <T>(operation: () => Promise<T>) => Promise<T>,
	normalizeMessage: (value: unknown, id: string) => RuntimeMessage | undefined,
): RuntimeOperations {
	return {
		setModel(selection) {
			return runIdleOperation(async () => {
				if (!allowedModels.has(`${selection.provider}/${selection.id}`))
					throw new Error("Model is outside the host allowlist");
				const model = modelRuntime.getModel(selection.provider, selection.id);
				if (!model) throw new Error("Selected model is unavailable");
				await runtime.session.setModel(model);
			});
		},
		setThinkingLevel(level) {
			return runIdleOperation(async () => {
				if (!["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(level))
					throw new Error("Invalid thinking level");
				runtime.session.setThinkingLevel(level);
			});
		},
		setTools(names) {
			return runIdleOperation(async () => {
				const available = new Set(runtime.session.getAllTools().map((tool) => tool.name));
				if (names.some((name) => !allowedTools.has(name))) throw new Error("Tool is outside the host allowlist");
				if (names.some((name) => !available.has(name))) throw new Error("Approved tool is unavailable");
				runtime.session.setActiveToolsByName([...new Set(names)]);
				runtime.session.sessionManager.appendCustomEntry("workbench-tool-loadout", [...new Set(names)]);
			});
		},
		clearQueue() {
			if (snapshot().status === "disposed") throw new Error("Runtime is disposed");
			return runtime.session.clearQueue();
		},
		getTree(): RuntimeTree {
			return {
				leafId: runtime.session.sessionManager.getLeafId(),
				entries: runtime.session.sessionManager.getEntries().map((entry) => {
					const message = entry.type === "message" ? normalizeMessage(entry.message, entry.id) : undefined;
					return {
						id: entry.id,
						parentId: entry.parentId,
						type: entry.type,
						timestamp: entry.timestamp,
						...(message ? { role: message.role, text: message.text } : {}),
						...(entry.type === "compaction" || entry.type === "branch_summary" ? { text: entry.summary } : {}),
					};
				}),
			};
		},
		async fork(entryId, options) {
			const result = await runIdleOperation(async () => runtime.fork(entryId, options));
			return { cancelled: result.cancelled, snapshot: snapshot() };
		},
		async navigateTree(entryId) {
			const result = await runIdleOperation(async () => runtime.session.navigateTree(entryId, { summarize: false }));
			return { cancelled: result.cancelled, editorText: result.editorText, snapshot: snapshot() };
		},
		compact(customInstructions) {
			return runIdleOperation(async () => {
				const result = await runtime.session.compact(customInstructions);
				return {
					summary: result.summary,
					tokensBefore: result.tokensBefore,
					estimatedTokensAfter: result.estimatedTokensAfter,
				};
			});
		},
		exportSession() {
			return runIdleOperation(async () => {
				const path = join(
					runtime.session.sessionManager.getSessionDir(),
					`.workbench-export-${randomUUID()}.jsonl`,
				);
				try {
					runtime.session.exportToJsonl(path);
					return { format: "jsonl" as const, content: await readFile(path, "utf8") };
				} finally {
					await unlink(path).catch(() => {});
				}
			});
		},
		getContext(): RuntimeContext {
			const projection = runtime.session.sessionManager.buildSessionProjection();
			return {
				source: "canonical-projection",
				leafId: runtime.session.sessionManager.getLeafId(),
				entries: projection.entries.map((entry) => ({
					id: entry.sourceEntry.id,
					type: entry.sourceEntry.type,
					messageCount: entry.messages.length,
				})),
				messages: projection.entries.flatMap((entry) =>
					entry.messages.flatMap((message, index) =>
						convertToLlm([message]).flatMap((converted, part) => {
							const normalized = normalizeMessage(converted, `${entry.sourceEntry.id}:${index}:${part}`);
							return normalized
								? [
										{
											...normalized,
											source:
												message.role === "compactionSummary"
													? ("compaction-summary" as const)
													: message.role === "branchSummary"
														? ("branch-summary" as const)
														: ("message" as const),
										},
									]
								: [];
						}),
					),
				),
				usage: runtime.session.getContextUsage() ?? null,
				historyEntryCount: runtime.session.sessionManager.getEntryCount(),
			};
		},
		listResources(): RuntimeResource[] {
			const loader = runtime.session.resourceLoader;
			return [
				...loader
					.getSkills()
					.skills.map((skill) => ({ kind: "skill" as const, name: skill.name, description: skill.description })),
				...loader.getPrompts().prompts.map((prompt) => ({
					kind: "prompt" as const,
					name: prompt.name,
					description: prompt.description,
				})),
				...loader.getExtensions().extensions.map((_extension, index) => ({
					kind: "extension" as const,
					name: `host-extension-${index + 1}`,
				})),
				...loader
					.getAgentsFiles()
					.agentsFiles.map((_file, index) => ({ kind: "context" as const, name: `context-${index + 1}` })),
			];
		},
	};
}
