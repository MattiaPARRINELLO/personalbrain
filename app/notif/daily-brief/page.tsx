"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Mail,
  BellRing,
  Music,
  Code2,
  Cloud,
  ListChecks,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { DailyBrief } from "@/lib/types";
import { formatRelative } from "@/lib/date";

export default function DailyBriefPage() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/daily-brief")
      .then((res) => {
        if (!res.ok) throw new Error("Introuvable");
        return res.json();
      })
      .then((data) => setBrief(data.brief))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-4)]" />
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--text-3)] text-sm mb-4">Aucun brief disponible.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--accent-cool)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors duration-200 mb-8"
      >
        <ArrowLeft className="w-3 h-3" />
        BACKSTAGE
      </Link>

      <header className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <CalendarDays className="w-5 h-5 text-[var(--accent-cool)]" />
          <h1 className="text-lg font-mono uppercase tracking-wider text-[var(--text-1)]">
            Brief du jour
          </h1>
        </div>
        <p className="text-xs font-mono text-[var(--text-3)] uppercase tracking-widest">
          {formatRelative(brief.date)}
        </p>
      </header>

      <div className="p-6 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] mb-8">
        <p className="text-sm leading-relaxed text-[var(--text-1)]">
          {brief.summary}
        </p>
      </div>

      {brief.weather && (
        <Section icon={<Cloud className="w-4 h-4" />} label="Météo">
          <p className="text-sm text-[var(--text-2)]">{brief.weather}</p>
        </Section>
      )}

      {brief.leetcodeDaily && (
        <Section icon={<Code2 className="w-4 h-4" />} label="LeetCode du jour">
          <p className="text-sm text-[var(--text-2)]">
            <span className="text-[var(--text-1)]">{brief.leetcodeDaily.title}</span>
            <span className="text-xs font-mono ml-2 px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--warm)]">
              {brief.leetcodeDaily.difficulty}
            </span>
          </p>
        </Section>
      )}

      {brief.reminders.length > 0 && (
        <Section icon={<BellRing className="w-4 h-4" />} label="Rappels">
          <ul className="space-y-2">
            {brief.reminders.map((r, i) => (
              <li key={i} className="text-sm text-[var(--text-2)] flex items-start gap-2">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[var(--accent-warm)] shrink-0" />
                <span>
                  <span className="text-[var(--text-1)]">{r.title}</span>
                  <span className="text-xs font-mono text-[var(--text-4)] ml-2">
                    {formatRelative(r.dueAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.events.length > 0 && (
        <Section icon={<Music className="w-4 h-4" />} label="Événements">
          <ul className="space-y-2">
            {brief.events.map((e, i) => (
              <li key={i} className="text-sm text-[var(--text-2)] flex items-start gap-2">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)] shrink-0" />
                <span>{e.title}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.urgentEmails && brief.urgentEmails.length > 0 && (
        <Section icon={<Mail className="w-4 h-4" />} label="Emails urgents">
          <ul className="space-y-2">
            {brief.urgentEmails.map((e, i) => (
              <li key={i} className="text-sm text-[var(--text-2)] flex items-start gap-2">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[var(--danger)] shrink-0" />
                <span>
                  <span className="text-[var(--text-1)]">{e.subject}</span>
                  <span className="text-xs font-mono text-[var(--text-4)] ml-2">
                    {e.from}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.concertChecklist && brief.concertChecklist.length > 0 && (
        <Section icon={<ListChecks className="w-4 h-4" />} label="Checklist concert">
          <ul className="space-y-2">
            {brief.concertChecklist.map((item, i) => (
              <li key={i} className="text-sm text-[var(--text-2)] flex items-start gap-2">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[var(--success)] shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="mt-10 pt-6 border-t border-[var(--border-1)]">
        <p className="text-xs font-mono text-[var(--text-4)] uppercase tracking-widest">
          Généré à {new Date(brief.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--accent-cool)]">{icon}</span>
        <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text-3)]">
          {label}
        </h2>
      </div>
      {children}
    </div>
  );
}
