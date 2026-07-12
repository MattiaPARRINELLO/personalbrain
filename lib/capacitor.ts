export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as Record<string, unknown>).Capacitor;
}

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  return isCapacitor();
}

export function isWebAuthnSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.PublicKeyCredential !== "undefined";
}
