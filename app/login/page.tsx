"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gateChecked, setGateChecked] = useState(false);
  const [noGate, setNoGate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/site-access", { cache: "no-store" });
        const data = (await r.json()) as {
          gateEnabled?: boolean;
          ok?: boolean;
        };
        if (cancelled) return;
        if (!data.gateEnabled) {
          setNoGate(true);
          router.replace("/");
          return;
        }
        if (data.ok) {
          router.replace(from.startsWith("/") ? from : "/");
          return;
        }
      } catch {
        if (!cancelled) setError("无法校验访问配置，请稍后重试");
      } finally {
        if (!cancelled) setGateChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/auth/site-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(data.error || "登录失败");
        return;
      }
      router.replace(from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }

  if (!gateChecked && !noGate) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-600 shadow-sm">
        正在检查访问配置…
      </div>
    );
  }

  if (noGate) {
    return null;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm space-y-5 rounded-xl border border-zinc-200 bg-white px-6 py-8 shadow-sm"
    >
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-zinc-900">访问验证</h1>
        <p className="text-sm text-zinc-600">
          请输入部署环境变量中配置的访问口令（仅团队成员知晓）。
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-zinc-700">口令</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-rose-200 focus:border-rose-400 focus:ring-2"
          placeholder="访问口令"
          required
        />
      </label>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-rose-600 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
      >
        {loading ? "验证中…" : "进入"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-16">
      <Suspense
        fallback={
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-600 shadow-sm">
            加载中…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
