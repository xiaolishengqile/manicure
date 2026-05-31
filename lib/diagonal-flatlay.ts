import sharp from "sharp";

import { DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG } from "@/lib/diagonal-packshot-config";

export {
  DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG,
  DIAGONAL_PACKSHOT_ROTATE_DEG,
  parseDiagonalPackshotRotateDeg,
} from "@/lib/diagonal-packshot-config";

/**
 * 将竖直白底 2×5 栅格整图旋转为斜拍观感（白底扩边，不裁切甲片）。
 */
export async function applyDiagonalPackshotRotation(
  uprightGridPng: Buffer,
  rotateDeg: number = DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG,
): Promise<Buffer> {
  return sharp(uprightGridPng)
    .rotate(rotateDeg, {
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png({ compressionLevel: 6 })
    .toBuffer();
}
