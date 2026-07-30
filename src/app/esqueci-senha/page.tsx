"use client";

import { useState } from "react";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: "/redefinir-senha",
    });
    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Não foi possível enviar o email. Tente de novo.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="liquid-panel w-full max-w-sm rounded-[28px] border border-white/10 p-7 text-white">
        <div className="mb-7 text-center">
          <h1 className="font-heading text-2xl">Esqueceu a senha?</h1>
          <p className="mt-1 text-sm text-white/55">
            A gente manda um link pro seu email pra criar uma nova.
          </p>
        </div>

        {sent ? (
          <div className="space-y-5 text-center">
            <p className="text-sm text-white/80">
              Se <span className="text-white">{email}</span> estiver cadastrado, o link de
              redefinição já está a caminho. Vale por 1 hora — confere também o spam.
            </p>
            <Link
              href="/login"
              className="inline-block w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-[#0A0A0B] shadow-lg shadow-white/10 transition"
            >
              Voltar pro login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-white/55" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff355d]/40"
              />
            </div>

            {error ? <p className="text-sm text-rose-200">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-[#0A0A0B] shadow-lg shadow-white/10 transition disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-white/55">
          Lembrou a senha?{" "}
          <Link href="/login" className="text-white underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
