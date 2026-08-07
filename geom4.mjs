import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/home/mattia/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell",
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 20000 });
await page.waitForTimeout(1500);
const res = await page.evaluate(() => {
  const checkEl = document.querySelector(".login-check");
  const cs = getComputedStyle(checkEl);
  const r = checkEl.getBoundingClientRect();
  return { position: cs.position, inset: cs.inset, display: cs.display, w: Math.round(r.width), h: Math.round(r.height) };
});
console.log(JSON.stringify(res));
await browser.close();
