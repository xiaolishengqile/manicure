export const runtime = "nodejs";
export const maxDuration = 60;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0") return true;
  if (h.endsWith(".local")) return true;
  if (h === "127.0.0.1") return true;
  return false;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体无效" }, { status: 400 });
  }
  const url =
    typeof body === "object" &&
    body !== null &&
    "url" in body &&
    typeof (body as { url: unknown }).url === "string"
      ? (body as { url: string }).url.trim()
      : "";

  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    return Response.json({ error: "仅支持 http(s) 图片地址" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "无效 URL" }, { status: 400 });
  }
  if (isBlockedHost(parsed.hostname)) {
    return Response.json({ error: "不允许的地址" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
      headers: { "User-Agent": "ManicureApp/1.0" },
    });
    if (!upstream.ok) {
      return Response.json({ error: "无法拉取该图片" }, { status: 502 });
    }
    const buf = await upstream.arrayBuffer();
    const ct =
      upstream.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream";
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Content-Disposition": 'attachment; filename="generated.png"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "下载代理失败" }, { status: 502 });
  }
}
