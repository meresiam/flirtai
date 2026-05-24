// Purge de dados antigos do Profile Watch — retenção configurada via
// PROFILE_WATCH_RETENTION_DAYS (default 180 dias, requisito LGPD declarado
// em docs/PROFILE-WATCH.md).
//
// Regras de retenção (uma cutoff comum, regras diferentes por modelo):
// - ProfileSnapshot:    capturedAt < cutoff               → apaga sempre
// - ProfilePost:        isDeleted = true AND
//                       lastSeenAt < cutoff               → apaga só posts já marcados
//                                                          como deletados há mais de 180d
//                                                          (posts ativos NÃO são purgados)
// - ProfileReport:      windowEnd < cutoff                → apaga sempre
// - CoachingSuggestion: createdAt < cutoff AND
//                       acknowledged = true               → preserva sugestões não-vistas
//
// MonitoredProfile em si NUNCA é apagado pelo purge — o user controla via
// DELETE /api/profiles/[id]. Cascade rules do Prisma já limpam tudo nesse caso.
//
// Idempotente: rodar 10x seguidas == rodar 1x.

import { prisma } from "@/lib/db";
import { PROFILE_WATCH_LIMITS } from "./limits";

export interface PurgeResult {
  retentionDays: number;
  cutoff: string;
  deleted: {
    snapshots: number;
    posts: number;
    reports: number;
    suggestions: number;
  };
}

export async function purgeOldProfileWatchData(): Promise<PurgeResult> {
  const retentionDays = PROFILE_WATCH_LIMITS.retentionDays;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const [snapshots, posts, reports, suggestions] = await Promise.all([
    prisma.profileSnapshot.deleteMany({
      where: { capturedAt: { lt: cutoff } },
    }),
    prisma.profilePost.deleteMany({
      where: {
        isDeleted: true,
        lastSeenAt: { lt: cutoff },
      },
    }),
    prisma.profileReport.deleteMany({
      where: { windowEnd: { lt: cutoff } },
    }),
    prisma.coachingSuggestion.deleteMany({
      where: {
        acknowledged: true,
        createdAt: { lt: cutoff },
      },
    }),
  ]);

  return {
    retentionDays,
    cutoff: cutoff.toISOString(),
    deleted: {
      snapshots: snapshots.count,
      posts: posts.count,
      reports: reports.count,
      suggestions: suggestions.count,
    },
  };
}
