"use client";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission as NotificationPermissionState;
  }
  const result = await Notification.requestPermission();
  return result as NotificationPermissionState;
}

export function fireBrowserNotification(opts: {
  title: string;
  body?: string;
  tag?: string;
  icon?: string;
  onClick?: () => void;
}) {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      icon: opts.icon ?? "/favicon.ico",
      silent: false,
    });
    if (opts.onClick) {
      n.onclick = () => {
        window.focus();
        opts.onClick?.();
        n.close();
      };
    }
    return n;
  } catch {
    return null;
  }
}
