"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 拉取可绘制的位图（data URL 或经本站代理的 http(s)） */
async function fetchImageBlobFromDisplayUrl(url: string): Promise<Blob> {
  if (url.startsWith("data:image/")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("无法读取图片数据");
    return res.blob();
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
    return res.blob();
  }
  throw new Error("不支持的图片地址格式");
}

/** 将位图按 deg（0/90/180/270）顺时针旋转，输出 PNG */
async function rotateImageBlobToPng(blob: Blob, deg: number): Promise<Blob> {
  const d = ((deg % 360) + 360) % 360;
  if (d === 0) return blob;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) {
        reject(new Error("图片尺寸无效"));
        return;
      }
      const swap = d % 180 !== 0;
      const cw = swap ? h : w;
      const ch = swap ? w : h;
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法创建画布"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((d * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2);
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("导出失败"));
        },
        "image/png",
        1,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片加载失败"));
    };
    img.src = objectUrl;
  });
}
import {
  GENERATION_MODE_OPTIONS,
  getDualUploadKind,
  requiresTenSingleNails,
  type GenerationMode,
} from "@/lib/generation-modes";

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
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [resultLabels, setResultLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadBusyIndex, setDownloadBusyIndex] = useState<number | null>(
    null,
  );
  /** 每张产出图的顺时针旋转角（仅预览与下载；新结果生成时重置） */
  const [resultRotationDeg, setResultRotationDeg] = useState<number[]>([]);
  /** 下标 0–9 即合成第 1–10 位顺序，与 FormData append 顺序一致 */
  const [tenSlots, setTenSlots] = useState<TenSlotCell[]>(() => emptyTenSlots());

  useEffect(() => {
    setResultRotationDeg(resultUrls.map(() => 0));
  }, [resultUrls]);

  const dualKind = getDualUploadKind(mode);
  const tenMode = requiresTenSingleNails(mode);

  const downloadResult = useCallback(async (url: string, index: number, rotationDeg: number) => {
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
      const rot = ((rotationDeg % 360) + 360) % 360;

      if (rot === 0) {
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
      }

      const blobIn = await fetchImageBlobFromDisplayUrl(url);
      const out = await rotateImageBlobToPng(blobIn, rot);
      const objectUrl = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `美甲生成_${index + 1}_旋转${rot}度.png`;
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "下载失败，请稍后重试。");
    } finally {
      setDownloadBusyIndex(null);
    }
  }, []);

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
    setResultUrls([]);
    setResultLabels([]);
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError("美甲产品图请选择图片文件。");
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

  const onSecondFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      setError(null);
      setResultUrls([]);
      setResultLabels([]);
      if (!f) {
        setSecondFile(null);
        setSecondPreviewUrl(null);
        return;
      }
      if (!f.type.startsWith("image/")) {
        setError(
          dualKind === "accessory"
            ? "饰品参考图请选择图片文件。"
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
    [dualKind],
  );

  const onTenBatchFilesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.target.files ?? []);
      setError(null);
      setResultUrls([]);
      setResultLabels([]);
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
    [],
  );

  const onTenSlotFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const slotIndex = tenSlotPickIndexRef.current;
      tenSlotPickIndexRef.current = null;
      const f = e.target.files?.[0];
      e.target.value = "";
      setError(null);
      setResultUrls([]);
      setResultLabels([]);
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
    [],
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
    setResultUrls([]);
    setResultLabels([]);
    try {
      const body = new FormData();
      body.set("mode", mode);
      if (tenMode) {
        for (let i = 0; i < 10; i++) {
          const f = tenSlots[i]!.file;
          if (f) body.append("nail", f);
        }
      } else {
        body.set("image", file!);
        if (dualKind === "model" && secondFile) {
          body.set("modelImage", secondFile);
        }
        if (dualKind === "accessory" && secondFile) {
          body.set("accessoryImage", secondFile);
        }
      }
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
  }, [dualKind, file, secondFile, mode, tenMode, tenSlots]);

  const resultHeading =
    mode === "multi_angle"
      ? "产出（多角度 · 固定3张）"
      : mode === "packaging_mockup"
        ? "产出（包装 + 手握 · 2张）"
        : mode === "flat_to_3d_packaging"
          ? "产出（2D→3D 包装 · 固定4张）"
          : mode === "model_tryon"
            ? "产出（试戴效果图）"
            : mode === "accessory_tryon"
              ? "产出（手模 · 指甲+饰品试戴）"
              : mode === "ten_singles_grid"
                ? "产出（十枚单甲 · 一张合集）"
                : mode === "extract_ten_grid"
                  ? "产出（白底栅格 · 仅抠图）"
                  : mode === "complete_single_grid"
                    ? "产出（白底栅格 · 补全至10枚）"
                    : "产出";

  const gridClass =
    mode === "multi_angle"
      ? "grid grid-cols-1 gap-6 md:grid-cols-3"
      : mode === "packaging_mockup"
        ? "grid grid-cols-1 gap-6 md:grid-cols-2"
        : mode === "flat_to_3d_packaging"
          ? "grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
          : "grid grid-cols-1";

  const canSubmit =
    !loading &&
    (tenMode
      ? tenSlots.every((s) => s.file)
      : !!file && (!dualKind || !!secondFile));

  const secondSlotTitle =
    dualKind === "accessory"
      ? "点击选择饰品参考图（戒指等）"
      : "点击选择模特照片";
  const secondSlotHint =
    dualKind === "accessory"
      ? "可含多只戒指；成片会生成手模并同时戴上甲片与这些饰品"
      : "需清晰露出指甲区域";

  const singleUploadTitle =
    mode === "flat_to_3d_packaging"
      ? "点击选择 2D 包装平面稿"
      : mode === "extract_ten_grid"
        ? "点击选择含多枚甲片的照片"
        : mode === "complete_single_grid"
          ? "点击选择单枚或少量甲片照片"
          : "点击选择美甲照片";
  const singleUploadHint =
    mode === "flat_to_3d_packaging"
      ? "正面/背面展开、屏显效果图、刀版图截图均可"
      : mode === "extract_ten_grid"
        ? "托盘、卡纸、实拍平铺等；只抠图中已出现的甲片，不补全款式"
        : mode === "complete_single_grid"
          ? "先整图转 180° 再送模型；成品须每行甲根顶线齐平，指位大小符合客观比例"
          : "支持常见图片格式";

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14">
        <header className="space-y-2">
          <p className="text-xl font-semibold tracking-wide text-rose-600 sm:text-2xl">
            美甲商家专用
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            白底产品图、多角度、包装示意、2D 转 3D 包装、模特/手模饰品试戴
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
                <div className="grid w-full max-w-md grid-cols-5 gap-2">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-zinc-500">① 美甲产品图</span>
                  <UploadTile
                    title="点击选择产品 / 甲片款式图"
                    hint="平铺、卡纸、白底商品图均可"
                    previewUrl={previewUrl}
                    onPick={onPickFile}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-zinc-500">
                    {dualKind === "accessory" ? "② 饰品参考图（戒指等）" : "② 模特图"}
                  </span>
                  <UploadTile
                    title={secondSlotTitle}
                    hint={secondSlotHint}
                    previewUrl={secondPreviewUrl}
                    onPick={onPickSecond}
                  />
                </div>
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
                  {resultUrls.map((url, i) => {
                    const deg = resultRotationDeg[i] ?? 0;
                    return (
                      <figure
                        key={`${url.slice(0, 48)}-${i}`}
                        className="flex flex-col gap-2"
                      >
                        <figcaption className="text-center text-xs font-medium text-zinc-500">
                          {resultLabels[i] ?? `图 ${i + 1}`}
                        </figcaption>
                        <div className="flex w-full items-start justify-center gap-2">
                          <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white p-2 shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={resultLabels[i] ?? `结果 ${i + 1}`}
                              className="mx-auto max-h-[min(70vh,520px)] w-full object-contain transition-transform duration-200 ease-out"
                              style={{
                                transform: `rotate(${deg}deg)`,
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            title="顺时针旋转 90°（仅影响预览与下载）"
                            onClick={() => {
                              setResultRotationDeg((prev) => {
                                const next = [...prev];
                                while (next.length <= i) next.push(0);
                                next[i] = ((next[i] ?? 0) + 90) % 360;
                                return next;
                              });
                            }}
                            className="inline-flex h-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-900"
                          >
                            <span className="text-base leading-none" aria-hidden>
                              ↻
                            </span>
                            <span>旋转</span>
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={downloadBusyIndex === i}
                            onClick={() => {
                              void downloadResult(url, i, deg);
                            }}
                            className="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-900 disabled:cursor-wait disabled:opacity-60"
                          >
                            {downloadBusyIndex === i ? "下载中…" : "下载"}
                          </button>
                          {deg !== 0 ? (
                            <span className="text-xs text-zinc-500">将下载已旋转 {deg}°</span>
                          ) : null}
                        </div>
                      </figure>
                    );
                  })}
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
            disabled={!canSubmit}
            onClick={onExtract}
            className="inline-flex h-14 items-center justify-center rounded-xl bg-rose-600 text-base font-semibold text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {loading
              ? mode === "multi_angle"
                ? "正在依次生成 3 张多角度图…"
                : mode === "packaging_mockup"
                  ? "正在依次生成 2 张包装手握图…"
                  : mode === "flat_to_3d_packaging"
                    ? "正在依次生成 4 张 3D 包装效果图…"
                    : mode === "model_tryon"
                      ? "正在生成试戴图…"
                      : mode === "accessory_tryon"
                        ? "正在生成手模试戴广告图…"
                        : mode === "ten_singles_grid"
                          ? "正在合成十甲白底合集…"
                          : mode === "complete_single_grid"
                            ? "正在补全至 10 枚…"
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
