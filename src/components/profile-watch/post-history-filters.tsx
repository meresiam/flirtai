"use client";

import { SearchIcon, EyeOffIcon, EyeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfilePostType } from "@/lib/profile-watch/types";

export type PostTypeFilter = "all" | ProfilePostType;

const TYPE_TABS: Array<{ key: PostTypeFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "image", label: "Fotos" },
  { key: "carousel", label: "Carrosséis" },
  { key: "reel", label: "Reels" },
  { key: "video", label: "Vídeos" },
];

interface PostHistoryFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeType: PostTypeFilter;
  onTypeChange: (type: PostTypeFilter) => void;
  includeDeleted: boolean;
  onIncludeDeletedChange: (v: boolean) => void;
  counts: Record<PostTypeFilter, number>;
  deletedCount: number;
}

export function PostHistoryFilters({
  searchValue,
  onSearchChange,
  activeType,
  onTypeChange,
  includeDeleted,
  onIncludeDeletedChange,
  counts,
  deletedCount,
}: PostHistoryFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar em captions…"
          aria-label="Buscar posts por caption"
          className={cn(
            "h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-9 pr-4",
            "text-sm text-white/85 placeholder:text-white/30",
            "transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06] focus:outline-none",
          )}
        />
      </div>

      {/* Type tabs + deleted toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-1 overflow-x-auto pb-0.5"
          role="tablist"
          aria-label="Filtrar posts por tipo"
        >
          {TYPE_TABS.map(({ key, label }) => {
            const count = counts[key] ?? 0;
            return (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={activeType === key}
                onClick={() => onTypeChange(key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150",
                  "min-h-[32px] touch-manipulation",
                  activeType === key
                    ? "bg-white/[0.1] text-white"
                    : "text-white/50 hover:bg-white/[0.05] hover:text-white/75",
                )}
              >
                {label}
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                      activeType === key
                        ? "bg-white/[0.15] text-white/80"
                        : "bg-white/[0.06] text-white/40",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {deletedCount > 0 && (
          <button
            type="button"
            onClick={() => onIncludeDeletedChange(!includeDeleted)}
            aria-pressed={includeDeleted}
            className={cn(
              "ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150",
              "min-h-[32px] border touch-manipulation",
              includeDeleted
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-white/[0.08] bg-white/[0.03] text-white/45 hover:border-white/15 hover:text-white/70",
            )}
          >
            {includeDeleted ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
            {includeDeleted ? "Ocultar deletados" : "Mostrar deletados"}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                includeDeleted ? "bg-red-500/20 text-red-200" : "bg-white/[0.06] text-white/45",
              )}
            >
              {deletedCount}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
