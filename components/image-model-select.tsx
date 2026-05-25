"use client";

import {
  DEFAULT_FLUX_GENERATION_SIZE,
  FLUX_GENERATION_SIZE_OPTIONS,
  IMAGE_MODEL_PRESET_OPTIONS,
  imageModelUsesFluxGenerations,
} from "@/lib/image-gateway-fields";

export function ImageModelSelect({
  value,
  onChange,
  fluxSize = DEFAULT_FLUX_GENERATION_SIZE,
  onFluxSizeChange,
  id = "imageModel",
  fluxSizeId = "imageFluxSize",
}: {
  value: string;
  onChange: (value: string) => void;
  fluxSize?: string;
  onFluxSizeChange?: (size: string) => void;
  id?: string;
  fluxSizeId?: string;
}) {
  const showFluxSize =
    imageModelUsesFluxGenerations(value) && onFluxSizeChange != null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="flex min-w-0 max-w-[11rem] items-center gap-1.5 sm:max-w-[13rem]">
        <label
          htmlFor={id}
          className="shrink-0 text-[10px] font-medium leading-none text-zinc-500"
        >
          图像模型
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          title={
            IMAGE_MODEL_PRESET_OPTIONS.find((o) => o.value === value)?.label ??
            value
          }
          className="h-6 min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1.5 py-0 pr-5 text-[11px] leading-6 text-zinc-800 outline-none ring-rose-500 focus:border-rose-400 focus:ring-1"
        >
          {IMAGE_MODEL_PRESET_OPTIONS.map((opt) => (
            <option key={opt.value || "default"} value={opt.value}>
              {opt.shortLabel}
            </option>
          ))}
        </select>
      </div>
      {showFluxSize ? (
        <div className="flex min-w-0 max-w-[8.5rem] items-center gap-1.5">
          <label
            htmlFor={fluxSizeId}
            className="shrink-0 text-[10px] font-medium leading-none text-zinc-500"
          >
            尺寸
          </label>
          <select
            id={fluxSizeId}
            value={fluxSize}
            onChange={(e) => onFluxSizeChange(e.target.value)}
            className="h-6 min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1.5 py-0 pr-5 text-[11px] leading-6 text-zinc-800 outline-none ring-rose-500 focus:border-rose-400 focus:ring-1"
          >
            {FLUX_GENERATION_SIZE_OPTIONS.map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
