// WR-03 — fonte única pra locales e timezones aceitos pelo produto.
// Importado em ambos lados pra fechar drift entre backend (Zod enum) e
// frontend (UI <select>). Sem isso, o regex aceitava ~600 IANAs / centenas
// de locales que a UI não oferecia, deixando o GET retornar valores que o
// <select> renderiza vazios.

export const LOCALE_IDS = ["pt-BR", "en-US", "es-ES"] as const;
export type LocaleId = (typeof LOCALE_IDS)[number];

export const TIMEZONE_IDS = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Noronha",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Madrid",
] as const;
export type TimezoneId = (typeof TIMEZONE_IDS)[number];
