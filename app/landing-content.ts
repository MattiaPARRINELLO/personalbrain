// ============================================================
// CONTENU ÉDITORIAL DE LA LANDING BACKSTAGE.
// Positionnement : second cerveau personnel — contexte, mémoire,
// continuité. Toutes les données de démonstration sont FICTIVES
// et signalées comme telles. Modifier ce fichier suffit pour
// changer tous les textes.
// ============================================================

export const GITHUB_URL = "https://github.com/MattiaPARRINELLO/personalbrain";

export const NAV_LINKS = [
  { href: "#produit", label: "Produit" },
  { href: "#memoire", label: "Mémoire" },
  { href: "#usages", label: "Usages" },
  { href: "#open-source", label: "Open source" },
  { href: "#securite", label: "Sécurité" },
] as const;

// --- Hero -----------------------------------------------------

export const HERO = {
  eyebrow: "Votre second cerveau personnel",
  title: "Tout ce qui compte dans votre journée, enfin relié.",
  description:
    "Backstage réunit vos conversations, votre mémoire et vos outils dans un espace personnel alimenté par l'IA. Retrouvez le contexte. Reliez les informations. Avancez sans repartir de zéro.",
  primaryCta: "Essayer la démo",
  secondaryCta: "Découvrir Backstage",
  loginCta: "Se connecter",
  note: "Démonstration publique limitée · Application complète en accès privé",
} as const;

// --- Problème ---------------------------------------------------

export const PROBLEM = {
  title: "Votre journée est partout. Votre contexte aussi.",
  description:
    "Une date dans un email. Une idée dans une conversation. Une adresse dans une note. Backstage relie ces fragments pour que l'information utile réapparaisse au bon moment.",
  fragments: [
    { kind: "Email", text: "Accréditation — réponse attendue" },
    { kind: "Événement", text: "Shooting · jeudi 20:30" },
    { kind: "Conversation", text: "« Prévois un objectif lumineux »" },
    { kind: "Note", text: "Accès côté scène, passer par le régisseur" },
    { kind: "Rappel", text: "Charger les batteries la veille" },
    { kind: "Lien", text: "Fiche technique de la salle" },
    { kind: "Contact", text: "Claire V. — attachée de presse" },
    { kind: "Projet", text: "Série « Scène 2025 » en cours" },
  ],
  resolution:
    "Dans Backstage, ces fragments forment un contexte unique — consultable, recherchable, relié.",
} as const;

// --- Mémoire ----------------------------------------------------

export const MEMORY = {
  title: "Une IA qui conserve le fil.",
  description:
    "Backstage s'appuie sur une mémoire persistante et inspectable : ce que vous confiez reste disponible au-delà d'une seule conversation, et vous gardez la main.",
  principles: [
    {
      n: "01",
      title: "Se souvenir",
      desc: "Les éléments utiles — préférences, faits, décisions — restent disponibles d'une conversation à l'autre, au lieu de disparaître avec l'historique.",
    },
    {
      n: "02",
      title: "Relier",
      desc: "Les informations associées à une personne, une date ou un projet forment un contexte cohérent. Une question sur un événement retrouve ce qui s'y rapporte.",
    },
    {
      n: "03",
      title: "Garder le contrôle",
      desc: "La mémoire est consultable, corrigeable et supprimable. Chaque fait est éditable, chaque relation visible — rien n'est une boîte noire.",
    },
  ],
} as const;

// --- Journée (scrollytelling) — données fictives -----------------
// ⚠️ DONNÉES DE DÉMONSTRATION — entièrement fictives.

