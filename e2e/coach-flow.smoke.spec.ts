import { expect, test } from "@playwright/test";

/**
 * Smoke E2E — Wave 0 / C3.
 *
 * Fluxo coberto: signup novo → criar contato → mandar mensagem pro /api/coach.
 *
 * Estratégia anti-flake:
 *  - email único por run (Date.now())
 *  - mock do /api/coach via route handler do Playwright (não bate na Anthropic real,
 *    pra smoke ser rápido + offline + sem custo)
 *  - se a UI ainda não tiver `data-testid`s estáveis, esse smoke usa labels visíveis em PT-BR
 *    e quebra ruidosamente quando a copy mudar — sinal correto.
 */

const APP = "/login";

test("login → criar contato → mandar /coach (mockado)", async ({ page }) => {
  const email = `smoke+${Date.now()}@flirtai.test`;
  const password = "Sm0ke!Test#2026";

  // 1) signup (ou login se já existir) — usar a página /login que tem ambos os modos
  await page.goto(APP);
  await expect(page).toHaveURL(/\/login/);

  // O fluxo de signup do better-auth varia conforme a UI. Tentamos signup primeiro;
  // se a UI já tiver o usuário, caímos pro login direto.
  const signupLink = page.getByRole("link", { name: /criar conta|cadastrar|sign up/i });
  if (await signupLink.isVisible().catch(() => false)) {
    await signupLink.click();
  }

  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha|password/i).fill(password);
  await page.getByRole("button", { name: /entrar|criar|cadastrar|signup/i }).click();

  // Aguarda redirect pra app autenticada
  await page.waitForURL(/\/(desenrolos|chat|home)/, { timeout: 30_000 });

  // 2) Criar contato — abre o flow de novo desenrolo
  const newContact = page.getByRole("button", { name: /novo desenrolo|nova contato|adicionar/i });
  await newContact.first().click();
  await page.getByLabel(/nome/i).fill("Bia Smoke");
  await page.getByLabel(/fonte|onde/i).fill("Instagram");
  await page.getByRole("button", { name: /salvar|criar/i }).click();

  // 3) Mock do /api/coach pra não bater na Anthropic real
  await page.route("**/api/coach", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assistantMessage: "Boa, manda essa.",
        suggestions: [
          { tone: "playful", text: "oi", why: "leve" },
          { tone: "confident", text: "te chamei pra sair", why: "direto" },
          { tone: "intriguing", text: "tenho uma teoria sobre você", why: "puxa curiosidade" },
        ],
        insight: {
          interestLevel: "Medium",
          read: "ela respondeu rápido",
          move: "puxa encontro casual",
          avoid: "não overexplain",
        },
        contact: {
          name: "Bia Smoke",
          source: "Instagram",
          status: "hot_lead",
          attractionLevel: "High",
          personalityType: "intelectual",
          interests: ["livro"],
          tags: ["potencial alto"],
          lastInteractionSummary: "topou marcar",
        },
        messageId: "smoke-msg-id",
      }),
    });
  });

  // 4) Mandar mensagem
  const input = page.getByPlaceholder(/cola a mensagem|o que ela disse|mensagem/i);
  await input.fill("oi, ela mandou só 'oi' agora");
  await page.getByRole("button", { name: /enviar|mandar|coach/i }).click();

  // 5) Resposta do coach aparece (qualquer pedaço do mock)
  await expect(page.getByText(/boa, manda essa/i)).toBeVisible({ timeout: 10_000 });
});
