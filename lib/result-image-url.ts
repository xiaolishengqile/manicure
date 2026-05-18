/**
 * 浏览器端：统一处理中转站返回的 data URL / https URL / 展示用 blob URL。
 */

export function extFromDataUrl(u: string): string {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif)/i.exec(u);
  if (!m) return "png";
  const t = m[1]!.toLowerCase();
  return t === "jpeg" ? "jpg" : t;
}

export function extFromContentType(ct: string | null): string {
  if (!ct) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("gif")) return "gif";
  return "png";
}

export type FetchRemoteImageBlob = (httpUrl: string) => Promise<Blob>;

/** data:（含贞贞 b64_json 转成的 data URL）、blob:（大图展示）、http(s):（llmgateway 等临时链） */
export async function resultImageUrlToBlob(
  url: string,
  fetchRemote?: FetchRemoteImageBlob,
): Promise<Blob> {
  const u = url.trim();
  if (u.startsWith("data:")) {
    const res = await fetch(u);
    return res.blob();
  }
  if (u.startsWith("blob:")) {
    const res = await fetch(u);
    if (!res.ok) {
      throw new Error("无法读取已生成的图片（blob 已失效，请重新生成）。");
    }
    return res.blob();
  }
  if (u.startsWith("http://") || u.startsWith("https://")) {
    if (fetchRemote) {
      return fetchRemote(u);
    }
    const res = await fetch(u, { mode: "cors" });
    if (!res.ok) {
      throw new Error("无法直接拉取图片，请使用应用内下载。");
    }
    return res.blob();
  }
  throw new Error("不支持的图片地址格式");
}

export async function triggerDownloadFromResultUrl(
  url: string,
  filename: string,
  fetchRemote?: FetchRemoteImageBlob,
): Promise<void> {
  const u = url.trim();
  if (u.startsWith("data:image/")) {
    const a = document.createElement("a");
    a.href = u;
    a.download = filename;
    a.rel = "noopener";
    a.click();
    return;
  }
  const blob = await resultImageUrlToBlob(u, fetchRemote);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener";
    a.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
