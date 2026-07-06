# ROADMAP.md — BACKSTAGE : Le Second Cerveau IA

> Document de référence ultime. Chaque ligne est une intention de design, une décision d'architecture ou un correctif critique.
> Ce document est vivant : il évolue avec le projet.

---

## Table des matières
1. [PHILOSOPHIE & VISION](#1--philosophie--vision)
2. [DIAGNOSTIC TECHNIQUE & CORRECTIFS](#2--diagnostic-technique--correctifs)
3. [L'INTERFACE COCKPIT — RÉVOLUTION UI/UX](#3--linterface-cockpit--révolution-uiux)
4. [MODULE CERVEAU & MÉMOIRE LONG TERME](#4--module-cerveau--mémoire-long-terme)
5. [MODULE RAPPELS & NOTIFICATIONS](#5--module-rappels--notifications)
6. [MODULE À VOIR PLUS TARD](#6--module-à-voir-plus-tard)
7. [MODULE ACCRÉDITATIONS](#7--module-accréditations)
8. [MODULE LEETCODE FOCUS COMPANION](#8--module-leetcode-focus-companion)
9. [CREATIVE FEATURES & MOONSHOTS](#9--creative-features--moonshots)
10. [PLAN DE MISE EN ŒUVRE](#10--plan-de-mise-en-œuvre)

---

## 1. 🎯 PHILOSOPHIE & VISION

### 1.1 Le Moteur de Vie

BACKSTAGE n'est pas un dashboard. C'est ton **Moteur de Vie** — un cockpit spatial qui fusionne tes deux identités (Dev & Photo) en un seul flux de conscience augmenté par l'IA.

**Profil Dev :**
- Étudiant en école d'informatique
- Veille technologique quotidienne
- Entraînements LeetCode réguliers
- Gestion de projets de code
- Stack : TypeScript, React, Next.js, Bun

**Profil Photo :**
- Photographe de concert
- Demandes d'accréditations (mails, relances, validations, refus)
- Plannings d'événements
- Repérages logistiques (itinéraires, horaires, météo, sac photo)
- Livraisons de galeries aux artistes/médias

### 1.2 La Promesse

> Un seul onglet toujours ouvert. L'IA lit tes mails, gère ton calendrier, se souvient de tout, te prépare tes concerts, te coache sur LeetCode, et te présente l'information au moment exact où tu en as besoin — pas avant, pas après.

### 1.3 Principes Fondateurs

1. **IA First** : Le chat est le centre névralgique. Toute fonctionnalité doit être pilotable à la voix/texte via l'IA.
2. **Zéro friction** : L'interface se métamorphose selon le contexte, sans que tu aies à naviguer.
3. **Mémoire infinie** : L'IA retient tout et structure sa connaissance de toi.
4. **Offline-ready** : PWA complète, tout fonctionne même sans connexion.
5. **Beautiful sans hurler** : Design brutaliste chaud, typographie ciselée, animations intentionnelles.

### 1.4 Ton quotidien avec BACKSTAGE (scénario cible)

```
07:30 — Tu ouvres BACKSTAGE. Le Daily Brief t'affiche ta journée.
       L'IA a déjà repéré un mail d'accréditation accepté pour ce soir.
       Elle a calculé l'itinéraire, vérifié la météo, et généré ta checklist sac photo.
       Le Concert Prep Agent est prêt.

09:00 — Entre deux cours, tu ouvres l'onglet.
       Le Leetcode Focus Companion te propose un exercice "Two Pointers" adapté
       à ton niveau et au créneau de 25 min que tu as dans ton calendrier.

14:00 — Tu jettes un lien YouTube d'une conf sur les Server Components dans le chat.
       L'IA le parse automatiquement, extrait le titre, la thumbnail, les tags,
       et le range dans "À voir plus tard" avec un résumé généré.

17:00 — L'IA détecte qu'une accréditation est sans réponse depuis 3 jours.
       Elle te propose un bouton "Rédiger une relance polie".

19:00 — Tu es au concert. L'IA t'a envoyé une notification 1h avant :
       "Départ dans 20 min pour [Salle]. Batterie boîtier chargée ? Météo : 12°C, pluie légère."
```

---

## 2. 🔧 DIAGNOSTIC TECHNIQUE & CORRECTIFS

### 2.1 URGENCE HAUTE — Écriture atomique robuste

#### 2.1.1 Problème
`lib/storage.ts:writeJsonAtomic` écrit dans `.tmp` puis `rename`, ce qui est atomique au niveau FS. Mais :
- Aucun verrouillage (mutex) — si deux requêtes écrivent simultanément (ex: l'IA appelle deux tools en parallèle), la deuxième écrase la première.
- Pas de retry sur erreur transitoire (ENOSPC, EACCES temporaire).
- `lib/config.ts:updateConfig` écrit directement sans `.tmp`+rename, donc non atomique.
- `lib/auth.ts`, `lib/daily-brief.ts` n'utilisent pas non plus d'écriture atomique.

#### 2.1.2 Solution — Mutex par fichier avec retry

```typescript
// lib/storage.ts — À implémenter

const locks = new Map<string, Promise<void>>();

async function withLock<T>(filename: string, fn: () => Promise<T>): Promise<T> {
  while (locks.has(filename)) {
    await locks.get(filename);
  }
  let resolve: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  locks.set(filename, promise);
  try {
    return await fn();
  } finally {
    locks.delete(filename);
    resolve!();
  }
}

async function writeJsonAtomic<T>(filename: string, data: T, retries = 3): Promise<void> {
  await ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, filename);
  const tmpPath = filePath + ".tmp";

  await withLock(filename, async () => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
        await fs.rename(tmpPath, filePath);
        return;
      } catch (err) {
        if (attempt === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt)));
      }
    }
  });
}
```

#### 2.1.3 Uniformisation
- Modifier `lib/config.ts` pour utiliser `writeJsonAtomic`.
- Modifier `lib/auth.ts` pour utiliser `writeJsonAtomic`.
- Modifier `lib/daily-brief.ts` pour utiliser `writeJsonAtomic`.
- Modifier `lib/google-client.ts:saveTokens` (déjà atomique, à garder tel quel).

#### 2.1.4 Corruption recovery
- Ajouter une validation JSON au `readJson` : si le parsing échoue, tenter le `.tmp` de secours, puis tenter les backups.
- Implémenter `readJsonSafe<T>(filename: string, fallback: T): Promise<T>` qui ne throw jamais.

### 2.2 URGENCE HAUTE — Session Google & Token Refresh

#### 2.2.1 Problème
- Le refresh token est vérifié seulement au moment de l'appel API (`getGoogleClient`).
- Si le refresh échoue définitivement, l'utilisateur reçoit une erreur seulement quand il tente une action Gmail/Calendar.
- Aucun mécanisme de fond qui prévient l'utilisateur AVANT que le token n'expire.
- Aucun healthcheck périodique des tokens.

#### 2.2.2 Solution — Healthcheck de fond + Notification préemptive

```typescript
// lib/google-health.ts — Nouveau module à créer

const HEALTH_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

export async function checkGoogleHealth(): Promise<{
  gmail: { ok: boolean; expiresIn?: number };
  calendar: { ok: boolean; expiresIn?: number };
}> {
  const result = { gmail: { ok: false }, calendar: { ok: false } };
  
  for (const type of ["gmail", "calendar"] as const) {
    try {
      const tokens = await loadTokens(type);
      if (!tokens?.refresh_token) continue;
      if (tokens.expiry_date && Date.now() >= tokens.expiry_date - 5 * 60 * 1000) {
        await getGoogleClient(type); // force refresh
      }
      result[type] = {
        ok: true,
        expiresIn: tokens.expiry_date ? tokens.expiry_date - Date.now() : undefined,
      };
    } catch {
      // déjà loggé dans google-client
    }
  }
  return result;
}
```

#### 2.2.3 API endpoint de healthcheck
- Créer `GET /api/auth/google/health` qui retourne l'état des tokens.
- Appelé périodiquement par le frontend (toutes les 15 min).
- Afficher un badge warning dans l'UI si un token expire dans < 1h.

### 2.3 URGANCE MOYENNE — Incohérence du cache config

#### 2.3.1 Problème
`lib/config.ts` a un `cachedConfig` static qui :
- N'est jamais invalidé après écriture (ligne 65 : `cachedConfig = next` OK, mais en lecture `getConfig` ne refresh pas si le cache est stale).
- Si un autre processus modifie `config.json`, le cache en mémoire devient obsolete.

#### 2.3.2 Solution
```typescript
// Ajouter un TTL au cache
let cachedConfig: { data: AppConfig; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

export async function getConfig(): Promise<AppConfig> {
  if (cachedConfig && Date.now() - cachedConfig.ts < CACHE_TTL) {
    return cachedConfig.data;
  }
  // ... read from disk
  cachedConfig = { data: parsed, ts: Date.now() };
  return parsed;
}
```

### 2.4 URGENCE MOYENNE — Persistance des conversations

#### 2.4.1 Problème
Les messages du chat sont stockés uniquement dans l'état React (`useState`). Rafraîchir la page = tout perdre.

#### 2.4.2 Solution
- Créer `data/chat-history.json` avec structure :
  ```typescript
  interface ChatHistory {
    sessions: {
      id: string;
      title: string; // généré par l'IA à partir du premier message
      messages: ChatMessage[];
      createdAt: string;
      updatedAt: string;
    }[];
  }
  ```
- Sauvegarder automatiquement après chaque message (debounce 2s).
- Ajouter un sélecteur de session dans l'UI (sidebar gauche ou modal).
- L'IA génère automatiquement un titre de 3-4 mots pour chaque nouvelle conversation.

### 2.5 URGENCE BASSE — Tests de résilience

#### 2.5.1 Tests à ajouter
- `storage.test.ts` : test de corruption JSON → fallback.
- `storage.test.ts` : test de concurrence (2 écritures simultanées).
- `google-client.test.ts` : test de retry exponentiel.
- `ai-providers.test.ts` : test de fallback anthropic → openai.
- Test d'intégration : chat → tool call → storage write → read back.

### 2.6 URGENCE BASSE — Divers

| Problème | Fichier | Action |
|----------|---------|--------|
| Pas de validation des entrées utilisateur avant écriture JSON | Tous les `app/actions/*.ts` | Ajouter `zod` pour valider les payloads |
| Pas de rate limiting sur l'API chat | `app/api/chat/route.ts` | Implémenter un rate limiter simple (token bucket en mémoire) |
| Pas de sanitization du contenu généré par l'IA avant affichage | `components/chat/ChatView.tsx` | Le `react-markdown` gère déjà, vérifier XSS |
| `webSearch` dans `storage.ts` fait un fetch sans timeout | `lib/storage.ts:269` | Ajouter `AbortController` avec timeout 10s |
| Pas de cleanup des backups anciens | `lib/storage.ts:47` | Ajouter une rotation : garder max 5 backups par fichier, supprimer les > 7 jours |

---

## 3. 💻 L'INTERFACE COCKPIT — RÉVOLUTION UI/UX

### 3.1 Fondation : le Design System "Obsidian Pulse"

On garde l'âme brutaliste du DESIGN.md mais on l'élève à un niveau supérieur.

#### 3.1.1 Palette — Évolution

```css
:root {
  /* Fondations — inchangées */
  --background: #0a0a0a;
  --surface-1: #141414;
  --surface-2: #1a1a1a;
  --surface-3: #1f1f1f;
  --border-1: #262626;
  --border-2: #333333;
  --text-1: #e5e5e5;
  --text-2: #8a8a8a;
  --text-3: #525252;

  /* Accents — enrichis */
  --accent-warm: #d4a373;       /* Photo, concerts, rappels */
  --accent-cool: #7aa2f7;       /* IA, code, LeetCode */
  --accent-success: #9ece6a;    /* Validé, livré */
  --accent-danger: #f7768e;     /* Refusé, urgent */
  --accent-warning: #e0af68;    /* En attente, attention */

  /* Nouvelles couleurs sémantiques */
  --ai-thinking: #bb9af7;       /* L'IA réfléchit (violet doux) */
  --ai-tool-call: #7dcfff;      /* L'IA exécute un outil (cyan) */
  --glow-warm: rgba(212, 163, 115, 0.08);
  --glow-cool: rgba(122, 162, 247, 0.08);
}
```

#### 3.1.2 Typographie

- **Titres** : Geist Sans, tracking tight, font-weight 600
- **Corps** : Geist Sans, 13-14px, leading-relaxed
- **Mono** : Space Mono pour les timestamps, labels, données techniques, code
- **Nouveau** : JetBrains Mono pour l'éditeur LeetCode (remplace Space Mono pour le code)

#### 3.1.3 Animations & Micro-interactions

| Élément | Animation | Durée | Easing |
|---------|-----------|-------|--------|
| Panneaux coulissants | `transform: translateX` + `opacity` | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) |
| Messages du chat | `opacity` + `translateY(8px)` en stagger | 150ms par message | `ease-out` |
| Indicateur "IA pense" | 3 points avec pulse décalé | 800ms loop | `ease-in-out` |
| Tool calls en cours | Bordure gauche animée (scan line) | 1.5s loop | `linear` |
| Changement de page | View Transition API (déjà en place) | 300ms | cross-fade |
| Hover cartes | `border-color` + `background` shift | 200ms | `ease-out` |
| Apparition panneau latéral | Slide from right + fade | 350ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Notification toast | Slide down + fade in, slide up + fade out | 400ms / 300ms | `ease-out` / `ease-in` |

### 3.2 Le Chat IA Central — Nouveau Design

Le chat actuel (`components/chat/ChatView.tsx`) est fonctionnel mais austère. Voici la vision.

#### 3.2.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Historique sessions] │  Messages du chat  │ [Context]   │
│      (240px)          │    (flex-1)        │ (320px)     │
│                       │                    │             │
│  ┌─────────────────┐  │  ┌──────────────┐  │  Calendrier │
│  │ Session 1       │  │  │ Assistant    │  │  du jour    │
│  │ Session 2       │  │  │ (message)    │  │             │
│  │ Session 3       │  │  └──────────────┘  │  Emails     │
│  │                 │  │                    │  récents    │
│  │ + Nouvelle      │  │  ┌──────────────┐  │             │
│  └─────────────────┘  │  │ Toi          │  │  Mémoire    │
│                       │  │ (message)    │  │  active     │
│                       │  └──────────────┘  │             │
│                       │                    │             │
│                       │  ┌──────────────┐  │             │
│                       │  │ [Input......] │  │             │
│                       │  └──────────────┘  │             │
└─────────────────────────────────────────────────────────┘
```

#### 3.2.2 Barre latérale gauche — Historique des sessions

Contrairement à ChatGPT qui liste des conversations sans âme, on crée une timeline verticale :

- Chaque session = une carte fine avec :
  - Titre auto-généré (ex: "Debug auth Next.js", "Prépa concert Zénith")
  - Date relative ("Il y a 2h", "Hier")
  - Un dot de couleur selon le contexte (bleu = code, ambre = photo)
  - Preview des 2-3 premiers mots du dernier message
- Barre de recherche en haut pour filtrer les sessions
- Bouton "+ Nouvelle conversation" en haut
- Scroll fluide, sessions groupées par jour

#### 3.2.3 Zone de messages — Rendu enrichi

Chaque message de l'IA doit être visuellement distinct et informatif :

**Message utilisateur :**
```
┌──────────────────────────────────────────┐
│ TOI · 14:32                              │
│ Peux-tu vérifier si j'ai reçu une        │
│ réponse pour l'accréditation de           │
│ Phoenix au Zénith ?                      │
└──────────────────────────────────────────┘
```
- Aligné à droite
- Fond `--surface-2`
- Bordure droite 2px `--accent-warm`
- Avatar : première lettre "M" dans un cercle `--accent-warm`

**Message assistant (texte simple) :**
```
┌──────────────────────────────────────────┐
│ ● ASSISTANT · 14:32                      │
│ Je vérifie tes mails...                  │
│                                          │
│ Bonne nouvelle ! Tu as reçu une réponse  │
│ hier à 18:42. L'accréditation pour       │
│ Phoenix au Zénith le 15 mars est         │
│ ACCEPTÉE. Contact : accreditation@...    │
│                                          │
│ [Voir le mail] [Ajouter au calendrier]   │
└──────────────────────────────────────────┘
```
- Aligné à gauche
- Fond `--surface-1`
- Bordure gauche 2px `--accent-cool`
- Dot cool coloré devant "ASSISTANT"

**Message assistant — Tool Call en cours (NOUVEAU) :**
```
┌──────────────────────────────────────────┐
│ ◈ L'IA lit tes emails Gmail...           │
│ ████████████░░░░░░░░ 60%                │
│                                          │
│ ╭── Tool: search_emails ──────────────╮ │
│ │ Query: "accreditation Phoenix"      │ │
│ │ Status: running...                  │ │
│ ╰─────────────────────────────────────╯ │
└──────────────────────────────────────────┘
```
- Fond `--surface-1` avec bordure gauche 2px `--ai-tool-call` (cyan)
- Barre de progression subtile (pas un spinner, une ligne qui pulse)
- Le bloc tool est rétractable (collapsible)
- Si le tool réussit → bordure passe en `--accent-success`, le bloc se réduit
- Si le tool échoue → bordure passe en `--accent-danger`, message d'erreur

**Message assistant — Tool Call terminé :**
```
┌──────────────────────────────────────────┐
│ ✓ search_emails · 0.4s · 3 résultats    │
│ ── Réduit (cliquer pour voir détails) ── │
└──────────────────────────────────────────┘
```

**Pendant que l'IA "réfléchit" (génération de texte) :**
```
┌──────────────────────────────────────────┐
│ ● ASSISTANT · 14:32                      │
│ Je vérifie tes mails...                  │
│ Bonne nouvelle ! Tu as reçu...█          │
└──────────────────────────────────────────┘
```
- Le `█` est un curseur clignotant (animation CSS `blink` 1s step-end)
- Le texte apparaît mot par mot (streaming SSE conservé)

**Actions chips (boutons inline après un message de l'IA) :**
```
[Voir le mail] [Ajouter au calendrier] [Créer un rappel] [Copier]
```
- Petits boutons outline, mono, taille 11px
- Apparaissent avec un fade-in 200ms après la fin du message

#### 3.2.4 Barre de saisie — Repensée

```
┌──────────────────────────────────────────────────────────┐
│ [@] [+]  │  Tape ton message... (Shift+Enter = retour)   │  [→]  │
└──────────────────────────────────────────────────────────┘
```

- `[@]` : Menu contextuel pour mentionner un module (ex: "@gmail", "@calendar", "@memory")
- `[+]` : Upload de fichier / image (drag & drop accepté dans la zone)
- Champ texte auto-grandissant (comportement actuel conservé)
- `[→]` : Bouton d'envoi, désactivé si champ vide
- Raccourci : `Ctrl+Enter` envoie, `Shift+Enter` nouvelle ligne
- Pendant l'envoi, le `[→]` devient un bouton stop `[■]` pour interrompre la génération

#### 3.2.5 Panneau contextuel droit (dynamique)

Le RightPanel actuel est statique. La vision : il se métamorphose selon ce que l'IA est en train de faire.

**État par défaut (idle) :**
- Calendrier du jour (compact)
- Derniers emails non lus (3 max)
- Rappels urgents

**Quand l'IA cherche des emails :**
→ Le panneau slide pour révéler une vue Gmail filtrée avec les résultats en temps réel.
```
┌──────────────────────────┐
│ RÉSULTATS GMAIL      [×] │
│                          │
│ ┌──────────────────────┐ │
│ │ 📧 RE: Accreditation │ │
│ │ De: Zenith Prod      │ │
│ │ 14 mars · ACCEPTÉE   │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ 📧 Accréditation     │ │
│ │ De: Moi              │ │
│ │ 10 mars · Envoyé     │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

**Quand l'IA crée un événement calendrier :**
→ Le panneau slide pour révéler un mini-calendrier avec le nouvel événement qui pulse.

**Quand l'IA utilise la mémoire :**
→ Le panneau affiche les faits mémoire pertinents qu'elle a utilisés.

### 3.3 Navigation & Layout Global

#### 3.3.1 Structure

```
┌────┬──────────────────────────────────────────────┬──────┐
│    │                                              │      │
│  N │  ┌── Header (breadcrumb contextuel) ──────┐  │  C   │
│  A │  │  Chat / [nom du module actif]          │  │  O   │
│  V │  └────────────────────────────────────────┘  │  N   │
│    │                                              │  T   │
│  G  │  ┌── Contenu principal ──────────────────┐  │  E   │
│  A │  │  (chat, brain, reminders, etc.)        │  │  X   │
│  U │  │                                         │  │  T   │
│  C │  │                                         │  │  E   │
│  H │  │                                         │  │      │
│  E │  └────────────────────────────────────────┘  │  P   │
│    │                                              │  A   │
│ 48 │  ┌── Input Area (si chat) ────────────────┐  │  N   │
│  p │  │                                         │  │  E   │
│  x │  └────────────────────────────────────────┘  │  L   │
│    │                                              │      │
└────┴──────────────────────────────────────────────┴──────┘
```

- **Nav gauche (48px)** : Icônes uniquement, pas de labels (labels au hover en tooltip)
- **Contenu principal** : flex-1, scrollable
- **Contexte droit (320px)** : Panneau contextuel dynamique, escamotable

#### 3.3.2 Icônes de navigation (LeftNav)

Ordre repensé :
```
┌────┐
│ 🏠 │  / (Chat)
│ 🧠 │  /brain
│ 📅 │  /calendar
│ 📧 │  /gmail
│ 🎫 │  /accreditations
│ 📌 │  /watch-later
│ 🔔 │  /reminders
│ 📊 │  /activity
│ ⚙  │  /settings
│    │
│ [●] │  Statut Google (vert/jaune/rouge)
└────┘
```

Chaque icône a :
- Un tooltip au hover (apparaît à droite, animé)
- Un badge de notification (petit dot coloré) si données nouvelles
- État actif : background `--surface-3`, bordure gauche 2px `--accent-cool`

#### 3.3.3 Command Palette (⌘K)

Déjà implémentée (`components/ui/CommandPalette.tsx`). À enrichir :
- Recherche sémantique dans la mémoire
- Recherche dans l'historique des chats
- Actions rapides : "Nouveau rappel", "Ajouter à voir plus tard", "Chercher un mail"
- L'IA répond directement dans la palette pour les questions simples

### 3.4 Responsive — Mobile First (vrai)

#### 3.4.1 Mobile (< 768px)

```
┌─────────────────────┐
│ [☰] Chat    [···]   │  ← Top bar fixe
├─────────────────────┤
│                     │
│   Contenu           │
│   (plein écran)     │
│                     │
├─────────────────────┤
│ Input area          │
├─────────────────────┤
│ [🏠][🧠][📅][📧][⚙] │  ← Bottom nav fixe
└─────────────────────┘
```

- La nav gauche devient une bottom tab bar (5 icônes max, le reste dans "Plus")
- Le panneau contexte droit devient un drawer (slide up from bottom)
- Le header est compact, le titre est tronqué

#### 3.4.2 Tablet (768px - 1024px)
- Nav gauche en icônes (pas de labels)
- Panneau contexte en overlay (pas en push)

#### 3.4.3 Desktop (1024px+)
- Layout complet comme décrit en 3.3.1

---

## 4. 🧠 MODULE CERVEAU & MÉMOIRE LONG TERME

### 4.1 Structure de la mémoire (`memory.json`)

```json
{
  "profile": {
    "name": "Mattia",
    "preferences": ["TypeScript", "noir et blanc", "concerts rock"]
  },
  "facts": [
    {
      "id": "mem_001",
      "content": "Mattia utilise Bun comme runtime pour ses projets perso",
      "category": "dev",
      "source": "chat",
      "confidence": 0.9,
      "createdAt": "2026-07-01T10:00:00Z",
      "updatedAt": "2026-07-01T10:00:00Z",
      "accessCount": 3,
      "lastAccessedAt": "2026-07-03T14:00:00Z"
    }
  ],
  "relationships": [
    {
      "id": "rel_001",
      "sourceId": "mem_001",
      "targetId": "mem_005",
      "type": "related_to"
    }
  ]
}
```

**Nouveaux champs proposés :**
- `source` : "chat" | "manual" | "email" | "calendar" — d'où vient ce fait
- `confidence` : 0-1 — à quel point l'IA est sûre de ce fait
- `accessCount` : combien de fois ce fait a été utilisé
- `lastAccessedAt` : dernière utilisation
- `relationships` : liens entre faits (graphe de connaissances)

### 4.2 Comment l'IA apprend (extraction automatique)

Dans `app/api/chat/route.ts`, après chaque réponse de l'IA, un processus d'extraction s'exécute :

1. L'IA analyse son propre message et celui de l'utilisateur
2. Elle identifie les nouveaux faits (nom d'artiste shooté, techno mentionnée, habitude détectée)
3. Elle catégorise automatiquement (dev, photo, life, preference)
4. Elle assigne un score de confiance
5. Les faits sont sauvegardés silencieusement dans `memory.json`

**Prompt d'extraction (injecté périodiquement) :**
```
Analyse cette conversation et extrais des faits sur Mattia. 
Pour chaque fait, indique la catégorie (dev, photo, life, preference) 
et un score de confiance (0-1). Ignore les informations triviales.

Format :
- [catégorie] [confiance] fait
```

### 4.3 Interface utilisateur du /brain — Repensée

#### 4.3.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 🧠 MÉMOIRE                                    [+ Ajouter]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 👤 PROFIL                                        [✏] │    │
│  │ Mattia — Développeur & Photographe de concert       │    │
│  │ Préférences : TypeScript, noir et blanc, ...        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ 💻 DEV   │ │ 📷 PHOTO │ │ 🌿 VIE   │ │ ⚙ PRÉFÉRENCE│  │
│  │   12     │ │    8     │ │    3     │ │      5       │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                             │
│  [Tous] [Dev] [Photo] [Vie] [Préférences]  🔍 Rechercher   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 💻 DEV                                          [···] │    │
│  │ Mattia utilise Bun comme runtime pour ses projets   │    │
│  │ perso                                              │    │
│  │ Source: Chat · Confiance: 90% · Il y a 3j          │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 📷 PHOTO                                         [···] │    │
│  │ Mattia shoote régulièrement au Zénith de Paris      │    │
│  │ Source: Calendar · Confiance: 95% · Il y a 1j      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3.2 Fonctionnalités

- **Stats par catégorie** : 4 cartes résumées en haut
- **Filtres par catégorie** : pills cliquables
- **Recherche full-text** dans les faits
- **Édition inline** : cliquer sur un fait → éditer le contenu, la catégorie
- **Suppression avec undo** : toast "Fait supprimé · [Annuler]" pendant 5s
- **Ajout manuel** : formulaire avec catégorie et contenu
- **Vue graphe** (moonshot) : visualisation du graphe de relations entre faits

#### 4.3.3 L'IA et la mémoire dans le chat

Quand l'utilisateur pose une question, l'IA peut explicitement référencer la mémoire :

```
ASSISTANT · 14:35
D'après ce que je sais de toi 🧠 :
- Tu préfères TypeScript pour tes projets
- Tu as shooté Phoenix au Zénith le 15 mars

Voici ma réponse...
```

Le 🧠 est un lien cliquable qui ouvre /brain avec le fait correspondant.

---

## 5. 🔔 MODULE RAPPELS & NOTIFICATIONS

### 5.1 Architecture de notification

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Frontend   │────▶│  SW polling  │────▶│  Notification   │
│  (visible)  │     │  (background)│     │  API            │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                    │                     │
       │     ┌──────────────┴──────┐              │
       └────▶│  POST /api/reminders│              │
             │  (mark notified)    │              │
             └─────────────────────┘              │
                                                  ▼
                                        ┌─────────────────┐
                                        │  Service Worker  │
                                        │  (push event)    │
                                        └─────────────────┘
```

### 5.2 Service Worker pour notifications en arrière-plan

Le SW actuel (`public/sw.js`) est basique. Il faut le renforcer.

```javascript
// public/sw.js — Évolution

const REMINDER_CHECK_INTERVAL = 60_000; // 1 minute

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
  // Démarrer le polling des rappels
  startReminderPolling();
});

async function startReminderPolling() {
  setInterval(async () => {
    try {
      const reminders = await getPendingReminders();
      for (const r of reminders) {
        if (new Date(r.dueAt).getTime() <= Date.now()) {
          self.registration.showNotification(r.title, {
            body: r.notes || "C'est l'heure !",
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-72.png",
            tag: `reminder-${r.id}`,
            data: { reminderId: r.id, url: "/reminders" },
            requireInteraction: true,
            actions: [
              { action: "done", title: "✓ Fait" },
              { action: "snooze", title: "⏰ +15 min" },
            ],
            vibrate: [200, 100, 200],
          });
        }
      }
    } catch (err) {
      console.error("[SW] Reminder check failed:", err);
    }
  }, REMINDER_CHECK_INTERVAL);
}

async function getPendingReminders() {
  // Fetch depuis le cache d'abord, puis réseau
  const cache = await caches.open("reminders-v1");
  const cached = await cache.match("/api/reminders/pending");
  if (cached) {
    const data = await cached.json();
    // Vérifier si le cache est frais (< 30s)
    const cachedAt = new Date(cached.headers.get("sw-cached-at") || 0);
    if (Date.now() - cachedAt.getTime() < 30_000) {
      return data.reminders;
    }
  }
  try {
    const res = await fetch("/api/reminders/pending");
    if (res.ok) {
      const clone = res.clone();
      cache.put("/api/reminders/pending", clone);
      const data = await res.json();
      return data.reminders;
    }
  } catch {}
  return [];
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { reminderId, url } = event.notification.data;

  if (event.action === "done") {
    // Marquer comme fait via API
    fetch(`/api/reminders/${reminderId}/done`, { method: "POST" });
  } else if (event.action === "snooze") {
    // Repousser de 15 min
    fetch(`/api/reminders/${reminderId}/snooze`, { method: "POST" });
  }

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
```

### 5.3 API endpoint dédié

Créer `GET /api/reminders/pending` :
```typescript
export async function GET() {
  const data = await getReminders();
  const pending = data.reminders.filter(
    (r) => r.status === "pending" && new Date(r.dueAt).getTime() <= Date.now() + 60000
  );
  return NextResponse.json(
    { reminders: pending },
    { headers: { "sw-cached-at": new Date().toISOString() } }
  );
}
```

### 5.4 Rappels créés par l'IA

Dans `app/api/chat/route.ts`, le tool `add_reminder` existe déjà. Améliorations :
- L'IA doit pouvoir programmer des rappels récurrents ("tous les lundis à 9h")
- L'IA doit pouvoir créer un rappel lié à un événement calendrier
- L'IA doit pouvoir créer un rappel lié à un email ("rappelle-moi de répondre à ce mail demain")

### 5.5 Interface /reminders — Améliorations

- **Vue timeline** : Les rappels sont affichés sur une frise chronologique verticale
- **Snooze intelligent** : L'IA suggère le meilleur moment pour snooze en fonction du calendrier
- **Rappels récurrents** : Support de la récurrence (daily, weekly, monthly)
- **Rappels géolocalisés** (moonshot) : "Rappelle-moi d'acheter des piles quand je passe près d'un magasin photo"

---

## 6. 📌 MODULE À VOIR PLUS TARD

### 6.1 Vision

Remplacer définitivement les captures d'écran et les onglets ouverts "au cas où". Chaque lien sauvegardé devient une carte riche et interactive.

### 6.2 Auto-parsing IA

Quand tu colles un lien dans le chat, l'IA :
1. Détecte automatiquement que c'est une URL
2. Fetch les métadonnées (Open Graph, titre, description, thumbnail)
3. Génère un résumé du contenu (via fetch + résumé IA)
4. Propose des tags automatiques
5. Crée une carte "À voir plus tard" en un clic

```
TOI · 15:02
https://www.youtube.com/watch?v=...

ASSISTANT · 15:02
J'ai analysé ce lien :

┌────────────────────────────────────────┐
│ 🎬 YOUTUBE                         [✓] │
│                                        │
│ "Next.js 16 — What's New in the        │
│  App Router"                           │
│  Chaîne: Vercel · 24 min               │
│                                        │
│ Résumé IA : Cette conférence couvre    │
│ les nouvelles APIs de Next.js 16,      │
│ notamment le streaming SSR et les      │
│ React Server Components...             │
│                                        │
│ Tags suggérés : #nextjs #react #web    │
│                                        │
│ [📌 Sauvegarder] [▶️ Regarder] [🗑 Ignorer] │
└────────────────────────────────────────┘
```

### 6.3 Interface /watch-later — Galerie de cartes

```
┌─────────────────────────────────────────────────────────────┐
│ 📌 À VOIR PLUS TARD                           [➕ Ajouter]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Tout] [🎬 Vidéos] [📄 Articles] [📷 Photos] [🎵 Musique] │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │┌────────┐│ │┌────────┐│ │┌────────┐│ │┌────────┐│      │
│  ││ THUMB  ││ ││ THUMB  ││ ││ THUMB  ││ ││ THUMB  ││      │
│  ││        ││ ││        ││ ││        ││ ││        ││      │
│  │└────────┘│ │└────────┘│ │└────────┘│ │└────────┘│      │
│  │          │ │          │ │          │ │          │      │
│  │ Titre    │ │ Titre    │ │ Titre    │ │ Titre    │      │
│  │ Source   │ │ Source   │ │ Source   │ │ Source   │      │
│  │ #tag #tag│ │ #tag #tag│ │ #tag #tag│ │ #tag #tag│      │
│  │ ⏱ 12 min │ │ 📄 5 min │ │ 🎵 3 min │ │ 🎬 45 min│      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Fonctionnalités

- **Vue grille adaptative** : 2 colonnes mobile, 3 tablette, 4 desktop
- **Drag & drop** pour réorganiser
- **Lecture différée** : Pour les articles, extraire le contenu texte et l'afficher en mode lecture (Reader View) directement dans l'app
- **Marquage automatique comme lu** : Si l'utilisateur ouvre le lien, marquer comme lu après 30s
- **Suggestions IA** : "Tu as 3 articles non lus, tu veux que je te les résume ?"
- **Partage rapide** : Bouton pour partager sur les réseaux ou copier le lien

---

## 7. 🎫 MODULE ACCRÉDITATIONS

### 7.1 Accréditation Assistant (IA)

L'IA scanne périodiquement les emails et :
1. Détecte les emails liés aux accréditations (expéditeur, sujet contenant "accréditation", "photo pass", "press")
2. Extrait automatiquement : artiste, lieu, date du concert, statut (demandé/accepté/refusé)
3. Crée ou met à jour la fiche dans `/accreditations`
4. Propose des actions : "Relancer", "Ajouter au calendrier", "Noter le contact"

### 7.2 Relance automatique

Quand une accréditation est en statut "pending" ou "sent" depuis plus de 3 jours :
- L'IA affiche une notification dans le chat : "L'accréditation pour [Artiste] au [Lieu] est sans réponse depuis 3 jours."
- Elle propose un brouillon de relance polie en français
- L'utilisateur peut éditer et envoyer en un clic

### 7.3 Pipeline visuel

Transformer la liste actuelle en un pipeline Kanban (déjà prévu dans DESIGN.md) :

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ ENVOYÉ   │  │ EN ATT.  │  │ ACCEPTÉ  │  │ REFUSÉ   │  │ RELANCE  │
│          │  │          │  │          │  │          │  │          │
│ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │
│ │Card 1│ │  │ │Card 2│ │  │ │Card 3│ │  │ │Card 4│ │  │ │Card 5│ │
│ └──────┘ │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │
│ ┌──────┐ │  │          │  │ ┌──────┐ │  │          │  │          │
│ │Card 6│ │  │          │  │ │Card 7│ │  │          │  │          │
│ └──────┘ │  │          │  │ └──────┘ │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

- Drag & drop entre colonnes
- Compteur par statut
- Filtre par artiste, lieu, date

---

## 8. 📊 MODULE LEETCODE FOCUS COMPANION

### 8.1 Vision

Un coach de code personnel qui s'intègre à ton calendrier et à ton niveau.

### 8.2 Fonctionnalités

#### 8.2.1 Smart Scheduler
- Lit les créneaux libres du calendrier Google
- Propose un exercice LeetCode adapté à la durée du créneau (15 min = Easy, 30 min = Medium, 1h = Hard)
- Tient compte de ton humeur (demandée le matin : "T'es chaud pour du code aujourd'hui ?")

#### 8.2.2 Stats & Progression
- Dashboard personnel : problèmes résolus, streak, temps moyen, sujets maîtrisés
- Radar chart des compétences (Arrays, DP, Trees, Graphs, etc.)
- Suggestions IA : "Tu galères sur les DP, voici 3 exercices progressifs"

#### 8.2.3 Daily Problem
- Chaque jour, un problème recommandé par l'IA
- Notification le matin avec le problème du jour
- Si résolu dans la journée → streak +1

#### 8.2.4 Code Review IA
- Dans le chat, coller du code → l'IA fait une review (complexité, style, edge cases)
- L'IA peut générer des cas de test supplémentaires
- L'IA peut proposer une solution alternative avec explication

#### 8.2.5 Interface /leetcode (nouvelle page à créer)
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 LEETCODE                                     [⚙ Connexion]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │   🔥 47  │  │  ✅ 128  │  │  📈 15%  │  │  ⏱ 42h    │ │
│  │  Streak  │  │  Total   │  │  Top %   │  │  Temps     │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │  📊 Radar Compétences│  │  📅 Problème du jour         │ │
│  │                      │  │                              │ │
│  │   (spider chart)     │  │  "Longest Palindromic        │ │
│  │                      │  │   Substring"                 │ │
│  │                      │  │  Medium · DP · 25 min        │ │
│  │                      │  │  [▶️ Résoudre]               │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  📋 Derniers exercices                               │   │
│  │  ┌──────────────────────────────────────────────────┐│   │
│  │  │ ✅ Two Sum · Easy · 5 min · Il y a 2h           ││   │
│  │  │ ✅ Valid Parentheses · Easy · 8 min · Hier       ││   │
│  │  │ ❌ Merge K Sorted Lists · Hard · 45 min · Hier   ││   │
│  │  └──────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Intégration LeetCode (backend)

Le module `lib/leetcode-api.ts` existe déjà. Améliorations :
- Synchronisation automatique du compte LeetCode (scraping ou API non officielle)
- Mise à jour quotidienne des stats
- Cache des problèmes pour consultation offline

---

## 9. 🚀 CREATIVE FEATURES & MOONSHOTS

### 9.1 CONCERT PREP AGENT 🤘

Le Graal. Quand un concert est ajouté au calendrier (par toi ou par l'IA), un agent dédié se déclenche :

**Phase 1 — Analyse (immédiate) :**
1. Extrait lieu, date, heure, artiste
2. Recherche web : caractéristiques de la salle (capacité, éclairage, fosse photo)
3. Récupère la météo pour le jour J (API METEO France ou OpenWeatherMap)

**Phase 2 — Logistique (J-2) :**
1. Calcule l'itinéraire depuis ton école (ou domicile) avec temps de trajet
2. Vérifie les horaires de transport en commun (API Île-de-France Mobilités ou Google Maps)
3. Génère une checklist personnalisée du sac photo :
   ```
   📋 CHECKLIST — Phoenix @ Zénith, 15 mars
   
   □ Boîtier Sony A7III (batterie chargée ?)
   □ Batterie de rechange (x2)
   □ 24-70mm f/2.8
   □ 70-200mm f/2.8
   □ Cartes SD formatées (x3)
   □ Passe sanitaire / Carte de presse
   □ Bouchons d'oreilles
   □ Veste de pluie (météo : 12°C, pluie légère)
   ```

**Phase 3 — Briefing (J-1) :**
- L'IA envoie une notification : "Concert demain ! Météo, itinéraire et checklist prêts."
- Résumé dans le chat des infos clés

**Phase 4 — Post-concert (J+1) :**
- L'IA demande : "Le concert s'est bien passé ? Tu veux que je crée la fiche de suivi ?"
- Création automatique d'une carte dans le pipeline Kanban Photo

### 9.2 DAILY BRIEF INTELLIGENT 🌅

Le Daily Brief existe déjà (`lib/daily-brief.ts`) mais il est basique. Évolution :

**Ce que l'IA prépare chaque matin (7h) :**
```
🌅 BONJOUR MATTIA — MARDI 15 MARS

📧 EMAILS
• [URGENT] Réponse accréditation Phoenix — ACCEPTÉE
• Newsletter LeetCode — Nouveaux problèmes cette semaine
• 3 emails non lus

📅 AUJOURD'HUI
• 09:00-11:00 — Cours Architecture Logicielle (Salle B12)
• 14:00-15:00 — TP React avancé
• 20:00 — 🎵 CONCERT : Phoenix @ Zénith
  → Départ conseillé : 18:30 (trajet 45 min)
  → Météo : 12°C, pluie légère → Prends un imper
  → Checklist sac photo prête

🧠 À FAIRE
• Relancer l'accréditation pour Justice (sans réponse depuis 5j)
• Finir le kata LeetCode "Longest Palindromic Substring"
• Envoyer la galerie au manager de Phoenix

💡 LEETCODE DU JOUR
• "LRU Cache" — Medium — 25 min
→ Tu as un créneau 11:00-11:30 dans ton calendrier

[Générer le brief] [Marquer comme lu]
```

Le brief est :
- Généré automatiquement à 7h (cron job dans le SW ou appel API programmé)
- Affiché comme premier message dans le chat chaque matin
- Consultable dans /activity avec l'historique

### 9.3 CONTEXT-AWARE SIDE PANEL 🧭

Le panneau droit devient un véritable copilote contextuel.

**Règles d'affichage contextuel :**

| Contexte | Panneau affiché |
|----------|----------------|
| Chat — idle | Daily Brief condensé |
| Chat — l'IA cherche des emails | Résultats Gmail en temps réel |
| Chat — l'IA modifie le calendrier | Mini calendrier avec le changement |
| Chat — l'IA consulte la mémoire | Faits mémoire utilisés |
| Chat — discussion code | Éditeur de code contextuel |
| Page /calendar | Calendrier plein écran (le panneau se rétracte) |
| Page /gmail | Liste emails plein écran |
| Page /accreditations | Stats accréditations |
| Page /brain | Graphe de mémoire |

### 9.4 PHOTO GALLERY DELIVERY TRACKER 📸

Un module qui n'existe pas encore mais qui serait le prolongement naturel du pipeline Kanban.

```
┌─────────────────────────────────────────────────────────────┐
│ 📸 GALERIES                                         [+ New] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Shooted]  [Selecting]  [Editing]  [Delivered]            │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 🎵 Phoenix @ Zénith — 15 mars 2026                │     │
│  │ 📸 847 photos · 23 sélectionnées · 12 éditées     │     │
│  │ 📤 Envoyé à : manager@phoenix.com                 │     │
│  │ 📅 Deadline livraison : 22 mars (dans 7 jours)    │     │
│  │ [Voir la galerie] [Ajouter des photos] [Marquer livré] │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Fonctionnalités :
- Upload batch de photos
- Sélection et tri
- Lien de livraison (Dropbox, Google Drive, WeTransfer) tracké
- Rappel automatique si deadline approche
- Template d'email de livraison généré par l'IA

### 9.5 VOICE MODE 🎙️

Pour les moments où tu ne peux pas taper (en déplacement, avant un concert) :
- Bouton micro dans la barre de saisie
- Reconnaissance vocale (Web Speech API)
- L'IA répond en texte (et potentiellement en vocal avec TTS)
- Commandes vocales : "Ajoute un rappel", "Quel est mon prochain concert ?"

### 9.6 KNOWLEDGE GRAPH VISUALIZATION 🕸️

Visualiser la mémoire de l'IA comme un graphe interactif :
- Nœuds = faits, souvenirs, contacts, événements
- Arêtes = relations sémantiques
- Force-directed layout (D3.js ou Canvas)
- Navigation par zoom/pan
- Cliquer sur un nœud → voir le fait et le modifier

Intégration possible avec le skill `graphify` déjà installé.

### 9.7 EMAIL TRIAGE AGENT 📧

L'IA peut :
- Classer automatiquement les emails par priorité
- Détecter les emails nécessitant une réponse et proposer un brouillon
- Résumer une longue conversation en 3 lignes
- Extraire automatiquement les pièces jointes (billets, accréditations PDF)
- Créer des règles de tri automatiques ("Tous les emails de newsletters → Archive")

---

## 10. 📅 PLAN DE MISE EN ŒUVRE

### Phase 1 — STABILISATION (Sprint 1-2)
_Durée estimée : 2 semaines_

- [ ] Implémenter le mutex par fichier dans `writeJsonAtomic` (2.1.2)
- [ ] Uniformiser les écritures atomiques (2.1.3)
- [ ] Ajouter `readJsonSafe` avec fallback (2.1.4)
- [ ] Healthcheck Google tokens + API endpoint (2.2.2, 2.2.3)
- [ ] Ajouter TTL au cache config (2.3.2)
- [ ] Ajouter `zod` pour valider les payloads des actions (2.6)
- [ ] Ajouter timeout au `webSearch` (2.6)
- [ ] Écrire les tests de résilience (2.5)

#### 🤖 Prompt à donner à OpenCode

```
Lis ROADMAP.md sections 2.1 à 2.6, puis implémente uniquement la Phase 1 :

1. Dans lib/storage.ts, ajoute un système de mutex par fichier avec retry exponentiel
   dans writeJsonAtomic (section 2.1.2 du ROADMAP pour les specs exactes).

2. Dans lib/storage.ts, crée readJsonSafe<T>(filename, fallback) qui ne throw jamais :
   essaie JSON.parse -> si échec, tente le .tmp -> si échec, tente le backup le plus
   récent -> sinon retourne fallback.

3. Modifie lib/config.ts, lib/auth.ts, lib/daily-brief.ts pour utiliser writeJsonAtomic
   au lieu de fs.writeFile direct.

4. Ajoute un TTL de 60s au cache de lib/config.ts (cachedConfig devient { data, ts }).

5. Crée lib/google-health.ts avec checkGoogleHealth() qui vérifie les tokens Gmail
   et Calendar, force le refresh si l'expiration est < 5 min.

6. Crée GET /api/auth/google/health qui appelle checkGoogleHealth() et retourne
   { gmail: { ok, expiresIn }, calendar: { ok, expiresIn } }.

7. Ajoute zod pour valider les payloads dans app/actions/*.ts (au moins
   reminders.ts, accreditations.ts, watch-later.ts, brain.ts).

8. Dans lib/storage.ts webSearch(), ajoute un AbortController avec timeout 10s.

9. Écris les tests dans lib/__tests__/storage.test.ts :
   - corruption JSON -> fallback via readJsonSafe
   - concurrence (2 writeJsonAtomic simultanés sur le même fichier) -> pas de corruption
   - retry exponentiel sur erreur transitoire

10. Lance bun run lint && bunx tsc --noEmit && bun run test pour vérifier.
```

---

### Phase 2 — PERSISTANCE & CHAT (Sprint 3-4)
_Durée estimée : 2 semaines_

- [ ] Persistance de l'historique des conversations (2.4)
- [ ] Sélecteur de sessions dans le chat (3.2.2)
- [ ] Nouveau rendu des messages avec tool calls visuels (3.2.3)
- [ ] Actions chips après chaque message de l'IA (3.2.3)
- [ ] Barre de saisie enrichie avec @mentions et upload (3.2.4)
- [ ] Rate limiting sur l'API chat (2.6)

#### 🤖 Prompt à donner à OpenCode

```
Lis ROADMAP.md sections 2.4 et 3.2, puis implémente uniquement la Phase 2 :

1. Crée data/chat-history.json avec le type ChatHistory (sessions[], chaque session
   contient id, title, messages[], createdAt, updatedAt). Ajoute les fonctions CRUD
   dans lib/storage.ts (getChatHistory, saveChatSession, deleteChatSession).

2. Dans components/chat/ChatView.tsx, ajoute la sauvegarde automatique après chaque
   message reçu (debounce 2s). Au chargement, restore la dernière session ou crée
   une nouvelle. L'IA génère le titre de la session à partir du 1er message utilisateur.

3. Crée components/chat/SessionSidebar.tsx — barre latérale gauche (240px) avec :
   - Timeline verticale des sessions groupées par jour
   - Chaque session = titre auto-généré + date relative + dot couleur (bleu=code, ambre=photo)
   - Barre de recherche en haut pour filtrer
   - Bouton "+ Nouvelle conversation"
   - Intègre-la dans AppShell (entre LeftNav et le contenu principal)

4. Refactore le rendu des messages dans ChatView pour le nouveau design :
   - Message assistant = fond --surface-1, bordure gauche 2px --accent-cool, dot coloré
   - Message utilisateur = fond --surface-2, bordure droite 2px --accent-warm, aligné droite
   - Tool call en cours = bordure cyan --ai-tool-call, barre de progression subtile,
     bloc rétractable montrant le nom du tool + arguments + statut "running..."
   - Tool call terminé = ✓ nom_du_tool · 0.4s · X résultats (succès vert, échec rouge)
   - Curseur clignotant (█) pendant le streaming des mots

5. Ajoute des Actions Chips sous chaque message de l'IA : petits boutons outline mono 11px
   [Voir le mail] [Ajouter au calendrier] [Créer un rappel] [Copier]
   Apparaissent en fade-in 200ms après la fin du message.

6. Améliore la barre de saisie :
   - Bouton [@] pour menu contextuel de mention de modules (@gmail, @calendar, @memory)
   - Bouton [+] pour upload (drag & drop accepté)
   - Ctrl+Enter pour envoyer, Shift+Enter nouvelle ligne
   - Le bouton envoi devient [■] stop pendant la génération

7. Dans app/api/chat/route.ts, ajoute un rate limiter simple (token bucket en mémoire,
   max 30 requêtes par minute par IP).

8. Lance bun run lint && bunx tsc --noEmit && bun run test pour vérifier.
```

---

### Phase 3 — UI/UX REVOLUTION (Sprint 5-7)
_Durée estimée : 3 semaines_

- [ ] Refonte du panneau contextuel dynamique (3.2.5, 9.3)
- [ ] Nouvelles animations et micro-interactions (3.1.3)
- [ ] Responsive mobile complet (3.4)
- [ ] Refonte de l'interface /brain (4.3)
- [ ] Extraction automatique des faits mémoire (4.2)
- [ ] Refonte de l'interface /reminders en timeline (5.5)
- [ ] Refonte de l'interface /watch-later en galerie (6.3)

#### 🤖 Prompt à donner à OpenCode

```
Lis ROADMAP.md sections 3.1, 3.2.5, 3.4, 4.2, 4.3, 5.5, 6.3, 9.3, puis implémente
uniquement la Phase 3 :

1. Refactore components/layout/RightPanel.tsx en ContextPanel dynamique :
   - État idle : calendrier du jour + derniers emails + rappels urgents
   - Quand l'IA cherche des emails (chat envoie event SSE "tool:search_emails") :
     le panneau slide pour afficher les résultats Gmail en temps réel
   - Quand l'IA crée/modifie un événement calendrier : mini calendrier qui pulse
   - Quand l'IA consulte la mémoire : faits mémoire utilisés affichés
   - Transition : slide from right + fade, 350ms cubic-bezier(0.16, 1, 0.3, 1)
   - Utilise un contexte React (ChatContext) pour communiquer l'état du chat au panneau

2. Ajoute les animations micro-interactions définies en 3.1.3 :
   - Messages du chat : stagger 150ms (opacity + translateY(8px))
   - Indicateur "IA pense" : 3 points pulse décalé 800ms
   - Tool calls : bordure scan line animée 1.5s linear
   - Toast notifications : slide down + fade in / slide up + fade out
   - Pas de librairie externe — tout en CSS animations + Tailwind

3. Responsive mobile complet (3.4) :
   - Mobile (<768px) : LeftNav → BottomTabBar (5 icônes max)
   - ContextPanel → Drawer (slide up from bottom)
   - Tablet (768-1024px) : LeftNav icônes seules, ContextPanel en overlay
   - Dans components/layout/Chrome.tsx, adapte MobileBottomNav pour 5 icônes

4. Ajoute l'extraction automatique des faits mémoire (4.2) :
   - Dans app/api/chat/route.ts, après chaque réponse complète de l'IA, appelle
     extractMemoryFacts() qui utilise l'IA pour identifier les nouveaux faits
   - Prompt d'extraction : "Analyse cette conversation et extrais des faits sur
     Mattia. Pour chaque fait, indique la catégorie (dev/photo/life/preference)
     et un score de confiance (0-1). Format : - [catégorie] [confiance] fait"
   - Les faits avec confiance > 0.7 sont sauvegardés automatiquement dans memory.json
   - Ajoute les champs source, confidence, accessCount au type MemoryFact

5. Refonte de /brain (4.3) :
   - Layout avec stats par catégorie (4 cartes en haut)
   - Filtres par catégorie (pills cliquables)
   - Recherche full-text dans les faits
   - Édition inline + suppression avec undo (toast 5s)
   - Ajout manuel avec formulaire catégorie + contenu

6. Refonte de /reminders en timeline verticale (5.5) :
   - Frise chronologique avec past/présent/futur
   - Rappels groupés par jour
   - Ajout du support récurrence (daily/weekly/monthly) dans le type Reminder

7. Refonte de /watch-later en galerie de cartes (6.3) :
   - Grille responsive (2 cols mobile, 3 tablette, 4 desktop)
   - Cartes avec thumbnail + titre + source + tags + temps estimé
   - Filtres : Tout / Vidéos / Articles / Photos / Musique
   - Drag & drop pour réorganiser

8. Lance bun run lint && bunx tsc --noEmit && bun run test pour vérifier.
```

---

### Phase 4 — IA AVANCÉE (Sprint 8-10)
_Durée estimée : 3 semaines_

- [ ] Auto-parsing des liens dans le chat (6.2)
- [ ] Accréditation Assistant avec détection emails (7.1)
- [ ] Relance automatique des accréditations (7.2)
- [ ] Pipeline Kanban accréditations (7.3)
- [ ] Email Triage Agent (9.7)
- [ ] Memory relationships + graphe de connaissances (4.1)
- [ ] Context-aware system prompt enrichi

#### 🤖 Prompt à donner à OpenCode

```
Lis ROADMAP.md sections 4.1, 6.2, 7.1, 7.2, 7.3, 9.7, puis implémente uniquement
la Phase 4 :

1. Auto-parsing des liens dans le chat (6.2) :
   - Dans app/api/chat/route.ts, au début de POST, détecte si le dernier message
     utilisateur contient une URL (regex). Si oui, appelle fetchPageMeta() puis
     génère un résumé IA avant de répondre à la question.
   - Le message de l'IA affiche une carte riche (titre, thumbnail, description,
     tags suggérés) avec boutons [Sauvegarder] [Ignorer].
   - Le bouton Sauvegarder crée automatiquement un WatchLaterItem.

2. Accréditation Assistant (7.1) :
   - Crée un outil IA scan_accreditations qui appelle fetchGmailMessages avec
     query "accréditation OR photo pass OR press" puis analyse les résultats.
   - Extraction automatique : artiste, lieu, date, statut (demandé/accepté/refusé).
   - Crée ou met à jour les fiches dans accreditations.json.
   - Ajoute un bouton [Scanner les accréditations] dans le chat ou sur /accreditations.

3. Relance automatique (7.2) :
   - Dans l'interface /accreditations, pour chaque fiche en statut "sent" ou "pending"
     depuis > 3 jours, affiche une bannière : "Sans réponse depuis X jours".
   - Bouton [Rédiger une relance] qui génère un brouillon d'email poli via l'IA.
   - L'utilisateur peut éditer et envoyer en un clic (via sendGmailReply).

4. Pipeline Kanban accréditations (7.3) :
   - Refactore /accreditations en vue Kanban : colonnes ENVOYÉ | EN ATTENTE |
     ACCEPTÉ | REFUSÉ | RELANCE.
   - Drag & drop des cartes entre colonnes (HTML5 drag & drop natif).
   - Compteur par colonne.
   - Filtre par artiste, lieu, date.

5. Email Triage Agent (9.7) :
   - Crée un outil IA triage_emails qui classe les emails non lus par priorité
     (urgent/normal/basse), détecte ceux nécessitant une réponse, et propose
     un résumé de 3 lignes pour les longues conversations.
   - Ajoute l'affichage du triage dans le ContextPanel côté droit.

6. Memory relationships (4.1) :
   - Ajoute le champ relationships[] au MemoryData (sourceId, targetId, type).
   - Quand l'IA extrait un fait, elle détecte aussi les relations avec les faits
     existants (ex: "Mattia shoote au Zénith" est lié à "Mattia est photographe").
   - Sur /brain, ajoute une mini vue "Faits liés" sous chaque fait.

7. Enrichis le system prompt (app/api/chat/route.ts buildSystemPrompt) avec :
   - Les 10 derniers faits mémoire les plus pertinents
   - Les événements du jour et du lendemain
   - Les accréditations en attente
   - Les 5 derniers rappels pending

8. Lance bun run lint && bunx tsc --noEmit && bun run test pour vérifier.
```

---

### Phase 5 — MOONSHOTS (Sprint 11-14)
_Durée estimée : 4 semaines_

- [ ] Concert Prep Agent complet (9.1)
- [ ] Daily Brief intelligent enrichi (9.2)
- [ ] Service Worker notifications avancées (5.2)
- [ ] Rappels récurrents et géolocalisés (5.5)
- [ ] LeetCode Smart Scheduler + interface dashboard (8.2, 8.5)
- [ ] Photo Gallery Delivery Tracker (9.4)
- [ ] Voice Mode (9.5)
- [ ] Knowledge Graph Visualization (9.6)

#### 🤖 Prompt à donner à OpenCode

```
Lis ROADMAP.md sections 5.2, 8.2, 8.5, 9.1, 9.2, 9.4, 9.5, 9.6, puis implémente
uniquement la Phase 5 :

1. Concert Prep Agent (9.1) :
   - Dans app/actions/ai-tools.ts, crée prepare_concert(concertId) qui :
     a. Lit les infos du concert depuis concerts.json
     b. Cherche la météo pour le lieu et la date (API OpenWeatherMap — utilise
        la variable d'env OPENWEATHERMAP_API_KEY, mais gère le cas où elle
        n'est pas configurée en retournant "Météo non disponible")
     c. Cherche des infos sur la salle (capacité, fosse photo) via webSearch
     d. Génère une checklist sac photo personnalisée via l'IA
     e. Retourne un objet ConcertPrep { weather, venueInfo, checklist, travelTips }
   - Crée un tool IA prepare_concert que l'utilisateur peut appeler depuis le chat
   - Notification J-1 via le Service Worker

2. Daily Brief intelligent (9.2) :
   - Refactore lib/daily-brief.ts pour générer un brief enrichi :
     - Emails urgents détectés (via triage)
     - Agenda du jour formaté
     - Rappels du jour
     - LeetCode du jour recommandé
     - Checklist concert si applicable
     - Météo du jour
   - Ajoute un cron dans le Service Worker qui déclenche la génération à 7h
   - Affiche le brief comme premier message du chat le matin

3. Service Worker notifications avancées (5.2) :
   - Remplace public/sw.js par la version complète décrite en 5.2 :
     - Polling des rappels toutes les 60s
     - Cache des reminders avec TTL 30s
     - Actions sur les notifications (✓ Fait, ⏰ +15 min)
     - notificationclick : focus l'onglet ou ouvre la page

4. Rappels récurrents (5.5) :
   - Ajoute recurrence au type Reminder (null | "daily" | "weekly" | "monthly")
   - Dans le polling SW, après avoir marqué un rappel comme "done", crée
     automatiquement la prochaine occurrence

5. LeetCode Companion (8.2, 8.5) :
   - Crée app/leetcode/page.tsx avec le dashboard :
     - 4 cartes stats (streak, total, top%, temps)
     - Radar chart des compétences (canvas ou SVG)
     - Problème du jour recommandé par l'IA
     - Liste des derniers exercices
   - Smart Scheduler : l'IA lit les créneaux libres du calendrier et propose
     un problème adapté à la durée (Easy ≤ 15 min, Medium ≤ 30 min, Hard ≤ 1h)
   - Utilise les données de lib/leetcode-api.ts et leetcode.json

6. Photo Gallery Delivery Tracker (9.4) :
   - Crée le type GalleryItem dans lib/types.ts
   - CRUD dans lib/storage.ts (gallery.json)
   - Page /gallery avec Kanban : Shooted → Selecting → Editing → Delivered
   - Template email de livraison généré par l'IA
   - Rappel automatique si deadline approche

7. Voice Mode (9.5) :
   - Crée components/chat/VoiceInput.tsx utilisant la Web Speech API
     (SpeechRecognition ou webkitSpeechRecognition)
   - Bouton micro dans la barre de saisie
   - Support des commandes vocales : "Ajoute un rappel", "Quel est mon prochain
     concert ?", "Note que..."

8. Knowledge Graph (9.6) :
   - Sur /brain, ajoute un onglet "Graphe" qui visualise les relations entre
     faits mémoire avec un layout force-directed
   - Implémentation en pur SVG/Canvas sans dépendance externe lourde
   - Navigation zoom/pan, clic sur un nœud → éditer le fait

9. Lance bun run lint && bunx tsc --noEmit && bun run test pour vérifier.
```

---

### Phase 6 — POLISH & PERF (Continu)

- [ ] Optimisation des performances (taille des bundles, lazy loading)
- [ ] Tests E2E (Playwright)
- [ ] Documentation développeur
- [ ] Monitoring et error tracking (Sentry auto-hosted ?)
- [ ] Rotation automatique des backups

#### 🤖 Prompt à donner à OpenCode

```
Lis ROADMAP.md section Phase 6, puis implémente :

1. Optimise les bundles : vérifie avec @next/bundle-analyzer (déjà installé)
   et applique lazy loading (dynamic import) sur les pages lourdes (brain,
   leetcode, watch-later).

2. Ajoute la rotation des backups dans lib/storage.ts maybeBackup() :
   - Garde max 5 backups par fichier
   - Supprime les backups > 7 jours

3. Écris des tests E2E avec Playwright pour les flows critiques :
   - Login passkey → chat → envoi message → réponse IA
   - Création rappel → notification → mark done

4. Vérifie la couverture de tests : bun run test --coverage

5. Lance bun run lint && bunx tsc --noEmit && bun run test pour vérifier.
```

---

## Annexe A — Dépendances futures envisagées

| Package | Usage | Priorité |
|---------|-------|----------|
| `zod` | Validation des payloads | Phase 1 |
| `d3` ou `@antv/g6` | Graphe de connaissances | Phase 5 |
| `@react-spring/web` ou `framer-motion` | Animations avancées | Phase 3 |
| `playwright` | Tests E2E | Phase 6 |

## Annexe B — Variables d'environnement à ajouter

```bash
# Météo
OPENWEATHERMAP_API_KEY=xxx

# Transport (optionnel)
ILE_DE_FRANCE_MOBILITES_API_KEY=xxx

# LeetCode scraping (optionnel)
LEETCODE_SESSION_COOKIE=xxx

# Error tracking (optionnel)
SENTRY_DSN=xxx
```

## Annexe C — Structure des fichiers data après évolution

```
data/
├── config.json              # Configuration (modèles, thème, features)
├── users.json               # Comptes utilisateurs (passkeys)
├── memory.json              # Mémoire long terme de l'IA
├── concerts.json            # Pipeline Kanban photo
├── leetcode.json            # Progression LeetCode
├── reminders.json           # Rappels
├── watch-later.json         # Liens sauvegardés
├── accreditations.json      # Demandes d'accréditation
├── activity.json            # Journal d'activité
├── emails.json              # Cache emails Gmail
├── chat-history.json        # Historique des conversations (NOUVEAU)
├── daily-briefs.json        # Briefs quotidiens
├── gmail-token.json         # Token OAuth Gmail
├── calendar-token.json      # Token OAuth Calendar
├── gallery.json             # Suivi des galeries photo (NOUVEAU)
└── backups/                 # Backups automatiques (30 min)
    ├── memory.json.2026-07-05T14-30-00.bak
    └── ...
```

---

> **Ce document est la bible du projet BACKSTAGE.**
> Toute contribution, PR, ou idée doit s'y référer.
> Mis à jour le 5 juillet 2026.
