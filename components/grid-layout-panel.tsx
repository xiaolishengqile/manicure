"use client";

import {
  COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX,
  COL_GUTTER_SUM_QUICK_PRESET_PCTS,
  DEFAULT_NAIL_SCALE_PCT_DRAFTS,
  DEFAULT_TEN_SINGLES_GRID_LAYOUT,
  nailScaleFromPctDraft,
  nailScalePctDraftAfterBlur,
  NAIL_SCALE_PCT_MAX,
  NAIL_SCALE_PCT_MIN,
} from "@/lib/ten-singles-grid-layout";
import type { GridLayoutPreset } from "@/lib/grid-layout-presets";

const DEFAULT_COL_WIDTH_DRAFTS = DEFAULT_TEN_SINGLES_GRID_LAYOUT.colWidthFrac.map(
  (n) => String(n),
);

function clampColGutterSumPct(n: number): number {
  return Math.min(COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX, Math.max(0, n));
}

export function GridLayoutPanel({
  modeLabel,
  colWidthDrafts,
  setColWidthDrafts,
  marginPctDraft,
  setMarginPctDraft,
  colGutterSumPct,
  setColGutterSumPct,
  rowGutterPctDraft,
  setRowGutterPctDraft,
  nailWidthPctDrafts,
  setNailWidthPctDrafts,
  nailHeightPctDrafts,
  setNailHeightPctDrafts,
  lockNailAspectRatio,
  setLockNailAspectRatio,
  nailAspectLockRatioRef,
  refreshNailAspectLockRatios,
  syncNailHeightFromWidthAt,
  syncNailWidthFromHeightAt,
  gridPresets,
  gridPresetSelectedIndex,
  setGridPresetSelectedIndex,
  gridPresetNotice,
  onApplyPreset,
  onDeletePreset,
  onSavePreset,
  gridPresetChipsRowRef,
  gridLayoutSavePresetButtonRef,
}: {
  modeLabel: string;
  colWidthDrafts: string[];
  setColWidthDrafts: React.Dispatch<React.SetStateAction<string[]>>;
  marginPctDraft: string;
  setMarginPctDraft: (v: string | ((prev: string) => string)) => void;
  colGutterSumPct: number;
  setColGutterSumPct: (v: number | ((prev: number) => number)) => void;
  rowGutterPctDraft: string;
  setRowGutterPctDraft: (v: string | ((prev: string) => string)) => void;
  nailWidthPctDrafts: string[];
  setNailWidthPctDrafts: React.Dispatch<React.SetStateAction<string[]>>;
  nailHeightPctDrafts: string[];
  setNailHeightPctDrafts: React.Dispatch<React.SetStateAction<string[]>>;
  lockNailAspectRatio: boolean;
  setLockNailAspectRatio: (v: boolean) => void;
  nailAspectLockRatioRef: React.MutableRefObject<number[]>;
  refreshNailAspectLockRatios: () => void;
  syncNailHeightFromWidthAt: (colIndex: number, widthDraft: string) => void;
  syncNailWidthFromHeightAt: (colIndex: number, heightDraft: string) => void;
  gridPresets: GridLayoutPreset[];
  gridPresetSelectedIndex: number | null;
  setGridPresetSelectedIndex: (v: number | null) => void;
  gridPresetNotice: string | null;
  onApplyPreset: (index: number) => void;
  onDeletePreset: (index: number) => void;
  onSavePreset: () => void;
  gridPresetChipsRowRef: React.RefObject<HTMLDivElement | null>;
  gridLayoutSavePresetButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  function pctDraftAfterBlur(
    raw: string,
    min: number,
    max: number,
    emptyFallback: number,
  ): string {
    const t = raw.trim().replace(/,/g, ".");
    if (t === "") return String(emptyFallback);
    const v = parseFloat(t);
    if (Number.isNaN(v)) return String(emptyFallback);
    return String(Math.min(max, Math.max(min, v)));
  }

  function colWidthDraftAfterBlur(raw: string, colIndex: number): string {
    const t = raw.trim().replace(/,/g, ".");
    if (t === "") return DEFAULT_COL_WIDTH_DRAFTS[colIndex] ?? "1";
    const v = parseFloat(t);
    if (Number.isNaN(v)) return DEFAULT_COL_WIDTH_DRAFTS[colIndex] ?? "1";
    return String(Math.min(1, Math.max(0.55, v)));
  }

  return (
    <div className="mt-4 min-w-0 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <fieldset className="w-full rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-3 lg:px-5">
        <legend className="px-1 text-xs font-semibold text-rose-800">
          白底栅格排版（可选）
        </legend>
        <div className="flex w-full min-w-0 flex-col gap-3">
          <div className="space-y-2.5">
            <p className="text-xs leading-relaxed text-zinc-600">
              五列相对宽度对应上排左→右拇→小（下排同列再重复一遍）。
              {modeLabel}
            </p>
            <p className="text-xs leading-relaxed text-rose-900/90">
              <span className="font-medium">关于「缝」：</span>
              <strong>同一行相邻美甲</strong>的左右留白用下方滑条控制：<strong>四条竖缝合计占「内区宽度」的百分之几</strong>（内区 = 去掉外留白后的中间区域）；下方会显示<strong>每条竖缝约占内宽的几%</strong>（合计÷4）。
              行与行之间的上下留白仍用「行间缝」百分比（占内高，<span className="font-mono">0</span>～<span className="font-mono">12</span>，失焦夹紧）。
              外留白失焦后会在 <span className="font-mono">0.5</span>～<span className="font-mono">8</span> 之间。
              <span className="mt-1.5 block text-zinc-700">
                若横向已贴紧仍觉得整图偏「宽」，多半是<strong>四边外留白</strong>偏大，可把<strong>外留白（占边长 %）</strong>适当<strong>调小</strong>。
              </span>
            </p>
          </div>
          <div className="min-w-0 space-y-3 border-t border-rose-100/80 pt-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p className="text-[11px] leading-snug text-zinc-500">
                五列相对宽度 + 每列格内甲片高/宽（%），100% 为默认。
                {modeLabel.includes("几何矫正")
                  ? " 几何矫正由模型排版，格内高宽不生效。"
                  : " 锁定纵横比时，改该列宽会联动该列高。"}
              </p>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-800">
                  <input
                    type="checkbox"
                    checked={lockNailAspectRatio}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setLockNailAspectRatio(on);
                      if (on) refreshNailAspectLockRatios();
                    }}
                    className="size-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-medium">锁定纵横比</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNailWidthPctDrafts([...DEFAULT_NAIL_SCALE_PCT_DRAFTS]);
                    setNailHeightPctDrafts([...DEFAULT_NAIL_SCALE_PCT_DRAFTS]);
                    nailAspectLockRatioRef.current = [1, 1, 1, 1, 1];
                  }}
                  className="text-xs font-medium text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-900"
                >
                  重设各列大小
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-x-3 sm:gap-y-2">
              {(["拇", "食", "中", "无", "小"] as const).map((lab, i) => (
                <div
                  key={lab}
                  className="flex flex-col gap-1.5 rounded-md border border-zinc-200/80 bg-white/60 px-2 py-2"
                >
                  <span className="text-xs font-semibold text-zinc-800">
                    {lab}指
                  </span>
                  <label className="flex flex-col gap-0.5 text-[11px] text-zinc-600">
                    <span>列宽</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      value={colWidthDrafts[i] ?? ""}
                      onChange={(e) => {
                        const t = e.target.value;
                        setColWidthDrafts((prev) => {
                          const next = [...prev];
                          next[i] = t;
                          return next;
                        });
                      }}
                      onBlur={() => {
                        setColWidthDrafts((prev) => {
                          const next = [...prev];
                          next[i] = colWidthDraftAfterBlur(prev[i] ?? "", i);
                          return next;
                        });
                      }}
                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[11px] text-zinc-600">
                    <span>高度 %</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      value={nailHeightPctDrafts[i] ?? ""}
                      onChange={(e) => {
                        const t = e.target.value;
                        setNailHeightPctDrafts((prev) => {
                          const next = [...prev];
                          next[i] = t;
                          return next;
                        });
                        if (lockNailAspectRatio) {
                          syncNailWidthFromHeightAt(i, t);
                        }
                      }}
                      onBlur={() => {
                        const blurred = nailScalePctDraftAfterBlur(
                          nailHeightPctDrafts[i] ?? "",
                        );
                        setNailHeightPctDrafts((prev) => {
                          const next = [...prev];
                          next[i] = blurred;
                          return next;
                        });
                        if (lockNailAspectRatio) {
                          syncNailWidthFromHeightAt(i, blurred);
                        }
                      }}
                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[11px] text-zinc-600">
                    <span>宽度 %</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      value={nailWidthPctDrafts[i] ?? ""}
                      onChange={(e) => {
                        const t = e.target.value;
                        setNailWidthPctDrafts((prev) => {
                          const next = [...prev];
                          next[i] = t;
                          return next;
                        });
                        if (lockNailAspectRatio) {
                          syncNailHeightFromWidthAt(i, t);
                        }
                      }}
                      onBlur={() => {
                        const blurred = nailScalePctDraftAfterBlur(
                          nailWidthPctDrafts[i] ?? "",
                        );
                        setNailWidthPctDrafts((prev) => {
                          const next = [...prev];
                          next[i] = blurred;
                          return next;
                        });
                        if (lockNailAspectRatio) {
                          syncNailHeightFromWidthAt(i, blurred);
                        } else {
                          nailAspectLockRatioRef.current[i] =
                            nailScaleFromPctDraft(
                              nailHeightPctDrafts[i] ?? "",
                            ) /
                            Math.max(1e-6, nailScaleFromPctDraft(blurred));
                        }
                      }}
                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              <label className="flex flex-col gap-1 text-xs text-zinc-700">
                <span className="font-medium leading-snug text-zinc-800">
                  外留白（占边长 %）
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  value={marginPctDraft}
                  onChange={(e) => setMarginPctDraft(e.target.value)}
                  onBlur={() =>
                    setMarginPctDraft((v) =>
                      pctDraftAfterBlur(v, 0.5, 8, 1.8),
                    )
                  }
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-2 text-xs text-zinc-700">
                <span className="font-medium leading-snug text-zinc-800">
                  同一行相邻美甲间距
                </span>
                <span className="text-[11px] leading-snug text-zinc-500">
                  拖动滑条：四条竖缝合计占「内区宽度」0～
                  {COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX}%（步进 0.5）
                </span>
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX}
                    step={0.5}
                    value={colGutterSumPct}
                    onChange={(e) =>
                      setColGutterSumPct(
                        clampColGutterSumPct(
                          parseFloat(e.target.value),
                        ),
                      )
                    }
                    className="h-2 min-w-0 flex-1 cursor-pointer accent-rose-600"
                    aria-valuemin={0}
                    aria-valuemax={COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX}
                    aria-valuenow={colGutterSumPct}
                    aria-label="同一行四条竖缝合计占内区宽度百分比"
                  />
                  <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900">
                    {colGutterSumPct.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-zinc-600">
                  合计约 {colGutterSumPct.toFixed(1)}% 内宽 · 每条约{" "}
                  {(colGutterSumPct / 4).toFixed(1)}% 内宽
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setColGutterSumPct(0)}
                    className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:border-rose-300 hover:bg-rose-50"
                  >
                    无
                  </button>
                  {COL_GUTTER_SUM_QUICK_PRESET_PCTS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setColGutterSumPct(pct)}
                      className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:border-rose-300 hover:bg-rose-50"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-700">
                <span className="font-medium leading-snug text-zinc-800">
                  行间缝（占内高 %）
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  value={rowGutterPctDraft}
                  onChange={(e) => setRowGutterPctDraft(e.target.value)}
                  onBlur={() =>
                    setRowGutterPctDraft((v) =>
                      pctDraftAfterBlur(v, 0, 12, 0),
                    )
                  }
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
                />
              </label>
            </div>
            <div className="flex flex-col gap-2 border-t border-rose-100/80 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
              <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto py-0.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setColWidthDrafts([...DEFAULT_COL_WIDTH_DRAFTS]);
                    setMarginPctDraft("1.8");
                    setColGutterSumPct(0);
                    setRowGutterPctDraft("0");
                    setNailWidthPctDrafts([...DEFAULT_NAIL_SCALE_PCT_DRAFTS]);
                    setNailHeightPctDrafts([...DEFAULT_NAIL_SCALE_PCT_DRAFTS]);
                    nailAspectLockRatioRef.current = [1, 1, 1, 1, 1];
                  }}
                  className="shrink-0 text-xs font-medium whitespace-nowrap text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-900"
                >
                  恢复默认排版
                </button>
                {gridPresets.length > 0 ? (
                  <span className="hidden shrink-0 text-zinc-300 sm:inline" aria-hidden>
                    |
                  </span>
                ) : null}
                <div
                  ref={gridPresetChipsRowRef}
                  className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2"
                >
                  {gridPresets.map((p, i) => (
                    <div
                      key={p.id}
                      className="relative inline-flex h-8 min-w-[2rem] shrink-0 items-stretch sm:h-9 sm:min-w-[2.25rem]"
                    >
                      <button
                        type="button"
                        onClick={() => onApplyPreset(i)}
                        title={`载入第 ${i + 1} 套；已选中时再点此可取消选中`}
                        className={`rounded-md border px-2 pr-5 text-[11px] font-semibold tabular-nums transition sm:rounded-lg sm:px-2.5 sm:pr-5 sm:text-xs ${
                          gridPresetSelectedIndex === i
                            ? "border-rose-500 bg-rose-100 text-rose-950 ring-1 ring-rose-400"
                            : "border-zinc-300 bg-white text-zinc-800 hover:border-rose-300 hover:bg-rose-50/80"
                        }`}
                      >
                        {i + 1}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeletePreset(i);
                        }}
                        className="absolute -right-1 -top-1 flex h-5 min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full border border-zinc-300 bg-white text-[11px] font-bold leading-none text-zinc-600 shadow-sm hover:border-rose-400 hover:bg-rose-50 hover:text-rose-800"
                        aria-label={`删除排版预设 ${i + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  ref={gridLayoutSavePresetButtonRef}
                  type="button"
                  onClick={onSavePreset}
                  title="保存当前栅格参数到预设"
                  className="shrink-0 whitespace-nowrap rounded-md border border-rose-400 bg-rose-600 px-2 py-1 text-[11px] font-semibold leading-none text-white shadow-sm transition hover:bg-rose-700 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-xs"
                >
                  保存配置
                </button>
              </div>
              {gridPresetNotice ? (
                <p className="min-w-0 flex-1 text-xs text-rose-800 sm:pt-0.5">
                  {gridPresetNotice}
                </p>
              ) : (
                <p className="min-w-0 flex-1 text-xs text-zinc-500 sm:pt-0.5">
                  预设保存在本机浏览器；未选中数字时保存会新增一套（最多 5 套）。再次点击已高亮的数字，或点击数字区域以外（「保存配置」除外）可取消选中。
                </p>
              )}
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
