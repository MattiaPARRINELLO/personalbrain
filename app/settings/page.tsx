"use client";

import {
  Palette,
  Mail,
  CalendarRange,
  ListTodo,
  LogOut,
  Check,
  Globe,
  Smartphone,
  Code2,
  Download,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { setLeetcodeUsername, loadLeetcode } from "@/app/actions/leetcode";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AccentPicker } from "@/components/ui/AccentPicker";
import { api, type GoogleLinkStatus, type MicrosoftTodoStatus } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";

const GOOGLE_STATUS_KEY = "google:status";

async function fetchGoogleStatus(): Promise<GoogleLinkStatus> {
  return api.googleStatus();
}

async function fetchMicrosoftStatus(): Promise<MicrosoftTodoStatus> {
  return api.microsoftStatus();
}

export default function SettingsPage() {
  const { data: status, loading } = useCachedFetch<GoogleLinkStatus>(
    GOOGLE_STATUS_KEY,
    fetchGoogleStatus,
    { ttl: 60 * 1000 }
  );

  const { data: msStatus, loading: msLoading } = useCachedFetch<MicrosoftTodoStatus>(
    "microsoft:status",
    fetchMicrosoftStatus,
    { ttl: 60 * 1000 }
  );

  const [leetUsername, setLeetUsername] = useState("");
  const [leetSaving, setLeetSaving] = useState(false);
  const [leetMsg, setLeetMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadLeetcode().then((d) => {
      if (d.leetcodeUsername) setLeetUsername(d.leetcodeUsername);
    }).catch(() => {});
  }, []);

  const handleLeetSave = async () => {
    setLeetSaving(true);
    setLeetMsg(null);
    try {
      await setLeetcodeUsername(leetUsername);
      setLeetMsg({ ok: true, text: "Synchronisé avec LeetCode ✓" });
    } catch (e) {
      setLeetMsg({ ok: false, text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setLeetSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      window.location.replace("/login");
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await fetch("/api/export", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Export impossible");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backstage-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMsg("Export téléchargé ✓");
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Supprimer définitivement TOUTES tes données (conversations, rappels, mémoire, comptes Google connectés) ? Cette action est irréversible."
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        "Confirmation finale : les sauvegardes automatiques seront supprimées aussi. Continuer ?"
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Suppression impossible");
      window.location.replace("/login");
    } catch (err) {
      setDeleteMsg(err instanceof Error ? err.message : "Erreur lors de la suppression");
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <PageHeader
            eyebrow="Préférences"
            title="Paramètres"
            description="Personnalise ton interface et gère tes connexions."
          />

          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Couleur d'accent"
                subtitle="Personnalise la couleur dominante de l'interface."
                action={<Palette className="w-4 h-4 text-[var(--text-3)]" />}
              />
              <CardBody>
                <AccentPicker />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Services Google"
                subtitle="Connecte ou vérifie l'état de tes services Google."
                action={<Globe className="w-4 h-4 text-[var(--text-3)]" />}
              />
              <CardBody>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]/40">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center border"
                        style={{
                          borderColor: status?.gmail
                            ? "var(--success)"
                            : "var(--border-2)",
                          color: status?.gmail
                            ? "var(--success)"
                            : "var(--text-3)",
                        }}
                      >
                        {status?.gmail ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[var(--text-1)]">
                          Gmail
                        </p>
                        <p className="text-[11px] text-[var(--text-3)]">
                          {loading && !status
                            ? "Vérification…"
                            : status?.gmail
                              ? "Connecté"
                              : "Non connecté"}
                        </p>
                      </div>
                    </div>
                    <a
                      href="/api/auth/google?type=gmail"
                      className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                    >
                      {status?.gmail ? "Reconnecter" : "Connecter"}
                    </a>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]/40">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center border"
                        style={{
                          borderColor: status?.calendar
                            ? "var(--success)"
                            : "var(--border-2)",
                          color: status?.calendar
                            ? "var(--success)"
                            : "var(--text-3)",
                        }}
                      >
                        {status?.calendar ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <CalendarRange className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[var(--text-1)]">
                          Calendrier
                        </p>
                        <p className="text-[11px] text-[var(--text-3)]">
                          {loading && !status
                            ? "Vérification…"
                            : status?.calendar
                              ? "Connecté"
                              : "Non connecté"}
                        </p>
                      </div>
                    </div>
                    <a
                      href="/api/auth/google?type=calendar"
                      className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                    >
                      {status?.calendar ? "Reconnecter" : "Connecter"}
                    </a>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Microsoft To Do"
                subtitle="Tes reminders Samsung se synchronisent ici. Connecte ton compte Microsoft pour les lire dans Rappels."
                action={<ListTodo className="w-4 h-4 text-[var(--text-3)]" />}
              />
              <CardBody>
                <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]/40">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center border"
                      style={{
                        borderColor: msStatus?.linked
                          ? "var(--success)"
                          : "var(--border-2)",
                        color: msStatus?.linked
                          ? "var(--success)"
                          : "var(--text-3)",
                      }}
                    >
                      {msStatus?.linked ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <ListTodo className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-1)]">
                        Microsoft To Do
                      </p>
                      <p className="text-[11px] text-[var(--text-3)]">
                        {msLoading && !msStatus
                          ? "Vérification…"
                          : msStatus?.linked
                            ? "Connecté"
                            : "Non connecté"}
                      </p>
                    </div>
                  </div>
                  <a
                    href="/api/auth/microsoft"
                    className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                  >
                    {msStatus?.linked ? "Reconnecter" : "Connecter"}
                  </a>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="LeetCode"
                subtitle="Ton pseudo pour synchroniser les stats automatiquement"
                action={<Code2 className="w-4 h-4 text-[var(--text-3)]" />}
              />
              <CardBody>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={leetUsername}
                    onChange={(e) => setLeetUsername(e.target.value)}
                    placeholder="ton-pseudo-leetcode"
                    className="flex-1 px-3 py-1.5 text-[13px]"
                  />
                  <Button
                    size="sm"
                    onClick={handleLeetSave}
                    disabled={leetSaving || !leetUsername.trim()}
                  >
                    {leetSaving ? "..." : "Sauvegarder"}
                  </Button>
                </div>
                {leetMsg && (
                  <p
                    className={`mt-2 text-[11px] ${
                      leetMsg.ok ? "text-[var(--success)]" : "text-[var(--danger)]"
                    }`}
                  >
                    {leetMsg.text}
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Données & vie privée"
                subtitle="Exporte ou supprime tes données personnelles."
                action={<Download className="w-4 h-4 text-[var(--text-3)]" />}
              />
              <CardBody>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-1)]">
                        Exporter mes données
                      </p>
                      <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                        Télécharge toutes tes données métier (conversations, rappels,
                        mémoire, emails en cache…) en un fichier JSON.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleExport()}
                      disabled={exporting}
                      leftIcon={exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    >
                      {exporting ? "Export…" : "Exporter"}
                    </Button>
                  </div>

                  {exportMsg && (
                    <p
                      className={`text-[11px] ${
                        exportMsg.endsWith("✓")
                          ? "text-[var(--success)]"
                          : "text-[var(--danger)]"
                      }`}
                    >
                      {exportMsg}
                    </p>
                  )}

                  <div className="pt-1">
                    <a
                      href="/privacy"
                      className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                    >
                      Lire la politique de vie privée →
                    </a>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-1)]">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-1)]">
                        Supprimer mon compte
                      </p>
                      <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                        Efface définitivement toutes tes données, tes passkeys et
                        tes connexions Google.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void handleDeleteAccount()}
                      disabled={deleting}
                      leftIcon={deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                    >
                      {deleting ? "Suppression…" : "Supprimer"}
                    </Button>
                  </div>

                  {deleteMsg && (
                    <p className="text-[11px] text-[var(--danger)]">{deleteMsg}</p>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Application"
                subtitle="Version web — BACKSTAGE"
                action={<Smartphone className="w-4 h-4 text-[var(--text-3)]" />}
              />
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-1)]">
                      Déconnexion
                    </p>
                    <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                      Ferme ta session en cours.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleLogout}
                    leftIcon={<LogOut className="w-3.5 h-3.5" />}
                  >
                    Déconnexion
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
