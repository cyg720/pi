> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Workbench protocol

Browser-safe, dependency-free ESM DTOs and strict request parsers. Import from
`@pi-workbench/protocol`. The wire protocol version is `1`; the private npm package
version is independent. Runtime objects, credentials, raw error stacks, functions,
raw binary objects, and class instances must not cross this boundary. Explicit
image request DTOs are the only bounded base64 attachment form.

## Requests and configuration

- `parseNewSessionRequest`: `{ workspaceId, name? }`
- `parsePromptRequest`: `{ text, requestId, images? }`; each image is
  `{ type: "image", mimeType, data }` with inline base64 PNG/JPEG/WebP/GIF data.
  At most 8 images, 5 MiB encoded per image and 7 MiB encoded combined. Empty
  text requires an image. Prompt JSON allows 8 MiB; other JSON defaults remain
  1 MiB. Servers must opt into the prompt byte limit only on that route.
- `parseConfigPatchRequest`: `{ scope, moduleId, revision, values }`
- `parseFileWriteRequest`: `{ path, content, etag }`
- `parseReplayRequest`: `{ afterSeq }`

Scope is `{ kind: "global" }`, `{ kind: "workspace", id }`, or
`{ kind: "session", id }`. `revision` is the expected current saved revision.
The server atomically checks it and increments on successful save; stale writes
return `CONFLICT`. PUT replaces the selected scope/module's entire values object;
it is not a field-level patch. Resolved reads merge fields across scopes, with
effective precedence session > workspace > global. Null is a value, not a deletion instruction.
The server must separately validate known modules, allowed fields, and semantics.

Saving values does not imply runtime application. `effectiveness` reports each
field's application status, confirmed effective value and revision, or a reason.
Before confirmation, effectiveRevision is null and status is pending/unsupported.
Config reads must redact secrets, including effective values and errors.

All parsers reject unknown structural fields, unsafe property names at any depth,
accessors, inherited custom prototypes, symbols, nonfinite numbers, sparse arrays,
cycles, and excessive depth, count, or decoded JSON size. They copy accepted data.
Servers must also bound raw request bytes before decoding JSON (suggested 1 MiB),
then use `parseJsonText` and the endpoint parser. Limits use UTF-16 code units.
Paths receive lexical checks only; server-side realpath/symlink containment and
authorization are mandatory. Etag null means create-only; other writes require an
exact current etag and atomic conflict checking.

## Sessions, runs, streaming, and recovery

A session is persistent conversation identity. Each accepted prompt creates a new
run with its own immutable runId; a terminal run is never restarted. `requestId`
is an idempotency key scoped to the session: an existing key returns the original
run without comparing or applying a new payload. Clients must retain the original
text/images for retries and use a new key for a new request. Only one active
run per session is supported unless a later capability explicitly adds a queue.

States are idle → running → cancelling → aborted, with completed or failed also
possible from running/cancelling. Cancellation acknowledges intent; only confirmed
runtime settlement establishes the terminal state. A cancellation racing natural
completion may end completed. An error event alone does not terminate a run.
The server emits exactly one terminal status, after final message/tool events.
Runtime per-turn completion is not equivalent to whole-run completion.

Every event carries version, sessionId, runId, seq, timestamp, type and payload.
seq begins at 1 and increases across all runs within a session; it is persisted
before publication and never reset after restart. Consumers verify session/run
identity, ignore seq <= last applied seq, and recover any gap before applying more.
Text/thinking are deltas. `message_end` replaces all accumulated content for that
message ID with its authoritative snapshot; never append the final snapshot.
Snapshots may retain JSON tool calls/results, summary source, and image attachment
MIME summaries without returning base64. Public terminal snapshot/color/run DTOs
are presentation data only; they grant no terminal execution capability.

Reconnect requests `afterSeq` (last applied event; 0 on initial subscription).
The server atomically joins retained history and live events without a gap, and
returns only newer events in order. If retention cannot satisfy the cursor, it
returns REPLAY_UNAVAILABLE and the client fetches a session snapshot, sets its
cursor to snapshot.latestSeq, and resumes. The snapshot and cursor must be captured
atomically. A cursor beyond latestSeq is INVALID_REQUEST. Recovered active runs
whose workers are gone must become failed/aborted with a persisted terminal event;
never silently resume model requests. Server-side retention policy is explicit.

## Verification

From the repository root:

```
node --test packages/agent-protocol/test/protocol.test.ts
npm run check --workspace=@pi-workbench/protocol
npm run build --workspace=@pi-workbench/protocol
```

The package type check uses no Node or DOM ambient types. Only tests import Node.
