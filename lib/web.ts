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
    return ![
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^169\.254\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^0\./,
      /^::1$/,
      /^fe80:/,
      /^fc00:/,
      /^fd/,
    ].some((p) => p.test(hostname));
  }

  // Hostname DNS : refuser si l'une des adresses résolues est privée.
  try {
    const { lookup } = await import("dns/promises");
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return !addresses.some(({ address }) => {
      const a = address.toLowerCase();
      return (
        a === "::1" ||
        a.startsWith("127.") ||
        a.startsWith("10.") ||
        a.startsWith("192.168.") ||
        a.startsWith("169.254.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(a) ||
        a.startsWith("fe80:") ||
        a.startsWith("fc") ||
        a.startsWith("fd")
      );
    });
  } catch {
    return true;
  }
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

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BACKSTAGE/1.0)" },
    });
    if (!res.ok) return { title: `Impossible de récupérer la page (${res.status})` };
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);

    return {
      title: ogTitle?.[1]?.trim() ?? titleMatch?.[1]?.trim() ?? "Titre non trouvé",
      thumbnail: ogImage?.[1] || undefined,
      description: ogDesc?.[1]?.trim(),
    } as { title: string; thumbnail?: string; description?: string };
  } catch {
    return { title: "Erreur de récupération du titre" };
  }
}
