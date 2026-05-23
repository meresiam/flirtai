// Diff entre posts existentes no DB e posts vindos do scraper.
// Retorna 3 buckets: novos (insert), vistos (update last_seen + metrics), sumidos (mark deleted).
// Posts já marcados como deletados que reaparecem voltam pra "vistos" com isDeleted=false.

import type { ProfilePost } from "@prisma/client";

import type { ScrapedPost } from "./types";

export interface PostDiff {
  created: ScrapedPost[];
  updated: Array<{ existing: ProfilePost; scraped: ScrapedPost }>;
  deleted: ProfilePost[];
  reappeared: Array<{ existing: ProfilePost; scraped: ScrapedPost }>;
}

export function diffPosts(
  existingPosts: ProfilePost[],
  scrapedPosts: ScrapedPost[],
): PostDiff {
  const byShortcode = new Map(existingPosts.map((p) => [p.shortcode, p]));
  const scrapedSet = new Set(scrapedPosts.map((p) => p.shortcode));

  const created: ScrapedPost[] = [];
  const updated: PostDiff["updated"] = [];
  const reappeared: PostDiff["reappeared"] = [];

  for (const scraped of scrapedPosts) {
    const existing = byShortcode.get(scraped.shortcode);
    if (!existing) {
      created.push(scraped);
      continue;
    }
    if (existing.isDeleted) {
      reappeared.push({ existing, scraped });
    } else {
      updated.push({ existing, scraped });
    }
  }

  // "Sumidos" só conta entre posts ainda não-deletados; deletados continuam deletados.
  const deleted = existingPosts.filter(
    (p) => !p.isDeleted && !scrapedSet.has(p.shortcode),
  );

  return { created, updated, deleted, reappeared };
}
