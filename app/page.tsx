import type { Metadata } from "next";
import "./landing.css";
import { InstalledRedirect } from "@/components/landing/InstalledRedirect";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { MemorySection } from "@/components/landing/MemorySection";
import { DayStory } from "@/components/landing/DayStory";
import { PublicDemo } from "@/components/landing/PublicDemo";
import { UseCaseWorlds } from "@/components/landing/UseCaseWorlds";
import { PrivacySection } from "@/components/landing/PrivacySection";
import { OpenSourceSection } from "@/components/landing/OpenSourceSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Backstage — Votre second cerveau personnel",
  description:
    "Backstage relie vos conversations, votre mémoire et vos outils dans un espace personnel alimenté par l'IA.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Backstage",
    title: "Backstage — Votre second cerveau personnel",
    description:
      "Backstage relie vos conversations, votre mémoire et vos outils dans un espace personnel alimenté par l'IA.",
    images: [{ url: "/backstage-logo.png", width: 1280, height: 1280, alt: "Backstage" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Backstage — Votre second cerveau personnel",
    description:
      "Backstage relie vos conversations, votre mémoire et vos outils dans un espace personnel alimenté par l'IA.",
    images: ["/backstage-logo.png"],
  },
};

export default function Home() {
  return (
    <>
      <InstalledRedirect />
      <SmoothScroll>
        <LandingHeader />
        <main id="main" className="landing relative z-10">
          <HeroSection />
          <ProblemSection />
          <MemorySection />
          <DayStory />
          <PublicDemo />
          <UseCaseWorlds />
          <PrivacySection />
          <OpenSourceSection />
          <FinalCTA />
        </main>
        <div className="relative z-10">
          <LandingFooter />
        </div>
      </SmoothScroll>
    </>
  );
}
