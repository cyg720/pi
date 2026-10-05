# 技能

技能为 Pi 提供特定工作所需的专门指令和辅助文件。Pi 会公布每项可用技能的名称和描述，只有任务需要时才加载完整指令。

如果工作流需要比提示词模板更多的上下文，但不需要新的可执行集成入口，可以使用技能。技能可以把脚本、参考资料和资源与指令一起打包。

Pi 实现了 [Agent Skills 规范](https://agentskills.io/specification)。多数无效字段只会产生警告，不会阻止启动。

## 创建技能

技能是一个包含 `SKILL.md` 的目录：

```text
pdf-tools/
├── SKILL.md
├── scripts/
│   └── extract.sh
├── references/
│   └── formats.md
└── assets/
    └── template.json
```

在 `SKILL.md` 开头写入前置元数据，随后直接给出指令：

```markdown
---
name: pdf-tools
description: Extract text and tables from PDF files. Use when reading, converting, or inspecting PDFs.
---

# PDF tools

Read `references/formats.md` before converting a document. Run scripts relative to this skill directory.
```

描述决定模型何时考虑加载技能。请同时说明技能的用途和适用时机。避免“帮助处理 PDF”这类描述，因为它无法提供足够的选择依据。

引用附带文件时，使用相对于技能目录的路径。Pi 会告诉模型技能所在位置，以便解析这些路径。

## 理解技能如何加载

启动时，Pi 扫描配置的技能位置，将每项技能的名称、描述和路径加入系统提示词，但不加入完整指令。

任务匹配时，模型读取 `SKILL.md` 并遵循其中的指令。这让详细指导仅在需要时进入上下文。模型可能未能加载相关技能，因此需要强制加载时可使用 `/skill:name`。

`/skill:name` 后的参数会作为用户请求附加到加载的指令后：

```text
/skill:pdf-tools extract report.pdf
```

技能仅应通过显式命令调用时，在前置元数据中设置 `disable-model-invocation: true`。`enableSkillCommands` [设置](settings.md)控制技能命令是否出现在交互式命令发现中；手动输入的 `/skill:name` 命令仍然有效。

<a id="choose-where-it-loads"></a>

## 添加到 Pi

把技能放入用户级或项目级技能目录。包含 `SKILL.md` 的目录会被递归发现。

Pi 也支持 Agent Skills 的标准位置 `~/.agents/skills/` 和 `.agents/skills/`。项目的 `.agents/skills/` 目录从工作目录向祖先目录查找；存在仓库根目录时，在那里停止。

Pi 接受某些独立的 Markdown 技能，但包含 `SKILL.md` 的目录是可移植的形式，应优先采用。其他位置参见[设置](settings.md#resources)和 [Pi 包](packages.md)。

项目技能可以指示模型运行脚本或修改文件。授予项目信任之前，请审查不熟悉的技能及其辅助文件。

## 编写可移植的前置元数据

Agent Skills 规范定义以下字段：

| 字段 | 用途 |
|---|---|
| `name` | 命令名称和显示名称 |
| `description` | 向模型显示的技能选择描述 |
| `license` | 许可证名称或附带的许可证文件 |
| `compatibility` | 环境要求 |
| `metadata` | 额外的键值元数据 |
| `allowed-tools` | 实验性的预先批准工具列表 |
| `disable-model-invocation` | 不让模型自动选择该技能 |

名称使用小写字母、数字和连字符，不能以连字符开头或结尾，也不能包含连续连字符。名称最多 64 个字符，描述最多 1024 个字符。

声明的名称与父目录不同，Pi 既不强制要求一致，也不会警告。其他 Agent Skills 实现可能强制要求一致，因此名称匹配仍是可移植的选择。

格式错误的 `SKILL.md` 文件，以及声明了技能但没有描述的文件，不会被加载。发生名称冲突时，保留首次发现的技能并产生警告。

## 验证并分享技能

在可以发现技能的位置运行 Pi，然后检查启动诊断和 `/skill:name` 命令。活动会话中编辑技能后，运行 `/reload`。

通过 [Pi 包](packages.md)，使用 npm 或 git 分发一项或多项技能。将环境设置保留在技能内部，并在包中声明所需的运行时依赖。

示例参见 [Anthropic 技能集合](https://github.com/anthropics/skills)和 [Pi 技能集合](https://github.com/badlogic/pi-skills)。
