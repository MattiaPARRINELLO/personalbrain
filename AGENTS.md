<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# BACKSTAGE — Agent instructions

Assistant personnel PWA — chat IA, rappels, calendrier, mails, mémoire, photo.
Mono-utilisateur, auth par passkey, données en JSON local.

---

## ⚠️ À lire avant toute modification

1. **`proxy.ts` protège TOUT par défaut.** Toute nouvelle route est privée
   sauf ajout explicite dans `PUBLIC_PATHS` / `PUBLIC_API_PREFIXES`.
2. **Server Actions : retour brut + `throw`.** Pas de wrapper `{ ok, error }`.
3. **`requireSession()` en première ligne** de chaque Server Action. Sans exception.
4. **Bun uniquement.** `bun run <script>` — jamais `npm`/`yarn`/`bun build`.
5. **`data/` est gitignoré et contient des secrets réels.** Ne jamais l'afficher,
   le committer, ni le logger.

---

## Stack

|            |                                                                   |
| ---------- | ----------------------------------------------------------------- |
| Runtime    | **Bun** (`bun.lock`)                                              |
| Framework  | Next.js **16.2.10** — App Router, `output: "standalone"`          |
| React      | 19.2.4                                                            |
| CSS        | Tailwind **v4** via `@tailwindcss/postcss`                        |
| Validation | **Zod 4**                                                         |
| Auth       | Passkey WebAuthn (`@simplewebauthn/*`) + JWT maison               |
| IA         | OpenAI SDK 6 + Anthropic SDK — unifiés dans `lib/ai-providers.ts` |
| Data       | JSON dans `data/` (gitignoré), écritures atomiques                |
| Push       | `web-push` (VAPID)                                                |
| Unit       | **Vitest 4** (`environment: "node"`)                              |
| E2E        | **Playwright** (chromium, workers: 1)                             |
| Icons      | `lucide-react`                                                    |
| Markdown   | `react-markdown` + `remark-gfm`                                   |

**Pas de Capacitor** — supprimé, le projet est PWA uniquement.

---

## Commands

| Usage            | Command                    |
| ---------------- | -------------------------- |
| Dev              | `bun dev`                  |
| Build            | `bun run build`            |
| Start (prod)     | `bun run start`            |
| Lint             | `bun run lint`             |
| Typecheck        | `bunx tsc --noEmit`        |
| Tests unitaires  | `bun run test`             |
| Tests (watch)    | `bun run test:watch`       |
| Tests E2E        | `bun run test:e2e`         |
| Bundle analyzer  | `bun run analyze`          |
| Cron rappels     | `bun run cron:reminders`   |
| Cron daily brief | `bun run cron:daily-brief` |
| Reset passkey    | `bun run reset:passkey`    |

⚠️ `bun build` ≠ `bun run build`. Le premier est le bundler Bun et ne construit
pas l'app Next.

---

## Git — règle stricte

- **Committer systématiquement** : toute modification terminée et vérifiée est
  committée immédiatement.
- **Working tree propre en fin de tâche.** Aucun changement en attente.
- Un commit par modification cohérente. Message **en français**, conventional
  commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- Ne jamais committer : `.env*`, `.deploy.env`, `data/`, `coverage/`,
  `test-results/`, `*.tsbuildinfo`.

---

## Architecture

```
app/
  actions/          20 Server Actions ("use server") + __tests__/
  api/              Route Handlers
  <page>/           page.tsx + composants LOCAUX à cette page
components/
  ui/               primitives partagées (Button, Card, Toast, Skeleton…)
  layout/           AppShell, Chrome, ContextPanel, FluxTimeline
  chat/             composants du chat
  widgets/          cartes dashboard
  landing/          composants de la page publique
  brain/            KnowledgeGraph
lib/
  cesar-client.ts   client CESAR (emploi du temps) — fetch HTTP pur, SANS navigateur
  storage/          CRUD par domaine (15 fichiers)
  types/            définitions par domaine (17 fichiers)
  ai-providers/     openai, anthropic, config, types
  __tests__/        tests unitaires
e2e/                specs Playwright (helpers, global-setup, projets no-auth/chromium)
scripts/            cron-scheduler, reset-passkey, cesar-smoke, scripts de QA/screenshots
```

