import type { TerminalColor, TerminalSnapshot } from "@pi-workbench/protocol";
import { Button } from "../../components/Button";
import { el } from "../../components/dom";
import { localizedAttribute, setText } from "../../i18n";
import type { AgentStore } from "../../state/agent";

const palette = [
  "#000000",
  "#cd3131",
  "#0dbc79",
  "#e5e510",
  "#2472c8",
  "#bc3fbc",
  "#11a8cd",
  "#e5e5e5",
  "#666666",
  "#f14c4c",
  "#23d18b",
  "#f5f543",
  "#3b8eea",
  "#d670d6",
  "#29b8db",
  "#ffffff",
];
export function terminalColor(color: TerminalColor | null): string | null {
  if (!color) return null;
  if (color.mode === "rgb")
    return `#${Math.max(0, Math.min(0xffffff, color.value)).toString(16).padStart(6, "0")}`;
  const index = color.value;
  if (index < 16) return palette[index] ?? null;
  if (index >= 232) {
    const level = Math.min(255, 8 + (index - 232) * 10);
    return `rgb(${level},${level},${level})`;
  }
  const value = index - 16,
    levels = [0, 95, 135, 175, 215, 255];
  return `rgb(${levels[Math.floor(value / 36)] ?? 0},${levels[Math.floor(value / 6) % 6] ?? 0},${levels[value % 6] ?? 0})`;
}
export function terminalKey(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey"> & { shiftKey?: boolean },
  applicationCursorKeys = false,
): string | null {
  if (
    event.metaKey ||
    (event.ctrlKey && event.key.toLowerCase() === "v") ||
    (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") ||
    (event.ctrlKey && event.key === "Tab")
  )
    return null;
  if (event.key === "Tab" && event.shiftKey) return "\x1b[Z";
  if (event.ctrlKey && /^[a-z]$/i.test(event.key))
    return String.fromCharCode(event.key.toUpperCase().charCodeAt(0) - 64);
  const prefix = applicationCursorKeys ? "\x1bO" : "\x1b[";
  const keys: Record<string, string> = {
    Enter: "\r",
    Backspace: "\x7f",
    Tab: "\t",
    Escape: "\x1b",
    ArrowUp: `${prefix}A`,
    ArrowDown: `${prefix}B`,
    ArrowRight: `${prefix}C`,
    ArrowLeft: `${prefix}D`,
    Home: `${prefix}H`,
    End: `${prefix}F`,
    Delete: "\x1b[3~",
    PageUp: "\x1b[5~",
    PageDown: "\x1b[6~",
  };
  const value = keys[event.key] ?? (event.key.length === 1 ? event.key : null);
  return value && event.altKey ? `\x1b${value}` : value;
}
export function terminalPaste(text: string, bracketed: boolean) {
  return bracketed ? `\x1b[200~${text}\x1b[201~` : text;
}

export function Terminal(store: AgentStore) {
  const status = el("p", "field-help");
  const screen = el("div", "agent-terminal-screen");
  screen.tabIndex = 0;
  screen.contentEditable = "true";
  screen.spellcheck = false;
  screen.setAttribute("role", "textbox");
  screen.setAttribute("aria-multiline", "true");
  localizedAttribute(screen, "aria-label", "交互终端屏幕");
  const cols = el("input"),
    rows = el("input");
  cols.type = rows.type = "number";
  cols.value = "80";
  rows.value = "24";
  cols.min = "20";
  cols.max = "240";
  rows.min = "4";
  rows.max = "100";
  localizedAttribute(cols, "aria-label", "终端列数");
  localizedAttribute(rows, "aria-label", "终端行数");
  let sessionId: string | null = null,
    snapshot: TerminalSnapshot | null = null,
    generation = 0,
    busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inputQueue = Promise.resolve();
  let wasAvailable = false;
  const start = Button("启动终端", () => {
    void action("POST", { cols: Number(cols.value), rows: Number(rows.value) });
  });
  const close = Button("关闭终端", () => {
    void action("DELETE");
  });
  const resize = Button("调整尺寸", () => {
    void action("POST", { cols: Number(cols.value), rows: Number(rows.value) }, "/resize");
  });
  const element = el(
    "div",
    "agent-terminal",
    el("div", "agent-terminal-toolbar", start, close, cols, rows, resize),
    status,
    screen,
  );
  const path = () => `/sessions/${encodeURIComponent(sessionId ?? "")}/terminal`;
  function controls() {
    const available = !!sessionId && !!store.state.health?.capabilities.terminal.supported;
    start.disabled = !available || store.state.loading || busy || snapshot?.status === "running";
    close.disabled = busy || !snapshot || !["starting", "running"].includes(snapshot.status);
    resize.disabled = close.disabled;
    if (!available) setText(status, "交互终端未启用；宿主须显式授权本地 Shell");
    else if (!wasAvailable && !snapshot) setText(status, "终端已就绪，点击启动终端");
    wasAvailable = available;
  }
  function paint() {
    controls();
    if (!snapshot) {
      screen.replaceChildren();
      screen.style.width = "";
      screen.style.height = "";
      return;
    }
    status.textContent = `${snapshot.status} · ${snapshot.cols}×${snapshot.rows} · ${snapshot.buffer}${snapshot.exitCode === null ? "" : ` · exit ${snapshot.exitCode}`}${snapshot.error ? ` · ${snapshot.error}` : ""}`;
    screen.style.width = `${snapshot.cols}ch`;
    screen.style.height = `${snapshot.rows * 1.4}em`;
    screen.replaceChildren(
      ...snapshot.screen.map((runs, y) => {
        const line = el("div", "agent-terminal-line");
        line.style.top = `${y * 1.4}em`;
        for (const run of runs) {
          const span = el("span");
          span.textContent = run.text;
          span.style.left = `${run.x}ch`;
          const foreground = terminalColor(run.inverse ? run.bg : run.fg),
            background = terminalColor(run.inverse ? run.fg : run.bg);
          if (foreground) span.style.color = foreground;
          if (background) span.style.backgroundColor = background;
          if (run.bold) span.style.fontWeight = "bold";
          if (run.dim) span.style.opacity = "0.5";
          if (run.italic) span.style.fontStyle = "italic";
          span.style.textDecoration = [
            run.underline ? "underline" : "",
            run.strikethrough ? "line-through" : "",
          ]
            .filter(Boolean)
            .join(" ");
          if (run.invisible) span.style.visibility = "hidden";
          line.append(span);
        }
        return line;
      }),
    );
    if (snapshot.cursor.visible) {
      const cursor = el("span", "agent-terminal-cursor");
      cursor.style.left = `${snapshot.cursor.x}ch`;
      cursor.style.top = `${snapshot.cursor.y * 1.4}em`;
      screen.append(cursor);
    }
  }
  async function poll(token = generation) {
    clearTimeout(timer);
    if (token !== generation || !sessionId || !store.state.health?.capabilities.terminal.supported)
      return;
    if (element.isConnected && !element.closest("[hidden]")) {
      try {
        const value = await store.client.json<TerminalSnapshot | null>(path());
        if (token !== generation) return;
        snapshot = value;
        paint();
      } catch (error) {
        if (token === generation)
          setText(status, error instanceof Error ? error.message : "终端连接失败");
      }
    }
    if (token === generation)
      timer = setTimeout(() => {
        void poll(token);
      }, 500);
  }
  async function action(method: string, body?: unknown, suffix = "") {
    if (busy || !sessionId) return;
    busy = true;
    controls();
    const token = generation;
    try {
      await store.client.json<unknown>(`${path()}${suffix}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (token === generation) {
        await poll(token);
        if (method === "POST" && !suffix) screen.focus();
      }
    } catch (error) {
      if (token === generation)
        setText(status, error instanceof Error ? error.message : "终端操作失败");
    } finally {
      busy = false;
      controls();
    }
  }
  function send(data: string) {
    if (!sessionId || snapshot?.status !== "running") return;
    const token = generation,
      endpoint = `${path()}/input`;
    inputQueue = inputQueue.then(async () => {
      if (token !== generation) return;
      try {
        await store.client.json<unknown>(endpoint, {
          method: "POST",
          body: JSON.stringify({ data }),
        });
      } catch (error) {
        if (token === generation)
          setText(status, error instanceof Error ? error.message : "终端输入失败");
      }
    });
  }
  screen.addEventListener("keydown", (event) => {
    if (event.isComposing || snapshot?.status !== "running") return;
    const value = terminalKey(event, snapshot.modes.applicationCursorKeys);
    if (value !== null) {
      event.preventDefault();
      send(value);
    }
  });
  screen.addEventListener("paste", (event) => {
    if (snapshot?.status !== "running") return;
    const text = event.clipboardData?.getData("text/plain");
    if (text !== undefined) {
      event.preventDefault();
      send(terminalPaste(text, snapshot.modes.bracketedPaste));
    }
  });
  screen.addEventListener("compositionend", (event) => {
    if (event.data) send(event.data);
  });
  store.subscribe(() => {
    if (sessionId !== store.state.selectedId) {
      sessionId = store.state.selectedId;
      snapshot = null;
      wasAvailable = false;
      ++generation;
      clearTimeout(timer);
      paint();
      void poll();
    }
    controls();
  });
  window.addEventListener("beforeunload", () => {
    ++generation;
    clearTimeout(timer);
  });
  controls();
  return element;
}
