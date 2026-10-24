> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Pi workbench host

Node >=22.19, same-origin frontend, native `node:http`, loopback binding only.
The repository is the deployment unit; the private evals export retains source.
Build root dependencies, protocol/adapter and frontend before the server bundle.

## Operator-selected local development

The default server has no provider and no anonymous configured-mode API access.
Set an absolute data directory outside this repository. Production identities are
supplied through the exported `startServer({ authenticate })` integration API.

For explicitly selected deterministic local testing:

```
PI_WORKBENCH_DATA_ROOT=/absolute/private/workbench-data \
PI_WORKBENCH_MODE=faux npm run start --workspace=@pi-workbench/server
```

Faux mode uses a clearly identified single local test owner, no paid provider and
no saved provider credentials. It is not a deployable multi-user auth system.

For an operator's no-auth loopback model server, explicitly enable local-owner
development access and select the exact endpoint/model. Merely supplying a model
does not enable anonymous access:

```
PI_WORKBENCH_DATA_ROOT=/absolute/private/workbench-data \
PI_WORKBENCH_TRUST_LOCAL_OWNER=1 \
PI_WORKBENCH_LOCAL_MODEL='{"provider":"local","id":"your-installed-model","baseUrl":"http://127.0.0.1:11434/v1","api":"openai-completions","contextWindow":8192,"maxTokens":512}' \
npm run start --workspace=@pi-workbench/server
```

This prints an explicit development-access warning. Do not reverse-proxy it to a
network. No model request is made until the user sends a prompt. Only loopback IP
HTTP endpoints are accepted by this command-line setup. No credential environment
variables, auth.json, shell profile, or provider login stores are inherited by
runtime subprocesses. Local-model tests use an HTTP fixture, not an actual LLM;
real local-model compatibility remains an operator acceptance check.

`PI_WORKBENCH_TERMINAL=1` is a separate explicit operator choice to enable a real
Linux PTY or Windows ConPTY. It is off by default. Opening a PTY requires the user's create action;
viewing the terminal panel does not spawn a shell. The shell is not an OS sandbox.
It receives a private HOME and a fixed non-secret environment. Do not enable it
for untrusted users or assume workspace cwd prevents host filesystem access.

Linux requires `/usr/bin/script`, `/usr/bin/stty` and `/bin/bash`; containers must
run an init/reaper (for example Docker `--init`) to reap orphaned exited jobs.
Windows uses pinned `node-pty@1.1.0` and the system `cmd.exe /d /q`, with a separate
bridge process for native handles and owner-disconnect cleanup. Install using
`npm ci --ignore-scripts`; the tested Windows x64 package includes its native
prebuild, so acceptance does not run dependency lifecycle scripts. The server
Windows x64 uses the locally patched ConPTY assets in `native/conpty`, with pinned
SHA-256 checks before loading. For source execution, run
`node scripts/prepare-workbench-conpty.mjs` from the repository root after installing
dependencies. The server build prepares its own scoped runtime automatically.
Keep the complete `dist` tree: `terminal/windows-worker.js`,
`terminal/node_modules/node-pty` and `native/conpty/manifest.json` are required.
The helper copies the pinned npm package into an owned scope; it does not change
the root `node_modules` package or run lifecycle scripts. Missing or mismatched
assets fail terminal startup instead of silently using the affected system ConPTY.
See `native/conpty/README.md` for provenance and the native patch.
Windows acceptance covers Node 24 on Windows build 26200, actual TTY input,
resize, Ctrl-C, exit and attached jobs. Other architectures, detached jobs and
arbitrary full-screen applications require separate acceptance.

## Authenticated host embedding

Import `startServer` and the `Authenticate` type from this package. Supply an
async `authenticate(request)` callback that verifies the host's actual identity
mechanism and returns `{ id, workspaceIds }`, or `null` on failure. Identifiers
must be stable safe strings; workspace grants are explicit IDs. The callback is
called for every request, so revocation takes effect immediately. Never trust an
unverified user-selected header. This package does not create or store identity
credentials. Host, Origin and fetch-site checks remain enabled even with auth.

