# 文件职责：在 Windows PowerShell 中直接运行 coding-agent 的 TypeScript 命令行入口。
# 技术维度：使用 PowerShell 参数解析、环境变量清理、路径拼接和 tsx 执行 TypeScript。
# 产品维度：让开发者无需构建即可本地试用 CLI，并可选择隔离真实服务凭据。
# 逻辑维度：解析 --no-env，按需移除凭据，校验 tsx，转发参数并传播退出码。
# 关键边界：必须先安装 node_modules；--no-env 会从当前进程移除列出的云服务环境变量。
# 新手阅读建议：按“参数解析、环境清理、入口执行”三段阅读，重点理解 @forwardArgs 的参数展开。

# 遇到命令错误立即停止，避免在准备步骤失败后继续启动 CLI。
$ErrorActionPreference = "Stop"

# 获取当前脚本目录，用于构造与工作目录无关的绝对工具路径。
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# 标记是否启用无凭据模式，默认保留当前环境变量。
$noEnv = $false
# 收集需要原样转发给 CLI 的参数，不包含脚本自身的 --no-env 开关。
$forwardArgs = New-Object System.Collections.Generic.List[string]

# arg 是当前命令行参数；循环负责识别本脚本开关并保留其他参数。
foreach ($arg in $args) {
	if ($arg -eq "--no-env") {
		$noEnv = $true
	} else {
		$forwardArgs.Add($arg)
	}
}

if ($noEnv) {
	# 列出无凭据模式下要移除的 API、云平台和代理认证环境变量名称。
	$envVarsToUnset = @(
		"ANTHROPIC_API_KEY",
		"ANTHROPIC_OAUTH_TOKEN",
		"OPENAI_API_KEY",
		"GEMINI_API_KEY",
		"GROQ_API_KEY",
		"CEREBRAS_API_KEY",
		"XAI_API_KEY",
		"OPENROUTER_API_KEY",
		"ZAI_API_KEY",
		"MISTRAL_API_KEY",
		"MINIMAX_API_KEY",
		"MINIMAX_CN_API_KEY",
		"AI_GATEWAY_API_KEY",
		"OPENCODE_API_KEY",
		"COPILOT_GITHUB_TOKEN",
		"GH_TOKEN",
		"GITHUB_TOKEN",
		"HF_TOKEN",
		"GOOGLE_APPLICATION_CREDENTIALS",
		"GOOGLE_CLOUD_PROJECT",
		"GCLOUD_PROJECT",
		"GOOGLE_CLOUD_LOCATION",
		"AWS_PROFILE",
		"AWS_ACCESS_KEY_ID",
		"AWS_SECRET_ACCESS_KEY",
		"AWS_SESSION_TOKEN",
		"AWS_REGION",
		"AWS_DEFAULT_REGION",
		"AWS_BEARER_TOKEN_BEDROCK",
		"AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
		"AWS_CONTAINER_CREDENTIALS_FULL_URI",
		"AWS_WEB_IDENTITY_TOKEN_FILE",
		"AZURE_OPENAI_API_KEY",
		"AZURE_OPENAI_BASE_URL",
		"AZURE_OPENAI_RESOURCE_NAME"
	)

	# name 是当前环境变量名称；不存在时静默跳过，确保清理过程幂等。
	foreach ($name in $envVarsToUnset) {
		Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
	}

	Write-Host "Running without API keys..."
}

# 指向仓库内安装的 tsx Windows 启动脚本，避免依赖全局安装。
$tsxBin = Join-Path $scriptDir "node_modules/.bin/tsx.cmd"
if (-not (Test-Path -LiteralPath $tsxBin)) {
	throw "tsx not found at $tsxBin. Run npm install from the repo root first."
}

# 指向 coding-agent 的 TypeScript CLI 源码入口。
$cliPath = Join-Path $scriptDir "packages/coding-agent/src/cli.ts"
& $tsxBin $cliPath @forwardArgs
# 保存 tsx 进程的退出码，以便调用方获知 CLI 是否执行成功。
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
	exit $exitCode
}
