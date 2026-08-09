"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function DailyBriefTestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[daily-brief-test] Erreur de rendu:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <AlertTriangle className="w-10 h-10 text-[var(--warm)] mb-5" />
      <h1 className="text-[15px] font-semibold text-[var(--text-1)]">
        La page test a rencontré une erreur
      </h1>
      <p className="mt-2 max-w-md text-[12.5px] text-[var(--text-3)] leading-relaxed">
        {error.message || "Erreur inconnue"}
        {error.digest ? ` (digest ${error.digest})` : ""}
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button variant="primary" onClick={reset} leftIcon={<RotateCcw className="w-4 h-4" />}>
          Réessayer
        </Button>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-3)] hover:text-[var(--text-1)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Accueil
        </Link>
      </div>
    </div>
  );
}
