/**
 * Replicate 上的 openai/gpt-image-2（及同 input schema 的变体）。
 * @see https://replicate.com/openai/gpt-image-2/api
 */

const REPLICATE_V1 = "https://api.replicate.com/v1";
/** Replicate 文档：大于约 256KB 的输入建议用可访问 URL（此处走官方文件上传） */
const DATA_URI_MAX_BYTES = 256 * 1024;
const POLL_MS = 1500;
const POLL_MAX_MS = 280_000;

export function imageProviderIsReplicate(): boolean {
  return process.env.IMAGE_PROVIDER?.trim().toLowerCase() === "replicate";
}

export function getReplicateApiToken(): string | undefined {
  return process.env.REPLICATE_API_TOKEN?.trim();
}

export function getReplicateImageModel(): string {
  return process.env.REPLICATE_IMAGE_MODEL?.trim() || "openai/gpt-image-2";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadImageFile(
  buffer: Buffer,
  mime: string,
  filename: string,
  token: string,
): Promise<string> {
  const blob = new Blob([new Uint8Array(buffer)], { type: mime });
  const form = new FormData();
  form.append("content", blob, filename);

  const res = await fetch(`${REPLICATE_V1}/files`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
    },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Replicate 文件上传失败 (${res.status}): ${text.slice(0, 800)}`);
  }
  let data: { urls?: { get?: string } };
  try {
    data = JSON.parse(text) as { urls?: { get?: string } };
  } catch {
    throw new Error("Replicate 文件上传响应不是合法 JSON。");
  }
  const url = data.urls?.get;
  if (!url) {
    throw new Error("Replicate 文件上传成功但未返回 urls.get。");
  }
  return url;
}

async function bufferToModelImageInput(
  buffer: Buffer,
  mime: string,
  filename: string,
  token: string,
): Promise<string> {
  if (buffer.length <= DATA_URI_MAX_BYTES) {
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }
  return uploadImageFile(buffer, mime, filename, token);
}

type PredictionJson = {
  id: string;
  status: string;
  urls?: { get?: string };
  error?: string | null;
  output?: unknown;
};

function parseOutputImageUrl(output: unknown): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string" && first.startsWith("http")) return first;
  }
  return null;
}

/**
 * 使用 Replicate 的 gpt-image-2：多图时顺序与调用方传入的 buffers 一致（须与提示词 FIRST/SECOND 对齐）。
 */
export async function runReplicateGptImage2(args: {
  token: string;
  model?: string;
  prompt: string;
  /** 按顺序传入，与 OpenAI images.edit 多图顺序一致 */
  images: { buffer: Buffer; mime: string; filename: string }[];
}): Promise<string | null> {
  const model = args.model ?? getReplicateImageModel();
  const parts = model.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`无效的 REPLICATE_IMAGE_MODEL: ${model}`);
  }
  const [owner, name] = parts;

  const input_images: string[] = [];
  for (const img of args.images) {
    input_images.push(
      await bufferToModelImageInput(img.buffer, img.mime, img.filename, args.token),
    );
  }

  const input: Record<string, unknown> = {
    prompt: args.prompt,
    input_images,
    aspect_ratio: "1:1",
    quality: "high",
    number_of_images: 1,
    output_format: "png",
    background: "opaque",
    moderation: "auto",
  };

  const createRes = await fetch(
    `${REPLICATE_V1}/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    },
  );
  const createText = await createRes.text();
  if (!createRes.ok) {
    throw new Error(
      `Replicate 创建预测失败 (${createRes.status}): ${createText.slice(0, 1200)}`,
    );
  }
  let pred: PredictionJson;
  try {
    pred = JSON.parse(createText) as PredictionJson;
  } catch {
    throw new Error("Replicate 创建预测响应不是合法 JSON。");
  }

  const pollUrl = pred.urls?.get;
  if (!pollUrl) {
    throw new Error("Replicate 预测未返回 urls.get，无法轮询状态。");
  }

  const deadline = Date.now() + POLL_MAX_MS;
  let last: PredictionJson = pred;

  while (Date.now() < deadline) {
    if (last.status === "succeeded") {
      return parseOutputImageUrl(last.output);
    }
    if (last.status === "failed" || last.status === "canceled") {
      const msg = last.error || `预测状态为 ${last.status}`;
      throw new Error(`Replicate: ${msg}`);
    }

    await sleep(POLL_MS);
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${args.token}` },
      cache: "no-store",
    });
    const pollText = await pollRes.text();
    if (!pollRes.ok) {
      throw new Error(`Replicate 轮询失败 (${pollRes.status}): ${pollText.slice(0, 800)}`);
    }
    try {
      last = JSON.parse(pollText) as PredictionJson;
    } catch {
      throw new Error("Replicate 轮询响应不是合法 JSON。");
    }
  }

  throw new Error("Replicate 预测超时（仍未成功）。");
}
