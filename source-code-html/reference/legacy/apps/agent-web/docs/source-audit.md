> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Pi full-package workbench coverage

Source: `pi-source`, verified HEAD `7d75a0e3eb273dff753d49c066ea29fbe7b3b6f6`. This is a source capability audit, not a claim that the new UI implements these capabilities. All paths below are relative to that checkout. No source files were changed. Browser suitability is an architectural classification, not a completed bundle/runtime test.

## Inventory and boundary

There are eleven package directories. Ten remain in scope after excluding `packages/coding-agent`: `ai`, `agent`, `durable`, `mcp`, `codemode`, `env`, `chord`, `telemetry`, `tui`, `evals`. There is no `apps/` directory and no `web-ui` package. All ten manifests are version 1.2.0. Public runtime manifests require Node >=22.19.0; evals is private and has no public entrypoint.

| Directory | Package | Role and runtime boundary |
|---|---|---|
| ai | @earendil-works/pi-ai | Headless provider/model/auth/stream/image/classifier library. Core and ordinary provider factories are browser-capable; production requests should use a secret-preserving backend. Bedrock and OAuth login are Node-only. |
| agent | @earendil-works/pi-agent-core | Headless in-memory agent loop/state/events. Browser-capable with browser-safe streamFn and tools; persistence and real tool backends are host responsibilities. |
| durable | @earendil-works/pi-durable | Experimental durable harness, storage, documents, tasks, tools. Portable core/memory/adapters; Node and Cloudflare storage/environment entrypoints require their respective hosts. |
| mcp | @earendil-works/pi-mcp | Transport-neutral client, HTTP and stdio, OAuth. Core/HTTP can be adapted to a browser with CORS/auth support; root export includes Node stdio, so do not assume whole-root browser bundling. |
| codemode | @earendil-works/pi-codemode | QuickJS-WASM capability-limited scripts. Root worker sandbox is Node/Bun; portable inline needs supplied WASM and interrupt policy; remote Cloudflare needs deployed Worker/DO. |
| env | @earendil-works/pi-env | Node client and Rust daemon, SSH deployment, remote files/processes/PTY. Requires OS/backend; cannot be a direct browser runtime. |
| chord | @earendil-works/chord | Browser/Node typed contracts, object hosts, RPC and replicated JSON. /node child-host manager and module loader are Node-only. |
| telemetry | @earendil-works/pi-telemetry | Portable explicit span context/contracts/schema types, no-op and in-memory adapter; no built-in hosted analytics or exporter. |
| tui | @earendil-works/pi-tui | Terminal renderer/components, stdin/stdout and native platform integration. Web surface should inspect/configure/show visual counterparts; full TUI execution needs a terminal host/bridge. |
| evals | @earendil-works/pi-evals | Private coding-agent behavioral evaluation harness and Docker documentation comparisons. Inspect config/reports only under coding-agent exclusion; execution depends on excluded package. |

Manifest dependencies: ai→telemetry; agent→ai; durable→ai,chord,codemode; env→durable,chord; mcp and codemode have no other Pi runtime dependency; evals→ai,coding-agent (dev). TUI demos may call AI but its runtime manifest has only marked and get-east-asian-width.

## Honest UI capability states

Use separate states: `Browser live` (actual tested Pi invocation), `Local utility` (actual tested pure operation), `Configuration only` (editor/export with no runtime invocation), `Backend required`, `Native terminal required`, `Dependency excluded`, `Example only`, `Unavailable/error`. Do not convert a source capability into a green connected status. Do not make run buttons generate fictional model replies, SSH sessions, MCP tools, span durations, token costs, durable commits, or sandbox execution. A local mock/demo must be explicitly labeled. Configuration saved in browser storage is not a durable Pi session. A library listing is not feature implementation.

Each screen should expose: feature title, source path/symbol, state badge, runtime explanation, actual inputs, validation, action/result or explicit disabled action, and optional advanced JSON. Unsupported parameters are hidden/disabled by concrete model/provider metadata, not silently ignored by a supposedly universal form.

## AI screens and parameters

Sources: `packages/ai/src/index.ts`, `models.ts`, `models-store.ts`, `types.ts`, `auth/*`, `model-catalog.ts`, `providers/all.ts`, `api/*`, `utils/*`; README Browser Usage explicitly documents Bedrock/OAuth limits.