### Pages particulières

- `/chat` — accueil = `components/chat/HomeHero.tsx` (affiché seulement quand la
  conversation est vide). Agrégat serveur `getHomeOverview()` (`app/actions/home.ts`,
  lectures `data/*.json` uniquement — aucun appel réseau) + **cache client partagé**
  avec les widgets du panneau de droite (`CALENDAR_CACHE_KEY`, `GMAIL_CACHE_KEY`
  exportés par `components/widgets/`). ➡️ Ne jamais dupliquer ces fetchers : réutiliser
  les mêmes clés, sinon l'accueil déclenche des requêtes réseau en double.
  Exception visuelle assumée (dégradés radiaux, sheen, animations d'inactivité) :
  cf. `DESIGN.md > Console IA`.
  ⚠️ La composition d'accueil est **ancrée en haut** et le conteneur de
  `ChatView.tsx` n'a **pas** de padding haut dans ce cas : c'est ce qui amène le
  tour de cou du badge détaillé (`/backstage-logo.png`) jusqu'au bord supérieur
  de la fenêtre, qui tient alors lieu de ligne de coupe. Réintroduire
  `py-8 sm:py-12` ou `justify-center` casse l'effet (et fait déborder la
  colonne). La marge négative de `HomeHero.tsx` est **mobile uniquement**. Le
  logo simple reste l'icône partout ailleurs.
- Panneau de droite (`components/layout/ContextPanel.tsx`) — 5 vues : « Flux »
  (défaut) = `FluxTimeline.tsx`, qui **fusionne cours + événements agenda +
  rappels** en une ligne de temps groupée par jour ; puis Agenda / Inbox / Code /
  Photos, qui réutilisent les widgets de `components/widgets/`. Un bloc « En
  retard » plafonné à 4 entrées précède la ligne de temps. Quand un outil IA
  tourne, le panneau bascule sur une vue contextuelle (ne pas casser ce chemin).
- `components/chat/SessionSidebar.tsx` — historique des conversations. Bandeau de
  3 compteurs en pied, alimenté par `home:overview` + `GMAIL_CACHE_KEY`
  (mêmes clés partagées, aucune requête supplémentaire).
- ⏱️ `lib/clock.ts` expose `useNow()` : horloge partagée (tick 30 s) dont le
  **snapshot serveur vaut 0**. C'est ce qui rend les salutations et l'heure live
  hydratation-safe. Ne pas réintroduire de `useState`/`useEffect` pour ça :
  la règle ESLint `react-hooks/set-state-in-effect` du projet le refuse.
- `/today` — page d'agrégat « Aujourd'hui » (rappels du jour, agenda, relances), 2e destination du rail.
- `/gallery` — redirige vers `/photos` (la galerie de livraison est la vue « Livraison » de Photos, `app/photos/GalleryKanban.tsx`).
- `/photos` — kanban shootings + toggle de vue « Shootings / Livraison ».
- `/demo-calls` — console privée authentifiée des appels IA de la démo publique
  (`/api/demo`) : question/réponse, IP, user-agent, statut, durée et sources.
- `/schedule` — emploi du temps CESAR (vue semaine + bouton Sync). Nourrit aussi
  la section « Cours » de `/today`, le daily brief et les notifications −30 min.

### Où placer un composant

| Utilisé par            | Emplacement                               |
| ---------------------- | ----------------------------------------- |
| Une seule page         | `app/<page>/MonComposant.tsx`             |
| Plusieurs pages        | `components/<catégorie>/MonComposant.tsx` |
| Primitive UI générique | `components/ui/`                          |

⚠️ `components/reminders/` et `components/watch-later/` sont **vides** — les vrais
composants sont dans `app/reminders/` et `app/watch-later/`. Ne pas s'y fier.

---

## Auth & sécurité

### proxy.ts — deny-by-default

