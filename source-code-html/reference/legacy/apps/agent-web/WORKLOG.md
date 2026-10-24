> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Agent Web migration work log

## 2026-10-14 — B01: migration complete

- Copied the original `src`, `tests`, documentation and application configuration into `apps/agent-web` without modifying `web-workbench-design`.
- Excluded Git metadata, dependency directories, generated bundles, deployment metadata and historical delivery archives.
- Manifest: `@pi-workbench/web`, version `0.1.0`, private ESM. Preserved TypeScript 7.0.2, esbuild 0.28.2 and Biome 2.3.5.
- Updated the two source-path tests to require the monorepo `packages` directory instead of silently skipping a missing sibling checkout.
- Deviation: none. Runtime connectivity and coding-agent UI are intentionally not claimed by this migration task.

## 2026-10-14 — B05: targeted regression verification complete

- Fixed cached snapshots losing subscriptions after closing a tab and changing another page. Discarding a page on reset/import now explicitly disposes its snapshot subscription; temporary detachment does not.
- Added a close/change/reopen/edit regression and reset/import disposal assertions.
- Commands executed from `apps/agent-web`, all final exits 0:
  - `node tests/workbench.test.mjs`: 71 passed, 0 failed, 0 skipped. Monorepo capability source paths verified.
  - `node tests/i18n.test.mjs`: 23 passed.
  - `node tests/config-effectiveness.test.mjs`: 182 passed, including 153 draft fields; runtime fields verified remains 0. This existing test regenerates `docs/config-effectiveness.json`.
  - `node tests/select.test.mjs`: 18 passed.
  - `node tests/workspace-state.test.mjs`: 14 passed.
  - `node tests/workspace-interactions.test.mjs`: 30 passed, including the new snapshot lifecycle regression and reset/import disposal assertions.
  - `npm run check`: TypeScript passed.
  - `npm run lint`: Biome checked 109 files, no diagnostics.
- Total: 338 local frontend checks. These are structural/event/mock-DOM tests, not browser visual QA, backend integration or SDK runtime verification.
- During iteration the new regression initially exposed the mock DOM's separate dataset/attribute storage; using the normal `dataset` API made the element marker consistent with the existing harness. One Biome import-spacing diagnostic was corrected. All six scripts were rerun together against the final application code and passed.
- Existing npm environment/project warnings concern `http-proxy` and `min-release-age`; no dependency or root npm configuration was modified.
- `diff -rq` against the original source shows changes only in `src/app/bootstrap.ts` and `src/components/Snapshot.ts`; all other migrated source files, model catalog and styles are unchanged.
- Deviation: added the narrowly scoped snapshot lifecycle bug fix with a regression rather than reproducing the pre-existing defect. No framework/version change, feature removal, paid API call, root configuration edit or Git commit. Full root checking remains owned by the parent task.

## 2026-10-14 — F01: built-in agent navigation verified

- Added `data/workspace-pages.ts` to distinguish content tabs from the unchanged ten-package catalog. Added the blue built-in coding-agent card, close/reopen-safe content tab and deep-link routing.
- Evidence: `node tests/agent-ui.test.mjs` checks ten package routes remain ten, separate agent content tab, close/reopen and cached page identity.
- Deviation: unknown-route fixture changed from the now-valid coding-agent route to `unknown-agent`; the ten-package coverage assertion was retained.

## 2026-10-14 — F02: real session creation and restoration verified

- Added `Sessions.ts`, same-origin `host-client.ts`, `host-events.ts`, and `state/agent.ts` for actual session lists, search, workspace selection, creation and snapshot restoration.
- Real integration command: `node --import ../../scripts/workbench-source-loader.mjs tests/agent-server-integration.test.mjs` passed 3 checks: native faux worker run over HTTP/SSE, refreshed frontend session restoration, and actual cancellation after server restart.
- The HTTP integration uses temporary host data outside the repository and closes its worker/server resources. No provider credentials or paid API calls.
- Deviation: real-browser refresh is not verified; equivalent new frontend store initialization is verified against persisted host data. Browser execution is blocked by the parent environment's socket isolation.

## 2026-10-14 — F03: core chat flow implemented; extended inputs pending

- `Chat.ts` renders actual messages, thinking and merged tool records; `Composer.ts` preserves per-session drafts, sends idempotent requests and sends explicit abort requests without inventing completion.
- Client/state tests verify late snapshots and events cannot overwrite newer navigation, duplicate sequences are ignored, gaps resynchronize and retry retains requestId. Persisted tool history hydrates without reapplying text deltas.
- Still pending: real attachment transport, model/thinking mutation and native steer/follow-up queue APIs. Unsupported functionality is not represented as working controls.

## 2026-10-14 — F04: file inspector implemented

- The existing `WorkspacePanel` owns the sole four-tab inspector. Files list actual host directory entries, navigate directories, search the current directory and refresh; selecting a file shows path/size only.
- Evidence: structural UI test proves one workspace panel/inspector and no code preview under file tree; no fabricated project files.
- Deviation: file editing is not part of this view. The server's read/write operations remain separate from the intentionally removed inline preview.

