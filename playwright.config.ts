import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E config (Wave 0 / C3).
 *
 * Pressupostos:
 *  - dev server local em http://localhost:3000 (rodar `npm run dev` antes OU deixar webServer subir)
 *  - DATABASE_URL apontando pro Postgres dev (docker compose up -d)
 *  - migrations aplicadas (npx prisma migrate dev)
 *  - ANTHROPIC_API_KEY setado (pode ser de teste — o smoke não chama LLM real)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        timeout: 120_000,
        reuseExistingServer: true,
      },
});
