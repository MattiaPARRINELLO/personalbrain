import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/home/mattia/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell",
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 20000 });
await page.waitForTimeout(1500);
const res = await page.evaluate(() => {
  const ring = document.querySelector("button.login-ring").getBoundingClientRect();
  const fp = document.querySelector(".login-fingerprint").getBoundingClientRect();
  const check = document.querySelector(".login-check").getBoundingClientRect();
  const ringCx = ring.x + ring.width / 2, ringCy = ring.y + ring.height / 2;
  const fpCx = fp.x + fp.width / 2, fpCy = fp.y + fp.height / 2;
  const checkCx = check.x + check.width / 2, checkCy = check.y + check.height / 2;
  return {
    fpCenterOffset: { dx: Math.round(ringCx - fpCx), dy: Math.round(ringCy - fpCy) },
    checkCenterOffset: { dx: Math.round(ringCx - checkCx), dy: Math.round(ringCy - checkCy) },
  };
});
console.log(JSON.stringify(res));
await browser.close();
