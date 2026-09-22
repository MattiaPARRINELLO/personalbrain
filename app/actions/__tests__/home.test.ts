import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ScheduleCourse } from "@/lib/types";

const mockStorage = {
  getCourses: vi.fn(),
  getMemory: vi.fn(),
  getReminders: vi.fn(),
  listPendingIntentions: vi.fn(),
  getLeetcode: vi.fn(),
};

// Les helpers purs (getNextCourse, getCoursesInRange) restent réels : c'est la
// logique d'agrégation qu'on teste, seuls les loaders sont doublés.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, ...mockStorage };
});

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));

const { getHomeOverview } = await import("@/app/actions/home");

function course(over: Partial<ScheduleCourse> & { start: number; end: number }): ScheduleCourse {
  return {
    uuid: `u-${over.start}`,
    subject: "Cours",
    teacher: "Prof",
    room: "Salle 1",
    lessonType: "Seance de cours",
    cancelled: false,
    remote: false,
    description: "",
    group: "",
    ...over,
  };
}

const NOW = new Date("2026-03-10T10:00:00");
const at = (iso: string) => +new Date(iso);

describe("getHomeOverview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    mockStorage.getMemory.mockResolvedValue({ profile: { name: "Mattia" } });
    mockStorage.getCourses.mockResolvedValue([]);
    mockStorage.getReminders.mockResolvedValue({ reminders: [] });
    mockStorage.listPendingIntentions.mockResolvedValue([]);
    mockStorage.getLeetcode.mockResolvedValue({ streak: 0, history: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retourne un état vide cohérent sans donnée", async () => {
    const overview = await getHomeOverview();

    expect(overview).toEqual({
      name: "Mattia",
      currentCourse: null,
      nextCourse: null,
      laterToday: [],
      coursesLater: [],
      remindersToday: [],
      remindersLate: [],
      remindersLateCount: 0,
      pendingFollowups: 0,
      leetcodeStreak: 0,
      leetcodeSolvedToday: false,
      leetcodeConfigured: false,
    });
  });

  it("met à null un prénom vide", async () => {
    mockStorage.getMemory.mockResolvedValue({ profile: { name: "   " } });
    expect((await getHomeOverview()).name).toBeNull();
  });

  it("distingue le cours en cours, le suivant et le reste de la journée", async () => {
    mockStorage.getCourses.mockResolvedValue([
      course({ subject: "En cours", start: at("2026-03-10T09:00:00"), end: at("2026-03-10T11:00:00") }),
      course({ subject: "Suivant", start: at("2026-03-10T14:00:00"), end: at("2026-03-10T16:00:00") }),
      course({ subject: "Plus tard", start: at("2026-03-10T17:00:00"), end: at("2026-03-10T18:00:00") }),
      course({ subject: "Demain", start: at("2026-03-11T09:00:00"), end: at("2026-03-11T10:00:00") }),
    ]);

    const overview = await getHomeOverview();

    expect(overview.currentCourse?.subject).toBe("En cours");
    expect(overview.nextCourse?.subject).toBe("Suivant");
    expect(overview.laterToday.map((c) => c.subject)).toEqual(["Suivant", "Plus tard"]);
    expect(overview.coursesLater.map((c) => c.subject)).toEqual(["Demain"]);
  });

  it("borne les cours des jours suivants à 7 jours", async () => {
    mockStorage.getCourses.mockResolvedValue([
      course({ subject: "Demain", start: at("2026-03-11T09:00:00"), end: at("2026-03-11T10:00:00") }),
      course({ subject: "Dans 6 j", start: at("2026-03-16T09:00:00"), end: at("2026-03-16T10:00:00") }),
      course({ subject: "Dans 8 j", start: at("2026-03-18T09:00:00"), end: at("2026-03-18T10:00:00") }),
    ]);

    const overview = await getHomeOverview();

    expect(overview.coursesLater.map((c) => c.subject)).toEqual(["Demain", "Dans 6 j"]);
  });

  it("retient le premier cours du jour quand rien n'est en cours", async () => {
    mockStorage.getCourses.mockResolvedValue([
      course({ subject: "Matin", start: at("2026-03-10T08:00:00"), end: at("2026-03-10T09:00:00") }),
      course({ subject: "Après-midi", start: at("2026-03-10T14:00:00"), end: at("2026-03-10T16:00:00") }),
    ]);

    const overview = await getHomeOverview();

    expect(overview.currentCourse).toBeNull();
    expect(overview.nextCourse?.subject).toBe("Après-midi");
    expect(overview.laterToday.map((c) => c.subject)).toEqual(["Après-midi"]);
  });

  it("ignore les séances annulées", async () => {
    mockStorage.getCourses.mockResolvedValue([
      course({
        subject: "Annulé",
        cancelled: true,
        start: at("2026-03-10T09:00:00"),
        end: at("2026-03-10T11:00:00"),
      }),
    ]);

    const overview = await getHomeOverview();

    expect(overview.currentCourse).toBeNull();
    expect(overview.nextCourse).toBeNull();
    expect(overview.laterToday).toEqual([]);
  });

  it("sépare les rappels du jour des rappels en retard et ignore les traités", async () => {
    mockStorage.getReminders.mockResolvedValue({
      reminders: [
        { id: "r1", title: "Tôt", dueAt: "2026-03-10T08:00:00", status: "pending" },
        { id: "r2", title: "Tard", dueAt: "2026-03-10T20:00:00", status: "pending" },
        { id: "r3", title: "Hier", dueAt: "2026-03-09T10:00:00", status: "pending" },
        { id: "r4", title: "Fait", dueAt: "2026-03-10T09:00:00", status: "done" },
      ],
    });

    const overview = await getHomeOverview();

    expect(overview.remindersToday.map((r) => r.title)).toEqual(["Tôt", "Tard"]);
    expect(overview.remindersToday[0].late).toBe(true);
    expect(overview.remindersToday[1].late).toBe(false);
    expect(overview.remindersLate.map((r) => r.title)).toEqual(["Hier"]);
    expect(overview.remindersLateCount).toBe(1);
  });

  it("trie les rappels en retard du plus récent au plus ancien", async () => {
    mockStorage.getReminders.mockResolvedValue({
      reminders: [
        { id: "r1", title: "Il y a 5 j", dueAt: "2026-03-05T10:00:00", status: "pending" },
        { id: "r2", title: "Hier", dueAt: "2026-03-09T10:00:00", status: "pending" },
        { id: "r3", title: "Il y a 3 j", dueAt: "2026-03-07T10:00:00", status: "pending" },
      ],
    });

    const overview = await getHomeOverview();

    expect(overview.remindersLate.map((r) => r.title)).toEqual(["Hier", "Il y a 3 j", "Il y a 5 j"]);
  });

  it("remonte les relances en attente et la série LeetCode du jour", async () => {
    mockStorage.listPendingIntentions.mockResolvedValue([{ id: "i1" }, { id: "i2" }]);
    mockStorage.getLeetcode.mockResolvedValue({
      streak: 47,
      history: [
        { date: "2026-03-09T08:00:00.000Z", solved: true },
        { date: "2026-03-10T08:00:00.000Z", solved: true },
      ],
    });

    const overview = await getHomeOverview();

    expect(overview.pendingFollowups).toBe(2);
    expect(overview.leetcodeStreak).toBe(47);
    expect(overview.leetcodeSolvedToday).toBe(true);
  });

  it("signale une série non encore validée aujourd'hui", async () => {
    mockStorage.getLeetcode.mockResolvedValue({
      streak: 47,
      history: [{ date: "2026-03-09T08:00:00.000Z", solved: true }],
    });

    expect((await getHomeOverview()).leetcodeSolvedToday).toBe(false);
  });

  it("signale un compte LeetCode configuré même sans série", async () => {
    mockStorage.getLeetcode.mockResolvedValue({ streak: 0, history: [], leetcodeUsername: "someone" });
    expect((await getHomeOverview()).leetcodeConfigured).toBe(true);
  });
});