Configured mode without that callback (or the explicitly selected local-owner
development flag) returns 401 for every API except health. Workspace grants and
session ownership are checked for file, runtime, PTY and config routes. Global
configuration means per-principal global defaults, not cross-user shared state.

Programmatic hosts may supply `approvedRemoteModel` instead of `configuredModel`.
It requires an exact `allowedOrigins: ["https://provider.example"]` allowlist,
explicit provider/id/API/baseUrl/contextWindow/maxTokens, and a nonblank
in-memory `apiKey` supplied by the host's credential handoff. No HTTP route or
CLI environment option accepts this credential. Neither startup nor validation
makes a model request. Worker IPC receives this explicit configuration; browser
responses, audit and worker logs do not. Construction/allowlist tests cover this
boundary. The 2026-10-14 local acceptance also exercised DeepSeek Flash text,
thinking, images, tools, queues, abort/recovery and compaction through this path;
see docs/workbench/LOCAL-TAKEOVER-TASKS.md. Other providers and invoice totals are
not covered by that acceptance.

Hosts may explicitly declare `capabilities.thinkingLevelMap` with `reasoning:true`.
It uses Pi's public mapping: off/minimal/low/medium/high/xhigh/max keys, provider
strings or null for unsupported levels. Without an explicit mapping, Pi can clamp
xhigh/max to high. No catalog is automatically substituted for the selected model;
check the provider's actual capability and outgoing request before claiming a level.

## Explicit live AI module operation

`POST /api/modules/ai/generate` uses that same host-approved model and guarded SSE
transport. Capabilities advertise it only when the host has a configured model.
The body accepts `input: { text, systemPrompt?, tools?, fields? }` and the existing optional
workspace/config reference. It never accepts a model URL, credential or executable
code from the browser. A requested model identity must exactly match the host.
Supported fields are model.provider/model.id, temperature, maxTokens, reasoning,
toolChoice, timeoutMs, maxRetries, maxRetryDelayMs and transport. The output limit cannot exceed
the host limit; timeout is 1..120000 ms, retries 0..3, delay cap 0..60000 ms, and
transport must be SSE. Client disconnect aborts the generation.

Tools default to an empty list; selected names must be host-approved workspace
read/write/edit tools. This single-generation operation sends their existing
definitions and returns proposed `toolCalls`, with `toolsExecuted:false`; it never
executes them or reads files for the model. Use the existing Agent operation for
execution. `toolChoice` supports `auto` (model may choose) and `none` (no calls),
not forced calls. Without tool declarations it is inactive. A receipt records
`auto` only when a declared call is observed, or `none` when offered tools produce
no calls in a successful response. Unexpected tool names or calls despite `none`
return failure and no verified fields. This is per-response evidence, not proof
that a tool executed or that every future provider response will obey.

The UI can explicitly copy its field draft, load a scope revision, merge those
operation fields into that scope, reload, then execute the saved revision. Saving
does not run a model and preserves unrelated scope fields. These are one-shot
generation parameters, not coding-agent defaults. Failed generation returns
`ok:false` and no newly verified fields. Successful inference alone does not prove
temperature, caching or retry semantics. Output truncation and observed thinking
are recorded separately; DeepSeek thinking mode leaves temperature inactive.
The whitelist of outgoing parameter values and response status codes is diagnostic
evidence, not a general claim of parameter effectiveness. Costs remain null unless
the host supplied pricing.

`PI_WORKBENCH_TOOLS=read,write,edit` enables only the named workspace tools.
`PI_WORKBENCH_CODEMODE=1` enables the built-in code-mode extension; its tool ceiling
remains host-controlled. `PI_WORKBENCH_LOCAL_MCP_ECHO=1` is a faux-only test fixture,
not a configured external MCP integration. These options are disabled by default.

## Explicit live Agent operation

