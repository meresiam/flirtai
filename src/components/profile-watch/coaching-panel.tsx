"use client";

import { SparklesIcon, LockIcon } from "lucide-react";

// TODO Wave 4: implementar painel real com CoachingSuggestion quando source=self estiver disponível
// Por ora renderiza stub visual. Só aparece se profile.source === 'self' (dead code no MVP).

export function CoachingPanel() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ff355d]/20 bg-[#ff355d]/10">
        <SparklesIcon className="h-7 w-7 text-[#ff7a66]" />
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.08] border border-white/10">
          <LockIcon className="h-2.5 w-2.5 text-white/40" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white/80">
          Self-Coach chega na Wave 4
        </h3>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/45">
          Conecte sua conta Instagram via Meta OAuth para receber sugestões
          de melhoria do seu perfil geradas por IA.
        </p>
      </div>

      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ff355d]/20 bg-[#ff355d]/10 px-3 py-1 text-[11px] text-[#ff7a66]">
        <LockIcon className="h-3 w-3" />
        Aguardando Wave 4
      </span>
    </div>
  );
}
