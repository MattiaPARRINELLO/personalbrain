import { cn } from "@/lib/utils";

/* ---------- Mockup : Kanban photo ---------- */

const SHOOT_COLUMNS = [
  {
    label: "Shooted",
    count: 6,
    cards: [
      { title: "M83 · Zénith", meta: "31/07 · 214 photos" },
      { title: "Justice · Lollapalooza", meta: "02/08 · 186 photos" },
    ],
  },
  {
    label: "Selecting",
    count: 4,
    cards: [{ title: "Air · Bercy", meta: "24/07 · 132 photos" }],
  },
  {
    label: "Editing",
    count: 3,
    cards: [{ title: "Phoenix · Salle Pleyel", meta: "18/07 · 98 photos" }],
  },
  {
    label: "Delivered",
    count: 12,
    cards: [{ title: "Daft Punk Tribute · La Cigale", meta: "Livré · 3.2 Go" }],
  },
] as const;

export function KanbanMock() {
  return (
    <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-1)] bg-[var(--surface-2)]">
        <span className="w-2 h-2 rounded-full bg-[var(--warm)]" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-3)]">
          kanban · shoots
        </span>
        <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-[var(--text-4)]">
          25 shoots · 4 étapes
        </span>
      </div>
      <div className="grid grid-cols-4 divide-x divide-[var(--border-1)]">
        {SHOOT_COLUMNS.map((col) => (
          <div key={col.label} className="px-2.5 py-3">
            <div className="flex items-center justify-between px-1 mb-2.5">
              <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">
                {col.label}
              </span>
              <span className="text-[9px] font-mono text-[var(--text-4)]">{col.count}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {col.cards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] px-2 py-1.5"
                >
                  <p className="text-[9.5px] font-medium text-[var(--text-1)] leading-tight truncate">
                    {card.title}
                  </p>
                  <p className="text-[8px] font-mono text-[var(--text-4)] mt-0.5">{card.meta}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Mockup : Streak LeetCode ---------- */

const WEEK = [
  { d: "L", on: true, today: false },
  { d: "M", on: true, today: false },
  { d: "M", on: true, today: false },
  { d: "J", on: false, today: false },
  { d: "V", on: true, today: false },
  { d: "S", on: true, today: false },
  { d: "D", on: true, today: true },
] as const;

export function StreakMock() {
  return (
    <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-1)] bg-[var(--surface-2)]">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-success)]" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-3)]">
          practice · leetcode
        </span>
      </div>
      <div className="px-4 py-4 flex items-center gap-4">
        <div className="relative w-[84px] h-[84px] shrink-0">
          <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
            <circle cx="42" cy="42" r="34" fill="none" stroke="var(--border-2)" strokeWidth="6" />
            <circle
              cx="42"
              cy="42"
              r="34"
              fill="none"
              stroke="var(--accent-success)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34 * 0.82} ${2 * Math.PI * 34}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[20px] font-semibold text-[var(--text-1)] leading-none tabular-nums">
              47
            </span>
            <span className="text-[8px] font-mono uppercase tracking-[0.14em] text-[var(--text-4)] mt-1">
              jours
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-[var(--text-4)]">
              cette semaine
            </span>
            <span className="text-[9px] font-mono text-[var(--accent-success)]">6/7</span>
          </div>
          <div className="flex gap-1.5">
            {WEEK.map((day, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 h-9 rounded-md border flex flex-col items-center justify-center gap-0.5",
                  day.on
                    ? "border-[var(--accent-success)]/30 bg-[var(--accent-success)]/10"
                    : "border-[var(--border-1)] bg-[var(--surface-2)]/50",
                  day.today && "ring-1 ring-[var(--accent-success)]"
                )}
              >
                <span className="text-[8px] font-mono text-[var(--text-4)]">{day.d}</span>
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    day.on ? "bg-[var(--accent-success)]" : "bg-[var(--border-3)]"
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Mockup : Mémoire ---------- */

const FACTS = [
  { cat: "code", label: "Code", text: "Préfère le TypeScript et les fonctions pures.", tone: "text-[var(--accent-cool)]" },
  { cat: "photo", label: "Photo", text: "Shoote en RAW, garde les sets complets.", tone: "text-[var(--warm)]" },
  { cat: "vie", label: "Vie", text: "Concert de M83 le 31/07 · Zénith.", tone: "text-[var(--accent-success)]" },
] as const;

export function MemoryMock() {
  return (
    <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-1)] bg-[var(--surface-2)]">
        <span className="w-2 h-2 rounded-full bg-[var(--ai-thinking)]" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-3)]">
          cerveau · mémoire
        </span>
        <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-[var(--text-4)]">
          128 faits
        </span>
      </div>
      <div className="px-4 py-4 flex flex-col gap-2">
        {FACTS.map((fact) => (
          <div
            key={fact.cat}
            className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 flex items-start gap-2.5"
          >
            <span className={cn("text-[8px] font-mono uppercase tracking-[0.12em] mt-[3px] shrink-0", fact.tone)}>
              {fact.label}
            </span>
            <span className="text-[10.5px] leading-relaxed text-[var(--text-2)]">{fact.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Artefacts de la journée (timeline) ---------- */

export function BriefMock() {
  return (
    <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse-dot" />
        <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">
          brief du matin
        </span>
        <span className="ml-auto text-[9px] font-mono text-[var(--text-4)]">07:30</span>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-2)]">
        Bonjour. <span className="text-[var(--text-1)] font-medium">Livraison M83 mercredi 12h.</span>{" "}
        Tu as 3 shoots cette semaine et 1 rappel en retard. Je commence par le plus pressé ?
      </p>
      <div className="mt-3 flex gap-2">
        <span className="rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 py-1 text-[10px] font-mono text-[var(--accent)]">
          Oui, vas-y
        </span>
        <span className="rounded-md border border-[var(--border-1)] px-2.5 py-1 text-[10px] font-mono text-[var(--text-3)]">
          Plus tard
        </span>
      </div>
    </div>
  );
}

export function GmailMock() {
  return (
    <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-success)]" />
        <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">
          gmail · tri automatique
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <div className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 flex items-center gap-3">
          <span className="w-6 h-6 rounded-md bg-[var(--accent)]/15 border border-[var(--accent)]/20 flex items-center justify-center text-[10px] font-mono text-[var(--accent)]">
            ZÉ
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[var(--text-1)] truncate">Zénith · accréditation M83</p>
            <p className="text-[9.5px] text-[var(--text-4)] truncate">Important · à traiter</p>
          </div>
          <span className="text-[9px] font-mono text-[var(--accent)] shrink-0">vu</span>
        </div>
        <div className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 flex items-center gap-3 opacity-60">
          <span className="w-6 h-6 rounded-md bg-[var(--surface-3)] border border-[var(--border-2)] flex items-center justify-center text-[10px] font-mono text-[var(--text-4)]">
            NE
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[var(--text-2)] truncate">Newsletter · offre objectifs</p>
            <p className="text-[9.5px] text-[var(--text-4)] truncate">Lu · archivé</p>
          </div>
          <span className="text-[9px] font-mono text-[var(--text-4)] shrink-0">lu</span>
        </div>
      </div>
    </div>
  );
}

