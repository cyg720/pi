/**
 * 文件职责：验证旧键位名称迁移到命名空间标识的磁盘改写、冲突处理和内存兼容。
 * 技术维度：使用 Vitest、临时目录、真实 JSON 配置文件和 KeybindingsManager 迁移接口。
 * 产品维度：保证升级后的用户快捷键继续生效，并优先保留用户已写入的新格式配置。
 * 逻辑维度：创建隔离代理目录，运行迁移或加载管理器，比较改写文件与有效键位映射。
 * 关键边界：用例会临时修改代理目录环境变量并递归清理临时目录；不覆盖新键名值。
 * 新手阅读建议：先看 createAgentDir，再依次阅读旧名改写、冲突优先级和仅内存兼容三例。
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.ts";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { runMigrations } from "../src/migrations.ts";

describe("keybindings migration", () => {
	// tempDirs 记录本测试组创建的代理临时目录，供 afterEach 清理。
	const tempDirs: string[] = [];

	// 每个用例后递归删除登记的临时目录；无参数，无返回值。
	afterEach(() => {
		// dir 是当前待清理的临时代理目录。
		for (const dir of tempDirs.splice(0)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	/**
	 * 创建包含指定 keybindings.json 的隔离代理目录。
	 * 参数：config 为待写入的键位配置对象。
	 * 返回值：新建代理目录路径。
	 * 使用示例：`createAgentDir({ cursorUp: ["up"] })`。
	 */
	function createAgentDir(config: Record<string, unknown>): string {
		// agentDir 是当前用例唯一的临时代理目录。
		const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-keybindings-test-"));
		tempDirs.push(agentDir);
		fs.writeFileSync(path.join(agentDir, "keybindings.json"), `${JSON.stringify(config, null, 2)}\n`, "utf-8");
		return agentDir;
	}

	// 验证旧短名称会改写为 TUI 或应用命名空间标识；无参数，无返回值。
	it("rewrites old key names to namespaced ids", () => {
		// agentDir 是包含两个旧格式键位的隔离配置目录。
		const agentDir = createAgentDir({
			cursorUp: ["up", "ctrl+p"],
			expandTools: "ctrl+x",
		});
		// previousAgentDir 保存测试前代理目录环境值，迁移后恢复。
		const previousAgentDir = process.env[ENV_AGENT_DIR];
		process.env[ENV_AGENT_DIR] = agentDir;
		runMigrations(agentDir);
		if (previousAgentDir === undefined) {
			delete process.env[ENV_AGENT_DIR];
		} else {
			process.env[ENV_AGENT_DIR] = previousAgentDir;
		}

		// migrated 是从磁盘重新读取的迁移后键位映射。
		const migrated = JSON.parse(fs.readFileSync(path.join(agentDir, "keybindings.json"), "utf-8")) as Record<
			string,
			unknown
		>;
		expect(migrated).toEqual({
			"tui.editor.cursorUp": ["up", "ctrl+p"],
			"app.tools.expand": "ctrl+x",
		});
	});

	// 验证旧名与新名冲突时保留显式的新命名空间值；无参数，无返回值。
	it("keeps the namespaced value when old and new names both exist", () => {
		// agentDir 是同时包含旧名和新名的隔离配置目录。
		const agentDir = createAgentDir({
			expandTools: "ctrl+x",
			"app.tools.expand": "ctrl+y",
		});
		// previousAgentDir 保存测试前代理目录环境值，迁移后恢复。
		const previousAgentDir = process.env[ENV_AGENT_DIR];
		process.env[ENV_AGENT_DIR] = agentDir;
		runMigrations(agentDir);
		if (previousAgentDir === undefined) {
			delete process.env[ENV_AGENT_DIR];
		} else {
			process.env[ENV_AGENT_DIR] = previousAgentDir;
		}

		// migrated 是用于确认冲突处理结果的迁移后文件内容。
		const migrated = JSON.parse(fs.readFileSync(path.join(agentDir, "keybindings.json"), "utf-8")) as Record<
			string,
			unknown
		>;
		expect(migrated).toEqual({
			"app.tools.expand": "ctrl+y",
		});
	});

	// 验证文件改写前管理器也能在内存中识别旧键名；无参数，无返回值。
	it("loads old key names in memory before the file is rewritten", () => {
		// agentDir 是包含两个旧格式操作名称的配置目录。
		const agentDir = createAgentDir({
			selectConfirm: "enter",
			interrupt: "ctrl+x",
		});

		// keybindings 是从旧配置直接创建的键位管理器。
		const keybindings = KeybindingsManager.create(agentDir);

		expect(keybindings.getUserBindings()).toEqual({
			"tui.select.confirm": "enter",
			"app.interrupt": "ctrl+x",
		});
		// effective 是合并默认值与用户设置后的最终键位配置。
		const effective = keybindings.getEffectiveConfig();
		expect(effective["tui.select.confirm"]).toBe("enter");
		expect(effective["app.interrupt"]).toBe("ctrl+x");
	});
});
