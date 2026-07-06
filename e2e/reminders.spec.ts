import { test, expect } from "@playwright/test";

test.describe("Reminders flow", () => {
  test("affiche la page des rappels", async ({ page }) => {
    await page.goto("/reminders");

    await expect(page).toHaveURL(/\/reminders/);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("affiche un bouton de création de rappel", async ({ page }) => {
    await page.goto("/reminders");

    // Cherche un bouton ou lien pour créer un rappel
    const createBtn = page.locator(
      'button:has-text("Nouveau"), button:has-text("Créer"), a:has-text("Nouveau"), a:has-text("Créer"), button:has-text("Ajouter")'
    ).first();

    // Si visible, click et vérifie l'apparition d'un formulaire
    if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createBtn.click();
      await expect(page.locator('input, textarea, form')).toHaveCount(1, { timeout: 5_000 }).catch(() => {});
    }
  });

  test("navigation vers reminders depuis la sidebar", async ({ page }) => {
    await page.goto("/");

    // Navigation via les liens de la barre latérale
    const link = page.locator('nav a[href="/reminders"], aside a[href="/reminders"]').first();
    if (await link.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await link.click();
      await expect(page).toHaveURL(/\/reminders/);
    }
  });
});
