import { describe, it, expect } from "vitest";
import { normalizeLesson, _extractLessonsJson } from "@/lib/cesar-client";
import {
  getCoursesForDay,
  getCoursesInRange,
  getNextCourse,
  getUpcomingCourses,
  getCoursesStartingSoon,
  formatCourse,
  courseNotifKey,
} from "@/lib/storage/schedule";
import type { ScheduleCourse } from "@/lib/types";

function course(partial: Partial<ScheduleCourse>): ScheduleCourse {
  return {
    uuid: "u1",
    subject: "E193 BASE DE DONNEES",
    teacher: "Alexandra HANNAT",
    room: "Salle 10, Batiment principal",
    start: new Date("2026-09-15T08:00:00").getTime(),
    end: new Date("2026-09-15T10:00:00").getTime(),
    lessonType: "Seance de cours",
    cancelled: false,
    remote: false,
    description: "",
    group: "",
    ...partial,
  };
}

describe("normalizeLesson", () => {
  it("extrait matiere, prof, salle+batiment et timestamps", () => {
    const c = normalizeLesson({
      uuid: "abc",
      startDate: 1000,
      endDate: 2000,
      schoolSubject: { name: "E16 JAVA" },
      teachers: [{ firstName: "Jean", lastName: "DUPONT" }],
      rooms: [{ name: "Salle 5", building: { name: "Batiment B" } }],
      lessonType: "TP",
      lessonStatus: "Actif",
    });
    expect(c).not.toBeNull();
    expect(c!.subject).toBe("E16 JAVA");
    expect(c!.teacher).toBe("Jean DUPONT");
    expect(c!.room).toBe("Salle 5, Batiment B");
    expect(c!.start).toBe(1000);
    expect(c!.end).toBe(2000);
    expect(c!.cancelled).toBe(false);
  });

  it("marque une seance annulee", () => {
    const c = normalizeLesson({
      uuid: "x",
      startDate: 1000,
      endDate: 2000,
      schoolSubject: { name: "E17 PYTHON" },
      lessonStatus: "Annule",
    });
    expect(c!.cancelled).toBe(true);
  });

  it("rejette une seance sans dates valides", () => {
    expect(normalizeLesson({ schoolSubject: { name: "X" } })).toBeNull();
    expect(normalizeLesson({ startDate: 2000, endDate: 1000 })).toBeNull();
  });

  it("gere l'absence de salle", () => {
    const c = normalizeLesson({ startDate: 1, endDate: 2, schoolSubject: { name: "E1" }, rooms: [] });
    expect(c!.room).toBe("");
  });
});

describe("requetes emploi du temps", () => {
  const courses = [
    course({ uuid: "a", subject: "E193 BASE DE DONNEES", start: new Date("2026-09-15T08:00:00").getTime(), end: new Date("2026-09-15T10:00:00").getTime() }),
    course({ uuid: "b", subject: "E22 ANGLAIS", start: new Date("2026-09-15T14:00:00").getTime(), end: new Date("2026-09-15T16:00:00").getTime() }),
    course({ uuid: "c", subject: "E193 BASE DE DONNEES", start: new Date("2026-09-17T09:00:00").getTime(), end: new Date("2026-09-17T12:00:00").getTime() }),
  ];

  it("filtre par jour", () => {
    expect(getCoursesForDay(courses, "2026-09-15").map((c) => c.uuid)).toEqual(["a", "b"]);
    expect(getCoursesForDay(courses, "2026-09-16")).toHaveLength(0);
  });

  it("filtre par plage", () => {
    const from = new Date("2026-09-15T12:00:00").getTime();
    const to = new Date("2026-09-16T00:00:00").getTime();
    expect(getCoursesInRange(courses, from, to).map((c) => c.uuid)).toEqual(["b"]);
  });

  it("retourne le prochain cours, filtrable par matiere", () => {
    const now = new Date("2026-09-15T09:00:00").getTime();
    // la seance en cours (a) est incluse : "a" tant qu'elle n'est pas terminee
    expect(getNextCourse(courses, undefined, now)!.uuid).toBe("a");
    expect(getNextCourse(courses, undefined, new Date("2026-09-15T10:30:00").getTime())!.uuid).toBe("b");
    expect(getNextCourse(courses, "base de donnees", now)!.uuid).toBe("a");
    expect(getNextCourse(courses, "anglais", now)!.uuid).toBe("b");
    const afterB = new Date("2026-09-15T17:00:00").getTime();
    expect(getNextCourse(courses, "base de donnees", afterB)!.uuid).toBe("c");
    expect(getNextCourse(courses, "inexistant", now)).toBeNull();
  });

  it("ignore les cours passes", () => {
    const now = new Date("2026-09-18T00:00:00").getTime();
    expect(getUpcomingCourses(courses, now)).toHaveLength(0);
    expect(getNextCourse(courses, undefined, now)).toBeNull();
  });

  it("formate un cours lisiblement", () => {
    const out = formatCourse(courses[0]);
    expect(out).toContain("E193 BASE DE DONNEES");
    expect(out).toContain("Salle 10");
  });

  it("selectionne les seances qui commencent dans les 30 min", () => {
    const soon = [
      course({ uuid: "s1", start: new Date("2026-09-15T09:20:00").getTime(), end: new Date("2026-09-15T11:00:00").getTime() }),
      course({ uuid: "s2", start: new Date("2026-09-15T10:05:00").getTime(), end: new Date("2026-09-15T12:00:00").getTime() }),
      course({ uuid: "s3", start: new Date("2026-09-15T08:00:00").getTime(), end: new Date("2026-09-15T12:00:00").getTime() }),
    ];
    const now = new Date("2026-09-15T09:00:00").getTime();
    expect(getCoursesStartingSoon(soon, 30, now).map((c) => c.uuid)).toEqual(["s1"]);
    expect(getCoursesStartingSoon(soon, 70, now).map((c) => c.uuid)).toEqual(["s1", "s2"]);
  });

  it("cle de notification stable par seance et avance", () => {
    expect(courseNotifKey(courses[0], 30)).toBe("a@30min");
    expect(courseNotifKey(course({ uuid: "" }), 30)).toContain("@30min");
  });
});

describe("_extractLessonsJson", () => {
  it("extrait et decode l'attribut lesson-schedules", () => {
    const payload = JSON.stringify([{ uuid: "1", startDate: 1, endDate: 2 }]);
    const html = `<div data-tui-calendar-event-lesson-schedules-value="${payload.replace(/"/g, "&quot;")}"></div>`;
    expect(JSON.parse(_extractLessonsJson(html))).toHaveLength(1);
  });

  it("echoue proprement sans attribut", () => {
    expect(() => _extractLessonsJson("<html></html>")).toThrow();
  });
});
