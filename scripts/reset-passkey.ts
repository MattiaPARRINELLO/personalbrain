import { saveUserStore } from "../lib/auth";

async function main() {
  await saveUserStore({ credentials: [] });
  console.log("Passkey(s) supprimée(s) : data/users.json réinitialisé à { credentials: [] }.");
  console.log("Ouvre /login pour recommencer le setup de la clé d'accès.");
}

main().catch((err) => {
  console.error("[reset-passkey] Erreur:", err);
  process.exit(1);
});
