import OpenAI, { toFile } from "openai";
import {
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

  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "请选择一张美甲图片（字段名 image）。" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "文件必须是图片格式。" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return Response.json(
      { error: `图片过大，请使用小于 ${MAX_BYTES / 1024 / 1024}MB 的文件。` },
      { status: 400 },
    );
  }

  const mode: GenerationMode = parseGenerationMode(formData.get("mode"));

  const mime = file.type || "image/jpeg";
  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";

  const openai = new OpenAI({
    apiKey,
    baseURL: getBaseURL(),
  });

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
