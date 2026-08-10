import { saveUserStore, SETUP_CONSUMED_FILE } from "../lib/auth";
import { promises as fs } from "fs";

async function main() {
  await saveUserStore({ credentials: [] });
  // Purge le marqueur de bootstrap : le SETUP_TOKEN redevient utilisable
  // pour le prochain enregistrement (le bootstrap doit être rejouable
  // uniquement via cette procédure explicite).
  try {
    await fs.unlink(SETUP_CONSUMED_FILE);
    console.log("Marqueur de bootstrap supprimé : le setup est réinitialisé.");
  } catch {
    // Pas de marqueur : rien à purger.
  }
  console.log("Passkey(s) supprimée(s) : data/users.json réinitialisé à { credentials: [] }.");
  console.log("Ouvre /login pour recommencer le setup de la clé d'accès.");
}

main().catch((err) => {
  console.error("[reset-passkey] Erreur:", err);
  process.exit(1);
});
