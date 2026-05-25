// W7 — Diário de Campo.
// Tool definition Anthropic pro extractor síncrono usado em POST /api/contacts/:id/encounters.
// O LLM recebe o rawText do user + contexto da Contact e devolve sinais estruturados.
// O contrato JSON aqui é a única fonte de verdade — tipos TS e zod runtime parser derivam dele.

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

export const ENCOUNTER_TOOL_NAME = "submit_encounter_extract";

export const ESCALATION_VALUES = [
  "regrediu",
  "estagnou",
  "avancou",
  "indefinido",
] as const;

export const MOOD_VALUES = [
  "leve",
  "tenso",
  "intenso",
  "frustrante",
  "neutro",
] as const;

export const ATTRACTION_DELTA_VALUES = ["down", "same", "up"] as const;

export const encounterExtractSchema = z
  .object({
    summary: z.string().min(1).max(240),
    escalation: z.enum(ESCALATION_VALUES),
    mood: z.enum(MOOD_VALUES),
    nextMove: z.string().min(1).max(180),
    attractionDelta: z.enum(ATTRACTION_DELTA_VALUES),
    greenFlags: z.array(z.string().min(1).max(80)).max(6).default([]),
    redFlags: z.array(z.string().min(1).max(80)).max(6).default([]),
    userRedPatterns: z.array(z.string().min(1).max(120)).max(3).default([]),
  })
  .strict();

export type EncounterExtract = z.infer<typeof encounterExtractSchema>;

export const encounterToolSchema: Anthropic.Tool = {
  name: ENCOUNTER_TOOL_NAME,
  description:
    "Extrai sinais factuais de um relato pos-encontro (texto livre PT-BR) do usuario sobre uma Contact. " +
    "Voce e UM EXTRATOR, nao um conselheiro. Saida em PT-BR, curta, factual, sem opiniao. " +
    "userRedPatterns so deve ser populado se o relato do USUARIO indicar padrao problematico DELE (nao dela).",
  input_schema: {
    type: "object",
    required: [
      "summary",
      "escalation",
      "mood",
      "nextMove",
      "attractionDelta",
      "greenFlags",
      "redFlags",
      "userRedPatterns",
    ],
    properties: {
      summary: {
        type: "string",
        description:
          "1-2 frases factuais sobre o que aconteceu no encontro. Max 240 chars. " +
          "Vai sobrescrever Contact.lastInteractionSummary.",
      },
      escalation: {
        type: "string",
        enum: [...ESCALATION_VALUES],
        description:
          "Como o relacionamento se moveu DEPOIS desse encontro: " +
          "regrediu (esfriou/recuou) | estagnou (sem mudanca) | avancou (avancou de fase) | indefinido (sem sinal claro).",
      },
      mood: {
        type: "string",
        enum: [...MOOD_VALUES],
        description:
          "Temperatura emocional do USUARIO no encontro (como ele descreveu): " +
          "leve | tenso | intenso | frustrante | neutro.",
      },
      nextMove: {
        type: "string",
        description:
          "1 frase PT-BR com a recomendacao concreta de proximo passo. Max 180 chars. " +
          "Exemplo: 'Espera 2-3 dias antes do proximo contato e abre com algo leve.'",
      },
      attractionDelta: {
        type: "string",
        enum: [...ATTRACTION_DELTA_VALUES],
        description:
          "Sinal pra Contact.attractionLevel: down (desceu nivel), same (sem mudanca), up (subiu nivel). " +
          "Use 'same' se nao houver evidencia clara.",
      },
      greenFlags: {
        type: "array",
        maxItems: 6,
        items: { type: "string" },
        description:
          "Sinais positivos NOVOS observados nesse encontro (curto, 1 frase cada, max 80 chars). " +
          "Use array vazio se nenhum novo. Nao repita flags ja conhecidas do Contact.",
      },
      redFlags: {
        type: "array",
        maxItems: 6,
        items: { type: "string" },
        description:
          "Sinais de alerta NOVOS observados (curto, max 80 chars). " +
          "Array vazio se nenhum. Nao repita flags ja conhecidas.",
      },
      userRedPatterns: {
        type: "array",
        maxItems: 3,
        items: { type: "string" },
        description:
          "Padroes problematicos do USUARIO (o homem que esta sendo aconselhado) DETECTADOS NESSE RELATO. " +
          "Max 3, max 120 chars cada. Exemplos: 'insistiu apos sinal claro de desinteresse', " +
          "'falou 80% do tempo sobre si mesmo', 'cancelou no ultimo minuto sem explicar'. " +
          "Use array vazio se nada relevante. NAO INCLUIR padroes DELA aqui — esse campo e so do usuario.",
      },
    },
  },
};
