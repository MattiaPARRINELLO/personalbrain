/**
 * Client CESAR 100% HTTP (aucun navigateur) — fonctionne en prod standalone.
 *
 * Pipeline : GET /connexion (CSRF) → POST login → skip écran CVEC →
 * GET /schedule → extraction de l'attribut data-tui-calendar-event-lesson-schedules-value
 * (JSON complet de toutes les séances) → normalisation.
 *
 * Identifiants : CESAR_USERNAME / CESAR_PASSWORD (env), base optionnelle CESAR_BASE.
 */
import type { ScheduleCourse } from "@/lib/types/schedule";
import { serverLog } from "./logger";

const CESAR_BASE = (process.env.CESAR_BASE || "https://cesar.emineo-education.fr").replace(/\/$/, "");
const TIMEOUT_MS = 45_000;

/** Normalise une séance brute CESAR (payload data-tui-calendar-event-lesson-schedules-value). */
export function normalizeLesson(item: Record<string, unknown>): ScheduleCourse | null {
  const schoolSubject = item.schoolSubject as { name?: string; label?: string } | undefined;
  const subject = String(schoolSubject?.name || schoolSubject?.label || "Cours").trim();
  const teachers = Array.isArray(item.teachers) ? item.teachers : [];
  const teacher = teachers
    .map((t: { firstName?: string; lastName?: string; fullName?: string; name?: string }) =>
      t?.fullName || t?.name || [t?.firstName, t?.lastName].filter(Boolean).join(" ")
    )
    .filter(Boolean)
    .join(", ");
  const rooms = Array.isArray(item.rooms) ? item.rooms : [];
  const roomList = rooms.map((r) => (typeof r === "string" ? r : r?.name || "")).filter(Boolean);
  const building = !(rooms[0] instanceof Object) || typeof rooms[0] !== "object" ? "" : rooms[0]?.building?.name || "";
  const room = building ? `${roomList.join(" / ")}${roomList.length ? ", " : ""}${building}` : roomList.join(" / ");
  const start = Number(item.startDate ?? item.start ?? item.startsAt ?? 0);
  const end = Number(item.endDate ?? item.end ?? item.endsAt ?? 0);
  if (!start || !end || !(end > start)) return null;

  return {
    uuid: String(item.uuid) || "",
    subject,
    teacher,
    room,
    start,
    end,
    lessonType: String(item.lessonType || ""),
    cancelled: item.cancelDesc != null || (item.lessonStatus ? item.lessonStatus !== "Actif" : false),
    remote: item.remote === true,
    description: String(item.description || ""),
    group: String((item.group as { name?: string } | undefined)?.name || ""),
  };
}

/** Extrait l'attribut lesson-schedules de la page (avec index de premier match — pas de regex backtracking sur 6 Mo). */
export function _extractLessonsJson(html: string): string {
  const key = "data-tui-calendar-event-lesson-schedules-value=\"";
  const i = html.indexOf(key);
  if (i === -1) throw new Error("attribut lesson-schedules absent du HTML");
  const start = i + key.length;
  // les guillemets internes sont echappes en &quot; : le prochain " brut termine l'attribut
  const end = html.indexOf('"', start);
  if (end === -1) throw new Error("attribut lesson-schedules non termine");
  return html
    .slice(start, end)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Récupère l'input hidden CSRF d'un formulaire. */
function extractCsrf(html: string, formNameRe: RegExp): string {
  const inputs = html.match(/<input[^>]*>/g) || [];
  for (const input of inputs) {
    const name = /name="([^"]*)"/.exec(input)?.[1];
    if (name && formNameRe.test(name)) return /value="([^"]*)"/.exec(input)?.[1] || "";
  }
  return "";
}

export async function fetchCesarSchedule(): Promise<ScheduleCourse[]> {
  const user = process.env.CESAR_USERNAME;
  const pass = process.env.CESAR_PASSWORD;
  if (!user || !pass) throw new Error("CESAR_USERNAME / CESAR_PASSWORD manquants");

  const cookies = new Map<string, string>();
  const track = (res: Response) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      if (i > 0) cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
  };
  const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  const postForm = (path: string, body: URLSearchParams, referer?: string) =>
    fetch(CESAR_BASE + path, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader(), ...(referer ? { Referer: CESAR_BASE + referer } : {}) },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  const get = (path: string) =>
    fetch(CESAR_BASE + path, { headers: { Cookie: cookieHeader() }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });

  // 1) page de login → token CSRF
  const r1 = await get("/connexion");
  track(r1);
  const loginHtml = await r1.text();
  const csrf = extractCsrf(loginHtml, /^(?:_?csrf_token)$/);
  if (!csrf) throw new Error("CSRF introuvable sur /connexion");

  // 2) POST login
  const r2 = await postForm("/connexion", new URLSearchParams({
    _username: user.trim(),
    _password: pass.trim(),
    _csrf_token: csrf,
    _referer: "",
  }), "/connexion");
  track(r2);
  if (r2.status !== 302 || r2.headers.get("location") === "/connexion") {
    throw new Error("login CESAR refuse");
  }

  // 3) écran CVEC éventuel → bouton "Rappeler plus tard"
  const home = await fetch(CESAR_BASE + "/", { headers: { Cookie: cookieHeader() }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  track(home);
  const homePath = home.status === 302 ? home.headers.get("location") || "/" : "/";
  if (homePath.includes("/televersement/cvec")) {
    const rc = await fetch(CESAR_BASE + homePath, { headers: { Cookie: cookieHeader() }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    track(rc);
    const hc = await rc.text();
    const skipName = /<button[^>]*name="(cvec_file\[[^\]]*\]|[^"]*skip[^"]*)"/.exec(hc)?.[1];
    const csrfKey = /<input[^>]*name="([^"]*token[^"]*)"/.exec(hc)?.[1];
    if (skipName) {
      const body = new URLSearchParams();
      if (csrfKey) body.set(csrfKey, extractCsrf(hc, new RegExp(`^${csrfKey!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)));
      body.set(skipName, "");
      const rs = await postForm(homePath, body, homePath);
      track(rs);
      console.log(`[cesar] ecran CVEC ignore (${rs.status})`);
    }
  }

  // 4) page EDT — chemins connus
  const candidatePaths = ["/schedule", "/emploi-du-temps"];
  let lastStatus = 0;
  for (const p of candidatePaths) {
    const r = await get(p);
    track(r);
    const html = await r.text();
    if (/\/(connexion|login)/.test(r.headers.get("location") || r.url)) continue;
    try {
      const lessons = _extractLessonsJson(html);
      const data = JSON.parse(lessons) as Record<string, unknown>[];
      const courses = data.map(normalizeLesson).filter((c): c is ScheduleCourse => !!c && !c.cancelled);
      courses.sort((a, b) => a.start - b.start);
      console.log(`[cesar] EDT recupere : ${courses.length} seances via ${p}`);
      return courses;
    } catch (err) {
      lastStatus = r.status;
      void serverLog("cesar", "warn", `Pas de lessons sur ${p} (${r.status})`, err);
    }
  }
  throw new Error(`emploi du temps introuvable sur ${candidatePaths.join(", ")} (dernier status ${lastStatus})`);
}
