/**
 * 文件职责：验证原生剪贴板模块加载器会按候选 require 根目录回退，并在全部失败时返回 null。
 * 技术维度：使用 Vitest 模拟函数、测试类型别名和内存假剪贴板实现隔离模块解析。
 * 产品维度：保证不同打包布局下仍能复制粘贴，并在原生依赖缺失时安全降级。
 * 逻辑维度：定义假模块，先测试首选失败后备用成功，再测试唯一候选失败。
 * 关键边界：不加载真实原生模块，也不访问系统剪贴板；只验证加载顺序和返回约定。
 * 新手阅读建议：先看 ClipboardRequire 和 fakeClipboard，再比较两个测试的候选数组与期望结果。
 */
import { describe, expect, test, vi } from "vitest";
import { type ClipboardModule, loadClipboardNative } from "../src/utils/clipboard-native.ts";

/** 测试用 require 函数签名；输入模块 ID，成功可返回任意模块值，失败可抛错。 */
type ClipboardRequire = (id: string) => unknown;

/** 完整实现 ClipboardModule 的内存假对象；不接触操作系统资源。 */
const fakeClipboard: ClipboardModule = {
	/** 返回固定空文本，表示剪贴板文本读取成功。 */
	getText: async () => "",
	/** 接受文本但不保存；本测试只需要满足模块接口。 */
	setText: async () => {},
	/** 固定报告存在图片，以覆盖接口完整性。 */
	hasImage: () => true,
	/** 返回三个字节的假图片数据。 */
	getImageBinary: async () => [1, 2, 3],
};

/** 原生剪贴板加载器测试组。 */
describe("loadClipboardNative", () => {
	/** 验证首个 require 抛错后继续尝试下一个根目录并返回成功模块。 */
	test("falls back to the next require root", () => {
		/** 总是抛出缺失错误的首选 require，并记录收到的模块 ID。 */
		const primary = vi.fn<ClipboardRequire>(() => {
			throw new Error("missing from bundled root");
		});
		/** 返回假剪贴板的备用 require。 */
		const fallback = vi.fn<ClipboardRequire>(() => fakeClipboard);

		expect(loadClipboardNative([primary, fallback])).toBe(fakeClipboard);
		expect(primary).toHaveBeenCalledWith("@mariozechner/clipboard");
		expect(fallback).toHaveBeenCalledWith("@mariozechner/clipboard");
	});

	/** 验证所有候选都抛错时使用 null 表示原生剪贴板不可用。 */
	test("returns null when no require root can load clipboard", () => {
		/** 总是失败的唯一 require 候选。 */
		const missing = vi.fn<ClipboardRequire>(() => {
			throw new Error("missing");
		});

		expect(loadClipboardNative([missing])).toBeNull();
	});
});
