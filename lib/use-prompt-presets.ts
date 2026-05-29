"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_PRESETS = 40;
const MAX_PRESET_LINE_CHARS = 200;

export type PromptPresetItem = { id: string; text: string };

function newPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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

export function usePromptPresets(
  storageKey: string,
  defaults: string[],
): {
  presets: PromptPresetItem[];
  newDraft: string;
  setNewDraft: (v: string) => void;
  draggingIndex: number | null;
  setDraggingIndex: (v: number | null) => void;
  dragOverIndex: number | null;
  setDragOverIndex: (v: number | null) => void;
  addFromDraft: () => void;
  removeById: (id: string) => void;
  move: (index: number, delta: -1 | 1) => void;
  reorderByDrag: (from: number, to: number) => void;
  clearDragUi: () => void;
} {
  const defaultItems = (): PromptPresetItem[] =>
    defaults.map((text, i) => ({ id: `builtin-${i}`, text }));

  const [presets, setPresets] = useState<PromptPresetItem[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const next = parseStoredPresets(raw);
        if (next?.length) return next;
      }
    } catch {
      /* ignore */
    }
    return defaultItems();
  });
  const [newDraft, setNewDraft] = useState("");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const skipFirstPersist = useRef(true);

  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(presets));
    } catch {
      /* ignore */
    }
  }, [presets, storageKey]);

  const addFromDraft = useCallback(() => {
    const t = newDraft.trim().slice(0, MAX_PRESET_LINE_CHARS);
    if (!t) return;
    setPresets((prev) => {
      if (prev.some((p) => p.text === t)) return prev;
      if (prev.length >= MAX_PRESETS) return prev;
      return [{ id: newPresetId(), text: t }, ...prev];
    });
    setNewDraft("");
  }, [newDraft]);

  const removeById = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const move = useCallback((index: number, delta: -1 | 1) => {
    setPresets((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[index]!;
      next[index] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }, []);

  const reorderByDrag = useCallback((from: number, to: number) => {
    if (from === to) return;
    setPresets((prev) => {
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [el] = next.splice(from, 1);
      next.splice(to, 0, el!);
      return next;
    });
  }, []);

  const clearDragUi = useCallback(() => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  }, []);

  return {
    presets,
    newDraft,
    setNewDraft,
    draggingIndex,
    setDraggingIndex,
    dragOverIndex,
    setDragOverIndex,
    addFromDraft,
    removeById,
    move,
    reorderByDrag,
    clearDragUi,
  };
}
