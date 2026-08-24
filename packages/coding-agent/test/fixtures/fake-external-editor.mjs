/**
 * 文件职责：模拟外部编辑器进程，供编码代理的外部编辑功能测试调用。
 * 技术维度：使用 Node.js 文件系统同步 API 和命令行参数，记录临时文件信息并按参数模拟成功或失败。
 * 产品维度：无需启动真实编辑器即可验证文件权限、目录隔离、内容回写和失败处理。
 * 逻辑维度：读取捕获路径与待编辑文件，写入环境快照；可选失败退出，否则写入空内容或固定编辑文本。
 * 关键边界：会覆盖命令行指定文件，必须仅传测试临时路径；缺少必要参数时以状态码 1 退出。
 * 新手阅读建议：先看两个必需参数的位置，再按“记录快照—模拟失败—模拟保存”的顺序阅读。
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** 测试快照输出路径，取第三个进程参数；缺失时脚本不能记录调用信息。 */
const capturePath = process.argv[2];
/** 外部编辑器收到的目标文件路径，固定取最后一个参数；应指向测试临时文件。 */
const filePath = process.argv.at(-1);
if (!capturePath || !filePath) {
	process.exit(1);
}

/** 目标文件所在目录；用于记录目录内容和权限，验证编辑器临时目录是否正确。 */
const directory = dirname(filePath);
writeFileSync(
	capturePath,
	JSON.stringify({
		/** 记录编辑目标的原始路径，供父测试核对。 */
		filePath,
		/** 编辑前的 UTF-8 内容，供父测试验证初始文本。 */
		content: readFileSync(filePath, "utf-8"),
		/** 编辑时目录内的条目列表，用于检查临时文件隔离。 */
		entries: readdirSync(directory),
		/** 目录的 Unix 权限低九位；范围为 0 至 0o777。 */
		directoryMode: statSync(directory).mode & 0o777,
	}),
	"utf-8",
);

if (process.argv.includes("--fail")) {
	process.exit(1);
}
writeFileSync(filePath, process.argv.includes("--empty") ? "" : "edited\n", "utf-8");
