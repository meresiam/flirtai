"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, KeyIcon, LogOutIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";

interface SettingsPayload {
  email: string;
  name: string | null;
  anthropicKeyMasked: string | null;
  anthropicKeySet: boolean;
  anthropicModel: string | null;
  defaultModel: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    void load();
    async function load() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) throw new Error("Não consegui carregar suas configurações.");
        const { settings: payload } = (await response.json()) as { settings: SettingsPayload };
        setSettings(payload);
        setName(payload.name ?? "");
        setModel(payload.anthropicModel ?? "");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Erro ao carregar.");
      } finally {
        setLoading(false);
      }
    }
  }, []);

  async function save(payload: Record<string, string | null>) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Não consegui salvar.");
      }
      const { settings: updated } = (await response.json()) as {
        settings: Partial<SettingsPayload>;
      };
      setSettings((current) => (current ? { ...current, ...updated } : current));
      setApiKey("");
      setSuccess("Atualizado!");
      window.setTimeout(() => setSuccess(null), 2000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save({ name });
  }

  async function handleSaveKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey.trim()) return;
    await save({ anthropicApiKey: apiKey.trim(), anthropicModel: model.trim() || null });
  }

  async function handleClearKey() {
    if (!confirm("Remover sua key e voltar pra key padrão do servidor?")) return;
    await save({ anthropicApiKey: null, anthropicModel: null });
    setModel("");
  }

  async function handleSaveModel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save({ anthropicModel: model.trim() || null });
  }

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 text-white">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar ao chat
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 transition hover:border-rose-300/40 hover:text-rose-200"
        >
          <LogOutIcon className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>

      <h1 className="font-heading text-3xl">Configurações</h1>
      <p className="mt-1 text-sm text-white/55">
        {settings ? settings.email : "—"}
      </p>

      {loading ? (
        <p className="mt-10 text-sm text-white/55">Carregando...</p>
      ) : (
        <div className="mt-8 space-y-6">
          <section className="liquid-panel rounded-[24px] border border-white/10 p-6">
            <h2 className="font-heading text-lg">Perfil</h2>
            <form onSubmit={handleSaveProfile} className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">
                  Nome
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-[#ff355d]/40"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0A0A0B] transition disabled:opacity-50"
              >
                Salvar perfil
              </button>
            </form>
          </section>

          <section className="liquid-panel rounded-[24px] border border-white/10 p-6">
            <div className="flex items-center gap-2">
              <KeyIcon className="h-4 w-4 text-[#ff355d]" />
              <h2 className="font-heading text-lg">Anthropic API</h2>
            </div>
            <p className="mt-2 text-sm text-white/55">
              {settings?.anthropicKeySet
                ? `Usando sua key: ${settings.anthropicKeyMasked}`
                : "Usando key padrão do servidor."}
            </p>

            <form onSubmit={handleSaveKey} className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">
                  Nova API key (sobrescreve a anterior)
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm outline-none transition focus:border-[#ff355d]/40"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-white/55">
                  Modelo (opcional)
                </span>
                <input
                  type="text"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={settings?.defaultModel ?? "claude-sonnet-4-6"}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm outline-none transition focus:border-[#ff355d]/40"
                />
                <span className="mt-1 block text-xs text-white/45">
                  Padrão: {settings?.defaultModel ?? "claude-sonnet-4-6"}
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving || !apiKey.trim()}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0A0A0B] transition disabled:opacity-50"
                >
                  Salvar key
                </button>
                {settings?.anthropicKeySet ? (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    disabled={saving}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/65 transition hover:border-rose-300/40 hover:text-rose-200"
                  >
                    Remover key personalizada
                  </button>
                ) : null}
              </div>
            </form>

            {settings?.anthropicKeySet ? (
              <form onSubmit={handleSaveModel} className="mt-6 border-t border-white/[0.06] pt-4">
                <p className="text-xs text-white/45">
                  Trocar só o modelo (mantendo a key atual):
                </p>
              </form>
            ) : null}
          </section>

          {error ? <p className="text-sm text-rose-200">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-200">{success}</p> : null}
        </div>
      )}
    </main>
  );
}
