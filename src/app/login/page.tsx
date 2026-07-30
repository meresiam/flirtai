"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/components/password-input";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await authClient.signIn.email({ email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Não foi possível entrar.");
      return;
    }
    router.push(redirect);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="liquid-panel w-full max-w-sm rounded-[28px] border border-white/10 p-7 text-white">
        <div className="mb-7 text-center">
          <h1 className="font-heading text-2xl">Entrar no Flirt.ai</h1>
          <p className="mt-1 text-sm text-white/55">Wingman dos encontros sérios.</p>
        </div>

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

          <div>
            <div className="flex items-baseline justify-between">
              <label
                className="text-xs uppercase tracking-[0.18em] text-white/55"
                htmlFor="password"
              >
                Senha
              </label>
              <Link href="/esqueci-senha" className="text-xs text-white/55 underline transition hover:text-white">
                Esqueceu a senha?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-rose-200">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-[#0A0A0B] shadow-lg shadow-white/10 transition disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/55">
          Sem conta?{" "}
          <Link href="/signup" className="text-white underline">
            Criar agora
          </Link>
        </p>
      </div>
    </main>
  );
}
