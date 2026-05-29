"use client";

import { ErrorBoundary } from "@/components/error-boundary";

type StreamResultSlot = {
  url: string;
  exportUrl: string;
  label: string;
} | null;

export function ResultDisplay({
  displayResultSlots,
  resultHeading,
  gridClass,
  downloadBusyIndex,
  copyBusyIndex,
  feedFromResultBusyIndex,
  regenerateBusyIndex,
  loading,
  onDownload,
  onCopy,
  onConvertToFeed,
  onRegenerateVariant,
  canConvertToFeed,
  canRegenerate,
  parallelCount,
  modeDescription,
}: {
  displayResultSlots: StreamResultSlot[] | null;
  resultHeading: string;
  gridClass: string;
  downloadBusyIndex: number | null;
  copyBusyIndex: number | null;
  feedFromResultBusyIndex: number | null;
  regenerateBusyIndex: number | null;
  loading: boolean;
  onDownload: (index: number) => void;
  onCopy: (index: number) => void;
  onConvertToFeed: (index: number) => void;
  onRegenerateVariant: (index: number) => void;
  canConvertToFeed: boolean;
  canRegenerate: (index: number) => boolean;
  parallelCount: number;
  modeDescription?: string;
}) {
  const filledCount =
    displayResultSlots?.filter((s) => s !== null).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-zinc-500">{resultHeading}</h2>
      {parallelCount > 1 ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          多路会同时打模型；若网关排队或限流，总耗时不一定比单路短（有时接近「两路各自变慢」）。先完成的图会先显示，不必等全部结束。
        </p>
      ) : null}
      {parallelCount > 1 && filledCount > 0 ? (
        <p className="text-xs leading-relaxed text-zinc-600">
          已并行生成 {filledCount} 张，请对比
          {modeDescription ?? "效果"}
          ，选用更合适的一张；若只满意其中一张，可点该图下方「重新生成此方案」单独重跑，另一张会保留。
        </p>
      ) : null}
      <ErrorBoundary>
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
                      onClick={() => onDownload(i)}
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
                      onClick={() => onCopy(i)}
                      title="复制图片到剪贴板，便于粘贴到其他应用"
                      className="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copyBusyIndex === i ? "复制中…" : "复制"}
                    </button>
                    {canConvertToFeed ? (
                      <button
                        type="button"
                        disabled={
                          !slot ||
                          feedFromResultBusyIndex === i ||
                          downloadBusyIndex === i ||
                          copyBusyIndex === i
                        }
                        onClick={() => onConvertToFeed(i)}
                        title="用该图替换左侧「投喂图片」中的主图，便于继续处理"
                        className="inline-flex h-9 min-w-[6.5rem] items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-900 shadow-sm transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {feedFromResultBusyIndex === i
                          ? "处理中…"
                          : "转为投喂图片"}
                      </button>
                    ) : null}
                    {canRegenerate(i) ? (
                      <button
                        type="button"
                        disabled={
                          loading ||
                          !slot ||
                          regenerateBusyIndex === i ||
                          downloadBusyIndex === i ||
                          copyBusyIndex === i ||
                          feedFromResultBusyIndex === i
                        }
                        onClick={() => onRegenerateVariant(i)}
                        title="仅重新生成当前方案（方案 A 或 B），另一张结果会保留"
                        className="inline-flex h-9 min-w-[7.5rem] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {regenerateBusyIndex === i
                          ? "重新生成中…"
                          : "重新生成此方案"}
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
      </ErrorBoundary>
    </div>
  );
}
