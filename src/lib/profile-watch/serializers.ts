// Serializers DB -> JSON pra Profile Watch.
// Nunca expor graphAccessToken nem rawPayload pro client.

import type {
  CoachingSuggestion,
  MonitoredProfile,
  ProfilePost,
  ProfileReport,
  ProfileSnapshot,
} from "@prisma/client";

import type {
  CoachingSuggestionSummary,
  MonitoredProfileSummary,
  ProfilePostSummary,
  ProfileReportSummary,
  ProfileSnapshotSummary,
} from "@/types/profile-watch";

export function serializeSnapshot(s: ProfileSnapshot): ProfileSnapshotSummary {
  return {
    capturedAt: s.capturedAt.toISOString(),
    followersCount: s.followersCount,
    followingCount: s.followingCount,
    postsCount: s.postsCount,
    bio: s.bio,
    avatarUrl: s.avatarUrl,
    isVerified: s.isVerified,
    externalUrl: s.externalUrl,
    category: s.category,
  };
}

export function serializeProfileSummary(
  profile: MonitoredProfile & { snapshots?: ProfileSnapshot[] },
): MonitoredProfileSummary {
  const latest = profile.snapshots?.[0];
  return {
    id: profile.id,
    source: profile.source,
    platform: profile.platform,
    handle: profile.handle,
    displayName: profile.displayName,
    status: profile.status,
    lastErrorMessage: profile.lastErrorMessage,
    cadenceHours: profile.cadenceHours,
    lastScanAt: profile.lastScanAt?.toISOString() ?? null,
    nextScanAt: profile.nextScanAt?.toISOString() ?? null,
    hasGraphToken: Boolean(profile.graphAccessToken),
    latestSnapshot: latest ? serializeSnapshot(latest) : null,
    createdAt: profile.createdAt.toISOString(),
  };
}

export function serializeProfilePost(post: ProfilePost): ProfilePostSummary {
  return {
    id: post.id,
    shortcode: post.shortcode,
    mediaType: post.mediaType,
    caption: post.caption,
    thumbnailUrl: post.thumbnailUrl,
    permalink: post.permalink,
    postedAt: post.postedAt?.toISOString() ?? null,
    firstSeenAt: post.firstSeenAt.toISOString(),
    lastSeenAt: post.lastSeenAt.toISOString(),
    isDeleted: post.isDeleted,
    deletedDetectedAt: post.deletedDetectedAt?.toISOString() ?? null,
    metrics: (post.lastMetrics as ProfilePostSummary["metrics"]) ?? null,
  };
}

export function serializeProfileReport(r: ProfileReport): ProfileReportSummary {
  return {
    id: r.id,
    windowStart: r.windowStart.toISOString(),
    windowEnd: r.windowEnd.toISOString(),
    newPostsCount: r.newPostsCount,
    deletedPostsCount: r.deletedPostsCount,
    followersDelta: r.followersDelta,
    engagementAvg: r.engagementAvg,
    aiSummary: r.aiSummary,
    aiHighlights: (r.aiHighlights as ProfileReportSummary["aiHighlights"]) ?? [],
    createdAt: r.createdAt.toISOString(),
  };
}

export function serializeCoachingSuggestion(
  s: CoachingSuggestion,
): CoachingSuggestionSummary {
  return {
    id: s.id,
    dimension: s.dimension,
    severity: s.severity,
    title: s.title,
    description: s.description,
    actionItems: (s.actionItems as string[]) ?? [],
    acknowledged: s.acknowledged,
    createdAt: s.createdAt.toISOString(),
  };
}
