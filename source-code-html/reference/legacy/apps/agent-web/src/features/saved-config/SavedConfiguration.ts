import { type JsonObject, parseJsonText } from "@pi-workbench/protocol";
import { el } from "../../components/dom";
import { localizedAttribute, setText } from "../../i18n";
import { object, renderReceipt } from "./receipt";
import { type ResolvedSelection, readResolvedSelection } from "./resolution";

type Capability = { operation: string; supported: boolean; fieldKeys: string[] };
type Snapshot = {
  revision: number;
  scope: JsonObject;
  values: JsonObject;
  resolved?: ResolvedSelection;
};
export function SavedConfiguration(
  moduleId: string,
  serverId: string,
  request: (path: string, init?: RequestInit) => Promise<unknown>,
  input: HTMLTextAreaElement,
) {
  const scope = el("select", "saved-config-scope");
  for (const kind of ["global", "workspace", "session"]) {
    const option = el("option", "", kind);
    option.value = kind;
    scope.append(option);
  }
  scope.value = "global";
  localizedAttribute(scope, "aria-label", "保存配置作用域");
  const scopeId = el("input", "saved-config-scope-id");
  localizedAttribute(scopeId, "aria-label", "作用域 ID");
  const workspace = el("input", "saved-config-workspace");
  localizedAttribute(workspace, "aria-label", "执行工作区 ID（留空使用宿主默认）");
  const load = el("button", "button secondary saved-config-load", "读取已保存配置");
  const run = el("button", "button primary saved-config-run", "使用已保存配置执行");
  const save = el("button", "button secondary saved-config-save", "保存当前操作参数");
  save.type = "button";
  save.disabled = true;
  load.type = run.type = "button";
  run.disabled = true;
  const status = el(
    "p",
    "field-help saved-config-status",
    "保存不代表生效；先读取配置，再显式执行。",
  );
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const error = el("pre", "field-help saved-config-error");
  error.setAttribute("role", "alert");
  const preview = el("pre", "code saved-config-preview");
  const inherit = el("input", "saved-config-inherit");
  inherit.type = "checkbox";
  localizedAttribute(inherit, "aria-label", "使用继承合成值");
  const output = el("div", "saved-config-output");
  const root = el(
    "section",
    "saved-config-panel",
    el("h3", "", "已保存配置执行与回执"),
    el("label", "field", el("span", "", "保存配置作用域"), scope),
    el("label", "field", el("span", "", "作用域 ID"), scopeId),
    el("label", "field", el("span", "", "执行工作区 ID（留空使用宿主默认）"), workspace),
    el("label", "field", inherit, el("span", "", "使用继承合成值")),
    el(
      "p",
      "field-help",
      "默认仅使用当前作用域。启用继承后使用全局 → 工作区 → 会话合成值，并校验所有来源修订；不会保存合成值到当前作用域。",
    ),
    el(
      "p",
      "field-help",
      "执行使用下方操作 JSON 的参数；不能同时指定 fields。字段仅取所选操作支持的已保存值。",
    ),
    load,
    save,
    run,
    el(
      "p",
      "field-help",
      "先读取修订，再保存操作 JSON 中的 fields；仅合并当前操作支持的字段，不运行模型。保存后重新读取再执行。",
    ),
    status,
    error,
    preview,
    output,
  );
  let capability: Capability | undefined;
  let snapshot: Snapshot | undefined;
  let generation = 0;
  let busy = false;
  const visible = () => root.isConnected && !root.closest("[hidden]");
  function reset() {
    generation++;
    busy = false;
    snapshot = undefined;
    run.disabled = true;
    save.disabled = true;
    load.disabled = false;
    preview.textContent = "";
    error.textContent = "";
    output.replaceChildren();
    setText(status, "保存不代表生效；先读取配置，再显式执行。");
  }
  for (const control of [scope, scopeId, workspace, inherit])
    control.addEventListener("change", reset);
  load.addEventListener("click", async () => {
    if (busy || !capability?.supported) return;
    const selectedCapability = capability;
    reset();
    if (scope.value !== "global" && !scopeId.value.trim()) {
      setText(status, "请填写作用域 ID；未发送请求。");
      return;
    }
    busy = true;
    load.disabled = true;
    const token = ++generation;
    setText(status, "正在读取已保存配置…");
    try {
      const query = new URLSearchParams({ scope: scope.value, moduleId });
      if (scope.value !== "global") query.set("id", scopeId.value.trim());
      const data = object(await request(`/api/config?${query}`));
      const returnedScope = object(data.scope);
      if (
        data.moduleId !== moduleId ||
        !Number.isSafeInteger(data.revision) ||
        Number(data.revision) < 0 ||
        returnedScope.kind !== scope.value ||
        (scope.value !== "global" && returnedScope.id !== scopeId.value.trim())
      )
        throw new Error("Invalid config snapshot");
      const values = object(data.values);
      if (token !== generation || !visible()) return;
      const resolved = inherit.checked ? readResolvedSelection(data, returnedScope) : undefined;
      snapshot = { revision: Number(data.revision), scope: returnedScope, values, resolved };
      const executionValues = resolved?.values ?? values;
      const selected = Object.fromEntries(
        selectedCapability.fieldKeys
          .filter((key) => Object.hasOwn(executionValues, key))
          .map((key) => [key, executionValues[key]]),
      );
      preview.textContent = JSON.stringify(
        {
          scope: returnedScope,
          revision: snapshot.revision,
          operation: selectedCapability.operation,
          mode: resolved ? "resolved" : "scope",
          ...(resolved
            ? {
                resolvedValues: resolved.values,
                sources: resolved.sources,
                revisionVector: resolved.revisionVector,
              }
            : {}),
          selectedFields: selected,
          excludedFields: Object.keys(executionValues).filter(
            (key) => !selectedCapability.fieldKeys.includes(key),
          ),
        },
        null,
        2,
      );
      setText(status, `已读取修订 ${snapshot.revision}；尚未执行。`);
      run.disabled = false;
      save.disabled = false;
    } catch (cause) {
      if (token !== generation) return;
      setText(status, "配置读取失败；请重试。未执行任何操作。");
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (token === generation) {
        busy = false;
        load.disabled = false;
      }
    }
  });
  save.addEventListener("click", async () => {
    if (busy || !snapshot || !capability?.supported || !visible()) return;
    const inputAtSave = input.value;
    let args: JsonObject;
    let fields: JsonObject;
    try {
      args = object(parseJsonText(inputAtSave));
      fields = object(args.fields);
      if (
        !Object.keys(fields).length ||
        Object.keys(fields).some((key) => !capability?.fieldKeys.includes(key))
      )
        throw new Error("Only non-empty fields supported by this operation can be saved");
    } catch (cause) {
      setText(status, "输入无效；未发送请求。");
      error.textContent = cause instanceof Error ? cause.message : String(cause);
      return;
    }
    const selected = snapshot;
    const token = ++generation;
    busy = true;
    save.disabled = load.disabled = run.disabled = true;
    error.textContent = "";
    try {
      await request("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: selected.scope,
          moduleId,
          revision: selected.revision,
          values: { ...selected.values, ...fields },
        }),
      });
      if (token !== generation || !visible()) return;
      // Keep a user's newer input intact if they edited while the save was pending.
      if (input.value === inputAtSave) {
        delete args.fields;
        input.value = JSON.stringify(args, null, 2);
      }
      reset();
      setText(status, "参数已保存，尚未执行；请重新读取配置。");
    } catch (cause) {
      if (token !== generation) return;
      snapshot = undefined;
      setText(status, "保存失败或修订冲突；请重新读取，未执行模型。");
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (token === generation) {
        busy = false;
        load.disabled = false;
      }
    }
  });
  run.addEventListener("click", async () => {
    if (busy || !snapshot || !capability?.supported || !visible()) return;
    error.textContent = "";
    output.replaceChildren();
    let args: JsonObject;
    try {
      args = object(parseJsonText(input.value));
      if (Object.hasOwn(args, "fields"))
        throw new Error("Remove input.fields before running saved configuration");
    } catch (cause) {
      setText(status, "输入无效；未发送请求。");
      error.textContent = cause instanceof Error ? cause.message : String(cause);
      return;
    }
    busy = true;
    run.disabled = true;
    load.disabled = true;
    save.disabled = true;
    const token = ++generation;
    const saved = snapshot;
    const operation = capability.operation;
    const fieldKeys = capability.fieldKeys;
    setText(status, "请求已发送，等待宿主结果…");
    try {
      const workspaceId =
        workspace.value.trim() || (scope.value === "workspace" ? scopeId.value.trim() : undefined);
      const result = await request(`/api/modules/${serverId}/${operation}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: args,
          ...(workspaceId ? { workspaceId } : {}),
          config: {
            scope: saved.scope,
            moduleId,
            revision: saved.revision,
            ...(saved.resolved
              ? { mode: "resolved", revisionVector: saved.resolved.revisionVector }
              : {}),
          },
        }),
      });
      if (token !== generation || !visible()) return;
      output.replaceChildren(
        renderReceipt(
          result,
          saved.revision,
          operation,
          moduleId,
          saved.scope,
          fieldKeys,
          saved.resolved,
        ),
      );
      setText(status, "已收到本次操作回执；后续配置修改需要重新读取并执行。");
    } catch (cause) {
      if (token !== generation || !visible()) return;
      snapshot = undefined;
      setText(status, "执行失败或修订冲突；请重新读取配置。未确认当前配置生效。");
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (token === generation) {
        busy = false;
        load.disabled = false;
        run.disabled = true;
        if (!visible()) setText(status, "页面切换后未展示迟到结果；执行状态未确认。");
      }
    }
  });
  return {
    root,
    choose(next: Capability | undefined) {
      capability = next;
      reset();
      load.disabled = !next?.supported;
    },
  };
}
