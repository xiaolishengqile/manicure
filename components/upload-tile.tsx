"use client";

export function UploadTile({
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
