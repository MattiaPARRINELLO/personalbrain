import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/home/mattia/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell",
});
for (const vp of [{ width: 1280, height: 800 }, { width: 375, height: 667 }]) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1500);
  const res = await page.evaluate((viewport) => {
    const out = { overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    const ring = document.querySelector("button.login-ring");
    const r = ring?.getBoundingClientRect();
    const icon = ring?.querySelector("svg")?.getBoundingClientRect();
    out.ring = r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null;
    out.iconInRing = icon && r ? icon.x >= r.x && icon.y >= r.y && icon.x + icon.width <= r.x + r.width && icon.y + icon.height <= r.y + r.height : null;
    const all = [...document.querySelectorAll("h1,p,button,span")];
    out.offScreen = all
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > viewport.width + 1 || b.left < -1);
      })
      .slice(0, 5)
      .map((el) => el.textContent?.slice(0, 30));
    // status text visibility
    const statusText = [...document.querySelectorAll("span")]
      .map((el) => el.textContent ?? "")
      .find((t) => t.includes("SYSTÈME PRÊT") || t.includes("TOUCHE"));
    out.statusText = statusText ?? "(introuvable)";
    return out;
  }, vp);
  console.log(`[${vp.width}x${vp.height}]`, JSON.stringify(res));
  await page.close();
}
await browser.close();
