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
  title: "Votre journée, enfin reliée.",
  description:
    "Vos conversations, votre mémoire et vos outils, reliés dans un même espace — sans repartir de zéro.",
  // Extrait de contexte illustratif (fictif) — une seule carte cohérente.
  contextLabel: "Contexte relié",
  fragments: [
    { kind: "Événement", text: "Shooting — jeudi 20:30" },
    { kind: "Mémoire", text: "Claire V. — attachée de presse" },
    { kind: "Information", text: "Accréditation à retirer sur place" },
  ],
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

// --- Une journée avec Backstage (scrollytelling) — données fictives
// ⚠️ DONNÉES DE DÉMONSTRATION — entièrement fictives.
// Le temps AVANCE à chaque étape : on suit une personne de 08:42 la
// veille du shooting jusqu'au lendemain matin. Chaque étape relie de
// nouveaux fragments au contexte déjà constitué.

export const DAY_STORY = {
  disclaimer: "Exemple illustratif avec des données fictives.",
  intro:
    "Suivez une journée réelle — en fiction : chaque moment fait remonter le bon fragment, au bon instant.",
  beats: [
    {
      time: "08:42",
      when: "La veille du shooting",
      query: "Qu'est-ce que je dois préparer pour mon shooting de demain ?",
      connections: [
        { kind: "Événement", text: "Shooting — Le Transbordeur, jeudi 20:30" },
        { kind: "Email", text: "Claire V. : « Accréditation au nom du média, retrait sur place »" },
        { kind: "Note", text: "Accès fosse 3 premiers titres, puis côté scène" },
        { kind: "Rappel", text: "Charger batteries + 2 cartes CF la veille" },
      ],
      answer:
        "Votre shooting est jeudi à 20:30 au Transbordeur. L'accréditation est au nom du média, à retirer sur place (email de Claire V.) ; en fosse : 3 premiers titres, puis accès côté scène. Pensez à charger les batteries et les cartes CF ce soir.",
      nextStep: {
        label: "Prochaine étape suggérée",
        text: "Ajouter un rappel « partir 45 min avant » pour jeudi ?",
        confirm: "Ajouter le rappel",
        dismiss: "Pas nécessaire",
        confirmed: "Rappel ajouté à votre liste — dans la démo uniquement.",
        dismissed: "D'accord, aucune action effectuée.",
      },
    },
    {
      time: "12:15",
      when: "Pause déjeuner",
      query: "J'ai une fenêtre ce midi — par quoi je commence ?",
      connections: [
        { kind: "Rappel", text: "Confirmer l'accréditation auprès de Claire V." },
        { kind: "Email", text: "Brouillon rédigé hier, à envoyer" },
        { kind: "Mémoire", text: "Préférence : répondre aux attachés de presse le matin" },
      ],
      answer:
        "Commencez par l'accréditation : un brouillon de réponse à Claire V. est déjà prêt dans vos emails. Vos notes indiquent que vous répondez aux attachés de presse le matin — parfait pour cette fenêtre. Le matériel peut attendre ce soir.",
      nextStep: {
        label: "Action suggérée",
        text: "Envoyer le brouillon de réponse à Claire V. ?",
        confirm: "Envoyer",
        dismiss: "Plus tard",
        confirmed: "Brouillon envoyé — dans la démo uniquement.",
        dismissed: "D'accord, rien n'a été envoyé.",
      },
    },
    {
      time: "21:58",
      when: "La veille au soir",
      query: "Je range le matériel — tu me confirmes la liste ?",
      connections: [
        { kind: "Rappel", text: "2 batteries chargées ✓" },
        { kind: "Rappel", text: "2 cartes CF formatées ✓" },
        { kind: "Mémoire", text: "Objectif 35mm f/1.4 pour la fosse" },
        { kind: "Note", text: "Lingettes + pare-soleil oubliés la dernière fois" },
      ],
      answer:
        "Batteries et cartes CF sont validées. Votre note du dernier shooting signale que vous aviez oublié lingettes et pare-soleil : ajoutez-les maintenant pour ne pas y penser demain sur place. L'objectif 35mm f/1.4 est bien le bon pour la fosse.",
      nextStep: {
        label: "Rappel intelligent",
        text: "Ajouter « lingettes + pare-soleil » à la liste de demain ?",
        confirm: "Ajouter",
        dismiss: "Inutile",
        confirmed: "Ajouté à votre liste — dans la démo uniquement.",
        dismissed: "D'accord, aucun rappel créé.",
      },
    },
    {
      time: "19:50",
      when: "Le soir du shooting — en route",
      query: "Je suis en route, tu me remindes quoi à l'arrivée ?",
      connections: [
        { kind: "Événement", text: "Retrait accréditation au nom du média" },
        { kind: "Note", text: "Fosse : 3 titres, puis côté scène" },
        { kind: "Rappel", text: "Partir 45 min avant — confirmé" },
        { kind: "Contact", text: "Claire V. sur place si souci" },
      ],
      answer:
        "À l'arrivée : retrait de l'accréditation au nom du média, puis directement en fosse pour les 3 premiers titres avant de basculer côté scène. Votre rappel « partir 45 min avant » est validé. Claire V. est votre contact sur place en cas de souci.",
      nextStep: {
        label: "Contexte disponible sur place",
        text: "Garder cette fiche ouverte pour le shooting ?",
        confirm: "Garder",
        dismiss: "Fermer",
        confirmed: "Fiche épinglée pour la soirée — dans la démo uniquement.",
        dismissed: "Fiche fermée.",
      },
    },
    {
      time: "09:30",
      when: "Le lendemain matin",
      query: "Qu'est-ce que j'ai capté hier dont je dois me souvenir ?",
      connections: [
        { kind: "Projet", text: "Série « Scène 2025 » — +38 photos" },
        { kind: "Note", text: "Côté scène : lumière chaude, cadrer large" },
        { kind: "Mémoire", text: "Claire V. veut un export avant vendredi" },
      ],
      answer:
        "Hier : 38 photos ajoutées à la série « Scène 2025 ». Votre note côté scène conseille une lumière chaude et des cadrages larges. Claire V. a demandé un export avant vendredi — à planifier dans la sélection.",
      nextStep: {
        label: "Suite logique",
        text: "Créer une tâche « sélection Scène 2025 — export vendredi » ?",
        confirm: "Créer la tâche",
        dismiss: "Plus tard",
        confirmed: "Tâche créée — dans la démo uniquement.",
        dismissed: "D'accord, rien n'a été créé.",
      },
    },
  ],
  outro:
    "Même contexte, du premier réflexe du matin à la sélection du lendemain. Backstage ne repart jamais de zéro.",
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
