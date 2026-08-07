---
description: Vérifie que le projet compile, lint et passe les tests après une modification (tsc + ESLint + Vitest).
---

# Vérification complète post-modification

Lance les trois vérifications du projet BACKSTAGE et s'arrête sur les erreurs.
À exécuter après CHAQUE modification de code (règle AGENTS.md).

1. Typecheck :
   `bunx tsc --noEmit`
2. Lint :
   `bun run lint`
3. Tests (filtre optionnel : `$ARGUMENTS`) :
   `bun run test $ARGUMENTS`

Rapporte :

- **0 erreur** : tout est vert, résume en une ligne.
- **Erreurs** : liste exacte (fichier, ligne, message). Ne considère pas la
  tâche terminée tant que tsc/lint/test ne passent pas tous les trois.
  Les warnings lint pré-existants (ex. `no-unused-vars` dans
  `lib/__tests__/session-edge.test.ts`, `notification-scheduler.ts`) ne sont
  pas des blocs.

Pour valider un build de production complet en plus : `bun run build` (ajoute
quelques minutes ; ne le lancer que si demandé explicitement).
