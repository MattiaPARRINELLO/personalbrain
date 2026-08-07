---
name: backstage-screenshots
description: Capturer des captures d'écran des pages BACKSTAGE (publiques et protégées) avec Playwright, en minant une session JWT pour les pages derrière login. À utiliser dès qu'un changement UI doit être vérifié visuellement avant/après.
---

# BACKSTAGE — Captures d'écran du site (pages publiques + protégées)

Workflow répété à chaque refonte/vérification UI du projet. Évite de recréer un
script jetable Playwright à chaque session.

## Quand l'utiliser

- Vérification visuelle avant/après un changement d'interface.
- Contrôle des pages protégées (derrière login passkey) : `/chat`, `/brain`,
  `/calendar`, `/gmail`, `/watch-later`, `/reminders`, `/search`, `/settings`,
  `/activity`, `/week`, `/focus`, `/leetcode`, `/photos`, `/gallery`, `/offline`,
  `/privacy`.
- Contrôle des pages publiques : `/` (landing), `/login`.

## Procédure

1. **Serveur de dev** : vérifier que le port 3000 répond
   (`ss -tlnp | grep :3000`). S'il est tombé ou si des process restants
   bloquent le port, utiliser la commande `/dev-restart` avant de capturer.
2. **Lancer le script** depuis la racine du projet :

   ```bash
   bun .mimocode/skills/backstage-screenshots/scripts/app-shots.mjs
   ```

   - Toutes les pages sont capturées par défaut dans `/tmp/app_*.png`.
   - Pages ciblées : `bun .mimocode/skills/backstage-screenshots/scripts/app-shots.mjs /chat /login`
   - Mode mobile (375×812) : `SHOT_DIR=/tmp/mobile bun ... --mobile`
   - Sortie autre : `SHOT_DIR=/tmp/avant bun ...`
3. **Inspecter les PNG** : l'agent principal n'a pas de vision — lire les
   captures via un subagent vision-capable
   (`actor run <type> "analyze the screenshots at /tmp/app_*.png" --model mimo/mimo-auto`)
   ou les afficher à l'utilisateur.
4. **Comparer avant/après** : garder deux dossiers (`/tmp/avant`, `/tmp/apres`)
   et donner au subagent vision les deux chemins.

## Détails techniques

- **Session mintée** : le script importe `signJwt` de `lib/session-core.ts`
  (le module Node/fs du projet — PAS `session-edge.ts`) et pose le cookie
  `pb_session` sur les pages protégées. `AUTH_SECRET` est chargé depuis
  `.env.local` par Bun automatiquement quand le script tourne depuis la racine
  du projet. Le JWT n'a pas besoin de `exp` (`verifyJwt` ne contrôle que s'il
  existe) ; `sub: "owner"` suffit.
- **Chromium** : chemin explicite
  `/home/mattia/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome` si
  présent (sinon `chromium.launch()`). Le chemin change quand Playwright est
  mis à jour — vérifier `ls ~/.cache/ms-playwright/`.
- **Pages protégées** : sans cookie, elles redirigent en 307 vers `/login`
  (capture inutile). Le script gère la liste automatiquement.
- **Pièges connus** :
  - `waitUntil: "networkidle"` peut timeout sur les pages avec streaming SSE
    (chat) ; le script attend ensuite 1,5 s — si une capture sort vide,
    augmenter ce délai.
  - Le serveur doit être lancé avec `bun dev` (pas un build statique) pour
    refléter le code en cours.
  - Toujours supprimer les scripts jetables recréés à la main ; ce skill est la
    version de référence.
