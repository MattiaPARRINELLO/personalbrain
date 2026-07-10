import { test, expect } from "@playwright/test";

test("chat messages persist after being sent", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/chat");
  await page.waitForLoadState("networkidle");

  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 10000 });

  await textarea.fill("Test message");
  await textarea.press("Enter");

  // Wait for the user message to appear
  const userMsg = page.locator("text=Test message").first();
  await expect(userMsg).toBeVisible({ timeout: 15000 });

  // Wait a moment then verify the message is still there
  await page.waitForTimeout(2000);
  await expect(userMsg).toBeVisible();

  // Check no hydration errors
  expect(errors.filter((e) => e.includes("hydrat"))).toEqual([]);
  expect(errors.filter((e) => e.includes("Hydrat"))).toEqual([]);
});
