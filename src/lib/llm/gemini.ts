// Camada única de acesso ao Gemini (Google GenAI SDK).
// Structured output usa responseMimeType application/json + responseJsonSchema —
// o espelho do tool_use forçado que o app usava na Anthropic. Todo call site
// novo de LLM passa por aqui.

import { GoogleGenAI, type Content } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  // Gemini implicit caching: tokens lidos do cache chegam em
  // cachedContentTokenCount. Não existe custo de "cache write" — o campo
  // cacheCreationTokens fica sempre 0 e só existe pra manter o shape do
  // UsageLog compatível com as linhas históricas da era Anthropic.
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

export function resolveGeminiModel(userOverride?: string | null): string {
  return userOverride || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

export function usageFromResponse(meta?: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
}): LlmUsage {
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
    cacheReadTokens: meta?.cachedContentTokenCount ?? 0,
    cacheCreationTokens: 0,
  };
}

interface StructuredCallInput {
  client: GoogleGenAI;
  model: string;
  system?: string;
  contents: Content[];
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export async function generateStructured<T>({
  client,
  model,
  system,
  contents,
  schema,
  maxOutputTokens,
  signal,
}: StructuredCallInput): Promise<{ data: T; usage: LlmUsage }> {
  const response = await client.models.generateContent({
    model,
    contents,
    config: {
      ...(system ? { systemInstruction: system } : {}),
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      maxOutputTokens,
      ...(signal ? { abortSignal: signal } : {}),
    },
  });

  const text = response.text;
  if (!text) throw new Error("Resposta vazia do Gemini.");
  return {
    data: JSON.parse(text) as T,
    usage: usageFromResponse(response.usageMetadata),
  };
}

/** Mensagem de erro PT-BR pra falhas do Gemini, com caso especial de modelo inexistente. */
export function geminiErrorMessage(error: unknown, model: string): string {
  const status = (error as { status?: number })?.status;
  if (status === 404) {
    return `Modelo "${model}" não está disponível na API Gemini. Confira GEMINI_MODEL.`;
  }
  if (status === 429) {
    return "Limite de requisições da API Gemini atingido. Tenta de novo em instantes.";
  }
  return error instanceof Error ? error.message : "O FLIRT A.I não conseguiu responder.";
}
