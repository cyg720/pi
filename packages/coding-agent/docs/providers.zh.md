# 提供商

大多数托管提供商都支持以下一种或两种身份验证方式：

- 通过浏览器或设备流程（基于OAuth）进行登录。
- 提供API密钥。

使用`/login [provider]`查看提供商支持的方法。Amazon Bedrock和Google Vertex AI也可以使用环境云凭证。

## 交互式身份验证

运行`/login`并选择一个提供商。Pi会引导您完成其OAuth或API密钥流程，并将生成的凭证保存在[`auth.json`](configuration.md#agent-directory)中。

在远程或无头机器上，OAuth回调可能无法到达本地进程。当提示时，请将最终重定向URL或授权码粘贴回Pi。

运行`/logout`并选择一个提供商以删除其存储的凭证。这不会取消环境变量，不会从`models.json`中移除身份验证，也不会撤销提供商处的凭证。

`auth.json`可以包含API密钥和OAuth令牌。请保持其私密，不要提交。

## 从环境使用API密钥

环境变量在CI和其他Pi不应存储密钥的场景中很有用。在启动Pi之前设置变量：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

下表涵盖了仅需单一主API密钥变量的提供商。需要额外配置或支持环境凭证的提供商详见[Provider Specific Config](#provider-specific-config)。

| 提供商                      | 环境变量                      |
|-----------------------------|------------------------------|
| Anthropic                   | `ANTHROPIC_API_KEY`             |
| Ant Ling                    | `ANT_LING_API_KEY`             |
| OpenAI                      | `OPENAI_API_KEY`             |
| DeepSeek                    | `DEEPSEEK_API_KEY`             |
| NVIDIA NIM                  | `NVIDIA_API_KEY`             |
| Google Gemini               | `GEMINI_API_KEY`             |
| GitHub Copilot              | `COPILOT_GITHUB_TOKEN`             |
| Mistral                     | `MISTRAL_API_KEY`             |
| Groq                        | `GROQ_API_KEY`             |
| Cerebras                    | `CEREBRAS_API_KEY`             |
| xAI                         | `XAI_API_KEY`             |
| OpenRouter                  | `OPENROUTER_API_KEY`             |
| Vercel AI Gateway           | `AI_GATEWAY_API_KEY`             |
| ZAI Coding Plan (Global)    | `ZAI_API_KEY`             |
| ZAI Coding Plan (China)     | `ZAI_CODING_CN_API_KEY`             |
| OpenCode Zen 和 Go         | `OPENCODE_API_KEY`             |
| Radius                      | `RADIUS_API_KEY`             |
| TypeSafe ([classifier models](models.md#use-classifier-models)) | `TYPESAFE_API_KEY` |
| Hugging Face                | `HF_TOKEN`             |
| Fireworks                   | `FIREWORKS_API_KEY`             |
| Together AI                 | `TOGETHER_API_KEY`             |
| Baseten                     | `BASETEN_API_KEY`             |
| Kimi For Coding             | `KIMI_API_KEY`             |
| Meta                        | `META_API_KEY`             |
| MiniMax                     | `MINIMAX_API_KEY`             |
| MiniMax (China)             | `MINIMAX_CN_API_KEY`             |
| Moonshot AI（全球及中国区） | `MOONSHOT_API_KEY`         |
| Qwen Token Plan 和 Individual | `QWEN_TOKEN_PLAN_API_KEY`         |
| Qwen Token Plan (China)     | `QWEN_TOKEN_PLAN_CN_API_KEY`             |
| Xiaomi MiMo                 | `XIAOMI_API_KEY`             |
| Xiaomi MiMo Token Plan (China) | `XIAOMI_TOKEN_PLAN_CN_API_KEY`         |
| Xiaomi MiMo Token Plan (Amsterdam) | `XIAOMI_TOKEN_PLAN_AMS_API_KEY`     |
| Xiaomi MiMo Token Plan (Singapore) | `XIAOMI_TOKEN_PLAN_SGP_API_KEY`     |

Anthropic也识别`ANTHROPIC_OAUTH_TOKEN`作为API凭证，并将`ANTHROPIC_AUTH_TOKEN`识别为承载式身份验证。

如果没有密钥或令牌设置，Anthropic会在`ANTHROPIC_FEDERATION_RULE_ID`、`ANTHROPIC_ORGANIZATION_ID`和`ANTHROPIC_IDENTITY_TOKEN_FILE`设置时使用工作负载身份联合身份验证：Anthropic SDK会交换身份令牌以获取短生命周期访问令牌，并自行刷新（重新读取身份令牌文件，因此请保持该文件新鲜以支持长时间会话）。`ANTHROPIC_SERVICE_ACCOUNT_ID`和`ANTHROPIC_WORKSPACE_ID`在设置时会直接传递。

## 从命令加载API密钥

要使用密钥管理器而不将解析后的密钥写入磁盘，可将提供商的`key`在`auth.json`中设置为以`!`开头的命令：

```json
{
  "anthropic": {
    "type": "api_key",
    "key": "!security find-generic-password -ws 'anthropic'"
  }
}
```

Pi会在密钥首次需要时运行该命令，并缓存其标准输出供进程生命周期内使用。输出为空、超时或退出码非零将使密钥保持未解析状态，直到Pi重启。

<a id="provider-specific-config"></a>
## 特定提供商配置

下述提供商需要额外设置，或可使用其平台提供的凭证。

存储的API密钥凭证可以包含一个`env`对象。其值对该提供商而言优先于进程环境变量：

```json
{
  "cloudflare-workers-ai": {
    "type": "api_key",
    "key": "...",
    "env": {
      "CLOUDFLARE_ACCOUNT_ID": "account-id"
    }
  }
}
```

### Radius

Radius是由Pi的开发者Earendil Works打造的服务。它提供了一个可定制的AI网关，内置组织级控制和分析功能，并内置了与Pi共享您创作成果的工具。

要开始使用，运行`/login radius`。这会将Radius添加为提供商，并将其模型显示在`/model`中，与其他提供商的模型无异。

Radius还自带一个MCP服务器，因此Pi可以为您管理Radius。
Radius 目前处于早期 alpha 阶段，正在快速发展。有关更多信息，请参见 [radius.earendil.com](https://radius.earendil.com)。

Radius 认证使用其网关目录，并缓存刷新的模型元数据，以便后续离线启动。在 `models.json` 中配置的自定义 Radius 网关使用其自己的目录，而不是继承公共 `radius.pi.dev` 目录。

### Azure OpenAI

设置 API 密钥，以及基础 URL 或资源名称：

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.ai.azure.com
# Or:
export AZURE_OPENAI_RESOURCE_NAME=your-resource
```

`ai.azure.com`、`cognitiveservices.azure.com` 和 `openai.azure.com` 下的资源根 URL 会被规范化为 OpenAI API 路径。

### Amazon Bedrock

Bedrock 可以使用承载令牌或环境 AWS 凭证源：

```bash
# Named profile
export AWS_PROFILE=your-profile

# IAM keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
# Required for temporary credentials
export AWS_SESSION_TOKEN=...

# Bedrock bearer token
export AWS_BEARER_TOKEN_BEDROCK=...

# Region, when not supplied by the profile or AWS SDK configuration
export AWS_REGION=us-west-2
# AWS_DEFAULT_REGION is also supported
```

Pi 还支持通过标准 `AWS_CONTAINER_CREDENTIALS_*` 和 `AWS_WEB_IDENTITY_TOKEN_FILE` 变量使用 ECS 任务凭证和 IRSA。

### Cloudflare AI Gateway

网关需要令牌、账户 ID 和网关 ID：

```bash
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...
```

账户和网关 ID 可以来自进程环境或凭证的 `env` 对象（在 `auth.json` 中）。

`CLOUDFLARE_API_KEY` 用于 Pi 认证到网关。上游访问可以使用 Cloudflare 统一计费、网关中存储的凭证，或在 `models.json` 中为提供者配置的 `Authorization` 头部。

### Cloudflare Workers AI

Workers AI 需要令牌和账户 ID：

```bash
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
```

账户 ID 也可以存储在凭证的 `env` 对象中。

### Google Vertex AI

使用 Google Cloud API 密钥：

```bash
export GOOGLE_CLOUD_API_KEY=...
```

要使用应用默认凭证，请配置项目和位置：

```bash
export GOOGLE_CLOUD_PROJECT=your-project
# GCLOUD_PROJECT is also supported
export GOOGLE_CLOUD_LOCATION=us-central1
```

然后进行认证：

```bash
gcloud auth application-default login
```

要使用服务账户密钥文件，请设置 `GOOGLE_APPLICATION_CREDENTIALS` 并配合项目和位置。

