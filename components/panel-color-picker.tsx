"use client";

import {
  DEFAULT_PANEL_COLOR_HEX,
  normalizePanelColorHex,
  PANEL_COLOR_PRESETS,
  type PanelColorSource,
} from "@/lib/panel-color";

type PanelColorPickerProps = {
  value: string;
  source: PanelColorSource;
  autoHex: string | null;
  onChange: (hex: string) => void;
  onSourceChange: (source: PanelColorSource) => void;
  disabled?: boolean;
};

export function PanelColorPicker({
  value,
  source,
  autoHex,
  onChange,
  onSourceChange,
  disabled = false,
}: PanelColorPickerProps) {
  const displayHex = normalizePanelColorHex(value) ?? DEFAULT_PANEL_COLOR_HEX;
  const isManual = source === "manual";

  return (
    <section
      className="w-full rounded-xl border border-zinc-200 bg-gradient-to-r from-zinc-50 via-white to-zinc-50 px-4 py-3 shadow-sm"
      aria-label="袋身主色"
    >
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* 左：标题 + 当前色 + 模式 */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 sm:max-w-[min(100%,22rem)]">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-800">袋身主色</p>
            <p className="hidden text-xs text-zinc-500 sm:block">
              默认跟随正面稿；点选色块或自定义可改袋身色
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200/80 shadow-inner ring-1 ring-black/5"
              style={{ backgroundColor: displayHex }}
              title={displayHex}
            />
            <p className="font-mono text-sm font-semibold text-zinc-800">
              {displayHex}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSourceChange("auto")}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                !isManual
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:ring-rose-200"
              } disabled:opacity-50`}
            >
              跟随正面稿
            </button>
            {isManual ? (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-white">
                手动
              </span>
            ) : null}
            {!isManual && autoHex ? (
              <span className="hidden text-xs text-zinc-500 lg:inline">
                识别 {autoHex}
              </span>
            ) : null}
          </div>
        </div>

        {/* 中：预设 — 始终横向一排，窄屏可左右滑动 */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[11px] font-medium text-zinc-400">
            预设
          </span>
          <div className="flex min-w-0 flex-1 flex-row flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PANEL_COLOR_PRESETS.map((p) => {
              const active =
                isManual && normalizePanelColorHex(p.hex) === displayHex;
              return (
                <button
                  key={p.hex}
                  type="button"
                  disabled={disabled}
                  title={`${p.label} ${p.hex}`}
                  onClick={() => {
                    onSourceChange("manual");
                    onChange(p.hex);
                  }}
                  className={`inline-flex shrink-0 flex-row items-center gap-1.5 rounded-lg border px-1.5 py-1 transition ${
                    active
                      ? "border-rose-500 bg-rose-50 ring-2 ring-rose-200"
                      : "border-zinc-200/80 bg-white hover:border-rose-300 hover:bg-rose-50/60"
                  } disabled:opacity-50`}
                >
                  <span
                    className="h-7 w-7 shrink-0 rounded-md border border-black/10 shadow-sm"
                    style={{ backgroundColor: p.hex }}
                  />
                  <span className="whitespace-nowrap text-xs text-zinc-700">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 右：自定义 */}
        <div className="flex shrink-0 items-center gap-2 border-t border-zinc-100 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
          <span className="shrink-0 text-[11px] font-medium text-zinc-400">
            自定义
          </span>
          <input
            type="color"
            value={displayHex}
            disabled={disabled}
            aria-label="自定义袋身颜色"
            onChange={(e) => {
              const hex = normalizePanelColorHex(e.target.value);
              if (hex) {
                onSourceChange("manual");
                onChange(hex);
              }
            }}
            className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white p-0.5 disabled:cursor-not-allowed"
          />
          <input
            type="text"
            value={displayHex}
            disabled={disabled}
            spellCheck={false}
            aria-label="袋身颜色 Hex"
            onChange={(e) => {
              const hex = normalizePanelColorHex(e.target.value);
              if (hex) {
                onSourceChange("manual");
                onChange(hex);
              }
            }}
            className="w-[5.5rem] rounded-lg border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-800 shadow-sm sm:w-24"
          />
        </div>
      </div>
    </section>
  );
}
