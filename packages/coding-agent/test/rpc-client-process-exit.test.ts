/**
 * 文件职责：验证 RPC 子进程在请求处理中退出时，客户端会拒绝尚未完成的请求。
 * 技术维度：使用 Vitest、临时目录、动态子进程脚本和真实 RpcClient 进程通信。
 * 产品维度：代理进程崩溃时让调用方及时得到明确错误，而不是请求永久挂起。
 * 逻辑维度：生成收到输入即以 43 退出的脚本，启动客户端，发起命令并断言退出错误。
 * 关键边界：测试会创建并递归删除系统临时目录；不应把临时路径指向仓库或用户数据。
 * 新手阅读建议：先读 writeChildScript 生成的脚本内容，再沿 start、getCommands、退出错误阅读。
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { RpcClient } from "../src/modes/rpc/rpc-client.ts";

/** 本文件创建的临时目录列表；每个用例后统一删除。 */
const tempDirs: string[] = [];

/**
 * 在唯一临时目录中写入一个子进程 ESM 脚本。
 * @param contents 要写入 child.mjs 的完整 JavaScript 源码。
 * @returns 新脚本的绝对路径，并把父目录登记到清理列表。
 * @example `writeChildScript("process.exit(1)")`。
 */
function writeChildScript(contents: string): string {
	/** mkdtempSync 创建的唯一测试目录，位于系统临时目录内。 */
	const dir = mkdtempSync(join(tmpdir(), "pi-rpc-client-exit-"));
	tempDirs.push(dir);
	/** 即将作为 RPC 子进程入口的 child.mjs 路径。 */
	const path = join(dir, "child.mjs");
	writeFileSync(path, contents);
	return path;
}

/** 每个用例后删除本文件登记的所有临时目录。 */
afterEach(() => {
	// dir 来自 tempDirs 且由 mkdtempSync 创建；递归强制删除仅限这些已验证临时目录。
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

/** RpcClient 子进程失败处理测试组。 */
describe("RpcClient child process failures", () => {
	/** 验证子进程以代码 43 退出后，进行中的 getCommands Promise 返回明确拒绝。 */
	test("rejects an in-flight request when the child process exits", async () => {
		/** 使用即时退出脚本启动的 RPC 客户端。 */
		const client = new RpcClient({
			cliPath: writeChildScript(`
process.stdin.once("data", () => {
	process.exit(43);
});
process.stdin.resume();
`),
		});

		await client.start();

		await expect(client.getCommands()).rejects.toThrow(/Agent process exited \(code=43 signal=null\)/);
	});
});
