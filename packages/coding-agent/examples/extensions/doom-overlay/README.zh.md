# DOOM叠加演示

在pi上以叠加方式运行DOOM。演示了叠加系统可以处理实时游戏渲染，达到35FPS。

## 使用方法

```bash
pi --extension ./examples/extensions/doom-overlay
```

然后运行：
```
/doom-overlay
```

约4MB的共享WAD文件会在首次运行时自动下载。

## 控制方法

| 操作         | 键盘         |
|--------------|--------------|
| 移动         | WASD或方向键 |
| 跑步         | Shift+WASD  |
| 开火         | F或Ctrl      |
| 使用/打开     | Space        |
| 武器         | 1-7          |
| 地图         | Tab          |
| 菜单         | Escape       |
| 暂停/退出     | Q            |

## 实现原理

DOOM以WebAssembly形式运行，编译自[doomgeneric](https://github.com/ozkl/doomgeneric)。每帧使用半块字符（▀）以24位颜色渲染，其中顶部像素为前景色，底部像素为背景色。

叠加系统使用：
- `width: "90%"` - 占终端宽度的90%
- `maxHeight: "80%"` - 最多占终端高度的80%
- `anchor: "center"` - 居中显示在终端中

高度根据宽度计算，以保持DOOM的3.2:1宽高比（考虑到半块渲染）。

## 版权信息

- [id Software](https://github.com/id-Software/DOOM) 提供原始DOOM
- [doomgeneric](https://github.com/ozkl/doomgeneric) 提供可移植DOOM实现
- [pi-doom](https://github.com/badlogic/pi-doom) 提供原始pi集成

