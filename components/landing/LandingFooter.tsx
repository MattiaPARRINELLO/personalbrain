import Link from "next/link";
import Image from "next/image";
import { FOOTER, GITHUB_URL } from "@/app/landing-content";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.06] py-12">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <Image
                src="/backstage-logo-simple.png"
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] object-contain"
              />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-[#f5f3f0]">
                Backstage
              </span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-[#7c7e8c]">
              {FOOTER.tagline}
            </p>
          </div>

          <nav aria-label="Liens de pied de page" className="grid grid-cols-2 gap-x-14 gap-y-2.5">
            {FOOTER.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded text-[12px] text-[#a5a7b3] transition-colors hover:text-[#f5f3f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]"
              >
                {link.label}
              </Link>
            ))}
            {FOOTER.legal.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded text-[12px] text-[#a5a7b3] transition-colors hover:text-[#f5f3f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="rounded text-[12px] text-[#7c7e8c] transition-colors hover:text-[#f5f3f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>

        <p className="mt-12 border-t border-white/[0.04] pt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-[#52525c]">
          {FOOTER.signature}
        </p>
      </div>
    </footer>
  );
}
