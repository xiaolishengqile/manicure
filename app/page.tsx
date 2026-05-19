"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GenerationModePicker } from "@/components/generation-mode-picker";
import { ImageModelSelect } from "@/components/image-model-select";
import { PanelColorPicker } from "@/components/panel-color-picker";
import {
  getDualUploadKind,
  modeIsPhotoExtractToGrid,
  modeIsVerticalToScatteredFlatLay,
  modeShowsWhiteGridLayoutPanel,
  parallelImageJobCountForMode,
  modeUsesDominantColorExtraction,
  modeUsesWhiteGridFormFields,
  requiresTenSingleNails,
  type GenerationMode,
  type NailsInBoxArrangement,
} from "@/lib/generation-modes";
import { extractDominantColorFromImageUrl } from "@/lib/panel-color-client";
import {
  DEFAULT_PANEL_COLOR_HEX,
  normalizePanelColorHex,
  type PanelColorSource,
} from "@/lib/panel-color";
import {
  extFromContentType,
  extFromDataUrl,
  resultImageUrlToBlob,
  triggerDownloadFromResultUrl,
} from "@/lib/result-image-url";
import {
  LS_GRID_LAYOUT_PRESETS,
  MAX_GRID_LAYOUT_PRESETS,
  newGridPresetId,
  parseGridLayoutPresets,
  type GridLayoutPreset,
} from "@/lib/grid-layout-presets";
import {
  COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX,
  COL_GUTTER_SUM_QUICK_PRESET_PCTS,
  DEFAULT_TEN_SINGLES_GRID_LAYOUT,
} from "@/lib/ten-singles-grid-layout";

function clampColGutterSumPct(n: number): number {
  return Math.min(COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX, Math.max(0, n));
}

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
import {
  DEFAULT_SOLO_IMAGE_PROMPT_PRESETS,
  DEFAULT_USER_PROMPT_PRESETS,
} from "@/lib/prompt-presets-defaults";
import { SiteAccessLogout } from "@/components/site-access-logout";

const LS_LAST_USER_NOTES = "manicure_last_user_extra_notes";
const LS_PROMPT_PRESETS = "manicure_user_prompt_presets";
const LS_SOLO_PROMPT_PRESETS = "manicure_solo_image_prompt_presets";
const MAX_PRESETS = 40;
const MAX_PRESET_LINE_CHARS = 200;

type PromptPresetItem = { id: string; text: string };

function newPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** 与 `/api/extract-nails` 并行流式分支一致：多路时先完成的先下发 */
type StreamResultSlot = {
  url: string;
  exportUrl: string;
  label: string;
} | null;

/** 仅多路并行时走 NDJSON 流；单路用 JSON，避免占位格一直转圈 */
function parallelStreamJobCount(m: GenerationMode): number {
  const n = parallelImageJobCountForMode(m);
  return n > 1 ? n : 0;
}

function defaultPresetItems(): PromptPresetItem[] {
  return DEFAULT_USER_PROMPT_PRESETS.map((text, i) => ({
    id: `builtin-${i}`,
    text,
  }));
}

