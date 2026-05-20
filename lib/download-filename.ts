/**
 * 生成结果图下载文件名，避免多次生成或同批多图落盘时重名。
 */

const INVALID_CHARS = /[\\/:*?"<>|]/g;

/** 本批生成开始时刻，用于区分不同次点击「生成」 */
export function formatDownloadBatchStamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-` +
    `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}

/** 标签/模式名等片段：去掉非法字符、压缩空白，限制长度 */
export function sanitizeFilenameSegment(
  raw: string,
  maxLen = 24,
): string {
  const s = raw
    .trim()
    .replace(INVALID_CHARS, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, maxLen)
    .replace(/_+$/, "");
  return s || "图";
}

export function buildResultDownloadFilename(args: {
  batchStamp: string;
  label?: string;
  index: number;
  ext: string;
  prefix?: string;
}): string {
  const { batchStamp, label, index, ext, prefix = "美甲生成" } = args;
  const tag = sanitizeFilenameSegment(label ?? `图${index + 1}`);
  const ord = String(index + 1).padStart(2, "0");
  const safeExt = ext.replace(/^\./, "").toLowerCase() || "png";
  return `${prefix}_${batchStamp}_${tag}_${ord}.${safeExt}`;
}
