import { code, el } from "../../components/dom";
import type { AgentStore } from "../../state/agent";
import { toolDiff, toolRecords } from "./derived";

export function ChangesInspector(store: AgentStore) {
  const list = el("div", "agent-changes-list");
  const element = el(
    "div",
    "agent-changes-view",
    el("p", "field-help", "工具执行记录 · 非 Git 暂存或批准门禁"),
    list,
  );
  const records = new Map<string, { element: HTMLDetailsElement; signature: string }>();
  let session: string | null = null;
  function update() {
    if (session !== store.state.selectedId) {
      records.clear();
      session = store.state.selectedId;
    }
    const changes = toolRecords(store.state.events).filter(
      (tool) => tool.phase === "end" && ["edit", "write"].includes(tool.name),
    );
    const keys = new Set(changes.map((tool) => tool.toolCallId));
    for (const [key, record] of records)
      if (!keys.has(key)) {
        record.element.remove();
        records.delete(key);
      }
    for (const tool of changes) {
      const signature = JSON.stringify(tool);
      let record = records.get(tool.toolCallId);
      if (!record) {
        record = { element: el("details", "agent-change"), signature: "" };
        records.set(tool.toolCallId, record);
      }
      if (record.signature !== signature) {
        const diff = toolDiff(tool.result);
        const output = el("pre", "agent-diff");
        output.textContent = diff ?? "";
        record.element.replaceChildren(
          el("summary", "", tool.name, " · ", tool.toolCallId, tool.isError ? " · error" : ""),
          code(tool.arguments ?? null),
          diff !== null ? output : el("p", "field-help", "此工具未返回差异文本，以下为实际结果"),
          code(tool.result ?? null),
        );
        record.signature = signature;
      }
    }
    const nodes = changes
      .map((tool) => records.get(tool.toolCallId)?.element)
      .filter((node): node is HTMLDetailsElement => node !== undefined);
    // Avoid detaching unchanged nodes: streaming updates must retain focus and expansion.
    if (
      nodes.length >= list.children.length &&
      nodes.every((node, index) => index >= list.children.length || list.children[index] === node)
    ) {
      for (const node of nodes.slice(list.children.length)) list.append(node);
    } else if (
      nodes.length !== list.children.length ||
      nodes.some((node, index) => list.children[index] !== node)
    ) {
      list.replaceChildren(...nodes);
    }
    if (!changes.length && !list.children.length)
      list.append(el("p", "agent-empty", "暂无已记录文件变更"));
  }
  return { element, update };
}
