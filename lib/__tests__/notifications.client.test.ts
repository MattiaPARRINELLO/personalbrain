/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";


async function getModule() {
  return import("@/lib/notifications");
}

describe("notifications (browser)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("getNotificationPermission retourne granted", async () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    const mod = await getModule();
    expect(mod.getNotificationPermission()).toBe("granted");
  });

  it("getNotificationPermission retourne denied", async () => {
    vi.stubGlobal("Notification", { permission: "denied" });
    const mod = await getModule();
    expect(mod.getNotificationPermission()).toBe("denied");
  });

  it("requestNotificationPermission ne demande pas si déjà granted", async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal("Notification", { permission: "granted", requestPermission });
    const mod = await getModule();
    expect(await mod.requestNotificationPermission()).toBe("granted");
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("requestNotificationPermission ne demande pas si déjà denied", async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal("Notification", { permission: "denied", requestPermission });
    const mod = await getModule();
    expect(await mod.requestNotificationPermission()).toBe("denied");
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("requestNotificationPermission demande et retourne le résultat", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    const mod = await getModule();
    expect(await mod.requestNotificationPermission()).toBe("granted");
    expect(requestPermission).toHaveBeenCalled();
  });

  it("fireBrowserNotification retourne null si permission pas granted", async () => {
    vi.stubGlobal("Notification", { permission: "denied" });
    const mod = await getModule();
    expect(mod.fireBrowserNotification({ title: "Test" })).toBeNull();
  });

  it("fireBrowserNotification crée une notification si granted", async () => {
    const NotificationMock = vi.fn(function () { return {}; });
    Object.assign(NotificationMock, { permission: "granted", requestPermission: vi.fn() });
    vi.stubGlobal("Notification", NotificationMock);
    const mod = await getModule();
    const result = mod.fireBrowserNotification({ title: "Test", body: "Hello" });
    expect(result).not.toBeNull();
  });

  it("fireBrowserNotification appelle onClick et close", async () => {
    const close = vi.fn();
    const NotificationMock = vi.fn(function () { return { close }; });
    Object.assign(NotificationMock, { permission: "granted", requestPermission: vi.fn() });
    vi.stubGlobal("Notification", NotificationMock);
    const mod = await getModule();
    const n = mod.fireBrowserNotification({ title: "Test", onClick: vi.fn() });
    expect(n).not.toBeNull();
    (n as unknown as { onclick: () => void }).onclick();
    expect((n as unknown as { close: () => void }).close).toHaveBeenCalled();
  });

  it("fireBrowserNotification retourne null si new Notification lance", async () => {
    const NotificationMock = vi.fn(function () { throw new Error("fail"); });
    Object.assign(NotificationMock, { permission: "granted", requestPermission: vi.fn() });
    vi.stubGlobal("Notification", NotificationMock);
    const mod = await getModule();
    const result = mod.fireBrowserNotification({ title: "Test" });
    expect(result).toBeNull();
  });
});
