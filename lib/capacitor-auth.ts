import { isCapacitor } from "./capacitor";

type AuthCallback = (token: string) => void;

let listeners: AuthCallback[] = [];

export function onCapTokenReceived(cb: AuthCallback) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function notifyListeners(token: string) {
  listeners.forEach((cb) => cb(token));
}

export async function parseTokenFromFragment(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace(/^#/, "?"));
  const token = params.get("token") || params.get("access_token");
  return token;
}

export function setupCapacitorAuthListener() {
  if (!isCapacitor() || typeof window === "undefined") return;

  import("@capacitor/app")
    .then(({ App }) => {
      App.addListener("appUrlOpen", (data) => {
        const url = data.url;
        if (!url || !url.startsWith("backstage://auth")) return;

        try {
          const parsed = new URL(url);
          const token = parsed.searchParams.get("token") || parsed.hash.replace(/^#/, "");
          if (token) {
            notifyListeners(token);
          }
        } catch {
          // ignore malformed URLs
        }
      });
    })
    .catch(() => {
      // Capacitor not available
    });
}

export async function openAuthInBrowser() {
  if (!isCapacitor()) return;

  const { Browser } = await import("@capacitor/browser");

  const baseUrl = window.location.origin;

  await Browser.open({
    url: `${baseUrl}/login?cap=1`,
    presentationStyle: "popover",
  });
}

export function setCapSessionCookie(token: string) {
  return fetch("/api/auth/set-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ token }),
  });
}
