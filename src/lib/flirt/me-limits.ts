// WR-05 — caps centralizados pra evitar drift entre os 3 sites que
// referenciam o mesmo dado (DB write em /api/me/profile/feedback,
// render no me-context que vai pro system prompt do coach, e display
// na pagina /me).
//
// Importe daqui em vez de hardcodar numeros literais. Quando W8 trocar
// o storage layer, atualizar so este arquivo previne desalinhamento.

export const WIN_SAMPLES_DB_CAP = 100;
export const RED_PATTERNS_RAW_DB_CAP = 200;
export const ME_CONTEXT_RENDER_CAP = 12;
export const ME_PAGE_DISPLAY_CAP = 20;
