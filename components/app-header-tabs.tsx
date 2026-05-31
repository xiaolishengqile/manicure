"use client";

import Link from "next/link";

export type AppTabId = "generate" | "layer-editor";

const TABS: { id: AppTabId; label: string; href: string }[] = [
  { id: "generate", label: "AI 生成", href: "/" },
  // { id: "layer-editor", label: "图层编辑", href: "/layer-editor" },
];

export function AppHeaderTabs({ activeTab }: { activeTab: AppTabId }) {
  return (
    <nav
      className="flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-100/90 p-0.5"
      aria-label="主导航"
    >
      {TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-white text-rose-700 shadow-sm ring-1 ring-zinc-200/80"
                : "text-zinc-600 hover:bg-white/60 hover:text-zinc-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
