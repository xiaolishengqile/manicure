/**
 * 十枚单甲拼图 / 单甲补齐 10 支 共用的白底栅格排版参数（服务端 Sharp 拼版）。
 */

/** 四条竖缝合计占「内宽」百分比 — 与滑条、解析上限一致 */
export const COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX = 35;

/** 滑条下方「一键填入」参考值（与略疏/适中/较疏档位一致） */
export const COL_GUTTER_SUM_QUICK_PRESET_PCTS = [14, 21, 29] as const;

/** 同一行内相邻两列之间的竖向留白（内部用 k×列槽换算，界面用「占内宽 %」更好懂） */
export type InterNailColGapMode = "tight" | "half" | "third" | "fifth";

/** 四条竖缝宽度之和 ÷ 去掉外留白后的内区宽度（0～1） */
export function colGutterTotalFracForMode(mode: InterNailColGapMode): number {
  return colGutterSumFracFromInterNailMode(mode);
}

/** 四条竖缝合计约占内宽的整数百分比（用于文案） */
export function colGutterTotalInnerWidthPctRounded(mode: InterNailColGapMode): number {
  return Math.round(colGutterTotalFracForMode(mode) * 100);
}

/** 单条竖缝约占内宽的整数百分比 */
export function colGutterEachInnerWidthPctRounded(mode: InterNailColGapMode): number {
  const s = colGutterTotalFracForMode(mode);
  if (s <= 1e-9) return 0;
  return Math.round((s / 4) * 100);
}

function interNailColGapOptionLabel(mode: InterNailColGapMode): string {
  if (mode === "tight") {
    return "无（四条竖缝合计 0% 内宽）";
  }
  const total = colGutterTotalInnerWidthPctRounded(mode);
  const each = colGutterEachInnerWidthPctRounded(mode);
  const title =
    mode === "fifth" ? "略疏" : mode === "third" ? "适中" : "较疏";
  return `${title}（合计≈${total}% 内宽，每条缝≈${each}%）`;
}

export const INTER_NAIL_COL_GAP_OPTIONS: {
  value: InterNailColGapMode;
  label: string;
}[] = [
  { value: "tight", label: interNailColGapOptionLabel("tight") },
  { value: "fifth", label: interNailColGapOptionLabel("fifth") },
  { value: "third", label: interNailColGapOptionLabel("third") },
  { value: "half", label: interNailColGapOptionLabel("half") },
];

/** 五列相对宽度（拇→小），已归一化使最大值为 1 */
export type TenSinglesGridLayout = {
  readonly colWidthFrac: readonly [number, number, number, number, number];
  /** 外留白占画布边长的比例，约 0.005–0.08 */
  readonly marginFrac: number;
  /** 四条列缝总宽占「内宽」的比例；与 `interNailColGapMode` 一致时由 k 推导：4k/(5+4k) */
  readonly colGutterSumFrac: number;
  /** 行与行之间缝高占「内高」的比例（仅一行缝），0–0.12 */
  readonly rowGutterSumFrac: number;
  /** 列缝相对列槽宽；缺省表示由旧版百分比字段解析 */
  readonly interNailColGapMode?: InterNailColGapMode | null;
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
  interNailColGapMode: "tight",
};

/**
 * 列槽等宽划分：innerW = 5·cellW + 4·gap，且 gap = k·cellW ⇒ 四条缝占内宽比例 4k/(5+4k)。
 */
export function colGutterSumFracFromInterNailMode(
  mode: InterNailColGapMode,
): number {
  const k =
    mode === "tight"
      ? 0
      : mode === "half"
        ? 0.5
        : mode === "third"
          ? 1 / 3
          : 0.2;
  if (k <= 0) return 0;
  return (4 * k) / (5 + 4 * k);
}

function parseInterNailColGapModeRaw(
  raw: FormDataEntryValue | null,
): InterNailColGapMode | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (
    s === "tight" ||
    s === "half" ||
    s === "third" ||
    s === "fifth"
  ) {
    return s;
  }
  return null;
}

