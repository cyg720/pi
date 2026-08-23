/**
 * 【文件职责】Bedrock 供应商模块装配：把 Bedrock Converse 流式实现打包为 ProviderStreams 形状。
 * 【技术维度】纯再导出 + 对象聚合。
 * 【产品维度】供应商工厂（providers/amazon-bedrock.ts）以此为载体取得 Bedrock 的流式能力。
 * 【逻辑维度】导入 stream/streamSimple → 组装为模块对象。
 * 【关键边界】与 providers/amazon-bedrock.ts 的供应商工厂配合使用，本文件仅提供 API 层。
 * 【新手阅读建议】半分钟读完：记住它是 Bedrock 的 stream 入口封装即可。
 */
import { stream, streamSimple } from "./api/bedrock-converse-stream.ts";

// Bedrock 供应商模块：stream/streamSimple 两个流式入口
export const bedrockProviderModule = {
	stream,
	streamSimple,
};