## 2026-10-14 — F05: executed change evidence implemented

- `derived.ts` merges start/update/end records to preserve arguments and results. The change inspector includes only actual edit/write end events and renders actual `result.diff` or `result.details.diff` when supplied.
- If no diff was returned, the UI says so and shows the result instead. Failed tool records remain marked as errors; no Git staging, approval or rollback is implied.
- Pending: native editor-tool end-to-end diff evidence; no fake change counts from the design images are used.

## 2026-10-14 — F06: truthful context view; projection API pending

- Displays actual saved session messages and explicitly distinguishes them from the final runtime context projection.
- Context occupancy and available/read skill counts remain unknown until provided by the host. They are never calculated from cumulative usage.
- This task is not fully complete: native projection/skills metadata is still required.

## 2026-10-14 — F07: actual run/event inspection implemented

- Shows native-backed run status and persisted/live event details, errors and tool arguments/results. Terminal states come from server status events based on agent_settled/isIdle.
- Queue/retry statistics remain explicitly unavailable until host supplies them. They are not shown as zero.
- Evidence: native faux completion/abort integration and client sequence/late-navigation tests.

## 2026-10-14 — F08: central dock implemented; PTY integration in progress

- `Dock.ts` is nested only in `agent-chat-column`, with real command-tool output, actual error events and persisted run history.
- Existing command output is labelled non-interactive PTY. A separate genuine PTY adapter is being coordinated; no ANSI stripping is represented as a full terminal.

## 2026-10-14 — F09: single shared status bar implemented

- Only one agent status bar exists; its terminal toggle is immediately before the current-context indicator. Actual cumulative usage sums message usage; unknown cost/context stays unknown.
- Evidence: agent UI tests verify one status bar and dock-only toggle behavior.

## 2026-10-14 — F10: twelve entry panels verified

- Six-column/two-row compact entry grid. Models use explicitly pinned searchable catalog; settings perform actual revisioned GET/PUT and show independent effectiveness reports; sessions/runs/files query real host data; diagnostics fetches actual health; appearance changes locale.
- Tool/codemode/context/extensions/integration entries provide searchable source capability references with explicit unsupported operation boundaries, no fake execution/install buttons.
- `node tests/agent-entries.test.mjs`: 8 checks passed, including config conflicts, invalid numbers, unchanged-value preservation and real response displays.
- Deviation: this verifies usable entry surfaces, not implementation of all native API controls indexed by the research inventory.

## 2026-10-14 — F11: structural layout and bilingual regression in progress

- Read the complete latest design brief and inspected the actual files/run reference images before implementation. Kept no independent chat heading/meta bar, no file-tree preview, one right inspector, central-only dock and preserved package navigation.
- New chrome uses the existing locale binding system; original dictionary entries take precedence to avoid changing established labels. Narrow layouts retain six-column entry grid.
- Browser visual, pointer, accessibility and responsive rendering verification remains blocked; structural/mock-DOM tests do not substitute for it.

## 2026-10-14 — F03/F06/F07/F08/F10: native control and research integration update

- F03: added native model/thinking/tools controls, steer/follow-up queue posting and capability-gated PNG/JPEG/WebP/GIF attachments. Image count/size/MIME validation uses protocol bounds; images stay in memory, session changes clear them, and uncertain retries reuse the same request ID only when text and image bytes match. Image attachments are not silently queued through the text-only queue route. Native image-model execution remains unverified.
- F06: split `ContextInspector`, reading actual native current-branch context/resources and estimated context usage. Explicitly states this is not the final provider request. Read skill count remains unknown.
- F07: split persistent four inspector components, real runtime queue view, retained tool detail expansion and keyboard tab navigation. Retry statistics stay unknown.
- F08: implemented separate `Terminal.ts` rendering actual ANSI-parser screen runs/cursor/colors/modes, keyboard/paste/IME input, resize and explicit start/close routes. No shell starts automatically. Screen-fixture tests are not native PTY or browser evidence.
- F10: reduced `Entries.ts` to 70 lines and split settings/models/appearance/diagnostics/session lists/references/research responsibilities. Twelve entry groups expose all 811 phase-two research rows from the 964-row catalog. Classification, status, native entry and sources are searchable, with static-baseline warnings; sources are inert text, not per-row action buttons.
- Build now requires and validates `docs/workbench/coverage/catalog.json`, then copies it byte-for-byte to `dist/research-catalog.json`. Initial numeric phase check was corrected from a string assumption; build and `cmp` then passed.
- Verified targeted suites: agent-runtime 13, agent-ui 8, agent-entries 8, inspector 8, native-panel 6, terminal 4, research 7, attachments 2 (56 total). The entries no-context assertion now excludes the expected static research GET while preserving the prohibition on malformed API requests. All original ten-package assertions remain unchanged.
- Re-ran all six original frontend suites after native/research integration: 338 passed. Expanded the real HTTP/SSE/native faux integration to 4 checks, including actual native snapshot/context/tools/tree/JSONL export reads; all passed.
- Permanently closed EventSource connections request a new snapshot instead of waiting forever for an impossible replay cursor. Fork results select the actual returned session only when the user has not navigated away. Image input is disabled immediately on session change while native capability is rechecked.
- Final current application verification: `tsc --noEmit`, `biome check src build.mjs` (147 files, no diagnostics), `node build.mjs`, and byte-identical catalog `cmp` all exit 0. Chat regression additionally checks expansion survives stream updates and raw thinking text does not change with locale.
- After the saved-configuration component was integrated, re-ran all nine new targeted frontend scripts together: 78 checks passed (56 coding-workbench checks plus 22 module-operation/saved-configuration checks). App TypeScript, Biome, build and catalog `cmp` all remained green. Combined with the six original suites, current frontend evidence is 416 checks; the separate four real native HTTP/SSE checks are not counted as frontend fixtures.
- Final attachment follow-through: integrated protocol `MessageSnapshot.imageAttachments` metadata so image-only messages show actual MIME attachment markers, without refetching bytes or inventing previews. Added one UI regression (agent-ui now 9; frontend total now 417). Re-ran UI, TypeScript, Biome147 and build successfully.

