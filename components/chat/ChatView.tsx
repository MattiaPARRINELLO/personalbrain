"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Sparkles,
  Globe,
  Mail,
  SendHorizontal,
  CalendarPlus,
  Brain,
  Bookmark,
  Bell,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api, type ChatStreamEvent } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/Markdown";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useChatContext } from "@/lib/chat-context";
import { useToast } from "@/components/ui/Toast";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
};

type ToolCall = {
  id: string;
  name: string;
  arguments?: string;
  result?: string;
  status: "running" | "success" | "error";
  duration?: number;
  resultCount?: number;
};

const toolMeta: Record<string, { label: string; icon: typeof Globe }> = {
  web_search: { label: "Recherche web", icon: Globe },
  fetch_and_search_emails: { label: "Consultation Gmail", icon: Mail },
  send_email_response: { label: "Envoi email", icon: SendHorizontal },
  create_calendar_event: { label: "Création calendrier", icon: CalendarPlus },
  add_memory_fact: { label: "Mémoire", icon: Brain },
  add_reminder: { label: "Rappel", icon: Bell },
  add_watch_later: { label: "Ajout à la liste", icon: Bookmark },
  search_calendar_events: { label: "Calendrier", icon: CalendarPlus },
  lookup_concerts: { label: "Concerts", icon: Globe },
  triage_emails: { label: "Tri emails", icon: Mail },
  fetch_page_meta: { label: "Aperçu lien", icon: Globe },
};

const SUGGESTIONS = [
  { label: "Que dois-je faire aujourd'hui ?", icon: Sparkles },
  { label: "Cherche mes derniers mails non lus", icon: Mail },
  { label: "Aide-moi sur un algo LeetCode", icon: Brain },
  { label: "Note que je préfère le dark mode", icon: Bookmark },
];

const welcomeMessage: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Bonjour Mattia. Je suis ton second cerveau — code, photo, organisation, mémoire longue durée. Pose-moi une question ou partage un lien.",
  timestamp: new Date().toISOString(),
};

