"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { NailCropResult } from "@/lib/nail-layer-editor";

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CropDragMode = "move" | "nw" | "ne" | "sw" | "se" | null;

type CropDragState = {
  slotIndex: number;
  mode: CropDragMode;
  startMouseX: number;
  startMouseY: number;
  origRect: CropRect;
};

const SLOT_LABELS = [
  "1·拇指", "2·食指", "3·中指", "4·无名指", "5·小指",
  "6·拇指", "7·食指", "8·中指", "9·无名指", "10·小指",
];

/** 初始化 2×5 均匀裁切框 */
function initCropRects(imgW: number, imgH: number): CropRect[] {
  const cols = 5;
  const rows = 2;
  const cellW = imgW / cols;
  const cellH = imgH / rows;
  // 留一点边距
  const padX = cellW * 0.08;
  const padY = cellH * 0.08;
  const rects: CropRect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rects.push({
        x: c * cellW + padX,
        y: r * cellH + padY,
        width: cellW - padX * 2,
        height: cellH - padY * 2,
      });
    }
  }
  return rects;
}

export function NailManualCropper({
  gridImageUrl,
  onConfirm,
  onCancel,
}: {
  gridImageUrl: string;
  onConfirm: (nails: NailCropResult[]) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [cropRects, setCropRects] = useState<CropRect[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 512, h: 512 });
  const dragRef = useRef<CropDragState | null>(null);
  const [imgSize, setImgSize] = useState({ w: 1024, h: 1024 });

  // Load the grid image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setCropRects(initCropRects(img.naturalWidth, img.naturalHeight));
    };
    img.src = gridImageUrl;
  }, [gridImageUrl]);

  // Fit canvas into container while preserving image aspect ratio
  useEffect(() => {
    const container = containerRef.current;
    if (!container || imgSize.w <= 0 || imgSize.h <= 0) return;

    const updateDisplay = () => {
      const maxW = container.clientWidth;
      const maxH = Math.min(window.innerHeight * 0.7, 900);
      const scale = Math.min(maxW / imgSize.w, maxH / imgSize.h);
      setDisplaySize({
        w: Math.floor(imgSize.w * scale),
        h: Math.floor(imgSize.h * scale),
      });
    };

    updateDisplay();
    const observer = new ResizeObserver(updateDisplay);
    observer.observe(container);
    window.addEventListener("resize", updateDisplay);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDisplay);
    };
  }, [imgSize.w, imgSize.h]);

  const canvasScale = displaySize.w / imgSize.w;

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = imgSize.w;
    canvas.height = imgSize.h;

    // Draw image
    ctx.drawImage(img, 0, 0, imgSize.w, imgSize.h);

    // Dim overlay
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, imgSize.w, imgSize.h);

    // Draw each crop rect
    cropRects.forEach((rect, i) => {
      const selected = i === selectedIndex;

      // Clear the dim inside the crop rect (show original image)
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
      ctx.clip();
      ctx.drawImage(img, 0, 0, imgSize.w, imgSize.h);
      ctx.restore();

      // Border
      ctx.strokeStyle = selected ? "#e11d48" : "#2563eb";
      ctx.lineWidth = selected ? 3 : 2;
      ctx.setLineDash(selected ? [] : [6, 3]);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      ctx.setLineDash([]);

      // Label
      const label = SLOT_LABELS[i] ?? `${i + 1}`;
      ctx.font = `bold ${Math.max(14, imgSize.w * 0.016)}px sans-serif`;
      const textMetrics = ctx.measureText(label);
      const textH = Math.max(18, imgSize.w * 0.02);
      const labelPadX = 6;
      const labelPadY = 4;
      const labelX = rect.x + 4;
      const labelY = rect.y + 4;
      ctx.fillStyle = selected ? "#e11d48" : "#2563eb";
      ctx.fillRect(
        labelX,
        labelY,
        textMetrics.width + labelPadX * 2,
        textH + labelPadY,
      );
      ctx.fillStyle = "#fff";
      ctx.fillText(label, labelX + labelPadX, labelY + textH - 2);

      // Resize handles (corners)
      if (selected) {
        ctx.fillStyle = "#e11d48";
        const hs = 8;
        const corners = [
          [rect.x, rect.y],
          [rect.x + rect.width, rect.y],
          [rect.x + rect.width, rect.y + rect.height],
          [rect.x, rect.y + rect.height],
        ];
        for (const [cx, cy] of corners) {
          ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
        }
      }
    });
  }, [cropRects, selectedIndex, imgSize]);

  // Convert client coords to image coords
  const toImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * imgSize.w,
        y: ((clientY - rect.top) / rect.height) * imgSize.h,
      };
    },
    [imgSize],
  );

  // Detect which corner handle is hit
  const hitCorner = useCallback(
    (ix: number, iy: number, rect: CropRect): CropDragMode => {
      const hs = 12 / canvasScale;
      const corners: [number, number, CropDragMode][] = [
        [rect.x, rect.y, "nw"],
        [rect.x + rect.width, rect.y, "ne"],
        [rect.x + rect.width, rect.y + rect.height, "se"],
        [rect.x, rect.y + rect.height, "sw"],
      ];
      for (const [cx, cy, mode] of corners) {
        if (Math.abs(ix - cx) < hs && Math.abs(iy - cy) < hs) return mode;
      }
      return null;
    },
    [canvasScale],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = toImageCoords(e.clientX, e.clientY);

      // Check if clicking on a corner of the selected rect
      if (selectedIndex !== null) {
        const rect = cropRects[selectedIndex];
        if (rect) {
          const corner = hitCorner(x, y, rect);
          if (corner) {
            dragRef.current = {
              slotIndex: selectedIndex,
              mode: corner,
              startMouseX: x,
              startMouseY: y,
              origRect: { ...rect },
            };
            return;
          }
        }
      }

      // Check if clicking inside a crop rect (move)
      // Check in reverse order so top-most (last drawn) is hit first
      for (let i = cropRects.length - 1; i >= 0; i--) {
        const rect = cropRects[i]!;
        if (
          x >= rect.x &&
          x <= rect.x + rect.width &&
          y >= rect.y &&
          y <= rect.y + rect.height
        ) {
          setSelectedIndex(i);
          dragRef.current = {
            slotIndex: i,
            mode: "move",
            startMouseX: x,
            startMouseY: y,
            origRect: { ...rect },
          };
          return;
        }
      }

      // Click on empty area: deselect
      setSelectedIndex(null);
    },
    [cropRects, selectedIndex, toImageCoords, hitCorner],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const { x, y } = toImageCoords(e.clientX, e.clientY);
      const dx = x - drag.startMouseX;
      const dy = y - drag.startMouseY;
      const orig = drag.origRect;

      setCropRects((prev) =>
        prev.map((rect, i) => {
          if (i !== drag.slotIndex) return rect;

          switch (drag.mode) {
            case "move": {
              const newX = Math.max(0, Math.min(imgSize.w - orig.width, orig.x + dx));
              const newY = Math.max(0, Math.min(imgSize.h - orig.height, orig.y + dy));
              return { ...rect, x: newX, y: newY };
            }
            case "nw": {
              const newX = Math.max(0, orig.x + dx);
              const newY = Math.max(0, orig.y + dy);
              const newW = Math.max(30, orig.width - (newX - orig.x));
              const newH = Math.max(30, orig.height - (newY - orig.y));
              return { x: newX, y: newY, width: newW, height: newH };
            }
            case "ne": {
              const newY = Math.max(0, orig.y + dy);
              const newW = Math.max(30, Math.min(imgSize.w - orig.x, orig.width + dx));
              const newH = Math.max(30, orig.height - (newY - orig.y));
              return { x: orig.x, y: newY, width: newW, height: newH };
            }
            case "sw": {
              const newX = Math.max(0, orig.x + dx);
              const newW = Math.max(30, orig.width - (newX - orig.x));
              const newH = Math.max(30, Math.min(imgSize.h - orig.y, orig.height + dy));
              return { x: newX, y: orig.y, width: newW, height: newH };
            }
            case "se": {
              const newW = Math.max(30, Math.min(imgSize.w - orig.x, orig.width + dx));
              const newH = Math.max(30, Math.min(imgSize.h - orig.y, orig.height + dy));
              return { x: orig.x, y: orig.y, width: newW, height: newH };
            }
            default:
              return rect;
          }
        }),
      );
    },
    [toImageCoords, imgSize],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Confirm: extract each crop region as transparent PNG
  const handleConfirm = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;

    const results: NailCropResult[] = [];
    for (const rect of cropRects) {
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 10 || h < 10) continue;

      const offscreen = document.createElement("canvas");
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext("2d");
      if (!ctx) continue;

      // Draw the cropped region
      ctx.drawImage(
        img,
        Math.round(rect.x),
        Math.round(rect.y),
        w,
        h,
        0,
        0,
        w,
        h,
      );

      // Make near-white pixels transparent
      const imageData = ctx.getImageData(0, 0, w, h);
      const pixels = imageData.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i]!;
        const g = pixels[i + 1]!;
        const b = pixels[i + 2]!;
        if (r > 240 && g > 240 && b > 240) {
          pixels[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      results.push({
        imageUrl: offscreen.toDataURL("image/png"),
        nativeWidth: w,
        nativeHeight: h,
      });
    }

    if (results.length > 0) {
      onConfirm(results);
    }
  }, [cropRects, onConfirm]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIndex !== null) {
        e.preventDefault();
        setCropRects((prev) => prev.filter((_, i) => i !== selectedIndex));
        setSelectedIndex(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleConfirm, onCancel, selectedIndex]);

  const selectedRect = selectedIndex !== null ? cropRects[selectedIndex] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Workflow header */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          <CropStepBadge done label="上传" />
          <span className="text-zinc-300">→</span>
          <CropStepBadge done label="抠图" />
          <span className="text-zinc-300">→</span>
          <CropStepBadge active label="裁切" />
          <span className="text-zinc-300">→</span>
          <CropStepBadge label="排版" />
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            setCropRects(initCropRects(imgSize.w, imgSize.h));
            setSelectedIndex(null);
          }}
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        >
          重置裁切框
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        >
          返回
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
        >
          确认裁切（Enter）
        </button>
      </div>

      {/* Instructions + selected info */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-blue-200/80 bg-blue-50/50 px-4 py-2.5 text-xs text-blue-900/90">
        <span className="font-medium">拖动蓝色框调整每枚甲片的裁切区域</span>
        {selectedRect ? (
          <>
            <span className="text-blue-700/70">|</span>
            <span>
              已选 {SLOT_LABELS[selectedIndex!] ?? `${selectedIndex! + 1} 号`}
              · {Math.round(selectedRect.width)}×{Math.round(selectedRect.height)} px
            </span>
            <span className="text-blue-600/60">Delete 删除此框</span>
          </>
        ) : (
          <span className="text-blue-700/70">点击框选中 · 拖动移动 · 拖角调整大小</span>
        )}
      </div>

      {/* Canvas — display size preserves aspect ratio (no stretch) */}
      <div
        ref={containerRef}
        className="flex w-full justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900/5 py-2 shadow-inner"
      >
        <canvas
          ref={canvasRef}
          width={imgSize.w}
          height={imgSize.h}
          style={{
            width: displaySize.w,
            height: displaySize.h,
            maxWidth: "100%",
            cursor: dragRef.current
              ? dragRef.current.mode === "move"
                ? "grabbing"
                : "nwse-resize"
              : "crosshair",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      <p className="text-center text-[11px] text-zinc-400">
        Enter 确认裁切 · Esc 返回 · Delete 删除选中框
      </p>
    </div>
  );
}

function CropStepBadge({
  label,
  done,
  active,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-medium ${
        active
          ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
          : done
            ? "bg-emerald-50 text-emerald-700"
            : "bg-zinc-100 text-zinc-400"
      }`}
    >
      {label}
    </span>
  );
}
