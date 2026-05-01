/** 白底栅格排版本地预设（最多 5 套） */

import {
  COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX,
  colGutterTotalInnerWidthPctRounded,
  type InterNailColGapMode,
} from "@/lib/ten-singles-grid-layout";

export const LS_GRID_LAYOUT_PRESETS = "manicure_grid_layout_presets_v1";
export const MAX_GRID_LAYOUT_PRESETS = 5;

export type GridLayoutPresetPayload = {
  colWidthDrafts: string[];
  marginPctDraft: string;
  /** 四条竖缝合计占内宽 %，0～COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX */
  colGutterSumPctDraft: string;
  rowGutterPctDraft: string;
};

export type GridLayoutPreset = { id: string } & GridLayoutPresetPayload;

export function newGridPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function clampPct(n: number): number {
  return Math.min(
    COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX,
    Math.max(0, n),
  );
}

function normalizeColDrafts(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...fallback];
  const mapped = raw.map((c) => (typeof c === "string" ? c : String(c)));
  if (mapped.length >= 5) return mapped.slice(0, 5);
  const next = [...fallback];
  for (let i = 0; i < mapped.length; i++) next[i] = mapped[i] ?? next[i];
  return next;
}

function migrateColGutterSumPctDraft(o: Record<string, unknown>): string {
  if (
    typeof o.colGutterSumPctDraft === "string" &&
    o.colGutterSumPctDraft.trim() !== ""
  ) {
    const v = parseFloat(o.colGutterSumPctDraft);
    if (Number.isFinite(v)) return String(clampPct(v));
  }
  const raw = o.colGapMode;
  if (
    raw === "tight" ||
    raw === "half" ||
    raw === "third" ||
    raw === "fifth"
  ) {
    return String(
      colGutterTotalInnerWidthPctRounded(raw as InterNailColGapMode),
    );
  }
  const legacy =
    typeof o.colGutterPctDraft === "string"
      ? parseFloat(o.colGutterPctDraft)
      : NaN;
  if (Number.isFinite(legacy)) return String(clampPct(legacy));
  return "0";
}

/** 从 localStorage 读出 0～5 条合法预设 */
export function parseGridLayoutPresets(
  raw: string | null,
  defaultColDrafts: string[],
): GridLayoutPreset[] {
  if (raw == null || raw === "") return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: GridLayoutPreset[] = [];
    for (const entry of arr) {
      if (typeof entry !== "object" || entry === null) continue;
      const o = entry as Record<string, unknown>;
      const id =
        typeof o.id === "string" && o.id.length > 0 ? o.id : newGridPresetId();
      const colWidthDrafts = normalizeColDrafts(
        o.colWidthDrafts,
        defaultColDrafts,
      );
      const marginPctDraft =
        typeof o.marginPctDraft === "string" ? o.marginPctDraft : "1.8";
      const rowGutterPctDraft =
        typeof o.rowGutterPctDraft === "string" ? o.rowGutterPctDraft : "0";
      const colGutterSumPctDraft = migrateColGutterSumPctDraft(o);
      out.push({
        id,
        colWidthDrafts,
        marginPctDraft,
        colGutterSumPctDraft,
        rowGutterPctDraft,
      });
      if (out.length >= MAX_GRID_LAYOUT_PRESETS) break;
    }
    return out;
  } catch {
    return [];
  }
}
