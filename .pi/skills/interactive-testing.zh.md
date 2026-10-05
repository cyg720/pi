---
name: interactive-testing
description: 在受控的tmux终端中测试和调试pi的交互模式。用于TUI行为检查和交互式发布冒烟测试。
---

# 使用tmux测试pi交互模式

在受控终端中运行TUI（从仓库根目录，向上两层目录）：

```bash
tmux new-session -d -s pi-test -x 80 -y 24
tmux send-keys -t pi-test "./pi-test.sh" Enter
sleep 3 && tmux capture-pane -t pi-test -p     # capture after startup
tmux send-keys -t pi-test "your prompt here" Enter
tmux send-keys -t pi-test Escape               # special keys (also C-o for ctrl+o, etc.)
tmux kill-session -t pi-test
```

对于发布冒烟测试，启动tmux会话时使用`-c /tmp`，并将`./pi-test.sh`替换为发布二进制文件的绝对路径。分别测试Node和Bun二进制文件，提交提示并等待模型回复；单独启动不构成通过的冒烟测试。

