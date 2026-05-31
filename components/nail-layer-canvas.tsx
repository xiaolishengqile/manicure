"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  alignRowsBaseline,
  autoArrangeLayers,
  distributeRowsEvenly,
  measureLayoutGaps,
  packLayersByRows,
  scaleAllLayers,
  scaleLayer,
  snapLayerPosition,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type NailLayer,
  type SnapGuide,
} from "@/lib/nail-layer-editor";

// ─── Types ───────────────────────────────────────────────────────────────────

type DragMode = "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se" | "rotate" | null;

type DragState = {
  mode: DragMode;
  layerId: string;
  startMouseX: number;
  startMouseY: number;
  origLayer: NailLayer;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const HANDLE_PX = 8;          // corner handle size in canvas px
const ROTATE_OFFSET = 30;     // rotation handle distance above top edge
const MIN_LAYER_SIZE = 20;
const MAX_LAYER_SIZE = 800;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Checkerboard tile size for transparency preview */
const CHECK_SIZE = 16;

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  for (let y = 0; y < h; y += CHECK_SIZE) {
    for (let x = 0; x < w; x += CHECK_SIZE) {
      ctx.fillStyle =
        (Math.floor(x / CHECK_SIZE) + Math.floor(y / CHECK_SIZE)) % 2 === 0
          ? "#ffffff"
          : "#e5e7eb";
      ctx.fillRect(x, y, CHECK_SIZE, CHECK_SIZE);
    }
  }
}

function normAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NailLayerCanvas({
  layers,
  onLayersChange,
  onExport,
  onBackToCropper,
  onReset,
  sourcePreviewUrl,
}: {
  layers: NailLayer[];
  onLayersChange: (layers: NailLayer[]) => void;
  onExport: (blob: Blob) => void;
  onBackToCropper?: () => void;
  onReset?: () => void;
  sourcePreviewUrl?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number>(0);

  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [lockRatio, setLockRatio] = useState(true);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [activeTool, setActiveTool] = useState<"move" | "rotate">("move");
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [hGap, setHGap] = useState(20);
  const [vGap, setVGap] = useState(40);
  const [globalScale, setGlobalScale] = useState(100);
  const gapsInitRef = useRef(false);

  // ── Image loader ───────────────────────────────────────────────────────────

  const loadImage = useCallback((url: string): Promise<HTMLImageElement> => {
    const cached = imageCacheRef.current.get(url);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageCacheRef.current.set(url, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }, []);

  // ── Canvas drawing ─────────────────────────────────────────────────────────

  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill with transparency checkerboard
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawCheckerboard(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background color (if not transparent)
    if (bgColor !== "transparent") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Sort by zIndex (bottom → top)
    const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    for (const layer of sorted) {
      try {
        const img = await loadImage(layer.imageUrl);
        ctx.save();
        ctx.translate(layer.x, layer.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        const halfW = layer.width / 2;
        const halfH = layer.height / 2;
        ctx.drawImage(img, -halfW, -halfH, layer.width, layer.height);
        ctx.restore();
      } catch {
        /* skip */
      }
    }

    // 对齐辅助线
    if (snapGuides.length > 0) {
      ctx.save();
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      for (const g of snapGuides) {
        ctx.beginPath();
        if (g.orientation === "v") {
          ctx.moveTo(g.position, 0);
          ctx.lineTo(g.position, CANVAS_HEIGHT);
        } else {
          ctx.moveTo(0, g.position);
          ctx.lineTo(CANVAS_WIDTH, g.position);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw selection overlay for the selected layer
    const sel = layers.find((l) => l.selected);
    if (sel) {
      ctx.save();
      ctx.translate(sel.x, sel.y);
      ctx.rotate((sel.rotation * Math.PI) / 180);
      const halfW = sel.width / 2;
      const halfH = sel.height / 2;

      // Bounding box
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(-halfW, -halfH, sel.width, sel.height);

      // Corner handles
      const corners: [number, number, string][] = [
        [-halfW, -halfH, "nw"],
        [halfW, -halfH, "ne"],
        [halfW, halfH, "se"],
        [-halfW, halfH, "sw"],
      ];
      for (const [cx, cy] of corners) {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.fillRect(cx - HANDLE_PX / 2, cy - HANDLE_PX / 2, HANDLE_PX, HANDLE_PX);
        ctx.strokeRect(cx - HANDLE_PX / 2, cy - HANDLE_PX / 2, HANDLE_PX, HANDLE_PX);
      }

      // Side handles (midpoints)
      const sides: [number, number][] = [
        [0, -halfH],    // top
        [0, halfH],     // bottom
        [-halfW, 0],    // left
        [halfW, 0],     // right
      ];
      for (const [sx, sy] of sides) {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1;
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
        ctx.strokeRect(sx - 3, sy - 3, 6, 6);
      }

      // Rotation handle — only when rotate tool is active
      if (activeTool === "rotate") {
        const rotY = -halfH - ROTATE_OFFSET;
        ctx.beginPath();
        ctx.moveTo(0, -halfH);
        ctx.lineTo(0, rotY);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, rotY, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    }
  }, [layers, bgColor, loadImage, snapGuides, activeTool]);

  // Schedule a draw on next frame
  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => void drawCanvas());
  }, [drawCanvas]);

  useEffect(() => {
    scheduleDraw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [scheduleDraw]);

  // 进入排版时同步当前间距到滑块
  useEffect(() => {
    if (layers.length === 0) {
      gapsInitRef.current = false;
      return;
    }
    if (!gapsInitRef.current) {
      const measured = measureLayoutGaps(layers);
      setHGap(measured.horizontalGap);
      setVGap(measured.verticalGap);
      setGlobalScale(100);
      gapsInitRef.current = true;
    }
  }, [layers]);

  const applyRowPack = useCallback(
    (nextH: number, nextV: number) => {
      setHGap(nextH);
      setVGap(nextV);
      onLayersChange(packLayersByRows(layers, nextH, nextV));
    },
    [layers, onLayersChange],
  );

  const bumpHorizontalGap = useCallback(
    (delta: number) => {
      applyRowPack(Math.max(0, hGap + delta), vGap);
    },
    [applyRowPack, hGap, vGap],
  );

  const bumpVerticalGap = useCallback(
    (delta: number) => {
      applyRowPack(hGap, Math.max(0, vGap + delta));
    },
    [applyRowPack, hGap, vGap],
  );

  const bumpGlobalScale = useCallback(
    (delta: number) => {
      const next = Math.max(50, Math.min(180, globalScale + delta));
      const factor = next / globalScale;
      if (Math.abs(factor - 1) < 0.001) return;
      setGlobalScale(next);
      const scaled = scaleAllLayers(layers, factor);
      onLayersChange(packLayersByRows(scaled, hGap, vGap));
    },
    [globalScale, layers, onLayersChange, hGap, vGap],
  );

  const scaleSelected = useCallback(
    (factor: number) => {
      onLayersChange(
        layers.map((l) => (l.selected ? scaleLayer(l, factor) : l)),
      );
    },
    [layers, onLayersChange],
  );

  // Fit canvas to available viewport on mount
  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      const scale = Math.min(
        rect.width / CANVAS_WIDTH,
        rect.height / CANVAS_HEIGHT,
        1,
      );
      setZoom(Math.max(0.25, scale * 0.95));
      setPanX(0);
      setPanY(0);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // ── Coordinate transforms ──────────────────────────────────────────────────

  const toCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const wrap = canvasWrapRef.current;
      if (!wrap) return { x: 0, y: 0 };
      const rect = wrap.getBoundingClientRect();
      // Canvas is centered in the wrap with zoom + pan
      const canvasDisplayW = CANVAS_WIDTH * zoom;
      const canvasDisplayH = CANVAS_HEIGHT * zoom;
      const offsetX = (rect.width - canvasDisplayW) / 2 + panX;
      const offsetY = (rect.height - canvasDisplayH) / 2 + panY;
      return {
        x: (clientX - rect.left - offsetX) / zoom,
        y: (clientY - rect.top - offsetY) / zoom,
      };
    },
    [zoom, panX, panY],
  );

  // ── Hit testing ────────────────────────────────────────────────────────────

  const localCoords = useCallback(
    (cx: number, cy: number, layer: NailLayer) => {
      const dx = cx - layer.x;
      const dy = cy - layer.y;
      const rad = (-layer.rotation * Math.PI) / 180;
      return {
        lx: dx * Math.cos(rad) - dy * Math.sin(rad),
        ly: dx * Math.sin(rad) + dy * Math.cos(rad),
      };
    },
    [],
  );

  const findLayerAtPoint = useCallback(
    (cx: number, cy: number): NailLayer | null => {
      const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex);
      for (const layer of sorted) {
        const { lx, ly } = localCoords(cx, cy, layer);
        const halfW = layer.width / 2;
        const halfH = layer.height / 2;
        if (lx >= -halfW && lx <= halfW && ly >= -halfH && ly <= halfH) return layer;
      }
      return null;
    },
    [layers, localCoords],
  );

  const hitTestSelected = useCallback(
    (cx: number, cy: number): DragMode => {
      const sel = layers.find((l) => l.selected);
      if (!sel) return null;
      const { lx, ly } = localCoords(cx, cy, sel);
      const halfW = sel.width / 2;
      const halfH = sel.height / 2;
      const threshold = HANDLE_PX / zoom + 4;

      // Rotation handle — only in rotate tool mode
      if (activeTool === "rotate") {
        const rotY = -halfH - ROTATE_OFFSET;
        if (Math.abs(lx) < threshold && Math.abs(ly - rotY) < threshold) {
          return "rotate";
        }
      }

      // Corner handles
      if (Math.abs(lx + halfW) < threshold && Math.abs(ly + halfH) < threshold) return "resize-nw";
      if (Math.abs(lx - halfW) < threshold && Math.abs(ly + halfH) < threshold) return "resize-ne";
      if (Math.abs(lx - halfW) < threshold && Math.abs(ly - halfH) < threshold) return "resize-se";
      if (Math.abs(lx + halfW) < threshold && Math.abs(ly - halfH) < threshold) return "resize-sw";

      // Inside bounding box → move
      if (lx >= -halfW && lx <= halfW && ly >= -halfH && ly <= halfH) return "move";

      return null;
    },
    [layers, localCoords, zoom, activeTool],
  );

  // ── Mouse handlers ─────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      const sel = layers.find((l) => l.selected);

      // 1. Check handles on already-selected layer
      const handleMode = hitTestSelected(x, y);
      if (handleMode && sel) {
        dragRef.current = {
          mode: handleMode,
          layerId: sel.id,
          startMouseX: x,
          startMouseY: y,
          origLayer: { ...sel },
        };
        return;
      }

      // 2. Click on a layer
      const hit = findLayerAtPoint(x, y);
      if (hit) {
        const isSwitch = sel != null && hit.id !== sel.id;
        const updated = layers.map((l) => ({
          ...l,
          selected: l.id === hit.id,
          zIndex:
            l.id === hit.id
              ? Math.max(...layers.map((ll) => ll.zIndex)) + 1
              : l.zIndex,
        }));
        onLayersChange(updated);

        // 切换到另一枚甲片：仅选中，不立即拖动/旋转
        if (isSwitch) {
          setActiveTool("move");
          setSnapGuides([]);
          return;
        }

        dragRef.current = {
          mode: "move",
          layerId: hit.id,
          startMouseX: x,
          startMouseY: y,
          origLayer: { ...hit },
        };
      } else {
        onLayersChange(layers.map((l) => ({ ...l, selected: false })));
        setSnapGuides([]);
      }
    },
    [layers, onLayersChange, toCanvasCoords, findLayerAtPoint, hitTestSelected],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      const dx = x - drag.startMouseX;
      const dy = y - drag.startMouseY;
      const orig = drag.origLayer;

      const updated = layers.map((layer) => {
        if (layer.id !== drag.layerId) return layer;

        switch (drag.mode) {
          case "move": {
            let nx = orig.x + dx;
            let ny = orig.y + dy;
            let guides: SnapGuide[] = [];
            if (snapEnabled) {
              const snapped = snapLayerPosition(
                orig,
                nx,
                ny,
                layers.filter((l) => l.id !== drag.layerId),
              );
              nx = snapped.x;
              ny = snapped.y;
              guides = snapped.guides;
            }
            setSnapGuides(guides);
            return { ...layer, x: nx, y: ny };
          }
          case "resize-se": {
            const newW = Math.max(MIN_LAYER_SIZE, Math.min(MAX_LAYER_SIZE, orig.width + dx));
            const newH = lockRatio
              ? newW * (orig.height / orig.width)
              : Math.max(MIN_LAYER_SIZE, Math.min(MAX_LAYER_SIZE, orig.height + dy));
            return { ...layer, width: newW, height: newH };
          }
          case "resize-nw": {
            const newW = Math.max(MIN_LAYER_SIZE, Math.min(MAX_LAYER_SIZE, orig.width - dx));
            const newH = lockRatio
              ? newW * (orig.height / orig.width)
              : Math.max(MIN_LAYER_SIZE, Math.min(MAX_LAYER_SIZE, orig.height - dy));
            const actualDx = orig.width - newW;
            const actualDy = orig.height - newH;
            return {
              ...layer,
              width: newW,
              height: newH,
              x: orig.x + actualDx / 2,
              y: orig.y + actualDy / 2,
            };
          }
          case "resize-ne": {
            const newW = Math.max(MIN_LAYER_SIZE, Math.min(MAX_LAYER_SIZE, orig.width + dx));
            const newH = lockRatio
              ? newW * (orig.height / orig.width)
              : Math.max(MIN_LAYER_SIZE, Math.min(MAX_LAYER_SIZE, orig.height - dy));
            const actualDy = orig.height - newH;
            return {
              ...layer,
              width: newW,
              height: newH,
              x: orig.x + dx / 2,
              y: orig.y + actualDy / 2,
            };
          }
          case "resize-sw": {
            const newW = Math.max(MIN_LAYER_SIZE, Math.min(MAX_LAYER_SIZE, orig.width - dx));
            const newH = lockRatio
              ? newW * (orig.height / orig.width)
              : Math.max(MIN_LAYER_SIZE, Math.min(MAX_LAYER_SIZE, orig.height + dy));
            const actualDx = orig.width - newW;
            return {
              ...layer,
              width: newW,
              height: newH,
              x: orig.x + actualDx / 2,
              y: orig.y + dy / 2,
            };
          }

          case "rotate": {
            const angle = Math.atan2(y - layer.y, x - layer.x) * (180 / Math.PI) + 90;
            return { ...layer, rotation: angle };
          }

          default:
            return layer;
        }
      });

      onLayersChange(updated);
    },
    [layers, onLayersChange, toCanvasCoords, lockRatio, snapEnabled],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    setSnapGuides([]);
  }, []);

  // ── Zoom with wheel ────────────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom((z) => Math.max(0.2, Math.min(5, z + delta)));
    },
    [],
  );

  // ── Layer actions ──────────────────────────────────────────────────────────

  const updateSelectedProp = useCallback(
    (prop: keyof NailLayer, value: number) => {
      onLayersChange(
        layers.map((l) => (l.selected ? { ...l, [prop]: value } : l)),
      );
    },
    [layers, onLayersChange],
  );

  const applySnappedMove = useCallback(
    (sel: NailLayer, nx: number, ny: number) => {
      if (snapEnabled) {
        const snapped = snapLayerPosition(
          sel,
          nx,
          ny,
          layers.filter((l) => l.id !== sel.id),
        );
        onLayersChange(
          layers.map((l) =>
            l.id === sel.id ? { ...l, x: snapped.x, y: snapped.y } : l,
          ),
        );
      } else {
        onLayersChange(
          layers.map((l) =>
            l.id === sel.id ? { ...l, x: nx, y: ny } : l,
          ),
        );
      }
    },
    [layers, onLayersChange, snapEnabled],
  );

  const deleteSelected = useCallback(() => {
    onLayersChange(layers.filter((l) => !l.selected));
  }, [layers, onLayersChange]);

  const moveLayerOrder = useCallback(
    (id: string, direction: "up" | "down") => {
      const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const target = direction === "up" ? idx + 1 : idx - 1;
      if (target < 0 || target >= sorted.length) return;
      const a = sorted[idx]!;
      const b = sorted[target]!;
      onLayersChange(
        layers.map((l) => {
          if (l.id === a.id) return { ...l, zIndex: b.zIndex };
          if (l.id === b.id) return { ...l, zIndex: a.zIndex };
          return l;
        }),
      );
    },
    [layers, onLayersChange],
  );

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = CANVAS_WIDTH;
    exportCanvas.height = CANVAS_HEIGHT;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    if (bgColor !== "transparent") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of sorted) {
      try {
        const img = await loadImage(layer.imageUrl);
        ctx.save();
        ctx.translate(layer.x, layer.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        const halfW = layer.width / 2;
        const halfH = layer.height / 2;
        ctx.drawImage(img, -halfW, -halfH, layer.width, layer.height);
        ctx.restore();
      } catch { /* skip */ }
    }

    exportCanvas.toBlob((blob) => {
      if (blob) onExport(blob);
    }, "image/png");
  }, [layers, bgColor, loadImage, onExport]);

  // ── Cursor ─────────────────────────────────────────────────────────────────

  const [cursorStyle, setCursorStyle] = useState<string>("default");

  const handleMouseMoveWithCursor = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) {
        const mode = dragRef.current.mode;
        if (mode === "move") setCursorStyle("grabbing");
        else if (mode === "rotate") setCursorStyle("crosshair");
        else setCursorStyle("nwse-resize");
        handleMouseMove(e);
        return;
      }
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      const mode = hitTestSelected(x, y);
      if (mode === "move") setCursorStyle("grab");
      else if (mode === "rotate" && activeTool === "rotate") setCursorStyle("crosshair");
      else if (mode) setCursorStyle("nwse-resize");
      else if (findLayerAtPoint(x, y)) setCursorStyle("pointer");
      else setCursorStyle("default");
    },
    [handleMouseMove, toCanvasCoords, hitTestSelected, findLayerAtPoint, activeTool],
  );

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      // 全局排版快捷键（无需选中）
      if (e.key === "[") {
        e.preventDefault();
        bumpHorizontalGap(e.shiftKey ? -8 : -4);
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        bumpHorizontalGap(e.shiftKey ? 8 : 4);
        return;
      }
      if ((e.key === "-" || e.key === "=" || e.key === "+") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        bumpGlobalScale(e.key === "-" ? -5 : 5);
        return;
      }

      const sel = layers.find((l) => l.selected);
      if (!sel) return;
      const step = e.shiftKey ? 10 : 1;
      switch (e.key) {
        case "ArrowLeft": {
          e.preventDefault();
          applySnappedMove(sel, sel.x - step, sel.y);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          applySnappedMove(sel, sel.x + step, sel.y);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          applySnappedMove(sel, sel.x, sel.y - step);
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          applySnappedMove(sel, sel.x, sel.y + step);
          break;
        }
        case "Delete":
        case "Backspace":
          e.preventDefault();
          deleteSelected();
          break;
        case "-":
          e.preventDefault();
          scaleSelected(0.95);
          break;
        case "=":
        case "+":
          e.preventDefault();
          scaleSelected(1.05);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layers, applySnappedMove, deleteSelected, bumpHorizontalGap, bumpGlobalScale, scaleSelected]);

  // ── Selected layer ─────────────────────────────────────────────────────────

  const selectedLayer = layers.find((l) => l.selected);
  const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[min(720px,calc(100vh-14rem))] flex-col overflow-hidden rounded-xl border border-zinc-300 bg-zinc-100 shadow-lg">
      {/* ── Workflow header ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-300 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <StepBadge done label="上传" />
          <span className="text-zinc-300">→</span>
          <StepBadge done label="抠图" />
          <span className="text-zinc-300">→</span>
          <StepBadge done label="裁切" />
          <span className="text-zinc-300">→</span>
          <StepBadge active label="排版" />
        </div>
        {sourcePreviewUrl ? (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sourcePreviewUrl}
              alt="原图"
              className="h-8 w-8 rounded object-cover"
            />
            <span className="text-[11px] text-zinc-500">原图参考</span>
          </div>
        ) : null}
        <div className="flex-1" />
        {onBackToCropper ? (
          <button
            type="button"
            onClick={onBackToCropper}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            ← 返回裁切
          </button>
        ) : null}
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            重新抠图
          </button>
        ) : null}
        <span className="hidden text-xs text-zinc-400 lg:inline">
          [ ] 行内间距 · −/+ 单枚缩放 · ⌘−/⌘+ 全体缩放 · 方向键微调
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
      {/* ── Left Toolbar ── */}
      <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-zinc-300 bg-zinc-200/80 py-2">
        <ToolBtn
          icon="✥"
          label="移动"
          active={activeTool === "move"}
          onClick={() => setActiveTool("move")}
        />
        <ToolBtn
          icon="↻"
          label="旋转"
          active={activeTool === "rotate"}
          onClick={() => setActiveTool("rotate")}
        />
        <div className="my-1 h-px w-6 bg-zinc-400/40" />
        <ToolBtn
          icon="⊟"
          label="缩小行距"
          onClick={() => bumpHorizontalGap(-4)}
        />
        <ToolBtn
          icon="⊞"
          label="增大行距"
          onClick={() => bumpHorizontalGap(4)}
        />
        <div className="flex-1" />
        <ToolBtn icon="🔍" label="重置缩放" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }} />
      </div>

      {/* ── Center: Canvas ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex h-9 items-center gap-3 border-b border-zinc-300 bg-zinc-200/60 px-3 text-[11px] text-zinc-600">
          <span className="font-mono">{CANVAS_WIDTH}×{CANVAS_HEIGHT}</span>
          <span className="text-zinc-400">|</span>
          <span>{Math.round(zoom * 100)}%</span>
          <span className="text-zinc-400">|</span>
          <label className="flex items-center gap-1">
            锁比
            <input
              type="checkbox"
              checked={lockRatio}
              onChange={(e) => setLockRatio(e.target.checked)}
              className="h-3 w-3 rounded"
            />
          </label>
          <span className="text-zinc-400">|</span>
          <label className="flex items-center gap-1">
            吸附
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(e) => setSnapEnabled(e.target.checked)}
              className="h-3 w-3 rounded"
            />
          </label>
          <span className="text-zinc-400">|</span>
          <label className="flex items-center gap-1">
            背景
            <select
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-[11px]"
            >
              <option value="#ffffff">白</option>
              <option value="#f7f7f7">灰</option>
              <option value="transparent">透明</option>
            </select>
          </label>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleExport}
            className="rounded bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
          >
            导出 PNG
          </button>
        </div>

        {/* Canvas area */}
        <div
          ref={canvasWrapRef}
          className="relative flex-1 overflow-hidden"
          style={{ cursor: cursorStyle }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMoveWithCursor}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="absolute"
            style={{
              width: CANVAS_WIDTH * zoom,
              height: CANVAS_HEIGHT * zoom,
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px))`,
              imageRendering: zoom > 2 ? "pixelated" : "auto",
            }}
          />
        </div>

        {/* Bottom properties bar */}
        {selectedLayer ? (
          <div className="flex h-11 flex-wrap items-center gap-2 border-t border-zinc-300 bg-zinc-200/60 px-3 text-[11px]">
            <span className="font-medium text-zinc-700">
              #{layers.findIndex((l) => l.id === selectedLayer.id) + 1}
            </span>
            <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white p-0.5">
              <NudgeBtn label="←" title="左移 1px" onClick={() => applySnappedMove(selectedLayer, selectedLayer.x - 1, selectedLayer.y)} />
              <NudgeBtn label="→" title="右移 1px" onClick={() => applySnappedMove(selectedLayer, selectedLayer.x + 1, selectedLayer.y)} />
              <NudgeBtn label="↑" title="上移 1px" onClick={() => applySnappedMove(selectedLayer, selectedLayer.x, selectedLayer.y - 1)} />
              <NudgeBtn label="↓" title="下移 1px" onClick={() => applySnappedMove(selectedLayer, selectedLayer.x, selectedLayer.y + 1)} />
            </div>
            <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white p-0.5">
              <NudgeBtn label="−" title="缩小 5%" onClick={() => scaleSelected(0.95)} />
              <span className="min-w-[2.5rem] text-center tabular-nums text-zinc-500">
                {Math.round(selectedLayer.width)}px
              </span>
              <NudgeBtn label="+" title="放大 5%" onClick={() => scaleSelected(1.05)} />
            </div>
            <PropInput
              label="X"
              value={selectedLayer.x}
              onChange={(v) => updateSelectedProp("x", v)}
            />
            <PropInput
              label="Y"
              value={selectedLayer.y}
              onChange={(v) => updateSelectedProp("y", v)}
            />
            <div className="flex-1" />
            <button
              type="button"
              onClick={deleteSelected}
              className="rounded border border-red-300 bg-white px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
            >
              删除
            </button>
          </div>
        ) : (
          <div className="flex h-11 items-center border-t border-zinc-300 bg-zinc-200/60 px-3 text-[11px] text-zinc-400">
            右侧调整行距 · 点击甲片后方向键或微调按钮修重叠 · [ ] 快捷缩进行距
          </div>
        )}
      </div>

      {/* ── Right: Layer Panel ── */}
      {layerPanelOpen && (
        <div className="flex w-56 flex-col border-l border-zinc-300 bg-zinc-200/80">
          {/* 快速排版 */}
          <div className="border-b border-zinc-300 bg-white/60 px-3 py-2.5">
            <div className="mb-2 text-[11px] font-semibold text-zinc-700">快速排版</div>
            <LayoutSlider
              label="行内间距"
              value={hGap}
              min={0}
              max={120}
              step={2}
              unit="px"
              onChange={(v) => applyRowPack(v, vGap)}
              onBump={(d) => bumpHorizontalGap(d)}
            />
            <LayoutSlider
              label="行间间距"
              value={vGap}
              min={0}
              max={160}
              step={4}
              unit="px"
              onChange={(v) => applyRowPack(hGap, v)}
              onBump={(d) => bumpVerticalGap(d)}
            />
            <LayoutSlider
              label="全体大小"
              value={globalScale}
              min={50}
              max={180}
              step={5}
              unit="%"
              onChange={(v) => {
                const factor = v / globalScale;
                setGlobalScale(v);
                const scaled = scaleAllLayers(layers, factor);
                onLayersChange(packLayersByRows(scaled, hGap, vGap));
              }}
              onBump={(d) => bumpGlobalScale(d)}
            />
            <div className="mt-2 flex flex-wrap gap-1">
              <MiniBtn
                label="行对齐"
                title="各行 Y 轴对齐"
                onClick={() => onLayersChange(alignRowsBaseline(layers))}
              />
              <MiniBtn
                label="均匀分布"
                title="各行内等距分布"
                onClick={() => onLayersChange(distributeRowsEvenly(layers))}
              />
              <MiniBtn
                label="重置"
                title="恢复默认网格排列"
                onClick={() => {
                  const packed = packLayersByRows(autoArrangeLayers(layers), 20, 40);
                  onLayersChange(packed);
                  setHGap(20);
                  setVGap(40);
                  setGlobalScale(100);
                }}
              />
            </div>
          </div>

          <div className="flex h-9 items-center justify-between border-b border-zinc-300 px-2">
            <span className="text-[11px] font-semibold text-zinc-700">图层</span>
            <span className="text-[10px] text-zinc-400">{layers.length} 枚</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sortedLayers.map((layer) => {
              const idx = layers.findIndex((l) => l.id === layer.id);
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => {
                    const isSwitch = selectedLayer?.id !== layer.id;
                    onLayersChange(
                      layers.map((l) => ({
                        ...l,
                        selected: l.id === layer.id,
                        zIndex:
                          l.id === layer.id
                            ? Math.max(...layers.map((ll) => ll.zIndex)) + 1
                            : l.zIndex,
                      })),
                    );
                    if (isSwitch) {
                      setActiveTool("move");
                      setSnapGuides([]);
                    }
                  }}
                  className={`flex w-full items-center gap-2 border-b border-zinc-300/60 px-2 py-1.5 text-left transition ${
                    layer.selected
                      ? "bg-blue-100/80"
                      : "hover:bg-zinc-300/40"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded border border-zinc-300 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={layer.imageUrl}
                      alt={`甲片 ${idx + 1}`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-zinc-800">
                      甲片 {idx + 1}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {Math.round(layer.width)}×{Math.round(layer.height)}
                      {" · "}
                      {Math.round(normAngle(layer.rotation))}°
                    </div>
                  </div>
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayerOrder(layer.id, "up");
                      }}
                      className="h-3.5 w-4 text-[9px] leading-none text-zinc-500 hover:text-zinc-800"
                      title="上移一层"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayerOrder(layer.id, "down");
                      }}
                      className="h-3.5 w-4 text-[9px] leading-none text-zinc-500 hover:text-zinc-800"
                      title="下移一层"
                    >
                      ▼
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toggle layer panel */}
      <button
        type="button"
        onClick={() => setLayerPanelOpen((o) => !o)}
        className="flex w-5 shrink-0 items-center justify-center border-l border-zinc-300 bg-zinc-200/80 text-[10px] text-zinc-600 transition hover:bg-zinc-300"
        title={layerPanelOpen ? "收起图层面板" : "展开图层面板"}
      >
        {layerPanelOpen ? "›" : "‹"}
      </button>
      </div>
    </div>
  );
}

