// Tipos compartilhados do módulo Profile Watch.
// Source of truth do schema é prisma/schema.prisma. Esses tipos descrevem
// estruturas auxiliares que cruzam fronteiras (scraper -> differ -> DB).

export type ProfileSource = "self" | "competitor" | "influencer";
export type ProfilePlatform = "instagram";
export type ProfileWatchStatus = "active" | "paused" | "error";
export type ProfilePostType = "image" | "carousel" | "reel" | "video";
export type CoachingDimension =
  | "bio"
  | "grid"
  | "cadence"
  | "pillars"
  | "engagement";
export type CoachingSeverity = "info" | "suggestion" | "critical";

export interface ScrapedProfile {
  handle: string;
  displayName: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isPrivate: boolean;
  externalUrl: string | null;
  category: string | null;
  posts: ScrapedPost[];
  rawPayload: unknown;
}

export interface ScrapedPost {
  shortcode: string;
  mediaType: ProfilePostType;
  caption: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  postedAt: Date | null;
  metrics: {
    likes?: number;
    comments?: number;
    views?: number;
    plays?: number;
  };
}

export interface ReportHighlight {
  type: "growth" | "engagement" | "content" | "delete" | "anomaly";
  label: string;
  value: string;
}

export interface ProfileReportPayload {
  windowStart: Date;
  windowEnd: Date;
  newPostsCount: number;
  deletedPostsCount: number;
  followersDelta: number;
  engagementAvg: number | null;
  aiSummary: string;
  aiHighlights: ReportHighlight[];
}