Matcher : tout sauf `_next/static`, `_next/image`, `assets`, `icons`, `images`,
`android-chrome-*`, `apple-touch-*`.

**Publics** :

- Pages : `/`, `/login`, `/notif`, `/offline`, `/privacy` (+ sous-routes)
- API : `/api/auth`, `/api/cron`, `/api/push`, `/api/reminders/pending`
- Fichiers racine : `.js`, `.json`, `.ico`, `.png`, `.svg`, `.webp`, `.txt`

**Comportement sans session valide** :

- `/api/*` → `401 JSON`
- autre → `redirect("/login")`

Le proxy tourne sur le **runtime Node par défaut** (Next 16 ; edge possible) →
utilise `lib/session-edge.ts` (`verifyJwt`, `SESSION_COOKIE`). Ne pas y importer
de code lourd (`fs`, `path`) si un jour déployé en edge.

✅ **Migration `middleware.ts` → `proxy.ts` réalisée** (Next 16.2 déprécie
l'ancien nom) : fichier renommé, fonction exportée `proxy`, runtime Node par
défaut. Testé par `proxy.test.ts` et les E2E (deny-by-default).

### Routes notables hors `/api/auth`

- `/api/chat/confirm` — **exécute les outils IA à effet externe après
  confirmation utilisateur** (bouton Confirmer/Annuler dans le chat). Session
  requise ; seuls les outils listés dans `REQUIRE_CONFIRMATION`
  (`lib/chat-tools.ts`) sont exécutables ; journalise dans `activity.json`
  (`ai_action`). Le modèle ne peut jamais s'auto-confirmer.
- `/api/auth/set-session` — **supprimé** (reliquat Capacitor, 0 appelant).
- `/api/reminders/[id]/done` — reproduit `markReminderStatus` (push MS +
  revalidation) ; appelé par le service worker.
- `/api/schedule` — `GET` = emploi du temps en cache, `POST` = sync CESAR forcée.
  Doublon assumé de `syncScheduleNow` (`app/actions/schedule.ts`).

### Emploi du temps CESAR (`lib/cesar-client.ts`)

⚠️ **Aucun navigateur en prod** (cPanel `npm install --production`, pas de
Chromium) : le client est du **fetch HTTP pur** — `GET /connexion` (CSRF) →
`POST` login → skip de l'écran CVEC → `GET /schedule` → décodage de l'attribut
`data-tui-calendar-event-lesson-schedules-value` (JSON de toutes les séances).
Ne jamais réintroduire Playwright ici : ça casse la prod standalone.

- Sortie normalisée : `ScheduleCourse` (matière, prof, salle+bâtiment, start/end
  en ms, annulés filtrés) dans `data/schedule.json`.
- ⚠️ `getNextCourse()` (`lib/storage/schedule.ts`) retourne le premier cours dont
  `end > now` — donc **le cours en cours s'il y en a un**, et il ne filtre pas
  `cancelled`. Pour « le prochain à venir », filtrer `!cancelled` puis `start > now`.
- Sync automatique : `syncScheduleIfStale()` (notification-scheduler) si l'EDT a
  plus de 6 h, est vide, ou si le dernier sync a échoué. Garde anti-concurrence
  dans `lib/storage/schedule.ts`.
- Notifications : `checkScheduleNotifs()` envoie un push **30 min avant** chaque
  cours (matière + salle + heure), anti-doublon dans `data/notified-courses.json`.
- Chat : outil **lecture seule** `get_schedule` (`scope: today|week|next`,
  `subject` optionnel) — jamais dans `REQUIRE_CONFIRMATION`.
- Daily brief : bloc « Cours du jour » + instruction de citer la salle du
  prochain cours.

### Trois implémentations de session — ne pas confondre

| Fichier               | Runtime | Usage                                                                              |
| --------------------- | ------- | ---------------------------------------------------------------------------------- |
| `lib/session-edge.ts` | edge/node | proxy (`proxy.ts`) uniquement                                                    |
| `lib/session-core.ts` | node    | logique JWT + `fs`                                                                 |
| `lib/session.ts`      | node    | **à importer dans les Server Actions** — expose `requireSession()`, `getSession()` |

### Helpers sécurité — état réel

| Helper                  | Fichier             | Consommé par                           |
| ----------------------- | ------------------- | -------------------------------------- |
| `checkRateLimit(key)`   | `lib/rate-limit.ts` | `app/api/chat/route.ts` **uniquement** |
| `isAuthorizedCron(req)` | `lib/cron-auth.ts`  | les 2 routes `/api/cron/*`             |

⚠️ **Dette connue** : pas de protection CSRF active (seule atténuation :
`SameSite=lax`). Les Server Actions ne sont pas rate-limitées. Si tu ajoutes une
action coûteuse (IA, scraping), signale-le.

### next.config.ts — headers

Toujours : `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `X-DNS-Prefetch-Control`.
En production seulement : `HSTS` + `CSP`.

⚠️ La CSP autorise `script-src 'unsafe-inline'` — requis par les scripts inline
de préchargement RSC de Next. Ne pas « corriger » sans vérifier que l'app démarre.

---

## Server Actions — pattern canonique

```ts
"use server";

import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addReminder, logActivity } from "@/lib/storage";
import type { Reminder } from "@/lib/types";

