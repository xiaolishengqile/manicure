import type OpenAI from "openai";

/** 贞贞 AI 工坊 OpenAI 兼容根路径（须以 /v1 结尾） */
export const DEFAULT_OPENAI_IMAGE_BASE_URL = "https://ai.t8star.org/v1";

export function getOpenAiImageApiKey(): string | undefined {
  return (
    process.env.T8STAR_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.LLM_GATEWAY_API_KEY?.trim()
  );
}

export function getOpenAiImageBaseUrl(): string {
  const explicit =
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.T8STAR_BASE_URL?.trim() ||
    process.env.LLM_GATEWAY_BASE_URL?.trim();
  return explicit || DEFAULT_OPENAI_IMAGE_BASE_URL;
}

function hostnameFromBaseUrl(baseURL: string): string | null {
  try {
    return new URL(baseURL).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** 逆向分组通常仅透传 model、prompt、size、image、quality */
export function openAiImagesEditUsesMinimalParams(baseURL: string): boolean {
  const host = hostnameFromBaseUrl(baseURL);
  if (!host) return false;
  return host.includes("t8star");
}

type ImagesEditCore = {
  model: string;
  image: OpenAI.Images.ImageEditParams["image"];
  prompt: string;
  size?: OpenAI.Images.ImageEditParams["size"];
  quality?: OpenAI.Images.ImageEditParams["quality"];
};

type ImagesEditJson = {
  data?: unknown;
  url?: string;
  output?: unknown;
  error?: { message?: string };
  message?: string;
};

function firstUrlFromImagesEditJson(json: ImagesEditJson): string | null {
  const data = json.data;
  if (Array.isArray(data) && data.length > 0) {
    const item = data[0];
    if (typeof item === "string") {
      if (item.startsWith("http") || item.startsWith("data:")) return item;
      if (item.length > 64) return `data:image/png;base64,${item}`;
    }
    if (item && typeof item === "object") {
      const row = item as { url?: string; b64_json?: string };
      if (row.url) return row.url;
      if (row.b64_json) return `data:image/png;base64,${row.b64_json}`;
    }
  }
  if (typeof json.url === "string" && json.url.length > 0) return json.url;
  if (typeof json.output === "string") {
    if (json.output.startsWith("http") || json.output.startsWith("data:")) {
      return json.output;
    }
  }
  return null;
}

/**
 * 贞贞等逆向分组：用原生 multipart 只传文档字段，避免 OpenAI SDK 附加字段导致
 * `multipart: NextPart: EOF` 等网关解析失败。
 */
export async function imagesEditViaGatewayMultipart(args: {
  apiKey: string;
  baseURL: string;
  model: string;
  prompt: string;
  images: { buffer: Buffer; mime: string; filename: string }[];
  size?: string;
  quality?: string;
}): Promise<string | null> {
  if (args.images.length === 0) {
    throw new Error("图像编辑请求缺少图片。");
  }
  for (const img of args.images) {
    if (img.buffer.length === 0) {
      throw new Error("上传图片为空，无法调用图像编辑接口。");
    }
  }

  const root = args.baseURL.replace(/\/$/, "");
  const form = new FormData();
  form.append("model", args.model);
  form.append("prompt", args.prompt);
  form.append("size", args.size ?? "1024x1024");
  form.append("quality", args.quality ?? "high");
  for (const img of args.images) {
    form.append(
      "image",
      new Blob([new Uint8Array(img.buffer)], { type: img.mime }),
      img.filename,
    );
  }

  const res = await fetch(`${root}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(280_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 800);
    try {
      const errJson = JSON.parse(text) as ImagesEditJson & {
        message?: string;
      };
      detail =
        errJson.error?.message ?? errJson.message ?? detail;
    } catch {
      /* keep raw */
    }
    throw new Error(`图像编辑接口 ${res.status}: ${detail}`);
  }

  let json: ImagesEditJson;
  try {
    json = JSON.parse(text) as ImagesEditJson;
  } catch {
    throw new Error("图像编辑接口返回不是合法 JSON。");
  }
  return firstUrlFromImagesEditJson(json);
}

export function buildOpenAiImagesEditParams(
  baseURL: string,
  core: ImagesEditCore,
): OpenAI.Images.ImageEditParams {
  const size = core.size ?? "1024x1024";
  const quality = core.quality ?? "high";
  const common = {
    model: core.model,
    image: core.image,
    prompt: core.prompt,
    size,
    quality,
    n: 1 as const,
    stream: false as const,
  };
  if (openAiImagesEditUsesMinimalParams(baseURL)) {
    return common;
  }
  return {
    ...common,
    background: "opaque" as const,
    output_format: "png" as const,
    input_fidelity: "high" as const,
  };
}
