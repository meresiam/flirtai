"use client";

import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FilterTab = "all" | "competitor" | "influencer" | "self";

interface ProfileFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  counts: Record<FilterTab, number>;
}

const TABS: Array<{ key: FilterTab; label: string; disabled?: boolean }> = [
  { key: "all", label: "Todos" },
  { key: "competitor", label: "Concorrentes" },
  { key: "influencer", label: "Influencers" },
  { key: "self", label: "Meu perfil", disabled: true },
];

export function ProfileFilters({
  searchValue,
  onSearchChange,
  activeTab,
  onTabChange,
  counts,
}: ProfileFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por @handle..."
          aria-label="Buscar perfis monitorados"
          className={cn(
            "h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-9 pr-4",
            "text-sm text-white/85 placeholder:text-white/30",
            "transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06] focus:outline-none",
          )}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5" role="tablist">
        <TooltipProvider>
          {TABS.map(({ key, label, disabled }) => {
            const count = counts[key];
            const tabButton = (
              <button
                key={key}
                role="tab"
                type="button"
                disabled={disabled}
                aria-selected={activeTab === key}
                aria-disabled={disabled}
                onClick={() => !disabled && onTabChange(key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                  "min-h-[36px] touch-manipulation",
                  activeTab === key
                    ? "bg-white/[0.1] text-white"
                    : "text-white/50 hover:bg-white/[0.05] hover:text-white/75",
                  disabled && "cursor-not-allowed opacity-40",
                )}
              >
                {label}
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                      activeTab === key
                        ? "bg-white/[0.15] text-white/80"
                        : "bg-white/[0.06] text-white/40",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );

            if (disabled) {
              return (
                <Tooltip key={key}>
                  <TooltipTrigger render={tabButton} />
                  <TooltipContent
                    side="bottom"
                    className="border-white/10 bg-black/90 text-white/70 text-xs"
                  >
                    Em breve — Wave 4
                  </TooltipContent>
                </Tooltip>
              );
            }

            return tabButton;
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
