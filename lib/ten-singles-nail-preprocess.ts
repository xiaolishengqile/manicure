import sharp from "sharp";

/** 与画布「指尖朝下」一致：甲尖（较窄端）应在图像下方；若检测到在上方则旋转 180°。 */
function isForegroundPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 14) return false;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const sat = maxc <= 1 ? 0 : (maxc - minc) / maxc;
  if (lum > 250 && sat < 0.06) return false;
  if (lum > 244 && sat < 0.1) return false;
  return true;
}

function rowWidth(
  mask: Uint8Array,
  width: number,
  height: number,
  y: number,
  xmin: number,
  xmax: number,
): number {
  let minx = xmax + 1;
  let maxx = xmin - 1;
  for (let x = xmin; x <= xmax; x++) {
    if (mask[y * width + x]) {
      minx = Math.min(minx, x);
      maxx = Math.max(maxx, x);
    }
  }
  return maxx >= minx ? maxx - minx + 1 : 0;
}

function avgRowWidthInBand(
  mask: Uint8Array,
  width: number,
  height: number,
  xmin: number,
  xmax: number,
  y0: number,
  y1: number,
): number {
  let sum = 0;
  let n = 0;
  for (let y = y0; y <= y1 && y < height; y++) {
    const w = rowWidth(mask, width, height, y, xmin, xmax);
    if (w > 0) {
      sum += w;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

function colHeight(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  ymin: number,
  ymax: number,
): number {
  let miny = ymax + 1;
  let maxy = ymin - 1;
  for (let y = ymin; y <= ymax; y++) {
    if (mask[y * width + x]) {
      miny = Math.min(miny, y);
      maxy = Math.max(maxy, y);
    }
  }
  return maxy >= miny ? maxy - miny + 1 : 0;
}

function avgColHeightInBand(
  mask: Uint8Array,
  width: number,
  height: number,
  ymin: number,
  ymax: number,
  x0: number,
  x1: number,
): number {
  let sum = 0;
  let n = 0;
  for (let x = x0; x <= x1 && x < width; x++) {
    const h = colHeight(mask, width, height, x, ymin, ymax);
    if (h > 0) {
      sum += h;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

/**
 * 基于「甲尖一侧横向更窄」的启发式，判断是否需要 180° 翻转。
 * 以竖长甲片为主；明显横长时不做 180（避免误判）。
 */
function shouldFlip180ForTipDownward(
  rgba: Uint8Array,
  width: number,
  height: number,
  channels: number,
): boolean {
  const stride = channels;
  const mask = new Uint8Array(width * height);
  let fg = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * stride;
      const r = rgba[i]!;
      const g = rgba[i + 1]!;
      const b = rgba[i + 2]!;
      const a = stride >= 4 ? rgba[i + 3]! : 255;
      if (isForegroundPixel(r, g, b, a)) {
        mask[y * width + x] = 1;
        fg++;
      }
    }
  }
  if (fg < width * height * 0.0015) return false;

  let ymin = height;
  let ymax = 0;
  let xmin = width;
  let xmax = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        ymin = Math.min(ymin, y);
        ymax = Math.max(ymax, y);
        xmin = Math.min(xmin, x);
        xmax = Math.max(xmax, x);
      }
    }
  }
  const bw = xmax - xmin + 1;
  const bh = ymax - ymin + 1;
  if (bw < 6 || bh < 6) return false;

  const verticalDominant = bh >= bw * 0.72;

  if (verticalDominant) {
    const band = Math.max(2, Math.floor(bh / 3));
    const topY0 = ymin;
    const topY1 = Math.min(ymin + band - 1, ymax);
    const botY0 = Math.max(ymax - band + 1, ymin);
    const botY1 = ymax;
    const avgTop = avgRowWidthInBand(mask, width, height, xmin, xmax, topY0, topY1);
    const avgBot = avgRowWidthInBand(mask, width, height, xmin, xmax, botY0, botY1);
    if (avgTop < 2 || avgBot < 2) return false;
    const topNarrower = avgTop / avgBot;
    const botNarrower = avgBot / avgTop;
    if (topNarrower < 0.8) return true;
    if (botNarrower < 0.8) return false;
    return false;
  }

  const band = Math.max(2, Math.floor(bw / 3));
  const leftX0 = xmin;
  const leftX1 = Math.min(xmin + band - 1, xmax);
  const rightX0 = Math.max(xmax - band + 1, xmin);
  const rightX1 = xmax;
  const avgLeft = avgColHeightInBand(mask, width, height, ymin, ymax, leftX0, leftX1);
  const avgRight = avgColHeightInBand(mask, width, height, ymin, ymax, rightX0, rightX1);
  if (avgLeft < 2 || avgRight < 2) return false;
  if (avgLeft / avgRight < 0.8) return true;
  if (avgRight / avgLeft < 0.8) return false;
  return false;
}

/**
 * 拼图前单格：EXIF 转正 + 指尖朝下（必要时 180°），不叠角标（角标在整图拼接时统一画）。
 */
export async function normalizeTenSingleNailForCollageCell(
  input: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const afterExif = await sharp(input).rotate().toBuffer();
    const { data, info } = await sharp(afterExif)
      .resize({ width: 520, height: 520, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const flip = shouldFlip180ForTipDownward(
      new Uint8Array(data),
      info.width,
      info.height,
      info.channels,
    );
    const oriented = flip
      ? await sharp(afterExif).rotate(180).toBuffer()
      : afterExif;
    const png = await sharp(oriented).png({ compressionLevel: 7 }).toBuffer();
    return { buffer: png, mime: "image/png" };
  } catch {
    return { buffer: input, mime };
  }
}
