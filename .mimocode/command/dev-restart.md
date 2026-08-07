---
description: Tue les process Next.js restants et relance le serveur de dev sur le port 3000 proprement.
---

# Redémarrage du serveur de dev

Sert quand le port 3000 est bloqué par des process restants (next-server, next
dev, bun dev) ou après un build/une session interrompue.

1. Tuer les process restants (ne pas tuer `bun` utilisateur) :

   ```bash
   pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f "bun dev" 2>/dev/null; sleep 2
   ```

2. Vérifier que le port est libéré :

   ```bash
   ss -tlnp 2>/dev/null | grep ':3000' && echo "ENCORE PRIS" || echo "port 3000 libre"
   ```

   Si encore pris, re-killer le PID listé (`kill <pid>`), puis `sleep 2`.

3. Relancer le serveur en arrière-plan avec log :

   ```bash
   (bun dev > /tmp/backstage-dev.log 2>&1 &) ; sleep 8
   ```

4. Vérifier qu'il répond :

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://localhost:3000/
   ```

   `200` (ou 3xx) = OK. Sinon lire la fin du log :
   `tail -20 /tmp/backstage-dev.log`.

Si un build propre est nécessaire avant de relancer : après l'étape 2, ajouter
`rm -rf .next` avant le `bun dev`.
