/**
 * 文件职责：验证用户消息组件在插入 OSC 133 终端语义标记后仍保持稳定高度与背景重置。
 * 技术维度：使用 Vitest、ANSI/OSC 控制序列常量和真实组件渲染结果进行逐行断言。
 * 产品维度：防止终端 shell 集成标记造成消息行错位、背景色泄漏或界面跳动。
 * 逻辑维度：初始化主题，渲染固定消息，依次检查三行中的开始、结束、最终标记和背景重置位置。
 * 关键边界：断言依赖 OSC 133 协议字节和当前三行布局；组件布局协议变化时需同步评估测试。
 * 新手阅读建议：先认识四个控制序列常量，再按 lines[0]、lines[1]、lines[2] 理解渲染结构。
 */
import { describe, expect, test } from "vitest";
import { UserMessageComponent } from "../src/modes/interactive/components/user-message.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

/** OSC 133 提示符区域开始标记；属于不可见终端控制序列。 */
const OSC133_ZONE_START = "\x1b]133;A\x07";
/** OSC 133 提示符区域结束标记；应移到独立尾行开头。 */
const OSC133_ZONE_END = "\x1b]133;B\x07";
/** OSC 133 命令完成标记；紧随区域结束标记。 */
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";
/** ANSI 背景色重置序列；每个可见渲染行末必须包含，避免颜色泄漏。 */
const BG_RESET = "\x1b[49m";

/** 用户消息 OSC 标记布局测试组。 */
describe("UserMessageComponent", () => {
	/** 验证结束标记从首行移至尾行时，组件仍固定渲染为三行。 */
	test("keeps user message height stable while moving closing OSC markers off line end", () => {
		initTheme("dark");

		/** 使用固定 hello 文本创建的消息组件，避免内容换行干扰控制序列断言。 */
		const component = new UserMessageComponent("hello");
		/** 在 20 列宽度下渲染的三行终端字符串，包含不可见控制序列。 */
		const lines = component.render(20);

		expect(lines).toHaveLength(3);
		expect(lines[0]).toContain(OSC133_ZONE_START);
		expect(lines[0].endsWith(BG_RESET)).toBe(true);
		expect(lines[0]).not.toContain(OSC133_ZONE_END);
		expect(lines[1]).toContain("hello");
		expect(lines[2].startsWith(OSC133_ZONE_END + OSC133_ZONE_FINAL)).toBe(true);
		expect(lines[2].endsWith(BG_RESET)).toBe(true);
	});

	test("chains Markdown transformers with user message context", () => {
		initTheme("dark");
		const calls: string[] = [];
		const component = new UserMessageComponent("The input is $x^2$.", undefined, 1, [
			(markdown, context) => {
				calls.push("formula");
				expect(context).toEqual({ messageType: "user", isStreaming: false, availableWidth: 78 });
				return markdown.replace("$x^2$", "x²");
			},
			(markdown) => {
				calls.push("suffix");
				return `${markdown} Done.`;
			},
		]);

		expect(stripAnsi(component.render(80).join("\n"))).toContain("The input is x². Done.");
		expect(calls).toEqual(["formula", "suffix"]);
	});

	test("reapplies Markdown transformers when invalidated", () => {
		initTheme("dark");
		let suffix = "before";
		const component = new UserMessageComponent("Message", undefined, 1, [(markdown) => `${markdown} ${suffix}`]);

		expect(stripAnsi(component.render(80).join("\n"))).toContain("Message before");

		suffix = "after";
		component.invalidate();

		expect(stripAnsi(component.render(80).join("\n"))).toContain("Message after");
	});
});
