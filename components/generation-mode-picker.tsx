"use client";

import {
  GENERATION_MODE_OPTIONS,
  generationModeOption,
  type GenerationMode,
} from "@/lib/generation-modes";

export function GenerationModePicker({
  value,
  onChange,
}: {
  value: GenerationMode;
  onChange: (mode: GenerationMode) => void;
}) {
  const selected = generationModeOption(value);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="生成模式"
      >
        {GENERATION_MODE_OPTIONS.map((opt) => {
          const checked = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={checked}
              title={`${opt.whenToUse}\n\n${opt.description}`}
              onClick={() => onChange(opt.value)}
              className={`rounded-md border px-2 py-1 text-left text-xs font-medium leading-snug transition ${
                checked
                  ? "border-rose-500 bg-rose-50 text-rose-800 shadow-sm"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-rose-200 hover:bg-rose-50/50"
              }`}
            >
              {opt.shortLabel}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        <span className="font-medium text-zinc-700">{selected.shortLabel}</span>
        <span className="text-zinc-400"> · </span>
        适合：{selected.whenToUse}
      </p>
    </div>
  );
}