`POST /api/modules/agent/live-run` runs the native Agent with the same configured
model and guarded workspace file tools. Its input is `{text, fields?, tools?,
steering?, followUp?, timeoutMs?, maxTurns?}`. Tools default to the host allowlist;
an explicit list must be a subset. The UI example selects no tools. Selecting
write/edit permits real changes in the authorized workspace; path/link protections
are shared with coding-agent. This is a one-shot operation, not a persisted chat.

Supported configuration fields are initialState.systemPrompt/messages/thinkingLevel,
toolExecution, steeringMode, followUpMode, sessionId, transport and maxRetryDelayMs.
As in the existing form schema, the messages field is a JSON string containing at
most 16 user-text messages with numeric timestamps. System text and each message
are limited to 16,384 characters. The host fixes the model, tools and SSE transport;
JSON tool declarations and thinking budgets are not executed by this operation.
The provider output limit is the smaller of 4096 and the host maximum.

The optional steering/followUp arrays each contain at most four text messages,
enqueued after the first assistant message ends. Native queue modes determine
their subsequent consumption. The operation allows 1..12 turns (default 6) and
1..120000 ms (default 120000), and aborts when the HTTP client disconnects.
Automatic provider retries are disabled, so maxRetryDelayMs is passed through but
is not claimed behaviorally verified. The response includes actual tool start/end
events, peak simultaneous tools, request message histories and model results.
Successful inference does not automatically verify instructions, cache behavior or
queue policies. Receipts mark only observed thinking, SSE and a measured multi-tool
batch's execution mode; actual file contents and expected responses require
independent acceptance checks. The existing faux tool-run remains labeled as such.

## Explicit persistent Durable operations

`POST /api/modules/durable/live-run` accepts `input: {operationId,text,tools?,fields?,
toolEnvironment?,deferredTools?,waitMs?,steering?,followUp?,continuation?}` and the existing workspace/config reference. It uses native Harness,
the host-approved model and fsync JSONL under the private data root. The operation
ID must be unused, 1..100 lowercase letters/digits/underscores/hyphens, excluding
Windows device names. Canonical spelling prevents filesystem aliases from
bypassing the operation lease. `live-inspect` accepts `{operationId}` and reads committed
records without scheduling. `live-resume` accepts `{operationId,waitMs?}` and uses
the original prompt, tool selection and configuration; it rechecks current host
model/tool authorization. Records are namespaced by principal and workspace.
These are separate persistent tasks, not coding-agent chat sessions.

Optional steering/followUp arrays contain at most four nonblank text messages each.
They are admitted after the base input with native `whenBusy:steer/followUp`; the
native boundary and configured queue mode decide consumption. Submission starts
scheduling, so admission is not an atomic batch and very fast runs may finish
before subsequent inputs arrive. Inputs and stable request IDs are persisted;
resume idempotently admits any missing inputs and waits for all submissions.
Inspection returns every admitted submission without scheduling. `ok:true` requires
all intended inputs and native tasks, including background compaction, to finish
successfully; `submission` is the base handle, `submissions` lists
all admitted handles, and `text` comes from the latest completed answer. Partial
answers on timeout do not make the overall operation successful. Completed queues
are not regenerated on resume. Queue parameters remain unverified in automatic
receipts; actual entry placement and responses require separate acceptance evidence.

The operation drains remaining native tasks within the same wait deadline before
closing its Harness. `tasks` counts every pending/failed task and includes at most
128 task summaries. Pending background work makes `resumable:true` even when all
input submissions have answers. Resume can finish that work without regenerating
the answers; it does not register old answers as newly observed field evidence.

