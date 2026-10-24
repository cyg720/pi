import { el } from "../../components/dom";
import { localizedAttribute } from "../../i18n";
import { Appearance } from "./entries/Appearance";
import { Diagnostics } from "./entries/Diagnostics";
import { Models } from "./entries/Models";
import { NativeSettings } from "./entries/NativeSettings";
import { ResearchCatalog } from "./entries/ResearchCatalog";
import { SessionLists } from "./entries/SessionLists";
import { Settings } from "./entries/Settings";
import { SourceCapabilities } from "./entries/SourceCapabilities";
import { RuntimePanel } from "./RuntimePanel";

export const entries = [
  ["models", "模型", "◈"],
  ["settings", "设置", "⚙"],
  ["tools", "工具", "⌘"],
  ["codemode", "代码模式", "⌥"],
  ["context", "上下文", "≡"],
  ["extensions", "扩展", "+"],
  ["appearance", "外观", "◐"],
  ["sessions", "会话", "▤"],
  ["files", "文件", "▱"],
  ["runs", "运行记录", "▷"],
  ["diagnostics", "诊断", "⌁"],
  ["integrations", "集成", "⇄"],
] as const;

export function EntryGrid(onSelect: (id: string) => void): HTMLElement {
  const grid = el("nav", "agent-entry-grid");
  localizedAttribute(grid, "aria-label", "工作台功能入口");
  for (const [id, title, symbol] of entries) {
    const icon = el("span", "agent-entry-icon", symbol);
    icon.setAttribute("aria-hidden", "true");
    const button = el("button", "agent-entry", icon, el("span", "", title));
    button.type = "button";
    button.dataset.entry = id;
    button.addEventListener("click", () => onSelect(id));
    grid.append(button);
  }
  return grid;
}

export function EntryPanel(
  id: string,
  context: { sessionId: string | null; workspaceId: string | null },
  close: () => void,
  presentation: "page" | "drawer" = "page",
): HTMLElement {
  const title = entries.find((entry) => entry[0] === id)?.[1] ?? "未知入口";
  const back = el("button", "agent-entry-back", presentation === "drawer" ? "×" : "返回工作台");
  localizedAttribute(back, "aria-label", "返回工作台");
  back.type = "button";
  back.addEventListener("click", close);
  const panel = el(
    "section",
    "agent-entry-panel",
    el("header", "agent-entry-header", el("h2", "", title), back),
  );
  panel.dataset.entryPanel = id;
  if (
    context.sessionId &&
    ["models", "tools", "extensions", "context", "sessions", "integrations"].includes(id)
  )
    panel.append(RuntimePanel(id, context.sessionId));
  if (id === "settings") panel.append(Settings(), NativeSettings(context.workspaceId));
  else if (id === "appearance") panel.append(Appearance());
  else if (id === "diagnostics") panel.append(Diagnostics());
  else if (id === "models") panel.append(Models());
  else if (["sessions", "files", "runs"].includes(id)) panel.append(SessionLists(id, context));
  else panel.append(SourceCapabilities(id, context));
  if (entries.some(([entry]) => entry === id)) panel.append(ResearchCatalog(id));
  return panel;
}
