import OpenAI, { toFile } from "openai";
import {
  ACCESSORY_TRYON_PROMPT,
  MODEL_TRYON_PROMPT,
  TEN_SINGLES_COLLAGE_REF_PROMPT,
  buildNailsInBoxPackagingPrompt,
  parseGenerationMode,
  parseNailsInBoxArrangement,
  promptsForMode,
  type GenerationMode,
} from "@/lib/generation-modes";
import {
  buildScaledSingleNailGrid,
  buildTenSinglesCollageReference,
} from "@/lib/ten-singles-collage";
import {
  buildWhiteGridLayoutPromptAddendum,
  parseTenSinglesGridLayoutFromFormData,
} from "@/lib/ten-singles-grid-layout";
import {
  exifRotate180TipDownToPng,
  exifUprightToPng,
  normalizeTenSingleNailForCollageCell,
} from "@/lib/ten-singles-nail-preprocess";
import {
  appendUserRefinementToPrompt,
  parseUserExtraNotes,
} from "@/lib/extra-user-notes";

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

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0") return true;
  if (h.endsWith(".local")) return true;
  if (h === "127.0.0.1") return true;
  return false;
}

function imageDataUrlToBuffer(url: string): Buffer | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(url);
  if (!match) return null;
  const mime = match[1]?.toLowerCase() ?? "";
  if (!mime.startsWith("image/")) return null;
  const payload = match[3] ?? "";
  if (match[2]) return Buffer.from(payload, "base64");
  return Buffer.from(decodeURIComponent(payload));
}

async function imageUrlToBuffer(url: string): Promise<Buffer> {
  const dataBuffer = imageDataUrlToBuffer(url);
  if (dataBuffer) return dataBuffer;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("模型返回的单甲图片地址无效。");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("模型返回的单甲图片地址不是 http(s)。");
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error("模型返回的单甲图片地址不允许下载。");
  }

  const upstream = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
    headers: { "User-Agent": "ManicureApp/1.0" },
  });
  if (!upstream.ok) {
    throw new Error("无法下载模型生成的单甲图片。");
  }
  const contentType =
    upstream.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (
    contentType &&
    !contentType.startsWith("image/") &&
    contentType !== "application/octet-stream"
  ) {
    throw new Error("模型生成的单甲结果不是图片格式。");
  }
  return Buffer.from(await upstream.arrayBuffer());
}

/**
 * 网关常返回短期 https URL；浏览器 <img> 易受跨域/防盗链影响显示破图。
 * 在服务端拉取后转为 data URL 再写入 JSON，前端即可稳定显示。
 */
