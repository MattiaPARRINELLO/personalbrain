import { PRIVACY } from "@/app/landing-content";

/**
 * Section sécurité — uniquement les garanties vérifiables dans le code :
 * auth par passkey, routes protégées par défaut, secrets serveur,
 * démo isolée, confirmation des actions sensibles, mémoire éditable.
 */
export function PrivacySection() {
  return (
    <section id="securite" className="control relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="section-label">· Sécurité ·</p>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-[#f5f3f0] sm:text-5xl">
            {PRIVACY.title}
            <span className="control__title-b block">{PRIVACY.titleB}</span>
          </h2>
          <p className="control__desc mt-5 max-w-xl">{PRIVACY.description}</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
          {PRIVACY.points.map((point, i) => (
            <div key={point.title} className="control__item" style={{ ["--item-i" as string]: i }}>
              <span className="control__item-n font-mono">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="control__item-title">{point.title}</h3>
                <p className="control__item-desc">{point.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
