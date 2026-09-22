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

  test("l'accueil affiche le hero et ses raccourcis", async ({ page }) => {
    await page.goto("/chat");
    const home = page.getByRole("region", { name: "Accueil du chat" });
    await expect(home).toBeVisible({ timeout: 10_000 });
    await expect(home.locator("h1")).toBeVisible();
    // Les libellés sont contextuels : on vérifie le nombre de raccourcis, pas
    // leur texte (qui dépend des données réelles du serveur de dev).
    await expect(
      home.getByRole("region", { name: "Raccourcis" }).locator("button")
    ).toHaveCount(4);
  });

  test("le panneau de droite expose ses vues et bascule sans erreur", async ({ page }) => {
    await page.goto("/chat");
    const panel = page.getByRole("complementary", { name: "Panneau de contexte" });
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const tabs = panel.getByRole("tablist", { name: "Vues du panneau" });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole("tab")).toHaveCount(5);
    // La vue par défaut est le flux chronologique.
    await expect(tabs.getByRole("tab", { name: "Flux" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Bascule vers l'agenda : la carte dédiée remplace la ligne de temps.
    await tabs.getByRole("tab", { name: "Agenda" }).click();
    await expect(tabs.getByRole("tab", { name: "Agenda" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(panel.getByRole("heading", { name: "Agenda" })).toBeVisible();
  });

  test("l'historique expose son bandeau de compteurs", async ({ page }) => {
    await page.goto("/chat");
    const history = page.getByRole("complementary", { name: "Historique des conversations" });
    await expect(history).toBeVisible({ timeout: 10_000 });
    await expect(history.getByRole("link", { name: "Rappels ouverts" })).toBeVisible();
    await expect(history.getByRole("link", { name: "Mails non lus" })).toBeVisible();
    await expect(history.getByRole("link", { name: "Série LeetCode" })).toBeVisible();
    await expect(history.getByRole("button", { name: "Nouvelle conversation" })).toBeVisible();
  });
});
