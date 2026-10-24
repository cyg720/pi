> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# node-forge 1.4.0 local backport

This archive applies the nested DigestAlgorithm element-count check from
[forge PR 1152](https://github.com/digitalbazaar/forge/pull/1152), commit
`ceba34402e329f0365134f23fe19898756527d65`, for
[GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
It is a local backport, not an upstream release. The package retains version
`1.4.0`; `piPatch` records its provenance and local revision.

The root development dependency pins this archive, and the root override
`node-forge: "$node-forge"` applies it to Gondolin as well. No install lifecycle
script modifies node_modules. Use `npm ci --ignore-scripts` for a clean install.
Installing the Gondolin example independently outside this monorepo does not
inherit this root override.

## Verification and rebuilding

From the repository root:

```text
npm run check:forge-backport
node --test scripts/forge-backport.test.mjs
npm run rebuild:forge-backport
```

The integrity check resolves forge from Gondolin and checks all 59 installed
files against `manifest.json`. It is also included in `npm run check`.
The tests use actual RSA 2048 signatures, PSS/OAEP, Gondolin CA persistence,
malformed certificates and a real certificate-verified localhost TLS exchange.
They do not execute a Gondolin VM or claim a private-key-free forgery attack.

Rebuilding downloads the original registry tarball, verifies its SHA-512,
applies only the RSA condition, adds provenance metadata, and builds the browser
artifacts with the original webpack configuration. The fixed tooling manifest
and lockfile install with lifecycle scripts disabled. The resulting archive is
written to `.artifacts/forge-backport/`; the script requires byte-identical output
and never overwrites the checked-in archive.

Compared with upstream, only `lib/rsa.js`, the two minified browser bundles, and
`package.json` differ. The other 55 files, including license, worker, and maps,
are unchanged. `upstream-1152.patch` preserves the reviewed upstream reference;
its changelog/test/comment changes are not part of this archive.

## Audit boundary

As observed on 2026-10-16, the root audit still reports two high entries for forge
and its dependent Gondolin. This backport intentionally does not change the
version to suppress advisory matching. An upstream fixed release remains pending.
The isolated legacy webpack 4 build tooling also has known development-dependency
advisories (19 during the recorded install); these packages are not shipped inside
the forge runtime archive. Its original bundle-size warnings are retained.

Real browser standard/full bundle results, clean-install logs, build provenance,
and limitations are recorded in `docs/workbench/verification/local/forge-review/`.
The original BSD/GPL dual license is retained in `LICENSE` and the archive.
