#!/usr/bin/env bash
# 文件职责：从源码启动编码代理，并可通过 --no-env 清空所有已知模型凭据。
# 技术维度：使用严格 Bash、参数数组、环境变量 unset 和本地 tsx 执行 TypeScript CLI。
# 产品维度：帮助开发者快速手工测试当前源码，也能验证无凭据时的首次设置和降级行为。
# 逻辑维度：定位仓库，解析并移除 --no-env；按需清空凭据；把其余参数转交 CLI。
# 关键边界：--no-env 会影响当前脚本子进程环境但不修改用户配置；必须先安装 node_modules。
# 新手阅读建议：先理解 ARGS 如何保留普通参数，再核对凭据清单和最后的 tsx 启动命令。
set -euo pipefail

# SCRIPT_DIR 是当前脚本所在仓库根目录的绝对路径，后续所有路径均基于它。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for --no-env flag
# 检查并消费 --no-env 参数。
# NO_ENV 表示是否需要清空凭据，只取 true 或 false。
NO_ENV=false
# ARGS 保存除 --no-env 外要原样传给编码代理 CLI 的参数。
ARGS=()
# arg 是用户传入的当前命令行参数。
for arg in "$@"; do
  if [[ "$arg" == "--no-env" ]]; then
    NO_ENV=true
  else
    ARGS+=("$arg")
  fi
done

if [[ "$NO_ENV" == "true" ]]; then
  # Unset API keys (see packages/ai/src/env-api-keys.ts)
  # 清空 API 凭据；完整来源清单参见 packages/ai/src/env-api-keys.ts。
  unset ANTHROPIC_API_KEY
  unset ANTHROPIC_OAUTH_TOKEN
  unset OPENAI_API_KEY
  unset GEMINI_API_KEY
  unset GROQ_API_KEY
  unset CEREBRAS_API_KEY
  unset XAI_API_KEY
  unset OPENROUTER_API_KEY
  unset ZAI_API_KEY
  unset MISTRAL_API_KEY
  unset MINIMAX_API_KEY
  unset MINIMAX_CN_API_KEY
  unset AI_GATEWAY_API_KEY
  unset OPENCODE_API_KEY
  unset COPILOT_GITHUB_TOKEN
  unset GH_TOKEN
  unset GITHUB_TOKEN
  unset HF_TOKEN
  unset GOOGLE_APPLICATION_CREDENTIALS
  unset GOOGLE_CLOUD_PROJECT
  unset GCLOUD_PROJECT
  unset GOOGLE_CLOUD_LOCATION
  unset AWS_PROFILE
  unset AWS_ACCESS_KEY_ID
  unset AWS_SECRET_ACCESS_KEY
  unset AWS_SESSION_TOKEN
  unset AWS_REGION
  unset AWS_DEFAULT_REGION
  unset AWS_BEARER_TOKEN_BEDROCK
  unset AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
  unset AWS_CONTAINER_CREDENTIALS_FULL_URI
  unset AWS_WEB_IDENTITY_TOKEN_FILE
  unset AZURE_OPENAI_API_KEY
  unset AZURE_OPENAI_BASE_URL
  unset AZURE_OPENAI_RESOURCE_NAME
  echo "Running without API keys..."
fi

"$SCRIPT_DIR/node_modules/.bin/tsx" --tsconfig "$SCRIPT_DIR/tsconfig.json" "$SCRIPT_DIR/packages/coding-agent/src/cli.ts" ${ARGS[@]+"${ARGS[@]}"}
