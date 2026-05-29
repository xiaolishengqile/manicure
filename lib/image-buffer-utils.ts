const MAX_IMAGE_DOWNLOAD_BYTES = 50 * 1024 * 1024;

export function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0") return true;
  if (h.endsWith(".local")) return true;
  if (h === "127.0.0.1") return true;
  return false;
}

export function imageDataUrlToBuffer(url: string): Buffer | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(url);
  if (!match) return null;
  const mime = match[1]?.toLowerCase() ?? "";
  if (!mime.startsWith("image/")) return null;
  const payload = match[3] ?? "";
  if (match[2]) return Buffer.from(payload, "base64");
  return Buffer.from(decodeURIComponent(payload));
}

export async function imageUrlToBuffer(
  url: string,
  opts?: { replicateDownloadAuth?: string; timeoutMs?: number },
): Promise<Buffer> {
  const dataBuffer = imageDataUrlToBuffer(url);
  if (dataBuffer) return dataBuffer;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("模型返回的单甲图片地址无效。");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("模型返回的单甲图片地址不是 http(s)。");
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error("模型返回的单甲图片地址不允许下载。");
  }

  const headers: Record<string, string> = { "User-Agent": "ManicureApp/1.0" };
  if (
    opts?.replicateDownloadAuth &&
    (parsed.hostname === "api.replicate.com" ||
      parsed.hostname.endsWith("replicate.delivery"))
  ) {
    headers.Authorization = `Bearer ${opts.replicateDownloadAuth}`;
  }

  const upstream = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(opts?.timeoutMs ?? 60_000),
    headers,
  });
  if (!upstream.ok) {
    throw new Error("无法下载模型生成的单甲图片。");
  }
  const contentType =
    upstream.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (
    contentType &&
    !contentType.startsWith("image/") &&
    contentType !== "application/octet-stream"
  ) {
    throw new Error("模型生成的单甲结果不是图片格式。");
  }
  return Buffer.from(await upstream.arrayBuffer());
}

/**
 * 网关常返回短期 https URL；浏览器 <img> 易受跨域/防盗链影响显示破图。
 * 在服务端拉取后转为 data URL 再写入 JSON，前端即可稳定显示。
 */
export async function toClientDisplayableImageUrl(
  urlOrData: string | null,
  replicateDownloadAuth?: string,
): Promise<string | null> {
  if (!urlOrData) return null;
  if (urlOrData.startsWith("data:")) return urlOrData;
  try {
    const buf = await imageUrlToBuffer(urlOrData, {
      replicateDownloadAuth,
      timeoutMs: 25_000,
    });
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return urlOrData;
  }
}
