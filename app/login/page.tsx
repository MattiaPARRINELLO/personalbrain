"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { Fingerprint, Loader2, ShieldCheck, AlertCircle, Check } from "lucide-react";

type Phase = "checking" | "idle" | "scanning" | "verified" | "error";

const RING_R = 95;

const PHASE_STATUS: Record<Phase, string> = {
  checking: "VÉRIFICATION DE TA CLÉ…",
  idle: "SYSTÈME PRÊT — TOUCHE L'EMPREINTE",
  scanning: "SCAN EN COURS…",
  verified: "CLÉ VÉRIFIÉE — OUVERTURE…",
  error: "",
};

const PHASE_LIGHT: Record<Phase, string> = {
  checking: "var(--text-4)",
  idle: "var(--text-3)",
  scanning: "var(--accent)",
  verified: "var(--success)",
  error: "var(--danger)",
};

const TICKS = [
  "top-0 left-0 border-t-2 border-l-2 rounded-tl",
  "top-0 right-0 border-t-2 border-r-2 rounded-tr",
  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl",
  "bottom-0 right-0 border-b-2 border-r-2 rounded-br",
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupToken = searchParams?.get("setupToken") ?? "";

  const [status, setStatus] = useState<"idle" | "loading" | "registering" | "authenticating">("idle");
  const [needsRegistration, setNeedsRegistration] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstAnchor = useRef<HTMLButtonElement | null>(null);
  const [burstOrigin, setBurstOrigin] = useState<{ x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    },
    []
  );

  useEffect(() => {
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then((res) => res.json() as Promise<{ authenticated: boolean }>)
      .then((data) => {
        if (data.authenticated) {
          router.replace("/chat");
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
  }, [router]);

  const completeAuth = useCallback(() => {
    setVerified(true);
    setBurstOrigin(null);
    if (burstAnchor.current) {
      const rect = burstAnchor.current.getBoundingClientRect();
      setBurstOrigin({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    redirectTimer.current = setTimeout(() => {
      router.replace("/chat");
    }, 1500);
  }, [router]);

  async function handleRegister() {
    if (status !== "idle" || verified) return;

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
        completeAuth();
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
    if (status !== "idle" || verified) return;

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
        completeAuth();
      } else {
        setError(verifyData.error ?? "L'authentification a échoué.");
        setStatus("idle");
      }
    } catch {
      setError("Authentification annulée ou impossible. Réessaie.");
      setStatus("idle");
    }
  }

  const phase: Phase = verified
    ? "verified"
    : status === "registering" || status === "authenticating"
      ? "scanning"
      : error
        ? "error"
        : needsRegistration === null
          ? "checking"
          : "idle";

  const isBusy = status !== "idle" || verified;
  const label = needsRegistration === null
    ? "Chargement…"
    : needsRegistration
      ? "Configurer Face ID / Touch ID"
      : "Se connecter avec Face ID / Touch ID";

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 overflow-hidden">
      {/* Repères de tirage */}
      <div className="fixed inset-4 pointer-events-none z-0" aria-hidden>
        {TICKS.map((tick) => (
          <span
            key={tick}
            className={`login-tick absolute w-3.5 h-3.5 border-[var(--border-3)] ${tick}`}
          />
        ))}
      </div>

      <div className="login-load relative z-10 flex flex-col items-center w-full max-w-sm text-center">
        {/* En-tête */}
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--text-4)]">
          — Accès privé —
        </p>
        <h1 className="mt-4 font-mono font-black tracking-[0.28em] text-[17px] gradient-text-ai">
          BACKSTAGE
        </h1>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--text-3)]">
          Ton visage, ta clé. Aucun mot de passe à retenir.
        </p>

        {/* L'anneau biométrique — la signature */}
        <button
          type="button"
          ref={burstAnchor}
          aria-label={label}
          onClick={() => (needsRegistration ? handleRegister() : handleAuthenticate())}
          disabled={isBusy || needsRegistration === null}
          data-phase={phase}
          className="login-ring relative mt-12 w-48 h-48 rounded-full disabled:cursor-not-allowed hover:scale-[1.03] active:scale-95 transition-transform duration-300"
        >
          <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
            <circle
              cx="100"
              cy="100"
              r={RING_R}
              fill="none"
              strokeWidth="1.5"
              stroke="currentColor"
              opacity="0.12"
            />
            <circle
              cx="100"
              cy="100"
              r={RING_R}
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              stroke="currentColor"
              className="login-progress-arc"
            />
          </svg>

          <span className="login-scan-beam" aria-hidden />
          <span className="login-shockwave" aria-hidden />

          <span className="absolute inset-0 flex items-center justify-center">
            <span className="login-fingerprint">
              <Fingerprint className="w-11 h-11" strokeWidth={1.25} />
            </span>
            <span className="login-check">
              <Check className="w-10 h-10" strokeWidth={1.5} />
            </span>
          </span>
        </button>

        {/* Explosion d'accès — ancre au centre de l'anneau (hors du bouton :
            un transform sur l'ancêtre casserait le position: fixed) */}
        {burstOrigin && (
          <span
            className="login-burst"
            style={{ top: burstOrigin.y, left: burstOrigin.x }}
            aria-hidden
          >
            <span className="login-burst-flash" />
            <span className="login-burst-ring" />
            <span className="login-burst-ring" />
            <span className="login-burst-ring" />
          </span>
        )}

        {/* Ligne de statut */}
        <div className="mt-9 min-h-[22px] flex items-center justify-center gap-2.5 px-4">
          <span
            className="w-1.5 h-1.5 shrink-0 transition-colors duration-300"
            style={{ backgroundColor: PHASE_LIGHT[phase] }}
            aria-hidden
          />
          {phase === "error" ? (
            <span className="flex items-start gap-1.5 text-[12px] text-[var(--danger)] leading-relaxed max-w-[300px] text-left">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </span>
          ) : (
            <span
              className={`text-[10.5px] font-mono uppercase tracking-[0.2em] ${
                phase === "scanning" || phase === "verified"
                  ? "text-[var(--accent)]"
                  : phase === "checking"
                    ? "text-[var(--text-4)]"
                    : "text-[var(--text-3)]"
              }`}
            >
              {PHASE_STATUS[phase]}
            </span>
          )}
        </div>

        {phase === "idle" && (
          <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-4)] fade-in">
            Face ID · Touch ID · Clé de sécurité
          </p>
        )}

        {/* Action secondaire */}
        <button
          type="button"
          onClick={() => (needsRegistration ? handleRegister() : handleAuthenticate())}
          disabled={isBusy || needsRegistration === null}
          className="mt-8 px-7 py-3 border border-[var(--border-2)] text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--text-2)] hover:border-[var(--border-3)] hover:text-[var(--text-1)] hover:border-[var(--warm)]/60 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isBusy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {verified ? "Ouverture…" : label}
            </span>
          ) : (
            label
          )}
        </button>

        <p className="text-[9.5px] text-[var(--text-4)] mt-10 text-center font-mono uppercase tracking-[0.2em]">
          <ShieldCheck className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
          Clé d&apos;accès WebAuthn · Sans mot de passe
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
