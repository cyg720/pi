import { localizedAttribute, setText } from "../i18n";
import { importDrafts } from "../services/drafts";
import { MAX_IMPORT_BYTES } from "../services/json";
import { Button } from "./Button";
import { el } from "./dom";
export function openImport(done: () => void) {
  const dialog = el("dialog", "dialog");
  const title = el("h2", "", "导入浏览器草稿");
  title.id = "import-title";
  dialog.setAttribute("aria-labelledby", title.id);
  const area = el("textarea", "json-editor");
  localizedAttribute(area, "aria-label", "粘贴草稿 JSON");
  localizedAttribute(area, "placeholder", "粘贴导出的 pi-workbench.browser-draft.json");
  const file = el("input");
  file.type = "file";
  file.accept = ".json,application/json";
  localizedAttribute(file, "aria-label", "选择草稿文件");
  const status = el("p", "error");
  status.setAttribute("role", "alert");
  file.addEventListener("change", async () => {
    const value = file.files?.[0];
    if (!value) return;
    if (value.size > MAX_IMPORT_BYTES) {
      setText(status, "文件不能超过 256 KB");
      return;
    }
    area.value = await value.text();
  });
  function close() {
    dialog.close();
    dialog.remove();
  }
  dialog.append(
    title,
    el("p", "", "导入会替换全部包的内存草稿。不要粘贴密钥、令牌或私人数据。"),
    file,
    area,
    status,
    el(
      "div",
      "toolbar",
      Button("取消", close),
      Button(
        "校验并替换",
        () => {
          try {
            importDrafts(area.value);
            close();
            done();
          } catch (e) {
            setText(status, (e as Error).message);
          }
        },
        "primary",
      ),
    ),
  );
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
