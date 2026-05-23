"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ProfileCard } from "./profile-card";
import type { MonitoredProfileSummary } from "@/types/profile-watch";

interface ProfileGridProps {
  profiles: MonitoredProfileSummary[];
  isLoading?: boolean;
}

function ProfileSkeleton() {
  return (
    <div className="liquid-panel flex flex-col gap-3 rounded-2xl border border-white/[0.08] p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-white/[0.08]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-28 rounded bg-white/[0.08]" />
          <Skeleton className="h-2.5 w-20 rounded bg-white/[0.06]" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full bg-white/[0.06]" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-2.5 w-20 rounded bg-white/[0.06]" />
        <Skeleton className="h-2.5 w-16 rounded bg-white/[0.06]" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-14 rounded-full bg-white/[0.06]" />
        <Skeleton className="h-2.5 w-16 rounded bg-white/[0.06]" />
      </div>
    </div>
  );
}

export function ProfileGrid({ profiles, isLoading }: ProfileGridProps) {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Carregando perfis"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <ProfileSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => (
        <ProfileCard key={profile.id} profile={profile} />
      ))}
    </div>
  );
}
