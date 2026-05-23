// Cliente do Apify Instagram Profile Scraper.
// Usa o endpoint run-sync-get-dataset-items pra esperar a execução e devolver
// itens em uma chamada. Timeout default ~5min, suficiente pra 1 perfil.

import type { ScrapedPost, ScrapedProfile } from "./types";

const DEFAULT_ACTOR_ID = "apify~instagram-profile-scraper";
const APIFY_BASE = "https://api.apify.com/v2";

interface ApifyPostItem {
  shortCode?: string;
  shortcode?: string;
  type?: string;
  productType?: string;
  caption?: string | null;
  displayUrl?: string | null;
  url?: string | null;
  timestamp?: string | null;
  takenAtTimestamp?: number | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  videoViewCount?: number | null;
  videoPlayCount?: number | null;
}

interface ApifyProfileItem {
  username?: string;
  fullName?: string | null;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  biography?: string | null;
  profilePicUrl?: string | null;
  profilePicUrlHD?: string | null;
  verified?: boolean;
  private?: boolean;
  externalUrl?: string | null;
  businessCategoryName?: string | null;
  latestPosts?: ApifyPostItem[];
}

interface ApifyRunInput {
  usernames: string[];
  resultsLimit: number;
}

export class ApifyError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApifyError";
  }
}

function token(): string {
  const t = process.env.APIFY_API_TOKEN;
  if (!t) throw new ApifyError("APIFY_API_TOKEN ausente no ambiente.");
  return t;
}

function actorId(): string {
  return process.env.APIFY_INSTAGRAM_ACTOR_ID ?? DEFAULT_ACTOR_ID;
}

function normalizePostType(item: ApifyPostItem): ScrapedPost["mediaType"] {
  const t = (item.type ?? item.productType ?? "").toLowerCase();
  if (t.includes("reel") || t === "clips") return "reel";
  if (t.includes("video")) return "video";
  if (t.includes("sidecar") || t.includes("carousel")) return "carousel";
  return "image";
}

function parsePostedAt(item: ApifyPostItem): Date | null {
  if (item.timestamp) {
    const d = new Date(item.timestamp);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (item.takenAtTimestamp) {
    return new Date(item.takenAtTimestamp * 1000);
  }
  return null;
}

function mapPosts(items: ApifyPostItem[] | undefined): ScrapedPost[] {
  if (!items?.length) return [];
  return items
    .map((p) => {
      const shortcode = p.shortCode ?? p.shortcode;
      if (!shortcode) return null;
      const post: ScrapedPost = {
        shortcode,
        mediaType: normalizePostType(p),
        caption: p.caption ?? null,
        thumbnailUrl: p.displayUrl ?? null,
        permalink: p.url ?? `https://instagram.com/p/${shortcode}/`,
        postedAt: parsePostedAt(p),
        metrics: {
          likes: p.likesCount ?? undefined,
          comments: p.commentsCount ?? undefined,
          views: p.videoViewCount ?? undefined,
          plays: p.videoPlayCount ?? undefined,
        },
      };
      return post;
    })
    .filter((p): p is ScrapedPost => p !== null);
}

export async function scrapeInstagramProfile(handle: string, options?: {
  resultsLimit?: number;
  timeoutMs?: number;
}): Promise<ScrapedProfile> {
  const input: ApifyRunInput = {
    usernames: [handle],
    resultsLimit: options?.resultsLimit ?? 50,
  };
  const url = `${APIFY_BASE}/acts/${actorId()}/run-sync-get-dataset-items?token=${encodeURIComponent(token())}`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 300_000,
  );

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApifyError("Apify timeout — scraper demorou demais.");
    }
    throw new ApifyError(`Apify request falhou: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApifyError(
      `Apify HTTP ${res.status}: ${body.slice(0, 200)}`,
      res.status,
    );
  }

  const items = (await res.json()) as ApifyProfileItem[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApifyError("Apify retornou vazio. Handle não existe?");
  }
  const item = items[0];

  if (item.private) {
    throw new ApifyError("Perfil privado — não é possível monitorar.");
  }

  if (!item.username) {
    throw new ApifyError("Apify retornou item sem username.");
  }

  const scraped: ScrapedProfile = {
    handle: item.username,
    displayName: item.fullName ?? null,
    followersCount: item.followersCount ?? 0,
    followingCount: item.followsCount ?? 0,
    postsCount: item.postsCount ?? 0,
    bio: item.biography ?? null,
    avatarUrl: item.profilePicUrlHD ?? item.profilePicUrl ?? null,
    isVerified: Boolean(item.verified),
    isPrivate: Boolean(item.private),
    externalUrl: item.externalUrl ?? null,
    category: item.businessCategoryName ?? null,
    posts: mapPosts(item.latestPosts),
    rawPayload: item,
  };

  return scraped;
}
