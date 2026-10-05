# Linux剪贴板助手

提供基于`libxcb.so.1`的异步X11文本和图像读取功能。预构建版本支持x64和arm64架构，运行于glibc和musl。读取操作有超时限制；如果原生操作卡顿，助手将不可用，直到操作完成。

当原生读取不可用时，编码代理会回退到命令行工具。Wayland读取使用`wl-paste`；所有Linux写入操作均使用现有的命令行或终端剪贴板路径。

## 构建

安装C编译器和XCB开发头文件，然后在每个支持的Linux架构的仓库根目录下运行：

```sh
npm --prefix packages/tui run build:native:linux
```

## 测试

安装构建依赖项以及`pkg-config`、`Xvfb`和`xclip`，然后在`packages/tui`目录下运行：

```sh
node --test test/native-clipboard-linux.test.ts
```

测试使用隔离的X11服务器，而非桌面剪贴板。当依赖项缺失时，测试会跳过。

