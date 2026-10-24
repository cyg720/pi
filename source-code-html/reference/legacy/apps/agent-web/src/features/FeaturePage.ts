import { Capabilities } from "../components/Capabilities";
import { el } from "../components/dom";
import { FeatureForm } from "../components/FeatureForm";
import { JsonEditor } from "../components/JsonEditor";
import { Panel } from "../components/Panel";
import { Snapshot } from "../components/Snapshot";
import { Notice } from "../components/Status";
import { Tabs } from "../components/Tabs";
import { featureSpecs } from "../data/feature-specs";
import { getDraft, setDocument } from "../state/store";
import type { PackageInfo } from "../types";
import { ModuleOperations } from "./ModuleOperations";
export function FeaturePage(pkg: PackageInfo, special?: HTMLElement) {
  const id = pkg.id;
  const config = el(
    "div",
    "feature-config",
    el("div", "split-grid", FeatureForm(id), Snapshot(id)),
    special,
    Panel(
      "结构化请求 / 示例数据",
      "EDITABLE · NOT EXECUTED",
      JsonEditor(
        getDraft(id).document,
        (value) => setDocument(id, value),
        "结构化草稿",
        `${id}:document`,
      ),
    ),
  );
  const coverage = Capabilities(pkg);
  coverage.hidden = true;
  return el(
    "div",
    "feature-page",
    Notice(
      id === "agent-core"
        ? "配置草稿不会自动执行；真实 Agent 使用宿主批准的模型和文件工具，选中的工具可修改授权工作区。"
        : id === "durable"
          ? "持久任务使用宿主批准的模型和文件工具；保留操作 ID，查看不会调用模型，恢复沿用原输入与参数。"
          : featureSpecs[id].hostRequirement,
    ),
    Tabs(
      [
        { id: "config", label: "配置工作区" },
        { id: "coverage", label: `源码能力 · ${pkg.capabilities.length}` },
      ],
      (tab) => {
        config.hidden = tab !== "config";
        coverage.hidden = tab !== "coverage";
      },
    ),
    config,
    coverage,
    ModuleOperations(id),
  );
}
