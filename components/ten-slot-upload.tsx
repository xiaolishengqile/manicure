"use client";

import type React from "react";

type TenSlotCell = { file: File | null; previewUrl: string | null };

export function TenSlotUpload({
  tenSlots,
  onPickSlot,
  onRemoveSlot,
  onBatchPick,
  onClear,
  onPasteToFirst,
}: {
  tenSlots: TenSlotCell[];
  onPickSlot: (index: number) => void;
  onRemoveSlot: (index: number) => void;
  onBatchPick: () => void;
  onClear: () => void;
  onPasteToFirst: (file: File) => void;
}) {
  const onPasteSlot =
    (slotIndex: number) => (e: React.ClipboardEvent) => {
      const dt = e.clipboardData;
      if (!dt) return;
      let f: File | null = null;
      if (dt.items?.length) {
        for (let i = 0; i < dt.items.length; i++) {
          const item = dt.items[i];
          if (item?.kind !== "file") continue;
          const t = item.type?.toLowerCase() ?? "";
          if (!t.startsWith("image/")) continue;
          f = item.getAsFile();
          if (f) break;
        }
      }
      if (!f && dt.files?.length) {
        for (let i = 0; i < dt.files.length; i++) {
          const file = dt.files.item(i);
          if (file?.type.startsWith("image/")) {
            f = file;
            break;
          }
        }
      }
      if (!f) return;
      e.preventDefault();
      e.stopPropagation();
      // Trigger parent to handle paste for this specific slot
      onPickSlot(slotIndex);
    };

  const onPasteZone = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const dt = e.clipboardData;
    if (!dt) return;
    let f: File | null = null;
    if (dt.items?.length) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item?.kind !== "file") continue;
        const t = item.type?.toLowerCase() ?? "";
        if (!t.startsWith("image/")) continue;
        f = item.getAsFile();
        if (f) break;
      }
    }
    if (!f && dt.files?.length) {
      for (let i = 0; i < dt.files.length; i++) {
        const file = dt.files.item(i);
        if (file?.type.startsWith("image/")) {
          f = file;
          break;
        }
      }
    }
    if (!f) return;
    e.preventDefault();
    e.stopPropagation();
    onPasteToFirst(f);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        tabIndex={0}
        role="region"
        aria-label="剪贴板粘贴到十格首个空位"
        onPaste={onPasteZone}
        onClick={(e) => {
          (e.currentTarget as HTMLDivElement).focus();
        }}
        className="cursor-default rounded-lg border border-dashed border-zinc-300 bg-zinc-50/90 px-3 py-2.5 text-xs leading-relaxed text-zinc-600 outline-none transition hover:border-rose-200 hover:bg-rose-50/60 focus-visible:border-rose-400 focus-visible:ring-2 focus-visible:ring-rose-400/40"
      >
        在对应区域点击一下使焦点落在该处后，可用 Ctrl+V（Windows）或 ⌘+V（Mac）将剪贴板中的图片粘贴为投喂图（填入<strong>首个空位</strong>；十格已满则替换第 1 格）。各格内可点击从文件夹选图或粘贴。
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">
        共 10 格：第 1–5 格 → 上排左→右；第 6–10 格 → 下排左→右。每格可单独添加、替换或删除；亦可一次选 10 张按顺序填满。提交后服务端会先将每格做「指尖朝下」校正，再按位置拼成**一张 2×5 白底参考图**，**每行内上对齐**使甲根后缘共线（格角带 1–10 小标）；模型成品提示词要求**不保留**小标。
      </p>
      <div className="grid w-full max-w-md grid-cols-5 gap-2 lg:max-w-full">
        {tenSlots.map((cell, i) => (
          <div
            key={i}
            className="group relative aspect-square w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm"
          >
            {cell.previewUrl ? (
              <>
                <button
                  type="button"
                  aria-label={`删除第 ${i + 1} 格`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onRemoveSlot(i);
                  }}
                  className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/80 text-sm font-bold text-white shadow-md transition hover:bg-red-600"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => onPickSlot(i)}
                  onPaste={onPasteSlot(i)}
                  className="flex h-full w-full items-stretch justify-stretch p-0.5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cell.previewUrl}
                    alt={`第 ${i + 1} 格`}
                    className="h-full w-full rounded-[4px] object-cover"
                  />
                </button>
                <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {i + 1}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onPickSlot(i)}
                onPaste={onPasteSlot(i)}
                className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-zinc-50 px-1 text-center transition hover:bg-rose-50/80"
              >
                <span className="text-xs font-semibold text-zinc-500">{i + 1}</span>
                <span className="text-[10px] leading-tight text-zinc-400">点击添加</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBatchPick}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-rose-400 hover:bg-rose-50"
        >
          一次选择 10 张（按顺序填入 1–10 格）
        </button>
        <button
          type="button"
          disabled={!tenSlots.some((s) => s.file)}
          onClick={onClear}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          清空十格
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        点击已有图片可替换该格；角标 × 仅删除本格。各格内点击后亦可 Ctrl+V / ⌘+V 粘贴；或使用上方粘贴区填入首个空位。
      </p>
    </div>
  );
}