export const DAY_STORY = {
  disclaimer: "Exemple illustratif avec des données fictives.",
  query: "Qu'est-ce que je dois préparer pour mon shooting de demain ?",
  connections: [
    { kind: "Événement", text: "Shooting — Le Transbordeur, jeudi 20:30" },
    { kind: "Email", text: "Claire V. : « Accréditation au nom du média, retrait sur place »" },
    { kind: "Note", text: "Accès fosse 3 premières chansons, puis côté scène" },
    { kind: "Rappel", text: "Charger batteries + 2 cartes CF la veille" },
    { kind: "Conversation", text: "« Objectif lumineux pour la fosse »" },
  ],
  answer:
    "Votre shooting est jeudi à 20:30 au Transbordeur. L'accréditation est au nom du média, à retirer sur place (email de Claire V.). En fosse : 3 premières chansons uniquement, puis accès côté scène. Pensez à charger les batteries et les cartes CF ce soir — et l'objectif lumineux prévu pour la fosse.",
  nextStep: {
    label: "Prochaine étape suggérée",
    text: "Ajouter un rappel « partir 45 min avant » pour jeudi ?",
    confirm: "Ajouter le rappel",
    dismiss: "Pas nécessaire",
    confirmed: "Rappel ajouté à votre liste — dans la démo uniquement.",
    dismissed: "D'accord, aucune action effectuée.",
  },
} as const;

// --- Mini-démo publique ------------------------------------------

export const PUBLIC_DEMO = {
  title: "Essayez avec un contexte fictif.",
  description:
    "Posez une question à Backstage : il répond à partir d'un jeu de données fictives, comme le ferait l'application avec les vôtres.",
  disclaimer: "Démonstration limitée avec données fictives. Aucun accès à votre espace personnel.",
  placeholder: "Ex. : Que dois-je préparer pour demain ?",
  button: "Demander",
  suggestions: [
    "Que dois-je préparer pour demain ?",
    "Retrouve les informations de mon prochain shooting.",
    "Quels événements importants arrivent bientôt ?",
  ],
  contextLabel: "Contexte mobilisé (fictif)",
  errors: {
    rate: "Trop de demandes — réessayez dans un instant.",
    generic: "La démonstration est momentanément indisponible. Réessayez.",
    invalid: "Question trop longue (400 caractères maximum).",
  },
  after: {
    title: "Ceci n'était qu'un aperçu.",
    text: "L'application complète est actuellement réservée aux personnes disposant déjà d'un accès.",
    loginCta: "Se connecter",
    githubCta: "Voir le code sur GitHub",
    note: "La création de compte n'est pas encore disponible.",
  },
} as const;

// --- Usages ------------------------------------------------------

export const USE_CASES = {
  title: "Trois façons de ne plus perdre le fil.",
  cases: [
    {
      key: "quotidien",
      tab: "Quotidien",
      query: "Retrouve ce que je dois préparer pour demain.",
      fragments: [
        { kind: "Agenda", text: "Rendez-vous bancaire — 14:00" },
        { kind: "Rappel", text: "Répondre au propriétaire avant midi" },
        { kind: "Email", text: "Colis à relancer — livré en point relais" },
      ],
      answer:
        "Demain : rendez-vous bancaire à 14:00, une réponse à envoyer au propriétaire avant midi, et un colis à récupérer en point relais. Rien d'autre d'attendu.",
      note: "Rappels, agenda et emails sont des intégrations réelles de l'application.",
    },
    {
      key: "photo",
      tab: "Photographie",
      query: "Quelles sont les informations importantes pour mon prochain shooting ?",
      fragments: [
        { kind: "Shooting", text: "Le Transbordeur — jeudi 20:30" },
        { kind: "Accréditation", text: "Au nom du média, retrait sur place" },
        { kind: "Contact", text: "Claire V. — attachée de presse" },
        { kind: "Note", text: "Fosse 3 titres, puis côté scène" },
      ],
      answer:
        "Jeudi 20:30 au Transbordeur. Accréditation au nom du média à retirer sur place — Claire V. est votre contact. En pratique : fosse limitée à 3 titres, puis côté scène.",
      note: "Suivi des shootings, accréditations et préparation de concert font partie de l'application.",
    },
    {
      key: "dev",
      tab: "Développement",
      query: "Où en suis-je sur cette fonctionnalité ?",
      fragments: [
        { kind: "Conversation", text: "« Refacto du rate limiter, à reprendre »" },
        { kind: "Note", text: "Tester le cas 429 avant de merger" },
        { kind: "Ressource", text: "Doc du framework — enregistrée mardi" },
      ],
      answer:
        "Dernier état connu : refacto du rate limiter en cours, restait à couvrir le cas 429 par un test avant de merger. La doc du framework que vous aviez enregistrée traite du sujet.",
      note: "Conversations persistées, ressources sauvegardées et pratique quotidienne du code sont couvertes par l'application.",
    },
  ],
} as const;

