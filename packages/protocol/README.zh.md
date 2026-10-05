# @earendil-works/pi-protocol

运行时中立的路由信封、CBOR编码和字节流帧，用于实验性的Pi协议。

协议版本`8`定义：

- a版本握手，用于识别逻辑`serverId`；
- 明确的服务器和会话请求目标；
- 相关请求和响应，带有严格的JSON无透明负载；
- 请求取消、无透明订阅更新和非带内附件变更；
- 非空无透明错误码和有界传输消息。

服务器目标包含`{ serverId }`；会话目标包含`{ serverId, sessionId, attachmentId }`。组合路由栅栏调用到一个逻辑服务器、持久会话和实时呈现附件。管理`attach()`和`detach()`不返回路由标识符；服务器通过非带内`attachment`消息发布所选的实时路由。断开连接仅在已承认的调用结束后释放该呈现的附件。

Chord拥有这些信封内部承载的负载语义：`{ serviceId, instance?, member, args }`调用、`$chord.service`控制词汇、服务目录、订阅快照和更新、服务错误码以及独立的Delta路径编解码器用于复制状态。`pi-protocol`验证每个无透明负载是严格的JSON，但不验证或导出其Chord语法。客户端和服务器通过`@earendil-works/chord`在服务适配器边界解析这些值。

会话目录状态、管理结果、转录、模型、插件和所有其他应用值保持为无透明服务数据。持久会话及其框架保留在会话工作进程本地。服务器和会话调用无透明地路由到其拥有者，Chord和应用进行验证和调用。

服务器和工作进程生命周期有意在此公共协议之外。实验性的本地协调器仅是一个无透明消息路由器；每个可替换的服务器进程拥有私有生命周期协议。

每个线框由一个四字节无符号大端负载长度和一个确定长度的CBOR项目组成。`encodeClientMessage()`和`encodeServerMessage()`验证和编码完整的帧。`ClientMessageDecoder`和`ServerMessageDecoder`接受任意流的分片和合并。

```ts
import {
  PROTOCOL_VERSION,
  encodeClientMessage,
  ServerMessageDecoder,
  type ClientHello,
} from "@earendil-works/pi-protocol";

const hello: ClientHello = { type: "hello", version: PROTOCOL_VERSION };
transport.send(encodeClientMessage(hello));

const decoder = new ServerMessageDecoder({ maxFrameLength: 1024 * 1024 });
for (const message of decoder.push(incomingChunk)) handleServerMessage(message);
decoder.end();
```

所有信封模式拒绝未知对象属性，编码器递归拒绝非JSON无透明负载，包括非有限数字、字节数组、`undefined`、原型和循环。信封违规、格式错误的CBOR和无效的帧抛出`ProtocolValidationError`。负载特定适配器必须在解码后自行进行语义验证。传输必须保持字节顺序。实验性传输未实现对等身份验证和已认证的服务上下文。

默认限制为每个CBOR负载/帧16 MiB，1,000,000个数组元素或映射条目，以及64层嵌套项目。该协议为实验性，没有兼容性保证。

