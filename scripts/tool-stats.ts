#!/usr/bin/env node

/**
 * 文件职责：扫描 Pi 会话 JSONL 文件，统计工具调用、结果体量及常见 Bash 命令，并生成可视化 HTML 报告。
 * 技术维度：使用 Node.js 文件系统 API、递归目录遍历、Map 聚合、粗略 Token 估算以及内嵌 Chart.js 页面。
 * 产品维度：帮助维护者识别高频或高输出工具，为性能优化、上下文控制和二次扩展提供数据依据。
 * 逻辑维度：先解析命令行参数并收集会话文件，再逐条关联工具调用与结果，最后汇总分桶数据并输出报告。
 * 关键边界：Token 数量按四字符一个 Token 估算；Bash 命令分类是尽力解析；输入必须是可读取的 JSONL 会话目录。
 * 新手阅读建议：先看 parseArgs、jsonlFiles 和主扫描循环，再看 commandKey、bucketCounts，最后阅读 HTML 模板。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openBrowser } from "../packages/coding-agent/src/utils/open-browser.ts";

/** 文本内容块：保存模型或工具产生的普通文本。 */
interface TextContent { type: "text"; text: string }
/** 图片内容块：保存 Base64 数据及可选媒体类型。 */
interface ImageContent { type: "image"; data: string; mimeType?: string }
/** 工具调用内容块：记录调用标识、工具名和参数。 */
interface ToolCallContent { type: "toolCall"; id: string; name: string; arguments?: Record<string, unknown> }
/** 会话内容块联合类型，未知块保留为宽泛键值对象。 */
type Content = TextContent | ImageContent | ToolCallContent | { type: string; [key: string]: unknown };
/** 会话消息的最小读取结构，只声明统计过程关心的字段。 */
interface Message { role?: string; content?: string | Content[]; toolCallId?: string; toolName?: string; details?: unknown }
/** JSONL 记录的最小结构。 */
interface Entry { type?: string; message?: Message }
/** 单个工具的调用次数、结果次数、估算体量及错误数。 */
interface ToolStats { calls: number; results: number; estimatedTokens: number; samples: number[]; errors: number }
/** 单类 Bash 命令的调用次数和结果体量。 */
interface BashCommandStats { calls: number; estimatedTokens: number; samples: number[] }
/** 按调用 ID 保存的工具信息，用于把后续结果关联回调用。 */
interface ToolCallInfo { toolName: string; bashCommand?: string }

/** 结果 Token 数的直方图边界，最后一个无穷大承接所有更大样本。 */
const BUCKETS = [0, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, Number.POSITIVE_INFINITY];

/** 解析会话目录和 HTML 输出路径；无参数时使用 Pi 默认目录与临时目录。返回规范化后的路径。示例：parseArgs()。 */
function parseArgs(): { sessionsDir: string; output: string } {
	/** 待扫描的会话根目录，可由 --sessions-dir 覆盖。 */
	let sessionsDir = join(homedir(), ".pi", "agent", "sessions");
	/** 报告输出路径，可由 --output 或 -o 覆盖。 */
	let output = join(tmpdir(), "pi-tool-stats.html");
	/** 去掉 Node 与脚本路径后的用户参数。 */
	const args = process.argv.slice(2);
	for (let i = 0; i < args.length; i++) {
		/** 当前正在解释的命令行参数。 */
		const arg = args[i];
		if (arg === "--sessions-dir" && args[i + 1]) sessionsDir = resolve(args[++i]);
		else if ((arg === "--output" || arg === "-o") && args[i + 1]) output = resolve(args[++i]);
		else if (arg === "--help" || arg === "-h") {
			console.log(`Usage: scripts/tool-stats.ts [--sessions-dir <dir>] [--output <file.html>]`);
			process.exit(0);
		}
	}
	return { sessionsDir, output };
}

/** 递归收集目录中的 .jsonl 文件。参数 dir 为当前目录；返回绝对或拼接后的文件路径列表。示例：jsonlFiles(sessionsDir)。 */
function jsonlFiles(dir: string): string[] {
	/** 当前目录及其子目录中发现的会话文件。 */
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		/** 当前目录项对应的完整路径。 */
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...jsonlFiles(path));
		else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(path);
	}
	return out;
}

/** 从 Map 获取统计对象，不存在时调用 create 初始化并写回。返回可直接累加的对象。示例：getStats(tools, name, createToolStats)。 */
function getStats<T>(map: Map<string, T>, key: string, create: () => T): T {
	/** 指定键现有或刚创建的统计对象。 */
	let stats = map.get(key);
	if (!stats) {
		stats = create();
		map.set(key, stats);
	}
	return stats;
}

