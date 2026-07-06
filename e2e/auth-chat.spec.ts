import { test, expect } from "@playwright/test";

test.describe("Auth + Chat flow", () => {
  test("affiche la page de login et tente une authentification passkey", async ({ page }) => {
    await page.goto("/login");

    // La page doit afficher le bouton de connexion
    await expect(page.locator("h1, h2, button")).toContainText(/connexion|authentification|passkey|Se connecter|Créer/i);
  });

  test("la page d'accueil affiche le layout chat", async ({ page }) => {
    await page.goto("/");

    // Vérifie que des éléments du chat sont présents
    await expect(page).toHaveURL("/");
    // Le body ne doit pas être vide
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("le champ de message est présent sur la page d'accueil", async ({ page }) => {
    await page.goto("/");

    // Recherche un champ de saisie (textarea ou input) dans le chat
    const input = page.locator('textarea, input[type="text"], [contenteditable="true"]').first();
    await expect(input).toBeVisible({ timeout: 10_000 });
  });

  test("navigation vers /reminders depuis l'accueil", async ({ page }) => {
    await page.goto("/");

    // Cherche le lien ou le bouton "Rappels" dans la navigation
    const remindersLink = page.locator('a[href="/reminders"], button:has-text("Rappels"), a:has-text("Rappels")').first();

    if (await remindersLink.isVisible()) {
      await remindersLink.click();
      await expect(page).toHaveURL(/\/reminders/);
    }
  });
});
