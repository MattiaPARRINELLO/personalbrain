import { describe, it, expect, beforeEach, vi } from "vitest";

// Simule le stockage JSON par fichier : readJsonSafe lit le store partagé,
// mutateJson applique le mutator sous "lock" et persiste le résultat.
const store = new Map<string, unknown>();

const mockReadJsonSafe = vi.fn(async (_file: string, fallback: unknown) => {
  return structuredClone(store.get("push-subscriptions.json") ?? fallback);
});

const mockMutateJson = vi.fn(
  async (file: string, fallback: SubsData, mutator: (data: SubsData) => SubsData | null | void) => {
    const current = structuredClone(store.get(file) ?? fallback) as SubsData;
    const res = mutator(current);
    const next = res ?? current;
    store.set(file, next);
    return next;
  }
);

vi.mock("@/lib/storage", () => ({
  readJsonSafe: mockReadJsonSafe,
  writeJsonAtomic: vi.fn(),
}));
vi.mock("@/lib/storage-core", () => ({ mutateJson: mockMutateJson }));

type SubsData = { subscriptions: unknown[] };

const { getSubscriptions, addSubscription, removeSubscription } = await import("@/lib/push-subscriptions");

const sub1 = {
  endpoint: "https://push.example.com/1",
  expirationTime: null,
  keys: { p256dh: "key1", auth: "auth1" },
};

const sub2 = {
  endpoint: "https://push.example.com/2",
  expirationTime: 9999999999,
  keys: { p256dh: "key2", auth: "auth2" },
};

describe("push-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
  });

  it("getSubscriptions retourne un tableau vide par défaut", async () => {
    const subs = await getSubscriptions();
    expect(subs).toEqual([]);
  });

  it("getSubscriptions retourne les abonnements existants", async () => {
    store.set("push-subscriptions.json", { subscriptions: [sub1, sub2] });
    const subs = await getSubscriptions();
    expect(subs).toHaveLength(2);
    expect(subs[0].endpoint).toBe("https://push.example.com/1");
  });

  it("addSubscription ajoute un nouvel abonnement", async () => {
    await addSubscription(sub1);
    expect(store.get("push-subscriptions.json")).toEqual({ subscriptions: [sub1] });
  });

  it("addSubscription ne duplique pas un abonnement existant (même endpoint)", async () => {
    store.set("push-subscriptions.json", { subscriptions: [sub1] });
    await addSubscription(sub1);
    const stored = store.get("push-subscriptions.json") as { subscriptions: typeof sub1[] };
    expect(stored.subscriptions).toHaveLength(1);
  });

  it("removeSubscription supprime un abonnement par endpoint", async () => {
    store.set("push-subscriptions.json", { subscriptions: [sub1, sub2] });
    await removeSubscription(sub1.endpoint);
    expect(store.get("push-subscriptions.json")).toEqual({ subscriptions: [sub2] });
  });

  it("removeSubscription ne change rien pour un endpoint inexistant", async () => {
    store.set("push-subscriptions.json", { subscriptions: [sub1] });
    await removeSubscription("https://push.example.com/unknown");
    expect(store.get("push-subscriptions.json")).toEqual({ subscriptions: [sub1] });
  });
});
