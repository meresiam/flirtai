// Tipos compartilhados front <-> back do módulo Profile Watch.

import type {
  CoachingDimension,
  CoachingSeverity,
  ProfilePostType,
  ProfileSource,
  ProfileWatchStatus,
} from "@/lib/profile-watch/types";

export interface MonitoredProfileSummary {
  id: string;
  source: ProfileSource;
  platform: "instagram";
  handle: string;
  displayName: string | null;
  status: ProfileWatchStatus;
  lastErrorMessage: string | null;
  cadenceHours: number;
  lastScanAt: string | null;
  nextScanAt: string | null;
  hasGraphToken: boolean;
  latestSnapshot: ProfileSnapshotSummary | null;
  createdAt: string;
}

export interface ProfileSnapshotSummary {
  capturedAt: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  externalUrl: string | null;
  category: string | null;
}

export interface ProfilePostSummary {
  id: string;
  shortcode: string;
  mediaType: ProfilePostType;
  caption: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  postedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isDeleted: boolean;
  deletedDetectedAt: string | null;
  metrics: {
    likes?: number;
    comments?: number;
    views?: number;
    plays?: number;
  } | null;
}

export interface ProfileReportSummary {
  id: string;
  windowStart: string;
  windowEnd: string;
  newPostsCount: number;
  deletedPostsCount: number;
  followersDelta: number;
  engagementAvg: number | null;
  aiSummary: string;
  aiHighlights: Array<{
    type: "growth" | "engagement" | "content" | "delete" | "anomaly";
    label: string;
    value: string;
  }>;
  createdAt: string;
}

export interface CoachingSuggestionSummary {
  id: string;
  dimension: CoachingDimension;
  severity: CoachingSeverity;
  title: string;
  description: string;
  actionItems: string[];
  acknowledged: boolean;
  createdAt: string;
}

export interface ProfileDetailResponse {
  profile: MonitoredProfileSummary;
  posts: ProfilePostSummary[];
  reports: ProfileReportSummary[];
  suggestions: CoachingSuggestionSummary[];
}