// --- Sécurité ----------------------------------------------------

export const PRIVACY = {
  title: "Personnel par conception.",
  titleB: "Contrôlable à chaque étape.",
  description:
    "Backstage est un espace privé. Les garanties ci-dessous sont celles réellement mises en œuvre dans le projet.",
  points: [
    {
      title: "Accès authentifié",
      desc: "L'application complète est derrière une authentification par passkey. Toute route privée est protégée par défaut.",
    },
    {
      title: "Secrets côté serveur",
      desc: "Les clés API restent côté serveur. Rien n'est exposé dans le navigateur.",
    },
    {
      title: "Démonstration isolée",
      desc: "La démo publique n'utilise qu'un jeu de données fictif, sans accès aux données réelles ni aux connecteurs privés.",
    },
    {
      title: "Actions confirmées",
      desc: "Les actions à effet externe (envoi d'email, modification d'agenda) sont soumises à une confirmation explicite avant exécution.",
    },
    {
      title: "Mémoire transparente",
      desc: "Les faits mémorisés sont listés, éditables et supprimables depuis l'interface.",
    },
    {
      title: "Suppression réelle",
      desc: "L'export et la suppression définitive des données sont disponibles dans l'application.",
    },
  ],
} as const;

// --- Open source -------------------------------------------------

export const OPEN_SOURCE = {
  title: "Ouvert jusque dans ses fondations.",
  description:
    "Le code source de Backstage est publiquement accessible. Explorez son fonctionnement, étudiez son architecture et suivez son évolution.",
  techs: [
    { label: "DeepSeek", role: "sous le capot", desc: "Le modèle d'intelligence artificielle qui alimente les réponses." },
    { label: "OpenCode", role: "développé avec", desc: "L'outil utilisé pour construire le projet, commit après commit." },
    { label: "Next.js · React · TypeScript", role: "stack", desc: "Une architecture inspectable, testée et documentée." },
  ],
  signature: "DeepSeek sous le capot. Code source public. Développé avec OpenCode.",
  cta: "Voir le code sur GitHub",
} as const;

// --- CTA final ---------------------------------------------------

export const FINAL_CTA = {
  title: "Et si votre journée formait enfin un tout ?",
  description:
    "Découvrez le fonctionnement de Backstage avec la démonstration publique. Si vous disposez déjà d'un accès, connectez-vous à votre espace personnel.",
  primaryCta: "Essayer la démo",
  secondaryCta: "Se connecter",
  tertiaryCta: "Voir le code sur GitHub",
  note: "Démonstration publique limitée · Application complète en accès privé",
} as const;

// --- Footer ------------------------------------------------------

export const FOOTER = {
  tagline: "Un espace personnel qui comprend le contexte.",
  links: [
    { href: "#produit", label: "Produit" },
    { href: "#memoire", label: "Mémoire" },
    { href: "#usages", label: "Usages" },
    { href: "#securite", label: "Sécurité" },
  ],
  legal: [
    { href: GITHUB_URL, label: "GitHub", external: true },
    { href: "/privacy", label: "Mentions légales", external: false },
    { href: "/privacy", label: "Confidentialité", external: false },
    { href: "/login", label: "Se connecter", external: false },
  ],
  signature: "Code source public · DeepSeek sous le capot · Développé avec OpenCode",
} as const;
