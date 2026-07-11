"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface SubInfo {
  count: number;
  endpoints: string[];
}

export default function NotifTestPage() {
  const { show: toast } = useToast();
  const [subs, setSubs] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [browserPerm, setBrowserPerm] = useState<string>("...");

  useEffect(() => {
    setBrowserPerm(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
    fetchSubs();
  }, []);

  async function fetchSubs() {
    try {
      const res = await fetch("/api/push");
      const data = (await res.json()) as SubInfo;
      setSubs(data);
    } catch {
      setSubs(null);
    }
  }

  async function sendTest() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test BACKSTAGE", message: "Notification de test depuis la page debug" }),
      });
      const data = (await res.json()) as { sent: number; failed: number; count: number };
      setResult(`Envoyé à ${data.sent}/${data.count} appareil(s), ${data.failed} échec(s)`);
      toast({ message: `Test envoyé à ${data.sent} appareil(s)` });
    } catch {
      setResult("Erreur réseau");
    }
    setLoading(false);
  }

  async function testBrowserNotif() {
    if (!("Notification" in window)) {
      setResult("Notifications navigateur non supportées");
      return;
    }
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      setBrowserPerm(perm);
      if (perm !== "granted") {
        setResult("Permission refusée");
        return;
      }
    }
    new Notification("Test navigateur", {
      body: "Ceci est une notification directe du navigateur",
      icon: "/icons/icon-192.png",
    });
    setResult("Notification navigateur affichée");
    setBrowserPerm(Notification.permission);
  }

  return (
    <AppShell>
      <PageHeader title="Test notifications" />

      <div className="max-w-xl mx-auto p-4 space-y-6">
        <section className="rounded-xl border border-[var(--border-1)] p-4 space-y-3">
          <h2 className="text-xs font-mono text-[var(--text-3)]">PERMISSION NAVIGATEUR</h2>
          <p className="text-sm font-mono">
            Statut : <span className={browserPerm === "granted" ? "text-green-400" : "text-[var(--warm)]"}>{browserPerm}</span>
          </p>
          <Button size="sm" onClick={testBrowserNotif}>
            Tester notification navigateur
          </Button>
        </section>

        <section className="rounded-xl border border-[var(--border-1)] p-4 space-y-3">
          <h2 className="text-xs font-mono text-[var(--text-3)]">PUSH SUBSCRIPTIONS</h2>
          <p className="text-sm font-mono">
            {subs ? `${subs.count} appareil(s) enregistré(s)` : "Chargement..."}
          </p>
          {subs && subs.endpoints.length > 0 && (
            <ul className="space-y-1">
              {subs.endpoints.map((ep, i) => (
                <li key={i} className="text-[10px] font-mono text-[var(--text-4)] break-all">{ep}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={fetchSubs} variant="ghost">
              Rafraîchir
            </Button>
            <Button size="sm" onClick={sendTest} disabled={loading || !subs || subs.count === 0}>
              {loading ? "Envoi..." : "Envoyer test push à tous"}
            </Button>
          </div>
        </section>

        {result && (
          <div className="rounded-xl border border-[var(--warm)]/30 bg-[var(--warm)]/10 p-3">
            <p className="text-xs font-mono">{result}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
