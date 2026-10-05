# 计划模式扩展

只读探索模式，用于安全的代码分析。

## 功能

- **内置写入工具禁用**：禁用编辑/写入功能，同时保留其他活动工具
- **Bash 允许列表**：仅允许只读的 bash 命令
- **计划提取**：从 `Plan:` 部分提取编号步骤
- **进度跟踪**：小部件显示执行过程中的完成状态
- **[DONE:n] 标记**：明确的步骤完成跟踪
- **会话持久化**：状态在会话恢复时保持

## 命令

- `/plan` - 切换计划模式
- `/todos` - 显示当前计划进度
- `Ctrl+Alt+P` - 切换计划模式（快捷键）

## 使用方法

1. 使用 `/plan` 或 `--plan` 标志启用计划模式
2. 请求代理分析代码并创建计划
3. 代理应在 `Plan:` 标题下输出编号的计划：

```
Plan:
1. First step description
2. Second step description
3. Third step description
```

4. 当提示时选择“执行计划”
5. 在执行过程中，代理使用 `[DONE:n]` 标签标记已完成的步骤
6. 进度小部件显示完成状态

## 工作原理

### 计划模式（只读）
- 内置编辑/写入工具禁用
- 其他活动工具保持可用
- 通过允许列表过滤 bash 命令
- 代理创建计划而不做任何更改

### 执行模式
- 恢复完整工具访问权限
- 代理按顺序执行步骤
- `[DONE:n]` 标记跟踪完成情况
- 小部件显示进度

### 命令允许列表

安全命令（允许）：
- 文件检查：`cat`, `head`, `tail`, `less`, `more`
- 搜索：`grep`, `find`, `rg`, `fd`
- 目录：`ls`, `pwd`, `tree`
- Git 读取：`git status`, `git log`, `git diff`, `git branch`
- 包信息：`npm list`, `npm outdated`, `yarn info`
- 系统信息：`uname`, `whoami`, `date`, `uptime`

被阻止的命令：
- 文件修改：`rm`, `mv`, `cp`, `mkdir`, `touch`
- Git 写入：`git add`, `git commit`, `git push`
- 包安装：`npm install`, `yarn add`, `pip install`
- 系统：`sudo`, `kill`, `reboot`
- 编辑器：`vim`, `nano`, `code`

