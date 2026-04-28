import sharp from "sharp";

/** 白底参考拼图边长；与常见 image edit 上限兼容，单格仍有足够细节 */
const COLLAGE_SIDE = 1600;

/**
 * 列 0–4 = 拇指、食指、中指、无名指、小指：拇最大、中指第二大、食≈名、小指最小。
 * 宽度上限级差刻意收窄，避免参考图里相邻指「悬殊过大」导致模型把成品画成玩具比例。
 */
const COL_MAX_WIDTH_FRAC: readonly number[] = [1, 0.945, 0.975, 0.945, 0.905];

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
    let topOff = Math.round(R - ry);

    // 若底会超出格高，画布会裁掉下半截 → 视觉上变成「底边齐平」。改为先缩放到格内，仍从 topOff 贴顶，保住甲根对齐。
    if (topOff + ih > ch) {
      const targetH = Math.max(1, ch - topOff);
      imgBuf = await sharp(imgBuf)
        .resize({
          width: cw,
          height: targetH,
          fit: "contain",
          position: "north",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
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
 * 每行内强制「甲根」同一水平线（按内容顶边对齐）；列间仅轻微左大右小。
 */
export async function buildTenSinglesCollageReference(
  cellPngBuffers: Buffer[],
): Promise<Buffer> {
  if (cellPngBuffers.length !== 10) {
    throw new Error("buildTenSinglesCollageReference requires exactly 10 buffers");
  }
  const W = COLLAGE_SIDE;
  const H = COLLAGE_SIDE;
  /** 外边距与格间缝：尽量小，让十枚在画布里更紧凑（仍留 1px 级缝隙避免拼版粘连感） */
  const margin = Math.round(W * 0.018);
  const gutter = Math.max(2, Math.round(W * 0.0025));
  const cols = 5;
  const rows = 2;
  const innerW = W - 2 * margin;
  const innerH = H - 2 * margin;
  const cellW = (innerW - (cols - 1) * gutter) / cols;
  const cellH = (innerH - (rows - 1) * gutter) / rows;

  const cw = Math.round(cellW);
  const ch = Math.round(cellH);

  const rowInners: Buffer[][] = [[], []];

  for (let i = 0; i < 10; i++) {
    const r = Math.floor(i / 5);
    const c = i % 5;
    const trimmed = await trimWhiteEdges(cellPngBuffers[i]!);
    const frac = COL_MAX_WIDTH_FRAC[c] ?? 0.87;
    const maxW = Math.max(1, Math.round(cw * frac));
    const inner = await sharp(trimmed)
      .resize({
        width: maxW,
        height: ch,
        fit: "contain",
        position: "north",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();
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
      const top = Math.round(margin + r * (cellH + gutter));
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
