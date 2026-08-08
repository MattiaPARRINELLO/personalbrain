---
description: Vérifie la prod après un déploiement BACKSTAGE (deploy.sh) : page, routes protégées, cron avec/sans secret, env serveur.
---

# Vérification post-déploiement (brain.mprnl.fr)

À exécuter après CHAQUE `./deploy.sh`. Vérifie que le build est en ligne, que les
routes protégées répondent, que le `CRON_SECRET` est actif côté serveur et que
le `.env` de prod contient bien les clés attendues.

## 1. Déployer (si pas déjà fait)

```bash
./deploy.sh
```

- Build standalone + rsync + restart (cPanel API ou SSH). Si le script affiche
  « Redémarre manuellement depuis cPanel », faire Stop/Start dans
  cPanel → Setup Node.js App **avant** les vérifications.

## 2. Pages publiques

```bash
echo "/: $(curl -s -o /dev/null -w '%{http_code}' https://brain.mprnl.fr/)"
echo "/login: $(curl -s -o /dev/null -w '%{http_code}' https://brain.mprnl.fr/login)"
```

- `/` : 200 ou 307 (redirection selon session) ; `/login` : 200.
- Tout 404/500 ici = build incomplet ou app pas redémarrée → re-vérifier le restart.

## 3. Routes API protégées (401 attendu sans session)

```bash
for p in "api/auth/microsoft" "api/auth/microsoft/status" "api/todo" "api/calendar" "api/gmail"; do
  echo "/$p: $(curl -s -o /dev/null -w '%{http_code}' https://brain.mprnl.fr/$p)"
done
```

- **401** = route présente et protégée (bon état).
- **404** = la route n'est pas dans le build déployé → re-vérifier que le commit
  est inclus (`git log --oneline -1`) puis redéployer.

## 4. Cron protégé par secret (source .deploy.env)

```bash
set -a; source .deploy.env; set +a
echo "avec secret (200 attendu): $(curl -s -o /dev/null -w '%{http_code}' -X POST -H "x-cron-secret: $CRON_SECRET" https://brain.mprnl.fr/api/cron/reminders)"
echo "sans secret (401 attendu): $(curl -s -o /dev/null -w '%{http_code}' -X POST https://brain.mprnl.fr/api/cron/reminders)"
```

- 200 avec secret + 401 sans = `CRON_SECRET` injecté et fail-closed actif.
- 401 même avec secret = l'app n'a pas redémarré avec le nouveau `.env`.

## 5. Clés attendues dans le .env du serveur (SSH, noms seulement)

```bash
ssh -p 22 -o BatchMode=yes mattiapa@mattiaparrinello.fr 'for v in MICROSOFT_CLIENT_ID MICROSOFT_CLIENT_SECRET MICROSOFT_REDIRECT_URI CRON_SECRET GOOGLE_CLIENT_ID; do grep -q "^$v=." /home/mattiapa/brain.mprnl.fr/.env && echo "$v: OK" || echo "$v: ABSENTE"; done' 2>&1 | grep -v "post-quantum\|store now\|may need to be upgraded"
```

- Toutes `OK` = l'env de prod est à jour (les valeurs ne sont jamais affichées).
- `ABSENTE` = le `.env` généré par `deploy.sh` n'a pas la clé → compléter
  `.deploy.env` et redéployer.

## Pièges connus

- **401 partout après déploiement** : l'app tourne encore avec l'ancien `.env`
  (restart manuel oublié) ou le rsync a échoué en cours de route.
- **404 sur une route API** : build déployé antérieur au commit qui l'a ajoutée.
- **Cron 401 avec secret** : l'ancien process n'a pas relu le nouveau `.env`.
- Ne jamais afficher les valeurs de `.deploy.env` / du `.env` serveur dans les
  rapports — seulement les noms de clés et codes HTTP.
