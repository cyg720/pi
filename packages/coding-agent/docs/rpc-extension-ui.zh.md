# RPC扩展UI

扩展可以通过`ctx.ui`请求用户交互。在RPC模式下，支持的调用成为请求/响应子协议，与常规[RPC命令](rpc-commands.md)和[会话事件](json.md)并存。

扩展UI方法分为两类：

- **对话方法**（`select`，`confirm`，`input`，`editor`）：在stdout输出`extension_ui_request`并阻塞，直到客户端通过stdin返回匹配的`extension_ui_response`及对应的`id`。

- **即发即忘方法**（`notify`，`setStatus`，`setWidget`，`setTitle`，`set_editor_text`）：在stdout输出`extension_ui_request`，但不期待响应。客户端可显示信息或忽略。

如果对话方法包含`timeout`字段，超时后代理端会自动以默认值解析。客户端无需跟踪超时。

## 限制

某些`ExtensionUIContext`方法在RPC模式下不支持或降级，因为它们需要直接访问终端UI：

- `custom()`返回`undefined`。
- `onTerminalInput()`返回一个无操作的取消订阅函数。
- `setWorkingMessage()`，`setWorkingVisible()`，`setWorkingIndicator()`，`setHiddenThinkingLabel()`，`setFooter()`，`setHeader()`，`addAutocompleteProvider()`，`setEditorComponent()`，`setToolsExpanded()`均为无操作。
- `getEditorText()`返回`""`，`getEditorComponent()`返回`undefined`。
- `getToolsExpanded()`返回`false`。
- `pasteToEditor()`委托给`setEditorText()`，不处理终端粘贴。
- `getAllThemes()`返回`[]`，`getTheme()`返回`undefined`。
- `setTheme()`返回`{ success: false, error: "Theme switching not supported in RPC mode" }`。

注意：`ctx.mode`在RPC模式下等同于`"rpc"`，`ctx.hasUI`等同于`true`，因为对话和即发即忘方法可通过扩展UI子协议实现。使用`ctx.mode === "tui"`保护需要真实终端的TUI特定功能，如`custom()`。

## 来自Pi的请求

所有请求均包含`type: "extension_ui_request"`、唯一`id`及`method`字段。

### select

提示用户从列表中选择。对话方法如含`timeout`字段，将包含毫秒级超时；客户端未及时响应时，代理端将以`undefined`自动解析。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-1",
  "method": "select",
  "title": "Allow dangerous command?",
  "options": ["Allow", "Block"],
  "timeout": 10000
}
```

预期响应：`extension_ui_response`携带`value`（所选选项字符串）或`cancelled: true`。

### confirm

提示用户进行是/否确认。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-2",
  "method": "confirm",
  "title": "Clear session?",
  "message": "All messages will be lost.",
  "timeout": 5000
}
```

预期响应：`extension_ui_response`携带`confirmed: true/false`或`cancelled: true`。

### input

提示用户输入自由文本。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-3",
  "method": "input",
  "title": "Enter a value",
  "placeholder": "type something..."
}
```

预期响应：`extension_ui_response`携带`value`（输入的文本）或`cancelled: true`。

### editor

打开多行文本编辑器，可选预填内容。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-4",
  "method": "editor",
  "title": "Edit some text",
  "prefill": "Line 1\nLine 2\nLine 3"
}
```

预期响应：`extension_ui_response`携带`value`（编辑后的文本）或`cancelled: true`。

### notify

显示通知。即发即忘，不期待响应。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-5",
  "method": "notify",
  "message": "Command blocked by user",
  "notifyType": "warning"
}
```

`notifyType`字段为`"info"`、`"warning"`或`"error"`。若省略，默认为`"info"`。

### setStatus

设置或清除底部/状态栏的状态条目。即发即忘。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-6",
  "method": "setStatus",
  "statusKey": "my-ext",
  "statusText": "Turn 3 running..."
}
```

发送`statusText: undefined`（或省略）以清除对应键的状态条目。

### setWidget

设置或清除显示在编辑器上方或下方的文本块（小部件）。即发即忘。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-7",
  "method": "setWidget",
  "widgetKey": "my-ext",
  "widgetLines": ["--- My Widget ---", "Line 1", "Line 2"],
  "widgetPlacement": "aboveEditor"
}
```

发送`widgetLines: undefined`（或省略）以清除小部件。`widgetPlacement`字段为`"aboveEditor"`（默认）或`"belowEditor"`。RPC模式仅支持字符串数组，组件工厂将被忽略。

### setTitle

设置终端窗口/标签页标题。即发即忘。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-8",
  "method": "setTitle",
  "title": "pi - my project"
}
```

### set_editor_text

设置输入编辑器中的文本。即发即忘。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-9",
  "method": "set_editor_text",
  "text": "prefilled text for the user"
}
```

## 来自Pi的响应

响应仅针对对话方法（`select`，`confirm`，`input`，`editor`）。`id`必须与请求匹配。

### 值响应（select，input，editor）

```json
{"type": "extension_ui_response", "id": "uuid-1", "value": "Allow"}
```

### 确认响应（确认）

```json
{"type": "extension_ui_response", "id": "uuid-2", "confirmed": true}
```

### 取消响应（任何对话框）

通过任何方式关闭对话框。扩展程序会收到`undefined`（用于选择/输入/编辑）或`false`（用于确认）。

```json
{"type": "extension_ui_response", "id": "uuid-3", "cancelled": true}
```

## 示例

请参见已勾选的[RPC扩展UI客户端](../examples/rpc-extension-ui.ts)及其[演示扩展](../examples/extensions/rpc-demo.ts)。

导出的请求和响应联合体定义在[`rpc-types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-types.ts)。有关模式无关的扩展指导，请参见[扩展](extensions.md#ui-and-modes)。

