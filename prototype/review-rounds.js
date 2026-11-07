/* Prototype-only round archives; the visible session keeps its identity. */
(() => {
  "use strict";
  const strings = "status model thinking approvalMode snapshot criteria material requirement checks args expected dependencies source outcome roundId conversationId reportId parentRoundId parentReportId sourceReportId draft".split(" ");
  const numbers = "round limit checkLimit timeLimit timeout version draftRevision".split(" ");
  function ensure(session) {
    session.version ||= 1;
    session.roundId ||= `${session.id}:round:${session.round || 0}`;
    session.conversationId ||= `${session.id}:conversation:${session.round || 0}`;
    if (session.status === "published") session.reportId ||= `${session.roundId}:report`;
  }
  function unsettled(session) {
    return ["running", "capturing", "finishing", "stopping", "unknown"].includes(session.status) || Boolean(session.queue?.length || session.settling || session.pendingApproval || session.recoveryBlocked);
  }
  function snapshot(value) {
    if (!value || !Number.isInteger(value.round) || value.round < 1) return null;
    const result = {};
    for (const key of strings) if (typeof value[key] === "string") result[key] = value[key];
    for (const key of numbers) if (Number.isFinite(value[key])) result[key] = value[key];
    result.sealed = value.sealed === true;
    result.settling = value.settling === true;
    result.pendingApproval = value.pendingApproval === true;
    result.queue = structuredClone(value.queue || []);
    result.attachments = structuredClone(value.attachments || []);
    result.messages = structuredClone(value.messages || []);
    if (value.usageSample) result.usageSample = structuredClone(value.usageSample);
    return result;
  }
  function history(value, current) {
    const seen = new Set();
    return (Array.isArray(value) ? value : []).map(snapshot).filter(item => {
      if (!item || item.round >= current || seen.has(item.round)) return false;
      seen.add(item.round);
      return true;
    }).sort((a, b) => a.round - b.round);
  }
  function next(session, limits, options = {}) {
    if (session.agent !== "review" || !["published", "stopped", "failed"].includes(session.status) || unsettled(session) || session.reviewRounds?.some(unsettled)) return false;
    if (options.expectedVersion !== undefined && options.expectedVersion !== (session.version || 1)) return false;
    ensure(session);
    if (options.sourceReportId && ![...(session.reviewRounds || []), session].some(item => item.reportId === options.sourceReportId)) return false;
    const archived = snapshot(session);
    if (!archived) return false;
    archived.sealed = true;
    session.reviewRounds = [...history(session.reviewRounds, session.round), archived];
    session.parentRoundId = session.roundId;
    session.parentReportId = session.reportId || "";
    session.sourceReportId = options.sourceReportId || "";
    session.round += 1;
    session.version += 1;
    session.roundId = `${session.id}:round:${session.round}`;
    session.conversationId = `${session.id}:conversation:${session.round}`;
    session.viewedRound = session.round;
    session.generation = (session.generation || 0) + 1;
    session.status = "idle";
    session.requirement = session.draft?.trim() || session.requirement || "复核上一轮问题及受影响项";
    session.material = [...new Set([session.material || "", ...(session.attachments || []).map(item => item.path)].filter(Boolean))].join("\n");
    session.messages = [];
    for (const key of ["snapshot", "outcome", "blocker", "blockReason", "reportId", "usageSample"]) delete session[key];
    Object.assign(session, limits);
    return true;
  }
  function displayed(session) {
    if (session.reviewChat) return session;
    const old = session.reviewRounds?.find(item => item.round === session.viewedRound);
    if (!old && (!session.viewedRound || session.viewedRound === session.round)) return session;
    const result = { ...session };
    for (const key of [...strings, ...numbers, "blocker", "blockReason", "usageSample", "messages", "attachments", "queue"]) delete result[key];
    return { ...result, ...(old || { round: session.viewedRound, missing: true, status: "unknown", messages: [] }), archived: true };
  }
  window.WorkbenchReviewRounds = { snapshot, history, next, displayed, ensure, unsettled };
})();
