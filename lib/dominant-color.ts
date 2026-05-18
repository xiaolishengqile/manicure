import sharp from "sharp";

/** 服务端从平面稿量化的主色（排除近黑/近白中性像素后占比最高） */
export type DominantColorSwatch = {
  hex: string;
  rgb: { r: number; g: number; b: number };
  /** 占「可计色」像素的比例，0–100 */
  sharePct: number;
};

const SAMPLE_MAX = 128;
const QUANT_STEP = 8;
/** 平面稿：只统计中心区域，避开边缘抗锯齿与留白 */
const CENTER_PANEL_FRAC = 0.55;
/** 近黑 / 近白 / 低饱和浅灰不计入（避免文字与留白抢主色） */
const NEUTRAL_LOW = 32;
const NEUTRAL_HIGH = 240;
const MIN_CHROMA = 10;

function isNeutralPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (max < NEUTRAL_LOW) return true;
  if (min > NEUTRAL_HIGH) return true;
  if (chroma < MIN_CHROMA && max > 200) return true;
  if (chroma < MIN_CHROMA && max < 55) return true;
  return false;
}

function quantizeChannel(v: number): number {
  return Math.min(255, Math.round(v / QUANT_STEP) * QUANT_STEP);
}

function bucketKey(r: number, g: number, b: number): string {
  return `${quantizeChannel(r)},${quantizeChannel(g)},${quantizeChannel(b)}`;
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export type ExtractDominantColorOptions = {
  /** 默认 center_panel：适合方形平面稿；full 用于特殊裁切 */
  focus?: "full" | "center_panel";
};

async function sharpPipelineForDominantColor(
  input: Buffer,
  focus: "full" | "center_panel",
): Promise<sharp.Sharp> {
  const rotated = sharp(input).rotate();
  if (focus === "full") return rotated;

  const meta = await rotated.clone().metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 8 || h < 8) return rotated;

  const cw = Math.max(4, Math.round(w * CENTER_PANEL_FRAC));
  const ch = Math.max(4, Math.round(h * CENTER_PANEL_FRAC));
  const left = Math.round((w - cw) / 2);
  const top = Math.round((h - ch) / 2);
  return sharp(input)
    .rotate()
    .extract({ left, top, width: cw, height: ch });
}

/**
 * 从图片缓冲提取占比最高的「面板色」（排除近黑/近白后统计）。
 * 失败时 return null，不阻断生图。
 */
export async function extractDominantColorFromBuffer(
  input: Buffer,
  options?: ExtractDominantColorOptions,
): Promise<DominantColorSwatch | null> {
  const focus = options?.focus ?? "center_panel";
  try {
    const pipeline = await sharpPipelineForDominantColor(input, focus);
    const { data, info } = await pipeline
      .resize(SAMPLE_MAX, SAMPLE_MAX, {
        fit: "inside",
        withoutEnlargement: false,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    if (channels < 3) return null;

    type Bucket = { r: number; g: number; b: number; count: number };
    const buckets = new Map<string, Bucket>();
    let eligible = 0;

    for (let i = 0; i < data.length; i += channels) {
      const a = channels >= 4 ? data[i + 3]! : 255;
      if (a < 128) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (isNeutralPixel(r, g, b)) continue;

      eligible++;
      const key = bucketKey(r, g, b);
      const prev = buckets.get(key);
      if (prev) {
        prev.r += r;
        prev.g += g;
        prev.b += b;
        prev.count++;
      } else {
        buckets.set(key, { r, g, b, count: 1 });
      }
    }

    if (eligible === 0 || buckets.size === 0) return null;

    let best: Bucket | null = null;
    for (const b of buckets.values()) {
      if (!best || b.count > best.count) best = b;
    }
    if (!best) return null;

    const r = Math.round(best.r / best.count);
    const g = Math.round(best.g / best.count);
    const b = Math.round(best.b / best.count);
    const sharePct = Math.round((best.count / eligible) * 1000) / 10;

    return {
      hex: toHex(r, g, b),
      rgb: { r, g, b },
      sharePct,
    };
  } catch {
    return null;
  }
}

export type PanelColorHintSource = "auto" | "user";

/** 将量化的主色写入英文提示词（供图像模型作数值锚点） */
export function appendDominantColorHintToPrompt(
  basePrompt: string,
  swatch: DominantColorSwatch,
  options?: { panelLabel?: string; source?: PanelColorHintSource },
): string {
  const label = options?.panelLabel?.trim() || "PRIMARY PANEL";
  const { hex, rgb, sharePct } = swatch;
  const source = options?.source ?? "auto";

  if (source === "user") {
    return `${basePrompt}

---
USER-SELECTED ${label} FILL COLOR (mandatory — **recolor** the product background):
- **Hex:** ${hex}
- **sRGB:** (${rgb.r}, ${rgb.g}, ${rgb.b})
- **Task:** replace the **large solid background / panel fill** on the front face (and any visible back panel areas that were a flat color in the references) with **exactly** this color. **Keep** all typography, logos, icons, layout, and white/light line art from the uploaded flats — **only** change the dominant panel color fields.
- **White text & icons:** stay clean white (or the same light color as on the flat); do **not** tint lettering with the panel hue.
- **Forbidden:** ignoring this hex and keeping the original flat background color; forbidden global grade that shifts ${hex} warmer/cooler/brighter.
- Matte laminate base between small highlights must average to ${hex}.
（中文：用户指定袋身主色 ${hex}，须**替换**平面稿大面积底色为此色，保留 Logo/文案版式与白字。）`;
  }

  return `${basePrompt}

---
SERVER-MEASURED DOMINANT ${label} COLOR (from uploaded flat artwork — numeric anchor; **match this fill**, do not drift):
- **Hex:** ${hex}
- **sRGB:** (${rgb.r}, ${rgb.g}, ${rgb.b})
- **Coverage:** ~${sharePct}% of counted non-neutral pixels on the reference (near-white text/background and near-black lines excluded from this statistic).
- **Requirement:** the main printed panel / background fill on the hero product face must match **this exact color family** — same hue, saturation, and lightness within tight tolerance. **Forbidden:** global white-balance, LUT, or saturation shifts that move the panel away from ${hex}. Specular foil highlights are allowed only as **small, local** glare streaks — the **matte printed base** between highlights must still average to ${hex}; **forbidden** making the whole face read as a brighter/saturer blue than the flat.
- **How to judge match:** compare the **flat center panel** of the reference to the **non-highlight** areas of the 3D face — not the brightest specular pixels.
（中文：服务端已从上传稿**中心底色区**提取主色 ${hex}；成片**哑光印刷底色**（去掉高光后）须与此一致；禁止整体偏亮/偏饱和。肉眼对比时勿拿平面稿去比 3D 图上的白色反光条。）`;
}
