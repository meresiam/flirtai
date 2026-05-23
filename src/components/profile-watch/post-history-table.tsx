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

interface PostHistoryTableProps {
  posts: ProfilePostSummary[];
  isLoading?: boolean;
}

export function PostHistoryTable({ posts, isLoading }: PostHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/[0.08]" aria-busy="true">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              {["Post", "Tipo", "Data", "Likes", "Comentários"].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-md bg-white/[0.06]" />
                    <Skeleton className="h-2.5 w-20 rounded bg-white/[0.06]" />
                  </div>
                </td>
                {Array.from({ length: 4 }).map((_, j) => (
                  <td key={j} className="px-3 py-3">
                    <Skeleton className="h-2.5 w-12 rounded bg-white/[0.06]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
    <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Histórico de posts">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th scope="col" className="px-3 py-3 text-left text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">
                Post
              </th>
              <th scope="col" className="px-3 py-3 text-left text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">
                Tipo
              </th>
              <th scope="col" className="px-3 py-3 text-left text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">
                Data
              </th>
              <th scope="col" className="px-3 py-3 text-right text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">
                Likes
              </th>
              <th scope="col" className="px-3 py-3 text-right text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">
                Comentários
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className={cn(
                  "border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]",
                  post.isDeleted && "opacity-60",
                )}
              >
                {/* Thumbnail + link */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.04]">
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
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Ver post ${post.shortcode} no Instagram`}
                      className="flex items-center gap-1 font-mono text-[11px] text-white/50 hover:text-white/80 transition-colors"
                    >
                      {post.shortcode.slice(0, 8)}…
                      <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                    {post.isDeleted && (
                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
                        deletado
                      </span>
                    )}
                  </div>
                </td>

                {/* Tipo */}
                <td className="px-3 py-3 text-xs text-white/55">
                  {MEDIA_TYPE_LABEL[post.mediaType] ?? post.mediaType}
                </td>

                {/* Data */}
                <td className="px-3 py-3 text-xs text-white/50">
                  {formatDate(post.postedAt)}
                </td>

                {/* Likes */}
                <td className="px-3 py-3 text-right text-xs text-white/55 tabular-nums">
                  {post.metrics?.likes?.toLocaleString("pt-BR") ?? "—"}
                </td>

                {/* Comentários */}
                <td className="px-3 py-3 text-right text-xs text-white/55 tabular-nums">
                  {post.metrics?.comments?.toLocaleString("pt-BR") ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
