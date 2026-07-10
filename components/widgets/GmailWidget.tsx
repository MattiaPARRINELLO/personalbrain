"use client";

import { ArrowUpRight, Inbox, Loader2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type GmailMessage } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { formatDateShort } from "@/lib/date";

function extractName(from: string): string {
  const m = from.match(/^"?([^"<]+)"?\s*</);
  if (m) return m[1].trim();
  const em = from.match(/<([^>]+)>/);
  return em ? em[1] : from;
}

const GMAIL_CACHE_KEY = "gmail:widget:list";

async function fetchWidgetGmail(): Promise<GmailMessage[]> {
  const res = await api.gmail.list();
  if (res.error) throw new Error(res.error);
  return (res.messages ?? []).slice(0, 4);
}

export function GmailWidget() {
  const { data: messages, loading, error } = useCachedFetch<GmailMessage[]>(
    GMAIL_CACHE_KEY,
    fetchWidgetGmail,
    { ttl: 2 * 60 * 1000 }
  );

  const visible = messages ?? [];

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[var(--text-1)]">Gmail</span>
          {!loading && visible.length > 0 && (
            <span className="text-[10px] font-mono text-[var(--text-3)]">{visible.length}</span>
          )}
        </div>
        <a
          href="https://mail.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--text-3)] hover:text-[var(--accent)] transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </CardHeader>
      <CardBody className="p-2">
        {error && visible.length === 0 && (
          <div className="text-[11px] text-[var(--danger)] px-3 py-2.5 rounded-md bg-[var(--danger)]/8 border border-[var(--danger)]/20">
            {error.message}
          </div>
        )}

        {loading && visible.length === 0 && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="px-3 py-6 text-center">
            <Inbox className="w-6 h-6 text-[var(--text-4)] mx-auto mb-2" />
            <p className="text-[11px] text-[var(--text-3)] font-mono">Boîte vide</p>
          </div>
        )}

        {visible.length > 0 && (
          <ul className="space-y-0.5 relative">
            {loading && (
              <li className="absolute top-1 right-1">
                <Loader2 className="w-3 h-3 text-[var(--accent)] animate-spin" />
              </li>
            )}
            {visible.map((msg) => (
              <li
                key={msg.id}
                className="group px-3 py-2.5 rounded-md hover:bg-[var(--surface-2)] transition-colors duration-150"
              >
                <div className="flex items-start gap-2.5">
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
                            ? "text-[12px] font-medium text-[var(--text-1)] truncate"
                            : "text-[12px] text-[var(--text-2)] truncate"
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
                          ? "text-[11px] text-[var(--text-1)] truncate"
                          : "text-[11px] text-[var(--text-2)] truncate"
                      }
                    >
                      {msg.subject || "(Sans objet)"}
                    </p>
                    <p className="text-[10px] text-[var(--text-3)] truncate mt-0.5">
                      {msg.snippet}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
