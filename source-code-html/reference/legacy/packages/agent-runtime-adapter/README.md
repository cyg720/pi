> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Runtime adapter

Node-only boundary around Pi's public coding-agent SDK. Import `@pi-workbench/runtime-adapter`; browser code must use the protocol package instead.

## Host contract

`createWorkbenchRuntime(options)` exposes prompt/abort/snapshot/dispose, native steering/follow-up queues, model/thinking/tool selection, tree navigation/fork, compaction, JSONL export, canonical context projection and resource enumeration. `src/types.ts` defines the complete contract.

- Supply absolute, authorized `cwd`, `agentDir`, and `sessionDir`. Resume files must remain within sessionDir and match the project. These checks do not make tools an OS sandbox.
- `mode: "faux"` uses an in-process scripted provider, empty memory credentials, no models.json, and no catalog network. Start workers with an allowlisted environment, isolated HOME, and PI_OFFLINE=1 because native availability checks inspect ambient metadata.
- `mode: "configured"` requires an explicit ModelRuntime and exact model identity. The adapter does not discover credentials or fall back to another model.
- `createConfiguredModelRuntime` accepts HTTP loopback IP endpoints with a public non-secret placeholder key, or HTTPS endpoints whose exact origin is host-approved and whose credential is injected in memory. No credential is read from browser configuration or saved. Host-declared reasoning/image capabilities default conservatively; absent host pricing is reported as unknown, never free. A mock HTTP test validates transport, not a real model's availability.
- No tools or user resources are enabled by default. Every tool and extension is a host-owned authorization decision. A project cwd is not a filesystem sandbox.
- `allowedTools` is the independent host authorization ceiling (defaults to `tools`); `tools` is only the initial active selection. Registration never grants permission. Approved tools can be disabled and re-enabled. Native scoped defaultTools currently accepts concrete approved names only, not glob/modifier expressions.
- MCP requires an explicit configuration callback. Faux MCP additionally requires an in-memory transport factory. OAuth, executable commands, remote endpoints and persistent credentials remain host concerns; they are not accepted from browser callbacks.
- Unapproved MCP tools are excluded from the native callable registry, including nested codemode/deferred calls. Connecting a host-declared MCP server does not authorize its tools.
- Configured model HTTP requests enforce the exact initial endpoint origin and `redirect: error`. Automatic redirects are never followed; guarded transport cannot be overridden by individual calls, and streaming is constrained to HTTP SSE.
- `createLocalEchoMcpOptions` is an explicit faux-only in-memory fixture, not an external integration. Enable its `mcp__local_echo__echo` tool separately.
- Approved read/write/edit tools use workspace-contained operations, refuse symlinks, hardlinks and protected credential paths, and limit files to 5 MiB. Writes validate the open file before truncation. This is not an OS sandbox against concurrent parent-directory mutation. Shell is never enabled by default.

## Events and persistence

Text and thinking deltas are incremental. `message_end` is authoritative and includes normalized text, thinking, tool calls/results, stop reason and usage. Tool arguments/results and filesystem diff/path are bounded JSON-safe projections with explicit truncation markers and sensitive-key redaction. Headers/env are redacted; ordinary free text is not a full DLP boundary. `agent_settled` produces the overall `settled` event; per-turn agent_end is not a completion signal.

Concurrent prompts require explicit steer/followUp behavior while the native session is streaming. Hosts must associate queue operations with an active registered run. Abort waits for idle, including requests cancelled during preflight. Disposal aborts and waits before session shutdown. Resume preserves saved allowlisted model, thinking and tool loadout; unavailable saved selections fail explicitly. Snapshot sessionFile is private to the server. Context messages include native compaction/branch summaries; this canonical projection is not the final provider request.

## Settings façade

`readWorkbenchSettings(target)` and `patchWorkbenchSettings(target, scope, patch)` use native Pi scope merging and locked file storage. Only model defaults, thinking defaults, defaultTools, and codemode mode/inlineBudget are supported. Scope is global or trusted project; null deletes a scope override. Unknown stored settings are preserved. This updates defaults only; saving must not be reported as applied to an active runtime.

Opt in with `scopedSettings: { projectTrusted }` to consume these whitelisted defaults when creating a runtime. A false trust flag excludes the project layer. Saved session choices win; explicit initial thinking/tools override defaults. Model/tool choices remain host-allowlisted. To consume defaultTools, omit `tools` and supply `allowedTools`. Changes affect the next creation, never silently reload a running session. No credential or resource discovery is enabled by this option.

## Targeted tests

Run from this package under an isolated HOME and an allowlisted environment:

`node --import ../../scripts/workbench-source-loader.mjs --test test/runtime.test.ts test/config.test.ts test/extensions.test.ts test/models.test.ts test/operations.test.ts test/workspace-tools.test.ts`

Never run the full paid-provider/e2e suite to validate this package.
