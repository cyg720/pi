/**
 * Central timing instrumentation for startup profiling.
 * Enable with PI_TIMING=1 environment variable.
 */

const ENABLED = process.env.PI_TIMING === "1";
interface TimingNamespace {
	timings: Array<{ label: string; ms: number }>;
	lastTime: number;
}

type TimingLabel = "main" | "extensions";

const timingNamespaces = new Map<TimingLabel, TimingNamespace>();

/**
 * 【文件职责】计时统计：记录各阶段耗时并呈现。
 * 【产品维度】让用户了解请求各环节耗时。
 * 【新手阅读建议】半分钟读完即可。
 */
export function resetTimings(namespace: TimingLabel = "main"): void {
	if (!ENABLED) return;
	timingNamespaces.set(namespace, { timings: [], lastTime: Date.now() });
}

export function time(label: string, namespace: TimingLabel = "main"): void {
	if (!ENABLED) return;
	const now = Date.now();

	if (!timingNamespaces.has(namespace)) {
		resetTimings(namespace);
	}

	const timingNamespace = timingNamespaces.get(namespace)!;
	timingNamespace.timings.push({ label, ms: now - timingNamespace.lastTime });
	timingNamespace.lastTime = now;
}

function printTimingGroup(title: string, timings: TimingNamespace["timings"]): void {
	const printableTimings = timings.filter((timing) => timing.ms >= 0);
	if (printableTimings.length === 0) return;
	console.error(`\n--- ${title} ---`);
	for (const t of printableTimings) {
		console.error(`  ${t.label}: ${t.ms}ms`);
	}
	console.error(`  TOTAL: ${printableTimings.reduce((a, b) => a + b.ms, 0)}ms`);
	console.error(`${"-".repeat(title.length + 8)}\n`);
}

export function printTimings(): void {
	if (!ENABLED) return;
	for (const [namespace, timingNamespace] of timingNamespaces) {
		printTimingGroup(`Startup Timings: ${namespace}`, timingNamespace.timings);
	}
}
