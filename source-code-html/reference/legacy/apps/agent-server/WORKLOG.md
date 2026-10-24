> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Agent server implementation log

## 2026-10-14 02:09 UTC: C03–C09 server foundation

Implemented independently scoped modules for HTTP transport, routes, storage,
workspace files, configuration, session/event persistence, SSE, worker lifecycle,
loopback model configuration, redacted audit and exclusive data-root locking.
No frameworks or ambient provider credentials are used.

### Verified acceptance evidence

Command from `apps/agent-server`:

`node --import ../../scripts/workbench-source-loader.mjs --test test/config-schema.test.ts test/server.test.ts test/boundaries.test.ts`

Result: 10/10 passing. Real child processes instantiate the native Pi SDK with
explicit faux provider. This is not an in-memory replacement of the runtime.

- C03: loopback HTTP, JSON API, same-origin static frontend, health/capabilities,
  strict request parsing and content-type/body limits. Static asset/CSP test passes.
- C04: atomic desired config persistence, per-module revisions and 409 conflicts,
  global/workspace/session precedence, independent server field validation for all
  original 153 fields. All defaults and range/type/choice/JSON negative tests pass.
  Generated schema has a drift check (`node scripts/generate-config-fields.mjs
  --check`). Desired values remain explicitly pending until runtime confirmation;
  broad native field application remains incomplete, rather than falsely applied.
- C05: server-owned workspace IDs; path containment, traversal and symlink
  rejection; bounded text read/write; create-only or exact-etag conflict checks;
  atomic replacement and serialized compare/write. Filename search is bounded to
  10,000 entries/1,000 results. Search acceptance being expanded.
- C06: sessions, run records, authoritative message replacement and event sequence
  stored together atomically outside repository. Restart restores transcript and
  native runtime session file. Interrupted run recovery records failure; it does
  not restart a model. Built-in coding-agent identity is static, not user CRUD.
- C07: real per-active-session subprocess, whitelist environment, private HOME and
  agent directories, bounded active count, run deadline, explicit cancellation,
  exit handling and server close cleanup. Two-session independence and timeout
  failure tests pass. Sessions replay across repeated worker lifetimes.
- C08: loopback-only binding; Host/origin/cross-site checks; no CORS allowance;
  audit contains timestamp/method/status only, not body/query/header/content.
  Secret configuration names rejected while legitimate maxTokens is allowed.
  This is a single-user loopback access boundary, not remote multi-user auth or
  a hostile-process OS sandbox. Strong isolation and arbitrary host tools remain
  explicitly unsupported until separate review.
- C09: malformed/unknown/oversized input, illegal path and symbolic link, concurrent
  stale file writes, revisions, missing workspace, configured-without-model,
  double data-root owner, interrupted run, timeout, abort and cleanup covered.

### In-progress integration / limitations

- Root `npm run check` belongs to parent. Local tsc exposed in-flight upstream
  settings types; no root/full test suite or paid provider run was invoked.
- Explicit no-auth local model endpoint bridge added; transport acceptance test
  still being added. No real external provider or local LLM has been contacted.
- Native module operations implemented by another worker are registered under
  `/api/modules/capabilities` and `/api/modules/:moduleId/:operation`; their
  operation-specific evidence is in `src/modules/WORKLOG.md`.
- Browser auth is same-origin loopback policy; no persistent credentials/tokens.
- POSIX containment checks reject static symlinks; this does not claim resistance
  to a separately privileged local process racing filesystem replacement.
- Event history currently retained on disk; no pruning/retention policy yet.
- Terminal integration is separately in progress. Existing unrelated Pi behavior
  and historical frontend delivery are unchanged.

## 2026-10-14 02:51 UTC: persistent runtimes, identity and effective settings

Supersedes the foundation's in-progress notes where explicitly verified below.

- C03/C08: configured mode now requires host-injected identity on all non-health
  APIs; session owner and workspace grants are enforced, including revoked
  workspace access to session configuration. Explicit local-owner CLI mode warns
  and remains loopback-only. No identity credentials are generated or stored.
- C04: saved revision execution selects supported fields from that scope only;
  actual operation receipts are stored only against the matching unchanged
  revision and become invalid after edits. SDK-boundary receipts do not claim
  supplier effects. Inherited desired values are displayed with sources but are
  not included in saved-scope module execution; resolved revision-vector execution
  remains a concrete limitation. Separate native settings GET/PUT uses actual Pi
  global/project files, digest revisions, native merge/null-delete semantics,
  workspace authorization, host opt-in and a host tool ceiling. New worker
  creation consumes those settings; existing workers remain unchanged.