| Screen/feature | Inputs, outputs and API mapping | Boundary |
|---|---|---|
| Models/catalog | `getProviders/getModels/getModel/getAllModels/getModelsOfType/getModelOfType`; model type chat/image/classifier; provider,id,name,api,baseUrl,input,cost,contextWindow,maxTokens,reasoning/inputLimits and provider-specific capabilities | Static catalog genuinely local; available/auth-filtered catalog requires credential state. Refresh options providers/allowNetwork/force/signal via ModelsRefreshOptions. |
| Providers/auth | setProvider/deleteProvider/clearProviders, checkAuth/getAvailable/getAuth/login/logout; CredentialStore and ModelsStore adapters; provider env and header transforms | Store secrets on server, show redacted metadata. Login OAuth is Node-only. Registering provider is not authenticating it. |
| Chat playground | `stream/complete/streamSimple/completeSimple`; messages system/user/assistant/toolResult; system prompt and tools carried in transcript system entries | Network/auth/CORS dependent, provider proxy recommended. |
| Common generation | temperature,maxTokens,samplingParams(JSON),reasoning,thinkingBudgets,toolChoice auto/none,transport sse/websocket/websocket-cached/auto,cacheRetention,sessionId,websocketConnectTimeoutMs,metadata | Sampling JSON applied only by compatible OpenAI-style adapters. Reasoning choices must follow model metadata. |
| Request policies | timeoutMs,maxRetries,maxRetryDelayMs; signal,headers,env,fetch,onPayload,onResponse,onProviderStreamEvent,telemetryContext | Functions are host adapters/hooks, not free-text values that magically execute. Some providers ignore unsupported options. |
| Streaming inspector | start/text/thinking/tool-call updates, done/error; partial tool JSON; frame encoder/decoder and transcript utilities | Source utility operations may run locally; real events require a request. Show stopReason pending/stop/length/toolUse/error/aborted/deferred accurately. |
| Tools/schema | Tool name,description,parameters; constrained sampling schema/grammar variants; validateToolArguments | Declaring schema is not implementing or executing a tool. |
| Deferred requests | streamDeferred/fetchDeferred/cancelDeferred; deferred bool or window 15m/1h/24h; fetch `wait`; opaque DeferredHandle | Only capable providers, persisted server handle; not a universal background-job API. |
| Images | generateImages(imageModel,{input:[text/image]},options); metadata, provider-specific options, response output/usage/stopReason | Image generation is separate from chat image input; do not invent width/quality options unsupported by chosen adapter. |
| Classification | classify(classifierModel,{state,images?,questions},options); choice instructions+criteria map; score instructions+criteria array; bool true/false criteria; temperature | Results choice/probabilities/confidence, score/confidence, bool probability. Requires classifier-capable model, optional images require image input. |
| Custom providers/compat | createProvider, lazyApi, custom models/base URL/auth/stream implementations; legacy compat export; fauxProvider | Source adapters, not universal plug-and-play endpoints. Faux must be visibly synthetic. |
| Diagnostics/transcript | retry/overflow estimates, usage+cost, cross-provider handoff, context serialization, session resource cleanup | Preserve absent usage as absent; do not fabricate zero costs. |

Provider-specific options must come from the matching interfaces, not a universal guessed field set: AnthropicOptions (`api/anthropic-messages.ts`), OpenAICompletionsOptions, OpenAIResponsesOptions, OpenAICodexResponsesOptions, AzureOpenAIResponsesOptions plus AzureEndpointOptions, GoogleOptions, GoogleVertexOptions, MistralOptions, BedrockOptions, PiMessagesOptions. OpenAI Codex is an AI provider and remains in scope despite exclusion of the different coding-agent package. Static provider factories and catalog data are enumerated by `providers/all.ts`; include dynamic `radius` rather than treating static generated catalog keys as the entire provider list.

## Agent screens and parameters

Sources: `packages/agent/src/agent.ts`, `types.ts`, `agent-loop.ts`, `stream-fn.ts`, `proxy.ts`, README.

