"use client";

import { Mail, ExternalLink, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardBody } from "@/components/ui/Card";
import { api, type GmailMessage } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { formatDateShort } from "@/lib/date";

function extractName(from: string): string {
  const match = from.match(/^"?(.+?)"?\s*</);
  return match ? match[1].trim() : from.replace(/<.+>/, "").trim() || from;
}

const GMAIL_CACHE_KEY = "gmail:page:list";

async function fetchAllGmail(): Promise<GmailMessage[]> {
  const res = await api.gmail.list();
  if (res.error) throw new Error(res.error);
  return res.messages ?? [];
}

export default function GmailPage() {
  const { data: messages, loading, error } = useCachedFetch<GmailMessage[]>(
    GMAIL_CACHE_KEY,
    fetchAllGmail,
    { ttl: 2 * 60 * 1000 }
  );

  const visible = messages ?? [];

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-6">
        <PageHeader
          title="Gmail"
          actions={
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-2)] hover:text-[var(--accent)] transition-colors"
            >
              Ouvrir Gmail
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          }
        />

        <div className="mt-6">
          {error && visible.length === 0 && (
            <Card variant="ghost" className="mb-6">
              <CardBody>
                <div className="text-[11px] text-[var(--danger)] px-3 py-2.5 rounded-md bg-[var(--danger)]/8 border border-[var(--danger)]/20">
                  {error.message}
                </div>
              </CardBody>
            </Card>
          )}

          {loading && visible.length === 0 && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          )}

          {!loading && visible.length === 0 && (
            <EmptyState
              icon={<Mail className="w-6 h-6" />}
              title="Aucun email"
              description="Votre boîte de réception est vide."
            />
          )}

          {visible.length > 0 && (
            <div className="space-y-2 relative">
              {loading && (
                <div className="absolute -top-7 right-0 flex items-center gap-1.5 text-[10px] text-[var(--text-3)]">
                  <Loader2 className="w-3 h-3 text-[var(--accent)] animate-spin" />
                  Actualisation…
                </div>
              )}
              {visible.map((msg) => (
                <Card
                  key={msg.id}
                  variant="ghost"
                  className="group hover:bg-[var(--surface-2)] transition-colors"
                >
                  <CardBody className="p-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={
                          msg.unread
                            ? "mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0"
                            : "mt-1.5 w-1.5 h-1.5 rounded-full bg-transparent shrink-0"
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p
                            className={
                              msg.unread
                                ? "text-[13px] font-medium text-[var(--text-1)] truncate"
                                : "text-[13px] text-[var(--text-2)] truncate"
                            }
                          >
                            {extractName(msg.from)}
                          </p>
                          <span className="shrink-0 text-[10px] text-[var(--text-3)] font-mono">
                            {formatDateShort(msg.date)}
                          </span>
                        </div>
                        <p
                          className={
                            msg.unread
                              ? "text-[12px] text-[var(--text-1)] truncate mt-0.5"
                              : "text-[12px] text-[var(--text-2)] truncate mt-0.5"
                          }
                        >
                          {msg.subject || "(Sans objet)"}
                        </p>
                        <p className="text-[11px] text-[var(--text-3)] line-clamp-2 mt-1 leading-relaxed">
                          {msg.snippet}
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
