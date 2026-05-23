// Zod schemas pra payloads de Profile Watch.

import { z } from "zod";

import { CURRENT_CONSENT_VERSION } from "./consent-text";
import { PROFILE_WATCH_LIMITS } from "./limits";

const handleSchema = z
  .string()
  .min(1)
  .max(30)
  .transform((v) => v.replace(/^@/, "").toLowerCase())
  .refine((v) => /^[a-z0-9._]+$/.test(v), {
    message: "Handle inválido. Use letras, números, ponto ou underline.",
  });

export const createProfileSchema = z.object({
  source: z.enum(["self", "competitor", "influencer"]),
  handle: handleSchema,
  cadenceHours: z
    .number()
    .int()
    .min(PROFILE_WATCH_LIMITS.cadenceMinHours)
    .max(PROFILE_WATCH_LIMITS.cadenceMaxHours)
    .default(24),
  consentVersion: z.literal(CURRENT_CONSENT_VERSION),
});

export const patchProfileSchema = z.object({
  status: z.enum(["active", "paused"]).optional(),
  cadenceHours: z
    .number()
    .int()
    .min(PROFILE_WATCH_LIMITS.cadenceMinHours)
    .max(PROFILE_WATCH_LIMITS.cadenceMaxHours)
    .optional(),
});

export const ackSuggestionSchema = z.object({
  acknowledged: z.boolean(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type PatchProfileInput = z.infer<typeof patchProfileSchema>;