const createReminderSchema = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  dueAt: z.string().min(1, "Date d'echeance requise"),
});

export async function createReminder(input: {
  title: string;
  dueAt: string;
}): Promise<Reminder> {
  await requireSession(); // 1. auth systématique

  const parsed = createReminderSchema.safeParse(input); // 2. validation Zod
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }

  const reminder = await addReminder(parsed.data); // 3. storage
  await logActivity("reminder_created", `Rappel créé : ${reminder.title}`);
  revalidatePath("/reminders"); // 4. revalidation

  return reminder; // 5. donnée BRUTE
}
```

### Règles

- **Retour** : la donnée brute (`Reminder`, `boolean`, `null`…). **Pas de wrapper.**
- **Erreur** : `throw new Error("message en français")`. Le client fait son
  `try/catch` — il n'y a pas de gestionnaire centralisé.
- **Validation** : Zod, schémas en tête de fichier, `.strict()` sur les updates,
  `safeParse` puis throw du premier `issue.message`.
- **IDs** : `if (!id || typeof id !== "string") throw new Error("Identifiant requis")`.
- **Revalidation** : `revalidatePath` uniquement. `revalidateTag` n'est jamais
  utilisé dans ce projet.
- **Messages d'erreur en français, sans accent** (cf. `"Date d'echeance requise"`).

### Recouvrement Actions ↔ Route Handlers

Certaines routes dupliquent des actions (`/api/reminders/[id]/done` ↔
`markReminderStatus`, `/api/memory/remember` ↔ `rememberFact`, `/api/gallery`,
`/api/calendar`, `/api/todo`).

C'est **volontaire** : ces endpoints servent des clients non-React (service
worker, notifications push, cron). Avant d'en ajouter un, vérifie qu'une action
ne suffit pas. Et si tu modifies la logique d'un côté, **répercute de l'autre**.

---

## Data layer

### lib/storage-core.ts — moteur

| Fonction                                   | Rôle                                  |
| ------------------------------------------ | ------------------------------------- |
| `writeJsonAtomic<T>(file, data, retries?)` | écriture `.tmp` + rename sous lock    |
| `mutateJson<T>(file, fallback, mutator)`   | read→mutate→write sous lock + backup  |
| `readJsonSafe<T>(file, fallback)`          | fichier → `.tmp` → backup → fallback  |
| `readOrCreate<T>(file, fallback)`          | lit ou initialise                     |
| `maybeBackup(file)`                        | backup ≤ 30 min, rotation 7 j / 5 max |

### lib/storage.ts — barrel PARTIEL

Ré-exporte `export *` des 14 domaines + `./web`, mais de `storage-core` seulement
**`readJsonSafe`** et **`writeJsonAtomic`**.

➡️ Pour `mutateJson`, `readOrCreate`, `maybeBackup` : importer directement
`@/lib/storage-core`.

### Fichiers data/

`accreditations` · `activity` · `chat-history` · `concerts` · `config` ·
`consent` · `demo-calls` · `emails` · `gallery` · `intentions` · `leetcode` · `memory` ·
`notified-courses` · `notified-reminders` · `photo-shoots` · `push-subscriptions` ·
`reminders` · `schedule` · `server-cache` · `users` · `watch-later`

Tokens OAuth : `calendar-token` · `gmail-token` · `microsoft-todo-token` ·
`firebase-service-account`
Backups auto : `data/backups/`

---

## Types

Définitions dans `lib/types/<domaine>.ts`. `lib/types.ts` est un **barrel pur**
(`export *`, aucune définition propre). Aucun doublon.

➡️ Toujours importer depuis `@/lib/types`.

Nouveau domaine → nouveau fichier dans `lib/types/` + ajout au barrel.

---

## Intégrations externes

| Service                  | Client                                                           | Tokens                                           |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------------------ |
| Google (Gmail, Calendar) | `lib/google-client.ts`, `lib/google-actions.ts`                  | `data/{gmail,calendar}-token.json`, refresh auto |
| Microsoft To Do          | `lib/microsoft-client.ts`, `lib/reminder-sync.ts`                | `data/microsoft-todo-token.json`                 |
| LeetCode                 | `lib/leetcode-api.ts`                                            | —                                                |
| Web search               | `lib/web.ts` — Brave + fallback DuckDuckGo, garde SSRF           | —                                                |
| Emploi du temps CESAR    | `lib/cesar-client.ts` (fetch pur, aucun navigateur)              | `CESAR_USERNAME` / `CESAR_PASSWORD`              |
| Météo                    | OpenWeatherMap (`lib/daily-brief.ts`, `lib/storage/concerts.ts`) | —                                                |
| Push                     | `lib/send-push.ts`, `lib/push-subscriptions.ts`                  | VAPID                                            |

⚠️ **Sync bidirectionnelle Microsoft** : `loadReminders()` appelle
`reconcileRemindersWithMicrosoft()` ; create/update/delete poussent vers MS.
Toute modification du CRUD rappels doit préserver ces appels.

⚠️ **API LeetCode — pièges vérifiés** (`alfa-leetcode-api.onrender.com`, tier
gratuit : démarrage à froid possible) :

- Les compteurs ne sont **pas** sur `/{pseudo}` (qui ne renvoie que le profil)
  mais sur `/{pseudo}/solved` (`solvedProblem`, `easySolved`…). Les lire sur le
  profil donne quatre zéros silencieux.
- Un pseudo inconnu répond **HTTP 200** avec un tableau `errors` : le code HTTP
  ne suffit pas, il faut inspecter le corps.
- `/{pseudo}/calendar` renvoie `submissionCalendar`, une **chaîne JSON**
  `{ "<epoch secondes>": n }` (minuit UTC, jours actifs seulement) et un champ
  `streak` de sémantique non documentée : la série est **recalculée** par
  `computeStreak()` (`lib/leetcode-utils.ts`), jamais lue depuis l'API.
- `/{pseudo}/contest` est facultatif : un compte sans concours renvoie
  `contestParticipation: []` et son échec ne doit pas priver du reste.
- `ranking` vaut 5 000 001 tant que le compte n'est pas classé → afficher
  « non classé » (`UNRANKED_RANKING`), jamais le nombre brut.

La synchro est pilotée par un TTL de 30 min (`SYNC_TTL_MS` dans
`app/actions/leetcode.ts`) et non plus par `streak === 0`, qui figeait les
chiffres à vie. L'échec d'un sync est remonté via `syncError` (jamais persisté) :
ne pas réintroduire de `catch {}` vide, c'est ce qui a masqué la panne.

---

## instrumentation.ts — piège documenté

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("dotenv/config");
    const { startScheduler } = await import("./lib/notification-scheduler");
    startScheduler();
  }
}
```

