/**
 * 文件职责：验证 plan-mode 示例扩展的安全命令判断、步骤文本清洗、待办提取和完成标记更新。
 * 技术维度：使用 Vitest 对纯字符串解析函数执行表格式边界测试，不依赖文件系统或外部进程。
 * 产品维度：保证计划模式只放行只读命令，并把模型回复稳定转换为简洁、可更新的待办列表。
 * 逻辑维度：按安全命令、文本清洗、计划提取、DONE 标记解析和完成状态更新五组组织用例。
 * 关键边界：安全判断采用允许列表而非仅排除危险命令；无 Plan 标题、过短或代码式步骤会被过滤。
 * 新手阅读建议：先读 isSafeCommand 的正反例理解安全边界，再依次跟随文字从清洗到完成标记的流程。
 */
import { describe, expect, it } from "vitest";
import {
	cleanStepText,
	extractDoneSteps,
	extractTodoItems,
	isSafeCommand,
	markCompletedSteps,
	type TodoItem,
} from "../examples/extensions/plan-mode/utils.ts";

/** 覆盖计划模式只读命令允许列表和常见危险命令拒绝规则。 */
describe("isSafeCommand", () => {
	describe("safe commands", () => {
		it("allows basic read commands", () => {
			expect(isSafeCommand("ls -la")).toBe(true);
			expect(isSafeCommand("cat file.txt")).toBe(true);
			expect(isSafeCommand("head -n 10 file.txt")).toBe(true);
			expect(isSafeCommand("tail -f log.txt")).toBe(true);
			expect(isSafeCommand("grep pattern file")).toBe(true);
			expect(isSafeCommand("find . -name '*.ts'")).toBe(true);
		});

		it("allows git read commands", () => {
			expect(isSafeCommand("git status")).toBe(true);
			expect(isSafeCommand("git log --oneline")).toBe(true);
			expect(isSafeCommand("git diff")).toBe(true);
			expect(isSafeCommand("git branch")).toBe(true);
		});

		it("allows npm/yarn read commands", () => {
			expect(isSafeCommand("npm list")).toBe(true);
			expect(isSafeCommand("npm outdated")).toBe(true);
			expect(isSafeCommand("yarn info react")).toBe(true);
		});

		it("allows other safe commands", () => {
			expect(isSafeCommand("pwd")).toBe(true);
			expect(isSafeCommand("echo hello")).toBe(true);
			expect(isSafeCommand("wc -l file.txt")).toBe(true);
			expect(isSafeCommand("du -sh .")).toBe(true);
			expect(isSafeCommand("df -h")).toBe(true);
		});
	});

	describe("destructive commands", () => {
		it("blocks file modification commands", () => {
			expect(isSafeCommand("rm file.txt")).toBe(false);
			expect(isSafeCommand("rm -rf dir")).toBe(false);
			expect(isSafeCommand("mv old new")).toBe(false);
			expect(isSafeCommand("cp src dst")).toBe(false);
			expect(isSafeCommand("mkdir newdir")).toBe(false);
			expect(isSafeCommand("touch newfile")).toBe(false);
		});

		it("blocks git write commands", () => {
			expect(isSafeCommand("git add .")).toBe(false);
			expect(isSafeCommand("git commit -m 'msg'")).toBe(false);
			expect(isSafeCommand("git push")).toBe(false);
			expect(isSafeCommand("git checkout main")).toBe(false);
			expect(isSafeCommand("git reset --hard")).toBe(false);
		});

		it("blocks package manager installs", () => {
			expect(isSafeCommand("npm install lodash")).toBe(false);
			expect(isSafeCommand("yarn add react")).toBe(false);
			expect(isSafeCommand("pip install requests")).toBe(false);
			expect(isSafeCommand("brew install node")).toBe(false);
		});

		it("blocks redirects", () => {
			expect(isSafeCommand("echo hello > file.txt")).toBe(false);
			expect(isSafeCommand("cat foo >> bar")).toBe(false);
			expect(isSafeCommand(">file.txt")).toBe(false);
		});

		it("blocks dangerous commands", () => {
			expect(isSafeCommand("sudo rm -rf /")).toBe(false);
			expect(isSafeCommand("kill -9 1234")).toBe(false);
			expect(isSafeCommand("reboot")).toBe(false);
		});

		it("blocks editors", () => {
			expect(isSafeCommand("vim file.txt")).toBe(false);
			expect(isSafeCommand("nano file.txt")).toBe(false);
			expect(isSafeCommand("code .")).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("requires command to be in safe list (not just non-destructive)", () => {
			expect(isSafeCommand("unknown-command")).toBe(false);
			expect(isSafeCommand("my-script.sh")).toBe(false);
		});

		it("handles commands with leading whitespace", () => {
			expect(isSafeCommand("  ls -la")).toBe(true);
			expect(isSafeCommand("  rm file")).toBe(false);
		});
	});
});

/** 覆盖计划步骤显示文本的 Markdown 清理、动作词移除、截断和空白归一化。 */
describe("cleanStepText", () => {
	it("removes markdown bold/italic", () => {
		expect(cleanStepText("**bold text**")).toBe("Bold text");
		expect(cleanStepText("*italic text*")).toBe("Italic text");
	});

	it("removes markdown code", () => {
		expect(cleanStepText("run `npm install`")).toBe("Npm install"); // "run" is stripped as action word
		// run 会作为开头动作词被移除，只保留真正的步骤内容。
		expect(cleanStepText("check the `config.json` file")).toBe("Config.json file");
	});

	it("removes leading action words", () => {
		expect(cleanStepText("Create the new file")).toBe("New file");
		expect(cleanStepText("Run the tests")).toBe("Tests");
		expect(cleanStepText("Check the status")).toBe("Status");
	});

	it("capitalizes first letter", () => {
		expect(cleanStepText("update config")).toBe("Config");
	});

	it("truncates long text", () => {
		/** 超过显示上限的步骤文本。 */
		const longText = "This is a very long step description that exceeds the maximum allowed length for display";
		/** 清洗并截断后的显示文本。 */
		const result = cleanStepText(longText);
		expect(result.length).toBe(50);
		expect(result.endsWith("...")).toBe(true);
	});

	it("normalizes whitespace", () => {
		expect(cleanStepText("multiple   spaces   here")).toBe("Multiple spaces here");
	});
});

/** 覆盖从带 Plan 标题的模型消息中提取编号待办项。 */
describe("extractTodoItems", () => {
	it("extracts numbered items after Plan: header", () => {
		/** 含普通 Plan 标题和三个编号步骤的模型消息。 */
		const message = `Here's what we'll do:

Plan:
1. First step here
2. Second step here
3. Third step here`;

		/** 从计划消息提取的待办项。 */
		const items = extractTodoItems(message);
		expect(items).toHaveLength(3);
		expect(items[0].step).toBe(1);
		expect(items[0].text).toBe("First step here");
		expect(items[0].completed).toBe(false);
	});

	it("handles bold Plan header", () => {
		/** 使用 Markdown 粗体 Plan 标题的消息。 */
		const message = `**Plan:**
1. Do something`;

		/** 从粗体标题后提取的待办项。 */
		const items = extractTodoItems(message);
		expect(items).toHaveLength(1);
	});

	it("handles parenthesis-style numbering", () => {
		/** 使用右括号编号格式的计划消息。 */
		const message = `Plan:
1) First item
2) Second item`;

		/** 从右括号编号中提取的待办项。 */
		const items = extractTodoItems(message);
		expect(items).toHaveLength(2);
	});

	it("returns empty array without Plan header", () => {
		/** 有编号但没有 Plan 标题的普通消息。 */
		const message = `Here are some steps:
1. First step
2. Second step`;

		/** 无标题时应为空的提取结果。 */
		const items = extractTodoItems(message);
		expect(items).toHaveLength(0);
	});

	it("filters out short items", () => {
		/** 同时包含过短步骤和正常步骤的计划。 */
		const message = `Plan:
1. OK
2. This is a proper step`;

		/** 过滤过短项后剩余的待办。 */
		const items = extractTodoItems(message);
		expect(items).toHaveLength(1);
		expect(items[0].text).toContain("proper");
	});

	it("filters out code-like items", () => {
		/** 同时包含纯代码项和自然语言步骤的计划。 */
		const message = `Plan:
1. \`npm install\`
2. Run the build process`;

		/** 过滤代码式项后剩余的待办。 */
		const items = extractTodoItems(message);
		expect(items).toHaveLength(1);
	});
});

/** 覆盖从模型文本中提取大小写不敏感的 DONE:编号 标记。 */
describe("extractDoneSteps", () => {
	it("extracts single DONE marker", () => {
		/** 含单个完成标记的回复。 */
		const message = "I've completed the first step [DONE:1]";
		expect(extractDoneSteps(message)).toEqual([1]);
	});

	it("extracts multiple DONE markers", () => {
		/** 含三个完成标记的回复。 */
		const message = "Did steps [DONE:1] and [DONE:2] and [DONE:3]";
		expect(extractDoneSteps(message)).toEqual([1, 2, 3]);
	});

	it("handles case insensitivity", () => {
		/** 使用三种大小写形式的完成标记。 */
		const message = "[done:1] [DONE:2] [Done:3]";
		expect(extractDoneSteps(message)).toEqual([1, 2, 3]);
	});

	it("returns empty array with no markers", () => {
		/** 不含任何完成标记的普通文本。 */
		const message = "No markers here";
		expect(extractDoneSteps(message)).toEqual([]);
	});

	it("ignores malformed markers", () => {
		/** 含两个非法标记和一个合法标记的文本。 */
		const message = "[DONE:abc] [DONE:] [DONE:1]";
		expect(extractDoneSteps(message)).toEqual([1]);
	});
});

/** 覆盖 DONE 标记对现有 TodoItem 数组的原地完成状态更新。 */
describe("markCompletedSteps", () => {
	it("marks matching items as completed", () => {
		/** 三个初始都未完成的待办项。 */
		const items: TodoItem[] = [
			{ step: 1, text: "First", completed: false },
			{ step: 2, text: "Second", completed: false },
			{ step: 3, text: "Third", completed: false },
		];

		/** 输入中识别到的完成标记数量。 */
		const count = markCompletedSteps("[DONE:1] [DONE:3]", items);

		expect(count).toBe(2);
		expect(items[0].completed).toBe(true);
		expect(items[1].completed).toBe(false);
		expect(items[2].completed).toBe(true);
	});

	it("returns count of completed items", () => {
		/** 用于验证返回计数的单个待办。 */
		const items: TodoItem[] = [{ step: 1, text: "First", completed: false }];

		expect(markCompletedSteps("[DONE:1]", items)).toBe(1);
		expect(markCompletedSteps("no markers", items)).toBe(0);
	});

	it("ignores markers for non-existent steps", () => {
		/** 不存在第 99 步时仍保持原状态的待办数组。 */
		const items: TodoItem[] = [{ step: 1, text: "First", completed: false }];

		/** 找到的标记数量，即使没有对应待办也计数。 */
		const count = markCompletedSteps("[DONE:99]", items);

		expect(count).toBe(1); // Still counts the marker found
		// 即使步骤不存在，解析器仍统计找出的合法标记。
		expect(items[0].completed).toBe(false); // But doesn't mark anything
		// 不存在的步骤标记不会修改任何待办状态。
	});

	it("doesn't double-complete already completed items", () => {
		/** 初始已完成的待办，用于验证幂等更新。 */
		const items: TodoItem[] = [{ step: 1, text: "First", completed: true }];

		markCompletedSteps("[DONE:1]", items);
		expect(items[0].completed).toBe(true);
	});
});
