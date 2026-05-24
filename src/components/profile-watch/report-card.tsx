"use client";

import { cn } from "@/lib/utils";
import type { ProfileReportSummary } from "@/types/profile-watch";

const HIGHLIGHT_CONFIG: Record<
  ProfileReportSummary["aiHighlights"][number]["type"],
  { className: string }
> = {
  growth: { className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  engagement: { className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  content: { className: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  delete: { className: "bg-red-500/10 text-red-400 border-red-500/20" },
  anomaly: { className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
};

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${s.toLocaleDateString("pt-BR", opts)} – ${e.toLocaleDateString("pt-BR", opts)}`;
}

interface ReportCardProps {
  report: ProfileReportSummary;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function ReportCard({ report, isExpanded, onToggle }: ReportCardProps) {
  return (
    <div
      className={cn(
        "liquid-panel rounded-2xl border border-white/[0.08] p-4 transition-all duration-200",
        "hover:border-white/[0.12]",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">
            {formatDateRange(report.windowStart, report.windowEnd)}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-white/55">
            <span>
              <span className="font-medium text-white/75">
                {report.followersDelta >= 0 ? "+" : ""}
                {report.followersDelta.toLocaleString("pt-BR")}
              </span>{" "}
              seguidores
            </span>
            {report.newPostsCount > 0 && (
              <span>
                <span className="font-medium text-white/75">{report.newPostsCount}</span> posts novos
              </span>
            )}
            {report.deletedPostsCount > 0 && (
              <span className="text-red-400">
                <span className="font-medium">{report.deletedPostsCount}</span> deletados
              </span>
            )}
          </div>
        </div>

        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white/50 transition hover:border-white/15 hover:text-white/75"
          >
            {isExpanded ? "Fechar" : "Ver resumo"}
          </button>
        )}
      </div>

      {/* Highlights chips */}
      {report.aiHighlights.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {report.aiHighlights.map((h, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                HIGHLIGHT_CONFIG[h.type].className,
              )}
            >
              <span className="font-medium">{h.label}:</span>
              <span>{h.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* AI Summary — só quando expandido */}
      {isExpanded && report.aiSummary && (
        <p className="mt-3 text-xs leading-relaxed text-white/60 border-t border-white/[0.06] pt-3">
          {report.aiSummary}
        </p>
      )}
    </div>
  );
}
