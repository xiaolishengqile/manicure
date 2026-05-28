import sharp from "sharp";

/** 斜排成片：竖直 2×5 整组刚性旋转（与方案 A「~45° 平行长轴」一致） */
export const DIAGONAL_PACKSHOT_ROTATE_DEG = 42;

/**
 * 将竖直白底 2×5 栅格整图旋转为斜拍观感（白底扩边，不裁切甲片）。
 */
export async function applyDiagonalPackshotRotation(
  uprightGridPng: Buffer,
  rotateDeg: number = DIAGONAL_PACKSHOT_ROTATE_DEG,
): Promise<Buffer> {
  return sharp(uprightGridPng)
    .rotate(rotateDeg, {
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png({ compressionLevel: 6 })
    .toBuffer();
}
