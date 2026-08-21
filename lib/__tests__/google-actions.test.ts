import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../google-client", () => ({
  getCalendarClient: () => Promise.resolve({ credentials: { access_token: "tok" } }),
  getGmailClient: () => Promise.resolve({ credentials: { access_token: "tok" } }),
}));

import { extractBody, createGoogleCalendarEvent } from "../google-actions";

const b64 = (text: string) => Buffer.from(text, "utf-8").toString("base64");

async function captureEventBody(start: string, end: string) {
  let captured: {
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
  } | undefined;
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    captured = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: "evt-1" }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  try {
    await createGoogleCalendarEvent("Réunion", start, end);
  } finally {
    vi.unstubAllGlobals();
  }
  if (!captured) throw new Error("fetch n'a pas été appelé");
  return captured;
}

describe("extractBody", () => {
  it("renvoie le corps direct pour un email text/plain mono-part", () => {
    expect(extractBody(undefined, "text/plain", { data: b64("Bonjour Noann") })).toBe("Bonjour Noann");
  });

  it("extrait le texte d'un email HTML-only mono-part (pas de version texte)", () => {
    const html = "<html><body><p>Salut,</p><p>Rendez-vous demain à 14h.</p></body></html>";
    expect(extractBody(undefined, "text/html", { data: b64(html) })).toBe("Salut,\nRendez-vous demain à 14h.");
  });

  it("priorise la version texte quand les deux existent", () => {
    const parts = [
      { mimeType: "text/plain", body: { data: b64("Version texte") } },
      { mimeType: "text/html", body: { data: b64("<p>Version HTML</p>") } },
    ];
    expect(extractBody(parts, "multipart/alternative", undefined)).toBe("Version texte");
  });

  it("trouve le HTML dans des parts imbriquées (multipart/related)", () => {
    const parts = [
      {
        mimeType: "multipart/related",
        parts: [
          { mimeType: "multipart/alternative", parts: [{ mimeType: "text/html", body: { data: b64("<p>Nested</p>") } }] },
        ],
      },
    ];
    expect(extractBody(parts, "multipart/mixed", undefined)).toBe("Nested");
  });

  it("supprime style/script et normalise les sauts de ligne du HTML", () => {
    const html = "<style>.x{color:red}</style><script>alert(1)</script><div>A<br>B</div>";
    expect(extractBody(undefined, "text/html", { data: b64(html) })).toBe("A\nB");
  });

  it("décode les entités HTML courantes", () => {
    const html = "<p>a &amp; b &lt;c&gt; &nbsp; &quot;d&quot;</p>";
    expect(extractBody(undefined, "text/html", { data: b64(html) })).toBe('a & b <c> "d"');
  });

  it("retourne une chaîne vide quand il n'y a aucun contenu", () => {
    expect(extractBody(undefined, "text/html", undefined)).toBe("");
    expect(extractBody([{ mimeType: "image/png", body: { data: b64("img") } }], "multipart/mixed", undefined)).toBe("");
  });
});

describe("createGoogleCalendarEvent — fuseau horaire", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("ajoute le fuseau local pour une dateHeure naïve (sans décalage)", async () => {
    const body = await captureEventBody("2026-08-22T17:00:00", "2026-08-22T18:00:00");
    expect(body.start).toEqual({
      dateTime: "2026-08-22T17:00:00",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    expect(body.end.timeZone).toBeDefined();
  });

  it("laisse intacte une dateHeure avec décalage explicite (Z)", async () => {
    const body = await captureEventBody("2026-08-22T17:00:00Z", "2026-08-22T18:00:00Z");
    expect(body.start).toEqual({ dateTime: "2026-08-22T17:00:00Z" });
    expect(body.end).toEqual({ dateTime: "2026-08-22T18:00:00Z" });
  });

  it("laisse intacte une dateHeure avec décalage +02:00", async () => {
    const body = await captureEventBody("2026-08-22T17:00:00+02:00", "2026-08-22T18:00:00+02:00");
    expect(body.start).toEqual({ dateTime: "2026-08-22T17:00:00+02:00" });
  });

  it("conserve le format jour-entier (all-day) sans timeZone", async () => {
    const body = await captureEventBody("2026-08-22", "2026-08-23");
    expect(body.start).toEqual({ date: "2026-08-22" });
    expect(body.end).toEqual({ date: "2026-08-23" });
  });
});
