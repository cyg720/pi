> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Runtime adapter work log

Updated 2026-10-14 03:01 UTC.

## Redirect and nested MCP follow-up (03:00 UTC)
- Configured providers wrap public ProviderStreams methods with a host-controlled fetch. Every request verifies the exact approved endpoint origin; redirect:error blocks all automatic redirects. Streaming is forced to SSE so WebSocket selection cannot bypass the HTTP guard.
- Two pure loopback servers test both OpenAI API implementations with 302/307/308: initial requests reach the approved server; destination request count remains zero. Existing successful initial SSE test still passes. No external endpoint or real credential was used.
- Native Pi normally retains unmatched MCP tools for codemode/tool-search. Adapter now excludes mcp__* whenever no concrete MCP name is approved; with approved MCP names native exact matching applies. Host authorization names reject glob/modifier patterns.
- Direct and deferred negative tests verify MCP initialization really occurred, unapproved nested codemode call fails, tools/call count stays zero, and setTools cannot grant it. Explicitly approved MCP positive tests still pass.
- Focused models/extensions tests: 8 passed, 0 failed; scoped Biome and root typecheck passed at 03:00 UTC.
- Final six-file adapter regression run: 24 passed, 0 failed at 03:01 UTC, using env -i, fresh HOME and PI_OFFLINE=1.

## Security and settings follow-up (02:44 UTC)
- Independent host `allowedTools` ceiling now guards startup, saved loadout, mutations and enumeration. SDK registry is initialized with the ceiling, then active selection is applied separately. Empty authorization refuses read/bash; explicitly approved read/write and MCP can be disabled/re-enabled.
- `scopedSettings` explicitly opts in to façade-whitelisted global/trusted-project settings at runtime creation. Save→new runtime model/thinking/tools application, untrusted-project exclusion, next-creation timing and unauthorized defaults are tested. Explicit active options and saved session state have precedence. Pattern/modifier defaultTools are not supported by this restricted adapter; concrete approved names are required.
- Read/write/edit reject hardlinks; writes no longer open with O_TRUNC before checking regular-file/nlink. Synthetic outside hardlink content remains intact after all three tool attempts.
- Tool display text now derives from sanitized content; full MCP snapshot sentinel test covers JSON secret keys in actual tool output, not only the serializer helper.
- Image metadata contains MIME only, with native image base64 omitted from snapshots/events.
- Final follow-up targeted run: 21 passed, 0 failed at 02:44 UTC; scoped Biome and root typecheck passed. Full repository check remains parent-coordinated.
- Image-only follow-up at 02:53 UTC: valid PNG reaches the faux provider, message_end/snapshot/native-session reopen retain MIME metadata and omit base64 (workspace-tools tests 4/4). HTTP fixture using arbitrary bytes as PNG was rejected by native image normalization as designed; server replaced it with valid PNG plus padding and confirmed actual HTTP image-only MIME metadata and fixed/chunked size rejection at 02:54 UTC. No metadata is invented for rejected images.

## Verified implementation
- D01/D07: private `@pi-workbench/runtime-adapter`, public coding-agent SDK services/session/runtime factories only; no copied agent loop or private imports. Production dist exports, types, build/check/lint/clean scripts and exact dependencies.
- Runtime/types/events/extensions/models are separate modules. Server-only snapshots include a private sessionFile; browser conversion belongs to agent-server.
- Explicit faux mode with memory credentials and scripted responses. Configured mode requires explicit host-owned ModelRuntime plus exact model identity, without fallback.
- Default-deny tools, disabled untrusted resource discovery, in-memory untrusted project settings and no implicit auth.json loading.
- Prompt, busy rejection, abort including preflight race, authoritative message-end events, overall agent-settled events, snapshots, tool enumeration and idempotent graceful disposal.
- Message IDs remain consistent across deltas, aborted final messages, snapshots and restore. Normalized messages preserve thinking, toolCallId and usage; arbitrary runtime payloads are excluded.
- Session restore enforces session-directory containment and exact canonical project identity.
- D03: explicit codemode/MCP/tool-search factories; requested extension loading errors fail closed. MCP never implicitly discovers home-directory config; faux requires an explicit in-memory transport. Extension loaded is distinct from server connected.
- D05: real Pi codemode script tool execution and in-memory MCP direct tool calls, including transport shutdown, verified using faux model responses.
- D06 configuration subset: narrow native public façade `readWorkbenchSettings` / `patchWorkbenchSettings`; global/trusted-project scope, model/thinking/tool/codemode defaults, null inheritance, native merging/file locking, unknown fields preserved, invalid/sensitive fields and malformed JSON refused. This does not claim active-session application.
- `createConfiguredModelRuntime` accepts explicit HTTP loopback IP endpoints or exact host-approved HTTPS origins with explicit memory credential injection. Local mock SSE verifies transport without real models. External constructor tests make zero network requests. Host capabilities/pricing propagate; unknown pricing is null.
- D02: native steer/followUp queues, clearQueue, bounded capability-checked image inputs, active model/thinking/tools mutations. Saved allowlisted model, thinking and tool loadout survive disposal/reopen; invalid saved models fail rather than fallback.
- D06: native tree/branch/fork, compaction using actual faux-generated summaries, native JSONL export, canonical context including summary text and source, resource enumeration. Native session manager remains the history authority.
- F05/F07 adapter boundary: bounded JSON-safe tool arguments/results persist across snapshots; write/edit carry real path/diff/patch. Workspace wrappers reject traversal, outside paths, symlinks and protected files. Sensitive keys are normalized before redaction; JSON strings are structurally sanitized; free text is not complete DLP.
- Explicit faux-only local echo MCP factory is exported for serialized worker host options; it does not represent an external MCP service.

## Test evidence

Executed from this package with `env -i`, PATH only, fresh HOME and PI_OFFLINE=1:

`node --import ../../scripts/workbench-source-loader.mjs --test test/runtime.test.ts test/config.test.ts test/extensions.test.ts test/models.test.ts test/operations.test.ts test/workspace-tools.test.ts`

Result: 19 passed, 0 failed, including the exported local echo fixture. Covers persistence/restore, cancellation/reuse/disposal, hostile resource non-execution, configuration scope/merge/refusal, codemode/MCP lifecycle, local HTTP transport, queues, model/thinking/tool persistence, branches/fork/export, actual compaction summary projection, filesystem write/edit/refusal, serializer redaction/truncation and image capabilities.

Scoped Biome and root `tsc --noEmit --pretty false` passed at 02:33 UTC. Full `npm run check` is coordinated by the parent after parallel integration.

## Remaining boundaries
- No full vitest/e2e suite, no real credentials and no paid/real model calls were used.
- Worker hosts must use an allowlisted environment and isolated HOME; native provider availability checks can inspect ambient auth metadata even when catalog networking is disabled.
- Native defaults façade does not claim active application of every module setting. Model/thinking/tools have explicit live mutation APIs; broader module-specific application remains separate.
- Third-party MCP/OAuth and real local model availability are unverified, not represented by mock success.
- Endpoint restrictions apply per HTTP request and reject redirects; the explicitly approved service itself remains a host trust decision.
- File wrappers are not a multi-tenant OS sandbox against concurrent directory replacement. A project cwd alone never authorizes arbitrary absolute paths.
