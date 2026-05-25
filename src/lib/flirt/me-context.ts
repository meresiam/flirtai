// W6 — Memória do Homem.
// Constrói o bloco "Sobre o usuário" injetado no system prompt do /api/coach.
// Marcado com cache_control: ephemeral pelo caller — o conteúdo só muda quando
// o user edita /me, e o último N de winSamples/redPatterns é capado pra evitar
// inflar o prompt (cap defensivo de 12 itens cada na render, mesmo que o DB
// guarde até 100/200).

import type { CoachToneId } from "@/lib/flirt/system-prompt";

export type MeContextInput = {
  tone?: CoachToneId | null;
  age?: number | null;
  locationCity?: string | null;
  contextLife?: string | null;
  demographics?: unknown; // Json — { relationship?, kids? } opcional
  winSamples?: unknown; // string[]
  redPatterns?: unknown; // string[] consolidados
  redPatternsRaw?: unknown; // string[] crus
  onboardingDone?: boolean;
};

const RENDER_CAP = 12;

export function buildMeContext(profile: MeContextInput | null | undefined): string | null {
  if (!profile) return null;

  const lines: string[] = [];
  const hasAnyField =
    profile.age != null ||
    !!profile.locationCity ||
    !!profile.contextLife ||
    isNonEmptyObject(profile.demographics) ||
    asStringArray(profile.winSamples).length > 0 ||
    asStringArray(profile.redPatterns).length > 0 ||
    asStringArray(profile.redPatternsRaw).length > 0;

  if (!hasAnyField) return null;

  lines.push("Sobre o usuário (este homem é quem você está aconselhando):");

  const facts: string[] = [];
  if (profile.age != null) facts.push(`Idade: ${profile.age}`);
  if (profile.locationCity) facts.push(`Cidade: ${profile.locationCity}`);
  if (profile.contextLife) facts.push(`Contexto: ${profile.contextLife}`);
  const demo = pickDemographics(profile.demographics);
  if (demo) facts.push(demo);
  if (facts.length) {
    lines.push(`- ${facts.join(" · ")}`);
  }

  const wins = asStringArray(profile.winSamples).slice(-RENDER_CAP);
  if (wins.length) {
    lines.push("");
    lines.push("Abordagens que JÁ FUNCIONARAM pra ele (mantenha a coerência de voz):");
    for (const sample of wins) {
      lines.push(`- ${truncate(sample, 220)}`);
    }
  }

  const reds = asStringArray(profile.redPatterns).slice(-RENDER_CAP);
  if (reds.length) {
    lines.push("");
    lines.push("Padrões problemáticos detectados (evite repetir):");
    for (const pattern of reds) {
      lines.push(`- ${truncate(pattern, 220)}`);
    }
  }

  // redPatternsRaw é menos curado — só aparece em forma sintetizada (count)
  // pra não inflar prompt enquanto W8 não consolida.
  const rawCount = asStringArray(profile.redPatternsRaw).length;
  if (rawCount > 0 && reds.length === 0) {
    lines.push("");
    lines.push(
      `O usuário marcou ${rawCount} sugestão(ões) como "não funcionou" recentemente — calibre com mais cuidado.`,
    );
  }

  return lines.join("\n");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function isNonEmptyObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

function pickDemographics(value: unknown): string | null {
  if (!isNonEmptyObject(value)) return null;
  const obj = value as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof obj.relationship === "string" && obj.relationship.trim()) {
    parts.push(`Estado civil: ${obj.relationship}`);
  }
  if (typeof obj.kids === "number" && obj.kids >= 0) {
    parts.push(`Filhos: ${obj.kids}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}
