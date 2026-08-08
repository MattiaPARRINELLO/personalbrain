// Barrel : conserve la surface publique historique du module storage.
// Le moteur bas niveau vit dans storage-core.ts, chaque domaine dans storage/<domaine>.ts.
export { readJsonSafe, writeJsonAtomic } from "./storage-core";
export * from "./storage/concerts";
export * from "./storage/gallery";
export * from "./storage/leetcode";
export * from "./storage/memory";
export * from "./storage/emails";
export * from "./storage/calendar";
export * from "./storage/reminders";
export * from "./storage/watch-later";
export * from "./storage/activity";
export * from "./storage/accreditations";
export * from "./storage/chat-history";
export * from "./storage/photo-shoots";
export * from "./storage/intentions";
export * from "./web";
