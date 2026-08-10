# Audit complet de PersonalBrain

> Rapport d'audit autonome — généré le 2026-08-09.
> Projet : BACKSTAGE / PersonalBrain — PWA « second cerveau » personnelle (chat IA, mémoire, rappels, Gmail, Calendar, Microsoft To Do, photo, LeetCode).
> Contexte : **strictement mono-utilisateur, mono-instance, déjà déployé en production sur un serveur cPanel**.
> Périmètre : audit seule, aucun fichier applicatif modifié. Aucun secret ni valeur `.env` n'est reproduit dans ce document.

---

## 1. Résumé exécutif

### État global

PersonalBrain est une application personnelle ambitieuse, **fonctionnelle et utilisée en production**, correctement structurée (Next.js 16 App Router, Server Actions par domaine, couche de stockage JSON avec écritures atomiques et backups, service worker maison). Le code compile, passe le lint et **323 tests unitaires sur 323**, et le build de production réussit. L'authentification par passkey est proprement mise en œuvre, le middleware deny-by-default protège l'ensemble des routes, et les Server Actions vérifient systématiquement la session.

La qualité technique est globalement **bonne pour un outil personnel**, avec une dette concentrée sur quatre axes : (1) l'agent IA peut exécuter des actions externes (e-mail, calendrier, notifications) **sans confirmation utilisateur** et reçoit du contenu non fiable (pages web, e-mails) **sans délimitation ni garde technique** ; (2) le garde anti-SSRF est incomplet (redirections et DNS non re-vérifiés, formes d'IP exotiques autorisées) alors que le serveur fetch automatiquement les liens collés dans le chat ; (3) l'UX souffre d'incohérences de navigation, d'états d'erreur quasi absents et d'accessibilité lacunaire ; (4) l'observabilité et la couverture de tests sur les zones critiques (chat, cron, middleware, routes API, service worker) sont quasi nulles.

### Principales forces

- Architecture par domaine claire (`app/actions/`, `lib/storage/`, `lib/types/`, `components/`) et conventions documentées dans `AGENTS.md` réellement suivies.
- Stockage JSON robuste : verrous par fichier, écriture `.tmp` + `rename`, backups toutes les 30 min avec rotation et récupération automatique depuis un backup en cas de corruption (`lib/storage-core.ts:100-301`).
- Sécurité de base sérieuse : middleware edge deny-by-default (`middleware.ts:66-92`), JWT HMAC-SHA256 cohérent entre edge et node, cookies `HttpOnly`/`Secure`/`SameSite=lax` (`lib/session.ts:20-25`), validation Zod dans les Server Actions, rate-limit sur le chat.
- Le chat streaming SSE avec outils IA, l'auto-extraction mémoire, la sync bidirectionnelle Microsoft To Do et le brief quotidien sont des fonctionnalités réellement implémentées, pas des coquilles.
- Tests unitaires nombreux (323) et sans appels réseau réels (tous mockés), y compris sur les rafraîchissements OAuth et la concurrence d'écriture.

### Principaux problèmes

1. **Actions IA sans confirmation et injection indirecte de prompt** : l'IA peut envoyer un e-mail, créer un événement calendrier ou pousser une notification sur simple contenu malveillant reçu d'une page web ou d'un e-mail (`app/api/chat/route.ts:296-313`, `lib/chat-tools.ts:285`). C'est le risque n°1.
2. **Garde anti-SSRF incomplète** : redirections non re-vérifiées, DNS re-résolu au moment du fetch, IP décimales/octales/IPv4-mapped non bloquées, réponse lue sans limite de taille (`lib/web.ts:85-154`).
3. **UX fragile** : un seul `error.tsx` dans tout le projet, pas de `loading.tsx` global, labels de navigation incohérents, raccourci `t` fantôme, suppression photo sans annulation, commande `/leetcode` qui renvoie un faux succès.
4. **Accessibilité lacunaire** : contraste du texte tertiaire ≈ 2,5:1 (échec WCAG AA), pas de skip-link, pas de focus trap sur les modales, boutons icône sans nom accessible, `prefers-reduced-motion` partiel.
5. **Observabilité et tests critiques absents** : aucune route API ni middleware ni cron testés ; pas d'identifiants de corrélation ; les erreurs OAuth brutes sont renvoyées au client.

### Cinq priorités absolues

