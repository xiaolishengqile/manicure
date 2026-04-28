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
 * EXIF 转正 → 再旋转 180°，使甲尖朝下、甲根朝上（发给模型前的单图/单甲规范化）。
 */
export async function exifRotate180TipDownToPng(
  input: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const afterExif = await sharp(input).rotate().toBuffer();
    const tipDown = await sharp(afterExif).rotate(180).toBuffer();
    const png = await sharp(tipDown).png({ compressionLevel: 7 }).toBuffer();
    return { buffer: png, mime: "image/png" };
  } catch {
    return { buffer: input, mime };
  }
}

/**
 * 拼图前单格：先 `exifRotate180TipDownToPng`，再缩小到格内上限，不叠角标。
 */
export async function normalizeTenSingleNailForCollageCell(
  input: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const { buffer: tipDown } = await exifRotate180TipDownToPng(input, mime);
    const png = await sharp(tipDown)
      .resize({ width: 520, height: 520, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 7 })
      .toBuffer();
    return { buffer: png, mime: "image/png" };
  } catch {
    return { buffer: input, mime };
  }
}
