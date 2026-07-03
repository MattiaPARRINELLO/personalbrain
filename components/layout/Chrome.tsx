"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  Brain,
  MessageSquareText,
  Bell,
  Bookmark,
  LogOut,
  Mail,
  CalendarRange,
  Check,
  X as XIcon,
  Sparkles,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, type GoogleLinkStatus } from "@/lib/api-client";
import { useCachedFetch, refreshCache } from "@/lib/cache";

type NavItem = {
  href: string;
  label: string;
  icon: typeof MessageSquareText;
  exact?: boolean;
};

const navItems: NavItem[] = [
  { href: "/", label: "Console IA", icon: MessageSquareText, exact: true },
  { href: "/brain", label: "Cerveau", icon: Brain },
  { href: "/reminders", label: "Rappels", icon: Bell },
  { href: "/watch-later", label: "À voir", icon: Bookmark },
  { href: "/accreditations", label: "Accréditations", icon: ShieldCheck },
  { href: "/calendar", label: "Calendrier", icon: CalendarRange },
  { href: "/gmail", label: "Gmail", icon: Mail },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

const GOOGLE_STATUS_KEY = "google:status";

async function fetchGoogleStatus(): Promise<GoogleLinkStatus> {
  return api.googleStatus();
}

export function LeftNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: status } = useCachedFetch<GoogleLinkStatus>(
    GOOGLE_STATUS_KEY,
    fetchGoogleStatus,
    { ttl: 60 * 1000 }
  );

  useEffect(() => {
    const id = setInterval(() => {
      void refreshCache(GOOGLE_STATUS_KEY, fetchGoogleStatus);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      router.replace("/login");
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  return (
    <aside className="hidden lg:flex flex-col w-[68px] shrink-0 h-full border-r border-[var(--border-1)] bg-[var(--surface-1)]/40">
      <div className="flex items-center justify-center h-16 border-b border-[var(--border-1)]">
        <div className="relative w-9 h-9 rounded-lg border border-[var(--border-2)] flex items-center justify-center bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-3)]">
          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)] breathe" />
        </div>
      </div>

      <nav className="flex-1 flex flex-col items-center gap-1 py-4">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "group relative w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200",
                active
                  ? "bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--border-2)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] border border-transparent"
              )}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[var(--accent)]" />
              )}
              <span className="pointer-events-none absolute left-full ml-3 px-2 py-1 rounded-md bg-[var(--surface-3)] border border-[var(--border-2)] text-[11px] text-[var(--text-1)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-2 py-4 border-t border-[var(--border-1)]">
        <GoogleStatusDot
          service="gmail"
          connected={status?.gmail ?? null}
          label="Gmail"
        />
        <GoogleStatusDot
          service="calendar"
          connected={status?.calendar ?? null}
          label="Calendrier"
        />
        <div className="my-1 w-6 h-px bg-[var(--border-1)]" />
        <button
          onClick={handleLogout}
          title="Déconnexion"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors duration-200"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}

function GoogleStatusDot({
  service,
  connected,
  label,
}: {
  service: "gmail" | "calendar";
  connected: boolean | null;
  label: string;
}) {
  const Icon = service === "gmail" ? Mail : CalendarRange;
  if (connected === null) {
    return (
      <div
        title={`${label} : vérification…`}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-4)]"
      >
        <span className="w-2 h-2 rounded-full bg-[var(--text-4)] animate-pulse" />
      </div>
    );
  }
  return (
    <a
      href={`/api/auth/google?type=${service}`}
      title={connected ? `${label} lié` : `Lier ${label} (clic pour connecter)`}
      className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 border",
        connected
          ? "border-[var(--success)]/30 bg-[var(--success)]/8 text-[var(--success)] hover:border-[var(--success)]/50"
          : "border-[var(--border-1)] bg-transparent text-[var(--text-4)] hover:text-[var(--text-1)] hover:border-[var(--border-3)]"
      )}
    >
      {connected ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
    </a>
  );
}

export function MobileTopBar() {
  return (
    <div className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-[var(--border-1)] bg-[var(--surface-1)]/60 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md border border-[var(--border-2)] flex items-center justify-center bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-3)]">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
        </div>
        <span className="text-[12px] font-semibold tracking-wide text-[var(--text-1)]">PersonalBrain</span>
      </div>
      <GoogleMobileStatus />
    </div>
  );
}

function GoogleMobileStatus() {
  const { data: status } = useCachedFetch<GoogleLinkStatus>(
    GOOGLE_STATUS_KEY,
    fetchGoogleStatus,
    { ttl: 60 * 1000 }
  );
  if (!status) return null;
  return (
    <div className="flex items-center gap-1.5">
      <a
        href="/api/auth/google?type=gmail"
        className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center border transition-colors",
          status.gmail
            ? "border-[var(--success)]/30 text-[var(--success)]"
            : "border-[var(--border-2)] text-[var(--text-3)]"
        )}
        title={status.gmail ? "Gmail lié" : "Lier Gmail"}
      >
        {status.gmail ? <Check className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
      </a>
      <a
        href="/api/auth/google?type=calendar"
        className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center border transition-colors",
          status.calendar
            ? "border-[var(--success)]/30 text-[var(--success)]"
            : "border-[var(--border-2)] text-[var(--text-3)]"
        )}
        title={status.calendar ? "Calendrier lié" : "Lier Calendrier"}
      >
        {status.calendar ? <Check className="w-3.5 h-3.5" /> : <CalendarRange className="w-3.5 h-3.5" />}
      </a>
    </div>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden flex items-center justify-around h-16 border-t border-[var(--border-1)] bg-[var(--surface-1)]/90 backdrop-blur px-2">
      {navItems.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200",
              active ? "text-[var(--accent)]" : "text-[var(--text-3)] hover:text-[var(--text-1)]"
            )}
          >
            <Icon className="w-5 h-5" strokeWidth={1.75} />
            <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8 pb-6 border-b border-[var(--border-1)]">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] font-mono mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-1)] text-balance leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[14px] text-[var(--text-2)] mt-2 max-w-2xl text-balance leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 border border-dashed border-[var(--border-1)] rounded-2xl bg-[var(--surface-1)]/40">
      {icon && (
        <div className="w-12 h-12 rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] flex items-center justify-center mb-4 text-[var(--text-3)]">
          {icon}
        </div>
      )}
      <h3 className="text-[14px] font-medium text-[var(--text-1)] mb-1.5">{title}</h3>
      {description && (
        <p className="text-[12px] text-[var(--text-3)] max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function CloseButton({ onClick, label = "Fermer" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
    >
      <XIcon className="w-3.5 h-3.5" />
    </button>
  );
}
