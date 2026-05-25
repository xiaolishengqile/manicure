/**
 * 中转站 OpenAI 兼容图像 API 字段（Edits / Generations）。
 * @see Apifox：Nano-banana-2(Pro)(Edits兼容)、Flux（Dall-e 格式 Generations）
 */

/** Nano-banana-2(Pro)(Edits兼容) 在网关上的 model 字段值 */
export const NANO_BANANA_2_IMAGE_MODEL = "nano-banana-2";

/** @deprecated 请使用 NANO_BANANA_2_IMAGE_MODEL */
export const NANO_BANANA_FLASH_IMAGE_MODEL = NANO_BANANA_2_IMAGE_MODEL;

/** 贞贞等中转：Flux 文生图 POST /v1/images/generations */
export const FLUX_IMAGE_MODELS = ["flux", "flux-dev", "flux-pro"] as const;

export type FluxImageModel = (typeof FLUX_IMAGE_MODELS)[number];

/** 文档列出的 size（WxH）；默认 1024x1024 */
export const FLUX_GENERATION_SIZE_OPTIONS = [
  "1024x1024",
  "1024x512",
  "1024x576",
  "1024x768",
  "512x1024",
  "512x768",
  "1280x960",
  "960x1280",
  "768x1366",
  "768x512",
  "1366x768",
  "1344x576",
] as const;

export type FluxGenerationSizeOption =
  (typeof FLUX_GENERATION_SIZE_OPTIONS)[number];

export const DEFAULT_FLUX_GENERATION_SIZE: FluxGenerationSizeOption =
  "1024x1024";

const FLUX_SIZE_SET = new Set<string>(FLUX_GENERATION_SIZE_OPTIONS);

export function imageModelUsesFluxGenerations(model: string): boolean {
  const m = model.trim().toLowerCase();
  return (FLUX_IMAGE_MODELS as readonly string[]).includes(m);
}

export function normalizeFluxGenerationSize(
  raw: string | undefined,
): FluxGenerationSizeOption {
  const t = raw?.trim();
  if (t && FLUX_SIZE_SET.has(t)) {
    return t as FluxGenerationSizeOption;
  }
  return DEFAULT_FLUX_GENERATION_SIZE;
}

export const IMAGE_ASPECT_RATIO_OPTIONS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

export type ImageAspectRatioOption = (typeof IMAGE_ASPECT_RATIO_OPTIONS)[number];

/** 仅 nano-banana-2 支持 image_size */
export const IMAGE_SIZE_K_OPTIONS = ["1K", "2K", "4K"] as const;

export type ImageSizeKOption = (typeof IMAGE_SIZE_K_OPTIONS)[number];

export function imageModelUsesNanoBananaEdits(model: string): boolean {
  const m = model.trim();
  return m === NANO_BANANA_2_IMAGE_MODEL || m === "gemini-3.1-flash-image-preview";
}

/** 前端下拉与 datalist 共用：默认走服务器 OPENAI_IMAGE_MODEL，未设置时回退 gpt-image-2 */
export const IMAGE_MODEL_PRESET_OPTIONS: {
  value: string;
  label: string;
  shortLabel: string;
}[] = [
  {
    value: "",
    label: "默认（OPENAI_IMAGE_MODEL，未设置时为 gpt-image-2）",
    shortLabel: "默认",
  },
  {
    value: NANO_BANANA_2_IMAGE_MODEL,
    label: "Nano-banana-2 Pro（Edits，nano-banana-2）",
    shortLabel: "Nano-banana-2",
  },
  {
    value: "flux",
    label: "Flux（文生图 /v1/images/generations；有参考图时走 Edits 兼容）",
    shortLabel: "Flux",
  },
  {
    value: "flux-dev",
    label: "Flux Dev（generations；有参考图时 Edits 兼容）",
    shortLabel: "Flux-dev",
  },
  {
    value: "flux-pro",
    label: "Flux Pro（generations；有参考图时 Edits 兼容）",
    shortLabel: "Flux-pro",
  },
];

const ASPECT_SET = new Set<string>(IMAGE_ASPECT_RATIO_OPTIONS);
const SIZE_SET = new Set<string>(IMAGE_SIZE_K_OPTIONS);

const MAX_MODEL_LEN = 128;

export type ParsedGatewayEditFields = {
  /** 已解析后的模型 id（非空） */
  model: string;
  aspectRatio?: ImageAspectRatioOption;
  imageSize?: ImageSizeKOption;
  /** Flux：POST /v1/images/generations 的 size（WxH） */
  fluxSize?: FluxGenerationSizeOption;
};

function trimStr(entry: FormDataEntryValue | null): string | undefined {
  if (entry == null) return undefined;
  if (typeof entry !== "string") return undefined;
  const t = entry.trim();
  return t === "" ? undefined : t;
}

/**
 * 从 FormData 读取 `imageModel`、`imageAspectRatio`、`imageSize`、`imageFluxSize`；
 * `imageModel` 空则回退 `defaultModel`（通常为环境变量）。
 */
export function parseGatewayEditFieldsFromForm(
  formData: FormData,
  defaultModel: string,
): ParsedGatewayEditFields {
  const rawModel = trimStr(formData.get("imageModel"));
  let model = defaultModel.trim() || "gpt-image-2";
  if (rawModel) {
    if (rawModel.length > MAX_MODEL_LEN) {
      model = defaultModel.trim() || "gpt-image-2";
    } else {
      model = rawModel;
    }
  }

  const arRaw = trimStr(formData.get("imageAspectRatio"));
  const aspectRatio =
    arRaw && ASPECT_SET.has(arRaw) ? (arRaw as ImageAspectRatioOption) : undefined;

  const szRaw = trimStr(formData.get("imageSize"));
  const imageSize =
    szRaw && SIZE_SET.has(szRaw) ? (szRaw as ImageSizeKOption) : undefined;

  const fluxSize = imageModelUsesFluxGenerations(model)
    ? normalizeFluxGenerationSize(trimStr(formData.get("imageFluxSize")))
    : undefined;

  return { model, aspectRatio, imageSize, fluxSize };
}
