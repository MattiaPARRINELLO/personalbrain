// BACKSTAGE — captures d'écran (pages publiques + protégées avec session JWT mintée).
// Usage (depuis la racine du projet) :
//   bun .mimocode/skills/backstage-screenshots/scripts/app-shots.mjs
//   bun .mimocode/skills/backstage-screenshots/scripts/app-shots.mjs /chat /login
//   SHOT_DIR=/tmp/mobile bun .mimocode/skills/backstage-screenshots/scripts/app-shots.mjs --mobile
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const projectRoot = process.env.PROJECT_ROOT ?? "/home/mattia/Documents/Perso/personalbrain";
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const outDir = process.env.SHOT_DIR ?? "/tmp";

const args = process.argv.slice(2);
const mobile = args.includes("--mobile");
const requested = args.filter((a) => !a.startsWith("--"));

const allPages = [
  "/", "/login", "/chat", "/brain", "/calendar", "/gmail", "/watch-later",
  "/reminders", "/search", "/settings", "/activity", "/week", "/focus",
  "/leetcode", "/photos", "/gallery", "/offline", "/privacy",
];
// Pages qui redirigent (307) vers /login sans session valide.
const protectedPages = new Set(allPages.filter((p) => !["/", "/login"].includes(p)));
const pages = requested.length ? requested : allPages;

// Session : minter un JWT valide via le module de session Node du projet.
// AUTH_SECRET vient de .env.local (chargé par Bun) ou de data/.auth-secret.
const { signJwt } = await import(path.join(projectRoot, "lib/session-core.ts"));
const token = await signJwt({ sub: "owner" });

const chromiumPath = "/home/mattia/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome";
const browser = await (fs.existsSync(chromiumPath)
  ? chromium.launch({ executablePath: chromiumPath })
  : chromium.launch());

const viewport = mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 };
const suffix = mobile ? "-mobile" : "";

for (const p of pages) {
  const context = await browser.newContext({ viewport });
  if (protectedPages.has(p)) {
    await context.addCookies([{ name: "pb_session", value: token, url: baseUrl }]);
  }
  const page = await context.newPage();
  const file = path.join(outDir, `app_${p.replace(/^\//, "").replace(/\//g, "_")}${suffix}.png`);
  try {
    await page.goto(baseUrl + p, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: file });
    console.log("OK  ", p, "->", file);
  } catch (e) {
    console.log("FAIL", p, String(e).slice(0, 140));
  } finally {
    await context.close();
  }
}

await browser.close();
console.log("Done. Output:", outDir);
