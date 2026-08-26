import { GITHUB_URL, OPEN_SOURCE } from "@/app/landing-content";

/**
 * Section open source — code public, DeepSeek sous le capot,
 * développé avec OpenCode. Aucun partenariat suggéré.
 */
export function OpenSourceSection() {
  return (
    <section id="open-source" className="opensource relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">· Open source ·</p>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-[#f5f3f0] sm:text-5xl">
            {OPEN_SOURCE.title}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#a5a7b3]">
            {OPEN_SOURCE.description}
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] sm:grid-cols-3">
          {OPEN_SOURCE.techs.map((tech) => (
            <div key={tech.label} className="opensource__card">
              <p className="opensource__role font-mono">{tech.role}</p>
              <p className="opensource__label mt-2 font-display text-lg font-semibold text-[#f5f3f0]">
                {tech.label}
              </p>
              <p className="opensource__desc mt-2">{tech.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="cta-secondary">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            {OPEN_SOURCE.cta}
          </a>
        </div>
      </div>
    </section>
  );
}
