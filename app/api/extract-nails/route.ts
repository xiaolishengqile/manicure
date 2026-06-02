import OpenAI from "openai";
import sharp from "sharp";
import {
  ACCESSORY_TRYON_PROMPT,
  buildModelTryonPrompt,
  TEN_SINGLES_COLLAGE_REF_PROMPT,
  EXTRACT_TEN_GRID_API_PREFIX,
  WHITE_GRID_RECTIFY_API_PREFIX,
  collapseIdenticalPromptJobs,
  finalizeParallelImageJobs,
  composeScatteredGridEditPrompt,
  EXTRACT_DIAGONAL_ROW_API_PREFIX,
  buildNailsInBoxBoxAspectApiPrefix,
  buildNailsInBoxPackagingPrompt,
  modeUsesDominantColorExtraction,
  generationModeOption,
  parseGenerationMode,
  parseNailsInBoxArrangement,
  modeAllowsPartialDualVariants,
  filterParallelImageJobs,
  parseParallelVariantChoice,
  promptsForMode,
  parseSameHandsRow,
  LAYER_EDITOR_EXTRACT_PROMPT,
  type GenerationImageJob,
  type GenerationMode,
} from "@/lib/generation-modes";
import {
  buildScaledSingleNailGrid,
  buildTenSinglesCollageReference,
} from "@/lib/ten-singles-collage";
import { buildDuplicatedRowGridFromOneRow } from "@/lib/single-row-split";
import { buildSameHandsProductSheet2x5 } from "@/lib/same-hands-row-sheet";
import {
  buildSingleRowModelSpacingPromptAddendum,
  buildWhiteGridLayoutPromptAddendum,
  layoutWithMinColGutterForSingleRow,
  parseTenSinglesGridLayoutFromFormData,
} from "@/lib/ten-singles-grid-layout";
import {
  applyDiagonalPackshotRotation,
  parseDiagonalPackshotRotateDeg,
  parseDiagonalUploadRows,
} from "@/lib/diagonal-flatlay";
import { buildTwoRowStripGrid } from "@/lib/ten-singles-collage";
import {
  exifUprightToPng,
  normalizeTenSingleNailForCollageCell,
} from "@/lib/ten-singles-nail-preprocess";
import {
  appendDominantColorHintToPrompt,
  extractDominantColorFromBuffer,
} from "@/lib/dominant-color";
import {
  parsePanelColorHex,
  parsePanelColorSource,
  swatchFromHex,
  type PanelColorSource,
} from "@/lib/panel-color";
import {
  appendUserRefinementToPrompt,
  parseUserExtraNotes,
} from "@/lib/extra-user-notes";
import { parseNailShapeProfile } from "@/lib/nail-shape-profiles";
import {
  buildFullSoloImageEditPrompt,
  parseSoloImageEditPrompt,
} from "@/lib/solo-image-edit-prompt";
import {
  imageModelUsesFluxGenerations,
  parseGatewayEditFieldsFromForm,
} from "@/lib/image-gateway-fields";
import { resolveOpenAiImageCredentials } from "@/lib/openai-image-gateway";
import {
  getReplicateApiToken,
  imageProviderIsReplicate,
} from "@/lib/replicate-gpt-image-2";
import {
  extFromMime,
  imageUrlToBuffer,
  toClientDisplayableImageUrl,
} from "@/lib/image-buffer-utils";
import {
  runParallelImageEditJobs,
  ndjsonStreamParallelImageJobsResponse,
} from "@/lib/parallel-image-jobs";
import {
  type ImageCtx,
  replicateDownloadAuth,
  editOnceRoute,
  editDualSceneNailsRoute,
} from "@/lib/image-edit-calls";
import { loadMultiAngleFrontHandRef } from "@/lib/multi-angle-hand-ref";
import {
  compactLongNailArtForBoxWindow,
  shouldCompactLongNailArtForBox,
} from "@/lib/nails-in-box-preprocess";
import {
  expandWhiteMarginSquare,
} from "@/lib/white-margin-expand";
import { parseWhiteMarginExpandPct } from "@/lib/white-margin-expand-config";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 12 * 1024 * 1024;

