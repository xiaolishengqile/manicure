export const DEFAULT_WHITE_MARGIN_EXPAND_PCT = 50;
export const MIN_WHITE_MARGIN_EXPAND_PCT = 1;
export const MAX_WHITE_MARGIN_EXPAND_PCT = 200;

export function parseWhiteMarginExpandPct(
  raw: FormDataEntryValue | null,
): number {
  const s = typeof raw === "string" ? raw.trim().replace(/,/g, ".") : "";
  if (s === "") return DEFAULT_WHITE_MARGIN_EXPAND_PCT;
  const v = parseFloat(s);
  if (!Number.isFinite(v)) return DEFAULT_WHITE_MARGIN_EXPAND_PCT;
  return Math.min(
    MAX_WHITE_MARGIN_EXPAND_PCT,
    Math.max(MIN_WHITE_MARGIN_EXPAND_PCT, v),
  );
}
