#!/usr/bin/env bash
#
# Migrate sessions from ~/.pi/agent/*.jsonl to proper session directories.
# This fixes sessions created by the bug in v0.30.0 where sessions were
# saved to ~/.pi/agent/ instead of ~/.pi/agent/sessions/<encoded-cwd>/.
#
# Usage: ./migrate-sessions.sh [--dry-run]
#
# 文件职责：把错误保存在代理根目录的旧版 JSONL 会话迁移到按工作目录编码的会话目录。
# 技术维度：使用 Bash、jq、sed、文件移动和 nullglob 安全枚举顶层会话文件。
# 产品维度：修复 v0.30.0 遗留会话位置，使用户能在正确项目下继续查看历史记录。
# 逻辑维度：解析 dry-run，枚举文件，读取首行 cwd，编码目标目录并逐个移动或跳过。
# 关键边界：真实模式会移动文件；依赖 jq，且目标已存在、JSON 无效或缺少 cwd 时不会覆盖。
# 新手阅读建议：先用 --dry-run 理解输出，再关注 cwd 编码规则和所有 SKIP 分支。

set -e

# AGENT_DIR 是会话根目录，可由 PI_AGENT_DIR 覆盖，默认位于用户主目录。
AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
# DRY_RUN 标记是否只预览迁移，默认执行真实移动。
DRY_RUN=false

if [[ "$1" == "--dry-run" ]]; then
	# DRY_RUN 在收到 --dry-run 时切换为 true，后续只输出计划而不移动文件。
    DRY_RUN=true
    echo "Dry run mode - no files will be moved"
    echo
fi

# Find all .jsonl files directly in agent dir (not in subdirectories)
# 只查找代理根目录直接包含的 .jsonl 文件，不进入子目录。
shopt -s nullglob
# files 保存顶层会话文件列表；无匹配时得到空数组而非字面量通配符。
files=("$AGENT_DIR"/*.jsonl)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
    echo "No session files found in $AGENT_DIR"
    exit 0
fi

echo "Found ${#files[@]} session file(s) to migrate"
echo

# migrated 统计已移动或 dry-run 中可移动的文件数量。
migrated=0
# failed 统计因读取、格式、cwd 或目标冲突而跳过的文件数量。
failed=0

# file 是当前待检查的旧版会话文件路径。
for file in "${files[@]}"; do
	# filename 是不含目录的会话文件名，用于日志和目标路径。
    filename=$(basename "$file")
    
    # Read first line and extract cwd using jq
	# 读取首行会话头；first_line 保存原始 JSON，读取失败时跳过。
    if ! first_line=$(head -1 "$file" 2>/dev/null); then
        echo "SKIP: $filename - cannot read file"
        ((failed++))
        continue
    fi
    
    # Parse JSON and extract cwd
	# 用 jq 提取 cwd；cwd 为空或 JSON 无效时分别由后续分支处理。
    if ! cwd=$(echo "$first_line" | jq -r '.cwd // empty' 2>/dev/null); then
        echo "SKIP: $filename - invalid JSON"
        ((failed++))
        continue
    fi
    
    if [[ -z "$cwd" ]]; then
        echo "SKIP: $filename - no cwd in session header"
        ((failed++))
        continue
    fi
    
    # Encode cwd: remove leading slash, replace slashes with dashes, wrap with --
	# encoded 是把路径分隔符替换为短横线后的安全目录名。
    encoded=$(echo "$cwd" | sed 's|^/||' | sed 's|[/:\\]|-|g')
    encoded="--${encoded}--"
    
	# target_dir 是当前工作目录对应的正式会话目录。
    target_dir="$AGENT_DIR/sessions/$encoded"
	# target_file 是迁移后的完整会话文件路径。
    target_file="$target_dir/$filename"
    
    if [[ -e "$target_file" ]]; then
        echo "SKIP: $filename - target already exists"
        ((failed++))
        continue
    fi
    
    echo "MIGRATE: $filename"
    echo "    cwd: $cwd"
    echo "    to:  $target_dir/"
    
    if [[ "$DRY_RUN" == false ]]; then
        mkdir -p "$target_dir"
        mv "$file" "$target_file"
    fi
    
    ((migrated++))
    echo
done

echo "---"
echo "Migrated: $migrated"
echo "Skipped:  $failed"

if [[ "$DRY_RUN" == true && $migrated -gt 0 ]]; then
    echo
    echo "Run without --dry-run to perform the migration"
fi
