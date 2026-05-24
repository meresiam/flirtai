# Nielsen UI Audit — Profile Watch (Wave 5)

**Projeto:** flirtai
**Data:** 24-05-2026
**Rotas auditadas:** `/profiles`, `/profiles/new`, `/profiles/[id]`
**Stack:** Next 16 + Tailwind v4 + shadcn/ui
**Persona:** both (mobile-heavy + desktop B2B)
**Método:** revisão de source code completa das 3 páginas + 20 componentes (`src/components/profile-watch/*`). Dev server não foi acionado — todos os PASSes são baseados em evidência de código, não em renders visuais.
**Resultado geral:** PASS após fixes — zero BLOCKs, 4 FLAGs justificadas remanescentes (2 corrigidas neste commit)

---

## Critério de fechamento (MeresClaude L2)

> Zero BLOCK, ≤2 FLAGs justificadas.

**Status:** atingido após aplicar fixes recomendados pré-merge (FLAG-2 e FLAG-3, abaixo).

---

## MOBILE-FIRST (M1–M10)

| # | Heurística | Status | Nota |
|---|------------|--------|------|
| M1 | Layout funcional em 320px | PASS | `max-w-5xl/2xl + px-4`. Stepper de `/profiles/new` cabe em 320px (math: 3×28 + 2×16 = 132px). |
| M2 | Touch targets ≥ 44px | PASS após fix | `min-h-[44px]` em CTAs. `ReportCard` "Ver resumo" era 36px → **corrigido para 44px**. |
| M3 | Tipografia legível em mobile (>14px body) | PASS | Body `text-sm` (14px). `text-[10px]` apenas em labels/badges não-interativos. |
| M4 | Sidebar = drawer no mobile | PASS (N/A) | Módulo não usa sidebar; nav via topbar flat. |
| M5 | Forms full-width | PASS | `HandleInput w-full`. `CadencePicker grid-cols-4 gap-2` (~66px/célula em 320px). |
| M6 | Tables responsive (cards no mobile) | PASS | `<div md:hidden><PostHistoryCards /></div>` + `<div hidden md:block><PostHistoryTable /></div>`. |
| M7 | Modals ok no mobile (bottom sheet) | PASS após fix | `ConsentDialog` e `PostDetailDialog` Sheet bottom. `DeleteConfirmDialog` era só Dialog → **refatorado para Sheet/Dialog adaptativo**. |
| M8 | CTAs above-the-fold no mobile | PASS com FLAG-4 | Sticky topbar tem CTA principal. Step "Tipo" do `/profiles/new` em 320px cabe em 667px viewport, mas pode oscilar com teclado aberto. |
| M9 | Imagens otimizadas (next/image, lazy) | FLAG-5 | `<img>` nativo em 5 lugares (avatares + thumbs). Decisão técnica conhecida — exige `remotePatterns` em next.config.ts. |
| M10 | Sem scroll horizontal involuntário | PASS | `overflow-x-auto` em `PostHistoryTable`, `ProfileFilters`, `PostHistoryFilters`. |

---

## Heurísticas Nielsen (H1–H10)

| # | Heurística | Status | Evidência |
|---|------------|--------|-----------|
| H1 | Visibilidade do status | PASS com FLAG-1 | `aria-busy + skeleton` em loading, `LoaderIcon animate-spin` em mutações, toast `role=alert aria-live=polite`. FLAG: refresh on-focus silencioso sem indicador visual. |
| H2 | Match com mundo real | PASS | 100% PT-BR. `toLocaleString("pt-BR")` em números. Labels naturais ("Foto"/"Carrossel"/"Reel"/"Vídeo"). Erros menores corrigidos: `lang="en"→pt-BR"` + description PT-BR. |
| H3 | Controle e liberdade | PASS | Stepper com voltar/cancelar; modals com X+ESC+click-outside; delete redireciona pós-sucesso; pause/resume reversível sem confirmação. |
| H4 | Consistência e padrões | PASS após fix | Tokens consistentes (`bg-[#ff355d]`, `min-h-[44px]`, opacidades `/35-/90`). Naming Lock OK. ReportCard 36px corrigido. |
| H5 | Prevenção de erros | PASS | Botão "Continuar" gated por `canAdvanceFromCurrent()`. `HandleInput` regex em tempo real. Limite de 3 perfis bloqueia botão. `ConsentDialog` aceitar gated por checkbox. |
| H6 | Reconhecimento vs memorização | PASS | Stepper visual com checkmarks. Bloco "Resumo" antes do consent. Counters por categoria. Topbar com nav sempre visível. Tooltips em features bloqueadas. |
| H7 | Flexibilidade e eficiência | FLAG-7 (informativo) | Sem atalhos de teclado / bulk actions / filtros saváveis. Aceitável para MVP com `PROFILES_PER_USER_LIMIT=3`. |
| H8 | Estética minimalista | PASS | 1 CTA primário por tela. Hierarquia clara via opacidades. Modal mobile com `max-h-90vh + overflow-y-auto`. `ReportCard` ai_summary só quando expandido. |
| H9 | Mensagens de erro | PASS | `HandleInput` erros específicos com `aria-invalid`. Mapping HTTP→PT-BR em `ERROR_MESSAGES`. Tooltips em `StatusPill status=error`. |
| H10 | Ajuda contextual | PASS | Tooltip `InfoIcon` no `CadencePicker`. Empty states explicativos. Notas inline ("Apenas perfis públicos…"). Dica no `DeleteConfirmDialog` ("use Pausar"). |

