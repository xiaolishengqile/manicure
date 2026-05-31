"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_COL_GUTTER_PCT_DRAFT,
  DEFAULT_NAIL_HEIGHT_PCT_DRAFTS,
  DEFAULT_NAIL_WIDTH_PCT_DRAFTS,
  nailScalePctDraftAfterBlur,
} from "@/lib/ten-singles-grid-layout";

const LS_GRID_TEMPLATES = "nail-grid-templates";
const MAX_TEMPLATES = 5;

interface GridTemplate {
  id: string;
  name: string;
  nailWidthPctDrafts: string[];
  nailHeightPctDrafts: string[];
  rowGutterPctDraft: string;
  colGutterPctDraft: string;
}

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

export function GridLayoutPanel({
  nailWidthPctDrafts,
  setNailWidthPctDrafts,
  nailHeightPctDrafts,
  setNailHeightPctDrafts,
  rowGutterPctDraft,
  setRowGutterPctDraft,
  colGutterPctDraft,
  setColGutterPctDraft,
}: {
  nailWidthPctDrafts: string[];
  setNailWidthPctDrafts: React.Dispatch<React.SetStateAction<string[]>>;
  nailHeightPctDrafts: string[];
  setNailHeightPctDrafts: React.Dispatch<React.SetStateAction<string[]>>;
  rowGutterPctDraft: string;
  setRowGutterPctDraft: (v: string | ((prev: string) => string)) => void;
  colGutterPctDraft: string;
  setColGutterPctDraft: (v: string | ((prev: string) => string)) => void;
}) {
  const [templates, setTemplates] = useState<GridTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_GRID_TEMPLATES);
      if (saved) {
        setTemplates(JSON.parse(saved));
      }
    } catch {
      // localStorage 不可用
    }
  }, []);

  function persistTemplates(updated: GridTemplate[]) {
    try {
      localStorage.setItem(LS_GRID_TEMPLATES, JSON.stringify(updated));
      setTemplates(updated);
    } catch {
      // localStorage 不可用
    }
  }

  function saveTemplate() {
    if (templates.length >= MAX_TEMPLATES) return;
    const id = Date.now().toString(36);
    const newTemplate: GridTemplate = {
      id,
      name: `模版${templates.length + 1}`,
      nailWidthPctDrafts: [...nailWidthPctDrafts],
      nailHeightPctDrafts: [...nailHeightPctDrafts],
      rowGutterPctDraft,
      colGutterPctDraft,
    };
    persistTemplates([...templates, newTemplate]);
    setActiveTemplateId(id);
  }

  function loadTemplate(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setNailWidthPctDrafts([...template.nailWidthPctDrafts]);
    setNailHeightPctDrafts([...template.nailHeightPctDrafts]);
    setRowGutterPctDraft(template.rowGutterPctDraft);
    setColGutterPctDraft(template.colGutterPctDraft);
    setActiveTemplateId(id);
  }

  function deleteTemplate(id: string) {
    const updated = templates.filter((t) => t.id !== id);
    persistTemplates(updated);
    if (activeTemplateId === id) {
      setActiveTemplateId(null);
    }
  }

  return (
    <div className="mt-4 min-w-0 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <fieldset className="w-full rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-3 lg:px-5">
        <legend className="px-1 text-xs font-semibold text-rose-800">
          白底栅格排版（可选）
        </legend>
        <div className="flex w-full min-w-0 flex-col gap-3">
          <p className="text-xs leading-relaxed text-zinc-600">
            单甲补齐：调整每指甲片的高宽比例和间距。
          </p>

          {/* 每指高度和宽度 */}
          <div className="min-w-0 space-y-3 border-t border-rose-100/80 pt-3">
            <p className="text-[11px] leading-snug text-zinc-500">
              每指甲片的缩放比例（%），100% 为默认大小。
            </p>
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
                        setActiveTemplateId(null);
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
                        setActiveTemplateId(null);
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
                      }}
                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* 行间距和列间距 */}
          <div className="grid grid-cols-1 gap-3 border-t border-rose-100/80 pt-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-700">
              <span className="font-medium leading-snug text-zinc-800">
                行间距 %
              </span>
              <span className="text-[11px] leading-snug text-zinc-500">
                上下两行之间的距离（占内高百分比）
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={rowGutterPctDraft}
                onChange={(e) => {
                  setRowGutterPctDraft(e.target.value);
                  setActiveTemplateId(null);
                }}
                onBlur={() =>
                  setRowGutterPctDraft((v) =>
                    pctDraftAfterBlur(v, 0, 20, 0),
                  )
                }
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-700">
              <span className="font-medium leading-snug text-zinc-800">
                列间距 %
              </span>
              <span className="text-[11px] leading-snug text-zinc-500">
                左右相邻美甲之间的距离（负值可让甲片更紧凑）
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={colGutterPctDraft}
                onChange={(e) => {
                  setColGutterPctDraft(e.target.value);
                  setActiveTemplateId(null);
                }}
                onBlur={() =>
                  setColGutterPctDraft((v) =>
                    pctDraftAfterBlur(v, -15, 15, 0),
                  )
                }
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
              />
            </label>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap items-center gap-2 border-t border-rose-100/80 pt-3">
            <button
              type="button"
              onClick={() => {
                setNailWidthPctDrafts([...DEFAULT_NAIL_WIDTH_PCT_DRAFTS]);
                setNailHeightPctDrafts([...DEFAULT_NAIL_HEIGHT_PCT_DRAFTS]);
                setRowGutterPctDraft("0");
                setColGutterPctDraft(DEFAULT_COL_GUTTER_PCT_DRAFT);
                setActiveTemplateId(null);
              }}
              className="text-xs font-medium text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-900"
            >
              恢复默认
            </button>
            {templates.length < MAX_TEMPLATES && (
              <>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={saveTemplate}
                  className="rounded-md border border-rose-400 bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
                >
                  存为模版
                </button>
              </>
            )}
          </div>

          {/* 模版列表 */}
          {templates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-rose-100/80 pt-3">
              <span className="text-[11px] text-zinc-500">已存模版：</span>
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="relative inline-flex h-8 min-w-[2rem] shrink-0 items-stretch"
                >
                  <button
                    type="button"
                    onClick={() => loadTemplate(t.id)}
                    title={`载入${t.name}；已选中时再点此可取消选中`}
                    className={`rounded-md border px-2 pr-5 text-[11px] font-semibold tabular-nums transition ${
                      activeTemplateId === t.id
                        ? "border-rose-500 bg-rose-100 text-rose-950 ring-1 ring-rose-400"
                        : "border-zinc-300 bg-white text-zinc-800 hover:border-rose-300 hover:bg-rose-50/80"
                    }`}
                  >
                    {t.name}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteTemplate(t.id);
                    }}
                    className="absolute -right-1 -top-1 flex h-5 min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full border border-zinc-300 bg-white text-[11px] font-bold leading-none text-zinc-600 shadow-sm hover:border-rose-400 hover:bg-rose-50 hover:text-rose-800"
                    aria-label={`删除${t.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </fieldset>
    </div>
  );
}
