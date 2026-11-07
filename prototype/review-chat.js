/* Static review chat; retain saved evidence and unresolved operations as history. */
(() => {
  "use strict";
  function result(outcome) {
    return `演示审查结论：${outcome === "pass" ? "通过" : outcome === "fail" ? "不通过" : "暂不能判定"}。\n这是手动选择的样例结果，未调用模型或执行检查，不能作为真实验收。可以继续发消息，补充要求或提供材料。`;
  }
  function migrate(session) {
    if (session.agent !== "review" || session.reviewChat) return;
    const messages = [];
    for (const record of [...(session.reviewRounds || []), session]) {
      if (record.requirement) messages.push({ role: "user", text: [record.requirement, record.criteria && `检查要求：\n${record.criteria}`, record.material && `参考材料：\n${record.material}`].filter(Boolean).join("\n\n"), mode: "历史审查记录" });
      messages.push(...structuredClone(record.messages || []));
      if (record.status === "published") messages.push({ role: "agent", text: `${result(record.outcome)}${record.snapshot ? `\n历史材料标识：${record.snapshot}；不代表当前文件。` : ""}`, mode: "历史审查记录" });
    }
    session.messages = messages;
    session.reviewChat = true;
    session.viewedRound = session.round;
    delete session.locatedMessage;
    if (session.status === "published") session.status = "done";
    if (session.status === "waiting") session.status = "idle";
  }
  window.WorkbenchReviewChat = { migrate, result };
})();
