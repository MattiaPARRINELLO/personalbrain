import { test, expect } from "@playwright/test";

// Specs avec session (storageState) : uniquement des pages en lecture pure
// (/brain charge la mémoire sans mutation, /chat affiche le composer sans
// envoyer). Aucun backend IA réel, aucune écriture, aucune notification.

test.describe("Navigation authentifiée", () => {
  test("le rail affiche les 4 destinations principales", async ({ page }) => {
    await page.goto("/brain");
    await expect(page.getByRole("link", { name: "Console IA" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Aujourd'hui" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cerveau" })).toBeVisible();
    await expect(page.getByRole("link", { name: "À voir" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Toutes les pages" })).toBeVisible();
  });

  test("le menu Toutes les pages liste les pages secondaires", async ({ page }) => {
    await page.goto("/brain");
    await page.getByRole("button", { name: "Toutes les pages" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Rappels" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Calendrier" })).toBeVisible();
    // "Paramètres" existe aussi dans le rail : on cible celui du menu.
    await expect(dialog.getByRole("link", { name: "Paramètres" })).toBeVisible();
  });

  test("la page Cerveau se charge avec une session", async ({ page }) => {
    await page.goto("/brain");
    await expect(page.getByRole("heading", { name: "Cerveau" })).toBeVisible();
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("Chat", () => {
  test("le composer est visible avec une session (sans envoi de message)", async ({ page }) => {
    await page.goto("/chat");
    const composer = page.locator("textarea").first();
    await expect(composer).toBeVisible({ timeout: 10_000 });
  });
});
