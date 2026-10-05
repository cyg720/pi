# Pi 包

Pi 包用于安装和分发扩展、技能、提示模板和主题等资源。当需要通过 npm 或 git 共享定制内容，或当多个资源需要打包在一起时，可以使用 Pi 包。

Pi 包可以是普通的目录或 npm 包。它可以通过 `package.json` 中的 `pi` 键声明显式路径，也可以暴露常规资源目录，并携带其自身的运行时依赖。

## 安装和管理 Pi 包

从 npm、git 或本地路径安装：

```bash
pi install npm:@example/pi-tools@1.0.0
pi install git:github.com/example/pi-tools@v1
pi install ./local-package
```


`pi list` 显示已配置的包。使用 `pi remove <source>` 删除一个包，使用 `pi update --extensions` 同步包安装。有关每个包命令和选项，请参阅 [命令行](cli.md#package-commands)。

个人安装写入 `~/.pi/agent/settings.json`。添加 `--local` 或 `-l` 可以将包声明写入 `.pi/settings.json`。项目信任授予后，Pi 才会读取该文件中的声明。

项目包在项目信任解决后才会安装和加载。包可以执行扩展代码，并且可以包含指导模型运行程序的技能。安装第三方包前请检查来源，授予项目信任前请检查项目包声明。

使用 `--extension` 或 `-e` 可以尝试一个包，而无需将其添加到设置中：

```bash
pi -e npm:@example/pi-tools
```


## 选择来源

| 来源 | 示例 | 行为 |
|---|---|---|
| npm | `npm:@example/pi-tools@1.0.0` | 安装在 Pi npm 目录下 |
| git | `git:github.com/example/pi-tools@v1` | 克隆并同步到所选引用 |
| URL | `https://github.com/example/pi-tools` | 作为 git 来源处理 |
| 本地 | `./pi-tools` | 从解析后的路径加载，不复制 |

版本化的 npm 规范会被锁定。git 标签和提交也会被锁定；包更新会同步检出但不会移动已配置的引用。

相对本地路径从包含它们的设置文件中解析。文件路径加载单个扩展，目录则遵循常规包发现规则。

## 创建 Pi 包

最简单的包使用常规目录：

```text
my-pi-package/
├── package.json
├── extensions/
├── skills/
├── prompts/
└── themes/
```


如果没有 `pi` 制造商，Pi 会从这些目录发现 TypeScript 和 JavaScript 扩展、技能目录、Markdown 提示和 JSON 主题。

使用显式制造商时，资源可能位于其他位置或需要过滤：

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./src/extension.ts"],
    "skills": ["./resources/skills"],
    "prompts": ["./resources/prompts/*.md"],
    "themes": ["./resources/themes/*.json"]
  }
}
```


路径相对于包根目录。数组可接受 glob 模式和排除项。直接列出以点开头或符号链接的资源根目录，以避免 glob 遍历时无法发现它们。

`pi-package` 关键字使 npm 包有资格出现在 [Pi 包画廊](https://pi.dev/packages) 中。可选的 `pi.image` 和 `pi.video` 字段可添加画廊预览。

## 声明依赖

将扩展导入的运行时包放在 `dependencies` 中。Pi 安装 npm 或 git 源时会安装包依赖。

Pi 向扩展和技能提供以下包：

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-tui`
- `typebox`

在 `peerDependencies` 中用 `"*"` 范围声明上述主机提供的包，并且不打包。Pi 会抑制自动安装 npm 包和通过 npm、pnpm 或 Bun 安装的 git 包的 peer 依赖。本地包不会被安装或修改，因此其依赖树由包作者负责。

不要在 `dependencies` 中列出主机提供的包。物理副本可能绕过 Pi 的扩展模块映射，在编译后的 ESM 中创建重复的类、注册表和初始化工作。Pi 会报告扩展警告。其他作为依赖的 Pi 包必须包含在发行的 tarball 中，并通过 `node_modules` 资源路径引用。

安装的包使用独立的模块根目录。不要依赖两个包共享同一个依赖实例，或一个包解析另一个包的未声明依赖。

## 选择包资源

在设置中以对象形式指定，可以限制从包加载的资源：

```json
{
  "packages": [
    {
      "source": "npm:@example/pi-tools",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"]
    }
  ]
}
```


对于每种资源类型：

- 省略属性表示加载该类型允许的所有资源。
- 使用 `[]` 加载该类型下的所有资源。
- 使用`!pattern`排除匹配的通配符。
- 使用`+path`包含一个确切允许的路径。
- 使用`-path`排除一个确切路径。

过滤器会缩小包清单的范围。它们不会暴露包本身未声明的资源。

运行`pi config`以启用或禁用发现的资源和pi内置的扩展。它从个人配置开始；按Tab切换作用域，或运行`pi config --local`从项目覆盖开始。

## 理解作用域和身份

同一个包可以出现在个人和项目设置中。项目条目通常会覆盖个人条目。使用`autoload: false`时，项目条目会作为过滤增量覆盖个人包。

Pi通过包名识别npm包，通过仓库URL（不含引用）识别git包，通过解析后的绝对路径识别本地包。这样可以防止通过等价声明加载同一个包两次。

使用[扩展](extensions.md)、[技能](skills.md)、[提示模板](prompt-templates.md)和[主题](themes.md)设计每个资源，然后再打包。

