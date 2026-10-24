import { parentPort, workerData } from "node:worker_threads";
import { generateDiffString, generateUnifiedPatch } from "@earendil-works/pi-coding-agent";

const { path, oldContent, newContent } = workerData as { path: string; oldContent: string; newContent: string };
parentPort?.postMessage({
	...generateDiffString(oldContent, newContent),
	patch: generateUnifiedPatch(path, oldContent, newContent),
});
