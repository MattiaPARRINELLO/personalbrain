import { writeStorageState } from "./helpers";

// Exécuté une fois avant la suite : génère le storageState avec un cookie de
// session valide (signé avec AUTH_SECRET de l'environnement de lancement).
export default function globalSetup(): void {
  writeStorageState();
}
