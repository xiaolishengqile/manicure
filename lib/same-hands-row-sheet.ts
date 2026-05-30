import {
  sameHandsRowModelPrompt,
  type GenerationMode,
} from "@/lib/generation-modes";
import { extFromMime, imageUrlToBuffer } from "@/lib/image-buffer-utils";
import {
  type ImageCtx,
  editOnceRoute,
} from "@/lib/image-edit-calls";
import { type ParsedGatewayEditFields } from "@/lib/image-gateway-fields";
import { buildDuplicatedRowGridFromOneRow } from "@/lib/single-row-split";
import {
  buildSingleRowModelSpacingPromptAddendum,
  type TenSinglesGridLayout,
} from "@/lib/ten-singles-grid-layout";
import { exifUprightToPng } from "@/lib/ten-singles-nail-preprocess";

export type BuildSameHandsProductSheet2x5Params = {
  mode: GenerationMode;
  inputBuffer: Buffer;
  inputMime: string;
  gridLayout: TenSinglesGridLayout;
  imageCtx: ImageCtx;
  gatewayEdit: ParsedGatewayEditFields;
  replicateDownloadAuth?: string;
  /** 单行模型 prompt 追加（如 solo / user notes），可为空 */
  promptSuffix?: string;
};

/**
 * 一行五甲 → **模型先规整单行** → 服务端整行复制为 2×5 产品背卡。
 * 用于「上下手同款」下的二次矫正与手握盒产品图。
 */
export async function buildSameHandsProductSheet2x5(
  params: BuildSameHandsProductSheet2x5Params,
): Promise<Buffer> {
  const pre = await exifUprightToPng(params.inputBuffer, params.inputMime);
  const ext = extFromMime(pre.mime);

  const basePrompt = sameHandsRowModelPrompt(params.mode);
  const rowModelPrompt =
    basePrompt +
    buildSingleRowModelSpacingPromptAddendum(params.gridLayout) +
    (params.promptSuffix ?? "");
  const oneRowUrl = await editOnceRoute(
    params.imageCtx,
    pre.buffer,
    ext,
    pre.mime,
    rowModelPrompt,
    params.gatewayEdit,
  );
  if (!oneRowUrl) {
    throw new Error("模型未返回单行美甲图（既无 url 也无 b64_json）。");
  }
  const oneRowBuffer = await imageUrlToBuffer(oneRowUrl, {
    replicateDownloadAuth: params.replicateDownloadAuth,
  });

  return buildDuplicatedRowGridFromOneRow(oneRowBuffer, params.gridLayout);
}
