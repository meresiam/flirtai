"use client";

import { Users, TrendingUp, UserCircle2, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProfileSource } from "@/lib/profile-watch/types";

interface ProfileTypePickerProps {
  value: Exclude<ProfileSource, "self"> | null;
  onChange: (value: Exclude<ProfileSource, "self">) => void;
}

const TYPES = [
  {
    key: "competitor" as const,
    icon: TrendingUp,
    label: "Concorrente",
    description: "Perfis de marcas ou criadores que competem com você. Acompanhe crescimento e conteúdo.",
    iconColor: "text-orange-400",
    borderActive: "border-orange-500/40",
    bgActive: "bg-orange-500/10",
    disabled: false,
  },
  {
    key: "influencer" as const,
    icon: Users,
    label: "Influencer",
    description: "Criadores em prospecção ou no seu portfólio de parcerias.",
    iconColor: "text-violet-400",
    borderActive: "border-violet-500/40",
    bgActive: "bg-violet-500/10",
    disabled: false,
  },
  {
    key: "self" as const,
    icon: UserCircle2,
    label: "Meu perfil",
    description: "Monitore seu próprio perfil com sugestões de melhoria por IA. Requer autorização Meta.",
    iconColor: "text-white/30",
    borderActive: "border-white/10",
    bgActive: "bg-white/[0.03]",
    disabled: true,
  },
];

export function ProfileTypePicker({ value, onChange }: ProfileTypePickerProps) {
  return (
    <TooltipProvider>
      <div className="grid gap-3">
        {TYPES.map(({ key, icon: Icon, label, description, iconColor, borderActive, bgActive, disabled }) => {
          const isSelected = value === key;

          const card = (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-disabled={disabled}
              onClick={() => !disabled && onChange(key as Exclude<ProfileSource, "self">)}
              className={cn(
                "relative flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
                "min-h-[80px] touch-manipulation",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff355d]/40",
                isSelected
                  ? cn("border", borderActive, bgActive)
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]",
                )}
              >
                <Icon className={cn("h-5 w-5", iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-white/90" : "text-white/75",
                    )}
                  >
                    {label}
                  </span>
                  {disabled && (
                    <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/40">
                      <LockIcon className="h-2.5 w-2.5" />
                      Wave 4
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-white/45 leading-relaxed">{description}</p>
              </div>

              {isSelected && (
                <div className="absolute right-4 top-4 flex h-4 w-4 items-center justify-center rounded-full bg-[#ff355d]">
                  <span className="text-[8px] text-white font-bold">✓</span>
                </div>
              )}
            </button>
          );

          if (disabled) {
            return (
              <Tooltip key={key}>
                <TooltipTrigger render={card} />
                <TooltipContent
                  side="top"
                  className="border-white/10 bg-black/90 text-white/70 text-xs"
                >
                  Disponível na Wave 4 — requer integração com Meta OAuth
                </TooltipContent>
              </Tooltip>
            );
          }

          return card;
        })}
      </div>
    </TooltipProvider>
  );
}
