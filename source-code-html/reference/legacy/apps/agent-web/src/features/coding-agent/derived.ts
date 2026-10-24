import type { JsonValue, RunEvent, RunEventPayloads, RunStatus } from "@pi-workbench/protocol";

export const runStatusLabels: Record<RunStatus, string> = {
  idle: "空闲",
  running: "运行中",
  cancelling: "正在停止",
  completed: "已完成",
  failed: "运行失败",
  aborted: "已中止",
};

export const toolPhaseLabels: Record<RunEventPayloads["tool"]["phase"], string> = {
  start: "已开始",
  update: "执行中",
  end: "已完成",
};

export function toolRecords(events: readonly RunEvent[]): RunEventPayloads["tool"][] {
  const tools = new Map<string, RunEventPayloads["tool"]>();
  for (const event of events) {
    if (event.type !== "tool") continue;
    tools.set(event.payload.toolCallId, {
      ...tools.get(event.payload.toolCallId),
      ...event.payload,
    });
  }
  return [...tools.values()];
}

/** Only surface diff bytes actually supplied by the tool; never invent a patch from summaries. */
export function toolDiff(result: JsonValue | undefined): string | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  if (typeof result.diff === "string") return result.diff;
  const details = result.details;
  return details &&
    typeof details === "object" &&
    !Array.isArray(details) &&
    typeof details.diff === "string"
    ? details.diff
    : null;
}
