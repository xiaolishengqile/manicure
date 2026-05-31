"use client";

import { ImageModelSelect } from "@/components/image-model-select";
import { AppHeaderTabs, type AppTabId } from "@/components/app-header-tabs";
import { SiteAccessLogout } from "@/components/site-access-logout";

export function AppPageHeader({
  activeTab,
  imageModelChoice,
  onImageModelChange,
  fluxSize,
  onFluxSizeChange,
  showImageModel = true,
}: {
  activeTab: AppTabId;
  imageModelChoice?: string;
  onImageModelChange?: (v: string) => void;
  fluxSize?: string;
  onFluxSizeChange?: (v: string) => void;
  showImageModel?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="shrink-0 text-xl font-semibold tracking-wide text-rose-600 sm:text-2xl">
          美甲商家专用
        </h1>
        {showImageModel && imageModelChoice !== undefined && onImageModelChange ? (
          <ImageModelSelect
            value={imageModelChoice}
            onChange={onImageModelChange}
            fluxSize={fluxSize ?? "1024x1024"}
            onFluxSizeChange={onFluxSizeChange ?? (() => {})}
          />
        ) : null}
        <AppHeaderTabs activeTab={activeTab} />
      </div>
      <SiteAccessLogout />
    </header>
  );
}
