/**
 * 文件职责：注册 /tui 调试命令，用于显示当前终端界面的完整重绘次数。
 * 技术维度：使用编码代理扩展 API、自定义 TUI 组件回调和 Text 占位组件读取内部统计值。
 * 产品维度：帮助开发者诊断终端界面重绘过多导致的闪烁或性能问题。
 * 逻辑维度：注册命令，确认存在 UI，打开一次自定义 UI 读取 fullRedraws，随后发送通知。
 * 关键边界：仅在交互式 UI 上下文有效；统计值是读取瞬间的快照，不会持续监控。
 * 新手阅读建议：先看 registerCommand 的命令结构，再沿 handler、ui.custom、ui.notify 理解一次调用流程。
 */
/**
 * Redraws Extension
 *
 * Exposes /tui to show TUI redraw stats.
 */
/** Redraws 扩展：公开 /tui 命令以查看 TUI 重绘统计。 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

/**
 * 注册 TUI 重绘统计命令。
 * @param pi 扩展宿主 API，用于注册命令和访问命令上下文。
 * @returns 无返回值；作用是向宿主登记 /tui。
 * @example `extension(pi)`，随后在交互界面输入 `/tui`。
 */
export default function (pi: ExtensionAPI) {
	pi.registerCommand("tui", {
		/** 命令列表中展示的简短英文说明。 */
		description: "Show TUI stats",
		/** 执行命令并展示统计；_args 当前未使用，ctx 提供 UI 能力。 */
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			/** 捕获的完整重绘次数；读取前为 0，回调执行后替换为 TUI 当前计数。 */
			let redraws = 0;
			// tui 是当前终端 UI，done 用于关闭自定义视图；其余下划线参数在此无需使用。
			await ctx.ui.custom<void>((tui, _theme, _keybindings, done) => {
				redraws = tui.fullRedraws;
				done(undefined);
				return new Text("", 0, 0);
			});
			ctx.ui.notify(`TUI full redraws: ${redraws}`, "info");
		},
	});
}
