"use client";

import { Pill } from "@/components/ui/Pill";
import type { MemoryData } from "@/lib/types";

export function ProfileCard({ profile }: { profile: MemoryData["profile"] }) {
  return (
    <div className="mb-6 p-5 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border-2)] flex items-center justify-center text-[var(--accent)] font-semibold text-[16px]">
          {profile.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)] font-mono">Profil</p>
          <h3 className="text-[15px] font-medium text-[var(--text-1)] mt-0.5">{profile.name}</h3>
          {profile.preferences.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {profile.preferences.map((p) => (
                <Pill key={p} tone="muted" dot>
                  {p}
                </Pill>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