| Screen/feature | Source-aligned mapping |
|---|---|
| Conversation/run | Agent.prompt(text/images or messages), continue, abort, waitForIdle, reset; transcript/message replacement and append; current model, thinkingLevel, tools; isStreaming, streamingMessage,pendingToolCalls,errorMessage |
| Queue controls | steer/followUp, clear queues, steering/follow-up mode all/one-at-a-time; toolExecution parallel/sequential; per-tool executionMode |
| Events | agent_start/end, turn_start/end, message_start/update/end, tool_execution_start/update/end with args,result,isError,durationMs only if actually measured |
| Tool registry | name,label,description,parameters,outputSchema,prepareArguments,execute,replay never/safe; content/details/structuredContent/isError/usage/terminate |
| Lifecycle policies | prepareRequest,prepareNextTurn,finishTurn; beforeToolCall block/reason/terminate; afterToolCall field overrides; convertToLlm and transformContext |
| Stream connection | streamFn/getApiKey; sessionId/thinkingBudgets/request options; proxy transport via proxy.ts |

Browser live requires actual safe tools and provider stream adapter. This package does not itself provide durable persistence, SSH execution, coding-agent session commands, a filesystem tool suite, or a finished chat UI.

## Durable screens and parameters

Sources: `packages/durable/src/index.ts`, `harness/{types,agent,harness,events,view,live,inbox,registry,task-graph}.ts`, `types.ts`, `documents.ts`, `entries.ts`, `tasks.ts`, public subdirectories below. Experimental label should be visible.

| Screen/feature | Inputs/results |
|---|---|
| Sessions/storage | Harness.open/root/close/resume/closed; memory; SQLite node; JSONL node with fsync option; Cloudflare DO SQLite; portable storage facades; one process owns storage (no cross-process locking) |
| Conversations | createConversation/fork(entryId)/configure/reset(handoff)/abort({background?}); ownership ownerless/task; agent model{provider,modelId},thinkingLevel,extensions,tools,modelTools,instructions,cwd; names persisted, implementations supplied by registry |
| Submit/inbox | input content/requestId/whenBusy steer,reject or default follow-up; write entry; wait/submission.abort; requestId idempotency; queue modes all/one-at-a-time |
| Transcript/live view | entries + docs pi.agent,pi.provider,pi.live,pi.inbox,pi.usage; viewState/watch and watchEvents; deltas, late-join snapshot, bounded slow-consumer resnapshot |
| Task graph/inspection | pending,running,waiting,completing; ownership,conversationId,background,abort; wait policy allSettled/failFast; checkpoint phases; abandonOnRestart; harness.inspect reports missing task definitions (not a task graph field) |
| Compaction | compact/manual result, automatic/background/overflow retry; enabled,reserveTokens=16384,keepRecentTokens=20000,backgroundTokens=32768; live failure/status and compaction hooks |
| Runtime settings | stream options; retry enabled/maxRetries=3/baseDelayMs=2000/maxAgentDelayMs=60000; progress partialIntervalMs=100/outputIntervalMs=100; toolExecution; steeringMode/followUpMode; contextRetentionMs/documentRetentionMs |
| Extensions | defineExtension/createRegistry install/uninstall/reload; tools,sections,hooks,wraps,tasks; section order,instructions; running code finishes under old version |
| Tools | defineTool parameters/structuredOutputSchema/callers model/tools/deferred/replay; executeTool nested calls, keyed replay,output/details/structuredOutput/diagnostics/usage/control; live nestedTools |
| Built-in tool forms | `/tools`: read(path,offset,limit),write(path,content),edit(path,edits:[{oldText,newText}]),bash(command,timeout seconds), optional createPowerShellTool(command,timeout). No environment means real error, not browser filesystem access. |
| Code mode | `/codemode`: createCodemodeExtension/createCodemodeTool, CodemodeStoreDoc, nested calls and tool declarations. Independent of coding-agent package. |
| Deferred tool search | `/tool-search`: createToolSearchExtension/createToolSearchTool; deferred tools become model-visible when loaded through control.addTools and stay loaded on branch/compaction |
| Documents | defineDoc/defineDocFamily,kind/version/scope,history latest/rewindable,fork initial/current/asOf,initial; atomic commit edits and entries, snapshot/snapshotAsOf/watchDoc/documentState |
| Execution environments | `/env` portable FileSystem/Shell contracts; `/env/node` NodeExecutionEnv; files/readers/watch/exec argv or shell; env id namespaces and per-conversation cwd |
| Image preparation | `/images`, `/images/node`, `/images/cloudflare`: Photon WASM, orientation/resize/conversion; default read image limits 2000x2000 and 4.5MB base64; worker option/idleMs for Node |
| Usage/errors/conformance | harness.usage aggregates model and tool actual usage including failed attempts; SessionFailed storage failure closes harness; StorageRequestError invalid call; /testing storage/env conformance |

