"use client";

import { LoaderIcon } from "lucide-react";

import { EncounterCard } from "@/components/encounter/encounter-card";
import type { EncounterRecord } from "@/types/flirt";

interface EncounterTimelineProps {
  encounters: EncounterRecord[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
}

export function EncounterTimeline({
  encounters,
  loading,
  loadingMore = false,
  hasMore = false,
  error = null,
  onLoadMore,
}: EncounterTimelineProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-6 text-sm text-white/55">
        <LoaderIcon className="h-4 w-4 animate-spin" />
        Carregando encontros...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 px-5 py-4 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (encounters.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-5 py-6 text-sm text-white/55">
        Nenhum encontro registrado ainda. Use o botão{" "}
        <strong className="text-white/80">+ Como foi?</strong> depois de um rolê pra
        guardar o relato e atualizar o perfil dela.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {encounters.map((encounter) => (
        <EncounterCard key={encounter.id} encounter={encounter} />
      ))}
      {hasMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                Carregando...
              </>
            ) : (
              "Carregar mais"
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