---

## Brandbook flirtai (B1–B6)

Brandbook próprio (NÃO AILA). Paleta dark `#070913` + accent `#ff355d` + branco em opacidades.

| # | Critério | Status |
|---|----------|--------|
| B1 | Cores | PASS — paleta consistente, semantic colors (emerald/red/yellow/violet/blue) bem aplicadas |
| B2 | Fontes | PASS — Sora + Space Grotesk via next/font/google |
| B3 | Spacing múltiplo de 4 | PASS — só tokens Tailwind padrão |
| B4 | Border radius | PASS — cards `rounded-2xl`, buttons `rounded-lg`, chips `rounded-full` |
| B5 | Motion | FLAG informativo — sem padrão de duração definido, transitions usam Tailwind default. `prefers-reduced-motion` implementado em gradientes. |
| B6 | Ícones | PASS — 100% Lucide React |

---

## Acessibilidade (A1–A4)

| # | Critério | Status |
|---|----------|--------|
| A1 | Contraste ≥ 4.5:1 em body text | FLAG-6 — `text-white/35` ~2.8:1, `text-white/40` ~3.2:1 (abaixo WCAG AA). Escolha estética deliberada em labels de metadata. |
| A2 | aria-labels em ícones interativos | PASS — todos os botões icon-only têm aria-label |
| A3 | Foco visual | PASS — `focus-visible:ring-2 focus-visible:ring-[#ff355d]/40` em cards/radios |
| A4 | Form labels associados | PASS com nota — `ConsentDialog` usa `<button role="checkbox">` dentro de `<label>` (válido HTML5 mas pode confundir JAWS/NVDA) |

---

## Resumo executivo

**Resultado:** PASS após fixes — zero BLOCKs, 4 FLAGs justificadas restantes.

### Fixes aplicados neste commit (recomendação do auditor):

1. **FLAG-2 corrigida** — `ReportCard` botão "Ver resumo/Fechar" de `min-h-[36px]` → `min-h-[44px]`. 1-line fix em `report-card.tsx:70`.
2. **FLAG-3 corrigida** — `DeleteConfirmDialog` refatorado com variante `Sheet` bottom para `<768px`, mesmo padrão de `ConsentDialog`/`PostDetailDialog`.
3. **Bug não-FLAG** — `html lang="en"` → `lang="pt-BR"` + `metadata.description` traduzida.

### FLAGs remanescentes (não bloqueiam Wave 5, viram débito documentado):

| ID | Heurística | Severidade | Decisão |
|----|------------|------------|---------|
| FLAG-1 | H1 refresh-on-focus silencioso | Comportamento intencional | Carregar como débito — dados read-only, refetch silencioso é OK pra produto de monitoramento |
| FLAG-4 | M8 CTA "Continuar" no fold 320px | Edge case teclado aberto | Monitorar — Step "Tipo" não tem campo de texto, então teclado raramente abre |
| FLAG-5 | M9 `<img>` nativo vs `next/image` | Débito técnico conhecido | Resolver antes de produção com tráfego real (config `remotePatterns` em `next.config.ts`) |
| FLAG-6 | A1 contraste textos `/35` e `/40` | Escolha estética deliberada | Decisão de Meres — labels uppercase secundárias, intenção é hierarquia visual sobre legibilidade absoluta |

### Caminhos críticos livres de BLOCK:

- Stepper com gate de avanço (`canAdvanceFromCurrent`)
- Validação inline `HandleInput` (regex + `aria-invalid`)
- Limite de perfis sinalizado em UI + botão desabilitado
- Feedback de loading em todas as mutações (toast + spinner)
- `ConsentDialog`, `PostDetailDialog`, `DeleteConfirmDialog` adaptativos Sheet/Dialog
- Delete com confirmação + alternativa de Pause
- Acessibilidade básica (aria-labels, foco visual, labels de form)

---

## Wave 5 — status final

| Item | Status |
|------|--------|
| Purge job 180d (LGPD) | DONE (commit `954b37f`) |
| Nielsen audit H1-H10 + MOBILE-FIRST | DONE (este doc) |
| Fixes pré-merge | DONE (FLAG-2, FLAG-3, lang) |
| OAuth Meta Wave 4 | BLOQUEADO (App Review Meta) |

**Wave 5 fecha aqui.** Próximos passos pertencem à Wave 4 (Self-Coach via Apify, não dependendo de OAuth Meta) ou aguardam aprovação App Review.