/** 创建数值全为零的工具统计对象。返回新的可变统计容器。示例：createToolStats()。 */
function createToolStats(): ToolStats {
	return { calls: 0, results: 0, estimatedTokens: 0, samples: [], errors: 0 };
}

/** 创建空的 Bash 命令统计对象。返回新的可变统计容器。示例：createBashStats()。 */
function createBashStats(): BashCommandStats {
	return { calls: 0, estimatedTokens: 0, samples: [] };
}

/** 按平均四字符一个 Token 粗略估算文本体量。参数 text 为原始结果；返回向上取整的估算值。示例：estimateTokenCount("abcd")。 */
function estimateTokenCount(text: string): number {
	return Math.ceil(text.length / 4);
}

/** 把字符串或内容块数组转换成可统计文本。参数 content 可为空；返回拼接文本。示例：contentText(message.content)。 */
function contentText(content: Message["content"]): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((block) => {
		if (block.type === "text" && "text" in block && typeof block.text === "string") return block.text;
		if (block.type === "image" && "data" in block && typeof block.data === "string") return block.data;
		return JSON.stringify(block);
	}).join("\n");
}

/** 从工具参数中安全提取 Bash command 字段。返回字符串或 undefined。示例：getBashCommand(block.arguments)。 */
function getBashCommand(args: Record<string, unknown> | undefined): string | undefined {
	/** 候选命令值，只有字符串才可用于后续分析。 */
	const command = args?.command;
	return typeof command === "string" ? command : undefined;
}

/** 将完整 Shell 命令归类为“程序 + 可选子命令”。参数 command 为原始命令；返回统计键。示例：commandKey("git status")。 */
function commandKey(command: string): string {
	/** 只取换行、管道或连接符之前的首条命令。 */
	const first = command.split(/\n|&&|\|\||;|\|/)[0]?.trim() ?? command.trim();
	/** 从首条命令中提取可选环境赋值、sudo、程序与首个参数。 */
	const match = first.match(/^(?:\w+=\S+\s+)*(?:sudo\s+)?([^\s]+)(?:\s+([^\s]+))?/);
	if (!match) return "unknown";
	/** 命令程序名；正则意外缺失时回退为 unknown。 */
	const bin = match[1] ?? "unknown";
	/** 不以短横线开头的首个参数，通常代表子命令。 */
	const sub = match[2] && !match[2].startsWith("-") ? ` ${match[2]}` : "";
	return `${bin}${sub}`;
}

/** 把样本数值分配到 BUCKETS 定义的区间。返回与区间一一对应的计数数组。示例：bucketCounts(stats.samples)。 */
function bucketCounts(samples: number[]): number[] {
	/** 每个直方图区间的累计样本数。 */
	const counts = new Array(BUCKETS.length - 1).fill(0) as number[];
	for (const sample of samples) {
		/** 当前样本命中的区间索引。 */
		const index = BUCKETS.findIndex((max, i) => i > 0 && sample <= max) - 1;
		counts[Math.max(0, index)]++;
	}
	return counts;
}

/** 将数值分桶边界转换成页面显示标签。返回如 0-50、32000+ 的字符串数组。示例：bucketLabels()。 */
function bucketLabels(): string[] {
	return BUCKETS.slice(0, -1).map((min, i) => {
		/** 当前区间的上界。 */
		const max = BUCKETS[i + 1];
		return Number.isFinite(max) ? `${min}-${max}` : `${min}+`;
	});
}

/** 命令行解析得到的输入目录与输出文件。 */
const { sessionsDir, output } = parseArgs();
if (!existsSync(sessionsDir)) throw new Error(`Sessions directory not found: ${sessionsDir}`);

/** 按工具名聚合的统计数据。 */
const tools = new Map<string, ToolStats>();
/** 按“程序 + 子命令”聚合的 Bash 统计数据。 */
const bashCommands = new Map<string, BashCommandStats>();
/** 工具调用 ID 到调用详情的索引，用于处理异步到达的结果。 */
const callsById = new Map<string, ToolCallInfo>();
/** 无法解析的 JSONL 行数；仅记录并跳过，不中断报告生成。 */
let parseErrors = 0;
/** 递归发现的全部会话文件。 */
const files = jsonlFiles(sessionsDir);


