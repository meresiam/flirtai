"use client";

import { cn } from "@/lib/utils";
import type { ProfileSource } from "@/lib/profile-watch/types";

interface ProfileBadgeProps {
  source: ProfileSource;
  className?: string;
}

const SOURCE_CONFIG: Record<
  ProfileSource,
  { label: string; className: string }
> = {
  competitor: {
    label: "Concorrente",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  },
  influencer: {
    label: "Influencer",
    className: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  },
  self: {
    label: "Meu perfil",
    className: "bg-[#ff355d]/15 text-[#ff7a66] border-[#ff355d]/25",
  },
};

export function ProfileBadge({ source, className }: ProfileBadgeProps) {
  const config = SOURCE_CONFIG[source];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
