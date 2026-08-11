import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      // Pages nécessitant une session : le storageState contient un cookie
      // pb_session valide signé avec AUTH_SECRET de l'environnement.
      name: "chromium",
      testIgnore: /e2e\/public\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/state.json",
      },
    },
    {
      // Pages publiques et redirections : aucun cookie de session.
      name: "no-auth",
      testMatch: /e2e\/public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