// file 是当前待扫描的会话 JSONL 文件路径。
for (const file of files) {
	// line 是当前会话文件中待解析的一行记录。
	for (const line of readFileSync(file, "utf8").split("\n")) {
		if (!line.trim()) continue;
		/** 当前 JSONL 行解析出的记录。 */
		let entry: Entry;
		try { entry = JSON.parse(line) as Entry; } catch { parseErrors++; continue; }
		if (entry.type !== "message") continue;
		/** 记录中可选的消息主体。 */
		const message = entry.message;
		if (!message) continue;
		if (message.role === "assistant" && Array.isArray(message.content)) {
			// block 是当前助手消息中的内容块，仅工具调用会进入统计。
			for (const block of message.content) {
				if (block.type !== "toolCall" || !("name" in block) || typeof block.name !== "string") continue;
				/** 当前工具名对应的累计统计。 */
				const stats = getStats(tools, block.name, createToolStats);
				stats.calls++;
				/** Bash 工具调用中提取出的原始命令，其他工具为 undefined。 */
				const bashCommand = block.name === "bash" ? getBashCommand(block.arguments) : undefined;
				callsById.set(block.id, { toolName: block.name, bashCommand });
				if (bashCommand) getStats(bashCommands, commandKey(bashCommand), createBashStats).calls++;
			}
		} else if (message.role === "toolResult" && message.toolName) {
			/** 当前工具结果转换后的文本。 */
			const text = contentText(message.content);
			/** 当前结果的粗略 Token 数。 */
			const tokens = estimateTokenCount(text);
			/** 当前工具名对应的累计统计。 */
			const stats = getStats(tools, message.toolName, createToolStats);
			stats.results++;
			stats.estimatedTokens += tokens;
			stats.samples.push(tokens);
			if ("isError" in message && message.isError === true) stats.errors++;
			/** 与结果 toolCallId 对应的原始调用信息。 */
			const call = message.toolCallId ? callsById.get(message.toolCallId) : undefined;
			if (call?.bashCommand) {
				/** 当前 Bash 命令类别的累计统计。 */
				const bash = getStats(bashCommands, commandKey(call.bashCommand), createBashStats);
				bash.estimatedTokens += tokens;
				bash.samples.push(tokens);
			}
		}
	}
}

/** 按结果 Token 总量降序排列的工具表格行。 */
const toolRows = [...tools.entries()].map(([name, s]) => ({ name, ...s, avg: s.results ? s.estimatedTokens / s.results : 0, histogram: bucketCounts(s.samples) })).sort((a, b) => b.estimatedTokens - a.estimatedTokens);
/** 结果 Token 总量最高的前 50 类 Bash 命令。 */
const bashRows = [...bashCommands.entries()].map(([name, s]) => ({ name, ...s, avg: s.samples.length ? s.estimatedTokens / s.samples.length : 0, histogram: bucketCounts(s.samples) })).sort((a, b) => b.estimatedTokens - a.estimatedTokens).slice(0, 50);
/** 注入报告页面的完整统计数据。 */
const data = { generatedAt: new Date().toISOString(), sessionsDir, files: files.length, parseErrors, bucketLabels: bucketLabels(), tools: toolRows, bashCommands: bashRows };

