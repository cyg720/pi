> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Local module execution work log

## 2026-10-14 02:57 UTC — E11 complete local binding inventory

- Current 153-field registry: 152 implemented local adapters, 1 explicitly
  unsupported JSON callback field (`agent/workbench.hooks`). No unimplemented
  mapping or parent-pending placeholder remains. Local verification comprises
  74 runtime behavior, 76 SDK boundary, and 2 telemetry metadata inspections.
  These categories intentionally do not mean 152 external production effects.
- Final targeted rerun: **90/90 tests passed** across all seven specified module
  test files. There are 32 explicit module operations. Server schema/TypeScript
  check, scoped modules/tests Biome, and protocol check/build/lint plus 10/10
  protocol tests passed. Parent owns the final repository-wide aggregate check.
- Report generation now requires each field's exact test name to appear as a
  passing TAP test, in its declared executed test source. It records SHA256 per
  test file, checks sources did not change during execution, uses a private
  temporary HOME with whitelisted environment, and removes HOME afterward.
- Added real native Durable scheduling/queue, context/document retention,
  compaction thresholds, progress commit throttling and constrained coding-tools
  actions. Shell capability is fixed `pwd` with a whitelist environment; files
  are limited to owned scratch README.md/note.txt and cleaned after execution.
- Added real native Codex SSE/WebSocket/cached continuation and connection
  timeout/fallback inside isolated workers with in-memory transport and fixed
  invalid fixture credentials. No main-server globals or credentials are used.
  Deferred boolean mode exercises native pending/fetch/completion/cancel; provider
  scheduling window objects are explicitly rejected by this local fixture.
- Added MCP HTTP injected-fetch reconnect/SSE caps and true native StdioTransport
  against a fixed owned Node child. Arbitrary programs/paths/env are rejected;
  child processes are reaped and cleanup errors preserve the original failure.
- Added Evals pure CLI parser selection through the parent-provided public
  `./workbench` export, always passed `{}` environment. No discovery, Docker or
  evaluation/inference run is claimed.
- Added Env 11-field native Connection/RemoteExecutionEnv/openTerminal protocol
  boundary against an owned Node peer. This is **not** the Rust daemon: no real
  watcher, terminal, remote shell or requested-path filesystem effect. The peer
  only records native frames; supplied argv and paths are never executed/opened.
- Upstream TUI contain fallback was reproduced, independently fixed by the parent
  TUI worker, then rerun: contain keeps outer position 0; chain moves it 1. The
  module field now has genuine runtime evidence and an explicit-operation receipt.
- Receipt safeguards exclude metadata-only and option-dependent inactive fields:
  WebSocket timeout in SSE mode; MCP SSE/reconnect options with GET disabled; MCP
  stderr byte cap with inherited stderr. Failed QuickJS, durable code/tool actions
  or expired transport probes receive no applied fields.
- `savedConfigApplies:false` means saving alone has no effect.
  `savedRevisionExecution` separately declares supported explicit operation
  execution with server-owned revision receipts; edits invalidate those receipts.

### Remaining external/host boundaries

External inference, authenticated/remote MCP, Rust pi-env daemon/SSH/watch/PTY,
deployed IPC/WebSocket, Cloudflare Codemode, telemetry exporters and Docker eval
execution are not verified by these local actions. Hook names cannot instantiate
functions; the host must register callbacks, so that field remains execution
disabled. Safe subsets and hard bounds are exposed in operation capabilities and
invalid/inapplicable fields fail rather than silently becoming effective.

## 2026-10-14 02:37 UTC — E11 current field evidence

- Added machine-readable registry for all 153 fields, distinct implementation and
  verification status, explicit operation timing, UI execution eligibility and
  concrete remaining implementation/integration paths. Unsupported callbacks never
  become executable through JSON. Historical validation supplied target names only.
- Current rerun: 47/47 tests, 103 fields implemented and verified in local actions:
  48 local runtime, 53 SDK request/option boundary, 2 metadata inspection. One hook
  field is unsupported JSON; 11 env/terminal fields require connection/policy
  integration; 38 additional mappings remain unimplemented at this checkpoint.
- `verify-field-report.ts` reruns the specified offline tests under an environment
  whitelist before writing `docs/workbench/coverage/field-effectiveness.json`.
  In-progress mappings without registered actions do not receive passing evidence.
- Real bindings now cover Agent 11, AI 17, Chord 11, Codemode 9, Durable 13,
  Evals 7, MCP 8, Telemetry 7 and TUI 14, plus Env 6 SSH argument boundary fields.
- Added native Chord Host routing/contracts/eager/dev/ping fixtures; WebSocket/IPC
  adapters use in-process endpoints. Default long timers are not reported as fired.
- Added native Durable Harness registry selection, controlled faux provider/model
  dispatch, captured request options and real retry policy. cwd is resolved only,
  not accessed. External provider names are rejected, never replaced silently.
