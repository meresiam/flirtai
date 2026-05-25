"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  PlusIcon,
  MessageSquareIcon,
  SearchIcon,
  MapPinIcon,
  HeartIcon,
  Loader2Icon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ContactAvatar } from "@/components/contact-avatar";
import { useFlirtStore } from "@/store/use-flirt-store";
import type { ContactRecord } from "@/types/flirt";

// W5 / M5 — debounce + min length pra search server-side.
// 250ms equilibra responsividade percebida com pressão no DB.
const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_MIN_CHARS = 2;

function labelStatus(status: ContactRecord["status"]) {
  if (status === "hot_lead") return "Hot lead";
  if (status === "cold") return "Esfriou";
  return "Ativa";
}

function statusDot(status: ContactRecord["status"]) {
  if (status === "hot_lead") return "bg-rose-300";
  if (status === "cold") return "bg-slate-300";
  return "bg-emerald-300";
}

export default function DesenrolosListPage() {
  const { contacts, hasHydrated, bootstrap, isBootstrapping, bootstrapError } =
    useFlirtStore();
  const [query, setQuery] = useState("");

  // W5 / M5 — quando query >= SEARCH_MIN_CHARS, a lista vem do servidor
  // (suporta name/handle/location/metContext/tag). Quando query vazia ou < min,
  // usa o cache local do Zustand (rápido, suficiente pra listar).
  const [serverResults, setServerResults] = useState<ContactRecord[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!useFlirtStore.persist.hasHydrated()) {
      void useFlirtStore.persist.rehydrate();
    }
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      void bootstrap();
    }
  }, [hasHydrated, bootstrap]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < SEARCH_MIN_CHARS) {
      // Cancela qualquer fetch em voo. Limpeza de state é feita derivando
      // `desenrolos` do cache local quando `hasActiveSearch` é false —
      // assim evitamos setState síncrono dentro do effect (react-hooks/set-state-in-effect).
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsSearching(true);
      setSearchError(null);

      const params = new URLSearchParams({ kind: "desenrolo", q: trimmed });
      fetch(`/api/contacts?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Não consegui buscar agora.");
          const data = (await res.json()) as { contacts: ContactRecord[] };
          return data.contacts;
        })
        .then((results) => {
          if (controller.signal.aborted) return;
          setServerResults(results);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setSearchError(
            cause instanceof Error ? cause.message : "Erro na busca.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const hasActiveSearch = query.trim().length >= SEARCH_MIN_CHARS;

  const desenrolos = useMemo(() => {
    if (hasActiveSearch && serverResults) {
      return serverResults.filter((c) => c.kind === "desenrolo");
    }
    return contacts.filter((c) => c.kind === "desenrolo");
  }, [contacts, hasActiveSearch, serverResults]);

  const isLoading = !hasHydrated || isBootstrapping;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#070913]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <nav className="flex items-center gap-1" aria-label="Navegação principal">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/50 transition hover:bg-white/[0.05] hover:text-white/80"
            >
              <MessageSquareIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </Link>
            <Link
              href="/desenrolos"
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-3 py-1.5 text-sm font-medium text-white/90"
              aria-current="page"
            >
              <HeartIcon className="h-4 w-4 text-[#ff355d]" />
              Desenrolos
            </Link>
            <Link
              href="/profiles"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/50 transition hover:bg-white/[0.05] hover:text-white/80"
            >
              <span className="hidden sm:inline">Perfis</span>
            </Link>
          </nav>

          <Link
            href="/desenrolos/new"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#ff355d] px-3 text-sm font-medium text-white transition hover:bg-[#ff355d]/90"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Novo desenrolo</span>
            <span className="sm:hidden">Novo</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white/90">Meus desenrolos</h1>
            <p className="mt-0.5 text-sm text-white/40">
              {desenrolos.length} perfil(is) salvo(s)
            </p>
          </div>
        </div>

        {bootstrapError ? (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            {bootstrapError}
          </div>
        ) : null}

        {/* Busca */}
        <div
          className={cn(
            "mb-5 flex items-center gap-2 rounded-2xl border bg-white/[0.04] px-4 py-3 transition-colors",
            searchError
              ? "border-rose-500/30"
              : isSearching
                ? "border-[#ff355d]/30"
                : "border-white/[0.07]",
          )}
        >
          {isSearching ? (
            <Loader2Icon
              aria-label="Buscando..."
              className="h-4 w-4 animate-spin text-[#ff355d]"
            />
          ) : (
            <SearchIcon className="h-4 w-4 text-white/35" aria-hidden="true" />
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, lugar, tag..."
            aria-label="Buscar desenrolos"
            aria-busy={isSearching}
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
          {hasActiveSearch && !isSearching ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="rounded-full px-2 py-0.5 text-xs text-white/40 transition hover:text-white/80"
            >
              Limpar
            </button>
          ) : null}
        </div>

        {searchError ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            {searchError}
          </div>
        ) : null}

        {/* Grid / estados */}
        {isLoading ? (
          <DesenroloGridSkeleton />
        ) : desenrolos.length === 0 ? (
          <EmptyState hasFilter={hasActiveSearch} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {desenrolos.map((c) => (
              <DesenroloCard key={c.id} contact={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function DesenroloCard({ contact }: { contact: ContactRecord }) {
  return (
    <Link
      href={`/desenrolos/${contact.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-[#ff355d]/30 hover:bg-white/[0.05]"
    >
      <div className="flex items-start gap-3">
        <ContactAvatar
          name={contact.name}
          src={contact.avatar}
          className="h-16 w-16"
          sizes="64px"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-base font-semibold text-white">
              {contact.name}
            </h3>
            {contact.padrao !== null ? (
              <span
                className="inline-flex shrink-0 items-baseline gap-1 rounded-md bg-[#ff355d]/15 px-2 py-0.5"
                title={`Padrão: ${contact.padrao.toFixed(1)}`}
              >
                <span className="text-[9px] uppercase tracking-wider text-[#ff8a9e]/70">
                  Padrão
                </span>
                <span className="font-mono text-sm font-semibold text-[#ff8a9e] tabular-nums">
                  {contact.padrao.toFixed(1)}
                </span>
              </span>
            ) : null}
          </div>
          {contact.location || contact.metContext ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-white/45">
              <MapPinIcon className="h-3 w-3" />
              <span className="truncate">
                {[contact.location, contact.metContext].filter(Boolean).join(" · ")}
              </span>
            </p>
          ) : null}
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/45">
            <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(contact.status))} />
            <span>{labelStatus(contact.status)}</span>
            <span className="text-white/25">·</span>
            <span>IA lê: {contact.attractionLevel}</span>
          </p>
        </div>
      </div>

      {contact.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {contact.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/55"
            >
              {tag}
            </span>
          ))}
          {contact.tags.length > 4 ? (
            <span className="text-[10px] text-white/35">
              +{contact.tags.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

function DesenroloGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]"
        />
      ))}
    </div>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  if (hasFilter) {
    return (
      <div className="py-12 text-center text-sm text-white/40">
        Nenhum desenrolo bate com a busca.
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#ff355d]/15">
        <HeartIcon className="h-6 w-6 text-[#ff355d]" />
      </div>
      <h3 className="text-base font-semibold text-white/90">
        Nenhum desenrolo cadastrado
      </h3>
      <p className="mt-1.5 text-sm text-white/45">
        Cria o primeiro perfil pra começar a organizar.
      </p>
      <Link
        href="/desenrolos/new"
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#ff355d] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#ff355d]/90"
      >
        <PlusIcon className="h-4 w-4" />
        Adicionar desenrolo
      </Link>
    </div>
  );
}
