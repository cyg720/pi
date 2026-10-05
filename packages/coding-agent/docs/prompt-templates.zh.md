# 提示模板

提示模板将Markdown文件转换为可重用的`/`命令。使用它时，您可以在不添加可执行行为或更多支持说明的情况下重复使用相同的提示。

模板可以接受参数，并且可以出现在命令补全中。Pi可以从个人配置、项目配置、显式路径或Pi包中加载模板。项目配置只有在授予项目信任后才会加载。

## 创建一个模板

创建`~/.pi/agent/prompts/review.md`：

```markdown
---
description: Review staged git changes
argument-hint: "[focus]"
---
Review the staged changes. Focus on ${1:-correctness, security, and error handling}.
```

文件名将成为命令名，因此该模板可用作`/review`。`description`将出现在命令补全中。如果省略，Pi将使用第一条非空行。

`argument-hint`是可选的。使用`<angle brackets>`表示必需参数，使用`[square brackets]`表示可选参数。

在活动会话中添加或更改模板后，运行`/reload`。

<a id="invoke-a-template"></a>

## 使用模板

在编辑器中输入模板命令：

```text
/review
/review concurrency
```

Pi在结果文本进入代理之前展开模板。除非有同名的扩展命令处理它，否则扩展会首先通过`input`事件接收原始输入。
| 语法 | 结果 |
|---|---|
| `$1`, `$2`, … | 一个位置参数 |
| `$@` 或 `$ARGUMENTS` | 所有参数用空格连接 |
| `${1:-default}` | 第一个参数，或默认值 |
| `${@:-default}` | 所有参数，或默认值 |
| `${@:N}` | 从位置 `N` 开始的参数 |
| `${@:N:L}` | `L` 个参数，从位置 `N` 开始 |

参数遵循 shell 风格的引号，因此 `/review "API compatibility"` 提供一个包含空格的参数。

<a id="choose-where-it-loads"></a>

## 添加到 Pi

将模板放入用户或项目提示目录。常规提示目录仅加载直接 `.md` 子目录。

设置和包可以选择嵌套的 Markdown 文件；包清单可以通过显式路径和通配符缩小发现范围。有关这些选项，请参见 [Settings](settings.md#resources) 和 [Pi Packages](packages.md)。

项目模板在获得信任后将成为编辑器中的命令。在信任不熟悉的项目之前，请检查其内容。有关 [Security](security.md#understand-project-trust) 信息，请参见。

