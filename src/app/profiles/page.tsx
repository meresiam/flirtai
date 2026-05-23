"use client";

import { useEffect, useDeferredValue, useState } from "react";
import Link from "next/link";
import { PlusIcon, MessageSquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileGrid } from "@/components/profile-watch/profile-grid";
import { ProfileFilters } from "@/components/profile-watch/profile-filters";
import { ProfileEmptyState } from "@/components/profile-watch/profile-empty-state";
import { useProfilesStore } from "@/store/use-profiles-store";
import type { MonitoredProfileSummary } from "@/types/profile-watch";

type FilterTab = "all" | "competitor" | "influencer" | "self";

function filterProfiles(
  profiles: MonitoredProfileSummary[],
  tab: FilterTab,
  query: string,
): MonitoredProfileSummary[] {
  let result = profiles;

  if (tab !== "all") {
    result = result.filter((p) => p.source === tab);
  }

  const q = query.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (p) =>
        p.handle.toLowerCase().includes(q) ||
        (p.displayName ?? "").toLowerCase().includes(q),
    );
  }

  return result;
}

export default function ProfileListPage() {
  const { profiles, limits, hasHydrated, isBootstrapping, bootstrapError, bootstrap } =
    useProfilesStore();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue);

  // Bootstrap ao montar
  useEffect(() => {
    if (!useProfilesStore.persist.hasHydrated()) {
      void useProfilesStore.persist.rehydrate();
    }
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      void bootstrap();
    }
  }, [hasHydrated, bootstrap]);

  const isLoading = !hasHydrated || isBootstrapping;

  const filteredProfiles = filterProfiles(profiles, activeTab, deferredSearch);

  const counts: Record<FilterTab, number> = {
    all: profiles.length,
    competitor: profiles.filter((p) => p.source === "competitor").length,
    influencer: profiles.filter((p) => p.source === "influencer").length,
    self: profiles.filter((p) => p.source === "self").length,
  };

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#070913]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Nav links */}
          <nav className="flex items-center gap-1" aria-label="Navegação principal">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/50 transition hover:bg-white/[0.05] hover:text-white/80"
            >
              <MessageSquareIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </Link>
            <Link
              href="/profiles"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/90 bg-white/[0.07]"
              aria-current="page"
            >
              Perfis
            </Link>
          </nav>

          {/* CTA principal (H8 — 1 por página) */}
          <Link
            href={limits.currentCount >= limits.perUser ? "#" : "/profiles/new"}
            aria-disabled={limits.currentCount >= limits.perUser}
            className={cn(
              "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white transition",
              limits.currentCount >= limits.perUser
                ? "pointer-events-none bg-[#ff355d]/40 opacity-50"
                : "bg-[#ff355d] hover:bg-[#ff355d]/90",
            )}
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Monitorar perfil</span>
            <span className="sm:hidden">Novo</span>
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Título + limite */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white/90">
              Perfis monitorados
            </h1>
            <p className="mt-0.5 text-sm text-white/40">
              {limits.currentCount} de {limits.perUser} perfis ativos
            </p>
          </div>
        </div>

        {/* Erro de bootstrap */}
        {bootstrapError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            {bootstrapError}
          </div>
        )}

        {/* Filtros */}
        {(isLoading || profiles.length > 0) && (
          <div className="mb-5">
            <ProfileFilters
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              counts={counts}
            />
          </div>
        )}

        {/* Grid / Empty state */}
        {!isLoading && profiles.length === 0 ? (
          <ProfileEmptyState />
        ) : !isLoading && filteredProfiles.length === 0 ? (
          <div className="py-10 text-center text-sm text-white/40">
            Nenhum perfil encontrado com esses filtros
          </div>
        ) : (
          <ProfileGrid profiles={filteredProfiles} isLoading={isLoading} />
        )}
      </main>
    </div>
  );
}
