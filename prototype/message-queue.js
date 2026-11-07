/* Local demonstration only: no model request or tool process is interrupted. */
(() => {
  "use strict";
  const pending = "等待当前步骤结束后插入 · 演示";
  function enqueue(s, text) {
    if ((s.agent !== "code" && !s.reviewChat) || !["running", "finishing"].includes(s.status) || !text.trim()) return false;
    s.queue.push(text);
    return true;
  }
  function insert(s, index) {
    if ((s.agent !== "code" && !s.reviewChat) || s.status !== "running" || !Number.isInteger(index) || index < 0 || index >= s.queue.length) return false;
    const [text] = s.queue.splice(index, 1);
    s.messages.push({ role: "user", text, mode: pending });
    return true;
  }
  function edit(s, index, revision, text) {
    if (revision !== JSON.stringify(s.queue) || !Number.isInteger(index) || index < 0 || index >= s.queue.length || !text.trim()) return false;
    s.queue[index] = text.trim();
    return true;
  }
  function boundary(s) {
    if (s.status !== "running") return 0;
    let count = 0;
    for (const message of s.messages) if (message.mode === pending) {
      message.mode = "已在步骤边界插入 · 演示";
      count++;
    }
    return count;
  }
  function cancel(s) {
    for (const message of s.messages) if (message.mode === pending) message.mode = "未送达 · 已取消插入";
  }
  window.WorkbenchMessageQueue = { pending, enqueue, insert, edit, boundary, cancel };
})();
