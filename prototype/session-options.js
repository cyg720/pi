/* Static session branches: copy context, never inherit execution ownership. */
(() => {
  "use strict";
  function modelLock(session) {
    if (session.recoveryBlocked || session.settling || session.pendingApproval) return "尚有旧轮、后台收尾或审批待核对。";
    if (["running", "capturing", "stopping", "finishing", "unknown"].includes(session.status) || session.queue.length) return "执行、收尾、待核对状态和队列结束后才能修改模型与思考等级。";
    if (session.agent === "review" && !session.reviewChat && !["idle", "waiting"].includes(session.status)) return "历史审查配置只读。";
    return "";
  }
  function branch(source, agent, id, limits, reviewContext = "") {
    if (!["code", "review"].includes(agent)) return null;
    const seen = new Set();
    const context = [...(source.branchContext || []), ...(source.messages || []).map((message, index) => ({ ...message, agent: source.agent, origin: `${source.id}:${source.round || 0}:message:${index}` }))];
    if (reviewContext) context.push({ role: "agent", agent: source.agent, text: reviewContext, origin: `${source.id}:${source.round}:review` });
    const visible = context.filter(message => ["user", "agent"].includes(message.role) && typeof message.text === "string").map((message, index) => ({ role: message.role, agent: message.agent, text: message.text, origin: message.origin || `${source.branchFrom || source.id}:legacy:${index}` })).filter(message => {
      if (seen.has(message.origin)) return false;
      seen.add(message.origin); return true;
    });
    return {
      id, project: source.project, title: `${[...source.title].slice(0, 40).join("")} · ${agent === "code" ? "编码" : "审查"}分支`,
      agent, model: source.model, thinking: source.thinking, status: "idle", draft: source.draft || "",
      approvalMode: source.approvalMode || "auto", attachments: structuredClone(source.attachments || []),
      branchFrom: source.id, branchTitle: source.title, branchContext: visible,
      branchRound: source.round || 0, branchCutoff: `${source.id}:${source.round || 0}:${source.messages?.length || 0}`,
      draftRevision: source.draftRevision || 0,
      messages: [], queue: [], round: agent === "review" ? 1 : 0, reviewChat: agent === "review",
      requirement: agent === "review" ? source.draft || "" : "", ...limits,
    };
  }
  window.WorkbenchSessionOptions = { modelLock, branch };
})();
