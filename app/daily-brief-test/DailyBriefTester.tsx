"use client";

import { useState } from "react";
import { Send, ExternalLink, CheckCircle2, XCircle, Info } from "lucide-react";
import Link from "next/link";
import { launchDailyBrief, type DailyBriefLaunchResult } from "@/app/actions/daily-brief";
import { Button } from "@/components/ui/Button";

export function DailyBriefTester() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DailyBriefLaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async () => {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(await launchDailyBrief());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setPending(false);
    }
  };

  const skipped = result && "skipped" in result ? result.skipped : null;
  const sentResult = result && "sent" in result ? result : null;

  return (
    <div className="space-y-6">
      <Button variant="primary" size="lg" loading={pending} leftIcon={<Send className="w-4 h-4" />} onClick={handleLaunch}>
        Générer et envoyer le brief
      </Button>

      {error && (
        <p className="flex items-start gap-2 text-[13px] text-[var(--danger)]">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {skipped && (
        <div className="flex items-start gap-2 text-[13px] text-[var(--warm)]">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Brief non envoyé : <span className="font-medium">{skipped}</span>.
          </span>
        </div>
      )}

      {sentResult && (
        <div
          className={`flex items-start gap-2 text-[13px] ${
            sentResult.sent ? "text-[var(--success)]" : "text-[var(--warm)]"
          }`}
        >
          {sentResult.sent ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>
            {sentResult.sent
              ? `Brief généré et push envoyé à ${sentResult.devices} appareil(s).`
              : `Brief généré mais aucun push envoyé (${sentResult.devices} appareil(s) ciblé(s)).`}
          </span>
        </div>
      )}

      <div className="pt-4 border-t border-[var(--border-1)]">
        <Link
          href="/notif/daily-brief"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--accent-cool)] hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Voir le brief du jour
        </Link>
      </div>

      <p className="flex items-start gap-2 text-[12px] text-[var(--text-4)] leading-relaxed">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Le vrai envoi quotidien a lieu à 7h si le serveur tourne. Cette page permet
        de tester le même chemin à la demande.
      </p>
    </div>
  );
}
