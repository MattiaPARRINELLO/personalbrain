import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/home/mattia/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const h = await page.evaluate(() => document.body.scrollHeight);
console.log("PAGE_HEIGHT:", h);
const fracs = [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
for (const f of fracs) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.floor(h * f));
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `/tmp/full-${Math.round(f * 100)}.png` });
}
await browser.close();