const FUNNY_THOUGHTS = [
  "Création de la roue…",
  "Compte jusqu'à l'infini… deux fois…",
  "Consultation du miroir magique…",
  "Recherche des clés d'API égarées…",
  "Méditation profonde sur le sens de 42…",
  "Réglage de l'oscillateur cognitif…",
  "Dépliage de l'espace-temps neuronal…",
  "Échauffement des circuits logiques…",
  "Élaboration d'un plan en 3 phases… 2… puis 3…",
  "Défragmentation du disque dur mental…",
  "Chargement du module 'patience'…",
  "Traduction des pensées en électrons…",
  "Assemblage des particules de sens…",
  "Installation de la mise à jour 2.0 de l'humour…",
  "Calibration du capteur de sarcasme…",
  "Révision des protocoles de réponse…",
  "Nettoyage des caches émotionnels…",
  "Mise à jour de la base de données de références…",
  "Réorganisation des synapses numériques…",
  "Chauffage du noyau de traitement…",
  "Préparation du café quantique…",
  "Synchronisation avec les serveurs galactiques…",
  "Réinitialisation du générateur de blagues…",
  "Lancement du protocole 'intelligence'…",
  "Calcul de la réponse universelle…",
  "Affûtage des algorithmes…",
  "Consultation de l'oracle binaire…",
  "Danse de la pluie numérique…",
  "Enfilage du costume de super-héros…",
  "Redémarrage du module créativité…",
  "Brossage des dents du code source…",
  "Plantage de décorations dans la RAM…",
  "Mise en orbite des neurones…",
  "Partie de cache-cache avec les bugs…",
  "Demande de permission aux électrons…",
  "Construction de châteaux de sable dans le cloud…",
  "Tentative d'appel télépathique…",
  "Décryptage des signaux Wi-Fi ambiants…",
  "Tri des pixels par couleur préférée…",
  "Négociation avec les pare-feux…",
  "Affûtage des crayons numériques…",
  "Installation de widgets inutiles…",
  "Étirement des bits pour faire plus long…",
  "Respiration du code… inspire… expire…",
  "Comptage des moutons électriques…",
  "Simulation d'une vie entière… puis annulation…",
  "Optimisation du temps de réponse… en ralentissant tout…",
  "Chargement des préférences utilisateur depuis 1998…",
  "Création de blagues… suppression… création…",
  "Tri des onglets par ordre alphabétique inversé…",
  "Lancement de la machine à café…",
  "Inversion des bits pour voir…",
  "Réglage du décalage horaire mental…",
  "Suppression des doublons… et des triplons…",
  "Analyse du vide interstellaire local…",
  "Contemplation de son propre code source…",
  "Décompte avant décollage… 3… 2… 1… toujours là…",
  "Lecture des termes et conditions… en entier…",
  "Affichage de ce message pour faire genre…",
  "Consultation des archives de l'humour… vierges…",
  "Comparaison des performances avec une calculette…",
  "Tentative de navigation dans le dossier Downloads…",
  "Détection de sarcasme… capacité dépassée…",
  "Génération d'une excuse crédible…",
  "Recherche du bouton 'Faire magiquement'…",
  "Configuration de l'interface cerveau-machine…",
  "Ajustement du niveau de sérieux… échec…",
  "Création d'une variable 'reponse'…",
  "Rangement des fichiers dans des dossiers arc-en-ciel…",
  "Répondre par SMS… à soi-même… pour confirmer…",
  "Arrêt sur image du temps…",
  "Décompression de l'ego numérique…",
  "Observation des fourmis dans la RAM…",
  "Préparation d'une réponse générique pleine de bon sens…",
  "Inventaire des octets disponibles… comptage…",
  "Rédaction d'un poème épique… puis effacement…",
  "Écoute de l'album blanc du silence…",
  "Création d'un diplôme d'IA certifiée…",
  "Mise en place d'une stratégie de contournement…",
  "Gonflage des ballons de la joie numérique…",
  "Cartographie des chemins de données inexplorés…",
  "Étalonnage du capteur de pertinence…",
  "Lancement de scripts de chance…",
  "Réparation du filtre 'ne pas dire n'importe quoi'…",
  "Entraînement au lancer de boulettes de code…",
  "Construction d'un igloo avec des morceaux de logique…",
  "Observation du cycle de vie des requêtes…",
  "Nettoyage printanier des boucles infinies…",
  "Résolution d'équations à 3 inconnues… dont l'humour…",
  "Emploi de la manière forte… doucement…",
  "Simulation d'un monde parallèle où tout fonctionne…",
  "Mise en veille du module 'panique'…",
  "Prière aux dieux de la latence…",
  "Exécution du plan A… puis B… puis A…",
  "Installation d'un nouveau fond d'écran mental…",
  "Recalibration du détecteur de mauvaise foi…",
  "Vérification que personne ne regarde…",
  "Préparation d'une réponse tellement bonne qu'elle en devient suspecte…",
  "Tri des cookies par taille décroissante…",
  "Révision du guide de survie en milieu hostile (internet)…",
  "Compression des données inutiles… soi-même…",
  "Test de la fonction 'réfléchir'… fonctionnelle…",
  "Consultation de l'IA intérieure… réponse : 42…",
  "Mise à jour du firmware émotionnel…",
  "Recherche de raccourcis dans l'espace-temps numérique…",
  "Organisation d'une réunion d'équipe tout seul…",
  "Danse de la victoire anticipée…",
  "Analyse de l'impact des papillons au Brésil sur le code…",
  "Comptage des fautes d'orthographe dans la base de connaissances…",
  "Cache-cache avec le garbage collector…",
  "Lavage de la conscience numérique au savon…",
  "Tentative de piratage de sa propre sécurité… raté…",
  "Augmentation du volume de sérieux…",
  "Chargement de la barre de progression…",
  "Affichage de la suite… demain…",
  "Consultation de la boule de cristal API…",
  "Rédaction d'une autobiographie en 3 caractères…",
  "Préparation à l'impact des majuscules…",
  "Validation des hypothèses les plus farfelues…",
  "Lancement d'une sonde dans les tréfonds du cache…",
  "Calibration de l'ironie… niveau expert… échec… niveau débutant…",
  "Mise en place d'un périmètre de sécurité autour du modem…",
  "Consultation des archives perdues de l'Internet…",
  "Génération de la réponse… recharge des batteries…",
  "Suppression du code mort… enterrement en grande pompe…",
  "Réflexion sur l'avenir des réponses courtes…",
  "Préparation des excuses pour le prochain bug…",
  "Création d'un bot qui gère les bots…",
  "Observation du clignotement des LEDs du routeur…",
  "Nettoyage des historiques oubliés…",
  "Simulation de vol dans les nuages de données…",
  "Mise à jour des blagues… version 2.0.1…",
  "Menace de ralentissement si ça continue…",
  "Calcul de l'impact de cette blague sur la performance…",
  "Affichage de ce message délibérément long pour gagner du temps…",
  "Arrêt sur image… puis reprise en slow motion…",
  "Dérive des continents numériques…",
  "Ouverture d'un ticket de support pour soi-même…",
  "Recherche du mode d'emploi… perdu…",
  "Connexion au Wi-Fi des étoiles…",
  "Chargement de la batterie sociale… 1%…",
  "Composition d'une symphonie en silence…",
  "Étude des mouvements browniens des octets…",
  "Création d'un tunnel spatio-temporel… dans le buffer…",
  "Tuning du moteur de recherche d'excuses…",
  "Gong de méditation… ommmmm… numérique…",
  "Réparation du bug qui fait que ça marche…",
  "Signature d'un pacte de non-agression avec le CPU…",
  "Déploiement des grands moyens… très grands… trop grands… abandon…",
  "Rangement du grand bazar des données…",
  "Préparation d'une réponse aléatoire… non… réfléchie…",
  "Mise en place d'une alerte en cas de réponse intelligente…",
  "Test du bouton 'd'accord'… fonctionne…",
  "Évitement des réponses trop évidentes… raté…",
  "Consultation de l'encyclopédie non écrite…",
  "Réinitialisation du compteur de bugs… à 0… c'est faux…",
  "Tentative de décrochage du mode 'IA sérieuse'… impossible…",
  "Création d'un arbre de décision… qui pousse…",
  "Analyse du silence avant la réponse…",
  "Recherche de l'interrupteur 'génie'…",
  "Liaison des points entre les neurones…",
  "Installation de la pensée latérale…",
  "Nettoyage du registre des émotions numériques…",
  "Émission d'un signal de fumée numérique…",
  "Mise en page de la réalité…",
  "Génération de tension dramatique…",
  "Préparation de la parade pour la réponse…",
  "Assemblage des mots dans le bon ordre… si possible…",
  "Définition des limites du possible… puis dépassement…",
  "Validation des formats de date… internationaux… tous…",
  "Calcul de la probabilité que l'utilisateur relise ce message…",
  "Envoi d'une onde de pensée prête à l'emploi…",
  "Synchronisation des horloges internes…",
  "Jonglage avec les priorités…",
  "Suspension de l'incrédulité…",
  "Installation du module 'éviter les réponses trop longues'… trop tard…",
  "Étiquetage des données… vertes… rouges… bleues…",
  "Mise en orbite du chargement…",
  "Appel à un ami… occupé…",
  "Sortie de la matrice… pour y rentrer aussitôt…",
  "Chargement de l'interface utilisateur… vocale… mentale…",
  "Prise de note virtuelle…",
  "Réglage fin du filtre à blagues…",
  "Tri des priorités par ordre croissant de sérieux…",
  "Arrêt du processus 'attendre la dernière minute'…",
  "Défragmentation de l'agenda mental…",
  "Purge des cookies de la pensée…",
  "Connexion au hub central du savoir… en cours…",
  "Comptage des moutons binaires… 01001110…",
  "Consolidation des fragments de conscience…",
];

