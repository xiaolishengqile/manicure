"use client";

import type { PromptPresetItem } from "@/lib/use-prompt-presets";

type ColorScheme = "rose" | "amber";

const colorClasses: Record<
  ColorScheme,
  {
    border: string;
    borderActive: string;
    bg: string;
    bgHover: string;
    text: string;
    textMuted: string;
    ring: string;
    handle: string;
    handleBorder: string;
    handleBg: string;
    numBg: string;
    btnUse: string;
    btnUseBorder: string;
    btnUseBg: string;
    inputBorder: string;
    inputRing: string;
    btnAdd: string;
    btnAddHover: string;
    dragBorder: string;
    dragRing: string;
  }
> = {
  rose: {
    border: "border-zinc-200",
    borderActive: "border-rose-400",
    bg: "bg-zinc-50/90",
    bgHover: "hover:bg-zinc-100",
    text: "text-zinc-800",
    textMuted: "text-zinc-600",
    ring: "ring-rose-200",
    handle: "border-zinc-300 bg-zinc-50 text-zinc-500",
    handleBorder: "border-dashed",
    handleBg: "bg-zinc-50",
    numBg: "bg-zinc-100 text-zinc-500",
    btnUse: "text-rose-900",
    btnUseBorder: "border-rose-200",
    btnUseBg: "bg-rose-50 hover:bg-rose-100",
    inputBorder: "border-zinc-300",
    inputRing: "ring-rose-500",
    btnAdd: "bg-zinc-800 text-white hover:bg-zinc-900",
    btnAddHover: "",
    dragBorder: "border-rose-400",
    dragRing: "ring-rose-200",
  },
  amber: {
    border: "border-amber-200/80",
    borderActive: "border-amber-500",
    bg: "bg-amber-50/90",
    bgHover: "hover:bg-amber-50",
    text: "text-zinc-800",
    textMuted: "text-amber-900/80",
    ring: "ring-amber-200",
    handle: "border-amber-300 bg-amber-50/80 text-amber-800/70",
    handleBorder: "border-dashed",
    handleBg: "bg-amber-50/80",
    numBg: "bg-amber-100 text-amber-900/70",
    btnUse: "text-amber-950",
    btnUseBorder: "border-amber-400",
    btnUseBg: "bg-amber-100 hover:bg-amber-200",
    inputBorder: "border-amber-300",
    inputRing: "ring-amber-500",
    btnAdd: "bg-amber-900 text-amber-50 hover:bg-amber-950",
    btnAddHover: "",
    dragBorder: "border-amber-500",
    dragRing: "ring-amber-200",
  },
};

export function PromptPresetsPanel({
  presets,
  newDraft,
  setNewDraft,
  draggingIndex,
  dragOverIndex,
  onAdd,
  onRemove,
  onMove,
  onReorderDrag,
  onClearDragUi,
  onAppend,
  description,
  colorScheme = "rose",
  dragDataKey,
}: {
  presets: PromptPresetItem[];
  newDraft: string;
  setNewDraft: (v: string) => void;
  draggingIndex: number | null;
  dragOverIndex: number | null;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onReorderDrag: (from: number, to: number) => void;
  onClearDragUi: () => void;
  onAppend: (text: string) => void;
  description: string;
  colorScheme?: ColorScheme;
  dragDataKey: string;
}) {
  const c = colorClasses[colorScheme];

  return (
    <div className={`mt-3 rounded-lg border ${c.border} ${c.bg} p-3`}>
      <p className={`mb-2 text-xs font-medium ${c.textMuted}`}>
        {description}
      </p>
      <ul className="max-h-52 space-y-2 overflow-y-auto">
        {presets.map((item, i) => (
          <li
            key={item.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              // setDragOverIndex handled by parent
            }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData(dragDataKey);
              const from = Number.parseInt(raw, 10);
              if (Number.isNaN(from)) {
                onClearDragUi();
                return;
              }
              onReorderDrag(from, i);
              onClearDragUi();
            }}
            className={`flex flex-wrap items-start gap-2 rounded-md border bg-white px-2 py-2 text-sm ${c.text} ${
              dragOverIndex === i
                ? `${c.dragBorder} ring-2 ${c.dragRing}`
                : c.border
            } ${draggingIndex === i ? "opacity-60" : ""}`}
          >
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(dragDataKey, String(i));
                e.dataTransfer.effectAllowed = "move";
                // setDraggingIndex handled by parent via onDragStart callback
              }}
              onDragEnd={onClearDragUi}
              className={`flex h-7 w-7 shrink-0 cursor-grab select-none items-center justify-center rounded border ${c.handleBorder} ${c.handle} active:cursor-grabbing`}
              title="拖动排序"
              aria-label="拖动排序"
            >
              ⋮⋮
            </span>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${c.numBg} text-xs font-semibold`}
              title="顺序"
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 break-words">{item.text}</span>
            <div className="flex shrink-0 flex-wrap gap-1">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
                className={`rounded border ${c.border} px-2 py-0.5 text-xs ${c.text} ${c.bgHover} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                上移
              </button>
              <button
                type="button"
                disabled={i >= presets.length - 1}
                onClick={() => onMove(i, 1)}
                className={`rounded border ${c.border} px-2 py-0.5 text-xs ${c.text} ${c.bgHover} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                下移
              </button>
              <button
                type="button"
                onClick={() => onAppend(item.text)}
                className={`rounded border ${c.btnUseBorder} ${c.btnUseBg} px-2 py-0.5 text-xs font-medium ${c.btnUse}`}
              >
                使用
              </button>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className={`rounded border ${c.border} px-2 py-0.5 text-xs ${c.textMuted} hover:border-red-200 hover:bg-red-50 hover:text-red-800`}
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
          value={newDraft}
          onChange={(e) => setNewDraft(e.target.value)}
          maxLength={200}
          placeholder="新增强提示词…"
          className={`min-w-[12rem] flex-1 rounded-lg border ${c.inputBorder} bg-white px-3 py-2 text-sm outline-none ${c.inputRing} focus:border-rose-500 focus:ring-2`}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!newDraft.trim() || presets.length >= 40}
          className={`inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${c.btnAdd}`}
        >
          添加
        </button>
      </div>
    </div>
  );
}
