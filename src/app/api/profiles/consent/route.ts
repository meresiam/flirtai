import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";
import {
  CURRENT_CONSENT_VERSION,
  getConsentTerms,
} from "@/lib/profile-watch/consent-text";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const terms = getConsentTerms();
  return NextResponse.json({
    version: CURRENT_CONSENT_VERSION,
    publishedAt: terms.publishedAt,
    body: terms.body,
  });
}
