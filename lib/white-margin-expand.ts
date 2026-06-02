import sharp from "sharp";

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 as const };

/**
 * 不 EXIF 转正、不 trim：原图像素居中铺到正方形白底，再按百分比四周扩白。
 * expandPercent=50 → 画布边长 = 正方形边长 × 1.5。
 */
export async function expandWhiteMarginSquare(
  input: Buffer,
  expandPercent: number,
): Promise<Buffer> {
  const source = sharp(input, { failOn: "none" });
  const meta = await source.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w <= 0 || h <= 0) {
    throw new Error("无法读取图片尺寸。");
  }

  const side = Math.max(w, h);
  const left = Math.floor((side - w) / 2);
  const top = Math.floor((side - h) / 2);
  const right = side - w - left;
  const bottom = side - h - top;

  const squared = await source
    .extend({ top, bottom, left, right, background: WHITE })
    .png()
    .toBuffer();

  const pct = Math.max(0, expandPercent);
  const newSide = Math.max(1, Math.round(side * (1 + pct / 100)));
  const pad = Math.floor((newSide - side) / 2);
  const padExtra = newSide - side - pad * 2;

  return sharp(squared)
    .extend({
      top: pad,
      bottom: pad + padExtra,
      left: pad,
      right: pad + padExtra,
      background: WHITE,
    })
    .png({ compressionLevel: 7 })
    .toBuffer();
}
