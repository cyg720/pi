/**
 * 文件职责：验证版本同步脚本会更新私有工作区依赖、跳过生成清单并强制已发布包锁步。
 * 技术维度：使用 Node 测试运行器、临时文件系统、子进程和严格断言进行黑盒测试。
 * 产品维度：避免发布时包版本不一致，同时保护仅用于安装锁定的生成 package.json 不被改写。
 * 逻辑维度：创建临时多包目录，运行同步脚本，检查依赖结果，再制造版本分歧验证失败退出。
 * 关键边界：测试会创建并递归删除临时目录；调用真实同步脚本但只作用于临时 packages 路径。
 * 新手阅读建议：先看三个辅助函数，再按首次成功同步和第二次锁步失败两阶段阅读主用例。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// 保存被测 sync-versions.js 的本地文件路径，供子进程直接执行。
const syncVersionsScript = fileURLToPath(new URL("./sync-versions.js", import.meta.url));

/**
 * 在临时工作区写入格式化的 package.json。
 * 参数：root 为临时根目录，relativeDirectory 为包目录，manifest 为清单对象。
 * 返回值：写入完成后解决的 Promise。
 * 使用示例：`await writeManifest(root, "packages/ai", { name, version })`。
 */
async function writeManifest(root, relativeDirectory, manifest) {
	// directory 是清单所在包目录的绝对路径。
	const directory = join(root, relativeDirectory);
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, "package.json"), `${JSON.stringify(manifest, null, "\t")}\n`);
}

/**
 * 读取并解析临时工作区中的 package.json。
 * 参数：root 为临时根目录，relativeDirectory 为包目录。
 * 返回值：解析后的清单对象 Promise。
 * 使用示例：`await readManifest(root, "packages/evals")`。
 */
async function readManifest(root, relativeDirectory) {
	return JSON.parse(await readFile(join(root, relativeDirectory, "package.json"), "utf8"));
}

/**
 * 在指定临时工作区同步 packages 下的版本。
 * 参数：root 为子进程工作目录和临时仓库根目录。
 * 返回值：spawnSync 的状态、标准输出和错误输出结果。
 * 使用示例：`const result = runSyncVersions(root)`。
 */
function runSyncVersions(root) {
	return spawnSync(process.execPath, [syncVersionsScript, join(root, "packages")], {
		cwd: root,
		encoding: "utf8",
	});
}


// 验证私有依赖更新、生成清单跳过和已发布包版本锁步；测试回调无参数，无返回值。
test("synchronizes private dependencies without touching generated manifests or relaxing published lockstep", async () => {
	// root 是本用例独享的临时仓库目录，最终在 finally 中删除。
	const root = await mkdtemp(join(tmpdir(), "pi-sync-versions-"));
	try {
		await writeManifest(root, "packages/ai", {
			name: "@earendil-works/pi-ai",
			version: "2.0.0",
		});
		await writeManifest(root, "packages/coding-agent", {
			name: "@earendil-works/pi-coding-agent",
			version: "2.0.0",
		});
		await writeManifest(root, "packages/evals", {
			name: "@earendil-works/pi-evals",
			version: "9.9.9",
			private: true,
			dependencies: {
				"@earendil-works/pi-coding-agent": "^1.0.0",
				"@mariozechner/pi-ai": "npm:@earendil-works/pi-ai@1.0.0",
			},
		});
		await writeManifest(root, "packages/coding-agent/install-lock", {
			name: "generated-install-lock",
			version: "0.0.0",
			private: true,
			dependencies: {
				"@earendil-works/pi-coding-agent": "^1.0.0",
			},
		});

		// result 保存所有已发布包同版本时的成功同步子进程结果。
		const result = runSyncVersions(root);
		assert.equal(result.status, 0, result.stderr);

		// evalsManifest 是同步后的私有包清单，应跟随发布包版本更新依赖。
		const evalsManifest = await readManifest(root, "packages/evals");
		assert.equal(evalsManifest.dependencies["@earendil-works/pi-coding-agent"], "^2.0.0");
		assert.equal(evalsManifest.dependencies["@mariozechner/pi-ai"], "npm:@earendil-works/pi-ai@2.0.0");
		// generatedManifest 是生成目录清单，其旧依赖范围必须保持不变。
		const generatedManifest = await readManifest(root, "packages/coding-agent/install-lock");
		assert.equal(generatedManifest.dependencies["@earendil-works/pi-coding-agent"], "^1.0.0");

		await writeManifest(root, "packages/ai", {
			name: "@earendil-works/pi-ai",
			version: "3.0.0",
		});
		// lockstepFailure 保存已发布包版本分歧时预期失败的子进程结果。
		const lockstepFailure = runSyncVersions(root);
		assert.equal(lockstepFailure.status, 1, lockstepFailure.stderr);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