⚠️ Les imports sont **dynamiques et gardés par `NEXT_RUNTIME`** volontairement.
Un import statique de `dotenv` embarque `fs`/`path`/`os`/`crypto` dans le bundle
edge et **crashe le proxy** (`__import_unsupported is not defined`).
**Ne pas convertir en imports statiques.**

---

## Tests

### Vitest — `environment: "node"`, pas de jsdom

`exclude: ["node_modules", ".mimocode", "e2e", "**/e2e/**"]`, alias `@` → racine.

Emplacements : `lib/__tests__/`, `app/actions/__tests__/`,
`app/calendar/__tests__/`, `app/api/chat/__tests__/` + 2 fichiers **à la
racine** : `proxy.test.ts` (deny-by-default) et `cron-auth.test.ts`
(secret partagé).

**Tests dépendant du FS** : mocker `process.cwd()` **puis** faire un
`await import()` dynamique du module storage. `lib/__tests__/__fs-mock-helper.ts`
expose une `Map` partagée entre la factory `vi.mock` et le test — ce fichier ne
doit **jamais** importer du code projet (deps circulaires).

### Playwright

`testDir: "./e2e"`, `workers: 1`, `fullyParallel: false`.
`webServer` lance `bun run dev` sur `:3000` (réutilise un serveur existant hors CI).

