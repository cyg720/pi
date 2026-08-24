/**
 * 文件职责：验证自定义消息组件把输出左边距传给扩展渲染器，并能在运行时更新。
 * 技术维度：使用 Vitest、真实 Text 组件、自定义 MessageRenderer 和 ANSI 清理后渲染断言。
 * 产品维度：让扩展消息与主界面缩进一致，并在布局设置变化后立即正确对齐。
 * 逻辑维度：记录每次渲染选项，构造消息组件，先检查一格边距，再设为零并重新检查。
 * 关键边界：固定 40 列宽度和暗色主题；只检查前导空格，不验证完整颜色样式。
 * 新手阅读建议：先看 optionsSeen 如何记录 renderer 参数，再比较 setOutputPad 前后的两组断言。
 */
import { Text } from "@earendil-works/pi-tui";
import { describe, expect, test } from "vitest";
import type { MessageRenderer, MessageRenderOptions } from "../src/core/extensions/types.ts";
import type { CustomMessage } from "../src/core/messages.ts";
import { CustomMessageComponent } from "../src/modes/interactive/components/custom-message.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

/** 自定义消息组件测试组。 */
describe("CustomMessageComponent", () => {
	/** 验证 outputPad 初值为 1，更新为 0 后渲染器选项和文本缩进同步变化。 */
	test("provides output padding to custom renderers and updates it", () => {
		initTheme("dark");
		/** 自定义渲染器历次收到的选项快照，按调用顺序保存。 */
		const optionsSeen: MessageRenderOptions[] = [];
		/** 记录选项并返回使用 outputPad 左边距的固定文本组件。 */
		const renderer: MessageRenderer = (_message, options) => {
			optionsSeen.push(options);
			return new Text("custom", options.outputPad, 0);
		};
		/** 固定可显示的自定义消息夹具。 */
		const message: CustomMessage = {
			role: "custom",
			customType: "test",
			content: "custom",
			display: true,
			timestamp: Date.now(),
		};
		/** 初始 outputPad 为 1 的被测组件。 */
		const component = new CustomMessageComponent(message, renderer, undefined, 1);

		expect(optionsSeen).toEqual([{ expanded: false, outputPad: 1 }]);
		expect(
			component
				.render(40)
				.map(stripAnsi)
				// line 是去除 ANSI 后的一行文本；任一行以空格加 custom 开头即证明边距存在。
				.some((line) => line.startsWith(" custom")),
		).toBe(true);

		component.setOutputPad(0);

		expect(optionsSeen.at(-1)).toEqual({ expanded: false, outputPad: 0 });
		expect(
			component
				.render(40)
				.map(stripAnsi)
				// line 是更新后的纯文本行；应存在直接以 custom 开头的行。
				.some((line) => line.startsWith("custom")),
		).toBe(true);
	});
});
