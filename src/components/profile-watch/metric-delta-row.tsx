"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricItem {
  label: string;
  value: string | number;
  delta?: number;
  suffix?: string;
}

interface MetricDeltaRowProps {
  metrics: MetricItem[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

function DeltaChip({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[11px] text-white/35">
        <Minus className="h-3 w-3" />0
      </span>
    );
  }
  const positive = delta > 0;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[11px] font-medium",
        positive ? "text-emerald-400" : "text-red-400",
      )}
    >
      {positive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {positive ? "+" : ""}
      {typeof delta === "number" ? formatNumber(Math.abs(delta)) : delta}
    </span>
  );
}

export function MetricDeltaRow({ metrics }: MetricDeltaRowProps) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:gap-6"
      aria-label="Métricas do perfil"
    >
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="flex flex-col gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 lg:min-w-[100px]"
        >
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">
            {metric.label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-white/90">
              {typeof metric.value === "number"
                ? formatNumber(metric.value)
                : metric.value}
              {metric.suffix ? (
                <span className="text-xs text-white/45">{metric.suffix}</span>
              ) : null}
            </span>
            {metric.delta !== undefined && <DeltaChip delta={metric.delta} />}
          </div>
        </div>
      ))}
    </div>
  );
}
