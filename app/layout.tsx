import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PwaLoader } from "@/components/ui/PwaLoader";
import { ThemeApplier } from "@/components/ui/ThemeApplier";
import { ViewTransitionProvider } from "@/components/ViewTransitionProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BACKSTAGE — Second Brain IA",
  description:
    "Second cerveau IA pour le code, la photo et la mémoire.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BACKSTAGE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#a5b4fc" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="application-name" content="BACKSTAGE" />
        <link rel="icon" type="image/png" href="/backstage-logo-simple.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

      </head>
      <body className="min-h-full relative font-sans">
        <PwaLoader />
        <ThemeApplier />
        <ViewTransitionProvider>
          {children}
        </ViewTransitionProvider>
      </body>
    </html>
  );
}
