import { describe, it, expect } from "vitest";
import { extractBody } from "../google-actions";

const b64 = (text: string) => Buffer.from(text, "utf-8").toString("base64");

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
