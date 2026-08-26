"use client";

import { useRef, useState } from "react";
import { PUBLIC_DEMO } from "@/app/landing-content";

type DemoSource = { kind: string; title: string; detail: string };

type Status = "idle" | "loading" | "done" | "error";

const MAX_INPUT = 400;

/**
 * Mini-démo publique : interroge /api/demo (DeepSeek côté serveur,
 * contexte 100 % fictif). Aucun accès aux données réelles.
 */
export function PublicDemo() {
  const [status, setStatus] = useState<Status>("idle");
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [sources, setSources] = useState<DemoSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const ask = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || status === "loading") return;
    if (trimmed.length > MAX_INPUT) {
      setStatus("error");
      setError(PUBLIC_DEMO.errors.invalid);
      return;
    }
    setStatus("loading");
    setError(null);
    setReply("");
    setSources([]);

    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json()) as {
        reply?: string;
        sources?: DemoSource[];
        error?: string;
      };
      if (!res.ok || !data.reply) {
        setStatus("error");
        setError(
          res.status === 429
            ? PUBLIC_DEMO.errors.rate
            : data.error ?? PUBLIC_DEMO.errors.generic
        );
        return;
      }
      setReply(data.reply);
      setSources(data.sources ?? []);
      setStatus("done");
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      setStatus("error");
      setError(PUBLIC_DEMO.errors.generic);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  return (
    <section id="demo" className="pubdemo relative py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="text-center">
          <p className="section-label">· Démonstration ·</p>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-[#f5f3f0] sm:text-4xl">
            {PUBLIC_DEMO.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#a5a7b3]">
            {PUBLIC_DEMO.description}
          </p>
        </div>

        <form onSubmit={onSubmit} className="pubdemo__field mt-10">
          <label htmlFor="demo-input" className="sr-only">
            Votre question pour la démonstration
          </label>
          <input
            id="demo-input"
            type="text"
            value={question}
            maxLength={MAX_INPUT + 50}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={PUBLIC_DEMO.placeholder}
            autoComplete="off"
            className="pubdemo__input"
          />
          <button
            type="submit"
            disabled={status === "loading" || !question.trim()}
            className="pubdemo__submit"
          >
            {status === "loading" ? (
              <span className="pubdemo__spinner" aria-hidden />
            ) : (
              PUBLIC_DEMO.button
            )}
            <span className="sr-only" aria-live="polite">
              {status === "loading" ? "Réponse en cours" : ""}
            </span>
          </button>
        </form>

        {/* Suggestions */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {PUBLIC_DEMO.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={status === "loading"}
              onClick={() => {
                setQuestion(suggestion);
                void ask(suggestion);
              }}
              className="pubdemo__suggestion"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Erreur */}
        {status === "error" && (
          <p className="pubdemo__error mt-6 text-center" role="alert">
            {error}
          </p>
        )}

        {/* Réponse */}
        {reply && (
          <div ref={resultRef} className="pubdemo__result mt-8" aria-live="polite">
            <p className="pubdemo__question font-mono">{question}</p>
            <p className="pubdemo__reply mt-4">{reply}</p>

            {sources.length > 0 && (
              <div className="pubdemo__sources mt-6">
                <p className="pubdemo__sources-label font-mono">{PUBLIC_DEMO.contextLabel}</p>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {sources.map((source) => (
                    <li key={source.title} className="pubdemo__source">
                      <span className="pubdemo__source-kind font-mono">{source.kind}</span>
                      <p className="pubdemo__source-title">{source.title}</p>
                      <p className="pubdemo__source-detail">{source.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="pubdemo__disclaimer mt-10 text-center font-mono" role="note">
          {PUBLIC_DEMO.disclaimer}
        </p>

        {/* Après la démonstration */}
        {status === "done" && (
          <div className="pubdemo__after mt-14 text-center">
            <h3 className="font-display text-2xl font-bold tracking-tight text-[#f5f3f0]">
              {PUBLIC_DEMO.after.title}
            </h3>
            <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-[#a5a7b3]">
              {PUBLIC_DEMO.after.text}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="/login"
                className="cta-secondary cta-secondary--solid"
              >
                {PUBLIC_DEMO.after.loginCta}
              </a>
              <a
                href="https://github.com/MattiaPARRINELLO/personalbrain"
                target="_blank"
                rel="noopener noreferrer"
                className="cta-secondary"
              >
                {PUBLIC_DEMO.after.githubCta}
              </a>
            </div>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#6b6d7a]">
              {PUBLIC_DEMO.after.note}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
