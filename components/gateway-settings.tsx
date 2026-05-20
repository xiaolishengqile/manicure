"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_IMAGE_GATEWAY_PROVIDER,
  IMAGE_GATEWAY_PROVIDERS,
  LS_GATEWAY_API_KEY,
  LS_GATEWAY_PROVIDER,
  type ImageGatewayProviderId,
  isImageGatewayProviderId,
  providerMeta,
} from "@/lib/image-gateway-providers";

export function GatewaySettings({
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
}: {
  provider: ImageGatewayProviderId;
  apiKey: string;
  onProviderChange: (id: ImageGatewayProviderId) => void;
  onApiKeyChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = providerMeta(provider);

  const persistProvider = useCallback(
    (id: ImageGatewayProviderId) => {
      onProviderChange(id);
      try {
        localStorage.setItem(LS_GATEWAY_PROVIDER, id);
      } catch {
        /* private mode */
      }
    },
    [onProviderChange],
  );

  const persistApiKey = useCallback(
    (key: string) => {
      onApiKeyChange(key);
      try {
        if (key.trim()) {
          localStorage.setItem(LS_GATEWAY_API_KEY, key);
        } else {
          localStorage.removeItem(LS_GATEWAY_API_KEY);
        }
      } catch {
        /* ignore */
      }
    },
    [onApiKeyChange],
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-700">中转站</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            当前：
            <span className="font-medium text-zinc-700">{meta.shortLabel}</span>
            {apiKey.trim() ? (
              <span className="text-emerald-600"> · 已填 Key</span>
            ) : (
              <span> · 未填 Key（将尝试服务器环境变量）</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
        >
          {open ? "收起" : "设置"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-zinc-100 pt-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">选择中转站</span>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="选择中转站"
            >
              {IMAGE_GATEWAY_PROVIDERS.map((p) => {
                const active = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => persistProvider(p.id)}
                    className={
                      active
                        ? "rounded-lg border border-rose-500 bg-rose-50 px-3 py-2 text-left text-xs font-semibold text-rose-800 shadow-sm"
                        : "rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-white"
                    }
                  >
                    <span className="block">{p.label}</span>
                    <span className="mt-0.5 block font-normal text-[10px] text-zinc-500">
                      {p.baseUrl}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-600">API Key</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => persistApiKey(e.target.value)}
              placeholder="sk-…"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-800 outline-none ring-rose-500 placeholder:text-zinc-400 focus:border-rose-400 focus:ring-1"
            />
            <span className="text-[11px] leading-snug text-zinc-500">
              {meta.keyHint}。密钥仅保存在本机浏览器，随请求发给本站 API
              用于调用图像接口，不会写入服务器磁盘。
            </span>
          </label>
        </div>
      ) : null}
    </section>
  );
}

/** 从 localStorage 恢复中转站与 Key（仅客户端） */
export function useGatewaySettingsFromStorage(): {
  provider: ImageGatewayProviderId;
  apiKey: string;
  setProvider: (id: ImageGatewayProviderId) => void;
  setApiKey: (key: string) => void;
  hydrated: boolean;
} {
  const [provider, setProvider] = useState<ImageGatewayProviderId>(
    DEFAULT_IMAGE_GATEWAY_PROVIDER,
  );
  const [apiKey, setApiKey] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedProvider = localStorage.getItem(LS_GATEWAY_PROVIDER);
      if (isImageGatewayProviderId(storedProvider)) {
        setProvider(storedProvider);
      }
      const storedKey = localStorage.getItem(LS_GATEWAY_API_KEY);
      if (storedKey) setApiKey(storedKey);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  return { provider, apiKey, setProvider, setApiKey, hydrated };
}
