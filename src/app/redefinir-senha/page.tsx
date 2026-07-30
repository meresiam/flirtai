"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = Boolean(tokenError) || !token;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (password !== confirm) {
      setError("As senhas não conferem. Digite a mesma senha nos dois campos.");
      return;
    }
    setError(null);
    setLoading(true);

    const result = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);

    if (result.error) {
      setError(
        result.error.message ??
          "Não foi possível redefinir a senha. O link pode ter expirado — peça um novo.",
      );
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/login");
    }, 2500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="liquid-panel w-full max-w-sm rounded-[28px] border border-white/10 p-7 text-white">
        <div className="mb-7 text-center">
          <h1 className="font-heading text-2xl">Criar senha nova</h1>
          <p className="mt-1 text-sm text-white/55">Escolha uma senha com pelo menos 8 caracteres.</p>
        </div>

        {invalidLink ? (
          <div className="space-y-5 text-center">
            <p className="text-sm text-rose-200">
              Este link de redefinição é inválido ou já expirou. Peça um novo pra continuar.
            </p>
            <Link
              href="/esqueci-senha"
              className="inline-block w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-[#0A0A0B] shadow-lg shadow-white/10 transition"
            >
              Pedir novo link
            </Link>
          </div>
        ) : done ? (
          <div className="space-y-5 text-center">
            <p className="text-sm text-white/80">
              Senha redefinida. Redirecionando pro login...
            </p>
            <Link href="/login" className="text-sm text-white underline">
              Ir pro login agora
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="text-xs uppercase tracking-[0.18em] text-white/55"
                htmlFor="password"
              >
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff355d]/40"
              />
            </div>

            <div>
              <label
                className="text-xs uppercase tracking-[0.18em] text-white/55"
                htmlFor="confirm"
              >
                Confirmar senha
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff355d]/40"
              />
            </div>

            {error ? <p className="text-sm text-rose-200">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-[#0A0A0B] shadow-lg shadow-white/10 transition disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar senha nova"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