## 2026-10-14 — D06: scoped native settings UI, awaiting host integration evidence

- Review identified that the existing settings panel only edited phase-one module configuration. Added independent `entries/NativeSettings.ts` and `native-settings-fields.ts`; retained the original ten-module panel unchanged.
- Agreed API with host: GET `/api/settings?scope=global|project&workspaceId=...`; PUT `/api/settings` with scope/workspaceId/exact string revision and only explicitly edited values. Native scope SHA256 revisions are forwarded unchanged. Null removes a scope override.
- Non-secret controls: default provider/model, thinking level, concrete comma-separated tool names, Codemode mode/inline budget. Host-enabled and host-project-trust/writable flags gate editing; there is no browser control that grants trust or expands permissions.
- Always states `next-runtime-creation`; saved session model/thinking/tool selections retain precedence. Does not call live runtime mutation/reload or automatically restart the current session. Displays resolved values, native source, scope, revision, trust and limitations.
- `node tests/agent-native-settings.test.mjs`: 10 passed, including exact patch/revision, null inheritance, 409 invalidation, untrusted project, late read/write isolation, duplicate-save suppression, numeric validation and bilingual state retention. Existing entry8/research7 regressions passed. TypeScript and Biome150 passed; build passed.
- README now documents native settings separately from historical phase-one-only behavior. Current frontend total: 427 checks. Real native file persistence/next-creation consumption still needs host+adapter evidence before D06 is considered fully verified.
- Actual integration now passed: `node --import ../../scripts/workbench-source-loader.mjs tests/agent-native-settings-integration.test.mjs`, 2 checks. Real NativeSettings handlers save global defaults through the running host, reject stale SHA256 revision with 409, save a trusted project override to actual `.pi/settings.json`, and retrieve correct global/project effective precedence. Worker count remains zero throughout: saving does not launch or mutate a runtime. Adapter next-runtime consumption evidence is tracked separately.

## 2026-10-14 — C04: explicit inherited saved-configuration execution

- Added an unchecked-by-default “使用继承合成值” control to the existing saved-configuration component; exact-scope execution remains unchanged. Changing inheritance invalidates the loaded snapshot and requires another explicit read.
- `resolution.ts` validates the full ordered global/workspace/session revision vector, including absent-layer revision zero, and verifies each resolved field's source belongs to that vector. Preview displays the actual resolved values, per-field sources, supported/excluded fields and complete vector.
- Explicit resolved POST includes `mode: "resolved"` and the unchanged GET revision vector, without sending `input.fields` or silently materializing inherited values into the leaf scope. Returned mode/vector/source/value must match the loaded evidence before showing a receipt.
- Receipts retain per-field source scope/revision and distinct behavioral/SDK-boundary/metadata evidence. CAS 409 clears executable state and requires reload. `stored:false` after concurrent source changes is labelled historical evidence only, never current configuration application.
- `node tests/module-operations.test.mjs`: 28 passed, preserving the previous 22 cases plus six resolved-mode cases: opt-in preview with missing layer0, exact wire vector/source receipts, concurrent-change historical evidence, CAS409, invalid vector/mismatched sources, and mode-switch late-read suppression. TypeScript and scoped Biome passed. No root check, paid model, commit or NativeSettings changes. Current frontend targeted total: 433 checks; these six additions are HTTP fixtures, not server concurrency proof.
- Deviation: native controls were added as separate components rather than expanding the central entry router. Full research inventory remains a static implementation baseline; it does not certify every indexed feature as implemented. Browser/real-provider validation remains pending.
