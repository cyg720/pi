import { type PromptImage, REQUEST_LIMITS } from "@pi-workbench/protocol";
import { Button } from "../../components/Button";
import { el } from "../../components/dom";
import { localizedAttribute, setText } from "../../i18n";
import type { AgentStore } from "../../state/agent";

export async function readPromptImages(files: File[]): Promise<PromptImage[]> {
  if (files.length > REQUEST_LIMITS.imageCount) throw new Error("最多选择 8 张图片");
  let total = 0;
  const images: PromptImage[] = [];
  for (const file of files) {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type))
      throw new Error("仅支持 PNG、JPEG、WebP 或 GIF");
    const length = Math.ceil(file.size / 3) * 4;
    total += length;
    if (length > REQUEST_LIMITS.imageCharacters || total > REQUEST_LIMITS.imageTotalCharacters)
      throw new Error("图片超过宿主大小限制");
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(file);
    });
    images.push({ type: "image", mimeType: file.type as PromptImage["mimeType"], data });
  }
  return images;
}

export function Attachments(store: AgentStore) {
  const input = el("input");
  input.type = "file";
  input.multiple = true;
  input.accept = "image/png,image/jpeg,image/webp,image/gif";
  localizedAttribute(input, "aria-label", "添加图片附件");
  input.hidden = true;
  const pick = Button("", () => input.click());
  const icon = el("img");
  icon.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#dce3ee" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>')}`;
  icon.width = 18;
  icon.height = 18;
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");
  icon.draggable = false;
  pick.append(icon);
  pick.classList.add("agent-attachment-picker");
  localizedAttribute(pick, "aria-label", "添加图片附件");
  localizedAttribute(pick, "title", "添加图片附件");
  const status = el("small", "field-help", "图片能力尚未确认");
  status.setAttribute("role", "status");
  status.hidden = true;
  const clear = Button("移除附件", () => reset());
  clear.hidden = true;
  const element = el("div", "agent-attachments", input, pick, clear, status);
  let images: PromptImage[] = [],
    selected: string | null = null,
    token = 0,
    supported = false,
    reading = false;
  clear.disabled = true;
  function reset() {
    ++token;
    images = [];
    input.value = "";
    reading = false;
    clear.disabled = true;
    clear.hidden = true;
    status.hidden = true;
    setText(status, "尚未选择图片");
  }
  input.addEventListener("change", () => {
    const generation = ++token;
    reading = true;
    status.hidden = false;
    void readPromptImages(Array.from(input.files ?? []))
      .then((result) => {
        if (generation !== token) return;
        images = result;
        setText(status, `已选择 {0} 张图片`.replace("{0}", String(images.length)));
      })
      .catch((error) => {
        if (generation === token) {
          images = [];
          setText(status, error instanceof Error ? error.message : "图片读取失败");
        }
      })
      .finally(() => {
        if (generation === token) {
          reading = false;
          clear.disabled = images.length === 0;
          clear.hidden = images.length === 0;
        }
      });
  });
  async function update() {
    const id = store.state.selectedId;
    if (selected !== id) {
      selected = id;
      reset();
      supported = false;
      input.disabled = true;
      pick.disabled = true;
      setText(status, "图片能力尚未确认");
      if (id) {
        const generation = token;
        try {
          const snapshot = await store.client.json<{ model?: { input?: string[] } }>(
            `/sessions/${encodeURIComponent(id)}/runtime/snapshot`,
          );
          if (generation !== token || selected !== id) return;
          supported = snapshot.model?.input?.includes("image") === true;
          setText(status, supported ? "尚未选择图片" : "当前模型不支持图片或能力未知");
        } catch {
          /* Capability stays unavailable after an unreadable native snapshot. */
        }
      }
    }
    input.disabled =
      !supported || !!store.state.snapshot?.session.activeRunId || store.state.sending;
    pick.disabled = input.disabled;
    clear.disabled = images.length === 0 && !reading;
  }
  store.subscribe(() => {
    void update();
  });
  window.addEventListener("agent-runtime-updated", () => {
    selected = null;
    void update();
  });
  void update();
  return { element, images: () => images, ready: () => !reading, clear: reset };
}
