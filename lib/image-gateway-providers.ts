/** 前台可选的 OpenAI 兼容图像中转（Base URL 须以 /v1 结尾） */
export type ImageGatewayProviderId = "t8star" | "llmgateway";

export const LS_GATEWAY_PROVIDER = "manicure_gateway_provider";
export const LS_GATEWAY_API_KEY = "manicure_gateway_api_key";

export const IMAGE_GATEWAY_PROVIDERS: {
  id: ImageGatewayProviderId;
  label: string;
  shortLabel: string;
  baseUrl: string;
  keyHint: string;
}[] = [
  {
    id: "t8star",
    label: "贞贞 AI 工坊",
    shortLabel: "贞贞",
    baseUrl: "https://ai.t8star.org/v1",
    keyHint: "在 https://ai.t8star.org 控制台获取",
  },
  {
    id: "llmgateway",
    label: "LLM Gateway",
    shortLabel: "LLM Gateway",
    baseUrl: "https://www.llmgateway.cn/v1",
    keyHint: "在 https://www.llmgateway.cn 控制台获取",
  },
];

export const DEFAULT_IMAGE_GATEWAY_PROVIDER: ImageGatewayProviderId = "t8star";

export function isImageGatewayProviderId(
  value: string | null | undefined,
): value is ImageGatewayProviderId {
  return value === "t8star" || value === "llmgateway";
}

export function baseUrlForGatewayProvider(
  id: string | null | undefined,
): string {
  const found = IMAGE_GATEWAY_PROVIDERS.find((p) => p.id === id);
  return found?.baseUrl ?? IMAGE_GATEWAY_PROVIDERS[0]!.baseUrl;
}

export function providerMeta(id: ImageGatewayProviderId) {
  return IMAGE_GATEWAY_PROVIDERS.find((p) => p.id === id)!;
}