function composeImageEditPrompt(
  mode: GenerationMode,
  prompt: string,
  label: string,
  extractGridAddendum: string,
): string {
  if (mode === "extract_ten_grid") {
    return `${EXTRACT_TEN_GRID_API_PREFIX}${prompt}${extractGridAddendum}`;
  }
  if (mode === "white_grid_rectify") {
    return `${WHITE_GRID_RECTIFY_API_PREFIX}${prompt}${extractGridAddendum}`;
  }
  if (mode === "extract_scattered_grid") {
    return composeScatteredGridEditPrompt(prompt);
  }
  if (mode === "extract_diagonal_row") {
    return `${EXTRACT_DIAGONAL_ROW_API_PREFIX}${prompt}`;
  }
  return prompt;
}

function resolveImageEditJobs(
  mode: GenerationMode,
  extractGridAddendum: string,
): GenerationImageJob[] {
  const raw = promptsForMode(mode);
  const composed = raw.map((job) => ({
    label: job.label,
    prompt: composeImageEditPrompt(
      mode,
      job.prompt,
      job.label,
      extractGridAddendum,
    ),
  }));
  return finalizeParallelImageJobs(mode, composed);
}

function getImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
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

/** 从平面稿提主色或用户指定色，拼进系统提示 */
async function systemPromptWithDominantColor(
  mode: GenerationMode,
  systemPrompt: string,
  flatArtBuffer: Buffer,
  panelLabel: string,
  panelColorSource: PanelColorSource,
  userPanelHex: string | null,
): Promise<string> {
  if (!modeUsesDominantColorExtraction(mode)) return systemPrompt;

  /** 仅当用户在前端点选预设/取色器（panelColorSource=manual 且带 hex）才改色；否则从正面稿自动提色 */
  const useUserPanelColor =
    panelColorSource === "manual" && userPanelHex != null;

  let swatch = useUserPanelColor ? swatchFromHex(userPanelHex) : null;
  if (!swatch) {
    swatch = await extractDominantColorFromBuffer(flatArtBuffer);
  }
  if (!swatch) return systemPrompt;

  const hintSource: "auto" | "user" = useUserPanelColor ? "user" : "auto";

  return appendDominantColorHintToPrompt(systemPrompt, swatch, {
    panelLabel,
    source: hintSource,
  });
}

