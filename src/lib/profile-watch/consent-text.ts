// Termo de consentimento versionado para Profile Watch.
// Mudança no texto -> bump CURRENT_VERSION e força re-aceite em perfis existentes
// (job de migration manual fora deste arquivo).

export const CURRENT_CONSENT_VERSION = "2026-05-v1";

interface ConsentTerms {
  version: string;
  publishedAt: string;
  body: string;
}

const TERMS: Record<string, ConsentTerms> = {
  "2026-05-v1": {
    version: "2026-05-v1",
    publishedAt: "2026-05-23",
    body: `**Termo de Uso — Profile Watch**

Ao cadastrar um perfil público do Instagram para monitoramento, você declara que:

1. **Base legal (LGPD).** O monitoramento será feito com base no legítimo interesse comercial (inteligência competitiva, análise de portfólio de influencers) ou execução de contrato (auto-análise do próprio perfil), em conformidade com a Lei 13.709/2018.

2. **Somente perfis públicos.** O Profile Watch não acessa perfis privados, mensagens diretas, lista de seguidores, ou qualquer dado restrito da plataforma.

3. **Sem inferência sobre vida pessoal.** Nenhuma análise é feita sobre vida afetiva, orientação, saúde, ou outros dados sensíveis. As métricas tratadas são exclusivamente públicas e agregadas (cadência, formato, engajamento).

4. **Sem perseguição.** O serviço NÃO pode ser usado para monitorar pessoa específica sem vínculo legítimo. Cadastro de ex-parceiros, conhecidos pessoais ou alvos de assédio configura uso indevido e enseja suspensão imediata da conta, sem prejuízo de comunicação às autoridades quando cabível.

5. **Conformidade com ToS do Instagram.** O serviço respeita rate-limits, não realiza scraping em massa, e cessa o monitoramento imediatamente em caso de bloqueio pela plataforma.

6. **Retenção limitada.** Snapshots e posts coletados são mantidos por 180 dias. Após esse período, são removidos automaticamente.

7. **Direitos do titular.** A pessoa titular do perfil monitorado pode, a qualquer momento, solicitar a remoção dos dados via canal de contato indicado. Solicitação é atendida em até 15 dias.

Você é o controlador dos dados que cadastra para monitoramento. A FlirtAI atua como operadora.`,
  },
};

export function getConsentTerms(version = CURRENT_CONSENT_VERSION): ConsentTerms {
  const terms = TERMS[version];
  if (!terms) throw new Error(`Versão de termo desconhecida: ${version}`);
  return terms;
}