- C05: HTTP directory creation, bounded filename search, text editing and stale
  etags tested. Hardlinks and credential-shaped JSON-string config are rejected.
- C06/C07: workers persist across prompts; native context/resources/extensions,
  model/thinking/tool selections, tree navigation, fork, compaction/export and
  queue commands route to the SDK. Queue rechecks running state atomically inside
  the child. Pending commands prevent capacity eviction. Fork holds an exclusive
  parent lease through native IPC, copy, publication and retirement, and new
  session records are published only after copy succeeds. Parent prompts during
  the post-IPC barrier return 409 and cannot corrupt parent session paths.
- Runtime tools: explicitly approved read/write/edit run inside the child through
  safe SDK wrappers. HTTP-to-worker write/read/edit tests verify actual workspace
  contents and persisted diff/tool facts. Code-mode and faux-only local MCP echo
  are assembled inside the child; neither implies a real external MCP connection.
- PTY: host opt-in, session-owned HTTP lifecycle wraps the terminal worker's real
  script/stty/xterm manager. Real input/resize/snapshot/close passes and shutdown
  awaits process cleanup. This remains a host shell, not an OS sandbox.
- Shutdown stops HTTP admission, drains admitted operations and active workers
  before releasing the root lock. A barrier test verifies late admitted writes
  complete before lock release.
- Models: local no-auth HTTP mock exercised real worker transport and unknown
  pricing stays null. Programmatic approvedRemoteModel validates an exact HTTPS
  origin allowlist and receives a host-owned in-memory credential only; startup
  performs no network/model requests. No real remote provider or actual local LLM
  was invoked. CLI does not accept provider credentials.
- Images: 8 MiB message-only body limits and lower ordinary-route limits cover
  Content-Length and chunked requests; bounded images reach the worker. Metadata
  projection is wired, but a new image-only persisted metadata assertion currently
  exposes an upstream runtime issue being investigated; do not mark it complete.

Evidence: 24 foundational/integration tests passed together before these final
race/settings additions. Later focused runs passed runtime-routes + worker-races
6/6 (including fork publication barrier), and native-settings + local-model +
tools-http 6/6. Server npm run check (153-field drift check + tsc) passed; scoped
Biome passed and server build.mjs produced main/worker bundles. Full root checks
remain parent-owned. No npm test/full Vitest, paid API, real credentials or Git
commit was used.

### 02:54 UTC final regression update

The image metadata assertion now passes using a valid PNG with trailing padding
instead of arbitrary bytes falsely labelled PNG. Native rejection of the original
invalid image was correct. HTTP image-only snapshots preserve MIME metadata and
never return base64. All 28 selected non-image server tests passed in one serial
run (37.6s), plus the dedicated image HTTP test passed (29 total). The frontend
owner separately verifies UI-to-native-settings HTTP integration. Module and
terminal implementation-specific suites remain owned by their respective workers.

## 2026-10-14 03:00 UTC: C04 inherited configuration execution

Explicit resolved mode now closes the earlier inherited-execution limitation.
GET configuration returns an ordered revisionVector including absent layers at
revision 0. Module execution accepts mode=resolved plus that complete vector;
values are resolved server-side global -> workspace -> session under the same
configuration queue used for patches. The complete vector is checked before
execution, then checked again before recording any receipt. Receipts are grouped
and written to each field's actual source record; inherited fields are never
invented in the target scope. Scope-only execution remains explicit and unchanged.
A barrier regression changes the global source after resolution and verifies
stored:false, no stale global receipt, and subsequent old-vector 409. Tests also
cover missing target scope, actual global/workspace sources, session override and
incomplete-vector rejection. UI integration is owned by the frontend worker.

Approved remote credentials are now required to be nonblank at startup, matching
the adapter contract; absent/whitespace/CRLF values are rejected before worker
creation. No credential is read from the environment or written to browser data.

### 03:05 UTC resolved receipt atomicity review

Resolved receipts now commit in one per-principal atomic transaction file, keyed
by target scope chain/module, containing the complete vector and actual field
sources. Configuration reads project them only while the entire vector matches.
Internal configuration mutation/resolution reads raw files so projected receipts
cannot accidentally become permanent scope-file state. This replaces the earlier
multi-file receipt writes: a failed commit cannot publish only the first source's
receipt. Fault injection verifies rejection leaves both global/workspace receipts
absent; a subsequent successful commit projects both, and a global source change
invalidates the workspace projection as well. Configuration values remain in their
existing files. Latest receipt + core server regression: 9/9 passed; full server
schema/TypeScript check passed. No journal or untested recovery protocol added.
