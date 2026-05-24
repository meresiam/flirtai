"use client";

import { ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfilePostSummary } from "@/types/profile-watch";

const MEDIA_TYPE_LABEL: Record<string, string> = {
  image: "Foto",
  carousel: "Carrossel",
  reel: "Reel",
  video: "Vídeo",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

interface PostHistoryCardsProps {
  posts: ProfilePostSummary[];
  isLoading?: boolean;
  onPostClick?: (post: ProfilePostSummary) => void;
}

export function PostHistoryCards({ posts, isLoading, onPostClick }: PostHistoryCardsProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-white/[0.08] p-3">
            <Skeleton className="h-14 w-14 shrink-0 rounded-lg bg-white/[0.08]" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-2.5 w-20 rounded bg-white/[0.06]" />
              <Skeleton className="h-2 w-28 rounded bg-white/[0.06]" />
              <div className="flex gap-3 mt-1">
                <Skeleton className="h-2 w-12 rounded bg-white/[0.06]" />
                <Skeleton className="h-2 w-12 rounded bg-white/[0.06]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-white/40">
        Nenhum post detectado ainda
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="list" aria-label="Histórico de posts">
      {posts.map((post) => (
        <div
          key={post.id}
          role="listitem"
          onClick={onPostClick ? () => onPostClick(post) : undefined}
          className={cn(
            "flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 transition-colors",
            onPostClick && "cursor-pointer hover:bg-white/[0.04] hover:border-white/[0.12]",
            post.isDeleted && "opacity-60",
          )}
        >
          {/* Thumbnail */}
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04]">
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

          {/* Info */}
          <div className="flex flex-1 min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/55">
                {MEDIA_TYPE_LABEL[post.mediaType] ?? post.mediaType}
              </span>
              <span className="text-[11px] text-white/35">
                {formatDate(post.postedAt)}
              </span>
              {post.isDeleted && (
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
                  deletado
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-white/45 tabular-nums">
              {post.metrics?.likes !== undefined && (
                <span>{post.metrics.likes.toLocaleString("pt-BR")} curtidas</span>
              )}
              {post.metrics?.comments !== undefined && (
                <span>{post.metrics.comments.toLocaleString("pt-BR")} comentários</span>
              )}
            </div>

            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Ver post ${post.shortcode} no Instagram`}
              className="flex items-center gap-1 font-mono text-[11px] text-white/35 hover:text-white/65 transition-colors mt-0.5 w-fit"
            >
              {post.shortcode.slice(0, 10)}
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
