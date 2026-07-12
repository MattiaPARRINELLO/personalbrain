import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  readJsonSafe: vi.fn(),
  writeJsonAtomic: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);

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
  });

  it("getSubscriptions retourne un tableau vide par défaut", async () => {
    mockStorage.readJsonSafe.mockResolvedValue({ subscriptions: [] });
    const subs = await getSubscriptions();
    expect(subs).toEqual([]);
  });

  it("getSubscriptions retourne les abonnements existants", async () => {
    mockStorage.readJsonSafe.mockResolvedValue({ subscriptions: [sub1, sub2] });
    const subs = await getSubscriptions();
    expect(subs).toHaveLength(2);
    expect(subs[0].endpoint).toBe("https://push.example.com/1");
  });

  it("addSubscription ajoute un nouvel abonnement", async () => {
    mockStorage.readJsonSafe.mockResolvedValue({ subscriptions: [] });
    await addSubscription(sub1);
    expect(mockStorage.writeJsonAtomic).toHaveBeenCalledWith("push-subscriptions.json", {
      subscriptions: [sub1],
    });
  });

  it("addSubscription ne duplique pas un abonnement existant (même endpoint)", async () => {
    mockStorage.readJsonSafe.mockResolvedValue({ subscriptions: [sub1] });
    await addSubscription(sub1);
    expect(mockStorage.writeJsonAtomic).not.toHaveBeenCalled();
  });

  it("removeSubscription supprime un abonnement par endpoint", async () => {
    mockStorage.readJsonSafe.mockResolvedValue({ subscriptions: [sub1, sub2] });
    await removeSubscription(sub1.endpoint);
    expect(mockStorage.writeJsonAtomic).toHaveBeenCalledWith("push-subscriptions.json", {
      subscriptions: [sub2],
    });
  });

  it("removeSubscription ne fait rien pour un endpoint inexistant", async () => {
    mockStorage.readJsonSafe.mockResolvedValue({ subscriptions: [sub1] });
    await removeSubscription("https://push.example.com/unknown");
    expect(mockStorage.writeJsonAtomic).toHaveBeenCalledWith("push-subscriptions.json", {
      subscriptions: [sub1],
    });
  });
});
