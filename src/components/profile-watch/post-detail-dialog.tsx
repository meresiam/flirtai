"use client";

import { useEffect, useState } from "react";
import {
  ExternalLinkIcon,
  HeartIcon,
  MessageCircleIcon,
  EyeIcon,
  PlayCircleIcon,
  CalendarIcon,
  ClockIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { ProfilePostSummary } from "@/types/profile-watch";

const MEDIA_TYPE_LABEL: Record<string, string> = {
  image: "Foto",
  carousel: "Carrossel",
  reel: "Reel",
  video: "Vídeo",
};

function formatFullDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("pt-BR");
}

interface PostDetailBodyProps {
  post: ProfilePostSummary;
}

function PostDetailBody({ post }: PostDetailBodyProps) {
  const metrics = post.metrics ?? {};
  const hasMetrics =
    metrics.likes !== undefined ||
    metrics.comments !== undefined ||
    metrics.views !== undefined ||
    metrics.plays !== undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* Thumbnail full + caption */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] mx-auto sm:mx-0">
          {post.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-white/[0.05]" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/55">
              {MEDIA_TYPE_LABEL[post.mediaType] ?? post.mediaType}
            </span>
            {post.isDeleted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">
                <AlertTriangleIcon className="h-2.5 w-2.5" />
                Deletado
              </span>
            )}
          </div>

          {post.caption ? (
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap break-words">
              {post.caption}
            </p>
          ) : (
            <p className="text-sm text-white/35 italic">Sem caption.</p>
          )}
        </div>
      </div>

      {/* Métricas */}
      {hasMetrics && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metrics.likes !== undefined && (
            <MetricCell icon={HeartIcon} label="Curtidas" value={formatNumber(metrics.likes)} />
          )}
          {metrics.comments !== undefined && (
            <MetricCell icon={MessageCircleIcon} label="Comentários" value={formatNumber(metrics.comments)} />
          )}
          {metrics.views !== undefined && (
            <MetricCell icon={EyeIcon} label="Views" value={formatNumber(metrics.views)} />
          )}
          {metrics.plays !== undefined && (
            <MetricCell icon={PlayCircleIcon} label="Plays" value={formatNumber(metrics.plays)} />
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <p className="mb-3 text-[10px] uppercase tracking-[0.14em] text-white/35">
          Timeline de detecção
        </p>
        <div className="flex flex-col gap-2 text-xs">
          <TimelineRow icon={CalendarIcon} label="Postado em" value={formatFullDate(post.postedAt)} />
          <TimelineRow icon={ClockIcon} label="Detectado em" value={formatFullDate(post.firstSeenAt)} />
          <TimelineRow icon={ClockIcon} label="Visto pela última vez" value={formatFullDate(post.lastSeenAt)} />
          {post.isDeleted && post.deletedDetectedAt && (
            <TimelineRow
              icon={AlertTriangleIcon}
              label="Deleção detectada"
              value={formatFullDate(post.deletedDetectedAt)}
              tone="danger"
            />
          )}
        </div>
      </div>

      {/* Link IG */}
      <a
        href={post.permalink}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-4 text-sm transition",
          "border-white/[0.1] bg-white/[0.04] text-white/75 hover:border-white/20 hover:bg-white/[0.07] hover:text-white",
        )}
      >
        Abrir no Instagram
        <ExternalLinkIcon className="h-4 w-4" />
      </a>
    </div>
  );
}

function MetricCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HeartIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-white/35">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white/85 tabular-nums">{value}</div>
    </div>
  );
}

function TimelineRow({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof CalendarIcon;
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("flex items-center gap-1.5", tone === "danger" ? "text-red-400" : "text-white/45")}>
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className={cn("tabular-nums", tone === "danger" ? "text-red-300" : "text-white/70")}>
        {value}
      </span>
    </div>
  );
}

interface PostDetailDialogProps {
  post: ProfilePostSummary | null;
  open: boolean;
  onClose: () => void;
}

export function PostDetailDialog({ post, open, onClose }: PostDetailDialogProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function handleOpenChange(v: boolean) {
    if (!v) onClose();
  }

  if (!post) return null;

  const titleText = `Post @${post.shortcode}`;
  const descriptionText = `${MEDIA_TYPE_LABEL[post.mediaType] ?? post.mediaType} • ${formatFullDate(post.postedAt)}`;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="liquid-panel max-h-[92vh] overflow-y-auto rounded-t-2xl border-t border-white/[0.08] bg-[#070913] px-5 pb-8 pt-6"
        >
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-base font-semibold text-white/90">
              {titleText}
            </SheetTitle>
            <SheetDescription className="text-xs text-white/45">
              {descriptionText}
            </SheetDescription>
          </SheetHeader>
          <PostDetailBody post={post} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="liquid-panel max-w-xl border border-white/[0.08] bg-[#070913]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white/90">
            {titleText}
          </DialogTitle>
          <DialogDescription className="text-xs text-white/45">
            {descriptionText}
          </DialogDescription>
        </DialogHeader>
        <PostDetailBody post={post} />
      </DialogContent>
    </Dialog>
  );
}
