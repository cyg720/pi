/**
 * 【文件职责】实现 `@earendil-works/pi-evals` 包中的 `vitest-evals/artifacts` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `node:crypto`、`node:fs/promises`、`node:path`、`vitest`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的评测场景提供运行与结果处理能力；本文件负责其中与 `vitest-evals/artifacts` 对应的子能力。
 * 【逻辑维度】对外入口包括 `PI_SESSION_SNAPSHOT_ARTIFACT`、`SourceAttachment`、`recordEvalSessionArtifact`、`recordEvalSourceArtifact`、`persistEvalArtifactReferences`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `PI_SESSION_SNAPSHOT_ARTIFACT`、`SourceAttachment`、`recordEvalSessionArtifact`、`recordEvalSourceArtifact`、`persistEvalArtifactReferences` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import {
	type RunnerTestCase,
	recordArtifact,
	type TestArtifact,
	type TestArtifactBase,
	type TestAttachment,
} from "vitest";
import type { HarnessRun } from "vitest-evals/harness";

export const PI_SESSION_SNAPSHOT_ARTIFACT = "piSessionJsonl";

const evalSessionArtifactKey = Symbol("pi-evals-session-artifact");
const evalSourceArtifactKey = Symbol("pi-evals-source-artifact");

interface PiSessionAttachment extends TestAttachment {
	name: "session.jsonl";
	contentType: "application/jsonl";
	body: string;
	bodyEncoding: "utf-8";
}

export interface SourceAttachment extends TestAttachment {
	name: string;
	contentType: string;
	body: string;
	bodyEncoding: "utf-8";
}

interface PiSessionArtifact extends TestArtifactBase {
	type: "@earendil-works/pi-evals:session";
	runId: string;
	attachments: [PiSessionAttachment] | [];
}

interface SourceArtifact extends TestArtifactBase {
	type: "@earendil-works/pi-evals:source";
	runId: string;
	attachments: [SourceAttachment] | [];
}

declare module "vitest" {
	interface TestArtifactRegistry {
		[evalSessionArtifactKey]: PiSessionArtifact;
		[evalSourceArtifactKey]: SourceArtifact;
	}
}

export async function recordEvalSessionArtifact(
	task: Readonly<RunnerTestCase>,
	run: Pick<HarnessRun, "artifacts">,
): Promise<void> {
	const runId = run.artifacts?.runId;
	const session = run.artifacts?.[PI_SESSION_SNAPSHOT_ARTIFACT];
	if (session === undefined) return;
	if (typeof runId !== "string" || typeof session !== "string") {
		throw new TypeError("Pi eval session artifact metadata is invalid.");
	}
	await recordArtifact(task, {
		type: "@earendil-works/pi-evals:session",
		runId,
		attachments: [
			{
				name: "session.jsonl",
				contentType: "application/jsonl",
				body: session,
				bodyEncoding: "utf-8",
			},
		],
	});
}

export async function recordEvalSourceArtifact(
	task: Readonly<RunnerTestCase>,
	runId: string,
	attachment: SourceAttachment,
): Promise<void> {
	await recordArtifact(task, {
		type: "@earendil-works/pi-evals:source",
		runId,
		attachments: [attachment],
	});
}

export async function persistEvalArtifactReferences(
	artifacts: ReadonlyArray<TestArtifact>,
	runId: string,
	artifactDirectory: string,
): Promise<Array<{ name: string; path: string }>> {
	const references: Array<{ name: string; path: string }> = [];
	for (const artifact of artifacts) {
		if (
			(artifact.type !== "@earendil-works/pi-evals:session" &&
				artifact.type !== "@earendil-works/pi-evals:source") ||
			artifact.runId !== runId
		) {
			continue;
		}
		const category = artifact.type === "@earendil-works/pi-evals:session" ? "sessions" : "sources";
		for (const attachment of artifact.attachments) {
			const name = basename(attachment.name);
			if (name !== attachment.name) throw new TypeError(`Invalid eval artifact name: ${attachment.name}`);
			const directory = join(artifactDirectory, category, createHash("sha256").update(runId).digest("hex"));
			await mkdir(directory, { recursive: true, mode: 0o700 });
			const path = join(directory, name);
			await writeFile(path, attachment.body, { encoding: "utf8", mode: 0o600 });
			references.push({ name, path: relative(artifactDirectory, path) });
		}
	}
	return references;
}
