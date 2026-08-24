/**
 * 文件职责：声明并转发已构建的 Amazon Bedrock 提供方公共类型与接口。
 * 技术维度：使用 TypeScript 声明文件和通配符导出，把 dist 目录中的声明暴露给包使用者。
 * 产品维度：让 TypeScript 用户在接入 Bedrock 模型时获得类型检查与编辑器提示。
 * 逻辑维度：本文件不实现业务逻辑，只把构建产物的全部公开成员继续导出。
 * 关键边界：依赖 dist/bedrock-provider.js 对应的声明已生成；路径或导出结构变化时需同步更新。
 * 新手阅读建议：先理解 export * 的“转发导出”含义，再到 dist 对应声明或源文件查看真实 API。
 */
export * from "./dist/bedrock-provider.js";
