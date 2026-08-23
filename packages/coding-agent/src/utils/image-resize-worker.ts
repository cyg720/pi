/**
 * 【文件职责】图片缩放 Worker 线程入口：接收主线程的缩放请求（字节/类型/选项），
 *              在 Worker 内执行缩放并回传结果，避免阻塞主线程。
 * 【技术维度】node:worker_threads 消息协议；复用 image-resize-core 的进程内缩放。
 * 【产品维度】大图片缩放不卡 UI。
 * 【逻辑维度】parentPort.on 接收请求 → resizeImageInProcess → 回传 ResizedImage。
 * 【新手阅读建议】看消息的请求/响应结构即可。
 */
import { parentPort } from "node:worker_threads";
import { type ImageResizeOptions, type ResizedImage, resizeImageInProcess } from "./image-resize-core.ts";

interface ResizeImageWorkerRequest {
	inputBytes: Uint8Array;
	mimeType: string;
	options?: ImageResizeOptions;
}

interface ResizeImageWorkerResponse {
	result?: ResizedImage | null;
	error?: string;
}

function isResizeImageWorkerRequest(value: unknown): value is ResizeImageWorkerRequest {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return record.inputBytes instanceof Uint8Array && typeof record.mimeType === "string";
}

const port = parentPort;
if (!port) {
	throw new Error("image resize worker requires parentPort");
}

port.once("message", (message: unknown) => {
	void (async () => {
		try {
			if (!isResizeImageWorkerRequest(message)) {
				throw new Error("Invalid image resize worker request");
			}
			const result = await resizeImageInProcess(message.inputBytes, message.mimeType, message.options);
			const response: ResizeImageWorkerResponse = { result };
			port.postMessage(response);
		} catch (error) {
			const response: ResizeImageWorkerResponse = {
				error: error instanceof Error ? error.message : String(error),
			};
			port.postMessage(response);
		}
	})();
});
