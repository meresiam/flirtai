"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckIcon,
  KeyRoundIcon,
  LoaderIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
} from "lucide-react";

import type { AdminUserRow } from "@/app/api/admin/users/route";

// Painel do admin: aprovação de cadastros + monitoramento de uso por usuário.
// Acesso controlado por ADMIN_EMAILS (server-side, requireAdmin).
export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/");
        return;
      }
      if (!response.ok) throw new Error("Não consegui carregar os usuários.");
      const data = (await response.json()) as { users: AdminUserRow[] };
      setUsers(data.users);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(userId: string, action: "approve" | "revoke") {
    setActingOn(userId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Ação falhou.");
      }
      const { user } = (await response.json()) as {
        user: { id: string; approvedAt: string | null };
      };
      setUsers((current) =>
        current
          ? current.map((row) =>
              row.id === user.id ? { ...row, approvedAt: user.approvedAt } : row,
            )
          : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro na ação.");
    } finally {
      setActingOn(null);
    }
  }

  const pending = (users ?? []).filter((user) => !user.approvedAt && !user.isAdmin);
  const totalCost = (users ?? []).reduce((sum, user) => sum + user.estimatedCostUsd, 0);
  const totalCalls7d = (users ?? []).reduce((sum, user) => sum + user.llmCalls7d, 0);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 text-white">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar ao chat
        </Link>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 transition hover:border-white/25 hover:text-white"
        >
          <RefreshCwIcon className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </div>

      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="h-6 w-6 text-[#ff5a63]" />
        <h1 className="font-heading text-3xl">Admin</h1>
      </div>
      <p className="mt-1 text-sm text-white/55">
        Aprovação de cadastros e uso de cada usuário. Custo é estimativa pelos
        preços de tabela do Gemini.
      </p>

      {loading ? (
        <p className="mt-10 text-sm text-white/55">Carregando...</p>
      ) : (
        <div className="mt-8 space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Usuários" value={String(users?.length ?? 0)} />
            <KpiCard label="Pendentes" value={String(pending.length)} highlight={pending.length > 0} />
            <KpiCard label="Chamadas IA (7d)" value={String(totalCalls7d)} />
            <KpiCard label="Custo estimado" value={formatUsd(totalCost)} />
          </div>

          {pending.length > 0 ? (
            <section className="liquid-panel rounded-[24px] border border-amber-300/25 p-6">
              <h2 className="font-heading text-lg text-amber-100">
                Cadastros aguardando aprovação
              </h2>
              <div className="mt-4 space-y-2">
                {pending.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {user.name || "Sem nome"}
                      </p>
                      <p className="truncate text-xs text-white/50">
                        {user.email} · cadastro {formatDate(user.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void act(user.id, "approve")}
                      disabled={actingOn === user.id}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0A0A0B] transition disabled:opacity-60"
                    >
                      {actingOn === user.id ? (
                        <LoaderIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckIcon className="h-4 w-4" />
                      )}
                      Aprovar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="liquid-panel rounded-[24px] border border-white/10 p-6">
            <h2 className="font-heading text-lg">Uso por usuário</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-white/40">
                    <th className="px-3 py-2 font-medium">Usuário</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Desenrolos</th>
                    <th className="px-3 py-2 text-right font-medium">Mensagens</th>
                    <th className="px-3 py-2 text-right font-medium">Chamadas IA</th>
                    <th className="px-3 py-2 text-right font-medium">7 dias</th>
                    <th className="px-3 py-2 text-right font-medium">Tokens in/out</th>
                    <th className="px-3 py-2 text-right font-medium">Custo est.</th>
                    <th className="px-3 py-2 font-medium">Última atividade</th>
                    <th className="px-3 py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(users ?? []).map((user) => {
                    const approved = Boolean(user.approvedAt) || user.isAdmin;
                    return (
                      <tr key={user.id} className="border-b border-white/[0.06]">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">
                                {user.name || "Sem nome"}
                              </p>
                              <p className="truncate text-xs text-white/45">{user.email}</p>
                            </div>
                            {user.isAdmin ? (
                              <span className="shrink-0 rounded-full border border-[#ff355d]/40 bg-[#ff355d]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#ff8a9e]">
                                admin
                              </span>
                            ) : null}
                            {user.hasOwnKey ? (
                              <KeyRoundIcon
                                className="h-3.5 w-3.5 shrink-0 text-emerald-300/80"
                                aria-label="Usa chave Gemini própria"
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={
                              approved
                                ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200"
                                : "rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200"
                            }
                          >
                            {approved ? "Aprovado" : "Pendente"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{user.contacts}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{user.messages}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{user.llmCalls}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{user.llmCalls7d}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-white/70">
                          {formatTokens(user.tokens.input + user.tokens.cacheRead + user.tokens.cacheCreation)}
                          {" / "}
                          {formatTokens(user.tokens.output)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-white/85">
                          {formatUsd(user.estimatedCostUsd)}
                        </td>
                        <td className="px-3 py-3 text-xs text-white/55">
                          {user.lastActivityAt ? formatDate(user.lastActivityAt) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {user.isAdmin ? (
                            <span className="text-xs text-white/30">—</span>
                          ) : approved ? (
                            <button
                              type="button"
                              onClick={() => void act(user.id, "revoke")}
                              disabled={actingOn === user.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-rose-300/40 hover:text-rose-200 disabled:opacity-60"
                            >
                              <UserRoundXIcon className="h-3.5 w-3.5" />
                              Revogar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void act(user.id, "approve")}
                              disabled={actingOn === user.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-60"
                            >
                              <UserRoundCheckIcon className="h-3.5 w-3.5" />
                              Aprovar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-white/40">
              Tokens in inclui cache (leitura + escrita). Chamadas antigas ao
              coach (antes do tracking) contam como chamada mas sem tokens.
            </p>
          </section>

          {error ? (
            <p role="alert" className="text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </main>
  );
}

function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "liquid-panel rounded-[20px] border border-amber-300/30 p-4"
          : "liquid-panel rounded-[20px] border border-white/10 p-4"
      }
    >
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className="mt-2 font-heading text-2xl text-white">{value}</p>
    </div>
  );
}

function formatUsd(value: number) {
  return `US$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  })}`;
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