`progress` reports changed partial messages observed in committed native `pi.live`
revisions during this HTTP operation. It includes the total count and at most 128
samples of commit sequence, elapsed time, generation identity and content lengths;
it does not duplicate partial message text. Inspect and already-settled resume
return no historical samples. These observations do not automatically verify a
configured interval: compare real runs and distinguish model generation timing
from commit throttling. Separate `outputCommits` and `outputSamples` count changed
running tool output, including nested tools; samples contain sequence, task/call
identity, elapsed time, retained length and dropped counts. Each sample list has
an explicit truncation flag. Workspace file tools do not publish streamed output;
native shell tools do. Neither observation automatically verifies `outputIntervalMs`.
Output throttling measures from the start of a write with a monotonic clock and
rechecks its deadline after timer wakeup. The samples above observe publication
after storage writes; variable storage latency can make their gaps shorter than
the configured start interval. They are not exact write-start timestamps.

The UI supports explicit save, reload and execution. The default tool environment
is `workspace`, installing guarded `workspace-files` read/write/edit tools.
`agent.cwd` must resolve within the authorized workspace and is the tools' root.
Read is replay safe; interrupted write/edit tasks retain native unsafe-replay behavior.
JSON fields use the existing form schema's JSON-string representation.

Native `coding-tools` requires a separate host-only `durableCodingTools` option:
`{id, allowedTools, open(workspaceRoot, signal?)}`. Allowed names are read/write/edit/
bash/powershell. `open` returns `{env: ExecutionEnv, close()}`; the host owns process
policy, credentials, isolation and cleanup. The browser may select `toolEnvironment:
"coding"` only when authorized, and cannot construct an environment or expand the
allowlist. Native tools keep their original schemas, output and replay policies.
An environment identity is persisted and checked again on resume; revoke tools or
change the host ID to reject an old operation. Each lease must reopen the same
persistent files, and close must release resources without deleting those files.
A local NodeExecutionEnv cwd is not a filesystem sandbox. No CLI setting enables
this capability, and the regular coding-agent tool ceiling is unchanged.

Both environments also register optional native `tool-search` and `codemode`.
`deferredTools` must be selected authorized tools; enable `tool-search` through
`agent.extensions` to discover them. Codemode uses QuickJS with a 16 MiB memory
limit and can call only registered, enabled tools. `codemode.inlineBudget` is
0..10000 (default 3000), and model catalogue helpers default off. Tool and extension
selection cannot exceed the host registry. These options do not authorize extra
processes or external services.

The wait limit is 1..120000 ms. Deadline or client disconnect closes and joins the
scheduler, preserving unfinished work for an explicit resume. Startup and inspect
do not resume it. An already settled submission is returned without generating
again and is labeled `persisted-provider-result`, with no newly verified fields.
`schedulingRequested` is not a network-request counter. Live results mark only
observed model identity/thinking; sampling, retry, cache, compaction, retention
and scheduling policies need their own behavior evidence. Stream uses SSE, timeout
1..120000 ms and provider retries 0..3; generation retry is separately configured,
disabled by default. Compaction is disabled by default in this explicit operation.

Local acceptance covers saved parameters, actual model/file effects, a paused
submission followed by a normal host restart, and explicit recovery. Hard-power
loss and a crash during a non-replay-safe tool remain unverified. Namespace metadata
is written by authorized run/resume operations, never from browser owner fields.
The offline relocation helper checks this identity against the original namespace
and moves the copied namespace to its new workspace path without editing task
JSONL or prompts. Nonempty legacy namespaces lacking metadata must first be run
or resumed by their original authorized host before backup; restore fails rather
than guessing their owner. Cross-operating-system path conversion is unsupported.

On Windows, the bounded Durable module's fixed `pwd` probe uses Pi's Git Bash discovery.
If Git is installed outside its standard locations, the operator may set
`PI_WORKBENCH_BASH` to the absolute Git Bash executable path. The bounded test runner
passes this one explicit setting through; no browser field can select a shell or
expand the fixed command. This does not enable a Windows PTY.

## Explicit real Env operation

An embedding host may supply `envDaemon.create()` returning an owned `Connection`,
a synthetic `inheritanceProbe` value matching the daemon's `PI_WORKBENCH_ENV_PROBE`,
and an async `close()` that reaps and verifies its disposable process/container.
This is a programmatic capability, never HTTP/JSON process configuration. The host
must provision a separate isolated Linux daemon for each call, with no credentials
or host mounts. The local acceptance host uses a pinned image ID, network disabled,
read-only root, non-root user, private tmpfs and process/memory/CPU limits.

