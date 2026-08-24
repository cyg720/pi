#!/usr/bin/env bash
# Create the deterministic source archive uploaded with GitHub releases.
# 创建随 GitHub Release 上传且内容可复现的源码归档。
#
# Usage:
# 用法：先准备模型数据，再传入版本、Git 引用和输出路径。
#   npm run hydrate:model-data
#   先补齐发布所需的模型数据快照。
#   ./scripts/create-source-archive.sh --version <version> --ref <git-ref> --out <archive.tar.gz>
#   创建指定版本和 Git 引用对应的 tar.gz 源码包。
# 文件职责：为 GitHub Release 创建内容可复现、结构经过验证的项目源码压缩包。
# 技术维度：使用 Bash 严格模式、Git 临时索引、git archive、gzip、tar、awk 和 Node.js 校验模型数据。
# 产品维度：让发布用户获得与指定提交和版本一致、包含必需模型数据且不夹带依赖或二进制的源码包。
# 逻辑维度：解析参数并核对版本，注入生成模型数据，创建确定性归档，再校验目录结构和必要文件后输出。
# 关键边界：运行前必须执行模型数据补水；版本只能含安全字符；输入 Git 引用必须可解析为提交。
# 新手阅读建议：先看参数校验和版本比对，再跟踪临时 Git 索引如何生成归档树，最后阅读三组安全校验。

set -euo pipefail

# version 保存命令行要求的发布版本，必须与目标提交中的包版本一致。
version=""
# source_ref 保存待归档 Git 引用，默认使用当前 HEAD。
source_ref="HEAD"
# output 保存最终 tar.gz 输出路径，参数解析前为空。
output=""
# invocation_dir 记录脚本启动目录，用于把相对输出路径转换为绝对路径。
invocation_dir="$PWD"

# 输出脚本支持的参数格式；无参数且无返回值，例如 `usage` 会写一行帮助信息。
usage() {
    echo "Usage: $0 --version <version> [--ref <git-ref>] --out <archive.tar.gz>"
}

# 检查某个选项后是否提供了非空值；参数 1 是选项名，参数 2 是值，缺失时退出；例如 `require_value --out "$path"`。
require_value() {
    if [[ $# -lt 2 || -z "$2" ]]; then
        echo "$1 requires a value" >&2
        usage >&2
        exit 1
    fi
}

# 逐个消费命令行参数；每个带值选项一次移除两个参数。
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version)
            require_value "$@"
            version="$2"
            shift 2
            ;;
        --ref)
            require_value "$@"
            source_ref="$2"
            shift 2
            ;;
        --out)
            require_value "$@"
            output="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# version 和 output 是创建归档所需的两个必填参数。
if [[ -z "$version" || -z "$output" ]]; then
    usage >&2
    exit 1
fi

# 限制版本字符，避免版本被解释为路径片段或命令语法。
if [[ ! "$version" =~ ^[0-9A-Za-z][0-9A-Za-z._-]*$ ]]; then
    echo "Invalid version: $version" >&2
    exit 1
fi

# repo_root 是根据脚本位置计算出的仓库根目录，不依赖调用者当前目录。
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

# commit 是 source_ref 解析后的确定提交对象；无效引用会因严格模式立即终止脚本。
commit="$(git rev-parse --verify --end-of-options "${source_ref}^{commit}")"

# package_version 从目标提交而非工作区读取 coding-agent 包版本。
package_version="$(git show "${commit}:packages/coding-agent/package.json" | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).version')"
# 拒绝命令行版本与目标提交版本不一致的归档，防止产物命名错误。
if [[ "$package_version" != "$version" ]]; then
    echo "Version ${version} does not match package version ${package_version} at ${source_ref}" >&2
    exit 1
fi

