# @earendil-works/pi-server

本地实验服务器，负责将客户端路由到应用托管的持久化会话。

当前实现支持服务器级和会话级的 facet 服务路由，以及多个展示端连接。`RoutedServerServiceHost.attachClient()` 创建连接作用域内的服务器服务端点，仅提供有限的连接管理能力。`RoutedSessionHandle.attachClient()` 返回展示端作用域内的会话能力。其 `invokeService()` 将服务/成员消息封装原样转发到所选会话端点；服务器验证连接路由，但不解析消息的业务内容，也不加载 facet 合约。

- 服务器服务调用和订阅通过连接的 `RoutedServerServiceAttachment` 原样路由，不解析业务内容；
- 应用拥有的 `SessionDirectory` 将私有目录映射为可复制、可安全提供给展示端的状态；
- 应用拥有的 `SessionManagement` 创建、移除、连接和断开会话，业务结果不暴露路由 ID；
- 路由器安装或清除活动路由后，通过独立通道发布连接变更；
- 会话服务调用通过 `invokeService` 路由，无需服务器端解码业务负载；
- 服务订阅更新始终限定在发起请求的连接范围内；
- 对话记录等应用观察数据作为普通服务状态路由，服务器不拥有其业务模式。

一个会话可以连接多个展示端。同一连接重复发起 `attach` 是幂等的；每次成功连接都会获得服务器生成的 `attachmentId`，它仅作为路由控制数据交付。会话请求携带 `{ serverId, sessionId, attachmentId }`，服务器会拒绝过期或不匹配的路由。连接丢失会使该连接的本地响应以拒绝状态结束，但只有已接纳的服务调用全部结束后，才会释放对应的展示端连接。展示端需求为零时，宿主结合工作进程本地的 Harness 活动，决定何时允许工作进程退出。服务器关闭会关闭所有已路由的会话句柄，释放工作进程和会话写入者所有权。

```ts
import { randomUUID } from "node:crypto";
import {
  type RoutedServerServiceHost,
  type RoutedSessionHandle,
  type ServerHost,
  type SessionMetadata,
  SessionNotFoundError,
} from "@earendil-works/pi-server";
import { createUnixServer, getUnixSocketPath } from "@earendil-works/pi-server/unix";

interface StoredSession extends SessionMetadata {
  path: string;
}

async function startServer(
  serverServices: RoutedServerServiceHost,
  sessions: Map<string, StoredSession>,
  openRoutedSession: (session: StoredSession) => Promise<RoutedSessionHandle>,
) {
  const host: ServerHost<StoredSession> = {
    serverServices,
    async resolveSession(sessionId) {
      const metadata = sessions.get(sessionId);
      if (!metadata) throw new SessionNotFoundError(`Unknown session: ${sessionId}`);
      return metadata;
    },
    openSession: (metadata) => openRoutedSession(metadata),
  };

  const serverId = randomUUID();
  const server = createUnixServer(host, {
    serverId,
    path: getUnixSocketPath(serverId, "/run/user/1000/pi"),
  });
  await server.start();
  return server;
}
```

应用必须提供服务器服务宿主、有界的会话解析器和路由会话工厂。`SessionMetadata` 只要求 `id` 字段；应用可以扩展自己的存储字段。会话发现和管理由应用拥有的服务负责；协议服务器只在路由展示端连接时向解析器请求元数据。宿主负责获取工作进程本地的会话和 Harness。失败时的清理也在该工作进程内完成。已打开的 JavaScript 会话对象和 Harness 都不会跨越进程边界。

`serverId`由启动器提供逻辑身份，非套接字地址。Unix预设要求显式物理`path`；`getUnixSocketPath()`从调用者选定目录派生一个。建议选择短小私有的运行时目录，而非从无界主目录路径派生路由。长期运行的启动器可重用相同ID和路径替换服务器进程。

`Server`通过`ServerListener`组合传输；对等认证由应用策略管理，实验性Unix传输不实现。Unix子模块提供`createUnixListener()`和`createUnixServer()`。低级路由信封验证、CBOR和帧机制来自`@earendil-works/pi-protocol`；Chord负责服务控制解析、错误码、快照与更新及每个订阅的复制状态编码。

服务器和工作者生命周期管理在公共Pi协议之外。可替换的应用服务器将连接附加转换为私有需求更新；工作者结合带生成标签的需求与权威Harness活动。实验性协调器仅提供稳定的路由和通用服务器生成连接变更报告。

