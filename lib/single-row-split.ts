import sharp from "sharp";

import {
  layoutWithMinColGutterForSingleRow,
  type TenSinglesGridLayout,
} from "@/lib/ten-singles-grid-layout";
import {
  buildDuplicatedFiveNailRowGrid,
  buildDuplicatedRowStripGrid,
} from "@/lib/ten-singles-collage";
import {
  uprightHorizontalNailRowCrops,
  uprightNailPads,
} from "@/lib/row-strip-upright";

const EXPECTED_NAILS_PER_ROW = 5;

async function pngMeta(buf: Buffer): Promise<{ w: number; h: number }> {
  const m = await sharp(buf).metadata();
  return { w: m.width ?? 1, h: m.height ?? 1 };
}

/**
 * 连通域/列缝裁切有时会误把一行甲片切成多根竖条（蕾丝底纹、甲面高光竖带等）。
 * 若列宽过窄或五列悬殊，则放弃按枚拼图，改走整行条带复制。
 */
async function fiveNailCropsLookLikeWholeNails(
  crops: Buffer[],
  rowBuffer: Buffer,
): Promise<boolean> {
  if (crops.length !== EXPECTED_NAILS_PER_ROW) return false;
  const trimmed = await trimWhiteEdges(rowBuffer);
  const row = await pngMeta(trimmed);
  const metas = await Promise.all(crops.map((b) => pngMeta(b)));
  const widths = metas.map((m) => m.w);
  const minW = Math.min(...widths);
  const maxW = Math.max(...widths);
  const rowW = Math.max(row.w, widths.reduce((s, w) => s + w, 0));

  if (minW < rowW * 0.1) return false;
  if (minW < maxW * 0.42) return false;

  for (const { w, h } of metas) {
    if (h < w * 1.08) return false;
    if (w > h * 0.72) return false;
  }
  return true;
}

async function trimWhiteEdges(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input)
      .trim({ threshold: 14, lineArt: false })
      .png()
      .toBuffer();
  } catch {
    return input;
  }
}

function isContentPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 22) return false;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const sat = maxc <= 1 ? 0 : (maxc - minc) / maxc;
  return lum < 252 || sat > 0.04;
}

function movingAverage(values: number[], window: number): number[] {
  const w = Math.max(1, window);
  const half = Math.floor(w / 2);
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      sum += values[j]!;
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return out;
}

/** 竖缝中心 → 相邻缝之间的中点作为裁切线（5 枚需 4 条缝） */
function boundariesFromGutterMids(gutters: number[], width: number): number[] {
  const g = [...gutters].sort((a, b) => a - b);
  if (g.length !== 4) {
    return Array.from({ length: 6 }, (_, i) => Math.round((i * width) / 5));
  }
  return [
    0,
    Math.round(g[0]! / 2),
    Math.round((g[0]! + g[1]!) / 2),
    Math.round((g[1]! + g[2]!) / 2),
    Math.round((g[2]! + g[3]!) / 2),
    width,
  ];
}

function findGutterBoundaries(ink: number[], segments: number): number[] {
  const n = ink.length;
  if (n < segments * 8) {
    return Array.from({ length: segments + 1 }, (_, i) =>
      Math.round((i * n) / segments),
    );
  }

  const smooth = movingAverage(ink, Math.max(3, Math.floor(n / 72)));
  const margin = Math.floor(n * 0.06);
  const lo = margin;
  const hi = n - margin - 1;

  const minima: { x: number; depth: number }[] = [];
  for (let x = lo + 1; x < hi; x++) {
    if (smooth[x]! <= smooth[x - 1]! && smooth[x]! <= smooth[x + 1]!) {
      const depth = (smooth[x - 1]! + smooth[x + 1]!) / 2 - smooth[x]!;
      if (depth > 0.5) minima.push({ x, depth });
    }
  }
  minima.sort((a, b) => b.depth - a.depth);

  const need = segments - 1;
  const chosen: number[] = [];
  const minGap = Math.floor(n / (segments + 1.5));

  for (const m of minima) {
    if (chosen.length >= need) break;
    if (chosen.every((c) => Math.abs(c - m.x) >= minGap)) {
      chosen.push(m.x);
    }
  }

  if (chosen.length < need) {
    return Array.from({ length: segments + 1 }, (_, i) =>
      Math.round((i * n) / segments),
    );
  }

  return boundariesFromGutterMids(chosen, n);
}

