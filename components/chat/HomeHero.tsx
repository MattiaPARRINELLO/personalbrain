"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  Brain,
  CalendarDays,
  Clock,
  Flame,
  Globe,
  Mail,
  MapPin,
  Sparkles,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCachedFetch } from "@/lib/cache";
import { useNow } from "@/lib/clock";
import { getHomeOverview } from "@/app/actions/home";
import { DEFAULT_SHORTCUTS } from "@/components/chat/chat-data";
import { CALENDAR_CACHE_KEY, fetchUpcomingCalendarEvents } from "@/components/widgets/CalendarWidget";
import { GMAIL_CACHE_KEY, fetchInboxMessages } from "@/components/widgets/GmailWidget";
import { formatTime } from "@/lib/date";
import type { HomeOverview } from "@/lib/types";

type Icon = typeof Sparkles;

interface Focus {
  title: string;
  start: number;
  end: number;
  location: string;
  remote: boolean;
  origin: "course" | "event";
  live: boolean;
  href: string;
}

interface Shortcut {
  label: string;
  icon: Icon;
}

interface Chip {
  icon: Icon;
  label: string;
  href?: string;
  tone: "accent" | "cool" | "warm" | "danger";
}

const TONE_TEXT: Record<Chip["tone"], string> = {
  accent: "text-[var(--accent)]",
  cool: "text-[var(--accent-cool)]",
  warm: "text-[var(--accent-warm)]",
  danger: "text-[var(--danger)]",
};

const TONE_BAR: Record<Focus["origin"], string> = {
  course: "bg-[var(--accent)]",
  event: "bg-[var(--accent-cool)]",
};

function greeting(hour: number): string {
  if (hour < 6) return "Encore debout ?";
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  if (hour < 23) return "Bonsoir";
  return "Bonne nuit";
}

function timeRange(start: number, end: number): string {
  return `${formatTime(new Date(start).toISOString())} – ${formatTime(new Date(end).toISOString())}`;
}

function countdown(target: number, now: number): string {
  const min = Math.round((target - now) / 60_000);
  if (min <= 0) return "maintenant";
  if (min < 60) return `dans ${min} min`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  if (hours < 24) return rest === 0 ? `dans ${hours} h` : `dans ${hours} h ${String(rest).padStart(2, "0")}`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "demain" : `dans ${days} jours`;
}

function formatDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

function isSameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(start: number, now: number): string {
  if (isSameDay(start, now)) return "";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(start, tomorrow.getTime())) return "demain · ";
  return `${new Date(start).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · `;
}

function buildShortcuts(
  overview: HomeOverview | undefined,
  focus: Focus | null,
  unreadMail: number
): Shortcut[] {
  const candidates: Shortcut[] = [];

  if (overview && (overview.remindersToday.length > 0 || overview.remindersLateCount > 0)) {
    candidates.push({ label: "Qu'est-ce que je dois faire aujourd'hui ?", icon: Sparkles });
  }
  if (focus?.origin === "course") {
    candidates.push({ label: `Que dois-je préparer pour ${focus.title} ?`, icon: CalendarDays });
  }
  if (focus?.origin === "event") {
    candidates.push({ label: `Prépare-moi pour « ${focus.title} »`, icon: CalendarDays });
  }
  if (unreadMail > 0) {
    candidates.push({ label: "Résume mes mails non lus", icon: Mail });
  }
  if (overview && overview.pendingFollowups > 0) {
    candidates.push({ label: "Où en sont mes relances en attente ?", icon: Globe });
  }
  if (overview && overview.leetcodeStreak > 0 && !overview.leetcodeSolvedToday) {
    candidates.push({ label: "Aide-moi sur un algo LeetCode", icon: Brain });
  }

  const seen = new Set<string>();
  return [...candidates, ...DEFAULT_SHORTCUTS]
    .filter((s) => (seen.has(s.label) ? false : seen.add(s.label)))
    .slice(0, 4);
}

