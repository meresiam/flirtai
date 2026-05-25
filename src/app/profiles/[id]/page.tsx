"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageSquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileHeader } from "@/components/profile-watch/profile-header";
import { MetricDeltaRow } from "@/components/profile-watch/metric-delta-row";
import { ReportTimeline } from "@/components/profile-watch/report-timeline";
import { PostHistoryTable } from "@/components/profile-watch/post-history-table";
import { PostHistoryCards } from "@/components/profile-watch/post-history-cards";
import { PostHistoryFilters, type PostTypeFilter } from "@/components/profile-watch/post-history-filters";
import { PostDetailDialog } from "@/components/profile-watch/post-detail-dialog";
import { CoachingPanel } from "@/components/profile-watch/coaching-panel";
import { ConsentDialog } from "@/components/profile-watch/consent-dialog";
import { useProfilesStore } from "@/store/use-profiles-store";
import type { ProfileDetailResponse, ProfilePostSummary } from "@/types/profile-watch";

interface ConsentStaleError {
  error: string;
  code: "consent_outdated";
  currentVersion: string;
  acceptedVersion: string;
  reacceptUrl: string;
}

const REFRESH_ON_FOCUS_THRESHOLD_MS = 30_000;

// Toast mínimo inline (sonner não está instalado — usa estado local)
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-xl",
        type === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/30 bg-red-500/10 text-red-300",
      )}
    >
      {message}
    </div>
  );
}

