import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/home/mattia/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell",
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message.slice(0, 200)));

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 20000 });
await page.waitForTimeout(1400);
await page.screenshot({ path: "/tmp/login_idle.png" });
console.log("phase (real):", await page.locator("button[data-phase]").getAttribute("data-phase"));
console.log("status:", (await page.locator("button[data-phase] ~ div span").first().textContent().catch(()=>"(n/a)"))?.trim());

// Force each visual phase to screenshot the animations
const btn = page.locator("button.login-ring");
for (const phase of ["scanning", "verified", "error"]) {
  await btn.evaluate((el, p) => el.setAttribute("data-phase", p), phase);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `/tmp/login_${phase}.png` });
}
console.log("console errors:", errors.length ? errors : "none");
await browser.close();
