# Darwin 原生预构建

提供修饰键状态和异步文本、图像和文件路径剪贴板访问，使用 AppKit。

## 构建

在 macOS 上，从仓库根目录运行：

```sh
npm --prefix packages/tui run build:native:darwin
```

构建使用 Apple clang 和通过 `xcrun` 获取的 macOS SDK。Intel 或 Apple Silicon 均可构建两个目标：arm64（macOS 11+）和 x64（macOS 10.15+）。

跨平台构建需要包含 macOS SDK 和 Mach-O 链接器的 Darwin 工具链，例如 osxcross：

```sh
CC=/path/to/osxcross/clang SDKROOT=/path/to/MacOSX.sdk \
  npm --prefix packages/tui run build:native:darwin
```

SDK 必须在 Apple 许可证下获取和使用。仅使用普通 clang 或 Zig 是不够的。

