// Guard de versão de consentimento para Profile Watch.
//
// Decisão de design (C8 / W4):
// - Operações iniciadas pelo USUÁRIO (scan manual, mudança de cadência, reativação)
//   BLOQUEIAM quando consentVersion !== CURRENT_CONSENT_VERSION.
// - O CRON (profile-scan automático) NÃO é bloqueado aqui: o usuário já consentiu
//   numa versão anterior, e a pressão regulatória se aplica apenas a ações novas
//   iniciadas pelo próprio usuário. Quando ele falhar em reaceitar e o perfil
//   for pausado/desativado, o cron para por `status !== "active"`.
// - Pausar é SEMPRE permitido mesmo com consent expirado — é até desejável,
//   pois impede coleta até o reaceite.
// - DELETE é sempre permitido (usuário tem direito de remover a qualquer momento).

import { NextResponse } from "next/server";

import type { MonitoredProfile } from "@prisma/client";

import { CURRENT_CONSENT_VERSION } from "./consent-text";

export interface ConsentStaleError {
  error: string;
  code: "consent_outdated";
  currentVersion: string;
  acceptedVersion: string;
  reacceptUrl: string;
}

/**
 * Retorna `null` se o consent do perfil está em dia.
 * Retorna um `NextResponse` 409 pronto pra ser devolvido se estiver desatualizado.
 */
export function requireFreshConsent(
  profile: Pick<MonitoredProfile, "id" | "consentVersion">,
): NextResponse<ConsentStaleError> | null {
  if (profile.consentVersion === CURRENT_CONSENT_VERSION) return null;

  return NextResponse.json<ConsentStaleError>(
    {
      error:
        "Termo de uso foi atualizado. Releia e reaceite para continuar monitorando este perfil.",
      code: "consent_outdated",
      currentVersion: CURRENT_CONSENT_VERSION,
      acceptedVersion: profile.consentVersion,
      reacceptUrl: `/profiles/${profile.id}?reaccept=consent`,
    },
    { status: 409 },
  );
}
