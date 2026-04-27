"use client";

import { useCallback, useRef, useState } from "react";
import {
  GENERATION_MODE_OPTIONS,
  type GenerationMode,
} from "@/lib/generation-modes";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>("complete_grid");
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [resultLabels, setResultLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setError(null);
    setResultUrls([]);
    setResultLabels([]);
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError("请选择图片文件。");
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }, []);

  const onExtract = useCallback(async () => {
    if (!file) {
      setError("请先选择一张美甲照片。");
      return;
    }
    setLoading(true);
    setError(null);
    setResultUrls([]);
    setResultLabels([]);
    try {
      const body = new FormData();
      body.set("image", file);
      body.set("mode", mode);
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
  }, [file, mode]);

  const modeMeta = GENERATION_MODE_OPTIONS.find((o) => o.value === mode);
  const resultHeading =
    mode === "multi_angle"
      ? "产出（多角度 · 固定3张）"
      : mode === "packaging_mockup"
        ? "产出（包装 + 手握 · 2张）"
        : "产出（白底栅格）";

  const gridClass =
    mode === "multi_angle"
      ? "grid grid-cols-1 gap-6 md:grid-cols-3"
      : mode === "packaging_mockup"
        ? "grid grid-cols-1 gap-6 md:grid-cols-2"
        : "grid grid-cols-1";

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-rose-600">
            美甲白底图
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            从实拍生成白底产品图、多角度图或包装手握示意
          </h1>
          <p className="text-base leading-relaxed text-zinc-600">
            上传「投喂图片」，先选择生成模式，再点主按钮。请求走你配置的中转站（OpenAI 兼容{" "}
            <span className="font-mono text-sm">/v1/images/edits</span>
            ）。多角度与包装模式会<strong>连续调用多次</strong>接口，耗时更长。请在{" "}
            <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm">.env.local</code>{" "}
            中配置 <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm">OPENAI_API_KEY</code>{" "}
            与 <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm">OPENAI_BASE_URL</code>。
          </p>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />

        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <label htmlFor="mode" className="text-sm font-semibold text-zinc-700">
            生成模式
          </label>
          <select
            id="mode"
            value={mode}
            onChange={(e) =>
              setMode(e.target.value as GenerationMode)
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-rose-500 focus:border-rose-500 focus:ring-2"
          >
            {GENERATION_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {modeMeta ? (
            <p className="text-sm leading-relaxed text-zinc-500">{modeMeta.description}</p>
          ) : null}
        </div>

        <section className="grid gap-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-500">投喂图片</h2>
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
                  <span className="text-base font-medium text-zinc-800">点击选择美甲照片</span>
                  <span className="text-zinc-500">支持常见图片格式</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-500">{resultHeading}</h2>
            <div className="min-h-[200px] rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
              {resultUrls.length ? (
                <div className={gridClass}>
                  {resultUrls.map((url, i) => (
                    <figure key={`${url.slice(0, 48)}-${i}`} className="flex flex-col gap-2">
                      <figcaption className="text-center text-xs font-medium text-zinc-500">
                        {resultLabels[i] ?? `图 ${i + 1}`}
                      </figcaption>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={resultLabels[i] ?? `结果 ${i + 1}`}
                        className="w-full rounded-lg border border-zinc-200 bg-white object-contain shadow-sm"
                      />
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
        </section>

        <div className="flex flex-col items-stretch gap-4">
          <button
            type="button"
            disabled={loading || !file}
            onClick={onExtract}
            className="inline-flex h-14 items-center justify-center rounded-xl bg-rose-600 text-base font-semibold text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {loading
              ? mode === "multi_angle"
                ? "正在依次生成 3 张多角度图…"
                : mode === "packaging_mockup"
                  ? "正在依次生成 2 张包装手握图…"
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
