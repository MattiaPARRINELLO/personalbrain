# Migration React Native — BACKSTAGE

> **Principe** : conserver le backend Next.js en prod tel quel, ajouter un client React Native (Expo) qui consomme les mêmes API. Aucune suppression de fonctionnalité web. Backend quasi intact.

---

## Phase 0 — Préparation & analyse

- [ ] **0.1** — Audit complet des appels API depuis le frontend web : lister chaque `fetch()` et `Server Action` appelée par chaque page, avec la forme des requêtes/réponses.
- [ ] **0.2** — Documenter le flux d'authentification complet (login, session cookie, refresh, logout) pour le reproduire en React Native.
- [ ] **0.3** — Extraire une spécification OpenAPI/Swagger des routes `app/api/*` existantes (ou au moins un document textuel).
- [ ] **0.4** — Relever toutes les dépendances navigateur (WebAuthn, push, Service Worker, localStorage, Notification API, SpeechRecognition) à remplacer ou wrapper.
- [ ] **0.5** — Lister tous les `localStorage` utilisés pour le cache offline côté web → concevoir l'équivalent AsyncStorage/SQLite côté RN.
- [ ] **0.6** — Faire l'inventaire des icônes lucide-react utilisées → vérifier leur équivalent dans `lucide-react-native`.
- [ ] **0.7** — Définir l'arborescence de navigation React Native (expo-router) calquée sur le App Router Next.js actuel.

---

## Phase 1 — Initialisation du projet React Native (Expo)

- [ ] **1.1** — Créer le projet Expo : `npx create-expo-app@latest backstage-mobile --template blank-typescript`
- [ ] **1.2** — Configurer `app.json` / `app.config.ts` : nom, scheme, icône, splash screen, permissions Android.
- [ ] **1.3** — Installer les dépendances de base :
  - `expo-router` (navigation file-based)
  - `expo-constants`, `expo-linking`, `expo-status-bar`
  - `nativewind` + `tailwindcss` (pour réutiliser le design system Tailwind)
  - `react-native-reanimated`, `react-native-gesture-handler` (animations)
  - `axios` ou simple `fetch` wrapper pour les appels API
- [ ] **1.4** — Configurer `nativewind` avec le thème warm brutalist (variables CSS → configuration Tailwind RN).
- [ ] **1.5** — Importer les polices : Geist Sans et Space Mono (via `expo-font`).
- [ ] **1.6** — Créer le wrapper `api-client.ts` côté RN : base URL, envoi automatique du cookie de session, gestion des erreurs, retry.
- [ ] **1.7** — Créer le `AppShell` RN (SafeAreaView, StatusBar, thème dark forcé, fond `var(--bg)`).

---

## Phase 2 — Authentification mobile

### 2.1 — Adaptation backend (léger)
- [ ] **2.1.1** — Vérifier que les routes `/api/auth/session` et `/api/auth/logout` gèrent correctement les appels cross-origin depuis l'app mobile (CORS headers si nécessaire — normalement pas en same-origin proxy, mais à vérifier si le dev utilise `localhost` différent).
- [ ] **2.1.2** — Ajouter `POST /api/auth/mobile-google` (optionnel) — endpoint qui reçoit un `idToken` Google côté serveur, le vérifie, crée/set la session cookie JWT. (Alternative : le client envoie le token au même endpoint que le web si déjà compatible.)

### 2.2 — Google OAuth (React Native)
- [ ] **2.2.1** — Installer `@react-native-google-signin/google-signin`.
- [ ] **2.2.2** — Configurer le projet Firebase/Google Cloud Console pour l'app Android (nouveau client OAuth Android avec le SHA-1 de l'APK).
- [ ] **2.2.3** — Implémenter le flow : `GoogleSignin.signIn()` → récupère `idToken` → `POST /api/auth/mobile-google` → stocke le cookie de session.
- [ ] **2.2.4** — Gérer le cas déjà connecté : `GoogleSignin.getCurrentUser()` au démarrage de l'app.
- [ ] **2.2.5** — Ajouter le bouton "Connexion avec Google" sur l'écran de login RN (respecter les guidelines de marque Google).

