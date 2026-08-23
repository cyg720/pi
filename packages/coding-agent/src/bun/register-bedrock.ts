/**
 * 【文件职责】Bun 构建的 Bedrock 注册：静态导入 Bedrock 模块并注册为覆盖实现
 *              （动态导入无法在单文件二进制中打包）。
 * 【产品维度】让独立 Bun 二进制支持 Bedrock。
 * 【逻辑维度】setBedrockProviderModule 覆盖懒加载实现。
 * 【新手阅读建议】半分钟读完即可。
 */
import { bedrockProviderModule } from "@earendil-works/pi-ai/bedrock-provider";
import { setBedrockProviderModule } from "@earendil-works/pi-ai/compat";

setBedrockProviderModule(bedrockProviderModule);
