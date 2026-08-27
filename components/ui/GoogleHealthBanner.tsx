"use client";

import { useEffect, useState } from "react";
import { useCachedFetch } from "@/lib/cache";
import { api, type GoogleHealth } from "@/lib/api-client";

const HEALTH_KEY = "google:health";
const HEALTH_TTL_MS = 5 * 60 * 1000;

type AccountKey = "gmail" | "calendar";
const ACCOUNT_LABELS: Record<AccountKey, string> = {
  gmail: "Gmail",
  calendar: "Google Agenda",
};

/**
 * Bannière de santé des connexions Google.
 * - broken : un refresh a échoué (invalid_grant) — reconnecter est obligatoire.
 * - expiringSoon : le lien approche des 7 jours du mode Testing (app non
 *   vérifiée) — reconnecter bientôt, avant la casse.
 * Re-fetch au retour du focus ; état rechargé depuis le serveur à chaque fois.
 */
export function GoogleHealthBanner() {
  const { data } = useCachedFetch<GoogleHealth>(HEALTH_KEY, api.googleHealth, {
    ttl: HEALTH_TTL_MS,
  });
  const [dismissedExpiring, setDismissedExpiring] = useState(false);

  useEffect(() => {
    const onFocus = () => {
      void api.googleHealth().then((fresh) => {
        if (fresh.gmail.broken || fresh.calendar.broken) {
          setDismissedExpiring(false);
        }
      });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (!data?.gmail.linked && !data?.calendar.linked) return null;

  const broken = Object.keys(ACCOUNT_LABELS).filter(
    (k) => data[k as AccountKey].linked && data[k as AccountKey].broken
  ) as AccountKey[];

  if (broken.length > 0) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-2"
      >
        <p className="min-w-0 text-[12px] text-[var(--danger)]">
          {broken.map((k) => ACCOUNT_LABELS[k]).join(" et ")} à reconnecter — l'accès
          a expiré ({broken.length > 1 ? "les deux comptes" : "le compte"}).
        </p>
        <a
          href={`/api/auth/google?type=${broken[0]}`}
          className="shrink-0 rounded-md border border-[var(--danger)]/50 px-3 py-1 text-[12px] font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/15"
        >
          Reconnecter
        </a>
      </div>
    );
  }

  const expiring = Object.keys(ACCOUNT_LABELS).filter(
    (k) => data[k as AccountKey].expiringSoon
  ) as AccountKey[];

  if (expiring.length > 0 && !dismissedExpiring) {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-3 border-b border-[#d4a373]/30 bg-[#d4a373]/10 px-4 py-2"
      >
        <p className="min-w-0 text-[12px] text-[#d4a373]">
          {expiring.map((k) => ACCOUNT_LABELS[k]).join(" et ")} expirent bientôt
          (application non vérifiée) — reconnectez quand vous pouvez pour éviter
          une coupure.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`/api/auth/google?type=${expiring[0]}`}
            className="rounded-md border border-[#d4a373]/50 px-3 py-1 text-[12px] font-medium text-[#d4a373] transition-colors hover:bg-[#d4a373]/15"
          >
            Reconnecter
          </a>
          <button
            type="button"
            aria-label="Masquer l'avertissement"
            onClick={() => setDismissedExpiring(true)}
            className="rounded-md p-1 text-[#8f91a0] transition-colors hover:text-[#f5f3f0]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
}