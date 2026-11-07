/* Generated offline from packages/ai; run node prototype/generate-model-catalog.mjs. */
window.WorkbenchModelCatalog = {
  "amazon-bedrock": [
    {
      "id": "amazon.nova-2-lite-v1:0",
      "name": "Nova 2 Lite",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "amazon.nova-lite-v1:0",
      "name": "Nova Lite",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "amazon.nova-micro-v1:0",
      "name": "Nova Micro",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "amazon.nova-pro-v1:0",
      "name": "Nova Pro",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "anthropic.claude-fable-5",
      "name": "Claude Fable 5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic.claude-fable-5-1",
      "name": "Claude Fable 5.1",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic.claude-haiku-4-5-20251001-v1:0",
      "name": "Claude Haiku 4.5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic.claude-haiku-5-5",
      "name": "Claude Haiku 5.5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic.claude-opus-4-1-20250805-v1:0",
      "name": "Claude Opus 4.1",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic.claude-opus-4-5-20251101-v1:0",
      "name": "Claude Opus 4.5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic.claude-opus-4-6-v1",
      "name": "Claude Opus 4.6",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "anthropic.claude-opus-4-7",
      "name": "Claude Opus 4.7",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic.claude-opus-4-8",
      "name": "Claude Opus 4.8",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic.claude-opus-5-5",
      "name": "Claude Opus 5.5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic.claude-sonnet-4-5-20250929-v1:0",
      "name": "Claude Sonnet 4.5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic.claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "anthropic.claude-sonnet-5",
      "name": "Claude Sonnet 5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic.claude-sonnet-5-5",
      "name": "Claude Sonnet 5.5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "apac.amazon.nova-lite-v1:0",
      "name": "Nova Lite (APAC)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "apac.amazon.nova-micro-v1:0",
      "name": "Nova Micro (APAC)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "apac.amazon.nova-pro-v1:0",
      "name": "Nova Pro (APAC)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "apac.anthropic.claude-sonnet-4-20250514-v1:0",
      "name": "Claude Sonnet 4 (APAC)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "au.anthropic.claude-haiku-4-5-20251001-v1:0",
      "name": "Claude Haiku 4.5 (AU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "au.anthropic.claude-haiku-5-5",
      "name": "Claude Haiku 5.5 (AU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "au.anthropic.claude-opus-4-6-v1",
      "name": "AU Anthropic Claude Opus 4.6",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "au.anthropic.claude-opus-4-7",
      "name": "Claude Opus 4.7 (AU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "au.anthropic.claude-opus-4-8",
      "name": "Claude Opus 4.8 (AU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "au.anthropic.claude-opus-5",
      "name": "Claude Opus 5 (AU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "au.anthropic.claude-opus-5-5",
      "name": "Claude Opus 5.5 (AU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "au.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "name": "Claude Sonnet 4.5 (AU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "au.anthropic.claude-sonnet-4-6",
      "name": "AU Anthropic Claude Sonnet 4.6",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "au.anthropic.claude-sonnet-5",
      "name": "Claude Sonnet 5 (AU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "ca.amazon.nova-lite-v1:0",
      "name": "Nova Lite (CA)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "deepseek.v3-v1:0",
      "name": "DeepSeek-V3.1",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 163840,
      "maxTokens": 81920,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek.v3.2",
      "name": "DeepSeek V3.2",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 163840,
      "maxTokens": 81920,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "eu.amazon.nova-2-lite-v1:0",
      "name": "Nova 2 Lite (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "eu.amazon.nova-lite-v1:0",
      "name": "Nova Lite (EU)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "eu.amazon.nova-micro-v1:0",
      "name": "Nova Micro (EU)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "eu.amazon.nova-pro-v1:0",
      "name": "Nova Pro (EU)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "eu.anthropic.claude-fable-5",
      "name": "Claude Fable 5 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
      "name": "Claude Haiku 4.5 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "eu.anthropic.claude-haiku-5-5",
      "name": "Claude Haiku 5.5 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "eu.anthropic.claude-opus-4-5-20251101-v1:0",
      "name": "Claude Opus 4.5 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "eu.anthropic.claude-opus-4-6-v1",
      "name": "Claude Opus 4.6 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "eu.anthropic.claude-opus-4-7",
      "name": "Claude Opus 4.7 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "eu.anthropic.claude-opus-4-8",
      "name": "Claude Opus 4.8 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "eu.anthropic.claude-opus-5",
      "name": "Claude Opus 5 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "eu.anthropic.claude-opus-5-5",
      "name": "Claude Opus 5.5 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "eu.anthropic.claude-sonnet-4-20250514-v1:0",
      "name": "Claude Sonnet 4 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "name": "Claude Sonnet 4.5 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "eu.anthropic.claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "eu.anthropic.claude-sonnet-5",
      "name": "Claude Sonnet 5 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "eu.anthropic.claude-sonnet-5-5",
      "name": "Claude Sonnet 5.5 (EU)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "eu.mistral.pixtral-large-2502-v1:0",
      "name": "Pixtral Large (25.02) (EU)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "global.amazon.nova-2-lite-v1:0",
      "name": "Nova 2 Lite (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "global.anthropic.claude-fable-5",
      "name": "Claude Fable 5 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "global.anthropic.claude-fable-5-1",
      "name": "Claude Fable 5.1 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
      "name": "Claude Haiku 4.5 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "global.anthropic.claude-haiku-5-5",
      "name": "Claude Haiku 5.5 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "global.anthropic.claude-opus-4-5-20251101-v1:0",
      "name": "Claude Opus 4.5 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "global.anthropic.claude-opus-4-6-v1",
      "name": "Claude Opus 4.6 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "global.anthropic.claude-opus-4-7",
      "name": "Claude Opus 4.7 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "global.anthropic.claude-opus-4-8",
      "name": "Claude Opus 4.8 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "global.anthropic.claude-opus-5",
      "name": "Claude Opus 5 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "global.anthropic.claude-opus-5-5",
      "name": "Claude Opus 5.5 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "global.anthropic.claude-sonnet-4-20250514-v1:0",
      "name": "Claude Sonnet 4 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "name": "Claude Sonnet 4.5 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "global.anthropic.claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "global.anthropic.claude-sonnet-5",
      "name": "Claude Sonnet 5 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "global.anthropic.claude-sonnet-5-5",
      "name": "Claude Sonnet 5.5 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "global.moonshotai.kimi-k3",
      "name": "Kimi K3 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "global.openai.gpt-5.6-luna",
      "name": "GPT-5.6 Luna (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "global.openai.gpt-5.6-sol",
      "name": "GPT-5.6 Sol (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "global.openai.gpt-5.6-terra",
      "name": "GPT-5.6 Terra (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "global.openai.gpt-6-astra",
      "name": "GPT-6 Astra (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "global.openai.gpt-6-luna",
      "name": "GPT-6 Luna (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "global.openai.gpt-6-sol",
      "name": "GPT-6 Sol (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "global.openai.gpt-6.1-sol",
      "name": "GPT-6.1 Sol (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "global.xai.grok-4.6",
      "name": "Grok 4.6 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "global.xai.grok-4.7",
      "name": "Grok 4.7 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "global.zai.glm-5.3",
      "name": "GLM-5.3 (Global)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google.gemma-4-26b-a4b",
      "name": "Gemma 4 26B A4B IT",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google.gemma-4-31b",
      "name": "Gemma 4 31B IT",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google.gemma-4-e2b",
      "name": "Gemma 4 E2B IT",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "in.anthropic.claude-haiku-4-5-20251001-v1:0",
      "name": "Claude Haiku 4.5 (India)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "in.anthropic.claude-opus-5",
      "name": "Claude Opus 5 (India)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "in.anthropic.claude-sonnet-5",
      "name": "Claude Sonnet 5 (India)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "in.openai.gpt-5.6-luna",
      "name": "GPT-5.6 Luna (India)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "in.openai.gpt-5.6-terra",
      "name": "GPT-5.6 Terra (India)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "jp.amazon.nova-2-lite-v1:0",
      "name": "Nova 2 Lite (JP)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "jp.anthropic.claude-haiku-4-5-20251001-v1:0",
      "name": "Claude Haiku 4.5 (JP)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "jp.anthropic.claude-haiku-5-5",
      "name": "Claude Haiku 5.5 (JP)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "jp.anthropic.claude-opus-4-7",
      "name": "Claude Opus 4.7 (JP)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "jp.anthropic.claude-opus-4-8",
      "name": "Claude Opus 4.8 (JP)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "jp.anthropic.claude-opus-5",
      "name": "Claude Opus 5 (JP)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "jp.anthropic.claude-opus-5-5",
      "name": "Claude Opus 5.5 (JP)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "jp.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "name": "Claude Sonnet 4.5 (JP)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "jp.anthropic.claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6 (JP)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "jp.anthropic.claude-sonnet-5",
      "name": "Claude Sonnet 5 (JP)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "meta.llama3-1-70b-instruct-v1:0",
      "name": "Llama 3.1 70B Instruct",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta.llama3-1-8b-instruct-v1:0",
      "name": "Llama 3.1 8B Instruct",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta.llama3-3-70b-instruct-v1:0",
      "name": "Llama 3.3 70B Instruct",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta.llama4-maverick-17b-instruct-v1:0",
      "name": "Llama 4 Maverick 17B Instruct",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta.llama4-scout-17b-instruct-v1:0",
      "name": "Llama 4 Scout 17B Instruct",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 10000000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "minimax.minimax-m2",
      "name": "MiniMax-M2",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204608,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax.minimax-m2.1",
      "name": "MiniMax-M2.1",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 196608,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax.minimax-m2.5",
      "name": "MiniMax-M2.5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 196608,
      "maxTokens": 98304,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral.devstral-2-123b",
      "name": "Devstral 2 123B",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral.magistral-small-2509",
      "name": "Magistral Small 1.2",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 40000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral.ministral-3-14b-instruct",
      "name": "Ministral 14B 3.0",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral.ministral-3-3b-instruct",
      "name": "Ministral 3 3B",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral.ministral-3-8b-instruct",
      "name": "Ministral 3 8B",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral.mistral-large-3-675b-instruct",
      "name": "Mistral Large 3",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral.pixtral-large-2502-v1:0",
      "name": "Pixtral Large (25.02)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral.voxtral-mini-3b-2507",
      "name": "Voxtral Mini 3B 2507",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral.voxtral-small-24b-2507",
      "name": "Voxtral Small 24B 2507",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "moonshot.kimi-k2-thinking",
      "name": "Kimi K2 Thinking",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai.kimi-k2.5",
      "name": "Kimi K2.5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia.nemotron-nano-12b-v2",
      "name": "NVIDIA Nemotron Nano 12B v2 VL BF16",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "nvidia.nemotron-nano-3-30b",
      "name": "NVIDIA Nemotron Nano 3 30B",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia.nemotron-nano-9b-v2",
      "name": "NVIDIA Nemotron Nano 9B v2",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "nvidia.nemotron-super-3-120b",
      "name": "NVIDIA Nemotron 3 Super 120B A12B",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai.gpt-5.4",
      "name": "GPT-5.4",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai.gpt-5.5",
      "name": "GPT-5.5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai.gpt-5.6-luna",
      "name": "GPT-5.6 Luna",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai.gpt-5.6-sol",
      "name": "GPT-5.6 Sol",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai.gpt-5.6-terra",
      "name": "GPT-5.6 Terra",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai.gpt-6-astra",
      "name": "GPT-6 Astra",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai.gpt-6-luna",
      "name": "GPT-6 Luna",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai.gpt-6-sol",
      "name": "GPT-6 Sol",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai.gpt-6.1-sol",
      "name": "GPT-6.1 Sol",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai.gpt-oss-120b",
      "name": "gpt-oss-120b",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai.gpt-oss-120b-1:0",
      "name": "gpt-oss-120b",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai.gpt-oss-20b",
      "name": "gpt-oss-20b",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai.gpt-oss-20b-1:0",
      "name": "gpt-oss-20b",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai.gpt-oss-safeguard-120b",
      "name": "GPT OSS Safeguard 120B",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai.gpt-oss-safeguard-20b",
      "name": "GPT OSS Safeguard 20B",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen.qwen3-235b-a22b-2507-v1:0",
      "name": "Qwen3 235B-A22B Instruct 2507",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen.qwen3-32b-v1:0",
      "name": "Qwen3 32B",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen.qwen3-coder-30b-a3b-v1:0",
      "name": "Qwen3-Coder 30B-A3B Instruct",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen.qwen3-coder-480b-a35b-v1:0",
      "name": "Qwen3-Coder 480B-A35B Instruct",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen.qwen3-coder-next",
      "name": "Qwen3 Coder Next",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen.qwen3-next-80b-a3b",
      "name": "Qwen3-Next 80B-A3B Instruct",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen.qwen3-vl-235b-a22b",
      "name": "Qwen3 VL 235B A22B Instruct",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us-gov.openai.gpt-oss-120b-1:0",
      "name": "gpt-oss-120b (GovCloud)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us-gov.openai.gpt-oss-20b-1:0",
      "name": "gpt-oss-20b (GovCloud)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.amazon.nova-2-lite-v1:0",
      "name": "Nova 2 Lite (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.amazon.nova-lite-v1:0",
      "name": "Nova Lite (US)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us.amazon.nova-micro-v1:0",
      "name": "Nova Micro (US)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us.amazon.nova-premier-v1:0",
      "name": "Nova Premier (US)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us.amazon.nova-pro-v1:0",
      "name": "Nova Pro (US)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 10000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us.anthropic.claude-fable-5",
      "name": "Claude Fable 5 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "us.anthropic.claude-fable-5-1",
      "name": "Claude Fable 5.1 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      "name": "Claude Haiku 4.5 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.anthropic.claude-haiku-5-5",
      "name": "Claude Haiku 5.5 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "us.anthropic.claude-opus-4-1-20250805-v1:0",
      "name": "Claude Opus 4.1 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.anthropic.claude-opus-4-5-20251101-v1:0",
      "name": "Claude Opus 4.5 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.anthropic.claude-opus-4-6-v1",
      "name": "Claude Opus 4.6 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "us.anthropic.claude-opus-4-7",
      "name": "Claude Opus 4.7 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "us.anthropic.claude-opus-4-8",
      "name": "Claude Opus 4.8 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "us.anthropic.claude-opus-5",
      "name": "Claude Opus 5 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "us.anthropic.claude-opus-5-5",
      "name": "Claude Opus 5.5 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "us.anthropic.claude-sonnet-4-20250514-v1:0",
      "name": "Claude Sonnet 4 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "name": "Claude Sonnet 4.5 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.anthropic.claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "us.anthropic.claude-sonnet-5",
      "name": "Claude Sonnet 5 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "us.anthropic.claude-sonnet-5-5",
      "name": "Claude Sonnet 5.5 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "us.meta.llama3-1-70b-instruct-v1:0",
      "name": "Llama 3.1 70B Instruct (US)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us.meta.llama3-1-8b-instruct-v1:0",
      "name": "Llama 3.1 8B Instruct (US)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us.meta.llama3-3-70b-instruct-v1:0",
      "name": "Llama 3.3 70B Instruct (US)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us.meta.llama4-maverick-17b-instruct-v1:0",
      "name": "Llama 4 Maverick 17B Instruct (US)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us.meta.llama4-scout-17b-instruct-v1:0",
      "name": "Llama 4 Scout 17B Instruct (US)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 10000000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us.mistral.pixtral-large-2502-v1:0",
      "name": "Pixtral Large (25.02) (US)",
      "reasoning": false,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "us.moonshotai.kimi-k3",
      "name": "Kimi K3 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.openai.gpt-5.6-luna",
      "name": "GPT-5.6 Luna (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "us.openai.gpt-5.6-sol",
      "name": "GPT-5.6 Sol (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "us.openai.gpt-5.6-terra",
      "name": "GPT-5.6 Terra (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "us.openai.gpt-6-astra",
      "name": "GPT-6 Astra (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "us.openai.gpt-6-luna",
      "name": "GPT-6 Luna (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "us.openai.gpt-6-sol",
      "name": "GPT-6 Sol (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "us.openai.gpt-6.1-sol",
      "name": "GPT-6.1 Sol (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "us.writer.palmyra-x4-v1:0",
      "name": "Palmyra X4 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 122880,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.writer.palmyra-x5-v1:0",
      "name": "Palmyra X5 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1040000,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.xai.grok-4.6",
      "name": "Grok 4.6 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.xai.grok-4.7",
      "name": "Grok 4.7 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "us.zai.glm-5.3",
      "name": "GLM-5.3 (US)",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "writer.palmyra-x4-v1:0",
      "name": "Palmyra X4",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 122880,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "writer.palmyra-x5-v1:0",
      "name": "Palmyra X5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1040000,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xai.grok-4.3",
      "name": "Grok 4.3",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xai.grok-4.6",
      "name": "Grok 4.6",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai.glm-4.7",
      "name": "GLM-4.7",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai.glm-4.7-flash",
      "name": "GLM-4.7-Flash",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai.glm-5",
      "name": "GLM-5",
      "reasoning": true,
      "api": "bedrock-converse-stream",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "ant-ling": [
    {
      "id": "Ling-2.6-1T",
      "name": "Ling 2.6 1T",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "Ling-2.6-flash",
      "name": "Ling 2.6 Flash",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "Ring-2.6-1T",
      "name": "Ring 2.6 1T",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    }
  ],
  "anthropic": [
    {
      "id": "claude-fable-5",
      "name": "Claude Fable 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-fable-5-1",
      "name": "Claude Fable 5.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-haiku-4-5",
      "name": "Claude Haiku 4.5 (latest)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-haiku-4-5-20251001",
      "name": "Claude Haiku 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-haiku-5-5",
      "name": "Claude Haiku 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4-5",
      "name": "Claude Opus 4.5 (latest)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-opus-4-5-20251101",
      "name": "Claude Opus 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-opus-4-6",
      "name": "Claude Opus 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4-7",
      "name": "Claude Opus 4.7",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4-8",
      "name": "Claude Opus 4.8",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-5",
      "name": "Claude Opus 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-5-5",
      "name": "Claude Opus 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-4-5",
      "name": "Claude Sonnet 4.5 (latest)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-sonnet-4-5-20250929",
      "name": "Claude Sonnet 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-5",
      "name": "Claude Sonnet 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-5-5",
      "name": "Claude Sonnet 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    }
  ],
  "azure": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 8192,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4-turbo",
      "name": "GPT-4 Turbo",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4.1",
      "name": "GPT-4.1",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4.1-mini",
      "name": "GPT-4.1 mini",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4.1-nano",
      "name": "GPT-4.1 nano",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o",
      "name": "GPT-4o",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o-2024-05-13",
      "name": "GPT-4o (2024-05-13)",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o-2024-08-06",
      "name": "GPT-4o (2024-08-06)",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o-2024-11-20",
      "name": "GPT-4o (2024-11-20)",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o-mini",
      "name": "GPT-4o mini",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-5",
      "name": "GPT-5",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5-chat-latest",
      "name": "GPT-5 Chat Latest",
      "reasoning": false,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-5-mini",
      "name": "GPT-5 Mini",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5-nano",
      "name": "GPT-5 Nano",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5-pro",
      "name": "GPT-5 Pro",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.1",
      "name": "GPT-5.1",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.2",
      "name": "GPT-5.2",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.2-pro",
      "name": "GPT-5.2 Pro",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.3-codex",
      "name": "GPT-5.3 Codex",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.3-codex-spark",
      "name": "GPT-5.3 Codex Spark",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 32000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4",
      "name": "GPT-5.4",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-mini",
      "name": "GPT-5.4 mini",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-nano",
      "name": "GPT-5.4 nano",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-pro",
      "name": "GPT-5.4 Pro",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.5",
      "name": "GPT-5.5",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.5-pro",
      "name": "GPT-5.5 Pro",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.6-luna",
      "name": "GPT-5.6 Luna",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-sol",
      "name": "GPT-5.6 Sol",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-terra",
      "name": "GPT-5.6 Terra",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-astra",
      "name": "GPT-6 Astra",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-luna",
      "name": "GPT-6 Luna",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-sol",
      "name": "GPT-6 Sol",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6.1-sol",
      "name": "GPT-6.1 Sol",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-daybreak-blue-latest",
      "name": "Daybreak Blue",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-daybreak-red-latest",
      "name": "Daybreak Red",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-realtime-2.1",
      "name": "GPT-Realtime-2.1",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o1",
      "name": "o1",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o1-pro",
      "name": "o1-pro",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o3",
      "name": "o3",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o3-mini",
      "name": "o3-mini",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o3-pro",
      "name": "o3-pro",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o4-mini",
      "name": "o4-mini",
      "reasoning": true,
      "api": "azure-openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-v4-pro",
      "name": "DeepSeek V4 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "baseten": [
    {
      "id": "deepseek-ai/DeepSeek-V4-Flash-0731",
      "name": "DeepSeek V4 Flash 0731",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 384000,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4-Pro-0813",
      "name": "DeepSeek V4 Pro 0813",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4.1-Flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 32768,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4.1-Flash-1017",
      "name": "DeepSeek V4.1 Flash 1017",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4.1-Flash-1017-Fast",
      "name": "DeepSeek V4.1 Flash 1017 Fast",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4.1-Flash-Fast",
      "name": "DeepSeek V4.1 Flash Fast",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 32768,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "moonshotai/Kimi-K3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B",
      "name": "Nemotron Ultra",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202800,
      "maxTokens": 202800,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-120b",
      "name": "OpenAI GPT 120B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128072,
      "maxTokens": 128072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "zai-org/GLM-5.2",
      "name": "GLM 5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "zai-org/GLM-5.2-Fast",
      "name": "GLM 5.2 Fast",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "zai-org/GLM-5.3",
      "name": "GLM 5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "zai-org/GLM-5.3-Fast",
      "name": "GLM 5.3 Fast",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "zai-org/GLM-5.3-Flash",
      "name": "GLM 5.3 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    }
  ],
  "cerebras": [
    {
      "id": "gpt-oss-120b",
      "name": "GPT OSS 120B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 40960,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen-3.8-27b",
      "name": "Qwen3.8 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 40960,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "cloudflare-ai-gateway": [
    {
      "id": "claude-fable-5",
      "name": "Claude Fable 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-fable-5-1",
      "name": "Claude Fable 5.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-haiku-4-5",
      "name": "Claude Haiku 4.5 (latest)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-haiku-5-5",
      "name": "Claude Haiku 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4-5",
      "name": "Claude Opus 4.5 (latest)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-opus-4-6",
      "name": "Claude Opus 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4-7",
      "name": "Claude Opus 4.7",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4-8",
      "name": "Claude Opus 4.8",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-5",
      "name": "Claude Opus 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-5-5",
      "name": "Claude Opus 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-4-5",
      "name": "Claude Sonnet 4.5 (latest)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-5",
      "name": "Claude Sonnet 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-5-5",
      "name": "Claude Sonnet 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
      "name": "DeepSeek V4 Flash 0731",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813",
      "name": "DeepSeek V4 Pro 0813",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "workers-ai/@cf/deepseek-ai/deepseek-v4.1-flash-1017",
      "name": "Deepseek V4.1 Flash 1017",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "workers-ai/@cf/google/gemma-4-26b-a4b-it",
      "name": "Gemma 4 26B A4B IT",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/ibm-granite/granite-4.0-h-micro",
      "name": "Granite 4.0 H Micro",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131000,
      "maxTokens": 131000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "name": "Llama 3.3 70B Instruct fp8 Fast",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 24000,
      "maxTokens": 24000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct",
      "name": "Llama 4 Scout 17B 16E Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "workers-ai/@cf/mistralai/mistral-small-3.1-24b-instruct",
      "name": "Mistral Small 3.1 24B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "workers-ai/@cf/moonshotai/kimi-k2.6",
      "name": "Kimi K2.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/moonshotai/kimi-k2.7-code",
      "name": "Kimi K2.7 Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/nvidia/nemotron-3-120b-a12b",
      "name": "Nemotron 3 Super 120B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/openai/gpt-oss-120b",
      "name": "GPT OSS 120B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/openai/gpt-oss-20b",
      "name": "GPT OSS 20B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/qwen/qwen3-30b-a3b-fp8",
      "name": "Qwen3 30B A3b fp8",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/qwen/qwen3.8-27b",
      "name": "Qwen3.8 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/zai-org/glm-4.7-flash",
      "name": "GLM-4.7-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/zai-org/glm-5.2",
      "name": "Glm 5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/zai-org/glm-5.3",
      "name": "Glm 5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "workers-ai/@cf/zai-org/glm-5.3-flash",
      "name": "Glm 5.3 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-4.1",
      "name": "GPT-4.1",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4.1-mini",
      "name": "GPT-4.1 mini",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4.1-nano",
      "name": "GPT-4.1 nano",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o",
      "name": "GPT-4o",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o-mini",
      "name": "GPT-4o mini",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-5",
      "name": "GPT-5",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5-mini",
      "name": "GPT-5 Mini",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5-nano",
      "name": "GPT-5 Nano",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.1",
      "name": "GPT-5.1",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.4",
      "name": "GPT-5.4",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-mini",
      "name": "GPT-5.4 mini",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-nano",
      "name": "GPT-5.4 nano",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-pro",
      "name": "GPT-5.4 Pro",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.5",
      "name": "GPT-5.5",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.5-pro",
      "name": "GPT-5.5 Pro",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.6-luna",
      "name": "GPT-5.6 Luna",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-sol",
      "name": "GPT-5.6 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-terra",
      "name": "GPT-5.6 Terra",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-astra",
      "name": "GPT-6 Astra",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-luna",
      "name": "GPT-6 Luna",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-sol",
      "name": "GPT-6 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6.1-sol",
      "name": "GPT-6.1 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "o3",
      "name": "o3",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o3-mini",
      "name": "o3-mini",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o4-mini",
      "name": "o4-mini",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "cloudflare-workers-ai": [
    {
      "id": "@cf/deepseek-ai/deepseek-v4-flash-0731",
      "name": "DeepSeek V4 Flash 0731",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "@cf/deepseek-ai/deepseek-v4-pro-0813",
      "name": "DeepSeek V4 Pro 0813",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
      "name": "Deepseek V4.1 Flash 1017",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "@cf/google/gemma-4-26b-a4b-it",
      "name": "Gemma 4 26B A4B IT",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "@cf/ibm-granite/granite-4.0-h-micro",
      "name": "Granite 4.0 H Micro",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131000,
      "maxTokens": 131000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "name": "Llama 3.3 70B Instruct fp8 Fast",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 24000,
      "maxTokens": 24000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "@cf/meta/llama-4-scout-17b-16e-instruct",
      "name": "Llama 4 Scout 17B 16E Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "@cf/mistralai/mistral-small-3.1-24b-instruct",
      "name": "Mistral Small 3.1 24B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "@cf/moonshotai/kimi-k2.6",
      "name": "Kimi K2.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "@cf/moonshotai/kimi-k2.7-code",
      "name": "Kimi K2.7 Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "@cf/nvidia/nemotron-3-120b-a12b",
      "name": "Nemotron 3 Super 120B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "low",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "@cf/openai/gpt-oss-120b",
      "name": "GPT OSS 120B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "@cf/openai/gpt-oss-20b",
      "name": "GPT OSS 20B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "@cf/qwen/qwen3-30b-a3b-fp8",
      "name": "Qwen3 30B A3b fp8",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "@cf/qwen/qwen3.8-27b",
      "name": "Qwen3.8 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "@cf/zai-org/glm-4.7-flash",
      "name": "GLM-4.7-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "@cf/zai-org/glm-5.2",
      "name": "Glm 5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "@cf/zai-org/glm-5.3",
      "name": "Glm 5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "@cf/zai-org/glm-5.3-flash",
      "name": "Glm 5.3 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    }
  ],
  "deepseek": [
    {
      "id": "deepseek-flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-pro",
      "name": "DeepSeek V4 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    }
  ],
  "fireworks": [
    {
      "id": "accounts/fireworks/models/deepseek-v4p1-flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/models/deepseek-v4p1-flash-1017",
      "name": "DeepSeek V4.1 Flash 1017",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/models/ember-1",
      "name": "Ember-1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/models/gpt-oss-120b",
      "name": "GPT OSS 120B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "accounts/fireworks/models/inkling",
      "name": "Inkling",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "accounts/fireworks/models/minimax-m3",
      "name": "MiniMax-M3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 512000,
      "maxTokens": 512000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "accounts/fireworks/models/minimax-m3p1-flash",
      "name": "MiniMax-M3.1-Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 512000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/models/muse-spark-open",
      "name": "Muse Spark Open",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "accounts/fireworks/models/nemotron-3-ultra-nvfp4",
      "name": "Nemotron 3 Ultra 550B A55B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b",
      "name": "Nemotron 3.5 Lightning 30B A3B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "accounts/fireworks/models/qwen3p8-2p4t-a95b",
      "name": "Qwen3.8 2.4T A95B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "accounts/fireworks/models/qwen3p8-max",
      "name": "Qwen3.8 Max",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "accounts/fireworks/routers/deepseek-flash-latest",
      "name": "DeepSeek Flash Latest",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/deepseek-v4p1-flash-1017-spot",
      "name": "DeepSeek V4.1 Flash 1017 Spot",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/deepseek-v4p1-flash-spot",
      "name": "DeepSeek V4.1 Flash Spot",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/kimi-fast-latest",
      "name": "Kimi Fast Latest",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/kimi-latest",
      "name": "Kimi Latest",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/minimax-latest",
      "name": "MiniMax Latest",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 512000,
      "maxTokens": 512000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "accounts/fireworks/routers/qwen-max-latest",
      "name": "Qwen Max Latest (Qwen3.8 Max)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "accounts/fireworks/models/glm-5p3",
      "name": "GLM 5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048573,
      "maxTokens": 262144,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/models/glm-5p3-flash",
      "name": "GLM 5.3 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048573,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/models/kimi-k3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/glm-5p3-fast",
      "name": "GLM 5.3 Fast",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048572,
      "maxTokens": 262144,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/glm-5p3-spot",
      "name": "GLM 5.3 Spot",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048573,
      "maxTokens": 262144,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/glm-fast-latest",
      "name": "GLM 5.3 Fast (Latest)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048572,
      "maxTokens": 262144,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/glm-flash-latest",
      "name": "GLM Flash Latest (GLM 5.3 Flash)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048573,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/glm-latest",
      "name": "GLM Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048573,
      "maxTokens": 262144,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/kimi-k3-fast",
      "name": "Kimi K3 Fast",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "accounts/fireworks/routers/kimi-k3-spot",
      "name": "Kimi K3 Spot",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    }
  ],
  "github-copilot": [
    {
      "id": "claude-fable-5",
      "name": "Claude Fable 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-fable-5.1",
      "name": "Claude Fable 5.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-haiku-4.5",
      "name": "Claude Haiku 4.5 (latest)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-haiku-5.5",
      "name": "Claude Haiku 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4.8",
      "name": "Claude Opus 4.8",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-5",
      "name": "Claude Opus 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-5.5",
      "name": "Claude Opus 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-4.6",
      "name": "Claude Sonnet 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-5",
      "name": "Claude Sonnet 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-5.5",
      "name": "Claude Sonnet 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gemini-3.8-flash",
      "name": "Gemini 3.8 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-4-argon",
      "name": "Gemini 4 Argon",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.3-codex",
      "name": "GPT-5.3 Codex",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-nano",
      "name": "GPT-5.4 nano",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.6-luna",
      "name": "GPT-5.6 Luna",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-sol",
      "name": "GPT-5.6 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-terra",
      "name": "GPT-5.6 Terra",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-astra",
      "name": "GPT-6 Astra",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-luna",
      "name": "GPT-6 Luna",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-sol",
      "name": "GPT-6 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6.1-sol",
      "name": "GPT-6.1 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "grok-4.5",
      "name": "Grok 4.5",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "grok-4.6",
      "name": "Grok 4.6",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "grok-4.7",
      "name": "Grok 4.7",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "mai-code-1.1-flash",
      "name": "MAI-Code-1.1-Flash",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "google": [
    {
      "id": "deep-research-max-preview-04-2026",
      "name": "Deep Research Max Preview (Apr-21-2026)",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deep-research-preview-04-2026",
      "name": "Deep Research Preview (Apr-21-2026)",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-2.5-computer-use-preview-10-2025",
      "name": "Gemini 2.5 Computer Use Preview 10-2025",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 128000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-2.5-flash",
      "name": "Gemini 2.5 Flash",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-2.5-flash-lite",
      "name": "Gemini 2.5 Flash-Lite",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-2.5-pro",
      "name": "Gemini 2.5 Pro",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3-flash-preview",
      "name": "Gemini 3 Flash Preview",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-flash-lite",
      "name": "Gemini 3.1 Flash Lite",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-flash-lite-image",
      "name": "Nano Banana 2 Lite",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 65536,
      "maxTokens": 4096,
      "levels": [
        "minimal",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-flash-lite-preview",
      "name": "Gemini 3.1 Flash Lite Preview",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-flash-live-preview",
      "name": "Gemini 3.1 Flash Live Preview",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-pro-preview",
      "name": "Gemini 3.1 Pro Preview",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-pro-preview-customtools",
      "name": "Gemini 3.1 Pro Preview Custom Tools",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.5-flash",
      "name": "Gemini 3.5 Flash",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.5-flash-lite",
      "name": "Gemini 3.5 Flash Lite",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.6-flash",
      "name": "Gemini 3.6 Flash",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.7-flash",
      "name": "Gemini 3.7 Flash",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.8-flash",
      "name": "Gemini 3.8 Flash",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-4-argon",
      "name": "Gemini 4 Argon",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 32768,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-flash-latest",
      "name": "Gemini Flash Latest",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-flash-lite-latest",
      "name": "Gemini Flash-Lite Latest",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-pro-latest",
      "name": "Gemini Pro Latest",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemma-4-26b-a4b-it",
      "name": "Gemma 4 26B A4B IT",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "minimal",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemma-4-31b-it",
      "name": "Gemma 4 31B IT",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "minimal",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "google-vertex": [
    {
      "id": "gemini-2.5-flash",
      "name": "Gemini 2.5 Flash",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-2.5-flash-lite",
      "name": "Gemini 2.5 Flash-Lite",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-2.5-pro",
      "name": "Gemini 2.5 Pro",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3-flash-preview",
      "name": "Gemini 3 Flash Preview",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-flash-lite",
      "name": "Gemini 3.1 Flash Lite",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-flash-lite-image",
      "name": "Nano Banana 2 Lite",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 65536,
      "maxTokens": 4096,
      "levels": [
        "minimal",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-pro-preview",
      "name": "Gemini 3.1 Pro Preview",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-pro-preview-customtools",
      "name": "Gemini 3.1 Pro Preview Custom Tools",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.5-flash",
      "name": "Gemini 3.5 Flash",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.5-flash-lite",
      "name": "Gemini 3.5 Flash Lite",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.6-flash",
      "name": "Gemini 3.6 Flash",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.7-flash",
      "name": "Gemini 3.7 Flash",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.8-flash",
      "name": "Gemini 3.8 Flash",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-4-argon",
      "name": "Gemini 4 Argon",
      "reasoning": true,
      "api": "google-vertex",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "groq": [
    {
      "id": "llama-3.1-8b-instant",
      "name": "Llama 3.1 8B",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "llama-3.3-70b-versatile",
      "name": "Llama 3.3 70B",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-oss-120b",
      "name": "GPT OSS 120B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-20b",
      "name": "GPT OSS 20B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-safeguard-20b",
      "name": "Safety GPT OSS 20B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.6-27b",
      "name": "Qwen3.6 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.8-27b",
      "name": "Qwen3.8 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "huggingface": [
    {
      "id": "deepseek-ai/DeepSeek-R1",
      "name": "DeepSeek-R1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 64000,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-R1-0528",
      "name": "DeepSeek-R1-0528",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 163840,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V3",
      "name": "DeepSeek-V3",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 64000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V3-0324",
      "name": "DeepSeek V3 0324",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 163840,
      "maxTokens": 163840,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V3.1",
      "name": "DeepSeek-V3.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V3.2",
      "name": "DeepSeek-V3.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 163840,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4-Flash",
      "name": "DeepSeek V4 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 384000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4-Flash-0731",
      "name": "DeepSeek V4 Flash 0731",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4-Flash-Vision-Exp",
      "name": "DeepSeek V4 Flash Vision Exp",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 384000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4-Pro",
      "name": "DeepSeek V4 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 393216,
      "levels": [
        "high"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4-Pro-0813",
      "name": "DeepSeek V4 Pro 0813",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4.1-Flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 384000,
      "levels": [
        "off",
        "low",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4.1-Flash-1017",
      "name": "DeepSeek V4.1 Flash 1017",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 384000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "google/gemma-3-12b-it",
      "name": "Gemma 3 12B IT",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "google/gemma-3-27b-it",
      "name": "Gemma 3 27B IT",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "google/gemma-3-4b-it",
      "name": "Gemma 3 4B IT",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "google/gemma-4-26B-A4B-it",
      "name": "Gemma 4 26B A4B IT",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemma-4-31B-it",
      "name": "Gemma 4 31B IT",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta-llama/Llama-3.1-8B-Instruct",
      "name": "Llama-3.1-8B-Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta-llama/Llama-3.3-70B-Instruct",
      "name": "Llama-3.3-70B-Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "MiniMaxAI/MiniMax-M1-80k",
      "name": "MiniMax M1 80K",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 80000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMaxAI/MiniMax-M2",
      "name": "MiniMax-M2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMaxAI/MiniMax-M2.1",
      "name": "MiniMax-M2.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMaxAI/MiniMax-M2.5",
      "name": "MiniMax-M2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMaxAI/MiniMax-M2.7",
      "name": "MiniMax-M2.7",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMaxAI/MiniMax-M3",
      "name": "MiniMax-M3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 524288,
      "maxTokens": 512000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/Kimi-K2-Instruct",
      "name": "Kimi-K2-Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "moonshotai/Kimi-K2-Instruct-0905",
      "name": "Kimi-K2-Instruct-0905",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "moonshotai/Kimi-K2-Thinking",
      "name": "Kimi-K2-Thinking",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/Kimi-K2.5",
      "name": "Kimi-K2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/Kimi-K2.6",
      "name": "Kimi-K2.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/Kimi-K2.7-Code",
      "name": "Kimi K2.7 Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/Kimi-K3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-oss-120b",
      "name": "GPT OSS 120B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-20b",
      "name": "GPT OSS 20B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen2.5-Coder-32B-Instruct",
      "name": "Qwen2.5-Coder-32B-Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "Qwen/Qwen3-235B-A22B",
      "name": "Qwen3 235B-A22B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 40960,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3-235B-A22B-Instruct-2507",
      "name": "Qwen3 235B-A22B Instruct 2507",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "Qwen/Qwen3-235B-A22B-Thinking-2507",
      "name": "Qwen3-235B-A22B-Thinking-2507",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 81920,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3-30B-A3B",
      "name": "Qwen3 30B A3B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 40960,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3-32B",
      "name": "Qwen3 32B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3-8B",
      "name": "Qwen3 8B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 40960,
      "maxTokens": 32768,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3-Coder-30B-A3B-Instruct",
      "name": "Qwen3-Coder 30B-A3B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      "name": "Qwen3-Coder-480B-A35B-Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "Qwen/Qwen3-Coder-Next",
      "name": "Qwen3-Coder-Next",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "Qwen/Qwen3-Next-80B-A3B-Instruct",
      "name": "Qwen3-Next-80B-A3B-Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "Qwen/Qwen3-VL-235B-A22B-Instruct",
      "name": "Qwen3 VL 235B A22B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "Qwen/Qwen3-VL-235B-A22B-Thinking",
      "name": "Qwen3 VL 235B A22B Thinking",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3-VL-30B-A3B-Instruct",
      "name": "Qwen3 VL 30B A3B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "Qwen/Qwen3.5-122B-A10B",
      "name": "Qwen3.5 122B-A10B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3.5-27B",
      "name": "Qwen3.5 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3.5-35B-A3B",
      "name": "Qwen3.5 35B-A3B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3.5-397B-A17B",
      "name": "Qwen3.5-397B-A17B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3.5-9B",
      "name": "Qwen3.5 9B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3.6-27B",
      "name": "Qwen3.6 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3.6-35B-A3B",
      "name": "Qwen3.6 35B-A3B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3.8-2.4T-A95B",
      "name": "Qwen3.8 2.4T A95B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "Qwen/Qwen3.8-27B",
      "name": "Qwen3.8 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "stepfun-ai/Step-3.5-Flash",
      "name": "Step 3.5 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "stepfun-ai/Step-3.7-Flash",
      "name": "Step 3.7 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "tencent/Hy3",
      "name": "Hy3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "tencent/Hy4-preview",
      "name": "Hy4 preview",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "thinkingmachines/Inkling",
      "name": "Inkling",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "thinkingmachines/Inkling-Small",
      "name": "Inkling Small",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 524288,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "XiaomiMiMo/MiMo-V2.5",
      "name": "MiMo-V2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "XiaomiMiMo/MiMo-V2.5-Pro",
      "name": "MiMo-V2.5-Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "zai-org/GLM-4.5-Air",
      "name": "GLM-4.5-Air",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 98304,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-4.5V",
      "name": "GLM-4.5V",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 65536,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-4.6",
      "name": "GLM-4.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-4.6V-Flash",
      "name": "GLM-4.6V-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-4.7",
      "name": "GLM-4.7",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-4.7-Flash",
      "name": "GLM-4.7-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-5",
      "name": "GLM-5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-5.1",
      "name": "GLM-5.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-5.2",
      "name": "GLM-5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-5.3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "zai-org/GLM-5.3-Flash",
      "name": "GLM-5.3-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    }
  ],
  "kimi-coding": [
    {
      "id": "k3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "k3-256k",
      "name": "Kimi K3-256K",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "k3.1-pro",
      "name": "Kimi K3.1 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "k3.1-pro-highspeed",
      "name": "Kimi K3.1 Pro Highspeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-for-coding",
      "name": "kimi-for-coding",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 32768,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "kimi-for-coding-highspeed",
      "name": "Kimi For Coding HighSpeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "meta": [
    {
      "id": "muse-spark-1.1",
      "name": "Muse Spark 1.1",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "muse-spark-1.2",
      "name": "Muse Spark 1.2",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "muse-spark-1.2-contributor",
      "name": "Muse Spark 1.2 Contributor",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "muse-spark-1.3",
      "name": "Muse Spark 1.3",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "muse-spark-1.3-contributor",
      "name": "Muse Spark 1.3 Contributor",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "muse-wonder-1.0",
      "name": "Muse Wonder",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    }
  ],
  "minimax": [
    {
      "id": "MiniMax-M2.7",
      "name": "MiniMax-M2.7",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMax-M2.7-highspeed",
      "name": "MiniMax-M2.7-highspeed",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMax-M3",
      "name": "MiniMax-M3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 524288,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMax-M3.1-Flash",
      "name": "MiniMax-M3.1-Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 524288,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    }
  ],
  "minimax-cn": [
    {
      "id": "MiniMax-M2.7",
      "name": "MiniMax-M2.7",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMax-M2.7-highspeed",
      "name": "MiniMax-M2.7-highspeed",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMax-M3",
      "name": "MiniMax-M3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 524288,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMax-M3.1-Flash",
      "name": "MiniMax-M3.1-Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 524288,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    }
  ],
  "mistral": [
    {
      "id": "codestral-2508",
      "name": "Codestral 25.08",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "codestral-latest",
      "name": "Codestral (latest)",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "devstral-2512",
      "name": "Devstral 2",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "devstral-latest",
      "name": "Devstral 2",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "devstral-medium-latest",
      "name": "Devstral 2 (latest)",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "glm-5-2",
      "name": "GLM-5.2",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "labs-devstral-small-2512",
      "name": "Devstral Small 2",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "labs-leanstral-1-5-1",
      "name": "Leanstral 1.5",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 128000,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "magistral-medium-latest",
      "name": "Magistral Medium (latest)",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16384,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "ministral-14b-2512",
      "name": "Ministral 3 14B",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "ministral-3b-2512",
      "name": "Ministral 3 3B",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 262144,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "ministral-3b-latest",
      "name": "Ministral 3B (latest)",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 128000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "ministral-8b-2512",
      "name": "Ministral 3 8B",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "ministral-8b-latest",
      "name": "Ministral 8B (latest)",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 128000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral-large-2512",
      "name": "Mistral Large 3",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral-large-4",
      "name": "Mistral Large 4",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral-large-latest",
      "name": "Mistral Large (latest)",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral-medium-2505",
      "name": "Mistral Medium 3",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral-medium-2508",
      "name": "Mistral Medium 3.1",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral-medium-2604",
      "name": "Mistral Medium 3.5",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral-medium-3.5",
      "name": "Mistral Medium 3.5",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral-medium-latest",
      "name": "Mistral Medium (latest)",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral-small-2506",
      "name": "Mistral Small 3.2",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral-small-2603",
      "name": "Mistral Small 4",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral-small-latest",
      "name": "Mistral Small (latest)",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "open-mistral-nemo",
      "name": "Open Mistral Nemo",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "pixtral-12b",
      "name": "Pixtral 12B",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "voxtral-small-2507",
      "name": "Voxtral Small",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 32000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "voxtral-small-latest",
      "name": "Voxtral Small (latest)",
      "reasoning": false,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 32000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "zai-glm-5-2",
      "name": "GLM-5.2",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "zai-glm-5-3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "zai-glm-5-3-flash",
      "name": "GLM-5.3-Flash",
      "reasoning": true,
      "api": "mistral-conversations",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    }
  ],
  "moonshotai": [
    {
      "id": "kimi-k2.6",
      "name": "Kimi K2.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.7-code",
      "name": "Kimi K2.7 Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.7-code-highspeed",
      "name": "Kimi K2.7 Code HighSpeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "kimi-k3.1-pro",
      "name": "Kimi K3.1 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k3.1-pro-highspeed",
      "name": "Kimi K3.1 Pro Highspeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "moonshotai-cn": [
    {
      "id": "kimi-k2.6",
      "name": "Kimi K2.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.7-code",
      "name": "Kimi K2.7 Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.7-code-highspeed",
      "name": "Kimi K2.7 Code HighSpeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "kimi-k3.1-pro",
      "name": "Kimi K3.1 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k3.1-pro-highspeed",
      "name": "Kimi K3.1 Pro Highspeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "nvidia": [
    {
      "id": "deepseek-ai/deepseek-v4.1-flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "google/diffusiongemma-26b-a4b-it",
      "name": "DiffusionGemma 26B A4B IT",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 250000,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemma-3-12b-it",
      "name": "Gemma 3 12B IT",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "google/gemma-3-4b-it",
      "name": "Gemma 3 4B IT",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta/llama-3.2-11b-vision-instruct",
      "name": "Llama 3.2 11b Vision Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta/llama-3.2-90b-vision-instruct",
      "name": "Llama-3.2-90B-Vision-Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta/muse-glimmer-30b",
      "name": "Muse Glimmer 30B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimaxai/minimax-m3.1-flash",
      "name": "MiniMax-M3.1-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistralai/mistral-7b-instruct-v0.3",
      "name": "Mistral-7B-Instruct-v0.3",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 65536,
      "maxTokens": 65536,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "moonshotai/kimi-k2.6",
      "name": "Kimi K2.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/cosmos-reason2-8b",
      "name": "Cosmos Reason2 8B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/llama-3.1-nemotron-70b-instruct",
      "name": "Llama 3.1 Nemotron 70B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      "name": "Llama 3.1 Nemotron Ultra 253B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      "name": "Nemotron 3 Nano Omni",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3-ultra-550b-a55b",
      "name": "Nemotron 3 Ultra 550B A55B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3.5-lightning-30b-a3b",
      "name": "Nemotron 3.5 Lightning 30B A3B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3.5-super-vl-120b-a12b",
      "name": "Nemotron 3.5 Super VL 120B A12B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-20b",
      "name": "GPT OSS 20B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "poolside/laguna-xs-2.1",
      "name": "Laguna XS 2.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "stepfun-ai/step-5-preview",
      "name": "Step 5 Preview",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-5.3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-5.3-flash",
      "name": "GLM-5.3-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "openai": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 8192,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4-turbo",
      "name": "GPT-4 Turbo",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4.1",
      "name": "GPT-4.1",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4.1-mini",
      "name": "GPT-4.1 mini",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4.1-nano",
      "name": "GPT-4.1 nano",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o",
      "name": "GPT-4o",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o-2024-05-13",
      "name": "GPT-4o (2024-05-13)",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o-2024-08-06",
      "name": "GPT-4o (2024-08-06)",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o-2024-11-20",
      "name": "GPT-4o (2024-11-20)",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-4o-mini",
      "name": "GPT-4o mini",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-5",
      "name": "GPT-5",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5-chat-latest",
      "name": "GPT-5 Chat Latest",
      "reasoning": false,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "gpt-5-mini",
      "name": "GPT-5 Mini",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5-nano",
      "name": "GPT-5 Nano",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5-pro",
      "name": "GPT-5 Pro",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "high"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.1",
      "name": "GPT-5.1",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.2",
      "name": "GPT-5.2",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.2-pro",
      "name": "GPT-5.2 Pro",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.3-codex",
      "name": "GPT-5.3 Codex",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.3-codex-spark",
      "name": "GPT-5.3 Codex Spark",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 32000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4",
      "name": "GPT-5.4",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-mini",
      "name": "GPT-5.4 mini",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-nano",
      "name": "GPT-5.4 nano",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-pro",
      "name": "GPT-5.4 Pro",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.5",
      "name": "GPT-5.5",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.5-pro",
      "name": "GPT-5.5 Pro",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.6-luna",
      "name": "GPT-5.6 Luna",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-sol",
      "name": "GPT-5.6 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-terra",
      "name": "GPT-5.6 Terra",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-astra",
      "name": "GPT-6 Astra",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-luna",
      "name": "GPT-6 Luna",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-sol",
      "name": "GPT-6 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6.1-sol",
      "name": "GPT-6.1 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-daybreak-blue-latest",
      "name": "Daybreak Blue",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-daybreak-red-latest",
      "name": "Daybreak Red",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-realtime-2.1",
      "name": "GPT-Realtime-2.1",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 32000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "o1",
      "name": "o1",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o1-pro",
      "name": "o1-pro",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o3",
      "name": "o3",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o3-mini",
      "name": "o3-mini",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o3-pro",
      "name": "o3-pro",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "o4-mini",
      "name": "o4-mini",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "openai-codex": [
    {
      "id": "gpt-5.6-luna",
      "name": "GPT-5.6 Luna",
      "reasoning": true,
      "api": "openai-codex-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-sol",
      "name": "GPT-5.6 Sol",
      "reasoning": true,
      "api": "openai-codex-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-terra",
      "name": "GPT-5.6 Terra",
      "reasoning": true,
      "api": "openai-codex-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-astra",
      "name": "GPT-6 Astra",
      "reasoning": true,
      "api": "openai-codex-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-luna",
      "name": "GPT-6 Luna",
      "reasoning": true,
      "api": "openai-codex-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-sol",
      "name": "GPT-6 Sol",
      "reasoning": true,
      "api": "openai-codex-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6.1-sol",
      "name": "GPT-6.1 Sol",
      "reasoning": true,
      "api": "openai-codex-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    }
  ],
  "opencode": [
    {
      "id": "claude-fable-5",
      "name": "Claude Fable 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-fable-5-1",
      "name": "Claude Fable 5.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-haiku-4-5",
      "name": "Claude Haiku 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-haiku-5-5",
      "name": "Claude Haiku 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4-5",
      "name": "Claude Opus 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-opus-4-6",
      "name": "Claude Opus 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4-7",
      "name": "Claude Opus 4.7",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4-8",
      "name": "Claude Opus 4.8",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-5",
      "name": "Claude Opus 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-5-5",
      "name": "Claude Opus 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-4-5",
      "name": "Claude Sonnet 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-5",
      "name": "Claude Sonnet 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-5-5",
      "name": "Claude Sonnet 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "qwen3.5-plus",
      "name": "Qwen3.5 Plus",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.6-plus",
      "name": "Qwen3.6 Plus",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.8-flash",
      "name": "Qwen3.8 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3-flash",
      "name": "Gemini 3 Flash",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.1-pro",
      "name": "Gemini 3.1 Pro Preview",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.5-flash",
      "name": "Gemini 3.5 Flash",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.5-flash-lite",
      "name": "Gemini 3.5 Flash Lite",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.6-flash",
      "name": "Gemini 3.6 Flash",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.7-flash",
      "name": "Gemini 3.7 Flash",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-3.8-flash",
      "name": "Gemini 3.8 Flash",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-4-argon",
      "name": "Gemini 4 Argon",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "beam-free",
      "name": "Beam Free",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "big-pickle",
      "name": "Big Pickle",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-v4-flash",
      "name": "DeepSeek V4 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-pro",
      "name": "DeepSeek V4 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4.1-flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4.1-flash-free",
      "name": "DeepSeek V4.1 Flash Free",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 32000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "flint-40b-free",
      "name": "Flint 40B Free",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "glm-5",
      "name": "GLM-5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "glm-5.1",
      "name": "GLM-5.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "glm-5.2",
      "name": "GLM-5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3-flash",
      "name": "GLM-5.3-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3-flash-free",
      "name": "GLM-5.3-Flash Free",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 32000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "kimi-k2.5",
      "name": "Kimi K2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.6",
      "name": "Kimi K2.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.7-code",
      "name": "Kimi K2.7 Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "mimo-v2.6-flash-free",
      "name": "MiMo-V2.6-Flash Free",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax-m2.5",
      "name": "MiniMax-M2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax-m2.7",
      "name": "MiniMax-M2.7",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax-m3",
      "name": "MiniMax-M3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 512000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral-large-4",
      "name": "Mistral Large 4",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 524288,
      "maxTokens": 262144,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nemotron-3-ultra-free",
      "name": "Nemotron 3 Ultra Free",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nemotron-3.5-lightning-free",
      "name": "Nemotron 3.5 Lightning Free",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nemotron-3.5-super-vl-free",
      "name": "Nemotron 3.5 Super VL Free",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "qwen3.8-max",
      "name": "Qwen3.8 Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5",
      "name": "GPT-5",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5-codex",
      "name": "GPT-5 Codex",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5-nano",
      "name": "GPT-5 Nano",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.1",
      "name": "GPT-5.1",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.1-codex",
      "name": "GPT-5.1 Codex",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.1-codex-max",
      "name": "GPT-5.1 Codex Max",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.1-codex-mini",
      "name": "GPT-5.1 Codex Mini",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.2",
      "name": "GPT-5.2",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.2-codex",
      "name": "GPT-5.2 Codex",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.3-codex",
      "name": "GPT-5.3 Codex",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4",
      "name": "GPT-5.4",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-mini",
      "name": "GPT-5.4 Mini",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-nano",
      "name": "GPT-5.4 Nano",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-pro",
      "name": "GPT-5.4 Pro",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.5",
      "name": "GPT-5.5",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.5-pro",
      "name": "GPT-5.5 Pro",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.6-luna",
      "name": "GPT-5.6 Luna",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-sol",
      "name": "GPT-5.6 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-terra",
      "name": "GPT-5.6 Terra",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-astra",
      "name": "GPT-6 Astra",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-luna",
      "name": "GPT-6 Luna",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-sol",
      "name": "GPT-6 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6.1-sol",
      "name": "GPT-6.1 Sol",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "grok-4.5",
      "name": "Grok 4.5",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "grok-4.6",
      "name": "Grok 4.6",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "grok-4.7",
      "name": "Grok 4.7",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "grok-build-0.1",
      "name": "Grok Build 0.1",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "high"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "muse-spark-1.2",
      "name": "Muse Spark 1.2",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "muse-spark-1.3",
      "name": "Muse Spark 1.3",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "muse-wonder-1.0",
      "name": "Muse Wonder",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    }
  ],
  "opencode-go": [
    {
      "id": "claude-haiku-5-5",
      "name": "Claude Haiku 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "minimax-m3",
      "name": "MiniMax-M3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.7-plus",
      "name": "Qwen3.7 Plus",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.8-flash",
      "name": "Qwen3.8 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.8-max",
      "name": "Qwen3.8 Max",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gemini-4-argon-contributor",
      "name": "Gemini 4 Argon Contributor",
      "reasoning": true,
      "api": "google-generative-ai",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "beam-free",
      "name": "Beam Free",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-pro",
      "name": "DeepSeek V4 Pro (New)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4.1-flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.2",
      "name": "GLM-5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3-flash",
      "name": "GLM-5.3-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "hy3",
      "name": "Hy3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "hy4-preview",
      "name": "Hy4 preview",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1024000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.7-code",
      "name": "Kimi K2.7 Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "max"
      ],
      "clamps": {
        "off": "max",
        "minimal": "max",
        "low": "max",
        "medium": "max",
        "high": "max",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "kimi-k3.1-pro",
      "name": "Kimi K3.1 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "longcat-2.0",
      "name": "LongCat-2.0",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mimo-v2.5",
      "name": "MiMo V2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mimo-v2.5-pro",
      "name": "MiMo V2.5 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mimo-v2.6-flash",
      "name": "MiMo-V2.6-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mimo-v2.6-pro",
      "name": "MiMo-V2.6-Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax-m3.1-flash",
      "name": "MiniMax M3.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 512000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "step-5-preview",
      "name": "Step 5 Preview",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "gpt-5.6-luna",
      "name": "GPT-5.6 Luna",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-luna",
      "name": "GPT-6 Luna",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "grok-4.7",
      "name": "Grok 4.7",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "muse-spark-1.2-contributor",
      "name": "Muse Spark 1.2 Contributor",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "muse-spark-1.3-contributor",
      "name": "Muse Spark 1.3 Contributor",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    }
  ],
  "openrouter": [
    {
      "id": "anthropic/claude-fable-5",
      "name": "Anthropic: Claude Fable 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-fable-5.1",
      "name": "Anthropic: Claude Fable 5.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-haiku-4.5",
      "name": "Anthropic: Claude Haiku 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-haiku-5.5",
      "name": "Anthropic: Claude Haiku 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.1",
      "name": "Anthropic: Claude Opus 4.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-opus-4.5",
      "name": "Anthropic: Claude Opus 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-opus-4.6",
      "name": "Anthropic: Claude Opus 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.7",
      "name": "Anthropic: Claude Opus 4.7",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.8",
      "name": "Anthropic: Claude Opus 4.8",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-5",
      "name": "Anthropic: Claude Opus 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-5.5",
      "name": "Anthropic: Claude Opus 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-4.5",
      "name": "Anthropic: Claude Sonnet 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-sonnet-4.6",
      "name": "Anthropic: Claude Sonnet 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-5",
      "name": "Anthropic: Claude Sonnet 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-5.5",
      "name": "Anthropic: Claude Sonnet 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "~anthropic/claude-fable-latest",
      "name": "Anthropic: Claude Fable Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "~anthropic/claude-haiku-latest",
      "name": "Anthropic: Claude Haiku Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "~anthropic/claude-opus-latest",
      "name": "Anthropic: Claude Opus Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "~anthropic/claude-sonnet-latest",
      "name": "Anthropic: Claude Sonnet Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "~deepseek/deepseek-flash-latest",
      "name": "DeepSeek: DeepSeek Flash Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "~deepseek/deepseek-pro-latest",
      "name": "DeepSeek: DeepSeek Pro Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 393216,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "~deepseek/deepseek-v4-flash-latest",
      "name": "DeepSeek: DeepSeek V4 Flash Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "~google/gemini-flash-latest",
      "name": "Google: Gemini Flash Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "~google/gemini-pro-latest",
      "name": "Google: Gemini Pro Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "~moonshotai/kimi-latest",
      "name": "MoonshotAI: Kimi Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "~openai/gpt-astra-latest",
      "name": "OpenAI: GPT Astra Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "~openai/gpt-luna-latest",
      "name": "OpenAI: GPT Luna Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "~openai/gpt-mini-latest",
      "name": "OpenAI: GPT Mini Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "~openai/gpt-sol-latest",
      "name": "OpenAI: GPT Sol Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "~openai/gpt-terra-latest",
      "name": "OpenAI: GPT Terra Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "~unbiased/pareto-latest",
      "name": "Pareto Latest",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "~x-ai/grok-latest",
      "name": "xAI: Grok Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 450000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "~z-ai/glm-flash-latest",
      "name": "Z.ai: GLM Flash Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "~z-ai/glm-latest",
      "name": "Z.ai: GLM Latest",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "aion-labs/aion-2.0",
      "name": "AionLabs: Aion-2.0",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "aion-labs/aion-3.0",
      "name": "AionLabs: Aion-3.0",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "aion-labs/aion-3.0-mini",
      "name": "AionLabs: Aion-3.0-Mini",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "aion-labs/aion-3.5",
      "name": "AionLabs: Aion 3.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "aion-labs/aion-3.5-mini",
      "name": "AionLabs: Aion 3.5 Mini",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "amazon/nova-2-lite-v1",
      "name": "Amazon: Nova 2 Lite",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "amazon/nova-lite-v1",
      "name": "Amazon: Nova Lite 1.0",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 5120,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "amazon/nova-micro-v1",
      "name": "Amazon: Nova Micro 1.0",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 5120,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "amazon/nova-premier-v1",
      "name": "Amazon: Nova Premier 1.0",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 32000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "amazon/nova-pro-v1",
      "name": "Amazon: Nova Pro 1.0",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 5120,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "anthropic/claude-fable-5:batch",
      "name": "Anthropic: Claude Fable 5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-fable-5.1:batch",
      "name": "Anthropic: Claude Fable 5.1 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-haiku-4.5:batch",
      "name": "Anthropic: Claude Haiku 4.5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-haiku-5.5:batch",
      "name": "Anthropic: Claude Haiku 5.5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.1:batch",
      "name": "Anthropic: Claude Opus 4.1 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-opus-4.5:batch",
      "name": "Anthropic: Claude Opus 4.5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-opus-4.6:batch",
      "name": "Anthropic: Claude Opus 4.6 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.7:batch",
      "name": "Anthropic: Claude Opus 4.7 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.8:batch",
      "name": "Anthropic: Claude Opus 4.8 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-5:batch",
      "name": "Anthropic: Claude Opus 5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-5.5:batch",
      "name": "Anthropic: Claude Opus 5.5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-4.5:batch",
      "name": "Anthropic: Claude Sonnet 4.5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-sonnet-4.6:batch",
      "name": "Anthropic: Claude Sonnet 4.6 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-5:batch",
      "name": "Anthropic: Claude Sonnet 5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-5.5:batch",
      "name": "Anthropic: Claude Sonnet 5.5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "arcee-ai/trinity-large-thinking",
      "name": "Arcee AI: Trinity Large Thinking",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 80000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "auto",
      "name": "Auto",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 2000000,
      "maxTokens": 30000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "bytedance-seed/seed-1.6",
      "name": "ByteDance Seed: Seed 1.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "bytedance-seed/seed-1.6-flash",
      "name": "ByteDance Seed: Seed 1.6 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "bytedance-seed/seed-2-1-turbo",
      "name": "ByteDance Seed: Seed 2.1 Turbo",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "bytedance-seed/seed-2.0-code",
      "name": "ByteDance Seed: Seed-2.0-Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "bytedance-seed/seed-2.0-lite",
      "name": "ByteDance Seed: Seed-2.0-Lite",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "bytedance-seed/seed-2.0-mini",
      "name": "ByteDance Seed: Seed-2.0-Mini",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "cohere/command-a-plus",
      "name": "Cohere: Command A+",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 192000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "cohere/command-r-08-2024",
      "name": "Cohere: Command R (08-2024)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "cohere/command-r-plus-08-2024",
      "name": "Cohere: Command R+ (08-2024)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "cohere/north-mini-code:free",
      "name": "Cohere: North Mini Code (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-chat",
      "name": "DeepSeek: DeepSeek V3",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "deepseek/deepseek-chat-v3-0324",
      "name": "DeepSeek: DeepSeek V3 0324",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 115200,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "deepseek/deepseek-chat-v3.1",
      "name": "DeepSeek: DeepSeek V3.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 163840,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-r1-0528",
      "name": "DeepSeek: R1 0528",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 163840,
      "maxTokens": 32768,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v3.1-terminus",
      "name": "DeepSeek: DeepSeek V3.1 Terminus",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 163840,
      "maxTokens": 147456,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v3.2",
      "name": "DeepSeek: DeepSeek V3.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v3.2-exp",
      "name": "DeepSeek: DeepSeek V3.2 Exp",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 163840,
      "maxTokens": 147456,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v4-flash",
      "name": "DeepSeek: DeepSeek V4 Flash 0423",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048575,
      "maxTokens": 943717,
      "levels": [
        "off",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "deepseek/deepseek-v4-flash-0731",
      "name": "DeepSeek: DeepSeek V4 Flash 0731",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek/deepseek-v4-flash-vision-exp",
      "name": "DeepSeek: DeepSeek V4 Flash Vision Exp",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek/deepseek-v4-pro",
      "name": "DeepSeek: DeepSeek V4 Pro 0423",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1024000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "deepseek/deepseek-v4-pro-0813",
      "name": "DeepSeek: DeepSeek V4 Pro 0813",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 393216,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek/deepseek-v4.1-flash",
      "name": "DeepSeek: DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek/deepseek-v4.1-flash-1017",
      "name": "DeepSeek: DeepSeek V4.1 Flash 1017",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 393216,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek/deepseek-v4.1-flash:batch",
      "name": "DeepSeek: DeepSeek V4.1 Flash (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 384000,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "dots-studio/dots-3-note-preview:free",
      "name": "Dots Studio: Dots3-Note Preview (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 512000,
      "maxTokens": 460800,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "elorian/glimpse",
      "name": "Elorian: Glimpse",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "fireworks/ember-1",
      "name": "Fireworks: Ember-1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "google/gemini-2.5-flash",
      "name": "Google: Gemini 2.5 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-2.5-flash-lite",
      "name": "Google: Gemini 2.5 Flash Lite",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-2.5-pro",
      "name": "Google: Gemini 2.5 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-2.5-pro-preview",
      "name": "Google: Gemini 2.5 Pro Preview 06-05",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3-flash-preview",
      "name": "Google: Gemini 3 Flash Preview",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3-flash-preview:batch",
      "name": "Google: Gemini 3 Flash Preview (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3-pro-image",
      "name": "Google: Nano Banana Pro (Gemini 3 Pro Image)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 65536,
      "maxTokens": 32768,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.1-flash-lite",
      "name": "Google: Gemini 3.1 Flash Lite",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.1-flash-lite-preview",
      "name": "Google: Gemini 3.1 Flash Lite Preview",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.1-flash-lite:batch",
      "name": "Google: Gemini 3.1 Flash Lite (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.1-pro-preview",
      "name": "Google: Gemini 3.1 Pro Preview",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.1-pro-preview-customtools",
      "name": "Google: Gemini 3.1 Pro Preview Custom Tools",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.1-pro-preview:batch",
      "name": "Google: Gemini 3.1 Pro Preview (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.5-flash",
      "name": "Google: Gemini 3.5 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.5-flash-lite",
      "name": "Google: Gemini 3.5 Flash Lite",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.5-flash-lite:batch",
      "name": "Google: Gemini 3.5 Flash Lite (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.5-flash:batch",
      "name": "Google: Gemini 3.5 Flash (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.6-flash",
      "name": "Google: Gemini 3.6 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.6-flash:batch",
      "name": "Google: Gemini 3.6 Flash (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.7-flash",
      "name": "Google: Gemini 3.7 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.7-flash:batch",
      "name": "Google: Gemini 3.7 Flash (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.8-flash",
      "name": "Google: Gemini 3.8 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.8-flash:batch",
      "name": "Google: Gemini 3.8 Flash (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-4-argon",
      "name": "Google: Gemini 4 Argon",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-4-argon:batch",
      "name": "Google: Gemini 4 Argon (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-nano-banana-2.1",
      "name": "Google: Nano Banana 2.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 65536,
      "maxTokens": 58982,
      "levels": [
        "off",
        "minimal",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemma-3-12b-it",
      "name": "Google: Gemma 3 12B",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "google/gemma-3-27b-it",
      "name": "Google: Gemma 3 27B",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 117964,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "google/gemma-4-26b-a4b-it",
      "name": "Google: Gemma 4 26B A4B ",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemma-4-26b-a4b-it:free",
      "name": "Google: Gemma 4 26B A4B  (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemma-4-31b-it",
      "name": "Google: Gemma 4 31B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemma-4-31b-it:free",
      "name": "Google: Gemma 4 31B (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "ibm-granite/granite-4.2-8b",
      "name": "IBM: Granite 4.2 8B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 117964,
      "levels": [
        "off",
        "low",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inception/mercury-2",
      "name": "Inception: Mercury 2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 50000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inception/mercury-2.5",
      "name": "Inception: Mercury 2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 260000,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inception/mercury-3",
      "name": "Inception: Mercury 3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inclusionai/ling-3.0-flash",
      "name": "inclusionAI: Ling 3.0 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inclusionai/ling-3.0-flash-vl",
      "name": "inclusionAI: Ling 3.0 Flash VL",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inclusionai/ling-3.1-flash",
      "name": "inclusionAI: Ling 3.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "liquid/lfm-2.5-2.6b:free",
      "name": "LiquidAI: LFM2.5-2.6B (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 65536,
      "maxTokens": 8192,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "liquid/lfm-2.5-24b-a2b",
      "name": "LiquidAI: LFM2.5-24B-A2B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meituan/longcat-2.0",
      "name": "Meituan: LongCat 2.0",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048756,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta-llama/llama-3.1-70b-instruct",
      "name": "Meta: Llama 3.1 70B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta-llama/llama-3.1-8b-instruct",
      "name": "Meta: Llama 3.1 8B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 117964,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta-llama/llama-3.3-70b-instruct",
      "name": "Meta: Llama 3.3 70B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta-llama/llama-4-maverick",
      "name": "Meta: Llama 4 Maverick",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta-llama/llama-4-scout",
      "name": "Meta: Llama 4 Scout",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 327680,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta/muse-glimmer-30b",
      "name": "Meta: Muse Glimmer 30B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "meta/muse-spark-1.1",
      "name": "Meta: Muse Spark 1.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "meta/muse-spark-1.2",
      "name": "Meta: Muse Spark 1.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "meta/muse-spark-1.2-contributor",
      "name": "Meta: Muse Spark 1.2 Contributor",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "meta/muse-spark-1.3",
      "name": "Meta: Muse Spark 1.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "meta/muse-spark-1.3-contributor",
      "name": "Meta: Muse Spark 1.3 Contributor",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "meta/muse-spark-open",
      "name": "Meta: Muse Spark Open",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "meta/muse-wonder",
      "name": "Meta: Muse Wonder",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "minimax/minimax-m1",
      "name": "MiniMax: MiniMax M1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 40000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2",
      "name": "MiniMax: MiniMax M2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2.1",
      "name": "MiniMax: MiniMax M2.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2.5",
      "name": "MiniMax: MiniMax M2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 198000,
      "maxTokens": 32768,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2.7",
      "name": "MiniMax: MiniMax M2.7",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m3",
      "name": "MiniMax: MiniMax M3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 524288,
      "maxTokens": 512000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m3.1-flash",
      "name": "MiniMax: MiniMax M3.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 524288,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "mistralai/codestral-2508",
      "name": "Mistral: Codestral 2508",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 204800,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/codestral-2508:batch",
      "name": "Mistral: Codestral 2508 (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 204800,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/devstral-2512",
      "name": "Mistral: Devstral 2 2512",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 209715,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/ministral-14b-2512",
      "name": "Mistral: Ministral 3 14B 2512",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 209715,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/ministral-3b-2512",
      "name": "Mistral: Ministral 3 3B 2512",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 104857,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/ministral-8b-2512",
      "name": "Mistral: Ministral 3 8B 2512",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 209715,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/ministral-8b-2512:batch",
      "name": "Mistral: Ministral 3 8B 2512 (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 209715,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-large",
      "name": "Mistral Large",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 102400,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-large-2407",
      "name": "Mistral Large 2407",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 104857,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-large-2512",
      "name": "Mistral: Mistral Large 3 2512",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 209715,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-large-2512:batch",
      "name": "Mistral: Mistral Large 3 2512 (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 209715,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-large-4-0",
      "name": "Mistral: Mistral Large 4",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistralai/mistral-medium-3",
      "name": "Mistral: Mistral Medium 3",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 104857,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-medium-3-5",
      "name": "Mistral: Mistral Medium 3.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 209715,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistralai/mistral-medium-3-5:batch",
      "name": "Mistral: Mistral Medium 3.5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 209715,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistralai/mistral-medium-3.1",
      "name": "Mistral: Mistral Medium 3.1",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 104857,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-medium-3.1:batch",
      "name": "Mistral: Mistral Medium 3.1 (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 104857,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-nemo",
      "name": "Mistral: Mistral Nemo",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-saba",
      "name": "Mistral: Saba",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 26214,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-small-2603",
      "name": "Mistral: Mistral Small 4",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 209715,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistralai/mistral-small-2603:batch",
      "name": "Mistral: Mistral Small 4 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 209715,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistralai/mistral-small-3.1-24b-instruct",
      "name": "Mistral: Mistral Small 3.1 24B",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 102400,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mistral-small-3.2-24b-instruct",
      "name": "Mistral: Mistral Small 3.2 24B",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/mixtral-8x22b-instruct",
      "name": "Mistral: Mixtral 8x22B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 65536,
      "maxTokens": 52428,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistralai/voxtral-small-24b-2507",
      "name": "Mistral: Voxtral Small 24B 2507",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 26214,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "moonshotai/kimi-k2",
      "name": "MoonshotAI: Kimi K2 0711",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 98304,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "moonshotai/kimi-k2-0905",
      "name": "MoonshotAI: Kimi K2 0905",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 98304,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "moonshotai/kimi-k2-thinking",
      "name": "MoonshotAI: Kimi K2 Thinking",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 98304,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k2.5",
      "name": "MoonshotAI: Kimi K2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 4096,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k2.6",
      "name": "MoonshotAI: Kimi K2.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k2.7-code",
      "name": "MoonshotAI: Kimi K2.7 Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k3",
      "name": "MoonshotAI: Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "moonshotai/kimi-k3:batch",
      "name": "MoonshotAI: Kimi K3 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 16384,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "moonshotai/kimi-k3.1-pro",
      "name": "MoonshotAI: Kimi K3.1 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "nex-agi/nex-n2.5-pro",
      "name": "Nex AGI: Nex-N2.5-Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3-nano-30b-a3b",
      "name": "NVIDIA: Nemotron 3 Nano 30B A3B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "name": "NVIDIA: Nemotron 3 Nano Omni (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3-super-120b-a12b",
      "name": "NVIDIA: Nemotron 3 Super",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "low",
        "medium"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "medium",
        "xhigh": "medium",
        "max": "medium"
      }
    },
    {
      "id": "nvidia/nemotron-3-super-120b-a12b:free",
      "name": "NVIDIA: Nemotron 3 Super (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "low",
        "medium"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "medium",
        "xhigh": "medium",
        "max": "medium"
      }
    },
    {
      "id": "nvidia/nemotron-3-ultra-550b-a55b",
      "name": "NVIDIA: Nemotron 3 Ultra",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202800,
      "maxTokens": 182520,
      "levels": [
        "off",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3-ultra-550b-a55b:free",
      "name": "NVIDIA: Nemotron 3 Ultra (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3.5-lightning",
      "name": "NVIDIA: Nemotron 3.5 Lightning",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3.5-lightning:free",
      "name": "NVIDIA: Nemotron 3.5 Lightning (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3.5-super-vl",
      "name": "NVIDIA: Nemotron 3.5 Super VL",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3.5-super-vl:free",
      "name": "NVIDIA: Nemotron 3.5 Super VL (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-3.5-turbo",
      "name": "OpenAI: GPT-3.5 Turbo",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 16385,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-3.5-turbo-0613",
      "name": "OpenAI: GPT-3.5 Turbo (older v0613)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 4095,
      "maxTokens": 3685,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-3.5-turbo-16k",
      "name": "OpenAI: GPT-3.5 Turbo 16k",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 16385,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-3.5-turbo:batch",
      "name": "OpenAI: GPT-3.5 Turbo (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 16385,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4",
      "name": "OpenAI: GPT-4",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 8191,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4-turbo",
      "name": "OpenAI: GPT-4 Turbo",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4-turbo:batch",
      "name": "OpenAI: GPT-4 Turbo (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1",
      "name": "OpenAI: GPT-4.1",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1-mini",
      "name": "OpenAI: GPT-4.1 Mini",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1-mini:batch",
      "name": "OpenAI: GPT-4.1 Mini (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1-nano",
      "name": "OpenAI: GPT-4.1 Nano",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1-nano:batch",
      "name": "OpenAI: GPT-4.1 Nano (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1:batch",
      "name": "OpenAI: GPT-4.1 (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o",
      "name": "OpenAI: GPT-4o",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-2024-05-13",
      "name": "OpenAI: GPT-4o (2024-05-13)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4096,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-2024-08-06",
      "name": "OpenAI: GPT-4o (2024-08-06)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-2024-11-20",
      "name": "OpenAI: GPT-4o (2024-11-20)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-mini",
      "name": "OpenAI: GPT-4o-mini",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-mini-2024-07-18",
      "name": "OpenAI: GPT-4o-mini (2024-07-18)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-mini:batch",
      "name": "OpenAI: GPT-4o-mini (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o:batch",
      "name": "OpenAI: GPT-4o (batch)",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-5",
      "name": "OpenAI: GPT-5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-mini",
      "name": "OpenAI: GPT-5 Mini",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-mini:batch",
      "name": "OpenAI: GPT-5 Mini (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-nano",
      "name": "OpenAI: GPT-5 Nano",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-nano:batch",
      "name": "OpenAI: GPT-5 Nano (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-pro",
      "name": "OpenAI: GPT-5 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "high"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-pro:batch",
      "name": "OpenAI: GPT-5 Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "high"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5:batch",
      "name": "OpenAI: GPT-5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.1",
      "name": "OpenAI: GPT-5.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.1-codex",
      "name": "OpenAI: GPT-5.1-Codex",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.1-codex-max",
      "name": "OpenAI: GPT-5.1-Codex-Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.1-codex-mini",
      "name": "OpenAI: GPT-5.1-Codex-Mini",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.1:batch",
      "name": "OpenAI: GPT-5.1 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.2",
      "name": "OpenAI: GPT-5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.2-chat",
      "name": "OpenAI: GPT-5.2 Chat",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 32000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-5.2-codex",
      "name": "OpenAI: GPT-5.2-Codex",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.2-pro",
      "name": "OpenAI: GPT-5.2 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.2-pro:batch",
      "name": "OpenAI: GPT-5.2 Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.2:batch",
      "name": "OpenAI: GPT-5.2 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.3-codex",
      "name": "OpenAI: GPT-5.3-Codex",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4",
      "name": "OpenAI: GPT-5.4",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-mini",
      "name": "OpenAI: GPT-5.4 Mini",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-mini:batch",
      "name": "OpenAI: GPT-5.4 Mini (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-nano",
      "name": "OpenAI: GPT-5.4 Nano",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-nano:batch",
      "name": "OpenAI: GPT-5.4 Nano (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-pro",
      "name": "OpenAI: GPT-5.4 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-pro:batch",
      "name": "OpenAI: GPT-5.4 Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4:batch",
      "name": "OpenAI: GPT-5.4 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.5",
      "name": "OpenAI: GPT-5.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.5-pro",
      "name": "OpenAI: GPT-5.5 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.5-pro:batch",
      "name": "OpenAI: GPT-5.5 Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.5:batch",
      "name": "OpenAI: GPT-5.5 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.6-luna",
      "name": "OpenAI: GPT-5.6 Luna",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-luna-pro",
      "name": "OpenAI: GPT-5.6 Luna Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-luna-pro:batch",
      "name": "OpenAI: GPT-5.6 Luna Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-luna:batch",
      "name": "OpenAI: GPT-5.6 Luna (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-sol",
      "name": "OpenAI: GPT-5.6 Sol",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-sol-pro",
      "name": "OpenAI: GPT-5.6 Sol Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-sol-pro:batch",
      "name": "OpenAI: GPT-5.6 Sol Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-sol:batch",
      "name": "OpenAI: GPT-5.6 Sol (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-terra",
      "name": "OpenAI: GPT-5.6 Terra",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-terra-pro",
      "name": "OpenAI: GPT-5.6 Terra Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-terra-pro:batch",
      "name": "OpenAI: GPT-5.6 Terra Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-5.6-terra:batch",
      "name": "OpenAI: GPT-5.6 Terra (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-astra",
      "name": "OpenAI: GPT-6 Astra",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-astra-pro",
      "name": "OpenAI: GPT-6 Astra Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-astra-pro:batch",
      "name": "OpenAI: GPT-6 Astra Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-astra:batch",
      "name": "OpenAI: GPT-6 Astra (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-luna",
      "name": "OpenAI: GPT-6 Luna",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-luna-pro",
      "name": "OpenAI: GPT-6 Luna Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-luna-pro:batch",
      "name": "OpenAI: GPT-6 Luna Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-luna:batch",
      "name": "OpenAI: GPT-6 Luna (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-sol",
      "name": "OpenAI: GPT-6 Sol",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-sol-pro",
      "name": "OpenAI: GPT-6 Sol Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-sol-pro:batch",
      "name": "OpenAI: GPT-6 Sol Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6-sol:batch",
      "name": "OpenAI: GPT-6 Sol (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6.1-sol",
      "name": "OpenAI: GPT-6.1 Sol",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6.1-sol-pro",
      "name": "OpenAI: GPT-6.1 Sol Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6.1-sol-pro:batch",
      "name": "OpenAI: GPT-6.1 Sol Pro (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-6.1-sol:batch",
      "name": "OpenAI: GPT-6.1 Sol (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "openai/gpt-audio",
      "name": "OpenAI: GPT Audio",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-audio-mini",
      "name": "OpenAI: GPT Audio Mini",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-chat-latest",
      "name": "OpenAI: GPT Chat Latest",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-oss-120b",
      "name": "OpenAI: gpt-oss-120b",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-120b:batch",
      "name": "OpenAI: gpt-oss-120b (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 117964,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-20b",
      "name": "OpenAI: gpt-oss-20b",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-20b:batch",
      "name": "OpenAI: gpt-oss-20b (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 117964,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-safeguard-20b",
      "name": "OpenAI: gpt-oss-safeguard-20b",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o1",
      "name": "OpenAI: o1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o3",
      "name": "OpenAI: o3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o3-mini",
      "name": "OpenAI: o3 Mini",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o3-mini-high",
      "name": "OpenAI: o3 Mini High",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "high"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o3-mini:batch",
      "name": "OpenAI: o3 Mini (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o3-pro",
      "name": "OpenAI: o3 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o3:batch",
      "name": "OpenAI: o3 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o4-mini",
      "name": "OpenAI: o4 Mini",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o4-mini-high",
      "name": "OpenAI: o4 Mini High",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "high"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o4-mini:batch",
      "name": "OpenAI: o4 Mini (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openrouter/auto",
      "name": "Auto Router",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 2000000,
      "maxTokens": 4096,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openrouter/auto-beta",
      "name": "Auto Router (Beta)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 2000000,
      "maxTokens": 4096,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openrouter/free",
      "name": "Free Models Router",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 4096,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openrouter/fusion",
      "name": "OpenRouter: Fusion",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 30000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openrouter/pareto-code",
      "name": "Pareto Code Router",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 2000000,
      "maxTokens": 4096,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "perceptron/perceptron-mk1.5",
      "name": "Perceptron: Perceptron Mk1.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 36864,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "poolside/laguna-s-2.1",
      "name": "Poolside: Laguna S 2.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "poolside/laguna-s-2.1:free",
      "name": "Poolside: Laguna S 2.1 (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "poolside/laguna-xs-2.1",
      "name": "Poolside: Laguna XS 2.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "poolside/laguna-xs-2.1:free",
      "name": "Poolside: Laguna XS 2.1 (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "prism-ml/ternary-bonsai-2-27b",
      "name": "PrismML: Ternary Bonsai 2 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "qwen/qwen-2.5-72b-instruct",
      "name": "Qwen2.5 72B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen-2.5-7b-instruct",
      "name": "Qwen: Qwen2.5 7B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32768,
      "maxTokens": 29491,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen-plus",
      "name": "Qwen: Qwen-Plus",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3-14b",
      "name": "Qwen: Qwen3 14B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 40960,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3-235b-a22b-2507",
      "name": "Qwen: Qwen3 235B A22B Instruct 2507",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3-235b-a22b-thinking-2507",
      "name": "Qwen: Qwen3 235B A22B Thinking 2507",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3-30b-a3b",
      "name": "Qwen: Qwen3 30B A3B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 40960,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3-30b-a3b-instruct-2507",
      "name": "Qwen: Qwen3 30B A3B Instruct 2507",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3-32b",
      "name": "Qwen: Qwen3 32B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 40960,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3-coder",
      "name": "Qwen: Qwen3 Coder 480B A35B",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3-coder-30b-a3b-instruct",
      "name": "Qwen: Qwen3 Coder 30B A3B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3-coder-flash",
      "name": "Qwen: Qwen3 Coder Flash",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3-coder-next",
      "name": "Qwen: Qwen3 Coder Next",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3-next-80b-a3b-instruct",
      "name": "Qwen: Qwen3 Next 80B A3B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3-next-80b-a3b-thinking",
      "name": "Qwen: Qwen3 Next 80B A3B Thinking",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3-vl-235b-a22b-instruct",
      "name": "Qwen: Qwen3 VL 235B A22B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3-vl-30b-a3b-instruct",
      "name": "Qwen: Qwen3 VL 30B A3B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3-vl-30b-a3b-thinking",
      "name": "Qwen: Qwen3 VL 30B A3B Thinking",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3-vl-8b-instruct",
      "name": "Qwen: Qwen3 VL 8B Instruct",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "qwen/qwen3.5-122b-a10b",
      "name": "Qwen: Qwen3.5-122B-A10B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.5-27b",
      "name": "Qwen: Qwen3.5-27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.5-35b-a3b",
      "name": "Qwen: Qwen3.5-35B-A3B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 81920,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.5-397b-a17b",
      "name": "Qwen: Qwen3.5 397B A17B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.5-9b",
      "name": "Qwen: Qwen3.5-9B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.5-flash-02-23",
      "name": "Qwen: Qwen3.5-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.5-plus-02-15",
      "name": "Qwen: Qwen3.5 Plus 2026-02-15",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.5-plus-20260420",
      "name": "Qwen: Qwen3.5 Plus 2026-04-20",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.6-27b",
      "name": "Qwen: Qwen3.6 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.6-35b-a3b",
      "name": "Qwen: Qwen3.6 35B A3B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.6-flash",
      "name": "Qwen: Qwen3.6 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.6-plus",
      "name": "Qwen: Qwen3.6 Plus",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.7-flash",
      "name": "Qwen: Qwen3.7 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.7-max",
      "name": "Qwen: Qwen3.7 Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.7-plus",
      "name": "Qwen: Qwen3.7 Plus",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.7-plus:batch",
      "name": "Qwen: Qwen3.7 Plus (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.8-2.4t-a95b",
      "name": "Qwen: Qwen3.8 2.4T A95B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1010000,
      "maxTokens": 909000,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "qwen/qwen3.8-27b",
      "name": "Qwen: Qwen3.8 27B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "qwen/qwen3.8-flash",
      "name": "Qwen: Qwen3.8 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen/qwen3.8-max-0902",
      "name": "Qwen: Qwen3.8 Max (0902)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "qwen/qwen3.8-max-prime",
      "name": "Qwen: Qwen3.8 Max Prime",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "qwen/qwen3.8-omni-flash",
      "name": "Qwen: Qwen3.8 Omni Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "recursive/flint-v1.0:free",
      "name": "Recursive: Flint (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "reflection/beam-1.0-501b-a23b",
      "name": "Reflection: Beam 1.0 501B A23B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "rekaai/reka-edge",
      "name": "Reka Edge",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 16384,
      "maxTokens": 14745,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "relace/relace-search",
      "name": "Relace: Relace Search",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 128000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "sakana/fugu-max",
      "name": "Sakana: Fugu Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "sakana/fugu-ultra",
      "name": "Sakana: Fugu Ultra",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "sakana/fugu-ultra-v2",
      "name": "Sakana: Fugu Ultra v2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "sakana/sakana-namazu",
      "name": "Sakana: Sakana Namazu",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "stepfun/step-3.5-flash",
      "name": "StepFun: Step 3.5 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "stepfun/step-3.7-flash",
      "name": "StepFun: Step 3.7 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 230400,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "stepfun/step-5-preview",
      "name": "StepFun: Step 5 Preview",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "tencent/hy3",
      "name": "Tencent: Hy3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "tencent/hy3-preview",
      "name": "Tencent: Hy3 preview",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "low",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "tencent/hy4-preview",
      "name": "Tencent: Hy4 preview",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 64000,
      "levels": [
        "off",
        "low",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "thinkingmachines/inkling",
      "name": "Thinking Machines: Inkling",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 524288,
      "maxTokens": 471859,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "thinkingmachines/inkling-small",
      "name": "Thinking Machines: Inkling Small",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 524288,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "thinkingmachines/inkling-small:free",
      "name": "Thinking Machines: Inkling Small (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "thinkingmachines/inkling:free",
      "name": "Thinking Machines: Inkling (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "typesafe/jev-router",
      "name": "TypeSafe: Jev Router",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "unbiased/pareto-26.10",
      "name": "Pareto 26.10",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "unbiased/pareto-26.9",
      "name": "Pareto 26.9",
      "reasoning": false,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "upstage/solar-mini4",
      "name": "Upstage: Solar Mini 4",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 524288,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "upstage/solar-pro-3",
      "name": "Upstage: Solar Pro 3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 117964,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "upstage/solar-pro4",
      "name": "Upstage: Solar Pro 4",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 524288,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "x-ai/grok-4.20",
      "name": "SpaceXAI: Grok 4.20",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 2000000,
      "maxTokens": 1800000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "x-ai/grok-4.3",
      "name": "SpaceXAI: Grok 4.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 900000,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "x-ai/grok-4.3:batch",
      "name": "SpaceXAI: Grok 4.3 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 900000,
      "levels": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "x-ai/grok-4.5",
      "name": "SpaceXAI: Grok 4.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 450000,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "x-ai/grok-4.6",
      "name": "SpaceXAI: Grok 4.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 450000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "x-ai/grok-4.7",
      "name": "SpaceXAI: Grok 4.7",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 450000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "x-ai/grok-build-0.1",
      "name": "SpaceXAI: Grok Build 0.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 230400,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xiaomi/mimo-v2.5",
      "name": "Xiaomi: MiMo-V2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 945000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xiaomi/mimo-v2.5-pro",
      "name": "Xiaomi: MiMo-V2.5-Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 945000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xiaomi/mimo-v2.6-flash",
      "name": "Xiaomi: MiMo-V2.6-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xiaomi/mimo-v2.6-pro",
      "name": "Xiaomi: MiMo-V2.6-Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xiaomi/mimo-v2.6-pro-ultraspeed",
      "name": "Xiaomi: MiMo-V2.6-Pro-UltraSpeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xingchen-agi/xing4.0-29b-a4b:free",
      "name": "XingChen: Xing4.0 29B A4B (free)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 235929,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-4.5",
      "name": "Z.ai: GLM 4.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 98304,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-4.5-air",
      "name": "Z.ai: GLM 4.5 Air",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 98304,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-4.5v",
      "name": "Z.ai: GLM 4.5V",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 65536,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-4.6",
      "name": "Z.ai: GLM 4.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-4.6v",
      "name": "Z.ai: GLM 4.6V",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-4.7",
      "name": "Z.ai: GLM 4.7",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-4.7-flash",
      "name": "Z.ai: GLM 4.7 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 117964,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-5",
      "name": "Z.ai: GLM 5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-5-turbo",
      "name": "Z.ai: GLM 5 Turbo",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-5.1",
      "name": "Z.ai: GLM 5.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "z-ai/glm-5.2",
      "name": "Z.ai: GLM 5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "off",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "z-ai/glm-5.3",
      "name": "Z.ai: GLM 5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 943718,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "z-ai/glm-5.3-flash",
      "name": "Z.ai: GLM 5.3 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048575,
      "maxTokens": 943717,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "z-ai/glm-5.3-flash:batch",
      "name": "Z.ai: GLM 5.3 Flash (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "z-ai/glm-5.3-flashx",
      "name": "Z.ai: GLM 5.3 FlashX",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "z-ai/glm-5.3-prime",
      "name": "Z.ai: GLM 5.3 Prime",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "z-ai/glm-5.3:batch",
      "name": "Z.ai: GLM 5.3 (batch)",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "z-ai/glm-5v-turbo",
      "name": "Z.ai: GLM 5V Turbo",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "qwen-token-plan": [
    {
      "id": "deepseek-v3.2",
      "name": "DeepSeek V3.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-v4-flash",
      "name": "DeepSeek V4 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-flash-0731",
      "name": "DeepSeek V4 Flash 0731",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-pro",
      "name": "DeepSeek V4 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-pro-0813",
      "name": "DeepSeek V4 Pro 0813",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4.1-flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4.1-flash-1017",
      "name": "DeepSeek V4.1 Flash 1017",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5",
      "name": "GLM-5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 16384,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.1",
      "name": "GLM-5.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 128000,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.2",
      "name": "GLM-5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "kimi-k2.5",
      "name": "Kimi K2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 98304,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.6",
      "name": "Kimi K2.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.7-code",
      "name": "Kimi K2.7 Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMax-M2.5",
      "name": "MiniMax-M2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 196608,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.6-flash",
      "name": "Qwen3.6 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.6-plus",
      "name": "Qwen3.6 Plus",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.7-max",
      "name": "Qwen3.7 Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.7-plus",
      "name": "Qwen3.7 Plus",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.8-flash",
      "name": "Qwen3.8 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "qwen3.8-max",
      "name": "Qwen3.8 Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    }
  ],
  "qwen-token-plan-cn": [
    {
      "id": "deepseek-v3.2",
      "name": "DeepSeek V3.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-v4-flash",
      "name": "DeepSeek V4 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-flash-0731",
      "name": "DeepSeek V4 Flash 0731",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-pro",
      "name": "DeepSeek V4 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-pro-0813",
      "name": "DeepSeek V4 Pro 0813",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4.1-flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4.1-flash-1017",
      "name": "DeepSeek V4.1 Flash 1017",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5",
      "name": "GLM-5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 16384,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.1",
      "name": "GLM-5.1",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 202752,
      "maxTokens": 128000,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.2",
      "name": "GLM-5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "kimi-k2.5",
      "name": "Kimi K2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 98304,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.6",
      "name": "Kimi K2.6",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "kimi-k2.7-code",
      "name": "Kimi K2.7 Code",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMax-M2.5",
      "name": "MiniMax-M2.5",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 196608,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.6-flash",
      "name": "Qwen3.6 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.6-plus",
      "name": "Qwen3.6 Plus",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.7-max",
      "name": "Qwen3.7 Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.7-plus",
      "name": "Qwen3.7 Plus",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.8-flash",
      "name": "Qwen3.8 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "qwen3.8-max",
      "name": "Qwen3.8 Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    }
  ],
  "qwen-token-plan-individual": [
    {
      "id": "deepseek-v4-flash-0731",
      "name": "DeepSeek V4 Flash 0731",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-pro",
      "name": "DeepSeek V4 Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4-pro-0813",
      "name": "DeepSeek V4 Pro 0813",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.2",
      "name": "GLM-5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "high",
        "max"
      ],
      "clamps": {
        "off": "high",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "qwen3.6-flash",
      "name": "Qwen3.6 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.7-max",
      "name": "Qwen3.7 Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.7-plus",
      "name": "Qwen3.7 Plus",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "qwen3.8-flash",
      "name": "Qwen3.8 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "qwen3.8-max",
      "name": "Qwen3.8 Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "xhigh",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    }
  ],
  "radius": [
    {
      "id": "balanced",
      "name": "Balanced",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "cheap",
      "name": "Cheap",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 32768,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "claude-fable-5",
      "name": "Claude Fable 5",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-fable-5-1",
      "name": "Claude Fable 5.1",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-haiku-4-5",
      "name": "Claude Haiku 4.5",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-haiku-5-5",
      "name": "Claude Haiku 5.5",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-4-5",
      "name": "Claude Opus 4.5",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-opus-4-8",
      "name": "Claude Opus 4.8",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-5",
      "name": "Claude Opus 5",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-opus-5-5",
      "name": "Claude Opus 5.5",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-4-5",
      "name": "Claude Sonnet 4.5",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "claude-sonnet-5",
      "name": "Claude Sonnet 5",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "claude-sonnet-5-5",
      "name": "Claude Sonnet 5.5",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "deepseek-v4.1-flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 32768,
      "levels": [
        "off",
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3-flash",
      "name": "GLM-5.3 Flash",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.3-codex",
      "name": "GPT 5.3 Codex",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4",
      "name": "GPT 5.4",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.4-mini",
      "name": "GPT 5.4 Mini",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.5",
      "name": "GPT 5.5",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "gpt-5.6-luna",
      "name": "GPT 5.6 Luna",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-sol",
      "name": "GPT 5.6 Sol",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-5.6-terra",
      "name": "GPT 5.6 Terra",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-astra",
      "name": "GPT 6 Astra",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-luna",
      "name": "GPT 6 Luna",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6-sol",
      "name": "GPT 6 Sol",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "gpt-6.1-sol",
      "name": "GPT 6.1 Sol",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "grok-4.7",
      "name": "Grok 4.7",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "kimi-k3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "minimax-m3.1-flash",
      "name": "MiniMax M3.1 Flash",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 524288,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "precise",
      "name": "Precise",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 272000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "recursive/flint",
      "name": "Flint (free, trains on data)",
      "reasoning": true,
      "api": "pi-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "low"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "low",
        "high": "low",
        "xhigh": "low",
        "max": "low"
      }
    }
  ],
  "together": [
    {
      "id": "deepseek-ai/DeepSeek-V4-Pro-0813",
      "name": "DeepSeek V4 Pro 0813",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 384000,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek-ai/DeepSeek-V4.1-Flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 384000,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta-models/Muse-Spark-Open-816B-A42B",
      "name": "Muse Spark Open",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "MiniMaxAI/MiniMax-M3",
      "name": "MiniMax-M3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 524288,
      "maxTokens": 524288,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/Kimi-K3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/NVIDIA-Nemotron-3.5-Super-VL",
      "name": "Nemotron 3.5 Super VL 120B A12B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-120b",
      "name": "GPT OSS 120B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3.5-9B",
      "name": "Qwen3.5 9B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 65536,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3.6-Plus",
      "name": "Qwen3.6 Plus",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "Qwen/Qwen3.7-Max",
      "name": "Qwen3.7 Max",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "reflection/Beam-1.0-501B-A23B",
      "name": "Beam 1.0 501B A23B",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "thinkingmachines/Inkling",
      "name": "Inkling",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 524288,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-5.2",
      "name": "GLM-5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048575,
      "maxTokens": 164000,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-5.3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1048575,
      "maxTokens": 262144,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai-org/GLM-5.3-Flash",
      "name": "GLM-5.3-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048575,
      "maxTokens": 400000,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "typesafe": [],
  "vercel-ai-gateway": [
    {
      "id": "alibaba/qwen-3-14b",
      "name": "Qwen3-14B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 40960,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen-3-235b",
      "name": "Qwen3 235B A22B",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "alibaba/qwen-3-30b",
      "name": "Qwen3-30B-A3B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 40960,
      "maxTokens": 16384,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen-3-32b",
      "name": "Qwen 3 32B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3-coder",
      "name": "Qwen3 Coder 480B A35B Instruct",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "alibaba/qwen3-coder-30b-a3b",
      "name": "Qwen 3 Coder 30B A3B Instruct",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "alibaba/qwen3-coder-next",
      "name": "Qwen3 Coder Next",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "alibaba/qwen3-max-thinking",
      "name": "Qwen 3 Max Thinking",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3-next-80b-a3b-instruct",
      "name": "Qwen3 Next 80B A3B Instruct",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 262114,
      "maxTokens": 262114,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "alibaba/qwen3-next-80b-a3b-thinking",
      "name": "Qwen3 Next 80B A3B Thinking",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3-vl-instruct",
      "name": "Qwen3 VL 235B A22B Instruct",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "alibaba/qwen3.5-flash",
      "name": "Qwen 3.5 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.5-plus",
      "name": "Qwen 3.5 Plus",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.6-27b",
      "name": "Qwen 3.6 27B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.6-plus",
      "name": "Qwen 3.6 Plus",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.7-flash",
      "name": "Qwen 3.7 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 991000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.7-max",
      "name": "Qwen 3.7 Max",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 991000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.7-plus",
      "name": "Qwen 3.7 Plus",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.8-2.4t-a95b",
      "name": "Qwen3.8 2.4T A95B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.8-27b",
      "name": "Qwen3.8 27B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.8-flash",
      "name": "Qwen 3.8 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 991000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.8-max",
      "name": "Qwen 3.8 Max",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.8-max-0902",
      "name": "Qwen3.8 Max 0902",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 991000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.8-max-prime",
      "name": "Qwen 3.8 Max Prime",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "alibaba/qwen3.8-omni-flash",
      "name": "Qwen 3.8 Omni Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "amazon/nova-2-lite",
      "name": "Nova 2 Lite",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 1000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "amazon/nova-lite",
      "name": "Nova Lite",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "amazon/nova-micro",
      "name": "Nova Micro",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "amazon/nova-pro",
      "name": "Nova Pro",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 300000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "anthropic/claude-fable-5",
      "name": "Claude Fable 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-fable-5-batch",
      "name": "Claude Fable 5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-fable-5.1",
      "name": "Claude Fable 5.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-fable-5.1-batch",
      "name": "Claude Fable 5.1 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "minimal",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-haiku-4.5",
      "name": "Claude Haiku 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-haiku-4.5-batch",
      "name": "Claude Haiku 4.5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-haiku-5.5",
      "name": "Claude Haiku 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-haiku-5.5-batch",
      "name": "Claude Haiku 5.5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.5",
      "name": "Claude Opus 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-opus-4.5-batch",
      "name": "Claude Opus 4.5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-opus-4.6",
      "name": "Claude Opus 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.6-batch",
      "name": "Claude Opus 4.6 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.7",
      "name": "Claude Opus 4.7",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.7-batch",
      "name": "Claude Opus 4.7 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.8",
      "name": "Claude Opus 4.8",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.8-batch",
      "name": "Claude Opus 4.8 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-4.8-fast",
      "name": "Claude Opus 4.8 (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-5",
      "name": "Claude Opus 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-5-batch",
      "name": "Claude Opus 5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-5-fast",
      "name": "Claude Opus 5 (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-5.5",
      "name": "Claude Opus 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-5.5-batch",
      "name": "Claude Opus 5.5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-opus-5.5-fast",
      "name": "Claude Opus 5.5 (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-4.5",
      "name": "Claude Sonnet 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-sonnet-4.5-batch",
      "name": "Claude Sonnet 4.5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "anthropic/claude-sonnet-4.6",
      "name": "Claude Sonnet 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-4.6-batch",
      "name": "Claude Sonnet 4.6 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-5",
      "name": "Claude Sonnet 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-5-batch",
      "name": "Claude Sonnet 5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-5.5",
      "name": "Claude Sonnet 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "anthropic/claude-sonnet-5.5-batch",
      "name": "Claude Sonnet 5.5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      }
    },
    {
      "id": "arcee-ai/trinity-large-thinking",
      "name": "Trinity Large Thinking",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 262100,
      "maxTokens": 80000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "bytedance/seed-1.6",
      "name": "Seed 1.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "bytedance/seed-1.8",
      "name": "Bytedance Seed 1.8",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "bytedance/seed-2.1-turbo",
      "name": "Seed 2.1 Turbo",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "callstack/apex",
      "name": "Apex",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "cohere/command-a",
      "name": "Command A",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 256000,
      "maxTokens": 8000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "deepseek/deepseek-r1",
      "name": "DeepSeek-R1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v3.1",
      "name": "DeepSeek V3.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 163840,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v3.2",
      "name": "DeepSeek V3.2",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "deepseek/deepseek-v3.2-thinking",
      "name": "DeepSeek V3.2 Thinking",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "deepseek/deepseek-v4-flash",
      "name": "DeepSeek V4 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v4-flash-0731",
      "name": "DeepSeek V4 Flash 0731",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v4-flash-vision-exp",
      "name": "DeepSeek V4 Flash Vision Exp",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v4-pro",
      "name": "DeepSeek V4 Pro",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v4-pro-0813",
      "name": "DeepSeek V4 Pro 0813",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 384000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v4.1-flash",
      "name": "DeepSeek V4.1 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v4.1-flash-1017",
      "name": "DeepSeek V4.1 Flash 1017",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v4.1-flash-1017-fast",
      "name": "DeepSeek V4.1 Flash 1017 Fast",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "deepseek/deepseek-v4.1-flash-fast",
      "name": "DeepSeek V4.1 Flash Fast",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "fireworks/ember-1",
      "name": "Ember-1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-2.5-flash",
      "name": "Gemini 2.5 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-2.5-flash-batch",
      "name": "Gemini 2.5 Flash (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-2.5-flash-lite",
      "name": "Gemini 2.5 Flash Lite",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-2.5-flash-lite-batch",
      "name": "Gemini 2.5 Flash Lite (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-2.5-pro",
      "name": "Gemini 2.5 Pro",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-2.5-pro-batch",
      "name": "Gemini 2.5 Pro (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3-flash",
      "name": "Gemini 3 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3-flash-batch",
      "name": "Gemini 3 Flash (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.1-flash-lite",
      "name": "Gemini 3.1 Flash Lite",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.1-flash-lite-batch",
      "name": "Gemini 3.1 Flash Lite (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.1-pro-preview",
      "name": "Gemini 3.1 Pro Preview",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.1-pro-preview-batch",
      "name": "Gemini 3.1 Pro Preview (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.5-flash",
      "name": "Gemini 3.5 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.5-flash-batch",
      "name": "Gemini 3.5 Flash (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.5-flash-lite",
      "name": "Gemini 3.5 Flash Lite",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.5-flash-lite-batch",
      "name": "Gemini 3.5 Flash Lite (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.6-flash",
      "name": "Gemini 3.6 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.6-flash-batch",
      "name": "Gemini 3.6 Flash (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.7-flash",
      "name": "Gemini 3.7 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.7-flash-batch",
      "name": "Gemini 3.7 Flash (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-3.8-flash",
      "name": "Gemini 3.8 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65535,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemini-4-argon",
      "name": "Gemini 4 Argon",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 1000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemma-4-26b-a4b-it",
      "name": "Google Gemma 4 26B A4B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "google/gemma-4-31b-it",
      "name": "Gemma 4 31B IT",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inception/mercury-2",
      "name": "Mercury 2",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 128000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inception/mercury-2.5",
      "name": "Mercury 2.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 260000,
      "maxTokens": 65536,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inception/mercury-3",
      "name": "Mercury 3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inception/mercury-coder-small",
      "name": "Mercury Coder Small Beta",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 32000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "inclusionai/ling-3.0-flash",
      "name": "Ling 3.0 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inclusionai/ling-3.0-flash-fin",
      "name": "Ling 3.0 Flash Fin",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inclusionai/ling-3.0-flash-sante",
      "name": "Ling 3.0 Flash Sante",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inclusionai/ling-3.0-flash-vl",
      "name": "Ling 3.0 Flash VL",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "inclusionai/ling-3.1-flash",
      "name": "Ling 3.1 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "interfaze/interfaze-beta",
      "name": "Interfaze Beta",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "liquid/lfm2.5-24b-a2b",
      "name": "LFM2.5-24B-A2B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 128000,
      "maxTokens": 8200,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meituan/longcat-2.5-preview",
      "name": "LongCat 2.5 Preview",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta/llama-3.1-70b",
      "name": "Llama 3.1 70B Instruct",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta/llama-3.1-8b",
      "name": "Llama 3.1 8B Instruct",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta/llama-3.3-70b",
      "name": "Llama 3.3 70B Instruct",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta/llama-4-maverick",
      "name": "Llama 4 Maverick 17B Instruct",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta/llama-4-scout",
      "name": "Llama 4 Scout 17B Instruct",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 8192,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "meta/muse-glimmer-30b",
      "name": "Muse Glimmer 30B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta/muse-spark-1.1",
      "name": "Muse Spark 1.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta/muse-spark-1.2",
      "name": "Muse Spark 1.2",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta/muse-spark-1.2-contributor",
      "name": "Muse Spark 1.2 Contributor",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta/muse-spark-1.3",
      "name": "Muse Spark 1.3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta/muse-spark-1.3-contributor",
      "name": "Muse Spark 1.3 Contributor",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta/muse-spark-open",
      "name": "Muse Spark Open",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "meta/muse-wonder-1.0",
      "name": "Muse Wonder",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2",
      "name": "MiniMax M2",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 205000,
      "maxTokens": 205000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2.1",
      "name": "MiniMax M2.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2.1-lightning",
      "name": "MiniMax M2.1 Lightning",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2.5",
      "name": "MiniMax M2.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 204800,
      "maxTokens": 131000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2.5-highspeed",
      "name": "MiniMax M2.5 High Speed",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 204800,
      "maxTokens": 131000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2.7",
      "name": "MiniMax M2.7",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 204800,
      "maxTokens": 131000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m2.7-highspeed",
      "name": "MiniMax M2.7 High Speed",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 204800,
      "maxTokens": 131100,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m3",
      "name": "MiniMax M3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 512000,
      "maxTokens": 512000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "minimax/minimax-m3.1-flash",
      "name": "MiniMax-M3.1-Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral/codestral",
      "name": "Mistral Codestral",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 4000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral/ministral-14b",
      "name": "Ministral 14B",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral/ministral-3b",
      "name": "Ministral 3B",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 4000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral/ministral-8b",
      "name": "Ministral 8B",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 4000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral/mistral-large-3",
      "name": "Mistral Large 3",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral/mistral-large-4",
      "name": "Mistral Large 4",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 524288,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral/mistral-medium-3.5",
      "name": "Mistral Medium Latest",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mistral/mistral-nemo",
      "name": "Mistral Nemo 12B",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mistral/mistral-small",
      "name": "Mistral Small",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 262144,
      "maxTokens": 4000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "mixedbread/toast-1",
      "name": "Toast 1",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131000,
      "maxTokens": 4000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "moonshotai/kimi-k2",
      "name": "Kimi K2 Instruct",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "moonshotai/kimi-k2.5",
      "name": "Kimi K2.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k2.6",
      "name": "Kimi K2.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262000,
      "maxTokens": 262000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k2.7-code",
      "name": "Kimi K2.7 Code",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k2.7-code-highspeed",
      "name": "Kimi K2.7 Code High Speed",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k3",
      "name": "Kimi K3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k3-fast",
      "name": "Kimi K3 Fast",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k3.1-pro",
      "name": "Kimi K3.1 Pro",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "moonshotai/kimi-k3.1-pro-highspeed",
      "name": "Kimi K3.1 Pro Highspeed",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3-nano-30b-a3b",
      "name": "Nemotron 3 Nano 30B A3B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3-super-120b-a12b",
      "name": "NVIDIA Nemotron 3 Super 120B A12B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 32000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3-ultra-550b-a55b",
      "name": "Nemotron 3 Ultra",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3.5-lightning",
      "name": "Nemotron 3.5 Lightning 30B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3.5-lightning-free",
      "name": "Nemotron 3.5 Lightning Free",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 65000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-3.5-super-vl",
      "name": "NVIDIA Nemotron 3.5 Super VL",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-nano-12b-v2-vl",
      "name": "Nvidia Nemotron Nano 12B V2 VL",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "nvidia/nemotron-nano-9b-v2",
      "name": "Nvidia Nemotron Nano 9B V2",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-4.1",
      "name": "GPT-4.1",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1-batch",
      "name": "GPT-4.1 (Batch)",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1-fast",
      "name": "GPT-4.1 (Fast)",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1-mini",
      "name": "GPT-4.1 mini",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1-mini-batch",
      "name": "GPT-4.1 mini (Batch)",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1-mini-fast",
      "name": "GPT-4.1 mini (Fast)",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4.1-nano",
      "name": "GPT-4.1 nano",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1047576,
      "maxTokens": 32768,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-batch",
      "name": "GPT-4o (Batch)",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-fast",
      "name": "GPT-4o (Fast)",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-mini",
      "name": "GPT-4o mini",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-mini-batch",
      "name": "GPT-4o mini (Batch)",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-4o-mini-fast",
      "name": "GPT-4o mini (Fast)",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 16384,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "openai/gpt-5",
      "name": "GPT-5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-batch",
      "name": "GPT-5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-codex",
      "name": "GPT-5-Codex",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-fast",
      "name": "GPT-5 (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-mini",
      "name": "GPT-5 mini",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-mini-batch",
      "name": "GPT-5 mini (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-mini-fast",
      "name": "GPT-5 mini (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-nano",
      "name": "GPT-5 nano",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-nano-batch",
      "name": "GPT-5 nano (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-pro",
      "name": "GPT-5 pro",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 272000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5-pro-batch",
      "name": "GPT-5 pro (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 272000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.1-codex",
      "name": "GPT-5.1-Codex",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.1-codex-max",
      "name": "GPT 5.1 Codex Max",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.1-codex-mini",
      "name": "GPT 5.1 Codex Mini",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.1-thinking",
      "name": "GPT 5.1 Thinking",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.1-thinking-fast",
      "name": "GPT 5.1 Thinking (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-5.2",
      "name": "GPT 5.2",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.2-batch",
      "name": "GPT 5.2 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.2-codex",
      "name": "GPT 5.2 Codex",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.2-fast",
      "name": "GPT 5.2 (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.2-pro",
      "name": "GPT 5.2 ",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.3-codex",
      "name": "GPT 5.3 Codex",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.3-codex-fast",
      "name": "GPT 5.3 Codex (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4",
      "name": "GPT 5.4",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-batch",
      "name": "GPT 5.4 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-fast",
      "name": "GPT 5.4 (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-mini",
      "name": "GPT 5.4 Mini",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-mini-batch",
      "name": "GPT 5.4 Mini (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-mini-fast",
      "name": "GPT 5.4 Mini (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-nano",
      "name": "GPT 5.4 Nano",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-nano-batch",
      "name": "GPT 5.4 Nano (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 400000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.4-pro",
      "name": "GPT 5.4 Pro",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.5",
      "name": "GPT 5.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.5-batch",
      "name": "GPT 5.5 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.5-fast",
      "name": "GPT 5.5 (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.5-pro",
      "name": "GPT 5.5 Pro",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "medium",
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.5-pro-batch",
      "name": "GPT 5.5 Pro (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.6-luna",
      "name": "GPT 5.6 Luna",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.6-luna-batch",
      "name": "GPT 5.6 Luna (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.6-luna-fast",
      "name": "GPT 5.6 Luna (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.6-sol",
      "name": "GPT 5.6 Sol",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.6-sol-batch",
      "name": "GPT 5.6 Sol (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.6-sol-fast",
      "name": "GPT 5.6 Sol (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.6-terra",
      "name": "GPT 5.6 Terra",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.6-terra-batch",
      "name": "GPT 5.6 Terra (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-5.6-terra-fast",
      "name": "GPT 5.6 Terra (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6-astra",
      "name": "GPT-6 Astra",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6-astra-batch",
      "name": "GPT-6 Astra (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6-astra-fast",
      "name": "GPT-6 Astra (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6-luna",
      "name": "GPT-6 Luna",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6-luna-batch",
      "name": "GPT-6 Luna (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6-luna-fast",
      "name": "GPT-6 Luna (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6-sol",
      "name": "GPT-6 Sol",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6-sol-batch",
      "name": "GPT-6 Sol (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6-sol-fast",
      "name": "GPT-6 Sol (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6.1-sol",
      "name": "GPT-6.1 Sol",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6.1-sol-batch",
      "name": "GPT-6.1 Sol (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-6.1-sol-fast",
      "name": "GPT-6.1 Sol (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "openai/gpt-oss-120b",
      "name": "GPT OSS 120B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-20b",
      "name": "GPT OSS 20B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 131072,
      "maxTokens": 8192,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-safeguard-120b",
      "name": "GPT OSS Safeguard 120B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 128000,
      "maxTokens": 16000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/gpt-oss-safeguard-20b",
      "name": "GPT OSS Safeguard 20B",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 128000,
      "maxTokens": 16000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o1",
      "name": "o1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o3",
      "name": "o3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o3-fast",
      "name": "o3 (Fast)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o3-mini",
      "name": "o3-mini",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o3-pro",
      "name": "o3 Pro",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "openai/o4-mini",
      "name": "o4-mini",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 100000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "poolside/laguna-s-2.1",
      "name": "Laguna S 2.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "poolside/laguna-s-2.1-free",
      "name": "Laguna S 2.1 Free",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "quiverai/arrow-2",
      "name": "Arrow 2",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "quiverai/arrow-2-telos",
      "name": "Arrow 2 Telos",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 131072,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "reflection/beam",
      "name": "Beam 1.0",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "reflection/beam-free",
      "name": "Beam 1.0 (Free)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "sakana/fugu-max",
      "name": "Fugu Max",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 1000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "sakana/fugu-ultra",
      "name": "Fugu Ultra",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 1000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "sakana/fugu-ultra-v2",
      "name": "Fugu Ultra v2",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 1000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "sakana/namazu",
      "name": "Sakana Namazu",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.20-multi-agent",
      "name": "Grok 4.20 Multi-Agent",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 2000000,
      "maxTokens": 2000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.20-multi-agent-batch",
      "name": "Grok 4.20 Multi-Agent (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 2000000,
      "maxTokens": 2000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.20-multi-agent-beta",
      "name": "Grok 4.20 Multi Agent Beta",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 2000000,
      "maxTokens": 2000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.20-non-reasoning",
      "name": "Grok 4.20 Non-Reasoning",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 2000000,
      "maxTokens": 2000000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "spacexai/grok-4.20-non-reasoning-batch",
      "name": "Grok 4.20 Non-Reasoning (Batch)",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 2000000,
      "maxTokens": 2000000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "spacexai/grok-4.20-non-reasoning-beta",
      "name": "Grok 4.20 Beta Non-Reasoning",
      "reasoning": false,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 2000000,
      "maxTokens": 2000000,
      "levels": [
        "off"
      ],
      "clamps": {
        "off": "off",
        "minimal": "off",
        "low": "off",
        "medium": "off",
        "high": "off",
        "xhigh": "off",
        "max": "off"
      }
    },
    {
      "id": "spacexai/grok-4.20-reasoning",
      "name": "Grok 4.20 Reasoning",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 2000000,
      "maxTokens": 2000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.20-reasoning-batch",
      "name": "Grok 4.20 Reasoning (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 2000000,
      "maxTokens": 2000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.20-reasoning-beta",
      "name": "Grok 4.20 Beta Reasoning",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 2000000,
      "maxTokens": 2000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.3",
      "name": "Grok 4.3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 1000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.3-batch",
      "name": "Grok 4.3 (Batch)",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 1000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.5",
      "name": "Grok 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.6",
      "name": "Grok 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-4.7",
      "name": "Grok 4.7",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-build-0.1",
      "name": "Grok Build 0.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "spacexai/grok-voice-3.0",
      "name": "Grok Voice 3.0",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 4096,
      "maxTokens": 4096,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "stealth/glyph-cluster",
      "name": "Glyph Cluster",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "stepfun/step-3.7-flash",
      "name": "Step 3.7 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "stepfun/step-5-preview",
      "name": "Step 5 Preview",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 1048576,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "tencent/hy3",
      "name": "Hy3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 262144,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "tencent/hy4-preview",
      "name": "Tencent Hy4 Preview",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1024000,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "thinkingmachines/inkling",
      "name": "Inkling",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 256000,
      "maxTokens": 256000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "thinkingmachines/inkling-small",
      "name": "Inkling Small",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 1000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xiaomi/mimo-v2.5",
      "name": "MiMo M2.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 131100,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xiaomi/mimo-v2.5-pro",
      "name": "MiMo V2.5 Pro",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1050000,
      "maxTokens": 131000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xiaomi/mimo-v2.6-flash",
      "name": "MiMo V2.6 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xiaomi/mimo-v2.6-pro",
      "name": "MiMo V2.6 Pro",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "xiaomi/mimo-v2.6-pro-ultraspeed",
      "name": "MiMo V2.6 Pro UltraSpeed",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-4.5",
      "name": "GLM 4.5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 128000,
      "maxTokens": 96000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-4.5-air",
      "name": "GLM 4.5 Air",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 128000,
      "maxTokens": 96000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-4.5v",
      "name": "GLM 4.5V",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 66000,
      "maxTokens": 16000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-4.6",
      "name": "GLM 4.6",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 96000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-4.7",
      "name": "GLM 4.7",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 120000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-4.7-flash",
      "name": "GLM 4.7 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 131000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-4.7-flashx",
      "name": "GLM 4.7 FlashX",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-5",
      "name": "GLM 5",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 202800,
      "maxTokens": 131100,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-5-turbo",
      "name": "GLM 5 Turbo",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 202800,
      "maxTokens": 131100,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-5.1",
      "name": "GLM 5.1",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 202800,
      "maxTokens": 64000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-5.2",
      "name": "GLM 5.2",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-5.2-fast",
      "name": "GLM 5.2 Fast",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-5.3",
      "name": "GLM 5.3",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 1000000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-5.3-fast",
      "name": "GLM 5.3 Fast",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text"
      ],
      "budgetControl": true,
      "contextWindow": 1048576,
      "maxTokens": 262144,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-5.3-flash",
      "name": "GLM 5.3 Flash",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-5.3-flashx",
      "name": "GLM 5.3 FlashX",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "zai/glm-5v-turbo",
      "name": "GLM 5V Turbo",
      "reasoning": true,
      "api": "anthropic-messages",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": true,
      "contextWindow": 200000,
      "maxTokens": 128000,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "xai": [
    {
      "id": "grok-4.3",
      "name": "Grok 4.3",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 30000,
      "levels": [
        "off",
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "off",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "grok-4.5",
      "name": "Grok 4.5",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "grok-4.6",
      "name": "Grok 4.6",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    },
    {
      "id": "grok-4.7",
      "name": "Grok 4.7",
      "reasoning": true,
      "api": "openai-responses",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 500000,
      "maxTokens": 500000,
      "levels": [
        "low",
        "medium",
        "high",
        "xhigh"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh"
      }
    }
  ],
  "xiaomi": [
    {
      "id": "mimo-v2.6-flash",
      "name": "MiMo-V2.6-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mimo-v2.6-pro",
      "name": "MiMo-V2.6-Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mimo-v2.6-pro-ultraspeed",
      "name": "MiMo-V2.6-Pro-UltraSpeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "xiaomi-token-plan-ams": [
    {
      "id": "mimo-v2.6-flash",
      "name": "MiMo-V2.6-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mimo-v2.6-pro",
      "name": "MiMo-V2.6-Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "xiaomi-token-plan-cn": [
    {
      "id": "mimo-v2.6-flash",
      "name": "MiMo-V2.6-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mimo-v2.6-pro",
      "name": "MiMo-V2.6-Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "xiaomi-token-plan-sgp": [
    {
      "id": "mimo-v2.6-flash",
      "name": "MiMo-V2.6-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "mimo-v2.6-pro",
      "name": "MiMo-V2.6-Pro",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1048576,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    }
  ],
  "zai": [
    {
      "id": "glm-4.7",
      "name": "GLM-4.7",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 204800,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "glm-5-turbo",
      "name": "GLM-5-Turbo",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 200000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "glm-5.2",
      "name": "GLM-5.2",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.2-highspeed",
      "name": "GLM-5.2 Highspeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "off",
        "high",
        "max"
      ],
      "clamps": {
        "off": "off",
        "minimal": "high",
        "low": "high",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3-flash",
      "name": "GLM-5.3-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3-highspeed",
      "name": "GLM-5.3 Highspeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    }
  ],
  "zai-coding-cn": [
    {
      "id": "glm-4.6v",
      "name": "GLM-4.6V",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 128000,
      "maxTokens": 32768,
      "levels": [
        "off",
        "minimal",
        "low",
        "medium",
        "high"
      ],
      "clamps": {
        "off": "off",
        "minimal": "minimal",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high"
      }
    },
    {
      "id": "glm-5.3",
      "name": "GLM-5.3",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3-flash",
      "name": "GLM-5.3-Flash",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text",
        "image"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    },
    {
      "id": "glm-5.3-highspeed",
      "name": "GLM-5.3 Highspeed",
      "reasoning": true,
      "api": "openai-completions",
      "input": [
        "text"
      ],
      "budgetControl": false,
      "contextWindow": 1000000,
      "maxTokens": 131072,
      "levels": [
        "low",
        "high",
        "max"
      ],
      "clamps": {
        "off": "low",
        "minimal": "low",
        "low": "low",
        "medium": "high",
        "high": "high",
        "xhigh": "max",
        "max": "max"
      }
    }
  ]
};
