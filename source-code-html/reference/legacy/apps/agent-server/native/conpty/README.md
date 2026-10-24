> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Workbench Windows x64 ConPTY

These assets fix cmd cooked-input rendering when the prompt ends exactly at the
terminal's last column. They are a local build, not an official Microsoft release.

- `OpenConsole.exe`: Microsoft Terminal tag `v1.25.2733.0`, commit
  `dc8ae365847d41f62d1ebca93815bb00959bc12f`, plus the two-file patch in
  `docs/workbench/verification/local/native-conpty/candidate3.patch`.
- `conpty.dll`: official release `1.25.260930003`, unchanged.
- `manifest.json`: exact binary digests and the reviewed `node-pty@1.1.0` bridge
  digests. Updating any component requires review and real native acceptance.
- `LICENSE` and `NOTICE.md`: upstream license and notices.

The source checkout, toolchain versions, build command and real test evidence are
recorded in `docs/workbench/verification/local/native-conpty/README.md` and its
manifest. VS 2026 Build Tools was used; this source tag also supports VS 2022/v143.
Recompiling may produce a different executable hash; do not update the manifest
without verifying the new executable.

From the repository root, `node scripts/prepare-workbench-conpty.mjs` verifies and
prepares the source worker's private package. The server build calls the same
helper for `dist`. Both preserve node-pty's relative DLL and worker paths. The root
npm package is untouched. The complete generated server `dist` tree must ship
together. Preparation currently targets a Windows x64 build host; other platforms
retain their existing paths and are not covered by this native acceptance.

Replacements record the previous tree's file hashes and confirm successful
publication before collection. `scripts/collect-workbench-conpty.ps1` uses the
built-in Windows PowerShell and exclusive native file handles to validate every
file before marking any for deletion. Loaded images retain the complete backup;
later preparations can collect it after release. Unknown, changed, linked or
unconfirmed backups are retained for review. Missing helper capabilities also
retain backups. No execution-policy or privilege changes are made.

The preparer, `scripts/conpty-publication-gate.mjs`, and its PowerShell helper must
ship together when preparing a source checkout or rebuilding. Windows x64 workers
share the publisher's process-owned gate before verifying or resolving node-pty,
and release it after the first native output. The built worker bundles the gate.
Startup cancellation and the existing request deadline remain active while waiting.
Already prepared runtime execution does not invoke the
collector. This is not a hostile-filesystem sandbox or a transactional guarantee
against interruption during deletion; historical backups without ownership
records are not adopted or deleted.

Real regression command, from `apps/agent-server`:

```
node --import ../../scripts/workbench-source-loader.mjs --test test/terminal-windows-wrap.test.ts test/terminal-windows.test.ts
```

The new tests execute actual cmd and Node processes, verify TTY flags, Tab
completion, full prompt text, soft reflow and child cleanup. They use no provider
fixtures or mock PTYs. Additional native Win32 and UI evidence remains in the
verification record; this does not imply arbitrary full-screen app compatibility.
