"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SiteAccessLogout() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/site-access", { cache: "no-store" });
        const data = (await r.json()) as { gateEnabled?: boolean; ok?: boolean };
        if (!cancelled && data.gateEnabled && data.ok) setVisible(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/site-access", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={logout}
      className="shrink-0 text-xs font-medium text-zinc-500 underline-offset-2 hover:text-rose-600 hover:underline"
    >
      退出访问
    </button>
  );
}
