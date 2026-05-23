"use client";

import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CADENCE_OPTIONS = [
  { value: 12, label: "12h", description: "Duas vezes ao dia" },
  { value: 24, label: "24h", description: "Uma vez ao dia" },
  { value: 48, label: "48h", description: "A cada 2 dias" },
  { value: 168, label: "7d", description: "Uma vez por semana" },
] as const;

type CadenceHours = (typeof CADENCE_OPTIONS)[number]["value"];

interface CadencePickerProps {
  value: CadenceHours;
  onChange: (value: CadenceHours) => void;
  disabled?: boolean;
}

export function CadencePicker({ value, onChange, disabled }: CadencePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-white/70">
          Frequência de monitoramento
        </label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              aria-label="O que é cadência?"
              className="text-white/35 hover:text-white/60 transition-colors"
            >
              <InfoIcon className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-[220px] border-white/10 bg-black/90 text-white/70 text-xs leading-relaxed"
            >
              Com que frequência o sistema vai buscar atualizações do perfil.
              Mais frequente = mais custo de API. Cadência mínima: 12h.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Frequência de monitoramento">
        {CADENCE_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl border py-3 text-center transition-all duration-150",
                "min-h-[60px] touch-manipulation",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff355d]/40",
                isSelected
                  ? "border-[#ff355d]/40 bg-[#ff355d]/10 text-white"
                  : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:border-white/15 hover:text-white/75",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-[10px] leading-tight">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
