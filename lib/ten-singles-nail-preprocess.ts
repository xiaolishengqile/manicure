import sharp from "sharp";

/**
 * 拼图前单格：EXIF 转正 → 再旋转 180°（使甲片指尖朝下）→ 缩小到格内上限，不叠角标。
 * 拼成整图发给图像模型之前，对每枚统一做上述处理。
 */
export async function normalizeTenSingleNailForCollageCell(
  input: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const afterExif = await sharp(input).rotate().toBuffer();
    const tipDown = await sharp(afterExif).rotate(180).toBuffer();
    const png = await sharp(tipDown)
      .resize({ width: 520, height: 520, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 7 })
      .toBuffer();
    return { buffer: png, mime: "image/png" };
  } catch {
    return { buffer: input, mime };
  }
}