function buildChips(overview: HomeOverview | undefined, unreadMail: number): Chip[] {
  if (!overview) return [];
  const chips: Chip[] = [];

  const remainingCourses = overview.laterToday.length;
  if (remainingCourses > 0) {
    chips.push({
      icon: CalendarDays,
      label: `${remainingCourses} cours restant${remainingCourses > 1 ? "s" : ""}`,
      href: "/schedule",
      tone: "accent",
    });
  }

  const dueToday = overview.remindersToday.length;
  const late = overview.remindersLateCount;
  if (dueToday > 0 || late > 0) {
    const total = dueToday + late;
    const plural = total > 1 ? "s" : "";
    const label =
      dueToday === 0
        ? `${late} rappel${late > 1 ? "s" : ""} en retard`
        : late === 0
          ? `${total} rappel${plural} aujourd'hui`
          : `${total} rappel${plural} · ${late} en retard`;
    chips.push({
      icon: Bell,
      label,
      href: "/reminders",
      tone: late > 0 ? "danger" : "warm",
    });
  }

  if (overview.pendingFollowups > 0) {
    chips.push({
      icon: Globe,
      label: `${overview.pendingFollowups} relance${overview.pendingFollowups > 1 ? "s" : ""}`,
      href: "/today",
      tone: "cool",
    });
  }

  // Comptage honnête : la liste partagée est plafonnée par l'API (10 mails),
  // donc on affiche « 10+ » plutôt qu'un total inventé.
  if (unreadMail > 0) {
    const capped = unreadMail >= 10;
    chips.push({
      icon: Mail,
      label: `${unreadMail}${capped ? "+" : ""} mail${unreadMail > 1 ? "s" : ""} non lu${unreadMail > 1 ? "s" : ""}`,
      href: "/gmail",
      tone: "accent",
    });
  }

  if (overview.leetcodeStreak > 0) {
    chips.push({
      icon: Flame,
      label: `série ${overview.leetcodeStreak} j`,
      href: "/leetcode",
      tone: overview.leetcodeSolvedToday ? "cool" : "warm",
    });
  }

  return chips;
}