/** 将任意「列缝合计占内宽 %」迁到离散档位（兼容旧数据） */
export function nearestInterNailColGapModeFromLegacyPct(
  pct0To100: number,
): InterNailColGapMode {
  const S = clamp(pct0To100 / 100, 0, 0.35);
  if (S <= 1e-9) return "tight";
  const modes: InterNailColGapMode[] = ["tight", "fifth", "third", "half"];
  let best: InterNailColGapMode = "tight";
  let bestD = Infinity;
  for (const m of modes) {
    const Sm = colGutterSumFracFromInterNailMode(m);
    const d = Math.abs(Sm - S);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

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
 * - `nailGridColGapMode`: `tight` | `half` | `third` | `fifth`（相邻列缝宽 = k×列槽宽，优先）
 * - `nailGridColGutterPct`: 四条竖缝合计占「内宽」百分比（无 `nailGridColGapMode` 时使用），0–35，默认 0
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

  const gapMode = parseInterNailColGapModeRaw(formData.get("nailGridColGapMode"));
  let colGutterSumFrac: number;
  let interNailColGapMode: InterNailColGapMode | null = null;
  if (gapMode !== null) {
    interNailColGapMode = gapMode;
    colGutterSumFrac = colGutterSumFracFromInterNailMode(gapMode);
  } else {
    const colGutterPct = parseFloat(
      String(formData.get("nailGridColGutterPct") ?? "").trim(),
    );
    const maxColGutterSumFrac = COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX / 100;
    colGutterSumFrac = Number.isFinite(colGutterPct)
      ? clamp(colGutterPct / 100, 0, maxColGutterSumFrac)
      : DEFAULT_TEN_SINGLES_GRID_LAYOUT.colGutterSumFrac;
    interNailColGapMode = null;
  }

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
    interNailColGapMode,
  };
}

/**
 * 供「白底栅格 · 仅抠出已有甲片」等纯模型排版场景：把与 Sharp 拼图一致的数值写进提示词。
 */
export function buildWhiteGridLayoutPromptAddendum(
  layout: TenSinglesGridLayout,
): string {
  const [c0, c1, c2, c3, c4] = layout.colWidthFrac;
  const marginPct = (layout.marginFrac * 100).toFixed(2);
  const colGutterPct = (layout.colGutterSumFrac * 100).toFixed(1);
  const colGutterEachPct = ((layout.colGutterSumFrac / 4) * 100).toFixed(1);
  const rowGutterPct = (layout.rowGutterSumFrac * 100).toFixed(2);
  const gapRuleEn = `- **Horizontal spacing between adjacent nail columns:** the **combined width of the four vertical white gaps** between the five columns = **${colGutterPct}%** of the **inner width** (after outer margins), split evenly — each gap ≈ **${colGutterEachPct}%** of inner width. If 0%, columns abut horizontally except natural cell fit.`;
  const gapRuleZh = `**相邻列留白**：四条竖缝**合计**占「内区宽度」约 **${colGutterPct}%**，**每条竖缝**约 **${colGutterEachPct}%**（内区 = 去掉外留白后的中间区域）；`;
  return `

USER-SUPPLIED GRID LAYOUT (mandatory proportions — match this modular sheet math on the square canvas):
- **Outer margin / quiet border:** **${marginPct}%** of the **canvas side length** on all four sides (uniform white band).
- **Inner area** = canvas minus that margin. Within the inner rectangle, lay out **2 rows × 5 columns** (columns 1→5 = thumb → index → middle → ring → pinky, left to right).
- **Column width weights** (relative horizontal budget per column, already normalized so max = 1): **${c0}, ${c1}, ${c2}, ${c3}, ${c4}**. Each nail’s horizontal span in its cell should respect its column’s share vs neighbors.
${gapRuleEn}
- **Single horizontal gutter between the two rows** = **${rowGutterPct}%** of the **inner height**. If 0, the two rows abut vertically within the inner area.
- Keep **cuticle / root tops** on one straight horizontal line per row; keep the finger-size ladder subtle and retail-realistic.

（用户指定的白底栅格数值：**外留白**约 ${marginPct}% 边长；五列相对宽 ${c0}、${c1}、${c2}、${c3}、${c4}（已归一）；${gapRuleZh}**行间缝**占内高约 ${rowGutterPct}%。须按上述比例控制留白与列宽。）`;
}