| # | Priorité | Justification |
|---|---|---|
| 1 | **Confirmation utilisateur pour les outils IA à effet externe** (`send_email_response`, `create_calendar_event`, `schedule_followup`, `add_reminder`, …) | Risque réel en production : envoi d'e-mail/calendrier déclenché par contenu non fiable |
| 2 | **Durcir le garde anti-SSRF** (redirections, DNS, formes d'IP, limite de taille de réponse) | Le serveur fetch automatiquement les liens du chat et de watch-later |
| 3 | **Système d'états d'erreur/chargement global** (error.tsx + loading.tsx + gestion d'erreur des actions côté client) | L'utilisateur est aveugle face aux échecs (Google, IA, push) |
| 4 | **Refonte de la navigation (5 destinations max) et harmonisation des labels** | Réduit la charge cognitive, aligne le produit sur son positionnement « chat d'abord » |
| 5 | **Tests critiques manquants** (chat route, middleware, cron-auth, contrôle d'accès négatif, SSRF) + E2E déterministes | Filet de sécurité indispensable avant toute refonte |

---

## 2. Contexte, périmètre et limites

### Contexte produit

PersonalBrain (nom de code interne, affiché « BACKSTAGE » dans `README.md:1`, `public/manifest.json:2`, `package.json:2`) est un « second cerveau » personnel : un assistant IA conversationnel avec mémoire longue, rappels, intégrations Google (Gmail, Calendar) et Microsoft To Do, gestion de watch-later, accréditations photo, LeetCode et brief quotidien. `PRODUCT.md:4-8` est explicite : « Primary: the owner (technical, visual, values craft and speed). Secondary: none — this is a private tool. »

Le produit est **déjà déployé en production** sur une instance Node unique via cPanel (`deploy.sh`, `.deploy.env.example` ; le domaine de production est mentionné dans `.env.example:5`).

### Fichiers inspectés

- Documentation : `README.md`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, `AUDIT.md` (daté du 12/07/2026, périmé — voir §13 FUN-010).
- Configuration : `package.json`, `bun.lock` (versions vérifiées via `node_modules`), `next.config.ts`, `middleware.ts`, `instrumentation.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `.env.example`, `.deploy.env.example`, `deploy.sh`.
- Code applicatif : `app/` (16 Server Actions, 34 Route Handlers, 40 pages/composants), `components/` (layout, chat, ui, widgets, landing, brain), `lib/` (session, auth, storage-core + 13 domaines, ai-providers, web, google/microsoft clients, reminder-sync, push, scheduler, offline, caches), `scripts/` (cron-scheduler, reset-passkey, scripts de QA), `e2e/` (3 specs), `public/` (`sw.js`, `manifest.json`, icônes).
- Données : `data/` listé (23 fichiers JSON + `.auth-secret` + `backups/`), **jamais ouvert** : valeurs masquées systématiquement. `data/users.json` existe (compte passkey déjà enregistré).

### Commandes exécutées

| Commande | Résultat | Durée |
|---|---|---|
| `bun run lint` | Exit 0 — 2 warnings (dépendances de hooks dans `components/chat/ChatView.tsx:176,460`) | ~5 s |
| `bunx tsc --noEmit` | Exit 0 — aucune erreur | ~20 s |
| `bun run test` | Exit 0 — **32 fichiers, 323 tests, 323 réussis** (1 warning jsdom : `Not implemented: Window's focus()` dans `lib/__tests__/notifications.client.test.ts`) | 3,4 s |
| `VAPID_PRIVATE_KEY="" NEXT_PUBLIC_VAPID_PUBLIC_KEY="" bun run build` | Exit 0 — build de production complet, 54 routes listées | ~2 min |
| `VAPID_PRIVATE_KEY="" NEXT_PUBLIC_VAPID_PUBLIC_KEY="" bun run test:e2e` | Exit 1 — **8 échecs : binaire Chromium Playwright absent** (`~/.cache/ms-playwright/chromium_headless_shell-1228` introuvable). Aucun test n'a réellement tourné | ~1 min |

Notes importantes sur l'exécution :

- Le scheduler interne (`lib/notification-scheduler.ts`) démarre à chaque boot du serveur (`instrumentation.ts:8-9`) et **envoie de vraies notifications push** si des rappels sont en retard. Or `data/push-subscriptions.json` contient **1 abonnement réel** et `data/reminders.json` contient **2 rappels en retard**. Démarrer `bun dev`/`bun start` ou un build sans précaution aurait envoyé de vraies notifications au téléphone du propriétaire. Les commandes build et E2E ont donc été lancées avec les clés VAPID vidées (`VAPID_PRIVATE_KEY="" NEXT_PUBLIC_VAPID_PUBLIC_KEY=""`), ce qui neutralise le scheduler (`lib/notification-scheduler.ts:248-252` : retour immédiat sans clés). Le `next build` reste valide pour la vérification de compilation ; le bundle client est néanmoins produit avec une clé VAPID publique vide et n'est pas destiné au déploiement.
- Le port 3000 était libre avant et après les tests ; aucun processus résiduel.
- Aucun cron, aucun push, aucun e-mail, aucune écriture calendrier n'a été déclenché pendant l'audit.

### Limites de l'analyse

- **Aucun E2E exécuté** : le binaire Chromium n'est pas installé et son installation est hors périmètre (pas d'installation de dépendances).
- **Aucune inspection visuelle** : les évaluations UI/UX/contraste reposent sur la lecture du code et des valeurs CSS, pas sur des captures d'écran ni des mesures d'outil (axe, Lighthouse).
- **Prod non sondée** : l'état réel du serveur (headers HTTP, SSL, comportement du SW en conditions réelles, backup serveur) n'a pas été vérifié ; seule l'analyse statique du code de déploiement a été faite.
- **Comportement WebAuthn réel** (authenticator utilisé, verrouillage, user verification) non vérifiable depuis le code.
- Quelques fichiers volumineux (ex. `app/api/chat/route.ts` intégral, tous les composants `components/chat/`) ont été analysés par lecture ciblée et via exploration déléguée ; les citations associées proviennent de cette exploration, recoupées sur les points critiques.

---

## 3. Cartographie fonctionnelle

| Module | Fonction | État | Utilité | Problèmes | Recommandation |
|---|---|---|---|---|---|
| Chat IA | Streaming SSE OpenAI/Anthropic, raisonnement visible, outils IA (21), auto-extraction mémoire | Fonctionnel | **Cœur du produit** | Aucune confirmation des actions externes ; injection indirecte de prompt ; auto-extraction mémoire sans consentement (`chat/route.ts:100-128`) | Conserver — ajouter confirmation des outils + délimitation du contenu non fiable |
| Mémoire (brain) | CRUD de faits, relations, recherche similarité, graphe (`components/brain/KnowledgeGraph.tsx`) | Fonctionnel | Élevée — différenciateur | Extraction auto sans consentement ; UI dense | Conserver — confirmer les écritures mémoire auto |
| Rappels | CRUD + récurrence + notifications push + sync MS To Do | Fonctionnel | Élevée | Route `/api/reminders/[id]/done` sans push MS ni revalidation (`app/api/reminders/[id]/done/route.ts:6-8`) ; sync fire-and-forget | Conserver — corriger la route done |
| Notifications push | VAPID, SW, actions « Fait / +15 min » | Fonctionnel | Élevée | SW non testé ; `pushsubscriptionchange` POST sans garde ; cache non purgé à la déconnexion | Conserver — tester + purger le cache SW à la déconnexion |
| Brief quotidien | Génération + push à 7h + page test | Fonctionnel (flag désactivé par défaut) | Moyenne | Flag `features.dailyBrief` à `false` par défaut (`lib/config.ts:39`) ; page `/daily-brief-test` en prod | Masquer/terminer — décider si le brief est gardé |
| Agenda Google | Lecture + création d'événements via OAuth, cache 2 min | Fonctionnel | Élevée | `state` OAuth non vérifié ; outil IA `create_calendar_event` sans confirmation | Conserver — vérifier le state + confirmer les actions IA |
| Gmail | Lecture, tri, envoi de réponse via outils IA | Fonctionnel | Élevée | `emails.json` local est un **mock** (`lib/storage/emails.ts:4-23`) confondu avec Gmail réel ; envoi IA sans confirmation | Conserver — clarifier le mock, confirmer l'envoi |
| Microsoft To Do | Sync bidirectionnelle des rappels | Fonctionnel | Moyenne (contournement Samsung Reminder) | Fire-and-forget avec échecs silencieux (`lib/reminder-sync.ts:46-49`) ; dernier-écrit-gagne | Conserver — ajouter un statut d'échec visible |
| Watch-later | Liens, articles, vidéos, extraction d'aperçu, auto-résumé IA | Fonctionnel | Moyenne | URL non validée à l'ajout ; SSRF en aval (`lib/watch-later.ts:16-39`) ; DnD sans alternative clavier | Conserver — valider l'URL à l'ajout |
| Photos / shootings | Kanban shoots photo, modale détail, galerie | Fonctionnel | Élevée (photographe) | Suppression sans undo (`app/photos/page.tsx:101-109`) ; modale sans focus trap (`DetailModal.tsx:64-67`) | Conserver — undo + accessibilité |
| Accréditations | Fiches accréditations concerts, scan IA depuis e-mails | Fonctionnel | Spécifique (élevée pour l'usage) | `scan_accreditations` modifie des fiches sans confirmation | Conserver — confirmation IA |
| Concerts | Fiches concerts, météo, préparation | Fonctionnel | Moyenne | Fusion calendrier/concerts implicite (`lib/storage/calendar.ts:5-18`) | Conserver ou fusionner avec Calendar |
| LeetCode | Streak, exercices, aide code | Partiel | Faible (incohérent avec le positionnement actuel) | Commande `/leetcode` = **placeholder faux succès** (`components/ui/command-palette/commands.ts:226-229`) | Simplifier ou déplacer en section secondaire |
| Focus | Minuteur anti-distraction, met les notifications en silence | Fonctionnel | Moyenne | `data/focus.json` absent au repos (créé au 1ᵉʳ usage) ; état non visible globalement | Conserver — masquer en section secondaire |
| Intentions (week) | Relances programmées (« penser à X ») | Fonctionnel | Moyenne | Nom « Semaine » ambigu ; double envoi possible si cron + scheduler | Conserver — renommer + dédupliquer |
| Journal d'activité | Log 200 entrées (`lib/storage/activity.ts:4,7-26`) | Fonctionnel | Faible (invisible) | Pas d'export, pas de purge explicite, quasi invisible | Déplacer en secondaire ou fusionner avec un panneau |
| Recherche | Web + mémoire + e-mails | Fonctionnel | Élevée | `/search` appelle `findEmails` (mock) sans vérifier le lien Gmail (`commands.ts:243-247`) | Conserver — corriger la source e-mails |
| Paramètres | Thème/accent, compte, connexions, suppression | Fonctionnel | Élevée | Double `window.confirm` pour la suppression (`app/settings/page.tsx:112-126`) ; « dark/light » annoncé mais seul l'accent change (`ThemeApplier.tsx:19`) | Conserver — supprimer le double confirm |
| Auth passkey | WebAuthn register/auth, cookie JWT 7 j | Fonctionnel | Critique | `SETUP_TOKEN` non consommé ; `userHandle` non vérifié ; `requireUserVerification: false` ; pas de révocation | Conserver — durcissement ciblé (voir SEC-001/010) |
| Landing page `/` | Page marketing animée | Fonctionnel | Faible (publique) | Duplique la valeur de `/chat` ; publique alors que le produit est personnel | Conserver (vitrine) ou rediriger vers `/chat` selon le choix produit |
| PWA hors ligne | SW network-first + fallback `/offline`, cache localStorage | Partiel | Annoncée forte, réelle moyenne | Réponses privées mises en cache (non isolées, jamais purgées à la déconnexion) ; `/chat` non précaché à l'install ; pas de queue hors ligne ; `start_url: /chat` mais SW précache `/` (`public/sw.js:44-53`) | Améliorer : purger le cache à la déconnexion, précacher `/chat` |

---

## 4. Analyse UI

### Hiérarchie visuelle

- Design system réel (Tailwind v4, tokens CSS dans `app/globals.css:37-66`) fidèle à `DESIGN.md` : fond `#0a0a0b`, surfaces `#141414`/`#1a1a1a`, bordures 1 px, sans ombres. « Éditeur brutaliste sombre » assumé, cohérent entre les pages.
- Hiérarchie pilotée par la densité : mono pour les métadonnées/labels, sans 13–14 px. Les primitives (`components/ui/Button.tsx`, `Card.tsx`, `Input.tsx`, `Pill.tsx`, `Skeleton.tsx`, `Toast.tsx`) sont homogènes et réutilisées — point fort.
- **Problème** : pas de vraie hiérarchie entre « action principale du chat » et les 13 destinations du rail ; le rail iconique est saturé (`components/layout/Chrome.tsx:38-52`).

### Typographie et couleurs

- Typo cohérente (Geist + mono) ; pas d'erreur détectée.
- **Contraste** : `--text-3 #71717a` ≈ 4,1:1 (sous AA 4,5:1 pour texte normal) et `--text-4 #52525b` ≈ **2,5:1** (échec net) sur `#0a0a0b` (`app/globals.css:37-66`). Utilisé pour timestamps, hints, placeholders (`globals.css:157`). **Fait vérifié par calcul**, à confirmer par mesure.
- **Thème clair fantôme** : `README.md:27` annonce « dark/light », mais `components/ui/ThemeApplier.tsx:19` ne modifie que l'accent ; aucun thème clair n'existe. Contradiction documentation/code.

### Icônes et labels

- Rail 100 % icônes sans texte : les liens n'ont que `title`, pas d'`aria-label` (`Chrome.tsx:102,123,135,138,204,211,223`). Le `title` n'est pas un nom accessible fiable.
- Labels incohérents : « Console IA » (rail) vs raccourci `g c` vers `/` (`components/ui/KeyboardShortcuts.tsx:8`) vs page `/chat` ; « À voir » (rail) vs « À voir plus tard » (aide clavier) ; le sheet mobile s'appelle « Toutes les pages » (`Chrome.tsx:309`).

### États visuels

- Boutons : focus visible OK sur `Button.tsx:59` et `IconButton.tsx:33` ; **aucun** style focus sur les liens du rail ni la bottom nav (`Chrome.tsx:99-118`).
- Inputs : `outline-none` + `focus:border` (`components/ui/Input.tsx:12`) — focus discret mais visible.
- Animations : 8 keyframes décoratives (`shimmer`, `pulse-dot`, `breathe`, `thinking-dot`, `tool-scan`, `chat-stagger`, `toast`, `context-pulse`, `globals.css:245-427`) **non couvertes par `prefers-reduced-motion`** ; seule la séquence login l'est (`globals.css:799-819`). La landing utilise `matchMedia` dans 6 composants (bon point).

### Responsive

- Rail desktop caché sous `lg` (`Chrome.tsx:81`), bottom nav 5 items + sheet « Plus » sur mobile (`Chrome.tsx:251-283`), chat en plein écran, `ContextPanel` en sheet bas (max-h 82vh) sur mobile (`ContextPanel.tsx:76`). Architecture responsive cohérente ; le risque est la densité du sheet et des panneaux à 375 px.

---

## 5. Analyse UX

### Parcours principaux

| Parcours | Étapes | Friction principale |
|---|---|---|
| Connexion passkey | `/login` → WebAuthn → cookie | 1ᵉʳ bootstrap : `SETUP_TOKEN` requis via header non documenté dans l'UI (`register-options/route.ts:22`) ; `requireUserVerification: false` (pas de bio requise) |
| Chat + outil IA | message → streaming → tool → résultat | **Aucune confirmation avant action externe** ; l'utilisateur ne voit que l'état « running » (`ChatView.tsx:338-348`) ; pas de distinction visuelle claire « contenu généré / résultat d'outil / donnée mémorisée » |
| Ajout d'un rappel | formulaire → push MS → liste | Erreurs MS silencieuses (fire-and-forget `lib/reminder-sync.ts:46-49`) ; pas de feedback si la sync échoue |
| Ajout watch-later | URL → meta → liste | L'URL n'est pas validée à l'ajout ; l'aperçu peut échouer silencieusement (`lib/watch-later.ts:16-39`) |
| Connexion Google | `/settings` → OAuth → callback | En cas d'échec, `err.message` brut renvoyé au client (`google/callback/route.ts:48-51`) ; **aucun écran d'état d'intégrations consolidé** (statuts éparpillés) |
| Suppression d'une photo | bouton → suppression immédiate | **Aucun undo ni confirm** (`app/photos/page.tsx:101-109`) — seul module sans garde-fou (les rappels/faits/liens ont un undo toast) |

### Problèmes transverses

1. **Erreurs quasi invisibles** : un seul `error.tsx` dans le projet (`app/daily-brief-test/error.tsx`). Toute erreur de rendu d'une page protégée → page Next générique. Les actions côté client affichent un toast « Erreur » sans cause ni action (`components/ui/Toast.tsx`).
2. **Pas de `loading.tsx` global** : chaque page gère son skeleton ad hoc (parfois aucun).
3. **Actions destructives incohérentes** : undo pour rappels/faits/liens, rien pour photos, double `window.confirm` pour la suppression du compte (`app/settings/page.tsx:112-126`).
4. **Charge cognitive du rail** : 13 destinations + palette + raccourcis — trop pour un produit « une seule vue » (positionnement annoncé `README.md:46`).
5. **Raccourcis incohérents** : `t` listé mais jamais implémenté (`KeyboardShortcuts.tsx:7-21` vs handler `:32-54`) ; `g c` pointe vers `/` au lieu de `/chat` (`:8`) ; `Esc` conflit (arrête le streaming `ChatView.tsx:493` ET ferme la palette `CommandPalette.tsx:68`) ; `⌘L` efface le chat et masque le raccourci navigateur.
6. **Palette de commandes aveugle à l'état** : aucune commande désactivée selon les connexions ; `/leetcode` renvoie un faux succès « ✓ Sync lancée » (`commands.ts:226-229`) ; `/search` appelle `findEmails` (mock) sans vérifier le lien Gmail (`commands.ts:243-247`).
7. **Auto-extraction mémoire sans consentement** : après chaque échange, `runMemoryExtraction` écrit des faits (`chat/route.ts:100-128`). L'utilisateur peut voir les faits dans `/brain` mais n'est pas informé de l'écriture en direct.
8. **Chargements/états vides** : `EmptyState` existe (`Chrome.tsx:405-430`) et est bien réutilisé ; les skeletons sont partiels (rappels, brain, watch-later, photos).

---

## 6. Architecture de l'information et navigation

### État actuel

- Rail desktop : 13 destinations + Paramètres + Déconnexion (`Chrome.tsx:38-52,123,135`) ; bottom nav mobile 5 items + sheet « Toutes les pages » (`Chrome.tsx:251-283,309`).
- Page d'accueil `/` : landing marketing publique ; le produit vit sur `/chat` (et `manifest.json:5` pointe `start_url: "/chat"`). **Déconnexion entre l'URL racine et le produit.**
- Raccourcis `g` : 6 pages (`KeyboardShortcuts.tsx:7-21`).
- La palette (⌘K) : 5 commandes slash (`commands.ts:132-248`).

### Navigation cible proposée

**Principale (rail, 5 destinations) :**

1. **Console** (`/chat`) — chat IA, action principale ;
2. **Aujourd'hui** (`/`) — agrégat : rappels du jour, agenda, brief, intentions (nouvelle page, voir §15 PH-01.3) ;
3. **Cerveau** (`/brain`) — mémoire + faits ;
4. **Boîtes** (`/gmail` + `/calendar` regroupés) — communications ;
5. **À voir** (`/watch-later`).

**Secondaire (sheet mobile / palette / section « Plus ») :** Photos, Accréditations, Concerts, LeetCode, Focus, Semaine (intentions), Activité, Recherche, Galerie, Paramètres.

**Regroupements proposés :**

- Fusionner **Photos + Galerie** (deux domaines de fichiers distincts `photo-shoots.json` / `gallery.json` mais même objectif visuel) — décision produit, cf. §7.
- Grouper **Calendar + Concerts** : les concerts sont déjà fusionnés dans la vue calendrier (`lib/storage/calendar.ts:5-18`).
- **Activité** : déplacer hors du rail (journal, consultable via Paramètres ou la palette).
- **LeetCode** : section secondaire (activité marginale, commande placeholder).
- **Paramètres** : conserver en icône fixe ; y regrouper toutes les connexions externes et le centre de confidentialité proposé (§8).

### Règles de navigation à établir

- Un label = une destination (harmoniser « Console IA » / « À voir » / « À voir plus tard »).
- Tout raccourci `g` doit pointer vers la même cible que le rail.
- La palette doit refléter l'état (désactiver les commandes dont la connexion manque).

---

## 7. Audit fonctionnel

| Fonctionnalité | Valeur réelle | Achèvement | Problèmes | Décision |
|---|---|---|---|---|
| Chat IA | Critique | ~90 % | Confirmation outils ; injection prompt ; extraction mémoire auto | **Conserver et améliorer** (priorité 1) |
| Mémoire | Élevée | ~80 % | UI dense ; écritures auto non signalées | **Conserver** |
| Rappels | Élevée | ~85 % | Route done sans sync MS ; erreurs MS silencieuses | **Conserver** — corriger `done` |
| Notifications push | Élevée | ~80 % | SW non testé ; cache non purgé à la déconnexion | **Conserver** |
| Gmail | Élevée | ~75 % | `emails.json` mock trompeur ; envoi IA non confirmé | **Conserver** — clarifier |
| Calendar | Élevée | ~80 % | state OAuth ; fusion concerts implicite | **Conserver** |
| Microsoft To Do | Moyenne | ~70 % | Fire-and-forget ; désync possible via la route `done` | **Conserver** — statut d'échec |
| Watch-later | Moyenne | ~80 % | URL non validée à l'ajout ; DnD sans clavier | **Conserver** |
| Photos | Élevée (usage pro) | ~85 % | Pas d'undo ; modale non accessible | **Conserver** |
| Galerie | Faible | ~60 % | Chevauche Photos | **Fusionner avec Photos** |
| Accréditations | Spécifique élevée | ~80 % | Scan IA sans confirmation | **Conserver** |
| Concerts | Moyenne | ~75 % | Doublon partiel Calendar | **Fusionner dans Calendar** |
| LeetCode | Faible | ~50 % | Placeholder `/leetcode` ; plus aligné avec le positionnement | **Simplifier / secondaire** |
| Focus | Moyenne | ~80 % | Invisible globalement | **Conserver — secondaire** |
| Intentions / Semaine | Moyenne | ~75 % | Nom ambigu ; double déclenchement possible | **Conserver — renommer « Relances »** |
| Journal d'activité | Faible | ~90 % | Invisible, pas d'export | **Secondaire** |
| Recherche | Élevée | ~70 % | Source e-mails = mock | **Conserver — corriger** |
| Brief quotidien | Moyenne | ~80 % | Flag off par défaut ; page test en prod | **Masquer / terminer** |
| Landing `/` | Faible (vitrine) | ~90 % | Publique ; duplique `/chat` | **Conserver (vitrine) — décision produit** |
| PWA hors ligne | Moyenne réelle vs annoncée | ~60 % | Pas de queue ; cache privé non purgé ; `/chat` non précaché | **Améliorer** |

### Fonctionnalités fantômes

1. **`/leetcode` de la palette** : faux succès « ✓ Sync lancée » (`commands.ts:226-229`).
2. **Raccourci `t`** : listé dans l'aide, jamais implémenté (`KeyboardShortcuts.tsx:7-21`).
3. **Thème clair** : annoncé, inexistant (`ThemeApplier.tsx:19`).
4. **`emails.json`** : mock seedé présenté comme données e-mails (`lib/storage/emails.ts:4-23`), jamais alimenté par Gmail.

### Doublons

- `Photos` vs `Galerie` ; `Concerts` vs `Calendar` (fusion déjà partielle).
- Logique dupliquée entre Server Actions et Route Handlers (documenté `AGENTS.md` ; ex. `markReminderStatus` ↔ `/api/reminders/[id]/done`, `rememberFact` ↔ `/api/memory/remember`).
- Types dupliqués entre `lib/types.ts` et `lib/api-client.ts` (signalé `AUDIT.md` n°7, toujours présent).

### Parcours inachevés

- Suppression de compte : efface `data/` mais conserve `.auth-secret` (`app/api/account/delete/route.ts:11,27-40`) → un cookie JWT émis avant reste valide 7 jours.
- Déconnexion : ne purge pas le cache du service worker ni les subscriptions push (`app/api/auth/logout/route.ts:5`).
- `scan_accreditations` : l'outil modifie des fiches sans aperçu avant exécution.

---

## 8. Fonctionnalités manquantes

Classement :

| Proposition | Classe | Bénéfice | Complexité | Dépendances | Risques |
|---|---|---|---|---|---|
| **Centre de confirmation des actions IA** (aperçu → confirmer/annuler avant toute action externe) | Indispensable | Élimine le risque n°1 (envoi d'e-mail/calendrier involontaire) | M | SEC-008/SEC-009 | Régression possible sur la fluidité du chat si mal conçu (confirmation en ligne dans le message, pas de modale bloquante) |
| **Journal des actions exécutées par l'IA** (qui, quoi, quand, statut) | Indispensable | Traçabilité des envois/modifications ; répond à la règle AGENTS « journaliser » | S | Réutilise `activity.json` | Faible |
| **Annulation des actions réversibles** (undo mail non, undo rappel/calendrier oui) | Forte valeur | Cohérence avec l'undo existant (rappels, faits, liens) | S | Storage | Moyen (idempotence) |
| **Centre de confidentialité / export sélectif** | Forte valeur | RGPD réel : `/api/export` existe déjà (exclut tokens/users, `export/route.ts:12-21`) mais pas d'UI ; ajouter suppression sélective par domaine | S | — | Faible |
| **Statut hors ligne explicite** (bannière + capacité réelle) | Forte valeur | `OfflineBanner` existe (`components/ui/OfflineBanner.tsx`) ; le rendre fiable et purger les caches privés à la déconnexion | M | PWA | Moyen |
| **Tableau de santé des intégrations** (Google, MS, push, IA : token OK, dernier refresh, dernière erreur) | Forte valeur | Remplace les statuts éparpillés ; diagnostique les échecs silencieux | M | `google-health.ts` existe déjà | Faible |
| **Restauration depuis une sauvegarde** (UI liste des `.bak` + restaurer) | Confort | Les backups existent (`storage-core.ts:249-266`) mais aucune UI | M | Storage | **Risque de perte de données si mal fait** — mode lecture seule d'abord |
| **Verrouillage automatique** (inactivité → re-auth passkey) | Confort | Protège le navigateur partagé | S | Session | Faible |
| **Mode lecture seule** | Confort | Tranquillité pendant les refontes | S | Middleware | Faible |
| **Journal de sécurité** (échecs d'auth, accès OAuth) | Confort | Observabilité | S | `activity.json` | Faible |
| **Recherche universelle** (faits + rappels + liens + e-mails) | Forte valeur | `/search` existe mais ciblé ; étendre | M | Storage | Moyen |
| **Synchronisation différée hors ligne** (queue de mutations) | À éviter maintenant | Complexité disproportionnée pour un usage mono-utilisateur quasi toujours en ligne | XL | PWA | Élevé — non recommandé |
| **Fonctionnalités sociales/multi-utilisateurs** | À éviter | Hors positionnement (`PRODUCT.md:8`) | — | — | — |

---

## 9. Sécurité et confidentialité

Contexte : mono-utilisateur, mono-instance, accessible sur Internet, connecté à Gmail/Calendar/To Do, agent IA exécutant des actions externes. **Seuls les risques pertinents sont listés.**

### 9.1 Risques confirmés et pertinents

**SEC-001 — SETUP_TOKEN non consommé, bootstrap rejouable, absent des exemples de déploiement**
- Preuve : `app/api/auth/passkey/register-options/route.ts:18-28` compare `x-setup-token` **sans le consommer** ; `register-verify/route.ts:22` relit `body.setupToken` (transport incohérent : header vs body) ; si `SETUP_TOKEN` absent, warning seulement (`:30-33`) et premier enregistrement ouvert à tous ; `.deploy.env.example` ne contient ni `SETUP_TOKEN` ni `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN`.
- Exploitation : fenêtre **avant le premier enregistrement du propriétaire**. En prod actuelle, `data/users.json` existe (déjà enregistré) → `hasCredentials()` force une session (`:13-17`). **Plus exploitable aujourd'hui**, mais critique pour toute réinstallation/reset (`bun run reset:passkey` réouvre le bootstrap).
- Recommandation : consommer le token après usage (lire + supprimer de l'env, ou fichier `data/setup-consumed`), imposer `SETUP_TOKEN` si aucune credential, ajouter `WEBAUTHN_RP_ID`/`ORIGIN` aux exemples de déploiement.

**SEC-002 — `state` OAuth généré mais jamais vérifié (Google + Microsoft)**
- Preuve : `app/api/auth/google/route.ts:30` génère un state ; `google/callback/route.ts:18-25` ne fait que le parser pour extraire le type, aucune comparaison ; idem `microsoft/route.ts:12` / `microsoft/callback/route.ts:12-15`.
- Impact réel : les callbacks exigent `requireSession()` et le `redirect_uri` est figé par env → login CSRF neutralisé en mono-utilisateur. Faiblesse de défense en profondeur ; devient bloquant en SaaS (account-linking).
- Recommandation : stocker le state dans un cookie signé (comme le challenge) et le comparer au callback.

**SEC-003 — Refresh tokens OAuth en clair, permissions 644**
- Preuve : `lib/google-client.ts:18-20,43-46` écrit `data/{gmail,calendar}-token.json` via `writeJsonAtomic` (mode par défaut 644) ; `lib/microsoft-client.ts:33-35,71-78` idem pour `microsoft-todo-token.json` ; `data/.auth-secret` également 644 (vérifié `stat`).
- Impact : si le serveur est compromis ou si `data/` fuite (erreur de reverse-proxy, backup), un attaquant dispose de tokens valides Gmail/Calendar/To Do.
- Recommandation minimale : `chmod 600 data/*.json data/.auth-secret` à l'installation (`deploy.sh`) ; robuste : chiffrer les refresh tokens avec une clé dérivée de `AUTH_SECRET` au repos.

**SEC-004 — `lib/csrf.ts` (assertSameOrigin) défini mais jamais importé**
- Preuve : `lib/csrf.ts:1-29`, aucun import dans le repo ; dette reconnue `AGENTS.md`.
- Atténuation existante : `SameSite=lax` (`lib/session.ts:23`), toutes les mutations derrière `requireSession()`.
- Recommandation minimale : brancher `assertSameOrigin` sur les routes POST sensibles ou supprimer le fichier mort ; robuste : middleware anti-CSRF global sur `/api/*` mutations.

**SEC-005 — Sessions 7 jours sans rotation ni révocation ; suppression de compte incomplète**
- Preuve : `lib/session-core.ts:6` (TTL 7 j, aucun `jti`) ; `logout/route.ts:5` efface le cookie seulement ; `account/delete/route.ts:11,27-40` conserve `.auth-secret` → les JWT déjà émis restent valides 7 jours après « suppression ».
- Recommandation : ajouter `jti` + denylist en mémoire (ou raccourcir le TTL à 24 h — rapide et efficace en mono-utilisateur), régénérer `.auth-secret` à la suppression de compte.

**SEC-006 — `/api/auth/set-session` public et orphelin (reliquat Capacitor)**
- Preuve : `set-session/route.ts:4-44` ; aucun appelant dans le repo (seul `AUDIT.md` le mentionne). Nécessite un JWT valide signé par `AUTH_SECRET` → inutilisable sans fuite de secret, mais surface inutile.
- Recommandation : supprimer la route (ou la mettre derrière un header partagé).

**SEC-007 — Garde anti-SSRF incomplète**
- Preuve : `lib/web.ts:85-134` — le DNS est résolu une fois au contrôle (`:114-130`), puis `fetch` re-résout à la connexion (`:149`) → **DNS rebinding** ; les redirections HTTP ne repassent pas par le contrôle → **redirect vers IP privée** ; `isIpLiteral` (`:97`) accepte `2130706433` (127.0.0.1 en décimal), `0177.0.0.1` (octal), `::ffff:127.0.0.1` (IPv4-mapped) qui ne matchent aucune regex privée (`:99-110`) ; `catch { return true }` si le DNS échoue (`:131-133`) ; `res.text()` **sans limite de taille** (`:154`, `lib/watch-later.ts:115`).
- Déclencheurs automatiques : le chat fetch le premier lien d'un message (`app/api/chat/route.ts:163-174`) ; `autoSummarize` (`watch-later.ts:106`) ; `fetchPageMeta` (`web.ts:136`).
- Impact : scan du réseau interne du serveur cPanel, accès aux services locaux, consommation mémoire. **Risque le plus « exploitable » après l'injection de prompt** — mais la victime est l'utilisateur lui-même (c'est lui qui colle un lien malveillant) ou une page web redirigeant vers une IP privée.
- Recommandation minimale : refuser les redirects (`redirect: "manual"` et contrôler chaque saut, max 3) ; robuste : fetch avec résolution DNS contrôlée (undici Agent + lookup), limite de taille (ex. 1 Mo), liste d'exceptions.

**SEC-008 — Outils IA à action externe sans confirmation utilisateur**
- Preuve : `app/api/chat/route.ts:296-313` exécute `executeTool` immédiatement pendant le streaming ; `lib/chat-tools.ts:285` (switch sur 21 outils) ; l'UI n'affiche que l'état « running » (`ChatView.tsx:338-348`). Outils concernés : `send_email_response` (`:301`, envoie un vrai e-mail), `create_calendar_event` (`:308`), `update_calendar_event` (`:320`), `schedule_followup` (`:402`, notification push), `add_reminder` (`:375`), `scan_accreditations` (`:431`), `add_photo_shoot` (`:526`), `update_photo_shoot` (`:536`), `prepare_concert` (`:504`).
- Combinaison critique avec SEC-009 : du contenu non fiable peut demander au modèle d'exécuter l'outil.

**SEC-009 — Injection indirecte de prompt**
- Preuve : le résumé d'une page web est collé **dans le message utilisateur** (`chat/route.ts:171`) ; les résultats d'outils (snippets de recherche, corps d'e-mails, pages) sont renvoyés au modèle en messages `tool` bruts (`chat/route.ts:308-312`, `chat-tools.ts:292-299`) ; `autoSummarize` envoie le texte brut extrait (`watch-later.ts:134-145`). Aucun délimiteur de confiance ; l'unique rempart est la consigne texte `chat-prompts.ts:175`.
- Recommandation minimale : délimiter le contenu non fiable (balises claires + instruction système renforcée) ; robuste : politique de permissions par source + confirmation (SEC-008).

**SEC-010 — WebAuthn : `userHandle` jamais vérifié ; `requireUserVerification: false` ; algorithme non contraint**
- Preuve : `auth-verify/route.ts:8-22` ignore `userHandle`, `:49` `requireUserVerification: false` ; `register-options/route.ts:45-49` ; counter bien vérifié/mis à jour (`auth-verify/route.ts:56-59`), challenge signé TTL 5 min.
- Impact mono-utilisateur : faible (vol d'authenticator non verrouillé). À durcir pour open source.

**SEC-011 — Erreurs OAuth brutes exposées au client**
- Preuve : `google/callback/route.ts:48-51` renvoie `err.message` ; `microsoft/callback/route.ts:17-21,31-35` renvoie `error_description` et `err.message`. Aucun token exposé. Information leak mineure.

**SEC-012 — Incohérence edge/node sur la clé de session**
- Preuve : `lib/session-edge.ts:19-23` exige `process.env.AUTH_SECRET` (throw sinon) ; `lib/session-core.ts:23-37` accepte un fallback `data/.auth-secret`. En prod `AUTH_SECRET` est défini (`deploy.sh:63`) → cohérent. Si un déploiement oublie `AUTH_SECRET` mais a un `.auth-secret` local, le middleware déconnecte tout. Faiblesse de configuration.

**SEC-013 — XSS via Markdown/HTML : FAUX POSITIF**
- `components/ui/Markdown.tsx:18` utilise `react-markdown` + `remark-gfm` : le HTML brut n'est pas rendu par défaut ; aucun `dangerouslySetInnerHTML` ni `innerHTML=` dans le repo (grep vide) ; liens `target="_blank"` + `rel="noopener noreferrer"` (`:26-27`). Pas de vecteur XSS identifié.

**SEC-014 — Read-modify-write non atomiques hors lock**
- Preuve : `lib/push-subscriptions.ts:23-38`, `lib/config.ts:73-79`, `lib/consent.ts:24-29`, `lib/auth.ts:50-59`, `notification-scheduler.ts:38-49` font read → mutate → `writeJsonAtomic` **sans** `mutateJson` (le lock couvre l'écriture, pas le cycle complet). En mono-instance, l'impact est une perte d'entrée sous concurrence (2 abonnements push ajoutés en même temps, 2 notifications marquées…). Impact faible ; correction : basculer sur `mutateJson`.

**SEC-015 — Route `/api/reminders/[id]/done` sans sync Microsoft ni revalidation**
- Preuve : `app/api/reminders/[id]/done/route.ts:6-8` fait `updateReminder` local **sans** `pushReminderUpdateToMicrosoft` ni `revalidatePath`, contrairement à `markReminderStatus` (`app/actions/reminders.ts:101-113`). La route est néanmoins **protégée par le middleware** (elle n'est pas dans `PUBLIC_API_PREFIXES`, `middleware.ts:23-28`) → pas de fuite d'accès, mais **désynchronisation MS To Do** réelle quand on marque un rappel fait depuis une notification push.
- Recommandation : réutiliser la même logique que l'action (ou appeler l'action) et revalider.

**SEC-016 — Cache du service worker : réponses privées non isolées, jamais purgées à la déconnexion**
- Preuve : `public/sw.js:43-53` (précache), `:144-170` : network-first qui **met en cache toute réponse GET OK**, y compris les pages privées pré-rendues contenant des données RSC ; cache unique `backstage-v5`, non séparé par session ; la déconnexion (`logout/route.ts:5`) ne purge rien côté client ; `lib/offline.ts:31-38` (`clearOfflineCache`) n'est jamais appelé par le flux de déconnexion.
- Impact mono-utilisateur : un navigateur partagé ou un compte OS partagé peut afficher des données en cache après déconnexion. Recommandation : sur `/api/auth/logout`, renvoyer un flag ou un message SW pour purger `backstage-v5` + `localStorage brain-cache:`.

**SEC-017 — `/api/push` POST public accepte n'importe quelle subscription**
- Preuve : `app/api/push/route.ts:21-34` — POST sans session (volontaire, appelé par le SW), mais aucune validation d'origine : un site tiers peut **soumettre une fausse subscription** (pollution du fichier). GET/PUT/DELETE exigent une session (`:9-19,36-38,94-96`). Impact faible ; garder le POST public mais valider la forme P256DH/auth et ajouter une limite.

### 9.2 Secrets et données personnelles (fait vérifié, sans valeur)

- `.env.local` et `.deploy.env` sont **ignorés par Git** (`.gitignore:35,38`) et **absents de l'historique** (vérifié `git log --all`). Seuls `.env.example` et `.deploy.env.example` sont suivis.
- Aucun secret de type `sk-…`, `AIza…`, clé privée n'apparaît dans le code suivi (grep sur le repo, hors node_modules).
- La clé VAPID publique n'est **plus** hardcodée dans `public/sw.js` (récupérée via `/api/push/vapid-key`, `sw.js:14-20`) — le constat de l'ancien `AUDIT.md` n°2 est corrigé.
- `data/` contient des tokens OAuth et `.auth-secret` en clair, permissions 644 (SEC-003).
- `app/api/export/route.ts:12-21` exclut correctement les fichiers sensibles (tokens, users, `.auth-secret`, server-cache) — bon point RGPD côté serveur ; aucune UI d'export.
- La suppression de compte (`account/delete`) efface tout `data/` sauf `.auth-secret` et `.gitkeep` (`:27-40`) — mais pas les caches client (IndexedDB/localStorage/SW).

---

## 10. Accessibilité

Analyse statique (aucune mesure avec axe/Lighthouse possible — non exécuté).

### Constats vérifiés

| # | Constat | Preuve | Critère WCAG probable |
|---|---|---|---|
| A11Y-001 | Contraste texte tertiaire `#52525b` ≈ 2,5:1 sur `#0a0a0b` — échec AA pour tout texte | `app/globals.css:37-66` (`--text-4`), utilisé timestamps/hints/placeholders (`:157`) | 1.4.3 (AA) |
| A11Y-002 | Texte secondaire `#71717a` ≈ 4,1:1 — sous AA 4,5:1 pour texte normal | `globals.css` (`--text-3`) | 1.4.3 (AA) |
| A11Y-003 | Pas de skip-link (aucun `skip`/`#main` dans le repo) | `components/layout/Chrome.tsx`, `app/layout.tsx` | 2.4.1 (A) |
| A11Y-004 | Boutons icône sans nom accessible (rail, déconnexion, repli panneau, toggle rappel, supprimer carte, fermer sheet) : `title` seul, pas d'`aria-label` | `Chrome.tsx:102,123,135,138,204,211,223,437` ; `ContextPanel.tsx:91` ; `ReminderRow.tsx:33` ; `ItemCard.tsx:54` ; `SessionSidebar.tsx:165-171,235` | 4.1.2 (A) / 2.4.4 (A) |
| A11Y-005 | Inputs sans label lié (`htmlFor`/`id`) : palette, textarea chat, recherches, formulaire rappel, modale photos ; labels « Échéance »/« Récurrence » non liés | `CommandPalette.tsx:276` ; `ChatComposer.tsx:149` ; `ReminderForm.tsx:45,52,59,70` ; `DetailModal.tsx:108-149` ; `brain/page.tsx:232` ; `watch-later/page.tsx:202` | 3.3.2 (A) / 1.3.1 (A) |
| A11Y-006 | Modales sans focus trap ni gestion Esc : `DetailModal` (photos), aide clavier | `DetailModal.tsx:64-67` ; `KeyboardShortcuts.tsx:67` ; la palette et le sheet ont `role="dialog" aria-modal` mais sans trap (`CommandPalette.tsx:232-234`, `Chrome.tsx:304`) | 2.1.2 (A) / 4.1.2 (A) |
| A11Y-007 | Focus visible absent sur liens du rail et bottom nav (pas de `focus-visible` ring) | `Chrome.tsx:99-118` ; contrasté avec `Button.tsx:59`/`IconButton.tsx:33` | 2.4.7 (AA) |
| A11Y-008 | `prefers-reduced-motion` : seule la séquence login couverte ; 8 keyframes décoratives actives sinon | `globals.css:245-427` vs `:799-819` ; `Skeleton.tsx:10` ; scroll smooth (`ChatView.tsx:258,263`) | 2.3.3 (AAA) — bonne pratique |
| A11Y-009 | Zones tactiles < 44 px : delete 28 px, close toast 24 px, close sheet 28 px | `ItemCard.tsx:54` ; `Toast.tsx:136` ; `Chrome.tsx:437` | 2.5.5 (AAA) / 2.5.8 (AA) |
| A11Y-010 | Drag & drop kanban/watch-later sans alternative clavier | `app/photos/page.tsx`, `app/watch-later/page.tsx` (DnD) | 2.1.1 (A) |
| A11Y-011 | Session sidebar : éléments `role="button"`/`tabIndex` corrects | `SessionSidebar.tsx:216-217` | positif |
| A11Y-012 | `alt` présents sur les images (logo, décoratives `alt=""`) | `Chrome.tsx`, `ItemCard.tsx:77-79` | positif |

### Plan de correction priorisé (détail §15 PH-04 et §18)

1. Contraste : éclaircir `--text-3`/`--text-4` (ex. `#a1a1aa` / `#8a8a8a`) et vérifier tous les thèmes d'accent.
2. Skip-link + `main id="main"` + focus-visible sur rail/bottom nav.
3. `aria-label` sur tous les boutons icône sans texte.
4. Labels liés sur les formulaires (modale photos en priorité).
5. Focus trap + Esc + restauration du focus sur `DetailModal` et l'aide clavier.
6. Envelopper les keyframes dans `@media (prefers-reduced-motion: reduce)`.
7. Agrandir les cibles tactiles (min 40-44 px) ; supprimer le DnD ou fournir des boutons déplacer haut/bas au clavier.

---

## 11. Performance et fiabilité

### Chargement et rendu

- Toutes les pages métier sont pré-rendues **statiques** au build (`next build` liste 30+ routes `○`) : le HTML est un shell servi vite, les données sont chargées côté client via `/api/*` après hydration → **waterfall** (HTML → JS → API) au lieu de Server Components. Choix cohérent avec le cache client TTL/SWR (`lib/cache.ts`), mais TTFI plus long et dépendance au JS.
- Le client envoie le **contexte complet** de la conversation au chat (`app/api/chat/route.ts:206-220` mappe tous les messages) : au-delà de N messages, la payload SSE grossit. Il existe un résumé automatique des messages > 3000 caractères (`:176-199`) — bon point — mais pas de fenêtrage de l'historique.
- Bundle : pas d'analyse exécutée (`bun run analyze` non lancé — build lourd). `react-markdown` + `remark-gfm` + `lucide-react` sont lourds ; pas de `productionBrowserSourceMaps` (dette `AUDIT.md` n°14).

### Stockage JSON

- Écritures atomiques (`.tmp` + `rename`) sous lock par fichier (`lib/storage-core.ts:11-40,62-91`) — solide.
- Backups : toutes les 30 min par fichier muté, rotation 7 j / max 5 (`storage-core.ts:249-266`), **récupération automatique** depuis un backup en cas de corruption (`readJsonSafe`, `:165-187` ; `readOrCreateUnlocked`, `:269-286`). Point fort rare.
- **Limites** : verrous et caches en mémoire par process (OK mono-instance, mais un redéploiement pendant une écriture peut laisser un `.tmp` — relu en secours, OK) ; read-modify-write non atomiques (SEC-014) ; aucun nettoyage des `.tmp` orphelins.
- **Disque plein / lecture seule** : `writeJsonAtomic` retente sur erreurs transitoires dont `ENOSPC` (`:42-52`) puis jette l'erreur → l'utilisateur voit une action en échec (sans message clair). Pas de monitoring du quota.
- **Backups non testés** : la restauration automatique est couverte par `lib/__tests__/storage.test.ts` (corruption + backup), mais pas de test de restauration depuis un backup serveur réel.

### Erreurs et observabilité

- `console.error`/`console.warn` préfixés par module — bonne convention (`AGENTS.md`), mais **aucune journalisation fichier** (tout va dans les logs cPanel) et **aucun identifiant de corrélation** : impossible de relier un échec serveur à une requête précise.
- Pas de monitoring (uptime, erreurs 5xx) ni d'alerte. Le scheduler échoue silencieusement en cas d'exception (catch large, `notification-scheduler.ts:97-137`).
- Les erreurs des services externes (Google, MS, IA, Brave) sont attrapées avec retries/backoff (bon point, cf. §12) mais **indistinguables des erreurs internes** côté client (toast générique).

---

## 12. Qualité technique et tests

### Architecture et typage

- Architecture saine : 16 Server Actions par domaine, 34 Route Handlers, couche storage unique, barils `lib/types.ts`/`lib/storage.ts` purs. Alias `@/*` partout.
- TypeScript strict (`tsconfig.json:7`) : **0 erreur** (`bunx tsc --noEmit`), 1 seul `as any` (`components/ui/PwaLoader.tsx:64`), aucun `@ts-ignore`/`@ts-expect-error` (grep vide), pas de `dangerouslySetInnerHTML`.
- ESLint : 0 erreur, 2 warnings de deps de hooks (`ChatView.tsx:176,460`) ; quelques `eslint-disable` ciblés et justifiés (set-state-in-effect, exhaustive-deps, no-img-element).
- **Dette** : duplication Actions ↔ Route Handlers (documentée `AGENTS.md`, volontaire pour SW/cron) ; duplication de types `lib/types.ts` ↔ `lib/api-client.ts` ; `lib/csrf.ts` mort ; `lib/reminder-sync.ts` fire-and-forget ; `server-cache` par process.

### Tests

- **Unitaires : 323/323 verts** (32 fichiers) — couvrent storage (dont concurrence d'écriture et corruption), JWT (tampering, expiration), OAuth Google/MS (refresh, retries, mocks), sync MS, push-subscriptions, offline, config, date, leetcode, actions métier (mockées).
- **Non testés** : `app/api/chat/route.ts` (le cœur), toutes les autres routes API, `middleware.ts`, `cron-auth.ts`, les routes passkey, `/api/export`, le scheduler, `lib/web.ts` (aucun test SSRF négatif !), `send-push`, `ai-providers` (mockés seulement), aucun test de contrôle d'accès négatif (401), aucun test de composant React (seul `notifications.client.test.ts` utilise jsdom), aucun test E2E déterministe.
- **E2E** : 3 specs non déterministes (tests conditionnels `isVisible` dans `e2e/auth-chat.spec.ts:34` et `reminders.spec.ts:20,31` ; `chat-fix.spec.ts` dépend d'un backend IA réel). Non exécutables ici (binaire Chromium absent). Aucun `storageState` pour les pages protégées.

### Déploiement (deploy.sh)

- Build standalone + rsync cPanel + `npm install --production` + restart (UAPI ou `touch tmp/restart.txt`). `data/*.json` exclus du rsync sauf `config.json` et `firebase-service-account.json` (`deploy.sh:105-114`) → **les données serveur ne sont pas écrasées**, mais `data/backups` est exclu : **les backups ne vivent que sur la machine de dev** (point OPS).
- `.env` de prod généré avec les secrets en clair dans l'archive (`deploy.sh:56-74`) — normal, mais le fichier reste 644.
- Pas de rollback versionné ; un déploiement interrompu laisse un état intermédiaire (rsync non atomique).

---

## 13. Registre exhaustif des constats

Légende : Impact 1-5 · Urgence 1-5 · Effort 1-5 (XS=1 … XL=5) · Confiance F/M/E. Priorité indicative = (impact × urgence) / effort.

| ID | Domaine | Constat | Preuve | Impact | Urgence | Effort | Priorité | Recommandation |
|---|---|---|---|---|---|---|---|---|
| SEC-001 | Sécurité | `SETUP_TOKEN` non consommé, bootstrap rejouable, absent des exemples de déploiement | `register-options/route.ts:18-28` ; `register-verify/route.ts:22` ; `.deploy.env.example` | 4 | 2 | 1 | 8 | Consommer le token (fichier marqueur) ; imposer si 0 credential ; ajouter RP_ID/ORIGIN aux exemples |
| SEC-002 | Sécurité | `state` OAuth généré sans comparaison (Google, MS) | `google/callback/route.ts:18-25` ; `microsoft/callback/route.ts:12-15` | 3 | 2 | 2 | 3 | Cookie signé + comparaison au callback |
| SEC-003 | Sécurité | Refresh tokens en clair, 644 | `google-client.ts:18-20,43-46` ; `microsoft-client.ts:33-35` | 4 | 3 | 2 | 6 | `chmod 600` à l'install ; chiffrer avec clé dérivée de `AUTH_SECRET` (option robuste) |
| SEC-004 | Sécurité | `assertSameOrigin` jamais utilisé | `lib/csrf.ts:1-29` | 2 | 2 | 1 | 4 | Brancher sur les POST sensibles ou supprimer |
| SEC-005 | Sécurité | Sessions 7 j sans révocation ; suppression de compte incomplète | `session-core.ts:6` ; `logout/route.ts:5` ; `account/delete/route.ts:11,27-40` | 3 | 2 | 2 | 3 | TTL 24 h + `jti` denylist ; régénérer `.auth-secret` au delete |
| SEC-006 | Sécurité | `/api/auth/set-session` orphelin public | `set-session/route.ts:4-44` (0 appelant) | 2 | 1 | 1 | 2 | Supprimer la route |
| SEC-007 | Sécurité | SSRF incomplet : redirects, DNS rebinding, IP exotiques, taille illimitée | `web.ts:85-154` ; `watch-later.ts:110-115` ; fetch auto `chat/route.ts:163-174` | 4 | 4 | 3 | 5,3 | `redirect:"manual"` + contrôle des sauts ; limite 1 Mo ; normaliser les IP ; re-résolution |
| SEC-008 | Sécurité | Outils IA à action externe sans confirmation | `chat/route.ts:296-313` ; `chat-tools.ts:285-546` | 5 | 5 | 3 | 8,3 | Centre de confirmation dans le flux chat (voir §15 PH-01) |
| SEC-009 | Sécurité | Injection indirecte de prompt (contenu web/e-mail non délimité) | `chat/route.ts:171,308-312` ; `watch-later.ts:134-145` | 5 | 4 | 2 | 10 | Délimiteurs `<user_content>` + politique par source + confirmation (SEC-008) |
| SEC-010 | Sécurité | WebAuthn : `userHandle` ignoré, `requireUserVerification: false` | `auth-verify/route.ts:8-22,49` ; `register-options/route.ts:45-49` | 2 | 1 | 1 | 2 | Durcissement (open source) — non bloquant mono-utilisateur |
| SEC-011 | Sécurité | Erreurs OAuth brutes au client | `google/callback/route.ts:48-51` ; `microsoft/callback/route.ts:17-35` | 1 | 1 | 1 | 1 | Messages génériques + log détaillé serveur |
| SEC-012 | Sécurité | Incohérence edge/node clé session (fallback fichier vs env) | `session-edge.ts:19-23` vs `session-core.ts:23-37` | 2 | 1 | 1 | 2 | Documenter ; vérifier `AUTH_SECRET` au boot |
| SEC-013 | Sécurité | XSS Markdown — **faux positif** | `Markdown.tsx:18` ; aucun `dangerouslySetInnerHTML` | 0 | 0 | 0 | — | Rien |
| SEC-014 | Sécurité | Read-modify-write non atomiques (5 sites) | `push-subscriptions.ts:23-38` ; `config.ts:73-79` ; `consent.ts:24-29` ; `auth.ts:50-59` ; `notification-scheduler.ts:38-49` | 2 | 2 | 2 | 2 | Basculer sur `mutateJson` |
| SEC-015 | Sécurité/Fonction | Route `/api/reminders/[id]/done` sans sync MS ni revalidate | `done/route.ts:6-8` vs `reminders.ts:101-113` | 3 | 3 | 1 | 9 | Réutiliser la logique de l'action |
| SEC-016 | Sécurité/PWA | Cache SW : réponses privées jamais purgées à la déconnexion | `sw.js:144-170` ; `logout/route.ts:5` | 3 | 2 | 2 | 3 | Message SW de purge sur logout |
| SEC-017 | Sécurité | `/api/push` POST public sans garde d'origine | `push/route.ts:21-34` | 1 | 1 | 1 | 1 | Valider forme + limite |
| UX-001 | UX | Un seul `error.tsx` ; pas de `loading.tsx` global | `app/daily-brief-test/error.tsx` seul ; `app/` sans `loading.tsx` | 4 | 4 | 2 | 8 | error/loading globaux + gestion d'erreur actions |
| UX-002 | UX | Actions destructives incohérentes (photos sans undo ; double confirm compte) | `photos/page.tsx:101-109` ; `settings/page.tsx:112-126` | 3 | 3 | 1 | 9 | Undo photos ; confirm unique |
| UX-003 | UX | Confirmation IA absente (duplique SEC-008 côté expérience) | `ChatView.tsx:338-348` | 5 | 5 | 3 | 8,3 | Confirmation en ligne dans le message |
| UX-004 | UX | Palette aveugle à l'état ; `/leetcode` faux succès | `commands.ts:226-229,243-247` | 2 | 2 | 1 | 4 | Désactiver/implémenter réellement |
| UX-005 | UX | Pas de statut consolidé des intégrations | `google-health.ts` existe, pas d'UI | 3 | 3 | 3 | 3 | Panneau santé (§8) |
| UX-006 | UX | Auto-extraction mémoire non signalée | `chat/route.ts:100-128` | 2 | 2 | 1 | 4 | Événement `memory_facts` affiché dans le chat (déjà streamé, non affiché ?) |
| UI-001 | UI | Rail 13 destinations saturé | `Chrome.tsx:38-52` | 4 | 3 | 3 | 4 | Navigation 5 + secondaire (§6) |
| UI-002 | UI | Labels incohérents (« Console IA », « À voir », `g c` → `/`) | `Chrome.tsx:39` ; `KeyboardShortcuts.tsx:8` | 2 | 2 | 1 | 4 | Harmoniser |
| UI-003 | UI | Thème clair fantôme | `ThemeApplier.tsx:19` vs `README.md:27` | 2 | 2 | 2 | 2 | Retirer l'annonce ou implémenter |
| UI-004 | UI | Raccourci `t` fantôme ; `Esc` en conflit | `KeyboardShortcuts.tsx:7-21,32-54` ; `ChatView.tsx:493` ; `CommandPalette.tsx:68` | 2 | 2 | 1 | 4 | Implémenter/supprimer ; hiérarchiser Esc |
| UI-005 | UI | `emails.json` mock confondu avec Gmail | `emails.ts:4-23` ; `commands.ts:243-247` | 2 | 2 | 1 | 4 | Supprimer le mock ou le marquer |
| FUN-001 | Fonctionnel | Brief quotidien flag off par défaut ; page test en prod | `config.ts:39` ; `app/daily-brief-test/` | 2 | 2 | 1 | 4 | Décision produit |
| FUN-002 | Fonctionnel | LeetCode : commande placeholder, cohérence produit faible | `commands.ts:226-229` ; `app/leetcode/page.tsx` | 2 | 2 | 2 | 2 | Secondaire ou retirer |
| FUN-003 | Fonctionnel | Photos vs Galerie ; Concerts vs Calendar : recouvrements | `photo-shoots.json`/`gallery.json` ; `storage/calendar.ts:5-18` | 3 | 2 | 3 | 2 | Fusionner (décision produit) |
| FUN-004 | Fonctionnel | Landing `/` publique vs produit sur `/chat` | `app/page.tsx` ; `manifest.json:5` | 2 | 1 | 2 | 1 | Décision produit (vitrine vs redirect) |
| FUN-005 | Fonctionnel | `/api/export` sans UI ; suppression sélective absente | `export/route.ts` ; `settings/page.tsx` | 3 | 2 | 2 | 3 | Centre de confidentialité |
| FUN-006 | Fonctionnel | Sync MS silencieuse en échec | `reminder-sync.ts:46-49,62-74` | 2 | 2 | 1 | 4 | Statut d'échec visible |
| PERF-001 | Performance | `res.text()` sans limite (mémoire) | `web.ts:154` ; `watch-later.ts:115` | 3 | 3 | 1 | 9 | Limite 1 Mo (couplé SEC-007) |
| PERF-002 | Performance | Waterfall HTML→JS→API sur toutes les pages | `next build` (routes ○) ; `lib/cache.ts` | 2 | 1 | 3 | 0,7 | Acceptable mono-utilisateur ; revisiter si ressenti |
| PERF-003 | Performance | Historique complet envoyé au chat | `chat/route.ts:206-220` | 2 | 1 | 2 | 1 | Fenêtrage + résumé (déjà partiel `:176-199`) |
| REL-001 | Fiabilité | Backups uniquement locaux (exclus du rsync) | `deploy.sh:105-114` | 4 | 3 | 2 | 6 | Inclure `data/backups` au backup serveur (hors rsync, cron de copie) |
| REL-002 | Fiabilité | Pas de rollback versionné ; rsync non atomique | `deploy.sh:38-114` | 3 | 2 | 3 | 2 | Archive `current`/`previous` |
| REL-003 | Fiabilité | Double exécution possible reminders (cron + scheduler interne) | `notification-scheduler.ts:254-259` ; `scripts/cron-scheduler.ts` ; `cron/reminders/route.ts:9-11` | 2 | 2 | 1 | 4 | Verrou `notified-reminders.json` OK ; documenter l'usage unique |
| OBS-001 | Observabilité | Aucun identifiant de corrélation ; logs console uniquement | `instrumentation.ts` ; conventions `console.*` | 3 | 3 | 2 | 4,5 | `requestId` + log structuré |
| TEST-001 | Tests | 0 test des routes API, middleware, cron, passkey, export, scheduler, web.ts (SSRF) | `app/api/` (aucun `*.test.ts`) ; `e2e/` | 4 | 4 | 4 | 4 | Priorité §15 PH-05 |
| TEST-002 | Tests | E2E non déterministes, dépendants d'un backend IA réel | `e2e/chat-fix.spec.ts:13-18` ; `auth-chat.spec.ts:34` | 3 | 3 | 2 | 4,5 | Specs déterministes + storageState |
| TEST-003 | Tests | Aucun test composant React / accessibilité / mobile | `vitest.config.ts` (node) ; `notifications.client.test.ts` seul jsdom | 3 | 2 | 3 | 2 | Testing Library + axe |
| TEST-004 | Tests | Tests de concurrence partiels (pas de `mutateJson` sous lock) | `storage.test.ts:173-208` | 1 | 1 | 1 | 1 | Compléter |
| A11Y-001 | Accessibilité | Contraste `--text-4` 2,5:1 | `globals.css:37-66` | 4 | 3 | 1 | 12 | Éclaircir les tokens (quick win) |
| A11Y-002 | Accessibilité | Pas de skip-link | `layout.tsx`, `Chrome.tsx` | 3 | 3 | 1 | 9 | Ajouter |
| A11Y-003 | Accessibilité | Boutons icône sans aria-label | cf. §10 A11Y-004 | 3 | 3 | 1 | 9 | `aria-label` systématique |
| A11Y-004 | Accessibilité | Formulaires sans labels liés | §10 A11Y-005 | 3 | 3 | 2 | 4,5 | Labels + `htmlFor` |
| A11Y-005 | Accessibilité | Modales sans focus trap/Esc | `DetailModal.tsx:64-67` ; `KeyboardShortcuts.tsx:67` | 3 | 3 | 2 | 4,5 | Trap + Esc + focus restore |
| A11Y-006 | Accessibilité | `prefers-reduced-motion` partiel | `globals.css:245-427` | 2 | 2 | 1 | 4 | Media query sur les keyframes |
| A11Y-007 | Accessibilité | Zones tactiles < 44 px | `ItemCard.tsx:54` ; `Toast.tsx:136` ; `Chrome.tsx:437` | 2 | 2 | 1 | 4 | Min 40 px |
| A11Y-008 | Accessibilité | DnD sans clavier | `photos/page.tsx`, `watch-later/page.tsx` | 2 | 1 | 3 | 0,7 | Boutons monter/descendre |
| ARC-001 | Architecture | Duplication Actions ↔ Routes (documentée, assumée) | `AGENTS.md` ; `done/route.ts` vs `reminders.ts` | 2 | 2 | 3 | 1,3 | Partager la logique (SEC-015 d'abord) |
| ARC-002 | Architecture | Types dupliqués `types.ts` ↔ `api-client.ts` | `AUDIT.md` n°7 (toujours) | 1 | 1 | 1 | 1 | Centraliser |
| ARC-003 | Architecture | `server-cache` par process, cache config mémoire | `server-cache.ts` ; `config.ts:49-70` | 1 | 1 | 1 | 1 | Accepté mono-instance |

Notes sur la formule : la priorité brute `(impact × urgence) / effort` sous-estime les corrections qui débloquent d'autres chantiers (SEC-008 débloque SEC-009 et UX-003 ; SEC-007 débloque PERF-001). Ces trois-là sont **P0 malgré un score intermédiaire** (exception assumée, cf. §15).

---

## 14. Quick wins

Corrections réalisables en moins d'une journée, classées par impact décroissant.

| # | Correction | Impact | Effort | Fichiers | Risque de régression |
|---|---|---|---|---|---|
| QW-1 | **Confirmer les actions IA à effet externe** — mode « validation » dans `executeTool` : les outils de niveau 3/4 (cf. §7 de l'audit contradictoire) attendent un flag `confirmed` ; sans lui, retour « action en attente de confirmation » au modèle | Élimine l'essentiel du risque SEC-008/SEC-009 | S (½ j) | `lib/chat-tools.ts:285`, `app/api/chat/route.ts:296-313`, `components/chat/ChatView.tsx` | Moyen : le chat peut demander une confirmation que l'UI n'affiche pas encore — prévoir le rendu minimal (bouton Confirmer dans le message assistant) |
| QW-2 | **Limiter la taille des réponses web** (1 Mo) dans `fetchPageMeta` et `autoSummarize` | Évite OOM/SSRF volumineux | XS | `lib/web.ts:154`, `lib/watch-later.ts:115` | Nul |
| QW-3 | **Corriger `/api/reminders/[id]/done`** : appeler la même logique que `markReminderStatus` (push MS + revalidate) | Réparer la désync MS To Do | XS | `app/api/reminders/[id]/done/route.ts:6-8` | Faible (modifie le flux notification → fait) |
| QW-4 | **Éclaircir les tokens de texte** (`--text-3`/`--text-4`) pour passer le contraste AA | Accessibilité immédiate | XS | `app/globals.css:37-66` | Faible (impact visuel léger) |
| QW-5 | **`chmod 600` sur `data/*.json` et `data/.auth-secret`** à l'installation (`deploy.sh`) | Réduit l'exposition des tokens | XS | `deploy.sh` | Nul |
| QW-6 | **Supprimer la route orpheline `/api/auth/set-session`** | Réduit la surface | XS | `app/api/auth/set-session/route.ts` | Nul (0 appelant vérifié) |
| QW-7 | **Harmoniser les labels** (« Console IA », `g c` → `/chat`, « À voir ») | Clarté | XS | `components/ui/KeyboardShortcuts.tsx:8`, `Chrome.tsx:39` | Nul |
| QW-8 | **Retirer le raccourci `t` fantôme** ou l'implémenter | Fini le mensonge de l'aide clavier | XS | `KeyboardShortcuts.tsx:7-21` | Nul |
| QW-9 | **Ajouter un `aria-label`** aux boutons icône sans nom (rail, déconnexion, toast, delete) | Accessibilité | S | `Chrome.tsx:102,123,135,138,204,211,223,437`, `Toast.tsx:136`, `ItemCard.tsx:54` | Nul |
| QW-10 | **Supprimer le faux succès `/leetcode`** de la palette (ou brancher le vrai flux) | Honnêteté de l'UI | XS | `components/ui/command-palette/commands.ts:226-229` | Nul |
| QW-11 | **Purge du cache SW + localStorage à la déconnexion** | Confidentialité | S | `app/api/auth/logout/route.ts`, `public/sw.js` (message `CLEAR_CACHE`), `lib/offline.ts:31-38` | Faible (rechargement après logout) |
| QW-12 | **Message générique sur les callbacks OAuth en erreur** (plus de `err.message` brut) | Fuite d'info réduite | XS | `google/callback/route.ts:48-51`, `microsoft/callback/route.ts:17-35` | Nul |
| QW-13 | **Brancher `assertSameOrigin`** sur les routes POST sensibles ou supprimer `lib/csrf.ts` | CSRF | XS | `lib/csrf.ts`, routes POST | Faible (les clients légitimes envoient Origin en POST fetch) |
| QW-14 | **Skip-link + `main id="main"`** | Accessibilité | XS | `app/layout.tsx`, `components/layout/Chrome.tsx` | Nul |

---

## 15. Roadmap priorisée

Les phases sont ordonnées pour débloquer les dépendances (la confirmation IA précède l'injection de prompt ; la navigation précède les états d'erreur ; les tests précèdent les refontes).

### Phase 0 — Protection minimale de la production

Objectif : réduire le risque immédiat sans refonte. Durée : 1 à 2 jours.

| ID | Description | Fichiers | Dépendances | Effort | Risques | Critères d'acceptation | Tests |
|---|---|---|---|---|---|---|---|
| PH-00.1 | Confirmation minimale des outils IA externes (QW-1) | `lib/chat-tools.ts`, `app/api/chat/route.ts`, `ChatView.tsx` | — | M | Chat moins fluide si mal rendu | Toute action externe affiche un bouton Confirmer/Annuler dans le message | Unitaire (`ai-tools.test.ts`) + manuel chat |
| PH-00.2 | SSRF : `redirect: "manual"` + contrôle des sauts (max 3) + limite 1 Mo + normalisation des IP | `lib/web.ts:85-154`, `lib/watch-later.ts:110-115` | — | M | Watch-later/aperçus cassés si sites hostiles aux UA | Un lien vers `http://169.254.169.254/` (direct, décimal, octal, v4-mapped, via 302) est refusé | Unitaire `web.test.ts` (nouveau) |
| PH-00.3 | `chmod 600` data/ (QW-5) + SEC-006 suppression set-session (QW-6) | `deploy.sh`, `app/api/auth/set-session/route.ts` | — | XS | Nul | Plus de fichier 644 dans data/ ; route 404 | Manuel |
| PH-00.4 | Purge cache SW/localStorage au logout (QW-11) | `logout/route.ts`, `sw.js`, `offline.ts` | — | S | Faible | Après logout, `caches.keys()` vide côté client | Manuel + unitaire `offline.test.ts` |
| PH-00.5 | `SETUP_TOKEN` consommé (fichier marqueur `data/setup-consumed` + refus si token déjà consommé) | `register-options/route.ts`, `register-verify/route.ts` | — | S | Risque de bloquer un ré-enregistrement légitime (gérer via `reset:passkey` qui purge le marqueur) | Deuxième bootstrap sans `reset:passkey` impossible | Unitaire `auth.test.ts` |

### Phase 1 — Fondations UX et navigation

Durée : 3 à 5 jours.

| ID | Description | Fichiers | Dépendances | Effort | Risques | Critères d'acceptation | Tests |
|---|---|---|---|---|---|---|---|
| PH-01.1 | Navigation cible 5 + secondaire (cf. §6) ; sheet « Toutes les pages » → sections regroupées | `components/layout/Chrome.tsx`, `AppShell.tsx` | — | M | Liens cassés si oubli ; garder les routes actuelles (redirection ou section) | Rail ≤ 5 destinations + menu secondaire ; tous les raccourcis `g` cohérents | E2E navigation (nouveau) |
| PH-01.2 | Labels harmonisés + `g c` → `/chat` + retrait du raccourci `t` | `KeyboardShortcuts.tsx`, `Chrome.tsx` | PH-01.1 | XS | Nul | Aide clavier = code réel | Manuel |
| PH-01.3 | Page « Aujourd'hui » (`/`) : rappels du jour, agenda du jour, intentions dues, brief (si activé) | `app/page.tsx` (nouvelle), widgets existants | PH-01.1 | L | Conflit avec la landing `/` publique — **choix produit** : la landing reste la landing, « Aujourd'hui » devient une route privée (`/today`) ou remplace `/` connecté | L'agrégat s'affiche à la connexion | E2E + unitaire des selecteurs |
| PH-01.4 | États d'erreur/chargement globaux : `app/error.tsx` + `app/loading.tsx` racine + gestion d'erreur des actions (message actionable) | `app/`, `components/ui/Toast.tsx`, `lib/api-client.ts` | — | M | Peu | Toute erreur de page affiche un écran utile (retry) ; toast d'action avec cause | Manuel + tests composants |
| PH-01.5 | Palette consciente de l'état (désactiver commandes sans connexion, supprimer faux succès) | `components/ui/command-palette/commands.ts` | — | S | Nul | `/search` sans Gmail → désactivé avec raison affichée | Manuel |

### Phase 2 — Cohérence fonctionnelle

Durée : 3 à 5 jours.

| ID | Description | Fichiers | Dépendances | Effort | Risques | Critères d'acceptation | Tests |
|---|---|---|---|---|---|---|---|
| PH-02.1 | `markReminderStatus` partagé entre l'action et la route `done` (+ revalidate + push MS) | `app/actions/reminders.ts`, `app/api/reminders/[id]/done/route.ts` | — | XS | Faible | Marquer « fait » depuis une notification synchronise MS To Do | Unitaire `reminders.test.ts` + `reminder-sync.test.ts` |
| PH-02.2 | `mutateJson` sur les 5 RMW non atomiques | `push-subscriptions.ts`, `config.ts`, `consent.ts`, `auth.ts`, `notification-scheduler.ts` | — | S | Faible | Plus de perte d'entrée sous concurrence | Unitaire `storage-domains.test.ts` |
| PH-02.3 | Décision et implémentation : fusion Photos+Galerie (ou déplacement Galerie en secondaire) ; Concerts dans Calendar | `app/photos/`, `app/gallery/`, `app/calendar/`, `lib/storage/` | PH-01.1 | L | Perte de données si migration mal faite — **migration de lecture seule** (gallery lu depuis photo-shoots) puis suppression progressive | Une seule entrée visuelle « Photos » ; données préservées | Tests de migration |
| PH-02.4 | Statut d'échec de la sync MS visible (colonne/icône « non synchronisé ») | `lib/reminder-sync.ts`, `components/reminders` (app/reminders) | PH-02.1 | S | Faible | Un rappel non poussé affiche un avertissement | Manuel |
| PH-02.5 | Brief quotidien : décision produit (activer par défaut avec consentement, ou masquer la page test) | `lib/config.ts:39`, `app/daily-brief-test/` | — | S | Nul | Comportement documenté et testé | Manuel |

### Phase 3 — Fonctionnalités à forte valeur

Durée : 4 à 7 jours.

| ID | Description | Fichiers | Dépendances | Effort | Risques | Critères d'acceptation | Tests |
|---|---|---|---|---|---|---|---|
| PH-03.1 | Journal des actions IA (qui/quoi/quand/statut) dans `activity.json` + vue dédiée | `lib/chat-tools.ts`, `app/api/chat/route.ts`, `lib/storage/activity.ts`, UI activité | PH-00.1 | M | Faible | Chaque action externe est tracée | Unitaire |
| PH-03.2 | Annulation des actions réversibles (rappel, événement calendrier local, photo) — undo toast étendu | `app/reminders/`, `app/photos/`, `app/calendar/` | — | M | Moyen (idempotence) | Undo photo créé | Manuel |
| PH-03.3 | Centre de confidentialité : UI d'export (`/api/export` existe) + suppression sélective par domaine | `app/settings/page.tsx`, nouvelle route | — | S | Faible | Export téléchargeable depuis Paramètres | Manuel |
| PH-03.4 | Tableau de santé des intégrations (Google, MS, push, IA : token OK, dernier refresh, dernière erreur) | `lib/google-health.ts` (existe), nouveau composant | — | M | Faible | Statuts visibles à un endroit | Unitaire `google-health.test.ts` (existe) |
| PH-03.5 | Délimitation du contenu non fiable dans le prompt (balises `<user_content>` + politique par source) | `app/api/chat/route.ts`, `lib/chat-prompts.ts`, `lib/chat-tools.ts` | PH-00.1 | M | Moyen (qualité des réponses) | Page malveillante n'initie plus d'appel d'outil sans confirmation | Tests d'injection (nouveau) |

### Phase 4 — Finition, accessibilité et performance

Durée : 3 à 6 jours.

| ID | Description | Fichiers | Dépendances | Effort | Risques | Critères d'acceptation | Tests |
|---|---|---|---|---|---|---|---|
| PH-04.1 | Contraste tokens + focus-visible partout + skip-link (QW-4/9/14) | `globals.css`, `Chrome.tsx`, `layout.tsx` | — | S | Faible | AA sur texte courant (vérif. axe) | axe-core (nouveau) |
| PH-04.2 | Labels liés + focus trap + Esc + restauration du focus (modales) | `DetailModal.tsx`, `KeyboardShortcuts.tsx`, `ReminderForm.tsx`, `CommandPalette.tsx`, `ChatComposer.tsx` | — | M | Faible | Tabulation bornée dans les modales ; labels `htmlFor` | axe-core + manuel clavier |
| PH-04.3 | `prefers-reduced-motion` sur les 8 keyframes + scroll smooth | `globals.css:245-427`, `ChatView.tsx:258,263` | — | XS | Nul | Animations désactivées sous reduce | Manuel |
| PH-04.4 | Zones tactiles ≥ 40 px (delete, toast, close) | `ItemCard.tsx:54`, `Toast.tsx:136`, `Chrome.tsx:437` | — | XS | Nul | Cibles ≥ 40 px | Manuel mobile |
| PH-04.5 | Fenêtrage de l'historique chat (derniers N messages + résumé) | `app/api/chat/route.ts:206-220` | — | S | Moyen (perte de contexte) | Payload bornée ; résumé conservé | Unitaire |

---

## 16. Backlog prêt à implémenter

Tickets autonomes (titre / problème / solution / périmètre / hors périmètre / acceptation / tests / priorité / estimation).

### T-1 — Confirmation des actions IA externes
- **Problème** : `send_email_response`, `create_calendar_event`, `schedule_followup`… s'exécutent sans approbation (`chat/route.ts:296-313`).
- **Solution** : dans `executeTool`, marquer les outils de niveau ≥ 3 ; s'ils arrivent sans `confirmed: true`, renvoyer au modèle un résultat « action en attente de confirmation (id: …) » ; le client affiche une carte Confirmer/Annuler qui rejoue l'appel avec `confirmed: true`.
- **Périmètre** : `lib/chat-tools.ts`, `app/api/chat/route.ts`, `components/chat/ChatView.tsx`, `components/chat/MessageBlocks.tsx`.
- **Hors périmètre** : refonte du prompt, permissions par source.
- **Acceptation** : aucune action externe sans clic ; annulation tracée.
- **Tests** : unitaire `ai-tools.test.ts` ; manuel.
- **Priorité** : P0. **Estimation** : ½–1 j.

### T-2 — Durcissement SSRF
- **Problème** : `lib/web.ts:85-154` (redirects, DNS rebinding, IP décimales/octales/v4-mapped, taille).
- **Solution** : helper `safeFetch` : `redirect: "manual"`, max 3 sauts contrôlés, `isSafeFetchUrl` à chaque saut, limite de corps 1 Mo (stream), normalisation des adresses (décimal→dotted, octal, v4-mapped).
- **Périmètre** : `lib/web.ts`, `lib/watch-later.ts`, `app/api/chat/route.ts:163-174`.
- **Hors périmètre** : résolution DNS contrôlée (undici Agent) — variante robuste.
- **Acceptation** : les cas de test SSRF (direct/redirect/encodé) sont rejetés ; les sites légitimes passent.
- **Tests** : nouveau `lib/__tests__/web.test.ts`.
- **Priorité** : P0. **Estimation** : 1 j.

### T-3 — Route `done` des rappels synchronisée
- **Problème** : `app/api/reminders/[id]/done/route.ts:6-8` court-circuite la sync MS et la revalidation.
- **Solution** : extraire `markReminderStatus` partagé (action + route) avec push MS + `revalidatePath`.
- **Périmètre** : `app/actions/reminders.ts`, route `done`.
- **Hors périmètre** : refonte de la sync.
- **Acceptation** : notification « Fait » → tâche MS complétée.
- **Tests** : `reminders.test.ts`, `reminder-sync.test.ts`.
- **Priorité** : P0. **Estimation** : 2–4 h.

### T-4 — Purge des caches privés à la déconnexion
- **Problème** : `sw.js` cache toute réponse GET OK (`:144-170`) ; logout ne purge pas.
- **Solution** : `POST /api/auth/logout` → réponse avec instruction ; le client postMessage `CLEAR_CACHE` au SW + `clearOfflineCache()` (`lib/offline.ts:31-38`).
- **Acceptation** : après logout, aucun cache `backstage-v*` ni clé `brain-cache:`.
- **Tests** : `offline.test.ts` ; manuel.
- **Priorité** : P1. **Estimation** : ½ j.

### T-5 — SETUP_TOKEN consommé
- **Solution** : après un register-verify réussi, écrire `data/setup-consumed` ; `register-options` refuse si token présent mais déjà consommé (sauf session active) ; `reset:passkey` purge le marqueur.
- **Acceptation** : re-bootstrap impossible sans `reset:passkey`.
- **Tests** : `auth.test.ts`.
- **Priorité** : P1. **Estimation** : ½ j.

### T-6 — Navigation 5 + secondaire
- **Solution** : rail = Console, Aujourd'hui, Cerveau, Boîtes (Gmail/Calendar), À voir ; le reste en menu secondaire/sheet ; harmonisation des raccourcis `g`.
- **Acceptation** : ≤ 5 destinations primaires ; toutes les routes conservées accessibles.
- **Tests** : E2E navigation.
- **Priorité** : P1. **Estimation** : 2 j.

### T-7 — États d'erreur et de chargement globaux
- **Solution** : `app/error.tsx` racine, `app/loading.tsx`, erreurs d'actions actionnables.
- **Acceptation** : aucune erreur ne produit un écran Next générique.
- **Tests** : manuel + composants.
- **Priorité** : P1. **Estimation** : 1–2 j.

### T-8 — Tests critiques manquants
- **Solution** : tests des routes `/api/chat` (auth, rate-limit, outil non confirmé), middleware (401/redirect), `cron-auth`, `web.ts` (SSRF), contrôle d'accès négatif ; E2E avec `storageState`.
- **Acceptation** : couverture des chemins critiques ; E2E déterministes (pas de backend réel).
- **Priorité** : P1. **Estimation** : 2–3 j.

### T-9 — Accessibilité (contraste, focus, labels, modales, reduced-motion)
- **Solution** : QW-4/9/14 + PH-04.1 à 04.4.
- **Priorité** : P2. **Estimation** : 2 j.

### T-10 — Décision produit + implémentation Photos/Galerie, Concerts/Calendar
- **Priorité** : P2 (décision produit d'abord). **Estimation** : 2 j.

---

## 17. Prompts d'implémentation

Prompts prêts à copier-coller. Chaque prompt impose : inspection préalable, périmètre borné, conservation du mono-utilisateur, tests, lint/TS/build, compte rendu, absence de secrets, arrêt sur ambiguïté dangereuse.

> Préambule commun à tous les prompts :
> « Tu travailles sur BACKSTAGE, PWA Next.js 16 App Router + Bun, strictement mono-utilisateur et mono-instance (données JSON dans `data/`, auth passkey, stockage via `lib/storage-core.ts` : `mutateJson`/`writeJsonAtomic` — utilise-les, ne fais pas de `fs.writeFile` direct). Lis d'abord `AGENTS.md` et les fichiers concernés avant de modifier quoi que ce soit. Applique le pattern Server Action canonique (requireSession, Zod, revalidatePath, erreurs en français sans accent). Ne modifie que le périmètre demandé. Vérifie `bun run lint`, `bunx tsc --noEmit`, `bun run test`, puis `bun run build` (avec les clés VAPID vidées : `VAPID_PRIVATE_KEY="" NEXT_PUBLIC_VAPID_PUBLIC_KEY="" bun run build` — ne démarre JAMAIS `bun dev`/`bun start` sans neutraliser le scheduler : `data/push-subscriptions.json` contient un abonnement réel et des rappels en retard déclencheraient de vraies notifications). Ne révèle jamais de secret. Si une décision produit est ambiguë (fusion, suppression de fonctionnalité), demande avant d'agir. Termine par le compte rendu : fichiers modifiés, tests passés, limites. »

### P-1 — Sécurisation minimale
« Applique les tickets T-1 (confirmation des outils IA), T-2 (SSRF), T-3 (route done), T-4 (purge cache logout), T-5 (SETUP_TOKEN consommé) du backlog `AUDIT_PRODUIT_COMPLET.md` §16. Fichiers principaux : `lib/chat-tools.ts`, `app/api/chat/route.ts`, `lib/web.ts`, `lib/watch-later.ts`, `app/api/reminders/[id]/done/route.ts`, `app/actions/reminders.ts`, `app/api/auth/logout/route.ts`, `public/sw.js`, `lib/offline.ts`, `app/api/auth/passkey/*`, `deploy.sh` (chmod 600). Ne touche pas à l'UI au-delà de la carte de confirmation minimale. Tests : ajoute les tests unitaires correspondants (ai-tools, web.test.ts, offline, auth). »

### P-2 — Refonte de la navigation
« Implémente T-6 + PH-01.2 : rail ≤ 5 destinations (Console, Aujourd'hui, Cerveau, Boîtes, À voir), menu secondaire pour le reste (Photos, Accréditations, Concerts, LeetCode, Focus, Relances, Activité, Recherche, Galerie, Paramètres), harmonisation des labels et des raccourcis `g` (corrige `g c` → `/chat`, retire `t`). Fichiers : `components/layout/Chrome.tsx`, `AppShell.tsx`, `components/ui/KeyboardShortcuts.tsx`, `components/ui/command-palette/commands.ts`. N'ajoute pas de nouvelle page. Préserve toutes les routes existantes (elles restent accessibles par URL). Si « Aujourd'hui » n'existe pas encore, pointe vers la landing actuelle en attendant le ticket PH-01.3. »

### P-3 — Page « Aujourd'hui »
« Crée une page d'agrégat "Aujourd'hui" (route privée, ex. `/today`) affichant : rappels du jour (échéance ≤ 24 h, via `getReminders`), événements du jour (via l'API calendar/`getCalendar`), relances dues (`listPendingIntentions`), météo si disponible. Réutilise les composants/widgets existants (`components/widgets/`, `app/reminders/ReminderRow.tsx`). Ajoute un état vide, un chargement (skeleton), et un lien "Tout voir" vers chaque module. N'intègre pas le brief quotidien (ticket séparé). Décision produit : demande confirmation pour l'emplacement (nouvelle route vs remplacement de `/`). »

### P-4 — Chat : confirmations et journal d'actions
« Améliore le chat : (1) carte de confirmation inline dans le message assistant pour les outils à effet externe (Confirmer/Annuler, ne rejoue pas le modèle, appelle l'outil avec `confirmed: true`) ; (2) journal des actions exécutées tracé dans `activity.json` (nouvel événement `ai_action` avec outil, arguments résumés, statut) et affiché dans `/activity` ; (3) affichage de l'événement `memory_facts` (l'événement est déjà streamé par `app/api/chat/route.ts:123`). Fichiers : `components/chat/ChatView.tsx`, `MessageBlocks.tsx`, `ChatComposer.tsx`, `lib/chat-tools.ts`, `app/actions/activity.ts`. Attention : ne modifie pas le format SSE existant sans migration. »

### P-5 — Harmonisation du design system
« Aligne le code sur `DESIGN.md` et `app/globals.css` : vérifie que tous les composants utilisent les tokens CSS (`--surface`, `--border`, `--text-*`), uniformise les focus (ring `focus-visible`), les bordures 1 px, l'absence d'ombres. Corrige les écarts détectés : boutons icône sans `aria-label` (ajoute-les), zones tactiles < 40 px. Ne change pas la palette (sauf éclaircir `--text-3`/`--text-4` pour le contraste AA). N'introduis pas de nouveau composant générique sans justification. »

### P-6 — Accessibilité
« Applique le plan §10 : skip-link, `main id="main"`, focus trap + Esc + restauration du focus sur `DetailModal` et l'aide clavier, labels `htmlFor`/`id` sur tous les formulaires, `aria-label` sur tous les boutons icône, `prefers-reduced-motion` sur les keyframes de `globals.css:245-427`, contraste des tokens texte. Ajoute `@axe-core/playwright` ou un test composant axe pour vérifier. Teste au clavier (Tab + Entrée) chaque parcours. »

### P-7 — Tests E2E
« Rends les E2E déterministes : (1) crée un `storageState` avec un cookie de session valide (signe un JWT avec `AUTH_SECRET` en test ou utilise `/api/auth/set-session` sur un serveur de test) ; (2) supprime les assertions conditionnelles (`isVisible` + `if`) de `e2e/auth-chat.spec.ts:34` et `e2e/reminders.spec.ts:20,31` ; (3) remplace `e2e/chat-fix.spec.ts` (backend IA réel) par un mock du flux SSE (route testée avec un faux provider) ; (4) ajoute des specs : navigation, parcours rappel complet, déconnexion + purge cache. N'exécute les E2E qu'avec le scheduler neutralisé (clés VAPID vides). »

### P-8 — Fonctionnalité manquante la plus utile (tableau de santé des intégrations)
« Crée un panneau "État des connexions" dans Paramètres : statut Google (gmail/calendar), Microsoft, push (nombre d'abonnements), IA (config modèle). Réutilise `lib/google-health.ts` et `isGoogleLinked` (`lib/google-client.ts:131-134`), `getSubscriptions` (`lib/push-subscriptions.ts`), `getConfig` (`lib/config.ts`). Affiche pour chaque intégration : connecté/déconnecté, dernière erreur connue, bouton "Connecter/Reconnecter" pointant vers les routes OAuth existantes. Ajoute un état vide et un rechargement manuel. »

---

## 18. Plan de validation

Checklist à exécuter après chaque phase (la sécurité et la non-régression sont continues).

### Fonctionnelle
- [ ] Chat : message → streaming → outil → confirmation → résultat → journal d'action.
- [ ] Rappel : création (avec MS lié), notification push, action « Fait » depuis la notification, sync MS.
- [ ] Mémoire : extraction auto affichée, CRUD, recherche.
- [ ] Watch-later : ajout, aperçu, auto-résumé, reorder clavier.
- [ ] Gmail/Calendar : lecture, envoi de réponse (avec confirmation), création d'événement (avec confirmation).
- [ ] Photos : CRUD, undo suppression, modale accessible.
- [ ] Export RGPD : téléchargement, exclusion des tokens.
- [ ] Suppression de compte : purge complète (data + caches client + cookies) et invalidation des sessions.

### Visuelle et responsive (375 / 768 / 1366 / 1920)
- [ ] Rail ≤ 5 + menu secondaire ; bottom nav mobile cohérente.
- [ ] Sheet « Toutes les pages » regroupe correctement.
- [ ] Chat plein écran mobile ; ContextPanel en sheet utilisable.
- [ ] Aucun débordement horizontal ; zoom 200 % sans perte fonctionnelle.

### Accessibilité (clavier + lecteur d'écran)
- [ ] Tabulation parcourt tout sans piège (focus trap modales).
- [ ] Skip-link fonctionnel.
- [ ] Contraste AA sur textes courants (axe-core : 0 violation critique).
- [ ] `prefers-reduced-motion` respecté.
- [ ] Tous les boutons icône ont un nom accessible.
- [ ] DnD doublé par des contrôles clavier.

### Sécurité
- [ ] Aucune action IA externe sans confirmation.
- [ ] SSRF : liens privés/redirects refusés (tests).
- [ ] Bootstrap passkey non rejouable sans `reset:passkey`.
- [ ] Logout purge les caches ; compte supprimé → JWT invalide.
- [ ] `data/` en 600 ; `set-session` supprimé ; OAuth `state` vérifié.
- [ ] Aucun secret dans les logs ni les réponses.

### Non-régression
- [ ] `bun run lint` : 0 erreur.
- [ ] `bunx tsc --noEmit` : 0 erreur.
- [ ] `bun run test` : 100 % verts.
- [ ] Build de production OK (VAPID neutralisées).
- [ ] E2E déterministes verts (avec storageState).

---

## 19. Conclusion

### Ordre d'exécution recommandé

1. **Jour 1-2 (Phase 0)** : T-1 → T-2 → T-3 → T-5 (sécurité minimale) + QW-5/6. Ces corrections ne touchent pas l'UX et débloquent tout le reste.
2. **Semaine 1 (Phase 1)** : navigation 5 + secondaire (T-6), états d'erreur globaux (T-7), harmonisation des labels.
3. **Semaine 1-2 (Phase 2)** : T-8 (tests critiques) — *avant* les refontes fonctionnelles, pour avoir un filet.
4. **Semaine 2 (Phase 3)** : journal des actions IA, undo photos, centre de confidentialité (export UI), tableau de santé des intégrations, délimitation du contenu non fiable (PH-03.5, dépend de T-1).
5. **Semaine 3-4 (Phase 4)** : accessibilité complète, contrastes, reduced-motion, fenêtrage chat.
6. **En continu** : décisions produit (Photos/Galerie, Concerts/Calendar, brief quotidien, landing `/`) — chaque fusion est un ticket dédié avec migration de lecture seule.

### Résultat produit attendu

Un produit **sûr à laisser connecté à Gmail/Calendar/To Do** (aucune action externe non confirmée), **fiable** (rappels synchronisés, backups serveur, erreurs visibles), **lisible** (5 destinations, labels cohérents), **accessible** (WCAG AA sur les parcours principaux) et **testé** (unitaires sur les zones critiques + E2E déterministes) — sans réécriture, en amélioration progressive, et sans perdre l'identité « éditeur sombre, chat d'abord » qui fait la valeur du produit.

---

*Fin du rapport. Aucun fichier applicatif n'a été modifié. Les commandes exécutées et leurs résultats figurent en §2.*