**Deux projets** :

- `chromium` — pages protégées, avec `storageState: e2e/.auth/state.json`
  (cookie `pb_session` valide signé avec `AUTH_SECRET` de l'environnement,
  généré par `e2e/global-setup.ts` via `e2e/helpers.ts`).
- `no-auth` (`e2e/public.spec.ts`) — pages publiques et redirections.

Règles : les specs **ne doivent déclencher aucune mutation** (lectures pures
uniquement — le serveur dev utilise `data/` réel) ni appeler le backend IA.
Lancer avec le scheduler neutralisé :
`AUTH_SECRET="$(openssl rand -hex 32)" VAPID_PRIVATE_KEY="" NEXT_PUBLIC_VAPID_PUBLIC_KEY="" bun run test:e2e`
(pas de VAPID → pas de notification push réelle pendant les tests).
`e2e/.auth/` est gitignoré (JWT de session, ne jamais committer).

**CI** : `.github/workflows/ci.yml` — lint, typecheck, tests unitaires et
build à chaque push/PR (job `quality`) + suite E2E Playwright (job `e2e`,
avec AUTH_SECRET aléatoire et VAPID vides).

---

## Variables d'environnement

`.env.local` contient des credentials réels — ne jamais l'afficher ni le logger.

### Requises

| Variable                                         | Usage                                  |
| ------------------------------------------------ | -------------------------------------- |
| `NEXT_PUBLIC_API_URL`                            | endpoint IA                            |
| `IA_API_KEY`                                     | clé IA                                 |
| `AUTH_SECRET`                                    | signature JWT (64 hex)                 |
| `WEBAUTHN_RP_ID`                                 | passkey                                |
| `WEBAUTHN_ORIGIN`                                | passkey                                |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | OAuth Google                           |
| `CRON_SECRET`                                    | obligatoire en prod pour `/api/cron/*` |
| `CESAR_USERNAME` / `CESAR_PASSWORD`              | emploi du temps CESAR                  |

### Optionnelles

`MICROSOFT_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` · `SETUP_TOKEN`
(enregistrement passkey initial) · `OPENWEATHERMAP_API_KEY` ·
`BRAVE_SEARCH_API_KEY` · `VAPID_SUBJECT` / `VAPID_PRIVATE_KEY` /
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` · `CRON_BASE_URL` · `ANALYZE` · `CESAR_BASE` (défaut `https://cesar.emineo-education.fr`) ·
`GOOGLE_TESTING_EXPIRY` (`"true"` uniquement si projet Google en mode Testing : réactive l'alerte d'âge ~7 j, sinon seul un refresh échoué déclenche « à reconnecter »)

Modèle complet : `.deploy.env.example`.

### Contrat du provider IA (OpenCode Go)

`NEXT_PUBLIC_API_URL` = `https://opencode.ai/zen/go/v1`. Le provider impose deux
choses, réunies dans `lib/ai-providers/config.ts` :

