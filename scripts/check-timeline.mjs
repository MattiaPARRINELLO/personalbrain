import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/home/mattia/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
// descendre à la timeline
await page.evaluate(() => document.querySelector("#journee")?.scrollIntoView());
await page.waitForTimeout(800);
const data = await page.evaluate(() => {
  const section = document.querySelector("#journee");
  // récupère la ligne de progression via sa hauteur animée
  const rows = Array.from(section?.querySelectorAll(".grid-cols-\\[auto_1fr\\]") ?? []);
  const rects = rows.map((r) => {
    const box = r.getBoundingClientRect();
    const firstChild = r.firstElementChild;
    const timeSpan = firstChild?.querySelector("span");
    const timeBox = timeSpan?.getBoundingClientRect();
    return { top: box.top, timeRight: timeBox?.right ?? null, timeWidth: timeBox?.width ?? null };
  });
  return { rows: rects };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
