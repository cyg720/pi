# @earendil-works/pi-client

面向实验性Pi服务协议的传输中立客户端。

```ts
import { Client, type ByteTransportFactory } from "@earendil-works/pi-client";

const transportFactory: ByteTransportFactory = async (handlers) => {
  // Connect using WebSocket, Unix socket, or another ordered byte transport.
  return {
    async send(chunk) {
      // Deliver bytes in invocation order and honor backpressure.
    },
    close() {},
  };
};

const client = await Client.connect({
  serverId: "01234567-89ab-4def-8123-456789abcdef",
  transportFactory,
});
const result = await client.request(
  { serverId: client.hello.serverId },
  { serviceId: "example.service", member: "read", args: [] },
);
```

客户端会验证物理端点是否报告了预期的逻辑`serverId`。全局服务器请求携带该ID，每个Session请求携带完整的实时目标`{ serverId, sessionId, attachmentId }`。组合的持久化地址可防止跨服务器或跨Session的路由错误；服务器生成的附加标识可拒绝在切换或重新附加后延迟到达的帧。

由应用程序拥有的Chord服务绑定提供了类型化的服务器和Session API。`createClientServiceTransport()`将一个懒加载的服务器或Session路由适配为Chord传输；`request()`和`subscribeService()`保持其底层原始。客户端使用Chord的服务控制解析器和每订阅状态解码器；`pi-protocol`仅验证路由信封和严格JSON边界。服务订阅返回完整的提供者快照；绑定安装后会调用`start()`释放缓冲在水合过程中的更新。`Client`应用有序的非带内附加更改，但故意不构造类型化服务代理或解释应用合约。

如编码代理的`Transcript`等应用观察API均为普通Chord服务。客户端不解释其快照或更新。

断开连接或处置时，待处理请求本地拒绝，但已接受的工作可能在附加释放前仍会在远程完成。客户端会清除其实时附加路由。它不会自动重连或重放请求。断开连接后，调用`reconnect()`，通过应用程序管理服务重新附加，并仅显式重复已知安全的操作。
实验性本地协调器仅提供稳定端点并转发流量。可替换的服务器进程在公共客户端协议之外管理会话和工作生命周期。

调用传输处理程序如下：

- `handlers.onData(chunk)`用于接收字节；
- `handlers.onClose()`用于有序终端关闭；
- `handlers.onError(error)`用于传输失败。

传输工厂为每次尝试创建一个新鲜的已认证连接。请求按ID关联，服务器失败以`ServerError`暴露。

## Unix域套接字

Node.js和Bun消费者可以使用独立的Unix传输：

```ts
import { Client } from "@earendil-works/pi-client";
import { createUnixTransportFactory } from "@earendil-works/pi-client/unix";

const client = new Client({
  serverId: "01234567-89ab-4def-8123-456789abcdef",
  transportFactory: createUnixTransportFactory({ path: "/tmp/pi.sock" }),
});
await client.connect();
```

Unix发现扫描显式的物理路由目录，从文件名推导每个预期的服务器ID，并通过现有的握手进行验证：

```ts
import { discoverUnixServers } from "@earendil-works/pi-client/unix";

const routes = await discoverUnixServers({ directory: "/run/user/1000/pi" });
// [{ serverId: "...", path: "/run/user/1000/pi/<serverId>.sock" }]
```

格式错误的条目、非套接字、陈旧或无响应的端点以及服务器ID不匹配的条目会被忽略。发现过程只读，最多并发探测16个套接字。意外的文件系统和套接字错误会拒绝发现。可通过`timeoutMs`覆盖默认探测超时。

`ClientOptions.maxFrameLength`限制协议负载。`maxPendingBytes`限制排队的Unix传输输出。双方均需配置匹配的限制。

