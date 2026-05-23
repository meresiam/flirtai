"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProfileWatchStatus } from "@/lib/profile-watch/types";

interface StatusPillProps {
  status: ProfileWatchStatus;
  errorMessage?: string | null;
  className?: string;
}

const STATUS_CONFIG: Record<
  ProfileWatchStatus,
  { label: string; dot: string; className: string }
> = {
  active: {
    label: "Ativo",
    dot: "bg-emerald-400",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  paused: {
    label: "Pausado",
    dot: "bg-yellow-400",
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  error: {
    label: "Erro",
    dot: "bg-red-400",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

export function StatusPill({ status, errorMessage, className }: StatusPillProps) {
  const config = STATUS_CONFIG[status];

  const pill = (
    <span
      className={cn(
        "inline-flex cursor-default items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]",
        config.className,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );

  if (status === "error" && errorMessage) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={pill} />
          <TooltipContent
            side="top"
            className="max-w-[220px] border-red-500/20 bg-black/90 text-red-300 text-xs"
          >
            {errorMessage}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return pill;
}
