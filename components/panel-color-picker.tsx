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
      className="w-full rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-4 shadow-sm"
      aria-label="袋身主色"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-800">袋身主色</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            默认跟随正面稿自动提色；点选下方色块或自定义后改为指定袋身色
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSourceChange("auto")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              !isManual
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:ring-rose-200"
            } disabled:opacity-50`}
          >
            跟随正面稿
          </button>
          {isManual ? (
            <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-white">
              手动指定
            </span>
          ) : null}
        </div>
      </div>

      {!isManual && autoHex ? (
        <p className="mb-3 text-xs text-zinc-500">
          已从正面稿识别：
          <span className="ml-1 font-mono font-medium text-zinc-700">
            {autoHex}
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {/* 当前色预览 */}
        <div className="flex shrink-0 items-center gap-3 lg:w-36 lg:flex-col lg:justify-center lg:border-r lg:border-zinc-200 lg:pr-4">
          <div
            className="h-16 w-16 shrink-0 rounded-xl border border-zinc-200/80 shadow-inner ring-1 ring-black/5 lg:h-14 lg:w-full"
            style={{ backgroundColor: displayHex }}
            title={displayHex}
          />
          <p className="font-mono text-sm font-medium tracking-wide text-zinc-700">
            {displayHex}
          </p>
        </div>

        {/* 预设色 */}
        <div className="min-w-0 flex-1 lg:px-1">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            预设
          </p>
          <div className="flex flex-wrap gap-2">
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
                  className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                    active
                      ? "border-rose-500 bg-rose-50 ring-2 ring-rose-200"
                      : "border-zinc-200 bg-white hover:border-rose-300 hover:bg-rose-50/50"
                  } disabled:opacity-50`}
                >
                  <span
                    className="h-7 w-7 shrink-0 rounded-md border border-black/10 shadow-sm"
                    style={{ backgroundColor: p.hex }}
                  />
                  <span className="text-xs font-medium text-zinc-700">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 自定义 */}
        <div className="flex shrink-0 flex-col justify-center gap-2 border-t border-zinc-100 pt-3 lg:w-44 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            自定义
          </p>
          <div className="flex items-center gap-2">
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
              className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white p-0.5 disabled:cursor-not-allowed"
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
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 font-mono text-xs text-zinc-800 shadow-sm"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
