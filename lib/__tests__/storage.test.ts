import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_DIR = path.join(os.tmpdir(), "personalbrain-test-" + Date.now());

// Rediriger process.cwd() vers notre dossier de test
const originalCwd = process.cwd;
beforeEach(() => {
  process.cwd = () => TEST_DIR;
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, "data"), { recursive: true });
});

afterEach(() => {
  process.cwd = originalCwd;
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

// Ces imports doivent être après le mock de process.cwd dans les tests
// On les importe dynamiquement pour chaque test
async function getStorage() {
  return import("@/lib/storage");
}

describe("storage - concerts", () => {
  it("retourne les données par défaut si le fichier n'existe pas", async () => {
    const storage = await getStorage();
    const data = await storage.getConcerts();
    expect(data.events).toBeDefined();
    expect(data.events.length).toBeGreaterThan(0);
    expect(data.events[0].artist).toBe("Muse");
  });

  it("sauvegarde et lit les concerts", async () => {
    const storage = await getStorage();
    await storage.saveConcerts({
      events: [{ id: "99", artist: "Test Band", venue: "Test Venue", date: "2026-01-01", status: "shooted" }],
    });
    const loaded = await storage.getConcerts();
    expect(loaded.events).toHaveLength(1);
    expect(loaded.events[0].artist).toBe("Test Band");
  });
});

describe("storage - reminders", () => {
  beforeEach(async () => {
    const storage = await getStorage();
    // Nettoie les reminders entre chaque test
    const data = await storage.getReminders();
    for (const r of data.reminders) {
      await storage.deleteReminder(r.id);
    }
  });

  it("crée et liste les reminders", async () => {
    const storage = await getStorage();
    const r = await storage.addReminder({ title: "Test reminder", dueAt: "2026-07-15T10:00:00Z" });
    expect(r.title).toBe("Test reminder");
    expect(r.status).toBe("pending");

    const data = await storage.getReminders();
    expect(data.reminders).toHaveLength(1);
    expect(data.reminders[0].title).toBe("Test reminder");
  });

  it("supprime un reminder", async () => {
    const storage = await getStorage();
    const r = await storage.addReminder({ title: "To delete", dueAt: "2026-07-15T10:00:00Z" });
    const deleted = await storage.deleteReminder(r.id);
    expect(deleted).toBe(true);

    const data = await storage.getReminders();
    expect(data.reminders).toHaveLength(0);
  });

  it("retourne false si le reminder n'existe pas", async () => {
    const storage = await getStorage();
    const deleted = await storage.deleteReminder("nonexistent");
    expect(deleted).toBe(false);
  });
});

describe("storage - emails", () => {
  it("recherche des emails par contenu", async () => {
    const storage = await getStorage();
    const results = await storage.searchEmails("Faustine");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].from).toContain("Faustine");
  });

  it("ne retourne rien pour une requête sans résultat", async () => {
    const storage = await getStorage();
    const results = await storage.searchEmails("xyznonexistent");
    expect(results).toHaveLength(0);
  });
});

describe("storage - watch later", () => {
  it("ajoute un item et le retrouve", async () => {
    const storage = await getStorage();
    await storage.addWatchLaterItem({
      url: "https://example.com/article",
      title: "Test Article",
      category: "article",
    });
    const data = await storage.getWatchLater();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe("Test Article");
    expect(data.items[0].source).toBe("example.com");
  });
});