- **`x-opencode-session` obligatoire** (identifiant stable par conversation) —
  sans lui : `400 MissingSessionID`. La session remonte depuis le client
  (`ChatView` → `api.chat.stream` → body `sessionId` → route → adaptateur) ;
  les appels hors conversation utilisent `DEFAULT_SESSION_ID`.
- **User-Agent dédié** (`personalbrain/1.0`), pas celui du SDK.

⚠️ Les deux SDK n'attendent pas la même baseURL : le SDK **OpenAI** reçoit
l'URL complète (`/v1/chat/completions`), le SDK **Anthropic** ajoute lui-même
`/v1` — d'où `getAnthropicClientConfig()` qui retire le suffixe `/v1`, sinon
`/v1/v1/messages` → 404.

---

## Conventions

- **Alias** : `@/*` → racine. Utiliser l'alias partout (`lib/session.ts` importe
  `./session-core` en relatif — incohérence historique, ne pas propager).
- **Nommage** : `kebab-case.ts` pour `lib/`, `PascalCase.tsx` pour les composants.
  **ASCII uniquement**.
- **Logging** : `console.error` / `console.warn` avec préfixe module
  (`[watch-later]`, `[storage]`). Pas de lib dédiée.
- **Journal démo** : les appels `/api/demo` sont persistés dans
  `data/demo-calls.json` (1000 entrées maximum) et consultables uniquement via
  `/demo-calls` après `requireSession()`. Le contenu envoyé et la réponse sont
  conservés pour l'audit abuse ; aucune clé ou donnée de l'application privée
  n'est journalisée.
- **Directives** : `"use server"` en tête des 20 fichiers `app/actions/*`,
  `"use client"` sur les composants interactifs. Systématique.
- **Langue** : messages utilisateur et commits en français, code et
  identifiants en anglais.

---

## Documentation

| Fichier      | Contenu                           | Dans le repo ?                                      |
| ------------ | --------------------------------- | --------------------------------------------------- |
| `README.md`  | présentation, install, structure  | ✅                                                  |
| `AGENTS.md`  | ce fichier                        | ✅                                                  |
| `AUDIT.md`   | audit du 12/07/2026               | ✅ ⚠️ périmé (mentionne Capacitor, supprimé depuis) |
| `DESIGN.md`  | palette, typo, composants, motion | ✅                                                  |
| `PRODUCT.md` | objectif, users, modules, ton     | ✅                                                  |

---

## Dette technique connue

À ne pas « corriger » spontanément, mais à garder en tête :

1. Server Actions non rate-limitées (seul `/api/chat` l'est)
2. `components/reminders/` et `components/watch-later/` vides
3. `AUDIT.md` périmé (12/07, mentionne Capacitor)
4. Route Handlers ↔ Server Actions : recouvrement à maintenir manuellement
5. `data/.setup-consumed` : marqueur « bootstrap SETUP_TOKEN consommé » —
    purge via `bun run reset:passkey` uniquement

---

## Si tu bloques

1. **API Next.js incertaine** → `node_modules/next/dist/docs/`
2. **Auth / routing** → `proxy.ts` puis `lib/session.ts`
3. **Pattern d'action** → `app/actions/reminders.ts` (référence canonique)
4. **Question produit** → `PRODUCT.md` (si présent, sinon demander)
5. **Question UI** → `DESIGN.md` (si présent, sinon demander)
6. **Contexte historique** → `AUDIT.md` (⚠️ daté)
7. **Pattern inconnu** → lire un fichier voisin et l'imiter
8. **Test FS** → mock `process.cwd()` **avant** l'import dynamique
9. **Ambiguïté d'architecture** → demander, ne pas deviner

---

## Maintenance de ce fichier

Toute modification structurelle — nouveau dossier racine, changement de
`proxy.ts`, nouveau script `package.json`, nouveau provider OAuth, nouvelle
variable d'env, nouvel outil — doit être répercutée ici **dans le même commit**.

Un `AGENTS.md` périmé est plus dangereux qu'un `AGENTS.md` absent : l'agent
produit du code faux avec une confiance totale.
