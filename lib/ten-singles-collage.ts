import sharp from "sharp";

import type { TenSinglesGridLayout } from "@/lib/ten-singles-grid-layout";
import { DEFAULT_TEN_SINGLES_GRID_LAYOUT } from "@/lib/ten-singles-grid-layout";

/** 白底参考拼图边长；与常见 image edit 上限兼容，单格仍有足够细节 */
const COLLAGE_SIDE = 1600;

function clampInnerFillFrac(frac: number): number {
  return Math.min(1, Math.max(0.45, frac));
}

/** 去掉近似白边 */
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

/** 从顶向下第一行含「非近似白」像素的 y（作为甲根/上缘对齐基准） */
async function firstContentRowYFromTop(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const stride = channels;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * stride;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = stride >= 4 ? data[i + 3]! : 255;
      if (a < 22) continue;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const sat = maxc <= 1 ? 0 : (maxc - minc) / maxc;
      if (lum < 252 || sat > 0.04) return y;
    }
  }
  return 0;
}

async function pngMeta(buf: Buffer): Promise<{ w: number; h: number }> {
  const m = await sharp(buf).metadata();
  return { w: m.width ?? 1, h: m.height ?? 1 };
}

/** 格内甲片宽/高缩放（按列；锁定纵横比时由界面保证该列两值同比例） */
async function applyNailScaleToInner(
  inner: Buffer,
  layout: TenSinglesGridLayout,
  colIndex: number,
): Promise<Buffer> {
  const c = colIndex % 5;
  const wScale = layout.nailColWidthScale[c] ?? 1;
  const hScale = layout.nailColHeightScale[c] ?? 1;
  if (
    Math.abs(wScale - 1) < 1e-6 &&
    Math.abs(hScale - 1) < 1e-6
  ) {
    return inner;
  }
  const { w, h } = await pngMeta(inner);
  return sharp(inner)
    .resize({
      width: Math.max(1, Math.round(w * wScale)),
      height: Math.max(1, Math.round(h * hScale)),
      fit: "fill",
    })
    .png()
    .toBuffer();
}

/** 相对原始 inner 等比缩放（用于整行放不下时） */
async function resizeInnerProportional(inner: Buffer, scale: number): Promise<Buffer> {
  const { w } = await pngMeta(inner);
  const nw = Math.max(1, Math.round(w * scale));
  return sharp(inner).resize({ width: nw }).png().toBuffer();
}

function rowRootBaselineFeasible(rootYs: number[], hs: number[], ch: number): boolean {
  const maxRoot = Math.max(...rootYs);
  const minCap = Math.min(...rootYs.map((ry, i) => ch + ry - hs[i]!));
  return maxRoot <= minCap + 0.75;
}

/**
 * 同一行五枚：甲根（内容顶边）对齐到同一水平线，再置入 cw×ch 白底格；必要时整行等比缩小直至可行。
 */
