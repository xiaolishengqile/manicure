"use client";

import { useCallback, useRef, useState } from "react";
import { AppPageHeader } from "@/components/app-page-header";
import { FeedPasteZone } from "@/components/feed-paste-zone";
import {
  GatewaySettings,
  useGatewaySettingsFromStorage,
} from "@/components/gateway-settings";
import { NailLayerCanvas } from "@/components/nail-layer-canvas";
import { NailManualCropper } from "@/components/nail-manual-cropper";
import { formatDownloadBatchStamp } from "@/lib/download-filename";
import { initLayersFromNails, type NailCropResult, type NailLayer } from "@/lib/nail-layer-editor";

type Phase = "upload" | "extracting" | "cropping" | "editing";

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
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
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

export default function LayerEditorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadStampRef = useRef(formatDownloadBatchStamp());

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gridUrl, setGridUrl] = useState<string | null>(null);
  const [layers, setLayers] = useState<NailLayer[]>([]);

  const {
    provider: gatewayProvider,
    apiKey: gatewayApiKey,
    setProvider: setGatewayProvider,
    setApiKey: setGatewayApiKey,
  } = useGatewaySettingsFromStorage();

  const applyFile = useCallback((next: File | null) => {
    setFile(next);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next ? URL.createObjectURL(next) : null;
    });
    if (phase !== "upload") {
      setGridUrl(null);
      setLayers([]);
      setPhase("upload");
    }
  }, [phase]);

  const resetAll = useCallback(() => {
    applyFile(null);
    setGridUrl(null);
    setLayers([]);
    setPhase("upload");
    setError(null);
  }, [applyFile]);

  const onExtract = useCallback(async () => {
    if (!file) {
      setError("请先选择一张含甲片的产品图。");
      return;
    }
    setLoading(true);
    setError(null);
    setPhase("extracting");
    downloadStampRef.current = formatDownloadBatchStamp();
    try {
      const body = new FormData();
      body.set("mode", "layer_editor");
      body.set("image", file);
      body.set("gatewayProvider", gatewayProvider);
      if (gatewayApiKey.trim()) {
        body.set("gatewayApiKey", gatewayApiKey.trim());
      }
      const res = await fetch("/api/extract-nails", { method: "POST", body });
      const data = (await res.json()) as { imageUrls?: string[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || `请求失败（${res.status}）`);
      }
      const urls = data.imageUrls ?? [];
      if (urls.length === 0) {
        throw new Error("未收到抠图结果。");
      }
      setGridUrl(urls[0]!);
      setPhase("cropping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "抠图失败");
      setPhase("upload");
    } finally {
      setLoading(false);
    }
  }, [file, gatewayProvider, gatewayApiKey]);

  const handleCropConfirm = useCallback((nails: NailCropResult[]) => {
    setLayers(initLayersFromNails(nails));
    setPhase("editing");
  }, []);

  const handleBackToCropper = useCallback(() => {
    setLayers([]);
    setPhase("cropping");
  }, []);

  const handleExport = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `图层编辑_${downloadStampRef.current}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const inWorkspace = phase === "cropping" || phase === "editing";

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <main
        className={`mx-auto flex flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 ${
          inWorkspace ? "max-w-[min(1600px,100%)]" : "max-w-4xl"
        }`}
      >
        <AppPageHeader activeTab="layer-editor" showImageModel={false} />

        <GatewaySettings
          provider={gatewayProvider}
          apiKey={gatewayApiKey}
          onProviderChange={setGatewayProvider}
          onApiKeyChange={setGatewayApiKey}
        />

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
        />

        {phase === "upload" || phase === "extracting" ? (
          <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <StepBadge active={phase === "upload"} label="① 上传" />
              <span className="text-zinc-300">→</span>
              <StepBadge label="② 抠图" />
              <span className="text-zinc-300">→</span>
              <StepBadge label="③ 裁切" />
              <span className="text-zinc-300">→</span>
              <StepBadge label="④ 排版" />
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-zinc-700">上传产品图</h2>
                <FeedPasteZone
                  ariaLabel="粘贴产品图"
                  onPasteImage={applyFile}
                >
                  Ctrl+V（Windows）或 ⌘+V（Mac）粘贴图片
                </FeedPasteZone>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className="relative flex min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-8 text-center transition hover:border-rose-300 hover:bg-rose-50/50"
                >
                  {previewUrl ? (
                    <>
                      <button
                        type="button"
                        aria-label="删除图片"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetAll();
                        }}
                        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/80 text-sm font-bold text-white shadow hover:bg-red-600"
                      >
                        ×
                      </button>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="预览"
                        className="max-h-56 w-full rounded-lg object-contain"
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-base font-medium text-zinc-800">
                        点击选择含甲片的产品图
                      </span>
                      <span className="max-w-sm text-sm text-zinc-500">
                        托盘、卡纸、白底商品图等均可；AI 会先抠出 2×5 栅格，再手动裁切并在画布上自由排版
                      </span>
                    </>
                  )}
                </div>
              </div>

              <aside className="flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 text-sm text-zinc-600">
                <p className="font-medium text-zinc-800">工作流程</p>
                <ol className="list-inside list-decimal space-y-2 text-xs leading-relaxed text-zinc-600">
                  <li>上传含多枚甲片的产品图</li>
                  <li>AI 自动抠图，生成 2×5 白底栅格</li>
                  <li>手动调整裁切框，精确框选每枚甲片</li>
                  <li>在画布上拖拽、缩放、旋转排版</li>
                  <li>导出 PNG 成品图</li>
                </ol>
              </aside>
            </div>

            <button
              type="button"
              disabled={!file || loading}
              onClick={() => void onExtract()}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-rose-600 text-base font-semibold text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              {loading ? "正在 AI 抠图…" : "开始抠图"}
            </button>
          </section>
        ) : null}

        {phase === "cropping" && gridUrl ? (
          <NailManualCropper
            gridImageUrl={gridUrl}
            onConfirm={handleCropConfirm}
            onCancel={resetAll}
          />
        ) : null}

        {phase === "editing" ? (
          <NailLayerCanvas
            layers={layers}
            onLayersChange={setLayers}
            onExport={handleExport}
            onBackToCropper={handleBackToCropper}
            onReset={resetAll}
            sourcePreviewUrl={previewUrl}
          />
        ) : null}
      </main>
    </div>
  );
}
