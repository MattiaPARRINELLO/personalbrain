import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_DIR = path.join(os.tmpdir(), "backstage-test-" + Date.now());

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

describe("readJsonSafe - corruption", () => {
  it("retourne le fallback si le fichier principal contient du JSON invalide", async () => {
    const filePath = path.join(TEST_DIR, "data", "corrupt.json");
    fs.writeFileSync(filePath, "{not valid json", "utf-8");

    const storage = await getStorage();
    const data = await storage.readJsonSafe<{ value: number }>("corrupt.json", { value: 42 });
    expect(data).toEqual({ value: 42 });
  });

  it("récupère depuis le .tmp si le fichier principal est corrompu", async () => {
    const filePath = path.join(TEST_DIR, "data", "corrupt2.json");
    const tmpPath = filePath + ".tmp";
    fs.writeFileSync(filePath, "garbage", "utf-8");
    fs.writeFileSync(tmpPath, JSON.stringify({ fromTmp: true }), "utf-8");

    const storage = await getStorage();
    const data = await storage.readJsonSafe<{ fromTmp: boolean }>("corrupt2.json", { fromTmp: false });
    expect(data).toEqual({ fromTmp: true });
  });

  it("récupère depuis le backup le plus récent si principal + .tmp sont corrompus", async () => {
    const filename = "corrupt3.json";
    const filePath = path.join(TEST_DIR, "data", filename);
    const tmpPath = filePath + ".tmp";
    const backupDir = path.join(TEST_DIR, "data", "backups");
    fs.mkdirSync(backupDir, { recursive: true });

    fs.writeFileSync(filePath, "garbage", "utf-8");
    fs.writeFileSync(tmpPath, "also garbage", "utf-8");

    // Deux backups : le plus récent doit être utilisé.
    fs.writeFileSync(
      path.join(backupDir, `${filename}.2020-01-01T00-00-00-000Z.bak`),
      JSON.stringify({ from: "oldBackup" }),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(backupDir, `${filename}.2026-01-01T00-00-00-000Z.bak`),
      JSON.stringify({ from: "newBackup" }),
      "utf-8"
    );

    const storage = await getStorage();
    const data = await storage.readJsonSafe<{ from: string }>(filename, { from: "fallback" });
    expect(data).toEqual({ from: "newBackup" });
  });

  it("retourne le fallback si rien n'est récupérable", async () => {
    const storage = await getStorage();
    const data = await storage.readJsonSafe<{ value: string }>(
      "does-not-exist.json",
      { value: "default" }
    );
    expect(data).toEqual({ value: "default" });
  });
});

describe("writeJsonAtomic - concurrence", () => {
  it("sérialise 2 écritures simultanées sur le même fichier sans corruption", async () => {
    const storage = await getStorage();
    const filename = "concurrent.json";

    const write = async (payload: { n: number; tag: string }) => {
      await storage.writeJsonAtomic(filename, payload);
    };

    await Promise.all([
      write({ n: 1, tag: "first" }),
      write({ n: 2, tag: "second" }),
    ]);

    const raw = fs.readFileSync(path.join(TEST_DIR, "data", filename), "utf-8");
    const parsed = JSON.parse(raw);
    expect([{ n: 1, tag: "first" }, { n: 2, tag: "second" }]).toContainEqual(parsed);
  });

  it("sérialise 10 écritures simultanées sur le même fichier", async () => {
    const storage = await getStorage();
    const filename = "concurrent-many.json";

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        storage.writeJsonAtomic(filename, { i, payload: `value-${i}` })
      )
    );

    const raw = fs.readFileSync(path.join(TEST_DIR, "data", filename), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty("i");
    expect(parsed).toHaveProperty("payload");
    expect(typeof parsed.i).toBe("number");
  });
});

describe("writeJsonAtomic - retry exponentiel", () => {
  it("réessaie sur erreur transitoire puis réussit", async () => {
    const storage = await getStorage();
    const filename = "retry.json";

    const writeFileSpy = vi.spyOn(fs.promises, "writeFile");
    writeFileSpy.mockImplementationOnce(async () => {
      const err = new Error("EACCES") as NodeJS.ErrnoException;
      err.code = "EACCES";
      throw err;
    });

    try {
      await storage.writeJsonAtomic(filename, { ok: true });
      expect(writeFileSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      const raw = fs.readFileSync(path.join(TEST_DIR, "data", filename), "utf-8");
      expect(JSON.parse(raw)).toEqual({ ok: true });
    } finally {
      writeFileSpy.mockRestore();
    }
  });

  it("throw après épuisement des retries sur erreur transitoire persistante", async () => {
    const storage = await getStorage();
    const filename = "retry-fail.json";

    const writeFileSpy = vi.spyOn(fs.promises, "writeFile");
    writeFileSpy.mockImplementation(async () => {
      const err = new Error("EACCES") as NodeJS.ErrnoException;
      err.code = "EACCES";
      throw err;
    });

    try {
      await expect(
        storage.writeJsonAtomic(filename, { ok: false })
      ).rejects.toThrow("EACCES");
      expect(writeFileSpy).toHaveBeenCalledTimes(3);
    } finally {
      writeFileSpy.mockRestore();
    }
  });

  it("throw immédiatement sur erreur non transitoire", async () => {
    const storage = await getStorage();
    const filename = "non-transient.json";

    const writeFileSpy = vi.spyOn(fs.promises, "writeFile");
    writeFileSpy.mockImplementation(async () => {
      const err = new Error("Bad path") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    });

    try {
      await expect(
        storage.writeJsonAtomic(filename, { ok: false })
      ).rejects.toThrow("Bad path");
      expect(writeFileSpy).toHaveBeenCalledTimes(1);
    } finally {
      writeFileSpy.mockRestore();
    }
  });
});
