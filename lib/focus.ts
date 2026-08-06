import { readJsonSafe, writeJsonAtomic } from "./storage";

export type FocusState = {
  active: boolean;
  startedAt?: string;
  durationMin?: number;
  endsAt?: string;
};

const FOCUS_FILE = "focus.json";
const defaultFocus: FocusState = { active: false };

const MIN_FOCUS_MIN = 5;
const MAX_FOCUS_MIN = 180;

/**
 * État du focus mode : pendant une session active, les notifications push
 * (rappels, relances) sont mises en silence — elles restent en attente et
 * partent après la fin de la session.
 */
export async function getFocusState(): Promise<FocusState> {
  const data = await readJsonSafe<FocusState>(FOCUS_FILE, defaultFocus);
  return {
    active: data?.active === true,
    startedAt: typeof data?.startedAt === "string" ? data.startedAt : undefined,
    durationMin: typeof data?.durationMin === "number" ? data.durationMin : undefined,
    endsAt: typeof data?.endsAt === "string" ? data.endsAt : undefined,
  };
}

export async function startFocus(durationMin: number): Promise<FocusState> {
  const clamped = Math.min(MAX_FOCUS_MIN, Math.max(MIN_FOCUS_MIN, Math.round(durationMin)));
  const next: FocusState = {
    active: true,
    startedAt: new Date().toISOString(),
    durationMin: clamped,
    endsAt: new Date(Date.now() + clamped * 60_000).toISOString(),
  };
  await writeJsonAtomic(FOCUS_FILE, next);
  return next;
}

export async function stopFocus(): Promise<FocusState> {
  const next: FocusState = { active: false };
  await writeJsonAtomic(FOCUS_FILE, next);
  return next;
}
