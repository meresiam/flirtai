// Stub do cliente Graph API Meta (Instagram Business).
// Implementação completa fica na Wave 4 (depende de App Review da Meta).
// Hoje, qualquer chamada gera erro previsível pra que /api/cron/profile-scan
// marque o perfil como erro com mensagem clara.

import type { ScrapedProfile } from "./types";

export class MetaGraphNotConfiguredError extends Error {
  constructor() {
    super(
      "Self-Coach via Graph API ainda não disponível — aguardando App Review da Meta.",
    );
    this.name = "MetaGraphNotConfiguredError";
  }
}

export async function fetchSelfProfile(_args: {
  accessToken: string;
  graphUserId: string;
}): Promise<ScrapedProfile> {
  throw new MetaGraphNotConfiguredError();
}
