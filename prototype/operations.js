/* Local demo receipts, not a Durable or server API. No timers or replay on restore. */
(() => {
  "use strict";
  function reference(value) {
    if (!value || !["round", "branch"].includes(value.type) || typeof value.requestId !== "string") return null;
    return Object.fromEntries(["requestId", "type", "project", "sourceId", "targetId", "targetAgent", "expectedVersion", "sourceRound", "draftRevision", "fingerprint"].filter(key => ["string", "number"].includes(typeof value[key])).map(key => [key, value[key]]));
  }
  function prepare(type, source, config) {
    window.WorkbenchReviewRounds.ensure(source);
    const intent = { ...config, type, project: source.project, sourceId: source.id, sourceRound: source.round,
      expectedVersion: source.version, draftRevision: source.draftRevision || 0, targetAgent: config.targetAgent || source.agent };
    if (type === "branch") {
      intent.child = window.WorkbenchSessionOptions.branch(source, intent.targetAgent, config.targetId, config.limits, config.reviewContext);
      intent.child.contextDefaults = structuredClone(config.contextDefaults || {});
    }
    intent.fingerprint = JSON.stringify([type, source.id, source.round, source.version, intent.targetId, intent.targetAgent, intent.draftRevision, source.draft, config.sourceReportId || "", intent.child || null]);
    return intent;
  }
  function lookup(ref, receipts = []) {
    if (!ref) return { status: "unknown" };
    const old = receipts.find(item => item.requestId === ref.requestId);
    if (!old) return { status: "unknown" };
    if (old.fingerprint !== ref.fingerprint || old.targetAgent !== ref.targetAgent || old.project !== ref.project || old.sourceId !== ref.sourceId || old.type !== ref.type || old.targetId !== ref.targetId) return { status: "rejected" };
    return old;
  }
  function commit(intent, sessions, receipts) {
    const old = lookup(intent, receipts);
    if (old.status !== "unknown") return old;
    const source = sessions.find(item => item.id === intent.sourceId && item.project === intent.project);
    if (!source) return { status: "rejected" };
    if (intent.type === "round") {
      if (!window.WorkbenchReviewRounds.next(source, intent.limits, intent)) return { status: "rejected" };
    } else {
      if (!intent.child || sessions.some(item => item.id === intent.targetId)) return { status: "rejected" };
      sessions.push(structuredClone(intent.child));
    }
    const receipt = { ...reference(intent), status: "committed", resultRound: intent.type === "round" ? source.round : intent.child.round };
    receipts.push(receipt);
    return receipt;
  }
  function clean(receipts) {
    return (Array.isArray(receipts) ? receipts : []).filter(item => item?.status === "committed" && reference(item)).map(item => ({ ...reference(item), status: "committed", resultRound: Number.isInteger(item.resultRound) ? item.resultRound : 0 }));
  }
  window.WorkbenchOperations = { prepare, reference, lookup, commit, clean };
})();
