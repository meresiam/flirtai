"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await authClient.signUp.email({ name, email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Não foi possível criar a conta.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="liquid-panel w-full max-w-sm rounded-[28px] border border-white/10 p-7 text-white">
        <div className="mb-7 text-center">
          <h1 className="font-heading text-2xl">Criar conta</h1>
          <p className="mt-1 text-sm text-white/55">Acesso pessoal ao seu wingman.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-white/55" htmlFor="name">
              Como te chamar
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff355d]/40"
            />
          </div>

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
            <label className="text-xs uppercase tracking-[0.18em] text-white/55" htmlFor="password">
              Senha
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
            <p className="mt-1 text-xs text-white/45">Mínimo 8 caracteres.</p>
          </div>

          {error ? <p className="text-sm text-rose-200">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-[#0A0A0B] shadow-lg shadow-white/10 transition disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/55">
          Já tem conta?{" "}
          <Link href="/login" className="text-white underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
