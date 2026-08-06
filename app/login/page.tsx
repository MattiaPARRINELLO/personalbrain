"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { Fingerprint, Loader2, ShieldCheck, AlertCircle, Sparkles, Smartphone, ExternalLink } from "lucide-react";
import { isCapacitor, isWebAuthnSupported } from "@/lib/capacitor";
import { openAuthInBrowser, onCapTokenReceived, setCapSessionCookie, parseTokenFromFragment } from "@/lib/capacitor-auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCapMode = searchParams?.get("cap") === "1";
  const setupToken = searchParams?.get("setupToken") ?? "";

  const [status, setStatus] = useState<"idle" | "loading" | "registering" | "authenticating">("idle");
  const [needsRegistration, setNeedsRegistration] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapacitorApp] = useState(() => isCapacitor() && !isWebAuthnSupported());

  const exchangeTokenAndClose = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/token-exchange", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { token: string | null };
      if (data.token) {
        window.location.replace(`backstage://auth?token=${encodeURIComponent(data.token)}`);
      }
    } catch {
      // fallback: try to close the tab
      window.close();
    }
  }, []);

  useEffect(() => {
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then((res) => res.json() as Promise<{ authenticated: boolean }>)
      .then((data) => {
        if (data.authenticated) {
          if (isCapMode) {
            exchangeTokenAndClose();
          } else {
            router.replace("/chat");
          }
          return;
        }
        return fetch("/api/auth/passkey/register-options", {
          credentials: "same-origin",
          headers: setupToken ? { "x-setup-token": setupToken } : undefined,
        })
          .then(async (res) => {
            const data = (await res.json()) as { isFirstRegistration?: boolean; error?: string };
            if (!res.ok || data.error) {
              // 401 = une passkey existe déjà mais la session est expirée :
              // on bascule sur le flux d'authentification (le bouton « Se connecter »).
              if (res.status === 401) {
                setNeedsRegistration(false);
                return;
              }
              setError(data.error ?? `Impossible de vérifier l'état de l'enregistrement (${res.status}).`);
              return;
            }
            setNeedsRegistration(data.isFirstRegistration ?? false);
          });
      })
      .catch(() => setNeedsRegistration(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, isCapMode]);

  async function handleRegister() {
    if (isCapacitorApp) {
      return openAuthInBrowser();
    }

    setStatus("registering");
    setError(null);
    try {
      const optionsRes = await fetch("/api/auth/passkey/register-options", {
        credentials: "same-origin",
        headers: setupToken ? { "x-setup-token": setupToken } : undefined,
      });
      const optionsData = (await optionsRes.json()) as { options: PublicKeyCredentialCreationOptionsJSON };
      const attestation = await startRegistration({ optionsJSON: optionsData.options });
      const verifyRes = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ response: attestation, setupToken: setupToken || undefined }),
      });
      const verifyData = (await verifyRes.json()) as { verified?: boolean; error?: string };
      if (verifyData.verified) {
        if (isCapMode) {
          await exchangeTokenAndClose();
        } else {
          router.replace("/chat");
        }
      } else {
        setError(verifyData.error ?? "L'enregistrement a échoué.");
        setStatus("idle");
      }
    } catch {
      setError("Impossible d'enregistrer la clé. Utilise un appareil compatible Face ID / Touch ID.");
      setStatus("idle");
    }
  }

  async function handleAuthenticate() {
    if (isCapacitorApp) {
      return openAuthInBrowser();
    }

    setStatus("authenticating");
    setError(null);
    try {
      const optionsRes = await fetch("/api/auth/passkey/auth-options", { credentials: "same-origin" });
      const optionsData = (await optionsRes.json()) as { options?: PublicKeyCredentialRequestOptionsJSON; error?: string };
      if (optionsData.error || !optionsData.options) {
        setError(optionsData.error ?? "Aucune clé enregistrée.");
        setStatus("idle");
        return;
      }
      const assertion = await startAuthentication({ optionsJSON: optionsData.options });
      const verifyRes = await fetch("/api/auth/passkey/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ response: assertion }),
      });
      const verifyData = (await verifyRes.json()) as { verified?: boolean; error?: string };
      if (verifyData.verified) {
        if (isCapMode) {
          await exchangeTokenAndClose();
        } else {
          router.replace("/chat");
        }
      } else {
        setError(verifyData.error ?? "L'authentification a échoué.");
        setStatus("idle");
      }
    } catch {
      setError("Authentification annulée ou impossible. Réessaie.");
      setStatus("idle");
    }
  }

  const isBusy = status !== "idle";
  const label = isCapacitorApp
    ? "Ouvrir l'authentification"
    : needsRegistration === null
      ? "Chargement…"
      : needsRegistration
        ? "Configurer Face ID / Touch ID"
        : "Se connecter avec Face ID / Touch ID";

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl border border-[var(--border-2)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-3)] mb-5 relative">
            <Sparkles className="w-5 h-5 text-[var(--accent)]" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--accent)] breathe" />
          </div>
          <h1 className="text-[20px] font-semibold tracking-tight text-[var(--text-1)]">
            <span className="gradient-text-ai">BACKSTAGE</span>
          </h1>
          <p className="text-[12.5px] text-[var(--text-3)] mt-1.5 leading-relaxed">
            Accès privé. Authentification sans mot de passe.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/60 backdrop-blur">
          <button
            onClick={needsRegistration ? handleRegister : handleAuthenticate}
            disabled={isBusy || needsRegistration === null}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--accent)] text-[#0a0a0b] font-medium text-[13px] hover:brightness-110 active:brightness-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isCapacitorApp ? (
              <ExternalLink className="w-4 h-4" />
            ) : (
              <Fingerprint className="w-4 h-4" />
            )}
            {label}
          </button>

          {error && (
            <div className="mt-4 flex items-start gap-2 text-[11.5px] text-[var(--danger)] leading-relaxed fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isCapacitorApp && (
            <div className="mt-4 flex items-start gap-2 text-[11.5px] text-[var(--text-3)] leading-relaxed">
              <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--accent-cool)]" />
              <span>L&apos;authentification s&apos;ouvre dans ton navigateur, reviens ensuite dans l&apos;app.</span>
            </div>
          )}
        </div>

        <p className="text-[10px] text-[var(--text-4)] mt-6 text-center font-mono uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3 inline-block mr-1 -mt-0.5" />
          Authentification par clé d&apos;accès
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
