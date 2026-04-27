import OpenAI, { toFile } from "openai";
import {
  ACCESSORY_TRYON_PROMPT,
  MODEL_TRYON_PROMPT,
  parseGenerationMode,
  promptsForMode,
  type GenerationMode,
} from "@/lib/generation-modes";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 12 * 1024 * 1024;

function getApiKey(): string | undefined {
  return (
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.LLM_GATEWAY_API_KEY?.trim()
  );
}

function getBaseURL(): string {
  return (
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.LLM_GATEWAY_BASE_URL?.trim() ||
    "https://www.llmgateway.cn/v1"
  );
}

function getImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";
}

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function editOnce(
  openai: OpenAI,
  buffer: Buffer,
  ext: string,
  mime: string,
  prompt: string,
): Promise<string | null> {
  const uploadable = await toFile(buffer, `input.${ext}`, { type: mime });
  const model = getImageModel();
  const res = await openai.images.edit({
    model,
    image: uploadable,
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "high",
    background: "opaque",
    output_format: "png",
    input_fidelity: "high",
    stream: false,
  });
  return firstImageUrl(res);
}

/** 第一张：场景（模特或饰品陈列），第二张：美甲产品 */
async function editDualSceneNails(
  openai: OpenAI,
  sceneBuffer: Buffer,
  sceneMime: string,
  nailsBuffer: Buffer,
  nailsMime: string,
  prompt: string,
): Promise<string | null> {
  const sceneExt = extFromMime(sceneMime);
  const nailsExt = extFromMime(nailsMime);
  const sceneFile = await toFile(sceneBuffer, `scene.${sceneExt}`, {
    type: sceneMime,
  });
  const nailsFile = await toFile(nailsBuffer, `nails.${nailsExt}`, {
    type: nailsMime,
  });
  const imageModel = getImageModel();
  const res = await openai.images.edit({
    model: imageModel,
    image: [sceneFile, nailsFile],
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "high",
    background: "opaque",
    output_format: "png",
    input_fidelity: "high",
    stream: false,
  });
  return firstImageUrl(res);
}

async function validateImageFile(
  entry: FormDataEntryValue | null,
  fieldLabel: string,
): Promise<
  | { ok: true; buffer: Buffer; mime: string }
  | { ok: false; error: string }
> {
  if (!entry || !(entry instanceof File)) {
    return { ok: false, error: `${fieldLabel}缺失或无效。` };
  }
  if (!entry.type.startsWith("image/")) {
    return { ok: false, error: `${fieldLabel}必须是图片格式。` };
  }
  const buffer = Buffer.from(await entry.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return {
      ok: false,
      error: `${fieldLabel}过大，请使用小于 ${MAX_BYTES / 1024 / 1024}MB 的文件。`,
    };
  }
  return { ok: true, buffer, mime: entry.type || "image/jpeg" };
}

export async function POST(request: Request) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return Response.json(
      {
        error:
          "服务器未配置 API Key。请在 .env.local 中设置 OPENAI_API_KEY（或 LLM_GATEWAY_API_KEY），对应中转站发放的密钥。",
      },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "无法解析上传内容。" }, { status: 400 });
  }

  const mode: GenerationMode = parseGenerationMode(formData.get("mode"));

  const openai = new OpenAI({
    apiKey,
    baseURL: getBaseURL(),
  });

  if (mode === "model_tryon" || mode === "accessory_tryon") {
    const nailsRes = await validateImageFile(
      formData.get("image"),
      "美甲产品图（字段 image）",
    );
    if (!nailsRes.ok) {
      return Response.json({ error: nailsRes.error }, { status: 400 });
    }

    const secondKey = mode === "model_tryon" ? "modelImage" : "accessoryImage";
    const secondLabel =
      mode === "model_tryon"
        ? "模特图（字段 modelImage）"
        : "饰品场景图（字段 accessoryImage）";
    let sceneRes = await validateImageFile(formData.get(secondKey), secondLabel);
    if (!sceneRes.ok && mode === "accessory_tryon") {
      sceneRes = await validateImageFile(
        formData.get("foodImage"),
        "饰品场景图（兼容旧字段 foodImage，建议改用 accessoryImage）",
      );
    }
    if (!sceneRes.ok) {
      return Response.json({ error: sceneRes.error }, { status: 400 });
    }

    const prompt =
      mode === "model_tryon" ? MODEL_TRYON_PROMPT : ACCESSORY_TRYON_PROMPT;
    const label =
      mode === "model_tryon" ? "试戴效果图" : "饰品场景试戴图";

    try {
      const url = await editDualSceneNails(
        openai,
        sceneRes.buffer,
        sceneRes.mime,
        nailsRes.buffer,
        nailsRes.mime,
        prompt,
      );
      if (!url) {
        return Response.json(
          { error: "模型未返回图片（既无 url 也无 b64_json）。" },
          { status: 502 },
        );
      }
      return Response.json({
        imageUrls: [url],
        labels: [label],
        imageUrl: url,
        mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
      return Response.json({ error: message }, { status: 502 });
    }
  }

  const nailsOnly = await validateImageFile(formData.get("image"), "美甲图片（字段 image）");
  if (!nailsOnly.ok) {
    return Response.json({ error: nailsOnly.error }, { status: 400 });
  }

  const buffer = nailsOnly.buffer;
  const mime = nailsOnly.mime;
  const ext = extFromMime(mime);

  const jobs = promptsForMode(mode);
  const imageUrls: string[] = [];
  const labels: string[] = [];

  try {
    for (const { prompt, label } of jobs) {
      const url = await editOnce(openai, buffer, ext, mime, prompt);
      if (!url) {
        return Response.json(
          {
            error: `模型未返回第 ${imageUrls.length + 1} 张图片（既无 url 也无 b64_json）。`,
            imageUrls,
            labels,
          },
          { status: 502 },
        );
      }
      imageUrls.push(url);
      labels.push(label);
    }

    return Response.json({
      imageUrls,
      labels,
      imageUrl: imageUrls[0],
      mode,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
    return Response.json(
      { error: message, imageUrls, labels },
      { status: 502 },
    );
  }
}

function firstImageUrl(res: OpenAI.Images.ImagesResponse): string | null {
  const item = res.data?.[0];
  if (!item) return null;
  if (item.url) return item.url;
  if (item.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  return null;
}
