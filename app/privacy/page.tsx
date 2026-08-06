import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vie privée & données — BACKSTAGE",
  description:
    "Comment BACKSTAGE gère tes données : consentement IA, stockage, export et suppression.",
};

const SECTIONS = [
  {
    title: "Ce que BACKSTAGE stocke",
    body: "Tes données vivent dans des fichiers JSON sur ton propre serveur : conversations, emails (synchronisés depuis Gmail), événements d'agenda, rappels, faits de mémoire, accréditations, shootings et préférences. Les tokens Google OAuth et la clé de signature de session sont stockés sur le serveur, jamais exposés au navigateur.",
  },
  {
    title: "Consentement IA explicite",
    body: "Rien n'est envoyé à un fournisseur d'IA tant que tu n'as pas accepté l'écran de consentement, au premier usage. Tu peux retirer ce consentement à tout moment. Tes messages ne servent jamais à entraîner un modèle.",
  },
  {
    title: "Ce qui part vers l'IA",
    body: "Uniquement ce que tu écris dans le chat (après consentement), les résumés automatiques de pages que tu ajoutes à « À voir plus tard », et le brief quotidien si tu l'actives. Les appels passent par des API tierces (fournisseur IA, recherche web, météo) avec les données strictement nécessaires à la requête.",
  },
  {
    title: "Export de tes données",
    body: "Depuis Réglages → « Exporter mes données », tu télécharges un fichier JSON contenant l'ensemble de tes données métier (conversations, rappels, emails, mémoire, etc.), prêtes à être réimportées ailleurs.",
  },
  {
    title: "Suppression de ton compte",
    body: "Depuis Réglages → « Supprimer mon compte », toutes tes données sont effacées définitivement : conversations, rappels, emails en cache, mémoire, identifiants (passkeys) et tokens Google. Les sauvegardes automatiques sont supprimées également. Seule la clé technique du serveur est conservée.",
  },
  {
    title: "Aucune revente, aucun tracker",
    body: "BACKSTAGE ne revend aucune donnée, n'affiche aucune publicité et n'intègre aucun tracker publicitaire. L'application fonctionne avec un minimum de services tiers : le fournisseur d'IA, Google (Gmail/Agenda) et les services de notification push.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen relative flex flex-col">
      <header className="max-w-3xl mx-auto w-full px-6 py-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-[12px] font-black tracking-[0.25em] uppercase text-[var(--text-1)] font-mono hover:opacity-80 transition-opacity duration-200"
        >
          BACKSTAGE
        </Link>
        <Link
          href="/login"
          className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-200"
        >
          Connexion
        </Link>
      </header>

      <section className="max-w-3xl mx-auto w-full px-6 pt-10 pb-20">
        <h1 className="text-3xl sm:text-4xl font-black tracking-[0.1em] uppercase text-[var(--text-1)] font-mono">
          Vie privée & <span className="gradient-text-ai">données</span>
        </h1>
        <p className="mt-3 text-[13px] text-[var(--text-3)] leading-relaxed">
          BACKSTAGE est un espace personnel : tes données sont stockées sur ton
          propre serveur, jamais revendues, jamais utilisées pour entraîner un
          modèle. Dernière mise à jour : août 2026.
        </p>

        <div className="mt-10 space-y-5">
          {SECTIONS.map((s) => (
            <div
              key={s.title}
              className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/60 p-6"
            >
              <h2 className="text-[13px] font-semibold text-[var(--text-1)] font-mono uppercase tracking-wider">
                {s.title}
              </h2>
              <p className="mt-2 text-[13px] text-[var(--text-3)] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-[11px] text-[var(--text-4)] font-mono uppercase tracking-wider">
          Contact : gestion du compte directement dans l'application (Réglages).
        </p>
      </section>
    </main>
  );
}
