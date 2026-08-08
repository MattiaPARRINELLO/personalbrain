import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/home/mattia/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell",
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 20000 });
await page.waitForTimeout(1500);
const res = await page.evaluate(() => {
  const ring = document.querySelector("button.login-ring").getBoundingClientRect();
  const fpEl = document.querySelector(".login-fingerprint");
  const fp = fpEl.getBoundingClientRect();
  const parent = fpEl.parentElement;
  const parentStyle = getComputedStyle(parent);
  const fpStyle = getComputedStyle(fpEl);
  return {
    ring: { x: Math.round(ring.x), w: Math.round(ring.width) },
    fp: { x: Math.round(fp.x), w: Math.round(fp.width) },
    parentStyle: { display: parentStyle.display, position: parentStyle.position, align: parentStyle.alignItems, justify: parentStyle.justifyContent, inset: parentStyle.inset },
    fpPos: fpStyle.position,
    parentRect: (() => { const r = parent.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width) }; })(),
  };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
