"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Inbox } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type GmailMessage } from "@/lib/api-client";
import { formatDateShort } from "@/lib/date";

function extractName(from: string): string {
  const m = from.match(/^"?([^"<]+)"?\s*</);
  if (m) return m[1].trim();
  const em = from.match(/<([^>]+)>/);
  return em ? em[1] : from;
}

export function GmailWidget() {
  const [messages, setMessages] = useState<GmailMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.gmail
      .list()
      .then((res) => {
        if (cancelled) return;
        setMessages((res.messages ?? []).slice(0, 4));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erreur de chargement");
        setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card variant="default" hover>
      <CardHeader
        title="Inbox"
        subtitle="contact.mprnl@gmail.com"
        action={
          <a
            href="/api/auth/google?type=gmail"
            className="text-[var(--text-3)] hover:text-[var(--accent)] transition-colors"
            title="Ouvrir Gmail"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        }
      />
      <CardBody className="p-2">
        {error && (
          <div className="text-[11px] text-[var(--danger)] px-3 py-2.5 rounded-md bg-[var(--danger)]/8 border border-[var(--danger)]/20">
            {error}
          </div>
        )}

        {messages === null && !error && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}

        {messages !== null && messages.length === 0 && !error && (
          <div className="px-3 py-6 text-center">
            <Inbox className="w-6 h-6 text-[var(--text-4)] mx-auto mb-2" />
            <p className="text-[11px] text-[var(--text-3)] font-mono">Boîte vide</p>
          </div>
        )}

        {messages && messages.length > 0 && (
          <ul className="space-y-0.5">
            {messages.map((msg) => (
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
