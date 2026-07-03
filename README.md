# PersonalBrain

**Second cerveau IA · Code · Photo · Mémoire**

Une PWA personnelle qui centralise chat IA, mémoire longue, rappels, agenda, mails,
watch-later, accréditations photo et brief du matin — le tout dans une seule interface
éditoriale sombre, installable, utilisable hors-ligne.

> _Un bon outil personnel, c'est comme une bonne photo : si tu remarques l'interface avant l'intention, c'est raté._

---

## 🧠 Ce que c'est

PersonalBrain n'est pas un dashboard de plus. C'est un espace de travail unique où
l'IA conversationnelle, la mémoire persistante et les outils du quotidien (Gmail,
Calendar, LeetCode, concerts) se répondent entre eux.

- **Chat IA streaming** (OpenAI / Anthropic) avec raisonnement visible, appels d'outils en direct
- **Mémoire** : l'IA se souvient de faits, et tu peux les corriger, oublier, explorer
- **Rappels** natifs navigateur + brief quotidien automatique
- **Watch-later** : liens, articles, vidéos YouTube avec extraction d'aperçu (og:image)
- **Agenda & Mail** : intégration Google via OAuth
- **Accréditations** : gestion des accréditations photo concerts (suit mes shootings)
- **Recherche web** : SearchAPI (Google) avec fallback DuckDuckGo
- **PWA** : installable, fonctionne hors-ligne, service worker, manifest
- **Thèmes & accent** : dark/light, couleur d'accent personnalisable, picker de thème

---

## 💻 Stack

