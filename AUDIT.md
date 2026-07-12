# Audit du projet : BACKSTAGE (PersonalBrain)

**Date :** 2026-07-12  
**Stack détectée :** Next.js 16.2.10 (App Router) · Bun · TypeScript 5 · Tailwind CSS v4 · Vitest 4 · Playwright · Capacitor 8  
**Taille estimée :** 131 fichiers · ~17 300 lignes de code  
**Tests :** 4 unitaires (473 lignes) + 3 e2e (102 lignes) = 575 lignes  
**Dépendances :** 25 directes · lockfile : `bun.lock`  
**Âge du projet :** 69 commits · 1 auteur · premier commit le 2026-07-02  
**Audité par :** AuditExpert

## Résumé exécutif

Projet personnel ambitieux (PWA second cerveau IA), bien architecturé côté feature et design system cohérent. Cependant, le maillon faible est **la sécurité** : le fichier `proxy.ts` censé protéger les routes API n'est pas activé (nommé `proxy.ts` au lieu de `middleware.ts`), laissant **tous les endpoints API sans authentification** — y compris chat, Gmail, Calendar, rappels et données personnelles. De plus, `zod` est utilisé dans 6 fichiers sans être déclaré dans `package.json`. La couverture de test est très faible (3,3% des fichiers). Les performances et la qualité du code sont globalement bonnes.

## Vue d'ensemble

| Catégorie | 🔴 Critiques | 🟡 Importants | 🟢 Mineurs |
|---|---|---|---|
| Architecture & Structure | 0 | 1 | 1 |
| Dépendances | 1 | 0 | 0 |
| Qualité du code | 0 | 2 | 2 |
| Sécurité | 2 | 3 | 0 |
| Configuration & Déploiement | 0 | 1 | 2 |
| Performance | 0 | 1 | 1 |
| Documentation | 0 | 0 | 2 |
| **Total** | **3** | **8** | **8** |

## Problèmes par sévérité

---

### 🔴 Critiques

#### 1. Middleware d'authentification inactif — `proxy.ts` (non chargé)

