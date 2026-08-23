/**
 * 【文件职责】扩展示例：小组件布局。
 * 【新手阅读建议】看布局 API。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function widgetPlacementExtension(pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setWidget("widget-above", ["Above editor widget"]);
		ctx.ui.setWidget("widget-below", ["Below editor widget"], { placement: "belowEditor" });
	});
}
