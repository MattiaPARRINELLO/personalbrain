import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notification — BACKSTAGE",
  robots: { index: false, follow: false },
};

export default function NotifLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-20">
        {children}
      </div>
    </div>
  );
}
