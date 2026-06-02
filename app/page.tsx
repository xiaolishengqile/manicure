"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppPageHeader } from "@/components/app-page-header";
import { GenerationModePicker } from "@/components/generation-mode-picker";
import { NailShapeProfilePicker } from "@/components/nail-shape-profile-picker";
import { PanelColorPicker } from "@/components/panel-color-picker";
import { FeedPasteZone, firstImageFileFromDataTransfer } from "@/components/feed-paste-zone";
import { UploadTile } from "@/components/upload-tile";
import { TenSlotUpload } from "@/components/ten-slot-upload";
import { ResultDisplay } from "@/components/result-display";
import { PromptPresetsPanel } from "@/components/prompt-presets-panel";
import { GridLayoutPanel } from "@/components/grid-layout-panel";
import {
  DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG,
  type DiagonalUploadRows,
} from "@/lib/diagonal-packshot-config";
import {
  DEFAULT_WHITE_MARGIN_EXPAND_PCT,
  MAX_WHITE_MARGIN_EXPAND_PCT,
  MIN_WHITE_MARGIN_EXPAND_PCT,
  parseWhiteMarginExpandPct,
} from "@/lib/white-margin-expand-config";
import {
  getDualUploadKind,
  modeIsDiagonalRowFlatlay,
  modeIsPhotoExtractToGrid,
  modeIsScatteredGridFlatlay,
  modeIsExpandWhiteMargin,
  modeShowsWhiteGridLayoutPanel,
  modeSupportsSameHandsRowOption,
  sameHandsRowUsesGridFormFields,
  sameHandsRowOptionHint,
  effectiveUsesSingleRowUpload,
  parallelImageJobCountForMode,
  parallelVariantChoiceFromSlotIndex,
  promptsForMode,
  modeUsesDominantColorExtraction,
  modeUsesWhiteGridFormFields,
  requiresTenSingleNails,
  type GenerationMode,
  type NailsInBoxArrangement,
  type ParallelVariantChoice,
} from "@/lib/generation-modes";
import {
  DEFAULT_NAIL_SHAPE_PROFILE,
  parseNailShapeProfile,
  type NailShapeProfileId,
} from "@/lib/nail-shape-profiles";
import { extractDominantColorFromImageUrl } from "@/lib/panel-color-client";
import {
  DEFAULT_PANEL_COLOR_HEX,
  normalizePanelColorHex,
  type PanelColorSource,
} from "@/lib/panel-color";
import {
  buildResultDownloadFilename,
  formatDownloadBatchStamp,
} from "@/lib/download-filename";
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
  DEFAULT_COL_GUTTER_PCT_DRAFT,
  DEFAULT_NAIL_HEIGHT_PCT_DRAFTS,
  DEFAULT_NAIL_WIDTH_PCT_DRAFTS,
  DEFAULT_TEN_SINGLES_GRID_LAYOUT,
  nailScaleFromPctDraft,
  nailScalePctDraftAfterBlur,
  NAIL_SCALE_PCT_MAX,
  NAIL_SCALE_PCT_MIN,
  serializeNailColScalePctDrafts,
} from "@/lib/ten-singles-grid-layout";
import { usePromptPresets } from "@/lib/use-prompt-presets";

function clampColGutterSumPct(n: number): number {
  return Math.min(COL_GUTTER_SUM_INNER_WIDTH_PCT_MAX, Math.max(0, n));
}