- **Fichier :** `proxy.ts` (ne devrait pas s'appeler `proxy.ts` — doit être `middleware.ts`)
- **Catégorie :** Sécurité / Architecture
- **Description :** Le fichier `proxy.ts` contient une logique de vérification de session JWT complète (`verifyJwt`, vérification de cookie `pb_session`, redirection vers `/login` pour les pages non authentifiées, rejet 401 pour les requêtes non-GET). Cependant, **Next.js ne charge que les fichiers nommés `middleware.ts`** (ou `middleware.js`) à la racine. `proxy.ts` est ignoré.
- **Impact :** **Aucun endpoint API n'est protégé.** Tous les routes sous `/api/` sauf `/api/auth/` sont accessibles sans authentification : chat, Gmail, Calendar, rappels, gallery, daily-brief, push notifications, memory, etc. Un attaquant pourrait lire les emails Gmail, le calendrier, les rappels, les données de mémoire, et chatter avec l'IA gratuitement.
- **Recommandation :** Renommer `proxy.ts` en `middleware.ts` OU intégrer `getSession()` en début de chaque route handler. La première option est plus DRY.

#### 2. Clé VAPID publique codée en dur — `public/sw.js:1`

- **Fichier :** `public/sw.js:1`
- **Catégorie :** Sécurité
- **Description :** La clé publique VAPID est hardcodée en clair dans le service worker :
  ```js
  const VAPID_PUBLIC_KEY = "BMmFNNXqVHLnhyokND2qq1ga3n1lq_4w1eTEhuU0Q-3f6wZUOMgQ0jeT03CkwsobgmRnxrmDPCGpj6FmLjP7bl0";
  ```
- **Impact :** Bien que VAPID public key soit conçue pour être publique, la coder en dur empêche sa rotation sans rebuild. Surtout, c'est un indicateur de pratique qui suggère que d'autres secrets pourraient être hardcodés. De plus, elle est dupliquée — elle existe aussi dans `.env.example` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`).
- **Recommandation :** Injecter la clé VAPID publique via une variable d'environnement ou un endpoint `/api/config` plutôt que de la coder en dur. Le service worker peut aussi la récupérer lors de l'installation.

#### 3. `zod` utilisé sans être déclaré dans `package.json`

- **Fichiers :** `app/actions/brain.ts:4`, `app/actions/photography.ts:4`, `app/actions/watch-later.ts:4`, `app/actions/reminders.ts:4`, `app/actions/accreditations.ts:4`, `app/api/memory/remember/route.ts:2`
- **Catégorie :** Dépendances
- **Description :** Le package `zod` est importé et activement utilisé pour la validation de schémas dans 6 fichiers, mais **n'apparaît pas dans `package.json`** (ni en `dependencies` ni en `devDependencies`). Il est installé en tant que dépendance transitive via `eslint-config-next` ou un autre package.
- **Impact :** Si une mise à jour casse la dépendance transitive ou si elle est nettoyée, `zod` disparaît et l'application plante au runtime. C'est une bombe à retardement.
- **Recommandation :** Ajouter `"zod": "^3"` (ou la version utilisée) dans `dependencies` de `package.json`.

---

### 🟡 Importants

#### 4. Server Actions sans vérification de session

- **Fichiers :** `app/actions/*.ts` (12 fichiers)
- **Catégorie :** Sécurité / Architecture
- **Description :** Aucune des 12 Server Actions (`brain.ts`, `memory.ts`, `chat-history.ts`, `reminders.ts`, `watch-later.ts`, `search.ts`, `activity.ts`, etc.) ne vérifie l'authentification. Elles sont marquées `"use server"` mais sans appel à `getSession()`.
- **Impact :** Toute action côté serveur (créer/mettre à jour/supprimer des données personnelles) peut être appelée sans être authentifié.
- **Recommandation :** Ajouter un helper `requireAuth()` qui appelle `getSession()` et lève une erreur si non authentifié, à placer en tête de chaque Server Action.

#### 5. API Chat sans authentification

- **Fichier :** `app/api/chat/route.ts:726`
- **Catégorie :** Sécurité
- **Description :** Le endpoint `POST /api/chat` n'a **aucune vérification de session**. Seul un rate limit IP (30 requêtes/minute) protège l'accès. La route est publique.
- **Impact :** N'importe qui peut chatter avec l'IA gratuitement, accéder aux outils (recherche web, emails, calendrier, mémoire, rappels) via les function calls. Coût IA à la charge du propriétaire.
- **Recommandation :** Ajouter `getSession()` au début du handler et retourner 401 si non authentifié.

#### 6. APIs Gmail et Calendar sans authentification

- **Fichiers :** `app/api/gmail/route.ts:20`, `app/api/calendar/route.ts:18`
- **Catégorie :** Sécurité
- **Description :** `GET /api/gmail` et `GET /api/calendar` n'ont aucun garde d'authentification. Elles accèdent directement aux tokens Google OAuth stockés sur le disque et aux APIs Google.
- **Impact :** Un attaquant peut lire tous les emails Gmail et les événements du calendrier sans aucune vérification.
- **Recommandation :** Ajouter `getSession()` en début de ces handlers.

#### 7. Duplication de types entre `lib/types.ts` et `lib/api-client.ts`

- **Fichiers :** `lib/types.ts` (lignes 66-91) et `lib/api-client.ts` (lignes 1-26)
- **Catégorie :** Qualité du code
- **Description :** Les types `GmailMessage` et `CalendarEvent` sont définis deux fois : une fois dans `lib/types.ts` (le fichier central des types métier) et une fois dans `lib/api-client.ts` (types spécifiques au client API). Les définitions ont des champs différents (`messageId` dans api-client est absent de types.ts).
- **Impact :** Divergence potentielle entre les définitions. Un changement dans un fichier peut ne pas être répercuté dans l'autre, causant des bugs silencieux.
- **Recommandation :** Centraliser tous les types dans `lib/types.ts` et les importer depuis `api-client.ts`.

#### 8. `server-cache.ts` utilise des opérations synchrones bloquantes

- **Fichier :** `lib/server-cache.ts:19,30`
- **Catégorie :** Performance
- **Description :** `readFileSync()` et `writeFileSync()` sont utilisés pour charger/sauvegarder le cache. Ces opérations sont bloquantes et peuvent geler l'event loop, particulièrement problématique dans un contexte serveur.
- **Impact :** Pics de latence lors des accès cache si le fichier est volumineux ou sous charge.
- **Recommandation :** Remplacer par des versions asynchrones (`readFile`, `writeFile`) ou utiliser Redis/ioredis pour un cache serveur scalable.

#### 9. Rate limiter in-memory seulement

- **Fichier :** `app/api/chat/route.ts:15-47`
- **Catégorie :** Configuration & Déploiement
- **Description :** Le rate limiter du chat est une `Map<string, { tokens, lastRefill }>` en mémoire. Il est réinitialisé à chaque redémarrage du serveur. En environnement serverless (Vercel, etc.), chaque instance a son propre compteur — un attaquant peut simplement envoyer 30 requêtes par instance.
- **Impact :** Protection illusoire en environnement distribué. Facile à contourner.
- **Recommandation :** Utiliser un store externe (Upstash Redis, Database) ou un middleware rate-limit standardisé.

#### 10. API `/api/auth/set-session` — création de session sans vérification

- **Fichier :** `app/api/auth/set-session/route.ts:4-10`
- **Catégorie :** Sécurité
- **Description :** Ce endpoint accepte n'importe quel JWT valide (signé avec `AUTH_SECRET`) et crée une session. Si le secret JWT fuit, un attaquant peut forger un token et créer une session.
- **Impact :** Risque si `AUTH_SECRET` est compromis. Le flux Capacitor a besoin de ce mécanisme, mais il manque des gardes (vérification d'origine, CSRF).
- **Recommandation :** Ajouter une vérification d'en-tête `Origin` ou `Referer`, et/ou limiter ce endpoint aux requêtes provenant de l'app Capacitor (via un header secret partagé).

#### 11. Faible couverture de tests

- **Fichiers :** `lib/__tests__/*.test.ts` (4 fichiers, 473 lignes), `e2e/*.spec.ts` (3 fichiers, 102 lignes)
- **Catégorie :** Qualité du code
- **Description :** Seulement 575 lignes de tests pour 17 300 lignes de code (~3,3%). Les tests unitaires couvrent `utils.ts`, `session-core.ts`, `storage.ts`, `google-client.ts`. Aucun test pour les composants React, les pages, les API routes, les Server Actions.
- **Impact :** Aucune filet de sécurité pour les changements. Risque élevé de régressions.
- **Recommandation :** Ajouter des tests pour les composants (vitest avec happy-dom), les API routes, et les actions critiques. Visez au moins 30% de couverture.

---

### 🟢 Mineurs

#### 12. `tsconfig.json` cible ES2017

- **Fichier :** `tsconfig.json:3`
- **Catégorie :** Architecture & Structure
- **Description :** `"target": "ES2017"` est conservateur pour un projet Next.js 16 avec Node 20+/Bun. ES2022 ou ESNext serait plus approprié.
- **Recommandation :** Passer à `"target": "ES2022"`.

#### 13. Imports très longs dans le handler chat

- **Fichier :** `app/api/chat/route.ts:8`
- **Catégorie :** Qualité du code
- **Description :** La ligne 8 importe ~15 symboles depuis `@/lib/storage` sur une seule ligne. Cela nuit à la lisibilité et au diff.
- **Recommandation :** Reformater en imports multi-lignes ou importer `* as storage` et utiliser `storage.webSearch()`.

#### 14. Pas de source maps configurées

- **Catégorie :** Configuration & Déploiement
- **Description :** `next.config.ts` n'a pas d'option `productionBrowserSourceMaps` ou de configuration source map. Le debug en production sera difficile.
- **Recommandation :** Activer `productionBrowserSourceMaps: true` si pertinent, ou configurer les source maps pour Sentry/autre.

#### 15. `proxy.ts` inactif (décision délibérée documentée dans AGENTS.md)

- **Fichier :** `proxy.ts`
- **Catégorie :** Architecture & Structure
- **Description :** Le fichier `proxy.ts` contient une implémentation complète de middleware d'authentification mais il est explicitement désactivé (documenté dans AGENTS.md : « proxy.ts exists but is NOT auto-loaded by Next.js »). C'est une décision dangereuse qui crée une illusion de sécurité.
- **Recommandation :** Soit le supprimer complètement, soit le renommer en `middleware.ts` et l'activer. Le laisser en l'état est trompeur.

#### 16. Pas de headers de sécurité

- **Catégorie :** Configuration & Déploiement
- **Description :** Aucun header de sécurité n'est configuré : pas de CSP, pas de `X-Frame-Options`, pas de `X-Content-Type-Options`, pas de `Strict-Transport-Security`. Next.js permet de les configurer dans `next.config.ts`.
- **Recommandation :** Ajouter des headers de sécurité dans `next.config.ts` via `headers()`.

#### 17. Pas de validation d'entrée sur certaines API routes

- **Fichier :** `app/api/push/route.ts` (notamment le test de push)
- **Catégorie :** Qualité du code
- **Description :** Plusieurs routes API manquent de validation d'entrée avec des schémas (zod est déjà disponible). Les routes push envoient des notifications sans vérifier les permissions de l'expéditeur.
- **Recommandation :** Uniformiser la validation avec zod sur toutes les routes API.

#### 18. Documentation API manquante

- **Catégorie :** Documentation
- **Description :** Aucune documentation des endpoints API. Les caller clients (`lib/api-client.ts`) donnent un aperçu partiel mais pas de spécification complète.
- **Recommandation :** Envisager un OpenAPI/Swagger doc ou au minimum documenter chaque route dans son entête.

#### 19. Pas de CHANGELOG ni versioning sémantique

- **Catégorie :** Documentation
- **Description :** Le projet est en `"version": "0.1.0"` mais il n'y a pas de CHANGELOG.md ni d'historique des versions.
- **Recommandation :** Initialiser un CHANGELOG.md avec les changements actuels. Adopter le versioning sémantique.

---

## Statistiques

| Métrique | Valeur |
|---|---|
| Fichiers `.ts`/`.tsx` (hors node_modules) | 131 |
| Lignes de code (hors node_modules) | ~17 300 |
| Fichiers de test unitaires | 4 (473 lignes) |
| Fichiers de test e2e | 3 (102 lignes) |
| Total tests | 7 fichiers, 575 lignes (3,3%) |
| Couverture | Non configurée |
| Dépendances directes | 25 |
| Dépendances transitives | Non évalué (bun.lock) |
| Commits | 69 |
| Auteurs | 1 |
| Premier commit | 2026-07-02 |
| Dernier commit | 2026-07-02 |

## Recommandations prioritaires

1. **🔴 Immédiat** : Renommer `proxy.ts` → `middleware.ts` pour activer la protection d'authentification sur toutes les routes API.
2. **🔴 Immédiat** : Ajouter `zod` dans `dependencies` de `package.json` (`bun add zod`).
3. **🟡 Court terme** : Ajouter `getSession()` en tête des Server Actions critiques (`brain.ts`, `memory.ts`, `reminders.ts`).
4. **🟡 Court terme** : Ajouter `getSession()` dans `app/api/chat/route.ts`, `app/api/gmail/route.ts`, `app/api/calendar/route.ts`.
5. **🟡 Moyen terme** : Supprimer la duplication de types entre `lib/types.ts` et `lib/api-client.ts`.
6. **🟡 Moyen terme** : Remplacer les opérations synchrones dans `server-cache.ts` par des versions asynchrones.
7. **🟢 Long terme** : Ajouter des tests pour les composants, pages et API routes.
8. **🟢 Long terme** : Configurer les headers de sécurité (CSP, HSTS, etc.).

---

*Audit généré automatiquement par AuditExpert. Les corrections n'ont pas été appliquées.*