export async function POST(request: Request) {
  const useReplicate = imageProviderIsReplicate();
  const replicateToken = getReplicateApiToken();

  if (useReplicate) {
    if (!replicateToken) {
      return Response.json(
        {
          error:
            "IMAGE_PROVIDER=replicate 时请在环境变量中设置 REPLICATE_API_TOKEN（Replicate 账户 API Token）。",
        },
        { status: 500 },
      );
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "无法解析上传内容。" }, { status: 400 });
  }

  let imageCtx: ImageCtx;
  if (useReplicate) {
    imageCtx = { provider: "replicate", token: replicateToken! };
  } else {
    const resolved = resolveOpenAiImageCredentials(formData);
    if ("error" in resolved) {
      return Response.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    imageCtx = {
      provider: "openai",
      openai: new OpenAI({
        apiKey: resolved.apiKey,
        baseURL: resolved.baseURL,
      }),
      baseURL: resolved.baseURL,
      apiKey: resolved.apiKey,
    };
  }

  const mode: GenerationMode = parseGenerationMode(formData.get("mode"));
  const panelColorSource = parsePanelColorSource(
    formData.get("panelColorSource"),
  );
  const userPanelHex = parsePanelColorHex(formData.get("panelColorHex"));
  /** 多路并行生图时：以 NDJSON 流推送，先完成的先下发，便于前端渐进展示 */
  const streamResults = formData.get("streamResults") === "1";
  const userExtraNotes = parseUserExtraNotes(formData.get("userExtraNotes"));
  const soloImageEditPrompt = parseSoloImageEditPrompt(
    formData.get("soloImageEditPrompt"),
  );
  const withNotes = (p: string) => appendUserRefinementToPrompt(p, userExtraNotes);
  /** 有「仅自定义」时：只拼两句白底底线 + 框内文 + 图；不拼长系统 prompt、补充说明、栅格 addendum */
  const imageEditPrompt = (systemPrompt: string) =>
    soloImageEditPrompt
      ? buildFullSoloImageEditPrompt(soloImageEditPrompt)
      : withNotes(systemPrompt);

  const gatewayEdit = parseGatewayEditFieldsFromForm(
    formData,
    getImageModel(),
  );

  if (
    useReplicate &&
    imageModelUsesFluxGenerations(gatewayEdit.model)
  ) {
    return Response.json(
      {
        error:
          "Flux 模型仅支持 OpenAI 兼容中转（/v1/images/generations 或 Edits）。请将 IMAGE_PROVIDER 设为 openai，或改用默认 / Nano-banana-2 模型。",
      },
      { status: 400 },
    );
  }

  const replAuth = replicateDownloadAuth(imageCtx);

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
      const url = await editOnceRoute(
        imageCtx,
        collageBuffer,
        "png",
        "image/png",
        imageEditPrompt(TEN_SINGLES_COLLAGE_REF_PROMPT),
        gatewayEdit,
      );
      if (!url) {
        return Response.json(
          { error: "模型未返回图片（既无 url 也无 b64_json）。" },
          { status: 502 },
        );
      }
      const displayUrl = await toClientDisplayableImageUrl(url, replAuth);
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

  if (mode === "multi_angle") {
    const nailsRes = await validateImageFile(
      formData.get("image"),
      "美甲款式参考图（字段 image）",
    );
    if (!nailsRes.ok) {
      return Response.json({ error: nailsRes.error }, { status: 400 });
    }

    let handRef: { buffer: Buffer; mime: string };
    try {
      handRef = await loadMultiAngleFrontHandRef();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "无法读取固定上手模板图";
      return Response.json({ error: message, imageUrls: [], labels: [] }, { status: 500 });
    }

    const jobs = promptsForMode(mode);

    try {
      const outcome = await runParallelImageEditJobs({
        jobs,
        replicateDownloadAuth: replAuth,
        edit: async ({ prompt }) =>
          editDualSceneNailsRoute(
            imageCtx,
            handRef.buffer,
            handRef.mime,
            nailsRes.buffer,
            nailsRes.mime,
            imageEditPrompt(prompt),
            gatewayEdit,
          ),
      });
      if (!outcome.ok) {
        return Response.json(
          {
            error: outcome.error,
            imageUrls: outcome.imageUrls,
            labels: outcome.labels,
          },
          { status: 502 },
        );
      }
      return Response.json({
        imageUrls: outcome.imageUrls,
        labels: outcome.labels,
        imageUrl: outcome.imageUrls[0],
        mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
      return Response.json({ error: message, imageUrls: [], labels: [] }, { status: 502 });
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

    const nailShapeProfile =
      mode === "model_tryon"
        ? parseNailShapeProfile(formData.get("nailShapeProfile"))
        : null;
    const prompt = imageEditPrompt(
      mode === "model_tryon"
        ? buildModelTryonPrompt(nailShapeProfile!)
        : ACCESSORY_TRYON_PROMPT,
    );
    const label =
      mode === "model_tryon" ? "试戴效果图" : "手模饰品试戴图";

    try {
      const url = await editDualSceneNailsRoute(
        imageCtx,
        sceneRes.buffer,
        sceneRes.mime,
        nailsRes.buffer,
        nailsRes.mime,
        prompt,
        gatewayEdit,
      );
      if (!url) {
        return Response.json(
          { error: "模型未返回图片（既无 url 也无 b64_json）。" },
          { status: 502 },
        );
      }

      const displayUrl = await toClientDisplayableImageUrl(url, replAuth);
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
    const compactLongNails = shouldCompactLongNailArtForBox(
      formData.get("nailBoxLongNails"),
    );
    let nailsBuffer = nailsRes.buffer;
    let nailsMime = nailsRes.mime;
    if (compactLongNails) {
      nailsBuffer = await compactLongNailArtForBoxWindow(nailsRes.buffer);
      nailsMime = "image/png";
    }
    const boxMeta = await sharp(boxRes.buffer).metadata();
    const aspectPrefix = buildNailsInBoxBoxAspectApiPrefix(
      boxMeta.width ?? 1,
      boxMeta.height ?? 1,
    );
    const basePrompt = imageEditPrompt(
      aspectPrefix +
        buildNailsInBoxPackagingPrompt(arrangement, { compactLongNails }),
    );
    const jobs = collapseIdenticalPromptJobs([
      {
        prompt: basePrompt,
        label: "开窗盒装效果图 · 方案 A",
      },
      {
        prompt: basePrompt,
        label: "开窗盒装效果图 · 方案 B",
      },
    ]);

    try {
      if (streamResults && jobs.length > 0) {
        return ndjsonStreamParallelImageJobsResponse({
          jobs,
          replicateDownloadAuth: replAuth,
          minSuccessful: 1,
          mode,
          edit: async ({ prompt }) =>
            editDualSceneNailsRoute(
              imageCtx,
              boxRes.buffer,
              boxRes.mime,
              nailsBuffer,
              nailsMime,
              prompt,
              gatewayEdit,
            ),
        });
      }
      const outcome = await runParallelImageEditJobs({
        jobs,
        replicateDownloadAuth: replAuth,
        minSuccessful: 1,
        edit: async ({ prompt }) =>
          editDualSceneNailsRoute(
            imageCtx,
            boxRes.buffer,
            boxRes.mime,
            nailsBuffer,
            nailsMime,
            prompt,
            gatewayEdit,
          ),
      });
      if (!outcome.ok) {
        return Response.json(
          {
            error: outcome.error,
            imageUrls: outcome.imageUrls,
            labels: outcome.labels,
          },
          { status: 502 },
        );
      }
      return Response.json({
        imageUrls: outcome.imageUrls,
        labels: outcome.labels,
        imageUrl: outcome.imageUrls[0],
        mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
      return Response.json(
        { error: message, imageUrls: [], labels: [] },
        { status: 502 },
      );
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

    const sameHandsRow = parseSameHandsRow(formData.get("sameHandsRow"));
    let productBuffer = nailsRes.buffer;
    let productMime = nailsRes.mime;
    if (sameHandsRow) {
      const gridLayout = layoutWithMinColGutterForSingleRow(
        parseTenSinglesGridLayoutFromFormData(formData),
      );
      try {
        productBuffer = await buildSameHandsProductSheet2x5({
          mode: "packaging_mockup",
          inputBuffer: nailsRes.buffer,
          inputMime: nailsRes.mime,
          gridLayout,
          imageCtx,
          gatewayEdit,
          replicateDownloadAuth: replAuth,
        });
        productMime = "image/png";
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "一行五甲复制为 2×5 产品图失败";
        return Response.json({ error: message, imageUrls: [], labels: [] }, { status: 502 });
      }
    }

    const jobs = promptsForMode(mode);

    try {
      const outcome = await runParallelImageEditJobs({
        jobs,
        replicateDownloadAuth: replAuth,
        edit: async ({ prompt }) =>
          editDualSceneNailsRoute(
            imageCtx,
            poseRes.buffer,
            poseRes.mime,
            productBuffer,
            productMime,
            imageEditPrompt(prompt),
            gatewayEdit,
          ),
      });
      if (!outcome.ok) {
        return Response.json(
          {
            error: outcome.error,
            imageUrls: outcome.imageUrls,
            labels: outcome.labels,
          },
          { status: 502 },
        );
      }
      return Response.json({
        imageUrls: outcome.imageUrls,
        labels: outcome.labels,
        imageUrl: outcome.imageUrls[0],
        mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
      return Response.json({ error: message, imageUrls: [], labels: [] }, { status: 502 });
    }
  }

  if (mode === "flat_to_3d_packaging") {
    const flatRes = await validateImageFile(
      formData.get("image"),
      "2D 包装刀模展开图（字段 image）",
    );
    if (!flatRes.ok) {
      return Response.json({ error: flatRes.error }, { status: 400 });
    }

    const jobs = promptsForMode(mode);
    if (jobs[0]) {
      jobs[0].prompt = await systemPromptWithDominantColor(
        mode,
        jobs[0].prompt,
        flatRes.buffer,
        "BOX PANEL",
        panelColorSource,
        userPanelHex,
      );
    }

    try {
      const outcome = await runParallelImageEditJobs({
        jobs,
        replicateDownloadAuth: replAuth,
        edit: async ({ prompt }) =>
          editOnceRoute(
            imageCtx,
            flatRes.buffer,
            extFromMime(flatRes.mime),
            flatRes.mime,
            imageEditPrompt(prompt),
            gatewayEdit,
          ),
      });
      if (!outcome.ok) {
        return Response.json(
          {
            error: outcome.error,
            imageUrls: outcome.imageUrls,
            labels: outcome.labels,
          },
          { status: 502 },
        );
      }
      return Response.json({
        imageUrls: outcome.imageUrls,
        labels: outcome.labels,
        imageUrl: outcome.imageUrls[0],
        mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
      return Response.json({ error: message, imageUrls: [], labels: [] }, { status: 502 });
    }
  }

  if (mode === "flat_to_3d_sachet") {
    const frontRes = await validateImageFile(
      formData.get("image"),
      "袋装正面平面稿（字段 image）",
    );
    if (!frontRes.ok) {
      return Response.json({ error: frontRes.error }, { status: 400 });
    }
    const backRes = await validateImageFile(
      formData.get("sachetBackImage"),
      "袋装背面平面稿（字段 sachetBackImage）",
    );
    if (!backRes.ok) {
      return Response.json({ error: backRes.error }, { status: 400 });
    }

    const jobs = promptsForMode(mode);
    if (jobs[0]) {
      jobs[0].prompt = await systemPromptWithDominantColor(
        mode,
        jobs[0].prompt,
        frontRes.buffer,
        "FRONT PANEL",
        panelColorSource,
        userPanelHex,
      );
    }

    try {
      const outcome = await runParallelImageEditJobs({
        jobs,
        replicateDownloadAuth: replAuth,
        edit: async ({ prompt }) =>
          editDualSceneNailsRoute(
            imageCtx,
            frontRes.buffer,
            frontRes.mime,
            backRes.buffer,
            backRes.mime,
            imageEditPrompt(prompt),
            gatewayEdit,
          ),
      });
      if (!outcome.ok) {
        return Response.json(
          {
            error: outcome.error,
            imageUrls: outcome.imageUrls,
            labels: outcome.labels,
          },
          { status: 502 },
        );
      }
      return Response.json({
        imageUrls: outcome.imageUrls,
        labels: outcome.labels,
        imageUrl: outcome.imageUrls[0],
        mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
      return Response.json({ error: message, imageUrls: [], labels: [] }, { status: 502 });
    }
  }

  if (mode === "layer_editor") {
    const nailsRes = await validateImageFile(
      formData.get("image"),
      "美甲产品图（字段 image）",
    );
    if (!nailsRes.ok) {
      return Response.json({ error: nailsRes.error }, { status: 400 });
    }

    let buffer = nailsRes.buffer;
    let mime = nailsRes.mime;
    const pre = await exifUprightToPng(buffer, mime);
    buffer = pre.buffer;
    mime = pre.mime;
    const ext = extFromMime(mime);

    try {
      // Call model to extract nails into a 2×5 grid
      const prompt = imageEditPrompt(LAYER_EDITOR_EXTRACT_PROMPT);
      const gridUrl = await editOnceRoute(
        imageCtx,
        buffer,
        ext,
        mime,
        prompt,
        gatewayEdit,
      );
      if (!gridUrl) {
        return Response.json(
          { error: "模型未返回抠图结果（既无 url 也无 b64_json）。" },
          { status: 502 },
        );
      }

      // Return the raw grid image — manual cropping happens on the client
      const gridBuffer = await imageUrlToBuffer(gridUrl, {
        replicateDownloadAuth: replAuth,
      });
      const gridB64 = gridBuffer.toString("base64");
      const gridDataUrl = `data:image/png;base64,${gridB64}`;

      return Response.json({
        imageUrls: [gridDataUrl],
        labels: ["抠图栅格（手动裁切）"],
        imageUrl: gridDataUrl,
        mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "图层编辑器抠图失败";
      return Response.json({ error: message }, { status: 502 });
    }
  }

  const nailsOnly = await validateImageFile(formData.get("image"), "美甲图片（字段 image）");
  if (!nailsOnly.ok) {
    return Response.json({ error: nailsOnly.error }, { status: 400 });
  }

  if (mode === "expand_white_margin") {
    try {
      const expandPct = parseWhiteMarginExpandPct(
        formData.get("whiteMarginExpandPct"),
      );
      const out = await expandWhiteMarginSquare(nailsOnly.buffer, expandPct);
      const baseLabel = generationModeOption("expand_white_margin").label;
      return Response.json({
        imageUrls: [`data:image/png;base64,${out.toString("base64")}`],
        labels: [`${baseLabel}（扩大 ${expandPct}%）`],
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "扩大白底留白失败。";
      return Response.json({ error: message, imageUrls: [], labels: [] }, { status: 502 });
    }
  }

  let buffer = nailsOnly.buffer;
  let mime = nailsOnly.mime;
  if (
    mode === "complete_single_grid" ||
    mode === "single_row_to_grid" ||
    mode === "extract_diagonal_row" ||
    mode === "extract_ten_grid" ||
    mode === "extract_scattered_grid" ||
    mode === "white_grid_rectify"
  ) {
    /** 单甲补齐：用户约定甲尖朝下，仅 EXIF 转正。抠多枚：仅 EXIF 转正，不整图 180°。 */
    const pre = await exifUprightToPng(buffer, mime);
    buffer = pre.buffer;
    mime = pre.mime;
  }
  const ext = extFromMime(mime);

  if (mode === "single_row_to_grid" || mode === "extract_diagonal_row") {
    const gridLayout = layoutWithMinColGutterForSingleRow(
      parseTenSinglesGridLayoutFromFormData(formData),
    );
    const skipRowModel = formData.get("skipRowModel") === "1";
    const job = promptsForMode(mode)[0];
    const isDiagonal = mode === "extract_diagonal_row";
    const diagonalUploadRows = isDiagonal
      ? parseDiagonalUploadRows(formData.get("diagonalUploadRows"))
      : "one_row";

    try {
      if (isDiagonal && !skipRowModel && diagonalUploadRows === "two_rows") {
        return Response.json(
          {
            error:
              "已选择「两行 / 2×5」上传时请勾选「跳过模型」，或改选「一行五枚」走模型抠图。",
          },
          { status: 400 },
        );
      }

      let oneRowBuffer = buffer;
      if (!skipRowModel) {
        if (!job) {
          return Response.json(
            {
              error: isDiagonal
                ? "未找到斜排（一行五甲）提示词。"
                : "未找到单行复制成双行提示词。",
            },
            { status: 500 },
          );
        }
        const rowModelPrompt =
          job.prompt + buildSingleRowModelSpacingPromptAddendum(gridLayout);
        const composedRowPrompt = composeImageEditPrompt(
          mode,
          rowModelPrompt,
          job.label ?? "",
          "",
        );
        const oneRowUrl = await editOnceRoute(
          imageCtx,
          buffer,
          ext,
          mime,
          imageEditPrompt(composedRowPrompt),
          gatewayEdit,
        );
        if (!oneRowUrl) {
          return Response.json(
            { error: "模型未返回单行美甲图（既无 url 也无 b64_json）。" },
            { status: 502 },
          );
        }
        oneRowBuffer = await imageUrlToBuffer(oneRowUrl, {
          replicateDownloadAuth: replAuth,
        });
      }

      let gridBuffer: Buffer;
      if (
        isDiagonal &&
        skipRowModel &&
        diagonalUploadRows === "two_rows"
      ) {
        gridBuffer = await buildTwoRowStripGrid(buffer, gridLayout);
      } else {
        gridBuffer = await buildDuplicatedRowGridFromOneRow(
          oneRowBuffer,
          gridLayout,
          { skipRowModel },
        );
      }
      if (isDiagonal) {
        const rotateDeg = parseDiagonalPackshotRotateDeg(
          formData.get("diagonalPackshotRotateDeg"),
        );
        gridBuffer = await applyDiagonalPackshotRotation(gridBuffer, rotateDeg);
      }
      const gridUrl = `data:image/png;base64,${gridBuffer.toString("base64")}`;

      const defaultLabel = generationModeOption(mode).label;
      const label = skipRowModel
        ? isDiagonal
          ? diagonalUploadRows === "two_rows"
            ? `${defaultLabel}（跳过模型 · 两行直转）`
            : `${defaultLabel}（跳过模型 · 复制成双行）`
          : "白底栅格 · 单行复制成双行（跳过模型）"
        : job?.label ?? defaultLabel;

      return Response.json({
        imageUrls: [gridUrl],
        labels: [label],
        imageUrl: gridUrl,
        mode,
      });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : isDiagonal
            ? "斜排（一行抠图、复制、旋转）失败"
            : "单行规整或服务端复制拼接失败";
      return Response.json({ error: message }, { status: 502 });
    }
  }

  if (mode === "complete_single_grid") {
    const gridLayout = parseTenSinglesGridLayoutFromFormData(formData);
    const job = promptsForMode(mode)[0];
    if (!job) {
      return Response.json({ error: "未找到单甲高清化提示词。" }, { status: 500 });
    }

    try {
      const singleNailUrl = await editOnceRoute(
        imageCtx,
        buffer,
        ext,
        mime,
        imageEditPrompt(job.prompt),
        gatewayEdit,
      );
      if (!singleNailUrl) {
        return Response.json(
          { error: "模型未返回单甲图片（既无 url 也无 b64_json）。" },
          { status: 502 },
        );
      }

      const singleNailBuffer = await imageUrlToBuffer(singleNailUrl, {
        replicateDownloadAuth: replAuth,
      });
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

  if (mode === "white_grid_rectify" && parseSameHandsRow(formData.get("sameHandsRow"))) {
    const gridLayout = layoutWithMinColGutterForSingleRow(
      parseTenSinglesGridLayoutFromFormData(formData),
    );
    try {
      const gridBuffer = await buildSameHandsProductSheet2x5({
        mode: "white_grid_rectify",
        inputBuffer: buffer,
        inputMime: mime,
        gridLayout,
        imageCtx,
        gatewayEdit,
        replicateDownloadAuth: replAuth,
      });
      const gridUrl = `data:image/png;base64,${gridBuffer.toString("base64")}`;
      const defaultLabel = generationModeOption(mode).label;
      const label = `${defaultLabel}（同款一行 · 模型规整后复制成双行）`;
      return Response.json({
        imageUrls: [gridUrl],
        labels: [label],
        imageUrl: gridUrl,
        mode,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "同款一行矫正或复制拼接失败";
      return Response.json({ error: message, imageUrls: [], labels: [] }, { status: 502 });
    }
  }

  const gridLayoutParsed = parseTenSinglesGridLayoutFromFormData(formData);
  const extractGridAddendum =
    mode === "extract_ten_grid"
      ? buildWhiteGridLayoutPromptAddendum(gridLayoutParsed, {
          variant: "spacing_only",
          spacingContext: "extract",
        })
      : mode === "white_grid_rectify"
        ? buildWhiteGridLayoutPromptAddendum(gridLayoutParsed, {
            variant: "spacing_only",
            spacingContext: "rectify",
          })
        : "";
  const variantChoice = parseParallelVariantChoice(
    formData.get("parallelVariantChoice"),
  );
  const jobs = filterParallelImageJobs(
    resolveImageEditJobs(mode, extractGridAddendum),
    variantChoice,
    mode,
  );
  if (jobs.length === 0) {
    return Response.json(
      {
        error:
          variantChoice === "a"
            ? "未找到方案 A 生成任务。"
            : variantChoice === "b"
              ? "未找到方案 B 生成任务。"
              : "没有可执行的生成任务。",
      },
      { status: 400 },
    );
  }

  const editResolvedExtractJob = async (job: {
    prompt: string;
    label: string;
  }) => {
    const prompt = imageEditPrompt(job.prompt);
    return editOnceRoute(
      imageCtx,
      buffer,
      ext,
      mime,
      prompt,
      gatewayEdit,
    );
  };

  try {
    if (streamResults && jobs.length > 0) {
      return ndjsonStreamParallelImageJobsResponse({
        jobs,
        replicateDownloadAuth: replAuth,
        minSuccessful: modeAllowsPartialDualVariants(mode) ? 1 : jobs.length,
        mode,
        edit: async (job) => editResolvedExtractJob(job),
      });
    }
    const outcome = await runParallelImageEditJobs({
      jobs,
      replicateDownloadAuth: replAuth,
      minSuccessful: modeAllowsPartialDualVariants(mode) ? 1 : jobs.length,
      edit: async (job) => editResolvedExtractJob(job),
    });
    if (!outcome.ok) {
      return Response.json(
        {
          error: outcome.error,
          imageUrls: outcome.imageUrls,
          labels: outcome.labels,
        },
        { status: 502 },
      );
    }
    return Response.json({
      imageUrls: outcome.imageUrls,
      labels: outcome.labels,
      imageUrl: outcome.imageUrls[0],
      mode,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "图像编辑接口调用失败";
    return Response.json(
      { error: message, imageUrls: [], labels: [] },
      { status: 502 },
    );
  }
}
