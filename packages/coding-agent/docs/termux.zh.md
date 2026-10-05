# 在Android上使用Termux运行Pi

Pi可以通过[Termux](https://termux.dev/)在Android上运行，Termux是一个终端模拟器和Linux环境。支持文本输入、文件工具和Shell命令。通过Termux:API，Pi可以利用Android剪贴板复制和粘贴文本。不支持剪贴板图片粘贴。

## 开始之前

从[GitHub或F-Droid](https://github.com/termux/termux-app#installation)安装Termux。请勿使用已弃用的Google Play版本。

[Termux:API](https://github.com/termux/termux-api#installation)是可选的。仅在需要Pi复制或粘贴Android剪贴板文本，或Shell命令需要Android设备API时才安装。

## 安装Pi

1. 更新Termux包：

   ```bash
   pkg update && pkg upgrade
   ```

2. 安装Node.js和Git：

   ```bash
   pkg install nodejs git
   ```

3. 安装Pi：

   ```bash
   npm install -g --ignore-scripts @earendil-works/pi-coding-agent
   ```

4. 验证安装：

   ```bash
   pi --version
   ```

5. 打开您要工作的文件夹并启动Pi：

   ```bash
   cd /path/to/working-folder
   pi
   ```

继续执行主要的[快速入门](quickstart.md#3-choose-a-model)，连接模型并运行您的第一个任务。

## 访问Android共享存储

Termux在获得权限之前无法访问Android共享存储。运行以下命令一次即可：

```bash
termux-setup-storage
```

批准后，Android共享存储将出现在`/storage/emulated/0`，并通过Termux在`~/storage/`下创建的链接访问。

仅在Pi需要访问这些文件时才授予此权限。在Termux中运行的命令和工具将使用与Termux进程相同的存储权限。

## 使用剪贴板命令

Pi使用`termux-clipboard-set`复制文本，并使用`termux-clipboard-get`作为其剪贴板粘贴快捷键。Shell命令可以直接使用这两个命令。安装Termux:API应用及其命令行包：

```bash
pkg install termux-api
```

验证集成：

```bash
printf 'Pi clipboard test' | termux-clipboard-set
termux-clipboard-get
```

第二个命令应打印`Pi clipboard test`。

Termux剪贴板API仅支持文本。Pi的剪贴板粘贴快捷键将文本插入编辑器，但无法附加剪贴板图片。

## 添加Termux特定的指令

Pi检测到它正在Termux中运行，但无法推断您希望它如何与Android交互。仅将与您的工作相关的环境细节添加到`~/.pi/agent/AGENTS.md`：

````markdown
# Termux environment

- Pi runs in Termux on Android.
- Shared Android storage is under `/storage/emulated/0`.
- Open URLs with `termux-open-url "https://example.com"`.
- Open files with `termux-open <path>`.
- Do not access shared storage unless the task requires it.
````

在活跃会话期间更改文件后，运行`/reload`。

## 故障排除

### 剪贴板集成失败

确认已安装以下组件：

1. 来自与Termux相同来源的Termux:API Android应用
2. `termux-api`命令行包

然后在Pi之外运行上述剪贴板验证命令。如果它们在那里失败，请在重试Pi的复制命令之前修复Termux:API的安装。

### 共享存储报告权限被拒绝

运行`termux-setup-storage`，批准Android权限请求，然后重试`~/storage/`或`/storage/emulated/0`下的路径。

### 安装后找不到Pi

打开新的Termux shell并运行：

```bash
npm prefix -g
command -v pi
```

确认全局npm二进制目录位于`PATH`，如果包缺失则重新安装Pi。