export function HomeHero({
  onPrompt,
  disabled,
}: {
  onPrompt: (prompt: string) => void;
  disabled: boolean;
}) {
  // Horloge client via useSyncExternalStore : le snapshot serveur vaut 0, donc
  // le HTML rendu par le serveur est identique au premier rendu client (aucune
  // erreur d'hydratation) et la salutation apparaît dès la première frame.
  const now = useNow();

  const { data: overview } = useCachedFetch<HomeOverview>("home:overview", getHomeOverview, {
    ttl: 60_000,
  });
  // Cache partagé avec les widgets du panneau de droite : aucune requête en plus.
  const { data: events } = useCachedFetch(CALENDAR_CACHE_KEY, fetchUpcomingCalendarEvents, {
    ttl: 2 * 60 * 1000,
  });
  const { data: messages } = useCachedFetch(GMAIL_CACHE_KEY, fetchInboxMessages, {
    ttl: 2 * 60 * 1000,
  });

  const unreadMail = useMemo(
    () => (messages ?? []).filter((m) => m.unread).length,
    [messages]
  );

  const focus = useMemo<Focus | null>(() => {
    if (now === 0) return null;

    if (overview?.currentCourse) {
      const c = overview.currentCourse;
      return {
        title: c.subject,
        start: c.start,
        end: c.end,
        location: c.room,
        remote: c.remote,
        origin: "course",
        live: true,
        href: "/schedule",
      };
    }

    const course: Focus | null = overview?.nextCourse
      ? {
          title: overview.nextCourse.subject,
          start: overview.nextCourse.start,
          end: overview.nextCourse.end,
          location: overview.nextCourse.room,
          remote: overview.nextCourse.remote,
          origin: "course",
          live: false,
          href: "/schedule",
        }
      : null;

    const event: Focus | null = (events ?? [])
      .filter((e) => new Date(e.end).getTime() > now)
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))
      .flatMap((e) => [
        {
          title: e.summary,
          start: +new Date(e.start),
          end: +new Date(e.end),
          location: e.location ?? "",
          remote: false,
          origin: "event" as const,
          live: +new Date(e.start) <= now,
          href: "/calendar",
        },
      ])[0] ?? null;

    return [course, event]
      .filter((f): f is Focus => f !== null)
      .sort((a, b) => a.start - b.start)[0] ?? null;
  }, [overview, events, now]);

  const shortcuts = useMemo(
    () => buildShortcuts(overview, focus, unreadMail),
    [overview, focus, unreadMail]
  );
  const chips = useMemo(() => buildChips(overview, unreadMail), [overview, unreadMail]);

  const briefing = useMemo(() => {
    if (now === 0) return "Je m'occupe du reste : Gmail, agenda, rappels, mémoire, recherche.";
    const minutes = focus ? Math.round((focus.start - now) / 60_000) : null;
    if (focus?.live) return "Tu es en plein dedans — je gère le reste pendant ce temps.";
    if (minutes !== null && minutes > 0 && minutes <= 60) {
      return `Ça commence ${countdown(focus!.start, now)}. Veux-tu que je te prépare ?`;
    }
    if (overview && overview.remindersLateCount > 0) {
      const late = overview.remindersLateCount;
      return `${late} rappel${late > 1 ? "s" : ""} en retard${late > 1 ? "" : "e"} — on commence par là ?`;
    }
    if (focus) return "Rien d'urgent avant : la journée est à toi.";
    if (overview && overview.remindersToday.length > 0) {
      return "Rien au programme côté agenda, juste tes rappels du jour.";
    }
    if (overview && overview.leetcodeStreak > 0) {
      return `Agenda libre — parfait pour tenir ta série de ${overview.leetcodeStreak} jours.`;
    }
    if (overview) return "Aucun rendez-vous aujourd'hui. Demande-moi ce que tu veux.";
    return "Je m'occupe du reste : Gmail, agenda, rappels, mémoire, recherche.";
  }, [focus, overview, now]);

  const eyebrow = useMemo(() => {
    if (now === 0) return "";
    const date = new Date(now).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return `${date} · ${formatTime(new Date(now).toISOString())}`;
  }, [now]);

  return (
    <section aria-label="Accueil du chat" className="flex flex-col items-center text-center">
      <div className="home-rise relative flex items-center justify-center">
        <div
          className="home-halo absolute w-52 h-52 rounded-full bg-[var(--accent)]/10 blur-[64px]"
          aria-hidden
        />
        <div className="home-float relative flex items-center justify-center">
          <div
            className="home-ring home-conic-ring absolute w-[76px] h-[76px] rounded-full"
            aria-hidden
          />
          <div className="relative w-14 h-14 rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] flex items-center justify-center overflow-hidden">
            <Image
              src="/backstage-logo-simple.png"
              alt="BACKSTAGE"
              width={36}
              height={36}
              className="w-9 h-9 object-contain"
            />
          </div>
        </div>
      </div>

      <p
        className="home-rise mt-7 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-3)]"
        style={{ animationDelay: "60ms" }}
      >
        <span className="relative flex w-1.5 h-1.5">
          <span className="absolute inset-0 rounded-full bg-[var(--accent)] animate-pulse-dot" />
          <span className="relative w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        </span>
        {eyebrow || "Backstage"}
      </p>

      <h1
        className="home-rise mt-3.5 text-[26px] sm:text-[34px] font-display font-bold tracking-tight text-[var(--text-1)] text-balance"
        style={{ animationDelay: "110ms" }}
      >
        {now > 0 ? (
          <span className="home-swap inline-block">
            {greeting(new Date(now).getHours())}
            {overview?.name ? ` ${overview.name}` : ""}
          </span>
        ) : (
          "Que puis-je faire pour toi ?"
        )}
      </h1>

      <p
        key={briefing}
        className="home-rise mt-3 text-[13px] sm:text-[14px] text-[var(--text-3)] max-w-md leading-relaxed balance"
        style={{ animationDelay: "160ms" }}
      >
        {briefing}
        {now > 0 && (
          <span className="home-caret" aria-hidden>
            ▍
          </span>
        )}
      </p>

      {focus && (
        <div
          className="home-rise home-sheen mt-8 w-full max-w-lg text-left"
          style={{ animationDelay: "220ms" }}
        >
          <div
            className={cn(
              "relative flex items-start gap-3.5 rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)]/70 backdrop-blur px-4 py-3.5 overflow-hidden",
              focus.live && "home-glow"
            )}
          >
            <span
              className={cn("absolute left-0 top-0 bottom-0 w-[2px]", TONE_BAR[focus.origin])}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">
                <span className={focus.live ? TONE_TEXT.danger : TONE_TEXT.accent}>
                  {focus.live
                    ? "En cours"
                    : `${countdown(focus.start, now)} · ${dayLabel(focus.start, now)}${timeRange(focus.start, focus.end)}`}
                </span>
                {focus.live && (
                  <span className="text-[var(--text-4)]">{timeRange(focus.start, focus.end)}</span>
                )}
              </p>
              <p className="mt-1.5 text-[15px] font-medium text-[var(--text-1)] truncate">
                {focus.title}
              </p>
              <p className="mt-1 flex items-center gap-2.5 text-[11px] text-[var(--text-3)]">
                {focus.location && (
                  <span className="flex items-center gap-1 truncate">
                    {focus.remote ? <Video className="w-3 h-3 shrink-0" /> : <MapPin className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{focus.location}</span>
                  </span>
                )}
                {focus.remote && !focus.location && (
                  <span className="flex items-center gap-1">
                    <Video className="w-3 h-3" />
                    Distanciel
                  </span>
                )}
                <span className="flex items-center gap-1 text-[var(--text-4)]">
                  <Clock className="w-3 h-3" />
                  {formatDuration(focus.end - focus.start)}
                </span>
              </p>
            </div>
            <Link
              href={focus.href}
              className="shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-4)] hover:text-[var(--accent)] hover:bg-[var(--surface-3)] transition-colors duration-200"
              title="Ouvrir"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div
          className="home-rise mt-3 flex flex-wrap items-center justify-center gap-1.5"
          style={{ animationDelay: "270ms" }}
        >
          {chips.map((c) => {
            const content = (
              <>
                <c.icon className={cn("w-3 h-3 shrink-0", TONE_TEXT[c.tone])} />
                <span className="text-[var(--text-2)] font-mono text-[10px] uppercase tracking-[0.12em]">
                  {c.label}
                </span>
              </>
            );
            const cls =
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border-1)] bg-[var(--surface-1)]/60 backdrop-blur transition-colors duration-200";
            return c.href ? (
              <Link key={c.label} href={c.href} className={cn(cls, "hover:border-[var(--border-3)]")}>
                {content}
              </Link>
            ) : (
              <span key={c.label} className={cls}>
                {content}
              </span>
            );
          })}
        </div>
      )}

      <section
        aria-label="Raccourcis"
        className="home-rise mt-9 w-full max-w-lg"
        style={{ animationDelay: "330ms" }}
      >
        <div className="flex items-center gap-3 mb-3 px-0.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-4)]">
            Raccourcis
          </span>
          <span className="flex-1 h-px bg-[var(--border-1)]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              onClick={() => void onPrompt(s.label)}
              disabled={disabled}
              className="group relative flex items-start gap-3 px-4 py-3.5 text-left text-[13px] text-[var(--text-2)] bg-[var(--surface-1)] border border-[var(--border-1)] rounded-xl hover:border-[var(--border-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-all duration-200 disabled:opacity-40"
            >
              <s.icon className="w-4 h-4 shrink-0 mt-0.5 text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors duration-200" />
              <span className="leading-relaxed line-clamp-2">{s.label}</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0 mt-0.5 ml-auto self-center text-[var(--text-4)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
