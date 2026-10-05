# 变更日志

## [未发布]

### 重大变更

- `FileSystem`需要`openBinaryReader()`和`openDirReader()`；自定义环境必须实现它们。
- `BinaryReader`需要`scanLines()`。
- `FileSystem`需要`watch()`。
- `Shell.exec()`除了接受shell字符串外，还接受argv数组，`ShellExecOptions.onOutput`接收第三个`info`参数命名流（`stdout`或`stderr`）；自定义环境必须接受两种形式并将流传递。

### 新增

- `openBinaryReader()`用于对已打开的普通文件进行有界的定位读取，`noFollow`拒绝以最终组件为symlink。
- `openDirReader()`用于分页目录列表，仅读取返回条目的元数据。
- `exec()`的argv形式，该形式不带shell运行程序。
- `createEnvConformance()`和`registerEnvConformance()`在`@earendil-works/pi-durable/testing`中，用于检查自定义`ExecutionEnv`实现。
- `settings.progress`与`partialIntervalMs`和`outputIntervalMs`配置生成部分和运行工具输出的提交频率；默认保持100毫秒（[#10357](https://github.com/earendil-works/pi/issues/10357)）
- `ShellExecOptions.window`和`ShellOutputInfo.skipped`：环境可以省略调用者保留尾部之外的shell输出并报告省略，因此远程环境不必传输调用者丢弃的输出。`ToolExecutionApi.outputWindow`提供窗口，`output(chunk, skipped)`计数省略；`bash`工具将它们传递。
- `BinaryReader.scanLines()`在一个过程中定位并测量行的跨度；`LineScanner`、`StreamDecoder`、`rangeDecoder()`和`startsWithBom()`在`@earendil-works/pi-durable/env`中，让其他环境能够像`NodeExecutionEnv`一样解码和扫描。
- `FileSystem.watch()`会报告文件和目录的变化，支持递归和排除，包括缺失的目标，带有明确的`overflow`和`error`以及`native`或`polling`模式。`NodeExecutionEnv`在Windows（原生监视器会保持目录打开，这会阻止重命名其父目录）、网络和FUSE文件系统上进行轮询，并在macOS上安装原生监视器后不久重新扫描，因为FSEvents会在`fs.watch`返回后错过立即做出的更改；其`watch`选项设置了模式、轮询间隔和目录限制。
### 已更改

- `read`工具仅读取文件的头部、一次扫描以及它显示的行，而不是加载整个文件；其结果未变。

### 已修复

- `NodeExecutionEnv.flushFile()`在目录上失败，Windows和POSIX上均出现`is_directory`错误。
-  尾部保留的工具输出不再依赖于进度提交发生的时间：进度快照将存储的输出压缩到保留的窗口，该窗口可以移动到后续窗口第一行开始的位置。

-  `NodeExecutionEnv` shell 输出和文本行读取器不再在块边界后丢弃 U+FEFF；Node 的流式 `TextDecoder` 带 BOM 处理已丢弃它，而不同于一次性解码所有字节。

## [1.0.2] - 2026-10-04

###  修复了

-  每个对话保留一个独立的提供者会话 UUID，并将其转发用于提示缓存和会话关联性（[#10424](https://github.com/earendil-works/pi/issues/10424)）

## [1.0.1] - 2026-10-03

## [1.0.0] - 2026-10-01

###  增加了

-  `@earendil-works/pi-durable` 的初始版本，这是一个持久化代理框架。请参阅 [README](README.md) 和 [设计文档](https://github.com/earendil-works/pi/blob/main/packages/durable/docs/spec.md)。