/** 完整 HTML 报告；其中脚本负责表格渲染、筛选和 Chart.js 图表。 */
const html = `<!doctype html>
<html>
<head>
	<meta charset="utf-8">
	<title>Pi Tool Stats</title>
	<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
	<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-100 p-6">
	<main class="max-w-7xl mx-auto space-y-6">
		<h1 class="text-3xl font-bold">Pi Tool Stats</h1>
		<p class="text-zinc-400">${data.files} session files from <code>${sessionsDir}</code>. Generated ${data.generatedAt}.</p>
		<section class="grid md:grid-cols-2 gap-6">
			<div class="bg-zinc-900 rounded p-4"><h2 class="font-semibold mb-3">Estimated result tokens by tool</h2><canvas id="tokens"></canvas></div>
			<div class="bg-zinc-900 rounded p-4"><h2 class="font-semibold mb-3">Tool calls</h2><canvas id="calls"></canvas></div>
		</section>
		<section class="grid md:grid-cols-2 gap-6">
			<div class="bg-zinc-900 rounded p-4">
				<div class="flex items-center justify-between gap-4 mb-3">
					<h2 class="font-semibold">Tool result token histogram</h2>
					<select id="toolSelect" class="bg-zinc-800 rounded px-2 py-1 text-sm"></select>
				</div>
				<p id="toolSummary" class="text-sm text-zinc-400 mb-3"></p>
				<canvas id="toolHistogram" height="120"></canvas>
			</div>
			<div class="bg-zinc-900 rounded p-4">
				<div class="flex items-center justify-between gap-4 mb-3">
					<h2 class="font-semibold">Bash result token histogram</h2>
					<select id="bashSelect" class="bg-zinc-800 rounded px-2 py-1 text-sm"></select>
				</div>
				<p id="bashSummary" class="text-sm text-zinc-400 mb-3"></p>
				<canvas id="bashHistogram" height="120"></canvas>
			</div>
		</section>
		<section class="bg-zinc-900 rounded p-4"><h2 class="font-semibold mb-3">Tools</h2><div id="tools"></div></section>
		<section class="bg-zinc-900 rounded p-4">
			<h2 class="font-semibold mb-3">Bash common commands (best effort)</h2>
			<div id="bash" class="mt-4"></div>
		</section>
	</main>
	<script>
		const data=${JSON.stringify(data)};
		function fmt(n){return Math.round(n).toLocaleString()}
		function esc(s){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
		function table(rows,el){
			document.getElementById(el).innerHTML='<table class="w-full text-sm"><thead class="text-zinc-400"><tr><th class="text-left p-2">Name</th><th class="text-right p-2">Calls</th><th class="text-right p-2">Results</th><th class="text-right p-2">Est. tokens</th><th class="text-right p-2">Avg/result</th><th class="text-left p-2 w-64">Histogram</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr class="border-t border-zinc-800 hover:bg-zinc-800/50 cursor-pointer" data-row="'+i+'"><td class="p-2 font-mono">'+esc(r.name)+'</td><td class="p-2 text-right">'+fmt(r.calls)+'</td><td class="p-2 text-right">'+fmt(r.results??r.samples.length)+'</td><td class="p-2 text-right">'+fmt(r.estimatedTokens)+'</td><td class="p-2 text-right">'+fmt(r.avg)+'</td><td class="p-2"><canvas id="'+el+'Hist'+i+'" height="34"></canvas></td></tr>').join('')+'</tbody></table>';
			rows.forEach((r,i)=>new Chart(document.getElementById(el+'Hist'+i),{type:'bar',data:{labels:data.bucketLabels,datasets:[{data:r.histogram,label:r.name,backgroundColor:'#60a5fa'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:(items)=>data.bucketLabels[items[0].dataIndex]+' tokens'}}},scales:{x:{display:false},y:{display:false}}}}));
			document.querySelectorAll('#'+el+' tr[data-row]').forEach(row=>row.addEventListener('click',()=>document.getElementById(el==='tools'?'toolSelect':'bashSelect').value=row.dataset.row,document.getElementById(el==='tools'?'toolSelect':'bashSelect').dispatchEvent(new Event('change'))));
		}
		function fillSelect(id,rows){document.getElementById(id).innerHTML=rows.map((r,i)=>'<option value="'+i+'">'+esc(r.name)+'</option>').join('')}
		function summary(r){return fmt(r.calls)+' calls, '+fmt(r.results??r.samples.length)+' results, '+fmt(r.estimatedTokens)+' estimated result tokens, '+fmt(r.avg)+' avg/result'}
		function singleHistogram(canvasId,summaryId,selectId,rows){
			let chart;
			function update(){
				const row=rows[Number(document.getElementById(selectId).value)]??rows[0];
				document.getElementById(summaryId).textContent=row?summary(row):'No data';
				if(chart)chart.destroy();
				chart=new Chart(document.getElementById(canvasId),{type:'bar',data:{labels:data.bucketLabels,datasets:[{label:row?.name??'',data:row?.histogram??[],backgroundColor:'#60a5fa'}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{title:(items)=>data.bucketLabels[items[0].dataIndex]+' tokens',label:(item)=>fmt(item.raw)+' results'}}},scales:{y:{beginAtZero:true,title:{display:true,text:'result count'}},x:{title:{display:true,text:'estimated tokens/result'}}}}});
			}
			document.getElementById(selectId).addEventListener('change',update);
			update();
		}
		table(data.tools,'tools');
		table(data.bashCommands,'bash');
		fillSelect('toolSelect',data.tools);
		fillSelect('bashSelect',data.bashCommands);
		singleHistogram('toolHistogram','toolSummary','toolSelect',data.tools);
		singleHistogram('bashHistogram','bashSummary','bashSelect',data.bashCommands);
		new Chart(document.getElementById('tokens'),{type:'bar',data:{labels:data.tools.map(r=>r.name),datasets:[{label:'estimated tokens',data:data.tools.map(r=>r.estimatedTokens)}]},options:{plugins:{legend:{display:false}}}});
		new Chart(document.getElementById('calls'),{type:'bar',data:{labels:data.tools.map(r=>r.name),datasets:[{label:'calls',data:data.tools.map(r=>r.calls)}]},options:{plugins:{legend:{display:false}}}});
	</script>
</body>
</html>`;

mkdirSync(resolve(output, ".."), { recursive: true });
writeFileSync(output, html);
console.log(`Wrote ${output}`);
openBrowser(output);