### 2.3 — Passkey / WebAuthn (React Native)
- [ ] **2.3.1** — Installer `react-native-passkey` (wrapper autour de l'API Android Credential Manager).
- [ ] **2.3.2** — Reproduire le flow WebAuthn : `GET /api/auth/passkey/generate-registration-options` → création locale → `POST /api/auth/passkey/verify-registration` (enregistrement) et `generate-authentication-options` → `verify-authentication` (login).
- [ ] **2.3.3** — Adapter `@simplewebauthn/browser` → le code actuel utilise les API navigateur (`navigator.credentials`). Extraire une couche d'abstraction `lib/passkey-provider.ts` qui détecte l'environnement et utilise le bon backend (browser vs react-native-passkey).

### 2.4 — Session management
- [ ] **2.4.1** — Créer un `SessionProvider` React Native (contexte + AsyncStorage) qui stocke l'état connecté/déconnecté.
- [ ] **2.4.2** — Implémenter le refresh automatique de session (appel périodique à `/api/auth/session` pour vérifier validité).
- [ ] **2.4.3** — Gérer l'expiration de session → redirection vers l'écran de login.
- [ ] **2.4.4** — Implémenter la déconnexion : `POST /api/auth/logout` → vider AsyncStorage → rediriger vers login.

### 2.5 — Écran de login
- [ ] **2.5.1** — Créer `app/login.tsx` (ou `app/(auth)/login.tsx` si layout auth séparé).
- [ ] **2.5.2** — UI : branding BACKSTAGE, bouton Google, bouton Passkey, titre "Connexion".
- [ ] **2.5.3** — Gérer les états : chargement, erreur d'auth, première connexion vs retour.

---

## Phase 3 — Notifications push (FCM)

### 3.1 — Backend (ajouts légers)
- [ ] **3.1.1** — Installer `firebase-admin` dans le backend Next.js.
- [ ] **3.1.2** — Ajouter `POST /api/push/fcm-register` : reçoit `{ token: string }`, stocke dans `data/fcm-tokens.json` (similaire à `push-subscriptions.ts` pour le web).
- [ ] **3.1.3** — Ajouter `POST /api/push/fcm-unregister` : supprime un token FCM.
- [ ] **3.1.4** — Créer `lib/fcm-tokens.ts` : mêmes fonctions que `lib/push-subscriptions.ts` (`addFcmToken`, `removeFcmToken`, `getFcmTokens`).
- [ ] **3.1.5** — Modifier `lib/notification-scheduler.ts` : au moment d'envoyer les notifications, itérer aussi sur les tokens FCM et envoyer via `admin.messaging().sendEachForMulticast()`.
- [ ] **3.1.6** — Modifier `lib/notifications.ts` : refactorer `sendPushNotification` en dispatcher (web-push si endpoint web, FCM si token mobile).
- [ ] **3.1.7** — Ajouter les variables d'env pour Firebase (`FIREBASE_SERVICE_ACCOUNT_KEY` en JSON ou chemin).

### 3.2 — React Native (FCM)
- [ ] **3.2.1** — Installer `@react-native-firebase/app` + `@react-native-firebase/messaging`.
- [ ] **3.2.2** — Configurer Firebase pour Android : `google-services.json` dans `android/app/`, apply plugin dans `build.gradle`.
- [ ] **3.2.3** — Demander la permission de notifications au lancement (`messaging().requestPermission()`).
- [ ] **3.2.4** — Récupérer le token FCM → l'envoyer à `POST /api/push/fcm-register` (au login + au refresh du token via `onTokenRefresh`).
- [ ] **3.2.5** — Gérer les notifications foreground : afficher une alerte locale ou un toast in-app.
- [ ] **3.2.6** — Gérer les notifications background/terminée : ouverture de l'app sur la page cible.
- [ ] **3.2.7** — Gérer les notifications avec payload data (click_action vers une route spécifique comme `/reminders`, `/chat`).
- [ ] **3.2.8** — Gérer le deep linking depuis les notifications.

### 3.3 — Notifications locales (rappel in-app)
- [ ] **3.3.1** — Installer `expo-notifications` pour les notifications locales (horaire, rappel).
- [ ] **3.3.2** — Planifier les reminders localement (basé sur les données reçues de l'API `/api/reminders`).

---

## Phase 4 — Navigation & Layout

- [ ] **4.1** — Définir la structure de dossiers expo-router :
  ```
  app/
    (auth)/
      login.tsx
    (tabs)/
      _layout.tsx          # Tab bar (Chat, Brain, Calendar, Gmail, More)
      index.tsx            # Chat (page principale)
      brain.tsx
      calendar.tsx
      gmail.tsx
      more.tsx             # Accès aux pages secondaires
    reminders.tsx
    watch-later.tsx
    gallery.tsx
    search.tsx
    settings.tsx
    activity.tsx
    leetcode.tsx
    accreditations.tsx
    _layout.tsx            # Layout racine
  ```
- [ ] **4.2** — Implémenter la Tab Bar avec icônes lucide-react-native, style warm brutalist.
- [ ] **4.3** — Implémenter le layout racine (Providers : Session, QueryClient, API client, thème).
- [ ] **4.4** — Implémenter les transitions de navigation cohérentes avec le thème.
- [ ] **4.5** — Gérer le ViewTransitionProvider → le remplacer par des animations react-native-reanimated (ou skip pour v1).

---

## Phase 5 — Composants UI partagés

> Recréer en React Native tous les composants de `components/ui/` avec nativewind.

- [ ] **5.1** — `Button.tsx` : pressable avec variantes (primary, secondary, ghost, danger), états (loading, disabled).
- [ ] **5.2** — `Card.tsx` : conteneur avec bordure 1px, padding, style warm brutalist.
- [ ] **5.3** — `Pill.tsx` : badge/tag arrondi avec variantes de couleur.
- [ ] **5.4** — `Skeleton.tsx` : placeholder animé pour le chargement.
- [ ] **5.5** — `Markdown.tsx` : rendu markdown avec react-native-markdown-display ou équivalent (utilisé dans le Chat).
- [ ] **5.6** — `IconBadge.tsx` : icône dans un cercle avec compteur.
- [ ] **5.7** — `Toast.tsx` : notifications in-app type toast (succès, erreur, info).
- [ ] **5.8** — `OfflineBanner.tsx` : bandeau connecté/déconnecté avec `@react-native-community/netinfo`.
- [ ] **5.9** — `AccentPicker.tsx` : sélecteur de couleur d'accent (settings) → reproduire en RN.
- [ ] **5.10** — `CommandPalette.tsx` (optionnel v1) : raccourcis clavier → pas nécessaire sur mobile, ou remplacer par gestes.
- [ ] **5.11** — `KeyboardShortcuts.tsx` → skip (pas de clavier sur mobile).
- [ ] **5.12** — `ThemeApplier.tsx` → gestion du thème dark/light côté RN (si le thème light est supporté plus tard).

---

## Phase 6 — Écrans principaux

### 6.1 — Chat (/)
- [ ] **6.1.1** — Recréer `ChatLayout.tsx` : split view (liste des sessions + zone de chat) → sur mobile : navigation stack (liste → chat) ou swipe entre les deux.
- [ ] **6.1.2** — Recréer `SessionSidebar.tsx` : liste des sessions de chat avec titre, date, swipe-to-delete/archive.
- [ ] **6.1.3** — Recréer `ChatView.tsx` : messages avec Markdown, streaming temps réel via SSE (EventSource polyfill pour RN).
- [ ] **6.1.4** — Gérer le streaming SSE : afficher les tokens au fur et à mesure, état "en train d'écrire...", scroll automatique.
- [ ] **6.1.5** — Recréer `ChatComposer.tsx` : TextInput multiligne, bouton envoi, bouton micro (VoiceInput).
- [ ] **6.1.6** — Recréer `VoiceInput.tsx` : utiliser `expo-speech-recognition` ou `@react-native-voice/voice` pour la reconnaissance vocale.
- [ ] **6.1.7** — Appels à l'API : `POST /api/chat` avec streaming SSE, `GET/POST /api/chat/history` pour les sessions.
- [ ] **6.1.8** — Gérer l'état du chat : `ChatContext` (contexte React), état loading, erreur, messages vides.
- [ ] **6.1.9** — Gérer les tool calls côté client (l'IA peut retourner des appels d'outils → afficher les résultats).

### 6.2 — Brain (Knowledge Graph)
- [ ] **6.2.1** — Évaluer si le `KnowledgeGraph.tsx` actuel (probablement canvas/SVG/D3) peut tourner dans un WebView ou s'il faut le réimplémenter en react-native-skia.
- [ ] **6.2.2** — Option A (recommandé v1) : WebView pointant vers `/brain` du site web, avec injection du token de session.
- [ ] **6.2.3** — Option B (v2) : réimplémentation native avec `react-native-skia` + `d3` ou `react-native-graph`.
- [ ] **6.2.4** — Appels API : charges les données mémoire via `GET /api/memory`, actions CRUD via Server Actions `brain.ts`.

### 6.3 — Calendar
- [ ] **6.3.1** — Installer `react-native-big-calendar` ou `react-native-calendars`.
- [ ] **6.3.2** — Appels API : `GET/POST /api/calendar` (Google Calendar via le backend).
- [ ] **6.3.3** — Affichage mois/semaine/jour, navigation entre dates.
- [ ] **6.3.4** — Formulaire création/modification événement (titre, date, description, lieu).
- [ ] **6.3.5** — Widget `CalendarWidget.tsx` : mini-calendar sur l'accueil → adapter en RN.

### 6.4 — Gmail
- [ ] **6.4.1** — Liste des emails avec FlatList, pull-to-refresh.
- [ ] **6.4.2** — Appels API : `GET /api/gmail?maxResults=N`, `POST /api/gmail/reply`.
- [ ] **6.4.3** — Vue détail d'un email (expéditeur, sujet, date, corps).
- [ ] **6.4.4** — Répondre à un email : TextInput + envoi via `POST /api/gmail/reply`.
- [ ] **6.4.5** — Widget `GmailWidget.tsx` : aperçu inbox sur l'accueil → adapter en RN.
- [ ] **6.4.6** — Gérer le markdown/html dans les emails.

---

## Phase 7 — Écrans secondaires

- [ ] **7.1** — **Reminders** (`/reminders`) : liste, création, édition, statut (pending/done/snoozed), récurrence. Appels : actions `reminders.ts` + `GET/POST /api/reminders`.
- [ ] **7.2** — **Watch Later** (`/watch-later`) : liste par catégorie, ajout rapide (URL + notes), marquer comme lu. Appels : actions `watch-later.ts`.
- [ ] **7.3** — **Gallery** (`/gallery`) : kanban par statut (shooted/selecting/editing/delivered), drag & drop entre colonnes, formulaire CRUD. Appels : `GET/POST /api/gallery`. Implémenter le drag & drop avec `react-native-draggable-flatlist`.
- [ ] **7.4** — **Search** (`/search`) : barre de recherche, résultats regroupés par section (brain, chat, reminders, emails). Appels : actions `search.ts`.
- [ ] **7.5** — **Settings** (`/settings`) : configuration du modèle IA, thème, notifications, Google Calendar sync on/off, Google Gmail sync on/off, déconnexion. Appels : `GET/POST` config via `lib/config.ts` (probablement un endpoint `/api/settings` à créer si pas déjà fait).
- [ ] **7.6** — **Activity** (`/activity`) : journal chronologique des actions, filtres par type. Appels : actions `activity.ts`.
- [ ] **7.7** — **LeetCode** (`/leetcode`) : liste des exercices, stats, synchro. Appels : actions `leetcode.ts`.
- [ ] **7.8** — **Accreditations** (`/accreditations`) : liste des accréditations, ajout/modification/suppression. Appels : actions `accreditations.ts`.
- [ ] **7.9** — **Daily Brief** : notification push → à l'ouverture, afficher le daily brief (données de `GET /api/daily-brief`). Composant d'affichage du résumé.

---

## Phase 8 — Offline & cache

- [ ] **8.1** — Installer `@tanstack/react-query` pour la gestion du cache et des requêtes serveur.
- [ ] **8.2** — Configurer `persistQueryClient` avec `@tanstack/query-async-storage-persister` + AsyncStorage.
- [ ] **8.3** — Remplacer la logique `offlineFetch()` (`lib/offline.ts` → localStorage) par React Query avec `networkMode: 'offlineFirst'`.
- [ ] **8.4** — Installer `@react-native-community/netinfo` pour détecter l'état connecté/déconnecté.
- [ ] **8.5** — Afficher un bandeau "Hors-ligne" (composant `OfflineBanner`) quand déconnecté.
- [ ] **8.6** — Stratégie stale-while-revalidate : afficher les données en cache puis rafraîchir si connecté.
- [ ] **8.7** — File d'attente des mutations offline : si l'utilisateur crée/modifie un élément hors-ligne, le stocker et l'envoyer quand la connexion revient.
- [ ] **8.8** — Page "Hors-ligne" (`/offline`) → écran RN avec message et bouton "Réessayer".

---

## Phase 9 — Deep linking & Widgets

- [ ] **9.1** — Configurer les deep links dans `app.config.ts` (scheme `backstage://`).
- [ ] **9.2** — Associer les routes expo-router aux paths deep link (`backstage://reminders/xxx`, `backstage://chat`, etc.).
- [ ] **9.3** — Gérer l'ouverture depuis une notification FCM (payload `route`).
- [ ] **9.4** — Widgets Android (optionnel v1) : mini-calendar, prochains reminders sur l'écran d'accueil via `Glance` ou configuration native.
- [ ] **9.5** — Adapter les widgets existants (`CalendarWidget`, `GmailWidget`, `AccreditationsWidget`, `LeetCodeWidget`) pour l'écran "More" ou en bandeau sur le Chat.

---

## Phase 10 — Tests

- [ ] **10.1** — Tests unitaires des composants RN avec React Native Testing Library.
- [ ] **10.2** — Tests d'intégration des appels API avec MSW (Mock Service Worker) côté RN.
- [ ] **10.3** — Tests E2E avec Detox ou Maestro sur émulateur Android.
- [ ] **10.4** — Tests de non-régression web : s'assurer que les modifications backend (FCM, etc.) ne cassent pas le front web existant.
- [ ] **10.5** — Tests sur plusieurs tailles d'écran Android (petit, moyen, tablette).
- [ ] **10.6** — Tests en conditions réseau dégradées (edge, 3G, offline).

---

## Phase 11 — Build & déploiement APK personnel

> Pas de Play Store. Juste un APK installable sur ton téléphone.

- [ ] **11.1** — Configurer `eas.json` pour un build debug/preview (pas de keystore production nécessaire, EAS génère un keystore debug temporaire).
- [ ] **11.2** — Configurer les variables d'environnement dans EAS Secrets (API URL, OAuth client ID).
- [ ] **11.3** — Build APK debug avec `eas build --platform android --profile preview`.
- [ ] **11.4** — Installer l'APK sur le téléphone (USB + `adb install` ou QR code EAS).
- [ ] **11.5** — Configurer EAS Update pour les mises à jour over-the-air (modifs JS sans rebuild complet).
- [ ] **11.6** — Alternative sans EAS : build local avec `npx expo run:android` (nécessite Android Studio et le téléphone branché).

---

## Phase 12 — Post-build

- [ ] **12.1** — Monitoring des crashs : intégrer Sentry pour React Native.
- [ ] **12.2** — Itération v1.1 — corrections de bugs après usage réel.
- [ ] **12.3** — Roadmap v2 — fonctionnalités natives pures : widget écran d'accueil Android, mode Picture-in-Picture pour le chat IA, partage système (share intent Android).
- [ ] **12.4** — Penser à l'iOS si pertinent : build Expo pour iOS aussi.

---

## Récapitulatif des modifications backend

| Fichier | Changement |
|---|---|
| `lib/fcm-tokens.ts` | NOUVEAU — CRUD tokens FCM |
| `lib/notification-scheduler.ts` | MODIFIÉ — dispatcher FCM en plus de web-push |
| `lib/send-push.ts` | MODIFIÉ — ajouter `sendFcmMulticast()` |
| `app/api/push/route.ts` | MODIFIÉ — ajouter POST/DELETE pour `/fcm-register`, `/fcm-unregister` |
| `lib/passkey-provider.ts` | NOUVEAU — abstraction WebAuthn (browser vs RN) |
| `.env.local` | MODIFIÉ — ajouter `FIREBASE_SERVICE_ACCOUNT_KEY` |
| `package.json` | MODIFIÉ — ajouter `firebase-admin` |
| `app/api/auth/google/route.ts` | MODIFIÉ (optionnel) — supporter `idToken` POST en plus du flow navigateur |

Tout le reste du backend est inchangé.

---

## Récapitulatif des dépendances React Native à installer

```
expo-router
nativewind + tailwindcss
react-native-reanimated
react-native-gesture-handler
react-native-safe-area-context
react-native-screens
@react-navigation/native
@react-native-async-storage/async-storage
@tanstack/react-query
@react-native-google-signin/google-signin
react-native-passkey
@react-native-firebase/app
@react-native-firebase/messaging
expo-notifications
expo-font
expo-speech-recognition (ou @react-native-voice/voice)
lucide-react-native
react-native-markdown-display
react-native-big-calendar (ou react-native-calendars)
react-native-draggable-flatlist
@react-native-community/netinfo
react-native-webview
react-native-skia (optionnel, v2)
@tanstack/query-async-storage-persister
axios (ou garder fetch natif)
```
