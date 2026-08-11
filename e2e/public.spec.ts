import { test, expect } from "@playwright/test";

// Specs "no-auth" : uniquement des pages publiques et des redirections.
// Aucune mutation possible (pas de session, pas de serveur réel appelé).

test.describe("Pages publiques", () => {
  test("la page de login affiche un bouton de connexion passkey", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.locator("h1, h2, button").filter({ hasText: /connexion|authentification|passkey|Se connecter|Créer/i }).first()
    ).toBeVisible();
  });

  test("la landing / rend du contenu", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("Deny-by-default : redirections et 401 sans session", () => {
  for (const path of ["/reminders", "/chat", "/today", "/gmail", "/brain", "/watch-later"]) {
    test(`${path} redirige vers /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("/api/reminders répond 401 JSON", async ({ request }) => {
    const res = await request.get("/api/reminders");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