Memory-backed durable core can support an honest ephemeral local demo if actually bundled and invoked. Persist/resume claims require actual storage adapter and restart testing. Runtime tools, Node files and process execution require backend. Do not exclude durable CodingTools just because the name contains “coding.”

Additional exact Durable extension parameters: tool_search takes nonempty `query` and positive integer `limit` (default 8), returns `details.loaded`. Codemode tool takes `{code}`; CodemodeToolOptions requires `sandbox`, supports `namespaces`, `inlineBudget` (default 3000), `models` (default true), host `globals`. Script discovery globals are `searchTools`, `describeTool`, `describeNamespace`. With models enabled it exposes `models.getModelsOfType`, `models.getAvailableOfType`, `models.getModelOfType`, `models.classify`, `models.generateImages`; at most four classify/image calls run simultaneously. These are Durable's integration, not automatic globals of standalone pi-codemode. Sources: `src/tool-search/tool-search.ts`, `src/codemode/{codemode,models,describe}.ts`.

## MCP screens and parameters

Sources: `packages/mcp/src/client.ts`, `protocol/{types,content,jsonrpc}.ts`, `transports/{stdio,streamable-http}.ts`, `oauth/index.ts`.

- Connection: McpClient name/version/capabilities/protocolVersion/requestTimeoutMs/roots; connect,ping,close; serverInfo/serverCapabilities/instructions/protocolVersion.
- HTTP: url,headers,openGetStream,maxMessageBytes,reconnect initialDelayMs/maxDelayMs/maxRetries,authProvider/injected fetch. Show connection/auth/reconnect/session-expired errors distinctly.
- Stdio: command,args,cwd,env,inheritEnv,stderr pipe/inherit,maxMessageBytes,maxStderrBytes,closeTimeoutMs. Node/backend only.
- Tools: listTools,callTool(name,args),input/output schemas,annotations,structuredContent,content,isError; per request timeoutMs/signal/onProgress. Progress renewal and cancellation are supported.
- Resources: listResources and listResourcesPage(cursor),listResourceTemplates and page variant,readResource(uri). These exist in source even though README protocol summary is incomplete.
- Notifications/requests: onNotification,onError,onClose,setRequestHandler,notify; roots/list and ping handling; tool-list changes/logging through generic notification API.
- OAuth: discovery,PKCE,dynamic registration,refresh,insufficient_scope step-up; provider state store and callback server. UI may inspect states but credentials/callback host need proper backend and authorization.
- Content conversion: toLlmContent preserves text/images, placeholders audio/resource-link/binary, unwraps embedded content; structured-only result becomes JSON.
- Test transport: /testing in-memory pair is useful for clearly labeled protocol demo.
- Explicitly unsupported initial protocol surface: batch JSON-RPC, legacy HTTP+SSE, server implementation, sampling and tasks. Do not display those as live MCP features.

## Code mode screens and parameters

Sources: `packages/codemode/src/{types,source,declarations,portable,index,wasm}.ts`, `runtime/{host,inline,remote,execution}.ts`, README.

- Source editor/parser: async-function body, top-level await/return; optional first line `// @options:` JSON with max_output_tokens and timeout_ms. Parser validates but caller applies limits.
- Injected capabilities: tools/globals with name,description,inputSchema,outputSchema; globals spread/signature; tools expose sanitized identifier and original bracket name; ALL_TOOLS listing.
- Sandbox config: timeoutMs default300000,memoryLimitBytes; Node wasm/workerUrl; portable inline wasm and interrupt budget; remote exchange adapter.
- Runtime script primitives: text,image(data-only),console,exit,store/load. No fetch,process,require,timers or modules in sandbox. Do not implement Run with native eval/Function in browser.
- Result: ok,value,error kind script/timeout/aborted/sandbox,output text/image,calls name/status/durationMs,successful storeWrites set/delete. Store writes require explicit host persistence.
- Deterministic run: start(code,{startedAt,seed,tools,globals,store,onStarted,onCall,onIdle}), deliver(seq,now,id,outcome); fingerprint and ordered results, signal/timeout.
- Local browser candidate: source parsing,identifier conversion,renderDeclarations,renderToolSignature/schemaToType are pure operations. Actual inline sandbox needs WASM asset wiring and safety testing; it blocks its calling thread. Cloudflare remote needs deployed sandbox Worker/DO.

