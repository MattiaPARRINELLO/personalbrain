import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFs = {
  mkdir: vi.fn(),
  access: vi.fn(),
  writeFile: vi.fn(),
};

vi.mock("fs", () => ({
  promises: {
    mkdir: (...args: unknown[]) => mockFs.mkdir(...args),
    access: (...args: unknown[]) => mockFs.access(...args),
    writeFile: (...args: unknown[]) => mockFs.writeFile(...args),
  },
}));

const mockStorage = {
  writeJsonAtomic: vi.fn(),
  readJsonSafe: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);

// Simule le read→mutate→write de storage-core pour saveCredential.
type Cred = { id: string; publicKey: string; counter: number };
type CredStore = { credentials: Cred[] };

const credentialStore: { current: CredStore } = { current: { credentials: [] } };
const mockMutateJson = vi.fn(
  async (_file: string, fallback: CredStore, mutator: (data: CredStore) => CredStore | null | void) => {
    const data = structuredClone(credentialStore.current ?? fallback);
    const res = mutator(data);
    credentialStore.current = (res ?? data) as CredStore;
    return credentialStore.current;
  }
);
vi.mock("@/lib/storage-core", () => ({ mutateJson: mockMutateJson }));

const { getUserStore, saveUserStore, hasCredentials, saveCredential, getCredentialById, getRpID, getOrigin, markSetupConsumed, isSetupConsumed } = await import("@/lib/auth");

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.access.mockRejectedValue(new Error("ENOENT"));
    mockFs.mkdir.mockResolvedValue(undefined);
    credentialStore.current = { credentials: [] };
  });

  describe("getUserStore", () => {
    it("crée le dossier data et le fichier users.json si absent", async () => {
      mockStorage.readJsonSafe.mockResolvedValue({ credentials: [] });
      const store = await getUserStore();
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockStorage.writeJsonAtomic).toHaveBeenCalledWith("users.json", { credentials: [] });
      expect(store).toEqual({ credentials: [] });
    });

    it("retourne le store existant", async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockStorage.readJsonSafe.mockResolvedValue({ credentials: [{ id: "cred1", publicKey: "abc", counter: 0 }] });
      const store = await getUserStore();
      expect(store.credentials).toHaveLength(1);
      expect(store.credentials[0].id).toBe("cred1");
    });
  });

  describe("saveUserStore", () => {
    it("écrit le store via writeJsonAtomic", async () => {
      const store = { credentials: [{ id: "cred1", publicKey: "abc", counter: 0 }] };
      await saveUserStore(store);
      expect(mockStorage.writeJsonAtomic).toHaveBeenCalledWith("users.json", store);
    });
  });

  describe("hasCredentials", () => {
    it("retourne false quand il n'y a pas de credentials", async () => {
      mockStorage.readJsonSafe.mockResolvedValue({ credentials: [] });
      expect(await hasCredentials()).toBe(false);
    });

    it("retourne true quand il y a des credentials", async () => {
      mockStorage.readJsonSafe.mockResolvedValue({ credentials: [{ id: "cred1", publicKey: "abc", counter: 0 }] });
      expect(await hasCredentials()).toBe(true);
    });
  });

  describe("saveCredential", () => {
    it("ajoute un nouveau credential", async () => {
      await saveCredential({ id: "cred1", publicKey: "abc", counter: 0 });
      expect(credentialStore.current.credentials).toEqual([
        { id: "cred1", publicKey: "abc", counter: 0 },
      ]);
    });

    it("remplace un credential existant par son id", async () => {
      credentialStore.current = {
        credentials: [{ id: "cred1", publicKey: "abc", counter: 0 }],
      };
      await saveCredential({ id: "cred1", publicKey: "def", counter: 1 });
      expect(credentialStore.current.credentials).toEqual([
        { id: "cred1", publicKey: "def", counter: 1 },
      ]);
    });
  });

  describe("getCredentialById", () => {
    it("retourne un credential existant", async () => {
      mockStorage.readJsonSafe.mockResolvedValue({
        credentials: [{ id: "cred1", publicKey: "abc", counter: 0 }],
      });
      const cred = await getCredentialById("cred1");
      expect(cred).not.toBeNull();
      expect(cred!.publicKey).toBe("abc");
    });

    it("retourne null pour un id inconnu", async () => {
      mockStorage.readJsonSafe.mockResolvedValue({ credentials: [] });
      expect(await getCredentialById("nope")).toBeNull();
    });
  });

  describe("markSetupConsumed / isSetupConsumed", () => {
    it("isSetupConsumed retourne false sans marqueur", async () => {
      mockFs.access.mockRejectedValue(new Error("ENOENT"));
      expect(await isSetupConsumed()).toBe(false);
    });

    it("isSetupConsumed retourne true quand le marqueur existe", async () => {
      mockFs.access.mockResolvedValue(undefined);
      expect(await isSetupConsumed()).toBe(true);
    });

    it("markSetupConsumed écrit le marqueur", async () => {
      mockFs.writeFile.mockResolvedValue(undefined);
      await markSetupConsumed();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe("getRpID", () => {
    it("retourne WEBAUTHN_RP_ID si défini", () => {
      process.env.WEBAUTHN_RP_ID = "example.com";
      const req = new Request("http://localhost");
      expect(getRpID(req)).toBe("example.com");
      delete process.env.WEBAUTHN_RP_ID;
    });

    it("extrait le hostname du header host", () => {
      const req = new Request("http://localhost", { headers: { host: "myapp.com:3000" } });
      expect(getRpID(req)).toBe("myapp.com");
    });

    it("retourne localhost si hostname est localhost", () => {
      const req = new Request("http://localhost", { headers: { host: "localhost:3000" } });
      expect(getRpID(req)).toBe("localhost");
    });
  });

  describe("getOrigin", () => {
    it("retourne WEBAUTHN_ORIGIN si défini", () => {
      process.env.WEBAUTHN_ORIGIN = "https://example.com";
      const req = new Request("http://localhost");
      expect(getOrigin(req)).toBe("https://example.com");
      delete process.env.WEBAUTHN_ORIGIN;
    });

    it("construit l'origine à partir des headers", () => {
      const req = new Request("http://localhost", { headers: { host: "example.com" } });
      expect(getOrigin(req)).toBe("https://example.com");
    });

    it("utilise http pour localhost", () => {
      const req = new Request("http://localhost", { headers: { host: "localhost:3000" } });
      expect(getOrigin(req)).toBe("http://localhost:3000");
    });

    it("utilise x-forwarded-proto si présent", () => {
      const req = new Request("http://localhost", {
        headers: { host: "example.com", "x-forwarded-proto": "http" },
      });
      expect(getOrigin(req)).toBe("http://example.com");
    });
  });
});