function StepBadge({
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function ToolBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded text-sm transition ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-zinc-700 hover:bg-zinc-300/60"
      }`}
    >
      {icon}
    </button>
  );
}

function NudgeBtn({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-6 min-w-[1.5rem] items-center justify-center rounded px-1 text-[11px] text-zinc-700 hover:bg-zinc-100"
    >
      {label}
    </button>
  );
}

function LayoutSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  onBump,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  onBump: (delta: number) => void;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-600">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-500">
          {value}
          {unit}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onBump(-step)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-xs text-zinc-600 hover:bg-zinc-50"
        >
          −
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-rose-500"
        />
        <button
          type="button"
          onClick={() => onBump(step)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-xs text-zinc-600 hover:bg-zinc-50"
        >
          +
        </button>
      </div>
    </div>
  );
}

function MiniBtn({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[10px] text-zinc-700 hover:bg-zinc-50"
    >
      {label}
    </button>
  );
}

function PropInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(Math.round(value)));

  // Sync draft when value changes externally
  useEffect(() => {
    setDraft(String(Math.round(value)));
  }, [value]);

  return (
    <label className="flex items-center gap-1 text-zinc-600">
      <span className="w-3 text-right text-zinc-500">{label}</span>
      <input
        type="number"
        value={draft}
        step={step}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        onBlur={() => setDraft(String(Math.round(value)))}
        className="w-14 rounded border border-zinc-300 bg-white px-1 py-0.5 text-[11px] tabular-nums outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
      />
    </label>
  );
}
