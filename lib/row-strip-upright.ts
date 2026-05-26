import sharp from "sharp";

const EXPECTED_NAILS = 5;

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

/** 横向闭运算：弥合甲面纵向高光造成的断裂 */
function morphCloseHorizontal(
  mask: boolean[],
  width: number,
  height: number,
  radius: number,
): boolean[] {
  const r = Math.max(1, radius);
  const dilated = new Array<boolean>(mask.length).fill(false);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = false;
      for (let dx = -r; dx <= r && !on; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width && mask[y * width + nx]!) on = true;
      }
      dilated[y * width + x] = on;
    }
  }
  const closed = new Array<boolean>(dilated.length).fill(false);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = true;
      for (let dx = -r; dx <= r && on; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= width || !dilated[y * width + nx]!) on = false;
      }
      closed[y * width + x] = on;
    }
  }
  return closed;
}

type Component = {
  pixels: { x: number; y: number }[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function findComponents(
  mask: boolean[],
  width: number,
  height: number,
): Component[] {
  const seen = new Array<boolean>(mask.length).fill(false);
  const out: Component[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]! || seen[idx]!) continue;
      const pixels: { x: number; y: number }[] = [];
      const stack = [{ x, y }];
      seen[idx] = true;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (stack.length > 0) {
        const p = stack.pop()!;
        pixels.push(p);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = p.x + dx;
          const ny = p.y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const ni = ny * width + nx;
          if (!mask[ni]! || seen[ni]!) continue;
          seen[ni] = true;
          stack.push({ x: nx, y: ny });
        }
      }
      out.push({ pixels, minX, maxX, minY, maxY });
    }
  }
  return out;
}

/** 主方向角（弧度），相对 x 轴 */
function principalAxisAngleRad(pixels: { x: number; y: number }[]): number {
  if (pixels.length < 8) return 0;
  let mx = 0;
  let my = 0;
  for (const p of pixels) {
    mx += p.x;
    my += p.y;
  }
  mx /= pixels.length;
  my /= pixels.length;
  let mu20 = 0;
  let mu02 = 0;
  let mu11 = 0;
  for (const p of pixels) {
    const dx = p.x - mx;
    const dy = p.y - my;
    mu20 += dx * dx;
    mu02 += dy * dy;
    mu11 += dx * dy;
  }
  return 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
}

async function pngMeta(buf: Buffer): Promise<{ w: number; h: number }> {
  const m = await sharp(buf).metadata();
  return { w: m.width ?? 1, h: m.height ?? 1 };
}

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
      if (isContentPixel(r, g, b, a)) return y;
    }
  }
  return 0;
}

/** 刚性旋转至竖直（长轴沿 y），保持甲尖朝下（高 ≥ 宽） */
async function uprightNailCrop(crop: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(crop).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixels: { x: number; y: number }[] = [];
  const stride = channels;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * stride;
      if (isContentPixel(data[i]!, data[i + 1]!, data[i + 2]!, stride >= 4 ? data[i + 3]! : 255)) {
        pixels.push({ x, y });
      }
    }
  }
  if (pixels.length < 12) return trimWhiteEdges(crop);

  const theta = principalAxisAngleRad(pixels);
  const deg = (90 - (theta * 180) / Math.PI + 360) % 360;
  let out = await sharp(crop)
    .rotate(deg, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
  out = await trimWhiteEdges(out);
  let { w, h } = await pngMeta(out);
  if (w > h) {
    out = await sharp(out)
      .rotate(90, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    out = await trimWhiteEdges(out);
    ({ w, h } = await pngMeta(out));
  }
  return out;
}

async function extractFiveNailCrops(trimmed: Buffer): Promise<Buffer[]> {
  const { data, info } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const stride = channels;
  const mask = new Array<boolean>(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * stride;
      mask[y * width + x] = isContentPixel(
        data[i]!,
        data[i + 1]!,
        data[i + 2]!,
        stride >= 4 ? data[i + 3]! : 255,
      );
    }
  }

  const closeRadius = Math.max(3, Math.round(width / 120));
  const closed = morphCloseHorizontal(mask, width, height, closeRadius);
  let components = findComponents(closed, width, height);
  const minArea = Math.max(80, Math.round((width * height) / 200));
  components = components.filter((c) => c.pixels.length >= minArea);
  components.sort((a, b) => {
    const ax = (a.minX + a.maxX) / 2;
    const bx = (b.minX + b.maxX) / 2;
    return ax - bx;
  });

  if (components.length !== EXPECTED_NAILS) {
    throw new Error(
      `无法稳定分出 5 枚甲片（检测到 ${components.length} 块），请使用间距更清晰的一行五甲图。`,
    );
  }

  const pad = Math.max(2, Math.round(width * 0.004));
  const crops: Buffer[] = [];
  for (const c of components) {
    const left = Math.max(0, c.minX - pad);
    const top = Math.max(0, c.minY - pad);
    const w = Math.min(width - left, c.maxX - c.minX + 1 + 2 * pad);
    const h = Math.min(height - top, c.maxY - c.minY + 1 + 2 * pad);
    const crop = await sharp(trimmed)
      .extract({ left, top, width: w, height: h })
      .png()
      .toBuffer();
    crops.push(await uprightNailCrop(crop));
  }
  return crops;
}

async function composeUprightRow(nails: Buffer[]): Promise<Buffer> {
  const metas = await Promise.all(nails.map((b) => pngMeta(b)));
  const heights = metas.map((m) => m.h);
  const maxH = Math.max(...heights);
  const gap = Math.max(6, Math.round(maxH * 0.06));
  const totalW = metas.reduce((s, m) => s + m.w, 0) + gap * (nails.length - 1);
  const rootYs = await Promise.all(nails.map((b) => firstContentRowYFromTop(b)));
  const R = Math.max(...rootYs);

  const composites: sharp.OverlayOptions[] = [];
  let x = 0;
  for (let i = 0; i < nails.length; i++) {
    const { w, h } = metas[i]!;
    const topOff = Math.round(R - rootYs[i]!);
    composites.push({ input: nails[i]!, left: x, top: topOff });
    x += w + gap;
  }

  return sharp({
    create: {
      width: Math.max(1, totalW),
      height: Math.max(1, maxH),
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * 将一行五甲逐枚刚性旋转至竖直（yaw≈0°），再拼回单行条带。
 * 失败时抛出，由调用方决定是否回退原图。
 */
export async function uprightHorizontalNailRow(oneRowBuffer: Buffer): Promise<Buffer> {
  const trimmed = await trimWhiteEdges(oneRowBuffer);
  const crops = await extractFiveNailCrops(trimmed);
  return composeUprightRow(crops);
}
