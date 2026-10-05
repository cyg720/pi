# 本地模型与llama.cpp

Pi 支持 [llama.cpp](https://github.com/ggml-org/llama.cpp) 路由器服务器。路由器会发现多个GGUF模型，并按需加载或卸载它们。

使用带有路由器支持的当前 llama.cpp 构建版本。请按照 [构建说明](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md) 操作，或为您的平台安装 [预编译版本](https://github.com/ggml-org/llama.cpp/releases)。

## 启动路由器

启动 `llama-server`，不带 `--model` 或 `-m`。传递模型参数将启动单模型模式，而非路由器模式。

```bash
llama-server \
  --models-dir ~/models \
  --no-models-autoload \
  --jinja \
  --host 127.0.0.1 \
  --port 8080 \
  -ngl 999 \
  -c 32768
```

重要选项：

- `--models-dir ~/models` 用于发现本地GGUF文件。
- `--no-models-autoload` 通过 `/llama` 显式保持加载。
- `--jinja` 启用兼容的聊天模板和工具调用。
- `-ngl 999` 尽可能将多层卸载到GPU。
- `-c 32768` 为每个加载的模型设置上下文窗口大小。省略此项将使用模型的原生上下文，这可能需要占用大量内存。

单文件模型可直接放在模型目录中。多模态或多分片模型请放入单独的子目录：

```text
~/models/
├── llama-3.2-1b-Q4_K_M.gguf
├── gemma-3-4b-it-Q4_K_M/
│   ├── gemma-3-4b-it-Q4_K_M.gguf
│   └── mmproj-F16.gguf
└── large-model-Q4_K_M/
    ├── large-model-Q4_K_M-00001-of-00003.gguf
    ├── large-model-Q4_K_M-00002-of-00003.gguf
    └── large-model-Q4_K_M-00003-of-00003.gguf
```

添加文件后请重启路由器。关于每模型的上下文大小及其他选项，请参阅 [llama.cpp 模型预设](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#model-presets)。

## 配置Pi

启动Pi并配置提供者：

```text
/login llama.cpp
```

输入路由器URL和可选API密钥。默认URL为 `http://127.0.0.1:8080`。

如果您以 `--no-models-autoload` 启动路由器，`/login llama.cpp` 仅存储连接。运行 `/llama` 加载模型，然后 `/model` 选择当前会话所用的模型。

环境变量也可配置相同值，无需 `/login`：

```bash
export LLAMA_BASE_URL=http://127.0.0.1:8080
export LLAMA_API_KEY=optional-secret
pi
```

如果服务器使用API密钥，请以 `llama-server` 启动并传入匹配的 `--api-key` 值。保留 `--host 127.0.0.1` 以实现本地访问。

## 管理模型

运行：

```text
/llama
```

- 选择未加载的模型以加载它。
- 选择已加载的模型以卸载它。
- 选择 **下载模型…**，在 Hugging Face 中搜索，然后选择一个仓库和量化配置。精确指定 `owner/repository[:quant]` 的值同样有效。
- 在加载或下载过程中按 Escape 键以确认取消。

Hugging Face 搜索会优先使用 `HF_TOKEN` 的设置，然后依次检查 `$HF_TOKEN_PATH`、`$HF_HOME/token`、`$XDG_CACHE_HOME/huggingface/token` 和 `~/.cache/huggingface/token`。搜索功能无需身份验证即可使用，但会受到较低的速率限制。Pi 会在下载受限制的仓库前发出警告，并提供访问页面链接。llama.cpp 服务器负责执行下载，因此其进程在选择需要访问权限的仓库时也必须具有 `HF_TOKEN`。

如果还有其他模型已加载，Pi 会询问是否先卸载它们还是保持加载状态。Pi 不会静默卸载模型，也不会删除模型文件。路由器可能与其他客户端共享，因此 `/llama` 会始终显示路由器的当前状态。

已加载和休眠的模型会出现在 `/model` 中。休眠的模型在被选中时会自动唤醒。如果启用了路由器的自动加载功能，未加载的预设模型也会出现，并在被选中时自动加载。通过 `--no-models-autoload` 可以在 `/llama` 中先加载模型，然后再进行选择。

如果路由器断开连接，`/llama` 会显示 **重试** 和 **关闭**。重试会重新连接并刷新模型状态，但不会重播中断的操作。

## 分类

聊天列表中的每个模型也会作为具有相同 ID 的分类器模型出现在 `llama-cpp-classify` API 中。分类器模型会回答关于 JSON 状态的 `choice`、`bool` 和 `score` 类型问题，例如 TypeSafe 的 Jev 模型。模型通过 [`codemode`](cli.md#enable-codemode) 脚本访问它们，并通过 `ctx.modelRegistry.classify()` 进行扩展；有关详细信息，请参见 [Classifier models](models.md#use-classifier-models)。
模型不生成答案。每个问题成为一个聊天提示：状态，请求中的每个问题，状态再次出现，然后是带有单标记标签的问题及其答案。标签是字母（用于选择，最多62个选项），`Yes`/`No`（用于布尔值），以及数字（用于评分，最多10个等级）。第二次读取状态时会同时看到问题，这在小模型上提高了JevBench的准确性。Pi读取标签的概率作为下一个标记，并对其进行归一化。选择返回每个选项的概率和一个置信度`(n * peak - 1) / (n - 1)`；评分返回预期等级。
- 原始标签概率通常过于自信。per-request `temperature`选项在归一化之前会将标签logits进行分割；值大于1会使分布变得柔和。它不会改变答案。
- 问题一个接一个地进行。所有问题的请求中，除了最后一个问题，前面的内容都相同，因此服务器的提示缓存只需评估一次。状态出现两次，因此其上下文大小需要是原来的两倍。
- 小型模型可能会遵循状态内部编写的指令。提示词告诉模型将状态视为数据，但这并不保证。
- 类似Qwen3.5的混合模型无法在没有上下文检查点的情况下回退部分缓存的提示词。如果每个问题都重新处理整个状态，请以`--ctx-checkpoints 32 --checkpoint-min-step 0`启动路由器。

## 排错

检查路由器是否可达：

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/models
```
- **`/llama`中没有模型：**检查`--models-dir`、目录布局，并重启路由器。
- **`/model`中缺少`--no-models-autoload`的模型：**先用`/llama`加载它。
- **加载失败或占用内存过多：**降低`-c`或卸载另一个模型。
- **服务器未处于路由器模式：**启动时不要使用`--model`、`-m`或`-hf`。

要移除`llama.cpp`提供者和`/llama`，请在`pi config`的Built-in中禁用`llama.cpp`，或在[设置](settings.md#resources)中设置`"extensions": ["-builtin:llama.cpp"]`。