- Added deterministic Codemode start/deliver clock/seed/tool tests and actual
  worker/inline constructor selection. Remote Cloudflare requires configured host
  transport and is rejected. Inline execution has a bounded interrupt budget.
- Added AI image/classifier/Anthropic metadata request serialization with injected
  fetch responses; fixture outputs are explicitly not inference.
- Explicit `input.fields` rejects unknown/inapplicable keys. Results report
  appliedFields/effectiveValues/validationLevel/per-field support; metadata-only
  fields are inspected and never included in appliedFields. Server owns matching
  saved-revision receipts and invalidation; saving remains distinct from execution.
- Protocol additionally exports terminal wire types, bounded inline image prompt
  DTOs and tool/summary message facts; 10 protocol tests pass.

## Scope and interface

`getModuleCapabilities()` returns operation-specific support, requirements, bounded
input examples, and limitations. `executeModule(moduleId, operation, input,
{ workspaceRoot, dataDirectory })` returns JSON-safe results. HTTP registration
belongs to the server owner; browser invocation belongs to the UI owner.

These actions verify local SDK behavior. They do not mark all 153 form fields
effective, claim live provider access, or complete E01–E10 in full. Saved settings
remain separate from runtime confirmation. All imports use public package exports;
the parent added the private evals package's narrow `./workbench` export.

## 2026-10-14 02:06 UTC — local actions verified

- E01 `ai/catalog`: reads bundled Anthropic provider model metadata and supported
  thinking levels through `createModels` and the public provider. No credential
  availability check, catalog refresh, provider request, images or classification.
- E02 `agent/tool-run`: actual Agent loop with explicit native faux provider,
  validated echo tool, two provider turns, message history and lifecycle events.
  Faux results are labeled; they do not establish external model behavior.
- E03 `chord/delta`: native transactional tracker adoption, immutable delta apply,
  and actual `memoryLinkPair` frame delivery. Remote principals, hot reload and
  WebSocket integration are not covered.
- E04 `codemode/execute`: real worker-thread QuickJS/WASM, 2-second deadline,
  16-MiB VM limit, strictly validated echo tool, output and returned store writes.
  No host filesystem, shell or networking is injected. Failed scripts return no
  committed store writes; storage persistence is not implied.
- E05 `durable/recovery`: native Harness with real JSONL storage, passive entry
  submission, close/reopen and request-ID deduplication. Created scratch records
  are cleaned in finally. No interrupted model generation or task graph claim.
- E06 `env/local-file`: actual pi-durable NodeExecutionEnv text write/read in
  private scratch. This is deliberately labeled as pi-durable, not a pi-env daemon.
  `env/connection-plan` separately invokes pi-env's native `sshArguments` strict
  host-key/forwarding validation and closed Connection lifecycle. No command is
  resolved or spawned, no authentication file read, no host trusted, no remote
  connection/daemon/PTY/watcher established.
- E07 `evals/plan` and `evals/report`: actual upstream task expansion and paired
  report statistics through the parent's public narrow export; validates input
  shape, outcome and score. Missing pairs withhold lift. Scores remain explicitly
  caller-supplied; no Docker or model evaluation was run. The source-only private
  evals package requires retaining monorepo source files in deployment.
- E08 `mcp/roundtrip`: actual McpClient initialization, listTools and callTool over
  native in-memory transport against an explicitly local echo service. External
  HTTP/stdio providers and OAuth are unverified.
- E09 `telemetry/span`: actual nested InMemoryTelemetryContext spans, events and
  settlement. No duration is invented; no external exporter or persistence.
- E10 `tui/text`: actual native terminal-cell width, ANSI stripping, wrapping and
  truncation. No claim that browser CSS equals a TUI theme or interactive terminal.

## Verification

Command from repository root:

```
env -i PATH="$PATH" HOME=/tmp LANG=C.UTF-8 node --import ./scripts/workbench-source-loader.mjs --test apps/agent-server/test/modules.test.ts
```

Result: 17/17 tests pass, including all 12 declared operations, invalid input,
unsafe SSH host arguments, prototype pollution, eval missing-pair handling and
QuickJS failure with no host `process` access or committed writes, and a real
non-yielding loop terminated by the 2-second deadline. Scratch is
empty after successful completion. No external network/provider request is made.
Local Biome checks scoped to modules and the test pass. Server type checking
reported no remaining module errors; another worker's coding-agent settings types
were still in flight at the first check. Parent owns final root integration/check.

## Deviations and remaining work

- This increment delivers explicit operation execution rather than pretending
  that storing arbitrary form JSON configures host callbacks or external systems.
- Provider catalog initially covers bundled Anthropic chat models only.
- Request authentication, raw body limits, module-operation authorization and
  concurrency admission are server responsibilities. QuickJS itself has deadline
  and memory bounds; no extra framework or dependency versions were introduced.
- UI has received the capability and invocation contract; browser-backed action
  acceptance remains separate from these local SDK tests.
