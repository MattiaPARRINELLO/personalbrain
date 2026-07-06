"use client";

import {
  Palette,
  Mail,
  CalendarRange,
  LogOut,
  Check,
  Globe,
  Smartphone,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AccentPicker } from "@/components/ui/AccentPicker";
import { api, type GoogleLinkStatus } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";

const GOOGLE_STATUS_KEY = "google:status";

async function fetchGoogleStatus(): Promise<GoogleLinkStatus> {
  return api.googleStatus();
}

export default function SettingsPage() {
  const { data: status, loading } = useCachedFetch<GoogleLinkStatus>(
    GOOGLE_STATUS_KEY,
    fetchGoogleStatus,
    { ttl: 60 * 1000 }
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      window.location.replace("/login");
    } catch (err) {
      console.error("Logout error", err);
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
