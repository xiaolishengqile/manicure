"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  GENERATION_MODE_OPTIONS,
  getDualUploadKind,
  requiresTenSingleNails,
  type GenerationMode,
  type NailsInBoxArrangement,
} from "@/lib/generation-modes";
import {
  LS_GRID_LAYOUT_PRESETS,
  MAX_GRID_LAYOUT_PRESETS,
  newGridPresetId,
  parseGridLayoutPresets,
  type GridLayoutPreset,
} from "@/lib/grid-layout-presets";
import {
  DEFAULT_TEN_SINGLES_GRID_LAYOUT,
  INTER_NAIL_COL_GAP_OPTIONS,
  type InterNailColGapMode,
} from "@/lib/ten-singles-grid-layout";

const DEFAULT_COL_WIDTH_DRAFTS = DEFAULT_TEN_SINGLES_GRID_LAYOUT.colWidthFrac.map(
  (n) => String(n),
);

function parsePctInput(
  raw: string,
  min: number,
  max: number,
  emptyFallback: number,
): number {
  const t = raw.trim().replace(/,/g, ".");
  if (t === "") return emptyFallback;
  const v = parseFloat(t);
  if (Number.isNaN(v)) return emptyFallback;
  return Math.min(max, Math.max(min, v));
}

/** 失焦后与提交一致：列缝/行缝、外留白不支持负数，会夹到合法区间 */
function pctDraftAfterBlur(
  raw: string,
  min: number,
  max: number,
  emptyFallback: number,
): string {
  return String(parsePctInput(raw, min, max, emptyFallback));
}

function colWidthDraftAfterBlur(raw: string, colIndex: number): string {
  const t = raw.trim().replace(/,/g, ".");
  if (t === "") return DEFAULT_COL_WIDTH_DRAFTS[colIndex] ?? "1";
  const v = parseFloat(t);
  if (Number.isNaN(v)) return DEFAULT_COL_WIDTH_DRAFTS[colIndex] ?? "1";
  return String(Math.min(1, Math.max(0.55, v)));
}

/** 提交用：空或非数字则回退到默认该列 */
function serializeColWidthDrafts(drafts: string[]): string {
  const nums = drafts.map((s, i) => {
    const t = s.trim().replace(/,/g, ".");
    if (t === "") return DEFAULT_TEN_SINGLES_GRID_LAYOUT.colWidthFrac[i] ?? 1;
    const v = parseFloat(t);
    if (Number.isNaN(v)) return DEFAULT_TEN_SINGLES_GRID_LAYOUT.colWidthFrac[i] ?? 1;
    return Math.min(1, Math.max(0.55, v));
  });
  return nums.join(",");
}
import { DEFAULT_USER_PROMPT_PRESETS } from "@/lib/prompt-presets-defaults";

const LS_LAST_USER_NOTES = "manicure_last_user_extra_notes";
const LS_PROMPT_PRESETS = "manicure_user_prompt_presets";
const MAX_PRESETS = 40;
const MAX_PRESET_LINE_CHARS = 200;

type PromptPresetItem = { id: string; text: string };

function newPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function defaultPresetItems(): PromptPresetItem[] {
  return DEFAULT_USER_PROMPT_PRESETS.map((text, i) => ({
    id: `builtin-${i}`,
    text,
  }));
}

