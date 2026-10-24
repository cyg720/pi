import { Button } from "../../components/Button";
import { el } from "../../components/dom";
import { localizedAttribute, localizedText } from "../../i18n";
import type { AgentStore } from "../../state/agent";

/** Directory metadata only: selecting a file never requests or previews its contents. */
export function FilesInspector(store: AgentStore) {
  const content = el("div", "agent-file-tree");
  const status = el("p", "field-help");
  status.setAttribute("role", "status");
  const search = el("input", "agent-search");
  search.type = "search";
  localizedAttribute(search, "placeholder", "搜索当前目录…");
  localizedAttribute(search, "aria-label", "搜索文件");
  let workspace = "",
    currentPath = "",
    generation = 0;
  let rows: HTMLElement[] = [];
  function filter() {
    for (const row of rows)
      row.hidden = !(row.dataset.name ?? "").includes(search.value.toLowerCase());
  }
  function setStatus(source: string, raw = false) {
    status.replaceChildren(raw ? document.createTextNode(source) : localizedText(source));
  }
  async function files(path = "") {
    const requestedWorkspace = workspace;
    const token = ++generation;
    currentPath = path;
    rows = [];
    content.replaceChildren();
    up.disabled = !workspace || !path;
    refresh.disabled = !workspace;
    if (!workspace) {
      status.textContent = "";
      content.append(el("p", "agent-empty", "暂无工作目录"));
      return;
    }
    setStatus("正在加载文件…");
    try {
      const result = await store.client.files(requestedWorkspace, path);
      if (token !== generation || requestedWorkspace !== workspace) return;
      rows = result.entries.map((item) => {
        const row = Button("", () => {
          if (item.kind === "directory") void files(item.path);
          else
            setStatus(
              `${item.path}${item.size === undefined ? "" : ` · ${item.size} bytes`}`,
              true,
            );
        });
        // File names are server data and must not pass through the UI translation dictionary.
        row.textContent = `${item.kind === "directory" ? "▸" : "·"} ${item.name}`;
        row.setAttribute("title", item.path);
        row.setAttribute("aria-label", item.path);
        row.className = "agent-file-row";
        row.dataset.name = item.name.toLowerCase();
        return row;
      });
      content.replaceChildren(...rows);
      setStatus(result.path || "/", true);
      if (result.truncated) status.append(el("small", "", "目录结果已截断"));
      if (!rows.length) content.append(el("p", "agent-empty", "目录为空"));
      filter();
    } catch (error) {
      if (token !== generation || requestedWorkspace !== workspace) return;
      setStatus(error instanceof Error ? error.message : "文件加载失败");
    }
  }
  search.addEventListener("input", filter);
  const up = Button("↑", () => {
    void files(currentPath.split("/").slice(0, -1).join("/"));
  });
  const refresh = Button("刷新", () => {
    void files(currentPath);
  });
  localizedAttribute(up, "aria-label", "上一级目录");
  localizedAttribute(up, "title", "上一级目录");
  localizedAttribute(refresh, "aria-label", "刷新");
  localizedAttribute(refresh, "title", "刷新");
  const element = el(
    "div",
    "agent-file-view",
    el("div", "agent-file-actions", search, up, refresh),
    status,
    content,
  );
  let initialized = false;
  function update() {
    // A pending session selection has no authoritative workspace yet. Do not show the first workspace.
    const next =
      store.state.snapshot?.session.workspaceId ??
      (store.state.selectedId ? "" : (store.state.workspaces[0]?.id ?? ""));
    if (!initialized || next !== workspace) {
      initialized = true;
      workspace = next;
      search.value = "";
      void files();
    }
  }
  return { element, update };
}
