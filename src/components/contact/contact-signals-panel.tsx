"use client";

import { AlertTriangleIcon, ThumbsUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ContactRecord } from "@/types/flirt";

interface ContactSignalsPanelProps {
  contact: Pick<ContactRecord, "name" | "greenFlags" | "redFlags">;
  className?: string;
}

export function ContactSignalsPanel({
  contact,
  className,
}: ContactSignalsPanelProps) {
  const greens = contact.greenFlags ?? [];
  const reds = contact.redFlags ?? [];
  const total = greens.length + reds.length;
  const firstName = contact.name?.split(" ")[0] ?? contact.name;

  return (
    <section
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-white/45">
            Sinais da {firstName}
          </h3>
          <p className="mt-0.5 text-[11px] text-white/35">
            Acumulado dos encontros registrados
          </p>
        </div>
        {total > 0 ? (
          <p className="text-[11px] text-white/55">
            <span className="font-medium text-emerald-200/85">
              {greens.length}
            </span>
            <span className="text-white/30"> positivos · </span>
            <span className="font-medium text-rose-200/85">{reds.length}</span>
            <span className="text-white/30"> a observar</span>
          </p>
        ) : null}
      </header>

      {total === 0 ? (
        <p className="text-sm text-white/45">
          Nenhum sinal registrado ainda. Use{" "}
          <span className="font-medium text-white/70">Como foi?</span> pra
          alimentar.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {greens.length > 0 ? (
            <div className="rounded-lg bg-emerald-400/[0.06] p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-300/80">
                <ThumbsUpIcon className="h-3 w-3" />
                Sinais positivos
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {greens.map((flag, idx) => (
                  <li
                    key={`g-${idx}`}
                    className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1 text-[11px] text-emerald-100/90"
                  >
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {reds.length > 0 ? (
            <div className="rounded-lg bg-rose-400/[0.06] p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-rose-300/80">
                <AlertTriangleIcon className="h-3 w-3" />
                Sinais a observar
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {reds.map((flag, idx) => (
                  <li
                    key={`r-${idx}`}
                    className="rounded-full border border-rose-400/25 bg-rose-400/[0.08] px-2.5 py-1 text-[11px] text-rose-100/90"
                  >
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