| Frontend                     | Backend / Runtime          | Data / Infra                | Auth                              |
| ---------------------------- | -------------------------- | --------------------------- | --------------------------------- |
| ![Next.js](https://img.shields.io/badge/Next.js-000?style=flat-square&logo=nextdotjs&logoColor=white) | ![Bun](https://img.shields.io/badge/Bun-000?style=flat-square&logo=bun&logoColor=f9f1e1) | ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) | ![Google OAuth](https://img.shields.io/badge/Google_OAuth-4285F4?style=flat-square&logo=google&logoColor=white) |
| ![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB) | ![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white) | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) | ![Passkey](https://img.shields.io/badge/Passkey_(WebAuthn)-34a853?style=flat-square&logo=webauthn&logoColor=white) |
| ![react-markdown](https://img.shields.io/badge/react--markdown-000?style=flat-square&logo=markdown&logoColor=white) | ![Anthropic](https://img.shields.io/badge/Anthropic-191919?style=flat-square&logo=anthropic&logoColor=white) | ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white) | |
| | ![google-auth-library](https://img.shields.io/badge/google--auth--library-4285F4?style=flat-square&logo=google&logoColor=white) | | |

---

## 🌟 Le truc qui me tient à cœur

![Aperçu](public/screenshots/shot.png)

- **Tout dans une seule vue** : chat à gauche, agenda / mail / leetcode / mémoire à droite, aucune page qui coupe le flux
- **IA qui agit vraiment** : `fetch_page`, `fetch_page_title`, `search_web`, `remember_fact` — pas du texte dans un coin
- **Pensé pour le quotidien** : raccourcis clavier (`⌘K` palette, `?` aide), PWA installable, fonctionne en 3G
- **Le détail, c'est l'intention** : un loader avant que l'IA ne "pense", un dot animé pendant qu'elle raisonne, un toast quand elle touche au calendrier

➜ **[Voir le code en action](#installation)** (clone + `bun dev`)

---

## ⚡ Décisions techniques notables

1. **Next.js 16 App Router + React 19** — Server Actions pour la mémoire et les rappels, Server Components pour les vues, streaming IA via Route Handler SSE
2. **`googleapis` → `google-auth-library`** — moins de surface, plus de contrôle sur les tokens et le refresh
3. **Cache client TTL + stale-while-revalidate** — pas de re-fetch agressif, données toujours fraîches sous 60s
4. **Service Worker maison** — pas de Workbox, stratégie `cache-first` pour le shell, `network-first` pour les API
5. **Manifeste + icônes SVG** — pas de PNG à générer, scalables à toutes les tailles
6. **Pas de base de données** — pour l'instant, fichiers JSON + mémoire serveur. C'est personnel, c'est assumé.

> Un bon outil personnel, c'est un outil qu'on peut ouvrir à 2h du matin
> sans se demander si la dépendance de gauche va casser.

---

## 🚀 Installation

```bash
git clone https://github.com/MattiaPARRINELLO/personalbrain.git
cd personalbrain
bun install
cp .env.example .env.local   # GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, ANTHROPIC_API_KEY, SEARCHAPI_API_KEY
bun dev
```

L'app démarre sur [http://localhost:3000](http://localhost:3000).

### Variables d'environnement

| Var                    | Rôle                                                |
| ---------------------- | --------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth Google (Calendar + Gmail)                     |
| `GOOGLE_CLIENT_SECRET` | OAuth Google                                        |
| `OPENAI_API_KEY`       | Modèles OpenAI (chat, raisonnement)                 |
| `ANTHROPIC_API_KEY`    | Modèles Anthropic (chat, raisonnement)              |
| `SEARCHAPI_API_KEY`    | Recherche web Google (optionnel, fallback DDG)      |
| `AUTH_SECRET`          | Session cookie signing (passkey + Google)           |

### Commandes

```bash
bun dev          # dev server
bun run build    # production build
bun run start    # production server
bun run lint     # eslint
bun run test     # vitest (unit tests)
bun run test:watch
```

---

## 🗂️ Structure

```
app/
  ├─ (chat)            # Chat IA + AppShell
  ├─ brain/            # Mémoire (faits, CRUD)
  ├─ reminders/        # Rappels + notifications natives
  ├─ watch-later/      # Liens, articles, vidéos
  ├─ calendar/         # Google Calendar
  ├─ gmail/            # Gmail
  ├─ activity/         # Journal d'activité
  ├─ search/           # Recherche web + mémoire
  ├─ accreditations/   # Accréditations photo
  ├─ settings/         # Thème, accent, profil
  └─ api/              # SSE chat, Google proxy
components/
  ├─ chat/             # ChatView, streaming, tool calls
  ├─ layout/           # AppShell, Chrome, RightPanel
  ├─ ui/               # Primitives (Markdown, CommandPalette, KeyboardShortcuts, AccentPicker, ThemeApplier, PwaLoader, OfflineBanner)
  └─ widgets/          # Calendar, Gmail, LeetCode, Accreditations
lib/
  ├─ ai-providers.ts   # Streaming OpenAI + Anthropic + reasoning
  ├─ google-actions.ts # Wrappers Calendar + Gmail
  ├─ storage.ts        # Persistance JSON, web search
  ├─ cache.ts          # TTL, SWR, optimistic updates
  ├─ server-cache.ts   # Cache côté serveur (process memory)
  ├─ daily-brief.ts    # Brief du matin
  ├─ offline.ts        # IndexedDB + queue offline
  └─ types.ts          # Types métier (memory, activity, reminders…)
public/
  ├─ sw.js             # Service worker
  ├─ manifest.json     # PWA manifest
  └─ icons/            # SVG icons
```

---

## 📬 Me retrouver

| Contact               | Lien                                                               |
| --------------------- | ------------------------------------------------------------------ |
| Email                 | [contact.mprnl@gmail.com](mailto:contact.mprnl@gmail.com)          |
| GitHub                | [github.com/MattiaParrinello](https://github.com/mattiaPARRINELLO) |
| Portfolio développeur | [dev.mprnl.fr](https://dev.mprnl.fr)                               |
| Portfolio photo       | [photo.mprnl.fr](https://photo.mprnl.fr)                           |
| Instagram photo       | [instagram.com/mattia_jpeg](https://instagram.com/mattia_jpeg)     |
