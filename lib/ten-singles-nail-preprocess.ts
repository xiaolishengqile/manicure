import sharp from "sharp";

/** 仅 EXIF 转正并导出 PNG，不强制 180°（用于「从实拍抠多枚」模式，保留拍摄朝向）。 */
export async function exifUprightToPng(
  input: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const afterExif = await sharp(input).rotate().toBuffer();
    const png = await sharp(afterExif).png({ compressionLevel: 7 }).toBuffer();
    return { buffer: png, mime: "image/png" };
  } catch {
    return { buffer: input, mime };
  }
}

/**
 * 拼图前单格：仅 EXIF 转正，再缩小到格内上限，不叠角标（不整图 180°）。
 */
export async function normalizeTenSingleNailForCollageCell(
  input: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const { buffer: upright } = await exifUprightToPng(input, mime);
    const png = await sharp(upright)
      .resize({ width: 520, height: 520, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 7 })
      .toBuffer();
    return { buffer: png, mime: "image/png" };
  } catch {
    return { buffer: input, mime };
  }
}
