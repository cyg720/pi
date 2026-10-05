---
name: release
description: 准备、发布、验证和恢复 pi 版本。用于发布准备、本地版本冒烟测试、发布以及失败的发布 CI 或公告。
---

# 发布 pi

从仓库根目录（此技能上两级目录）运行仓库命令，除非另有说明。

**锁步版本控制**：所有包共享一个版本；每次发布都会一起更新。`patch` = 修复和新增功能，`minor` = 破坏性变更。无主版本发布。

1. **更新 CHANGESLOG**：询问用户是否已在 `main` 的最新提交上运行了 `/cl` 提示。如果没有，他们必须先运行 `/cl` 来审核并更新每个包的 `[Unreleased]` 部分，然后才能发布。

2. **本地冒烟测试**：构建一个未发布的版本并在仓库外部进行冒烟测试（以便无法解析工作区文件）：
   ```bash
   npm run release:local -- --out /tmp/pi-local-release --force
   cd /tmp

   # Node package install smoke tests
   /tmp/pi-local-release/node/pi --help
   /tmp/pi-local-release/node/pi --version
   /tmp/pi-local-release/node/pi --list-models
   /tmp/pi-local-release/node/pi -p "Say exactly: ok"
   /tmp/pi-local-release/node/pi

   # Bun binary smoke tests
   /tmp/pi-local-release/bun/pi --help
   /tmp/pi-local-release/bun/pi --version
   /tmp/pi-local-release/bun/pi --list-models
   /tmp/pi-local-release/bun/pi -p "Say exactly: ok"
   /tmp/pi-local-release/bun/pi
   ```
   验证 Node 和 Bun 启动、模型/账户列表、交互式启动以及至少一个带有预期默认提供者的实际提示。bare 命令 `/tmp/pi-local-release/node/pi` 和 `/tmp/pi-local-release/bun/pi` 会启动交互模式；在 tmux 中运行每个命令，提交一个提示，等待模型回复后再认为交互式冒烟测试通过。除非用户明确接受风险，否则失败是发布阻塞项。

   按照 [interactive-testing.md](interactive-testing.md) 的说明加载并执行 tmux 工作流程。从 `/tmp` 启动每个发布二进制文件，而不是仓库根目录。

3. **运行发布脚本**：
   ```bash
   PI_ALLOW_LOCKFILE_CHANGE=1 npm_config_min_release_age=0 npm run release:patch    # fixes + additions
   PI_ALLOW_LOCKFILE_CHANGE=1 npm_config_min_release_age=0 npm run release:minor    # breaking changes
   ```
   仅使用 `npm_config_min_release_age=0` 运行发布命令。仓库的正常 npm 年龄门控在其他情况下可能会阻止发布时刷新锁文件，因为当前工作区包版本最近曾被发布过。发布前请审查并确认锁文件或安装锁的差异。
   发布脚本会在 Nix 模型目录的固定版本（`nix/model-catalog.json`）过期时刷新它，提升所有包的版本，更新更新日志，重新生成发布产物，运行 `npm run check`，提交 `Release vX.Y.Z`，创建 `vX.Y.Z` 标签，添加新的 `## [Unreleased]` 更新日志部分，提交 `Add [Unreleased] section for next cycle`，然后推送 `main` 和标签。标签推送后不要再次运行发布脚本。

4. **CI 验证并公告 npm 版本**：推送 `vX.Y.Z` 标签会触发 `.github/workflows/build-binaries.yml`。`publish-npm` 任务通过 GitHub Actions OIDC 使用 npm 可信发布，环境为 `npm-publish`；无需在本地运行 `npm publish`、`npm whoami`，也无需 OTP 或 WebAuthn 流程。发布后，`announce-pi-dev-release` 验证所有公开工作区包都解析到准确的发布版本，且其 npm 压缩包可用，然后将已验证的发布标记写入 R2。`pi.dev/api/latest-version` 读取该标记；在此任务成功之前，绝不能根据 npm 的状态公告版本。

5. **CI 构建 Nix 版本**：推送标签还会触发 `.github/workflows/nix.yml`，在 Linux 和 macOS 上构建标签对应的 flake，然后以快进方式将 `stable` 分支移动到发布提交。`nix run github:earendil-works/pi/stable` 运行最新版本。如果 Nix 构建失败，`stable` 会停留在上一版本；无法修补已发布的标签，因此应修复 `main`，并在下一版本中发布修复。

6. **如果 CI 发布或公告失败**：检查失败的任务。发布辅助程序是幂等的，会跳过 npm 上已经存在的包版本；公告任务会在更新 R2 标记前再次检查可用性。修复 CI 或 npm 临时问题后，重新运行失败的任务或工作流。不要为同一版本再次运行 `npm run release:patch` 或 `npm run release:minor`。

