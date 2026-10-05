# `@earendil-works/pi-example-plugin`

本包提供常规的 `session` 和 `tui` Chord 面向切面。Session-worker 面向切面提供远程问候服务。TUI 面向切面贡献 `/hello` 并调用该服务。

本包无需构建脚本。Pi 会询问 Chord 发现 `src/session.ts` 和 `src/tui.ts`，将两者都构建进其服务器拥有的插件缓存，并将 TUI 艺术品发送给客户端。

从仓库根目录：

```bash
PI_EXPERIMENTAL=1 ./pi-test.sh server \
  -e "$PWD/packages/coding-agent/examples/plugins/pi-example-plugin"
```

或者，客户端也可以为创建或恢复的 Session 选择本地服务器上的插件：

```bash
PI_EXPERIMENTAL=1 ./pi-test.sh client \
  -e "$PWD/packages/coding-agent/examples/plugins/pi-example-plugin"
```

重复 `-e` 可以选择多个插件包。客户端路径会在本地解析，仅发送给 Unix 服务器；Radius 客户端无法选择服务器文件系统路径。Session 和匹配的 TUI 面向切面会与该 Session 一起存储，因此后续服务器生成和客户端可以无需插件参数恢复该 Session。其他 Session 和其工作进程不受影响。活动 Session 会拒绝不同的包选择，而不是被重启。

`server -e` 建立服务器配置文件的默认 Session 和 TUI 面向切面。启动显式前台服务器且不带 `-e` 会清除该默认设置。客户端选择永远不会改变服务器根面向切面的生成。

在 TUI 中运行 `/hello Armin`。编辑面向切面后运行 `/reload`。服务器会原子性地重建包，重新加载附带的 Session-worker 生成，更新当前 TUI 生成，并将新艺术品提供给未来客户端。

包元数据可以覆盖或禁用常规条目：

```json
{
  "chord": {
    "facets": {
      "session": "./src/worker.ts",
      "tui": false
    }
  }
}
```