function defaultSoloPresetItems(): PromptPresetItem[] {
  return DEFAULT_SOLO_IMAGE_PROMPT_PRESETS.map((text, i) => ({
    id: `solo-builtin-${i}`,
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

/** 从系统剪贴板取第一张图片文件（用于投喂区粘贴） */
function firstImageFileFromDataTransfer(dt: DataTransfer | null): File | null {
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
function FeedPasteZone({
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

function UploadTile({
  title,
  hint,
  previewUrl,
  onPick,
  onClear,
}: {
  title: string;
  hint: string;
  previewUrl: string | null;
  onPick: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="relative rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition hover:border-rose-300 hover:bg-rose-50/60">
      {previewUrl && onClear ? (
        <button
          type="button"
          aria-label="删除该投喂图"
          onClick={(ev) => {
            ev.stopPropagation();
            onClear();
          }}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/80 text-sm font-bold text-white shadow-md transition hover:bg-red-600"
        >
          ×
        </button>
      ) : null}
      <button
        type="button"
        onClick={onPick}
        className="flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] px-3 py-6 text-center text-sm text-zinc-600"
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
    </div>
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
  /** 空字符串：不传 imageModel，由服务器 OPENAI_IMAGE_MODEL 决定（未设置则为 gpt-image-2） */
  const [imageModelChoice, setImageModelChoice] = useState("");
  const [nailBoxArrangement, setNailBoxArrangement] =
    useState<NailsInBoxArrangement>("vertical");
  /** 文本草稿：可删光再输入，提交时再解析成数字 */
  const [colWidthDrafts, setColWidthDrafts] = useState<string[]>(() => [
    ...DEFAULT_COL_WIDTH_DRAFTS,
  ]);
  const [marginPctDraft, setMarginPctDraft] = useState("1.8");
  const [colGutterSumPct, setColGutterSumPct] = useState(0);
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
  /** 非空表示 NDJSON 渐进填格；完成后会清空并写入 resultUrls */
  const [streamSlots, setStreamSlots] = useState<StreamResultSlot[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadBusyIndex, setDownloadBusyIndex] = useState<number | null>(
    null,
  );
  const [copyBusyIndex, setCopyBusyIndex] = useState<number | null>(null);
  const [feedFromResultBusyIndex, setFeedFromResultBusyIndex] = useState<
    number | null
  >(null);
  /** 下标 0–9 即合成第 1–10 位顺序，与 FormData append 顺序一致 */
  const [tenSlots, setTenSlots] = useState<TenSlotCell[]>(() => emptyTenSlots());

  const [panelColorHex, setPanelColorHex] = useState(DEFAULT_PANEL_COLOR_HEX);
  const [panelColorSource, setPanelColorSource] =
    useState<PanelColorSource>("auto");
  const [panelAutoHex, setPanelAutoHex] = useState<string | null>(null);

  const [userExtraNotes, setUserExtraNotes] = useState("");
  /** 非空时：服务端在框内文前加两句白底底线后发图；不拼长系统提示与「补充说明」 */
  const [soloImageEditPrompt, setSoloImageEditPrompt] = useState("");
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
  const [soloPromptPresets, setSoloPromptPresets] =
    useState<PromptPresetItem[]>(defaultSoloPresetItems);
  const skipFirstSoloPresetPersist = useRef(true);
  const [soloPresetPanelOpen, setSoloPresetPanelOpen] = useState(false);
  const [newSoloPresetDraft, setNewSoloPresetDraft] = useState("");
  const [draggingSoloPresetIndex, setDraggingSoloPresetIndex] = useState<
    number | null
  >(null);
  const [dragOverSoloPresetIndex, setDragOverSoloPresetIndex] = useState<
    number | null
  >(null);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SOLO_PROMPT_PRESETS);
      if (!raw) return;
      const next = parseStoredPresets(raw);
      if (next?.length) setSoloPromptPresets(next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (skipFirstSoloPresetPersist.current) {
      skipFirstSoloPresetPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(
        LS_SOLO_PROMPT_PRESETS,
        JSON.stringify(soloPromptPresets),
      );
    } catch {
      /* ignore */
    }
  }, [soloPromptPresets]);

  const dualKind = getDualUploadKind(mode);
  const tenMode = requiresTenSingleNails(mode);
  const showPanelColorPicker = modeUsesDominantColorExtraction(mode);

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
      {
        const g = parseFloat(p.colGutterSumPctDraft);
        setColGutterSumPct(
          clampColGutterSumPct(Number.isFinite(g) ? g : 0),
        );
      }
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
      colGutterSumPctDraft: String(colGutterSumPct),
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
    colGutterSumPct,
    rowGutterPctDraft,
    gridPresetSelectedIndex,
    gridPresets.length,
  ]);

  const resultObjectUrlsRef = useRef<string[]>([]);
  /** 与 resultUrls 下标对齐：中转站原始 data/https，供下载/复制（展示可能是 blob:） */
  const resultExportUrlsRef = useRef<string[]>([]);

  const revokeResultObjectUrls = useCallback(() => {
    for (const u of resultObjectUrlsRef.current) {
      URL.revokeObjectURL(u);
    }
    resultObjectUrlsRef.current = [];
  }, []);

  /** 超大 data URL 转 blob URL，避免 <img> 长时间不绘制 */
  const prepareResultUrlForDisplay = useCallback((url: string): string => {
    if (!url.startsWith("data:") || url.length < 512_000) return url;
    try {
      const comma = url.indexOf(",");
      if (comma < 0) return url;
      const meta = url.slice(0, comma);
      const b64 = url.slice(comma + 1);
      const mime =
        /^data:([^;,]+)/i.exec(meta)?.[1]?.trim() || "image/png";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const obj = URL.createObjectURL(new Blob([bytes], { type: mime }));
      resultObjectUrlsRef.current.push(obj);
      return obj;
    } catch {
      return url;
    }
  }, []);

  const clearResults = useCallback(() => {
    revokeResultObjectUrls();
    resultExportUrlsRef.current = [];
    setResultUrls([]);
    setResultLabels([]);
    setStreamSlots(null);
  }, [revokeResultObjectUrls]);

  const fetchRemoteResultBlob = useCallback(async (httpUrl: string): Promise<Blob> => {
    const res = await fetch("/api/download-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: httpUrl }),
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
    return res.blob();
  }, []);

  const resolveExportUrl = useCallback((displayUrl: string, index: number) => {
    return resultExportUrlsRef.current[index] ?? displayUrl;
  }, []);

  const commitResultUrls = useCallback(
    (rawUrls: string[], labels: string[]) => {
      resultExportUrlsRef.current = rawUrls;
      setResultUrls(rawUrls.map(prepareResultUrlForDisplay));
      setResultLabels(labels);
    },
    [prepareResultUrlForDisplay],
  );

  const downloadResult = useCallback(
    async (
      displayUrl: string,
      index: number,
      exportUrlOverride?: string,
    ) => {
      const exportUrl = exportUrlOverride ?? resolveExportUrl(displayUrl, index);
      setDownloadBusyIndex(index);
      setError(null);
      try {
        let ext = "png";
        if (exportUrl.startsWith("data:image/")) {
          ext = extFromDataUrl(exportUrl);
        } else if (exportUrl.startsWith("blob:")) {
          const blob = await resultImageUrlToBlob(exportUrl);
          ext = extFromContentType(blob.type);
        }
        await triggerDownloadFromResultUrl(
          exportUrl,
          `美甲生成_${index + 1}.${ext}`,
          fetchRemoteResultBlob,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "下载失败，请稍后重试。");
      } finally {
        setDownloadBusyIndex(null);
      }
    },
    [fetchRemoteResultBlob, resolveExportUrl],
  );

  const copyResultToClipboard = useCallback(
    async (displayUrl: string, index: number, exportUrlOverride?: string) => {
      if (
        typeof ClipboardItem === "undefined" ||
        typeof navigator.clipboard?.write !== "function"
      ) {
        setError("当前浏览器不支持复制图片到剪贴板。");
        return;
      }
      setCopyBusyIndex(index);
      setError(null);
      try {
        const exportUrl = exportUrlOverride ?? resolveExportUrl(displayUrl, index);
        const blob = await resultImageUrlToBlob(exportUrl, fetchRemoteResultBlob);
        const raw = blob.type.split(";")[0].trim().toLowerCase();
        let mime = "image/png";
        if (raw.startsWith("image/")) {
          mime = raw === "image/jpg" ? "image/jpeg" : raw;
        }
        await navigator.clipboard.write([
          new ClipboardItem({
            [mime]: blob,
          }),
        ]);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "复制失败，可改用下载后在其他应用中打开。",
        );
      } finally {
        setCopyBusyIndex(null);
      }
    },
    [fetchRemoteResultBlob, resolveExportUrl],
  );

  const convertResultToFeedImage = useCallback(
    async (displayUrl: string, index: number, exportUrlOverride?: string) => {
      if (tenMode) return;
      setFeedFromResultBusyIndex(index);
      setError(null);
      try {
        const exportUrl = exportUrlOverride ?? resolveExportUrl(displayUrl, index);
        const blob = await resultImageUrlToBlob(exportUrl, fetchRemoteResultBlob);
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
    [tenMode, clearResults, fetchRemoteResultBlob, resolveExportUrl],
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

  const applyMainImageFile = useCallback(
    (f: File | null) => {
      setError(null);
      clearResults();
      if (!f) {
        setFile(null);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        return;
      }
      if (!f.type.startsWith("image/")) {
        setError(
          mode === "flat_to_3d_packaging" || mode === "flat_to_3d_sachet"
            ? mode === "flat_to_3d_sachet"
              ? "袋装正面平面稿请选择图片文件。"
              : "2D 包装平面稿请选择图片文件。"
            : mode === "nails_in_box"
              ? "美甲款式图请选择图片文件。"
              : mode === "extract_angle_scattered"
                ? "竖直白底商品图请选择图片文件。"
                : "美甲产品图请选择图片文件。",
        );
        setFile(null);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        return;
      }
      setFile(f);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(f);
      });
    },
    [clearResults, mode],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      applyMainImageFile(e.target.files?.[0] ?? null);
    },
    [applyMainImageFile],
  );

  const applySecondImageFile = useCallback(
    (f: File | null) => {
      setError(null);
      clearResults();
      if (!f) {
        setSecondFile(null);
        setSecondPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
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
                : dualKind === "sachet_back"
                  ? "袋装背面平面稿请选择图片文件。"
                  : dualKind === "nails_box"
                    ? "包装盒样式参考图请选择图片文件。"
                    : "模特图请选择图片文件。",
        );
        setSecondFile(null);
        setSecondPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
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

  const onSecondFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      applySecondImageFile(e.target.files?.[0] ?? null);
    },
    [applySecondImageFile],
  );

  const applyTenSlotFile = useCallback(
    (slotIndex: number, f: File) => {
      setError(null);
      clearResults();
      if (slotIndex < 0 || slotIndex > 9) return;
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

  const onTenSlotFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const slotIndex = tenSlotPickIndexRef.current;
      tenSlotPickIndexRef.current = null;
      const f = e.target.files?.[0];
      e.target.value = "";
      if (slotIndex === null || slotIndex < 0 || slotIndex > 9) return;
      if (!f) return;
      applyTenSlotFile(slotIndex, f);
    },
    [applyTenSlotFile],
  );

  const onPasteTenSlot = useCallback(
    (slotIndex: number) => (e: React.ClipboardEvent) => {
      const pasted = firstImageFileFromDataTransfer(e.clipboardData);
      if (!pasted) return;
      e.preventDefault();
      e.stopPropagation();
      applyTenSlotFile(slotIndex, pasted);
    },
    [applyTenSlotFile],
  );

  const applyTenPasteToFirstAvailable = useCallback(
    (f: File) => {
      setError(null);
      clearResults();
      if (!f.type.startsWith("image/")) {
        setError("请选择图片文件。");
        return;
      }
      setTenSlots((prev) => {
        const empty = prev.findIndex((s) => !s.file);
        const i = empty === -1 ? 0 : empty;
        const next = [...prev];
        const old = next[i];
        if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
        next[i] = {
          file: f,
          previewUrl: URL.createObjectURL(f),
        };
        return next;
      });
    },
    [clearResults],
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
                : dualKind === "sachet_back"
                  ? "请同时上传「袋装正面平面稿」与「袋装背面平面稿」。"
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
      if (imageModelChoice.trim()) {
        body.set("imageModel", imageModelChoice.trim());
      }
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
        body.set("nailGridColGutterPct", String(colGutterSumPct));
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
        if (dualKind === "sachet_back" && secondFile) {
          body.set("sachetBackImage", secondFile);
        }
        if (dualKind === "nails_box" && secondFile) {
          body.set("packagingBoxImage", secondFile);
          body.set("nailArrangement", nailBoxArrangement);
        }
        if (modeUsesWhiteGridFormFields(mode)) {
          body.set("nailGridColWidths", serializeColWidthDrafts(colWidthDrafts));
          body.set(
            "nailGridMarginPct",
            String(parsePctInput(marginPctDraft, 0.5, 8, 1.8)),
          );
          body.set("nailGridColGutterPct", String(colGutterSumPct));
          body.set(
            "nailGridRowGutterPct",
            String(parsePctInput(rowGutterPctDraft, 0, 12, 0)),
          );
        }
      }
      if (modeUsesDominantColorExtraction(mode)) {
        body.set("panelColorSource", panelColorSource);
        if (panelColorSource === "manual") {
          body.set(
            "panelColorHex",
            normalizePanelColorHex(panelColorHex) ?? DEFAULT_PANEL_COLOR_HEX,
          );
        }
      }
      body.set("userExtraNotes", userExtraNotes);
      body.set("soloImageEditPrompt", soloImageEditPrompt);
      const jobStreamN = parallelStreamJobCount(mode);
      if (jobStreamN > 0) {
        body.set("streamResults", "1");
        setStreamSlots(Array.from({ length: jobStreamN }, () => null));
      }
      const res = await fetch("/api/extract-nails", {
        method: "POST",
        body,
      });
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("ndjson")) {
        if (!res.body) {
          throw new Error("响应体为空。");
        }
        const reader = res.body.getReader();
        const textDec = new TextDecoder();
        let carry = "";
        let finalUrls: string[] = [];
        let finalLabels: string[] = [];
        const streamedByIndex = new Map<number, StreamResultSlot>();
        const flushLine = (line: string) => {
          const t = line.trim();
          if (!t) return;
          let msg: {
            type: string;
            jobCount?: number;
            index?: number;
            label?: string;
            imageUrl?: string;
            ok?: boolean;
            error?: string;
            imageUrls?: string[];
            labels?: string[];
          };
          try {
            msg = JSON.parse(t) as typeof msg;
          } catch {
            return;
          }
          if (msg.type === "meta" && typeof msg.jobCount === "number") {
            setStreamSlots(() =>
              Array.from({ length: msg.jobCount! }, () => null),
            );
          } else if (
            msg.type === "image" &&
            typeof msg.index === "number" &&
            msg.imageUrl
          ) {
            const idx = msg.index;
            const slot: StreamResultSlot = {
              url: prepareResultUrlForDisplay(msg.imageUrl),
              exportUrl: msg.imageUrl,
              label: msg.label ?? `图 ${idx + 1}`,
            };
            streamedByIndex.set(idx, slot);
            setStreamSlots((prev) => {
              const n = Math.max(prev?.length ?? 0, idx + 1);
              const next: StreamResultSlot[] = Array.from(
                { length: n },
                (_, i) => (prev && i < prev.length ? prev[i]! : null),
              );
              next[idx] = slot;
              return next;
            });
          } else if (msg.type === "done") {
            if (!msg.ok) {
              throw new Error(msg.error || "处理失败");
            }
            finalUrls = msg.imageUrls ?? [];
            finalLabels = msg.labels ?? [];
          }
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          carry += textDec.decode(value, { stream: true });
          const parts = carry.split("\n");
          carry = parts.pop() ?? "";
          for (const line of parts) flushLine(line);
        }
        if (carry.trim()) flushLine(carry);
        if (finalUrls.length === 0 && streamedByIndex.size > 0) {
          finalUrls = [...streamedByIndex.entries()]
            .sort(([a], [b]) => a - b)
            .map(([, slot]) => slot!.exportUrl);
          if (finalLabels.length === 0) {
            finalLabels = [...streamedByIndex.entries()]
              .sort(([a], [b]) => a - b)
              .map(([, slot]) => slot!.label);
          }
        }
        if (finalUrls.length === 0) {
          throw new Error("未收到结果图片（流可能中断）。");
        }
        setStreamSlots(null);
        commitResultUrls(
          finalUrls,
          finalLabels.length
            ? finalLabels
            : finalUrls.map((_, i) => `图 ${i + 1}`),
        );
      } else {
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
        setStreamSlots(null);
        commitResultUrls(urls, data.labels ?? urls.map((_, i) => `图 ${i + 1}`));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理失败");
      setStreamSlots(null);
    } finally {
      setStreamSlots(null);
      setLoading(false);
    }
  }, [
    clearResults,
    commitResultUrls,
    dualKind,
    file,
    secondFile,
    mode,
    imageModelChoice,
    tenMode,
    tenSlots,
    panelColorHex,
    panelColorSource,
    userExtraNotes,
    soloImageEditPrompt,
    nailBoxArrangement,
    colWidthDrafts,
    marginPctDraft,
    colGutterSumPct,
    rowGutterPctDraft,
    prepareResultUrlForDisplay,
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

  const appendSoloPresetToField = useCallback((line: string) => {
    const t = line.trim().slice(0, MAX_PRESET_LINE_CHARS);
    if (!t) return;
    setSoloImageEditPrompt((prev) => {
      const next = prev.trim() ? `${prev.trim()}\n${t}` : t;
      return next.slice(0, 4000);
    });
  }, []);

  const addSoloPresetFromDraft = useCallback(() => {
    const t = newSoloPresetDraft.trim().slice(0, MAX_PRESET_LINE_CHARS);
    if (!t) return;
    setSoloPromptPresets((prev) => {
      if (prev.some((p) => p.text === t)) return prev;
      if (prev.length >= MAX_PRESETS) return prev;
      return [{ id: newPresetId(), text: t }, ...prev];
    });
    setNewSoloPresetDraft("");
  }, [newSoloPresetDraft]);

  const removeSoloPresetById = useCallback((id: string) => {
    setSoloPromptPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const moveSoloPreset = useCallback((index: number, delta: -1 | 1) => {
    setSoloPromptPresets((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[index]!;
      next[index] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }, []);

  const reorderSoloPresetByDrag = useCallback((from: number, to: number) => {
    if (from === to) return;
    setSoloPromptPresets((prev) => {
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

  const clearSoloPresetDragUi = useCallback(() => {
    setDraggingSoloPresetIndex(null);
    setDragOverSoloPresetIndex(null);
  }, []);

  const displayResultSlots = useMemo((): StreamResultSlot[] | null => {
    if (streamSlots) return streamSlots;
    if (resultUrls.length === 0) return null;
    return resultUrls.map((url, i) => ({
      url,
      exportUrl: resultExportUrlsRef.current[i] ?? url,
      label: resultLabels[i] ?? `图 ${i + 1}`,
    }));
  }, [streamSlots, resultUrls, resultLabels]);

  const filledResultSlotCount =
    displayResultSlots?.filter((s) => s !== null).length ?? 0;

  const resultHeading =
    mode === "multi_angle"
      ? "产出（正视上手 · 1张 · 真实棚拍感）"
      : mode === "packaging_mockup"
        ? "产出（包装 + 手握 · 1张）"
        : mode === "flat_to_3d_packaging"
          ? "产出（2D→3D 开窗盒装 · 1张）"
          : mode === "flat_to_3d_sachet"
            ? "产出（2D 正背面 → 单片袋装实拍 · 1张）"
            : mode === "nails_in_box"
            ? "产出（开窗盒装 · 甲片入盒 · 1张）"
            : mode === "model_tryon"
            ? "产出（试戴效果图）"
            : mode === "accessory_tryon"
              ? "产出（手模 · 指甲+饰品试戴）"
              : mode === "ten_singles_grid"
                ? "产出（十枚单甲 · 一张合集）"
                : mode === "extract_ten_grid"
                  ? "产出（白底栅格 · 仅抠图 · 1张）"
                  : mode === "extract_angle_scattered"
                    ? "产出（散落实拍 · A 内置排版参考 + B 随机排布 · 2张）"
                    : mode === "white_grid_rectify"
                    ? "产出（白底栅格 · 几何矫正 · 1张）"
                    : mode === "complete_single_grid"
                      ? "产出（白底栅格 · 单甲补齐10支）"
                      : "产出";

  const gridClass =
    parallelImageJobCountForMode(mode) > 1
      ? "grid grid-cols-1 gap-6 md:grid-cols-2"
      : mode === "packaging_mockup"
        ? "grid grid-cols-1"
        : mode === "flat_to_3d_packaging" || mode === "flat_to_3d_sachet"
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
          : dualKind === "sachet_back"
            ? "点击选择袋装背面平面稿"
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
          : dualKind === "sachet_back"
            ? "背面说明、成分表、撕口虚线等；袋身主色以右侧色板为准（手动指定时会替换正背面大面积底色）"
            : dualKind === "nails_box"
            ? "盒型、开窗比例、背板质感与**盒面 Logo/文字**尽量与参考一致（勿改比例、勿杜撰印刷）；窗内**两排甲片之间不要留空带**；甲片款式与甲型以左侧图为准"
            : "需清晰露出指甲区域";

  const firstDualProductHint =
    dualKind === "packaging_pose"
      ? "款式来源：托盘、背卡、白底栅格等均可；不用于锁手型"
      : dualKind === "packaging_3d_ref"
        ? "正面/背面展开、屏显效果图、刀版图截图均可；为盒面图文唯一来源；服务端会**自动提取主色**写入提示词"
        : dualKind === "sachet_back"
          ? "方形正面稿：Logo、品名、版式不变；右侧可**手动选袋身色**或跟随正面稿自动提色"
          : dualKind === "model" || dualKind === "accessory"
          ? "美甲产品图约定：甲尖朝下；每行从左到右大拇指→小指；试戴成图按格严格还原款式"
          : dualKind === "nails_box"
            ? "款式图：托盘/背卡/白底栅格均可；横向时**上下两排甲片紧挨无横缝**；左右与图案甲型逐枚保真"
            : "平铺、卡纸、白底商品图均可";

  const singleUploadTitle =
    mode === "extract_angle_scattered"
      ? "点击选择竖直 2×5 白底商品图（或规整竖直甲片）"
      : mode === "extract_ten_grid"
        ? "点击选择含多枚甲片的照片"
        : mode === "white_grid_rectify"
        ? "点击选择已生成的 2×5 白底栅格图"
        : mode === "complete_single_grid"
          ? "点击选择单枚甲片照片"
          : "点击选择美甲照片";
  const singleUploadHint =
    mode === "extract_angle_scattered"
      ? "输入须为**竖直甲片**（常见 2×5）；**A/B 均须恰好 10 枚**、**纯白底**、互不压住；**A** 双图（你的产品图 + 内置斜拍参考排版），只学参考的位置与同列共线，**花色仍来自你的产品图**；**B** 随机打散；并行 **2 张**择优"
      : mode === "extract_ten_grid"
        ? "托盘、卡纸、实拍平铺等；只抠图中已出现的甲片，不补全款式；每次生成 **1 张**"
        : mode === "white_grid_rectify"
          ? "请上传 2×5 白底成品图。**不改甲型与长短**，仅刚性旋转摆正歪斜，用外留白/列缝/行间缝控距；每次生成 **1 张**"
          : mode === "complete_single_grid"
            ? "请上传甲尖朝下、甲根朝上的单枚（或含一枚主款）；仅做 EXIF 转正后由模型抠出一枚高清单甲，再由服务端按五列相对宽度复制成 10 格"
            : "支持常见图片格式";

  useEffect(() => {
    if (!showPanelColorPicker || !previewUrl || panelColorSource !== "auto") {
      return;
    }
    let cancelled = false;
    void extractDominantColorFromImageUrl(previewUrl).then((hex) => {
      if (cancelled) return;
      setPanelAutoHex(hex);
      if (hex) setPanelColorHex(hex);
    });
    return () => {
      cancelled = true;
    };
  }, [previewUrl, panelColorSource, showPanelColorPicker]);

  const onModeChange = useCallback((next: GenerationMode) => {
    setMode(next);
    if (modeUsesDominantColorExtraction(next)) {
      setPanelColorSource("auto");
      setPanelAutoHex(null);
    }
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
  }, []);

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14">
        <header className="flex flex-wrap items-start justify-between gap-3 space-y-2">
          <div className="flex min-w-0 flex-wrap items-end gap-3">
            <h1 className="text-xl font-semibold tracking-wide text-rose-600 sm:text-2xl">
              美甲商家专用
            </h1>
            <ImageModelSelect
              value={imageModelChoice}
              onChange={(v) => {
                setImageModelChoice(v);
                clearResults();
              }}
            />
          </div>
          <SiteAccessLogout />
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

        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-zinc-700">生成模式</p>
          <GenerationModePicker value={mode} onChange={onModeChange} />
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={onExtract}
          className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-rose-600 text-base font-semibold text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          {loading
            ? mode === "multi_angle"
              ? "正在生成正视上手主图…"
              : mode === "packaging_mockup"
                ? "正在生成包装手握图…"
                : mode === "flat_to_3d_packaging"
                  ? "正在生成 3D 开窗盒装主视图…"
                  : mode === "flat_to_3d_sachet"
                    ? "正在生成单片袋装实拍图…"
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
                              : mode === "extract_angle_scattered"
                                ? "正在生成散落实拍（2张）…"
                                : mode === "white_grid_rectify"
                                ? "正在几何矫正…"
                                : "正在生成…"
            : "开始生成"}
        </button>
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          {showPanelColorPicker ? (
            <PanelColorPicker
              value={panelColorHex}
              source={panelColorSource}
              autoHex={panelAutoHex}
              disabled={loading}
              onChange={setPanelColorHex}
              onSourceChange={(src) => {
                setPanelColorSource(src);
                if (src === "auto" && panelAutoHex) {
                  setPanelColorHex(panelAutoHex);
                }
              }}
            />
          ) : null}
          <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-500">投喂图片</h2>
            {tenMode ? (
              <div className="flex flex-col gap-3">
                <FeedPasteZone
                  ariaLabel="剪贴板粘贴到十格首个空位"
                  onPasteImage={applyTenPasteToFirstAvailable}
                >
                  在对应区域点击一下使焦点落在该处后，可用 Ctrl+V（Windows）或 ⌘+V（Mac）将剪贴板中的图片粘贴为投喂图（填入<strong>首个空位</strong>；十格已满则替换第 1 格）。各格内可点击从文件夹选图或粘贴。
                </FeedPasteZone>
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
                            onPaste={onPasteTenSlot(i)}
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
                          onPaste={onPasteTenSlot(i)}
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
                  点击已有图片可替换该格；角标 × 仅删除本格。各格内点击后亦可 Ctrl+V / ⌘+V 粘贴；或使用上方粘贴区填入首个空位。
                </p>
              </div>
            ) : dualKind ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <FeedPasteZone
                    ariaLabel="粘贴第一张投喂图"
                    className="min-h-[4.5rem]"
                    onPasteImage={(f) => {
                      applyMainImageFile(f);
                    }}
                  >
                    <span className="font-medium text-zinc-700">① </span>
                    在对应区域点击一下使焦点落在该处后，可用 Ctrl+V（Windows）或 ⌘+V（Mac）将剪贴板中的图片粘贴为投喂图（第一张）。
                  </FeedPasteZone>
                  <FeedPasteZone
                    ariaLabel="粘贴第二张投喂图"
                    className="min-h-[4.5rem]"
                    onPasteImage={(f) => {
                      applySecondImageFile(f);
                    }}
                  >
                    <span className="font-medium text-zinc-700">② </span>
                    在对应区域点击一下使焦点落在该处后，可用 Ctrl+V（Windows）或 ⌘+V（Mac）将剪贴板中的图片粘贴为投喂图（第二张）。
                  </FeedPasteZone>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-zinc-500">
                      {dualKind === "packaging_3d_ref"
                        ? "① 2D 包装平面稿"
                        : dualKind === "sachet_back"
                          ? "① 袋装正面平面稿"
                          : dualKind === "nails_box"
                            ? "① 美甲款式 / 甲片产品图"
                            : "① 美甲产品图"}
                    </span>
                    <UploadTile
                      title={
                        dualKind === "packaging_3d_ref"
                          ? "点击选择 2D 包装平面稿"
                          : dualKind === "sachet_back"
                            ? "点击选择袋装正面平面稿"
                            : dualKind === "nails_box"
                              ? "点击选择美甲款式图"
                              : "点击选择产品 / 甲片款式图"
                      }
                      hint={firstDualProductHint}
                      previewUrl={previewUrl}
                      onPick={onPickFile}
                      onClear={() => {
                        applyMainImageFile(null);
                        setPanelAutoHex(null);
                      }}
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
                            : dualKind === "sachet_back"
                              ? "② 袋装背面平面稿"
                              : dualKind === "nails_box"
                                ? "② 包装盒样式参考"
                                : "② 模特图"}
                    </span>
                    <UploadTile
                      title={secondSlotTitle}
                      hint={secondSlotHint}
                      previewUrl={secondPreviewUrl}
                      onPick={onPickSecond}
                      onClear={() => {
                        applySecondImageFile(null);
                      }}
                    />
                  </div>
                </div>
                </div>
                <p className="text-xs text-zinc-500">
                  下方虚线区域点击后仅从文件夹选图；剪贴板粘贴请使用上方两个「粘贴区」。
                </p>
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
              <>
                <FeedPasteZone
                  ariaLabel="剪贴板粘贴投喂图"
                  onPasteImage={(f) => {
                    applyMainImageFile(f);
                  }}
                >
                  在对应区域点击一下使焦点落在该处后，可用 Ctrl+V（Windows）或 ⌘+V（Mac）将剪贴板中的图片粘贴为投喂图。
                </FeedPasteZone>
                <div className="relative rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition hover:border-rose-300 hover:bg-rose-50/60">
                  {previewUrl ? (
                    <button
                      type="button"
                      aria-label="删除投喂图"
                      onClick={() => {
                        applyMainImageFile(null);
                      }}
                      className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/80 text-base font-bold text-white shadow-md transition hover:bg-red-600"
                    >
                      ×
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onPickFile}
                    className="flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] px-4 py-8 text-center text-sm text-zinc-600"
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
                        <span className="text-base font-medium text-zinc-800">
                          {singleUploadTitle}
                        </span>
                        <span className="text-zinc-500">{singleUploadHint}</span>
                        <span className="text-xs text-zinc-400">
                          点此区域仅从文件夹选择文件
                        </span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  下方虚线区域点击后仅从文件夹选图；剪贴板粘贴请使用上方「粘贴区」。
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-500">{resultHeading}</h2>
            {parallelImageJobCountForMode(mode) > 1 ? (
              <p className="text-xs leading-relaxed text-zinc-500">
                多路会同时打模型；若网关排队或限流，总耗时不一定比单路短（有时接近「两路各自变慢」）。先完成的图会先显示，不必等全部结束。
              </p>
            ) : null}
            {parallelImageJobCountForMode(mode) > 1 && filledResultSlotCount > 0 ? (
              <p className="text-xs leading-relaxed text-zinc-600">
                已并行生成 {filledResultSlotCount} 张，请对比
                {modeIsVerticalToScatteredFlatLay(mode)
                  ? "是否恰好 10 枚、底边是否纯白；A 是否贴近内置参考排版（同列共线、约 45°）且花色来自你的产品图；B 是否 10 枚全部打散、非整齐 2×5"
                  : modeIsPhotoExtractToGrid(mode)
                    ? "抠图保真度与排版"
                    : "甲型保真度与竖直/间距"}
                ，选用更合适的一张；可点「转为投喂图片」继续处理。
              </p>
            ) : null}
            <div className="min-h-[200px] rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
              {displayResultSlots?.length ? (
                <div className={gridClass}>
                  {displayResultSlots.map((slot, i) => (
                    <figure
                      key={`result-slot-${i}`}
                      className="flex flex-col gap-2"
                    >
                      <figcaption className="text-center text-xs font-medium text-zinc-500">
                        {slot?.label ?? `图 ${i + 1}`}
                      </figcaption>
                      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white p-2 shadow-sm">
                        {slot ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={slot.url}
                            alt={slot.label}
                            className="mx-auto max-h-[min(70vh,520px)] w-full object-contain"
                          />
                        ) : (
                          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-zinc-400">
                            <span
                              className="inline-block size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-rose-400"
                              aria-hidden
                            />
                            <span>生成中…</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={
                            !slot ||
                            downloadBusyIndex === i ||
                            copyBusyIndex === i
                          }
                          onClick={() => {
                            if (!slot) return;
                            void downloadResult(slot.url, i, slot.exportUrl);
                          }}
                          className="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {downloadBusyIndex === i ? "下载中…" : "下载"}
                        </button>
                        <button
                          type="button"
                          disabled={
                            !slot ||
                            copyBusyIndex === i ||
                            downloadBusyIndex === i
                          }
                          onClick={() => {
                            if (!slot) return;
                            void copyResultToClipboard(slot.url, i, slot.exportUrl);
                          }}
                          title="复制图片到剪贴板，便于粘贴到其他应用"
                          className="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {copyBusyIndex === i ? "复制中…" : "复制"}
                        </button>
                        {!tenMode ? (
                          <button
                            type="button"
                            disabled={
                              !slot ||
                              feedFromResultBusyIndex === i ||
                              downloadBusyIndex === i ||
                              copyBusyIndex === i
                            }
                            onClick={() => {
                              if (!slot) return;
                              void convertResultToFeedImage(slot.url, i, slot.exportUrl);
                            }}
                            title="用该图替换左侧「投喂图片」中的主图，便于继续处理"
                            className="inline-flex h-9 min-w-[6.5rem] items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-900 shadow-sm transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="min-w-0 flex flex-col gap-4 lg:col-span-2">
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="solo-image-edit-prompt"
                  className="text-sm font-semibold text-amber-950"
                >
                  仅自定义图像提示（可选）
                </label>
                <span className="max-w-md text-xs text-amber-900/80">
                  填写后：在框内文字前<strong>自动加两句</strong>（纯白 #FFFFFF 白底 + 电商 packshot 气质）；再发当前模式下的上传图，不拼长系统提示与下方「补充说明」。
                  若模式会一次出多张（如多角度），每张都会用同一段合成提示分别请求。
                </span>
              </div>
              <textarea
                id="solo-image-edit-prompt"
                value={soloImageEditPrompt}
                onChange={(e) => setSoloImageEditPrompt(e.target.value)}
                maxLength={4000}
                rows={3}
                placeholder="例如：把背景统一成纯白 #FFFFFF；轻微校正色温；去掉边缘杂色…"
                className="mt-2 w-full resize-y rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-amber-500/40 focus:border-amber-500 focus:ring-2"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoloImageEditPrompt("")}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950 shadow-sm transition hover:border-amber-500 hover:bg-amber-50"
                >
                  清空本框
                </button>
                <button
                  type="button"
                  onClick={() => setSoloPresetPanelOpen((o) => !o)}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950 shadow-sm transition hover:border-amber-500 hover:bg-amber-50"
                >
                  {soloPresetPanelOpen ? "收起常用提示词" : "常用提示词"}
                </button>
                <span className="text-xs text-amber-900/60">
                  {soloImageEditPrompt.length}/4000
                </span>
              </div>
              {soloPresetPanelOpen ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/90 p-3">
                  <p className="mb-2 text-xs font-medium text-amber-900/90">
                    新添加的词条会出现在**第一行**。可**拖动左侧手柄**排序，或用「上移 / 下移」微调；顺序会保存（与本框下方的「补充说明」常用词分存）。
                  </p>
                  <ul className="max-h-52 space-y-2 overflow-y-auto">
                    {soloPromptPresets.map((item, i) => (
                      <li
                        key={item.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverSoloPresetIndex(i);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const raw = e.dataTransfer.getData(
                            "text/x-solo-preset-index",
                          );
                          const from = Number.parseInt(raw, 10);
                          if (Number.isNaN(from)) {
                            clearSoloPresetDragUi();
                            return;
                          }
                          reorderSoloPresetByDrag(from, i);
                          clearSoloPresetDragUi();
                        }}
                        className={`flex flex-wrap items-start gap-2 rounded-md border bg-white px-2 py-2 text-sm text-zinc-800 ${
                          dragOverSoloPresetIndex === i
                            ? "border-amber-500 ring-2 ring-amber-200"
                            : "border-amber-200/80"
                        } ${draggingSoloPresetIndex === i ? "opacity-60" : ""}`}
                      >
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              "text/x-solo-preset-index",
                              String(i),
                            );
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingSoloPresetIndex(i);
                          }}
                          onDragEnd={clearSoloPresetDragUi}
                          className="flex h-7 w-7 shrink-0 cursor-grab select-none items-center justify-center rounded border border-dashed border-amber-300 bg-amber-50/80 text-xs text-amber-800/70 active:cursor-grabbing"
                          title="拖动排序"
                          aria-label="拖动排序"
                        >
                          ⋮⋮
                        </span>
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-amber-100 text-xs font-semibold text-amber-900/70"
                          title="顺序"
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 break-words">
                          {item.text}
                        </span>
                        <div className="flex shrink-0 flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={() => moveSoloPreset(i, -1)}
                            className="rounded border border-amber-200 px-2 py-0.5 text-xs text-amber-950 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            上移
                          </button>
                          <button
                            type="button"
                            disabled={i >= soloPromptPresets.length - 1}
                            onClick={() => moveSoloPreset(i, 1)}
                            className="rounded border border-amber-200 px-2 py-0.5 text-xs text-amber-950 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            下移
                          </button>
                          <button
                            type="button"
                            onClick={() => appendSoloPresetToField(item.text)}
                            className="rounded border border-amber-400 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950 hover:bg-amber-200"
                          >
                            使用
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSoloPresetById(item.id)}
                            className="rounded border border-amber-200 px-2 py-0.5 text-xs text-amber-900/80 hover:border-red-200 hover:bg-red-50 hover:text-red-800"
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
                      value={newSoloPresetDraft}
                      onChange={(e) => setNewSoloPresetDraft(e.target.value)}
                      maxLength={MAX_PRESET_LINE_CHARS}
                      placeholder="新增强提示词…"
                      className="min-w-[12rem] flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none ring-amber-500 focus:border-amber-500 focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={addSoloPresetFromDraft}
                      disabled={
                        !newSoloPresetDraft.trim() ||
                        soloPromptPresets.length >= MAX_PRESETS
                      }
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-amber-900 px-4 text-sm font-medium text-amber-50 transition hover:bg-amber-950 disabled:cursor-not-allowed disabled:bg-amber-300"
                    >
                      添加
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
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
          </div>
          </div>
        </section>

        {modeShowsWhiteGridLayoutPanel(mode) ? (
          <div className="mt-4 min-w-0 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <fieldset className="w-full rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-3 lg:px-5">
              <legend className="px-1 text-xs font-semibold text-rose-800">
                白底栅格排版（可选）
              </legend>
              <div className="flex w-full min-w-0 flex-col gap-3">
                <div className="space-y-2.5">
                  <p className="text-xs leading-relaxed text-zinc-600">
                    五列相对宽度对应上排左→右拇→小（下排同列再重复一遍）。
                    {mode === "extract_ten_grid"
                      ? "本模式由模型按下列数值排版；每次 **1 张**；数值含义与十枚单甲/单甲补齐的服务端拼图一致。"
                      : mode === "white_grid_rectify"
                        ? "几何矫正：**十格拆层整版重排**（非整图扶正），逐格锁定甲型与长短，每枚 **刚性旋转至竖直** + 平移；每次 **1 张**。附录：外留白/列缝/行间缝；「五列宽」无效。"
                      : mode === "complete_single_grid"
                        ? "单甲补齐：下列数值仅用于服务端把「一枚抠图甲片」按列宽复制成 10 格（体现拇→小尺码差），**不会**再次发给模型改甲型。"
                        : "提交时服务端会按最大列归一；缝过大时可能自动缩小甲片以适配画布。"}
                  </p>
                  <p className="text-xs leading-relaxed text-rose-900/90">
                    <span className="font-medium">关于「缝」：</span>
                    <strong>同一行相邻美甲</strong>的左右留白用下方滑条控制：<strong>四条竖缝合计占「内区宽度」的百分之几</strong>（内区 = 去掉外留白后的中间区域）；下方会显示<strong>每条竖缝约占内宽的几%</strong>（合计÷4）。
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
                    <label className="flex min-w-0 flex-col gap-2 text-xs text-zinc-700">
                      <span className="font-medium leading-snug text-zinc-800">
                        同一行相邻美甲间距
                      </span>
                      <span className="text-[11px] leading-snug text-zinc-500">
                        拖动滑条：四条竖缝合计占「内区宽度」0～
                        {COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX}%（步进 0.5）
                      </span>
                      <div className="flex min-w-0 items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX}
                          step={0.5}
                          value={colGutterSumPct}
                          onChange={(e) =>
                            setColGutterSumPct(
                              clampColGutterSumPct(
                                parseFloat(e.target.value),
                              ),
                            )
                          }
                          className="h-2 min-w-0 flex-1 cursor-pointer accent-rose-600"
                          aria-valuemin={0}
                          aria-valuemax={COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX}
                          aria-valuenow={colGutterSumPct}
                          aria-label="同一行四条竖缝合计占内区宽度百分比"
                        />
                        <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900">
                          {colGutterSumPct.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug text-zinc-600">
                        合计约 {colGutterSumPct.toFixed(1)}% 内宽 · 每条约{" "}
                        {(colGutterSumPct / 4).toFixed(1)}% 内宽
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setColGutterSumPct(0)}
                          className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:border-rose-300 hover:bg-rose-50"
                        >
                          无
                        </button>
                        {COL_GUTTER_SUM_QUICK_PRESET_PCTS.map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setColGutterSumPct(pct)}
                            className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:border-rose-300 hover:bg-rose-50"
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
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
                          setColGutterSumPct(0);
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
      </main>
    </div>
  );
}
