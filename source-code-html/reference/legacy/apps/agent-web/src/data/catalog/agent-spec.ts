import { type FeatureSpec, field as f } from "./types";
export const agentSpec: FeatureSpec = {
  sections: [
    {
      title: "Initial state",
      description:
        "AgentOptions.initialState · packages/agent/src/agent.ts. The host resolves a full model and supplies executable tools.",
      fields: [
        f(
          "initialState.systemPrompt",
          "System prompt",
          "textarea",
          "You are a concise research assistant.",
        ),
        f("initialState.thinkingLevel", "Thinking level", "select", "off", {
          options: ["off", "minimal", "low", "medium", "high", "xhigh", "max"],
          help: "Model-dependent; xhigh/max are not universal.",
        }),
        f(
          "initialState.messages",
          "Message history JSON",
          "textarea",
          '[{"role":"user","content":"Summarize the source files.","timestamp":0}]',
        ),
      ],
    },
    {
      title: "Scheduling & stream options",
      description: "AgentOptions · packages/agent/src/agent.ts",
      fields: [
        f("toolExecution", "Tool execution", "select", "parallel", {
          options: ["parallel", "sequential"],
        }),
        f("steeringMode", "Steering queue", "select", "one-at-a-time", {
          options: ["all", "one-at-a-time"],
        }),
        f("followUpMode", "Follow-up queue", "select", "one-at-a-time", {
          options: ["all", "one-at-a-time"],
        }),
        f("sessionId", "Provider session ID", "text", "agent-example"),
        f("transport", "Transport", "select", "auto", {
          options: ["auto", "sse", "websocket", "websocket-cached"],
        }),
        f(
          "thinkingBudgets",
          "Thinking budgets JSON",
          "textarea",
          '{"low":1024,"medium":8192,"high":16384}',
        ),
        f("maxRetryDelayMs", "Retry delay cap (ms)", "number", 60000, { min: 0 }),
      ],
    },
    {
      title: "Tool & lifecycle wiring",
      description:
        "Workbench annotations describe host code to supply. They are not AgentOptions fields.",
      fields: [
        f(
          "workbench.toolDefinition",
          "Tool declaration draft",
          "textarea",
          '{"name":"lookup","label":"Lookup","description":"Read a catalog record","parameters":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}}',
          {
            help: "For live-run, add hostTool=read/write/edit and select that tool in tools. JSON cannot supply execute callbacks.",
          },
        ),
        f(
          "workbench.hooks",
          "Planned host hooks",
          "textarea",
          '["beforeToolCall","afterToolCall","prepareRequest","finishTurn","transformContext","convertToLlm"]',
        ),
      ],
    },
  ],
  example: {
    initialState: {
      systemPrompt: "You are a concise research assistant.",
      thinkingLevel: "off",
      messages: [{ role: "user", content: "Summarize the source files.", timestamp: 0 }],
    },
    toolExecution: "parallel",
    steeringMode: "one-at-a-time",
    followUpMode: "one-at-a-time",
    sessionId: "agent-example",
    transport: "auto",
    maxRetryDelayMs: 60000,
  },
  hostRequirement:
    "This is the serializable portion of AgentOptions. Construction requires streamFn; the host resolves initialState.model and supplies tools, hooks, context conversion and any authenticated proxy. No agent loop, tools or queues are running here.",
};