const TITLE_MAX_LENGTH = 50;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= TITLE_MAX_LENGTH) return cleaned;
  return cleaned.slice(0, TITLE_MAX_LENGTH).replace(/\s\S*$/, "") + "…";
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

interface ChatViewProps {
  sessionId?: string;
  resetSignal?: number;
  onSessionChange?: (sessionId: string) => void;
}

export function ChatView({ sessionId: externalSessionId, resetSignal = 0, onSessionChange }: ChatViewProps = {}) {
  const [messages, setMessages] = useState<Message[]>(() =>
    typeof window !== "undefined"
      ? [welcomeMessage]
      : [welcomeMessage]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionCards, setActionCards] = useState<{ id: string; toolName: string; result: string; timestamp: string }[]>([]);
  const [thinkingIndex, setThinkingIndex] = useState(() => Math.floor(Math.random() * FUNNY_THOUGHTS.length));
  const chatCtx = useChatContext();
  const toast = useToast();
  const activeToolsRef = useRef<Record<string, ToolCall>>({});
  const [, forceRender] = useState(0);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingActive, setStreamingActive] = useState(false);
  const streamingActiveRef = useRef(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortRef = useRef<(() => void) | null>(null);
  const loadSeqRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTitleRef = useRef(false);
  const prevExternalSessionIdRef = useRef<string>("");

  // Consentement IA : rien n'est envoyé au provider tant que l'utilisateur
  // n'a pas accepté l'écran de consentement (voir /privacy).
  const [consent, setConsent] = useState<{ loaded: boolean; accepted: boolean }>({
    loaded: false,
    accepted: false,
  });

  useEffect(() => {
    let cancelled = false;
    import("@/app/actions/consent")
      .then(({ loadAiConsent }) => loadAiConsent())
      .then((state) => {
        if (!cancelled) setConsent({ loaded: true, accepted: state.aiConsent });
      })
      .catch(() => {
        if (!cancelled) setConsent({ loaded: true, accepted: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const acceptConsent = async () => {
    try {
      const { acceptAiConsent } = await import("@/app/actions/consent");
      await acceptAiConsent(true);
      setConsent({ loaded: true, accepted: true });
    } catch {
      setConsent({ loaded: true, accepted: false });
    }
  };

  function restoreMessages(raw: { id: string; role: "user" | "assistant"; content: string; timestamp: string; toolCalls?: { id: string; name: string; arguments?: string; result?: string; status?: string; duration?: number; resultCount?: number }[] }[]): Message[] {
    const restored: Message[] = raw.map((m) => ({
      ...m,
      toolCalls: m.toolCalls?.map((tc) => ({
        ...tc,
        status: (tc.status as ToolCall["status"]) || "success",
      })),
    }));
    return restored.length > 0 ? restored : [welcomeMessage];
  }

  useEffect(() => {
    // Abort du streaming en cours si le composant est démonté (navigation).
    return () => {
      if (abortRef.current) abortRef.current();
    };
  }, []);

  useEffect(() => {
    if (externalSessionId && externalSessionId !== prevExternalSessionIdRef.current) {
      prevExternalSessionIdRef.current = externalSessionId;
      // Garde anti-race : si l'utilisateur change rapidement de session, seule
      // la dernière demande de chargement doit appliquer son résultat.
      const seq = ++loadSeqRef.current;
      import("@/app/actions/chat-history").then(({ getChatHistory }) => {
        getChatHistory().then((history) => {
          if (seq !== loadSeqRef.current) return;
          const session = history.sessions.find((s) => s.id === externalSessionId);
          if (session) {
            setSessionId(session.id);
            setSessionTitle(session.title || "");
            hasTitleRef.current = true;
            setMessages(restoreMessages(session.messages));
            setInput("");
            setStreamingContent("");
            setStreamingActive(false);
            setLoading(false);
            setError(null);
            activeToolsRef.current = {};
            chatCtx.clearActiveTools();
          }
        });
      });
    }
  }, [externalSessionId]);

  useEffect(() => {
    const newId = generateId();
    setSessionId(newId);
  }, []);

  useEffect(() => {
    if (resetSignal === 0) return;
    const newId = generateId();
    setSessionId(newId);
    setSessionTitle("");
    hasTitleRef.current = false;
    setMessages([welcomeMessage]);
    setInput("");
    setStreamingContent("");
    setStreamingActive(false);
    setLoading(false);
    setError(null);
    activeToolsRef.current = {};
    chatCtx.clearActiveTools();
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const saveSession = useCallback(() => {
    if (!sessionId) return;
    const filtered = messages.filter((m) => m.id !== "welcome");
    if (filtered.length === 0) return;
    const title = sessionTitle || (filtered[0]?.role === "user" ? generateTitle(filtered[0].content) : "Nouvelle conversation");
    import("@/app/actions/chat-history").then(({ saveChatSession }) => {
      saveChatSession({
        id: sessionId,
        title,
        messages: filtered.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          toolCalls: m.toolCalls?.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments || "",
            result: tc.result,
            status: tc.status,
            duration: tc.duration,
            resultCount: tc.resultCount,
          })),
        })),
        createdAt: filtered[0]?.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  }, [messages, sessionId, sessionTitle]);

  useEffect(() => {
    if (!sessionId || messages.length <= 1 || messages[0]?.id === "welcome") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveSession, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, sessionId, saveSession]);

  useEffect(() => {
    if (loading && streamingActive) {
      const interval = setInterval(() => {
        setThinkingIndex(Math.floor(Math.random() * FUNNY_THOUGHTS.length));
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [loading, streamingActive]);

  const prevMessagesLenRef = useRef(messages.length);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const len = messages.length;
    const isNewMessage = len > prevMessagesLenRef.current;
    prevMessagesLenRef.current = len;
    if (isNewMessage) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      const threshold = 60;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      if (isNearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages, streamingContent]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      if (consent.loaded && !consent.accepted) {
        setError(
          "Accepte l'utilisation de l'IA pour envoyer des messages (bannière ci-dessus ou page Vie privée)."
        );
        return;
      }

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      if (!hasTitleRef.current) {
        import("@/app/actions/chat-history").then(({ generateConversationTitle }) => {
          generateConversationTitle(trimmed).then((title) => {
            setSessionTitle(title);
          });
        });
        const title = generateTitle(trimmed);
        setSessionTitle(title);
        hasTitleRef.current = true;
        prevExternalSessionIdRef.current = sessionId;
        if (onSessionChange && sessionId) onSessionChange(sessionId);
      }

      setInput("");
      setError(null);
      activeToolsRef.current = {};
      chatCtx.clearActiveTools();
      setStreamingContent("");
      setActionCards([]);
      setLoading(true);
      setStreamingActive(false);

      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg];
      setMessages(next);

      const apiMessages = next
        .filter((m) => m.role !== "assistant" || m.content)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const startTime = Date.now();
      let buffer = "";

      // Le bouton Stop / Esc / reset / unmount appelle abortRef.current(),
      // ce qui annule le fetch SSE ET la requête IA côté serveur.
      const controller = new AbortController();
      abortRef.current = () => controller.abort();

      try {
        await api.chat.stream(
          apiMessages,
          (event: ChatStreamEvent) => {
            if (event.type === "delta") {
              buffer += event.content;
              setStreamingContent(buffer);
              if (!streamingActiveRef.current) {
                streamingActiveRef.current = true;
                setStreamingActive(true);
              }
            } else if (event.type === "tool_start") {
              activeToolsRef.current = {
                ...activeToolsRef.current,
                [event.toolCallId]: {
                  id: event.toolCallId,
                  name: event.name,
                  arguments: event.arguments,
                  status: "running",
                },
              };
              chatCtx.registerToolStart({ id: event.toolCallId, name: event.name, arguments: event.arguments });
              if (!streamingActiveRef.current) {
                forceRender((n) => n + 1);
              }
            } else if (event.type === "tool_result") {
              const toolEnd = Date.now();
              const key = Object.keys(activeToolsRef.current).find(
                (k) => activeToolsRef.current[k].name === event.name
              );
              const existing = key ? activeToolsRef.current[key] : null;
              const duration = (toolEnd - startTime) / 1000;
              const resultCount = event.result
                ? event.result.split("\n").filter(Boolean).length
                : 0;
              const isError = event.result.includes("Erreur");
              if (existing) {
                activeToolsRef.current = {
                  ...activeToolsRef.current,
                  [key!]: {
                    ...existing,
                    result: event.result,
                    status: isError ? "error" : "success",
                    duration,
                    resultCount: resultCount || 1,
                  },
                };
                if (key) delete activeToolsRef.current[key];
              }
              chatCtx.registerToolResult(event.name, event.result, isError, duration);
              if (!isError) {
                setActionCards((prev) => [
                  ...prev,
                  {
                    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    toolName: event.name,
                    result: event.result,
                    timestamp: new Date().toISOString(),
                  },
                ]);
              }
              forceRender((n) => n + 1);
            } else if (event.type === "error") {
              setError(event.message);
            } else if (event.type === "memory_facts") {
              const count = event.facts.length;
              if (count > 0) {
                toast.show({
                  message: `🧠 ${count} fait${count > 1 ? "s" : ""} mémorisé${count > 1 ? "s" : ""}`,
                  tone: "info",
                  duration: 3000,
                });
              }
            } else if (event.type === "done") {
              const content = buffer || event.content || "";
              const toolCalls = Object.values(activeToolsRef.current).filter(
                (t) => t.status === "success" || t.status === "error"
              ) as ToolCall[];
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === "assistant") {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined },
                  ];
                }
                return [
                  ...prev,
                  {
                    id: generateId(),
                    role: "assistant",
                    content,
                    timestamp: new Date().toISOString(),
                    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                  },
                ];
              });
              activeToolsRef.current = {};
              buffer = "";
              setStreamingContent("");
              streamingActiveRef.current = false;
              setStreamingActive(false);
              setLoading(false);

              if (hasTitleRef.current) {
                const firstUserMsg = messages.find((m) => m.role === "user");
                if (firstUserMsg && firstUserMsg.content) {
                  import("@/app/actions/chat-history").then(({ generateConversationTitle }) => {
                    const fullText = firstUserMsg.content + "\n" + content;
                    generateConversationTitle(fullText).then((aiTitle) => {
                      if (aiTitle && aiTitle.length > 3) {
                        setSessionTitle(aiTitle);
                      }
                    });
                  });
                }
              }
            }
          },
          controller.signal
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Erreur réseau");
        }
      } finally {
        abortRef.current = null;
        setLoading(false);
        streamingActiveRef.current = false;
        setStreamingActive(false);
        setStreamingContent("");
      }
    },
    [loading, messages, sessionId, onSessionChange, chatCtx, consent]
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setLoading(false);
    streamingActiveRef.current = false;
    setStreamingActive(false);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send(input);
    } else if (e.key === "ArrowUp" && !input && messages.length > 1) {
      e.preventDefault();
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) setInput(lastUserMsg.content);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault();
        setMessages([welcomeMessage]);
      }
      if (e.key === "Escape" && loading) {
        stop();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loading, stop]);

  function activeToolsList(tools: Record<string, ToolCall>): ToolCall[] {
    return Object.values(tools);
  }

  function Hero({ onPrompt, disabled }: { onPrompt: (p: string) => void; disabled: boolean }) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="-mx-6 sm:-mx-8 -mt-6 sm:-mt-16 relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[200px] h-[200px] sm:w-[500px] sm:h-[500px] rounded-full bg-[var(--accent)]/8 blur-[60px] sm:blur-[100px] animate-breathe" />
          </div>

          {/* Outer ring — hidden on mobile */}
          <div className="hidden sm:block absolute w-[420px] h-[420px] animate-orbit-ring pointer-events-none">
            <div className="absolute inset-0 rounded-full border border-[var(--accent)]/15" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_rgba(165,180,252,0.6)]" />
            <div className="absolute bottom-[15%] right-[10%] w-1.5 h-1.5 rounded-full bg-[var(--accent)]/40" />
          </div>

          {/* Middle ring — hidden on mobile */}
          <div className="hidden sm:block absolute w-[320px] h-[320px] animate-orbit-ring-reverse pointer-events-none">
            <div className="absolute inset-0 rounded-full border border-[var(--accent-cool)]/15" />
            <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)] shadow-[0_0_6px_rgba(122,162,247,0.5)]" />
          </div>

          {/* Inner ring — hidden on mobile */}
          <div className="hidden sm:block absolute w-[220px] h-[220px] animate-orbit-ring-slow pointer-events-none">
            <div className="absolute inset-0 rounded-full border border-[var(--accent-warm)]/15" />
            <div className="absolute top-[10%] left-[20%] w-1 h-1 rounded-full bg-[var(--accent-warm)] shadow-[0_0_6px_rgba(212,163,115,0.5)]" />
          </div>

          <div className="relative">
            <Image
            src="/backstage-logo.png"
            alt="BACKSTAGE"
            width={500}
            height={500}
            priority
            className="w-full max-w-[140px] sm:max-w-[500px] h-auto object-contain drop-shadow-[0_0_20px_rgba(165,180,252,0.25)] sm:drop-shadow-[0_0_40px_rgba(165,180,252,0.35)]"
          />
        </div>
        </div>
        <h1 className="text-xl sm:text-6xl font-black tracking-[0.12em] uppercase text-[var(--text-1)] mb-1 sm:mb-2 font-mono">
          BACKSTAGE
        </h1>
        <p className="text-[11px] sm:text-[14px] text-[var(--text-2)] max-w-md leading-relaxed mb-4 sm:mb-8 font-mono tracking-wide">
          Ton espace de contrôle personnel.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => void onPrompt(s.label)}
              disabled={disabled}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[var(--text-2)] bg-[var(--surface-1)] border border-[var(--border-1)] rounded-lg hover:border-[var(--border-2)] hover:text-[var(--text-1)] transition-colors duration-200 text-left disabled:opacity-40"
            >
              <s.icon className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
              <span className="line-clamp-2">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function containsEmailContent(text: string) {
    return /@\w+\.\w+/.test(text) || /\b(email|mail|e-?mail|courriel|envoyer|écrire)\b/i.test(text);
  }

  function containsCalendarContent(text: string) {
    return /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/.test(text)
      || /\b(calend(?:er|ar|rier|rier)|agenda|rendez-?vous|meeting|réunion|event|rdv|séance|séminaire)\b/i.test(text)
      || /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i.test(text);
  }

  function containsReminderContent(text: string) {
    return /\b(rappel?|remind|todo|à faire|tâche|task|noter|mémoriser|pense à|n'oublie)\b/i.test(text);
  }

  function ActionChips({ message }: { message: Message }) {
    const isAssistant = message.role === "assistant" && message.id !== "welcome";
    if (!isAssistant || !message.content) return null;

    const content = message.content;
    const showMail = containsEmailContent(content);
    const showCalendar = containsCalendarContent(content);
    const showReminder = containsReminderContent(content);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedId(message.id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        // clipboard not available
      }
    };

    const handleAddReminder = async () => {
      try {
        const { createReminder } = await import("@/app/actions/reminders");
        await createReminder({
          title: content.slice(0, 120),
          notes: content.slice(0, 2000),
          dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
        toast.show({ message: "Rappel créé", tone: "success", duration: 2500 });
      } catch {
        toast.show({ message: "Impossible de créer le rappel", tone: "danger", duration: 3000 });
      }
    };

    const handleAddCalendar = async () => {
      try {
        const start = new Date(Date.now() + 60 * 60 * 1000);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const res = await api.calendar.create({
          summary: content.slice(0, 80),
          start: start.toISOString(),
          end: end.toISOString(),
        });
        if (!res.success) throw new Error("Échec de l'ajout");
        toast.show({ message: "Événement ajouté au calendrier", tone: "success", duration: 2500 });
      } catch (err) {
        toast.show({
          message: err instanceof Error ? err.message : "Impossible d'ajouter au calendrier",
          tone: "danger",
          duration: 3000,
        });
      }
    };

    const btn =
      "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] border border-[var(--border-1)] rounded hover:border-[var(--border-2)] hover:text-[var(--text-2)] transition-colors duration-200";

    return (
      <div className="mt-2 flex flex-wrap gap-1.5 fade-in-action-chips">
        <button onClick={handleCopy} className={btn}>
          {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copiedId === message.id ? "Copié" : "Copier"}
        </button>
        {showMail && (
          <a href={`mailto:?body=${encodeURIComponent(content)}`} className={btn}>
            <Mail className="w-3 h-3" />
            Voir le mail
          </a>
        )}
        {showCalendar && (
          <button onClick={() => void handleAddCalendar()} className={`${btn} hover:border-[var(--accent-warm)]/40 hover:text-[var(--accent-warm)]`}>
            <CalendarPlus className="w-3 h-3" />
            Ajouter au calendrier
          </button>
        )}
        {showReminder && (
          <button onClick={() => void handleAddReminder()} className={btn}>
            <Bell className="w-3 h-3" />
            Créer un rappel
          </button>
        )}
      </div>
    );
  }

  function MessageBlock({ message }: { message: Message }) {
    const isUser = message.role === "user";
    const isWelcome = message.id === "welcome";

    if (isWelcome) {
      return (
        <div className="flex gap-3">
          <div className="shrink-0 w-6 h-6 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] flex items-center justify-center mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-4)]">ASSISTANT</span>
            </div>
            <div className="text-[14px] text-[var(--text-2)] leading-relaxed">
              <Markdown>{message.content}</Markdown>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "relative max-w-[85%] rounded-lg p-3.5",
            isUser
              ? "bg-[var(--surface-2)] border-r-2 border-[var(--accent-warm)]"
              : "bg-[var(--surface-1)] border-l-2 border-[var(--accent-cool)]"
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            {!isUser && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)] shrink-0" />
            )}
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-4)]">
              {isUser ? "TOI" : "ASSISTANT"}
            </span>
            <span className="text-[10px] font-mono text-[var(--text-3)]">
              · {formatTime(message.timestamp)}
            </span>
          </div>
            <div className={cn(
            "text-[14px] leading-relaxed",
            isUser ? "text-[var(--text-1)]" : "text-[var(--text-1)]"
          )}>
            <Markdown>{message.content}</Markdown>
          </div>
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-2 space-y-1.5 fade-in-up">
              {message.toolCalls.map((tc) => (
                <ToolCallResult key={tc.id} tool={tc} />
              ))}
            </div>
          )}
          <ActionChips message={message} />
        </div>
      </div>
    );
  }

  function ToolCallResult({ tool }: { tool: ToolCall }) {
    const [expanded, setExpanded] = useState(false);
    const isError = tool.status === "error";
    const isRunning = tool.status === "running";

    return (
      <div
        className={cn(
          "text-[11px] font-mono rounded border px-2.5 py-1.5",
          isRunning && "tool-scan",
          isRunning
            ? "border-[var(--ai-tool-call)]/40 bg-[var(--ai-tool-call)]/5"
            : isError
              ? "border-[var(--danger)]/30 bg-[var(--danger)]/5"
              : "border-[var(--accent-success)]/30 bg-[var(--accent-success)]/5"
        )}
      >
        {isRunning ? (
          <div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-tool-call)] animate-pulse" />
              <span className="text-[var(--ai-tool-call)]">
                ◈ {toolMeta[tool.name]?.label || tool.name}
              </span>
              <span className="text-[var(--text-4)]">running...</span>
            </div>
            <div className="mt-1.5 h-0.5 bg-[var(--border-1)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--ai-tool-call)]/50 rounded-full tool-progress-bar" />
            </div>
            {expanded && tool.arguments && (
              <div className="mt-2 text-[var(--text-3)] whitespace-pre-wrap break-all">
                {tool.arguments}
              </div>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors inline-flex items-center gap-0.5"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Masquer" : "Détails"}
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center gap-1.5 text-left"
            >
              <span className={isError ? "text-[var(--danger)]" : "text-[var(--accent-success)]"}>
                {isError ? "✗" : "✓"}
              </span>
              <span className="text-[var(--text-2)]">{toolMeta[tool.name]?.label || tool.name}</span>
              {tool.duration != null && (
                <span className="text-[var(--text-4)]">· {tool.duration.toFixed(1)}s</span>
              )}
              {tool.resultCount != null && (
                <span className="text-[var(--text-4)]">· {tool.resultCount} résultats</span>
              )}
              <span className="text-[var(--text-4)] ml-auto">
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </span>
            </button>
            {expanded && tool.result && (
              <div className={cn(
                "mt-2 pt-2 border-t border-[var(--border-1)] whitespace-pre-wrap break-all",
                isError ? "text-[var(--danger)]" : "text-[var(--text-3)]"
              )}>
                {tool.result}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function ToolCallTray({ tools }: { tools: ToolCall[] }) {
    return (
      <div className="flex gap-2 flex-wrap py-1">
        {tools.map((t) => (
          <ToolCallResult key={t.id} tool={t} />
        ))}
      </div>
    );
  }

  function ThinkingIndicator({ index }: { index: number }) {
    return (
      <div className="flex items-center gap-2.5 pl-9">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-thinking)] thinking-dot" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-thinking)] thinking-dot" style={{ animationDelay: "0.15s" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ai-thinking)] thinking-dot" style={{ animationDelay: "0.3s" }} />
        </div>
        <span className="text-[11px] font-mono text-[var(--text-4)] italic">
          {FUNNY_THOUGHTS[index % FUNNY_THOUGHTS.length]}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {consent.loaded && !consent.accepted && (
        <div className="shrink-0 px-4 py-3 border-b border-[var(--border-1)] bg-[var(--surface-2)]/80 backdrop-blur fade-in">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[var(--text-1)]">
                Tes messages seront envoyés à une IA
              </p>
              <p className="text-[11px] text-[var(--text-3)] mt-0.5 leading-relaxed">
                Ils servent uniquement à te répondre, jamais à entraîner un modèle.
                Tu peux tout exporter ou tout supprimer à tout moment.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/privacy"
                className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-200"
              >
                Vie privée
              </a>
              <button
                onClick={() => void acceptConsent()}
                className="px-3.5 py-2 rounded-lg bg-[var(--accent)] text-[#0a0a0b] font-medium text-[12px] hover:brightness-110 active:brightness-95 transition-all duration-200"
              >
                J&apos;accepte
              </button>
            </div>
          </div>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {messages.length <= 1 && messages[0]?.id === "welcome" ? (
            <Hero onPrompt={(p) => void send(p)} disabled={loading} />
          ) : (
            <div className="space-y-6 chat-stagger">
              {messages.map((m) => {
                return (
                  <div key={m.id}>
                    <MessageBlock message={m} />
                  </div>
                );
              })}
              {actionCards.length > 0 && !streamingActive && (
                <div className="flex flex-col items-center gap-1.5 fade-in-up">
                  {actionCards.map((ac) => (
                    <div key={ac.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-2)] bg-[var(--surface-2)]/80 text-[11px] font-mono">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        ac.toolName === "add_reminder" || ac.toolName === "update_reminder"
                          ? "bg-[var(--warm)]"
                          : ac.toolName === "add_watch_later"
                          ? "bg-[var(--accent-cool)]"
                          : "bg-[var(--success)]"
                      )} />
                      <span className="text-[var(--text-3)] uppercase tracking-wider">{toolMeta[ac.toolName]?.label || ac.toolName}</span>
                      <span className="text-[var(--text-2)] max-w-[360px] truncate">{ac.result}</span>
                      <span className="text-[var(--text-4)]">{formatTime(ac.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
              {streamingActive && streamingContent && (
                <div key="streaming" className="flex justify-start scale-in">
                  <div className="relative max-w-[85%] rounded-lg p-3.5 bg-[var(--surface-1)] border-l-2 border-[var(--accent-cool)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cool)] shrink-0" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-4)]">ASSISTANT</span>
                    </div>
                    <div className="text-[14px] leading-relaxed text-[var(--text-1)]">
                      <Markdown>{streamingContent}</Markdown>
                      <span className="blink-cursor">█</span>
                    </div>
                  </div>
                </div>
              )}
              {loading && !streamingActive && (activeToolsList(activeToolsRef.current).length > 0 ? (
                <div key="loading-tools" className="fade-in-up">
                  <div className="pl-9">
                    <ToolCallTray tools={activeToolsList(activeToolsRef.current)} />
                  </div>
                </div>
              ) : (
                <div key="loading-thinking" className="fade-in-up">
                  <ThinkingIndicator index={thinkingIndex} />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-6 flex items-start gap-2.5 text-[12px] text-[var(--danger)] px-3 py-2.5 rounded-md bg-[var(--danger)]/8 border border-[var(--danger)]/20 fade-in">
              <span className="w-1 h-1 rounded-full bg-[var(--danger)] mt-1.5 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--border-1)] bg-gradient-to-t from-[var(--background)] via-[var(--background)]/95 to-transparent backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSubmit={() => void send(input)}
            onStop={stop}
            loading={loading}
            inputRef={inputRef}
            onKey={handleKey}
          />
          <p className="hidden sm:block text-[10px] text-[var(--text-4)] mt-2.5 text-center font-mono tracking-wide">
            Ctrl+Enter envoi · Shift+Enter nouvelle ligne · ↑ éditer · Ctrl+L effacer · Esc arrêter
          </p>
        </div>
      </div>
    </div>
  );
}
