import type { MessageSnapshot } from "@pi-workbench/protocol";
import { AgentAvatar } from "../../components/AgentAvatar";
import { code, el } from "../../components/dom";
import type { AgentStore } from "../../state/agent";
import { toolPhaseLabels, toolRecords } from "./derived";

export function Chat(store: AgentStore) {
  const element = el("div", "agent-messages");
  element.setAttribute("role", "log");
  let session: string | null = null;
  let messages = new Map<string, { message: MessageSnapshot; element: HTMLElement }>();
  const expanded = new Set<string>();
  function remember(node: HTMLDetailsElement, key: string) {
    node.open = expanded.has(key);
    node.addEventListener("toggle", () => {
      if (node.open) expanded.add(key);
      else expanded.delete(key);
    });
    return node;
  }
  function update() {
    const state = store.state;
    if (session !== state.selectedId) {
      session = state.selectedId;
      expanded.clear();
      messages.clear();
    }
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    const nextMessages = new Map<string, { message: MessageSnapshot; element: HTMLElement }>();
    const children = (state.snapshot?.messages ?? []).map((message) => {
      // Stream reducers preserve unchanged snapshots. Keep their DOM and layout intact.
      const previous = messages.get(message.id);
      if (previous?.message === message) {
        nextMessages.set(message.id, previous);
        return previous.element;
      }
      const content = el("div", "agent-message-body");
      for (const [index, part] of message.content.entries()) {
        if (part.type === "thinking") {
          const text = el("pre");
          text.textContent = part.text;
          content.append(
            remember(
              el("details", "agent-thinking", el("summary", "", "思考过程"), text),
              `thinking:${message.id}:${index}`,
            ),
          );
        } else {
          const text = el("p", "agent-message-text");
          text.textContent = part.text;
          content.append(text);
        }
      }
      for (const image of message.imageAttachments ?? [])
        content.append(el("p", "agent-image-metadata", `图片附件 · ${image.mimeType}`));
      const article = el(
        "article",
        `agent-message ${message.role}`,
        message.role === "user" ? el("span", "agent-avatar", "我") : AgentAvatar("agent-avatar"),
        el(
          "div",
          "",
          el(
            "strong",
            "",
            message.role === "user" ? "你" : message.role === "tool" ? "工具结果" : "coding-agent",
          ),
          content,
        ),
      );
      nextMessages.set(message.id, { message, element: article });
      return article;
    });
    messages = nextMessages;
    const tools = toolRecords(state.events);
    for (const tool of tools)
      children.push(
        remember(
          el(
            "details",
            "agent-tool-card",
            el(
              "summary",
              "",
              tool.name,
              el("small", "", tool.isError ? "工具错误" : toolPhaseLabels[tool.phase]),
            ),
            code(tool),
          ),
          `tool:${tool.toolCallId}`,
        ),
      );
    if (!state.snapshot?.messages.length && !tools.length)
      children.push(
        el(
          "div",
          "agent-empty",
          el("span", "agent-welcome-symbol", "⌘"),
          el(
            "p",
            "",
            state.loading
              ? "正在加载会话…"
              : state.selectedId
                ? "发送消息开始工作"
                : "选择或新建会话",
          ),
          el("small", "", "消息与工具结果由宿主服务提供"),
        ),
      );
    for (const [index, child] of children.entries())
      if (element.children[index] !== child)
        element.insertBefore(child, element.children[index] ?? null);
    while (element.children.length > children.length) element.children[children.length].remove();
    if (nearBottom) element.scrollTop = element.scrollHeight;
  }
  store.subscribe(update);
  update();
  return element;
}