`POST /api/modules/env/live-runtime` accepts `{input:{text?,fields?,verifyIdentity?}}` plus the
existing workspace/config reference. It performs real scratch file read/write,
shell output/exit, watch and PTY operations. Paths must be normalized under `/tmp`,
shells are `/bin/sh` or `/bin/bash`, and terminal argv is one of those shells with
optional `-l`. Poll interval is bounded to 10..2000 ms, directories to 1..10000,
and rows/columns to 1..1000. Execution is limited to 20 seconds; client disconnect
closes the Connection. Cleanup runs before the response is returned. Hosts must
bound their cleanup implementation separately. Failed cleanup is not success.

The optional `verifyIdentity:true` creates a second isolated daemon and exercises
the existing Durable file mutation queue using actual counter files. Two client
objects sharing one filesystem ID serialize their writes; distinct daemon IDs
use independent queues. Only a successful explicit comparison verifies `env.id`.
It is disabled by default and proves neither OS isolation nor cross-process locking.
Both owned connections are closed on cancellation and cleaned up before completion.

The UI supports saving, reloading and executing a revision. Receipts verify only
observed cwd, shell process identity, watch mode, terminal cwd/argv/dimensions
and environment inheritance. The shell's running executable is compared with
the selected path's real canonical target; PTY argv is read from `/proc`.
Native watch failures return `ok:false`, `failureStage:"watch"`, the daemon error
and no verified fields, instead of an opaque internal-server error.
Other fields remain sent-but-unverified; the operation does not prove namespace
isolation, watch directory caps or timing distributions. This does not enable SSH
or the separate Windows coding-agent PTY. The original protocol-only runtime action
remains labeled as controlled evidence. Without an explicit factory the new action
is unsupported and does not start a process.

## Explicit real Docker evaluations

The embedding host may provide `dockerEvals` with an absolute Docker executable,
immutable `without_docs`/`with_docs` image IDs, an approved provider/model, an
in-memory credential, allowed eval files and an explicit process environment.
HTTP configuration cannot supply images, executable paths or credentials.
`POST /api/modules/evals/live-discover` and `live-evaluate` accept `{input:{fields?}}`
and the existing saved-config reference. Fields are provider, model, requestedFiles,
discoveryArgs and runsPerVariant; JSON fields use the existing JSON-string schema.
Model identity must match the host. Files must be host-approved; discovery arguments
allow only test-name filters. Limits are four discovered cases, one to three pairs
per case, and a twelve-minute operation deadline.

Discovery runs both immutable containers with networking disabled and no provider
credential. Evaluation runs the native harness and judges against the real model,
with read-only root, resource limits, private temporary secrets and only its owned
artifact directory mounted. The credential enters stdin, never Docker arguments or
environment. Child environment uses a fixed system-variable allowlist. The original
Docker entrypoint isolates model tools from evaluator source and judge answers.
Client disconnect aborts the operation; each container is removed and cleanup checked.
Artifacts and native reports remain under principal/workspace-scoped private data.
There is no automatic resumption after interruption.

`ok` means a nonempty selection was discovered and, for evaluation, every pair has
measured scores. It does not mean every task scored 1. Missing/error observations
withhold comparison results. Scores and usage come from native reports, not browser
inputs; catalog costs are estimates, not invoices. Discovery alone does not verify
provider/model. Saved receipts apply only to the actual operation; a single pair is
not evidence of general model quality or documentation benefit. The existing plan,
selection and supplied-observation report actions retain their original evidence level.

## Native coding settings

