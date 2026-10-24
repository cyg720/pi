> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Protocol work log

## 2026-10-14 02:37 UTC — terminal, image and durable message wire facts

- Exported TerminalSnapshot/TerminalScreenRun/TerminalColor wire types without
  server dependencies. Added optional toolCalls/toolResult/source message facts;
  authoritative message replacement preserves these JSON facts.
- Prompt images accept PNG/JPEG/WebP/GIF inline base64, at most 8 images,
  5 MiB encoded per image and 7 MiB combined, with 8 MiB prompt JSON allowance.
  Empty text requires at least one image. All other JSON parsers retain 1 MiB
  defaults. Server transport byte limits and actual model capability checks are
  separate. Image bytes are never validated as a real image by this DTO alone.
- Evidence: protocol tests 10/10, browser-safe package build passed. No runtime
  dependency added. Runtime/server own persistence and sanitized image summaries.

## 2026-10-14 01:57 UTC — C01 verified

- Added private ESM `@pi-workbench/protocol@0.1.0`, wire version 1, zero runtime dependencies.
- Added health/capabilities/errors/config expected-versus-effective metadata, agent/workspace/session/run/message/file DTOs and strict request parsers.
- Parsers reject unknown structural fields, unsafe keys, non-JSON values, accessor properties, malformed scope/revisions, excessive size/depth/count, and unsafe lexical file paths.
- Evidence: `npm run check --workspace=@pi-workbench/protocol`, `npm run build --workspace=@pi-workbench/protocol`, and `node --test packages/agent-protocol/test/protocol.test.ts` passed (8 tests); local Biome check passed after formatting.
- Browser isolation: compilation uses `types: []`, `lib: [ES2024]`; source has no runtime/Node imports. Tests alone use Node built-ins.
- Deviations: none. Module-specific semantic validation, transport byte limits, filesystem realpath containment, and secret redaction remain server responsibilities. Root integration/check belongs to the parent task; no root manifest/lock edits made here.

## 2026-10-14 01:57 UTC — C02 verified

- Defined session identity versus one-shot runs, state transition helpers, terminal states and cancellation race behavior.
- Defined per-session persistent sequence, idempotent prompt request IDs, replay cursor/retention-gap recovery, terminal-event ordering, restart recovery and snapshot consistency requirements in README.md.
- Added sequence classification and immutable message reducer; `message_end` replaces partial content authoritatively.
- Evidence: named sequence, transition, and authoritative-final-message tests passed in the same 8-test run.
- Deviations: protocol contract and helpers verified; service persistence/replay and runtime settlement integration must be tested separately, not claimed complete by this package.

## 2026-10-14 02:08 UTC — persisted event hydration

- Added optional SessionSnapshot.events, agreed between UI and server owners, with the same atomic latestSeq boundary. Snapshot messages remain authoritative; retained events must not be replayed as deltas onto already hydrated messages.
- Package check/build and all 8 named tests pass again.
