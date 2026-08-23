/**
 * 【文件职责】实现 Loader 加载指示组件：以可定制的帧动画（默认旋转点阵）展示进行中状态，
 *              支持自定义动画帧/间隔、双色调配色与消息文本的动态更新。
 * 【技术维度】继承 Text 复用折行渲染；setInterval 驱动帧轮转；渲染前置空行使加载条与上方内容留出间隔。
 * 【产品维度】在模型思考、命令执行等耗时操作期间给用户明确的“正在进行”反馈，避免界面像卡死。
 * 【逻辑维度】start 更新显示并启动定时器 → 定时器按 intervalMs 推进 currentFrame 并刷新文本 →
 *              stop 清除定时器 → setIndicator 重置帧序列（单帧或空数组则不启动动画）。
 * 【关键边界】frames 为空数组时隐藏指示符；intervalMs 必须 >0 才生效；stop 后必须重新 start 才会再动；
 *              组件销毁前调用方需自行 stop 以免定时器泄漏。
 * 【新手阅读建议】先看 LoaderIndicatorOptions 与两个 DEFAULT 常量 → 再读 start/restartAnimation/
 *              updateDisplay 三步联动。
 */
import type { TUI } from "../tui.ts";
import { Text } from "./text.ts";

/** 指示符选项（中文说明）：frames 动画帧序列；intervalMs 帧间隔毫秒数。 */
export interface LoaderIndicatorOptions {
	/** Animation frames. Use an empty array to hide the indicator. */
	// 动画帧数组；传空数组表示隐藏指示符
	frames?: string[];
	/** Frame interval in milliseconds for animated indicators. */
	// 动画帧间隔（毫秒）
	intervalMs?: number;
}

// 默认旋转点阵帧序列（盲文点字符）
const DEFAULT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
// 默认帧间隔：80ms
const DEFAULT_INTERVAL_MS = 80;

/**
 * Loader component that updates with an optional spinning animation.
 */
/**
 * Loader 组件（中文说明）：在 Text 基础上叠加“指示符 + 消息”的组合显示与定时刷新。
 */
export class Loader extends Text {
	// 当前动画帧序列（可被 setIndicator 替换）
	private frames = [...DEFAULT_FRAMES];
	// 帧间隔毫秒数
	private intervalMs = DEFAULT_INTERVAL_MS;
	// 当前帧下标
	private currentFrame = 0;
	// 动画定时器 ID；null 表示未在动画中
	private intervalId: NodeJS.Timeout | null = null;
	// 关联的 TUI 实例：更新后请求重绘
	private ui: TUI | null = null;
	// 为 true 时帧字符按原样渲染（不套 spinner 配色）
	private renderIndicatorVerbatim = false;
	// 指示符着色函数
	private spinnerColorFn: (str: string) => string;
	// 消息文本着色函数
	private messageColorFn: (str: string) => string;
	// 当前显示的消息
	private message: string = "Loading...";

	// 构造函数：以 1 列水平边距、无垂直边距初始化基类，随后应用指示符配置
	constructor(
		ui: TUI,
		spinnerColorFn: (str: string) => string,
		messageColorFn: (str: string) => string,
		message: string = "Loading...",
		indicator?: LoaderIndicatorOptions,
	) {
		super("", 1, 0);
		this.ui = ui;
		this.spinnerColorFn = spinnerColorFn;
		this.messageColorFn = messageColorFn;
		this.message = message;
		this.setIndicator(indicator);
	}

	// 渲染：在最上方插入一个空行，与相邻内容保持间距
	render(width: number): string[] {
		return ["", ...super.render(width)];
	}

	// 启动：立即刷新一次显示并重启动画定时器
	start(): void {
		this.updateDisplay();
		this.restartAnimation();
	}

	// 停止：清除动画定时器
	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	// 更新消息文本并立即反映到显示
	setMessage(message: string): void {
		this.message = message;
		this.updateDisplay();
	}

	/**
	 * 替换指示符配置（中文说明）：传入 undefined 表示使用内置默认；
	 * 显式提供则进入“逐字渲染”模式（帧不再套用 spinner 配色）；配置后立即重启动画。
	 */
	setIndicator(indicator?: LoaderIndicatorOptions): void {
		this.renderIndicatorVerbatim = indicator !== undefined;
		this.frames = indicator?.frames !== undefined ? [...indicator.frames] : [...DEFAULT_FRAMES];
		this.intervalMs = indicator?.intervalMs && indicator.intervalMs > 0 ? indicator.intervalMs : DEFAULT_INTERVAL_MS;
		this.currentFrame = 0;
		this.start();
	}

	// 重启动画（私有）：多于 1 帧才需要定时器；到点推进帧下标并刷新显示
	private restartAnimation(): void {
		this.stop();
		if (this.frames.length <= 1) {
			return;
		}
		this.intervalId = setInterval(() => {
			this.currentFrame = (this.currentFrame + 1) % this.frames.length;
			this.updateDisplay();
		}, this.intervalMs);
	}

	// 组装当前显示文本（私有）：帧 + 空格 + 着色消息；随后请求 TUI 重绘
	private updateDisplay(): void {
		const frame = this.frames[this.currentFrame] ?? "";
		const renderedFrame = this.renderIndicatorVerbatim ? frame : this.spinnerColorFn(frame);
		const indicator = frame.length > 0 ? `${renderedFrame} ` : "";
		this.setText(`${indicator}${this.messageColorFn(this.message)}`);
		if (this.ui) {
			this.ui.requestRender();
		}
	}
}
