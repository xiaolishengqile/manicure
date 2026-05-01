/**
 * 十枚单甲拼图 / 单甲补齐 10 支 共用的白底栅格排版参数（服务端 Sharp 拼版）。
 */

/** 五列相对宽度（拇→小），已归一化使最大值为 1 */
export type TenSinglesGridLayout = {
  readonly colWidthFrac: readonly [number, number, number, number, number];
  /** 外留白占画布边长的比例，约 0.005–0.08 */
  readonly marginFrac: number;
  /** 列与列之间总缝宽占「内宽」的比例，再均分到 4 条缝，0–0.12 */
  readonly colGutterSumFrac: number;
  /** 行与行之间缝高占「内高」的比例（仅一行缝），0–0.12 */
  readonly rowGutterSumFrac: number;
};

/** 与历史 `COL_MAX_WIDTH_FRAC` 一致，作默认 */
export const DEFAULT_COL_WIDTH_FRAC: readonly [number, number, number, number, number] = [
  1, 0.945, 0.975, 0.945, 0.905,
];

export const DEFAULT_TEN_SINGLES_GRID_LAYOUT: TenSinglesGridLayout = {
  colWidthFrac: DEFAULT_COL_WIDTH_FRAC,
  marginFrac: 0.018,
  colGutterSumFrac: 0,
  rowGutterSumFrac: 0,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** 将 5 个相对宽度压到 [0.55,1] 后按最大值归一，保证至少一列为 1 */
export function normalizeColFracs(values: number[]): [number, number, number, number, number] {
  const v = values.slice(0, 5).map((x) => clamp(Number(x), 0.55, 1));
  while (v.length < 5) v.push(1);
  const m = Math.max(...v, 1e-6);
  return [
    v[0]! / m,
    v[1]! / m,
    v[2]! / m,
    v[3]! / m,
    v[4]! / m,
  ];
}

/**
 * 从 FormData 解析栅格选项；字段均可缺省，用默认。
 * - `nailGridColWidths`: 逗号分隔五数，如 `1,0.95,0.98,0.95,0.9`
 * - `nailGridMarginPct`: 外留白占边长百分比，默认 1.8（即 0.018）
 * - `nailGridColGutterPct`: 列缝总宽占「内宽」百分比，0–12，默认 0
 * - `nailGridRowGutterPct`: 行间缝占「内高」百分比，0–12，默认 0
 */
export function parseTenSinglesGridLayoutFromFormData(
  formData: FormData,
): TenSinglesGridLayout {
  const rawCols = formData.get("nailGridColWidths");
  let colWidthFrac: [number, number, number, number, number] = [
    ...DEFAULT_COL_WIDTH_FRAC,
  ];
  if (typeof rawCols === "string" && rawCols.trim()) {
    const parts = rawCols
      .split(/[,，\s]+/)
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !Number.isNaN(n));
    if (parts.length >= 5) {
      colWidthFrac = normalizeColFracs(parts);
    }
  }

  const marginPct = parseFloat(
    String(formData.get("nailGridMarginPct") ?? "").trim(),
  );
  const marginFrac = Number.isFinite(marginPct)
    ? clamp(marginPct / 100, 0.005, 0.08)
    : DEFAULT_TEN_SINGLES_GRID_LAYOUT.marginFrac;

  const colGutterPct = parseFloat(
    String(formData.get("nailGridColGutterPct") ?? "").trim(),
  );
  const colGutterSumFrac = Number.isFinite(colGutterPct)
    ? clamp(colGutterPct / 100, 0, 0.12)
    : DEFAULT_TEN_SINGLES_GRID_LAYOUT.colGutterSumFrac;

  const rowGutterPct = parseFloat(
    String(formData.get("nailGridRowGutterPct") ?? "").trim(),
  );
  const rowGutterSumFrac = Number.isFinite(rowGutterPct)
    ? clamp(rowGutterPct / 100, 0, 0.12)
    : DEFAULT_TEN_SINGLES_GRID_LAYOUT.rowGutterSumFrac;

  return {
    colWidthFrac,
    marginFrac,
    colGutterSumFrac,
    rowGutterSumFrac,
  };
}
