#!/usr/bin/env bash
# 文件职责：在隔离的临时主目录和空环境中运行仓库全部非在线测试。
# 技术维度：使用 Bash 严格模式、mktemp、env -i、trap 和 npm 工作区测试命令。
# 产品维度：避免本机密钥、配置和缓存改变测试结果或触发真实付费服务。
# 逻辑维度：创建并标记临时目录，定义安全清理函数，构造白名单环境后启动 npm test。
# 关键边界：清理函数只删除带所有权标记且路径匹配的目录；需要系统提供 false 和 npm。
# 新手阅读建议：先看临时目录所有权标记，再读 cleanup 的防误删检查，最后看 test_env 白名单。
set -euo pipefail

# Isolate user resources, credentials, temporary files, and tool configuration.
# 隔离用户资源、凭据、临时文件和工具配置。
# temp_parent 是创建测试根目录的父目录，并去除末尾斜杠以便后续路径校验。
temp_parent="${TMPDIR:-/tmp}"
temp_parent="${temp_parent%/}"
# test_root 是本次测试独享且随机命名的临时根目录。
test_root="$(mktemp -d "$temp_parent/pi-test.XXXXXX")"
# git_askpass 指向始终失败的 false 命令，禁止 Git 弹出认证提示。
git_askpass="$(type -P false)"
readonly temp_parent test_root git_askpass

mkdir -p "$test_root/home/.config" "$test_root/tmp" "$test_root/cache/npm"
# Mark the generated root so cleanup can verify ownership before deleting it.
# 标记生成目录，使清理前能够验证该目录确由本脚本创建。
touch "$test_root/.pi-test-owned" "$test_root/npm-userconfig" "$test_root/npm-globalconfig"

# Only remove the marked directory created above, never an unverified path.
# 只删除上面创建且带标记的目录，绝不删除未经验证的路径。
# cleanup 在脚本退出时保留原状态码，并仅清理通过路径与所有权检查的测试根目录。
cleanup() {
	# status 保存进入清理函数前的退出状态。
	local status=$?
	trap - EXIT

	case "$test_root" in
		"$temp_parent"/pi-test.*)
			if [[ -d "$test_root" && ! -L "$test_root" && -f "$test_root/.pi-test-owned" ]]; then
				rm -rf -- "$test_root"
			else
				printf "Refusing to remove unverified test directory: %s\n" "$test_root" >&2
				[[ $status -ne 0 ]] || status=1
			fi
			;;
		*)
			printf "Refusing to remove unexpected test directory: %s\n" "$test_root" >&2
			[[ $status -ne 0 ]] || status=1
			;;
	esac

	exit "$status"
}
trap cleanup EXIT

# Start from an empty environment and allow only required platform and test settings.
# 从空环境开始，只允许平台启动和测试隔离所必需的设置。
# test_env 是传给 env -i 的环境变量白名单数组。
test_env=(
	"PATH=$PATH"
	"PWD=$PWD"
	"HOME=$test_root/home"
	"USERPROFILE=$test_root/home"
	"TMPDIR=$test_root/tmp"
	"TMP=$test_root/tmp"
	"TEMP=$test_root/tmp"
	"XDG_CONFIG_HOME=$test_root/home/.config"
	"XDG_CACHE_HOME=$test_root/cache"
	"LANG=C"
	"LC_ALL=C"
	"TZ=UTC"
	"GIT_CONFIG_NOSYSTEM=1"
	"GIT_CONFIG_GLOBAL=/dev/null"
	"GIT_TERMINAL_PROMPT=0"
	"GIT_ASKPASS=$git_askpass"
	"GIT_EDITOR=true"
	"GIT_SEQUENCE_EDITOR=true"
	"NPM_CONFIG_USERCONFIG=$test_root/npm-userconfig"
	"NPM_CONFIG_GLOBALCONFIG=$test_root/npm-globalconfig"
	"NPM_CONFIG_CACHE=$test_root/cache/npm"
	"PI_NO_LOCAL_LLM=1"
	"AWS_EC2_METADATA_DISABLED=true"
)

# Native Windows needs these inherited values to launch child processes.
# 原生 Windows 启动子进程需要继承这些系统值。
# name 是当前候选 Windows 系统环境变量名。
for name in SystemRoot SYSTEMROOT WINDIR COMSPEC PATHEXT; do
	# value 是允许为空的当前环境变量值。
	value="${!name-}"
	[[ -z "$value" ]] || test_env+=("$name=$value")
done

# Preserve CI detection only for runner behavior and test reporting.
# 只保留 CI 检测变量，用于测试运行器行为和报告格式。
# name 是当前候选 CI 环境变量名。
for name in CI GITHUB_ACTIONS; do
	# value 是允许为空的当前 CI 标记值。
	value="${!name-}"
	[[ -z "$value" ]] || test_env+=("$name=$value")
done

echo "Running tests without API keys in isolated home: $test_root/home"
env -i "${test_env[@]}" npm test
