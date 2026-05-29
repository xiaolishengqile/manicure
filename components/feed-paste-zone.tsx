"use client";

import type React from "react";

/** 从系统剪贴板取第一张图片文件（用于投喂区粘贴） */
export function firstImageFileFromDataTransfer(
  dt: DataTransfer | null,
): File | null {
  if (!dt) return null;
  if (dt.items?.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (item?.kind !== "file") continue;
      const t = item.type?.toLowerCase() ?? "";
      if (!t.startsWith("image/")) continue;
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  const { files } = dt;
  if (files?.length) {
    for (let i = 0; i < files.length; i++) {
      const f = files.item(i);
      if (f?.type.startsWith("image/")) return f;
    }
  }
  return null;
}

/** 投喂区专用：点击聚焦后在此粘贴剪贴板图片，不会打开系统文件夹 */
export function FeedPasteZone({
  ariaLabel,
  children,
  onPasteImage,
  className = "",
}: {
  ariaLabel: string;
  children: React.ReactNode;
  onPasteImage: (file: File) => void;
  className?: string;
}) {
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const f = firstImageFileFromDataTransfer(e.clipboardData);
    if (!f) return;
    e.preventDefault();
    e.stopPropagation();
    onPasteImage(f);
  };

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={ariaLabel}
      onPaste={onPaste}
      onClick={(e) => {
        (e.currentTarget as HTMLDivElement).focus();
      }}
      className={`cursor-default rounded-lg border border-dashed border-zinc-300 bg-zinc-50/90 px-3 py-2.5 text-xs leading-relaxed text-zinc-600 outline-none transition hover:border-rose-200 hover:bg-rose-50/60 focus-visible:border-rose-400 focus-visible:ring-2 focus-visible:ring-rose-400/40 ${className}`}
    >
      {children}
    </div>
  );
}
