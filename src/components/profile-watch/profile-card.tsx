"use client";

import { useRouter } from "next/navigation";
import { UserCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileBadge } from "./profile-badge";
import { StatusPill } from "./status-pill";
import type { MonitoredProfileSummary } from "@/types/profile-watch";

interface ProfileCardProps {
  profile: MonitoredProfileSummary;
  previousFollowersCount?: number;
}

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

function formatLastScan(lastScanAt: string | null): string {
  if (!lastScanAt) return "Aguardando 1º scan";
  const diff = Date.now() - new Date(lastScanAt).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "Há menos de 1h";
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Há ${days}d`;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const router = useRouter();
  const snap = profile.latestSnapshot;

  return (
    <button
      type="button"
      onClick={() => router.push(`/profiles/${profile.id}`)}
      className={cn(
        "liquid-panel group relative flex w-full flex-col gap-3 rounded-2xl border border-white/[0.08] p-4 text-left",
        "transition-all duration-200 hover:border-white/[0.15] hover:bg-white/[0.04]",
        "min-h-[140px] touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff355d]/40",
      )}
    >
      {/* Header: avatar + handle + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
            {snap?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={snap.avatarUrl}
                alt={`@${profile.handle}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserCircle2 className="h-full w-full p-1.5 text-white/30" />
            )}
            {snap?.isVerified && (
              <span
                aria-label="Verificado"
                className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px] text-white"
              >
                ✓
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white/90">
              {profile.displayName ?? `@${profile.handle}`}
            </div>
            <div className="text-[11px] text-white/45">@{profile.handle}</div>
          </div>
        </div>

        <ProfileBadge source={profile.source} className="shrink-0" />
      </div>

      {/* Métricas */}
      {snap ? (
        <div className="flex items-center gap-4 text-xs text-white/60">
          <div>
            <span className="font-medium text-white/85">
              {formatFollowers(snap.followersCount)}
            </span>{" "}
            seguidores
          </div>
          <div>
            <span className="font-medium text-white/85">{snap.postsCount}</span> posts
          </div>
        </div>
      ) : (
        <div className="text-xs text-white/35 italic">Dados do 1º scan pendentes</div>
      )}

      {/* Footer: status + último scan */}
      <div className="flex items-center justify-between gap-2">
        <StatusPill
          status={profile.status}
          errorMessage={profile.lastErrorMessage}
        />
        <div className="flex items-center gap-1 text-[11px] text-white/35">
          <Clock className="h-3 w-3" />
          <span>{formatLastScan(profile.lastScanAt)}</span>
        </div>
      </div>
    </button>
  );
}
