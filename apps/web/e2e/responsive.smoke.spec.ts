import { test, expect } from "@playwright/test";

/**
 * Responsive smoke: login page renders across viewports.
 * Full intake E2E can be expanded once a stable local server is running.
 */
test("login page is usable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Operator sign-in/i })).toBeVisible();
  await expect(page.getByLabel(/Email/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
});
