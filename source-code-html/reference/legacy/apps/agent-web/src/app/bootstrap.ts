import { Button } from "../components/Button";
import { el, link } from "../components/dom";
import { openImport } from "../components/ImportDialog";
import { closeSelect } from "../components/Select";
import { disposeSnapshots } from "../components/Snapshot";
import { announce } from "../components/Status";
import { installSelects } from "../components/select-observer";
import { packages } from "../data/packages";
import { CodingAgentPage } from "../features/coding-agent/page";
import { initializeLanguage, setText, translate } from "../i18n";
import { Shell } from "../layout/Shell";
import { selectSidebar } from "../layout/Sidebar";
import { type TabAction, TabBar } from "../layout/TabBar";
import { exportDrafts } from "../services/drafts";
import { sourceUrl } from "../services/source";
import { resetDraft } from "../state/store";
import { closeAllTabs, closeOtherTabs, closeTab, createTabState, openTab } from "../state/tabs";
import { pages } from "./pages";
import { handleWorkspaceHash, initialWorkspaceRoute, syncWorkspaceRoute } from "./workspace-router";
export function bootstrap(root: HTMLElement) {
  initializeLanguage();
  let state = createTabState(initialWorkspaceRoute(location.hash));
  const cache = new Map<string, HTMLElement>();
  const tabs = TabBar(change);
  const outlet = Shell(root, tabs.element, (id) => change("activate", id));
  let agentPage: ReturnType<typeof CodingAgentPage> | null = null;
  function change(action: TabAction, id: string) {
    closeSelect();
    state =
      action === "activate"
        ? openTab(state, id)
        : action === "close"
          ? closeTab(state, id)
          : action === "others"
            ? closeOtherTabs(state, id)
            : closeAllTabs(state);
    render();
  }
  function page(id: string) {
    if (id === "coding-agent") {
      agentPage ??= CodingAgentPage();
      root.querySelector(".agent-inspector-host")?.replaceChildren(agentPage.inspector);
      root.querySelector(".agent-status-host")?.replaceChildren(agentPage.status);
      return agentPage.element;
    }
    const pkg = packages.find((p) => p.id === id) ?? packages[0];
    const heading = el(
      "div",
      "page-title",
      el(
        "div",
        "",
        el("span", "eyebrow", "PI CORE / WORKBENCH"),
        el("h1", "", pkg.title, el("span", "title-mark", "Ⅰ")),
        el("p", "", pkg.subtitle),
      ),
      el(
        "div",
        "page-actions",
        Button("↺ 重置本页", () => {
          if (confirm(translate(`重置「${pkg.title}」的当前内存草稿？`))) {
            const previous = cache.get(id);
            if (previous) disposeSnapshots(previous);
            resetDraft(id);
            cache.delete(id);
            render();
            announce("已重置当前包草稿");
          }
        }),
        Button("导入草稿", () =>
          openImport(() => {
            for (const section of cache.values()) disposeSnapshots(section);
            cache.clear();
            render();
            announce("已导入全部工作区草稿");
          }),
        ),
        Button(
          "↓ 导出草稿",
          () => {
            try {
              exportDrafts();
              announce("已生成浏览器草稿 JSON 文件");
            } catch (error) {
              announce((error as Error).message);
            }
          },
          "primary",
        ),
      ),
    );
    const section = el("section", "workspace-page");
    section.id = `workspace-page-${id}`;
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-labelledby", `workspace-tab-${id}`);
    section.tabIndex = 0;
    section.replaceChildren(
      heading,
      el(
        "div",
        "effect-status",
        el("strong", "", "生效范围：仅本地草稿"),
        el("span", "", "表单和 JSON 文档独立保存；导出包含两者，不会自动合并为 SDK 参数。"),
        el(
          "span",
          "",
          id === "ai" || id === "agent-core" || id === "durable" || id === "env" || id === "evals"
            ? "真实执行状态以下方宿主结果与回执为准。"
            : "导出文件：配置交接文档 · 运行时：未连接，尚未应用",
        ),
      ),
      pages[id](pkg),
      el(
        "div",
        "page-source",
        link("查看当前包源码 ↗", sourceUrl(pkg.source)),
        el(
          "small",
          "",
          id === "env"
            ? "真实环境操作需宿主授权并显式执行"
            : id === "ai" || id === "agent-core" || id === "durable" || id === "evals"
              ? "浏览器不接收密钥 · 真实生成需显式执行"
              : "无密钥 · 无远程执行 · 内存草稿",
        ),
      ),
    );
    return section;
  }
  function render() {
    const coding = state.active === "coding-agent";
    root.querySelector(".app-shell")?.classList.toggle("coding-active", coding);
    outlet.classList.toggle("coding-main", coding);
    for (const node of root.querySelectorAll<HTMLElement>(
      ".main-footer, .workspace-panel-placeholder",
    ))
      node.hidden = coding;
    for (const node of root.querySelectorAll<HTMLElement>(
      ".agent-inspector-host, .agent-status-host",
    ))
      node.hidden = !coding;
    root.querySelector(".agent-card")?.classList.toggle("active", coding);
    selectSidebar(state.active ?? "");
    tabs.render(state);
    syncWorkspaceRoute(state.active);
    const pkg = packages.find((p) => p.id === state.active);
    const title = document.querySelector("title");
    if (title) setText(title, pkg ? `${pkg.title} · Pi Workbench` : "Pi Workbench");
    if (!state.ids.length) {
      outlet.replaceChildren(
        el(
          "div",
          "workspace-empty",
          el("span", "workspace-empty-symbol", "π"),
          el("h1", "", "工作区已就绪"),
          el("p", "", "从左侧选择一个包，打开新的页签。"),
          el("small", "", "关闭页签不会删除本地草稿。刷新页面会清空草稿。"),
        ),
      );
      return;
    }
    const sections = state.ids.map((id) => {
      let section = cache.get(id);
      if (!section) {
        section = page(id);
        cache.set(id, section);
      }
      section.hidden = id !== state.active;
      return section;
    });
    outlet.replaceChildren(...sections);
  }
  window.addEventListener("hashchange", () => {
    const id = handleWorkspaceHash(location.hash, state.ids, state.active);
    if (id !== state.active && id !== null) change("activate", id);
    else syncWorkspaceRoute(state.active);
  });
  render();
  installSelects(root);
}
