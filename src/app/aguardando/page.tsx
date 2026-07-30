"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HourglassIcon, LoaderIcon, LogOutIcon, RefreshCwIcon } from "lucide-react";

import { signOut } from "@/lib/auth-client";

// Página exibida enquanto o cadastro não foi aprovado pelo admin.
// O bootstrap do shell redireciona pra cá quando qualquer API responde
// 403 { code: "pending_approval" }.
export default function AguardandoPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function checkStatus(manual: boolean) {
    if (manual) setChecking(true);
    try {
      const response = await fetch("/api/approval-status", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as {
        approved: boolean;
        email: string | null;
      };
      setEmail(data.email);
      if (data.approved) {
        router.replace("/");
      }
    } catch {
      // silencioso — o botão permite tentar de novo
    } finally {
      if (manual) setChecking(false);
    }
  }

  useEffect(() => {
    void checkStatus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // ignora — redireciona de qualquer jeito
    }
    window.location.href = "/login";
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-white">
      <div className="liquid-panel w-full max-w-md rounded-[28px] border border-white/10 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#ff355d]/10">
          <HourglassIcon className="h-6 w-6 text-[#ff5a63]" />
        </div>
        <h1 className="mt-5 font-heading text-2xl">Cadastro em análise</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Sua conta{email ? ` (${email})` : ""} foi criada e está aguardando
          liberação. Assim que for aprovada, é só entrar de novo — nada mais a
          fazer por enquanto.
        </p>

        <div className="mt-7 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void checkStatus(true)}
            disabled={checking}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0A0A0B] transition disabled:opacity-60"
          >
            {checking ? (
              <LoaderIcon className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-4 w-4" />
            )}
            Verificar de novo
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={signingOut}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/65 transition hover:border-rose-300/30 hover:text-rose-100 disabled:opacity-60"
          >
            <LogOutIcon className="h-4 w-4" />
            {signingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </div>
    </main>
  );
}
