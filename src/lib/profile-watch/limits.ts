// Limites operacionais do Profile Watch.
// Tudo env-configurable. Defaults pensados pra MVP B2B.

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const PROFILE_WATCH_LIMITS = {
  /** Quantos perfis no total um user pode ter (qualquer source). */
  perUser: num("PROFILES_PER_USER_LIMIT", 3),
  /** Tamanho do batch processado por chamada do cron. */
  cronBatchSize: num("PROFILE_WATCH_BATCH_SIZE", 50),
  /** Cadência mínima/máxima permitida (horas). */
  cadenceMinHours: num("PROFILE_WATCH_CADENCE_MIN", 6),
  cadenceMaxHours: num("PROFILE_WATCH_CADENCE_MAX", 168),
  /** Janela de geração de relatório (horas). 24h => relatório diário. */
  reportWindowHours: num("PROFILE_WATCH_REPORT_WINDOW", 24),
  /** Retenção em dias antes de purge. */
  retentionDays: num("PROFILE_WATCH_RETENTION_DAYS", 180),
};

export function clampCadence(hours: number): number {
  const { cadenceMinHours, cadenceMaxHours } = PROFILE_WATCH_LIMITS;
  if (!Number.isFinite(hours)) return 24;
  return Math.min(Math.max(Math.round(hours), cadenceMinHours), cadenceMaxHours);
}