export default function ProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const { patchProfile, removeProfile } = useProfilesStore();

  const [detail, setDetail] = useState<ProfileDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Dialog de reaceite de consent
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [isReaccepting, setIsReaccepting] = useState(false);

  // Filtros de posts
  const [postSearch, setPostSearch] = useState("");
  const deferredPostSearch = useDeferredValue(postSearch);
  const [postType, setPostType] = useState<PostTypeFilter>("all");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // Dialog de detalhe
  const [selectedPost, setSelectedPost] = useState<ProfilePostSummary | null>(null);

  // Refresh on-focus
  const lastFetchedAtRef = useRef<number>(0);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const loadDetail = useCallback(
    async (mode: "initial" | "silent") => {
      if (!id) return;
      if (mode === "initial") {
        setIsLoading(true);
        setFetchError(null);
      }
      try {
        const r = await fetch(`/api/profiles/${id}`, { cache: "no-store" });
        if (r.status === 401) { window.location.href = "/login"; return; }
        if (r.status === 404) {
          if (mode === "initial") setFetchError("Perfil não encontrado.");
          return;
        }
        if (!r.ok) throw new Error("Erro ao carregar perfil.");
        const data = (await r.json()) as ProfileDetailResponse;
        setDetail(data);
        lastFetchedAtRef.current = Date.now();
      } catch (e) {
        if (mode === "initial") {
          setFetchError(e instanceof Error ? e.message : "Erro ao carregar.");
        }
      } finally {
        if (mode === "initial") setIsLoading(false);
      }
    },
    [id],
  );

  // Fetch inicial do detalhe
  useEffect(() => {
    if (!id) return;
    void loadDetail("initial");
  }, [id, loadDetail]);

  // Refresh on-focus: ao voltar pra aba depois de >30s, refetch silencioso
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      const elapsed = Date.now() - lastFetchedAtRef.current;
      if (lastFetchedAtRef.current === 0 || elapsed < REFRESH_ON_FOCUS_THRESHOLD_MS) return;
      void loadDetail("silent");
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadDetail]);

  // Abre o dialog de reaceite se ?reaccept=consent estiver na URL
  useEffect(() => {
    if (searchParams.get("reaccept") === "consent") {
      setConsentDialogOpen(true);
    }
  }, [searchParams]);

  // Intercepta resposta 409 com code="consent_outdated" e abre o dialog de reaceite.
  // Retorna true se foi um 409 de consent (caller deve abortar a ação).
  async function handleConsentOutdated(res: Response): Promise<boolean> {
    if (res.status !== 409) return false;
    try {
      const body = (await res.json()) as Partial<ConsentStaleError>;
      if (body.code === "consent_outdated") {
        setConsentDialogOpen(true);
        return true;
      }
    } catch {
      // não era um JSON de consent — deixa o caller lidar
    }
    return false;
  }

  // Após o reaceite bem-sucedido: fecha dialog, limpa ?reaccept da URL, refetch silencioso.
  async function handleConsentAccept(consentVersion: string) {
    if (!id || isReaccepting) return;
    setIsReaccepting(true);
    try {
      const res = await fetch(`/api/profiles/${id}/consent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentVersion }),
      });
      if (!res.ok) {
        showToast("Não foi possível registrar o reaceite. Tente novamente.", "error");
        return;
      }
      setConsentDialogOpen(false);
      // Remove ?reaccept da URL sem recarregar a página
      const url = new URL(window.location.href);
      url.searchParams.delete("reaccept");
      router.replace(url.pathname + (url.search !== "?" ? url.search : ""));
      showToast("Termo de uso aceito. Pode continuar monitorando.", "success");
      void loadDetail("silent");
    } finally {
      setIsReaccepting(false);
    }
  }

  // Ações
  async function handlePauseToggle() {
    if (!detail) return;
    const newStatus = detail.profile.status === "paused" ? "active" : "paused";
    const res = await fetch(`/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (await handleConsentOutdated(res)) return;
    if (!res.ok) {
      showToast("Não foi possível alterar o status.", "error");
      return;
    }
    setDetail((prev) =>
      prev ? { ...prev, profile: { ...prev.profile, status: newStatus } } : prev,
    );
    patchProfile(id, { status: newStatus });
    showToast(newStatus === "paused" ? "Monitoramento pausado." : "Monitoramento retomado.", "success");
  }

  async function handleDelete() {
    const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Não foi possível remover o perfil.", "error");
      return;
    }
    removeProfile(id);
    router.push("/profiles");
  }

  async function handleScanNow() {
    const res = await fetch(`/api/profiles/${id}/scan`, { method: "POST" });
    if (res.status === 429) {
      showToast("Limite de scans atingido (10/h). Aguarde um pouco.", "error");
      return;
    }
    if (await handleConsentOutdated(res)) return;
    if (!res.ok) {
      showToast("Não foi possível iniciar o scan.", "error");
      return;
    }
    showToast("Scan iniciado. Os dados serão atualizados em breve.", "success");
    setTimeout(() => { void loadDetail("silent"); }, 2000);
  }

  // Aplica filtros ao histórico de posts
  const allPosts = useMemo(() => detail?.posts ?? [], [detail?.posts]);

  const postCountsByType = useMemo<Record<PostTypeFilter, number>>(() => {
    const base: Record<PostTypeFilter, number> = {
      all: 0,
      image: 0,
      carousel: 0,
      reel: 0,
      video: 0,
    };
    const visiblePool = includeDeleted ? allPosts : allPosts.filter((p) => !p.isDeleted);
    base.all = visiblePool.length;
    for (const p of visiblePool) {
      if (p.mediaType in base) base[p.mediaType as PostTypeFilter] += 1;
    }
    return base;
  }, [allPosts, includeDeleted]);

  const deletedCount = useMemo(
    () => allPosts.filter((p) => p.isDeleted).length,
    [allPosts],
  );

  const filteredPosts = useMemo(() => {
    let result = allPosts;
    if (!includeDeleted) result = result.filter((p) => !p.isDeleted);
    if (postType !== "all") result = result.filter((p) => p.mediaType === postType);
    const q = deferredPostSearch.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => (p.caption ?? "").toLowerCase().includes(q));
    }
    return result;
  }, [allPosts, includeDeleted, postType, deferredPostSearch]);

  const showPostFilters = !isLoading && allPosts.length > 0;

  // Monta métricas para o MetricDeltaRow
  function buildMetrics() {
    const snap = detail?.profile.latestSnapshot;
    if (!snap) return [];

    // Pega o relatório mais recente para calcular deltas
    const lastReport = detail?.reports[0];

    return [
      {
        label: "Seguidores",
        value: snap.followersCount,
        delta: lastReport?.followersDelta,
      },
      {
        label: "Posts",
        value: snap.postsCount,
        delta: lastReport ? lastReport.newPostsCount - lastReport.deletedPostsCount : undefined,
      },
      ...(lastReport?.engagementAvg != null
        ? [
            {
              label: "Engajamento",
              value: lastReport.engagementAvg.toFixed(1),
              suffix: "%",
            },
          ]
        : []),
    ];
  }

  if (!isLoading && fetchError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-sm text-red-400">{fetchError}</p>
        <Link
          href="/profiles"
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Voltar para perfis
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#070913]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
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
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/[0.05] hover:text-white/90"
            >
              Perfis
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Header do perfil */}
        {isLoading || !detail ? (
          <div className="flex flex-col gap-4">
            {/* Skeleton header */}
            <div className="h-3 w-28 animate-pulse rounded bg-white/[0.07]" />
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-full bg-white/[0.08]" />
              <div className="flex flex-col gap-2">
                <div className="h-5 w-40 animate-pulse rounded bg-white/[0.08]" />
                <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
              </div>
            </div>
          </div>
        ) : (
          <ProfileHeader
            profile={detail.profile}
            onPauseToggle={handlePauseToggle}
            onDelete={handleDelete}
            onScanNow={handleScanNow}
          />
        )}

        {/* Métricas */}
        <section className="mt-6" aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="mb-3 text-xs uppercase tracking-[0.14em] text-white/35">
            Métricas atuais
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/[0.07] p-3">
                  <div className="h-2 w-12 animate-pulse rounded bg-white/[0.07] mb-2" />
                  <div className="h-5 w-20 animate-pulse rounded bg-white/[0.08]" />
                </div>
              ))}
            </div>
          ) : (
            <MetricDeltaRow metrics={buildMetrics()} />
          )}
        </section>

        {/* Relatórios */}
        <section className="mt-8" aria-labelledby="reports-heading">
          <h2 id="reports-heading" className="mb-3 text-xs uppercase tracking-[0.14em] text-white/35">
            Relatórios recentes
          </h2>
          <ReportTimeline
            reports={detail?.reports ?? []}
            isLoading={isLoading}
          />
        </section>

        {/* Histórico de posts — tabela no desktop, cards no mobile */}
        <section className="mt-8" aria-labelledby="posts-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="posts-heading" className="text-xs uppercase tracking-[0.14em] text-white/35">
              Posts detectados
            </h2>
            {showPostFilters && filteredPosts.length !== allPosts.length && (
              <span className="text-[10px] tabular-nums text-white/35">
                {filteredPosts.length} de {allPosts.length}
              </span>
            )}
          </div>

          {showPostFilters && (
            <div className="mb-4">
              <PostHistoryFilters
                searchValue={postSearch}
                onSearchChange={setPostSearch}
                activeType={postType}
                onTypeChange={setPostType}
                includeDeleted={includeDeleted}
                onIncludeDeletedChange={setIncludeDeleted}
                counts={postCountsByType}
                deletedCount={deletedCount}
              />
            </div>
          )}

          {showPostFilters && filteredPosts.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">
              Nenhum post bate com esses filtros.
            </p>
          ) : (
            <>
              {/* Mobile (<md): cards */}
              <div className="md:hidden">
                <PostHistoryCards
                  posts={filteredPosts}
                  isLoading={isLoading}
                  onPostClick={setSelectedPost}
                />
              </div>

              {/* Desktop (>=md): tabela */}
              <div className="hidden md:block">
                <PostHistoryTable
                  posts={filteredPosts}
                  isLoading={isLoading}
                  onPostClick={setSelectedPost}
                />
              </div>
            </>
          )}
        </section>

        {/* Coaching panel — só source=self (dead code no MVP) */}
        {detail?.profile.source === "self" && (
          <section className="mt-8" aria-labelledby="coaching-heading">
            <h2 id="coaching-heading" className="mb-3 text-xs uppercase tracking-[0.14em] text-white/35">
              Self-Coach IA
            </h2>
            <CoachingPanel />
          </section>
        )}
      </main>

      {/* Dialog de detalhe do post */}
      <PostDetailDialog
        post={selectedPost}
        open={selectedPost !== null}
        onClose={() => setSelectedPost(null)}
      />

      {/* Dialog de reaceite de consent */}
      <ConsentDialog
        open={consentDialogOpen}
        mode="reaccept"
        isSubmitting={isReaccepting}
        onClose={() => (isReaccepting ? null : setConsentDialogOpen(false))}
        onAccept={handleConsentAccept}
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
