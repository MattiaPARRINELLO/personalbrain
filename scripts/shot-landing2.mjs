import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/home/mattia/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
// défilement progressif pour capturer la timeline
const positions = [
  ["top", 0],
  ["stats", 1050],
  ["journee-1", 1750],
  ["journee-2", 2500],
  ["journee-3", 3300],
  ["journee-4", 4200],
  ["journee-5", 5100],
  ["modules", 6400],
  ["prive", 7900],
  ["cta", 9000],
];
for (const [name, y] of positions) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `/tmp/landing-${name}.png` });
}
await browser.close();
