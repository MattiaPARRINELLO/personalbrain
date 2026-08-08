import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const originalCwd = process.cwd;
// Le storage fige DATA_DIR (process.cwd() + "data") au chargement du module :
// on garde donc un TEST_DIR CONSTANT (pattern de storage.test.ts) et on vide
// le dossier data/ entre chaque test.
const TEST_DIR = path.join(os.tmpdir(), "backstage-sync-test-" + Date.now());

beforeEach(() => {
  process.cwd = () => TEST_DIR;
  // Nettoyage complet du dossier data (fichiers, backups, server-cache, locks).
  fs.rmSync(path.join(TEST_DIR, "data"), { recursive: true, force: true });
  fs.mkdirSync(path.join(TEST_DIR, "data"), { recursive: true });
  process.env.MICROSOFT_CLIENT_ID = "id";
  process.env.MICROSOFT_CLIENT_SECRET = "secret";
  process.env.MICROSOFT_REDIRECT_URI = "http://localhost:3000/api/auth/microsoft/callback";
});

afterEach(() => {
  process.cwd = originalCwd;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

async function getSync() {
  return import("@/lib/reminder-sync");
}
async function getStorage() {
  return import("@/lib/storage");
}

// Compte Microsoft "connecté" : token valide dans data/.
async function linkMicrosoft() {
  await fs.promises.writeFile(
    path.join(TEST_DIR, "data", "microsoft-todo-token.json"),
    JSON.stringify({
      access_token: "valid",
      refresh_token: "refresh",
      expiry_date: Date.now() + 3_600_000,
    }),
    "utf-8"
  );
}

function mockFetchRoutes(routes: { url: string; method?: string; response: () => unknown | Promise<unknown>; status?: number }[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      const route = routes.find((r) => (r.method ?? "GET") === method && u.includes(r.url));
      if (!route) throw new Error(`Route non mockée: ${method} ${u}`);
      const body = await route.response();
      if (route.status === 404) {
        return { ok: false, status: 404, text: async () => "Not Found" };
      }
      return { ok: true, status: 200, json: async () => body };
    })
  );
}

describe("reminder-sync", () => {
  it("pushNew lie la tâche créée côté Microsoft au rappel local", async () => {
    await linkMicrosoft();
    const storage = await getStorage();
    const reminder = await storage.addReminder({ title: "Acheter du pain", dueAt: "2026-08-08T08:00:00.000Z" });

    mockFetchRoutes([
      { url: "/me/todo/lists?$top=100", response: () => ({ value: [{ id: "list-1", displayName: "Tâches", wellknownListName: "tasks" }] }) },
      { url: "/me/todo/lists/list-1/tasks", method: "POST", response: () => ({ id: "task-1", title: "Acheter du pain", status: "notStarted", createdDateTime: new Date().toISOString(), lastModifiedDateTime: new Date().toISOString() }) },
    ]);

    const sync = await getSync();
    const linked = await sync.pushNewReminderToMicrosoft(reminder);

    expect(linked.microsoftTaskId).toBe("task-1");
    expect(linked.microsoftListId).toBe("list-1");

    const data = await storage.getReminders();
    expect(data.reminders[0].microsoftTaskId).toBe("task-1");
  });

  it("pushNew ne crée rien si le compte Microsoft n'est pas lié", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const storage = await getStorage();
    const reminder = await storage.addReminder({ title: "Local only", dueAt: "2026-08-08T08:00:00.000Z" });

    const sync = await getSync();
    const linked = await sync.pushNewReminderToMicrosoft(reminder);

    expect(linked.microsoftTaskId).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("réconciliation : tâche supprimée côté MS → suppression locale", async () => {
    await linkMicrosoft();
    const storage = await getStorage();
    await storage.addReminder({ title: "Lié", dueAt: "2026-08-08T08:00:00.000Z" });
    const data1 = await storage.getReminders();
    await storage.updateReminder(data1.reminders[0].id, {
      microsoftTaskId: "task-gone",
      microsoftListId: "list-1",
    });

    mockFetchRoutes([
      { url: "/me/todo/lists/list-1/tasks/task-gone", response: () => null, status: 404 },
    ]);

    const sync = await getSync();
    await sync.reconcileRemindersWithMicrosoft();

    const after = await storage.getReminders();
    expect(after.reminders).toHaveLength(0);
  });

  it("réconciliation : tâche MS plus récente → appliquée localement", async () => {
    await linkMicrosoft();
    const storage = await getStorage();
    await storage.addReminder({ title: "Ancien titre", dueAt: "2026-08-08T08:00:00.000Z" });
    const data1 = await storage.getReminders();
    // updatedAt volontairement ancien pour que MS gagne
    await storage.updateReminder(data1.reminders[0].id, {
      microsoftTaskId: "task-1",
      microsoftListId: "list-1",
      notes: undefined,
    });
    const before = await storage.getReminders();
    const reminder = before.reminders[0];

    const future = new Date(Date.now() + 60_000).toISOString();
    mockFetchRoutes([
      {
        url: "/me/todo/lists/list-1/tasks/task-1",
        response: () => ({
          id: "task-1",
          title: "Modifié sur MS",
          status: "completed",
          dueDateTime: { dateTime: "2026-08-09T09:00:00.000Z", timeZone: "UTC" },
          body: { contentType: "text", content: "Notes MS" },
          createdDateTime: reminder.createdAt,
          lastModifiedDateTime: future,
        }),
      },
    ]);

    const sync = await getSync();
    await sync.reconcileRemindersWithMicrosoft();

    const after = await storage.getReminders();
    const updated = after.reminders[0];
    expect(updated.title).toBe("Modifié sur MS");
    expect(updated.status).toBe("done");
    expect(updated.notes).toBe("Notes MS");
  });

  it("réconciliation : local plus récent → rien n'est appliqué", async () => {
    await linkMicrosoft();
    const storage = await getStorage();
    await storage.addReminder({ title: "Local à jour", dueAt: "2026-08-08T08:00:00.000Z" });
    const data1 = await storage.getReminders();
    await storage.updateReminder(data1.reminders[0].id, {
      microsoftTaskId: "task-1",
      microsoftListId: "list-1",
    });

    const past = new Date(Date.now() - 60_000).toISOString();
    mockFetchRoutes([
      {
        url: "/me/todo/lists/list-1/tasks/task-1",
        response: () => ({
          id: "task-1",
          title: "Titre MS périmé",
          status: "notStarted",
          createdDateTime: new Date().toISOString(),
          lastModifiedDateTime: past,
        }),
      },
    ]);

    const sync = await getSync();
    await sync.reconcileRemindersWithMicrosoft();

    const after = await storage.getReminders();
    expect(after.reminders[0].title).toBe("Local à jour");
    expect(after.reminders[0].status).toBe("pending");
  });
});
