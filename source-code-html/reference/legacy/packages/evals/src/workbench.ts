/** Local planning/reporting entry point. Does not launch evaluations or providers. */

export type { EvalCliOptions } from "./cli-options.ts";
export { parseEvalCli } from "./cli-options.ts";
export type { DiscoveredEvalCase, DocumentationVariant, EvalTask } from "./plan.ts";
export { createTaskPlan, parseDiscoveredCases } from "./plan.ts";
export type { EvalObservation, ExpectedEvalRun } from "./report.ts";
export { formatEvalComparisonReport, readTaskObservation, summarizeEvalObservations } from "./report.ts";
