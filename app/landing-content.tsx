import {
  BriefMock,
  GmailMock,
  KanbanMock,
  StreakDayMock,
  MemoryFactMock,
} from "@/components/landing/ModuleMocks";

export const TOOLBAR = ["gmail", "agenda", "rappels", "recherche web", "mémoire", "leetcode", "kanban photo"];

export const CAPABILITIES = [
  {
    n: "01",
    title: "Il exécute, il ne discute pas",
    desc: "Demande en langage naturel : il lit tes emails, crée un événement, recherche une date de concert, programme un rappel. Les outils sont réels, branchés sur tes comptes.",
  },
  {
    n: "02",
    title: "Il se souvient de ce qui compte",
    desc: "Faits, préférences, relations : une mémoire durable, consultable et éditable. Chaque réponse est personnalisée par ce que tu lui as confié, jamais par une hypothèse.",
  },
  {
    n: "03",
    title: "Il te tient au courant",
    desc: "Rappels récurrents, notifications push, brief du matin. Quand ça compte, il revient vers toi, sans jamais spammer.",
  },
];

export const PRIVACY_POINTS = [
  {
    icon: "🔑",
    title: "Passkeys (WebAuthn)",
    desc: "Pas de mot de passe à retenir. Ton visage ou ta clé de sécurité, et c'est tout.",
  },
  {
    icon: "🗂",
    title: "Consentement explicite",
    desc: "Rien n'est envoyé à l'IA sans validation. Chaque action est visible, chaque donnée supprimable.",
  },
  {
    icon: "📦",
    title: "Export & suppression",
    desc: "Tes données t'appartiennent : export complet, suppression définitive, à tout moment.",
  },
];

export const DAY_STEPS = [
  {
    time: "07:30",
    title: "Le brief. Il prépare ta journée.",
    desc: "Rappels du jour, emails importants, agenda. Tout est trié et hiérarchisé avant que tu ouvres les yeux, tu décides juste par où commencer.",
    accent: "var(--accent)",
    artifact: <BriefMock />,
  },
  {
    time: "09:15",
    title: "Le mail important, traité en 10 secondes.",
    desc: "Une accréditation de dernière minute ? Il la repère, te la résume, et prépare la réponse avec les infos de ta mémoire. Tu valides, c'est parti.",
    accent: "var(--accent-success)",
    artifact: <GmailMock />,
  },
  {
    time: "14:00",
    title: "Le shoot. Les photos rentrent, la méthode reste.",
    desc: "Retour de concert : les 214 photos rejoignent le kanban. La sélection, le rendu, la date de livraison, chaque étape a sa place, rien ne se perd.",
    accent: "var(--warm)",
    artifact: <KanbanMock />,
  },
  {
    time: "21:30",
    title: "La série. Un problème par jour, zéro blocage.",
    desc: "Le streak tient la discipline, l'IA débloque quand tu coinces, avec le pattern, pas la solution. Le code s'améliore sans que tu t'en aperçoives.",
    accent: "var(--accent-success)",
    artifact: <StreakDayMock />,
  },
  {
    time: "23:00",
    title: "Le récap. Rien ne se perd dans la nuit.",
    desc: "Ce qui compte est mémorisé, le brief de demain est prêt, les rappels sont programmés. Tu fermes l'écran, demain est déjà organisé.",
    accent: "var(--ai-thinking)",
    artifact: <MemoryFactMock />,
  },
];

export const STAT_LABELS = [
  { label: "outils branchés", suffix: "" },
  { label: "jours de série", suffix: "" },
  { label: "faits mémorisés", suffix: "" },
  { label: "shoots suivis", suffix: "" },
] as const;
