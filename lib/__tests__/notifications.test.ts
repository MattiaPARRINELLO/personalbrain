/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("notifications (node)", () => {
  it("getNotificationPermission retourne unsupported côté serveur", async () => {
    const { getNotificationPermission } = await import("@/lib/notifications");
    expect(getNotificationPermission()).toBe("unsupported");
  });

  it("requestNotificationPermission retourne unsupported côté serveur", async () => {
    const { requestNotificationPermission } = await import("@/lib/notifications");
    expect(await requestNotificationPermission()).toBe("unsupported");
  });

  it("fireBrowserNotification retourne null côté serveur", async () => {
    const { fireBrowserNotification } = await import("@/lib/notifications");
    const result = fireBrowserNotification({ title: "Test" });
    expect(result).toBeNull();
  });
});