export function StreakDayMock() {
  return (
    <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4 flex items-center gap-4">
      <div className="relative w-[64px] h-[64px] shrink-0">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border-2)" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="var(--accent-success)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 26 * 0.96} ${2 * Math.PI * 26}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[16px] font-semibold text-[var(--text-1)] leading-none tabular-nums">
            47
          </span>
          <span className="text-[7px] font-mono uppercase tracking-[0.14em] text-[var(--text-4)] mt-0.5">
            jours
          </span>
        </div>
      </div>
      <div>
        <p className="text-[11.5px] text-[var(--text-1)] font-medium">
          Problem #114 · Valid Parentheses
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-3)]">
          Bloqué sur l'approche pile → l'IA t'a montré le pattern, pas la solution.
        </p>
      </div>
    </div>
  );
}

export function MemoryFactMock() {
  return (
    <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-thinking)]" />
        <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">
          cerveau · récap
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--warm)]" />
          <span className="text-[10.5px] text-[var(--text-2)]">
            M83 shooté au Zénith · <span className="text-[var(--text-1)]">ajouté</span>
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)]" />
          <span className="text-[10.5px] text-[var(--text-2)]">
            Préférence : RAW + sets complets · <span className="text-[var(--text-1)]">rappelé</span>
          </span>
        </div>
      </div>
      <p className="mt-3 text-[10px] font-mono text-[var(--text-4)]">brief de demain préparé ✓</p>
    </div>
  );
}
