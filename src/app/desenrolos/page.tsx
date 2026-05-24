"use client";

import { useEffect, useState, useDeferredValue, useMemo } from "react";
import Link from "next/link";
import {
  PlusIcon,
  MessageSquareIcon,
  SearchIcon,
  MapPinIcon,
  HeartIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ContactAvatar } from "@/components/contact-avatar";
import { useFlirtStore } from "@/store/use-flirt-store";
import type { ContactRecord } from "@/types/flirt";

function labelStatus(status: ContactRecord["status"]) {
  if (status === "hot lead") return "Hot lead";
  if (status === "cold") return "Esfriou";
  return "Ativa";
}

function statusDot(status: ContactRecord["status"]) {
  if (status === "hot lead") return "bg-rose-300";
  if (status === "cold") return "bg-slate-300";
  return "bg-emerald-300";
}

export default function DesenrolosListPage() {
  const { contacts, hasHydrated, bootstrap, isBootstrapping, bootstrapError } =
    useFlirtStore();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

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

  const desenrolos = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filtered = contacts.filter((c) => c.kind === "desenrolo");
    if (!q) return filtered;
    return filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.location ?? "").toLowerCase().includes(q) ||
        (c.metContext ?? "").toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [contacts, deferredQuery]);

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
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
          <SearchIcon className="h-4 w-4 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, lugar, tag..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>

        {/* Grid / estados */}
        {isLoading ? (
          <DesenroloGridSkeleton />
        ) : desenrolos.length === 0 ? (
          <EmptyState hasFilter={!!query.trim()} />
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
