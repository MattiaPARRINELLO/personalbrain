// Utilitaires web partagés : recherche, récupération de métadonnées de page,
// extraction de texte et garde-fou anti-SSRF (bloque les URLs privées/réservées).

export async function webSearch(query: string): Promise<string> {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
        {
          signal: controller.signal,
          headers: {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": braveKey,
          },
        }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const results = data.web?.results ?? [];
        if (results.length > 0) {
          return results.slice(0, 3).map((r: { title: string; url: string; description: string }) =>
            `- ${r.title}\n  ${r.description}\n  ${r.url}`
          ).join("\n\n");
        }
        return `Aucun résultat web pour "${query}".`;
      }
    } catch {
      clearTimeout(timeout);
      // Fallback à DuckDuckGo
    }
  }

  // Fallback : recherche DuckDuckGo (gratuite, sans clé)
  const fallbackController = new AbortController();
  const fallbackTimeout = setTimeout(() => fallbackController.abort(), 10_000);
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
      { signal: fallbackController.signal }
    );
    clearTimeout(fallbackTimeout);
    if (res.ok) {
      const data = await res.json();
      const abstract = data.AbstractText;
      const results = data.RelatedTopics ?? [];
      if (abstract) {
        return abstract;
      }
      if (results.length > 0) {
        const texts = results.slice(0, 3).map((r: { Text?: string; Result?: string }) =>
          r.Text ?? r.Result ?? ""
        ).filter(Boolean);
        if (texts.length > 0) return texts.join("\n\n");
      }
    }
  } catch {
    clearTimeout(fallbackTimeout);
  }

  return `Recherche web pour "${query}" : aucun résultat trouvé.`;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Anti-SSRF : n'autorise que des URLs http(s) publiques. Bloque les adresses
// privées/réservées (localhost, RFC1918, link-local, metadata cloud) pour que
// le fetch automatique d'URLs utilisateur ne puisse pas atteindre le réseau
// interne ni les endpoints de métadonnées cloud.
// Si la résolution DNS échoue (hors-ligne), on laisse le fetch décider :
// une cible injoignable échouera naturellement sans exposer le réseau interne.

const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT (100.64.0.0/10)
  /^224\./,
  /^240\./,
];

const PRIVATE_IPV6_PATTERNS = [/^::1$/, /^fe80:/, /^fc/, /^fd/];

// Convertit un hostname en adresse IPv4 "dotted" si c'en est une, en gérant
// les formes exotiques (décimale 32-bit, octale, hexadécimale, IPv4-mapped)
// que les regex naïves laissent passer. Retourne null si ce n'est pas une IP.
function normalizeIpv4(hostname: string): string | null {
  const clean = hostname.replace(/^\[|\]$/g, "");

  // IPv4-mapped IPv6 en notation décimale : ::ffff:127.0.0.1 ou ::127.0.0.1
  const mapped = clean.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];

  // Une seule partie entière : entier 32 bits (décimal, 0x hexa ou 0 octal)
  if (/^\d+$/.test(clean) || /^0x[0-9a-f]+$/i.test(clean)) {
    try {
      const value = Number(clean);
      if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) return null;
      return `${(value >>> 24) & 0xff}.${(value >>> 16) & 0xff}.${(value >>> 8) & 0xff}.${value & 0xff}`;
    } catch {
      return null;
    }
  }

  // Quatre parties séparées par des points (éventuellement octal/hexa)
  const parts = clean.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const bytes: number[] = [];
  for (const p of parts) {
    // 0177 = octal ; 0x7f = hexa ; sinon décimal
    const base = p.startsWith("0x") ? 16 : p.startsWith("0") && p.length > 1 ? 8 : 10;
    const v = parseInt(p, base);
    if (Number.isNaN(v) || v < 0 || v > 255) return null;
    bytes.push(v);
  }
  return bytes.join(".");
}

// IPv4-mapped IPv6 normalisée par le runtime en hexa : ::ffff:7f00:1 → 127.0.0.1
function ipv6MappedToIpv4(hostname: string): string | null {
  const clean = hostname.replace(/^\[|\]$/g, "");
  const m = clean.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  if (hi > 0xffff || lo > 0xffff) return null;
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isPrivateAddress(address: string): boolean {
  const a = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (PRIVATE_IPV6_PATTERNS.some((p) => p.test(a))) return true;
  const ipv4 = normalizeIpv4(a) ?? ipv6MappedToIpv4(a);
  if (ipv4 !== null) {
    return PRIVATE_IPV4_PATTERNS.some((p) => p.test(ipv4));
  }
  return false;
}

export async function isSafeFetchUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost") return false;

  const isIpLiteral = /^[\d.]+$/.test(hostname) || hostname.includes(":");
  if (isIpLiteral) {
    return !isPrivateAddress(hostname);
  }

  // Hostname DNS : refuser si l'une des adresses résolues est privée.
  try {
    const { lookup } = await import("dns/promises");
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return !addresses.some(({ address }) => isPrivateAddress(address));
  } catch {
    return true;
  }
}

// Nombre maximal d'octets lus pour une page/aperçu (anti OOM / anti SSRF
// volumineux). 1 Mo est largement suffisant pour des métadonnées et résumés.
const MAX_FETCH_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

async function readBodyWithLimit(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    // Corps non streamable (certains runtimes/mocks) : on lit puis on vérifie.
    const text = await res.text();
    if (text.length > MAX_FETCH_BYTES) throw new Error("Réponse trop volumineuse");
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_FETCH_BYTES) {
      await reader.cancel();
      throw new Error("Réponse trop volumineuse");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8").decode(buf);
}

// Fetch serveur sûr : chaque saut de redirection est re-vérifié par
// isSafeFetchUrl (anti DNS rebinding et redirect vers IP privée) et le corps
// est limité en taille. Le DNS est résolu par le runtime au moment du fetch :
// c'est le meilleur compromis sans dépendance (undici Agent = variante robuste).
export async function safeFetchText(
  url: string,
  timeoutMs = 8000,
  headers: Record<string, string> = {}
): Promise<string> {
  if (!(await isSafeFetchUrl(url))) {
    throw new Error("URL non autorisée (adresse privée ou invalide)");
  }

  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BACKSTAGE/1.0)", ...headers },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirection sans cible");
      const nextUrl = new URL(location, currentUrl).toString();
      if (!(await isSafeFetchUrl(nextUrl))) {
        throw new Error("Redirection vers une URL non autorisée");
      }
      currentUrl = nextUrl;
      continue;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return readBodyWithLimit(res);
  }
  throw new Error("Trop de redirections");
}

export async function fetchPageMeta(url: string): Promise<{ title: string; thumbnail?: string }> {
  if (!(await isSafeFetchUrl(url))) {
    return { title: "URL non autorisée (adresse privée ou invalide)" };
  }
  try {
    const ytId = extractYouTubeId(url);
    if (ytId) {
      return {
        title: "",
        thumbnail: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
      };
    }

    const html = await safeFetchText(url, 5000);
    if (!html) return { title: "Impossible de récupérer la page" };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);

    return {
      title: ogTitle?.[1]?.trim() ?? titleMatch?.[1]?.trim() ?? "Titre non trouvé",
      thumbnail: ogImage?.[1] || undefined,
      description: ogDesc?.[1]?.trim(),
    } as { title: string; thumbnail?: string; description?: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const httpStatus = message.match(/^HTTP (\d+)$/);
    if (httpStatus) {
      return { title: `Impossible de récupérer la page (${httpStatus[1]})` };
    }
    return { title: "Erreur de récupération du titre" };
  }
}