async function toClientDisplayableImageUrl(
  urlOrData: string | null,
): Promise<string | null> {
  if (!urlOrData) return null;
  if (urlOrData.startsWith("data:")) return urlOrData;
  try {
    const buf = await imageUrlToBuffer(urlOrData);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return urlOrData;
  }
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
  const userExtraNotes = parseUserExtraNotes(formData.get("userExtraNotes"));
  const withNotes = (p: string) => appendUserRefinementToPrompt(p, userExtraNotes);

  const openai = new OpenAI({
    apiKey,
    baseURL: getBaseURL(),
  });

  if (mode === "ten_singles_grid") {
    const gridLayout = parseTenSinglesGridLayoutFromFormData(formData);
    /** 与客户端 `body.append("nail", f)` 顺序一致：第 1 张→栅格 input 1，依此类推 */
    const entries = formData.getAll("nail");
    if (entries.length !== 10) {
      return Response.json(
        {
          error: `该模式需要恰好 10 张单甲照片（字段 nail），当前 ${entries.length} 张。`,
        },
        { status: 400 },
      );
    }
    const normalizedCells: Buffer[] = [];
    for (let i = 0; i < 10; i++) {
      const entry = entries[i];
      const validated = await validateImageFile(
        entry instanceof File ? entry : null,
        `第 ${i + 1} 张单甲`,
      );
      if (!validated.ok) {
        return Response.json({ error: validated.error }, { status: 400 });
      }
      const { buffer: cellPng } = await normalizeTenSingleNailForCollageCell(
        validated.buffer,
        validated.mime,
      );
      normalizedCells.push(cellPng);
    }
    let collageBuffer: Buffer;
    try {
      collageBuffer = await buildTenSinglesCollageReference(
        normalizedCells,
        gridLayout,
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "服务端拼接十甲参考图失败";
      return Response.json({ error: message }, { status: 500 });
    }
    try {
      const url = await editOnce(
        openai,
        collageBuffer,
        "png",
        "image/png",
        withNotes(TEN_SINGLES_COLLAGE_REF_PROMPT),
      );
      if (!url) {
        return Response.json(
          { error: "模型未返回图片（既无 url 也无 b64_json）。" },
          { status: 502 },
        );
      }
      const displayUrl = await toClientDisplayableImageUrl(url);
      return Response.json({
        imageUrls: [displayUrl],
        labels: ["十枚单甲 · 白底合集"],
        imageUrl: displayUrl,
        mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
      return Response.json({ error: message }, { status: 502 });
    }
  }

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
        : "饰品参考图（字段 accessoryImage）";
    let sceneRes = await validateImageFile(formData.get(secondKey), secondLabel);
    if (!sceneRes.ok && mode === "accessory_tryon") {
      sceneRes = await validateImageFile(
        formData.get("foodImage"),
        "饰品参考图（兼容旧字段 foodImage，建议改用 accessoryImage）",
      );
    }
    if (!sceneRes.ok) {
      return Response.json({ error: sceneRes.error }, { status: 400 });
    }

    const prompt = withNotes(
      mode === "model_tryon" ? MODEL_TRYON_PROMPT : ACCESSORY_TRYON_PROMPT,
    );
    const label =
      mode === "model_tryon" ? "试戴效果图" : "手模饰品试戴图";

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
      const displayUrl = await toClientDisplayableImageUrl(url);
      return Response.json({
        imageUrls: [displayUrl],
        labels: [label],
        imageUrl: displayUrl,
        mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
      return Response.json({ error: message }, { status: 502 });
    }
  }

  if (mode === "nails_in_box") {
    const nailsRes = await validateImageFile(
      formData.get("image"),
      "美甲款式图（字段 image）",
    );
    if (!nailsRes.ok) {
      return Response.json({ error: nailsRes.error }, { status: 400 });
    }
    const boxRes = await validateImageFile(
      formData.get("packagingBoxImage"),
      "包装盒样式图（字段 packagingBoxImage）",
    );
    if (!boxRes.ok) {
      return Response.json({ error: boxRes.error }, { status: 400 });
    }

    const arrangement = parseNailsInBoxArrangement(
      formData.get("nailArrangement"),
    );
    const prompt = withNotes(buildNailsInBoxPackagingPrompt(arrangement));
    const label = "开窗盒装效果图";

    try {
      const url = await editDualSceneNails(
        openai,
        nailsRes.buffer,
        nailsRes.mime,
        boxRes.buffer,
        boxRes.mime,
        prompt,
      );
      if (!url) {
        return Response.json(
          { error: "模型未返回图片（既无 url 也无 b64_json）。" },
          { status: 502 },
        );
      }
      const displayUrl = await toClientDisplayableImageUrl(url);
      return Response.json({
        imageUrls: [displayUrl],
        labels: [label],
        imageUrl: displayUrl,
        mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
      return Response.json({ error: message }, { status: 502 });
    }
  }

  if (mode === "packaging_mockup") {
    const nailsRes = await validateImageFile(
      formData.get("image"),
      "美甲产品图（字段 image）",
    );
    if (!nailsRes.ok) {
      return Response.json({ error: nailsRes.error }, { status: 400 });
    }
    const poseRes = await validateImageFile(
      formData.get("packagingPoseImage"),
      "握姿参考图（字段 packagingPoseImage）",
    );
    if (!poseRes.ok) {
      return Response.json({ error: poseRes.error }, { status: 400 });
    }

    const jobs = promptsForMode(mode);
    const imageUrls: string[] = [];
    const labels: string[] = [];

    try {
      for (const { prompt, label } of jobs) {
        const url = await editDualSceneNails(
          openai,
          poseRes.buffer,
          poseRes.mime,
          nailsRes.buffer,
          nailsRes.mime,
          withNotes(prompt),
        );
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
        imageUrls.push((await toClientDisplayableImageUrl(url)) ?? url);
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

  if (mode === "flat_to_3d_packaging") {
    const flatRes = await validateImageFile(
      formData.get("image"),
      "2D 包装平面稿（字段 image）",
    );
    if (!flatRes.ok) {
      return Response.json({ error: flatRes.error }, { status: 400 });
    }
    const refRes = await validateImageFile(
      formData.get("packaging3dReferenceImage"),
      "3D/摄影参考图（字段 packaging3dReferenceImage）",
    );
    if (!refRes.ok) {
      return Response.json({ error: refRes.error }, { status: 400 });
    }

    const jobs = promptsForMode(mode);
    const imageUrls: string[] = [];
    const labels: string[] = [];

    try {
      for (const { prompt, label } of jobs) {
        /** flat_to_3d：先传摄影参考、再传 2D 稿，与 `FLAT_TO_3D_*` 提示中 FIRST/SECOND 定义一致，减轻整图复刻参考。 */
        const url = await editDualSceneNails(
          openai,
          refRes.buffer,
          refRes.mime,
          flatRes.buffer,
          flatRes.mime,
          withNotes(prompt),
        );
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
        imageUrls.push((await toClientDisplayableImageUrl(url)) ?? url);
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

  const nailsOnly = await validateImageFile(formData.get("image"), "美甲图片（字段 image）");
  if (!nailsOnly.ok) {
    return Response.json({ error: nailsOnly.error }, { status: 400 });
  }

  let buffer = nailsOnly.buffer;
  let mime = nailsOnly.mime;
  if (mode === "complete_single_grid") {
    const pre = await exifRotate180TipDownToPng(buffer, mime);
    buffer = pre.buffer;
    mime = pre.mime;
  } else if (mode === "extract_ten_grid") {
    const pre = await exifUprightToPng(buffer, mime);
    buffer = pre.buffer;
    mime = pre.mime;
  }
  const ext = extFromMime(mime);

  if (mode === "complete_single_grid") {
    const gridLayout = parseTenSinglesGridLayoutFromFormData(formData);
    const job = promptsForMode(mode)[0];
    if (!job) {
      return Response.json({ error: "未找到单甲高清化提示词。" }, { status: 500 });
    }

    try {
      const singleNailUrl = await editOnce(
        openai,
        buffer,
        ext,
        mime,
        withNotes(job.prompt),
      );
      if (!singleNailUrl) {
        return Response.json(
          { error: "模型未返回单甲图片（既无 url 也无 b64_json）。" },
          { status: 502 },
        );
      }

      const singleNailBuffer = await imageUrlToBuffer(singleNailUrl);
      const gridBuffer = await buildScaledSingleNailGrid(
        singleNailBuffer,
        gridLayout,
      );
      const gridUrl = `data:image/png;base64,${gridBuffer.toString("base64")}`;

      return Response.json({
        imageUrls: [gridUrl],
        labels: [job.label],
        imageUrl: gridUrl,
        mode,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "单甲高清化或服务端拼图失败";
      return Response.json({ error: message }, { status: 502 });
    }
  }

  const jobs = promptsForMode(mode);
  const imageUrls: string[] = [];
  const labels: string[] = [];
  const extractGridAddendum =
    mode === "extract_ten_grid"
      ? buildWhiteGridLayoutPromptAddendum(
          parseTenSinglesGridLayoutFromFormData(formData),
        )
      : "";

  try {
    for (const { prompt, label } of jobs) {
      const composed =
        mode === "extract_ten_grid" ? `${prompt}${extractGridAddendum}` : prompt;
      const url = await editOnce(openai, buffer, ext, mime, withNotes(composed));
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
      imageUrls.push((await toClientDisplayableImageUrl(url)) ?? url);
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
