/** 浏览器端：从预览图中心区域粗估主色（与投喂图自动提色预览一致） */

const CENTER_FRAC = 0.55;
const NEUTRAL_LOW = 32;
const NEUTRAL_HIGH = 240;
const MIN_CHROMA = 10;
const QUANT = 8;

function isNeutral(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (max < NEUTRAL_LOW) return true;
  if (min > NEUTRAL_HIGH) return true;
  if (chroma < MIN_CHROMA && max > 200) return true;
  if (chroma < MIN_CHROMA && max < 55) return true;
  return false;
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export async function extractDominantColorFromImageUrl(
  objectUrl: string,
): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("load failed"));
      el.crossOrigin = "anonymous";
      el.src = objectUrl;
    });

    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    const sw = img.naturalWidth * CENTER_FRAC;
    const sh = img.naturalHeight * CENTER_FRAC;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map<
      string,
      { r: number; g: number; b: number; n: number }
    >();
    let eligible = 0;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]!;
      if (a < 128) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (isNeutral(r, g, b)) continue;
      eligible++;
      const qr = Math.min(255, Math.round(r / QUANT) * QUANT);
      const qg = Math.min(255, Math.round(g / QUANT) * QUANT);
      const qb = Math.min(255, Math.round(b / QUANT) * QUANT);
      const key = `${qr},${qg},${qb}`;
      const prev = buckets.get(key);
      if (prev) {
        prev.r += r;
        prev.g += g;
        prev.b += b;
        prev.n++;
      } else {
        buckets.set(key, { r, g, b, n: 1 });
      }
    }

    if (eligible === 0) return null;
    let best: { r: number; g: number; b: number; n: number } | null = null;
    for (const b of buckets.values()) {
      if (!best || b.n > best.n) best = b;
    }
    if (!best) return null;
    return toHex(best.r / best.n, best.g / best.n, best.b / best.n);
  } catch {
    return null;
  }
}
