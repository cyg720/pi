---
name: add-llm-provider
description: 为 packages/ai 添加新的大语言模型（LLM）提供商的检查清单。涵盖核心类型、提供商实现、懒加载注册、模型生成、完整的测试矩阵、编码代理连接以及文档。
---

# 添加新的 LLM 提供商（packages/ai）

添加新提供商涉及多个文件。请按顺序执行以下步骤。

## 1. 核心类型（`packages/ai/src/types.ts`）

- 将 API 标识符添加到 `Api` 类型联合中（例如 `"bedrock-converse-stream"`）。
- 创建扩展 `StreamOptions` 的选项接口。
- 添加映射到 `ApiOptionsMap`。
- 将提供商名称添加到 `KnownProvider` 类型联合中。

## 2. 提供商实现（`packages/ai/src/providers/`）

创建一个导出以下内容的提供商文件：

- `stream<Provider>()` 返回 `AssistantMessageEventStream`。
- `streamSimple<Provider>()` 映射到 `SimpleStreamOptions`。
- 特定于提供商的选项接口。
- 消息/工具转换函数。
- 响应解析，发出标准化事件（`text`、`tool_call`、`thinking`、`usage`、`stop`）。

## 3. 提供商导出与懒加载注册

- 在 `packages/ai/package.json` 中添加一个包子路径导出，指向 `./dist/providers/<provider>.js`。
- 在 `packages/ai/src/index.ts` 中为根入口处仍需可用的提供商选项类型添加 `export type` 重导出。
- 通过懒加载包装器在 `packages/ai/src/providers/register-builtins.ts` 中注册提供商；不要静态导入提供商实现模块。
- 在 `packages/ai/src/env-api-keys.ts` 中添加凭证检测。

## 4. 模型生成（`packages/ai/scripts/generate-models.ts`）

- 添加逻辑以从提供商源端获取/解析模型。
- 映射到标准化的 `Model` 接口。

## 5. 测试（`packages/ai/test/`）

- 始终将提供商添加到 `stream.test.ts` 中，至少包含一个代表性模型，即使它重用了现有的 API 实现（如 `openai-completions`）。
- 根据适用情况，将提供商添加到更广泛的测试矩阵中：`tokens.test.ts`、`abort.test.ts`、`empty.test.ts`、`context-overflow.test.ts`、`unicode-surrogate.test.ts`、`tool-call-without-result.test.ts`、`image-tool-result.test.ts`、`total-tokens.test.ts`、`cross-provider-handoff.test.ts`。
- 对于 `cross-provider-handoff.test.ts`，至少添加一个提供商/模型对。如果提供商暴露了多个模型家族（例如 GPT 和 Claude），则每个家族至少添加一对。
- 对于非标准认证，创建一个实用工具（例如 `bedrock-utils.ts`）并添加凭证检测。

## 6. 编码代理（`packages/coding-agent/`）

- `src/core/model-resolver.ts`：将默认模型 ID 添加到 `defaultModelPerProvider`。
- `src/core/provider-display-names.ts`：添加 API 密钥登录的显示名称，以便 `/login` 及相关 UI 能显示内置 API 密钥认证的提供商。
- `src/cli/args.ts`：添加环境变量文档。
- `README.md`：添加提供商设置说明。
- `docs/providers.md`：添加设置说明、环境变量和 `auth.json` 密钥。

## 7. 文档

- `packages/ai/README.md`：添加到提供商表中，记录选项/认证信息，添加环境变量。
- `packages/ai/CHANGELOG.md`：在 `## [Unreleased]` 下添加条目。