## Environment screens and parameters

Sources: `packages/env/src/{index,connection,remote-env,ssh,terminal,watch,list-files}.ts`, `daemon/`, `docs/{protocol,semantics}.md`.

- Hosts/SSH: host,user,port,identityFile,knownHostsFile,hostKeyAlias,ssh,configFile; scan/accept/forget host keys,detectPlatform,deployDaemon,connectSsh/sshConnection. Host key acceptance is a security decision, not automatic fake success.
- Connection: daemon command,info/error/log/close state; localDaemon/packagedDaemon; supported linux/android/darwin/windows x64/arm64. Binary deployment verified by SHA-256.
- ExecutionEnv: id,cwd,shellPath,shellEnv,watch; filesystem metadata/read/write/append/truncate/flush/rename/remove/create dirs/temp files; positional binary and paged directory readers; native/polling watchers; abort/cancellation and cleanup.
- Tree listing: hidden(defaulttrue),gitignore(defaulttrue),exclude,maxEntries(default50000),maxBytes(default4MiB),timeoutMs(default10000); entries path/kind,truncated; no symlink following and .git omitted; older daemon not_supported with fallback.
- Commands: string shell vs argv direct; cwd,env,inheritEnv,timeout seconds,onOutput stdout/stderr,spill afterBytes/afterLines,window maxBytes/maxLines/minIntervalMs/bytesPerSecond; result exitCode/spillPath.
- Terminal: openTerminal cwd,argv,env,inheritEnv,cols,rows,onData; input/resize/exit/foreground status. PTY terminals are not supported on Windows yet. Browser UI requires authenticated bridge and terminal frontend; package is not a browser SSH client.

## Chord screens and parameters

Sources: `packages/chord/src/index.ts`, `host.ts`, `contract.ts`, `declare.ts`, `state.ts`, `reload.ts`, `delta/index.ts`, `node.ts`, docs/guide.md.

- Contracts: local/remote, name/version,input schema,variants,state,methods method(input,output),opaque,bind/coverage. Show this as typed developer inspection, not an end-user plugin marketplace.
- Host/object inspector: createHost name/principalKey; serve/get/root handles, principal/routing/address/state/lifetime; defineFacet/defineRegistry,load/reload/dispose and errors.
- State: cell,derivation,listener,resource; subscriptions; replicatedState snapshots/deltas; delivery context/sequence and backpressure. Real browser example may use memoryLinkPair.
- Links/RPC: memoryLinkPair,ipcLink,webSocketLink,acceptWebSockets; transport configuration and connected state require actual link. Node IPC requires host.
- Delta lab: track,beginChange,prepare,adopt,applyImmutable; JSON edits/string append/front truncation/arrays/sets/deletes; immutable ownership and callback rollback. Can actually execute in browser.
- Context: explicit cancellation/values via /context, withCancel/withAbortSignal/withoutAbortSignal/withContextValue/awaitWithContext.
- /node: createHostManager,forkDriver,childControl,processLock,nodeLoader; native backend only. Reload preserves state and in-flight work semantics; do not simulate successful process replacement.

## Telemetry screens and parameters

Sources: `packages/telemetry/src/{index,memory,noop}.ts`, `testing/index.ts`.

- Adapter selector: NOOP_TELEMETRY_CONTEXT/InMemoryTelemetryContext or externally supplied adapter. No default exporter or dashboard service.
- Span tree: startSpan({name,attributes},callback),child spans,addEvent,setAttributes,setStatus ok/error with name/message; context passed explicitly (not automatic ambient tracing).
- Recorded data: id,parentId,name,attributes,events,status,settled,endSequence. The in-memory contract does not supply timestamps/durations; UI must not fabricate them as source values.
- Schema inspector: version,spans,description,parents any/root_or_external/spans,startAttributes required flags,endAttributes,events,status,errorWhen; attribute types scalar/array strings/numbers/booleans,sensitive/cardinality metadata,enum values/examples.
- defineTelemetrySchema/createTypedSpanStarter provide typing; no runtime schema validation is performed by typed starter. /testing supplies adapter conformance.