async function placeRowWithAlignedRoots(
  innerBuffers: Buffer[],
  cw: number,
  ch: number,
): Promise<Buffer[]> {
  const originals = [...innerBuffers];
  let scale = 1;
  let current = originals;
  let rootYs = await Promise.all(current.map((b) => firstContentRowYFromTop(b)));
  let hs = await Promise.all(current.map(async (b) => (await pngMeta(b)).h));

  while (!rowRootBaselineFeasible(rootYs, hs, ch) && scale > 0.02) {
    scale *= 0.91;
    current = await Promise.all(originals.map((b) => resizeInnerProportional(b, scale)));
    rootYs = await Promise.all(current.map((b) => firstContentRowYFromTop(b)));
    hs = await Promise.all(current.map(async (b) => (await pngMeta(b)).h));
  }

  /** 同一行甲根线：所有「内容顶」对齐到本行最大的 rootY（甲根在上、指尖朝下时即画面上方同一直线） */
  const R = Math.max(...rootYs);

  const out: Buffer[] = [];
  for (let i = 0; i < current.length; i++) {
    let imgBuf = current[i]!;
    const ry = rootYs[i]!;
    let { w: iw, h: ih } = await pngMeta(imgBuf);
    const topOff = Math.round(R - ry);

    // 若底会超出格高，等比缩小至格内，仍从 topOff 贴顶，保住甲根对齐与原始宽高比。
    if (topOff + ih > ch) {
      const targetH = Math.max(1, ch - topOff);
      const scale = targetH / ih;
      imgBuf = await sharp(imgBuf)
        .resize({
          width: Math.max(1, Math.round(iw * scale)),
          height: targetH,
          fit: "fill",
        })
        .png()
        .toBuffer();
      const m2 = await pngMeta(imgBuf);
      iw = m2.w;
      ih = m2.h;
    }

    const padL = Math.max(0, Math.floor((cw - iw) / 2));
    const cell = await sharp({
      create: {
        width: cw,
        height: ch,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{ input: imgBuf, left: padL, top: topOff }])
      .png()
      .toBuffer();
    out.push(cell);
  }
  return out;
}

/** 同一行五枚：甲根对齐，画布宽 = 甲片宽（无槽内居中留白，便于紧凑横排） */
async function alignRowRootsTightPack(
  innerBuffers: Buffer[],
  ch: number,
): Promise<Buffer[]> {
  const originals = [...innerBuffers];
  let scale = 1;
  let current = originals;
  let rootYs = await Promise.all(current.map((b) => firstContentRowYFromTop(b)));
  let hs = await Promise.all(current.map(async (b) => (await pngMeta(b)).h));

  while (!rowRootBaselineFeasible(rootYs, hs, ch) && scale > 0.02) {
    scale *= 0.91;
    current = await Promise.all(originals.map((b) => resizeInnerProportional(b, scale)));
    rootYs = await Promise.all(current.map((b) => firstContentRowYFromTop(b)));
    hs = await Promise.all(current.map(async (b) => (await pngMeta(b)).h));
  }

  const R = Math.max(...rootYs);
  const out: Buffer[] = [];
  for (let i = 0; i < current.length; i++) {
    let imgBuf = current[i]!;
    const ry = rootYs[i]!;
    let { w: iw, h: ih } = await pngMeta(imgBuf);
    const topOff = Math.round(R - ry);

    if (topOff + ih > ch) {
      const targetH = Math.max(1, ch - topOff);
      const shrink = targetH / ih;
      imgBuf = await sharp(imgBuf)
        .resize({
          width: Math.max(1, Math.round(iw * shrink)),
          height: targetH,
          fit: "fill",
        })
        .png()
        .toBuffer();
      const m2 = await pngMeta(imgBuf);
      iw = m2.w;
      ih = m2.h;
    }

    const cell = await sharp({
      create: {
        width: iw,
        height: ch,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{ input: imgBuf, left: 0, top: topOff }])
      .png()
      .toBuffer();
    out.push(cell);
  }
  return out;
}

/** 按各列槽宽分别居中置入（用于拇→小列宽不等的单甲复制 10 格） */
async function placeRowWithAlignedRootsVariableCells(
  innerBuffers: Buffer[],
  colWidths: readonly number[],
  ch: number,
): Promise<Buffer[]> {
  const originals = [...innerBuffers];
  let scale = 1;
  let current = originals;
  let rootYs = await Promise.all(current.map((b) => firstContentRowYFromTop(b)));
  let hs = await Promise.all(current.map(async (b) => (await pngMeta(b)).h));

  while (!rowRootBaselineFeasible(rootYs, hs, ch) && scale > 0.02) {
    scale *= 0.91;
    current = await Promise.all(originals.map((b) => resizeInnerProportional(b, scale)));
    rootYs = await Promise.all(current.map((b) => firstContentRowYFromTop(b)));
    hs = await Promise.all(current.map(async (b) => (await pngMeta(b)).h));
  }

  const R = Math.max(...rootYs);
  const out: Buffer[] = [];
  for (let i = 0; i < current.length; i++) {
    let imgBuf = current[i]!;
    const ry = rootYs[i]!;
    let { w: iw, h: ih } = await pngMeta(imgBuf);
    const topOff = Math.round(R - ry);
    const cw = Math.max(1, colWidths[i] ?? 1);

    if (topOff + ih > ch) {
      const targetH = Math.max(1, ch - topOff);
      const shrink = targetH / ih;
      imgBuf = await sharp(imgBuf)
        .resize({
          width: Math.max(1, Math.round(iw * shrink)),
          height: targetH,
          fit: "fill",
        })
        .png()
        .toBuffer();
      const m2 = await pngMeta(imgBuf);
      iw = m2.w;
      ih = m2.h;
    }

    const padL = Math.max(0, Math.floor((cw - iw) / 2));
    const cell = await sharp({
      create: {
        width: cw,
        height: ch,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{ input: imgBuf, left: padL, top: topOff }])
      .png()
      .toBuffer();
    out.push(cell);
  }
  return out;
}

/** 五列槽宽按拇→小宽度缩放比例分配内区（扣除列缝后） */
function proportionalColWidthsPx(
  innerW: number,
  gutterPx: number,
  widthScales: readonly number[],
): number[] {
  const cols = widthScales.length;
  const sum = widthScales.reduce((a, b) => a + b, 0) || 1;
  const avail = innerW - (cols - 1) * gutterPx;
  return widthScales.map((s) => Math.max(1, Math.round((avail * s) / sum)));
}

function cellSlotBadgeSvg(slot1Based: number, box: number): Buffer {
  const fs = Math.max(12, Math.floor(box * 0.45));
  const svg = `<svg width="${box}" height="${box}" xmlns="http://www.w3.org/2000/svg">
  <rect x="1" y="1" width="${box - 2}" height="${box - 2}" rx="4" fill="#ffffff" stroke="#222" stroke-width="1.5"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    font-size="${fs}" fill="#111" font-family="system-ui,sans-serif" font-weight="700">${slot1Based}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

/**
 * 将已归一化的 10 枚 PNG（顺序 = 用户第 1–10 格）拼成一张 2×5 白底参考图，左上起第 1–5 为上排。
 * 每行内强制「甲根」同一水平线（按内容顶边对齐）；列宽与缝由 `layout` 控制。
 */
export async function buildTenSinglesCollageReference(
  cellPngBuffers: Buffer[],
  layout: TenSinglesGridLayout = DEFAULT_TEN_SINGLES_GRID_LAYOUT,
): Promise<Buffer> {
  if (cellPngBuffers.length !== 10) {
    throw new Error("buildTenSinglesCollageReference requires exactly 10 buffers");
  }
  const W = COLLAGE_SIDE;
  const H = COLLAGE_SIDE;
  const margin = Math.round(W * layout.marginFrac);
  const cols = 5;
  const rows = 2;
  const innerW = W - 2 * margin;
  const innerH = H - 2 * margin;
  const gutter =
    cols > 1
      ? Math.round((innerW * layout.colGutterSumFrac) / (cols - 1))
      : 0;
  const rowGutter =
    rows > 1
      ? Math.round((innerH * layout.rowGutterSumFrac) / (rows - 1))
      : 0;
  const cellW = (innerW - (cols - 1) * gutter) / cols;
  const cellH = (innerH - (rows - 1) * rowGutter) / rows;

  const cw = Math.round(cellW);
  const ch = Math.round(cellH);

  const rowInners: Buffer[][] = [[], []];

  for (let i = 0; i < 10; i++) {
    const r = Math.floor(i / 5);
    const c = i % 5;
    const trimmed = await trimWhiteEdges(cellPngBuffers[i]!);
    const frac = layout.colWidthFrac[c] ?? 0.87;
    const maxW = Math.max(1, Math.round(cw * frac));
    const inner = await applyNailScaleToInner(
      await sharp(trimmed)
        .resize({
          width: maxW,
          height: ch,
          fit: "contain",
          position: "north",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer(),
      layout,
      c,
    );
    rowInners[r]!.push(inner);
  }

  const alignedRows: Buffer[][] = [];
  for (let r = 0; r < rows; r++) {
    alignedRows.push(await placeRowWithAlignedRoots(rowInners[r]!, cw, ch));
  }

  const composites: sharp.OverlayOptions[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = Math.round(margin + c * (cellW + gutter));
      const top = Math.round(margin + r * (cellH + rowGutter));
      const fitted = alignedRows[r]![c]!;
      composites.push({ input: fitted, left, top });
      const slot1 = r * cols + c + 1;
      const badge = Math.min(36, Math.round(Math.min(cw, ch) * 0.14));
      composites.push({
        input: cellSlotBadgeSvg(slot1, badge),
        left: left + 4,
        top: top + ch - badge - 4,
      });
    }
  }

  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/** 行内甲片最大高度占行格比例（参考零售 2×5，勿顶满半幅画布） */
const SINGLE_GRID_ROW_NAIL_MAX_HEIGHT_FRAC = 0.72;

/**
 * 将一枚模型高清化后的单甲复制成 2×5 尺码合集。
 * 设计约束（与用户参考图一致）：
 * - 同一行内 **高度相同**（拇→小仅宽度递减）
 * - 拇指保持投喂/抠图宽高比，其余指在同高下按宽度 % 收窄
 * - 按实际甲宽紧凑横排，列间距由 layout.colGutterSumFrac 控制
 */
export async function buildScaledSingleNailGrid(
  singleNailBuffer: Buffer,
  layout: TenSinglesGridLayout = DEFAULT_TEN_SINGLES_GRID_LAYOUT,
): Promise<Buffer> {
  const W = COLLAGE_SIDE;
  const H = COLLAGE_SIDE;
  const margin = Math.round(W * layout.marginFrac);
  const cols = 5;
  const rows = 2;
  const innerW = W - 2 * margin;
  const innerH = H - 2 * margin;
  const gutter =
    cols > 1
      ? Math.round((innerW * layout.colGutterSumFrac) / (cols - 1))
      : 0;
  const rowGutter =
    rows > 1
      ? Math.round((innerH * layout.rowGutterSumFrac) / (rows - 1))
      : 0;
  const cellH = (innerH - (rows - 1) * rowGutter) / rows;
  const ch = Math.round(cellH);

  const trimmed = await trimWhiteEdges(singleNailBuffer);
  const { w: sourceW, h: sourceH } = await pngMeta(trimmed);
  const sourceAspect = sourceW / Math.max(1, sourceH);
  const refWScale = layout.nailColWidthScale[0] ?? 1;
  const refHScale = layout.nailColHeightScale[0] ?? 1;
  const widthScaleSum = layout.nailColWidthScale.reduce((a, b) => a + b, 0) || 1;

  const innerRowW = innerW - (cols - 1) * gutter;
  const thumbSlotW = (innerRowW * refWScale) / widthScaleSum;
  /** 行内统一甲高：不超行格 72%，且拇指按投喂宽高比能在宽度预算内放下 */
  const rowTargetH = Math.max(
    1,
    Math.min(
      Math.round((ch * SINGLE_GRID_ROW_NAIL_MAX_HEIGHT_FRAC) / refHScale),
      Math.round(thumbSlotW / Math.max(1e-6, sourceAspect)),
    ),
  );

  const rowInners: Buffer[][] = [[], []];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wScale = layout.nailColWidthScale[c] ?? 1;
      const hScale = layout.nailColHeightScale[c] ?? 1;
      const targetH = Math.max(1, Math.round(rowTargetH * (hScale / refHScale)));
      const targetW = Math.max(
        1,
        Math.round(targetH * sourceAspect * (wScale / refWScale)),
      );
      const inner = await sharp(trimmed)
        .resize({
          width: targetW,
          height: targetH,
          fit: "fill",
        })
        .png()
        .toBuffer();
      rowInners[r]!.push(inner);
    }
  }

  const alignedRow0 = await alignRowRootsTightPack(rowInners[0]!, ch);
  const rowWidths = await Promise.all(alignedRow0.map(async (b) => (await pngMeta(b)).w));
  const totalRowW =
    rowWidths.reduce((a, b) => a + b, 0) + (cols - 1) * gutter;
  let packX = margin + Math.max(0, Math.round((innerW - totalRowW) / 2));
  const colLefts = rowWidths.map((w) => {
    const left = packX;
    packX += w + gutter;
    return left;
  });

  const alignedRows: Buffer[][] = [
    alignedRow0,
    await alignRowRootsTightPack(rowInners[1]!, ch),
  ];

  const composites: sharp.OverlayOptions[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      composites.push({
        input: alignedRows[r]![c]!,
        left: colLefts[c]!,
        top: Math.round(margin + r * (cellH + rowGutter)),
      });
    }
  }

  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * 单行五枚（已裁切）→ 复制为上下两排 2×5 **成品图**。
 * - 无角标（区别于 buildTenSinglesCollageReference）
 * - 行高按内容收紧，两排纵向居中，避免半幅空格子
 * - 仅用 colWidthFrac 作列宽上限，不强制拉高到整格（保甲型/长短与指尖阶梯）
 */
export async function buildDuplicatedFiveNailRowGrid(
  fiveNailBuffers: Buffer[],
  layout: TenSinglesGridLayout = DEFAULT_TEN_SINGLES_GRID_LAYOUT,
): Promise<Buffer> {
  if (fiveNailBuffers.length !== 5) {
    throw new Error("buildDuplicatedFiveNailRowGrid requires exactly 5 buffers");
  }

  const W = COLLAGE_SIDE;
  const H = COLLAGE_SIDE;
  const margin = Math.round(W * layout.marginFrac);
  const cols = 5;
  const rows = 2;
  const innerW = W - 2 * margin;
  const innerH = H - 2 * margin;
  const gutter =
    cols > 1
      ? Math.round((innerW * layout.colGutterSumFrac) / (cols - 1))
      : 0;
  const rowGutter =
    rows > 1
      ? Math.round((innerH * layout.rowGutterSumFrac) / (rows - 1))
      : 0;
  const cellW = (innerW - (cols - 1) * gutter) / cols;
  const cellH = (innerH - (rows - 1) * rowGutter) / rows;
  const cw = Math.round(cellW);
  const chCap = Math.round(cellH);

  const prepared: Buffer[] = [];
  for (let c = 0; c < cols; c++) {
    let buf = await trimWhiteEdges(fiveNailBuffers[c]!);
    const maxW = Math.max(1, Math.round(cw * (layout.colWidthFrac[c] ?? 0.87)));
    const { w } = await pngMeta(buf);
    if (w > maxW) {
      buf = await sharp(buf)
        .resize({ width: maxW, withoutEnlargement: true })
        .png()
        .toBuffer();
    }
    prepared.push(await applyNailScaleToInner(buf, layout, c));
  }

  const heights = await Promise.all(prepared.map(async (b) => (await pngMeta(b)).h));
  const maxH = Math.max(...heights);
  const chRow = Math.max(1, Math.min(chCap, maxH + 6));

  const rowCells = await placeRowWithAlignedRoots(prepared, cw, chRow);
  const blockH = rows * chRow + (rows - 1) * rowGutter;
  const blockTop = margin + Math.max(0, Math.round((innerH - blockH) / 2));

  const composites: sharp.OverlayOptions[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      composites.push({
        input: rowCells[c]!,
        left: Math.round(margin + c * (cellW + gutter)),
        top: Math.round(blockTop + r * (chRow + rowGutter)),
      });
    }
  }

  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/** 单行复制成双行：条带占内区宽/高的比例上限（1 = 铺满内区，外留白仅由 marginFrac 控制） */
export const SINGLE_ROW_STRIP_MAX_INNER_FILL = 1;

/**
 * 整行条带 → 原样复制为上下两排 2×5 成品（不裁成 5 枚，避免高光竖条误判甲缝）。
 * 条带等比缩放至内区上限，两行块在内区居中；拇→小比例与甲尖阶梯保留自源图。
 */
export async function buildDuplicatedRowStripGrid(
  oneRowBuffer: Buffer,
  layout: TenSinglesGridLayout = DEFAULT_TEN_SINGLES_GRID_LAYOUT,
  options?: { maxInnerFillFrac?: number },
): Promise<Buffer> {
  const fill = clampInnerFillFrac(options?.maxInnerFillFrac ?? SINGLE_ROW_STRIP_MAX_INNER_FILL);
  const W = COLLAGE_SIDE;
  const H = COLLAGE_SIDE;
  const margin = Math.round(W * layout.marginFrac);
  const rows = 2;
  const innerW = W - 2 * margin;
  const innerH = H - 2 * margin;
  const rowGutter =
    rows > 1
      ? Math.round((innerH * layout.rowGutterSumFrac) / (rows - 1))
      : 0;
  const maxRowH = Math.max(1, (innerH - rowGutter) / rows);
  const targetW = innerW * fill;
  const targetRowH = maxRowH * fill;

  let strip = await trimWhiteEdges(oneRowBuffer);
  const { w, h } = await pngMeta(strip);
  if (w < 8 || h < 8) {
    throw new Error("单行图尺寸过小，无法拼成 2×5。");
  }

  const scale = Math.min(targetW / w, targetRowH / h);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  strip = await sharp(strip).resize({ width: nw, height: nh }).png().toBuffer();

  const blockH = rows * nh + (rows - 1) * rowGutter;
  const blockTop = margin + Math.max(0, Math.round((innerH - blockH) / 2));
  const left = margin + Math.max(0, Math.round((innerW - nw) / 2));

  const composites: sharp.OverlayOptions[] = [
    { input: strip, left, top: blockTop },
    { input: strip, left, top: Math.round(blockTop + nh + rowGutter) },
  ];

  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * 已是两行/2×5 的商品图：整图等比缩放后居中铺进标准画布（不复制、不裁十枚）。
 * 供斜排「跳过模型」路径在旋转前使用。
 */
export async function buildTwoRowStripGrid(
  twoRowBuffer: Buffer,
  layout: TenSinglesGridLayout = DEFAULT_TEN_SINGLES_GRID_LAYOUT,
  options?: { maxInnerFillFrac?: number },
): Promise<Buffer> {
  const fill = clampInnerFillFrac(options?.maxInnerFillFrac ?? SINGLE_ROW_STRIP_MAX_INNER_FILL);
  const W = COLLAGE_SIDE;
  const H = COLLAGE_SIDE;
  const margin = Math.round(W * layout.marginFrac);
  const innerW = W - 2 * margin;
  const innerH = H - 2 * margin;
  const targetW = innerW * fill;
  const targetH = innerH * fill;

  let block = await trimWhiteEdges(twoRowBuffer);
  const { w, h } = await pngMeta(block);
  if (w < 8 || h < 8) {
    throw new Error("两行图尺寸过小，无法铺进画布。");
  }

  const scale = Math.min(targetW / w, targetH / h);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  block = await sharp(block).resize({ width: nw, height: nh }).png().toBuffer();

  const left = margin + Math.max(0, Math.round((innerW - nw) / 2));
  const top = margin + Math.max(0, Math.round((innerH - nh) / 2));

  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: block, left, top }])
    .png({ compressionLevel: 6 })
    .toBuffer();
}
