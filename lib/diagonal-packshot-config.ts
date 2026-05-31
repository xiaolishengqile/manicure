/** 斜排成片：竖直 2×5 整组刚性旋转（未传参时的默认角度） */
export const DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG = 25;

/** @deprecated 使用 {@link DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG} */
export const DIAGONAL_PACKSHOT_ROTATE_DEG = DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG;

const MIN_DIAGONAL_PACKSHOT_ROTATE_DEG = 0;
const MAX_DIAGONAL_PACKSHOT_ROTATE_DEG = 89;

/** 斜排上传：一行五甲 vs 已是两行（完整 2×5） */
export type DiagonalUploadRows = "one_row" | "two_rows";

export function parseDiagonalUploadRows(
  raw: FormDataEntryValue | null,
): DiagonalUploadRows {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "two_rows" || s === "two" || s === "2" || s === "2x5") {
    return "two_rows";
  }
  return "one_row";
}

/** FormData `diagonalPackshotRotateDeg`：空或非法时用默认 25° */
export function parseDiagonalPackshotRotateDeg(
  raw: FormDataEntryValue | null,
): number {
  const s = typeof raw === "string" ? raw.trim().replace(/,/g, ".") : "";
  if (s === "") return DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG;
  return Math.min(
    MAX_DIAGONAL_PACKSHOT_ROTATE_DEG,
    Math.max(MIN_DIAGONAL_PACKSHOT_ROTATE_DEG, n),
  );
}