`PI_WORKBENCH_NATIVE_SETTINGS=1` enables the native Pi settings facade; project
settings additionally require `PI_WORKBENCH_TRUST_PROJECT_SETTINGS=1`.
Embedding hosts use `nativeSettings: { projectTrusted: boolean }`.
GET `/api/settings?scope=global|project&workspaceId=...` and PUT `/api/settings`
use the same authorized workspace. PUT requires `{scope,workspaceId,revision,values}`;
revision is a digest of the actual native scope file. Stale writes return 409.
Only defaultProvider/defaultModel/defaultThinkingLevel/defaultTools/codemode are
accepted. `null` deletes an override. Tools cannot exceed the host allowlist.
Global files are per-principal under the private data root; project files use the
workspace's native `.pi/settings.json`. Native Pi resolves global/project values.
Changes take effect at the next runtime creation, not in an existing idle worker.
Saved session model/thinking/tools take precedence. Disabled or untrusted scopes
report `writable:false`; linked settings files are rejected.

## Storage, restart and shutdown

Data lives under the explicit root: workspaces, atomic session/run/event records,
per-principal configuration and content-free audit. Stop with SIGINT/SIGTERM on POSIX;
shutdown waits for runtimes, PTYs, local SDK operations and SSE cleanup. A lock
prevents concurrent owners of the same data root. A lock whose PID no longer
exists can be recovered; an invalid or live-PID lock is not silently removed.
Never edit these records while the server runs. Back up the complete root only
after stopping the server. Restore the complete directory with its permissions.
For a different data-root path, use `scripts/restore-workbench.mjs` as documented in
`deploy/WORKBENCH.md`; native session pointers and headers require offline relocation.

Windows `child.kill("SIGTERM")` forcibly terminates Node. A parent that launches the
CLI with an IPC channel should send `pi-workbench:shutdown` and await exit code 0;
IPC disconnection also closes the host. Embedding hosts can call `server.close()`
directly. No network shutdown route is exposed.

Sessions keep native Pi JSONL files private; browser snapshots omit local session
paths. A run interrupted by restart becomes failed, not resumed automatically.
SSE uses `event: run`, session-monotonic `id`, and Last-Event-ID replay. Snapshot
contains persisted events; `/replay?afterSeq=N` returns the same history as JSON.

Config writes require a matching revision. The generated 153-field host schema
rejects unknown keys, wrong scalar types, invalid options and unsafe JSON shapes.
Credential-bearing fields are rejected, including inside JSON-string form fields.
Saved values are desired values; they are not claimed effective until an explicit
operation returns a matching verified receipt. Persistent live session defaults
and local one-shot operation effects are distinct.
Saved-config module execution defaults to the selected scope's own values.
Explicit `config.mode: "resolved"` additionally requires the complete
`revisionVector` returned by GET config. The ordered vector includes global,
workspace and session revisions as applicable, including missing records at 0.
All sources are checked before execution and before recording receipts; a changed
source returns 409 before execution, or `stored:false` if it changes during the
operation. A single atomic receipt transaction records the entire vector and all
field sources. Reads project receipts only onto their actual source records and
only while the complete vector still matches; configuration value files are not
rewritten to store inherited receipts.
Native global/project settings above are a separate Pi-resolved path. A receipt
verifies only the named operation and matching fields, never future session or
supplier behavior.

## Deliberate security limits

- Loopback and same-origin are mandatory; public/remote binding is unsupported.
- Authentication integration is supplied by the embedding host; local-owner flags
  are explicit development modes, not remote-user authentication.
- File routes reject traversal, static symbolic links, hardlinks and oversized or
  non-text edits, and use compare-and-replace etags. This is not a defense against
  a privileged local process racing filesystem replacement.
- Runtime subprocesses currently have no native host tools by default.
- Secret data is not included in HTTP audit records or worker stdout/stderr logs.
- PTYs have real host effects and are never represented as a secure sandbox.
- Event history is retained; long-running operators must manage disk capacity.

Targeted tests are individual `node --import ../../scripts/workbench-source-loader.mjs
--test test/<name>.test.ts` invocations. `check:schema` verifies generated schema
drift; root integration/check is owned by the repository-level workflow.