/** 兼容旧版 string[] 与新版 { id, text }[] */
function parseStoredPresets(raw: string): PromptPresetItem[] | null {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (arr.every((x): x is string => typeof x === "string")) {
      const lines = arr
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.slice(0, MAX_PRESET_LINE_CHARS))
        .slice(0, MAX_PRESETS);
      if (!lines.length) return null;
      return lines.map((text) => ({ id: newPresetId(), text }));
    }
    const out: PromptPresetItem[] = [];
    for (const entry of arr) {
      if (typeof entry !== "object" || entry === null) continue;
      const o = entry as Record<string, unknown>;
      const textRaw = typeof o.text === "string" ? o.text.trim() : "";
      const text = textRaw.slice(0, MAX_PRESET_LINE_CHARS);
      if (!text) continue;
      const id =
        typeof o.id === "string" && o.id.length > 0 ? o.id : newPresetId();
      out.push({ id, text });
      if (out.length >= MAX_PRESETS) break;
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

type TenSlotCell = { file: File | null; previewUrl: string | null };

function emptyTenSlots(): TenSlotCell[] {
  return Array.from({ length: 10 }, () => ({ file: null, previewUrl: null }));
}

function UploadTile({
  title,
  hint,
  previewUrl,
  onPick,
}: {
  title: string;
  hint: string;
  previewUrl: string | null;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50/60"
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={title}
          className="max-h-40 w-full rounded-lg object-contain"
        />
      ) : (
        <>
          <span className="text-sm font-medium text-zinc-800">{title}</span>
          <span className="text-xs text-zinc-500">{hint}</span>
        </>
      )}
    </button>
  );
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);
  const tenInputRef = useRef<HTMLInputElement>(null);
  const tenSlotInputRef = useRef<HTMLInputElement>(null);
  const tenSlotPickIndexRef = useRef<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null);
  const [secondPreviewUrl, setSecondPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>("extract_ten_grid");
  const [nailBoxArrangement, setNailBoxArrangement] =
    useState<NailsInBoxArrangement>("vertical");
  /** 文本草稿：可删光再输入，提交时再解析成数字 */
  const [colWidthDrafts, setColWidthDrafts] = useState<string[]>(() => [
    ...DEFAULT_COL_WIDTH_DRAFTS,
  ]);
  const [marginPctDraft, setMarginPctDraft] = useState("1.8");
  const [colInterNailGap, setColInterNailGap] =
    useState<InterNailColGapMode>("tight");
  const [rowGutterPctDraft, setRowGutterPctDraft] = useState("0");
  const [gridPresets, setGridPresets] = useState<GridLayoutPreset[]>([]);
  const [gridPresetSelectedIndex, setGridPresetSelectedIndex] = useState<
    number | null
  >(null);
  const [gridPresetNotice, setGridPresetNotice] = useState<string | null>(null);
  const skipFirstGridPresetPersist = useRef(true);
  /** 新增一套后由 effect 写入选中下标与提示，避免 updater 内副作用 */
  const pendingGridAppendRef = useRef(false);
  const gridPresetChipsRowRef = useRef<HTMLDivElement>(null);
  const gridLayoutSavePresetButtonRef = useRef<HTMLButtonElement>(null);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [resultLabels, setResultLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadBusyIndex, setDownloadBusyIndex] = useState<number | null>(
    null,
  );
  const [feedFromResultBusyIndex, setFeedFromResultBusyIndex] = useState<
    number | null
  >(null);
  /** 下标 0–9 即合成第 1–10 位顺序，与 FormData append 顺序一致 */
  const [tenSlots, setTenSlots] = useState<TenSlotCell[]>(() => emptyTenSlots());

  const [userExtraNotes, setUserExtraNotes] = useState("");
  const skipNextNotesPersist = useRef(true);
  const [promptPresets, setPromptPresets] =
    useState<PromptPresetItem[]>(defaultPresetItems);
  const skipFirstPresetPersist = useRef(true);
  const [presetPanelOpen, setPresetPanelOpen] = useState(false);
  const [newPresetDraft, setNewPresetDraft] = useState("");
  const [draggingPresetIndex, setDraggingPresetIndex] = useState<number | null>(
    null,
  );
  const [dragOverPresetIndex, setDragOverPresetIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    try {
      const t = localStorage.getItem(LS_LAST_USER_NOTES);
      if (t != null) setUserExtraNotes(t);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_PROMPT_PRESETS);
      if (!raw) return;
      const next = parseStoredPresets(raw);
      if (next?.length) setPromptPresets(next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_GRID_LAYOUT_PRESETS);
      setGridPresets(parseGridLayoutPresets(raw, DEFAULT_COL_WIDTH_DRAFTS));
    } catch {
      setGridPresets([]);
    }
  }, []);

  useEffect(() => {
    if (skipFirstGridPresetPersist.current) {
      skipFirstGridPresetPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(LS_GRID_LAYOUT_PRESETS, JSON.stringify(gridPresets));
    } catch {
      /* private mode */
    }
  }, [gridPresets]);

  useEffect(() => {
    if (!gridPresetNotice) return;
    const t = setTimeout(() => setGridPresetNotice(null), 3500);
    return () => clearTimeout(t);
  }, [gridPresetNotice]);

  useEffect(() => {
    if (!pendingGridAppendRef.current) return;
    pendingGridAppendRef.current = false;
    if (gridPresets.length === 0) return;
    const n = gridPresets.length;
    setGridPresetSelectedIndex(null);
    setGridPresetNotice(`已保存为第 ${n} 套`);
  }, [gridPresets]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (gridPresetSelectedIndex === null) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (gridPresetChipsRowRef.current?.contains(t)) return;
      if (gridLayoutSavePresetButtonRef.current?.contains(t)) return;
      setGridPresetSelectedIndex(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [gridPresetSelectedIndex]);

  useEffect(() => {
    if (skipNextNotesPersist.current) {
      skipNextNotesPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(LS_LAST_USER_NOTES, userExtraNotes);
    } catch {
      /* ignore */
    }
  }, [userExtraNotes]);

  useEffect(() => {
    if (skipFirstPresetPersist.current) {
      skipFirstPresetPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(LS_PROMPT_PRESETS, JSON.stringify(promptPresets));
    } catch {
      /* ignore */
    }
  }, [promptPresets]);

  const dualKind = getDualUploadKind(mode);
  const tenMode = requiresTenSingleNails(mode);

  const applyGridPresetAt = useCallback(
    (index: number) => {
      if (gridPresetSelectedIndex === index) {
        setGridPresetSelectedIndex(null);
        setGridPresetNotice(null);
        return;
      }
      const p = gridPresets[index];
      if (!p) return;
      setColWidthDrafts([...p.colWidthDrafts]);
      setMarginPctDraft(p.marginPctDraft);
      setColInterNailGap(p.colGapMode);
      setRowGutterPctDraft(p.rowGutterPctDraft);
      setGridPresetSelectedIndex(index);
      setGridPresetNotice(null);
    },
    [gridPresets, gridPresetSelectedIndex],
  );

  const deleteGridPresetAt = useCallback((index: number) => {
    setGridPresets((prev) => prev.filter((_, i) => i !== index));
    setGridPresetSelectedIndex((sel) => {
      if (sel === null) return null;
      if (sel === index) return null;
      if (sel > index) return sel - 1;
      return sel;
    });
    setGridPresetNotice(null);
  }, []);

  const saveGridLayoutPreset = useCallback(() => {
    setGridPresetNotice(null);
    const snap = {
      colWidthDrafts: [...colWidthDrafts],
      marginPctDraft,
      colGapMode: colInterNailGap,
      rowGutterPctDraft,
    };
    const sel = gridPresetSelectedIndex;
    if (
      sel !== null &&
      sel >= 0 &&
      sel < gridPresets.length
    ) {
      setGridPresets((prev) =>
        prev.map((p, i) => (i === sel ? { ...p, ...snap } : p)),
      );
      setGridPresetNotice(`已覆盖第 ${sel + 1} 套`);
      return;
    }
    if (gridPresets.length >= MAX_GRID_LAYOUT_PRESETS) {
      setGridPresetNotice(
        "已满 5 套，请先点选要覆盖的一套再点「保存配置」，或点 × 删除一套。",
      );
      return;
    }
    pendingGridAppendRef.current = true;
    setGridPresets((prev) => {
      if (prev.length >= MAX_GRID_LAYOUT_PRESETS) {
        pendingGridAppendRef.current = false;
        queueMicrotask(() =>
          setGridPresetNotice(
            "已满 5 套，请先点选要覆盖的一套再点「保存配置」，或点 × 删除一套。",
          ),
        );
        return prev;
      }
      return [...prev, { id: newGridPresetId(), ...snap }];
    });
  }, [
    colWidthDrafts,
    marginPctDraft,
    colInterNailGap,
    rowGutterPctDraft,
    gridPresetSelectedIndex,
    gridPresets.length,
  ]);

  const clearResults = useCallback(() => {
    setResultUrls([]);
    setResultLabels([]);
  }, []);

  const downloadResult = useCallback(async (url: string, index: number) => {
    const extFromDataUrl = (u: string): string => {
      const m = /^data:image\/(png|jpeg|jpg|webp|gif)/i.exec(u);
      if (!m) return "png";
      const t = m[1].toLowerCase();
      return t === "jpeg" ? "jpg" : t;
    };
    const extFromContentType = (ct: string | null): string => {
      if (!ct) return "png";
      if (ct.includes("webp")) return "webp";
      if (ct.includes("jpeg")) return "jpg";
      if (ct.includes("png")) return "png";
      if (ct.includes("gif")) return "gif";
      return "png";
    };

    setDownloadBusyIndex(index);
    setError(null);
    try {
      if (url.startsWith("data:image/")) {
        const ext = extFromDataUrl(url);
        const filename = `美甲生成_${index + 1}.${ext}`;
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        a.click();
        return;
      }
      if (url.startsWith("http://") || url.startsWith("https://")) {
        const res = await fetch("/api/download-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) {
          const text = await res.text();
          let msg = "下载失败";
          try {
            const j = JSON.parse(text) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            if (text) msg = text.slice(0, 120);
          }
          throw new Error(msg);
        }
        const ext = extFromContentType(res.headers.get("content-type"));
        const filename = `美甲生成_${index + 1}.${ext}`;
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        a.rel = "noopener";
        a.click();
        URL.revokeObjectURL(objectUrl);
        return;
      }
      throw new Error("不支持的图片地址格式");
    } catch (e) {
      setError(e instanceof Error ? e.message : "下载失败，请稍后重试。");
    } finally {
      setDownloadBusyIndex(null);
    }
  }, []);

  const convertResultToFeedImage = useCallback(
    async (url: string, index: number) => {
      if (tenMode) return;
      setFeedFromResultBusyIndex(index);
      setError(null);
      try {
        let blob: Blob;
        if (url.startsWith("data:image/")) {
          const res = await fetch(url);
          blob = await res.blob();
        } else if (url.startsWith("http://") || url.startsWith("https://")) {
          const res = await fetch("/api/download-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          if (!res.ok) {
            const text = await res.text();
            let msg = "获取图片失败";
            try {
              const j = JSON.parse(text) as { error?: string };
              if (j.error) msg = j.error;
            } catch {
              if (text) msg = text.slice(0, 120);
            }
            throw new Error(msg);
          }
          blob = await res.blob();
        } else {
          throw new Error("不支持的图片地址格式");
        }
        const mime = blob.type || "image/png";
        const ext = mime.includes("webp")
          ? "webp"
          : mime.includes("jpeg") || mime.includes("jpg")
            ? "jpg"
            : "png";
        const newFile = new File([blob], `投喂图_${index + 1}.${ext}`, {
          type: mime.startsWith("image/") ? mime : "image/png",
        });
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(newFile);
        });
        setFile(newFile);
        clearResults();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "无法将该图设为投喂图片，请稍后重试。",
        );
      } finally {
        setFeedFromResultBusyIndex(null);
      }
    },
    [tenMode, clearResults],
  );

  const onPickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onPickSecond = useCallback(() => {
    secondInputRef.current?.click();
  }, []);

  const onPickTenBatch = useCallback(() => {
    tenInputRef.current?.click();
  }, []);

  const clearTenSlots = useCallback(() => {
    setTenSlots((slots) => {
      slots.forEach((c) => {
        if (c.previewUrl) URL.revokeObjectURL(c.previewUrl);
      });
      return emptyTenSlots();
    });
  }, []);

  const removeTenSlot = useCallback((index: number) => {
    setTenSlots((prev) => {
      const next = [...prev];
      const cell = next[index];
      if (!cell) return prev;
      if (cell.previewUrl) URL.revokeObjectURL(cell.previewUrl);
      next[index] = { file: null, previewUrl: null };
      return next;
    });
  }, []);

  const beginPickTenSlot = useCallback((index: number) => {
    tenSlotPickIndexRef.current = index;
    tenSlotInputRef.current?.click();
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setError(null);
    clearResults();
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError(
        mode === "flat_to_3d_packaging"
          ? "2D 包装平面稿请选择图片文件。"
          : mode === "nails_in_box"
            ? "美甲款式图请选择图片文件。"
            : "美甲产品图请选择图片文件。",
      );
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }, [clearResults, mode]);

  const onSecondFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      setError(null);
      clearResults();
      if (!f) {
        setSecondFile(null);
        setSecondPreviewUrl(null);
        return;
      }
      if (!f.type.startsWith("image/")) {
        setError(
          dualKind === "accessory"
            ? "饰品参考图请选择图片文件。"
            : dualKind === "packaging_pose"
              ? "握姿参考图请选择图片文件。"
              : dualKind === "packaging_3d_ref"
                ? "3D/摄影参考图请选择图片文件。"
                : dualKind === "nails_box"
                  ? "包装盒样式参考图请选择图片文件。"
                  : "模特图请选择图片文件。",
        );
        setSecondFile(null);
        setSecondPreviewUrl(null);
        return;
      }
      setSecondFile(f);
      setSecondPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(f);
      });
    },
    [clearResults, dualKind],
  );

  const onTenBatchFilesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.target.files ?? []);
      setError(null);
      clearResults();
      e.target.value = "";
      if (picked.length !== 10) {
        setError("请一次选择恰好 10 张单甲图片。");
        return;
      }
      for (const f of picked) {
        if (!f.type.startsWith("image/")) {
          setError("10 张文件均须为图片格式。");
          return;
        }
      }
      setTenSlots((prev) => {
        prev.forEach((c) => {
          if (c.previewUrl) URL.revokeObjectURL(c.previewUrl);
        });
        return picked.map((f) => ({
          file: f,
          previewUrl: URL.createObjectURL(f),
        }));
      });
    },
    [clearResults],
  );

  const onTenSlotFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const slotIndex = tenSlotPickIndexRef.current;
      tenSlotPickIndexRef.current = null;
      const f = e.target.files?.[0];
      e.target.value = "";
      setError(null);
      clearResults();
      if (slotIndex === null || slotIndex < 0 || slotIndex > 9) return;
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        setError("请选择图片文件。");
        return;
      }
      setTenSlots((prev) => {
        const next = [...prev];
        const old = next[slotIndex];
        if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
        next[slotIndex] = {
          file: f,
          previewUrl: URL.createObjectURL(f),
        };
        return next;
      });
    },
    [clearResults],
  );

  const onExtract = useCallback(async () => {
    if (tenMode) {
      if (!tenSlots.every((s) => s.file)) {
        setError("请填满全部 10 个格子后再生成（可逐格添加或一次选 10 张）。");
        return;
      }
    } else if (dualKind) {
      if (!file || !secondFile) {
        setError(
          dualKind === "accessory"
            ? "请同时上传「美甲产品图」与「饰品参考图」。"
            : dualKind === "packaging_pose"
              ? "请同时上传「美甲产品图」与「握姿参考图」（真实手握盒构图）。"
              : dualKind === "packaging_3d_ref"
                ? "请同时上传「2D 包装平面稿」与「3D/摄影参考图」。"
                : dualKind === "nails_box"
                  ? "请同时上传「美甲款式图」与「包装盒样式参考图」。"
                  : "请同时上传「美甲产品图」与「模特图」。",
        );
        return;
      }
    } else if (!file) {
      setError("请先选择一张美甲照片。");
      return;
    }

    setLoading(true);
    setError(null);
    clearResults();
    try {
      const body = new FormData();
      body.set("mode", mode);
      if (tenMode) {
        for (let i = 0; i < 10; i++) {
          const f = tenSlots[i]!.file;
          if (f) body.append("nail", f);
        }
        body.set("nailGridColWidths", serializeColWidthDrafts(colWidthDrafts));
        body.set(
          "nailGridMarginPct",
          String(parsePctInput(marginPctDraft, 0.5, 8, 1.8)),
        );
        body.set("nailGridColGapMode", colInterNailGap);
        body.set(
          "nailGridRowGutterPct",
          String(parsePctInput(rowGutterPctDraft, 0, 12, 0)),
        );
      } else {
        body.set("image", file!);
        if (dualKind === "model" && secondFile) {
          body.set("modelImage", secondFile);
        }
        if (dualKind === "accessory" && secondFile) {
          body.set("accessoryImage", secondFile);
        }
        if (dualKind === "packaging_pose" && secondFile) {
          body.set("packagingPoseImage", secondFile);
        }
        if (dualKind === "packaging_3d_ref" && secondFile) {
          body.set("packaging3dReferenceImage", secondFile);
        }
        if (dualKind === "nails_box" && secondFile) {
          body.set("packagingBoxImage", secondFile);
          body.set("nailArrangement", nailBoxArrangement);
        }
        if (
          mode === "complete_single_grid" ||
          mode === "extract_ten_grid"
        ) {
          body.set("nailGridColWidths", serializeColWidthDrafts(colWidthDrafts));
          body.set(
            "nailGridMarginPct",
            String(parsePctInput(marginPctDraft, 0.5, 8, 1.8)),
          );
          body.set("nailGridColGapMode", colInterNailGap);
          body.set(
            "nailGridRowGutterPct",
            String(parsePctInput(rowGutterPctDraft, 0, 12, 0)),
          );
        }
      }
      body.set("userExtraNotes", userExtraNotes);
      const res = await fetch("/api/extract-nails", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as {
        imageUrls?: string[];
        labels?: string[];
        imageUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `请求失败（${res.status}）`);
      }
      const urls = data.imageUrls?.length
        ? data.imageUrls
        : data.imageUrl
          ? [data.imageUrl]
          : [];
      if (!urls.length) {
        throw new Error("未收到结果图片。");
      }
      setResultUrls(urls);
      setResultLabels(data.labels ?? urls.map((_, i) => `图 ${i + 1}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理失败");
    } finally {
      setLoading(false);
    }
  }, [
    clearResults,
    dualKind,
    file,
    secondFile,
    mode,
    tenMode,
    tenSlots,
    userExtraNotes,
    nailBoxArrangement,
    colWidthDrafts,
    marginPctDraft,
    colInterNailGap,
    rowGutterPctDraft,
  ]);

  const clearUserNotes = useCallback(() => {
    setUserExtraNotes("");
    try {
      localStorage.removeItem(LS_LAST_USER_NOTES);
    } catch {
      /* ignore */
    }
  }, []);

  const appendPresetToNotes = useCallback((line: string) => {
    const t = line.trim().slice(0, MAX_PRESET_LINE_CHARS);
    if (!t) return;
    setUserExtraNotes((prev) => (prev.trim() ? `${prev.trim()}\n${t}` : t));
  }, []);

  const addPresetFromDraft = useCallback(() => {
    const t = newPresetDraft.trim().slice(0, MAX_PRESET_LINE_CHARS);
    if (!t) return;
    setPromptPresets((prev) => {
      if (prev.some((p) => p.text === t)) return prev;
      if (prev.length >= MAX_PRESETS) return prev;
      return [{ id: newPresetId(), text: t }, ...prev];
    });
    setNewPresetDraft("");
  }, [newPresetDraft]);

  const removePresetById = useCallback((id: string) => {
    setPromptPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const movePreset = useCallback((index: number, delta: -1 | 1) => {
    setPromptPresets((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[index]!;
      next[index] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }, []);

  const reorderPresetByDrag = useCallback((from: number, to: number) => {
    if (from === to) return;
    setPromptPresets((prev) => {
      if (
        from < 0 ||
        to < 0 ||
        from >= prev.length ||
        to >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [el] = next.splice(from, 1);
      next.splice(to, 0, el!);
      return next;
    });
  }, []);

  const clearPresetDragUi = useCallback(() => {
    setDraggingPresetIndex(null);
    setDragOverPresetIndex(null);
  }, []);

  const resultHeading =
    mode === "multi_angle"
      ? "产出（多角度上手 · 固定2张 · 真实棚拍感）"
      : mode === "packaging_mockup"
        ? "产出（包装 + 手握 · 1张）"
        : mode === "flat_to_3d_packaging"
          ? "产出（2D→3D 开窗盒装 · 1张）"
          : mode === "nails_in_box"
            ? "产出（开窗盒装 · 甲片入盒）"
            : mode === "model_tryon"
            ? "产出（试戴效果图）"
            : mode === "accessory_tryon"
              ? "产出（手模 · 指甲+饰品试戴）"
              : mode === "ten_singles_grid"
                ? "产出（十枚单甲 · 一张合集）"
                : mode === "extract_ten_grid"
                  ? "产出（白底栅格 · 仅抠图）"
                  : mode === "complete_single_grid"
                    ? "产出（白底栅格 · 单甲补齐10支）"
                    : "产出";

  const gridClass =
    mode === "multi_angle"
      ? "grid grid-cols-1 gap-6 md:grid-cols-2"
      : mode === "packaging_mockup"
        ? "grid grid-cols-1"
        : mode === "flat_to_3d_packaging"
          ? "grid grid-cols-1"
          : "grid grid-cols-1";

  const canSubmit =
    !loading &&
    (tenMode
      ? tenSlots.every((s) => s.file)
      : !!file && (!dualKind || !!secondFile));

  const secondSlotTitle =
    dualKind === "accessory"
      ? "点击选择饰品参考图（戒指等）"
      : dualKind === "packaging_pose"
        ? "点击选择握姿 / 构图参考"
        : dualKind === "packaging_3d_ref"
          ? "点击选择 3D/摄影参考图"
          : dualKind === "nails_box"
            ? "点击选择包装盒样式参考图"
            : "点击选择模特照片";
  const secondSlotHint =
    dualKind === "accessory"
      ? "可含多只戒指；成片会生成手模并同时戴上甲片与这些饰品"
      : dualKind === "packaging_pose"
        ? "真实手握包装盒（或相近握持）照片；用于锁定手型与镜头，款式以左侧产品图为准"
        : dualKind === "packaging_3d_ref"
          ? "实拍盒型、竞品主图、电商光影与白底投影等；若参考为「开窗见甲片」更佳。盒面印刷与配色仍以左侧 2D 稿为准"
          : dualKind === "nails_box"
            ? "盒型、开窗比例、背板质感与印刷风格；甲片款式以左侧图为准"
            : "需清晰露出指甲区域";

  const firstDualProductHint =
    dualKind === "packaging_pose"
      ? "款式来源：托盘、背卡、白底栅格等均可；不用于锁手型"
      : dualKind === "packaging_3d_ref"
        ? "正面/背面展开、屏显效果图、刀版图截图均可；为盒面图文唯一来源"
        : dualKind === "model" || dualKind === "accessory"
          ? "美甲产品图约定：甲尖朝下；每行从左到右大拇指→小指；试戴成图按格严格还原款式"
          : dualKind === "nails_box"
            ? "款式图：托盘/背卡/白底栅格均可；将按所选排列映射到盒内开窗"
            : "平铺、卡纸、白底商品图均可";

  const singleUploadTitle =
    mode === "extract_ten_grid"
      ? "点击选择含多枚甲片的照片"
      : mode === "complete_single_grid"
        ? "点击选择单枚甲片照片"
        : "点击选择美甲照片";
  const singleUploadHint =
    mode === "extract_ten_grid"
      ? "托盘、卡纸、实拍平铺等；只抠图中已出现的甲片，不补全款式"
      : mode === "complete_single_grid"
        ? "先整图转 180°；模型生成一枚高清单甲，再由服务端按尺码规则拼成 10 枚"
        : "支持常见图片格式";

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-wide text-rose-600 sm:text-2xl">
            美甲商家专用
          </h1>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        <input
          ref={secondInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onSecondFileChange}
        />
        <input
          ref={tenInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onTenBatchFilesChange}
        />
        <input
          ref={tenSlotInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onTenSlotFileChange}
        />

        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <label htmlFor="mode" className="text-sm font-semibold text-zinc-700">
            生成模式
          </label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => {
              const next = e.target.value as GenerationMode;
              setMode(next);
              if (next === "ten_singles_grid") {
                setFile(null);
                setPreviewUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
                setSecondFile(null);
                setSecondPreviewUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
              } else {
                setTenSlots((prev) => {
                  prev.forEach((c) => {
                    if (c.previewUrl) URL.revokeObjectURL(c.previewUrl);
                  });
                  return emptyTenSlots();
                });
                if (!getDualUploadKind(next)) {
                  setSecondFile(null);
                  setSecondPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                  });
                }
              }
            }}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-rose-500 focus:border-rose-500 focus:ring-2"
          >
            {GENERATION_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <section className="grid gap-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-500">投喂图片</h2>
            {tenMode ? (
              <div className="flex flex-col gap-3">
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
                              removeTenSlot(i);
                            }}
                            className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/80 text-sm font-bold text-white shadow-md transition hover:bg-red-600"
                          >
                            ×
                          </button>
                          <button
                            type="button"
                            onClick={() => beginPickTenSlot(i)}
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
                          onClick={() => beginPickTenSlot(i)}
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
                    onClick={onPickTenBatch}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-rose-400 hover:bg-rose-50"
                  >
                    一次选择 10 张（按顺序填入 1–10 格）
                  </button>
                  <button
                    type="button"
                    disabled={!tenSlots.some((s) => s.file)}
                    onClick={() => {
                      clearTenSlots();
                      setError(null);
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    清空十格
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  点击已有图片可替换该格；角标 × 仅删除本格。
                </p>
              </div>
            ) : dualKind ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-zinc-500">
                      {dualKind === "packaging_3d_ref"
                        ? "① 2D 包装平面稿"
                        : dualKind === "nails_box"
                          ? "① 美甲款式 / 甲片产品图"
                          : "① 美甲产品图"}
                    </span>
                    <UploadTile
                      title={
                        dualKind === "packaging_3d_ref"
                          ? "点击选择 2D 包装平面稿"
                          : dualKind === "nails_box"
                            ? "点击选择美甲款式图"
                            : "点击选择产品 / 甲片款式图"
                      }
                      hint={firstDualProductHint}
                      previewUrl={previewUrl}
                      onPick={onPickFile}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-zinc-500">
                      {dualKind === "accessory"
                        ? "② 饰品参考图（戒指等）"
                        : dualKind === "packaging_pose"
                          ? "② 握姿参考（真实手握盒）"
                          : dualKind === "packaging_3d_ref"
                            ? "② 3D/摄影参考图"
                            : dualKind === "nails_box"
                              ? "② 包装盒样式参考"
                              : "② 模特图"}
                    </span>
                    <UploadTile
                      title={secondSlotTitle}
                      hint={secondSlotHint}
                      previewUrl={secondPreviewUrl}
                      onPick={onPickSecond}
                    />
                  </div>
                </div>
                {dualKind === "nails_box" ? (
                  <fieldset className="rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-3">
                    <legend className="px-1 text-xs font-semibold text-zinc-600">
                      盒内甲片排列
                    </legend>
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-6">
                      <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
                        <input
                          type="radio"
                          name="nailArrangement"
                          className="mt-1"
                          checked={nailBoxArrangement === "vertical"}
                          onChange={() => setNailBoxArrangement("vertical")}
                        />
                        <span>
                          <span className="font-medium">竖向双列</span>
                          <span className="block text-xs font-normal text-zinc-500">
                            橱窗式：左右各一列、指尖朝外，适合长条开窗盒
                          </span>
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
                        <input
                          type="radio"
                          name="nailArrangement"
                          className="mt-1"
                          checked={nailBoxArrangement === "horizontal"}
                          onChange={() => setNailBoxArrangement("horizontal")}
                        />
                        <span>
                          <span className="font-medium">横向 2×5</span>
                          <span className="block text-xs font-normal text-zinc-500">
                            两行五列白底栅格，与常见背卡排版一致
                          </span>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={onPickFile}
                className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50/60"
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="已选择的预览"
                    className="max-h-48 w-full rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <span className="text-base font-medium text-zinc-800">{singleUploadTitle}</span>
                    <span className="text-zinc-500">{singleUploadHint}</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-500">{resultHeading}</h2>
            <div className="min-h-[200px] rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
              {resultUrls.length ? (
                <div className={gridClass}>
                  {resultUrls.map((url, i) => (
                    <figure
                      key={`${url.slice(0, 48)}-${i}`}
                      className="flex flex-col gap-2"
                    >
                      <figcaption className="text-center text-xs font-medium text-zinc-500">
                        {resultLabels[i] ?? `图 ${i + 1}`}
                      </figcaption>
                      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white p-2 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={resultLabels[i] ?? `结果 ${i + 1}`}
                          className="mx-auto max-h-[min(70vh,520px)] w-full object-contain"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={downloadBusyIndex === i}
                          onClick={() => {
                            void downloadResult(url, i);
                          }}
                          className="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-900 disabled:cursor-wait disabled:opacity-60"
                        >
                          {downloadBusyIndex === i ? "下载中…" : "下载"}
                        </button>
                        {!tenMode ? (
                          <button
                            type="button"
                            disabled={feedFromResultBusyIndex === i}
                            onClick={() => {
                              void convertResultToFeedImage(url, i);
                            }}
                            title="用该图替换左侧「投喂图片」中的主图，便于继续处理"
                            className="inline-flex h-9 min-w-[6.5rem] items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-900 shadow-sm transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
                          >
                            {feedFromResultBusyIndex === i
                              ? "处理中…"
                              : "转为投喂图片"}
                          </button>
                        ) : null}
                      </div>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[180px] items-center justify-center">
                  <p className="px-4 text-center text-sm text-zinc-400">
                    生成结果会显示在这里
                  </p>
                </div>
              )}
            </div>
          </div>
          {mode === "ten_singles_grid" ||
          mode === "complete_single_grid" ||
          mode === "extract_ten_grid" ? (
            <div className="min-w-0 lg:col-span-2">
              <fieldset className="w-full rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-3 lg:px-5">
                <legend className="px-1 text-xs font-semibold text-rose-800">
                  白底栅格排版（可选）
                </legend>
                <div className="flex w-full min-w-0 flex-col gap-3">
                  <div className="space-y-2.5">
                    <p className="text-xs leading-relaxed text-zinc-600">
                      五列相对宽度对应上排左→右拇→小（下排同列再重复一遍）。
                      {mode === "extract_ten_grid"
                        ? "本模式由模型按下列数值排版；数值含义与十枚单甲/单甲补齐的服务端拼图一致。"
                        : "提交时服务端会按最大列归一；缝过大时可能自动缩小甲片以适配画布。"}
                    </p>
                    <p className="text-xs leading-relaxed text-rose-900/90">
                      <span className="font-medium">关于「缝」：</span>
                      <strong>同一行相邻美甲</strong>的左右留白由下方「相邻间距」按<strong>单格宽度</strong>（内区五等分后的列槽宽）的 ½ / ⅓ / ⅕ 设定；选「贴紧」则四列缝为 0。
                      行与行之间的上下留白仍用「行间缝」百分比（占内高，<span className="font-mono">0</span>～<span className="font-mono">12</span>，失焦夹紧）。
                      外留白失焦后会在 <span className="font-mono">0.5</span>～<span className="font-mono">8</span> 之间。
                      <span className="mt-1.5 block text-zinc-700">
                        若横向已贴紧仍觉得整图偏「宽」，多半是<strong>四边外留白</strong>偏大，可把<strong>外留白（占边长 %）</strong>适当<strong>调小</strong>。
                      </span>
                    </p>
                  </div>
                  <div className="min-w-0 space-y-3 border-t border-rose-100/80 pt-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-x-3 sm:gap-y-2">
                      {(["拇", "食", "中", "无", "小"] as const).map((lab, i) => (
                        <label
                          key={lab}
                          className="flex flex-col gap-1 text-xs text-zinc-700"
                        >
                          <span className="font-medium text-zinc-800">{lab}指列宽</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            spellCheck={false}
                            value={colWidthDrafts[i] ?? ""}
                            onChange={(e) => {
                              const t = e.target.value;
                              setColWidthDrafts((prev) => {
                                const next = [...prev];
                                next[i] = t;
                                return next;
                              });
                            }}
                            onBlur={() => {
                              setColWidthDrafts((prev) => {
                                const next = [...prev];
                                next[i] = colWidthDraftAfterBlur(prev[i] ?? "", i);
                                return next;
                              });
                            }}
                            className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                      <label className="flex flex-col gap-1 text-xs text-zinc-700">
                        <span className="font-medium leading-snug text-zinc-800">
                          外留白（占边长 %）
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          spellCheck={false}
                          value={marginPctDraft}
                          onChange={(e) => setMarginPctDraft(e.target.value)}
                          onBlur={() =>
                            setMarginPctDraft((v) =>
                              pctDraftAfterBlur(v, 0.5, 8, 1.8),
                            )
                          }
                          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-zinc-700">
                        <span className="font-medium leading-snug text-zinc-800">
                          同一行相邻美甲间距
                        </span>
                        <span className="text-[11px] leading-snug text-zinc-500">
                          每条竖缝宽度 = k × 单格宽（五列等分内宽）
                        </span>
                        <select
                          value={colInterNailGap}
                          onChange={(e) =>
                            setColInterNailGap(
                              e.target.value as InterNailColGapMode,
                            )
                          }
                          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
                        >
                          {INTER_NAIL_COL_GAP_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-zinc-700">
                        <span className="font-medium leading-snug text-zinc-800">
                          行间缝（占内高 %）
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          spellCheck={false}
                          value={rowGutterPctDraft}
                          onChange={(e) => setRowGutterPctDraft(e.target.value)}
                          onBlur={() =>
                            setRowGutterPctDraft((v) =>
                              pctDraftAfterBlur(v, 0, 12, 0),
                            )
                          }
                          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums outline-none ring-rose-500 focus:border-rose-500 focus:ring-1"
                        />
                      </label>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-rose-100/80 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
                      <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto py-0.5 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setColWidthDrafts([...DEFAULT_COL_WIDTH_DRAFTS]);
                            setMarginPctDraft("1.8");
                            setColInterNailGap("tight");
                            setRowGutterPctDraft("0");
                            setGridPresetNotice(null);
                          }}
                          className="shrink-0 text-xs font-medium whitespace-nowrap text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-900"
                        >
                          恢复默认排版
                        </button>
                        {gridPresets.length > 0 ? (
                          <span className="hidden shrink-0 text-zinc-300 sm:inline" aria-hidden>
                            |
                          </span>
                        ) : null}
                        <div
                          ref={gridPresetChipsRowRef}
                          className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2"
                        >
                          {gridPresets.map((p, i) => (
                            <div
                              key={p.id}
                              className="relative inline-flex h-8 min-w-[2rem] shrink-0 items-stretch sm:h-9 sm:min-w-[2.25rem]"
                            >
                              <button
                                type="button"
                                onClick={() => applyGridPresetAt(i)}
                                title={`载入第 ${i + 1} 套；已选中时再点此可取消选中`}
                                className={`rounded-md border px-2 pr-5 text-[11px] font-semibold tabular-nums transition sm:rounded-lg sm:px-2.5 sm:pr-5 sm:text-xs ${
                                  gridPresetSelectedIndex === i
                                    ? "border-rose-500 bg-rose-100 text-rose-950 ring-1 ring-rose-400"
                                    : "border-zinc-300 bg-white text-zinc-800 hover:border-rose-300 hover:bg-rose-50/80"
                                }`}
                              >
                                {i + 1}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteGridPresetAt(i);
                                }}
                                className="absolute -right-1 -top-1 flex h-5 min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full border border-zinc-300 bg-white text-[11px] font-bold leading-none text-zinc-600 shadow-sm hover:border-rose-400 hover:bg-rose-50 hover:text-rose-800"
                                aria-label={`删除排版预设 ${i + 1}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          ref={gridLayoutSavePresetButtonRef}
                          type="button"
                          onClick={() => saveGridLayoutPreset()}
                          title="保存当前栅格参数到预设"
                          className="shrink-0 whitespace-nowrap rounded-md border border-rose-400 bg-rose-600 px-2 py-1 text-[11px] font-semibold leading-none text-white shadow-sm transition hover:bg-rose-700 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-xs"
                        >
                          保存配置
                        </button>
                      </div>
                      {gridPresetNotice ? (
                        <p className="min-w-0 flex-1 text-xs text-rose-800 sm:pt-0.5">
                          {gridPresetNotice}
                        </p>
                      ) : (
                        <p className="min-w-0 flex-1 text-xs text-zinc-500 sm:pt-0.5">
                          预设保存在本机浏览器；未选中数字时保存会新增一套（最多 5 套）。再次点击已高亮的数字，或点击数字区域以外（「保存配置」除外）可取消选中。
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>
          ) : null}
        </section>

        <div className="flex flex-col items-stretch gap-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="user-extra-notes"
                className="text-sm font-semibold text-zinc-800"
              >
                补充说明（可选）
              </label>
              <span className="text-xs text-zinc-500">
                会附在发给模型的提示末尾；不满意时可写修改意见
              </span>
            </div>
            <textarea
              id="user-extra-notes"
              value={userExtraNotes}
              onChange={(e) => setUserExtraNotes(e.target.value)}
              maxLength={2500}
              rows={3}
              placeholder="例如：指尖深色对齐真指尖、光再柔一点…"
              className="mt-2 w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-900 outline-none ring-rose-500 focus:border-rose-500 focus:ring-2"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearUserNotes}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-900"
              >
                清空
              </button>
              <button
                type="button"
                onClick={() => setPresetPanelOpen((o) => !o)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-rose-400 hover:bg-rose-50"
              >
                {presetPanelOpen ? "收起常用提示词" : "常用提示词"}
              </button>
              <span className="text-xs text-zinc-400">
                {userExtraNotes.length}/2500
              </span>
            </div>
            {presetPanelOpen ? (
              <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/90 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-600">
                  新添加的词条会出现在**第一行**。可**拖动左侧手柄**排序，或用「上移 / 下移」微调；顺序会保存。
                </p>
                <ul className="max-h-52 space-y-2 overflow-y-auto">
                  {promptPresets.map((item, i) => (
                    <li
                      key={item.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverPresetIndex(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const raw = e.dataTransfer.getData("text/x-preset-index");
                        const from = Number.parseInt(raw, 10);
                        if (Number.isNaN(from)) {
                          clearPresetDragUi();
                          return;
                        }
                        reorderPresetByDrag(from, i);
                        clearPresetDragUi();
                      }}
                      className={`flex flex-wrap items-start gap-2 rounded-md border bg-white px-2 py-2 text-sm text-zinc-800 ${
                        dragOverPresetIndex === i
                          ? "border-rose-400 ring-2 ring-rose-200"
                          : "border-zinc-200"
                      } ${draggingPresetIndex === i ? "opacity-60" : ""}`}
                    >
                      <span
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/x-preset-index", String(i));
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingPresetIndex(i);
                        }}
                        onDragEnd={clearPresetDragUi}
                        className="flex h-7 w-7 shrink-0 cursor-grab select-none items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500 active:cursor-grabbing"
                        title="拖动排序"
                        aria-label="拖动排序"
                      >
                        ⋮⋮
                      </span>
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-zinc-100 text-xs font-semibold text-zinc-500"
                        title="顺序"
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{item.text}</span>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => movePreset(i, -1)}
                          className="rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          disabled={i >= promptPresets.length - 1}
                          onClick={() => movePreset(i, 1)}
                          className="rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          下移
                        </button>
                        <button
                          type="button"
                          onClick={() => appendPresetToNotes(item.text)}
                          className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-900 hover:bg-rose-100"
                        >
                          使用
                        </button>
                        <button
                          type="button"
                          onClick={() => removePresetById(item.id)}
                          className="rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 hover:border-red-200 hover:bg-red-50 hover:text-red-800"
                        >
                          删除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-stretch gap-2">
                  <input
                    type="text"
                    value={newPresetDraft}
                    onChange={(e) => setNewPresetDraft(e.target.value)}
                    maxLength={MAX_PRESET_LINE_CHARS}
                    placeholder="新增强提示词…"
                    className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-rose-500 focus:border-rose-500 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={addPresetFromDraft}
                    disabled={
                      !newPresetDraft.trim() || promptPresets.length >= MAX_PRESETS
                    }
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 px-4 text-sm font-medium text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    添加
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={onExtract}
            className="inline-flex h-14 items-center justify-center rounded-xl bg-rose-600 text-base font-semibold text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {loading
              ? mode === "multi_angle"
                ? "正在依次生成 2 张真实感多角度上手图…"
                : mode === "packaging_mockup"
                  ? "正在生成包装手握图…"
                  : mode === "flat_to_3d_packaging"
                    ? "正在生成 3D 开窗盒装主视图…"
                    : mode === "nails_in_box"
                      ? "正在生成开窗盒装效果图…"
                      : mode === "model_tryon"
                      ? "正在生成试戴图…"
                      : mode === "accessory_tryon"
                        ? "正在生成手模试戴广告图…"
                        : mode === "ten_singles_grid"
                          ? "正在合成十甲白底合集…"
                          : mode === "complete_single_grid"
                            ? "正在生成单甲并拼成 10 枚…"
                            : mode === "extract_ten_grid"
                              ? "正在抠图排版…"
                              : "正在生成…"
              : "开始生成"}
          </button>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