## TUI screens and parameters

Source: `packages/tui/src/index.ts` is more complete than README; `components/*`, `tui.ts`, `tui-alt-screen.ts`, `tui-main-screen.ts`, `terminal.ts`, `terminal-image.ts`, `keybindings.ts`, `keys.ts`, `colors.ts`, native platform modules.

- Component showcase: Container,Box,Text,TruncatedText,Input,Editor,Markdown,Loader,CancellableLoader,SelectList,SettingsList,Spacer,Image,HStack,VStack,ScrollView,MouseRegion. A DOM visual counterpart should be labeled a showcase, not the actual terminal renderer.
- Layout/overlay inspector: main-screen vs alternate-screen renderer,viewport,stack sizes/scroll,overlay anchor/bounds/margin/focus; terminal cells/columns/rows differ from CSS pixels.
- Editor/input: history/multiline/autocomplete,combined slash/path completions,selection/cursor/IME,keybindings conflicts,Kitty key press/repeat/release,mouse/wheel.
- Appearance: terminal color mode/indexed/RGB/OKLCH/OKHSL,mix/style,Markdown theme,LaTeX render; ANSI utilities visibleWidth/truncate/wrap/slice/strip,fuzzy filter,OSC8 links.
- Terminal integration: ProcessTerminal,stdin buffer,terminal colors/status OSC7501; clipboard/native modifiers require OS modules. These are not browser clipboard/key APIs.
- Images: Kitty/iTerm2 capabilities,cell dimensions,transcoding/fallback,dimensions detection. Browser displaying PNG does not establish terminal image protocol support.

## Evals and examples

Sources: `packages/evals/package.json`,README,`src/{cli,plan,report,harness,docker}.ts`,`evals/*`. Expose suite/config/report inspection: provider/model,runs-per-variant,case/test filter,variants without_docs/with_docs,cohorts/tasks/outcomes and paired scores/lift. Missing/duplicate/skipped/pending/unscored/errored arms block pair; blocked pair withholds headline lift. Missing telemetry is unavailable, not zero. Execution uses Docker/Node and coding-agent; show `Dependency excluded` for Run. Do not add coding-agent's tools/session UI through this back door.

App-like examples, not separate released apps:

- agent/examples/mcp-codemode/main.ts and tools.ts: MCP+codemode+agent wiring; OS/provider dependent.
- codemode/examples/cloudflare/{agent,sandbox}: two Workers configs and sources; deployment example, not active service.
- durable/test/examples/00–31: conversations,documents,forks,owned conversations,Chord state,watches,harness,configuration,context,registry reload,extension state,tasks,recovery,chat,system prompt,real model,coding tools,print,JSON,inbox,late join,foreground/background subagents,child tasks,compaction,coding-tool harness,plan mode,reviewer,per-conversation sandbox,tool override,reload/restart. `26-coding-agent.ts` is a durable example filename, not automatic proof of an import of excluded package; inspect imports before deciding.
- tui/test contains executable demos/tests, not browser apps. Root scripts/nix/build configuration are developer infrastructure, not additional user-facing packages.

## Suggested navigation / reusable screen schema

Primary routes: Overview, AI, Agent, Durable, MCP, Code Mode, Environments, Chord, Telemetry, TUI, Evals. Within each route use real feature tabs above, not eleven copies of one generic text panel. Shared components: PackageHeader,CapabilityBadge,SourceReference,ConfigField/JSONEditor,ValidationSummary,ActionBar,ResultInspector,EventList,EmptyState,RuntimeRequirement. Feature record should carry stable id/packageId/title/sourceRefs/runtime/implementationStatus/fields/actions/results. Keep source support and current UI implementation status separate.

Acceptance: all ten packages discoverable; every significant feature family above appears in navigation or explicit coverage inventory; parameter values match source; production/OS actions truthfully gated; live utilities have tests and actual outputs; TUI is not claimed as browser-terminal execution; evals dependency exclusion is explicit; no absent apps invented; no coding-agent package imported.
