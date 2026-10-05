# pi-coding-agent SDK 示例代码，进程集成及扩展

## 命令行集成

[`rpc-client.ts`](rpc-client.ts) 使用类型化的 `RpcClient` 在子进程中运行 Pi，流式传输事件，并等待运行结束。

从仓库检出后运行之前，请先构建编码代理包：

```bash
node examples/rpc-client.ts "Explain this repository"
```

## 目录

### [sdk/](sdk/)
通过 `createAgentSession()` 实现程序化使用。展示了如何自定义模型、提示、工具、扩展和会话管理。

### [extensions/](extensions/)
演示了以下示例扩展：
- 生命周期事件处理器（工具拦截、安全门、上下文修改）
- 自定义工具（待办事项列表、问题、子代理、输出截断）
- 命令和键盘快捷键
- 自定义 UI（页脚、页眉、编辑器、覆盖层）
- Git 集成（检查点、自动提交）
- 系统提示修改和自定义压缩
- 外部集成（SSH、文件监视器、系统主题同步）
- 自定义提供者（带自定义流式传输的 Anthropic、GitLab Duo）

### [plugins/pi-example-plugin/](plugins/pi-example-plugin/)
一个实验性插件包，Pi 会将其自动构建为独立的 Session-worker 和 TUI Chord 面相。


## 文档

- [SDK 示例](sdk/README.md)
- [命令行集成](../docs/cli-integration.md)
- [扩展文档](../docs/extensions.md)
- [技能文档](../docs/skills.md)

