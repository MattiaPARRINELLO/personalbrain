"use client";

import { Bell, Brain, Music, Mail } from "lucide-react";
import { createReminder } from "@/app/actions/reminders";
import { rememberFact } from "@/app/actions/brain";
import { loadConcerts, saveConcertEvents } from "@/app/actions/concerts";
import { findEmails } from "@/app/actions/ai-tools";
import { api } from "@/lib/api-client";
import type { MemoryCategory, ConcertEvent } from "@/lib/types";

export type ParsedArgs = Record<string, string>;

export interface CommandDef {
  id: string;
  prefix: string;
  label: string;
  description: string;
  usage: string;
  icon: typeof Bell;
  parse: (raw: string) => ParsedArgs | null;
  execute: (args: ParsedArgs) => Promise<string>;
}

const CATEGORY_MAP: Record<string, MemoryCategory> = {
  dev: "dev",
  code: "dev",
  photo: "photo",
  photos: "photo",
  photography: "photo",
  vie: "life",
  life: "life",
  perso: "life",
  preference: "preference",
  pref: "preference",
  preferences: "preference",
  goût: "preference",
  gout: "preference",
};

function parseCategory(s: string): MemoryCategory {
  return CATEGORY_MAP[s.toLowerCase().trim()] ?? "life";
}

/** Extracts a relative or absolute date expression from the end of a string. */
function extractDateFromEnd(raw: string): { title: string; dateExpr: string } {
  const datePatterns: RegExp[] = [
    /(\d{4}-\d{2}-\d{2})$/,
    /(demain\s*(?:[àa]\s*)?\d{1,2}h\d{0,2})$/i,
    /(demain)$/i,
    /(ce\s+soir)$/i,
    /(dans\s+\d+\s*h(?:eures)?)$/i,
    /(\d{1,2}h\d{0,2})$/,
  ];

  for (const pat of datePatterns) {
    const m = raw.match(pat);
    if (m) {
      return {
        title: raw.slice(0, raw.length - m[1].length).trim() || raw,
        dateExpr: m[1],
      };
    }
  }

  return { title: raw, dateExpr: "" };
}

/** Converts a date expression to an ISO string. */
function resolveDate(dateExpr: string): string {
  const now = new Date();
  const lower = dateExpr.toLowerCase().trim();

  if (!lower) {
    // Default: +1 hour
    const d = new Date(now);
    d.setHours(d.getHours() + 1);
    return d.toISOString();
  }

  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(dateExpr)) {
    return dateExpr;
  }

  // "demain"
  if (lower === "demain") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  // "demain 15h" / "demain à 15h30"
  const demainMatch = lower.match(/demain\s*(?:[àa]\s*)?(\d{1,2})h(\d{1,2})?/);
  if (demainMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(parseInt(demainMatch[1]), parseInt(demainMatch[2] || "0"), 0, 0);
    return d.toISOString();
  }

  // "ce soir"
  if (lower === "ce soir") {
    const d = new Date(now);
    d.setHours(20, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }

  // "dans 2h" / "dans 3 heures"
  const dansMatch = lower.match(/dans\s+(\d+)\s*h(?:eures)?/);
  if (dansMatch) {
    const d = new Date(now);
    d.setHours(d.getHours() + parseInt(dansMatch[1]));
    return d.toISOString();
  }

  // "15h" / "15h30"
  const hMatch = lower.match(/^(\d{1,2})h(\d{1,2})?$/);
  if (hMatch) {
    const d = new Date(now);
    d.setHours(parseInt(hMatch[1]), parseInt(hMatch[2] || "0"), 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }

  // Fallback
  const d = new Date(now);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

export const COMMANDS: CommandDef[] = [
  {
    id: "todo",
    prefix: "/todo",
    label: "Créer un rappel",
    description: "Ajoute un rappel avec titre et date optionnelle",
    usage: "/todo <titre> [date]",
    icon: Bell,
    parse(raw) {
      const rest = raw.slice("/todo".length).trim();
      if (!rest) return null;
      const { title, dateExpr } = extractDateFromEnd(rest);
      return { title, dateExpr };
    },
    async execute(args) {
      const dueAt = resolveDate(args.dateExpr ?? "");
      await createReminder({ title: args.title, dueAt });
      return `✓ Rappel créé : "${args.title}"`;
    },
  },
  {
    id: "remember",
    prefix: "/remember",
    label: "Mémoriser un fait",
    description: "Ajoute un fait mémoire dans une catégorie",
    usage: "/remember <contenu> [catégorie]",
    icon: Brain,
    parse(raw) {
      const rest = raw.slice("/remember".length).trim();
      if (!rest) return null;

      const words = rest.split(/\s+/);
      const last = words[words.length - 1].toLowerCase().trim();
      const cat = parseCategory(last);

      // If the last word is a valid category, consume it
      if (cat !== "life" || last === "life") {
        const content = words.slice(0, -1).join(" ");
        return content ? { content, category: cat } : null;
      }

      return { content: rest, category: "life" };
    },
    async execute(args) {
      const cat = (args.category as MemoryCategory) || "life";
      await rememberFact(args.content, cat);
      return `✓ Fait mémorisé : "${args.content}"`;
    },
  },
  {
    id: "concert",
    prefix: "/concert",
    label: "Ajouter un concert",
    description: "Ajoute un concert avec artiste, lieu et date",
    usage: "/concert <artiste> <lieu> <date>",
    icon: Music,
    parse(raw) {
      const rest = raw.slice("/concert".length).trim();
      if (!rest) return null;

      const words = rest.split(/\s+/);
      if (words.length < 3) return null;

      const date = words[words.length - 1];
      const venue = words[words.length - 2];
      const artist = words.slice(0, -2).join(" ");

      return { artist, venue, date };
    },
    async execute(args) {
      const data = await loadConcerts();
      const newEvent: ConcertEvent = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        artist: args.artist,
        venue: args.venue,
        date: args.date,
        status: "shooted",
      };
      await saveConcertEvents([...data.events, newEvent]);
      return `✓ Concert ajouté : ${args.artist} au ${args.venue} le ${args.date}`;
    },
  },
  {
    id: "search",
    prefix: "/search",
    label: "Chercher dans les emails",
    description: "Recherche un mot-clé dans les emails Gmail",
    usage: "/search <mot-clé>",
    icon: Mail,
    parse(raw) {
      const rest = raw.slice("/search".length).trim();
      if (!rest) return null;
      return { query: rest };
    },
    async execute(args) {
      // La palette reflète l'état réel : sans compte Gmail lié, la recherche
      // ne peut pas aboutir — on le dit au lieu d'échouer silencieusement.
      const status = await api.googleStatus();
      if (!status.gmail) {
        throw new Error("Gmail non connecté — lie ton compte dans les Paramètres.");
      }
      const emails = await findEmails(args.query);
      if (emails.length === 0) return `Aucun email trouvé pour "${args.query}"`;
      return `${emails.length} email(s) trouvé(s) pour "${args.query}"`;
    },
  },
];
