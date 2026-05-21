"use client";

import { useState } from "react";

import {
  NAIL_SHAPE_PROFILE_OPTIONS,
  nailShapeProfileOption,
  type NailShapeProfileId,
} from "@/lib/nail-shape-profiles";

export function NailShapeProfilePicker({
  value,
  onChange,
  defaultOpen = true,
}: {
  value: NailShapeProfileId;
  onChange: (id: NailShapeProfileId) => void;
  /** 首次展开状态 */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const selected = nailShapeProfileOption(value);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-zinc-50/80"
      >
        <div className="min-w-0">
          <span className="text-sm font-semibold text-zinc-800">
            上手甲型（轮廓）
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
            {open
              ? "约束上手轮廓；花色仍以产品图为准"
              : `当前：${selected.label}`}
          </span>
        </div>
        <span
          className="shrink-0 text-xs font-medium text-zinc-400"
          aria-hidden
        >
          {open ? "收起" : "展开"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-zinc-100 px-2 pb-2 pt-1.5">
          <div
            className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch]"
            role="radiogroup"
            aria-label="上手甲型"
          >
            {NAIL_SHAPE_PROFILE_OPTIONS.map((opt) => {
              const isSelected = value === opt.id;
              return (
                <label
                  key={opt.id}
                  title={opt.description}
                  className={`flex w-[5.25rem] shrink-0 cursor-pointer flex-col overflow-hidden rounded-md border text-left transition sm:w-[5.5rem] ${
                    isSelected
                      ? "border-rose-400 bg-rose-50/80 ring-2 ring-rose-300"
                      : "border-zinc-200 bg-white hover:border-rose-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="nailShapeProfile"
                    className="sr-only"
                    checked={isSelected}
                    onChange={() => onChange(opt.id)}
                  />
                  <div className="h-14 w-full overflow-hidden bg-zinc-900">
                    {opt.referenceImagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={opt.referenceImagePath}
                        alt={`${opt.label}参考`}
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-0.5 px-1 text-center text-[10px] leading-tight text-zinc-400">
                        <span className="text-sm" aria-hidden>
                          ↗
                        </span>
                        <span>沿用产品图</span>
                      </div>
                    )}
                  </div>
                  <span className="truncate px-1 py-1 text-center text-[11px] font-medium leading-tight text-zinc-800">
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