function colGutterPctForSubmit(mode: GenerationMode, colGutterPctDraft: string, colGutterSumPct: number): number {
  if (mode === "complete_single_grid") {
    return parsePctInput(colGutterPctDraft, -15, 15, 10);
  }
  return colGutterSumPct;
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

function parseDiagonalRotateDegDraft(
  raw: string,
  emptyFallback: number = DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG,
): number {
  return parsePctInput(raw, 0, 89, emptyFallback);
}

function diagonalRotateDegDraftAfterBlur(raw: string): string {
  const t = raw.trim();
  if (t === "") return "";
  return String(parseDiagonalRotateDegDraft(t, DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG));
}

function whiteMarginExpandPctDraftAfterBlur(raw: string): string {
  return String(parseWhiteMarginExpandPct(raw));
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
import {
  GatewaySettings,
  useGatewaySettingsFromStorage,
} from "@/components/gateway-settings";

const LS_LAST_USER_NOTES = "manicure_last_user_extra_notes";
const LS_NAIL_SHAPE_PROFILE = "manicure_model_tryon_nail_shape_profile";
const MAX_PRESETS = 40;
const MAX_PRESET_LINE_CHARS = 200;

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

type TenSlotCell = { file: File | null; previewUrl: string | null };

function emptyTenSlots(): TenSlotCell[] {
  return Array.from({ length: 10 }, () => ({ file: null, previewUrl: null }));
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
  const [imageFluxSize, setImageFluxSize] = useState("1024x1024");
  const [nailBoxArrangement, setNailBoxArrangement] =
    useState<NailsInBoxArrangement>("vertical");
  const [nailBoxLongNails, setNailBoxLongNails] = useState(false);
  const [nailShapeProfile, setNailShapeProfile] =
    useState<NailShapeProfileId>(DEFAULT_NAIL_SHAPE_PROFILE);
  /** 文本草稿：可删光再输入，提交时再解析成数字 */
  const [colWidthDrafts, setColWidthDrafts] = useState<string[]>(() => [
    ...DEFAULT_COL_WIDTH_DRAFTS,
  ]);
  const [marginPctDraft, setMarginPctDraft] = useState("8.5");
  const [colGutterSumPct, setColGutterSumPct] = useState(0);
  const [rowGutterPctDraft, setRowGutterPctDraft] = useState("0");
  const [colGutterPctDraft, setColGutterPctDraft] = useState(
    DEFAULT_COL_GUTTER_PCT_DRAFT,
  );
  const [nailWidthPctDrafts, setNailWidthPctDrafts] = useState<string[]>(() => [
    ...DEFAULT_NAIL_WIDTH_PCT_DRAFTS,
  ]);
  const [nailHeightPctDrafts, setNailHeightPctDrafts] = useState<string[]>(() => [
    ...DEFAULT_NAIL_HEIGHT_PCT_DRAFTS,
  ]);
  const [lockNailAspectRatio, setLockNailAspectRatio] = useState(true);
  /** 上下手同款：默认勾选，上传一行五甲（二次矫正 / 手握盒） */
  const [sameHandsRow, setSameHandsRow] = useState(true);
  /** 斜排模式：服务端整图旋转角度（度）；空 = 提交时用默认 25° */
  const [diagonalRotateDegDraft, setDiagonalRotateDegDraft] = useState("");
  const [diagonalUploadRows, setDiagonalUploadRows] =
    useState<DiagonalUploadRows>("one_row");
  const [skipDiagonalRowModel, setSkipDiagonalRowModel] = useState(false);
  const [whiteMarginExpandPctDraft, setWhiteMarginExpandPctDraft] =
    useState(String(DEFAULT_WHITE_MARGIN_EXPAND_PCT));
  const nailAspectLockRatioRef = useRef<number[]>([1, 1, 1, 1, 1]);
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
  const [regenerateBusyIndex, setRegenerateBusyIndex] = useState<number | null>(
    null,
  );
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
  const userPresets = usePromptPresets(
    "manicure_user_prompt_presets",
    DEFAULT_USER_PROMPT_PRESETS,
  );
  const soloPresets = usePromptPresets(
    "manicure_solo_image_prompt_presets",
    DEFAULT_SOLO_IMAGE_PROMPT_PRESETS,
  );
  const [presetPanelOpen, setPresetPanelOpen] = useState(false);
  const [soloPresetPanelOpen, setSoloPresetPanelOpen] = useState(false);

  // Aliases for JSX backward compatibility
  const promptPresets = userPresets.presets;
  const newPresetDraft = userPresets.newDraft;
  const setNewPresetDraft = userPresets.setNewDraft;
  const draggingPresetIndex = userPresets.draggingIndex;
  const setDraggingPresetIndex = userPresets.setDraggingIndex;
  const dragOverPresetIndex = userPresets.dragOverIndex;
  const setDragOverPresetIndex = userPresets.setDragOverIndex;
  const addPresetFromDraft = userPresets.addFromDraft;
  const removePresetById = userPresets.removeById;
  const movePreset = userPresets.move;
  const reorderPresetByDrag = userPresets.reorderByDrag;
  const clearPresetDragUi = userPresets.clearDragUi;

  const soloPromptPresets = soloPresets.presets;
  const newSoloPresetDraft = soloPresets.newDraft;
  const setNewSoloPresetDraft = soloPresets.setNewDraft;
  const draggingSoloPresetIndex = soloPresets.draggingIndex;
  const setDraggingSoloPresetIndex = soloPresets.setDraggingIndex;
  const dragOverSoloPresetIndex = soloPresets.dragOverIndex;
  const setDragOverSoloPresetIndex = soloPresets.setDragOverIndex;
  const addSoloPresetFromDraft = soloPresets.addFromDraft;
  const removeSoloPresetById = soloPresets.removeById;
  const moveSoloPreset = soloPresets.move;
  const reorderSoloPresetByDrag = soloPresets.reorderByDrag;
  const clearSoloPresetDragUi = soloPresets.clearDragUi;

  const {
    provider: gatewayProvider,
    apiKey: gatewayApiKey,
    setProvider: setGatewayProvider,
    setApiKey: setGatewayApiKey,
  } = useGatewaySettingsFromStorage();

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
      const raw = localStorage.getItem(LS_NAIL_SHAPE_PROFILE);
      if (raw) setNailShapeProfile(parseNailShapeProfile(raw));
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_NAIL_SHAPE_PROFILE, nailShapeProfile);
    } catch {
      /* private mode */
    }
  }, [nailShapeProfile]);

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

  const dualKind = getDualUploadKind(mode);
  const tenMode = requiresTenSingleNails(mode);
  const usesSingleRowUpload = effectiveUsesSingleRowUpload(mode, sameHandsRow);
  const showsSameHandsOption = modeSupportsSameHandsRowOption(mode);
  const showsWhiteGridLayoutPanel = modeShowsWhiteGridLayoutPanel(mode);
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
        const v = Number.isFinite(g) ? g : 0;
        setColGutterPctDraft(
          String(Math.min(15, Math.max(-15, v))),
        );
        setColGutterSumPct(clampColGutterSumPct(Math.max(0, v)));
      }
      setRowGutterPctDraft(p.rowGutterPctDraft);
      const wDrafts = p.nailWidthPctDrafts ?? [...DEFAULT_NAIL_WIDTH_PCT_DRAFTS];
      const hDrafts = p.nailHeightPctDrafts ?? [...DEFAULT_NAIL_HEIGHT_PCT_DRAFTS];
      setNailWidthPctDrafts([...wDrafts]);
      setNailHeightPctDrafts([...hDrafts]);
      const locked = p.lockNailAspectRatio ?? true;
      setLockNailAspectRatio(locked);
      if (locked) {
        nailAspectLockRatioRef.current = wDrafts.map((w, i) =>
          nailScaleFromPctDraft(hDrafts[i] ?? "") /
          Math.max(1e-6, nailScaleFromPctDraft(w)),
        );
      }
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
      colGutterSumPctDraft:
        mode === "complete_single_grid" ? colGutterPctDraft : String(colGutterSumPct),
      rowGutterPctDraft,
      nailWidthPctDrafts: [...nailWidthPctDrafts],
      nailHeightPctDrafts: [...nailHeightPctDrafts],
      lockNailAspectRatio,
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
    colGutterPctDraft,
    mode,
    rowGutterPctDraft,
    nailWidthPctDrafts,
    nailHeightPctDrafts,
    lockNailAspectRatio,
    gridPresetSelectedIndex,
    gridPresets.length,
  ]);

  const syncNailHeightFromWidthAt = useCallback(
    (colIndex: number, widthDraft: string) => {
      const w = nailScaleFromPctDraft(widthDraft);
      const ratio = nailAspectLockRatioRef.current[colIndex] ?? 1;
      const hPct = Math.round(w * ratio * 100);
      const clamped = Math.min(
        NAIL_SCALE_PCT_MAX,
        Math.max(NAIL_SCALE_PCT_MIN, hPct),
      );
      setNailHeightPctDrafts((prev) => {
        const next = [...prev];
        next[colIndex] = String(clamped);
        return next;
      });
    },
    [],
  );

  const syncNailWidthFromHeightAt = useCallback(
    (colIndex: number, heightDraft: string) => {
      const h = nailScaleFromPctDraft(heightDraft);
      const ratio = nailAspectLockRatioRef.current[colIndex] ?? 1;
      const wPct = Math.round(h / Math.max(1e-6, ratio) * 100);
      const clamped = Math.min(
        NAIL_SCALE_PCT_MAX,
        Math.max(NAIL_SCALE_PCT_MIN, wPct),
      );
      setNailWidthPctDrafts((prev) => {
        const next = [...prev];
        next[colIndex] = String(clamped);
        return next;
      });
    },
    [],
  );

  const refreshNailAspectLockRatios = useCallback(() => {
    nailAspectLockRatioRef.current = nailWidthPctDrafts.map((w, i) =>
      nailScaleFromPctDraft(nailHeightPctDrafts[i] ?? "") /
      Math.max(1e-6, nailScaleFromPctDraft(w)),
    );
  }, [nailWidthPctDrafts, nailHeightPctDrafts]);

  const resultObjectUrlsRef = useRef<string[]>([]);
  /** 与 resultUrls 下标对齐：中转站原始 data/https，供下载/复制（展示可能是 blob:） */
  const resultExportUrlsRef = useRef<string[]>([]);
  /** 每次点击生成时刷新，写入下载文件名以区分不同批次 */
  const downloadBatchStampRef = useRef(formatDownloadBatchStamp());

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
      labelOverride?: string,
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
        const label =
          labelOverride ?? resultLabels[index] ?? `图 ${index + 1}`;
        await triggerDownloadFromResultUrl(
          exportUrl,
          buildResultDownloadFilename({
            batchStamp: downloadBatchStampRef.current,
            label,
            index,
            ext,
          }),
          fetchRemoteResultBlob,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "下载失败，请稍后重试。");
      } finally {
        setDownloadBusyIndex(null);
      }
    },
    [fetchRemoteResultBlob, resolveExportUrl, resultLabels],
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
        const feedLabel = resultLabels[index] ?? `图 ${index + 1}`;
        const newFile = new File(
          [blob],
          buildResultDownloadFilename({
            batchStamp: downloadBatchStampRef.current,
            label: feedLabel,
            index,
            ext,
            prefix: "投喂图",
          }),
          {
            type: mime.startsWith("image/") ? mime : "image/png",
          },
        );
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
              : "包装刀模展开图请选择图片文件。"
            : mode === "nails_in_box"
              ? "美甲款式图请选择图片文件。"
              : modeIsScatteredGridFlatlay(mode)
                ? "竖直 2×5 白底商品图请选择图片文件。"
                : modeIsDiagonalRowFlatlay(mode)
                  ? diagonalUploadRows === "two_rows"
                    ? "两行 / 2×5 美甲图请选择图片文件。"
                    : "一行五甲照片请选择图片文件。"
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

  const onExtract = useCallback(async (opts?: {
    variantChoice?: ParallelVariantChoice;
    mergeSlotIndex?: number;
  }) => {
    const variantChoice = opts?.variantChoice ?? "all";
    const mergeSlotIndex = opts?.mergeSlotIndex;
    const isPartialRegen =
      variantChoice !== "all" &&
      mergeSlotIndex !== undefined &&
      parallelImageJobCountForMode(mode) > 1;

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
      setError(
        mode === "flat_to_3d_packaging"
          ? "请先上传包装刀模展开图。"
          : "请先选择一张美甲照片。",
      );
      return;
    }

    setLoading(true);
    setError(null);
    if (isPartialRegen) {
      setRegenerateBusyIndex(mergeSlotIndex!);
      const slotCount = parallelImageJobCountForMode(mode);
      setStreamSlots(
        Array.from({ length: slotCount }, (_, i) => {
          if (i === mergeSlotIndex) return null;
          const url = resultUrls[i];
          if (!url) return null;
          return {
            url,
            exportUrl: resultExportUrlsRef.current[i] ?? url,
            label: resultLabels[i] ?? `图 ${i + 1}`,
          };
        }),
      );
    } else {
      clearResults();
      downloadBatchStampRef.current = formatDownloadBatchStamp();
    }
    try {
      const body = new FormData();
      body.set("mode", mode);
      if (variantChoice !== "all") {
        body.set("parallelVariantChoice", variantChoice);
      }
      if (imageModelChoice.trim()) {
        body.set("imageModel", imageModelChoice.trim());
      }
      if (
        imageModelChoice.trim() &&
        imageFluxSize.trim() &&
        /^(flux|flux-dev|flux-pro)$/i.test(imageModelChoice.trim())
      ) {
        body.set("imageFluxSize", imageFluxSize.trim());
      }
      if (tenMode) {
        for (let i = 0; i < 10; i++) {
          const f = tenSlots[i]!.file;
          if (f) body.append("nail", f);
        }
        body.set("nailGridColWidths", serializeColWidthDrafts(colWidthDrafts));
        body.set(
          "nailGridMarginPct",
          String(parsePctInput(marginPctDraft, 0.5, 12, 8.5)),
        );
        body.set("nailGridColGutterPct", String(colGutterSumPct));
        body.set(
          "nailGridRowGutterPct",
          String(parsePctInput(rowGutterPctDraft, 0, 12, 0)),
        );
        body.set(
          "nailGridNailColWidthsPct",
          serializeNailColScalePctDrafts(nailWidthPctDrafts),
        );
        body.set(
          "nailGridNailColHeightsPct",
          serializeNailColScalePctDrafts(nailHeightPctDrafts),
        );
      } else {
        body.set("image", file!);
        if (dualKind === "model" && secondFile) {
          body.set("modelImage", secondFile);
          body.set("nailShapeProfile", nailShapeProfile);
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
          if (nailBoxLongNails) {
            body.set("nailBoxLongNails", "1");
          }
        }
        if (showsSameHandsOption) {
          body.set("sameHandsRow", sameHandsRow ? "1" : "0");
        }
        if (modeIsDiagonalRowFlatlay(mode)) {
          body.set("skipRowModel", skipDiagonalRowModel ? "1" : "0");
          body.set("diagonalUploadRows", diagonalUploadRows);
          body.set(
            "diagonalPackshotRotateDeg",
            String(parseDiagonalRotateDegDraft(diagonalRotateDegDraft)),
          );
        }
        if (modeIsExpandWhiteMargin(mode)) {
          body.set("whiteMarginExpandPct", whiteMarginExpandPctDraft.trim());
        }
        if (
          modeUsesWhiteGridFormFields(mode) ||
          sameHandsRowUsesGridFormFields(mode, sameHandsRow)
        ) {
          body.set("nailGridColWidths", serializeColWidthDrafts(colWidthDrafts));
          body.set(
            "nailGridMarginPct",
            String(parsePctInput(marginPctDraft, 0.5, 12, 8.5)),
          );
          body.set(
            "nailGridColGutterPct",
            String(colGutterPctForSubmit(mode, colGutterPctDraft, colGutterSumPct)),
          );
          body.set(
            "nailGridRowGutterPct",
            String(parsePctInput(rowGutterPctDraft, 0, 12, 0)),
          );
          body.set(
            "nailGridNailColWidthsPct",
            serializeNailColScalePctDrafts(nailWidthPctDrafts),
          );
          body.set(
            "nailGridNailColHeightsPct",
            serializeNailColScalePctDrafts(nailHeightPctDrafts),
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
      body.set("gatewayProvider", gatewayProvider);
      if (gatewayApiKey.trim()) {
        body.set("gatewayApiKey", gatewayApiKey.trim());
      }
      const jobStreamN =
        parallelStreamJobCount(mode) > 0 && variantChoice === "all"
          ? parallelStreamJobCount(mode)
          : 0;
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
        if (isPartialRegen && mergeSlotIndex !== undefined) {
          const slotCount = parallelImageJobCountForMode(mode);
          const defaultLabels = promptsForMode(mode).map((j) => j.label);
          const mergedExports = [...resultExportUrlsRef.current];
          const mergedLabels = [...resultLabels];
          while (mergedExports.length < slotCount) mergedExports.push("");
          while (mergedLabels.length < slotCount) {
            mergedLabels.push(
              defaultLabels[mergedLabels.length] ??
                `图 ${mergedLabels.length + 1}`,
            );
          }
          mergedExports[mergeSlotIndex] = finalUrls[0]!;
          mergedLabels[mergeSlotIndex] =
            finalLabels[0] ?? mergedLabels[mergeSlotIndex]!;
          commitResultUrls(mergedExports, mergedLabels);
        } else {
          commitResultUrls(
            finalUrls,
            finalLabels.length
              ? finalLabels
              : finalUrls.map((_, i) => `图 ${i + 1}`),
          );
        }
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
        if (isPartialRegen && mergeSlotIndex !== undefined) {
          const slotCount = parallelImageJobCountForMode(mode);
          const defaultLabels = promptsForMode(mode).map((j) => j.label);
          const mergedExports = [...resultExportUrlsRef.current];
          const mergedLabels = [...resultLabels];
          while (mergedExports.length < slotCount) mergedExports.push("");
          while (mergedLabels.length < slotCount) {
            mergedLabels.push(
              defaultLabels[mergedLabels.length] ??
                `图 ${mergedLabels.length + 1}`,
            );
          }
          mergedExports[mergeSlotIndex] = urls[0]!;
          mergedLabels[mergeSlotIndex] =
            (data.labels?.[0] ?? mergedLabels[mergeSlotIndex])!;
          commitResultUrls(mergedExports, mergedLabels);
        } else {
          commitResultUrls(urls, data.labels ?? urls.map((_, i) => `图 ${i + 1}`));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理失败");
      setStreamSlots(null);
    } finally {
      setStreamSlots(null);
      setRegenerateBusyIndex(null);
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
    imageFluxSize,
    tenMode,
    tenSlots,
    panelColorHex,
    panelColorSource,
    userExtraNotes,
    soloImageEditPrompt,
    nailBoxArrangement,
    nailShapeProfile,
    colWidthDrafts,
    marginPctDraft,
    colGutterSumPct,
    colGutterPctDraft,
    rowGutterPctDraft,
    nailWidthPctDrafts,
    nailHeightPctDrafts,
    sameHandsRow,
    diagonalRotateDegDraft,
    diagonalUploadRows,
    skipDiagonalRowModel,
    whiteMarginExpandPctDraft,
    showsSameHandsOption,
    prepareResultUrlForDisplay,
    gatewayProvider,
    gatewayApiKey,
    resultUrls,
    resultLabels,
  ]);

  const onRegenerateVariant = useCallback(
    (slotIndex: number) => {
      const choice = parallelVariantChoiceFromSlotIndex(slotIndex);
      if (!choice) return;
      void onExtract({ variantChoice: choice, mergeSlotIndex: slotIndex });
    },
    [onExtract],
  );

  const clearUserNotes = useCallback(() => {
    setUserExtraNotes("");
    try {
      localStorage.removeItem(LS_LAST_USER_NOTES);
    } catch {
      /* ignore */
    }
  }, []);

  const appendPresetToNotes = useCallback((line: string) => {
    const t = line.trim().slice(0, 200);
    if (!t) return;
    setUserExtraNotes((prev) => (prev.trim() ? `${prev.trim()}\n${t}` : t));
  }, []);

  const appendSoloPresetToField = useCallback((line: string) => {
    const t = line.trim().slice(0, 200);
    if (!t) return;
    setSoloImageEditPrompt((prev) => {
      const next = prev.trim() ? `${prev.trim()}\n${t}` : t;
      return next.slice(0, 4000);
    });
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
          ? "产出（2D 刀模 → 3D 全封闭盒 · 1张）"
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
                : mode === "expand_white_margin"
                  ? "产出（白底扩留白 · 正方形 · 1张）"
                : mode === "extract_ten_grid"
                  ? "产出（白底栅格 · 仅抠图 · 2张择优）"
                  : mode === "extract_diagonal_row"
                    ? "产出（斜排 · 一行五甲 · 1张）"
                    : mode === "extract_scattered_grid"
                      ? "产出（散落排版 · 2×5 打散 · 1张）"
                    : mode === "white_grid_rectify"
                    ? "产出（白底栅格 · 几何矫正 · 1张）"
                    : mode === "complete_single_grid"
                      ? "产出（白底栅格 · 单甲补齐10支）"
                      : mode === "single_row_to_grid"
                        ? "产出（白底栅格 · 单行复制成双行 · 1张）"
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
            ? "实拍/渲染盒装图；成片以它为底，**只换**窗内美甲，位置高度不变"
            : "需清晰露出指甲区域";

  const firstDualProductHint =
    dualKind === "packaging_pose"
      ? sameHandsRow
        ? "上传**一行五枚**（拇→小，甲尖朝下）；**模型先规整单行**，服务端再复制为 2×5 后合成手握图。取消勾选可传完整 2×5"
        : "款式来源：完整 **2×5** 背卡/托盘/白底栅格；上下行可不同款"
      : dualKind === "packaging_3d_ref"
        ? "正面/背面展开、屏显效果图、刀版图截图均可；为盒面图文唯一来源；服务端会**自动提取主色**写入提示词"
        : dualKind === "sachet_back"
          ? "方形正面稿：Logo、品名、版式不变；右侧可**手动选袋身色**或跟随正面稿自动提色"
          : dualKind === "model" || dualKind === "accessory"
          ? "美甲产品图约定：甲尖朝下；每行从左到右大拇指→小指；试戴成图按格严格还原款式"
          : dualKind === "nails_box"
            ? "款式图：托盘/背卡/白底栅格；图案会**逐枚贴到**右侧包装盒窗内原有甲片位置（不重排、不拉伸盒体）"
            : "平铺、卡纸、白底商品图均可";

  const singleUploadTitle =
    modeIsScatteredGridFlatlay(mode)
        ? "点击选择竖直 2×5 白底商品图"
        : mode === "extract_ten_grid"
          ? "点击选择含多枚甲片的照片"
        : mode === "white_grid_rectify"
        ? sameHandsRow
          ? "点击选择一行五枚甲片照片"
          : "点击选择已生成的 2×5 白底栅格图"
        : mode === "multi_angle"
          ? "点击选择美甲款式参考图"
        : mode === "flat_to_3d_packaging"
          ? "点击选择包装刀模展开图"
        : mode === "complete_single_grid"
          ? "点击选择单枚甲片照片"
          : mode === "expand_white_margin"
            ? "点击选择要扩留白的图片"
          : modeIsDiagonalRowFlatlay(mode)
            ? diagonalUploadRows === "two_rows"
              ? "点击选择两行 / 2×5 美甲图"
              : "点击选择一行五枚甲片照片"
            : usesSingleRowUpload
              ? "点击选择一行五枚甲片照片"
              : "点击选择美甲照片";
  const singleUploadHint =
    modeIsScatteredGridFlatlay(mode)
      ? "上传**竖直 2×5**（上排 1–5、下排 6–10）；输出 **10 枚**在白底**随机位置与角度**打散，保留每格甲型与花色，禁止仍排成整齐栅格；每次 **1 张**"
      : modeIsDiagonalRowFlatlay(mode)
        ? diagonalUploadRows === "two_rows"
          ? skipDiagonalRowModel
            ? `上传**已是两行 / 2×5** 的白底商品图。仅 EXIF 转正 → 铺满画布 → 斜排旋转（默认 **${DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG}°**），**不复制、不调模型**`
            : "两行上传须勾选下方「跳过模型」；未勾选时请改选「一行五枚」走模型抠图。"
          : skipDiagonalRowModel
            ? `上传**一行五枚**。跳过模型：EXIF 转正 → 整行复制成双行 → 斜排旋转（默认 **${DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG}°**）`
            : `上传**一行五枚**（拇→小）。模型抠出一行后服务端复制成双行并旋转（默认 **${DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG}°**）`
      : mode === "extract_ten_grid"
        ? "托盘、卡纸、实拍平铺等；只抠已出现的甲片，**锁定每枚长短与甲型**，每行甲根齐平、指尖随长短自然阶梯；每次并行 **2 张**（择优）"
        : mode === "white_grid_rectify"
          ? sameHandsRow
            ? "上传**一行五枚**（拇→小，甲尖朝下）。**模型先规整单行**，服务端**再复制为 2×5**；取消勾选则改传完整 2×5"
            : "请上传 **2×5** 白底成品图。**不改甲型与长短**，仅刚性旋转摆正歪斜，用外留白/列缝/行间缝控距；每次 **1 张**"
          : mode === "multi_angle"
            ? "上传 2×5 背卡、平铺或商品图作为款式参考；上手 pose 固定为内置棚拍模板，仅替换五指美甲，**每指长短必须与上传图一致**（拇 **左→右**、其余四指 **上→下**），生成 **1 张**主图"
          : mode === "flat_to_3d_packaging"
            ? "上传刀模/展开结构图（含各面板印刷与折线）；输出 **1 张**全封闭 3D 盒白底 mockup（**无开窗**）；服务端自动提取稿面主色"
          : mode === "complete_single_grid"
            ? "请上传甲尖朝下、甲根朝上的单枚（或含一枚主款）；仅做 EXIF 转正后由模型抠出一枚高清单甲，再由服务端按五列相对宽度复制成 10 格"
            : mode === "expand_white_margin"
              ? `上传任意美甲/商品图；**不转正、不抠图**。先居中铺成正方形白底，再四周扩白（默认 **${DEFAULT_WHITE_MARGIN_EXPAND_PCT}%**）；纯服务端处理，每次 **1 张**`
            : mode === "single_row_to_grid"
              ? "上传一行五枚（拇→小，甲尖朝下）。模型抠出带白缝的一行，服务端**整行复制**成双排；「同一行相邻美甲间距」主要约束模型"
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
    if (next === "layer_editor") return;
    setMode(next);
    if (modeUsesDominantColorExtraction(next)) {
      setPanelColorSource("auto");
      setPanelAutoHex(null);
    }
    if (next === "single_row_to_grid" || next === "extract_diagonal_row") {
      if (marginPctDraft.trim() === "1.8" || marginPctDraft.trim() === "6") {
        setMarginPctDraft("8.5");
      }
      setColGutterSumPct((prev) => (prev < 14 ? 14 : prev));
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

  useEffect(() => {
    if (mode === "layer_editor") {
      setMode("extract_ten_grid");
    }
  }, [mode]);

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        <AppPageHeader
          activeTab="generate"
          imageModelChoice={imageModelChoice}
          onImageModelChange={(v) => {
            setImageModelChoice(v);
            clearResults();
          }}
          fluxSize={imageFluxSize}
          onFluxSizeChange={setImageFluxSize}
        />

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

        <GatewaySettings
          provider={gatewayProvider}
          apiKey={gatewayApiKey}
          onProviderChange={setGatewayProvider}
          onApiKeyChange={setGatewayApiKey}
        />

        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-zinc-700">生成模式</p>
          <GenerationModePicker value={mode} onChange={onModeChange} />
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void onExtract()}
          className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-rose-600 text-base font-semibold text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          {loading
            ? mode === "multi_angle"
              ? "正在生成正视上手主图…"
              : mode === "packaging_mockup"
                ? sameHandsRow
                  ? "正在模型规整一行并复制为 2×5，再合成手握图…"
                  : "正在生成包装手握图…"
                : mode === "flat_to_3d_packaging"
                  ? "正在生成 3D 全封闭盒主视图…"
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
                            : mode === "expand_white_margin"
                              ? "正在扩大白底留白…"
                            : mode === "single_row_to_grid"
                              ? "正在规整单行并复制拼接 2×5…"
                              : mode === "extract_ten_grid"
                              ? "正在并行抠图排版（2 张）…"
                              : mode === "extract_diagonal_row"
                                ? "正在生成斜排（一行抠图、复制、旋转）…"
                                : mode === "extract_scattered_grid"
                                  ? "正在生成散落排版…"
                                : mode === "white_grid_rectify"
                                ? sameHandsRow
                                  ? "正在模型规整一行并复制为 2×5…"
                                  : "正在几何矫正…"
                                : "正在生成…"
            : "开始生成"}
        </button>
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {mode === "model_tryon" ? (
          <NailShapeProfilePicker
            value={nailShapeProfile}
            onChange={setNailShapeProfile}
          />
        ) : null}

        {modeIsExpandWhiteMargin(mode) ? (
          <label className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 shadow-sm">
            <span className="font-medium">扩大百分之多少</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                className="max-w-[8rem] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums outline-none ring-rose-500/30 focus:border-rose-400 focus:ring-2"
                value={whiteMarginExpandPctDraft}
                onChange={(e) => setWhiteMarginExpandPctDraft(e.target.value)}
                onBlur={() =>
                  setWhiteMarginExpandPctDraft((prev) =>
                    whiteMarginExpandPctDraftAfterBlur(prev),
                  )
                }
                aria-describedby="white-margin-expand-pct-hint"
              />
              <span className="text-zinc-600">%</span>
            </div>
            <span
              id="white-margin-expand-pct-hint"
              className="text-xs font-normal text-zinc-500"
            >
              先居中铺成正方形白底，再按此比例四周扩白；默认{" "}
              {DEFAULT_WHITE_MARGIN_EXPAND_PCT}%，有效范围{" "}
              {MIN_WHITE_MARGIN_EXPAND_PCT}–{MAX_WHITE_MARGIN_EXPAND_PCT}%。
            </span>
          </label>
        ) : null}

        <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-8">
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
              <TenSlotUpload
                tenSlots={tenSlots}
                onPickSlot={beginPickTenSlot}
                onRemoveSlot={removeTenSlot}
                onBatchPick={onPickTenBatch}
                onClear={() => {
                  clearTenSlots();
                  setError(null);
                }}
                onPasteToFirst={applyTenPasteToFirstAvailable}
              />
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
                    Ctrl+V（Windows）或 ⌘+V（Mac）
                  </FeedPasteZone>
                  <FeedPasteZone
                    ariaLabel="粘贴第二张投喂图"
                    className="min-h-[4.5rem]"
                    onPasteImage={(f) => {
                      applySecondImageFile(f);
                    }}
                  >
                    <span className="font-medium text-zinc-700">② </span>
                    Ctrl+V（Windows）或 ⌘+V（Mac）
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
                              : dualKind === "packaging_pose" && sameHandsRow
                                ? "点击选择一行五枚甲片照片"
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
                {showsSameHandsOption ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={sameHandsRow}
                      onChange={(e) => setSameHandsRow(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium">上下手同款（一行五甲）</span>
                      <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                        {sameHandsRowOptionHint(mode)}
                      </span>
                    </span>
                  </label>
                ) : null}
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
                    <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-zinc-200 pt-3 text-sm text-zinc-800">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={nailBoxLongNails}
                        onChange={(e) => setNailBoxLongNails(e.target.checked)}
                      />
                      <span>
                        <span className="font-medium">甲片偏长</span>
                        <span className="block text-xs font-normal text-zinc-500">
                          生成前先把款式图整组缩小并铺白底，避免模型为长甲把外盒拉高；盒体比例仍以包装盒参考图为准
                        </span>
                      </span>
                    </label>
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
                  Ctrl+V（Windows）或 ⌘+V（Mac）
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
                {showsSameHandsOption ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={sameHandsRow}
                      onChange={(e) => setSameHandsRow(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium">上下手同款（一行五甲）</span>
                      <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                        {sameHandsRowOptionHint(mode)}
                      </span>
                    </span>
                  </label>
                ) : null}
                {modeIsDiagonalRowFlatlay(mode) ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 text-sm text-zinc-800">
                    <fieldset>
                      <legend className="text-sm font-medium text-zinc-800">
                        上传内容
                      </legend>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name="diagonalUploadRows"
                            className="mt-1"
                            checked={diagonalUploadRows === "one_row"}
                            onChange={() => setDiagonalUploadRows("one_row")}
                          />
                          <span>
                            <span className="font-medium">一行五枚</span>
                            <span className="block text-xs font-normal text-zinc-500">
                              可走模型抠图，或由服务端复制成双行
                            </span>
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name="diagonalUploadRows"
                            className="mt-1"
                            checked={diagonalUploadRows === "two_rows"}
                            onChange={() => {
                              setDiagonalUploadRows("two_rows");
                              setSkipDiagonalRowModel(true);
                            }}
                          />
                          <span>
                            <span className="font-medium">已是两行 / 2×5</span>
                            <span className="block text-xs font-normal text-zinc-500">
                              须勾选「跳过模型」，仅铺满画布后旋转
                            </span>
                          </span>
                        </label>
                      </div>
                    </fieldset>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={skipDiagonalRowModel}
                        onChange={(e) => setSkipDiagonalRowModel(e.target.checked)}
                      />
                      <span>
                        <span className="font-medium">跳过模型</span>
                        <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                          仅 EXIF 转正 + 服务端处理 + 斜排旋转；一行时复制成双行，两行时不复制
                        </span>
                      </span>
                    </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium">服务端斜排旋转角度（度）</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="max-w-[8rem] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums outline-none ring-rose-500/30 focus:border-rose-400 focus:ring-2"
                      value={diagonalRotateDegDraft}
                      onChange={(e) => setDiagonalRotateDegDraft(e.target.value)}
                      onBlur={() =>
                        setDiagonalRotateDegDraft((prev) =>
                          diagonalRotateDegDraftAfterBlur(prev),
                        )
                      }
                      placeholder={String(DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG)}
                      aria-describedby="diagonal-rotate-deg-hint"
                    />
                    <span
                      id="diagonal-rotate-deg-hint"
                      className="text-xs font-normal text-zinc-500"
                    >
                      {diagonalUploadRows === "two_rows"
                        ? "两行铺满画布后整图刚性旋转"
                        : "一行复制为 2×5 后整图刚性旋转"}
                      ；留空或未填时默认 {DEFAULT_DIAGONAL_PACKSHOT_ROTATE_DEG}
                      °，有效范围 0–89°。
                    </span>
                  </label>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <ResultDisplay
            displayResultSlots={displayResultSlots}
            resultHeading={resultHeading}
            gridClass={gridClass}
            downloadBusyIndex={downloadBusyIndex}
            copyBusyIndex={copyBusyIndex}
            feedFromResultBusyIndex={feedFromResultBusyIndex}
            regenerateBusyIndex={regenerateBusyIndex}
            loading={loading}
            onDownload={(i) => {
              const slot = displayResultSlots?.[i];
              if (!slot) return;
              void downloadResult(slot.url, i, slot.exportUrl, slot.label);
            }}
            onCopy={(i) => {
              const slot = displayResultSlots?.[i];
              if (!slot) return;
              void copyResultToClipboard(slot.url, i, slot.exportUrl);
            }}
            onConvertToFeed={(i) => {
              const slot = displayResultSlots?.[i];
              if (!slot) return;
              void convertResultToFeedImage(slot.url, i, slot.exportUrl);
            }}
            onRegenerateVariant={onRegenerateVariant}
            canConvertToFeed={!tenMode}
            canRegenerate={(i) =>
              parallelImageJobCountForMode(mode) > 1 &&
              !!parallelVariantChoiceFromSlotIndex(i)
            }
            parallelCount={parallelImageJobCountForMode(mode)}
            modeDescription={
              modeIsScatteredGridFlatlay(mode)
                ? "是否恰好 10 枚、底边是否纯白、是否已打散且每枚角度各异（非整齐 2×5）"
                : modeIsPhotoExtractToGrid(mode)
                  ? "抠图保真度与排版"
                  : "甲型保真度与竖直/间距"
            }
          />
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
                <PromptPresetsPanel
                  presets={soloPromptPresets}
                  newDraft={newSoloPresetDraft}
                  setNewDraft={setNewSoloPresetDraft}
                  draggingIndex={draggingSoloPresetIndex}
                  dragOverIndex={dragOverSoloPresetIndex}
                  onAdd={addSoloPresetFromDraft}
                  onRemove={removeSoloPresetById}
                  onMove={moveSoloPreset}
                  onReorderDrag={reorderSoloPresetByDrag}
                  onClearDragUi={clearSoloPresetDragUi}
                  onAppend={appendSoloPresetToField}
                  description="新添加的词条会出现在**第一行**。可**拖动左侧手柄**排序，或用「上移 / 下移」微调；顺序会保存（与本框下方的「补充说明」常用词分存）。"
                  colorScheme="amber"
                  dragDataKey="text/x-solo-preset-index"
                />
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
              <PromptPresetsPanel
                presets={promptPresets}
                newDraft={newPresetDraft}
                setNewDraft={setNewPresetDraft}
                draggingIndex={draggingPresetIndex}
                dragOverIndex={dragOverPresetIndex}
                onAdd={addPresetFromDraft}
                onRemove={removePresetById}
                onMove={movePreset}
                onReorderDrag={reorderPresetByDrag}
                onClearDragUi={clearPresetDragUi}
                onAppend={appendPresetToNotes}
                description="新添加的词条会出现在**第一行**。可**拖动左侧手柄**排序，或用「上移 / 下移」微调；顺序会保存。"
                colorScheme="rose"
                dragDataKey="text/x-preset-index"
              />
            ) : null}
          </div>
          </div>
          </div>
        </section>

        {showsWhiteGridLayoutPanel ? (
          <GridLayoutPanel
            nailWidthPctDrafts={nailWidthPctDrafts}
            setNailWidthPctDrafts={setNailWidthPctDrafts}
            nailHeightPctDrafts={nailHeightPctDrafts}
            setNailHeightPctDrafts={setNailHeightPctDrafts}
            rowGutterPctDraft={rowGutterPctDraft}
            setRowGutterPctDraft={setRowGutterPctDraft}
            colGutterPctDraft={colGutterPctDraft}
            setColGutterPctDraft={setColGutterPctDraft}
          />
        ) : null}
      </main>
    </div>
  );
}
