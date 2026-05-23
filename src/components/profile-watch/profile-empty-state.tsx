"use client";

import { useRouter } from "next/navigation";
import { Eye, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProfileEmptyState() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <Eye className="h-8 w-8 text-white/30" />
      </div>

      <h2 className="mb-2 text-lg font-semibold text-white/85">
        Nenhum perfil monitorado
      </h2>
      <p className="mb-8 max-w-sm text-sm text-white/45 leading-relaxed">
        Monitore concorrentes e influencers para acompanhar crescimento,
        posts deletados e relatórios de IA.
      </p>

      {/* Exemplos do que o módulo faz */}
      <div className="mb-8 grid w-full max-w-sm gap-3 sm:grid-cols-3">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <TrendingUp className="h-5 w-5 text-[#ff7a66]" />
          <span className="text-[11px] text-white/50 leading-tight">Métricas de crescimento</span>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <Users className="h-5 w-5 text-violet-400" />
          <span className="text-[11px] text-white/50 leading-tight">Análise de concorrentes</span>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <Eye className="h-5 w-5 text-emerald-400" />
          <span className="text-[11px] text-white/50 leading-tight">Posts detectados</span>
        </div>
      </div>

      <Button
        onClick={() => router.push("/profiles/new")}
        className="min-h-[44px] bg-[#ff355d] px-6 text-white hover:bg-[#ff355d]/90"
      >
        Adicionar primeiro perfil
      </Button>
    </div>
  );
}
