// W6 — definições compartilhadas entre página /me, /me/onboarding e modal.
// Mantém o catálogo de opções alinhado com o Zod do backend (route.ts).
// Source of truth: docs/DATA-MODEL.md seção UserProfile.

export const CONTEXT_LIFE_OPTIONS = [
  { id: "universitário", label: "Universitário" },
  { id: "corporativo", label: "Corporativo" },
  { id: "autônomo", label: "Autônomo" },
  { id: "atleta", label: "Atleta / disciplina física" },
  { id: "criativo", label: "Criativo / artista" },
  { id: "outro", label: "Outro" },
] as const;

export const RELATIONSHIP_OPTIONS = [
  { id: "solteiro", label: "Solteiro" },
  { id: "namorando", label: "Namorando" },
  { id: "casado", label: "Casado" },
  { id: "divorciado", label: "Divorciado" },
  { id: "viuvo", label: "Viúvo" },
] as const;

export const COACH_TONE_OPTIONS = [
  {
    id: "low_key",
    label: "Low-key",
    description: "Discreto, conciso. Quem está ocupado e responde no tempo dele.",
  },
  {
    id: "direto",
    label: "Direto",
    description: "Vai ao ponto. Convite claro, sem rodeio.",
  },
  {
    id: "provocador",
    label: "Provocador",
    description: "Tensão e teasing calibrado. Nunca grosseria.",
  },
] as const;

export type ContextLifeId = (typeof CONTEXT_LIFE_OPTIONS)[number]["id"];
export type RelationshipId = (typeof RELATIONSHIP_OPTIONS)[number]["id"];
export type CoachToneId = (typeof COACH_TONE_OPTIONS)[number]["id"];

export interface OnboardingAnswers {
  age: number | null;
  locationCity: string | null;
  contextLife: ContextLifeId | null;
  relationship: RelationshipId | null;
  kids: number | null;
  tone: CoachToneId | null;
}

export const EMPTY_ANSWERS: OnboardingAnswers = {
  age: null,
  locationCity: null,
  contextLife: null,
  relationship: null,
  kids: null,
  tone: null,
};

export function answersToPayload(answers: OnboardingAnswers) {
  const demographics: Record<string, unknown> = {};
  if (answers.relationship) demographics.relationship = answers.relationship;
  if (answers.kids != null) demographics.kids = answers.kids;
  return {
    age: answers.age,
    locationCity: answers.locationCity,
    contextLife: answers.contextLife,
    tone: answers.tone,
    demographics: Object.keys(demographics).length > 0 ? demographics : null,
  };
}