# 相对输出路径应相对于脚本调用目录，而不是脚本切换后的仓库根目录。
if [[ "$output" != /* ]]; then
    output="$invocation_dir/$output"
fi
mkdir -p "$(dirname "$output")"
# 将输出目录和文件名规范化为绝对路径，便于创建同目录临时文件。
output="$(cd "$(dirname "$output")" && pwd)/$(basename "$output")"

# model_data_dir 是补水命令生成的提供商模型元数据目录。
model_data_dir="packages/ai/src/providers/data"
# 清单文件不存在表示模型数据尚未准备，不能创建完整发布包。
if [[ ! -f "${model_data_dir}/.manifest.json" ]]; then
    echo "Generated model data is missing. Run npm run hydrate:model-data first." >&2
    exit 1
fi

# model_data_files 包含清单和目录下所有 JSON 快照；nullglob 避免无匹配时保留通配符文本。
shopt -s nullglob
model_data_files=("${model_data_dir}/.manifest.json" "${model_data_dir}"/*.json)
shopt -u nullglob
# 只有清单而没有模型 JSON 时也视为缺少生成数据。
if [[ ${#model_data_files[@]} -eq 1 ]]; then
    echo "Generated model data is missing from ${model_data_dir}" >&2
    exit 1
fi

# temporary_archive 是与目标同目录的临时压缩包，校验成功后才原子移动为正式输出。
temporary_archive="$(mktemp "${output}.tmp.XXXXXX")"
# temporary_index 是独立 Git 索引路径，用于向提交树临时加入被忽略的模型数据。
temporary_index="$(mktemp "${output}.index.XXXXXX")"
# manifest 保存归档中的完整路径列表，供后续安全校验。
manifest="$(mktemp "${output}.manifest.XXXXXX")"
# validation_root 是解压归档并运行内容校验的临时目录。
validation_root="$(mktemp -d "${output}.validation.XXXXXX")"
rm -f "$temporary_index"
# 默认退出处理器清理全部临时文件和目录，包括中途失败的情况。
trap 'rm -f "$temporary_archive" "$temporary_index" "$manifest"; rm -rf "$validation_root"' EXIT

# Add the ignored release model-data snapshot to a temporary index based on the
# 以发布提交为基础，把 Git 忽略的模型数据快照加入临时索引。
# release commit. Archiving the resulting tree keeps the source artifact
# 对临时索引生成的树归档，使同一提交和同一模型数据得到稳定一致的源码包。
# deterministic for the same commit and generated model data.
# 这保证归档内容可复现，而不会修改真实工作区或正式 Git 索引。
GIT_INDEX_FILE="$temporary_index" git read-tree "$commit"
GIT_INDEX_FILE="$temporary_index" git add -f -- "${model_data_files[@]}"
# archive_tree 是写入模型数据后的临时 Git 树对象标识。
archive_tree="$(GIT_INDEX_FILE="$temporary_index" git write-tree)"
# archive_mtime 使用目标提交时间，使所有归档条目的时间戳保持确定。
archive_mtime="$(git show -s --format=%ct "$commit")"

# archive_root 是压缩包内所有内容共同使用的顶层目录名。
archive_root="pi-${version}"
git archive --format=tar --prefix="${archive_root}/" --mtime="@${archive_mtime}" "$archive_tree" \
    | gzip -n -9 > "$temporary_archive"
tar -tzf "$temporary_archive" > "$manifest"

# required_paths 列出发布源码包必须具备的入口、锁文件、生成数据和运行时资源。
required_paths=(
    "package.json"
    "package-lock.json"
    "scripts/build-binaries.sh"
    "packages/ai/src/models.generated.ts"
    "packages/ai/src/image-models.generated.ts"
    "packages/ai/src/providers/data/.manifest.json"
    "packages/coding-agent/package.json"
    "packages/coding-agent/src/utils/image-resize-worker.ts"
    "packages/coding-agent/src/core/export-html/template.css"
)

# 逐项确认必需路径位于归档清单中，缺少任何一个都立即失败。
for path in "${required_paths[@]}"; do
    if ! grep -Fxq "${archive_root}/${path}" "$manifest"; then
        echo "Source archive is missing required path: $path" >&2
        exit 1
    fi
done

# 所有归档条目必须以唯一顶层目录开头，防止路径逃逸或混入并列根目录。
if ! awk -v prefix="${archive_root}/" 'index($0, prefix) != 1 { exit 1 }' "$manifest"; then
    echo "Source archive contains a path outside ${archive_root}/" >&2
    exit 1
fi

# 源码包不得包含可重新安装的 node_modules 或预构建二进制目录。
if grep -Eq '(^|/)node_modules/|(^|/)packages/coding-agent/binaries/' "$manifest"; then
    echo "Source archive contains generated dependencies or binaries" >&2
    exit 1
fi

# 将归档解压到隔离目录，并用归档自身的校验脚本验证模型数据一致性。
tar -xzf "$temporary_archive" -C "$validation_root"
node "${validation_root}/${archive_root}/packages/ai/scripts/check-model-data.ts"

# 校验全部通过后把临时归档移动到用户指定的最终路径。
mv "$temporary_archive" "$output"
# 正式归档已经移走，更新退出处理器只清理其余辅助文件。
trap 'rm -f "$temporary_index" "$manifest"; rm -rf "$validation_root"' EXIT
# 输出最终绝对路径，供调用脚本或 CI 后续步骤读取。
printf '%s\n' "$output"
