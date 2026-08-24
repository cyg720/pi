/**
 * 文件职责：提供人工运行的终端图片渲染测试，展示能力探测、图片尺寸和降级结果。
 * 技术维度：使用真实 ProcessTerminal、TUI、图片协议能力检测和 Base64 图片数据。
 * 产品维度：帮助开发者在具体终端中验证图片显示效果及不支持时的降级提示。
 * 逻辑维度：读取命令行图片，解析尺寸，搭建 TUI 内容，监听 Ctrl+C 后启动界面。
 * 关键边界：会接管当前终端并持续运行；默认路径面向 Unix，图片按 PNG MIME 解析。
 * 新手阅读建议：先传入一个 PNG 路径运行，再按“读取—解析—组件—焦点—启动”阅读。
 */
import { readFileSync } from "fs";
import { Image } from "../src/components/image.ts";
import { Spacer } from "../src/components/spacer.ts";
import { Text } from "../src/components/text.ts";
import { ProcessTerminal } from "../src/terminal.ts";
import { getCapabilities, getImageDimensions } from "../src/terminal-image.ts";
import { TUI } from "../src/tui.ts";

/** 命令行指定的图片路径；未指定时使用 /tmp/test-image.png。 */
const testImagePath = process.argv[2] || "/tmp/test-image.png";

console.log("Terminal capabilities:", getCapabilities());
console.log("Loading image from:", testImagePath);

/** 从磁盘读入的原始图片字节；读取失败时脚本会退出。 */
let imageBuffer: Buffer;
try {
	imageBuffer = readFileSync(testImagePath);
} catch (_e) {
	// _e 是文件读取异常；用户只需看到目标路径和正确用法。
	console.error(`Failed to load image: ${testImagePath}`);
	console.error("Usage: npx tsx test/image-test.ts [path-to-image.png]");
	process.exit(1);
}

/** 图片字节的 Base64 表示，供终端图片组件使用。 */
const base64Data = imageBuffer.toString("base64");
/** 从 PNG 数据解析出的尺寸；无法识别时为未定义值。 */
const dims = getImageDimensions(base64Data, "image/png");

console.log("Image dimensions:", dims);
console.log("");

/** 连接当前标准输入输出的真实进程终端。 */
const terminal = new ProcessTerminal();
/** 在真实终端上运行的 TUI。 */
const tui = new TUI(terminal);

tui.addChild(new Text("Image Rendering Test", 1, 1));
tui.addChild(new Spacer(1));

if (dims) {
	tui.addChild(
		// s 是降级占位文本，使用黄色 ANSI 前景色包裹。
		new Image(base64Data, "image/png", { fallbackColor: (s) => `\x1b[33m${s}\x1b[0m` }, { maxWidthCells: 60 }, dims),
	);
} else {
	tui.addChild(new Text("Could not parse image dimensions", 1, 0));
}

tui.addChild(new Spacer(1));
tui.addChild(new Text("Press Ctrl+C to exit", 1, 0));

/** 只处理 Ctrl+C 的最小焦点组件，用于退出人工测试。 */
const editor = {
	/** @param data 终端输入文本；首字符码为 3 时表示 Ctrl+C。 */
	handleInput(data: string) {
		if (data.charCodeAt(0) === 3) {
			tui.stop();
			process.exit(0);
		}
	},
};

tui.setFocus(editor as any);
tui.start();
