/**
 * 文件职责：验证更新日志链接规范化到当前 GitHub 仓库及对应版本标签。
 * 技术维度：使用 Vitest、Markdown 字符串夹具和版本对象测试纯转换函数。
 * 产品维度：确保发布日志不会跳到旧仓库或错误的 main 分支内容。
 * 逻辑维度：第一例处理相对路径，第二例迁移旧仓库 URL 并保留外链与锚点。
 * 关键边界：目录使用 tree，文件使用 blob；外部域名和本地锚点不得改写。
 * 新手阅读建议：逐行对比输入与期望 URL，观察 v0.79.0 插入位置。
 */
import { describe, expect, test } from "vitest";
import { type ChangelogEntry, normalizeChangelogLinks } from "../src/utils/changelog.ts";

/** 0.79.0 版本条目夹具。 */
const entry: ChangelogEntry = {
	major: 0,
	minor: 79,
	patch: 0,
	content: "",
};

/** 更新日志链接规范化测试组。 */
describe("normalizeChangelogLinks", () => {
	/** 验证包内文件、目录和根相对路径变为版本固定链接。 */
	test("rewrites package-relative changelog links to tag-pinned GitHub source links", () => {
		/** 含四种相对链接的 Markdown。 */
		const markdown = [
			"[Project Trust](README.md#project-trust)",
			"[Extensions](docs/extensions.md#project_trust)",
			"[Examples](examples/extensions/)",
			"[Root README](../../README.md#supply-chain-hardening)",
		].join("\n");

		expect(normalizeChangelogLinks(markdown, entry)).toBe(
			[
				"[Project Trust](https://github.com/earendil-works/pi/blob/v0.79.0/packages/coding-agent/README.md#project-trust)",
				"[Extensions](https://github.com/earendil-works/pi/blob/v0.79.0/packages/coding-agent/docs/extensions.md#project_trust)",
				"[Examples](https://github.com/earendil-works/pi/tree/v0.79.0/packages/coding-agent/examples/extensions/)",
				"[Root README](https://github.com/earendil-works/pi/blob/v0.79.0/README.md#supply-chain-hardening)",
			].join("\n"),
		);
	});

	/** 验证旧仓库 URL 迁移，外链与本地锚点保持原样。 */
	test("canonicalizes old repository URLs without changing external links", () => {
		/** 含旧仓库、外部和锚点链接的 Markdown。 */
		const markdown = [
			"[#5167](https://github.com/earendil-works/pi-mono/pull/5167)",
			"[#4163](https://github.com/badlogic/pi-mono/issues/4163)",
			"[Agent README](https://github.com/badlogic/pi-mono/blob/main/packages/agent/README.md)",
			"[External](https://example.com/docs)",
			"[Local anchor](#settings)",
		].join("\n");

		expect(normalizeChangelogLinks(markdown, "0.79.0")).toBe(
			[
				"[#5167](https://github.com/earendil-works/pi/pull/5167)",
				"[#4163](https://github.com/earendil-works/pi/issues/4163)",
				"[Agent README](https://github.com/earendil-works/pi/blob/v0.79.0/packages/agent/README.md)",
				"[External](https://example.com/docs)",
				"[Local anchor](#settings)",
			].join("\n"),
		);
	});
});