/**
 * 将单行五列商品甲片图裁成 5 枚 PNG（左→右 = 拇→小）。
 * 优先按列投影找竖缝；失败时均分宽度。
 */
export async function splitHorizontalNailRow(
  rowPng: Buffer,
  expectedCount = EXPECTED_NAILS_PER_ROW,
): Promise<Buffer[]> {
  const trimmed = await trimWhiteEdges(rowPng);
  const { data, info } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (width < expectedCount * 4 || height < 4) {
    throw new Error("单行图尺寸过小，无法裁切为五枚甲片。");
  }

  const ink = new Array<number>(width).fill(0);
  const stride = channels;
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * stride;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = stride >= 4 ? data[i + 3]! : 255;
      if (isContentPixel(r, g, b, a)) count++;
    }
    ink[x] = count;
  }

  const bounds = findGutterBoundaries(ink, expectedCount);
  if (bounds.length !== expectedCount + 1) {
    throw new Error("单行裁切边界计算失败。");
  }

  const pads: Buffer[] = [];
  for (let i = 0; i < expectedCount; i++) {
    const left = Math.max(0, bounds[i]!);
    const right = Math.min(width, bounds[i + 1]!);
    const w = right - left;
    if (w < 2) {
      throw new Error(`第 ${i + 1} 列裁切宽度过窄，请上传间距更清晰的单行五甲图。`);
    }
    const crop = await sharp(trimmed)
      .extract({ left, top: 0, width: w, height })
      .png()
      .toBuffer();
    pads.push(await trimWhiteEdges(crop));
  }
  return pads;
}

export type BuildDuplicatedRowGridOptions = {
  /** 未走模型：可对上传图尝试按枚裁切+排版面板列缝；默认 false = 模型已出带缝一行，仅整行复制 */
  skipRowModel?: boolean;
};

/**
 * - **默认（走模型）**：模型输出「一行五甲 + 列间白缝」→ 服务端**整行条带**复制为上下两排（不再切成五列，避免竖条碎裂）。
 * - **跳过模型**：在白底清晰时可按枚摆正并用排版面板的列缝拼 2×5；否则仍整行复制。
 */
export async function buildDuplicatedRowGridFromOneRow(
  oneRowBuffer: Buffer,
  layout: TenSinglesGridLayout,
  options?: BuildDuplicatedRowGridOptions,
): Promise<Buffer> {
  const layoutEff = layoutWithMinColGutterForSingleRow(layout);
  const trimmed = await trimWhiteEdges(oneRowBuffer);

  if (!options?.skipRowModel) {
    return buildDuplicatedRowStripGrid(trimmed, layoutEff);
  }

  let fiveCrops: Buffer[] | null = null;
  try {
    fiveCrops = await uprightHorizontalNailRowCrops(trimmed);
  } catch {
    try {
      const pads = await splitHorizontalNailRow(trimmed);
      fiveCrops = await uprightNailPads(pads);
    } catch {
      /* 裁切失败时整行复制 */
    }
  }

  if (
    fiveCrops?.length === EXPECTED_NAILS_PER_ROW &&
    (await fiveNailCropsLookLikeWholeNails(fiveCrops, trimmed))
  ) {
    return buildDuplicatedFiveNailRowGrid(fiveCrops, layoutEff);
  }

  return buildDuplicatedRowStripGrid(trimmed, layoutEff);
}
