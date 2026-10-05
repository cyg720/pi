# 编码代理套件测试

使用 `test/suite/` 作为基于新框架的测试套件，围绕 `AgentSession` 和 `AgentSessionRuntime`。

规则：
- 使用 `test/suite/harness.ts`
- 使用来自 `packages/ai/src/providers/faux.ts` 的伪提供者
- 不要使用真实的提供者 API、真实 API 密钥、网络调用或付费令牌
- 保持这些测试在 CI 环境中安全且确定性
- 除非缺失的功能强制使用，否则不要使用或扩展旧的 `test/test-harness.ts` 路径

