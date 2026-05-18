import type { DominantColorSwatch } from "@/lib/dominant-color";

export type PanelColorSource = "auto" | "manual";

/** 袋身 / 盒面常用预设（可点选） */
export const PANEL_COLOR_PRESETS: { hex: string; label: string }[] = [
  { hex: "#D0C3D2", label: "藕紫" },
  { hex: "#B8D9F0", label: "天蓝" },
  { hex: "#E8B4C8", label: "粉红" },
  { hex: "#F5D0C4", label: "蜜桃" },
  { hex: "#C8E6D0", label: "薄荷" },
  { hex: "#E8DCC8", label: "米杏" },
  { hex: "#C4B8E8", label: "薰衣草" },
  { hex: "#F0E8A8", label: "奶油黄" },
];

const HEX_RE = /^#?([0-9A-Fa-f]{6})$/;

export function normalizePanelColorHex(raw: string): string | null {
  const t = raw.trim();
  const m = HEX_RE.exec(t);
  if (!m) return null;
  return `#${m[1]!.toUpperCase()}`;
}

export function parsePanelColorHex(
  entry: FormDataEntryValue | null,
): string | null {
  if (entry == null) return null;
  return normalizePanelColorHex(typeof entry === "string" ? entry : "");
}

export function parsePanelColorSource(
  entry: FormDataEntryValue | null,
): PanelColorSource {
  const s = typeof entry === "string" ? entry.trim().toLowerCase() : "";
  return s === "manual" ? "manual" : "auto";
}

export function swatchFromHex(
  hex: string,
  sharePct = 100,
): DominantColorSwatch | null {
  const norm = normalizePanelColorHex(hex);
  if (!norm) return null;
  const h = norm.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { hex: norm, rgb: { r, g, b }, sharePct };
}

export const DEFAULT_PANEL_COLOR_HEX = PANEL_COLOR_PRESETS[1]!.hex;
