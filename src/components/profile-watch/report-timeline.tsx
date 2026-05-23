"use client";

import { useState } from "react";
import { FileTextIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportCard } from "./report-card";
import type { ProfileReportSummary } from "@/types/profile-watch";

interface ReportTimelineProps {
  reports: ProfileReportSummary[];
  isLoading?: boolean;
}

export function ReportTimeline({ reports, isLoading }: ReportTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleReport(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando relatórios">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.08] p-4">
            <div className="flex justify-between gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-2 w-24 rounded bg-white/[0.08]" />
                <Skeleton className="h-3 w-36 rounded bg-white/[0.06]" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg bg-white/[0.06]" />
            </div>
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full bg-white/[0.06]" />
              <Skeleton className="h-5 w-24 rounded-full bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
          <FileTextIcon className="h-6 w-6 text-white/25" />
        </div>
        <div>
          <p className="text-sm text-white/60">Nenhum relatório ainda</p>
          <p className="mt-1 text-xs text-white/35">
            O primeiro relatório é gerado após o scan inicial
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="list" aria-label="Histórico de relatórios">
      {reports.map((report) => (
        <div key={report.id} role="listitem">
          <ReportCard
            report={report}
            isExpanded={expandedId === report.id}
            onToggle={() => toggleReport(report.id)}
          />
        </div>
      ))}
    </div>
  );
}
