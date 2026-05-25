// Orquestrador de scan de um único MonitoredProfile.
// Faz: scrape -> snapshot -> diff posts -> upsert -> ProfileReport quando janela fecha.
// Atualiza lastScanAt/nextScanAt e marca erro com mensagem em caso de falha.

import type { MonitoredProfile, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

import { scrapeInstagramProfile, ApifyError } from "./apify-client";
import { decryptToken } from "./token-crypto";
import { fetchSelfProfile } from "./meta-graph-client";
import { diffPosts } from "./post-differ";
import { generateReport, type ReportContext } from "./report-builder";
import { PROFILE_WATCH_LIMITS } from "./limits";
import type { ScrapedProfile } from "./types";

export interface ScanResult {
  profileId: string;
  ok: boolean;
  durationMs: number;
  reportCreated: boolean;
  newPosts: number;
  deletedPosts: number;
  error?: string;
}

// Próximo scan em caso de sucesso: usa cadenceHours do perfil.
function nextSuccessfulScanAt(profile: MonitoredProfile, now: Date): Date {
  return new Date(now.getTime() + profile.cadenceHours * 60 * 60 * 1000);
}

// Próximo scan em caso de falha: backoff exponencial com cap de 24h.
// Recebe o errorCount JÁ INCREMENTADO (pós-falha).
// Exemplos: 1→2h, 5→10h, 12→24h, 13→24h (cap em 12 * 2 = 24h).
// Cap em 12: a partir daí backoff é constante 24h até suceder.
function nextRetryAt(errorCount: number, now: Date): Date {
  const cappedCount = Math.min(errorCount, 12);
  const backoffHours = cappedCount * 2;
  return new Date(now.getTime() + backoffHours * 60 * 60 * 1000);
}

async function fetchProfile(profile: MonitoredProfile): Promise<ScrapedProfile> {
  if (profile.source === "self") {
    if (!profile.graphAccessToken || !profile.graphUserId) {
      throw new Error("Perfil SELF sem token Meta. Reconecte a conta.");
    }
    const accessToken = decryptToken(profile.graphAccessToken);
    return fetchSelfProfile({ accessToken, graphUserId: profile.graphUserId });
  }
  return scrapeInstagramProfile(profile.handle, { resultsLimit: 50 });
}

function computeEngagementAvg(
  posts: { likes?: number; comments?: number }[],
  followers: number,
): number | null {
  if (!posts.length || followers <= 0) return null;
  const total = posts.reduce(
    (sum, p) => sum + (p.likes ?? 0) + (p.comments ?? 0),
    0,
  );
  return total / posts.length / followers;
}

function shouldCreateReport(
  lastReportEnd: Date | null,
  now: Date,
  windowHours: number,
): boolean {
  if (!lastReportEnd) return true;
  const elapsed = now.getTime() - lastReportEnd.getTime();
  return elapsed >= windowHours * 60 * 60 * 1000;
}

export async function runProfileScan(
  profile: MonitoredProfile,
): Promise<ScanResult> {
  const startedAt = Date.now();
  const now = new Date();
  let scraped: ScrapedProfile;

  try {
    scraped = await fetchProfile(profile);
  } catch (err) {
    const errorMessage =
      err instanceof ApifyError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    const newErrorCount = profile.errorCount + 1;
    await prisma.monitoredProfile.update({
      where: { id: profile.id },
      data: {
        status: "error",
        lastErrorMessage: errorMessage.slice(0, 500),
        lastScanAt: now,
        errorCount: newErrorCount,
        nextScanAt: nextRetryAt(newErrorCount, now),
      },
    });
    return {
      profileId: profile.id,
      ok: false,
      durationMs: Date.now() - startedAt,
      reportCreated: false,
      newPosts: 0,
      deletedPosts: 0,
      error: errorMessage,
    };
  }

  // Privado virou erro hard — mas pode voltar a público, então aplica retry exponencial
  // (não pausa permanentemente; o backoff garante que não spameia Apify).
  if (scraped.isPrivate) {
    const newErrorCount = profile.errorCount + 1;
    await prisma.monitoredProfile.update({
      where: { id: profile.id },
      data: {
        status: "error",
        lastErrorMessage: "Perfil ficou privado — aguardando retry.",
        lastScanAt: now,
        errorCount: newErrorCount,
        nextScanAt: nextRetryAt(newErrorCount, now),
      },
    });
    return {
      profileId: profile.id,
      ok: false,
      durationMs: Date.now() - startedAt,
      reportCreated: false,
      newPosts: 0,
      deletedPosts: 0,
      error: "Perfil ficou privado.",
    };
  }

  // 1) snapshot append-only.
  await prisma.profileSnapshot.create({
    data: {
      profileId: profile.id,
      capturedAt: now,
      followersCount: scraped.followersCount,
      followingCount: scraped.followingCount,
      postsCount: scraped.postsCount,
      bio: scraped.bio,
      avatarUrl: scraped.avatarUrl,
      isVerified: scraped.isVerified,
      isPrivate: scraped.isPrivate,
      externalUrl: scraped.externalUrl,
      category: scraped.category,
      rawPayload: scraped.rawPayload as Prisma.InputJsonValue,
    },
  });

  // 2) diff posts.
  const existingPosts = await prisma.profilePost.findMany({
    where: { profileId: profile.id },
  });
  const diff = diffPosts(existingPosts, scraped.posts);

  // 3) aplicar diff.
  const writes: Prisma.PrismaPromise<unknown>[] = [];

  for (const post of diff.created) {
    writes.push(
      prisma.profilePost.create({
        data: {
          profileId: profile.id,
          shortcode: post.shortcode,
          mediaType: post.mediaType,
          caption: post.caption,
          thumbnailUrl: post.thumbnailUrl,
          permalink: post.permalink,
          postedAt: post.postedAt,
          firstSeenAt: now,
          lastSeenAt: now,
          lastMetrics: post.metrics as Prisma.InputJsonValue,
        },
      }),
    );
  }

  for (const { existing, scraped: s } of diff.updated) {
    writes.push(
      prisma.profilePost.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: now,
          thumbnailUrl: s.thumbnailUrl ?? existing.thumbnailUrl,
          caption: s.caption ?? existing.caption,
          lastMetrics: s.metrics as Prisma.InputJsonValue,
        },
      }),
    );
  }

  for (const { existing, scraped: s } of diff.reappeared) {
    writes.push(
      prisma.profilePost.update({
        where: { id: existing.id },
        data: {
          isDeleted: false,
          deletedDetectedAt: null,
          lastSeenAt: now,
          lastMetrics: s.metrics as Prisma.InputJsonValue,
        },
      }),
    );
  }

  for (const deletedPost of diff.deleted) {
    writes.push(
      prisma.profilePost.update({
        where: { id: deletedPost.id },
        data: { isDeleted: true, deletedDetectedAt: now },
      }),
    );
  }

  if (writes.length > 0) {
    await prisma.$transaction(writes);
  }

  // 4) decidir se cria ProfileReport.
  const lastReport = await prisma.profileReport.findFirst({
    where: { profileId: profile.id },
    orderBy: { windowEnd: "desc" },
    select: { windowEnd: true },
  });

  const windowHours = PROFILE_WATCH_LIMITS.reportWindowHours;
  let reportCreated = false;

  if (shouldCreateReport(lastReport?.windowEnd ?? null, now, windowHours)) {
    const windowStart =
      lastReport?.windowEnd ??
      new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const windowEnd = now;

    // dados pro LLM
    const followersBefore =
      (await prisma.profileSnapshot.findFirst({
        where: { profileId: profile.id, capturedAt: { lt: windowStart } },
        orderBy: { capturedAt: "desc" },
        select: { followersCount: true },
      }))?.followersCount ?? scraped.followersCount;

    const followersDelta = scraped.followersCount - followersBefore;
    const engagementAvg = computeEngagementAvg(
      scraped.posts.map((p) => p.metrics),
      scraped.followersCount,
    );

    const newPostsSummary = diff.created.slice(0, 5).map((p) => {
      const date = p.postedAt ? p.postedAt.toISOString().slice(0, 10) : "data ?";
      const caption = (p.caption ?? "(sem legenda)").slice(0, 80);
      return `${p.mediaType} ${date}: ${caption}`;
    });

    const deletedPostsSummary = diff.deleted.slice(0, 5).map((p) => {
      const caption = (p.caption ?? "(sem legenda)").slice(0, 80);
      const lastSeen = p.lastSeenAt.toISOString().slice(0, 10);
      return `Post deletado (visto até ${lastSeen}): ${caption}`;
    });

    const ctx: ReportContext = {
      handle: profile.handle,
      displayName: profile.displayName,
      source: profile.source,
      windowStart,
      windowEnd,
      followersBefore,
      followersAfter: scraped.followersCount,
      followersDelta,
      newPostsCount: diff.created.length,
      deletedPostsCount: diff.deleted.length,
      engagementAvg,
      newPostsSummary,
      deletedPostsSummary,
    };

    try {
      const llmOutput = await generateReport(ctx);
      await prisma.profileReport.create({
        data: {
          profileId: profile.id,
          windowStart,
          windowEnd,
          newPostsCount: diff.created.length,
          deletedPostsCount: diff.deleted.length,
          followersDelta,
          engagementAvg,
          aiSummary: llmOutput.aiSummary,
          aiHighlights: llmOutput.aiHighlights as unknown as Prisma.InputJsonValue,
        },
      });
      reportCreated = true;
    } catch (err) {
      // Relatório é secundário: scan principal sucedeu (perfil acessível, snapshot salvo,
      // diff aplicado). Não derrubar nem incrementar errorCount por falha de LLM.
      // Decisão de design (M7): errorCount reseta = 0 junto com o update de sucesso abaixo,
      // mesmo que o relatório tenha falhado. Só loga a mensagem de erro do relatório.
      const errMsg = err instanceof Error ? err.message : String(err);
      await prisma.monitoredProfile.update({
        where: { id: profile.id },
        data: { lastErrorMessage: `Relatório falhou: ${errMsg.slice(0, 400)}` },
      });
    }
  }

  // 5) atualizar agendamento — scan principal sucedeu; reseta errorCount para 0.
  // Se o relatório falhou (bloco acima), errorCount ainda reseta: report é secundário.
  await prisma.monitoredProfile.update({
    where: { id: profile.id },
    data: {
      status: "active",
      lastErrorMessage: null,
      errorCount: 0,
      lastScanAt: now,
      nextScanAt: nextSuccessfulScanAt(profile, now),
      displayName: scraped.displayName ?? profile.displayName,
    },
  });

  return {
    profileId: profile.id,
    ok: true,
    durationMs: Date.now() - startedAt,
    reportCreated,
    newPosts: diff.created.length,
    deletedPosts: diff.deleted.length,
  };
}
