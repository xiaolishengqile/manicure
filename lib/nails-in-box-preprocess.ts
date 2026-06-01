import sharp from "sharp";

/** 竖长款式图判定：高宽比超过此值视为「偏长」 */
const TALL_NAIL_ART_ASPECT = 1.12;

/**
 * 入盒前压缩竖长款式图：整组等比缩小并居中铺白底，降低模型把外盒拉高的视觉倾向。
 * 不改变甲片相对比例，仅缩小整图在画布上的占比并限制画布高宽比。
 */
export async function compactLongNailArtForBoxWindow(input: Buffer): Promise<Buffer> {
  const upright = await sharp(input).rotate().toBuffer();
  const meta = await sharp(upright).metadata();
  const w = Math.max(1, meta.width ?? 1);
  const h = Math.max(1, meta.height ?? 1);
  const aspect = h / w;

  if (aspect <= TALL_NAIL_ART_ASPECT) {
    return upright;
  }

  const contentScale = aspect >= 1.55 ? 0.62 : aspect >= 1.35 ? 0.68 : 0.74;
  const maxHeightToWidth = 1.06;

  const scaledW = Math.max(1, Math.round(w * contentScale));
  const scaledH = Math.max(1, Math.round(h * contentScale));
  const scaled = await sharp(upright)
    .resize(scaledW, scaledH, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  let canvasW = Math.max(scaledW, Math.round(scaledH / maxHeightToWidth));
  let canvasH = Math.max(scaledH, Math.round(canvasW * maxHeightToWidth));
  if (canvasH / canvasW > maxHeightToWidth) {
    canvasW = Math.ceil(canvasH / maxHeightToWidth);
  }

  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: scaled, gravity: "center" }])
    .png({ compressionLevel: 7 })
    .toBuffer();
}

export function shouldCompactLongNailArtForBox(
  raw: FormDataEntryValue | null,
): boolean {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return s === "1" || s === "true" || s === "yes" || s === "on";
}
