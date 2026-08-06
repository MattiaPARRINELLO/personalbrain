import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/home/mattia/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 150)); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 150)));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const checks = await page.evaluate(() => {
  const out = {};
  // Polices réellement utilisées
  const used = new Set();
  document.querySelectorAll("h1,h2,h3").forEach((el) => used.add(getComputedStyle(el).fontFamily.split(",")[0]));
  out.headingsFonts = [...used];
  const bodyFont = getComputedStyle(document.body).fontFamily.split(",")[0];
  out.bodyFont = bodyFont;
  // Présence des sections
  out.sections = ["#produit", "#modules", "#vie-privee", "#journee"].map((s) => s + ":" + !!document.querySelector(s));
  // Chevauchements de texte (h1 vs autres éléments)
  const h1 = document.querySelector("h1").getBoundingClientRect();
  out.h1 = { top: Math.round(h1.top), bottom: Math.round(h1.bottom), width: Math.round(h1.width) };
  // Contraste du texte secondaire
  const p = document.querySelector("main p");
  const pStyle = getComputedStyle(p);
  out.bodyTextColor = pStyle.color;
  out.bodyTextSize = pStyle.fontSize;
  // Vérifier que le terminal a bien ses lignes
  const terminal = document.querySelector('[class*="rounded-2xl"]');
  out.terminalPresent = !!terminal;
  // Stats réelles
  const statNums = [...document.querySelectorAll(".tabular-nums")].map((e) => e.textContent.trim());
  out.statNumbers = statNums;
  return out;
});
console.log(JSON.stringify(checks, null, 2));
console.log("CONSOLE_ERRORS:", errors.length ? errors : "aucune");
await browser.close();
